// ============================================================
// RUSH RUNNING — Ciclo menstrual
// ------------------------------------------------------------
// A fase é SEMPRE calculada pelo backend a partir da data do
// último período: este hook nunca deduz fase no cliente.
// O módulo é opcional — um atleta sem perfil cadastrado fica em
// hasProfile: false e nada deve forçá-lo a preencher.
//
// Carregado sob demanda pela tela de ciclo; não entra no
// carregamento inicial do app.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { menstrual } from '../api';

/** Fases devolvidas pelo backend (McNulty et al., 2020). */
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export interface CycleProfile {
  lmp_date: string;
  cycle_length_days: number;
  uses_hormonal_contraceptive: boolean;
  contraceptive_type: string | null;
}

export interface CycleTracking {
  date: string;
  phase: CyclePhase;
  cramp_level: number;
  bloating_level: number;
  energy_level: number;
  mood_level: number;
  bleeding_intensity: string | null;
}

export interface CycleTrackingInput {
  cramp_level?: number;
  bloating_level?: number;
  energy_level?: number;
  mood_level?: number;
  bleeding_intensity?: string | null;
  date?: string;
}

export interface CycleProfileInput {
  lmp_date: string;
  cycle_length_days?: number;
  uses_hormonal_contraceptive?: boolean;
  contraceptive_type?: string | null;
}

export interface CycleData {
  hasProfile: boolean;
  profile: CycleProfile | null;
  /** Null enquanto não houver perfil cadastrado. */
  phase: CyclePhase | null;
  cycleLengthDays: number | null;
  usesHormonalContraceptive: boolean;
  /** Registro de sintomas de hoje; null quando o dia ainda não foi preenchido. */
  tracking: CycleTracking | null;
  symptomScore: number | null;
  /** Recomendação de treino da fase, montada pelo backend. Exibir como veio. */
  recommendation: any | null;
  isLoading: boolean;
  error: string | null;
  /** Limites aceitos pelo backend para a duração do ciclo. */
  cycleLengthRange: { min: number; max: number };
  reload: () => Promise<void>;
  saveProfile: (input: CycleProfileInput) => Promise<void>;
  saveTracking: (input: CycleTrackingInput) => Promise<void>;
}

/** O backend fixa valores fora desta faixa no limite mais próximo. */
const CYCLE_LENGTH_RANGE = { min: 21, max: 35 };

export function useCycle(enabled = true): CycleData {
  const [today, setToday] = useState<any>(null);
  const [profile, setProfile] = useState<CycleProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [todayRes, profileRes] = await Promise.all([
        menstrual.today(),
        menstrual.getProfile(),
      ]);
      setToday(todayRes);
      setProfile(profileRes?.profile || null);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar dados do ciclo');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  const saveProfile = useCallback(
    async (input: CycleProfileInput) => {
      if (!input.lmp_date) {
        throw new Error('A data do último período é obrigatória.');
      }
      await menstrual.saveProfile({
        lmp_date: input.lmp_date,
        cycle_length_days: input.cycle_length_days ?? 28,
        uses_hormonal_contraceptive: !!input.uses_hormonal_contraceptive,
        contraceptive_type: input.contraceptive_type ?? null,
      });
      await reload();
    },
    [reload],
  );

  const saveTracking = useCallback(
    async (input: CycleTrackingInput) => {
      // O POST sobrescreve o dia: corrigir um registro é reenviar.
      await menstrual.track(input);
      await reload();
    },
    [reload],
  );

  const hasProfile = !!today?.has_profile;

  return {
    hasProfile,
    profile: profile
      ? { ...profile, uses_hormonal_contraceptive: !!profile.uses_hormonal_contraceptive }
      : null,
    phase: hasProfile ? (today.phase as CyclePhase) : null,
    cycleLengthDays: today?.cycle_length_days ?? profile?.cycle_length_days ?? null,
    usesHormonalContraceptive: !!today?.uses_hormonal_contraceptive,
    tracking: today?.tracking || null,
    symptomScore: today?.symptom_score ?? null,
    recommendation: today?.recommendation || null,
    isLoading,
    error,
    cycleLengthRange: CYCLE_LENGTH_RANGE,
    reload,
    saveProfile,
    saveTracking,
  };
}
