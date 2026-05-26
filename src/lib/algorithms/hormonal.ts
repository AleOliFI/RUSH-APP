import type { CyclePhase, HormonalProfile } from '../../types/hrv';
import type { TrainingDirective } from '../../types/readiness';

/**
 * Estimate the menstrual cycle phase from the day of the cycle.
 * Day 1 = first day of menstruation.
 */
export function estimateCyclePhase(dayOfCycle: number): CyclePhase {
  if (dayOfCycle < 1) return 'unknown';
  if (dayOfCycle <= 5) return 'menstrual';
  if (dayOfCycle <= 14) return 'follicular';
  if (dayOfCycle <= 28) return 'luteal';
  return 'unknown';
}

/**
 * Apply luteal-phase RMSSD correction (×1.15) to prevent false fatigue alerts
 * caused by the natural 10–30% HRV drop during the luteal phase.
 */
export function applyLutealCorrection(rmssd: number, phase: CyclePhase): number {
  return phase === 'luteal' ? rmssd * 1.15 : rmssd;
}

export interface FemininePrescription {
  directive: TrainingDirective;
  session: string;
  alert?: string;
}

/**
 * Returns a training prescription adapted to the user's hormonal profile and
 * current cycle phase, per the clinical protocols in the PDF specification.
 */
export function getPrescriptionFeminine(
  zone: 'green' | 'orange' | 'red',
  profile: HormonalProfile,
  phase: CyclePhase,
): FemininePrescription {
  if (zone === 'red') {
    return {
      directive: 'rest',
      session:
        'Repouso de impacto. 10 min de respiração guiada (Coerência Cardíaca: 6 ciclos/min, 5s inspiração, 5s expiração).',
    };
  }

  if (profile === 'sop') {
    if (zone === 'green') {
      return {
        directive: 'high_intensity',
        session: '6 × 3 min a 90–95% FCmáx com 3 min de recuperação ativa. Priorizar HIIT para sensibilidade à insulina.',
        alert: 'Fase SOP: HIIT recomendado para regulação insulínica.',
      };
    }
    return {
      directive: 'moderate',
      session: '40 min de corrida contínua em Zona 2 (esforço 5/10, ritmo conversacional). MICT para equilíbrio hormonal.',
    };
  }

  if (profile === 'ahf_reds') {
    if (zone === 'green') {
      return {
        directive: 'moderate',
        session: '35–45 min de corrida leve em Zona 2 (esforço 4–5/10). Mantenha ingestão de carboidratos ≥ 3 g/kg antes do treino.',
        alert: 'Perfil AHF/RED-S: evitar alta intensidade. Garantir balanço energético positivo.',
      };
    }
    return {
      directive: 'regenerative',
      session: '30–40 min de Power Walking com inclinação 6–8%. Sem impacto articular. Priorize recuperação energética.',
      alert: 'Perfil AHF/RED-S: impacto reduzido obrigatório.',
    };
  }

  // Regular profile
  if (zone === 'green') {
    const isLuteal = phase === 'luteal';
    return {
      directive: 'high_intensity',
      session: isLuteal
        ? '15 min aquecimento. 3 × 1.000m no limiar anaeróbico (esforço 7–8/10) com 90s recuperação ativa. 10 min desaquecimento. (Intensidade levemente reduzida para fase lútea.)'
        : '15 min aquecimento. 4 × 1.000m no limiar anaeróbico (esforço 8/10) com 90s recuperação ativa. 10 min desaquecimento.',
    };
  }

  return {
    directive: 'moderate',
    session: '35–45 min de corrida contínua em Zona 2 (esforço 5/10, ritmo conversacional).',
  };
}
