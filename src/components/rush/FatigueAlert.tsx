// ============================================================
// RUSH RUNNING — Alerta de fadiga acumulada
// ------------------------------------------------------------
// Banner no topo do Início, a partir de 2 dias consecutivos com
// VFC abaixo da baseline. É o sinal de segurança mais importante
// do app: até esta tela existir, o backend calculava tudo isso e
// ninguém via.
//
// Tudo aqui vem medido: dias consecutivos, desvio da baseline,
// RMSSD do dia, FC de repouso contra a média e a sessão que o
// agente colocou no lugar da planejada. O protocolo de recuperação
// é exibido como o backend o montou, sem reescrita.
// ============================================================

import React from 'react';
import type { FatigueAlert as FatigueAlertData } from '../../data/adapters';

interface FatigueAlertProps {
  alert: FatigueAlertData;
  /** Razão carga aguda:crônica, quando há histórico suficiente. */
  acwr: number | null;
  onStartRecoverySession?: () => void;
  onOpenWorkouts?: () => void;
}

const TIPO_SESSAO: Record<string, string> = {
  rest: 'Descanso completo',
  active_recovery: 'Recuperação ativa',
  easy_run: 'Rodagem leve',
  recovery: 'Regenerativo',
};

/**
 * Acima de 1,5 a literatura associa a razão a maior incidência de lesão
 * (Gabbett, 2016). O texto para aí de propósito: não há base para atribuir
 * uma probabilidade específica nem uma lesão específica ao número.
 */
const ACWR_LIMITE_ALTO = 1.5;

