// ============================================================
// RUSH RUNNING — Camada de dados do shell autenticado
// Busca tudo que as telas precisam da API e traduz para os
// tipos de apresentação via src/data/adapters.ts.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { activities as activitiesApi, hrv, social, training, users } from '../api';
import {
  AthleteProfile,
  DailyMileage,
  FeedPost,
  PhysiologicalReadiness,
  WeeklySummary,
  WorkoutPrescription,
} from '../types';
import {
  EMPTY_READINESS,
  toAthlete,
  toFeedPosts,
  toReadiness,
  toWeeklySchedule,
  toWeeklySummary,
  toWorkout,
} from '../data/adapters';
import { APP_IMAGES } from '../data/appAssets';

/** Perfil exibido enquanto o primeiro carregamento não termina. */
const PLACEHOLDER_ATHLETE: AthleteProfile = {
  id: 'loading',
  name: '—',
  handle: '@—',
  category: 'AGE-GROUP',
  avatarUrl: APP_IMAGES.headerAvatar,
  status: 'READY',
  statusText: 'CARREGANDO…',
  quote: '',
  vo2Max: 0,
  restingHR: 0,
  thresholdPace: '—',
  targetWeeklyKm: 0,
  completedWeeklyKm: 0,
  totalKm: 0,
  totalWorkouts: 0,
  followers: 0,
  following: 0,
  pr5k: '—',
  pr10k: '—',
  pr21k: '—',
  pr42k: '—',
};

const PLACEHOLDER_WORKOUT: WorkoutPrescription = {
  id: 'loading',
  title: 'CARREGANDO PRESCRIÇÃO…',
  focus: '—',
  imageUrl: APP_IMAGES.marianaActionRunning,
  targetPace: '—',
  durationMinutes: 0,
  distanceKm: 0,
  zone: '—',
  hrRange: '—',
  intensityLabel: '—',
  steps: [],
  coachingNotes: '',
};

/** Resolve uma promessa de API devolvendo `null` em vez de propagar erro. */
async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export interface RushData {
  athlete: AthleteProfile;
  readiness: PhysiologicalReadiness;
  todayWorkout: WorkoutPrescription;
  weeklySchedule: DailyMileage[];
  weeklySummary: WeeklySummary;
  feedPosts: FeedPost[];
  userPosts: FeedPost[];
  hrvStatusRaw: any;
  planRaw: any;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  submitMeasurement: (payload: MeasurementPayload) => Promise<void>;
  publishPost: (
    caption: string,
    options?: { privacy?: 'public' | 'followers' | 'private'; activityId?: string },
  ) => Promise<void>;
  finishRun: (payload: FinishRunPayload) => Promise<any>;
}

export interface MeasurementPayload {
  rmssd_ms: number;
  rhr_bpm: number;
  duration_seconds?: number;
  device_id?: string | null;
  wellness?: { sleep: number; fatigue: number; soreness: number; stress: number; readiness: number } | null;
}

export interface FinishRunPayload {
  distance_km: number;
  duration_seconds: number;
  avg_hr?: number | null;
  max_hr?: number | null;
  avg_pace?: string | null;
  title?: string | null;
  shoe_id?: string | null;
  session_id?: string | null;
}

