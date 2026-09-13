import React from 'react';
import { RUNNING_SHOES, RETIRED_SHOE_CRITICAL } from '../../data/appAssets';
import { ImageViewerItem, RunningShoe } from '../../types';
import { downloadImageToDevice } from '../../utils/imageDownload';

interface GearGarageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenShoeRetirement: () => void;
  onViewImage: (item: ImageViewerItem) => void;
}

export const GearGarageModal: React.FC<GearGarageModalProps> = ({
  isOpen,
  onClose,
  onOpenShoeRetirement,
  onViewImage,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gear-garage-title"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/90 backdrop-blur-md transition-opacity"
    >
      <div className="flex-1 w-full" onClick={onClose} />

      <div className="relative w-full max-w-xl mx-auto max-h-[92vh] flex flex-col bg-[#0D0D0D] rounded-t-3xl border-t border-[#FF5500]/50 shadow-[0_-12px_40px_rgba(0,0,0,0.9)] overflow-hidden">
        {/* Grab Pill */}
        <div className="w-full flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-[#353534]" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-[#262626]">
          <div>
            <span className="font-label-sm text-[10px] text-[#FF5500] tracking-widest uppercase block">
              EQUIPAMENTOS & FROTA
            </span>
            <h2 id="gear-garage-title" className="font-headline text-2xl text-[#F7F5F3] uppercase tracking-normal">
              Garagem de Tênis
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3] flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Fechar garagem de tênis"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Fleet Mileage Summary Card */}
          <div className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-xs text-[#A1A1AA] uppercase tracking-wider">
                Fleet Mileage Tracker
              </span>
              <span className="font-telemetry text-xs text-[#22C55E] font-bold">3 ATIVOS • 1 APOSENTADO</span>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <span className="font-headline text-4xl text-[#F7F5F3] tracking-tight">1.527</span>
                <span className="font-label-sm text-xs text-[#A1A1AA] uppercase ml-1.5">KM MONITORADOS</span>
              </div>
              <div className="text-right">
                <span className="font-telemetry text-sm text-[#FF5500] font-bold">48% SAÚDE MÉDIA</span>
                <span className="text-[10px] text-[#A1A1AA] block">Rodízio Ativo</span>
              </div>
            </div>

            {/* Micro Breakdown Bar */}
            <div className="w-full h-2.5 bg-[#101010] rounded-full overflow-hidden flex border border-[#262626]">
              <div className="bg-[#22C55E] h-full" style={{ width: '45%' }} title="Amortecimento Ótimo" />
              <div className="bg-[#FACC15] h-full" style={{ width: '35%' }} title="Atenção" />
              <div className="bg-[#EF4444] h-full" style={{ width: '20%' }} title="Aposentado/Crítico" />
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] font-telemetry pt-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#22C55E]" /> Ótimo (1 par)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#FACC15]" /> Moderado (1 par)
              </span>
              <span className="flex items-center gap-1 text-[#EF4444]">
                <span className="w-2 h-2 rounded-full bg-[#EF4444]" /> Crítico (1 par)
              </span>
            </div>
          </div>

          {/* Urgent Critical Alert Banner */}
          <div className="bg-[#EF4444]/15 border border-[#EF4444]/50 rounded-2xl p-4 shadow-lg flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#EF4444]/20 border border-[#EF4444]/40 flex items-center justify-center text-[#EF4444] shrink-0">
                <span className="material-symbols-outlined text-[24px]">crisis_alert</span>
              </div>
              <div className="min-w-0">
                <span className="font-headline text-base text-[#F7F5F3] uppercase tracking-wide block">
                  Colapso de Espuma Detectado!
                </span>
                <p className="text-xs text-[#e5e2e1] mt-0.5 leading-relaxed">
                  O par <strong className="text-[#EF4444]">Asics Superblast 2</strong> atingiu 712 km (102%). Impacto tibial elevado em +38%.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                onOpenShoeRetirement();
              }}
              className="min-h-[44px] bg-[#EF4444] hover:bg-[#DC2626] active:scale-95 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shrink-0 uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <span>Ver Diagnóstico</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

          {/* Active Shoes List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-lg text-[#F7F5F3] uppercase tracking-normal">
                Calçados em Rotação Ativa (3)
              </h3>
              <button
                onClick={() => alert('Formulário de cadastro de novo par de tênis.')}
                className="text-xs text-[#FF5500] hover:text-[#FF6B00] font-bold flex items-center gap-1 uppercase cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                <span>Adicionar Tênis</span>
              </button>
            </div>

            <div className="space-y-3">
              {RUNNING_SHOES.map((shoe) => {
                const pct = Math.round((shoe.currentKm / shoe.maxKm) * 100);
                return (
                  <div
                    key={shoe.id}
                    className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 shadow-md space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative w-16 h-16 rounded-xl bg-[#101010] border border-[#262626] overflow-hidden shrink-0">
                          <img
                            src={shoe.imageUrl}
                            alt={shoe.name}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() =>
                              onViewImage({
                                url: shoe.imageUrl,
                                title: `${shoe.name} (${shoe.currentKm} km)`,
                                subtitle: shoe.modelType,
                                category: 'GARAGEM DE TÊNIS',
                                filename: `${shoe.id}.jpg`,
                              })
                            }
                            className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                          >
                            <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                          </button>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-headline text-lg text-[#F7F5F3] uppercase tracking-wide truncate">
                              {shoe.name}
                            </h4>
                            {shoe.isDefault && (
                              <span className="bg-[#FF5500]/15 text-[#FF5500] font-label-sm text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                                PADRÃO PROVAS
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#A1A1AA] truncate mt-0.5">{shoe.modelType}</p>
                          <span className="text-[10px] text-[#737373] block truncate">{shoe.plateTechnology}</span>
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          downloadImageToDevice(
                            shoe.imageUrl,
                            `${shoe.id}.jpg`,
                            `${shoe.name} - Imagem`
                          )
                        }
                        className="w-9 h-9 rounded-lg bg-[#101010] text-[#A1A1AA] hover:text-[#F7F5F3] border border-[#262626] flex items-center justify-center transition-colors cursor-pointer"
                        title="Baixar imagem do calçado"
                      >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                      </button>
                    </div>

                    {/* Progress & Mileage */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs font-telemetry">
                        <span className="text-[#A1A1AA]">
                          {shoe.currentKm} km rodados / {shoe.maxKm} km máx
                        </span>
                        <span
                          className={`font-bold ${
                            pct >= 70 ? 'text-[#FACC15]' : 'text-[#22C55E]'
                          }`}
                        >
                          {pct}% consumido
                        </span>
                      </div>

                      <div className="w-full h-2 bg-[#101010] rounded-full overflow-hidden border border-[#262626]">
                        <div
                          className={`h-full rounded-full ${
                            pct >= 70
                              ? 'bg-gradient-to-r from-[#FACC15] to-[#FF5500]'
                              : 'bg-[#22C55E]'
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] pt-1">
                        <span>Pace médio: <strong className="text-[#F7F5F3]">{shoe.avgPace}</strong></span>
                        <span>{shoe.sessionsCount} sessões</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Retired Shoe Shortcut */}
          <div className="bg-[#1C1C1C] rounded-2xl border border-[#EF4444]/40 p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[#EF4444]">
                <span className="material-symbols-outlined text-[18px]">archive</span>
                <span className="font-headline text-base text-[#F7F5F3] uppercase">
                  Calçado Aposentado / Crítico
                </span>
              </div>
              <span className="bg-[#EF4444]/15 text-[#EF4444] font-telemetry text-xs font-bold px-2 py-0.5 rounded">
                712 / 700 KM
              </span>
            </div>

            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              {RETIRED_SHOE_CRITICAL.name} ({RETIRED_SHOE_CRITICAL.pairNumber}) encerrou a vida útil biomecânica. Veja a telemetria de impacto tibial e os modelos substitutos com desconto RUSH PRO.
            </p>

            <button
              onClick={() => {
                onClose();
                onOpenShoeRetirement();
              }}
              className="w-full min-h-[44px] bg-[#262626] hover:bg-[#353534] text-[#F7F5F3] font-bold text-xs py-2.5 px-4 rounded-xl border border-[#353534] flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-[#EF4444]">troubleshoot</span>
              <span>Abrir Telemetria de Desgaste & Substitutos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