export const FatigueAlert: React.FC<FatigueAlertProps> = ({
  alert,
  acwr,
  onStartRecoverySession,
  onOpenWorkouts,
}) => {
  if (alert.severity === 'none') return null;

  const critico = alert.severity === 'critical';
  const cor = critico ? '#EF4444' : '#FACC15';
  const sessao = alert.adjustedSession;

  return (
    <section
      role="alert"
      aria-live="polite"
      className="rounded-2xl border p-4 space-y-4"
      style={{
        borderColor: `${cor}66`,
        backgroundColor: `${cor}14`,
        boxShadow: critico ? `0 0 24px ${cor}22` : undefined,
      }}
    >
      {/* Cabeçalho */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${critico ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: cor }}
            />
            <span
              className="font-label-sm text-[10px] uppercase tracking-widest font-extrabold"
              style={{ color: cor }}
            >
              {alert.label}
            </span>
          </span>

          <span
            className="font-telemetry text-[9px] font-black uppercase px-2 py-0.5 rounded ml-auto"
            style={{ backgroundColor: `${cor}22`, color: cor }}
          >
            {critico ? 'Crítico' : 'Atenção'} • {alert.consecutiveLowDays} dias
          </span>
        </div>

        <h2 className="font-headline text-xl text-[#F7F5F3] uppercase leading-tight">
          {alert.headline}
        </h2>

        <p className="text-xs text-[#e5e2e1] leading-relaxed">
          {alert.deltaPercent != null && (
            <>
              Sua VFC está{' '}
              <strong style={{ color: cor }}>
                {Math.abs(alert.deltaPercent).toFixed(0)}% {alert.deltaPercent < 0 ? 'abaixo' : 'acima'}
              </strong>{' '}
              da baseline.{' '}
            </>
          )}
          {alert.explanation}
        </p>
      </div>

      {/* Números medidos */}
      {(alert.rmssdMs != null || alert.rhrToday != null) && (
        <div className="grid grid-cols-2 gap-2">
          {alert.rmssdMs != null && (
            <div className="bg-[#101010]/70 rounded-xl p-3 border border-[#262626]">
              <span className="font-telemetry text-[9px] text-[#A1A1AA] uppercase block">
                VFC (RMSSD)
              </span>
              <span className="font-headline text-2xl" style={{ color: cor }}>
                {alert.rmssdMs}
                <span className="text-[10px] text-[#A1A1AA] ml-1">ms</span>
              </span>
              {alert.rmssdBaselineRange && (
                <span className="font-telemetry text-[9px] text-[#737373] block mt-0.5">
                  Faixa normal: {alert.rmssdBaselineRange.min}–{alert.rmssdBaselineRange.max} ms
                </span>
              )}
            </div>
          )}

          {alert.rhrToday != null && (
            <div className="bg-[#101010]/70 rounded-xl p-3 border border-[#262626]">
              <span className="font-telemetry text-[9px] text-[#A1A1AA] uppercase block">
                FC de repouso
              </span>
              <span className="font-headline text-2xl text-[#F7F5F3]">
                {Math.round(alert.rhrToday)}
                <span className="text-[10px] text-[#A1A1AA] ml-1">bpm</span>
              </span>
              {alert.rhrDelta != null && (
                <span
                  className="font-telemetry text-[9px] block mt-0.5"
                  style={{ color: alert.rhrDelta > 0 ? cor : '#22C55E' }}
                >
                  {alert.rhrDelta > 0 ? '+' : ''}
                  {alert.rhrDelta.toFixed(1)} bpm vs. média
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sessão adaptada */}
      {sessao && (
        <div className="bg-[#101010]/70 rounded-xl p-3.5 border border-[#262626] space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest">
              Sessão de hoje, adaptada
            </span>
            {alert.recoveryLabel && (
              <span className="font-telemetry text-[9px] uppercase font-bold" style={{ color: cor }}>
                Nível {alert.recoveryLevel} • {alert.recoveryLabel}
              </span>
            )}
          </div>

          <span className="font-headline text-base text-[#F7F5F3] uppercase block">
            {TIPO_SESSAO[sessao.type] || sessao.type}
          </span>

          {(sessao.durationMin || sessao.targetZone) && (
            <div className="flex gap-4">
              {sessao.durationMin ? (
                <span className="font-telemetry text-[10px] text-[#A1A1AA]">
                  Duração: <strong className="text-[#F7F5F3]">{sessao.durationMin} min</strong>
                </span>
              ) : null}
              {sessao.targetZone && (
                <span className="font-telemetry text-[10px] text-[#A1A1AA]">
                  Zona: <strong className="text-[#F7F5F3]">{sessao.targetZone}</strong>
                </span>
              )}
            </div>
          )}

          {sessao.description && (
            <p className="text-xs text-[#A1A1AA] leading-relaxed">{sessao.description}</p>
          )}
        </div>
      )}

      {/* Protocolo do backend, exibido como veio */}
      {alert.recoveryActivities.length > 0 && (
        <div className="space-y-1.5">
          <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
            Protocolo de hoje
          </span>
          <ul className="space-y-1">
            {alert.recoveryActivities.map((item, indice) => (
              <li key={indice} className="flex gap-2 text-xs text-[#e5e2e1] leading-relaxed">
                <span className="shrink-0" style={{ color: cor }}>
                  •
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Carga de treino, quando disponível */}
      {acwr != null && acwr > ACWR_LIMITE_ALTO && (
        <div className="bg-[#101010]/70 rounded-xl p-3 border border-[#262626] flex items-start gap-2.5">
          <span className="material-symbols-outlined text-[18px] shrink-0" style={{ color: cor }}>
            info
          </span>
          <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
            Sua razão carga aguda:crônica está em{' '}
            <strong style={{ color: cor }}>{acwr.toFixed(2)}</strong>. Razões acima de 1,5 estão
            associadas a maior incidência de lesão (Gabbett, 2016). Priorize a recuperação antes de
            voltar à alta intensidade.
          </p>
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-2">
        {onStartRecoverySession && sessao && sessao.type !== 'rest' && (
          <button
            type="button"
            onClick={onStartRecoverySession}
            className="flex-1 min-h-[48px] bg-[#FF5500] hover:bg-[#FF6B00] text-[#0D0D0D] font-headline text-sm uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">play_arrow</span>
            <span>Iniciar sessão leve</span>
          </button>
        )}

        {onOpenWorkouts && (
          <button
            type="button"
            onClick={onOpenWorkouts}
            className={`min-h-[48px] px-4 bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] text-[#F7F5F3] font-headline text-sm uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              sessao && sessao.type !== 'rest' && onStartRecoverySession ? '' : 'flex-1'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">calendar_view_week</span>
            <span>Ver plano</span>
          </button>
        )}
      </div>
    </section>
  );
};