export function useRushData(): RushData {
  const [athlete, setAthlete] = useState<AthleteProfile>(PLACEHOLDER_ATHLETE);
  const [readiness, setReadiness] = useState<PhysiologicalReadiness>(EMPTY_READINESS);
  const [todayWorkout, setTodayWorkout] = useState<WorkoutPrescription>(PLACEHOLDER_WORKOUT);
  const [weeklySchedule, setWeeklySchedule] = useState<DailyMileage[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary>({
    completedKm: 0,
    targetKm: 0,
    progressPercent: null,
    avgPace: '—',
    caloriesKcal: null,
    activityCount: 0,
  });
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [hrvStatusRaw, setHrvStatusRaw] = useState<any>(null);
  const [planRaw, setPlanRaw] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [me, profile, hrvStatus, plan, stats7, statsAll, records, vo2max, recentActivities, feed] =
        await Promise.all([
          safe(users.me()),
          safe(users.profile()),
          safe(hrv.status()),
          safe(training.myPlan()),
          safe(activitiesApi.stats(7)),
          safe(activitiesApi.stats(365)),
          safe(activitiesApi.records()),
          safe(hrv.vo2max()),
          safe(activitiesApi.list(1)),
          safe(social.feed('global', 1)),
        ]);

      if (!mounted.current) return;

      if (!me) {
        setError('Não foi possível carregar seu perfil. Verifique sua conexão.');
        setIsLoading(false);
        return;
      }

      // Volume semanal alvo = soma das sessões planejadas da semana corrente.
      const weeklyGoalKm = +(plan?.week_sessions || [])
        .reduce((sum: number, s: any) => sum + (s.distance_km || 0), 0)
        .toFixed(1);

      setHrvStatusRaw(hrvStatus);
      setPlanRaw(plan);
      setReadiness(hrvStatus?.measurement ? toReadiness(hrvStatus) : EMPTY_READINESS);
      setTodayWorkout(toWorkout(plan, hrvStatus, profile));
      setAthlete(
        toAthlete({ me, profile, hrvStatus, records, vo2max, stats7, statsAll, weeklyGoalKm }),
      );
      setWeeklySchedule(toWeeklySchedule(plan, recentActivities?.activities || []));
      setWeeklySummary(toWeeklySummary(plan, stats7, recentActivities?.activities || []));
      setFeedPosts(toFeedPosts(feed?.feed || [], me.id));
    } catch (err: any) {
      if (mounted.current) setError(err?.message || 'Erro ao carregar dados');
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  /** Registra a medição matinal (VFC + bem-estar) e recarrega a prescrição. */
  const submitMeasurement = useCallback(
    async (payload: MeasurementPayload) => {
      if (payload.wellness) {
        await hrv.wellness(payload.wellness);
      }
      await hrv.measure({
        rmssd_ms: payload.rmssd_ms,
        rhr_bpm: payload.rhr_bpm,
        hr_rest_bpm: payload.rhr_bpm,
        duration_seconds: payload.duration_seconds ?? 60,
        device_id: payload.device_id ?? null,
      });
      await reload();
    },
    [reload],
  );

  /**
   * Publica no feed. No modelo do backend a "postagem" é a própria
   * atividade: a legenda e a privacidade escolhidas são gravadas na
   * atividade mais recente do atleta.
   */
  const publishPost = useCallback(
    async (caption: string, options?: { privacy?: 'public' | 'followers' | 'private'; activityId?: string }) => {
      let targetId = options?.activityId;

      if (!targetId) {
        const mine = await safe(activitiesApi.list(1));
        targetId = mine?.activities?.[0]?.id;
      }

      if (!targetId) {
        throw new Error('Nenhuma atividade registrada para publicar. Registre uma corrida primeiro.');
      }

      await activitiesApi.update(targetId, {
        feeling_notes: caption,
        privacy: options?.privacy || 'public',
      });
      await reload();
    },
    [reload],
  );

  /** Grava a corrida concluída como atividade real. */
  const finishRun = useCallback(
    async (payload: FinishRunPayload) => {
      const created = await activitiesApi.create({
        type: 'run',
        title: payload.title || undefined,
        distance_km: payload.distance_km,
        duration_seconds: payload.duration_seconds,
        avg_hr: payload.avg_hr ?? undefined,
        max_hr: payload.max_hr ?? undefined,
        avg_pace: payload.avg_pace ?? undefined,
        shoe_id: payload.shoe_id ?? undefined,
        session_id: payload.session_id ?? undefined,
      });
      await reload();
      return created;
    },
    [reload],
  );

  return {
    athlete,
    readiness,
    todayWorkout,
    weeklySchedule,
    weeklySummary,
    feedPosts,
    userPosts: feedPosts,
    hrvStatusRaw,
    planRaw,
    isLoading,
    error,
    reload,
    submitMeasurement,
    publishPost,
    finishRun,
  };
}
