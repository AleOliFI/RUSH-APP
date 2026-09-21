// ============================================================
// RUSH RUNNING — Diagnóstico de desgaste do calçado
// ------------------------------------------------------------
// O protótipo exibia telemetria biomecânica (impacto tibial em G,
// tempo de contato com o solo, energia elástica residual, confiança
// de modelo) que este app não tem como medir: não há footpod,
// plataforma de força nem análise de acelerometria. Exibir esses
// números levaria o atleta a decidir sobre risco de lesão com base
// em dados inventados, então eles saíram.
//
// O que fica é o que realmente se sabe: quilometragem acumulada pelas
// atividades vinculadas, vida útil declarada no cadastro, número de
// sessões e pace médio com aquele par.
// ============================================================

import React, { useState } from 'react';
import { ImageViewerItem, RunningShoe } from '../../types';
import { gear as gearApi } from '../../api';

interface ShoeRetirementModalProps {
  isOpen: boolean;
  shoe: RunningShoe | null;
  onClose: () => void;
  onReloadGear: () => Promise<void>;
  onViewImage: (item: ImageViewerItem) => void;
}

const STATUS_COLOR: Record<string, string> = {
  OPTIMAL: '#22C55E',
  NEW: '#22C55E',
  WARNING: '#FACC15',
  CRITICAL: '#EF4444',
  RETIRED: '#737373',
};

/** Orientação geral por faixa de uso — não é uma medição deste par. */
const GUIDANCE: Record<string, string> = {
  NEW: 'Par novo. Registre as corridas com ele para acompanhar a quilometragem automaticamente.',
  OPTIMAL: 'Dentro da faixa de uso prevista para este par. Siga acompanhando a quilometragem.',
  WARNING:
    'O par passou de dois terços da vida útil que você declarou. É um bom momento para começar a rodar um par de substituição em paralelo.',
  CRITICAL:
    'O par atingiu ou ultrapassou a vida útil declarada. A recomendação usual é reduzir o uso em treinos de maior volume ou intensidade e aposentá-lo.',
  RETIRED: 'Par aposentado. Ele não recebe mais quilometragem de novas corridas.',
};

