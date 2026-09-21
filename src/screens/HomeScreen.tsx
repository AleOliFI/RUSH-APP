import React, { useState } from 'react';
import { AthleteProfile, PhysiologicalReadiness, WorkoutPrescription, DailyMileage, ImageViewerItem, WeeklySummary } from '../types';
import { APP_IMAGES } from '../data/appAssets';
import { DailySummary } from '../components/rush/DailySummary';
import { FatigueAlert } from '../components/rush/FatigueAlert';
import type { FatigueAlert as FatigueAlertData } from '../data/adapters';

interface HomeScreenProps {
  athlete: AthleteProfile;
  readiness: PhysiologicalReadiness;
  todayWorkout: WorkoutPrescription;
  weeklySchedule: DailyMileage[];
  weeklySummary: WeeklySummary;
  /** Atividades do atleta que têm foto anexada. */
  photoActivities: any[];
  onStartMeasure: () => void;
  onViewWorkoutDetails: () => void;
  onOpenProfile: () => void;
  onOpenWorkoutsTab: () => void;
  onViewImage?: (item: ImageViewerItem) => void;
  onOpenGearGarage?: () => void;
  onOpenBleHardware?: () => void;
  onStartActiveRun?: () => void;
  onOpenFieldProtocol?: () => void;
  /** Alerta de fadiga acumulada — invisível abaixo de 2 dias consecutivos. */
  fatigueAlert: FatigueAlertData;
  /** Razão carga aguda:crônica, para o aviso de carga dentro do alerta. */
  acwr?: number | null;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  athlete,
  readiness,
  todayWorkout,
  weeklySchedule,
  weeklySummary,
  photoActivities,
  onStartMeasure,
  onViewWorkoutDetails,
  onOpenProfile,
  onOpenWorkoutsTab,
  onViewImage,
  onOpenGearGarage,
  onOpenBleHardware,
  onStartActiveRun,
  onOpenFieldProtocol,
  fatigueAlert,
  acwr = null,
}) => {
  const handleOpenWorkoutViewer = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onViewImage) {
      onViewImage({
        url: todayWorkout.imageUrl,
        title: todayWorkout.title,
        subtitle: todayWorkout.focus,
        category: 'PRESCRIÇÃO AUTOMÁTICA',
        filename: `${todayWorkout.title.toLowerCase().replace(/[^a-z0-9]/gi, '-')}.png`,
        description: `Pista de atletismo e prescrição de ritmo para ${todayWorkout.title}. Foco em ${todayWorkout.focus}, pace alvo de ${todayWorkout.targetPace} min/km por ${todayWorkout.durationMinutes} minutos.`,
      });
    }
  };

  const handleOpenAthleteViewer = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onViewImage) {
      onViewImage({
        url: athlete.avatarUrl,
        title: `${athlete.name} (${athlete.category})`,
        subtitle: athlete.quote,
        category: 'PASSAPORTE BIOMÉTRICO DO ATLETA',
        filename: `rush-running-atleta-${athlete.name.toLowerCase().replace(/[^a-z0-9]/gi, '-')}.png`,
        description: `Passaporte biométrico do atleta ${athlete.name}. VO2 Máx de ${athlete.vo2Max} mL/kg/min e frequência de repouso ${athlete.restingHR} BPM.`,
      });
    }
  };
  // Gauge math: Circumference of r=40 is 2 * PI * 40 ≈ 251.2
  // dashoffset = 251.2 * (1 - readiness.score / 100)
  const circumference = 251.2;
  const strokeDashoffset = circumference * (1 - readiness.score / 100);

  const totalKm = weeklySummary.completedKm;
  const targetKm = weeklySummary.targetKm;
  // Sem meta planejada a barra fica zerada e o rótulo avisa — nunca 100%.
  const progressPercent = weeklySummary.progressPercent;
  const barWidth = progressPercent ?? 0;

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-4 pt-2 pb-6">
      {/* Alerta de fadiga vem antes de tudo: é o que muda a decisão do dia. */}
      <FatigueAlert
        alert={fatigueAlert}
        acwr={acwr}
        onStartRecoverySession={onStartActiveRun}
        onOpenWorkouts={onOpenWorkoutsTab}
      />

      {/* 0. Resumo Diário Compacto & Minimalista */}
      <DailySummary
        readinessScore={readiness.score}
        readinessLabel={readiness.label}
        pendingDistanceKm={todayWorkout.distanceKm}
        pendingDurationMinutes={todayWorkout.durationMinutes}
        workoutTitle={todayWorkout.title}
        onStartMeasure={onStartMeasure}
        onViewWorkout={onViewWorkoutDetails}
      />

      {/* 1. Status & Hero Readiness Cockpit */}
      <div className="relative overflow-hidden rounded-xl bg-[#1C1C1C] p-5 shadow-xl border border-[#262626]">
        {/* Ambient Glow */}
        <div className="absolute -right-16 -top-16 w-52 h-52 bg-[#FF5500]/12 rounded-full blur-3xl pointer-events-none" />

        {/* Cockpit Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#FF5500] animate-ping" />
            <span className="font-label-caps text-xs text-[#FF5500] tracking-widest uppercase font-extrabold">
              STATUS FISIOLÓGICO
            </span>
          </div>
          <div className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-[#FF5500]/15 text-[#FF5500] font-label-sm text-[11px] border border-[#FF5500]/30">
            <span className="material-symbols-outlined text-[14px]">bolt</span>
            <span className="font-bold tracking-wider">PRO HUD</span>
          </div>
        </div>

        {/* Metric Circle & Readiness Value */}
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FF5500] text-[#0D0D0D] mb-2 shadow-[0_0_12px_rgba(255,85,0,0.4)]">
              <span className="material-symbols-outlined text-[16px] font-bold">verified</span>
              <span className="font-label-caps text-[11px] tracking-wider uppercase font-black">
                {readiness.label}
              </span>
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-metric-hero-mobile text-[#F7F5F3] tracking-tighter">
                {readiness.score}
              </span>
              <span className="font-headline-sm text-[#FF5500] uppercase">%</span>
            </div>
            <p className="font-body text-xs text-[#737373] mt-0.5 leading-relaxed">
              {readiness.advice}
            </p>
          </div>

          {/* Dial SVG Gauge */}
          <div className="relative w-28 h-28 flex items-center justify-center flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                fill="transparent"
                r="40"
                stroke="#262626"
                strokeDasharray="251.2"
                strokeDashoffset="0"
                strokeWidth="8"
              />
              <circle
                className="transition-all duration-1000 drop-shadow-[0_0_8px_rgba(255,85,0,0.6)]"
                cx="50"
                cy="50"
                fill="transparent"
                id="readiness-gauge"
                r="40"
                stroke="#FF5500"
                strokeDasharray="251.2"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                strokeWidth="8"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-[#FF5500] text-[26px]">vital_signs</span>
              <span className="font-label-sm text-[11px] text-[#737373] mt-0.5 font-bold">
                {readiness.score}/100
              </span>
            </div>
          </div>
        </div>

        {/* Dual Metric Cards: RHR & HRV */}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-[#262626]">
          <div className="bg-[#101010] p-3 rounded-lg border border-[#202020] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#737373]">
              <span className="font-label-caps text-[10px] uppercase font-bold">RHR (REPOUSO)</span>
              <span className="material-symbols-outlined text-[16px] text-[#EF4444]">favorite</span>
            </div>
            <div className="mt-1 flex items-baseline space-x-1">
              <span className="font-headline-md text-[#F7F5F3]">{readiness.restingHR}</span>
              <span className="font-label-sm text-[10px] text-[#FF5500] uppercase font-bold">BPM</span>
            </div>
            <div className="mt-1 flex items-center space-x-1 text-[#22C55E] font-label-sm text-[10px]">
              <span className="material-symbols-outlined text-[12px]">trending_down</span>
              <span>{readiness.rhrDiff} bpm vs média</span>
            </div>
          </div>

          <div className="bg-[#101010] p-3 rounded-lg border border-[#202020] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#737373]">
              <span className="font-label-caps text-[10px] uppercase font-bold">HRV (RMSSD)</span>
              <span className="material-symbols-outlined text-[16px] text-[#22C55E]">monitoring</span>
            </div>
            <div className="mt-1 flex items-baseline space-x-1">
              <span className="font-headline-md text-[#F7F5F3]">{readiness.hrvRmssd}</span>
              <span className="font-label-sm text-[10px] text-[#FF5500] uppercase font-bold">MS</span>
            </div>
            <div className="mt-1 flex items-center space-x-1 text-[#22C55E] font-label-sm text-[10px]">
              <span className="material-symbols-outlined text-[12px]">check_circle</span>
              <span className="font-bold uppercase">{readiness.hrvStatus}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Primary Rapid Trigger Buttons */}
      <div className="space-y-2.5">
        <button
          onClick={onStartActiveRun}
          className="w-full h-14 bg-[#FF5500] hover:bg-[#FF6B00] active:scale-[0.99] transition-all duration-200 rounded-xl flex items-center justify-between px-5 shadow-[0_0_22px_rgba(255,85,0,0.4)] cursor-pointer"
          id="active-run-trigger"
        >
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-[#0D0D0D] flex items-center justify-center text-[#FF5500]">
              <span className="material-symbols-outlined text-[24px] animate-pulse">directions_run</span>
            </div>
            <div className="text-left">
              <span className="font-headline-sm text-[#0D0D0D] tracking-wider uppercase block leading-tight">
                INICIAR CORRIDA (LIVE HUD)
              </span>
              <span className="font-label-caps text-[10px] text-[#0D0D0D]/80 uppercase block font-black">
                MULTI-GNSS L1/L5 • TELEMETRIA EM TEMPO REAL
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-[#0D0D0D] text-[24px]">
            play_circle
          </span>
        </button>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={onStartMeasure}
            className="min-h-[48px] py-2 px-2.5 bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] rounded-xl flex flex-col items-center justify-center gap-0.5 text-center cursor-pointer transition-all shadow"
          >
            <span className="material-symbols-outlined text-[#FF5500] text-[20px]">ecg</span>
            <span className="font-label-caps text-[9px] uppercase font-bold text-[#F7F5F3] leading-tight">
              Medição HRV
            </span>
          </button>

          <button
            onClick={onOpenGearGarage}
            className="min-h-[48px] py-2 px-2.5 bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] rounded-xl flex flex-col items-center justify-center gap-0.5 text-center cursor-pointer transition-all shadow"
          >
            <span className="material-symbols-outlined text-[#22C55E] text-[20px]">sports_martial_arts</span>
            <span className="font-label-caps text-[9px] uppercase font-bold text-[#F7F5F3] leading-tight">
              Garagem Tênis
            </span>
          </button>

          <button
            onClick={onOpenBleHardware}
            className="min-h-[48px] py-2 px-2.5 bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] rounded-xl flex flex-col items-center justify-center gap-0.5 text-center cursor-pointer transition-all shadow"
          >
            <span className="material-symbols-outlined text-[#3B82F6] text-[20px]">bluetooth_connected</span>
            <span className="font-label-caps text-[9px] uppercase font-bold text-[#F7F5F3] leading-tight">
              Sensores BLE
            </span>
          </button>
        </div>
      </div>

      {/* 3. Recommended Workout Card */}
      <div className="rounded-xl bg-[#1C1C1C] overflow-hidden shadow-lg flex flex-col border border-[#262626]">
        {/* Image Header with Dark Gradient Scrim and Interactive Actions */}
        <div
          className="relative w-full h-48 bg-cover bg-center cursor-pointer group"
          style={{ backgroundImage: `url('${todayWorkout.imageUrl}')` }}
          onClick={handleOpenWorkoutViewer}
          title="Clique para visualizar a imagem em alta resolução"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#1C1C1C] via-[#1C1C1C]/40 to-transparent transition-opacity group-hover:opacity-75" />
          
          {/* Top Left Badge */}
          <div className="absolute top-4 left-4 flex items-center space-x-2 pointer-events-none">
            <span className="px-2.5 py-1 bg-[#0D0D0D]/90 backdrop-blur-md rounded text-[#FF5500] font-label-caps text-[10px] uppercase tracking-wider font-extrabold flex items-center gap-1 border border-[#262626]">
              <span className="material-symbols-outlined text-[14px]">psychology</span>
              PRESCRIÇÃO AUTOMÁTICA
            </span>
          </div>

          {/* Top Right Quick Action: ver a imagem em tela cheia */}
          <div className="absolute top-4 right-4 flex items-center space-x-2 z-10">
            {/* View Fullscreen Modal */}
            <button
              onClick={handleOpenWorkoutViewer}
              className="w-8 h-8 rounded-lg bg-[#0D0D0D]/85 hover:bg-[#262626] text-[#F7F5F3] hover:text-[#FF5500] border border-[#333] flex items-center justify-center cursor-pointer transition-colors shadow-md"
              title="Visualizar imagem completa com zoom"
              aria-label="Visualizar imagem"
            >
              <span className="material-symbols-outlined text-[16px]">fullscreen</span>
            </button>
          </div>

          <div className="absolute bottom-3 left-4 right-4 pointer-events-none">
            <span className="font-label-caps text-xs text-[#FF5500] uppercase tracking-wider font-extrabold">
              {todayWorkout.focus}
            </span>
            <h2 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight leading-tight">
              {todayWorkout.title}
            </h2>
          </div>
        </div>

        {/* Workout Specs Grid */}
        <div className="p-5 flex flex-col space-y-4">
          <div className="grid grid-cols-3 gap-2 bg-[#101010] p-3 rounded-lg border border-[#202020] text-center">
            <div className="flex flex-col">
              <span className="font-label-caps text-[10px] text-[#737373] uppercase font-bold">PACE ALVO</span>
              <span className="font-headline-sm text-[#FF5500] tracking-tight mt-0.5">
                {todayWorkout.targetPace}
              </span>
              <span className="font-label-sm text-[10px] text-[#737373]">MIN/KM</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-caps text-[10px] text-[#737373] uppercase font-bold">DURAÇÃO</span>
              <span className="font-headline-sm text-[#F7F5F3] tracking-tight mt-0.5">
                {todayWorkout.durationMinutes}
              </span>
              <span className="font-label-sm text-[10px] text-[#737373]">MINUTOS</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-caps text-[10px] text-[#737373] uppercase font-bold">DISTÂNCIA</span>
              <span className="font-headline-sm text-[#F7F5F3] tracking-tight mt-0.5">
                {todayWorkout.distanceKm}
              </span>
              <span className="font-label-sm text-[10px] text-[#737373]">KM ESTIMADO</span>
            </div>
          </div>

          {/* Zone 4 Intensity Tag */}
          <div className="flex items-center justify-between px-3 py-2 rounded bg-[#201f1f] border border-[#262626]">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5500] shadow-[0_0_8px_rgba(255,85,0,0.8)]" />
              <span className="font-label-caps text-[10px] sm:text-[11px] text-[#F7F5F3] uppercase font-bold">
                {todayWorkout.zone}
              </span>
            </div>
            <span className="font-telemetry text-xs text-[#FF5500] font-bold">
              {todayWorkout.hrRange}
            </span>
          </div>

          {/* Action Button */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={onViewWorkoutDetails}
              className="w-full h-12 bg-[#2a2a2a] hover:bg-[#FF5500] text-[#F7F5F3] hover:text-[#0D0D0D] transition-colors duration-200 rounded-lg flex items-center justify-center space-x-2 font-body text-xs font-bold tracking-wider uppercase cursor-pointer border border-[#333]"
            >
              <span>VER DETALHES DO TREINO</span>
              <span className="material-symbols-outlined text-[18px]">readiness_score</span>
            </button>

            <button
              onClick={onOpenWorkoutsTab}
              className="w-full h-12 bg-[#FF5500]/15 hover:bg-[#FF5500] text-[#FF5500] hover:text-[#0D0D0D] transition-colors duration-200 rounded-lg flex items-center justify-center space-x-2 font-body text-xs font-bold tracking-wider uppercase cursor-pointer border border-[#FF5500]/40"
            >
              <span>EXECUTAR TREINO (HUD)</span>
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Weekly Mileage & Pacing HUD Tracker */}
      <div className="rounded-xl bg-[#1C1C1C] p-5 shadow-lg flex flex-col space-y-4 border border-[#262626]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-[#FF5500] text-[20px]">calendar_view_week</span>
            <span className="font-label-caps text-xs text-[#F7F5F3] uppercase tracking-wider font-extrabold">
              QUILOMETRAGEM SEMANAL
            </span>
          </div>
          <span className="font-telemetry text-xs text-[#FF5500] font-bold">
            {progressPercent === null ? 'SEM META NA SEMANA' : `${progressPercent}% CONCLUÍDO`}
          </span>
        </div>

        {/* Big Mileage Progress Numbers */}
        <div className="flex items-baseline justify-between">
          <div>
            <span className="font-headline-lg-mobile text-[#F7F5F3] tracking-tight">
              {totalKm.toFixed(1)}
            </span>
            <span className="font-label-sm text-[10px] text-[#FF5500] uppercase ml-1 font-bold">
              KM RODADOS
            </span>
          </div>
          <div className="text-right">
            <span className="font-body text-xs font-bold text-[#737373]">META: </span>
            <span className="font-headline-sm text-[#F7F5F3]">{targetKm > 0 ? targetKm.toFixed(1) : '—'}</span>
            <span className="font-label-sm text-[10px] text-[#737373] uppercase ml-0.5">KM</span>
          </div>
        </div>

        {/* Segmented Tactical Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-3 bg-[#101010] rounded-full overflow-hidden p-0.5 flex border border-[#202020]">
            <div
              className="h-full bg-[#FF5500] rounded-full shadow-[0_0_10px_rgba(255,85,0,0.7)] transition-all duration-700"
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <div className="flex justify-between font-label-sm text-[10px] text-[#737373] px-1">
            {weeklySchedule.map((item, idx) => (
              <span
                key={idx}
                className={item.isToday ? 'text-[#FF5500] font-bold' : item.completed ? 'text-[#e5e2e1]' : 'text-[#404040]'}
              >
                {item.day}
              </span>
            ))}
          </div>
        </div>

        {/* Split Visual Micro-Cards */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="p-3 rounded bg-[#201f1f] flex items-center space-x-3 border border-[#262626]">
            <div className="w-8 h-8 rounded bg-[#FF5500]/10 flex items-center justify-center text-[#FF5500]">
              <span className="material-symbols-outlined text-[18px]">pace</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-[10px] text-[#737373] uppercase font-bold">Pace Médio</span>
              <span className="font-telemetry text-xs text-[#F7F5F3] font-bold">{weeklySummary.avgPace}</span>
            </div>
          </div>

          <div className="p-3 rounded bg-[#201f1f] flex items-center space-x-3 border border-[#262626]">
            <div className="w-8 h-8 rounded bg-[#22C55E]/10 flex items-center justify-center text-[#22C55E]">
              <span className="material-symbols-outlined text-[18px]">local_fire_department</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-[10px] text-[#737373] uppercase font-bold">Gasto Energético</span>
              <span className="font-telemetry text-xs text-[#F7F5F3] font-bold">
                {weeklySummary.caloriesKcal !== null
                  ? `${weeklySummary.caloriesKcal.toLocaleString('pt-BR')} kcal`
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Runner Profile Motivation & Status Snippet */}
      <div
        className="rounded-xl bg-[#101010] p-4 flex items-center justify-between border border-[#262626] hover:border-[#FF5500]/50 transition-colors"
      >
        <div 
          onClick={onOpenProfile}
          className="flex items-center space-x-4 flex-1 min-w-0 cursor-pointer group"
        >
          <div 
            className="relative flex-shrink-0"
            onClick={handleOpenAthleteViewer}
            title="Clique para visualizar o passaporte"
          >
            <img
              alt={athlete.name}
              className="w-12 h-12 rounded-lg object-cover ring-1 ring-[#333] group-hover:ring-[#FF5500] transition-all"
              src={athlete.avatarUrl}
            />
            <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[#22C55E] ring-2 ring-[#101010]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-headline-sm text-[#F7F5F3] truncate group-hover:text-[#FF5500] transition-colors">
                {athlete.name}
              </span>
              <span className="px-1.5 py-0.2 bg-[#FF5500] text-[#0D0D0D] font-telemetry text-[10px] rounded uppercase font-extrabold">
                {athlete.category}
              </span>
            </div>
            <p className="font-body text-xs text-[#737373] truncate mt-0.5">
              {athlete.quote}
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center space-x-2 ml-2">
          <button
            onClick={handleOpenAthleteViewer}
            title="Visualizar foto do atleta"
            className="w-8 h-8 rounded bg-[#1C1C1C] hover:bg-[#262626] text-[#737373] hover:text-[#FF5500] border border-[#333] flex items-center justify-center cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">visibility</span>
          </button>
          <button
            onClick={onOpenProfile}
            title="Ver passaporte biométrico completo"
            className="w-8 h-8 rounded bg-[#1C1C1C] hover:bg-[#262626] text-[#737373] hover:text-[#FF5500] border border-[#333] flex items-center justify-center cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* 6. Minhas fotos de treino */}
      <div className="rounded-xl bg-[#141414] p-5 border border-[#262626] space-y-3">
        <div className="flex items-center justify-between border-b border-[#262626] pb-2.5 gap-2">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="material-symbols-outlined text-[#FF5500] text-[18px]">download_for_offline</span>
            <div className="min-w-0">
              <span className="font-label-caps text-[9px] text-[#FF5500] uppercase font-black tracking-widest block">
                ARMAZENAMENTO LOCAL
              </span>
              <h3 className="font-headline-sm text-xs text-[#F7F5F3] uppercase tracking-tight">
                MINHAS FOTOS DE TREINO
              </h3>
            </div>
          </div>
          <span className="font-telemetry text-[10px] text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/30 px-2 py-0.5 rounded font-bold shrink-0">
            {photoActivities.length} {photoActivities.length === 1 ? 'FOTO' : 'FOTOS'}
          </span>
        </div>

        {photoActivities.length === 0 ? (
          <p className="font-body text-xs text-[#737373] leading-relaxed">
            Nenhuma foto ainda. Anexe uma imagem ao publicar um treino no feed e ela aparece aqui para
            visualizar em alta resolução ou salvar no dispositivo.
          </p>
        ) : (
          <>
            <p className="font-body text-xs text-[#737373]">
              Visualize em alta resolução ou salve os arquivos no armazenamento local do seu dispositivo:
            </p>

            <div className="space-y-2.5">
              {photoActivities.slice(0, 6).map((activity) => {
                const filename = `rush-treino-${activity.id}.jpg`;
                return (
                  <div
                    key={activity.id}
                    className="bg-[#1C1C1C] rounded-lg border border-[#262626] p-2.5 flex items-center gap-3"
                  >
                    <button
                      onClick={() =>
                        onViewImage?.({
                          url: activity.image_url,
                          title: activity.title || 'Treino',
                          subtitle: `${(activity.distance_km || 0).toFixed(2)} km`,
                          category: 'MINHAS FOTOS DE TREINO',
                          filename,
                        })
                      }
                      className="w-14 h-14 rounded-lg overflow-hidden border border-[#262626] bg-[#101010] shrink-0 cursor-pointer"
                      aria-label={`Ver foto de ${activity.title || 'treino'}`}
                    >
                      <img src={activity.image_url} alt="" className="w-full h-full object-cover" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <span className="font-headline-sm text-xs text-[#F7F5F3] uppercase truncate block">
                        {activity.title || 'Treino'}
                      </span>
                      <span className="font-telemetry text-[10px] text-[#737373]">
                        {(activity.distance_km || 0).toFixed(2)} km • JPG
                      </span>
                    </div>

                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
