// ============================================================
// RUSH RUNNING — Garagem de Tênis
// ------------------------------------------------------------
// Frota real do atleta (/api/gear/shoes). A quilometragem de cada
// par acumula sozinha pelas atividades vinculadas, então os números
// aqui refletem corridas de fato registradas.
// ============================================================

import React, { useMemo, useState } from 'react';
import { ImageViewerItem, RunningShoe } from '../../types';
import { gear as gearApi } from '../../api';
import { buscarModelos, CATEGORIAS, ModeloDeTenis } from '../../data/catalogoTenis';

export interface ShoesSummary {
  total_km: number;
  active_count: number;
  retired_count: number;
  avg_health_pct: number;
  optimal_count: number;
  warning_count: number;
  critical_count: number;
}

interface GearGarageModalProps {
  isOpen: boolean;
  shoes: RunningShoe[];
  summary: ShoesSummary | null;
  onClose: () => void;
  onReloadGear: () => Promise<void>;
  onOpenShoeRetirement: (shoeId: string) => void;
  onViewImage: (item: ImageViewerItem) => void;
}

const STATUS_COLOR: Record<string, string> = {
  OPTIMAL: '#22C55E',
  NEW: '#22C55E',
  WARNING: '#FACC15',
  CRITICAL: '#EF4444',
  RETIRED: '#737373',
};

const EMPTY_FORM = {
  name: '',
  model_type: '',
  colorway: '',
  plate_technology: '',
  initial_km: '',
  max_km: '800',
  is_default: false,
};

