import React, { useState } from 'react';
import { APP_IMAGES } from '../../data/appAssets';
import { ImageViewerItem } from '../../types';

interface WorkoutSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenStoryExporter: () => void;
  onPublishToFeed: () => void;
  onViewImage: (item: ImageViewerItem) => void;
}

export const WorkoutSummaryModal: React.FC<WorkoutSummaryModalProps> = ({
  isOpen,
  onClose,
  onOpenStoryExporter,
  onPublishToFeed,
  onViewImage,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'splits' | 'dynamics'>('overview');

  if (!isOpen) return null;

  const splits = [
    { km: 1, pace: '4:28', hr: 148, elev: '+4m' },
    { km: 5, pace: '4:22', hr: 162, elev: '+2m' },
    { km: 10, pace: '4:19', hr: 165, elev: '-1m' },
    { km: 15, pace: '4:18', hr: 168, elev: '+8m' },
    { km: 18, pace: '4:02', hr: 178, elev: '-3m', isFastest: true },
    { km: 21, pace: '4:14', hr: 174, elev: '+0m' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-title"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/92 backdrop-blur-md transition-opacity"
    >
      <div className="flex-1 w-full" onClick={onClose} />

      <div className="relative w-full max-w-xl mx-auto max-h-[95vh] flex flex-col bg-[#0D0D0D] rounded-t-3xl border-t border-[#22C55E]/60 shadow-[0_-12px_45px_rgba(0,0,0,0.95)] overflow-hidden">
        {/* Grab Pill */}
        <div className="w-full flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-[#353534]" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-[#262626]">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
              <span className="font-label-sm text-[10px] text-[#22C55E] tracking-widest uppercase font-bold">
                TREINO CONCLUÍDO COM SUCESSO
              </span>
            </div>
            <h2 id="summary-title" className="font-headline text-2xl text-[#F7F5F3] uppercase tracking-normal">
              Meia Maratona • 21.10 KM
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar resumo do treino"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* PR Alert Banner */}
          <div className="bg-gradient-to-r from-[#22C55E]/20 via-[#FF5500]/20 to-transparent p-4 rounded-2xl border border-[#22C55E]/50 flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-[#22C55E]/25 border border-[#22C55E]/50 flex items-center justify-center text-[#22C55E] shrink-0">
                <span className="material-symbols-outlined text-[26px]">emoji_events</span>
              </div>
              <div>
                <span className="font-headline text-lg text-[#F7F5F3] uppercase tracking-wide block">
                  Novo Recorde Pessoal (RP)!
                </span>
                <span className="text-xs text-[#e5e2e1]">
                  -1m 48s em relação à melhor marca anterior de 21K.
                </span>
              </div>
            </div>
            <span className="font-telemetry text-xs font-black text-[#22C55E] bg-[#22C55E]/20 px-2 py-1 rounded">
              TOP 3%
            </span>
          </div>

          {/* Primary Telemetry Bento */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-[#1C1C1C] p-3 rounded-xl border border-[#262626]">
              <span className="text-[10px] text-[#A1A1AA] uppercase block font-label-caps">DISTÂNCIA</span>
              <span className="font-headline text-2xl text-[#F7F5F3] block mt-0.5">21.10</span>
              <span className="text-[10px] text-[#A1A1AA]">Quilômetros</span>
            </div>
            <div className="bg-[#1C1C1C] p-3 rounded-xl border border-[#262626]">
              <span className="text-[10px] text-[#A1A1AA] uppercase block font-label-caps">TEMPO OFICIAL</span>
              <span className="font-headline text-2xl text-[#FF5500] block mt-0.5">1:32:04</span>
              <span className="text-[10px] text-[#A1A1AA]">4:21 /km médio</span>
            </div>
            <div className="bg-[#1C1C1C] p-3 rounded-xl border border-[#262626]">
              <span className="text-[10px] text-[#A1A1AA] uppercase block font-label-caps">CARDIO Z4</span>
              <span className="font-headline text-2xl text-[#F7F5F3] block mt-0.5">166</span>
              <span className="text-[10px] text-[#A1A1AA]">BPM médio</span>
            </div>
          </div>

          {/* Tab Filter Switcher */}
          <div className="flex items-center gap-1.5 bg-[#1C1C1C] p-1 rounded-xl border border-[#262626]">
            {[
              { id: 'overview', label: 'Visão Geral & Mapa' },
              { id: 'splits', label: 'Splits Km a Km' },
              { id: 'dynamics', label: 'Dinâmica Biomecânica' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-h-[44px] py-2 px-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#FF5500] text-[#0D0D0D] shadow-md'
                    : 'text-[#A1A1AA] hover:text-[#F7F5F3]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Overview & Map */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Tactical GPS Heatmap Card */}
              <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] overflow-hidden shadow-lg space-y-3">
                <div className="relative h-44 bg-[#101010] flex items-center justify-center overflow-hidden">
                  <img
                    src={APP_IMAGES.workoutSprintTrack}
                    alt="Circuito do Treino"
                    className="w-full h-full object-cover opacity-60"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1C1C1C] via-black/30 to-black/60" />

                  {/* SVG Route Heatmap overlay */}
                  <svg className="absolute inset-0 w-full h-full p-4 overflow-visible" viewBox="0 0 400 160">
                    <path
                      d="M 30 110 Q 80 40 160 50 T 260 100 T 360 40"
                      fill="none"
                      stroke="#FF5500"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 260 100 T 360 40"
                      fill="none"
                      stroke="#22C55E"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                  </svg>

                  <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 text-xs font-telemetry flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
                    <span>USP RAIA OLÍMPICA • MULTI-GNSS L1+L5</span>
                  </div>

                  <div className="absolute bottom-3 right-3 bg-[#FF5500] text-[#0D0D0D] font-headline text-xs px-2.5 py-1 rounded shadow">
                    SPLIT MAIS RÁPIDO: 4:02/km
                  </div>
                </div>

                <div className="px-4 pb-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-[#101010] p-2.5 rounded-lg border border-[#262626]">
                    <span className="text-[#A1A1AA] uppercase text-[10px] block">ALTIMETRIA</span>
                    <span className="font-telemetry text-sm text-[#F7F5F3] font-bold mt-0.5 block">+148 m</span>
                  </div>
                  <div className="bg-[#101010] p-2.5 rounded-lg border border-[#262626]">
                    <span className="text-[#A1A1AA] uppercase text-[10px] block">GASTO</span>
                    <span className="font-telemetry text-sm text-[#F7F5F3] font-bold mt-0.5 block">1.482 kcal</span>
                  </div>
                  <div className="bg-[#101010] p-2.5 rounded-lg border border-[#262626]">
                    <span className="text-[#A1A1AA] uppercase text-[10px] block">CADÊNCIA</span>
                    <span className="font-telemetry text-sm text-[#22C55E] font-bold mt-0.5 block">182 SPM</span>
                  </div>
                </div>
              </div>

              {/* Heart Rate Zones Distribution */}
              <div className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-xs text-[#A1A1AA] uppercase tracking-wider">
                    Distribuição pelas Zonas Cardíacas
                  </span>
                  <span className="font-telemetry text-xs text-[#FF5500] font-bold">53% EM ZONA 4</span>
                </div>

                <div className="space-y-2">
                  {[
                    { zone: 'Z5 (Máxima >179)', pct: 8, color: '#EF4444', time: '7m 22s' },
                    { zone: 'Z4 (Limiar 166-178)', pct: 53, color: '#FF5500', time: '48m 48s', highlight: true },
                    { zone: 'Z3 (Tempo 153-165)', pct: 24, color: '#FACC15', time: '22m 05s' },
                    { zone: 'Z2 (Aeróbica 139-152)', pct: 12, color: '#22C55E', time: '11m 03s' },
                    { zone: 'Z1 (Recovery <138)', pct: 3, color: '#3B82F6', time: '2m 46s' },
                  ].map((z) => (
                    <div key={z.zone} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-telemetry">
                        <span className={`font-bold ${z.highlight ? 'text-[#FF5500]' : 'text-[#F7F5F3]'}`}>
                          {z.zone}
                        </span>
                        <span className="text-[#A1A1AA]">{z.time} ({z.pct}%)</span>
                      </div>
                      <div className="w-full h-2 bg-[#101010] rounded-full overflow-hidden border border-[#262626]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${z.pct}%`, backgroundColor: z.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Splits */}
          {activeTab === 'splits' && (
            <div className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-label-caps text-xs text-[#A1A1AA] uppercase tracking-wider">
                  Splits Parciais por Quilômetro
                </span>
                <span className="font-telemetry text-xs text-[#22C55E] font-bold">RITMO NEGATIVO</span>
              </div>

              <div className="divide-y divide-[#262626]">
                {splits.map((s) => (
                  <div
                    key={s.km}
                    className={`py-2.5 flex items-center justify-between text-xs font-telemetry ${
                      s.isFastest ? 'bg-[#FF5500]/10 px-2 rounded-lg -mx-2' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#F7F5F3]">KM {s.km}</span>
                      {s.isFastest && (
                        <span className="bg-[#FF5500] text-[#0D0D0D] text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase">
                          MAIS RÁPIDO
                        </span>
                      )}
                    </div>
                    <span className="text-[#A1A1AA]">{s.elev}</span>
                    <span className="text-[#F7F5F3] font-bold">{s.hr} bpm</span>
                    <span className="font-headline text-sm text-[#FF5500]">{s.pace}/km</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Dynamics */}
          {activeTab === 'dynamics' && (
            <div className="space-y-3">
              <div className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] space-y-3">
                <span className="font-label-caps text-xs text-[#A1A1AA] uppercase tracking-wider block">
                  Dinâmica de Corrida Avançada (Stryd & Polar)
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#101010] p-3 rounded-xl border border-[#262626]">
                    <span className="text-[10px] text-[#A1A1AA] uppercase block">OSCILAÇÃO VERTICAL</span>
                    <span className="font-headline text-2xl text-[#22C55E] block mt-0.5">7.8 cm</span>
                    <span className="text-[10px] text-[#22C55E] font-bold">Faixa de Elite (&lt;8.0cm)</span>
                  </div>
                  <div className="bg-[#101010] p-3 rounded-xl border border-[#262626]">
                    <span className="text-[10px] text-[#A1A1AA] uppercase block">TEMPO CONTATO SOLO</span>
                    <span className="font-headline text-2xl text-[#22C55E] block mt-0.5">214 ms</span>
                    <span className="text-[10px] text-[#22C55E] font-bold">Alta Elasticidade</span>
                  </div>
                  <div className="bg-[#101010] p-3 rounded-xl border border-[#262626]">
                    <span className="text-[10px] text-[#A1A1AA] uppercase block">EQUILÍBRIO GCT</span>
                    <span className="font-headline text-xl text-[#F7F5F3] block mt-0.5">49.8% / 50.2%</span>
                    <span className="text-[10px] text-[#A1A1AA]">Simetria Perfeita</span>
                  </div>
                  <div className="bg-[#101010] p-3 rounded-xl border border-[#262626]">
                    <span className="text-[10px] text-[#A1A1AA] uppercase block">PASSADA MÉDIA</span>
                    <span className="font-headline text-xl text-[#F7F5F3] block mt-0.5">1.28 m</span>
                    <span className="text-[10px] text-[#A1A1AA]">Potência: 340 Watts</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action CTAs */}
          <div className="space-y-2.5 pt-2">
            <button
              onClick={() => {
                onClose();
                onOpenStoryExporter();
              }}
              className="w-full min-h-[52px] py-3.5 px-4 bg-[#FF5500] hover:bg-[#FF6B00] active:scale-[0.98] text-[#0D0D0D] rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#FF5500]/25 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[22px]">auto_stories</span>
              <span className="font-headline text-base uppercase tracking-wider whitespace-nowrap">
                Compartilhar Sticker de Telemetria (9:16)
              </span>
            </button>

            <button
              onClick={() => {
                onClose();
                onPublishToFeed();
              }}
              className="w-full min-h-[48px] py-3 px-4 bg-[#262626] hover:bg-[#353534] active:scale-[0.98] text-[#F7F5F3] rounded-xl flex items-center justify-center gap-2 border border-[#353534] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px] text-[#FF5500]">post_add</span>
              <span className="font-bold text-xs uppercase tracking-wider">
                Publicar no Feed da Comunidade
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
