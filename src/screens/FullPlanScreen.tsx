// ============================================================
// RUSH RUNNING — Plano completo, as 12 semanas
// ------------------------------------------------------------
// A tela de treinos mostra só a semana corrente. Um plano
// periodizado existe justamente para se enxergar o caminho
// inteiro: saber que a semana 9 é o pico e a 10 tem o simulado
// muda como o atleta encara a semana 3.
//
// Duas coisas vêm prontas do backend de propósito:
//
// - A FASE de cada semana. Ela é derivada de week_number e
//   duration_weeks pela mesma função que gera o plano. Recalcular
//   aqui criaria uma segunda conta para a mesma resposta, e é
//   assim que as duas divergem no primeiro ajuste.
// - O que já foi CUMPRIDO. Uma atividade guarda o session_id do
//   treino que realizou, então "feito" é um dado. Sem isso a tela
//   teria de estimar o progresso — e um progresso estimado num
//   plano de treino é pior do que nenhum.
//
// Do desenho ficaram de fora: "análise TSS" (o app calcula sRPE,
// que é outra métrica), sincronização com Garmin/Coros/Stryd, o
// nome e o tempo-alvo da prova (o schema guarda só a data) e o
// selo de validação por treinador-chefe.
// ============================================================

import React, { useMemo, useState } from 'react';
import type { PlanoCompletoData, ResumoSemana } from '../hooks/useTrainingReference';

interface FullPlanScreenProps {
  plano: PlanoCompletoData;
  onVoltar: () => void;
}

const FASES = {
  base: {
    rotulo: 'Base aeróbica',
    cor: '#22C55E',
    resumo: 'Volume progressivo em Z2. Constrói a base mitocondrial que sustenta tudo o que vem depois.',
  },
  build: {
    rotulo: 'Build — carga',
    cor: '#FACC15',
    resumo: 'Entra o limiar. O volume ainda sobe, e a intensidade começa a puxar o ritmo de prova.',
  },
  peak: {
    rotulo: 'Pico',
    cor: '#FF5500',
    resumo: 'O maior volume do plano, com simulado. É a semana que dói e a que responde se o plano funcionou.',
  },
  taper: {
    rotulo: 'Taper — prova',
    cor: '#C084FC',
    resumo: 'Volume reduzido para chegar descansado, mantendo a intensidade para não perder o ritmo.',
  },
} as const;

const TIPO_ROTULO: Record<string, string> = {
  easy_run: 'Rodagem leve',
  interval: 'Intervalado',
  long_run: 'Longão',
  tempo: 'Tempo run',
  recovery: 'Regenerativo',
  strength: 'Força',
  test: 'Simulado',
  rest: 'Descanso',
  other: 'Outro',
};

const DIAS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

/** Dias até a data, ou null. */
function diasAte(data?: string | null): number | null {
  if (!data) return null;
  const alvo = new Date(data);
  if (Number.isNaN(alvo.getTime())) return null;
  return Math.ceil((alvo.getTime() - Date.now()) / 86400000);
}

// ------------------------------------------------------------

/**
 * Régua das fases.
 *
 * Cada fase ocupa a largura proporcional ao número de semanas que
 * tem — desenhar quatro blocos iguais mentiria sobre a forma da
 * periodização, em que a base é longa e o taper é curto.
 */
