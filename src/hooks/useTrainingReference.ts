// ============================================================
// RUSH RUNNING — Referências de treino sob demanda
// ------------------------------------------------------------
// Dados de consulta que não precisam entrar no carregamento
// inicial do app: as cinco zonas de frequência cardíaca e o
// ranking de um desafio.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { hrv, training } from '../api';

export interface HrZone {
  name: string;
  minBpm: number;
  maxBpm: number;
  pctMax: string;
  rpe: string;
  purpose: string;
  /** Faixa de DFA-α1 correspondente, quando aplicável. */
  dfaAlpha1: string;
}

export interface HrZonesData {
  maxHr: number | null;
  /**
   * De onde veio a FCmáx: medida num teste de campo, ou estimada
   * pela idade.
   *
   * A tela precisa distinguir as duas. Uma estimativa por idade é
   * uma média populacional — ela erra por indivíduo, e num caso
   * medido aqui a diferença foi de 13 bpm, o bastante para deslocar
   * uma zona inteira. Mostrar as duas do mesmo jeito engana quem lê.
   */
  maxHrSource: 'field_test' | 'age_estimate' | null;
  zones: Record<string, HrZone>;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useHrZones(enabled = true): HrZonesData {
  const [maxHr, setMaxHr] = useState<number | null>(null);
  const [maxHrSource, setMaxHrSource] = useState<'field_test' | 'age_estimate' | null>(null);
  const [zones, setZones] = useState<Record<string, HrZone>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await hrv.zones();
      setMaxHr(res?.max_hr ?? null);
      setMaxHrSource(res?.max_hr_source ?? null);
      setZones(res?.zones || {});
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar as zonas de frequência cardíaca');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  return { maxHr, maxHrSource, zones, isLoading, error, reload };
}

// ------------------------------------------------------------
// Plano completo
// ------------------------------------------------------------

export interface ResumoSemana {
  week_number: number;
  /** Vem do backend, e não é recalculada aqui: é a mesma conta que gera o plano. */
  phase: 'base' | 'build' | 'peak' | 'taper';
  total_km: number;
  session_count: number;
  rest_count: number;
  has_test: boolean;
}

export interface PlanoCompletoData {
  plan: any | null;
  /** Sessões agrupadas por número da semana. */
  weeks: Record<string, any[]>;
  weekSummary: ResumoSemana[];
  totals: { weeks: number; sessions: number; total_km: number } | null;
  assignment: any | null;
  /** Ids das sessões que este atleta já cumpriu — derivado de activities.session_id. */
  completedIds: string[];
  completedKm: number;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * O plano inteiro, das 12 semanas.
 *
 * A tela de treinos mostra só a semana corrente. Um plano
 * periodizado existe justamente para se ver aonde ele vai: saber
 * que a semana 9 é o pico e a 10 tem o simulado muda como o atleta
 * encara a semana 3.
 */
export function usePlanoCompleto(planId: string | null): PlanoCompletoData {
  const [dados, setDados] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!planId) return;
    setIsLoading(true);
    setError(null);
    try {
      setDados(await training.planDetails(planId));
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar o plano');
    } finally {
      setIsLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    if (planId) reload();
    else setDados(null);
  }, [planId, reload]);

  return {
    plan: dados?.plan ?? null,
    weeks: dados?.weeks ?? {},
    weekSummary: Array.isArray(dados?.week_summary) ? dados.week_summary : [],
    totals: dados?.totals ?? null,
    assignment: dados?.assignment ?? null,
    completedIds: Array.isArray(dados?.completed_session_ids) ? dados.completed_session_ids : [],
    completedKm: Number(dados?.completed_km) || 0,
    isLoading,
    error,
    reload,
  };
}
