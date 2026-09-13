import React, { useState, useEffect } from 'react';
import { APP_IMAGES } from '../../data/appAssets';

interface ActiveRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFinishWorkout: () => void;
}

type RunStage = 'pre-run' | 'gnss-loss' | 'countdown' | 'running' | 'paused';

export const ActiveRunModal: React.FC<ActiveRunModalProps> = ({
  isOpen,
  onClose,
  onFinishWorkout,
}) => {
  const [stage, setStage] = useState<RunStage>('pre-run');
  const [countdownNum, setCountdownNum] = useState(3);
  const [elapsedSeconds, setElapsedSeconds] = useState(1752); // ~29:12
  const [currentDistance, setCurrentDistance] = useState(5.24);
  const [instantPace, setInstantPace] = useState('3:52');
  const [heartRate, setHeartRate] = useState(176);
  const [cadence, setCadence] = useState(186);
  const [powerWatts, setPowerWatts] = useState(340);
  const [lapCount, setLapCount] = useState(4);
  const [isLocked, setIsLocked] = useState(false);
  const [satsCount, setSatsCount] = useState(14);

  // Live timer while running
  useEffect(() => {
    if (stage !== 'running') return;
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
      setCurrentDistance((prev) => +(prev + 0.004).toFixed(3));
      setHeartRate((prev) => {
        const delta = Math.floor(Math.random() * 3) - 1;
        return Math.max(172, Math.min(182, prev + delta));
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [stage]);

  // Countdown handler
  useEffect(() => {
    if (stage !== 'countdown') return;
    setCountdownNum(3);
    const interval = setInterval(() => {
      setCountdownNum((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setStage('running');
          return 1;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [stage]);

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleLap = () => {
    setLapCount((prev) => prev + 1);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="active-run-title"
      className="fixed inset-0 z-[60] bg-[#0D0D0D] flex flex-col text-[#F7F5F3] select-none"
    >
      {/* ============================================================ */}
      {/* 1. STAGE: PRÉ-LARGADA / GNSS ACQUISITION */}
      {/* ============================================================ */}
      {stage === 'pre-run' && (
        <div className="flex-1 flex flex-col justify-between p-6 max-w-lg mx-auto w-full">
          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] animate-ping" />
              <span className="font-telemetry text-xs font-bold text-[#22C55E] uppercase tracking-wider">
                SESSÃO ARMADA • PRE-RUN
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

          {/* Orbital Satellite Radar & GPS Lock */}
          <div className="text-center space-y-4 my-auto">
            <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
              {/* Pulsing radar rings */}
              <div className="absolute inset-0 rounded-full border border-[#22C55E]/20 animate-ping" />
              <div className="absolute inset-4 rounded-full border border-[#22C55E]/40" />
              <div className="absolute inset-10 rounded-full border border-[#22C55E]/60" />
              <div className="w-24 h-24 rounded-full bg-[#1C1C1C] border-2 border-[#22C55E] flex flex-col items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                <span className="material-symbols-outlined text-[#22C55E] text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  satellite_alt
                </span>
                <span className="font-telemetry text-xs font-black text-[#22C55E] mt-0.5">
                  {satsCount}/16 SATS
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <h2 id="active-run-title" className="font-headline text-3xl uppercase tracking-normal">
                Multi-GNSS Travado (&lt;1.18m)
              </h2>
              <p className="text-xs text-[#A1A1AA] max-w-xs mx-auto">
                Banda dupla L1 + L5 sincronizada no circuito Ibirapuera. Telemetria e mapa de calor ativos.
              </p>
            </div>

            {/* Microclimate & Sensor Badges */}
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto pt-2 text-xs font-telemetry">
              <div className="bg-[#1C1C1C] p-2 rounded-xl border border-[#262626]">
                <span className="text-[#A1A1AA] block text-[9px] uppercase">CLIMA</span>
                <span className="font-bold text-[#F7F5F3]">22°C • 8km/h</span>
              </div>
              <div className="bg-[#1C1C1C] p-2 rounded-xl border border-[#262626]">
                <span className="text-[#A1A1AA] block text-[9px] uppercase">POLAR H10</span>
                <span className="font-bold text-[#22C55E]">66 BPM OK</span>
              </div>
              <div className="bg-[#1C1C1C] p-2 rounded-xl border border-[#262626]">
                <span className="text-[#A1A1AA] block text-[9px] uppercase">STRYD</span>
                <span className="font-bold text-[#c3f400]">WATTS OK</span>
              </div>
            </div>

            <button
              onClick={() => setStage('gnss-loss')}
              className="text-xs text-[#737373] hover:text-[#EF4444] underline transition-colors cursor-pointer"
            >
              Simular perda de sinal GNSS (ver contingência tática)
            </button>
          </div>

          {/* Action: Disparar Cronômetro */}
          <div className="space-y-3">
            <button
              onClick={() => setStage('countdown')}
              className="w-full min-h-[58px] py-4 px-6 bg-[#FF5500] hover:bg-[#FF6B00] active:scale-[0.98] text-[#0D0D0D] rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-[#FF5500]/30 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[28px] font-black">play_arrow</span>
              <span className="font-headline text-xl uppercase tracking-wider">
                Disparar Cronômetro
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. STAGE: CONTINGÊNCIA PERDA DE SINAL GNSS */}
      {/* ============================================================ */}
      {stage === 'gnss-loss' && (
        <div className="flex-1 flex flex-col justify-between p-6 max-w-lg mx-auto w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#EF4444]">
              <span className="material-symbols-outlined text-[20px]">warning</span>
              <span className="font-telemetry text-xs font-bold uppercase tracking-wider">
                CONTINGÊNCIA DE SATÉLITE
              </span>
            </div>
            <button
              onClick={() => setStage('pre-run')}
              className="text-xs text-[#A1A1AA] hover:text-white underline cursor-pointer"
            >
              Voltar ao Radar
            </button>
          </div>

          <div className="space-y-5 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#EF4444]/20 border border-[#EF4444]/40 flex items-center justify-center text-[#EF4444] mx-auto">
              <span className="material-symbols-outlined text-[36px]">gps_off</span>
            </div>

            <div className="text-center space-y-1">
              <h2 className="font-headline text-2xl uppercase text-[#F7F5F3]">
                Sinal GNSS Não Detectado
              </h2>
              <p className="text-xs text-[#A1A1AA] max-w-xs mx-auto">
                Visada obstruída ou interferência na antena. Verifique o checklist abaixo:
              </p>
            </div>

            <div className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] space-y-3 text-xs">
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-[#FF5500] text-[#0D0D0D] font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <span className="text-[#e5e2e1]">Afaste-se de prédios altos, túneis ou coberturas metálicas.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-[#FF5500] text-[#0D0D0D] font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <span className="text-[#e5e2e1]">Certifique-se de que a permissão de Localização Exata está ativa.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-[#FF5500] text-[#0D0D0D] font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <span className="text-[#e5e2e1]">Recicle o rádio GPS ou alterne para modo Indoor (Acelerômetro).</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSatsCount(14);
                  setStage('pre-run');
                }}
                className="flex-1 min-h-[48px] py-3 bg-[#262626] hover:bg-[#353534] text-white font-bold text-xs rounded-xl uppercase tracking-wider cursor-pointer"
              >
                Re-escanear GPS
              </button>
              <button
                onClick={() => setStage('countdown')}
                className="flex-1 min-h-[48px] py-3 bg-[#FF5500] text-[#0D0D0D] font-headline text-sm rounded-xl uppercase tracking-wider cursor-pointer"
              >
                Modo Indoor / Esteira
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. STAGE: COUNTDOWN */}
      {/* ============================================================ */}
      {stage === 'countdown' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
          <span className="font-telemetry text-sm text-[#FF5500] font-extrabold uppercase tracking-widest">
            PREPARAR CORRIDA
          </span>

          <div className="relative w-44 h-44 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-[#FF5500]/20 animate-ping" />
            <div className="w-36 h-36 rounded-full border-4 border-[#FF5500] flex items-center justify-center shadow-[0_0_40px_rgba(255,85,0,0.5)] bg-[#1C1C1C]">
              <span className="font-headline text-8xl text-[#FF5500] leading-none">
                {countdownNum}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="font-headline text-xl uppercase tracking-wider text-white">
              Ritmo Alvo: 3:50 - 3:55 /km
            </span>
            <p className="text-xs text-[#A1A1AA]">Mantenha os ombros relaxados e cadência acima de 180 spm.</p>
          </div>

          <button
            onClick={() => setStage('running')}
            className="text-xs text-[#A1A1AA] hover:text-white underline uppercase tracking-wider pt-4 cursor-pointer"
          >
            Pular Contagem
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. STAGE: RUNNING & PAUSED (LIVE HUD) */}
      {/* ============================================================ */}
      {(stage === 'running' || stage === 'paused') && (
        <div className="flex-1 flex flex-col justify-between p-5 max-w-lg mx-auto w-full">
          {/* Top Workout Sub-header */}
          <div className="flex items-center justify-between border-b border-[#262626] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5500] animate-pulse" />
              <span className="font-headline text-sm uppercase tracking-wider text-[#F7F5F3]">
                TIRO {lapCount} DE 8 • 800M PISTA
              </span>
            </div>
            <div className="flex items-center gap-2 font-telemetry text-xs">
              <span className="bg-[#1C1C1C] px-2 py-0.5 rounded border border-[#262626] text-[#22C55E]">
                GPS L1/L5
              </span>
              <button
                onClick={() => setIsLocked(!isLocked)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isLocked ? 'bg-[#FF5500] text-black' : 'bg-[#1C1C1C] text-[#A1A1AA]'
                }`}
                title={isLocked ? 'Desbloquear tela' : 'Bloquear tela'}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isLocked ? 'lock' : 'lock_open'}
                </span>
              </button>
            </div>
          </div>

          {/* Primary HUD: Chronometer & Instant Pace */}
          <div className="text-center space-y-2 py-2">
            <span className="text-xs font-label-caps text-[#A1A1AA] uppercase tracking-wider">
              TEMPO DECORRIDO
            </span>
            <div className="font-headline text-7xl text-[#F7F5F3] tracking-tighter leading-none">
              {formatTime(elapsedSeconds)}
              <span className="text-2xl text-[#737373]">.7</span>
            </div>

            {/* Target Pace Box */}
            <div className="bg-[#1C1C1C] p-3 rounded-2xl border border-[#262626] max-w-xs mx-auto shadow-md">
              <div className="flex items-baseline justify-center gap-2">
                <span className="font-headline text-5xl text-[#22C55E] tracking-tight leading-none">
                  {instantPace}
                </span>
                <span className="font-label-caps text-xs text-[#A1A1AA] uppercase">/KM INSTANTÂNEO</span>
              </div>
              <div className="flex items-center justify-center gap-1 mt-1 text-[11px] text-[#22C55E] font-bold uppercase">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                <span>No Alvo Prescrito (3:50 - 3:55)</span>
              </div>
            </div>
          </div>

          {/* Quad Telemetry Bento */}
          <div className="grid grid-cols-4 gap-2 text-center font-telemetry">
            <div className="bg-[#1C1C1C] p-2.5 rounded-xl border border-[#262626]">
              <span className="text-[9px] text-[#A1A1AA] uppercase block">DISTÂNCIA</span>
              <span className="font-headline text-xl text-[#F7F5F3] block mt-0.5">
                {currentDistance.toFixed(2)}
              </span>
              <span className="text-[9px] text-[#737373]">KM</span>
            </div>
            <div className="bg-[#1C1C1C] p-2.5 rounded-xl border border-[#262626]">
              <span className="text-[9px] text-[#A1A1AA] uppercase block">CADÊNCIA</span>
              <span className="font-headline text-xl text-[#22C55E] block mt-0.5">{cadence}</span>
              <span className="text-[9px] text-[#737373]">SPM</span>
            </div>
            <div className="bg-[#1C1C1C] p-2.5 rounded-xl border border-[#262626]">
              <span className="text-[9px] text-[#A1A1AA] uppercase block">POTÊNCIA</span>
              <span className="font-headline text-xl text-[#c3f400] block mt-0.5">{powerWatts}</span>
              <span className="text-[9px] text-[#737373]">WATTS</span>
            </div>
            <div className="bg-[#1C1C1C] p-2.5 rounded-xl border border-[#262626]">
              <span className="text-[9px] text-[#A1A1AA] uppercase block">CARDIO Z4</span>
              <span className="font-headline text-xl text-[#EF4444] block mt-0.5">{heartRate}</span>
              <span className="text-[9px] text-[#737373]">BPM</span>
            </div>
          </div>

          {/* Real-time ECG Trace / VFC wave */}
          <div className="bg-[#1C1C1C] p-3 rounded-xl border border-[#262626] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#EF4444] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                favorite
              </span>
              <div className="text-xs">
                <span className="font-bold text-white block">Polar H10 ECG (1000Hz)</span>
                <span className="text-[10px] text-[#A1A1AA]">Zona 4 • Limiar Anaeróbico</span>
              </div>
            </div>
            <div className="w-28 h-6 flex items-center justify-center">
              <svg className="w-full h-full text-[#EF4444]" fill="none" viewBox="0 0 100 24">
                <path
                  d="M0 12 L20 12 L25 4 L30 20 L35 0 L40 18 L45 12 L100 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Tactical Audio Coach Tip */}
          <div className="bg-[#1C1C1C]/80 border border-[#FF5500]/30 rounded-xl p-3 flex items-center gap-3">
            <span className="material-symbols-outlined text-[#FF5500] text-[22px] shrink-0">
              record_voice_over
            </span>
            <p className="text-xs text-[#e5e2e1] leading-tight">
              “Excelente Mariana! Mantenha 186 de cadência e relaxamento nos ombros na reta final.”
            </p>
          </div>

          {/* Tactical Bottom Controls */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <button
              disabled={isLocked}
              onClick={handleLap}
              className="min-h-[54px] bg-[#262626] hover:bg-[#353534] active:scale-95 text-white rounded-2xl flex flex-col items-center justify-center gap-0.5 border border-[#353534] transition-all cursor-pointer disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[20px]">flag</span>
              <span className="font-bold text-xs uppercase">Volta / Lap</span>
            </button>

            {stage === 'running' ? (
              <button
                disabled={isLocked}
                onClick={() => setStage('paused')}
                className="min-h-[54px] bg-[#FACC15] hover:bg-[#EAB308] active:scale-95 text-[#0D0D0D] rounded-2xl flex flex-col items-center justify-center gap-0.5 font-headline uppercase shadow-lg transition-all cursor-pointer disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[22px] font-black">pause</span>
                <span className="text-xs tracking-wider">Pausar</span>
              </button>
            ) : (
              <button
                disabled={isLocked}
                onClick={() => setStage('running')}
                className="min-h-[54px] bg-[#22C55E] hover:bg-[#16A34A] active:scale-95 text-[#0D0D0D] rounded-2xl flex flex-col items-center justify-center gap-0.5 font-headline uppercase shadow-lg transition-all cursor-pointer disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[22px] font-black">play_arrow</span>
                <span className="text-xs tracking-wider">Retomar</span>
              </button>
            )}

            <button
              disabled={isLocked}
              onClick={() => {
                onClose();
                onFinishWorkout();
              }}
              className="min-h-[54px] bg-[#EF4444] hover:bg-[#DC2626] active:scale-95 text-white rounded-2xl flex flex-col items-center justify-center gap-0.5 font-headline uppercase shadow-lg transition-all cursor-pointer disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[20px]">stop</span>
              <span className="text-xs tracking-wider">Encerrar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