export const GearGarageModal: React.FC<GearGarageModalProps> = ({
  isOpen,
  shoes,
  summary,
  onClose,
  onReloadGear,
  onOpenShoeRetirement,
  onViewImage,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Sugestões do catálogo enquanto a pessoa digita o nome do par.
  const [sugestoes, setSugestoes] = useState<ModeloDeTenis[]>([]);

  const active = useMemo(() => shoes.filter((s) => s.status !== 'RETIRED'), [shoes]);
  const retired = useMemo(() => shoes.filter((s) => s.status === 'RETIRED'), [shoes]);
  const critical = useMemo(() => active.find((s) => s.status === 'CRITICAL'), [active]);

  if (!isOpen) return null;

  /**
   * Digitar o nome busca no catálogo. Nada é forçado: a lista some
   * quando não há correspondência e o campo continua livre.
   */
  const handleNome = (valor: string) => {
    setForm((atual) => ({ ...atual, name: valor }));
    setSugestoes(buscarModelos(valor));
  };

  /**
   * Escolher um modelo preenche uso, placa e vida útil de referência.
   * Tudo continua editável: os números da categoria são ponto de
   * partida, não especificação de fabricante.
   */
  const handleEscolherModelo = (modelo: ModeloDeTenis) => {
    const categoria = CATEGORIAS[modelo.categoria];
    setForm((atual) => ({
      ...atual,
      name: modelo.nome,
      model_type: categoria.usoPrincipal,
      plate_technology: modelo.placa === 'carbono' ? 'Placa de carbono' : '',
      max_km: String(categoria.vidaUtilKm),
    }));
    setSugestoes([]);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Informe o nome do par.');
      return;
    }
    const maxKm = Number(form.max_km);
    if (!isFinite(maxKm) || maxKm < 50 || maxKm > 5000) {
      setError('A vida útil estimada deve ficar entre 50 e 5000 km.');
      return;
    }
    const initialKm = form.initial_km ? Number(form.initial_km) : 0;
    if (!isFinite(initialKm) || initialKm < 0 || initialKm > 5000) {
      setError('A quilometragem inicial deve ficar entre 0 e 5000 km.');
      return;
    }

    setIsSaving(true);
    try {
      await gearApi.createShoe({
        name: form.name.trim(),
        model_type: form.model_type.trim() || null,
        colorway: form.colorway.trim() || null,
        plate_technology: form.plate_technology.trim() || null,
        initial_km: initialKm,
        max_km: maxKm,
        is_default: form.is_default,
      });
      await onReloadGear();
      setForm(EMPTY_FORM);
      setSugestoes([]);
      setIsAdding(false);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível cadastrar o calçado.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (shoe: RunningShoe) => {
    setBusyId(shoe.id);
    setError(null);
    try {
      await gearApi.updateShoe(shoe.id, { is_default: true });
      await onReloadGear();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível definir o par padrão.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReactivate = async (shoe: RunningShoe) => {
    setBusyId(shoe.id);
    setError(null);
    try {
      await gearApi.reactivateShoe(shoe.id);
      await onReloadGear();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível reativar o calçado.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gear-garage-title"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/90 backdrop-blur-md transition-opacity"
    >
      <div className="flex-1 w-full" onClick={onClose} />

      <div className="relative w-full max-w-xl mx-auto max-h-[92vh] flex flex-col bg-[#0D0D0D] rounded-t-3xl border-t border-[#FF5500]/50 shadow-[0_-12px_40px_rgba(0,0,0,0.9)] overflow-hidden">
        <div className="w-full flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-[#353534]" />
        </div>

        <div className="px-5 py-3 flex items-center justify-between border-b border-[#262626]">
          <div>
            <span className="font-label-sm text-[10px] text-[#FF5500] tracking-widest uppercase block">
              EQUIPAMENTOS & FROTA
            </span>
            <h2 id="gear-garage-title" className="font-headline text-2xl text-[#F7F5F3] uppercase tracking-normal">
              Garagem de Tênis
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar garagem de tênis"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Resumo da frota */}
          <div className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] shadow-lg space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-label-caps text-xs text-[#A1A1AA] uppercase tracking-wider">
                Quilometragem da frota
              </span>
              <span className="font-telemetry text-xs text-[#22C55E] font-bold shrink-0">
                {summary?.active_count ?? 0} ATIVOS • {summary?.retired_count ?? 0} APOSENTADOS
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <div>
                <span className="font-headline text-4xl text-[#F7F5F3] tracking-tight">
                  {(summary?.total_km ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                </span>
                <span className="font-label-sm text-xs text-[#A1A1AA] uppercase ml-1.5">KM MONITORADOS</span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-telemetry text-sm text-[#FF5500] font-bold">
                  {summary?.avg_health_pct ?? 0}% DE VIDA ÚTIL
                </span>
                <span className="text-[10px] text-[#A1A1AA] block">média dos pares ativos</span>
              </div>
            </div>

            {summary && summary.active_count > 0 && (
              <>
                <div className="w-full h-2.5 bg-[#101010] rounded-full overflow-hidden flex border border-[#262626]">
                  <div
                    className="bg-[#22C55E] h-full"
                    style={{ width: `${(summary.optimal_count / summary.active_count) * 100}%` }}
                    title="Amortecimento ótimo"
                  />
                  <div
                    className="bg-[#FACC15] h-full"
                    style={{ width: `${(summary.warning_count / summary.active_count) * 100}%` }}
                    title="Atenção"
                  />
                  <div
                    className="bg-[#EF4444] h-full"
                    style={{ width: `${(summary.critical_count / summary.active_count) * 100}%` }}
                    title="Crítico"
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] font-telemetry pt-1">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#22C55E]" /> Ótimo ({summary.optimal_count})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#FACC15]" /> Atenção ({summary.warning_count})
                  </span>
                  <span className="flex items-center gap-1 text-[#EF4444]">
                    <span className="w-2 h-2 rounded-full bg-[#EF4444]" /> Crítico ({summary.critical_count})
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Alerta de par crítico — só quando existe de fato */}
          {critical && (
            <div className="bg-[#EF4444]/15 border border-[#EF4444]/50 rounded-2xl p-4 shadow-lg flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#EF4444]/20 border border-[#EF4444]/40 flex items-center justify-center text-[#EF4444] shrink-0">
                  <span className="material-symbols-outlined text-[24px]">crisis_alert</span>
                </div>
                <div className="min-w-0">
                  <span className="font-headline text-base text-[#F7F5F3] uppercase tracking-wide block">
                    Vida útil no limite
                  </span>
                  <p className="text-xs text-[#e5e2e1] mt-0.5 leading-relaxed">
                    O par <strong className="text-[#EF4444]">{critical.name}</strong> atingiu {critical.currentKm} km
                    de {critical.maxKm} km ({critical.foamDegradationPct}%).
                  </p>
                </div>
              </div>

              <button
                onClick={() => onOpenShoeRetirement(critical.id)}
                className="min-h-[44px] bg-[#EF4444] hover:bg-[#DC2626] active:scale-95 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shrink-0 uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                <span>Ver</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-[#EF4444] font-bold" role="alert">
              {error}
            </p>
          )}

          {/* Pares ativos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-headline text-lg text-[#F7F5F3] uppercase tracking-normal">
                Em rotação ativa ({active.length})
              </h3>
              <button
                onClick={() => setIsAdding((v) => !v)}
                className="text-xs text-[#FF5500] hover:text-[#FF6B00] font-bold flex items-center gap-1 uppercase cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isAdding ? 'close' : 'add_circle'}
                </span>
                <span>{isAdding ? 'Cancelar' : 'Adicionar'}</span>
              </button>
            </div>

            {/* Formulário de cadastro */}
            {isAdding && (
              <form onSubmit={handleAdd} className="bg-[#1C1C1C] rounded-2xl border border-[#FF5500]/40 p-4 space-y-3">
                <div className="space-y-1">
                  <label htmlFor="shoe-name" className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
                    Nome do par *
                  </label>
                  <input
                    id="shoe-name"
                    value={form.name}
                    onChange={(e) => handleNome(e.target.value)}
                    placeholder="ex.: Nike Pegasus 41"
                    autoComplete="off"
                    className="w-full h-10 rounded-lg bg-[#101010] border border-[#262626] px-3 text-xs text-[#F7F5F3] focus:outline-none focus:border-[#FF5500]"
                  />

                  {sugestoes.length > 0 && (
                    <ul className="rounded-lg border border-[#262626] bg-[#101010] divide-y divide-[#1C1C1C] overflow-hidden">
                      {sugestoes.map((modelo) => (
                        <li key={modelo.nome}>
                          <button
                            type="button"
                            onClick={() => handleEscolherModelo(modelo)}
                            className="w-full text-left px-3 py-2 hover:bg-[#1C1C1C] flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <span className="text-xs text-[#F7F5F3] truncate">{modelo.nome}</span>
                            <span className="font-label-sm text-[9px] uppercase text-[#737373] shrink-0">
                              {CATEGORIAS[modelo.categoria].rotulo}
                              {modelo.placa === 'carbono' ? ' • Carbono' : ''}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="text-[10px] text-[#737373] leading-relaxed">
                    Escolher um modelo da lista preenche uso e vida útil estimada — os dois continuam
                    editáveis. A versão (41, 22, v4…) você completa no nome.
                  </p>
                </div>

                <div className="space-y-1">
                  <label htmlFor="shoe-type" className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
                    Uso principal
                  </label>
                  <input
                    id="shoe-type"
                    value={form.model_type}
                    onChange={(e) => setForm({ ...form, model_type: e.target.value })}
                    placeholder="ex.: Rodagem diária e longões"
                    className="w-full h-10 rounded-lg bg-[#101010] border border-[#262626] px-3 text-xs text-[#F7F5F3] focus:outline-none focus:border-[#FF5500]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label htmlFor="shoe-initial" className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
                      Km já rodados
                    </label>
                    <input
                      id="shoe-initial"
                      type="number"
                      inputMode="decimal"
                      value={form.initial_km}
                      onChange={(e) => setForm({ ...form, initial_km: e.target.value })}
                      placeholder="0"
                      className="w-full h-10 rounded-lg bg-[#101010] border border-[#262626] px-3 text-xs text-[#F7F5F3] font-telemetry focus:outline-none focus:border-[#FF5500]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="shoe-max" className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
                      Vida útil (km) *
                    </label>
                    <input
                      id="shoe-max"
                      type="number"
                      inputMode="numeric"
                      value={form.max_km}
                      onChange={(e) => setForm({ ...form, max_km: e.target.value })}
                      className="w-full h-10 rounded-lg bg-[#101010] border border-[#262626] px-3 text-xs text-[#F7F5F3] font-telemetry focus:outline-none focus:border-[#FF5500]"
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between cursor-pointer min-h-[40px]">
                  <span className="text-xs text-[#F7F5F3] font-bold">Usar como par padrão</span>
                  <input
                    type="checkbox"
                    checked={form.is_default}
                    onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                    className="accent-[#FF5500] w-4 h-4 rounded cursor-pointer"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full h-11 rounded-xl bg-[#FF5500] hover:bg-[#FF6B00] disabled:opacity-60 disabled:cursor-wait text-[#0D0D0D] text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  {isSaving ? 'Cadastrando…' : 'Cadastrar par'}
                </button>
              </form>
            )}

            {active.length === 0 && !isAdding && (
              <div className="bg-[#1C1C1C] rounded-2xl border border-dashed border-[#262626] p-6 text-center">
                <span className="material-symbols-outlined text-[30px] text-[#404040]">footprint</span>
                <p className="text-xs text-[#737373] mt-2 leading-relaxed">
                  Nenhum par cadastrado. Adicione seus tênis para acompanhar a quilometragem automaticamente a
                  cada corrida.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {active.map((shoe) => {
                const pct = shoe.foamDegradationPct;
                const color = STATUS_COLOR[shoe.status] || '#22C55E';
                return (
                  <div key={shoe.id} className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 shadow-md space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {shoe.imageUrl && (
                          <div className="relative w-16 h-16 rounded-xl bg-[#101010] border border-[#262626] overflow-hidden shrink-0">
                            <img src={shoe.imageUrl} alt={shoe.name} className="w-full h-full object-cover" />
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
                              aria-label={`Ver imagem de ${shoe.name}`}
                            >
                              <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                            </button>
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-headline text-lg text-[#F7F5F3] uppercase tracking-wide truncate">
                              {shoe.name}
                            </h4>
                            {shoe.isDefault && (
                              <span className="bg-[#FF5500]/15 text-[#FF5500] font-label-sm text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                                PADRÃO
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#A1A1AA] truncate mt-0.5">{shoe.modelType}</p>
                          <span className="text-[10px] font-bold" style={{ color }}>
                            {shoe.statusLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs font-telemetry">
                        <span className="text-[#A1A1AA]">
                          {shoe.currentKm} km rodados / {shoe.maxKm} km
                        </span>
                        <span className="font-bold" style={{ color }}>
                          {pct}% consumido
                        </span>
                      </div>

                      <div className="w-full h-2 bg-[#101010] rounded-full overflow-hidden border border-[#262626]">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] pt-1">
                        <span>
                          Pace médio: <strong className="text-[#F7F5F3]">{shoe.avgPace}</strong>
                        </span>
                        <span>
                          {shoe.sessionsCount} {shoe.sessionsCount === 1 ? 'sessão' : 'sessões'}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      {!shoe.isDefault && (
                        <button
                          onClick={() => handleSetDefault(shoe)}
                          disabled={busyId === shoe.id}
                          className="flex-1 h-9 rounded-lg bg-[#101010] border border-[#262626] text-[11px] font-bold uppercase text-[#A1A1AA] hover:text-[#F7F5F3] disabled:opacity-50 cursor-pointer"
                        >
                          Tornar padrão
                        </button>
                      )}
                      <button
                        onClick={() => onOpenShoeRetirement(shoe.id)}
                        className="flex-1 h-9 rounded-lg bg-[#101010] border border-[#262626] text-[11px] font-bold uppercase text-[#A1A1AA] hover:text-[#F7F5F3] cursor-pointer"
                      >
                        Ver desgaste
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pares aposentados */}
          {retired.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-headline text-lg text-[#F7F5F3] uppercase tracking-normal">
                Aposentados ({retired.length})
              </h3>

              {retired.map((shoe) => (
                <div
                  key={shoe.id}
                  className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 shadow-md flex items-center justify-between gap-3 opacity-80"
                >
                  <div className="min-w-0">
                    <span className="font-headline text-base text-[#F7F5F3] uppercase block truncate">
                      {shoe.name}
                    </span>
                    <span className="font-telemetry text-[11px] text-[#A1A1AA]">
                      {shoe.currentKm} / {shoe.maxKm} km • {shoe.sessionsCount} sessões
                    </span>
                  </div>

                  <button
                    onClick={() => handleReactivate(shoe)}
                    disabled={busyId === shoe.id}
                    className="shrink-0 h-9 px-3 rounded-lg bg-[#101010] border border-[#262626] text-[11px] font-bold uppercase text-[#A1A1AA] hover:text-[#F7F5F3] disabled:opacity-50 cursor-pointer"
                  >
                    Reativar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
