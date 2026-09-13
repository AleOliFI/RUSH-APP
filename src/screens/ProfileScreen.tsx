// ============================================================
// RUSH RUNNING — Perfil do atleta
// Estatísticas, recordes, atividades e conquistas vêm da API.
// Rótulos comparativos (percentis, classificações) foram trocados
// por medidas verificáveis: variação do período e delta da baseline.
// ============================================================

import React, { useState } from 'react';
import { AthleteProfile, ImageViewerItem, PhysiologicalReadiness, WeeklySummary } from '../types';
import { downloadImageToDevice } from '../utils/imageDownload';
import { formatDuration, paceFromActivity, timeAgo } from '../data/adapters';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned_at?: string;
}

interface ProfileScreenProps {
  athlete: AthleteProfile;
  readiness: PhysiologicalReadiness;
  weeklySummary: WeeklySummary;
  /** Objetivo e local vindos do cadastro, para a linha de identificação. */
  objectiveLabel: string | null;
  location: string | null;
  vo2maxTrendPercent: number | null;
  hrvStatusLabel: string;
  recentActivities: any[];
  achievementsEarned: Achievement[];
  achievementsAll: Achievement[];
  trainingLoad: { acwr: number | null; zone: string | null; has_enough_history: boolean } | null;
  personalRecords: Record<string, { avg_pace: string | null } | null> | null;
  shoesSummary: { active_count: number; critical_count: number; warning_count: number } | null;
  devices: { brand: string }[];
  onOpenGearGarage: () => void;
  onOpenBleHardware: () => void;
  onOpenEditProfile: () => void;
  onViewImage: (item: ImageViewerItem) => void;
}

