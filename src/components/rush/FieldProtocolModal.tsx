import React, { useState } from 'react';

interface FieldProtocolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartProtocol: () => void;
}

export const FieldProtocolModal: React.FC<FieldProtocolModalProps> = ({
  isOpen,
  onClose,
  onStartProtocol,
}) => {
  const [selectedProtocol, setSelectedProtocol] = useState<'friel' | 'cooper' | 'ramp'>('friel');
  const [checklist1, setChecklist1] = useState(true);
  const [checklist2, setChecklist2] = useState(true);
  const [checklist3, setChecklist3] = useState(true);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="protocol-title"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/92 backdrop-blur-md transition-opacity"
    >
      <div className="flex-1 w-full" onClick={onClose} />

      <div className="relative w-full max-w-xl mx-auto max-h-[94vh] flex flex-col bg-[#0D0D0D] rounded-t-3xl border-t border-[#FF5500]/60 shadow-[0_-12px_45px_rgba(0,0,0,0.95)] overflow-hidden">
        {/* Grab Pill */}
        <div className="w-full flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-[#353534]" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-[#262626]">
          <div>
            <span className="font-label-sm text-[10px] text-[#FF5500] tracking-widest uppercase block">
              LABORATÓRIO FISIOLÓGICO RUSH
            </span>
            <h2 id="protocol-title" className="font-headline text-2xl text-[#F7F5F3] uppercase tracking-normal">
              Protocolo de Campo • Limiar LTHR
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar protocolo de campo"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Biomedical Sensors Status */}
          <div className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] shadow-md flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#101010] flex items-center justify-center text-[#22C55E] border border-[#262626]">
                <span className="material-symbols-outlined text-[24px]">verified</span>
              </div>
              <div>
                <span className="font-headline text-base text-[#F7F5F3] uppercase tracking-wide block">
                  Polar H10 ECG + GPS L1/L5 Ativos
                </span>
                <span className="text-xs text-[#A1A1AA]">
                  Taxa 1.000 Hz sem amortecimento óptico para cálculo do limiar.
                </span>
              </div>
            </div>
            <span className="font-telemetry text-xs text-[#22C55E] font-bold shrink-0">100% OK</span>
          </div>

          {/* Protocol Selection */}
          <div className="space-y-2">
            <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
              Selecione o Protocolo de Teste
            </span>
            <div className="space-y-2.5">
              {[
                {
                  id: 'friel',
                  name: '01. Teste Friel 30 min (Recomendado)',
                  desc: 'All-out contínuo de 30 minutos em pista. O ritmo e frequência dos últimos 20 min definem seu LTHR com 99% de acurácia.',
                  badge: 'PADRÃO OURO',
                  duration: '45 min total',
                },
                {
                  id: 'cooper',
                  name: '02. Teste de Cooper 12 min',
                  desc: 'Distância máxima percorrida em 12 minutos. Calcula VO2 Max indireto e ritmo crítico.',
                  badge: 'RÁPIDO',
                  duration: '25 min total',
                },
                {
                  id: 'ramp',
                  name: '03. Teste Máximo Escalonado (Rampa)',
                  desc: 'Aumento progressivo de 0.5 km/h a cada 2 minutos até a exaustão volitiva.',
                  badge: 'AVANÇADO',
                  duration: '35 min total',
                },
              ].map((proto) => (
                <div
                  key={proto.id}
                  onClick={() => setSelectedProtocol(proto.id as any)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedProtocol === proto.id
                      ? 'bg-[#1C1C1C] border-[#FF5500] shadow-md'
                      : 'bg-[#101010] border-[#262626] opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-headline text-base text-[#F7F5F3] uppercase tracking-wide">
                      {proto.name}
                    </span>
                    <span className="bg-[#FF5500]/15 text-[#FF5500] font-telemetry text-[10px] font-bold px-2 py-0.5 rounded">
                      {proto.badge}
                    </span>
                  </div>
                  <p className="text-xs text-[#A1A1AA] mt-1 leading-relaxed">{proto.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tactical 3-Phase Schedule */}
          <div className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] space-y-3">
            <span className="font-label-caps text-xs text-[#A1A1AA] uppercase tracking-wider block">
              Cronograma das 3 Fases da Sessão
            </span>

            <div className="divide-y divide-[#262626] text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#262626] text-[#FF5500] font-bold flex items-center justify-center text-xs">
                    1
                  </span>
                  <div>
                    <span className="font-bold text-[#F7F5F3] block">Aquecimento Progressivo</span>
                    <span className="text-[#A1A1AA]">Zona 1 a Zona 2 suave + 3 acelerações</span>
                  </div>
                </div>
                <span className="font-telemetry font-bold text-[#F7F5F3]">10 MIN</span>
              </div>

              <div className="py-2.5 flex items-center justify-between bg-[#FF5500]/10 px-2 rounded-lg -mx-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#FF5500] text-[#0D0D0D] font-black flex items-center justify-center text-xs">
                    2
                  </span>
                  <div>
                    <span className="font-bold text-[#FF5500] block">All-out Sustentado (Contra-Relógio)</span>
                    <span className="text-[#e5e2e1]">Lap automático aos 10 min para capturar os 20 min finais</span>
                  </div>
                </div>
                <span className="font-telemetry font-black text-[#FF5500]">30 MIN</span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#262626] text-[#22C55E] font-bold flex items-center justify-center text-xs">
                    3
                  </span>
                  <div>
                    <span className="font-bold text-[#F7F5F3] block">Desaquecimento Ativo</span>
                    <span className="text-[#A1A1AA]">Trote regenerativo em Zona 1</span>
                  </div>
                </div>
                <span className="font-telemetry font-bold text-[#22C55E]">5 MIN</span>
              </div>
            </div>
          </div>

          {/* Zones Table (Recalibradas após o teste) */}
          <div className="space-y-2">
            <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
              Zonas que serão Recalibradas
            </span>
            <div className="grid grid-cols-5 gap-1.5 text-center font-telemetry text-xs">
              <div className="bg-[#1C1C1C] p-2 rounded-lg border border-[#262626]">
                <span className="text-[9px] text-[#3B82F6] font-bold block">Z1</span>
                <span className="text-[#F7F5F3] block mt-0.5">&lt;85%</span>
                <span className="text-[8px] text-[#737373]">Recov</span>
              </div>
              <div className="bg-[#1C1C1C] p-2 rounded-lg border border-[#262626]">
                <span className="text-[9px] text-[#22C55E] font-bold block">Z2</span>
                <span className="text-[#F7F5F3] block mt-0.5">85-89%</span>
                <span className="text-[8px] text-[#737373]">Aerób</span>
              </div>
              <div className="bg-[#1C1C1C] p-2 rounded-lg border border-[#262626]">
                <span className="text-[9px] text-[#FACC15] font-bold block">Z3</span>
                <span className="text-[#F7F5F3] block mt-0.5">90-94%</span>
                <span className="text-[8px] text-[#737373]">Tempo</span>
              </div>
              <div className="bg-[#1C1C1C] p-2 rounded-lg border border-[#FF5500]">
                <span className="text-[9px] text-[#FF5500] font-black block">Z4</span>
                <span className="text-[#FF5500] font-bold block mt-0.5">95-102%</span>
                <span className="text-[8px] text-[#FF5500]">Limiar</span>
              </div>
              <div className="bg-[#1C1C1C] p-2 rounded-lg border border-[#EF4444]">
                <span className="text-[9px] text-[#EF4444] font-bold block">Z5</span>
                <span className="text-[#F7F5F3] block mt-0.5">&gt;103%</span>
                <span className="text-[8px] text-[#737373]">VO2</span>
              </div>
            </div>
          </div>

          {/* Checklist before starting */}
          <div className="bg-[#1C1C1C] p-3.5 rounded-xl border border-[#262626] space-y-2 text-xs">
            <span className="font-label-caps text-[10px] text-[#A1A1AA] uppercase tracking-wider block font-bold">
              Checklist de Precisão
            </span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={checklist1}
                onChange={(e) => setChecklist1(e.target.checked)}
                className="accent-[#FF5500] w-4 h-4 rounded"
              />
              <span className="text-[#e5e2e1]">Pista ou asfalto 100% plano sem semáforos</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={checklist2}
                onChange={(e) => setChecklist2(e.target.checked)}
                className="accent-[#FF5500] w-4 h-4 rounded"
              />
              <span className="text-[#e5e2e1]">Mínimo de 48h sem treinos de intensidade máxima</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={checklist3}
                onChange={(e) => setChecklist3(e.target.checked)}
                className="accent-[#FF5500] w-4 h-4 rounded"
              />
              <span className="text-[#e5e2e1]">Eletrodos da cinta peitoral umedecidos</span>
            </label>
          </div>

          {/* Action CTA */}
          <button
            onClick={() => {
              onClose();
              onStartProtocol();
            }}
            className="w-full min-h-[54px] py-4 px-6 bg-[#FF5500] hover:bg-[#FF6B00] active:scale-[0.98] text-[#0D0D0D] rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-[#FF5500]/30 font-headline text-lg uppercase tracking-wider transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px]">play_arrow</span>
            <span>Iniciar Protocolo de Campo Agora</span>
          </button>
        </div>
      </div>
    </div>
  );
};
