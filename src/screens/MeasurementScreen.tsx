// ============================================================
// RUSH RUNNING — Tela de Medição Matinal (VFC)
// ------------------------------------------------------------
// A captura é REAL: fotopletismografia pela câmera ou intervalos
// R-R de um sensor BLE (GATT 0x180D). Há ainda entrada manual para
// quem mede em outro aplicativo/relógio.
//
// A classificação (favorável / atenção / recuperação) e o índice de
// prontidão vêm do backend depois do envio — esta tela não inventa
// nenhum valor fisiológico.
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PhysiologicalReadiness, SubjectiveFeedback } from '../types';
import { CAPTURE_DURATION_SECONDS, useHrvCapture } from '../hooks/useHrvCapture';
import type { MeasurementPayload } from '../hooks/useRushData';

interface MeasurementScreenProps {
  currentReadiness: PhysiologicalReadiness;
  hasMeasuredToday: boolean;
  onSubmitMeasurement: (payload: MeasurementPayload) => Promise<void>;
  onBackToHome: () => void;
}

type ScreenPhase = 'idle' | 'capturing' | 'manual' | 'subjective' | 'saving' | 'completed';

interface CapturedValues {
  rmssd_ms: number;
  hr_rest_bpm: number;
  duration_seconds: number;
  device_name: string | null;
  rr_count: number | null;
  quality: string;
}

const LIKERT = [1, 2, 3, 4, 5];

/** Escala Likert reutilizada pelas cinco perguntas de bem-estar. */
const LikertRow: React.FC<{
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}> = ({ label, hint, value, onChange }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center text-xs">
      <span className="font-label-caps text-[11px] text-[#e5e2e1] uppercase font-bold">{label}</span>
      <span className="font-telemetry text-xs text-[#FF5500] font-bold">{hint}</span>
    </div>
    <div className="grid grid-cols-5 gap-2">
      {LIKERT.map((val) => (
        <button
          key={val}
          type="button"
          onClick={() => onChange(val)}
          aria-pressed={value === val}
          className={`h-11 rounded font-headline-sm text-sm uppercase transition-all cursor-pointer ${
            value === val
              ? 'bg-[#FF5500] text-[#0D0D0D] font-extrabold shadow-[0_0_10px_rgba(255,85,0,0.5)]'
              : 'bg-[#141414] text-[#737373] border border-[#262626] hover:text-[#e5e2e1]'
          }`}
        >
          {val}
        </button>
      ))}
    </div>
  </div>
);