export const ShoeRetirementModal: React.FC<ShoeRetirementModalProps> = ({
  isOpen,
  shoe,
  onClose,
  onReloadGear,
  onViewImage,
}) => {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isOpen || !shoe) return null;

  const color = STATUS_COLOR[shoe.status] || '#22C55E';
  const pct = shoe.foamDegradationPct;
  const remainingKm = Math.max(0, +(shoe.maxKm - shoe.currentKm).toFixed(1));
  const overKm = shoe.currentKm > shoe.maxKm ? +(shoe.currentKm - shoe.maxKm).toFixed(1) : 0;

  const handleRetire = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await gearApi.retireShoe(shoe.id);
      await onReloadGear();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível aposentar o calçado.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleReactivate = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await gearApi.reactivateShoe(shoe.id);
      await onReloadGear();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível reativar o calçado.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await gearApi.deleteShoe(shoe.id);
      await onReloadGear();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível remover o calçado.');
    } finally {
      setIsBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shoe-retire-title"
      className="fixed inset-0 z-[55] flex flex-col justify-end bg-black/92 backdrop-blur-md transition-opacity"
    >
      <div className="flex-1 w-full" onClick={onClose} />

      <div className="relative w-full max-w-xl mx-auto max-h-[92vh] flex flex-col bg-[#0D0D0D] rounded-t-3xl border-t shadow-[0_-12px_45px_rgba(0,0,0,0.95)] overflow-hidden"
        style={{ borderTopColor: `${color}99` }}
      >
        <div className="w-full flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-[#353534]" />
        </div>

        <div className="px-5 py-3 flex items-center justify-between border-b border-[#262626] gap-3">
          <div className="min-w-0">
            <span className="font-label-sm text-[10px] tracking-widest uppercase block" style={{ color }}>
              DIAGNÓSTICO DE DESGASTE
            </span>
            <h2 id="shoe-retire-title" className="font-headline text-2xl text-[#F7F5F3] uppercase tracking-normal truncate">
              {shoe.name}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 shrink-0 rounded-full bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar diagnóstico"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Imagem e estado */}
          <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] overflow-hidden shadow-lg">
            {shoe.imageUrl && (
              <div className="relative h-44 bg-[#101010]">
                <img src={shoe.imageUrl} alt={shoe.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1C1C1C] via-transparent to-transparent" />

                <span
                  className="absolute top-3 left-3 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider"
                  style={{ backgroundColor: color, color: '#0D0D0D' }}
                >
                  {shoe.statusLabel}
                </span>

                <div className="absolute bottom-3 right-3 flex gap-2">
                  <button
                    onClick={() =>
                      onViewImage({
                        url: shoe.imageUrl,
                        title: `${shoe.name} (${shoe.currentKm} km)`,
                        subtitle: shoe.modelType,
                        category: 'DIAGNÓSTICO DE DESGASTE',
                        filename: `${shoe.id}.jpg`,
                      })
                    }
                    className="min-h-[40px] min-w-[40px] bg-[#0D0D0D]/80 hover:bg-black text-white p-2 rounded-xl border border-white/20 flex items-center justify-center backdrop-blur-md cursor-pointer"
                    title="Ver em tela cheia"
                  >
                    <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                  </button>
                </div>
              </div>
            )}

            <div className="p-4 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <span className="font-headline text-4xl tracking-tight" style={{ color }}>
                    {shoe.currentKm}
                  </span>
                  <span className="font-label-sm text-xs text-[#A1A1AA] uppercase ml-1.5">
                    KM DE {shoe.maxKm} KM
                  </span>
                </div>
                <span className="font-telemetry text-sm font-bold shrink-0" style={{ color }}>
                  {pct}% consumido
                </span>
              </div>

              <div className="w-full h-3 bg-[#101010] rounded-full overflow-hidden border border-[#262626]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
                />
              </div>

              <p className="text-xs text-[#A1A1AA] font-telemetry">
                {overKm > 0
                  ? `${overKm} km além da vida útil declarada.`
                  : `Restam ${remainingKm} km até a vida útil declarada.`}
              </p>
            </div>
          </div>

          {/* Uso medido */}
          <div className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] space-y-3">
            <span className="font-label-caps text-xs text-[#A1A1AA] uppercase tracking-wider block">
              Uso registrado com este par
            </span>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="bg-[#101010] p-3 rounded-xl border border-[#262626]">
                <span className="text-[10px] text-[#A1A1AA] uppercase block">SESSÕES</span>
                <span className="font-headline text-2xl text-[#F7F5F3] block mt-0.5">{shoe.sessionsCount}</span>
              </div>
              <div className="bg-[#101010] p-3 rounded-xl border border-[#262626]">
                <span className="text-[10px] text-[#A1A1AA] uppercase block">PACE MÉDIO</span>
                <span className="font-headline text-2xl text-[#FF5500] block mt-0.5">{shoe.avgPace}</span>
              </div>
              <div className="bg-[#101010] p-3 rounded-xl border border-[#262626]">
                <span className="text-[10px] text-[#A1A1AA] uppercase block">KM / SESSÃO</span>
                <span className="font-headline text-2xl text-[#F7F5F3] block mt-0.5">
                  {shoe.sessionsCount > 0 ? (shoe.currentKm / shoe.sessionsCount).toFixed(1) : '—'}
                </span>
              </div>
            </div>

            {shoe.plateTechnology && (
              <p className="text-[11px] text-[#737373]">
                Tecnologia declarada: <span className="text-[#A1A1AA]">{shoe.plateTechnology}</span>
              </p>
            )}
          </div>

          {/* Orientação */}
          <div className="bg-[#1C1C1C] p-4 rounded-2xl border space-y-2" style={{ borderColor: `${color}55` }}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]" style={{ color }}>
                info
              </span>
              <span className="font-label-caps text-xs uppercase font-extrabold tracking-wider" style={{ color }}>
                Orientação
              </span>
            </div>
            <p className="text-xs text-[#e5e2e1] leading-relaxed">{GUIDANCE[shoe.status]}</p>
            <p className="text-[10px] text-[#737373] leading-relaxed pt-1 border-t border-[#262626]">
              O percentual acima compara a quilometragem acumulada com a vida útil que você declarou ao cadastrar
              o par. Não é uma medição do estado físico da entressola: avaliar amortecimento real exige inspeção
              do calçado ou sensores de força que o app não possui.
            </p>
          </div>

          {error && (
            <p className="text-xs text-[#EF4444] font-bold" role="alert">
              {error}
            </p>
          )}

          {/* Ações */}
          <div className="space-y-2.5 pt-1">
            {shoe.status === 'RETIRED' ? (
              <button
                onClick={handleReactivate}
                disabled={isBusy}
                className="w-full min-h-[52px] py-3.5 px-4 bg-[#22C55E] hover:bg-[#16A34A] disabled:opacity-60 disabled:cursor-wait text-[#0D0D0D] rounded-xl flex items-center justify-center gap-2 shadow-lg font-headline text-base uppercase tracking-wider transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[22px]">restart_alt</span>
                <span>{isBusy ? 'Reativando…' : 'Voltar à rotação'}</span>
              </button>
            ) : (
              <button
                onClick={handleRetire}
                disabled={isBusy}
                className="w-full min-h-[52px] py-3.5 px-4 bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60 disabled:cursor-wait text-white rounded-xl flex items-center justify-center gap-2 shadow-lg font-headline text-base uppercase tracking-wider transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[22px]">archive</span>
                <span>{isBusy ? 'Aposentando…' : 'Aposentar este par'}</span>
              </button>
            )}

            {confirmDelete ? (
              <div className="bg-[#EF4444]/10 border border-[#EF4444]/40 rounded-xl p-3 space-y-2.5">
                <p className="text-xs text-[#e5e2e1] leading-relaxed">
                  Remover apaga o par da frota permanentemente. As corridas continuam registradas, mas perdem o
                  vínculo com este calçado.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 h-10 rounded-lg bg-[#262626] text-[#F7F5F3] text-xs font-bold uppercase cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isBusy}
                    className="flex-1 h-10 rounded-lg bg-[#EF4444] text-white text-xs font-bold uppercase disabled:opacity-60 cursor-pointer"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full min-h-[44px] text-xs text-[#737373] hover:text-[#EF4444] font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Remover da frota
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
