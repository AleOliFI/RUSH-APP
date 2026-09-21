import React, { useState } from 'react';
import { WorkoutPrescription, ImageViewerItem } from '../../types';

interface WorkoutDetailModalProps {
  workout: WorkoutPrescription;
  isOpen: boolean;
  onClose: () => void;
  onStartWorkout: () => void;
  onViewImage?: (item: ImageViewerItem) => void;
}

export const WorkoutDetailModal: React.FC<WorkoutDetailModalProps> = ({
  workout,
  isOpen,
  onClose,
  onStartWorkout,
  onViewImage,
}) => {
  if (!isOpen) return null;

  const handleOpenViewer = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onViewImage) {
      onViewImage({
        url: workout.imageUrl,
        title: workout.title,
        subtitle: workout.focus,
        category: 'PRESCRIÇÃO DE TREINO',
        filename: `${workout.title.toLowerCase().replace(/[^a-z0-9]/gi, '-')}.png`,
        description: `Imagem de referência técnica para ${workout.title}. Prescrito em ${workout.zone} com alvo de pace ${workout.targetPace} min/km.`,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#1C1C1C] border border-[#262626] w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header with image */}
        <div
          className="relative w-full h-48 bg-cover bg-center flex-shrink-0 cursor-pointer group"
          style={{ backgroundImage: `url('${workout.imageUrl}')` }}
          onClick={handleOpenViewer}
          title="Clique para visualizar a imagem em alta resolução"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#1C1C1C] via-[#1C1C1C]/60 to-transparent transition-opacity group-hover:opacity-75" />
          
          {/* Top Actions: ver imagem e fechar */}
          <div className="absolute top-4 right-4 flex items-center space-x-2">
            {/* View Fullscreen button */}
            {onViewImage && (
              <button
                onClick={handleOpenViewer}
                className="w-9 h-9 rounded-lg bg-[#0D0D0D]/85 text-[#e5e2e1] hover:text-[#FF5500] hover:bg-[#202020] flex items-center justify-center cursor-pointer border border-[#333]"
                title="Visualizar imagem completa"
                aria-label="Visualizar imagem"
              >
                <span className="material-symbols-outlined text-[18px]">fullscreen</span>
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-9 h-9 rounded-lg bg-[#0D0D0D]/85 text-[#e5e2e1] hover:text-[#FF5500] hover:bg-[#202020] flex items-center justify-center cursor-pointer border border-[#333]"
              aria-label="Fechar"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div className="absolute bottom-3 left-5 right-5 pointer-events-none">
            <span className="font-label-caps text-xs text-[#FF5500] uppercase tracking-wider font-extrabold">
              {workout.focus}
            </span>
            <h2 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight">
              {workout.title}
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2 bg-[#101010] p-3 rounded-lg border border-[#202020] text-center">
            <div>
              <span className="font-label-caps text-[9px] text-[#737373] uppercase font-bold">PACE ALVO</span>
              <div className="font-headline-sm text-[#FF5500] mt-0.5">{workout.targetPace} <span className="text-[10px] text-[#737373]">min/km</span></div>
            </div>
            <div>
              <span className="font-label-caps text-[9px] text-[#737373] uppercase font-bold">DURAÇÃO</span>
              <div className="font-headline-sm text-[#F7F5F3] mt-0.5">{workout.durationMinutes} <span className="text-[10px] text-[#737373]">min</span></div>
            </div>
            <div>
              <span className="font-label-caps text-[9px] text-[#737373] uppercase font-bold">DISTÂNCIA</span>
              <div className="font-headline-sm text-[#F7F5F3] mt-0.5">{workout.distanceKm} <span className="text-[10px] text-[#737373]">km</span></div>
            </div>
          </div>

          {/* Coaching Instructions */}
          <div className="bg-[#201f1f] p-3.5 rounded-lg border border-[#262626]">
            <div className="flex items-center space-x-2 text-[#FF5500] mb-1">
              <span className="material-symbols-outlined text-[18px]">psychology</span>
              <span className="font-label-caps text-[11px] font-extrabold uppercase">ORIENTAÇÕES DO TREINADOR</span>
            </div>
            <p className="font-body text-xs text-[#e5e2e1] leading-relaxed">
              {workout.coachingNotes}
            </p>
          </div>

          {/* Detailed Splits / Intervals */}
          <div className="space-y-2">
            <span className="font-label-caps text-[10px] text-[#737373] uppercase font-bold tracking-wider block">
              DETALHAMENTO DOS BLOCOS
            </span>
            {workout.steps.map((step, idx) => (
              <div key={step.id} className="bg-[#101010] p-3 rounded-lg border border-[#202020] space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded bg-[#262626] text-[#FF5500] font-telemetry text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-body text-xs font-bold text-[#F7F5F3]">{step.title}</span>
                  </div>
                  <span className="font-label-sm text-[10px] text-[#FF5500] font-bold">
                    {step.hrRange}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-[#737373] font-telemetry pl-7">
                  <span>{step.durationOrDistance}</span>
                  <span className="text-[#F7F5F3] font-bold">{step.targetPace}</span>
                </div>
                <p className="font-body text-[11px] text-[#737373] pl-7">
                  {step.description}
                </p>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              className="h-12 bg-[#262626] hover:bg-[#333] text-[#F7F5F3] font-headline-sm text-xs uppercase rounded-lg transition-colors cursor-pointer"
            >
              FECHAR
            </button>
            <button
              onClick={() => {
                onClose();
                onStartWorkout();
              }}
              className="h-12 bg-[#FF5500] hover:bg-[#FF6B00] text-[#0D0D0D] font-headline-sm text-xs uppercase rounded-lg flex items-center justify-center space-x-1.5 shadow-[0_0_16px_rgba(255,85,0,0.4)] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
              <span>EXECUTAR TREINO</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
