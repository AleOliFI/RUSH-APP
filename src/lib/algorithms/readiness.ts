import type { ReadinessColor, ReadinessState, TrainingDirective } from '../../types/readiness';

export const READINESS_COLOR_HEX: Record<ReadinessColor, string> = {
  green: '#22C55E',
  orange: '#F97316',
  red: '#EF4444',
  gray: '#525252',
};

export const DIRECTIVE_LABEL: Record<TrainingDirective, string> = {
  high_intensity: 'Alta Intensidade',
  moderate: 'Moderado',
  regenerative: 'Regenerativo',
  rest: 'Repouso Total',
  calibrating: 'Calibrando',
};

/**
 * Detect metabolic downregulation pattern in male athletes.
 * Returns [flagActive, penaltyFactor].
 * When flagged: score is multiplied by (1 - 0.45) = 0.55.
 */
export function detectMaleDownregulation(
  sVfcDaily: number,
  baseline28: number,
  rhrDaily: number,
  eWb: number,
): [boolean, number] {
  const isFlag = sVfcDaily >= baseline28 && rhrDaily <= 45 && eWb < 50;
  return [isFlag, isFlag ? 0.55 : 1.0];
}

/**
 * Estimate T:C (testosterone:cortisol) catabolic imbalance from VFC trend + TRIMP.
 * Returns true when HIIT should be blocked.
 */
export function estimateCatabolicFactor(
  last5DaysSVFC: number[],
  trimpLast3Days: number,
): boolean {
  if (last5DaysSVFC.length < 3) return false;
  const relevant = last5DaysSVFC.slice(-5);
  let consecutiveDrops = 0;
  for (let i = 1; i < relevant.length; i++) {
    if (relevant[i] < relevant[i - 1]) {
      consecutiveDrops++;
    } else {
      consecutiveDrops = 0;
    }
  }
  return consecutiveDrops >= 3 && trimpLast3Days >= 200;
}

function resolveZone(score: number): 'green' | 'orange' | 'red' {
  if (score >= 70) return 'green';
  if (score >= 40) return 'orange';
  return 'red';
}

function prescriptionForZone(zone: 'green' | 'orange' | 'red'): {
  directive: TrainingDirective;
  title: string;
  description: string;
  example_session: string;
} {
  switch (zone) {
    case 'green':
      return {
        directive: 'high_intensity',
        title: 'Pronto para Alta Intensidade',
        description:
          'Seu sistema nervoso autônomo está em excelente estado. Seu corpo absorve bem o estresse do treino hoje.',
        example_session:
          '15 min aquecimento. 4 × 1.000m no limiar anaeróbico (esforço 8/10) com 90s recuperação ativa. 10 min desaquecimento.',
      };
    case 'orange':
      return {
        directive: 'moderate',
        title: 'Treino Moderado',
        description:
          'Seus marcadores estão estáveis. Um treino em Zona 2 hoje consolida seu condicionamento sem comprometer a recuperação.',
        example_session:
          '35–45 min de corrida contínua em Zona 2 (esforço 5/10, ritmo conversacional).',
      };
    case 'red':
      return {
        directive: 'rest',
        title: 'Repouso Ativo',
        description:
          'Seu sistema simpático está dominante. Forçar intensidade hoje aumenta o risco de lesão e aprofunda a fadiga.',
        example_session:
          'Repouso de impacto. 10 min de respiração guiada (Coerência Cardíaca: 6 ciclos/min, 5s inspiração, 5s expiração).',
      };
  }
}

export interface ReadinessInput {
  sVfc: number;
  sFcr: number;
  eWb: number;
  readingCount: number;
  /** Pass penaltyFactor from detectMaleDownregulation (default 1.0) */
  penaltyFactor?: number;
  /** Pass true when estimateCatabolicFactor returns true */
  catabolicFlag?: boolean;
  /** Set true when score was penalised by downregulation detection */
  falseReadinessFlag?: boolean;
}

/**
 * V2 Weighted 3-dimensional readiness engine.
 * E_Prontidão = 0.50 × S_VFC_adj + 0.20 × S_FCR + 0.30 × E_WB
 */
export function evaluateReadiness(input: ReadinessInput): ReadinessState {
  const {
    sVfc,
    sFcr,
    eWb,
    readingCount,
    penaltyFactor = 1.0,
    catabolicFlag = false,
    falseReadinessFlag = false,
  } = input;

  if (readingCount < 7) {
    return {
      color: 'gray',
      score: 0,
      directive: 'calibrating',
      title: 'Calibrando Baseline',
      description:
        'Continue medindo diariamente. Precisamos de 7+ leituras para calcular sua baseline pessoal de VFC.',
      example_session: 'Mantenha seu treino habitual durante a calibração.',
    };
  }

  const rawScore = 0.5 * sVfc + 0.2 * sFcr + 0.3 * eWb;
  const score = Math.round(Math.min(100, Math.max(0, rawScore * penaltyFactor)));

  // Block HIIT when catabolic factor is active — cap zone at orange
  const zone = resolveZone(score);
  const effectiveZone: 'green' | 'orange' | 'red' =
    catabolicFlag && zone === 'green' ? 'orange' : zone;

  const colorMap: Record<'green' | 'orange' | 'red', ReadinessColor> = {
    green: 'green',
    orange: 'orange',
    red: 'red',
  };

  const prescription = prescriptionForZone(effectiveZone);

  return {
    color: colorMap[effectiveZone],
    score,
    directive: prescription.directive,
    title: prescription.title,
    description: prescription.description,
    example_session: prescription.example_session,
    falseReadinessFlag,
    catabolicFlag,
  };
}
