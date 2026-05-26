import type { HRVStatus, RHRStatus, WellbeingStatus } from '../../types/hrv';
import type { ReadinessColor, ReadinessState, TrainingDirective } from '../../types/readiness';

interface MatrixEntry {
  state: 1 | 2 | 3 | 4 | 5;
  color: ReadinessColor;
  scoreBase: number;
  directive: TrainingDirective;
  title: string;
  description: string;
  example_session: string;
}

/**
 * The 5-state Prescription Matrix from the product specification.
 * Inputs: HRV status × RHR status × Well-being status
 */
function resolveMatrixEntry(
  hrv: HRVStatus,
  rhr: RHRStatus,
  wb: WellbeingStatus,
): MatrixEntry {
  // State 1 — Green: Peak readiness, high-intensity training
  if (hrv === 'elevated' && rhr !== 'elevated' && (wb === 'excellent' || wb === 'good')) {
    return {
      state: 1,
      color: 'green',
      scoreBase: 90,
      directive: 'high_intensity',
      title: 'Pronto para Alta Intensidade',
      description:
        'Seu sistema nervoso autônomo está em excelente estado. Seu corpo absorve bem o estresse do treino hoje.',
      example_session: '6-8x 1000m no limiar de lactato com 90s de recuperação ativa',
    };
  }

  // State 2 — Yellow: Anomaly (elevated VFC + elevated RHR + poor well-being = protective parasympathetic)
  if (hrv === 'elevated' && rhr === 'elevated' && (wb === 'poor' || wb === 'very_poor')) {
    return {
      state: 2,
      color: 'yellow',
      scoreBase: 55,
      directive: 'regenerative',
      title: 'Atenção: Hiperatividade Parassimpática',
      description:
        'VFC elevada com FC de repouso alta é um sinal de alerta. Seu corpo pode estar em fase de sobreachoque não-funcional.',
      example_session: '30-40 min de corrida leve em Z1/Z2 ou caminhada',
    };
  }

  // State 3 — Orange: Baseline equilibrium, moderate training
  if (hrv === 'baseline' && rhr === 'normal' && (wb === 'excellent' || wb === 'good')) {
    return {
      state: 3,
      color: 'orange',
      scoreBase: 70,
      directive: 'moderate',
      title: 'Equilíbrio Autonômico',
      description:
        'Seus marcadores estão estáveis. Um treino moderado vai consolidar seu condicionamento sem comprometer a recuperação.',
      example_session: '8-10 km em ritmo tempo (Z3)',
    };
  }

  // State 4 — Red: Below baseline, reduce load
  if (hrv === 'below_baseline' || (hrv === 'baseline' && (wb === 'poor' || wb === 'very_poor'))) {
    return {
      state: 4,
      color: 'red',
      scoreBase: 35,
      directive: 'regenerative',
      title: 'Reduza a Carga',
      description:
        'Seu sistema simpático está dominante. Forçar um treino intenso hoje aumenta o risco de lesão e aprofunda a fadiga.',
      example_session: '25 min de corrida leve ou caminhada de transição',
    };
  }

  // State 5 — Dark Red: Chronic low trend, mandatory rest
  if (hrv === 'low_trend') {
    return {
      state: 5,
      color: 'dark_red',
      scoreBase: 10,
      directive: 'rest',
      title: 'Repouso Obrigatório',
      description:
        'Tendência crônica de VFC baixa detectada. Alto risco de sobreachoque não-funcional ou início de EAC. Repouso completo é a prescrição médica.',
      example_session: 'Sem impacto. Hidratação, sono e técnicas de relaxamento.',
    };
  }

  // Default: moderate when ambiguous
  return {
    state: 3,
    color: 'orange',
    scoreBase: 65,
    directive: 'moderate',
    title: 'Treino Moderado',
    description: 'Mantenha o volume habitual. Evite intensidades acima do limiar hoje.',
    example_session: '8 km em ritmo confortável (Z2/Z3)',
  };
}

function calculateScore(entry: MatrixEntry, wb: WellbeingStatus): number {
  const wbBonus: Record<WellbeingStatus, number> = {
    excellent: 8,
    good: 3,
    poor: -5,
    very_poor: -10,
  };
  return Math.min(100, Math.max(0, entry.scoreBase + wbBonus[wb]));
}

export function evaluateReadiness(
  hrv: HRVStatus,
  rhr: RHRStatus,
  wb: WellbeingStatus,
): ReadinessState {
  if (hrv === 'calibrating') {
    return {
      state: 3,
      color: 'gray',
      score: 0,
      directive: 'calibrating',
      title: 'Calibrando Baseline',
      description:
        'Continue medindo diariamente. Precisamos de 7+ leituras para calcular sua baseline pessoal de VFC.',
      example_session: 'Mantenha seu treino habitual durante a calibração.',
    };
  }

  const entry = resolveMatrixEntry(hrv, rhr, wb);
  return {
    state: entry.state,
    color: entry.color,
    score: calculateScore(entry, wb),
    directive: entry.directive,
    title: entry.title,
    description: entry.description,
    example_session: entry.example_session,
  };
}

export const READINESS_COLOR_HEX: Record<ReadinessColor, string> = {
  green: '#22C55E',
  yellow: '#EAB308',
  orange: '#F97316',
  red: '#EF4444',
  dark_red: '#991B1B',
  gray: '#525252',
};

export const DIRECTIVE_LABEL: Record<TrainingDirective, string> = {
  high_intensity: 'Alta Intensidade',
  moderate: 'Moderado',
  regenerative: 'Regenerativo',
  rest: 'Repouso Total',
  calibrating: 'Calibrando',
};
