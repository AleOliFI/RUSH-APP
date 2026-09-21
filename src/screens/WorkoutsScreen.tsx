import React, { useState, useEffect, useMemo } from 'react';
import { WorkoutPrescription, ImageViewerItem, UpcomingSession, WorkoutCategory } from '../types';
import { formatClock, useRunTracker, RunSummary } from '../hooks/useRunTracker';

interface WorkoutsScreenProps {
  workout: WorkoutPrescription;
  upcomingSessions: UpcomingSession[];
  currentWeek: number | null;
  onOpenDetailModal: () => void;
  onViewImage?: (item: ImageViewerItem) => void;
  onFinishWorkout: (summary: RunSummary, sessionId?: string | null) => Promise<void>;
}

/** Extrai os minutos de rótulos como "8 min" ou "25 min • 6.8 km". */
function parseStepMinutes(label: string): number {
  const match = /(\d+)\s*min/i.exec(label || '');
  return match ? Number(match[1]) : 5;
}

export const WorkoutsScreen: React.FC<WorkoutsScreenProps> = ({
  workout,
  upcomingSessions,
  currentWeek,
  onOpenDetailModal,
  onViewImage,
  onFinishWorkout,
}) => {
  // Execução guiada: cronômetro e distância vêm do GNSS real.
  const tracker = useRunTracker();
  const isRunningWorkout = tracker.stage === 'running' || tracker.stage === 'paused' || tracker.stage === 'acquiring';
  const isPaused = tracker.stage === 'paused';

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepStartedAt, setStepStartedAt] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'TODOS' | WorkoutCategory>('TODOS');

  const formatTime = formatClock;

  const currentStep = workout.steps[currentStepIndex] || workout.steps[0];

  // Tempo restante do bloco atual, derivado do cronômetro real.
  const stepSeconds = useMemo(() => {
    if (!currentStep) return 0;
    const totalStepSeconds = parseStepMinutes(currentStep.durationOrDistance) * 60;
    return Math.max(0, totalStepSeconds - (tracker.elapsedSeconds - stepStartedAt));
  }, [currentStep, tracker.elapsedSeconds, stepStartedAt]);

  // Avança sozinho para o próximo bloco quando o tempo do atual acaba.
  useEffect(() => {
    if (tracker.stage !== 'running') return;
    if (stepSeconds > 0) return;
    if (currentStepIndex >= workout.steps.length - 1) return;
    setCurrentStepIndex((prev) => prev + 1);
    setStepStartedAt(tracker.elapsedSeconds);
  }, [stepSeconds, tracker.stage, tracker.elapsedSeconds, currentStepIndex, workout.steps.length]);

  const handleStartWorkout = (sessionId?: string | null) => {
    setSaveError(null);
    setActiveSessionId(sessionId ?? null);
    setCurrentStepIndex(0);
    setStepStartedAt(0);
    tracker.start();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStopWorkout = async () => {
    const summary = tracker.finish();

    if (summary.distanceKm <= 0) {
      // Sem distância registrada não há atividade para gravar.
      tracker.reset();
      setSaveError('Nenhuma distância foi registrada pelo GPS — a sessão não foi salva.');
      return;
    }

    setIsSaving(true);
    try {
      await onFinishWorkout(summary, activeSessionId);
      tracker.reset();
    } catch (err: any) {
      setSaveError(err?.message || 'Não foi possível salvar a sessão.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredSessions = useMemo(
    () => (activeFilter === 'TODOS' ? upcomingSessions : upcomingSessions.filter((s) => s.category === activeFilter)),
    [activeFilter, upcomingSessions],
  );

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-5 pt-2 pb-8">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-[#262626] pb-3">
        <div>
          <span className="font-label-caps text-[10px] text-[#FF5500] uppercase tracking-widest font-extrabold block">
            PRESCRIÇÃO & EXECUÇÃO
          </span>
          <h1 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight">
            CENTRAL DE TREINOS
          </h1>
        </div>

        {!isRunningWorkout && (
          <button
            onClick={() => handleStartWorkout(null)}
            className="px-3.5 py-1.5 rounded-lg bg-[#FF5500] hover:bg-[#FF6B00] text-[#0D0D0D] font-headline-sm text-xs uppercase flex items-center space-x-1.5 shadow-[0_0_12px_rgba(255,85,0,0.4)] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
            <span>INICIAR HUD</span>
          </button>
        )}
      </div>

      {/* LIVE WORKOUT HUD OVERLAY MODE */}
      {isRunningWorkout && (
        <div className="rounded-xl bg-[#1C1C1C] p-5 border-2 border-[#FF5500] shadow-[0_0_30px_rgba(255,85,0,0.3)] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5500] animate-ping" />
              <span className="font-label-caps text-xs text-[#FF5500] font-black uppercase tracking-wider">
                EXECUÇÃO EM TEMPO REAL
              </span>
            </div>
            <div className="px-2 py-0.5 rounded bg-[#FF5500]/20 text-[#FF5500] font-telemetry text-xs font-bold">
              {currentStep ? `${currentStep.targetZone} ATIVA` : 'EM CURSO'}
            </div>
          </div>

          {/* Big Stadium Clock / Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 bg-[#101010] p-4 rounded-lg border border-[#202020]">
            <div>
              <span className="font-label-caps text-[10px] text-[#737373] uppercase font-bold">TEMPO DECORRIDO</span>
              <div className="font-metric-hero-mobile text-[#F7F5F3]">{formatTime(tracker.elapsedSeconds)}</div>
            </div>
            <div>
              <span className="font-label-caps text-[10px] text-[#737373] uppercase font-bold">DISTÂNCIA TOTAL</span>
              <div className="font-metric-hero-mobile text-[#FF5500]">{tracker.distanceKm.toFixed(2)} <span className="text-xs font-telemetry text-[#737373]">KM</span></div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center bg-[#101010] p-3 rounded-lg border border-[#202020]">
            <div>
              <span className="font-label-caps text-[9px] text-[#737373] uppercase font-bold">PACE INSTANTÂNEO</span>
              <div className="font-headline-sm text-[#F7F5F3] mt-0.5">
                {tracker.instantPace} <span className="text-[10px] text-[#FF5500]">/KM</span>
              </div>
            </div>
            <div>
              <span className="font-label-caps text-[9px] text-[#737373] uppercase font-bold">FREQ. CARDÍACA</span>
              {tracker.heartRate !== null ? (
                <div className="font-headline-sm text-[#FF5500] mt-0.5">
                  {tracker.heartRate} <span className="text-[10px] text-[#737373]">BPM</span>
                </div>
              ) : (
                <button
                  onClick={tracker.connectHeartRate}
                  disabled={!tracker.isBleSupported}
                  className="mt-0.5 text-[10px] text-[#FF5500] font-bold uppercase disabled:text-[#737373] disabled:cursor-not-allowed cursor-pointer hover:underline"
                >
                  {tracker.isBleSupported ? 'Conectar cinta' : 'BLE indisp.'}
                </button>
              )}
            </div>
            <div>
              <span className="font-label-caps text-[9px] text-[#737373] uppercase font-bold">PRECISÃO GNSS</span>
              <div className="font-headline-sm text-[#22C55E] mt-0.5">
                {tracker.gpsAccuracyM !== null ? tracker.gpsAccuracyM : '—'}{' '}
                <span className="text-[10px] text-[#737373]">M</span>
              </div>
            </div>
          </div>

          {/* Active Step Indicator */}
          <div className="bg-[#201f1f] p-3 rounded-lg border border-[#262626]">
            <div className="flex justify-between items-center text-xs">
              <span className="font-label-caps text-[10px] text-[#FF5500] font-black uppercase">
                ETAPA {currentStepIndex + 1} DE {workout.steps.length}
              </span>
              <span className="font-telemetry text-xs text-[#F7F5F3]">
                {formatTime(stepSeconds)} restante
              </span>
            </div>
            <div className="font-body text-sm font-bold text-[#F7F5F3] mt-1">
              {currentStep.title} ({currentStep.durationOrDistance})
            </div>
            <p className="font-body text-xs text-[#737373] mt-0.5">
              {currentStep.description}
            </p>
          </div>

          {/* Controls: Next Lap, Pause, Stop */}
          {(tracker.errorMessage || saveError) && (
            <p className="text-xs text-[#EF4444] font-bold leading-relaxed" role="alert">
              {saveError || tracker.errorMessage}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                setCurrentStepIndex((prev) => Math.min(prev + 1, workout.steps.length - 1));
                setStepStartedAt(tracker.elapsedSeconds);
                tracker.lap();
              }}
              disabled={currentStepIndex >= workout.steps.length - 1}
              className="h-11 rounded bg-[#2a2a2a] hover:bg-[#333] disabled:opacity-40 disabled:cursor-not-allowed text-[#F7F5F3] font-body text-xs font-bold uppercase transition-colors cursor-pointer"
            >
              PRÓXIMO BLOCO
            </button>
            <button
              onClick={() => (isPaused ? tracker.resume() : tracker.pause())}
              className="h-11 rounded bg-[#101010] border border-[#333] text-[#FF5500] font-body text-xs font-bold uppercase hover:bg-[#202020] transition-colors cursor-pointer"
            >
              {isPaused ? 'RETOMAR' : 'PAUSAR'}
            </button>
            <button
              onClick={handleStopWorkout}
              disabled={isSaving}
              className="h-11 rounded bg-[#EF4444] disabled:opacity-60 disabled:cursor-wait text-[#0D0D0D] font-body text-xs font-bold uppercase hover:bg-[#ff5a5a] transition-colors cursor-pointer"
            >
              {isSaving ? 'SALVANDO…' : 'CONCLUIR'}
            </button>
          </div>
        </div>
      )}

      {/* TODAY'S PRESCRIBED WORKOUT CARD */}
      <div className="rounded-xl bg-[#1C1C1C] overflow-hidden shadow-xl border border-[#262626]">
        <div
          className="relative w-full h-48 bg-cover bg-center cursor-pointer group"
          style={{ backgroundImage: `url('${workout.imageUrl}')` }}
          onClick={() => {
            if (onViewImage) {
              onViewImage({
                url: workout.imageUrl,
                title: workout.title,
                subtitle: workout.focus,
                category: 'PRESCRIÇÃO DE HOJE',
                filename: `${workout.title.toLowerCase().replace(/[^a-z0-9]/gi, '-')}-track.png`,
                description: `Pista de atletismo oficial e diretriz de ritmo para ${workout.title}. Prescrição: ${workout.zone}, Pace Alvo: ${workout.targetPace} min/km.`,
              });
            }
          }}
          title="Clique para visualizar a imagem em alta resolução"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#1C1C1C] via-[#1C1C1C]/40 to-transparent transition-opacity group-hover:opacity-75" />
          
          <div className="absolute top-4 left-4 pointer-events-none">
            <span className="px-2.5 py-1 bg-[#0D0D0D]/90 backdrop-blur-md rounded text-[#FF5500] font-label-caps text-[10px] uppercase tracking-wider font-extrabold flex items-center gap-1 border border-[#262626]">
              <span className="material-symbols-outlined text-[14px]">bolt</span>
              PRESCRIÇÃO DE HOJE
            </span>
          </div>

          {/* Ver a imagem em tela cheia */}
          <div className="absolute top-4 right-4 flex items-center space-x-2 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onViewImage) {
                  onViewImage({
                    url: workout.imageUrl,
                    title: workout.title,
                    subtitle: workout.focus,
                    category: 'PRESCRIÇÃO DE HOJE',
                    filename: `${workout.title.toLowerCase().replace(/[^a-z0-9]/gi, '-')}-track.png`,
                    description: `Pista de atletismo oficial e diretriz de ritmo para ${workout.title}. Prescrição: ${workout.zone}, Pace Alvo: ${workout.targetPace} min/km.`,
                  });
                }
              }}
              className="w-8 h-8 rounded-lg bg-[#0D0D0D]/85 hover:bg-[#262626] text-[#F7F5F3] hover:text-[#FF5500] border border-[#333] flex items-center justify-center cursor-pointer transition-colors shadow-md"
              title="Visualizar em tela cheia"
              aria-label="Visualizar imagem"
            >
              <span className="material-symbols-outlined text-[16px]">fullscreen</span>
            </button>
          </div>

          <div className="absolute bottom-3 left-4 right-4 pointer-events-none">
            <span className="font-label-caps text-xs text-[#FF5500] uppercase tracking-wider font-extrabold">
              {workout.focus}
            </span>
            <h2 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight leading-tight">
              {workout.title}
            </h2>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <p className="font-body text-xs text-[#737373] leading-relaxed">
            {workout.coachingNotes}
          </p>

          {/* Steps List */}
          <div className="space-y-2">
            <span className="font-label-caps text-[10px] text-[#737373] uppercase font-bold tracking-wider block">
              ESTRUTURA DA SESSÃO
            </span>

            {workout.steps.map((step, idx) => (
              <div
                key={step.id}
                className="bg-[#101010] p-3 rounded-lg border border-[#202020] flex items-start justify-between gap-3"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded bg-[#201f1f] text-[#FF5500] font-telemetry text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </div>
                  <div>
                    <span className="font-body text-xs font-bold text-[#F7F5F3] block">
                      {step.title}
                    </span>
                    <span className="font-telemetry text-[11px] text-[#737373]">
                      {step.durationOrDistance} • {step.targetPace}
                    </span>
                  </div>
                </div>
                <span className="font-label-sm text-[10px] text-[#FF5500] bg-[#FF5500]/10 px-2 py-0.5 rounded border border-[#FF5500]/20 font-bold whitespace-nowrap">
                  {step.targetZone}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2 flex gap-3">
            <button
              onClick={() => handleStartWorkout(workout.id)}
              disabled={workout.isRestDay}
              title={workout.isRestDay ? 'Hoje é dia de descanso prescrito' : undefined}
              className="flex-1 h-12 bg-[#FF5500] hover:bg-[#FF6B00] disabled:bg-[#262626] disabled:text-[#737373] disabled:shadow-none disabled:cursor-not-allowed text-[#0D0D0D] font-headline-sm uppercase tracking-wider rounded-lg flex items-center justify-center space-x-2 shadow-[0_0_16px_rgba(255,85,0,0.35)] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">
                {workout.isRestDay ? 'bedtime' : 'play_arrow'}
              </span>
              <span>{workout.isRestDay ? 'DIA DE DESCANSO' : 'EXECUTAR AGORA'}</span>
            </button>
            <button
              onClick={onOpenDetailModal}
              className="px-4 h-12 bg-[#2a2a2a] hover:bg-[#333] text-[#F7F5F3] rounded-lg flex items-center justify-center cursor-pointer border border-[#333]"
              title="Ver detalhes completos"
            >
              <span className="material-symbols-outlined text-[20px]">info</span>
            </button>
          </div>
        </div>
      </div>

      {/* UPCOMING WORKOUTS / LIBRARY */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-xs text-[#F7F5F3] uppercase tracking-wider font-extrabold">
            PRÓXIMAS SESSÕES DA SEMANA
          </span>
          <span className="font-telemetry text-xs text-[#737373]">
            {currentWeek ? `MICRO-CICLO ${currentWeek}` : 'SEM PLANO ATIVO'}
          </span>
        </div>

        {/* Filter chips */}
        <div className="flex space-x-2 overflow-x-auto pb-1">
          {(['TODOS', 'VO2 MÁX', 'LIMIAR', 'ENDURANCE', 'REGENERATIVO'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter as any)}
              className={`px-3 py-1 rounded text-xs font-label-caps uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === filter
                  ? 'bg-[#FF5500] text-[#0D0D0D] font-black'
                  : 'bg-[#141414] text-[#737373] border border-[#262626] hover:text-[#e5e2e1]'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="space-y-2.5">
          {filteredSessions.length === 0 && (
            <div className="bg-[#141414] p-5 rounded-xl border border-dashed border-[#262626] text-center">
              <span className="material-symbols-outlined text-[28px] text-[#404040]">event_busy</span>
              <p className="text-xs text-[#737373] mt-1.5 leading-relaxed">
                {upcomingSessions.length === 0
                  ? 'Nenhuma sessão restante nesta semana do seu plano.'
                  : 'Nenhuma sessão desta categoria no restante da semana.'}
              </p>
            </div>
          )}

          {filteredSessions.map((item) => (
            <div
              key={item.id}
              className="bg-[#1C1C1C] p-4 rounded-xl border border-[#262626] flex items-center justify-between hover:border-[#FF5500]/50 transition-colors"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-label-caps text-[9px] bg-[#FF5500]/15 text-[#FF5500] px-1.5 py-0.2 rounded font-bold uppercase">
                    {item.badge}
                  </span>
                  <span className="font-telemetry text-[11px] text-[#737373]">{item.dayLabel}</span>
                </div>
                <h3 className="font-headline-sm text-sm text-[#F7F5F3] uppercase">{item.title}</h3>
                <div className="flex items-center space-x-3 font-telemetry text-xs text-[#737373]">
                  <span>{item.distance}</span>
                  <span>•</span>
                  <span>{item.duration}</span>
                  <span>•</span>
                  <span className="text-[#FF5500]">{item.targetPace}</span>
                </div>
              </div>

              {!item.isRest && (
                <button
                  onClick={() => handleStartWorkout(item.id)}
                  aria-label={`Iniciar ${item.title}`}
                  className="w-10 h-10 shrink-0 rounded-lg bg-[#201f1f] text-[#F7F5F3] hover:text-[#0D0D0D] hover:bg-[#FF5500] transition-colors flex items-center justify-center cursor-pointer border border-[#262626]"
                >
                  <span className="material-symbols-outlined text-[20px]">play_arrow</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
