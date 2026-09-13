// ============================================================
// RUSH RUNNING — Adaptadores Backend -> Tipos de Tela
// ------------------------------------------------------------
// O backend é a fonte da verdade fisiológica (trainingAgent.js).
// Este módulo apenas TRADUZ as respostas da API para as formas
// que os componentes de tela esperam. Nenhuma decisão de treino
// é tomada aqui.
// ============================================================

import {
  AthleteProfile,
  PhysiologicalReadiness,
  WorkoutPrescription,
  WorkoutStep,
  DailyMileage,
  FeedPost,
  RunningShoe,
  WeeklySummary,
  UpcomingSession,
  WorkoutCategory,
} from '../types';
import { APP_IMAGES } from './appAssets';

/* ------------------------------------------------------------------ */
/* Utilidades de formatação                                            */
/* ------------------------------------------------------------------ */

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function formatPace(secondsPerKm: number | null | undefined): string {
  if (!secondsPerKm || !isFinite(secondsPerKm) || secondsPerKm <= 0) return '—';
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function paceFromActivity(distanceKm: number, durationSeconds: number): string {
  if (!distanceKm || distanceKm <= 0) return '—';
  return formatPace(durationSeconds / distanceKm);
}

export function timeAgo(isoDate: string): string {
  const then = new Date(isoDate).getTime();
  if (isNaN(then)) return '';
  const diffMin = Math.floor((Date.now() - then) / 60000);
  if (diffMin < 1) return 'Agora mesmo';
  if (diffMin < 60) return `Há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Ontem';
  if (diffD < 7) return `Há ${diffD} dias`;
  const diffW = Math.floor(diffD / 7);
  if (diffW < 5) return `Há ${diffW} sem`;
  return new Date(isoDate).toLocaleDateString('pt-BR');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/* ------------------------------------------------------------------ */
/* Prontidão fisiológica                                               */
/* ------------------------------------------------------------------ */

const HRV_STATUS_LABEL: Record<string, PhysiologicalReadiness['hrvStatus']> = {
  favorable: 'Excelente',
  attention: 'Normal',
  recovery: 'Baixo',
};

const STATUS_HEADLINE: Record<string, string> = {
  favorable: 'RECUPERAÇÃO ÓTIMA',
  attention: 'ATENÇÃO — CARGA MODERADA',
  recovery: 'PRIORIDADE: RECUPERAÇÃO',
};

/**
 * Índice de prontidão 0–100 exibido no app.
 *
 * IMPORTANTE: este é um AGREGADO DE EXIBIÇÃO, não um índice fisiológico
 * validado na literatura. Ele combina duas grandezas que o backend já
 * calcula cientificamente:
 *   - posição do lnRMSSD de hoje em relação à baseline de 28 dias (z-score)
 *   - questionário de bem-estar (Hooper & Mackinnon, escala 1–5)
 * A classificação que governa a prescrição de treino continua sendo o
 * `status` retornado pelo trainingAgent — este número serve só para a UI.
 */
export function computeReadinessScore(
  lnToday: number | null,
  baselineMean: number | null,
  baselineSd: number | null,
  wellness: { sleep: number; fatigue: number; soreness: number; stress: number; readiness: number } | null,
): number {
  let hrvComponent = 50;
  if (lnToday != null && baselineMean != null && baselineMean > 0) {
    const sd = Math.max(baselineSd || 0.05, 0.05);
    const z = (lnToday - baselineMean) / sd;
    // z = +3 -> 100 ; z = 0 -> 50 ; z = -3 -> 0
    hrvComponent = clamp(50 + (50 / 3) * z, 0, 100);
  }

  if (!wellness) return Math.round(hrvComponent);

  // sono e prontidão: quanto maior melhor. fadiga, dor e estresse: invertidos.
  const positives = [wellness.sleep, wellness.readiness];
  const inverted = [wellness.fatigue, wellness.soreness, wellness.stress].map((v) => 6 - v);
  const raw = [...positives, ...inverted].reduce((a, b) => a + b, 0) / 5; // 1..5
  const wellnessComponent = clamp(((raw - 1) / 4) * 100, 0, 100);

  return Math.round(0.7 * hrvComponent + 0.3 * wellnessComponent);
}

export function toReadiness(hrvStatus: any): PhysiologicalReadiness {
  const measurement = hrvStatus?.measurement || null;
  const status = hrvStatus?.status || null;
  const suggestion = hrvStatus?.suggestion || null;
  const wellness = hrvStatus?.wellness || null;
  const metrics = suggestion?.metrics || null;

  const statusKey: string = status?.status || suggestion?.status || 'attention';
  const restingHR = measurement?.rhr_bpm ?? measurement?.hr_rest_bpm ?? 0;
  const rhrBaseline = metrics?.rhr_baseline_mean ?? null;

  const lnToday = metrics?.lnrmssd_today ?? status?.lnrmssd ?? null;
  const baselineMean = metrics?.lnrmssd_baseline_mean ?? status?.lnrmssd_7d_mean ?? null;
  const baselineSd = metrics?.lnrmssd_baseline_sd ?? status?.lnrmssd_7d_sd ?? null;

  // Percentual do lnRMSSD de hoje frente à baseline de 28 dias.
  const hrvPercentage =
    lnToday != null && baselineMean != null && baselineMean > 0
      ? Math.round((lnToday / baselineMean) * 100)
      : 0;

  return {
    score: computeReadinessScore(lnToday, baselineMean, baselineSd, wellness),
    label: STATUS_HEADLINE[statusKey] || 'AGUARDANDO MEDIÇÃO',
    advice:
      status?.explanation_text ||
      suggestion?.explanation_text ||
      'Realize a medição matinal de VFC para liberar a prescrição do dia.',
    restingHR: Math.round(restingHR),
    rhrDiff: rhrBaseline != null && restingHR ? Math.round(restingHR - rhrBaseline) : 0,
    hrvRmssd: measurement?.rmssd_ms ? Math.round(measurement.rmssd_ms) : 0,
    hrvStatus: HRV_STATUS_LABEL[statusKey] || 'Normal',
    hrvPercentage: clamp(hrvPercentage, 0, 999),
    timestamp: measurement?.timestamp || hrvStatus?.date || new Date().toISOString(),
  };
}

/** Prontidão exibida enquanto nenhuma medição do dia existe. */
export const EMPTY_READINESS: PhysiologicalReadiness = {
  score: 0,
  label: 'AGUARDANDO MEDIÇÃO',
  advice: 'Realize a medição matinal de VFC para liberar a prescrição do dia.',
  restingHR: 0,
  rhrDiff: 0,
  hrvRmssd: 0,
  hrvStatus: 'Normal',
  hrvPercentage: 0,
  timestamp: new Date().toISOString(),
};

/* ------------------------------------------------------------------ */
/* Perfil do atleta                                                    */
/* ------------------------------------------------------------------ */

const READINESS_TO_ATHLETE_STATUS: Record<string, AthleteProfile['status']> = {
  favorable: 'READY',
  attention: 'FATIGUED',
  recovery: 'RECOVERING',
};

const ATHLETE_STATUS_TEXT: Record<AthleteProfile['status'], string> = {
  READY: 'STATUS: READY',
  FATIGUED: 'STATUS: FATIGUED',
  RECOVERING: 'STATUS: RECOVERING',
  UNKNOWN: 'SEM MEDIÇÃO HOJE',
};

export interface AthleteSources {
  me: any;
  profile: any;
  hrvStatus: any;
  records: any;
  vo2max: any;
  stats7: any;
  statsAll: any;
  weeklyGoalKm: number;
}

export function toAthlete(src: AthleteSources): AthleteProfile {
  const { me, profile, hrvStatus, records, vo2max, stats7, statsAll, weeklyGoalKm } = src;

  // Sem medição do dia não há status autonômico: não é fadiga, é ausência de dado.
  const statusKey: string | null = hrvStatus?.measurement
    ? hrvStatus?.status?.status || hrvStatus?.suggestion?.status || 'attention'
    : null;
  const athleteStatus: AthleteProfile['status'] = statusKey
    ? READINESS_TO_ATHLETE_STATUS[statusKey] || 'FATIGUED'
    : 'UNKNOWN';
  const isPro = !!me?.is_pro;

  const zones = hrvStatus?.suggestion?.hr_zones || null;
  const thresholdPace = profile?.pace_5k
    ? `${profile.pace_5k}/km`
    : zones?.Z4?.pace
      ? String(zones.Z4.pace).split('–')[0].trim()
      : '—';

  const rec = records?.records || {};

  return {
    id: me?.id || 'me',
    name: me?.name || profile?.name || 'Atleta RUSH',
    handle: `@${me?.username || profile?.username || 'rush'}`,
    category: isPro ? 'PRO' : 'AGE-GROUP',
    avatarUrl: me?.avatar_url || profile?.avatar_url || APP_IMAGES.headerAvatar,
    status: athleteStatus,
    statusText: ATHLETE_STATUS_TEXT[athleteStatus],
    quote: me?.bio || profile?.bio || 'Treine mais forte quando seu corpo permitir.',
    vo2Max: vo2max?.vo2max ?? 0,
    restingHR: Math.round(
      hrvStatus?.measurement?.rhr_bpm ?? hrvStatus?.measurement?.hr_rest_bpm ?? profile?.hr_rest_tested ?? 0,
    ),
    thresholdPace,
    targetWeeklyKm: weeklyGoalKm,
    completedWeeklyKm: +(stats7?.stats?.total_distance_km ?? 0),
    totalKm: +(profile?.stats?.total_distance_km ?? statsAll?.stats?.total_distance_km ?? 0),
    totalWorkouts: profile?.stats?.activities ?? statsAll?.stats?.total_activities ?? 0,
    followers: profile?.stats?.followers ?? 0,
    following: profile?.stats?.following ?? 0,
    pr5k: rec['5k']?.formatted || '—',
    pr10k: rec['10k']?.formatted || '—',
    pr21k: rec['21k']?.formatted || '—',
    pr42k: rec['42k']?.formatted || '—',
  };
}

/* ------------------------------------------------------------------ */
/* Prescrição do treino do dia                                         */
/* ------------------------------------------------------------------ */

const SESSION_TYPE_LABEL: Record<string, { title: string; focus: string; intensity: string }> = {
  easy_run: { title: 'RODAGEM LEVE', focus: 'BASE AERÓBICA', intensity: 'MODERADA' },
  recovery: { title: 'RODAGEM REGENERATIVA', focus: 'RECUPERAÇÃO ATIVA', intensity: 'BAIXA' },
  long_run: { title: 'LONGÃO', focus: 'RESISTÊNCIA AERÓBICA', intensity: 'MODERADA' },
  tempo: { title: 'TEMPO RUN', focus: 'LIMIAR ANAERÓBICO', intensity: 'ALTA' },
  interval: { title: 'INTERVALADO', focus: 'POTÊNCIA AERÓBICA (VO₂)', intensity: 'MÁXIMA' },
  strength: { title: 'FORÇA', focus: 'ECONOMIA DE CORRIDA', intensity: 'MODERADA' },
  test: { title: 'TESTE DE CAMPO', focus: 'AVALIAÇÃO DE LIMIAR', intensity: 'MÁXIMA' },
  rest: { title: 'DESCANSO TOTAL', focus: 'SUPERCOMPENSAÇÃO', intensity: 'NULA' },
  other: { title: 'SESSÃO LIVRE', focus: 'CONDICIONAMENTO', intensity: 'MODERADA' },
};

const SESSION_TYPE_IMAGE: Record<string, string> = {
  interval: APP_IMAGES.workoutSprintTrack,
  test: APP_IMAGES.workoutSprintTrack,
  tempo: APP_IMAGES.marianaActionRunning,
  long_run: APP_IMAGES.marianaSunlight,
  easy_run: APP_IMAGES.marianaSunlight,
  recovery: APP_IMAGES.marianaSunlight,
};

function zoneRange(zones: any, zoneKey: string): string {
  const z = zones?.[zoneKey];
  if (!z) return '—';
  return `${z.minBpm}–${z.maxBpm} BPM`;
}

/**
 * Paces individualizados por zona.
 *
 * O agente de treino devolve apenas as faixas de FC (`hr_zones`); os paces
 * por zona só existem depois que o atleta roda um teste de campo, que grava
 * `user_profiles.custom_zones_json`. Sem teste, não há pace para exibir e a
 * tela mostra "—" em vez de estimar um valor.
 */
export function parseCustomZonePaces(profile: any): Record<string, string> | null {
  if (!profile?.custom_zones_json) return null;
  try {
    const parsed = typeof profile.custom_zones_json === 'string'
      ? JSON.parse(profile.custom_zones_json)
      : profile.custom_zones_json;
    const out: Record<string, string> = {};
    for (const key of Object.keys(parsed || {})) {
      if (parsed[key]?.pace) out[key] = parsed[key].pace;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

/**
 * Deriva os blocos da sessão (aquecimento / principal / desaquecimento).
 * O backend prescreve volume, duração e zona; o detalhamento em blocos é
 * uma estruturação de apresentação padrão para cada tipo de sessão.
 */
function buildSteps(session: any, zones: any, zonePaces: Record<string, string> | null): WorkoutStep[] {
  const type = session?.type || 'easy_run';
  const totalMin = session?.duration_min || 45;
  const totalKm = session?.distance_km || 0;
  const mainZone = session?.target_hr_zone || 'Z2';

  if (type === 'rest') {
    return [
      {
        id: 'rest-1',
        title: 'Descanso completo',
        durationOrDistance: 'Dia inteiro',
        targetPace: '—',
        targetZone: '—',
        hrRange: '—',
        description:
          'Nenhuma sessão prescrita. Priorize sono, hidratação e alimentação para consolidar as adaptações.',
      },
    ];
  }

  const warmMin = Math.max(8, Math.round(totalMin * 0.18));
  const coolMin = Math.max(5, Math.round(totalMin * 0.12));
  const mainMin = Math.max(5, totalMin - warmMin - coolMin);

  const steps: WorkoutStep[] = [
    {
      id: 'warmup',
      title: 'Aquecimento progressivo',
      durationOrDistance: `${warmMin} min`,
      targetPace: zonePaces?.Z1 || '—',
      targetZone: 'Z1',
      hrRange: zoneRange(zones, 'Z1'),
      description: 'Trote leve com aumento gradual de cadência. Inclua educativos e mobilidade de tornozelo/quadril.',
    },
    {
      id: 'main',
      title: SESSION_TYPE_LABEL[type]?.title || 'Parte principal',
      durationOrDistance: totalKm ? `${mainMin} min • ${totalKm} km` : `${mainMin} min`,
      targetPace: session?.target_pace || zonePaces?.[mainZone] || '—',
      targetZone: mainZone,
      hrRange: zoneRange(zones, mainZone),
      description: session?.description || 'Mantenha o esforço dentro da faixa prescrita e monitore a frequência cardíaca.',
    },
    {
      id: 'cooldown',
      title: 'Desaquecimento',
      durationOrDistance: `${coolMin} min`,
      targetPace: zonePaces?.Z1 || '—',
      targetZone: 'Z1',
      hrRange: zoneRange(zones, 'Z1'),
      description: 'Trote muito leve seguido de caminhada. Alongamento estático opcional após a normalização da FC.',
    },
  ];

  return steps;
}

export function toWorkout(plan: any, hrvStatus: any, profile?: any): WorkoutPrescription {
  const suggestion = hrvStatus?.suggestion || null;
  // A sessão exibida é sempre a ADAPTADA pelo agente quando existe medição
  // do dia; sem medição, cai para a sessão planejada crua.
  const session = suggestion?.adjusted_session || plan?.today_session || null;
  const zones = suggestion?.hr_zones || null;
  const zonePaces = parseCustomZonePaces(profile);

  const type: string = session?.type || (plan?.has_plan ? 'easy_run' : 'rest');
  const meta = SESSION_TYPE_LABEL[type] || SESSION_TYPE_LABEL.other;
  const mainZone = session?.target_hr_zone || 'Z2';
  const zoneMeta = zones?.[mainZone];

  // "(ADAPTADO)" só quando a sessão realmente mudou frente ao planejado.
  // O agente pode devolver action != 'maintain' e ainda assim manter a
  // sessão (um dia de descanso, por exemplo, continua sendo descanso).
  const planned = plan?.today_session || null;
  const adapted =
    !!suggestion &&
    !!planned &&
    (planned.type !== session?.type ||
      planned.distance_km !== session?.distance_km ||
      planned.duration_min !== session?.duration_min ||
      planned.target_hr_zone !== session?.target_hr_zone);

  return {
    id: plan?.today_session?.id || `session-${type}`,
    title: adapted ? `${meta.title} (ADAPTADO)` : meta.title,
    focus: meta.focus,
    imageUrl: SESSION_TYPE_IMAGE[type] || APP_IMAGES.marianaActionRunning,
    targetPace: session?.target_pace || zonePaces?.[mainZone] || '—',
    durationMinutes: session?.duration_min || 0,
    distanceKm: session?.distance_km || 0,
    zone: `INTENSIDADE: ${mainZone}${zoneMeta?.name ? ` (${zoneMeta.name.toUpperCase()})` : ''}`,
    hrRange: zoneMeta ? `${zoneMeta.minBpm}–${zoneMeta.maxBpm} BPM` : '—',
    intensityLabel: meta.intensity,
    steps: buildSteps(session, zones, zonePaces),
    isRestDay: type === 'rest',
    coachingNotes:
      suggestion?.explanation_text ||
      session?.description ||
      'Nenhuma medição de VFC hoje: a prescrição ainda não foi adaptada ao seu estado autonômico.',
  };
}

/* ------------------------------------------------------------------ */
/* Semana de treino                                                    */
/* ------------------------------------------------------------------ */

const DAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

/**
 * Constrói a régua semanal combinando o volume PLANEJADO (training_sessions)
 * com o volume REALIZADO (activities da semana corrente).
 */
export function toWeeklySchedule(plan: any, weekActivities: any[]): DailyMileage[] {
  const today = new Date();
  const isoToday = today.getDay() || 7; // 1=segunda ... 7=domingo

  // Segunda-feira da semana corrente
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - (isoToday - 1));

  const plannedByDay = new Map<number, number>();
  for (const session of plan?.week_sessions || []) {
    plannedByDay.set(session.day_of_week, (plannedByDay.get(session.day_of_week) || 0) + (session.distance_km || 0));
  }

  const doneByDay = new Map<number, number>();
  for (const act of weekActivities || []) {
    const d = new Date(act.date);
    if (isNaN(d.getTime()) || d < monday) continue;
    const dow = d.getDay() || 7;
    doneByDay.set(dow, (doneByDay.get(dow) || 0) + (act.distance_km || 0));
  }

  return DAY_LABELS.map((label, index) => {
    const dow = index + 1;
    const done = doneByDay.get(dow) || 0;
    const planned = plannedByDay.get(dow) || 0;
    return {
      day: label,
      dayShort: label.charAt(0),
      km: +(done || planned).toFixed(1),
      isToday: dow === isoToday,
      completed: done > 0,
    };
  });
}

/**
 * Resumo da semana corrente: volume realizado, meta planejada, pace médio
 * e gasto energético. Quando o plano não define sessões para a semana,
 * `targetKm` fica 0 e `progressPercent` fica null — a tela então mostra
 * "sem meta" em vez de fingir 100% de conclusão.
 */
export function toWeeklySummary(plan: any, stats7: any, weekActivities: any[]): WeeklySummary {
  const targetKm = +(plan?.week_sessions || [])
    .reduce((sum: number, sess: any) => sum + (sess.distance_km || 0), 0)
    .toFixed(1);

  const completedKm = +(stats7?.stats?.total_distance_km ?? 0);
  const totalSeconds = stats7?.stats?.total_duration_seconds ?? 0;

  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() || 7) - 1));

  const thisWeek = (weekActivities || []).filter((a) => {
    const d = new Date(a.date);
    return !isNaN(d.getTime()) && d >= monday;
  });

  const caloriesKcal = thisWeek.reduce(
    (sum: number, a: any) => (a.calories ? sum + a.calories : sum),
    0,
  );

  return {
    completedKm,
    targetKm,
    progressPercent: targetKm > 0 ? Math.min(100, Math.round((completedKm / targetKm) * 100)) : null,
    avgPace: completedKm > 0 ? `${formatPace(totalSeconds / completedKm)}/km` : '—',
    caloriesKcal: caloriesKcal > 0 ? caloriesKcal : null,
    activityCount: stats7?.stats?.total_activities ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* Próximas sessões da semana                                          */
/* ------------------------------------------------------------------ */

const SESSION_CATEGORY: Record<string, WorkoutCategory> = {
  interval: 'VO2 MÁX',
  test: 'VO2 MÁX',
  tempo: 'LIMIAR',
  long_run: 'ENDURANCE',
  easy_run: 'ENDURANCE',
  recovery: 'REGENERATIVO',
  rest: 'REGENERATIVO',
  strength: 'OUTRO',
  other: 'OUTRO',
};

const SESSION_BADGE: Record<string, string> = {
  interval: 'VELOCIDADE',
  test: 'TESTE',
  tempo: 'RESISTÊNCIA',
  long_run: 'ENDURANCE',
  easy_run: 'BASE',
  recovery: 'BIO-RECOVERY',
  rest: 'DESCANSO',
  strength: 'FORÇA',
  other: 'LIVRE',
};

const WEEKDAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function dayLabelFor(dayOfWeek: number, todayDow: number): string {
  if (dayOfWeek === todayDow) return 'Hoje';
  if (dayOfWeek === todayDow + 1) return 'Amanhã';
  return WEEKDAY_NAMES[dayOfWeek - 1] || '—';
}

/**
 * Sessões restantes da semana corrente do plano ativo, já formatadas.
 * Só entram os dias ainda por vir — o treino de hoje aparece no card
 * principal da tela, não nesta lista.
 */
export function toUpcomingSessions(plan: any, profile?: any): UpcomingSession[] {
  const todayDow = new Date().getDay() || 7;
  const zonePaces = parseCustomZonePaces(profile);

  return (plan?.week_sessions || [])
    .filter((sess: any) => sess.day_of_week > todayDow)
    .sort((a: any, b: any) => a.day_of_week - b.day_of_week)
    .map((sess: any) => {
      const type = sess.type || 'other';
      const meta = SESSION_TYPE_LABEL[type] || SESSION_TYPE_LABEL.other;
      const zone = sess.target_hr_zone || 'Z2';

      return {
        id: sess.id,
        title: sess.description ? String(sess.description).toUpperCase() : meta.title,
        category: SESSION_CATEGORY[type] || 'OUTRO',
        badge: SESSION_BADGE[type] || 'LIVRE',
        dayLabel: dayLabelFor(sess.day_of_week, todayDow),
        dayOfWeek: sess.day_of_week,
        distance: sess.distance_km ? `${sess.distance_km} km` : '—',
        duration: sess.duration_min ? `${sess.duration_min} min` : '—',
        targetPace: sess.target_pace || zonePaces?.[zone] || '—',
        zone: `Zona ${zone.replace(/^Z/i, '')}`,
        isRest: type === 'rest',
      };
    });
}

/* ------------------------------------------------------------------ */
/* Feed social                                                         */
/* ------------------------------------------------------------------ */

const HR_STATUS_BADGE: Record<string, string> = {
  favorable: 'VFC FAVORÁVEL',
  attention: 'VFC EM ATENÇÃO',
  recovery: 'VFC EM RECUPERAÇÃO',
};

export function toFeedPost(activity: any, currentUserId?: string): FeedPost {
  const distance = activity.distance_km || 0;
  const duration = activity.duration_seconds || 0;

  return {
    id: activity.id,
    authorName: activity.name || 'Atleta RUSH',
    authorHandle: `@${activity.username || 'rush'}`,
    authorAvatar: activity.avatar_url || APP_IMAGES.headerAvatar,
    isPro: false,
    isVerified: activity.user_id === currentUserId,
    location: activity.description || '',
    timeAgo: timeAgo(activity.date),
    caption: activity.feeling_notes || activity.description || activity.title || '',
    activityPhoto: activity.image_url || undefined,
    workoutTitle: activity.title || undefined,
    distanceKm: +distance.toFixed(2),
    duration: formatDuration(duration),
    avgPace: activity.avg_pace || `${paceFromActivity(distance, duration)}/km`,
    avgHr: activity.avg_hr || undefined,
    effortScore: activity.rpe_score || activity.rpe || undefined,
    kudosCount: activity.likes_count ?? 0,
    commentsCount: activity.comments_count ?? 0,
    isKudoed: !!activity.has_liked,
    badgeText: activity.hrv_status_display ? HR_STATUS_BADGE[activity.hrv_status_display] : undefined,
  };
}

export function toFeedPosts(feed: any[], currentUserId?: string): FeedPost[] {
  return (feed || []).map((a) => toFeedPost(a, currentUserId));
}

/* ------------------------------------------------------------------ */
/* Calçados                                                            */
/* ------------------------------------------------------------------ */

const SHOE_FALLBACK_IMAGES = [
  APP_IMAGES.shoeAlphafly,
  APP_IMAGES.shoeSuperblast,
  APP_IMAGES.shoeEndorphin,
  APP_IMAGES.wornShoeAsics,
];

export function toShoe(raw: any, index = 0): RunningShoe {
  return {
    id: raw.id,
    name: raw.name,
    modelType: raw.modelType || 'Rodagem Geral',
    imageUrl: raw.imageUrl || SHOE_FALLBACK_IMAGES[index % SHOE_FALLBACK_IMAGES.length],
    currentKm: raw.currentKm,
    maxKm: raw.maxKm,
    status: raw.status,
    statusLabel: raw.statusLabel,
    foamDegradationPct: raw.foamDegradationPct,
    isDefault: raw.isDefault,
    colorway: raw.colorway || '',
    plateTechnology: raw.plateTechnology || '',
    avgPace: raw.avgPace || '—',
    sessionsCount: raw.sessionsCount || 0,
  };
}
