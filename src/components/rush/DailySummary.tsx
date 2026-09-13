import React from 'react';

interface DailySummaryProps {
  readinessScore: number;
  readinessLabel: string;
  pendingDistanceKm: number;
  pendingDurationMinutes: number;
  workoutTitle?: string;
  onStartMeasure?: () => void;
  onViewWorkout?: () => void;
}

export const DailySummary: React.FC<DailySummaryProps> = ({
  readinessScore,
  readinessLabel,
  pendingDistanceKm,
  pendingDurationMinutes,
  workoutTitle,
  onStartMeasure,
  onViewWorkout,
}) => {
  // Determine color theme based on readiness score
  const isHigh = readinessScore >= 80;
  const isModerate = readinessScore >= 60 && readinessScore < 80;
  const scoreColor = isHigh ? 'text-[#22C55E]' : isModerate ? 'text-[#FACC15]' : 'text-[#EF4444]';
  const scoreBg = isHigh ? 'bg-[#22C55E]/10' : isModerate ? 'bg-[#FACC15]/10' : 'bg-[#EF4444]/10';
  const scoreBorder = isHigh ? 'border-[#22C55E]/30' : isModerate ? 'border-[#FACC15]/30' : 'border-[#EF4444]/30';

  return (
    <div
      id="daily-summary-compact"
      className="w-full bg-[#141414] rounded-xl border border-[#262626] px-3.5 py-2.5 flex items-center justify-between gap-3 shadow-sm"
    >
      {/* 1. Prontidão Fisiológica */}
      <div
        onClick={onStartMeasure}
        className={`flex items-center gap-2.5 flex-1 cursor-pointer transition-opacity hover:opacity-90 ${onStartMeasure ? 'cursor-pointer' : ''}`}
        title="Toque para ver ou atualizar a prontidão matinal"
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${scoreBg} ${scoreBorder} flex-shrink-0`}>
          <span className={`font-telemetry text-base font-extrabold ${scoreColor}`}>
            {readinessScore}
          </span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-label-caps text-[9px] uppercase tracking-wider text-[#737373] font-bold truncate">
            Prontidão Fisiológica
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${isHigh ? 'bg-[#22C55E]' : isModerate ? 'bg-[#FACC15]' : 'bg-[#EF4444]'}`} />
            <span className="font-telemetry text-xs font-bold text-[#F7F5F3] uppercase tracking-tight truncate">
              {readinessLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Subtle Divider */}
      <div className="w-[1px] h-8 bg-[#262626] flex-shrink-0" />

      {/* 2. Volume Pendente Hoje */}
      <div
        onClick={onViewWorkout}
        className={`flex items-center justify-end gap-2.5 flex-1 cursor-pointer transition-opacity hover:opacity-90 ${onViewWorkout ? 'cursor-pointer' : ''}`}
        title="Toque para ver os detalhes da sessão pendente"
      >
        <div className="flex flex-col items-end min-w-0 text-right">
          <span className="font-label-caps text-[9px] uppercase tracking-wider text-[#737373] font-bold truncate">
            Volume Pendente
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-telemetry text-sm font-black text-[#FF5500]">
              {pendingDistanceKm.toFixed(1)}
            </span>
            <span className="font-telemetry text-[10px] text-[#A3A3A3] font-semibold">KM</span>
            <span className="text-[#404040] text-xs">•</span>
            <span className="font-telemetry text-xs font-bold text-[#F7F5F3]">
              {pendingDurationMinutes}
            </span>
            <span className="font-telemetry text-[10px] text-[#737373]">min</span>
          </div>
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#FF5500]/10 border border-[#FF5500]/30 text-[#FF5500] flex-shrink-0">
          <span className="material-symbols-outlined text-[18px]">directions_run</span>
        </div>
      </div>
    </div>
  );
};
