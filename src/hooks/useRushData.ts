// ============================================================
// RUSH RUNNING — Camada de dados do shell autenticado
// Busca tudo que as telas precisam da API e traduz para os
// tipos de apresentação via src/data/adapters.ts.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  activities as activitiesApi,
  challenges as challengesApi,
  hrv,
  social,
  subscriptions as subscriptionsApi,
  training,
  users,
} from '../api';
import {
  AthleteProfile,
  DailyMileage,
  FeedPost,
  PhysiologicalReadiness,
  UpcomingSession,
  WeeklySummary,
  WorkoutPrescription,
} from '../types';
import {
  EMPTY_READINESS,
  toAthlete,
  toFeedPosts,
  toReadiness,
  toUpcomingSessions,
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
  upcomingSessions: UpcomingSession[];
  currentWeek: number | null;
  feedPosts: FeedPost[];
  feedChannel: FeedChannel;
  setFeedChannel: (channel: FeedChannel) => void;
  isLoadingFeed: boolean;
  toggleKudo: (postId: string) => Promise<void>;
  activeChallenge: any | null;
  joinChallenge: (id: string) => Promise<void>;
  trainingLoad: any | null;
  hrvHistory: any[];
  vo2maxRaw: any;
  devices: any[];
  subscription: any | null;
  recentActivitiesRaw: any[];
  reloadDevices: () => Promise<void>;
  hrvStatusRaw: any;
  planRaw: any;
  profileRaw: any;
  recordsRaw: any;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  submitMeasurement: (payload: MeasurementPayload) => Promise<void>;
  finishRun: (payload: FinishRunPayload) => Promise<any>;
}

export type FeedChannel = 'foryou' | 'following' | 'club';

/** Cada canal do feed mapeia para um escopo do endpoint social. */
const CHANNEL_SCOPE: Record<FeedChannel, string> = {
  foryou: 'global',
  following: 'following',
  club: 'academy',
};

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
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([]);
  const [feedChannel, setFeedChannelState] = useState<FeedChannel>('foryou');
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState<any | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [trainingLoad, setTrainingLoad] = useState<any | null>(null);
  const [hrvHistory, setHrvHistory] = useState<any[]>([]);
  const [vo2maxRaw, setVo2maxRaw] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any | null>(null);
  const [recentActivitiesRaw, setRecentActivitiesRaw] = useState<any[]>([]);
  const [hrvStatusRaw, setHrvStatusRaw] = useState<any>(null);
  const [planRaw, setPlanRaw] = useState<any>(null);
  const [profileRaw, setProfileRaw] = useState<any>(null);
  const [recordsRaw, setRecordsRaw] = useState<any>(null);
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
          safe(social.feed(CHANNEL_SCOPE[feedChannel], 1)),
        ]);

      const [load, history, deviceList, subStatus] = await Promise.all([
        safe(activitiesApi.trainingLoad()),
        safe(hrv.history(28)),
        safe(users.devices()),
        safe(subscriptionsApi.status()),
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
      setProfileRaw(profile);
      setRecordsRaw(records);
      setTrainingLoad(load);
      setHrvHistory(history?.measurements || []);
      setVo2maxRaw(vo2max);
      setDevices(deviceList?.devices || []);
      setSubscription(subStatus);
      setRecentActivitiesRaw(recentActivities?.activities || []);
      setReadiness(hrvStatus?.measurement ? toReadiness(hrvStatus) : EMPTY_READINESS);
      setTodayWorkout(toWorkout(plan, hrvStatus, profile));
      setAthlete(
        toAthlete({ me, profile, hrvStatus, records, vo2max, stats7, statsAll, weeklyGoalKm }),
      );
      setWeeklySchedule(toWeeklySchedule(plan, recentActivities?.activities || []));
      setWeeklySummary(toWeeklySummary(plan, stats7, recentActivities?.activities || []));
      setUpcomingSessions(toUpcomingSessions(plan, profile));
      setCurrentUserId(me.id);
      setFeedPosts(toFeedPosts(feed?.feed || [], me.id));

      // Desafio em destaque: o que o atleta já participa, senão o primeiro ativo.
      const challengeList = await safe(challengesApi.list());
      const all = challengeList?.challenges || [];
      setActiveChallenge(all.find((c: any) => c.is_participating) || all[0] || null);
    } catch (err: any) {
      if (mounted.current) setError(err?.message || 'Erro ao carregar dados');
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, [feedChannel]);

  useEffect(() => {
    reload();
  }, [reload]);

  /** Troca o canal do feed e recarrega apenas a lista de posts. */
  const setFeedChannel = useCallback(
    async (channel: FeedChannel) => {
      setFeedChannelState(channel);
      setIsLoadingFeed(true);
      const feed = await safe(social.feed(CHANNEL_SCOPE[channel], 1));
      if (mounted.current) {
        setFeedPosts(toFeedPosts(feed?.feed || [], currentUserId || undefined));
        setIsLoadingFeed(false);
      }
    },
    [currentUserId],
  );

  /** Curte/descurte uma atividade, refletindo a contagem devolvida pela API. */
  const toggleKudo = useCallback(async (postId: string) => {
    const result = await social.like(postId);
    setFeedPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, isKudoed: !!result.liked, kudosCount: result.likes_count ?? p.kudosCount } : p,
      ),
    );
  }, []);

  /** Recarrega apenas a lista de sensores pareados. */
  const reloadDevices = useCallback(async () => {
    const deviceList = await safe(users.devices());
    if (mounted.current) setDevices(deviceList?.devices || []);
  }, []);

  /** Entra em um desafio e atualiza o card em destaque. */
  const joinChallenge = useCallback(async (id: string) => {
    await challengesApi.join(id);
    const list = await safe(challengesApi.list());
    const all = list?.challenges || [];
    setActiveChallenge(all.find((c: any) => c.id === id) || all[0] || null);
  }, []);

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
    upcomingSessions,
    currentWeek: planRaw?.plan?.current_week ?? null,
    feedPosts,
    feedChannel,
    setFeedChannel,
    isLoadingFeed,
    toggleKudo,
    activeChallenge,
    joinChallenge,
    trainingLoad,
    hrvHistory,
    vo2maxRaw,
    devices,
    subscription,
    recentActivitiesRaw,
    reloadDevices,
    hrvStatusRaw,
    planRaw,
    profileRaw,
    recordsRaw,
    isLoading,
    error,
    reload,
    submitMeasurement,
    finishRun,
  };
}