const ReguaDeFases: React.FC<{ semanas: ResumoSemana[]; semanaAtual: number | null }> = ({
  semanas, semanaAtual,
}) => {
  const blocos = useMemo(() => {
    const ordem: (keyof typeof FASES)[] = ['base', 'build', 'peak', 'taper'];
    return ordem
      .map((fase) => {
        const doGrupo = semanas.filter((s) => s.phase === fase);
        if (doGrupo.length === 0) return null;
        return {
          fase,
          semanas: doGrupo.length,
          de: doGrupo[0].week_number,
          ate: doGrupo[doGrupo.length - 1].week_number,
          km: +doGrupo.reduce((t, s) => t + s.total_km, 0).toFixed(1),
        };
      })
      .filter(Boolean) as Array<{ fase: keyof typeof FASES; semanas: number; de: number; ate: number; km: number }>;
  }, [semanas]);

  if (blocos.length === 0) return null;
  const total = blocos.reduce((t, b) => t + b.semanas, 0);

  return (
    <div className="space-y-2.5">
      <div className="flex h-3 rounded-full overflow-hidden bg-[#101010]" role="presentation">
        {blocos.map((b) => (
          <div
            key={b.fase}
            style={{ width: `${(b.semanas / total) * 100}%`, backgroundColor: FASES[b.fase].cor }}
            title={`${FASES[b.fase].rotulo}: semanas ${b.de} a ${b.ate}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {blocos.map((b) => {
          const atual = semanaAtual != null && semanaAtual >= b.de && semanaAtual <= b.ate;
          return (
            <div
              key={b.fase}
              className={`bg-[#1C1C1C] rounded-xl p-2.5 border ${atual ? 'border-[#FF5500]' : 'border-[#262626]'}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: FASES[b.fase].cor }} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#F7F5F3] truncate">
                  {FASES[b.fase].rotulo}
                </span>
              </div>
              <span className="text-[9px] text-[#A1A1AA] block mt-0.5">
                Sem. {b.de}–{b.ate} • {b.km} km
              </span>
              <p className="text-[9px] text-[#737373] leading-relaxed mt-1">{FASES[b.fase].resumo}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ------------------------------------------------------------

const Sessao: React.FC<{ sessao: any; cumprida: boolean }> = ({ sessao, cumprida }) => {
  const ehDescanso = sessao.type === 'rest';

  return (
    <div
      className={`rounded-lg p-2.5 border flex items-start gap-2.5 ${
        ehDescanso ? 'bg-[#0D0D0D] border-[#1C1C1C]' : 'bg-[#101010] border-[#262626]'
      }`}
    >
      <span className="w-14 shrink-0">
        <span className="text-[9px] text-[#737373] uppercase tracking-widest block">
          {DIAS[sessao.day_of_week] || `Dia ${sessao.day_of_week}`}
        </span>
      </span>

      <span className="flex-1 min-w-0">
        <span className={`text-xs font-bold block truncate ${ehDescanso ? 'text-[#737373]' : 'text-[#F7F5F3]'}`}>
          {TIPO_ROTULO[sessao.type] || sessao.type}
          {!ehDescanso && sessao.distance_km ? ` • ${sessao.distance_km} km` : ''}
        </span>

        {!ehDescanso && (
          <span className="flex items-center gap-2 mt-0.5 flex-wrap">
            {sessao.duration_min ? (
              <span className="text-[9px] text-[#A1A1AA]">{sessao.duration_min} min</span>
            ) : null}
            {sessao.target_pace && <span className="text-[9px] text-[#A1A1AA]">{sessao.target_pace}/km</span>}
            {sessao.target_hr_zone && (
              <span className="text-[9px] font-bold text-[#FF5500]">{sessao.target_hr_zone}</span>
            )}
            {Number(sessao.is_fixed) === 1 && (
              <span className="text-[9px] text-[#C084FC] uppercase tracking-wider">do treinador</span>
            )}
          </span>
        )}

        {sessao.description && !ehDescanso && (
          <span className="text-[9px] text-[#737373] leading-relaxed block mt-1">{sessao.description}</span>
        )}
      </span>

      {cumprida && (
        <span
          className="material-symbols-outlined text-[#22C55E] text-[18px] shrink-0"
          title="Sessão cumprida"
          aria-label="cumprida"
        >
          check_circle
        </span>
      )}
    </div>
  );
};

// ------------------------------------------------------------

export const FullPlanScreen: React.FC<FullPlanScreenProps> = ({ plano, onVoltar }) => {
  const {
    plan, weeks, weekSummary, totals, assignment, completedIds, completedKm, isLoading, error,
  } = plano;

  const semanaAtual = assignment?.current_week ? Number(assignment.current_week) : null;
  const [aberta, setAberta] = useState<number | null>(null);

  // A semana corrente abre sozinha na primeira renderização com dados.
  const abertaEfetiva = aberta ?? semanaAtual;

  if (isLoading && !plan) {
    return (
      <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 pt-2 pb-8 space-y-3">
        <div className="h-24 rounded-2xl bg-[#1C1C1C] border border-[#262626] animate-pulse" />
        <div className="h-40 rounded-2xl bg-[#1C1C1C] border border-[#262626] animate-pulse" />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 pt-4 pb-8 space-y-3">
        <button
          type="button"
          onClick={onVoltar}
          className="self-start flex items-center gap-1 text-[#A1A1AA] hover:text-[#F7F5F3] cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          <span className="text-xs uppercase tracking-wider">Treinos</span>
        </button>
        <div className="bg-[#1C1C1C] border border-[#EF4444] rounded-xl p-4">
          <p className="text-xs text-[#F7F5F3] leading-relaxed">
            {error || 'Não foi possível carregar o plano.'}
          </p>
        </div>
      </div>
    );
  }

  const dias = diasAte(assignment?.end_date);
  const pctVolume = totals && totals.total_km > 0
    ? Math.round((completedKm / totals.total_km) * 100)
    : 0;

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-5 pt-2 pb-8">
      {/* Cabeçalho */}
      <div className="border-b border-[#262626] pb-3">
        <button
          type="button"
          onClick={onVoltar}
          className="flex items-center gap-1 text-[#A1A1AA] hover:text-[#F7F5F3] transition-colors cursor-pointer mb-2"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          <span className="text-xs uppercase tracking-wider">Treinos</span>
        </button>
        <span className="font-label-caps text-[10px] text-[#FF5500] uppercase tracking-widest font-extrabold block">
          Plano periodizado
        </span>
        <h1 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight">{plan.name}</h1>
        <p className="text-xs text-[#737373] leading-relaxed mt-1">
          {plan.distance_km} km • {plan.duration_weeks} semanas • {plan.level}
          {dias != null && dias >= 0 ? ` • faltam ${dias} ${dias === 1 ? 'dia' : 'dias'}` : ''}
        </p>
      </div>

      {/* Números do plano */}
      {totals && (
        <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-[9px] text-[#A1A1AA] uppercase tracking-widest block">Volume total</span>
              <span className="font-headline text-xl text-[#F7F5F3] block leading-tight">
                {totals.total_km}<span className="text-[10px] text-[#737373] ml-0.5">km</span>
              </span>
            </div>
            <div>
              <span className="text-[9px] text-[#A1A1AA] uppercase tracking-widest block">Sessões</span>
              <span className="font-headline text-xl text-[#F7F5F3] block leading-tight">
                {totals.sessions}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-[#A1A1AA] uppercase tracking-widest block">Cumprido</span>
              <span className="font-headline text-xl text-[#FF5500] block leading-tight">
                {completedKm}<span className="text-[10px] text-[#737373] ml-0.5">km</span>
              </span>
            </div>
          </div>

          <div className="h-2 bg-[#101010] rounded-full overflow-hidden">
            <div className="h-full bg-[#FF5500] rounded-full transition-all" style={{ width: `${Math.min(100, pctVolume)}%` }} />
          </div>
          <span className="text-[10px] text-[#A1A1AA]">
            {pctVolume}% do volume planejado
            {completedIds.length > 0 ? ` • ${completedIds.length} sessões registradas` : ' • nenhuma sessão registrada ainda'}
          </span>
        </div>
      )}

      {/* Régua das fases */}
      <div className="space-y-2">
        <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
          As quatro fases
        </span>
        <ReguaDeFases semanas={weekSummary} semanaAtual={semanaAtual} />
      </div>

      {/* Cronograma */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest">
            Cronograma
          </span>
          {semanaAtual && (
            <span className="text-[9px] text-[#FF5500] uppercase tracking-widest">
              semana {semanaAtual} em andamento
            </span>
          )}
        </div>

        {weekSummary.map((s) => {
          const ehAtual = semanaAtual === s.week_number;
          const estaAberta = abertaEfetiva === s.week_number;
          const sessoes = weeks[String(s.week_number)] || [];
          const cumpridasNaSemana = sessoes.filter((x: any) => completedIds.includes(x.id)).length;
          const fase = FASES[s.phase];

          return (
            <div
              key={s.week_number}
              className={`bg-[#1C1C1C] rounded-xl border overflow-hidden ${
                ehAtual ? 'border-[#FF5500]' : 'border-[#262626]'
              }`}
            >
              <button
                type="button"
                onClick={() => setAberta(estaAberta ? -1 : s.week_number)}
                aria-expanded={estaAberta}
                className="w-full min-h-[56px] p-3 flex items-center gap-2.5 text-left cursor-pointer hover:bg-[#262626] transition-colors"
              >
                <span
                  className="w-1 h-9 rounded-full shrink-0"
                  style={{ backgroundColor: fase.cor }}
                  aria-hidden="true"
                />

                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="font-headline text-sm uppercase text-[#F7F5F3]">
                      Semana {s.week_number}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider" style={{ color: fase.cor }}>
                      {fase.rotulo}
                    </span>
                    {s.has_test && (
                      <span className="text-[9px] text-[#FF5500] uppercase tracking-wider">simulado</span>
                    )}
                  </span>
                  <span className="text-[10px] text-[#A1A1AA] block mt-0.5">
                    {s.session_count} {s.session_count === 1 ? 'treino' : 'treinos'} • {s.rest_count} descanso
                    {s.rest_count === 1 ? '' : 's'}
                    {cumpridasNaSemana > 0 ? ` • ${cumpridasNaSemana} cumprido${cumpridasNaSemana === 1 ? '' : 's'}` : ''}
                  </span>
                </span>

                <span className="text-right shrink-0">
                  <span className="font-headline text-base text-[#F7F5F3] block leading-none">
                    {s.total_km}
                  </span>
                  <span className="text-[9px] text-[#737373]">km</span>
                </span>

                <span className="material-symbols-outlined text-[#A1A1AA] text-[20px] shrink-0">
                  {estaAberta ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {estaAberta && (
                <div className="px-3 pb-3 space-y-1.5">
                  {sessoes.length === 0 ? (
                    <p className="text-[10px] text-[#737373] py-2">Sem sessões nesta semana.</p>
                  ) : (
                    sessoes.map((sessao: any) => (
                      <Sessao
                        key={sessao.id}
                        sessao={sessao}
                        cumprida={completedIds.includes(sessao.id)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[9px] text-[#525252] leading-relaxed text-center">
        Periodização em quatro fases segundo os modelos de Daniels, Pfitzinger e Seiler. O volume de
        cada sessão é ajustado diariamente pela sua VFC.
      </p>
    </div>
  );
};
