// ============================================================
// RUSH PERFORMANCE — Recovery Protocol Module
//
// Protocolo de recuperação escalonado baseado em:
// - Petersen et al. (2021): crioterapia inibe adaptações em fase de base
// - Mujika & Padilla (2000, 2003): taper — volume -40-60%, intensidade 100%
// - Grgic et al. (2021): foam rolling — benefício neurológico (DOMS)
// - Knufinke et al. (2018): sono ≥7h geral, ≥8h em carga pesada
// - Coyle & González-Alonso (2001): deriva cardíaca e termorregulação
// ============================================================

const OVERREACHING_THRESHOLD = 5;
const OVERTRAINING_THRESHOLD = 10;

const RECOVERY_LEVELS = {
  1: { level: 1, label: 'Leve', description: 'Reduzir intensidade — treino leve Z1/Z2' },
  2: { level: 2, label: 'Moderado', description: 'Descanso ativo — caminhada ou mobilidade' },
  3: { level: 3, label: 'Severo', description: 'Descanso passivo completo recomendado' },
  4: { level: 4, label: 'Overreaching', description: '⚠️ Sinal de sobrecarga acumulada — consulte seu treinador' },
};

/**
 * Retorna o nível de recuperação baseado em dias consecutivos com VFC baixa.
 * @param {number} consecutiveLowDays
 * @returns {{level: number, label: string, description: string}}
 */
function getRecoveryLevel(consecutiveLowDays) {
  const days = typeof consecutiveLowDays === 'number' ? Math.max(0, consecutiveLowDays) : 0;
  if (days >= OVERREACHING_THRESHOLD) return RECOVERY_LEVELS[4];
  if (days >= 3) return RECOVERY_LEVELS[3];
  if (days >= 2) return RECOVERY_LEVELS[2];
  return RECOVERY_LEVELS[1];
}

/**
 * Constrói a sessão de recuperação adequada ao nível.
 * Nível 1: rodagem leve Z1/Z2 (20-30 min)
 * Nível 2: descanso ativo (caminhada/mobilidade)
 * Nível 3+: descanso passivo completo
 * @param {number} level
 * @param {Object} plannedSession
 * @returns {Object}
 */
function buildRecoverySession(level, plannedSession) {
  if (level >= 3) {
    return {
      type: 'rest',
      distance_km: 0,
      duration_min: 0,
      target_hr_zone: null,
      description: level >= 4
        ? '⚠️ Descanso obrigatório — sinais de overreaching detectados. Priorize sono e nutrição.'
        : 'Descanso passivo completo. Seu sistema nervoso precisa se recuperar.',
      recovery_activities: getRecoveryActivities(level),
    };
  }

  if (level === 2) {
    return {
      type: 'active_recovery',
      distance_km: null,
      duration_min: 20,
      target_hr_zone: 'Z1',
      description: 'Descanso ativo: caminhada leve 20 min ou yoga/mobilidade. Evite qualquer impacto.',
      recovery_activities: getRecoveryActivities(level),
    };
  }

  // Nível 1: substituir intenso por leve, manter movimento
  const session = plannedSession || {};
  const isIntense = ['interval', 'tempo', 'test'].includes(session.type);
  if (isIntense) {
    return {
      type: 'easy_run',
      distance_km: session.distance_km ? Math.min(6, +(session.distance_km * 0.5).toFixed(1)) : 4.0,
      duration_min: 30,
      target_hr_zone: 'Z2',
      description: `Treino ${session.type || 'intenso'} substituído por rodagem leve Z2 de 30 min (VFC baixa hoje).`,
      recovery_activities: getRecoveryActivities(level),
    };
  }

  // Plano já era leve — manter mas com Z1
  return {
    ...session,
    target_hr_zone: 'Z1',
    duration_min: Math.round((session.duration_min || 30) * 0.7),
    distance_km: session.distance_km ? +(session.distance_km * 0.7).toFixed(1) : null,
    description: 'Volume reduzido em 30% e mantido em Z1 (VFC em recuperação).',
    recovery_activities: getRecoveryActivities(level),
  };
}

/**
 * Retorna atividades de recuperação sugeridas por nível.
 * @param {number} level
 * @returns {string[]}
 */
function getRecoveryActivities(level) {
  const base = ['Sono ≥ 8h esta noite', 'Hidratação: 35ml/kg de peso'];
  if (level >= 4) {
    return [
      ...base,
      'Descanso completo — sem corrida ou treino intenso',
      'Alimentação rica em proteínas (1.6–2g/kg)',
      'Verificar carga total de estresse (trabalho, vida pessoal)',
      '⚠️ Considere consultar seu treinador ou profissional de saúde',
    ];
  }
  if (level >= 3) {
    return [
      ...base,
      'Descanso passivo: sem corrida, sem treino',
      'Caminhada leve opcional (10–15 min) se se sentir bem',
      'Mobilidade suave / alongamento (10 min)',
      'Foam rolling: quadríceps, panturrilha, glúteos (1–2 min/grupo)',
    ];
  }
  if (level >= 2) {
    return [
      ...base,
      'Caminhada 20 min ou yoga leve',
      'Foam rolling: pontos de tensão (10–15 min total)',
      'Mobilidade de quadril e tornozelo (10 min)',
    ];
  }
  return [
    ...base,
    'Foam rolling pós-treino (10 min)',
    'Alongamento estático pós-treino (10 min)',
  ];
}

/**
 * Determina se banho de gelo deve ser sugerido.
 * Banho de gelo inibe adaptações fisiológicas (hipertrofia, ganho capilar/mitocondrial).
 * Deve ser usado SOMENTE em fase de competição (provas em dias seguidos).
 * NUNCA durante fases de base, build ou pico de treinamento.
 * Fonte: Petersen et al. (2021)
 *
 * @param {'base'|'build'|'peak'|'taper'|'competition'} periodizationPhase
 * @returns {boolean}
 */
function shouldSuggestIceBath(periodizationPhase) {
  return periodizationPhase === 'competition';
}

/**
 * Gera protocolo de taper baseado em Mujika & Padilla (2000, 2003).
 * Volume: -40 a -60%. Intensidade: 100% mantida. Frequência: máximo -20%.
 *
 * @param {Object} session - Sessão planejada original
 * @param {number} weeksToRace - Semanas até a prova
 * @returns {Object} Sessão com ajuste de taper
 */
function applyTaperAdjustment(session, weeksToRace) {
  if (!session || weeksToRace > 2) return session;

  const volumeReductionFactor = weeksToRace <= 1 ? 0.50 : 0.35; // -50% na semana final, -35% na penúltima

  return {
    ...session,
    distance_km: session.distance_km
      ? +(session.distance_km * (1 - volumeReductionFactor)).toFixed(1)
      : null,
    duration_min: session.duration_min
      ? Math.round(session.duration_min * (1 - volumeReductionFactor))
      : null,
    description: `Taper pré-prova: volume -${Math.round(volumeReductionFactor * 100)}% (Mujika & Padilla). Intensidade e ritmo de prova mantidos.`,
    is_taper: true,
  };
}

module.exports = {
  getRecoveryLevel,
  buildRecoverySession,
  getRecoveryActivities,
  shouldSuggestIceBath,
  applyTaperAdjustment,
  OVERREACHING_THRESHOLD,
  OVERTRAINING_THRESHOLD,
  RECOVERY_LEVELS,
};
