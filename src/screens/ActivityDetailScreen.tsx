// ============================================================
// RUSH RUNNING — Detalhe e edição da atividade
// ------------------------------------------------------------
// Sem esta tela uma corrida gravada errado ficava no histórico
// para sempre. Cobre: dados básicos, calçado, recorte do
// percurso, privacidade, exportação e exclusão.
//
// Do desenho ficaram de fora:
// - exportação .FIT: o app não gera esse formato (o .GPX sai com
//   os pontos reais, inclusive altitude quando o aparelho a
//   reportou)
// - "Re-sincronizar Strava/Garmin": não há integração com nenhum
//   dos dois; um botão que não faz nada é pior que nenhum botão
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { formatDuration, paceFromActivity } from '../data/adapters';
import type { ActivityDetailData, ActivityPrivacy } from '../hooks/useActivityDetail';
import { ACTIVITY_LIMITS } from '../hooks/useActivityDetail';

interface ActivityDetailScreenProps {
  detail: ActivityDetailData;
  /** Calçados do atleta, para trocar o par usado na sessão. */
  shoes: any[];
  onBack: () => void;
  onDeleted: () => void;
  onViewRoute: (activity: { id: string; title?: string | null }) => void;
}

const TIPOS = [
  { id: 'run', label: 'Corrida de rua', icon: 'directions_run' },
  { id: 'trail_run', label: 'Trilha', icon: 'landscape' },
  { id: 'treadmill', label: 'Esteira', icon: 'fitness_center' },
  { id: 'walk', label: 'Caminhada', icon: 'directions_walk' },
];

