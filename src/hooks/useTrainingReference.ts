// ============================================================
// RUSH RUNNING — Referências de treino sob demanda
// ------------------------------------------------------------
// Dados de consulta que não precisam entrar no carregamento
// inicial do app: as cinco zonas de frequência cardíaca e o
// ranking de um desafio.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { challenges, hrv } from '../api';

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
  /** Estimada por idade quando não há teste de campo — a tela precisa dizer isso. */
  maxHr: number | null;
  zones: Record<string, HrZone>;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useHrZones(enabled = true): HrZonesData {
  const [maxHr, setMaxHr] = useState<number | null>(null);
  const [zones, setZones] = useState<Record<string, HrZone>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await hrv.zones();
      setMaxHr(res?.max_hr ?? null);
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

  return { maxHr, zones, isLoading, error, reload };
}

export interface LeaderboardEntry {
  user_id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  rank: number;
  progress_value: number;
  progress_pct: number;
  is_me: boolean;
}

export interface LeaderboardData {
  challenge: any | null;
  entries: LeaderboardEntry[];
  /** A linha do próprio atleta, para fixar no topo ou no rodapé da lista. */
  myEntry: LeaderboardEntry | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useChallengeLeaderboard(challengeId: string | null): LeaderboardData {
  const [challenge, setChallenge] = useState<any | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!challengeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await challenges.leaderboard(challengeId);
      setChallenge(res?.challenge || null);
      setEntries(res?.leaderboard || []);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar o ranking do desafio');
    } finally {
      setIsLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    challenge,
    entries,
    myEntry: entries.find((e) => e.is_me) || null,
    isLoading,
    error,
    reload,
  };
}