export const MeasurementScreen: React.FC<MeasurementScreenProps> = ({
  currentReadiness,
  hasMeasuredToday,
  onSubmitMeasurement,
  onBackToHome,
}) => {
  const capture = useHrvCapture();

  const [phase, setPhase] = useState<ScreenPhase>('idle');
  const [captured, setCaptured] = useState<CapturedValues | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [breathPhase, setBreathPhase] = useState<'INSPIRE' | 'EXPIRE'>('INSPIRE');

  // Entrada manual
  const [manualRmssd, setManualRmssd] = useState('');
  const [manualRhr, setManualRhr] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<SubjectiveFeedback>({
    sleepQuality: 4,
    fatigueLevel: 2,
    muscleSoreness: 2,
    stressLevel: 2,
    energyLevel: 4,
  });

  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  /* ---- a captura terminou: seguir para o questionário ---- */
  useEffect(() => {
    if (capture.phase === 'done' && capture.result) {
      setCaptured({
        rmssd_ms: capture.result.rmssd_ms,
        hr_rest_bpm: capture.result.hr_rest_bpm,
        duration_seconds: capture.result.duration_seconds,
        device_name: capture.result.device_name,
        rr_count: capture.result.rr_count,
        quality: capture.result.quality === 'alta' ? 'Alta (R-R suficientes)' : 'Média (poucos intervalos)',
      });
      setPhase('subjective');
    }
  }, [capture.phase, capture.result]);

  /* ---- guia de respiração 4s inspira / 4s expira ---- */
  useEffect(() => {
    if (phase !== 'capturing') return;
    const id = setInterval(() => setBreathPhase((p) => (p === 'INSPIRE' ? 'EXPIRE' : 'INSPIRE')), 4000);
    return () => clearInterval(id);
  }, [phase]);

  /* ---- desenho da onda PPG captada ---- */
  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas || phase !== 'capturing') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.fillStyle = '#101010';
    ctx.fillRect(0, 0, width, height);

    const data = capture.waveform;
    if (data.length < 2) return;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    ctx.beginPath();
    ctx.strokeStyle = '#FF5500';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(255,85,0,0.6)';
    ctx.shadowBlur = 8;

    const step = width / (data.length - 1);
    data.forEach((val, i) => {
      const y = height - ((val - min) / range) * (height - 20) - 10;
      const x = i * step;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [capture.waveform, phase]);

  const progressPct = useMemo(
    () => Math.round(((CAPTURE_DURATION_SECONDS - capture.secondsRemaining) / CAPTURE_DURATION_SECONDS) * 100),
    [capture.secondsRemaining],
  );

  const startCamera = async () => {
    setSaveError(null);
    setPhase('capturing');
    await capture.startCamera();
  };

  const startBle = async () => {
    setSaveError(null);
    setPhase('capturing');
    await capture.startBle();
  };

  const cancelCapture = () => {
    capture.cancel();
    setPhase('idle');
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);

    const rmssd = Number(manualRmssd);
    const rhr = Number(manualRhr);

    if (!isFinite(rmssd) || rmssd < 10 || rmssd > 200) {
      setManualError('O RMSSD precisa ser um número entre 10 e 200 ms.');
      return;
    }
    if (!isFinite(rhr) || rhr < 30 || rhr > 120) {
      setManualError('A FC de repouso precisa ser um número entre 30 e 120 bpm.');
      return;
    }

    setCaptured({
      rmssd_ms: Math.round(rmssd),
      hr_rest_bpm: Math.round(rhr),
      duration_seconds: 60,
      device_name: 'Entrada manual',
      rr_count: null,
      quality: 'Informado pelo atleta',
    });
    setPhase('subjective');
  };

  const submitAll = async () => {
    if (!captured) return;
    setSaveError(null);
    setPhase('saving');

    try {
      await onSubmitMeasurement({
        rmssd_ms: captured.rmssd_ms,
        rhr_bpm: captured.hr_rest_bpm,
        duration_seconds: captured.duration_seconds,
        device_name: captured.device_name,
        wellness: {
          sleep: feedback.sleepQuality,
          fatigue: feedback.fatigueLevel,
          soreness: feedback.muscleSoreness,
          stress: feedback.stressLevel,
          readiness: feedback.energyLevel,
        },
      });
      setPhase('completed');
    } catch (err: any) {
      setSaveError(err?.message || 'Não foi possível salvar a medição. Tente novamente.');
      setPhase('subjective');
    }
  };

  const restart = () => {
    capture.reset();
    setCaptured(null);
    setManualRmssd('');
    setManualRhr('');
    setPhase('idle');
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-5 pt-2 pb-8">
      {/* Barra de título */}
      <div className="flex items-center justify-between border-b border-[#262626] pb-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={onBackToHome}
            className="w-8 h-8 rounded bg-[#1C1C1C] flex items-center justify-center text-[#737373] hover:text-[#FF5500] hover:bg-[#262626] transition-colors cursor-pointer"
            aria-label="Voltar para o início"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div>
            <span className="font-label-caps text-[10px] text-[#FF5500] uppercase tracking-widest font-extrabold block">
              DIAGNÓSTICO MATINAL
            </span>
            <h1 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight">TELEMETRIA DE PRONTIDÃO</h1>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#1C1C1C] border border-[#262626]">
          <span
            className={`w-2 h-2 rounded-full ${capture.phase === 'capturing' ? 'bg-[#22C55E] animate-pulse' : 'bg-[#737373]'}`}
          />
          <span className="font-label-sm text-[10px] text-[#737373] uppercase font-bold">
            {capture.deviceName || (capture.source === 'camera' ? 'CÂMERA PPG' : 'SEM SENSOR')}
          </span>
        </div>
      </div>

      {/* Erro de captura */}
      {capture.errorMessage && (
        <div className="rounded-xl bg-[#EF4444]/12 border border-[#EF4444]/50 p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-[#EF4444] text-[22px] shrink-0">error</span>
          <div className="min-w-0">
            <span className="font-label-caps text-[11px] text-[#EF4444] uppercase font-extrabold block">
              MEDIÇÃO NÃO CONCLUÍDA
            </span>
            <p className="text-xs text-[#e5e2e1] mt-1 leading-relaxed">{capture.errorMessage}</p>
            <button
              onClick={restart}
              className="mt-2 text-xs text-[#FF5500] font-bold uppercase hover:underline cursor-pointer"
            >
              Escolher outra forma de medir
            </button>
          </div>
        </div>
      )}

      {/* FASE 1 — escolha da fonte */}
      {phase === 'idle' && (
        <div className="space-y-5">
          <div className="rounded-xl bg-[#1C1C1C] p-5 border border-[#262626] shadow-xl relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-[#FF5500]/10 rounded-full blur-2xl" />

            <div className="flex items-center space-x-2 text-[#FF5500] mb-3">
              <span className="material-symbols-outlined text-[22px]">info</span>
              <span className="font-label-caps text-xs uppercase tracking-wider font-extrabold">
                PROTOCOLO ORTOSTÁTICO PADRÃO
              </span>
            </div>

            <p className="font-body text-sm text-[#e5e2e1] leading-relaxed mb-4">
              A medição matinal analisa a variabilidade da frequência cardíaca (RMSSD) em repouso absoluto, mapeando o
              equilíbrio entre os sistemas nervosos simpático e parassimpático.
            </p>

            <div className="space-y-2.5 text-xs text-[#737373] bg-[#101010] p-4 rounded-lg border border-[#202020]">
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-[#FF5500] text-[16px]">check</span>
                <span>Permaneça deitado ou sentado, sem falar ou movimentar-se.</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-[#FF5500] text-[16px]">check</span>
                <span>Siga o ritmo de respiração guiado (4 segundos inspire / 4 expire).</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-[#FF5500] text-[16px]">check</span>
                <span>Duração de {CAPTURE_DURATION_SECONDS} segundos para captura dos intervalos R-R.</span>
              </div>
            </div>

            {hasMeasuredToday && (
              <div className="mt-4 rounded-lg bg-[#FACC15]/10 border border-[#FACC15]/40 px-3.5 py-2.5 flex items-start gap-2">
                <span className="material-symbols-outlined text-[#FACC15] text-[18px] shrink-0">history</span>
                <p className="text-xs text-[#e5e2e1] leading-relaxed">
                  Você já mediu hoje. Uma nova medição <strong>substitui</strong> a leitura do dia e recalcula a
                  prescrição.
                </p>
              </div>
            )}

            <div className="mt-5 space-y-2.5">
              <button
                onClick={startCamera}
                className="w-full h-14 bg-[#FF5500] hover:bg-[#FF6B00] active:scale-[0.99] text-[#0D0D0D] font-headline-sm uppercase tracking-wider rounded-xl flex items-center justify-center space-x-2 shadow-[0_0_20px_rgba(255,85,0,0.4)] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[24px]">photo_camera</span>
                <span>MEDIR PELA CÂMERA ({CAPTURE_DURATION_SECONDS}s)</span>
              </button>

              <button
                onClick={startBle}
                disabled={!capture.isBleSupported}
                className="w-full h-12 bg-[#1C1C1C] hover:bg-[#262626] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] text-[#F7F5F3] font-bold text-xs uppercase tracking-wider rounded-xl border border-[#353534] flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px] text-[#22C55E]">bluetooth</span>
                <span>
                  {capture.isBleSupported ? 'USAR CINTA / RELÓGIO BLE' : 'BLE INDISPONÍVEL NESTE NAVEGADOR'}
                </span>
              </button>

              <button
                onClick={() => setPhase('manual')}
                className="w-full h-12 bg-transparent hover:bg-[#141414] text-[#A1A1AA] hover:text-[#F7F5F3] font-bold text-xs uppercase tracking-wider rounded-xl border border-[#262626] flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">keyboard</span>
                <span>DIGITAR VALORES DE OUTRO APP</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-[#141414] p-4 border border-[#262626]">
            <span className="font-label-caps text-[10px] text-[#737373] uppercase tracking-wider font-bold block mb-2">
              ÚLTIMA PRONTIDÃO REGISTRADA
            </span>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-headline-md text-[#F7F5F3]">{currentReadiness.score}%</span>
                <span className="font-label-sm text-xs text-[#FF5500] ml-2 font-bold uppercase">
                  {currentReadiness.label}
                </span>
              </div>
              <span className="font-telemetry text-xs text-[#737373]">
                {currentReadiness.hrvRmssd ? `${currentReadiness.hrvRmssd} ms` : 'sem dados'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* FASE 1b — entrada manual */}
      {phase === 'manual' && (
        <form
          onSubmit={submitManual}
          className="rounded-xl bg-[#1C1C1C] p-5 border border-[#262626] shadow-xl space-y-4"
        >
          <div>
            <span className="font-label-caps text-xs text-[#FF5500] uppercase font-extrabold tracking-wider block">
              ENTRADA MANUAL
            </span>
            <h2 className="font-headline-sm text-[#F7F5F3] uppercase mt-1">INFORME A LEITURA DO SEU APARELHO</h2>
            <p className="font-body text-xs text-[#737373] mt-0.5">
              Use os valores de repouso medidos hoje pela manhã no seu relógio, cinta ou aplicativo de VFC.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="manual-rmssd" className="font-label-caps text-[11px] text-[#e5e2e1] uppercase font-bold block">
              RMSSD (ms) — entre 10 e 200
            </label>
            <input
              id="manual-rmssd"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={manualRmssd}
              onChange={(e) => setManualRmssd(e.target.value)}
              placeholder="ex.: 62"
              className="w-full h-12 rounded-lg bg-[#101010] border border-[#262626] px-3.5 font-telemetry text-[#F7F5F3] focus:border-[#FF5500] focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="manual-rhr" className="font-label-caps text-[11px] text-[#e5e2e1] uppercase font-bold block">
              FC de repouso (bpm) — entre 30 e 120
            </label>
            <input
              id="manual-rhr"
              type="number"
              inputMode="numeric"
              value={manualRhr}
              onChange={(e) => setManualRhr(e.target.value)}
              placeholder="ex.: 48"
              className="w-full h-12 rounded-lg bg-[#101010] border border-[#262626] px-3.5 font-telemetry text-[#F7F5F3] focus:border-[#FF5500] focus:outline-none"
            />
          </div>

          {manualError && (
            <p className="text-xs text-[#EF4444] font-bold" role="alert">
              {manualError}
            </p>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setPhase('idle')}
              className="h-12 px-4 rounded-xl bg-[#141414] border border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3] text-xs font-bold uppercase cursor-pointer"
            >
              Voltar
            </button>
            <button
              type="submit"
              className="flex-1 h-12 bg-[#FF5500] hover:bg-[#FF6B00] text-[#0D0D0D] font-headline-sm uppercase tracking-wider rounded-xl cursor-pointer"
            >
              Continuar
            </button>
          </div>
        </form>
      )}

      {/* FASE 2 — captura ao vivo */}
      {phase === 'capturing' && (
        <div className="space-y-5">
          <div className="rounded-xl bg-[#1C1C1C] p-5 border border-[#FF5500]/50 shadow-[0_0_25px_rgba(255,85,0,0.2)] relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF5500] animate-ping" />
                <span className="font-label-caps text-xs text-[#FF5500] font-black tracking-widest uppercase">
                  {capture.phase === 'connecting' ? 'CONECTANDO SENSOR…' : 'CAPTURA BIOMÉTRICA ATIVA'}
                </span>
              </div>
              <div className="font-telemetry text-sm text-[#F7F5F3] bg-[#101010] px-3 py-1 rounded border border-[#262626]">
                RESTAM: <span className="text-[#FF5500] font-extrabold">{capture.secondsRemaining}s</span>
              </div>
            </div>

            {/* Vídeo oculto: fonte dos frames PPG */}
            <video ref={capture.videoRef} playsInline muted className="hidden" />

            {capture.source === 'camera' && !capture.signalOk && (
              <div className="mb-4 rounded-lg bg-[#FACC15]/12 border border-[#FACC15]/40 px-3.5 py-2.5 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FACC15] text-[18px]">touch_app</span>
                <span className="text-xs text-[#e5e2e1]">
                  Cubra totalmente a câmera traseira e o flash com a ponta do dedo. O cronômetro pausa sem sinal.
                </span>
              </div>
            )}

            {/* Onda PPG ao vivo */}
            <div className="relative rounded-lg overflow-hidden border border-[#262626] bg-[#101010] mb-4">
              <canvas ref={waveCanvasRef} width={600} height={120} className="w-full h-28 object-cover block" />
              <div className="absolute top-2 left-2 flex items-center space-x-1.5 px-2 py-0.5 rounded bg-[#0D0D0D]/80 backdrop-blur-sm border border-[#202020]">
                <span className={`w-1.5 h-1.5 rounded-full ${capture.signalOk ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`} />
                <span className="font-telemetry text-[10px] text-[#737373]">
                  {capture.source === 'ble' ? 'INTERVALOS R-R VIA GATT 0x180D' : 'PPG WAVEFORM'}
                </span>
              </div>
            </div>

            {/* Leituras ao vivo */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#101010] p-3.5 rounded-lg border border-[#202020] text-center">
                <span className="font-label-caps text-[10px] text-[#737373] uppercase font-bold block">
                  FREQ. CARDÍACA INSTANTÂNEA
                </span>
                <div className="flex items-baseline justify-center space-x-1 mt-1">
                  <span className="font-metric-hero-mobile text-[#F7F5F3]">{capture.liveBpm ?? '--'}</span>
                  <span className="font-label-sm text-xs text-[#FF5500] font-bold">BPM</span>
                </div>
                <span className="font-label-sm text-[10px] text-[#22C55E]">
                  {capture.signalOk ? 'Sinal estável' : 'Aguardando sinal'}
                </span>
              </div>

              <div className="bg-[#101010] p-3.5 rounded-lg border border-[#202020] text-center">
                <span className="font-label-caps text-[10px] text-[#737373] uppercase font-bold block">
                  INTERVALOS R-R VÁLIDOS
                </span>
                <div className="flex items-baseline justify-center space-x-1 mt-1">
                  <span className="font-metric-hero-mobile text-[#FF5500]">{capture.rrCount}</span>
                  <span className="font-label-sm text-xs text-[#FF5500] font-bold">RR</span>
                </div>
                <span className="font-label-sm text-[10px] text-[#737373]">
                  O RMSSD é calculado no fim da captura
                </span>
              </div>
            </div>

            {/* Progresso */}
            <div className="mt-4">
              <div className="w-full h-1.5 bg-[#101010] rounded-full overflow-hidden border border-[#202020]">
                <div
                  className="h-full bg-[#FF5500] transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
                />
              </div>
            </div>

            {/* Guia de respiração */}
            <div className="mt-4 pt-4 border-t border-[#262626]">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-label-caps text-[10px] text-[#737373] uppercase font-bold">
                  GUIA DE RESPIRAÇÃO
                </span>
                <span className="font-label-caps text-xs text-[#FF5500] font-extrabold uppercase animate-pulse">
                  {breathPhase}
                </span>
              </div>
              <div className="w-full h-2 bg-[#101010] rounded-full overflow-hidden border border-[#202020]">
                <div
                  className="h-full bg-gradient-to-r from-[#FF5500] to-[#22C55E] transition-all duration-[4000ms] ease-in-out"
                  style={{ width: breathPhase === 'INSPIRE' ? '100%' : '15%' }}
                />
              </div>
            </div>

            <button
              onClick={cancelCapture}
              className="mt-4 w-full h-11 rounded-xl bg-[#141414] border border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3] text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Cancelar medição
            </button>
          </div>
        </div>
      )}

      {/* FASE 3 — questionário subjetivo */}
      {(phase === 'subjective' || phase === 'saving') && captured && (
        <div className="rounded-xl bg-[#1C1C1C] p-5 border border-[#262626] shadow-xl space-y-5">
          <div>
            <div className="flex items-center space-x-2 text-[#22C55E]">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              <span className="font-label-caps text-xs uppercase font-extrabold tracking-wider">
                LEITURA SENSORIAL CONCLUÍDA
              </span>
            </div>
            <h2 className="font-headline-sm text-[#F7F5F3] uppercase mt-1">AVALIAÇÃO SUBJETIVA DO ATLETA</h2>
            <p className="font-body text-xs text-[#737373] mt-0.5">
              Escala de percepção de 1 a 5, conforme o questionário de bem-estar de Hooper &amp; Mackinnon.
            </p>
          </div>

          {/* Resumo da captura */}
          <div className="grid grid-cols-3 gap-2.5 bg-[#101010] p-3.5 rounded-lg border border-[#202020]">
            <div>
              <span className="font-label-sm text-[10px] text-[#737373] uppercase block">RMSSD</span>
              <span className="font-telemetry-mono-lg text-[#FF5500]">{captured.rmssd_ms}</span>
              <span className="font-label-sm text-[10px] text-[#737373] ml-1">ms</span>
            </div>
            <div>
              <span className="font-label-sm text-[10px] text-[#737373] uppercase block">FC REPOUSO</span>
              <span className="font-telemetry-mono-lg text-[#F7F5F3]">{captured.hr_rest_bpm}</span>
              <span className="font-label-sm text-[10px] text-[#737373] ml-1">bpm</span>
            </div>
            <div>
              <span className="font-label-sm text-[10px] text-[#737373] uppercase block">QUALIDADE</span>
              <span className="text-[11px] text-[#e5e2e1] leading-tight block mt-1">{captured.quality}</span>
            </div>
          </div>

          <LikertRow
            label="1. Qualidade do sono & descanso"
            hint={`${feedback.sleepQuality}/5`}
            value={feedback.sleepQuality}
            onChange={(v) => setFeedback({ ...feedback, sleepQuality: v })}
          />
          <LikertRow
            label="2. Fadiga geral percebida"
            hint={feedback.fatigueLevel === 1 ? 'Sem fadiga' : feedback.fatigueLevel === 5 ? 'Exausto' : `${feedback.fatigueLevel}/5`}
            value={feedback.fatigueLevel}
            onChange={(v) => setFeedback({ ...feedback, fatigueLevel: v })}
          />
          <LikertRow
            label="3. Dor muscular tardia (DOMS)"
            hint={feedback.muscleSoreness === 1 ? 'Nenhuma dor' : feedback.muscleSoreness === 5 ? 'Muita dor' : `${feedback.muscleSoreness}/5`}
            value={feedback.muscleSoreness}
            onChange={(v) => setFeedback({ ...feedback, muscleSoreness: v })}
          />
          <LikertRow
            label="4. Nível de estresse mental"
            hint={`${feedback.stressLevel}/5`}
            value={feedback.stressLevel}
            onChange={(v) => setFeedback({ ...feedback, stressLevel: v })}
          />
          <LikertRow
            label="5. Disposição para treinar"
            hint={`${feedback.energyLevel}/5`}
            value={feedback.energyLevel}
            onChange={(v) => setFeedback({ ...feedback, energyLevel: v })}
          />

          {saveError && (
            <p className="text-xs text-[#EF4444] font-bold" role="alert">
              {saveError}
            </p>
          )}

          <button
            onClick={submitAll}
            disabled={phase === 'saving'}
            className="w-full h-14 bg-[#FF5500] hover:bg-[#FF6B00] disabled:opacity-60 disabled:cursor-wait active:scale-[0.99] text-[#0D0D0D] font-headline-sm uppercase tracking-wider rounded-xl flex items-center justify-center space-x-2 shadow-[0_0_20px_rgba(255,85,0,0.4)] cursor-pointer mt-4"
          >
            <span>{phase === 'saving' ? 'PROCESSANDO…' : 'PROCESSAR PRONTIDÃO FINAL'}</span>
            <span className="material-symbols-outlined text-[20px]">analytics</span>
          </button>
        </div>
      )}

      {/* FASE 4 — resultado vindo do backend */}
      {phase === 'completed' && (
        <div className="rounded-xl bg-[#1C1C1C] p-5 border border-[#FF5500] shadow-2xl space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#FF5500]/20 text-[#FF5500] mb-2">
              <span className="material-symbols-outlined text-[28px]">verified</span>
            </div>
            <span className="font-label-caps text-xs text-[#FF5500] uppercase font-bold tracking-widest block">
              DIAGNÓSTICO CONCLUÍDO
            </span>
            <h2 className="font-headline-lg text-[#F7F5F3] uppercase mt-1">SCORE: {currentReadiness.score}%</h2>
            <span className="font-label-caps text-xs text-[#FF5500] uppercase font-extrabold block mt-0.5">
              {currentReadiness.label}
            </span>
            <p className="font-body text-xs text-[#737373] max-w-sm mx-auto mt-2 leading-relaxed">
              {currentReadiness.advice}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 bg-[#101010] p-4 rounded-lg border border-[#202020]">
            <div>
              <span className="font-label-caps text-[10px] text-[#737373] uppercase font-bold">RHR DE HOJE</span>
              <div className="font-headline-sm text-[#F7F5F3] mt-0.5">{currentReadiness.restingHR} BPM</div>
            </div>
            <div>
              <span className="font-label-caps text-[10px] text-[#737373] uppercase font-bold">HRV RMSSD</span>
              <div className="font-headline-sm text-[#FF5500] mt-0.5">{currentReadiness.hrvRmssd} MS</div>
            </div>
            <div>
              <span className="font-label-caps text-[10px] text-[#737373] uppercase font-bold">VS. BASELINE</span>
              <div className="font-headline-sm text-[#F7F5F3] mt-0.5">{currentReadiness.hrvPercentage}%</div>
            </div>
          </div>

          <button
            onClick={onBackToHome}
            className="w-full h-14 bg-[#FF5500] hover:bg-[#FF6B00] active:scale-[0.99] text-[#0D0D0D] font-headline-sm uppercase tracking-wider rounded-xl flex items-center justify-center space-x-2 shadow-[0_0_20px_rgba(255,85,0,0.4)] cursor-pointer"
          >
            <span>VER TREINO ADAPTADO DE HOJE</span>
            <span className="material-symbols-outlined text-[20px]">check</span>
          </button>

          <button
            onClick={restart}
            className="w-full h-11 rounded-xl bg-[#141414] border border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3] text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            Refazer medição
          </button>
        </div>
      )}
    </div>
  );
};
