// ============================================================
// RUSH RUNNING — Ficha do atleta (visão do treinador)
// ------------------------------------------------------------
// Tudo aqui chega numa requisição só: perfil, objetivo, 30 dias
// de VFC, as últimas atividades, o histórico de VO₂máx e o plano
// em execução.
//
// O gráfico de VFC é o centro da tela. Uma série de lnRMSSD sem
// a faixa de referência do próprio atleta é ilegível: o que
// importa não é o valor de hoje, é o quanto ele se afastou da
// média dele. Por isso a faixa (média ± desvio) é desenhada ao
// fundo, e a linha por cima.
//
// O que o desenho trazia e ficou de fora: nome e tempo-alvo da
// prova (o schema guarda só a data), número de géis por treino, e
// um badge "PRO #8824" com número de matrícula. Nenhum desses
// campos existe.
// ============================================================

import React, { useMemo } from 'react';
import type { FichaAtletaData } from '../hooks/useAssessoria';

interface CoachAthleteScreenProps {
  ficha: FichaAtletaData;
  onVoltar: () => void;
  onPrescrever: () => void;
}

const COR_ESTADO: Record<string, string> = {
  recovery: '#EF4444',
  attention: '#FACC15',
  favorable: '#22C55E',
};

/** Idade a partir da data de nascimento, ou null. */
function idadeDe(nascimento?: string | null): number | null {
  if (!nascimento) return null;
  const n = new Date(nascimento);
  if (Number.isNaN(n.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - n.getFullYear();
  const m = hoje.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) idade -= 1;
  return idade > 0 && idade < 120 ? idade : null;
}

/** Dias até a prova, quando há data marcada. */
function diasAte(data?: string | null): number | null {
  if (!data) return null;
  const alvo = new Date(data);
  if (Number.isNaN(alvo.getTime())) return null;
  return Math.ceil((alvo.getTime() - Date.now()) / 86400000);
}

const Dado: React.FC<{ rotulo: string; valor: string; unidade?: string; cor?: string }> = ({
  rotulo, valor, unidade, cor = 'text-[#F7F5F3]',
}) => (
  <div className="bg-[#1C1C1C] border border-[#262626] rounded-xl p-2.5 text-center">
    <span className="text-[9px] text-[#A1A1AA] uppercase tracking-widest block">{rotulo}</span>
    <span className={`font-headline text-lg block leading-tight ${cor}`}>
      {valor}
      {unidade && <span className="text-[10px] text-[#737373] ml-0.5">{unidade}</span>}
    </span>
  </div>
);

// ------------------------------------------------------------
// Gráfico de VFC
// ------------------------------------------------------------

/**
 * Série de lnRMSSD com a faixa de referência do próprio atleta.
 *
 * SVG puro e sem biblioteca: são 30 pontos e uma faixa, e trazer
 * um pacote de gráficos para isso custaria mais do que resolve.
 */
const GraficoVfc: React.FC<{ historico: any[] }> = ({ historico }) => {
  const dados = useMemo(() => {
    // O backend devolve do mais recente para o mais antigo; o
    // gráfico lê da esquerda (antigo) para a direita (hoje).
    const pontos = [...historico]
      .filter((d) => Number.isFinite(Number(d.lnrmssd)))
      .reverse()
      .map((d) => ({
        valor: Number(d.lnrmssd),
        media: Number(d.lnrmssd_7d_mean),
        desvio: Number(d.lnrmssd_7d_sd),
        status: d.status as string,
        data: d.date as string,
      }));
    return pontos;
  }, [historico]);

  if (dados.length < 2) {
    return (
      <div className="bg-[#101010] border border-[#262626] rounded-xl p-4 text-center">
        <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
          {dados.length === 0
            ? 'Sem medições de VFC nos últimos 30 dias.'
            : 'Só uma medição nos últimos 30 dias — ainda não há série para desenhar.'}
        </p>
      </div>
    );
  }

  const L = 300;
  const A = 90;
  const pad = 4;

  const valores = dados.flatMap((d) => [
    d.valor,
    Number.isFinite(d.media) ? d.media + (Number.isFinite(d.desvio) ? d.desvio : 0) : d.valor,
    Number.isFinite(d.media) ? d.media - (Number.isFinite(d.desvio) ? d.desvio : 0) : d.valor,
  ]);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const span = max - min || 1;

  const x = (i: number) => pad + (i * (L - pad * 2)) / (dados.length - 1);
  const y = (v: number) => pad + (A - pad * 2) * (1 - (v - min) / span);

  const linha = dados.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.valor).toFixed(1)}`).join(' ');

  // Faixa média ± desvio: é ela que torna a linha interpretável.
  const temFaixa = dados.every((d) => Number.isFinite(d.media) && Number.isFinite(d.desvio));
  const faixa = temFaixa
    ? [
        ...dados.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.media + d.desvio).toFixed(1)}`),
        ...dados.slice().reverse().map((d, i) => {
          const idx = dados.length - 1 - i;
          return `L ${x(idx).toFixed(1)} ${y(d.media - d.desvio).toFixed(1)}`;
        }),
        'Z',
      ].join(' ')
    : null;

  const ultimo = dados[dados.length - 1];

  return (
    <div className="bg-[#101010] border border-[#262626] rounded-xl p-3">
      <svg
        viewBox={`0 0 ${L} ${A}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Série de ${dados.length} medições de VFC nos últimos 30 dias, com a faixa normal do atleta ao fundo.`}
        preserveAspectRatio="none"
      >
        {faixa && <path d={faixa} fill="#22C55E" fillOpacity="0.12" stroke="none" />}
        <path d={linha} fill="none" stroke="#FF5500" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle
          cx={x(dados.length - 1)}
          cy={y(ultimo.valor)}
          r="3"
          fill={COR_ESTADO[ultimo.status] || '#FF5500'}
        />
      </svg>

      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-[9px] text-[#A1A1AA] uppercase tracking-widest">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#22C55E]/30 border border-[#22C55E]/50" />
          Faixa normal dele
        </span>
        <span className="text-[9px] text-[#737373] uppercase tracking-widest">
          {dados.length} medições • {dados[0].data} → {ultimo.data}
        </span>
      </div>
    </div>
  );
};

