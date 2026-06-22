export type Behavior =
  | 'alcohol'
  | 'late_dinner'
  | 'high_stress'
  | 'travel'
  | 'extra_caffeine'
  | 'poor_sleep'
  | 'intense_training';

export interface BehaviorOption {
  key: Behavior;
  label: string;
  emoji: string;
}

export const BEHAVIOR_OPTIONS: BehaviorOption[] = [
  { key: 'alcohol',          label: 'Álcool',          emoji: '🍺' },
  { key: 'late_dinner',      label: 'Jantar tardio',   emoji: '🌙' },
  { key: 'high_stress',      label: 'Estresse alto',   emoji: '😤' },
  { key: 'travel',           label: 'Viagem',          emoji: '✈️' },
  { key: 'extra_caffeine',   label: 'Cafeína extra',   emoji: '☕' },
  { key: 'poor_sleep',       label: 'Pouco sono',      emoji: '😴' },
  { key: 'intense_training', label: 'Treino intenso',  emoji: '🏋️' },
];

export interface BehaviorImpact {
  behavior: Behavior;
  label: string;
  emoji: string;
  avgDelta: number;   // average S_VFC change next day (negative = disruptor)
  sampleCount: number;
}

interface BehaviorLog {
  log_date: string;
  behaviors: string[];
}

interface Assessment {
  assessed_at: string;
  s_vfc: number | null;
}

/**
 * For each logged behavior, calculate the average next-day S_VFC delta
 * relative to the user's historical mean.
 */
export function calculateBehaviorCorrelations(
  logs: BehaviorLog[],
  assessments: Assessment[],
  mu28SVC: number,
): BehaviorImpact[] {
  if (logs.length < 3 || assessments.length < 3 || mu28SVC === 0) return [];

  const assessmentMap = new Map<string, number>();
  for (const a of assessments) {
    if (a.s_vfc != null) assessmentMap.set(a.assessed_at, a.s_vfc);
  }

  const deltas: Record<string, number[]> = {};

  for (const log of logs) {
    if (!log.behaviors?.length) continue;

    // Find next-day assessment
    const nextDate = new Date(log.log_date);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().split('T')[0];
    const nextSVC = assessmentMap.get(nextDateStr);

    if (nextSVC == null) continue;
    const delta = nextSVC - mu28SVC;

    for (const b of log.behaviors) {
      if (!deltas[b]) deltas[b] = [];
      deltas[b].push(delta);
    }
  }

  return BEHAVIOR_OPTIONS
    .filter((opt) => (deltas[opt.key]?.length ?? 0) >= 2)
    .map((opt) => {
      const vals = deltas[opt.key];
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      return {
        behavior: opt.key,
        label: opt.label,
        emoji: opt.emoji,
        avgDelta: Math.round(avg * 10) / 10,
        sampleCount: vals.length,
      };
    })
    .sort((a, b) => a.avgDelta - b.avgDelta); // worst disruptors first
}
