export type TabType = 'inicio' | 'medicao' | 'treinos' | 'feed' | 'premium-pro' | 'perfil';

export interface AthleteProfile {
  id: string;
  name: string;
  handle: string;
  category: 'PRO' | 'ELITE' | 'AGE-GROUP';
  avatarUrl: string;
  status: 'READY' | 'FATIGUED' | 'RECOVERING';
  statusText: string;
  quote: string;
  vo2Max: number;
  restingHR: number;
  thresholdPace: string;
  targetWeeklyKm: number;
  completedWeeklyKm: number;
  totalKm: number;
  totalWorkouts: number;
  followers: number;
  following: number;
  pr5k: string;
  pr10k: string;
  pr21k: string;
  pr42k: string;
}

export interface RunningShoe {
  id: string;
  name: string;
  modelType: string;
  imageUrl: string;
  currentKm: number;
  maxKm: number;
  status: 'OPTIMAL' | 'WARNING' | 'CRITICAL' | 'NEW' | 'RETIRED';
  statusLabel: string;
  foamDegradationPct: number;
  isDefault: boolean;
  colorway: string;
  plateTechnology: string;
  avgPace: string;
  sessionsCount: number;
}

export interface FeedPost {
  id: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  isPro: boolean;
  isVerified: boolean;
  categoryTag?: string;
  location: string;
  timeAgo: string;
  caption: string;
  activityPhoto?: string;
  workoutTitle?: string;
  distanceKm?: number;
  duration?: string;
  avgPace?: string;
  avgHr?: number;
  effortScore?: number;
  kudosCount: number;
  commentsCount: number;
  isKudoed?: boolean;
  hrZones?: { z1z2: number; z3: number; z4: number; z5: number };
  badgeText?: string;
  badgeDiff?: string;
  sensorBadge?: string;
}

export interface ActivityComment {
  id: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  isCoach?: boolean;
  badge?: string;
  timeAgo: string;
  text: string;
  kudosCount: number;
  tag?: string;
}

export interface PhysiologicalReadiness {
  score: number; // 0-100 (e.g. 88)
  label: string; // 'RECUPERAÇÃO ÓTIMA'
  advice: string;
  restingHR: number; // 46 bpm
  rhrDiff: number; // -3 bpm
  hrvRmssd: number; // 68 ms
  hrvStatus: 'Excelente' | 'Normal' | 'Baixo';
  hrvPercentage: number; // 98%
  timestamp: string;
}

export interface WorkoutStep {
  id: string;
  title: string;
  durationOrDistance: string;
  targetPace: string;
  targetZone: string;
  hrRange: string;
  description: string;
}

export interface WorkoutPrescription {
  id: string;
  title: string;
  focus: string;
  imageUrl: string;
  targetPace: string;
  durationMinutes: number;
  distanceKm: number;
  zone: string;
  hrRange: string;
  intensityLabel: string;
  steps: WorkoutStep[];
  coachingNotes: string;
}

export interface DailyMileage {
  day: string; // 'SEG', 'TER', ...
  dayShort: string;
  km: number;
  isToday: boolean;
  completed: boolean;
}

export interface SubjectiveFeedback {
  sleepQuality: number; // 1-5 (maior = melhor)
  fatigueLevel: number; // 1-5 (maior = mais fadiga)
  muscleSoreness: number; // 1-5 (maior = mais dor)
  stressLevel: number; // 1-5 (maior = mais estresse)
  energyLevel: number; // 1-5 (maior = melhor disposicao)
}

export interface WeeklySummary {
  completedKm: number;
  /** Volume planejado para a semana. 0 quando o plano não define sessões. */
  targetKm: number;
  /** Percentual concluído, ou null quando não há meta definida. */
  progressPercent: number | null;
  avgPace: string;
  caloriesKcal: number | null;
  activityCount: number;
}

export interface ImageViewerItem {
  url: string;
  title: string;
  subtitle?: string;
  category?: string;
  filename?: string;
  description?: string;
}