// ------------------------------------------------------------

export const CoachAthleteScreen: React.FC<CoachAthleteScreenProps> = ({
  ficha, onVoltar, onPrescrever,
}) => {
  const { athlete, hrvHistory, recentActivities, vo2max, plan, isLoading, error } = ficha;

  if (isLoading && !athlete) {
    return (
      <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 pt-2 pb-8 space-y-3">
        <div className="h-24 rounded-2xl bg-[#1C1C1C] border border-[#262626] animate-pulse" />
        <div className="h-32 rounded-2xl bg-[#1C1C1C] border border-[#262626] animate-pulse" />
      </div>
    );
  }

  if (error || !athlete) {
    return (
      <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 pt-4 pb-8 space-y-3">
        <button
          type="button"
          onClick={onVoltar}
          className="self-start flex items-center gap-1 text-[#A1A1AA] hover:text-[#F7F5F3] cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          <span className="text-xs uppercase tracking-wider">Painel</span>
        </button>
        <div className="bg-[#1C1C1C] border border-[#EF4444] rounded-xl p-4">
          <p className="text-xs text-[#F7F5F3] leading-relaxed">
            {error || 'Não foi possível carregar a ficha deste atleta.'}
          </p>
        </div>
      </div>
    );
  }

  const idade = idadeDe(athlete.date_of_birth);
  const dias = diasAte(athlete.target_race_date);
  const ultimaVfc = hrvHistory[0] || null;
  const ultimoVo2 = vo2max[0] || null;
  const primeiroVo2 = vo2max.length > 1 ? vo2max[vo2max.length - 1] : null;
  const evolucaoVo2 =
    ultimoVo2 && primeiroVo2
      ? Number(ultimoVo2.vo2max_value) - Number(primeiroVo2.vo2max_value)
      : null;

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
          <span className="text-xs uppercase tracking-wider">Painel</span>
        </button>

        <div className="flex items-start gap-3">
          {athlete.avatar_url ? (
            <img src={athlete.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#262626] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#A1A1AA] text-[28px]">person</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight truncate">
              {athlete.name}
            </h1>
            <span className="text-xs text-[#737373] block truncate">@{athlete.username}</span>
            {ultimaVfc?.status && (
              <span
                className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border"
                style={{ color: COR_ESTADO[ultimaVfc.status], borderColor: COR_ESTADO[ultimaVfc.status] }}
              >
                {ultimaVfc.status === 'recovery' ? 'Recuperação'
                  : ultimaVfc.status === 'attention' ? 'Atenção' : 'Favorável'}
                {ultimaVfc.date ? ` • ${ultimaVfc.date}` : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Biometria */}
      <div className="grid grid-cols-4 gap-2">
        <Dado rotulo="Peso" valor={athlete.weight_kg ? String(athlete.weight_kg) : '—'} unidade={athlete.weight_kg ? 'kg' : ''} />
        <Dado rotulo="Altura" valor={athlete.height_cm ? String(athlete.height_cm) : '—'} unidade={athlete.height_cm ? 'cm' : ''} />
        <Dado rotulo="Idade" valor={idade != null ? String(idade) : '—'} unidade={idade != null ? 'anos' : ''} />
        <Dado
          rotulo="FC repouso"
          valor={athlete.hr_rest_tested ? String(athlete.hr_rest_tested) : '—'}
          unidade={athlete.hr_rest_tested ? 'bpm' : ''}
          cor="text-[#EF4444]"
        />
      </div>

      {/* Objetivo e plano */}
      {(athlete.distance_km || plan) && (
        <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
                {plan ? 'Plano em execução' : 'Objetivo'}
              </span>
              <span className="font-headline text-base text-[#F7F5F3] uppercase block truncate">
                {plan?.plan_name || `${athlete.distance_km} km`}
              </span>
            </div>
            {dias != null && dias >= 0 && (
              <div className="text-right shrink-0">
                <span className="font-headline text-xl text-[#FF5500] block leading-none">{dias}</span>
                <span className="text-[9px] text-[#A1A1AA] uppercase tracking-widest">
                  {dias === 1 ? 'dia p/ prova' : 'dias p/ prova'}
                </span>
              </div>
            )}
          </div>

          {plan && (
            <>
              <div className="h-2 bg-[#101010] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#FF5500] rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round(((plan.current_week || 1) / (plan.duration_weeks || 12)) * 100))}%`,
                  }}
                />
              </div>
              <span className="text-[10px] text-[#A1A1AA]">
                Semana {plan.current_week || 1} de {plan.duration_weeks || '—'}
                {plan.level ? ` • ${plan.level}` : ''}
              </span>
            </>
          )}
        </div>
      )}

      {/* VFC */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest">
            Tendência autonômica — 30 dias
          </span>
          {ultimaVfc && (
            <span className="font-headline text-lg" style={{ color: COR_ESTADO[ultimaVfc.status] || '#F7F5F3' }}>
              {Number(ultimaVfc.lnrmssd).toFixed(2)}
            </span>
          )}
        </div>
        <GraficoVfc historico={hrvHistory} />
        {ultimaVfc?.explanation_text && (
          <div className="bg-[#1C1C1C] border border-[#262626] rounded-xl p-3">
            <p className="text-[11px] text-[#D4D4D8] leading-relaxed">{ultimaVfc.explanation_text}</p>
          </div>
        )}
      </div>

      {/* VO2máx */}
      {vo2max.length > 0 && (
        <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-2.5">
          <div className="flex items-end justify-between gap-2">
            <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest">
              VO₂ máx. estimado
            </span>
            <span className="font-headline text-2xl text-[#FF5500]">
              {Number(ultimoVo2.vo2max_value).toFixed(1)}
              <span className="text-[10px] text-[#737373] ml-1">ml/kg/min</span>
            </span>
          </div>

          {/* Barras na ordem cronológica: a resposta vem invertida. */}
          <div className="flex items-end gap-1.5 h-16">
            {[...vo2max].reverse().map((v, i, arr) => {
              const val = Number(v.vo2max_value);
              const todos = arr.map((x) => Number(x.vo2max_value));
              const lo = Math.min(...todos) * 0.95;
              const hi = Math.max(...todos);
              const alt = hi > lo ? ((val - lo) / (hi - lo)) * 100 : 100;
              const ehUltimo = i === arr.length - 1;
              return (
                <div key={v.id || i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t ${ehUltimo ? 'bg-[#FF5500]' : 'bg-[#3F3F46]'}`}
                    style={{ height: `${Math.max(8, alt)}%` }}
                    title={`${val.toFixed(1)} em ${v.date}`}
                  />
                  <span className="text-[8px] text-[#737373]">{val.toFixed(1)}</span>
                </div>
              );
            })}
          </div>

          {evolucaoVo2 !== null && vo2max.length > 1 && (
            <span className={`text-[10px] ${evolucaoVo2 >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
              {evolucaoVo2 >= 0 ? '+' : ''}{evolucaoVo2.toFixed(1)} ml/kg/min desde a primeira estimativa
            </span>
          )}
        </div>
      )}

      {/* Atividades */}
      <div className="space-y-2">
        <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
          Últimas atividades
        </span>
        {recentActivities.length === 0 ? (
          <div className="bg-[#1C1C1C] border border-[#262626] rounded-xl p-4 text-center">
            <p className="text-xs text-[#A1A1AA]">Nenhuma atividade registrada.</p>
          </div>
        ) : (
          recentActivities.slice(0, 5).map((a: any) => (
            <div key={a.id} className="bg-[#1C1C1C] border border-[#262626] rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-bold text-[#F7F5F3] block truncate">
                    {a.title || 'Atividade'}
                  </span>
                  <span className="text-[10px] text-[#737373]">{String(a.date).slice(0, 10)}</span>
                </div>
                <span className="font-headline text-base text-[#FF5500] shrink-0">
                  {Number(a.distance_km).toFixed(1)}<span className="text-[10px] text-[#737373] ml-0.5">km</span>
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#A1A1AA]">
                {a.avg_pace && <span>{a.avg_pace}</span>}
                {a.avg_hr && <span>{a.avg_hr} bpm</span>}
                {a.rpe_score != null && <span>RPE {a.rpe_score}/10</span>}
              </div>
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={onPrescrever}
        className="w-full min-h-[52px] bg-[#FF5500] hover:bg-[#FF6A1F] rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
      >
        <span className="material-symbols-outlined text-[#0D0D0D] text-[20px]">edit</span>
        <span className="text-xs font-bold uppercase tracking-wider text-[#0D0D0D]">
          Prescrever treino
        </span>
      </button>
    </div>
  );
};