const PRIVACIDADE: { id: ActivityPrivacy; label: string; desc: string; icon: string }[] = [
  { id: 'public', label: 'Público no feed', desc: 'Visível para toda a comunidade', icon: 'public' },
  { id: 'followers', label: 'Apenas seguidores', desc: 'Só quem segue seu perfil', icon: 'group' },
  { id: 'private', label: 'Privado', desc: 'Só você — ainda conta nas suas métricas', icon: 'lock' },
];

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mmss(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = Math.round(segundos % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const ActivityDetailScreen: React.FC<ActivityDetailScreenProps> = ({
  detail,
  shoes,
  onBack,
  onDeleted,
  onViewRoute,
}) => {
  const { activity, track, trim, isLoading, isSaving, error } = detail;

  const [titulo, setTitulo] = useState('');
  const [notas, setNotas] = useState('');
  const [rpe, setRpe] = useState<number | null>(null);
  const [tipo, setTipo] = useState<string>('run');
  const [privacidade, setPrivacidade] = useState<ActivityPrivacy>('public');
  const [calcado, setCalcado] = useState<string | null>(null);

  const [fimCorte, setFimCorte] = useState<number | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (!activity) return;
    setTitulo(activity.title || '');
    setNotas(activity.feeling_notes || activity.description || '');
    setRpe(activity.rpe_score ?? activity.rpe ?? null);
    setTipo(activity.type || 'run');
    setPrivacidade((activity.privacy as ActivityPrivacy) || 'public');
    setCalcado(activity.shoe_id || null);
    setFimCorte(activity.duration_seconds || null);
  }, [activity]);

  const alterado = useMemo(() => {
    if (!activity) return false;
    return (
      titulo !== (activity.title || '') ||
      notas !== (activity.feeling_notes || activity.description || '') ||
      rpe !== (activity.rpe_score ?? activity.rpe ?? null) ||
      tipo !== activity.type ||
      privacidade !== activity.privacy ||
      calcado !== (activity.shoe_id || null)
    );
  }, [activity, titulo, notas, rpe, tipo, privacidade, calcado]);

  const salvar = async () => {
    try {
      await detail.update({
        title: titulo,
        feeling_notes: notas,
        type: tipo,
        privacy: privacidade,
        shoe_id: calcado,
        ...(rpe != null ? { rpe_score: rpe } : {}),
      });
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3500);
    } catch {
      /* a mensagem já aparece na tela */
    }
  };

  const excluir = async () => {
    try {
      await detail.remove();
      onDeleted();
    } catch {
      /* a mensagem já aparece na tela */
    }
  };

  const recortar = async () => {
    if (fimCorte == null) return;
    try {
      await detail.trimTrack(0, fimCorte);
    } catch {
      /* a mensagem já aparece na tela */
    }
  };

  if (isLoading && !activity) {
    return (
      <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 pt-6">
        <span className="text-xs text-[#737373]">Carregando atividade…</span>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 pt-6 space-y-3">
        <span className="text-xs text-[#EF4444]">{error || 'Atividade não encontrada.'}</span>
        <button
          type="button"
          onClick={onBack}
          className="min-h-[48px] bg-[#1C1C1C] border border-[#262626] rounded-xl text-[#F7F5F3] cursor-pointer"
        >
          Voltar
        </button>
      </div>
    );
  }

  const paceExibido =
    activity.avg_pace ||
    (activity.distance_km > 0
      ? `${paceFromActivity(activity.distance_km, activity.duration_seconds)}/km`
      : '—');

  const calcadoAtivos = shoes.filter((s) => !s.retired_at);

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-4 pt-2 pb-8">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3 border-b border-[#262626] pb-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          className="w-11 h-11 rounded-xl bg-[#1C1C1C] border border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3] flex items-center justify-center cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>

        <div className="flex-1 min-w-0">
          <span className="font-label-caps text-[10px] text-[#FF5500] uppercase tracking-widest font-extrabold block">
            Detalhes da atividade
          </span>
          <h1 className="font-headline text-lg text-[#F7F5F3] uppercase truncate">
            {activity.title || 'Atividade'}
          </h1>
        </div>

        <button
          type="button"
          onClick={salvar}
          disabled={!alterado || isSaving}
          className="min-h-[44px] px-4 bg-[#FF5500] hover:bg-[#FF6B00] disabled:bg-[#262626] disabled:text-[#737373] disabled:cursor-not-allowed text-[#0D0D0D] font-headline text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-[16px]">{salvo ? 'check' : 'save'}</span>
          <span>{isSaving ? '…' : salvo ? 'Salvo' : 'Salvar'}</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="bg-[#EF4444]/12 border border-[#EF4444]/40 rounded-xl px-4 py-3">
          <span className="text-xs text-[#e5e2e1]">{error}</span>
        </div>
      )}

      {/* Resumo medido */}
      <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-3">
        <span className="font-telemetry text-[10px] text-[#A1A1AA] uppercase block">
          {formatarDataHora(activity.date)}
        </span>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#101010] rounded-xl p-3 border border-[#262626]">
            <span className="font-telemetry text-[9px] text-[#737373] uppercase block">Distância</span>
            <span className="font-headline text-2xl text-[#F7F5F3]">
              {(activity.distance_km || 0).toFixed(2)}
              <span className="text-[10px] text-[#A1A1AA] ml-1">km</span>
            </span>
          </div>
          <div className="bg-[#101010] rounded-xl p-3 border border-[#262626]">
            <span className="font-telemetry text-[9px] text-[#737373] uppercase block">Tempo</span>
            <span className="font-headline text-2xl text-[#F7F5F3]">
              {formatDuration(activity.duration_seconds || 0)}
            </span>
          </div>
          <div className="bg-[#101010] rounded-xl p-3 border border-[#262626]">
            <span className="font-telemetry text-[9px] text-[#737373] uppercase block">Ritmo médio</span>
            <span className="font-headline text-2xl text-[#FF5500]">{paceExibido}</span>
          </div>
        </div>

        {(activity.avg_hr || activity.max_hr) && (
          <div className="flex gap-4">
            {activity.avg_hr && (
              <span className="font-telemetry text-[10px] text-[#A1A1AA]">
                FC média: <strong className="text-[#EF4444]">{activity.avg_hr} bpm</strong>
              </span>
            )}
            {activity.max_hr && (
              <span className="font-telemetry text-[10px] text-[#A1A1AA]">
                FC máxima: <strong className="text-[#EF4444]">{activity.max_hr} bpm</strong>
              </span>
            )}
          </div>
        )}

        {trim && (
          <div className="bg-[#FACC15]/10 border border-[#FACC15]/40 rounded-xl p-3 space-y-2">
            <span className="font-telemetry text-[10px] text-[#FACC15] uppercase block font-bold">
              Percurso recortado
            </span>
            <span className="text-[11px] text-[#e5e2e1] leading-relaxed block">
              O registro original era de {trim.original_distance_km.toFixed(2)} km em{' '}
              {formatDuration(trim.original_duration_seconds)}.
            </span>
            <button
              type="button"
              onClick={() => detail.undoTrim()}
              disabled={isSaving}
              className="min-h-[40px] px-3 bg-[#101010] hover:bg-[#262626] border border-[#262626] rounded-lg text-[11px] font-bold uppercase tracking-wider text-[#F7F5F3] cursor-pointer"
            >
              Desfazer recorte
            </button>
          </div>
        )}
      </div>

      {/* 1. Dados básicos */}
      <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-4">
        <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
          1 · Dados básicos
        </span>

        <div>
          <label htmlFor="titulo" className="text-xs text-[#A1A1AA] block mb-1.5">
            Título da sessão
          </label>
          <input
            id="titulo"
            type="text"
            value={titulo}
            maxLength={ACTIVITY_LIMITS.titleMaxLength}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full h-12 bg-[#101010] border border-[#262626] rounded-xl px-4 text-sm text-[#F7F5F3] focus:border-[#FF5500] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="notas" className="text-xs text-[#A1A1AA] block mb-1.5">
            Como foi o treino
          </label>
          <textarea
            id="notas"
            value={notas}
            maxLength={ACTIVITY_LIMITS.textMaxLength}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            className="w-full bg-[#101010] border border-[#262626] rounded-xl px-4 py-3 text-sm text-[#F7F5F3] focus:border-[#FF5500] focus:outline-none resize-none"
          />
        </div>

        <div>
          <span className="text-xs text-[#A1A1AA] block mb-1.5">
            Esforço percebido {rpe != null && <strong className="text-[#FF5500]">{rpe}/10</strong>}
          </span>
          <div className="grid grid-cols-10 gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => setRpe(valor)}
                aria-label={`Esforço ${valor}`}
                aria-pressed={rpe === valor}
                className={`h-10 rounded-lg font-headline-sm text-xs transition-all cursor-pointer border ${
                  rpe === valor
                    ? 'bg-[#FF5500] text-[#0D0D0D] border-[#FF5500] font-extrabold'
                    : 'bg-[#141414] text-[#737373] border-[#262626] hover:text-[#e5e2e1]'
                }`}
              >
                {valor}
              </button>
            ))}
          </div>
          <span className="font-telemetry text-[9px] text-[#737373] uppercase block mt-1.5">
            Entra no cálculo da carga aguda:crônica
          </span>
        </div>

        <div>
          <span className="text-xs text-[#A1A1AA] block mb-1.5">Tipo de atividade</span>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                onClick={() => setTipo(opcao.id)}
                aria-pressed={tipo === opcao.id}
                className={`min-h-[52px] rounded-xl border flex items-center gap-2 px-3 transition-all cursor-pointer ${
                  tipo === opcao.id
                    ? 'bg-[#FF5500]/12 border-[#FF5500] text-[#FF5500]'
                    : 'bg-[#101010] border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3]'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{opcao.icon}</span>
                <span className="font-headline text-xs uppercase text-left leading-tight">
                  {opcao.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Calçado */}
      <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-3">
        <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
          2 · Calçado desta sessão
        </span>

        {calcadoAtivos.length === 0 ? (
          <p className="text-xs text-[#737373] leading-relaxed">
            Nenhum par cadastrado na garagem de tênis.
          </p>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setCalcado(null)}
              aria-pressed={calcado === null}
              className={`w-full min-h-[48px] rounded-xl border px-3 flex items-center justify-between transition-all cursor-pointer ${
                calcado === null
                  ? 'bg-[#101010] border-[#FF5500] text-[#FF5500]'
                  : 'bg-[#101010] border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3]'
              }`}
            >
              <span className="font-headline text-xs uppercase">Sem calçado registrado</span>
            </button>

            {calcadoAtivos.map((par) => {
              const selecionado = calcado === par.id;
              const km = Number(par.current_km ?? par.currentKm ?? 0);
              const max = Number(par.max_km ?? par.maxKm ?? 0);
              const pct = max > 0 ? Math.min(100, (km / max) * 100) : 0;
              return (
                <button
                  key={par.id}
                  type="button"
                  onClick={() => setCalcado(par.id)}
                  aria-pressed={selecionado}
                  className={`w-full rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    selecionado
                      ? 'bg-[#FF5500]/10 border-[#FF5500]'
                      : 'bg-[#101010] border-[#262626] hover:border-[#444]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-headline text-sm uppercase truncate ${
                        selecionado ? 'text-[#FF5500]' : 'text-[#F7F5F3]'
                      }`}
                    >
                      {par.name}
                    </span>
                    <span className="font-telemetry text-[10px] text-[#A1A1AA] shrink-0">
                      {km.toFixed(0)} / {max.toFixed(0)} km
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#262626] rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: pct >= 90 ? '#EF4444' : pct >= 65 ? '#FACC15' : '#22C55E',
                      }}
                    />
                  </div>
                </button>
              );
            })}

            <p className="text-[10px] text-[#737373] leading-relaxed">
              Trocar o par recalcula a quilometragem dos dois calçados.
            </p>
          </div>
        )}
      </div>

      {/* 3. Recorte */}
      <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-3">
        <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
          3 · Recorte do percurso
        </span>

        {!track || track.length < 2 ? (
          <p className="text-xs text-[#737373] leading-relaxed">
            Esta atividade não tem traçado GPS gravado, então não há percurso a recortar. Só corridas
            feitas com o HUD do app têm traçado.
          </p>
        ) : (
          <>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Esqueceu de parar o relógio? Corte o tempo final. A distância, a duração e o pace são
              recalculados a partir dos pontos que sobram — não são digitados.
            </p>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-telemetry text-[10px] text-[#737373] uppercase">Início 0:00</span>
                <span className="font-headline text-lg text-[#FF5500]">
                  {fimCorte != null ? mmss(fimCorte) : '—'}
                </span>
                <span className="font-telemetry text-[10px] text-[#737373] uppercase">
                  Fim {mmss(activity.duration_seconds || 0)}
                </span>
              </div>

              <input
                id="corte"
                type="range"
                min={30}
                max={activity.duration_seconds || 60}
                step={5}
                value={fimCorte ?? activity.duration_seconds ?? 60}
                onChange={(e) => setFimCorte(Number(e.target.value))}
                className="w-full accent-[#FF5500] cursor-pointer"
              />
            </div>

            {fimCorte != null && fimCorte < (activity.duration_seconds || 0) && (
              <span className="font-telemetry text-[10px] text-[#FACC15] uppercase block">
                Serão removidos {mmss((activity.duration_seconds || 0) - fimCorte)} do final
              </span>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={recortar}
                disabled={isSaving || fimCorte == null || fimCorte >= (activity.duration_seconds || 0)}
                className="flex-1 min-h-[48px] bg-[#101010] hover:bg-[#262626] disabled:opacity-40 disabled:cursor-not-allowed border border-[#262626] rounded-xl flex items-center justify-center gap-2 text-[#F7F5F3] cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[#FF5500] text-[18px]">content_cut</span>
                <span className="text-xs font-bold uppercase tracking-wider">Aplicar recorte</span>
              </button>

              <button
                type="button"
                onClick={() => onViewRoute({ id: activity.id, title: activity.title })}
                className="min-h-[48px] px-4 bg-[#101010] hover:bg-[#262626] border border-[#262626] rounded-xl flex items-center justify-center gap-2 text-[#F7F5F3] cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[#FF5500] text-[18px]">route</span>
                <span className="text-xs font-bold uppercase tracking-wider">Ver</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* 4. Privacidade */}
      <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-2">
        <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
          4 · Visibilidade
        </span>

        {PRIVACIDADE.map((opcao) => (
          <button
            key={opcao.id}
            type="button"
            onClick={() => setPrivacidade(opcao.id)}
            aria-pressed={privacidade === opcao.id}
            className={`w-full rounded-xl border p-3 flex items-center gap-3 text-left transition-all cursor-pointer ${
              privacidade === opcao.id
                ? 'bg-[#FF5500]/10 border-[#FF5500]'
                : 'bg-[#101010] border-[#262626] hover:border-[#444]'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] shrink-0 ${
                privacidade === opcao.id ? 'text-[#FF5500]' : 'text-[#737373]'
              }`}
            >
              {opcao.icon}
            </span>
            <div className="min-w-0">
              <span
                className={`font-headline text-sm uppercase block ${
                  privacidade === opcao.id ? 'text-[#FF5500]' : 'text-[#F7F5F3]'
                }`}
              >
                {opcao.label}
              </span>
              <span className="text-[10px] text-[#737373] block leading-snug">{opcao.desc}</span>
            </div>
          </button>
        ))}
      </div>

      {/* 5. Exportar e excluir */}
      <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-3">
        <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
          5 · Exportar e excluir
        </span>

        <button
          type="button"
          onClick={() => detail.downloadGpx().catch(() => {})}
          disabled={!track}
          className="w-full min-h-[48px] bg-[#101010] hover:bg-[#262626] disabled:opacity-40 disabled:cursor-not-allowed border border-[#262626] rounded-xl flex items-center justify-center gap-2 text-[#F7F5F3] cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-[#FF5500] text-[18px]">download</span>
          <span className="text-xs font-bold uppercase tracking-wider">
            {track ? 'Exportar percurso (.GPX)' : 'Sem percurso para exportar'}
          </span>
        </button>

        {!confirmandoExclusao ? (
          <button
            type="button"
            onClick={() => setConfirmandoExclusao(true)}
            className="w-full min-h-[48px] bg-[#EF4444]/10 hover:bg-[#EF4444]/20 border border-[#EF4444]/40 rounded-xl flex items-center justify-center gap-2 text-[#EF4444] cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
            <span className="text-xs font-bold uppercase tracking-wider">Excluir atividade</span>
          </button>
        ) : (
          <div className="bg-[#EF4444]/10 border border-[#EF4444]/40 rounded-xl p-3.5 space-y-3">
            <p className="text-xs text-[#e5e2e1] leading-relaxed">
              Excluir remove {(activity.distance_km || 0).toFixed(2)} km do seu volume, tira a sessão da
              carga de treino e devolve a quilometragem ao calçado. Não há como desfazer.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmandoExclusao(false)}
                className="flex-1 min-h-[44px] bg-[#1C1C1C] border border-[#262626] rounded-lg text-[#F7F5F3] text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={excluir}
                disabled={isSaving}
                className="flex-1 min-h-[44px] bg-[#EF4444] hover:bg-[#DC2626] rounded-lg text-[#F7F5F3] text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                {isSaving ? 'Excluindo…' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
