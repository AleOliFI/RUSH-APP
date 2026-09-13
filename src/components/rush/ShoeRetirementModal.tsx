import React, { useState } from 'react';
import { RETIRED_SHOE_CRITICAL } from '../../data/appAssets';
import { ImageViewerItem } from '../../types';
import { downloadImageToDevice } from '../../utils/imageDownload';

interface ShoeRetirementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewImage: (item: ImageViewerItem) => void;
}

export const ShoeRetirementModal: React.FC<ShoeRetirementModalProps> = ({
  isOpen,
  onClose,
  onViewImage,
}) => {
  const [isRetired, setIsRetired] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState<'all' | 'volume' | 'race' | 'recovery'>('volume');
  const [selectedStrike, setSelectedStrike] = useState<'neutra' | 'pronada' | 'supinada'>('neutra');
  const [selectedTerrain, setSelectedTerrain] = useState<'asfalto' | 'pista' | 'misto'>('asfalto');
  const shoe = RETIRED_SHOE_CRITICAL;

  if (!isOpen) return null;

  const handleRetireShoe = () => {
    setIsRetired(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shoe-retirement-title"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/90 backdrop-blur-md transition-opacity"
    >
      <div className="flex-1 w-full" onClick={onClose} />

      <div className="relative w-full max-w-xl mx-auto max-h-[94vh] flex flex-col bg-[#0D0D0D] rounded-t-3xl border-t border-[#EF4444]/60 shadow-[0_-12px_45px_rgba(0,0,0,0.95)] overflow-hidden">
        {/* Grab Pill */}
        <div className="w-full flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-[#353534]" />
        </div>

        {/* Modal Header with Critical Alert */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-[#262626] bg-[#1a0f0f]/60">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-ping" />
              <span className="font-label-sm text-[10px] text-[#EF4444] tracking-widest uppercase font-bold">
                DIAGNÓSTICO BIOMECÂNICO CRÍTICO
              </span>
            </div>
            <h2 id="shoe-retirement-title" className="font-headline text-2xl text-[#F7F5F3] uppercase tracking-normal">
              {shoe.name} • {isRetired ? 'APOSENTADO' : 'LIMITE ATINGIDO'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar diagnóstico"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Main Shoe Card with Image & High Contrast degradation */}
          <div className="bg-[#1C1C1C] rounded-2xl border border-[#EF4444]/40 overflow-hidden shadow-xl">
            <div className="relative h-52 w-full bg-[#101010] flex items-center justify-center overflow-hidden">
              <img
                src={shoe.imageUrl}
                alt={shoe.name}
                className="w-full h-full object-cover opacity-90 hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1C1C1C] via-transparent to-black/40" />

              {/* Badges Over Image */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="bg-[#EF4444] text-[#0D0D0D] font-headline text-xs px-2.5 py-1 rounded uppercase tracking-wider font-extrabold flex items-center gap-1 shadow-md">
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  102% DESGASTADO
                </span>
                <span className="bg-[#101010]/80 backdrop-blur-md text-[#F7F5F3] font-telemetry text-xs px-2 py-0.5 rounded border border-[#262626]">
                  {shoe.currentKm} / {shoe.maxKm} KM
                </span>
              </div>

              {/* View & Download Buttons */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <button
                  onClick={() =>
                    onViewImage({
                      url: shoe.imageUrl,
                      title: `${shoe.name} (${shoe.currentKm} km)`,
                      subtitle: 'Desgaste severo de entressola detectado por sensores',
                      category: 'DIAGNÓSTICO DE CALÇADO',
                      filename: 'asics_superblast2_worn_critical.jpg',
                    })
                  }
                  className="min-h-[44px] min-w-[44px] bg-[#0D0D0D]/85 hover:bg-[#0D0D0D] text-white p-2.5 rounded-xl border border-white/20 flex items-center justify-center backdrop-blur-md transition-all cursor-pointer"
                  title="Visualizar em alta resolução"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                </button>
                <button
                  onClick={() =>
                    downloadImageToDevice(
                      shoe.imageUrl,
                      'asics_superblast2_worn_critical.jpg',
                      `${shoe.name} - Telemetria de Desgaste`
                    )
                  }
                  className="min-h-[44px] min-w-[44px] bg-[#FF5500] hover:bg-[#FF6B00] text-[#0D0D0D] p-2.5 rounded-xl flex items-center justify-center font-bold shadow-lg transition-all cursor-pointer"
                  title="Baixar foto do calçado"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                </button>
              </div>
            </div>

            {/* Degradation Metrics Bar */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#A1A1AA] uppercase font-label-caps tracking-wider">
                  Vida Útil da Entressola Supercritical
                </span>
                <span className="text-[#EF4444] font-telemetry font-bold">
                  +{shoe.overKm} KM ALÉM DO LIMITE SEGURO
                </span>
              </div>

              <div className="w-full h-3 bg-[#101010] rounded-full overflow-hidden border border-[#262626]">
                <div
                  className="h-full bg-gradient-to-r from-[#22C55E] via-[#FACC15] to-[#EF4444] rounded-full"
                  style={{ width: '100%' }}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-telemetry text-[#A1A1AA] pt-1">
                <span>0 km (Novo)</span>
                <span>350 km (50%)</span>
                <span className="text-[#EF4444] font-bold">700 km (Limite Máx)</span>
              </div>
            </div>
          </div>

          {/* Telemetria Biomecânica Coletada */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-lg text-[#F7F5F3] uppercase tracking-normal">
                Telemetria Coletada (Stryd & Polar)
              </h3>
              <span className="font-telemetry text-[11px] text-[#A1A1AA]">ID: {shoe.reportId}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#1C1C1C] p-3.5 rounded-xl border border-[#EF4444]/30 space-y-1">
                <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
                  IMPACTO TIBIAL MÉDIO
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-headline text-2xl text-[#EF4444]">{shoe.tibialImpactG} G</span>
                  <span className="text-[10px] text-[#EF4444] font-telemetry font-bold">ZONA VERMELHA</span>
                </div>
                <span className="font-telemetry text-[11px] text-[#EF4444] block">
                  {shoe.tibialImpactDiff}
                </span>
              </div>

              <div className="bg-[#1C1C1C] p-3.5 rounded-xl border border-[#EF4444]/30 space-y-1">
                <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
                  TEMPO CONTATO SOLO
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-headline text-2xl text-[#EF4444]">{shoe.groundContactTimeMs} ms</span>
                  <span className="text-[10px] text-[#FACC15] font-telemetry font-bold">LENTO</span>
                </div>
                <span className="font-telemetry text-[11px] text-[#A1A1AA] block">
                  {shoe.groundContactDiff}
                </span>
              </div>

              <div className="bg-[#1C1C1C] p-3.5 rounded-xl border border-[#262626] space-y-1">
                <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
                  RETORNO DE ENERGIA
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-headline text-2xl text-[#FACC15]">{shoe.residualElasticEnergy}%</span>
                  <span className="text-[10px] text-[#A1A1AA] font-telemetry font-bold">RESIDUAL</span>
                </div>
                <span className="font-telemetry text-[11px] text-[#A1A1AA] block">
                  Colapso de Espuma
                </span>
              </div>

              <div className="bg-[#1C1C1C] p-3.5 rounded-xl border border-[#262626] space-y-1">
                <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
                  HISTÓRICO DE SESSÕES
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-headline text-2xl text-[#F7F5F3]">{shoe.sessionsLogged}</span>
                  <span className="text-[10px] text-[#A1A1AA] font-telemetry font-bold">TREINOS</span>
                </div>
                <span className="font-telemetry text-[11px] text-[#A1A1AA] block">
                  Ritmo Médio: {shoe.historicalPace}
                </span>
              </div>
            </div>
          </div>

          {/* AI Forensic Report Card */}
          <div className="bg-[#1C1C1C] p-4 rounded-xl border border-[#262626] space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FF5500] text-[20px]">psychology</span>
                <span className="font-label-caps text-xs text-[#FF5500] uppercase tracking-wider font-bold">
                  Parecer Prometheus AI (Stryd Sync)
                </span>
              </div>
              <span className="font-telemetry text-xs text-[#22C55E] font-bold">
                CONFIANÇA {shoe.modelConfidence}
              </span>
            </div>
            <p className="text-xs text-[#e5e2e1] leading-relaxed italic">
              {shoe.aiReport}
            </p>
          </div>

          {/* Action: Aposentar Este Tênis Agora */}
          <div>
            {!isRetired ? (
              <button
                onClick={handleRetireShoe}
                className="w-full min-h-[52px] py-3.5 px-4 bg-[#EF4444] hover:bg-[#DC2626] active:scale-[0.98] text-white rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#EF4444]/25 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[22px]">archive</span>
                <span className="font-headline text-base uppercase tracking-wider whitespace-nowrap">
                  Aposentar Este Tênis Agora
                </span>
              </button>
            ) : (
              <div className="p-4 bg-[#22C55E]/15 border border-[#22C55E]/40 rounded-xl flex items-center gap-3 text-[#22C55E]">
                <span className="material-symbols-outlined text-[24px]">verified</span>
                <div>
                  <span className="font-bold text-sm block">Calçado Aposentado com Honras!</span>
                  <span className="text-xs text-[#A1A1AA]">
                    Registrado na frota histórica (712 km). O modelo não será sugerido para treinos ativos.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Seção: Filtros Avançados de Biomecânica & Recomendações */}
          <div className="space-y-4 pt-2 border-t border-[#262626]">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-label-sm text-[10px] text-[#FF5500] uppercase tracking-widest font-bold">
                  PROMETHEUS ENGINE
                </span>
                <h3 className="font-headline text-xl text-[#F7F5F3] uppercase tracking-normal">
                  Substitutos Compatíveis com seu Perfil
                </h3>
              </div>
              <span className="bg-[#FF5500]/15 text-[#FF5500] font-telemetry text-xs font-bold px-2 py-0.5 rounded">
                2 MATCHES
              </span>
            </div>

            {/* Quick Interactive Filters */}
            <div className="space-y-2">
              <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
                Objetivo do Treino
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'volume', label: 'Rodagem' },
                  { id: 'race', label: 'Provas' },
                  { id: 'recovery', label: 'Recovery' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedObjective(tab.id as any)}
                    className={`min-h-[44px] py-1.5 px-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                      selectedObjective === tab.id
                        ? 'bg-[#FF5500] text-[#0D0D0D]'
                        : 'bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3] border border-[#262626]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recommendation Cards */}
            <div className="space-y-4">
              {shoe.recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-[#1C1C1C] rounded-2xl border border-[#262626] hover:border-[#FF5500]/50 transition-all overflow-hidden shadow-lg space-y-3 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative w-16 h-16 rounded-xl bg-[#101010] border border-[#262626] overflow-hidden shrink-0">
                        <img
                          src={rec.imageUrl}
                          alt={rec.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() =>
                            onViewImage({
                              url: rec.imageUrl,
                              title: rec.name,
                              subtitle: rec.category,
                              category: 'RECOMENDAÇÃO DE CALÇADO',
                              filename: `${rec.name.toLowerCase().replace(/\s+/g, '_')}.jpg`,
                            })
                          }
                          className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                          title="Ver detalhes"
                        >
                          <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                        </button>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-[#22C55E]/15 text-[#22C55E] font-telemetry text-xs font-extrabold px-1.5 py-0.5 rounded">
                            {rec.matchPercentage}% MATCH
                          </span>
                          <span className="font-label-sm text-[10px] text-[#FF5500] font-bold uppercase">
                            {rec.badgeText}
                          </span>
                        </div>
                        <h4 className="font-headline text-lg text-[#F7F5F3] uppercase tracking-wide truncate mt-0.5">
                          {rec.name}
                        </h4>
                        <p className="text-xs text-[#A1A1AA] truncate">{rec.category}</p>
                      </div>
                    </div>
                  </div>

                  {/* Telemetry Advantages */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-[#101010] p-2.5 rounded-lg border border-[#262626]">
                      <span className="text-[#A1A1AA] block text-[10px] uppercase">Retorno Elástico</span>
                      <span className="text-[#22C55E] font-telemetry font-bold block mt-0.5">
                        {rec.energyReturnDiff}
                      </span>
                    </div>
                    <div className="bg-[#101010] p-2.5 rounded-lg border border-[#262626]">
                      <span className="text-[#A1A1AA] block text-[10px] uppercase">Impacto Tibial</span>
                      <span className="text-[#22C55E] font-telemetry font-bold block mt-0.5">
                        {rec.tibialImpactDiff}
                      </span>
                    </div>
                  </div>

                  {/* Pricing & Direct Store Links */}
                  <div className="pt-1 flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      {rec.priceOriginal && (
                        <span className="text-[11px] text-[#737373] line-through block leading-none">
                          {rec.priceOriginal}
                        </span>
                      )}
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-headline text-2xl text-[#FF5500] leading-tight">
                          {rec.pricePro}
                        </span>
                        <span className="text-[10px] text-[#22C55E] font-bold uppercase">
                          {rec.discountPro}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={rec.mercadoLivreUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[44px] bg-[#262626] hover:bg-[#353534] text-[#F7F5F3] font-bold text-xs py-2.5 px-3 rounded-lg border border-[#353534] flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px] text-[#FACC15]">shopping_bag</span>
                        <span>M. Livre</span>
                      </a>
                      <a
                        href={rec.amazonUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[44px] bg-[#FF5500] hover:bg-[#FF6B00] text-[#0D0D0D] font-extrabold text-xs py-2.5 px-3.5 rounded-lg flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">store</span>
                        <span>Amazon</span>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
