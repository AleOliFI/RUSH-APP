// ============================================================
// RUSH RUNNING — HUD de Corrida Ativa
// ------------------------------------------------------------
// Cronômetro, distância e pace vêm do GNSS real (useRunTracker).
// A frequência cardíaca vem de uma cinta BLE quando o atleta conecta.
// Cadência e potência dependem de footpod/medidor que o navegador não
// expõe: ficam como "—" em vez de serem estimadas.
// ============================================================

import React, { useEffect, useState } from 'react';
import { WorkoutPrescription } from '../../types';
import { formatClock, RunSummary, useRunTracker } from '../../hooks/useRunTracker';

interface ActiveRunModalProps {
  isOpen: boolean;
  workout: WorkoutPrescription;
  onClose: () => void;
  onFinishWorkout: (summary: RunSummary) => Promise<void>;
}

type ModalStage = 'pre-run' | 'countdown' | 'live' | 'saving';

/** Converte "4:35" ou "4:35/km" em segundos por km. */
function paceToSeconds(pace: string | null | undefined): number | null {
  if (!pace) return null;
  const match = /(\d+):(\d{2})/.exec(pace);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export const ActiveRunModal: React.FC<ActiveRunModalProps> = ({
  isOpen,
  workout,
  onClose,
  onFinishWorkout,
}) => {
  const tracker = useRunTracker();
  const [stage, setStage] = useState<ModalStage>('pre-run');
  const [countdownNum, setCountdownNum] = useState(3);
  const [isLocked, setIsLocked] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Ao abrir, começa a adquirir sinal de GNSS imediatamente.
  useEffect(() => {
    if (isOpen) {
      setStage('pre-run');
      setSaveError(null);
      tracker.prepare();
    } else {
      tracker.reset();
      setIsLocked(false);
    }
    // tracker é estável entre renders; depender dele reiniciaria a captura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Contagem regressiva antes da largada.
  useEffect(() => {
    if (stage !== 'countdown') return;
    setCountdownNum(3);
    const interval = setInterval(() => {
      setCountdownNum((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          tracker.start();
          setStage('live');
          return 1;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  if (!isOpen) return null;

  const hasSignal = tracker.gpsAccuracyM !== null && tracker.gpsAccuracyM <= 35;
  const gpsFailed = tracker.stage === 'error';

  const targetSeconds = paceToSeconds(workout.targetPace);
  const currentSeconds = paceToSeconds(tracker.instantPace);
  // Tolerância de 10 s/km em torno do pace prescrito.
  const paceVerdict =
    targetSeconds == null || currentSeconds == null
      ? null
      : currentSeconds < targetSeconds - 10
        ? 'rapido'
        : currentSeconds > targetSeconds + 10
          ? 'lento'
          : 'no-alvo';

  const handleFinish = async () => {
    const summary = tracker.finish();

    if (summary.distanceKm <= 0) {
      setSaveError('Nenhuma distância registrada pelo GPS — nada foi salvo.');
      return;
    }

    setStage('saving');
    try {
      await onFinishWorkout(summary);
      tracker.reset();
      onClose();
    } catch (err: any) {
      setSaveError(err?.message || 'Não foi possível salvar a corrida.');
      setStage('live');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="active-run-title"
      className="fixed inset-0 z-[60] bg-[#0D0D0D] flex flex-col text-[#F7F5F3] select-none"
    >
      {/* ============================================================ */}
      {/* 1. PRÉ-LARGADA — aquisição de sinal GNSS */}
      {/* ============================================================ */}
      {stage === 'pre-run' && (
        <div className="flex-1 flex flex-col justify-between p-6 max-w-lg mx-auto w-full overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${hasSignal ? 'bg-[#22C55E] animate-pulse' : 'bg-[#FACC15] animate-ping'}`}
              />
              <span
                className={`font-telemetry text-xs font-bold uppercase tracking-wider ${hasSignal ? 'text-[#22C55E]' : 'text-[#FACC15]'}`}
              >
                {gpsFailed ? 'GNSS INDISPONÍVEL' : hasSignal ? 'SESSÃO ARMADA • PRE-RUN' : 'ADQUIRINDO SINAL…'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-[#1C1C1C] text-[#A1A1AA] flex items-center justify-center hover:text-white cursor-pointer"
              aria-label="Cancelar largada"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>

          <div className="text-center space-y-4 my-auto">
            <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
              <div
                className={`absolute inset-0 rounded-full border ${hasSignal ? 'border-[#22C55E]/20' : 'border-[#FACC15]/20 animate-ping'}`}
              />
              <div className={`absolute inset-4 rounded-full border ${hasSignal ? 'border-[#22C55E]/40' : 'border-[#FACC15]/40'}`} />
              <div className={`absolute inset-10 rounded-full border ${hasSignal ? 'border-[#22C55E]/60' : 'border-[#FACC15]/60'}`} />
              <div
                className={`w-24 h-24 rounded-full bg-[#1C1C1C] border-2 flex flex-col items-center justify-center ${
                  hasSignal
                    ? 'border-[#22C55E] shadow-[0_0_30px_rgba(34,197,94,0.3)]'
                    : 'border-[#FACC15] shadow-[0_0_30px_rgba(250,204,21,0.25)]'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[36px] ${hasSignal ? 'text-[#22C55E]' : 'text-[#FACC15]'}`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {gpsFailed ? 'gps_off' : 'satellite_alt'}
                </span>
                <span
                  className={`font-telemetry text-xs font-black mt-0.5 ${hasSignal ? 'text-[#22C55E]' : 'text-[#FACC15]'}`}
                >
                  {tracker.gpsAccuracyM !== null ? `±${tracker.gpsAccuracyM} m` : '—'}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <h2 id="active-run-title" className="font-headline text-3xl uppercase tracking-normal">
                {gpsFailed ? 'Sinal GNSS não detectado' : hasSignal ? 'Posição travada' : 'Procurando satélites'}
              </h2>
              <p className="text-xs text-[#A1A1AA] max-w-xs mx-auto leading-relaxed">
                {gpsFailed
                  ? tracker.errorMessage
                  : hasSignal
                    ? `Precisão horizontal de ±${tracker.gpsAccuracyM} m. Distância e pace serão medidos pelo GPS do aparelho.`
                    : 'Vá para uma área aberta e mantenha o aparelho com visada livre para o céu.'}
              </p>
            </div>

            {/* Estado dos sensores — apenas o que existe de fato */}
            <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto pt-2 text-xs font-telemetry">
              <div className="bg-[#1C1C1C] p-2.5 rounded-xl border border-[#262626]">
                <span className="text-[#A1A1AA] block text-[9px] uppercase">GNSS</span>
                <span className={`font-bold ${hasSignal ? 'text-[#22C55E]' : 'text-[#FACC15]'}`}>
                  {tracker.gpsAccuracyM !== null ? `±${tracker.gpsAccuracyM} m` : 'sem sinal'}
                </span>
              </div>
              <button
                onClick={tracker.connectHeartRate}
                disabled={!tracker.isBleSupported || !!tracker.hrDeviceName}
                className="bg-[#1C1C1C] p-2.5 rounded-xl border border-[#262626] text-left disabled:cursor-default cursor-pointer hover:border-[#FF5500]/50 transition-colors"
              >
                <span className="text-[#A1A1AA] block text-[9px] uppercase">CINTA CARDÍACA</span>
                <span className={`font-bold ${tracker.hrDeviceName ? 'text-[#22C55E]' : 'text-[#FF5500]'}`}>
                  {tracker.hrDeviceName
                    ? `${tracker.hrDeviceName} OK`
                    : tracker.isBleSupported
                      ? 'Conectar'
                      : 'BLE indisp.'}
                </span>
              </button>
            </div>

            {/* Prescrição de referência */}
            <div className="bg-[#1C1C1C] p-3 rounded-2xl border border-[#262626] max-w-xs mx-auto text-left">
              <span className="font-label-sm text-[10px] text-[#FF5500] uppercase tracking-widest block">
                SESSÃO DE REFERÊNCIA
              </span>
              <span className="font-headline text-base text-[#F7F5F3] uppercase block mt-0.5">{workout.title}</span>
              <span className="font-telemetry text-[11px] text-[#A1A1AA]">
                {workout.distanceKm ? `${workout.distanceKm} km` : '—'} • {workout.hrRange} • pace alvo{' '}
                <span className="text-[#FF5500]">{workout.targetPace}</span>
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            {tracker.errorMessage && !gpsFailed && (
              <p className="text-xs text-[#EF4444] text-center" role="alert">
                {tracker.errorMessage}
              </p>
            )}
            <button
              onClick={() => setStage('countdown')}
              className="w-full min-h-[58px] py-4 px-6 bg-[#FF5500] hover:bg-[#FF6B00] active:scale-[0.98] text-[#0D0D0D] rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-[#FF5500]/30 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[28px] font-black">play_arrow</span>
              <span className="font-headline text-xl uppercase tracking-wider">Disparar Cronômetro</span>
            </button>
            {!hasSignal && (
              <p className="text-[11px] text-[#A1A1AA] text-center leading-relaxed">
                Sem sinal de GNSS a corrida é cronometrada, mas a distância fica em 0 km e nada é salvo ao
                encerrar.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. CONTAGEM REGRESSIVA */}
      {/* ============================================================ */}
      {stage === 'countdown' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
          <span className="font-telemetry text-sm text-[#FF5500] font-extrabold uppercase tracking-widest">
            PREPARAR CORRIDA
          </span>

          <div className="relative w-44 h-44 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-[#FF5500]/20 animate-ping" />
            <div className="w-36 h-36 rounded-full border-4 border-[#FF5500] flex items-center justify-center shadow-[0_0_40px_rgba(255,85,0,0.5)] bg-[#1C1C1C]">
              <span className="font-headline text-8xl text-[#FF5500] leading-none">{countdownNum}</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="font-headline text-xl uppercase tracking-wider text-white">
              Ritmo Alvo: {workout.targetPace} /km
            </span>
            <p className="text-xs text-[#A1A1AA] max-w-xs">{workout.zone}</p>
          </div>

          <button
            onClick={() => {
              tracker.start();
              setStage('live');
            }}
            className="text-xs text-[#A1A1AA] hover:text-white underline uppercase tracking-wider pt-4 cursor-pointer"
          >
            Pular Contagem
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. HUD AO VIVO */}
      {/* ============================================================ */}
      {(stage === 'live' || stage === 'saving') && (
        <div className="flex-1 flex flex-col justify-between p-5 max-w-lg mx-auto w-full overflow-y-auto">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between border-b border-[#262626] pb-3">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${tracker.stage === 'paused' ? 'bg-[#FACC15]' : 'bg-[#FF5500] animate-pulse'}`}
              />
              <span className="font-headline text-sm uppercase tracking-wider text-[#F7F5F3] truncate">
                {tracker.laps.length > 0 ? `VOLTA ${tracker.laps.length + 1}` : 'VOLTA 1'} • {workout.title}
              </span>
            </div>
            <div className="flex items-center gap-2 font-telemetry text-xs shrink-0">
              <span
                className={`bg-[#1C1C1C] px-2 py-0.5 rounded border border-[#262626] ${hasSignal ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}
              >
                {tracker.gpsAccuracyM !== null ? `±${tracker.gpsAccuracyM}m` : 'SEM GPS'}
              </span>
              <button
                onClick={() => setIsLocked(!isLocked)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isLocked ? 'bg-[#FF5500] text-black' : 'bg-[#1C1C1C] text-[#A1A1AA]'
                }`}
                title={isLocked ? 'Desbloquear tela' : 'Bloquear tela'}
              >
                <span className="material-symbols-outlined text-[18px]">{isLocked ? 'lock' : 'lock_open'}</span>
              </button>
            </div>
          </div>

          {/* Cronômetro e pace instantâneo */}
          <div className="text-center space-y-2 py-2">
            <span className="text-xs font-label-caps text-[#A1A1AA] uppercase tracking-wider">
              TEMPO DECORRIDO
            </span>
            <div className="font-headline text-7xl text-[#F7F5F3] tracking-tighter leading-none">
              {formatClock(tracker.elapsedSeconds)}
            </div>

            <div className="bg-[#1C1C1C] p-3 rounded-2xl border border-[#262626] max-w-xs mx-auto shadow-md">
              <div className="flex items-baseline justify-center gap-2">
                <span
                  className={`font-headline text-5xl tracking-tight leading-none ${
                    paceVerdict === 'no-alvo'
                      ? 'text-[#22C55E]'
                      : paceVerdict === null
                        ? 'text-[#F7F5F3]'
                        : 'text-[#FACC15]'
                  }`}
                >
                  {tracker.instantPace}
                </span>
                <span className="font-label-caps text-xs text-[#A1A1AA] uppercase">/KM INSTANTÂNEO</span>
              </div>
              {paceVerdict && (
                <div
                  className={`flex items-center justify-center gap-1 mt-1 text-[11px] font-bold uppercase ${
                    paceVerdict === 'no-alvo' ? 'text-[#22C55E]' : 'text-[#FACC15]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {paceVerdict === 'no-alvo' ? 'check_circle' : paceVerdict === 'rapido' ? 'trending_up' : 'trending_down'}
                  </span>
                  <span>
                    {paceVerdict === 'no-alvo'
                      ? `No alvo prescrito (${workout.targetPace})`
                      : paceVerdict === 'rapido'
                        ? `Acima do alvo (${workout.targetPace})`
                        : `Abaixo do alvo (${workout.targetPace})`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Telemetria */}
          <div className="grid grid-cols-4 gap-2 text-center font-telemetry">
            <div className="bg-[#1C1C1C] p-2.5 rounded-xl border border-[#262626]">
              <span className="text-[9px] text-[#A1A1AA] uppercase block">DISTÂNCIA</span>
              <span className="font-headline text-xl text-[#F7F5F3] block mt-0.5">
                {tracker.distanceKm.toFixed(2)}
              </span>
              <span className="text-[9px] text-[#737373]">KM</span>
            </div>
            <div className="bg-[#1C1C1C] p-2.5 rounded-xl border border-[#262626]">
              <span className="text-[9px] text-[#A1A1AA] uppercase block">PACE MÉDIO</span>
              <span className="font-headline text-xl text-[#22C55E] block mt-0.5">{tracker.avgPace}</span>
              <span className="text-[9px] text-[#737373]">/KM</span>
            </div>
            <div className="bg-[#1C1C1C] p-2.5 rounded-xl border border-[#262626]">
              <span className="text-[9px] text-[#A1A1AA] uppercase block">VOLTAS</span>
              <span className="font-headline text-xl text-[#c3f400] block mt-0.5">{tracker.laps.length}</span>
              <span className="text-[9px] text-[#737373]">LAPS</span>
            </div>
            <div className="bg-[#1C1C1C] p-2.5 rounded-xl border border-[#262626]">
              <span className="text-[9px] text-[#A1A1AA] uppercase block">CARDIO</span>
              <span className="font-headline text-xl text-[#EF4444] block mt-0.5">
                {tracker.heartRate ?? '—'}
              </span>
              <span className="text-[9px] text-[#737373]">BPM</span>
            </div>
          </div>

          {/* Cinta cardíaca */}
          <div className="bg-[#1C1C1C] p-3 rounded-xl border border-[#262626] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="material-symbols-outlined text-[#EF4444] text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                favorite
              </span>
              <div className="text-xs min-w-0">
                <span className="font-bold text-white block truncate">
                  {tracker.hrDeviceName || 'Nenhuma cinta conectada'}
                </span>
                <span className="text-[10px] text-[#A1A1AA]">
                  {tracker.hrDeviceName
                    ? `Máx. na sessão: ${tracker.maxHeartRate ?? '—'} bpm`
                    : 'Cadência e potência exigem sensores que o navegador não expõe'}
                </span>
              </div>
            </div>
            {!tracker.hrDeviceName && (
              <button
                onClick={tracker.connectHeartRate}
                disabled={!tracker.isBleSupported}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-[#262626] hover:bg-[#353534] disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-bold uppercase text-[#F7F5F3] cursor-pointer"
              >
                Conectar
              </button>
            )}
          </div>

          {/* Orientação de ritmo derivada da prescrição */}
          <div className="bg-[#1C1C1C]/80 border border-[#FF5500]/30 rounded-xl p-3 flex items-center gap-3">
            <span className="material-symbols-outlined text-[#FF5500] text-[22px] shrink-0">
              record_voice_over
            </span>
            <p className="text-xs text-[#e5e2e1] leading-tight">
              {paceVerdict === 'rapido'
                ? `Você está mais rápido que o prescrito (${workout.targetPace}/km). Segure o ritmo para não comprometer o restante da sessão.`
                : paceVerdict === 'lento'
                  ? `Ritmo abaixo do alvo (${workout.targetPace}/km). Aumente a cadência gradualmente se a percepção de esforço permitir.`
                  : paceVerdict === 'no-alvo'
                    ? 'Ritmo dentro da faixa prescrita. Mantenha o esforço e a respiração controlados.'
                    : `Alvo da sessão: ${workout.hrRange} • ${workout.targetPace}/km.`}
            </p>
          </div>

          {saveError && (
            <p className="text-xs text-[#EF4444] font-bold text-center pt-2" role="alert">
              {saveError}
            </p>
          )}

          {/* Controles */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <button
              disabled={isLocked || stage === 'saving'}
              onClick={tracker.lap}
              className="min-h-[54px] bg-[#262626] hover:bg-[#353534] active:scale-95 text-white rounded-2xl flex flex-col items-center justify-center gap-0.5 border border-[#353534] transition-all cursor-pointer disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[20px]">flag</span>
              <span className="font-bold text-xs uppercase">Volta / Lap</span>
            </button>

            {tracker.stage !== 'paused' ? (
              <button
                disabled={isLocked || stage === 'saving'}
                onClick={tracker.pause}
                className="min-h-[54px] bg-[#FACC15] hover:bg-[#EAB308] active:scale-95 text-[#0D0D0D] rounded-2xl flex flex-col items-center justify-center gap-0.5 font-headline uppercase shadow-lg transition-all cursor-pointer disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[22px] font-black">pause</span>
                <span className="text-xs tracking-wider">Pausar</span>
              </button>
            ) : (
              <button
                disabled={isLocked || stage === 'saving'}
                onClick={tracker.resume}
                className="min-h-[54px] bg-[#22C55E] hover:bg-[#16A34A] active:scale-95 text-[#0D0D0D] rounded-2xl flex flex-col items-center justify-center gap-0.5 font-headline uppercase shadow-lg transition-all cursor-pointer disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[22px] font-black">play_arrow</span>
                <span className="text-xs tracking-wider">Retomar</span>
              </button>
            )}

            <button
              disabled={isLocked || stage === 'saving'}
              onClick={handleFinish}
              className="min-h-[54px] bg-[#EF4444] hover:bg-[#DC2626] active:scale-95 text-white rounded-2xl flex flex-col items-center justify-center gap-0.5 font-headline uppercase shadow-lg transition-all cursor-pointer disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[20px]">stop</span>
              <span className="text-xs tracking-wider">{stage === 'saving' ? 'Salvando' : 'Encerrar'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