const ACWR_ZONE_TEXT: Record<string, string> = {
  destreinamento: 'Carga abaixo da faixa',
  ideal: 'Equilíbrio fisiológico',
  atencao: 'Carga acima da faixa',
  sobrecarga: 'Risco de sobrecarga',
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  athlete,
  readiness,
  weeklySummary,
  objectiveLabel,
  location,
  vo2maxTrendPercent,
  hrvStatusLabel,
  recentActivities,
  achievementsEarned,
  achievementsAll,
  trainingLoad,
  personalRecords,
  shoesSummary,
  devices,
  onOpenGearGarage,
  onOpenBleHardware,
  onOpenEditProfile,
  onViewImage,
}) => {
  const [activeTab, setActiveTab] = useState<'posts' | 'stats' | 'badges'>('posts');

  const earnedIds = new Set(achievementsEarned.map((a) => a.id));
  const pending = achievementsAll.filter((a) => !earnedIds.has(a.id));

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-3 space-y-5 pb-28">
      {/* Athlete Cover & Header Profile */}
      <div className="bg-[#1C1C1C] rounded-3xl border border-[#262626] overflow-hidden shadow-xl space-y-4">
        {/* Cover Photo */}
        <div className="relative h-36 bg-[#101010] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[#FF5500]/30 via-[#22C55E]/10 to-black" />
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <button
              onClick={onOpenEditProfile}
              className="min-h-[44px] bg-black/60 hover:bg-black/90 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">switch_account</span>
              <span>Trocar Perfil</span>
            </button>
          </div>
        </div>

        {/* Profile Card Info */}
        <div className="px-5 pb-5 -mt-16 space-y-4">
          <div className="flex items-end justify-between">
            <div className="relative">
              <img
                src={athlete.avatarUrl}
                alt={athlete.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-[#0D0D0D] shadow-xl"
              />
              <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-[#22C55E] border-2 border-[#0D0D0D]" />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  onViewImage({
                    url: athlete.avatarUrl,
                    title: athlete.name,
                    subtitle: athlete.quote,
                    category: 'PASSAPORTE DO ATLETA',
                    filename: 'athlete_profile.jpg',
                  })
                }
                className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-[#262626] text-[#F7F5F3] hover:bg-[#353534] border border-[#353534] flex items-center justify-center transition-all cursor-pointer"
                title="Ver foto em alta resolução"
              >
                <span className="material-symbols-outlined text-[18px]">zoom_in</span>
              </button>
              <button
                onClick={() =>
                  downloadImageToDevice(
                    athlete.avatarUrl,
                    'athlete_avatar.jpg',
                    `${athlete.name} - Avatar`
                  )
                }
                className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-[#FF5500] text-[#0D0D0D] hover:bg-[#FF6B00] font-bold flex items-center justify-center shadow-md transition-all cursor-pointer"
                title="Baixar avatar"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-headline text-2xl text-[#F7F5F3] uppercase tracking-normal">
                {athlete.name}
              </h2>
              <span className="bg-[#FF5500] text-[#0D0D0D] font-headline text-[10px] font-black px-1.5 py-0.2 rounded uppercase">
                {athlete.category}
              </span>
            </div>
            <p className="text-xs text-[#A1A1AA] font-telemetry mt-0.5">
              {[athlete.handle, objectiveLabel, location].filter(Boolean).join(' • ')}
            </p>
            <p className="text-xs text-[#e5e2e1] italic mt-2 leading-relaxed">
              {athlete.quote}
            </p>
          </div>

          {/* Followers & Km Counts */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[#262626] text-center font-telemetry text-xs">
            <div className="bg-[#101010] p-2 rounded-xl border border-[#262626]">
              <span className="font-headline text-lg text-[#F7F5F3] block">{athlete.totalKm}</span>
              <span className="text-[10px] text-[#A1A1AA] uppercase">KM TOTAIS</span>
            </div>
            <div className="bg-[#101010] p-2 rounded-xl border border-[#262626]">
              <span className="font-headline text-lg text-[#F7F5F3] block">{athlete.totalWorkouts}</span>
              <span className="text-[10px] text-[#A1A1AA] uppercase">TREINOS</span>
            </div>
            <div className="bg-[#101010] p-2 rounded-xl border border-[#262626]">
              <span className="font-headline text-lg text-[#F7F5F3] block">{athlete.followers}</span>
              <span className="text-[10px] text-[#A1A1AA] uppercase">SEGUIDORES</span>
            </div>
            <div className="bg-[#101010] p-2 rounded-xl border border-[#262626]">
              <span className="font-headline text-lg text-[#F7F5F3] block">{athlete.following}</span>
              <span className="text-[10px] text-[#A1A1AA] uppercase">SEGUINDO</span>
            </div>
          </div>
        </div>
      </div>

      {/* Capacidade Rush & Biometria */}
      <div className="bg-[#1C1C1C] rounded-2xl p-4 border border-[#262626] space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-xs text-[#A1A1AA] uppercase tracking-wider">
            Capacidade Fisiológica & Biometria RUSH
          </span>
          <span
            className={`font-telemetry text-xs font-bold ${
              athlete.status === 'READY'
                ? 'text-[#22C55E]'
                : athlete.status === 'FATIGUED'
                  ? 'text-[#FACC15]'
                  : 'text-[#EF4444]'
            }`}
          >
            {athlete.statusText}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="bg-[#101010] p-3 rounded-xl border border-[#262626]">
            <span className="text-[10px] text-[#A1A1AA] uppercase block">VO2 MÁXIMO</span>
            <span className="font-headline text-2xl text-[#22C55E] block mt-0.5">
              {athlete.vo2Max > 0 ? athlete.vo2Max : '—'}
            </span>
            <span
              className={`text-[9px] font-bold ${
                vo2maxTrendPercent == null
                  ? 'text-[#A1A1AA]'
                  : vo2maxTrendPercent >= 0
                    ? 'text-[#22C55E]'
                    : 'text-[#EF4444]'
              }`}
            >
              {vo2maxTrendPercent == null
                ? 'sem histórico'
                : `${vo2maxTrendPercent >= 0 ? '+' : ''}${vo2maxTrendPercent}% no período`}
            </span>
          </div>
          <div className="bg-[#101010] p-3 rounded-xl border border-[#262626]">
            <span className="text-[10px] text-[#A1A1AA] uppercase block">VFC RMSSD</span>
            <span className="font-headline text-2xl text-[#FF5500] block mt-0.5">
              {readiness.hrvRmssd ? `${readiness.hrvRmssd} ms` : '—'}
            </span>
            <span className="text-[9px] text-[#A1A1AA]">{hrvStatusLabel}</span>
          </div>
          <div className="bg-[#101010] p-3 rounded-xl border border-[#262626]">
            <span className="text-[10px] text-[#A1A1AA] uppercase block">FC REPOUSO</span>
            <span className="font-headline text-2xl text-[#F7F5F3] block mt-0.5">
              {athlete.restingHR ? `${athlete.restingHR} bpm` : '—'}
            </span>
            <span
              className={`text-[9px] font-bold ${
                readiness.rhrDiff === 0
                  ? 'text-[#A1A1AA]'
                  : readiness.rhrDiff < 0
                    ? 'text-[#22C55E]'
                    : 'text-[#FACC15]'
              }`}
            >
              {readiness.rhrDiff === 0
                ? 'na baseline'
                : `${readiness.rhrDiff > 0 ? '+' : ''}${readiness.rhrDiff} bpm vs. baseline`}
            </span>
          </div>
        </div>
      </div>

      {/* Recordes Pessoais (PRs) */}
      <div className="bg-[#1C1C1C] rounded-2xl p-4 border border-[#262626] space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-xs text-[#A1A1AA] uppercase tracking-wider">
            Recordes Pessoais Oficiais (PRs)
          </span>
          <span className="font-telemetry text-xs text-[#FF5500] font-bold">HOMOLOGADOS</span>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center font-telemetry">
          <div className="bg-[#101010] p-2.5 rounded-xl border border-[#262626]">
            <span className="text-[10px] text-[#A1A1AA] uppercase block">5 KM</span>
            <span className="font-headline text-base text-[#F7F5F3] block mt-0.5">{athlete.pr5k}</span>
            <span className="text-[9px] text-[#FF5500]">{personalRecords?.['5k']?.avg_pace || '—'}</span>
          </div>
          <div className="bg-[#101010] p-2.5 rounded-xl border border-[#262626]">
            <span className="text-[10px] text-[#A1A1AA] uppercase block">10 KM</span>
            <span className="font-headline text-base text-[#F7F5F3] block mt-0.5">{athlete.pr10k}</span>
            <span className="text-[9px] text-[#FF5500]">{personalRecords?.['10k']?.avg_pace || '—'}</span>
          </div>
          <div className="bg-[#101010] p-2.5 rounded-xl border border-[#22C55E]/40">
            <span className="text-[10px] text-[#22C55E] uppercase block font-bold">21 KM</span>
            <span className="font-headline text-base text-[#22C55E] block mt-0.5">{athlete.pr21k}</span>
            <span className="text-[9px] text-[#22C55E] font-bold">{personalRecords?.['21k']?.avg_pace || '—'}</span>
          </div>
          <div className="bg-[#101010] p-2.5 rounded-xl border border-[#262626]">
            <span className="text-[10px] text-[#A1A1AA] uppercase block">42 KM</span>
            <span className="font-headline text-base text-[#F7F5F3] block mt-0.5">{athlete.pr42k}</span>
            <span className="text-[9px] text-[#FF5500]">{personalRecords?.['42k']?.avg_pace || '—'}</span>
          </div>
        </div>
      </div>

      {/* Hardware & Gear Garage Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onOpenGearGarage}
          className="min-h-[56px] p-3.5 bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] rounded-2xl flex items-center justify-between transition-all cursor-pointer shadow-md text-left"
        >
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#FF5500] text-[24px]">sports_martial_arts</span>
            <div>
              <span className="font-headline text-sm uppercase text-[#F7F5F3] block">Garagem de Tênis</span>
              <span className="text-[10px] text-[#A1A1AA]">
                {shoesSummary && shoesSummary.active_count > 0
                  ? `${shoesSummary.active_count} ${shoesSummary.active_count === 1 ? 'par ativo' : 'pares ativos'}${
                      shoesSummary.critical_count > 0 ? ` • ${shoesSummary.critical_count} crítico` : ''
                    }`
                  : 'Nenhum par cadastrado'}
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-[#A1A1AA] text-[18px]">chevron_right</span>
        </button>

        <button
          onClick={onOpenBleHardware}
          className="min-h-[56px] p-3.5 bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] rounded-2xl flex items-center justify-between transition-all cursor-pointer shadow-md text-left"
        >
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#22C55E] text-[24px]">bluetooth_connected</span>
            <div>
              <span className="font-headline text-sm uppercase text-[#F7F5F3] block">Sensores BLE</span>
              <span className="text-[10px] text-[#A1A1AA] truncate block max-w-[130px]">
                {devices.length > 0 ? devices.map((d) => d.brand).join(' • ') : 'Nenhum sensor pareado'}
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-[#A1A1AA] text-[18px]">chevron_right</span>
        </button>
      </div>

      {/* Profile Subtabs */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 border-b border-[#262626] pb-2">
          {[
            { id: 'posts', label: 'Atividades Recentes' },
            { id: 'stats', label: 'Estatísticas & Carga' },
            { id: 'badges', label: `Conquistas (${achievementsEarned.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`min-h-[44px] py-1.5 px-3 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#FF5500] text-[#0D0D0D] shadow-md'
                  : 'bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'posts' && (
          <div className="space-y-3">
            {recentActivities.length === 0 && (
              <div className="bg-[#1C1C1C] p-6 rounded-2xl border border-dashed border-[#262626] text-center">
                <span className="material-symbols-outlined text-[30px] text-[#404040]">directions_run</span>
                <p className="text-xs text-[#737373] mt-2">Nenhuma atividade registrada ainda.</p>
              </div>
            )}

            {recentActivities.slice(0, 6).map((activity) => (
              <div key={activity.id} className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-headline text-base text-[#F7F5F3] uppercase truncate">
                    {activity.title || 'Atividade'}
                  </span>
                  <span className="text-xs font-telemetry text-[#A1A1AA] shrink-0">
                    {timeAgo(activity.date)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs font-telemetry text-[#A1A1AA] flex-wrap">
                  <span className="text-[#F7F5F3] font-bold">{(activity.distance_km || 0).toFixed(2)} km</span>
                  <span>•</span>
                  <span>{formatDuration(activity.duration_seconds || 0)}</span>
                  <span>•</span>
                  <span className="text-[#FF5500]">
                    {activity.avg_pace || `${paceFromActivity(activity.distance_km || 0, activity.duration_seconds || 0)}/km`}
                  </span>
                  {activity.avg_hr && (
                    <>
                      <span>•</span>
                      <span className="text-[#EF4444]">{activity.avg_hr} bpm</span>
                    </>
                  )}
                </div>
                {(activity.feeling_notes || activity.description) && (
                  <p className="text-xs text-[#A1A1AA] leading-relaxed">
                    {activity.feeling_notes || activity.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] space-y-3">
            <span className="font-headline text-base text-[#F7F5F3] uppercase block">
              Volume semanal
              {weeklySummary.targetKm > 0
                ? ` (${weeklySummary.completedKm.toFixed(1)} km / ${weeklySummary.targetKm.toFixed(1)} km meta)`
                : ` (${weeklySummary.completedKm.toFixed(1)} km — sem meta planejada)`}
            </span>
            <div className="w-full h-3 bg-[#101010] rounded-full overflow-hidden border border-[#262626]">
              <div
                className="h-full bg-[#FF5500] rounded-full transition-all"
                style={{ width: `${weeklySummary.progressPercent ?? 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-[#A1A1AA] font-telemetry pt-1 gap-2 flex-wrap">
              <span>
                {trainingLoad?.has_enough_history && trainingLoad.acwr != null
                  ? `ACWR: ${trainingLoad.acwr.toFixed(2)}`
                  : 'ACWR: histórico insuficiente'}
              </span>
              <span className="text-[#22C55E] font-bold">
                {trainingLoad?.zone ? ACWR_ZONE_TEXT[trainingLoad.zone] : '—'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="bg-[#101010] p-2.5 rounded-lg border border-[#262626]">
                <span className="text-[9px] text-[#737373] uppercase block">SESSÕES 7D</span>
                <span className="font-telemetry text-sm text-[#F7F5F3] font-bold">
                  {weeklySummary.activityCount}
                </span>
              </div>
              <div className="bg-[#101010] p-2.5 rounded-lg border border-[#262626]">
                <span className="text-[9px] text-[#737373] uppercase block">PACE MÉDIO</span>
                <span className="font-telemetry text-sm text-[#F7F5F3] font-bold">{weeklySummary.avgPace}</span>
              </div>
              <div className="bg-[#101010] p-2.5 rounded-lg border border-[#262626]">
                <span className="text-[9px] text-[#737373] uppercase block">KM TOTAIS</span>
                <span className="font-telemetry text-sm text-[#F7F5F3] font-bold">{athlete.totalKm}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'badges' && (
          <div className="space-y-3">
            {achievementsEarned.length === 0 && pending.length === 0 && (
              <p className="text-xs text-[#737373]">Nenhuma conquista cadastrada.</p>
            )}

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {achievementsEarned.map((badge) => (
                <div
                  key={badge.id}
                  className="bg-[#1C1C1C] p-3 rounded-2xl border border-[#22C55E]/40 space-y-1"
                  title={badge.description}
                >
                  <span className="text-2xl">{badge.icon}</span>
                  <span className="font-bold text-[#F7F5F3] block leading-tight">{badge.name}</span>
                  <span className="text-[10px] text-[#22C55E]">
                    {badge.earned_at ? new Date(badge.earned_at).toLocaleDateString('pt-BR') : 'Conquistado'}
                  </span>
                </div>
              ))}

              {pending.map((badge) => (
                <div
                  key={badge.id}
                  className="bg-[#1C1C1C] p-3 rounded-2xl border border-[#262626] space-y-1 opacity-60"
                  title={badge.description}
                >
                  <span className="text-2xl">🔒</span>
                  <span className="font-bold text-[#A1A1AA] block leading-tight">{badge.name}</span>
                  <span className="text-[10px] text-[#737373]">Bloqueada</span>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-[#737373] text-center">
              {achievementsEarned.length} de {achievementsAll.length} conquistas desbloqueadas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
