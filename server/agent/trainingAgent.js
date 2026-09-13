// ============================================================
// RUSH PERFORMANCE — Training Agent (VFC & Fisiologia Cardiovascular)
//
// Algoritmo Científico de Modulação e Prescrição de Treinamento
// Baseado em evidências fisiológicas e de medicina do esporte:
// - Plews, D. J., Laursen, P. B., Kilding, A. E., & Buchheit, M. (2012, 2013, 2014):
//   Heart rate variability in elite endurance athletes: 28-day baseline, 7-day rolling average,
//   Smallest Worthwhile Change (SWC = 0.5 * SD), and parasympathetic hyperactivity/saturation.
// - Buchheit, M. (2014): Monitoring training status with HR measures: do all roads lead to Rome?
//   Frontiers in Physiology, 5, 73.
// - Kiviniemi, A. M., Hautala, A. J., Kinnunen, H., & Tulppo, M. P. (2007):
//   Daily exercise prescription on the basis of HR variability improves peak VO2max compared with predetermined training.
// - Carrasco-Poyatos, M., et al. (2022): HRV-guided training for endurance athletes: A systematic review and meta-analysis.
// - Coyle, E. F., & González-Alonso, J. (2001): Cardiovascular drift during prolonged exercise.
// - Seiler, S. (2010): Polarized training model (80% low intensity Z1/Z2, 20% high intensity Z4/Z5).
// - Gellish, R. L., et al. (2007): Longitudinal modeling of the relationship between age and maximal heart rate.
// - Mujika, I., & Padilla, S. (2000, 2003): Scientific bases for precompetition tapering strategies.
// - McNulty, K. L., et al. (2020): The effects of menstrual cycle phase on exercise performance in eumenorrheic women.
// ============================================================

const {
  getRecoveryLevel,
  buildRecoverySession,
  getRecoveryActivities,
  shouldSuggestIceBath,
  applyTaperAdjustment,
  OVERREACHING_THRESHOLD,
  RECOVERY_LEVELS
} = require('./recoveryProtocol');

const {
  getCyclePhase,
  calcMenstrualSymptomScore,
  getPhaseTrainingRecommendation,
  adjustStatusForCycle,
  CYCLE_PHASES
} = require('./menstrualModule');

// Constantes de decisão fisiológica (Plews et al. 2013, Buchheit 2014)
const SWC_MULTIPLIER = 0.5;              // Smallest Worthwhile Change (0.5 * SD)
const MIN_SWC = 0.05;                    // Salvaguarda mínima para SWC (evita colapso do corredor quando SD=0)
const ATTENTION_LOWER_MULTIPLIER = 1.0;  // Limiar inferior de atenção (-1.0 * SWC)
const RECOVERY_LOWER_MULTIPLIER = 1.5;   // Limiar inferior de recuperação (-1.5 * SWC)
const SATURATION_UPPER_MULTIPLIER = 1.5; // Limiar superior de saturação parassimpática (+1.5 * SWC)

// Calibração de Bem-Estar — Escala Likert 1-5 (Hooper & Mackinnon 1995)
const SLEEP_CRITICAL_THRESHOLD = 2;      // <= 2: sono péssimo/insuficiente
const READINESS_CRITICAL_THRESHOLD = 2;  // <= 2: prontidão muito baixa
const FATIGUE_CRITICAL_THRESHOLD = 4;    // >= 4: fadiga alta/extrema
const SORENESS_CRITICAL_THRESHOLD = 4;   // >= 4: dor muscular intensa
const STRESS_CRITICAL_THRESHOLD = 4;     // >= 4: estresse elevado

// Reduções moduladas de treino
const REDUCTION_ATTENTION_VOLUME = 0.20; // Redução de 20% no volume para status attention
const REDUCTION_ATTENTION_INTENSITY = 0.10;
const REDUCTION_RECOVERY_VOLUME = 0.50;  // Redução de 50% no volume para status recovery

// Taper
const TAPER_WEEKS = 2;

/**
 * Conta fatores críticos de bem-estar (Hooper & Mackinnon, 1995)
 * @param {Object} wellness
 * @returns {number}
 */
function countCriticalWellnessFactors(wellness) {
  if (!wellness || typeof wellness !== 'object') return 0;
  let count = 0;
  if (typeof wellness.sleep === 'number' && wellness.sleep <= SLEEP_CRITICAL_THRESHOLD) count++;
  if (typeof wellness.fatigue === 'number' && wellness.fatigue >= FATIGUE_CRITICAL_THRESHOLD) count++;
  if (typeof wellness.soreness === 'number' && wellness.soreness >= SORENESS_CRITICAL_THRESHOLD) count++;
  if (typeof wellness.stress === 'number' && wellness.stress >= STRESS_CRITICAL_THRESHOLD) count++;
  if (typeof wellness.readiness === 'number' && wellness.readiness <= READINESS_CRITICAL_THRESHOLD) count++;
  return count;
}

/**
 * Detecta Saturação Parassimpática (Buchheit 2014, Plews et al. 2013).
 * Ocorre quando o lnRMSSD cai ligeiramente abaixo da baseline, mas a FC de repouso (RHR)
 * permanece no piso basal ou baixa E o atleta não relata fadiga aguda.
 *
 * @param {number} delta - lnRMSSD hoje - baseline
 * @param {number} swc - Smallest Worthwhile Change
 * @param {number|null} rhrToday - FC de repouso hoje (bpm)
 * @param {number|null} rhrMean - FC de repouso média basal (bpm)
 * @param {Object|null} wellness - Questionário de bem-estar
 * @returns {boolean}
 */
function detectParasympatheticSaturation(delta, swc, rhrToday, rhrMean, wellness) {
  if (delta >= -swc) return false; // VFC normal, não é saturação
  if (rhrToday == null || rhrMean == null || rhrMean <= 0) return false;

  // FC de repouso estável ou menor que a média basal indica tônus vagal elevado no nodo sinusal
  const rhrIsLowOrStable = rhrToday <= rhrMean + 1.0;
  const criticalCount = countCriticalWellnessFactors(wellness);

  // Sem sintomas de fadiga extrema
  return rhrIsLowOrStable && criticalCount <= 1;
}

/**
 * Classifica o status autonômico diário baseado em lnRMSSD, baseline de 28d e SWC.
 *
 * @param {number} lnrmssdToday - lnRMSSD medido no dia
 * @param {number} meanBaseline - Média da baseline histórica (28d ou 7d)
 * @param {number} sdBaseline - Desvio padrão da baseline histórica
 * @param {Object|null} wellnessScores - Questionário de bem-estar
 * @param {number|null} rhrToday - FC de repouso do dia
 * @param {number|null} rhrMean - Média da FC de repouso basal
 * @returns {'favorable'|'attention'|'recovery'}
 */
function classifyHrvStatus(lnrmssdToday, meanBaseline, sdBaseline, wellnessScores = null, rhrToday = null, rhrMean = null) {
  const safeToday = (typeof lnrmssdToday === 'number' && !isNaN(lnrmssdToday)) ? lnrmssdToday : 0;
  const effectiveMean = (typeof meanBaseline === 'number' && !isNaN(meanBaseline) && meanBaseline > 0) ? meanBaseline : safeToday;
  const effectiveSd = (typeof sdBaseline === 'number' && !isNaN(sdBaseline) && sdBaseline >= 0) ? sdBaseline : 0;

  const swc = Math.max(effectiveSd * SWC_MULTIPLIER, MIN_SWC);
  const delta = safeToday - effectiveMean;

  const roundedDelta = Math.round(delta * 1e8) / 1e8;
  const roundedSwc = Math.round(swc * 1e8) / 1e8;
  const satUpper = Math.round(swc * SATURATION_UPPER_MULTIPLIER * 1e8) / 1e8;
  const recLower = Math.round(swc * RECOVERY_LOWER_MULTIPLIER * 1e8) / 1e8;

  // Verificação de Saturação Parassimpática superior (Plews et al. 2013)
  if (roundedDelta > satUpper) {
    if (wellnessScores && typeof wellnessScores === 'object') {
      const hasHighFatigue = typeof wellnessScores.fatigue === 'number' && wellnessScores.fatigue >= FATIGUE_CRITICAL_THRESHOLD;
      const hasHighStress = typeof wellnessScores.stress === 'number' && wellnessScores.stress >= STRESS_CRITICAL_THRESHOLD;
      const criticalCount = countCriticalWellnessFactors(wellnessScores);
      if (hasHighFatigue || hasHighStress || criticalCount >= 2) {
        return 'attention';
      }
    }
    return 'favorable';
  }

  // Verificação de Saturação Parassimpática inferior com RHR baixa (Buchheit 2014)
  if (detectParasympatheticSaturation(roundedDelta, roundedSwc, rhrToday, rhrMean, wellnessScores)) {
    return 'favorable';
  }

  // Corredor Autonômico Padrão
  if (roundedDelta >= -roundedSwc) {
    return 'favorable';
  } else if (roundedDelta >= -recLower) {
    return 'attention';
  } else {
    return 'recovery';
  }
}

/**
 * Calcula a FC Máxima individualizada usando a Equação de Gellish et al. (2007)
 * @param {Object} params
 * @param {number} params.age - Idade em anos
 * @param {string} [params.gender] - 'male' | 'female'
 * @param {number} [params.weightKg] - Peso em kg
 * @param {number} [params.heightCm] - Altura em cm
 * @returns {number} FCmax estimada em bpm
 */
function calculateMaxHr({ age, gender = 'male', weightKg = null, heightCm = null } = {}) {
  const safeAge = typeof age === 'number' && age > 0 ? age : 30;
  let bmi = 23.0;
  if (weightKg && heightCm && heightCm > 0) {
    const heightM = heightCm / 100;
    bmi = weightKg / (heightM * heightM);
  }

  const genderOffset = gender === 'female' ? 0 : 4;
  const maxHr = 207 - (0.7 * safeAge) - (0.1 * bmi) + genderOffset;
  return Math.round(maxHr);
}

/**
 * Calcula as 5 Zonas de Treinamento Cardíaco (Z1-Z5) baseadas no modelo Polarizado de Seiler
 * @param {number} maxHr - FC Máxima
 * @returns {Object} Faixas de FC e descrições para cada zona
 */
function calculateHrZones(maxHr) {
  const safeMax = typeof maxHr === 'number' && maxHr > 100 ? maxHr : 185;
  return {
    Z1: {
      name: 'Regenerativa',
      minBpm: Math.round(safeMax * 0.50),
      maxBpm: Math.round(safeMax * 0.60),
      pctMax: '50%–60%',
      rpe: '8–9 (Muito Leve)',
      purpose: 'Recuperação ativa e fluxo sanguíneo',
      dfaAlpha1: '> 0.75',
    },
    Z2: {
      name: 'Base Aeróbica (Endurance)',
      minBpm: Math.round(safeMax * 0.60),
      maxBpm: Math.round(safeMax * 0.70),
      pctMax: '60%–70%',
      rpe: '10–12 (Leve/Conversacional)',
      purpose: 'Biogênese mitocondrial e queima de gordura (75-80% do volume)',
      dfaAlpha1: '≈ 0.75 (LT1)',
    },
    Z3: {
      name: 'Zona Cinza (Tempo Submáximo)',
      minBpm: Math.round(safeMax * 0.70),
      maxBpm: Math.round(safeMax * 0.80),
      pctMax: '70%–80%',
      rpe: '13–14 (Moderado)',
      purpose: 'Ritmo de maratona — evitar no dia a dia para não gerar fadiga residual',
      dfaAlpha1: '0.50–0.75',
    },
    Z4: {
      name: 'Limiar Anaeróbico (Threshold)',
      minBpm: Math.round(safeMax * 0.80),
      maxBpm: Math.round(safeMax * 0.90),
      pctMax: '80%–90%',
      rpe: '15–17 (Forte / Desconfortável)',
      purpose: 'Elevação do limiar de lactato (~4 mmol/L)',
      dfaAlpha1: '≈ 0.50 (LT2)',
    },
    Z5: {
      name: 'VO2 Máximo (Potência Neuromuscular)',
      minBpm: Math.round(safeMax * 0.90),
      maxBpm: safeMax,
      pctMax: '90%–100%',
      rpe: '18–20 (Exaustão Máxima)',
      purpose: 'Débito cardíaco máximo e recrutamento de fibras Tipo IIx (tiros curtos)',
      dfaAlpha1: '< 0.50',
    },
  };
}

/**
 * Calcula o Fator de Eficiência (Efficiency Factor - EF / Pa:HR)
 * @param {number} speedMetersPerMin - Velocidade em m/min (ou pace convertido)
 * @param {number} avgHrBpm - FC Média sustentada em bpm
 * @returns {number} EF normalizado
 */
function calculateEfficiencyFactor(speedMetersPerMin, avgHrBpm) {
  if (!speedMetersPerMin || !avgHrBpm || avgHrBpm <= 0) return 0;
  return +(speedMetersPerMin / avgHrBpm).toFixed(3);
}

/**
 * Calcula o Desacoplamento Aeróbico (Aerobic Decoupling) entre a 1ª e a 2ª metade do treino
 * @param {number} efFirstHalf - EF da primeira metade
 * @param {number} efSecondHalf - EF da segunda metade
 * @returns {{decouplingPercent: number, status: 'consolidated'|'borderline'|'limited'}}
 */
function calculateAerobicDecoupling(efFirstHalf, efSecondHalf) {
  if (!efFirstHalf || !efSecondHalf || efFirstHalf <= 0) {
    return { decouplingPercent: 0, status: 'consolidated' };
  }

  const decouplingPercent = +(((efFirstHalf - efSecondHalf) / efFirstHalf) * 100).toFixed(1);
  let status = 'consolidated'; // < 5%
  if (decouplingPercent > 8.0) {
    status = 'limited';     // > 8%
  } else if (decouplingPercent >= 5.0) {
    status = 'borderline';  // 5% a 8%
  }

  return { decouplingPercent, status };
}

/**
 * Aplica ajuste para status "attention"
 */
function applyAttentionAdjustment(session) {
  if (!session || typeof session !== 'object') {
    return {
      type: 'easy_run',
      distance_km: 6.4,
      duration_min: 36,
      target_pace: null,
      target_hr_zone: 'Z2',
      description: 'Treino reduzido em 20% (VFC em atenção)'
    };
  }

  const adjusted = { ...session };

  switch (session.type) {
    case 'long_run':
      adjusted.distance_km = session.distance_km != null
        ? +(session.distance_km * (1 - REDUCTION_ATTENTION_VOLUME)).toFixed(1)
        : null;
      adjusted.duration_min = session.duration_min != null
        ? Math.round(session.duration_min * (1 - REDUCTION_ATTENTION_VOLUME))
        : (adjusted.distance_km ? Math.round(adjusted.distance_km * 6.5) : null);
      adjusted.description = `Longão reduzido em 20% (VFC em atenção). ${session.distance_km || ''} km → ${adjusted.distance_km || ''} km`;
      break;

    case 'interval':
      adjusted.distance_km = session.distance_km != null
        ? +(session.distance_km * (1 - REDUCTION_ATTENTION_VOLUME)).toFixed(1)
        : null;
      adjusted.duration_min = session.duration_min != null
        ? Math.round(session.duration_min * (1 - REDUCTION_ATTENTION_VOLUME))
        : (adjusted.distance_km ? Math.round(adjusted.distance_km * 5) : null);
      adjusted.description = 'Intervalado com volume de tiros reduzido em 20% (VFC em atenção)';
      break;

    case 'easy_run':
      adjusted.distance_km = session.distance_km != null
        ? +(session.distance_km * 0.85).toFixed(1)
        : null;
      adjusted.duration_min = session.duration_min != null
        ? Math.round(session.duration_min * 0.85)
        : (adjusted.distance_km ? Math.round(adjusted.distance_km * 6) : null);
      adjusted.description = `Rodagem leve reduzida em 15% para ${adjusted.distance_km || ''} km (VFC em atenção)`;
      break;

    case 'tempo':
      adjusted.distance_km = session.distance_km != null
        ? +(session.distance_km * (1 - REDUCTION_ATTENTION_VOLUME)).toFixed(1)
        : null;
      adjusted.duration_min = session.duration_min != null
        ? Math.round(session.duration_min * (1 - REDUCTION_ATTENTION_VOLUME))
        : (adjusted.distance_km ? Math.round(adjusted.distance_km * 5.5) : null);
      adjusted.target_hr_zone = session.target_hr_zone === 'Z4' ? 'Z3' : session.target_hr_zone;
      adjusted.description = 'Tempo run reduzido: volume -20% e intensidade moderada (Z3)';
      break;

    case 'recovery_run':
    case 'recovery':
      adjusted.distance_km = session.distance_km != null
        ? +(session.distance_km * 0.85).toFixed(1)
        : null;
      adjusted.duration_min = session.duration_min != null
        ? Math.round(session.duration_min * 0.85)
        : (adjusted.distance_km ? Math.round(adjusted.distance_km * 6.5) : null);
      adjusted.target_hr_zone = 'Z1';
      adjusted.description = 'Treino regenerativo mantido em Z1 com volume levemente ajustado';
      break;

    case 'test':
      adjusted.description = 'Teste de corrida: sugerido adiar ou realizar em ritmo controlado';
      break;

    default:
      adjusted.description = 'Manter conforme planejado (treino de baixo impacto cardiovascular)';
      break;
  }

  return adjusted;
}

/**
 * Aplica ajuste para status "recovery"
 */
function applyRecoveryAdjustment(session) {
  if (!session || typeof session !== 'object') {
    return {
      type: 'rest',
      distance_km: 0,
      duration_min: 0,
      target_hr_zone: null,
      description: 'Sugerido descanso completo (recuperação necessária)'
    };
  }

  const adjusted = { ...session };

  switch (session.type) {
    case 'long_run':
      adjusted.distance_km = session.distance_km != null
        ? +(session.distance_km * (1 - REDUCTION_RECOVERY_VOLUME)).toFixed(1)
        : null;
      adjusted.duration_min = session.duration_min != null
        ? Math.round(session.duration_min * (1 - REDUCTION_RECOVERY_VOLUME))
        : (adjusted.distance_km ? Math.round(adjusted.distance_km * 6.5) : null);
      adjusted.target_hr_zone = 'Z1';
      adjusted.description = `Longão convertido para Z1 com 50% menos volume. ${session.distance_km || ''} km → ${adjusted.distance_km || ''} km`;
      break;

    case 'interval':
    case 'tempo':
      adjusted.type = 'easy_run';
      adjusted.distance_km = session.distance_km != null
        ? Math.min(5.0, +(session.distance_km * 0.5).toFixed(1))
        : 5.0;
      adjusted.duration_min = 30;
      adjusted.target_hr_zone = 'Z2';
      adjusted.description = 'Treino intenso convertido para rodagem leve Z2 de 30 min (recuperação necessária)';
      break;

    case 'easy_run':
      if (['Z1', 'Z2'].includes(session.target_hr_zone) || !session.target_hr_zone) {
        adjusted.distance_km = session.distance_km != null
          ? +(session.distance_km * 0.7).toFixed(1)
          : null;
        adjusted.duration_min = session.duration_min != null
          ? Math.round(session.duration_min * 0.7)
          : (adjusted.distance_km ? Math.round(adjusted.distance_km * 6.5) : null);
        adjusted.target_hr_zone = 'Z1';
        adjusted.description = `Rodagem leve reduzida em 30% em Z1 para ${adjusted.distance_km || ''} km (recuperação)`;
      } else {
        adjusted.type = 'rest';
        adjusted.distance_km = 0;
        adjusted.duration_min = 0;
        adjusted.target_hr_zone = null;
        adjusted.description = 'Sugerido descanso completo (recuperação necessária)';
      }
      break;

    case 'recovery_run':
    case 'recovery':
      adjusted.distance_km = session.distance_km != null
        ? +(session.distance_km * 0.7).toFixed(1)
        : null;
      adjusted.duration_min = session.duration_min != null
        ? Math.round(session.duration_min * 0.7)
        : (adjusted.distance_km ? Math.round(adjusted.distance_km * 6.5) : null);
      adjusted.target_hr_zone = 'Z1';
      adjusted.description = 'Treino regenerativo mantido em Z1 com volume reduzido';
      break;

    case 'strength':
      adjusted.description = 'Manter treino de força/recuperação ativa (baixo impacto cardiovascular)';
      break;

    default:
      adjusted.type = 'rest';
      adjusted.distance_km = 0;
      adjusted.duration_min = 0;
      adjusted.target_hr_zone = null;
      adjusted.description = 'Sugerido descanso completo (recuperação necessária)';
      break;
  }

  return adjusted;
}

/**
 * Determina ação baseada no status e tipo de treino
 */
function determineAction(status, plannedSession, weeksToRace) {
  const session = plannedSession || {
    type: 'easy_run',
    distance_km: 8,
    duration_min: 45,
    target_pace: null,
    target_hr_zone: 'Z2',
    is_fixed: false,
    description: 'Treino padrão'
  };

  // Taper: respeitar plano original (Buchheit 2014, Mujika & Padilla)
  if (weeksToRace !== null && weeksToRace !== undefined && weeksToRace <= TAPER_WEEKS) {
    if (status === 'recovery' && session.is_fixed) {
      return { action: 'postpone', adjustedSession: null, reasonCode: 'TAPER_RECOVERY_FIXED' };
    }
    const tapered = applyTaperAdjustment(session, weeksToRace);
    return { action: 'maintain', adjustedSession: tapered, reasonCode: 'TAPER_MAINTAIN' };
  }

  // Treinos fixos não são modificados, apenas adiados quando necessário
  if (session.is_fixed) {
    if (status === 'recovery') {
      return { action: 'postpone', adjustedSession: null, reasonCode: 'RECOVERY_FIXED_SESSION' };
    }
    if (status === 'attention' && session.type === 'test') {
      return { action: 'postpone', adjustedSession: null, reasonCode: 'ATTENTION_TEST_POSTPONE' };
    }
    return { action: 'maintain', adjustedSession: session, reasonCode: 'MAINTAIN_FIXED_SESSION' };
  }

  // Decisão baseada no status autonômico
  if (status === 'favorable') {
    return { action: 'maintain', adjustedSession: session, reasonCode: 'FAVORABLE_MAINTAIN' };
  }

  if (status === 'attention') {
    const adjusted = applyAttentionAdjustment(session);
    return { action: 'reduce', adjustedSession: adjusted, reasonCode: 'ATTENTION_REDUCE' };
  }

  if (status === 'recovery') {
    const adjusted = applyRecoveryAdjustment(session);
    if (adjusted.type === 'rest') {
      return { action: 'rest', adjustedSession: adjusted, reasonCode: 'RECOVERY_REST' };
    }
    return { action: 'light', adjustedSession: adjusted, reasonCode: 'RECOVERY_LIGHT' };
  }

  return { action: 'maintain', adjustedSession: session, reasonCode: 'DEFAULT_MAINTAIN' };
}

/**
 * Gera texto explicativo detalhado para o usuário
 */
function generateExplanation(status, action, lnrmssdToday, meanBaseline, sdBaseline, wellness, reasonCode, consecutiveLowDays = 0, cycleInfo = null) {
  const deltaPercent = (typeof meanBaseline === 'number' && meanBaseline > 0)
    ? ((lnrmssdToday - meanBaseline) / meanBaseline) * 100
    : 0;
  const criticalFactors = countCriticalWellnessFactors(wellness);
  let text = '';

  switch (status) {
    case 'favorable':
      text = `✅ Sua VFC está ${Math.abs(deltaPercent).toFixed(0)}% ${deltaPercent >= 0 ? 'acima' : 'dentro'} da baseline histórica. `;
      text += 'Seu sistema parassimpático está recuperado e pronto para a sessão!';
      break;

    case 'attention':
      if (deltaPercent > 0) {
        text = `⚠️ Sua VFC está ${Math.abs(deltaPercent).toFixed(0)}% acima da média com fadiga/estresse associados (hiperatividade parassimpática, Plews et al., 2013). `;
        text += 'Sugerimos treino moderado ou regenerativo.';
      } else {
        text = `⚠️ Sua VFC está ${Math.abs(deltaPercent).toFixed(0)}% abaixo da baseline de 28 dias. `;
        text += 'Indicativo de fadiga aguda ou estresse acumulado. Ajustamos o treino para Z2 com volume reduzido.';
      }
      break;

    case 'recovery':
      text = `🔴 Sua VFC está suprimida (${Math.abs(deltaPercent).toFixed(0)}% abaixo da baseline). `;
      if (consecutiveLowDays >= 3) {
        text += `Alerta: ${consecutiveLowDays} dias consecutivos em recuperação. Priorize descanso passivo e sono reparador.`;
      } else {
        text += 'Recomendamos descanso ou rodagem leve regenerativa em Z1.';
      }
      break;
  }

  if (criticalFactors >= 2 && wellness) {
    const factors = [];
    if (typeof wellness.sleep === 'number' && wellness.sleep <= SLEEP_CRITICAL_THRESHOLD) factors.push('sono');
    if (typeof wellness.fatigue === 'number' && wellness.fatigue >= FATIGUE_CRITICAL_THRESHOLD) factors.push('fadiga');
    if (typeof wellness.soreness === 'number' && wellness.soreness >= SORENESS_CRITICAL_THRESHOLD) factors.push('dor muscular');
    if (typeof wellness.stress === 'number' && wellness.stress >= STRESS_CRITICAL_THRESHOLD) factors.push('estresse');
    if (typeof wellness.readiness === 'number' && wellness.readiness <= READINESS_CRITICAL_THRESHOLD) factors.push('disposição');
    text += ` ${factors.length} fatores de bem-estar estão críticos: ${factors.join(', ')}.`;
  }

  if (cycleInfo?.note) {
    text += ` [${cycleInfo.modifier}: ${cycleInfo.note}]`;
  }

  return text;
}

/**
 * FUNÇÃO PRINCIPAL DO AGENTE
 * Gera sugestão de treino baseada em VFC, RHR, Ciclo Menstrual e Zonas de FC
 *
 * @param {Object} params
 * @param {number} params.lnrmssdToday - lnRMSSD medido no dia
 * @param {number} [params.rhrToday] - FC de repouso no dia (bpm)
 * @param {number} [params.lnrmssd28dMean] - Média histórica de 28d do lnRMSSD
 * @param {number} [params.lnrmssd28dSd] - Desvio padrão histórico de 28d do lnRMSSD
 * @param {number} [params.rhr28dMean] - Média histórica de 28d da FC de repouso
 * @param {number} [params.rhr28dSd] - Desvio padrão histórico de 28d da FC de repouso
 * @param {number} [params.lnrmssd7dMean] - Média de 7d (retrocompatibilidade)
 * @param {number} [params.lnrmssd7dSd] - Desvio padrão de 7d
 * @param {number} [params.consecutiveLowDays=0] - Dias consecutivos com VFC baixa
 * @param {Object} [params.wellnessScores] - Questionário de bem-estar
 * @param {Object} [params.menstrualData] - { phase, symptomScore, recommendation }
 * @param {Object} [params.plannedSession] - Sessão planejada original
 * @param {number|null} [params.weeksToRace] - Semanas até a prova alvo
 * @param {string} [params.periodizationPhase='base'] - 'base'|'build'|'peak'|'taper'|'competition'
 * @param {Object} [params.userProfile] - { age, gender, weight_kg, height_cm }
 * @returns {Object}
 */
function generateTrainingSuggestion({
  lnrmssdToday,
  rhrToday = null,
  lnrmssd28dMean = null,
  lnrmssd28dSd = null,
  rhr28dMean = null,
  rhr28dSd = null,
  lnrmssd7dMean = null,
  lnrmssd7dSd = null,
  consecutiveLowDays = 0,
  wellnessScores,
  menstrualData = null,
  plannedSession,
  weeksToRace = null,
  periodizationPhase = 'base',
  userProfile = null,
} = {}) {
  const safeToday = (typeof lnrmssdToday === 'number' && !isNaN(lnrmssdToday)) ? lnrmssdToday : 0;

  // Usa baseline de 28d preferencialmente; fallback para 7d se 28d não disponível
  const effectiveMean = (typeof lnrmssd28dMean === 'number' && lnrmssd28dMean > 0)
    ? lnrmssd28dMean
    : ((typeof lnrmssd7dMean === 'number' && lnrmssd7dMean > 0) ? lnrmssd7dMean : safeToday);

  const effectiveSd = (typeof lnrmssd28dSd === 'number' && lnrmssd28dSd >= 0)
    ? lnrmssd28dSd
    : ((typeof lnrmssd7dSd === 'number' && lnrmssd7dSd >= 0) ? lnrmssd7dSd : 0);

  const safeWellness = wellnessScores || { sleep: 3, fatigue: 3, soreness: 3, stress: 3, readiness: 3 };
  const safeSession = plannedSession || {
    type: 'easy_run',
    distance_km: 8,
    duration_min: 45,
    target_pace: null,
    target_hr_zone: 'Z2',
    is_fixed: false,
    description: 'Treino padrão'
  };

  // Passo 1: Classificar status VFC com corredor autonômico, RHR e saturação
  let status = classifyHrvStatus(safeToday, effectiveMean, effectiveSd, safeWellness, rhrToday, rhr28dMean);

  // Passo 2: Ajuste por Ciclo Menstrual (se aplicável)
  let cycleInfo = null;
  if (menstrualData && menstrualData.phase) {
    status = adjustStatusForCycle(status, menstrualData.phase, menstrualData.symptomScore || 0);
    cycleInfo = getPhaseTrainingRecommendation(menstrualData.phase, status);
  }

  // Passo 3: Avaliar fatores subjetivos de bem-estar (Hooper & Mackinnon 1995)
  const criticalFactors = countCriticalWellnessFactors(safeWellness);
  if (criticalFactors >= 3) {
    status = 'recovery';
  } else if (criticalFactors >= 2) {
    if (status === 'favorable') status = 'attention';
    else if (status === 'attention') status = 'recovery';
  }

  // Passo 4: Protocolo de Recuperação Escalonado (se status === recovery)
  let recoveryLevelInfo = null;
  let action, adjustedSession, reasonCode;

  if (status === 'recovery') {
    const recoveryLevel = getRecoveryLevel(consecutiveLowDays);
    recoveryLevelInfo = recoveryLevel;
    adjustedSession = buildRecoverySession(recoveryLevel.level, safeSession);
    action = adjustedSession.type === 'rest' ? 'rest' : 'light';
    reasonCode = consecutiveLowDays >= OVERREACHING_THRESHOLD ? 'OVERREACHING_TRIGGERED' : 'RECOVERY_ESCALATED';
  } else {
    const decision = determineAction(status, safeSession, weeksToRace);
    action = decision.action;
    adjustedSession = decision.adjustedSession;
    reasonCode = decision.reasonCode;
  }

  // Passo 5: Gerar texto explicativo
  const explanationText = generateExplanation(
    status, action, safeToday, effectiveMean, effectiveSd,
    safeWellness, reasonCode, consecutiveLowDays, cycleInfo
  );

  // Passo 6: Métricas autonômicas e Zonas de FC
  const swc = Math.max(effectiveSd * SWC_MULTIPLIER, MIN_SWC);
  const delta = safeToday - effectiveMean;
  const deltaPercent = effectiveMean > 0 ? ((safeToday - effectiveMean) / effectiveMean) * 100 : 0;

  // Cálculo de Zonas individualizadas
  const maxHr = calculateMaxHr(userProfile || { age: 30, gender: 'male' });
  const hrZones = calculateHrZones(maxHr);

  const suggestIceBath = shouldSuggestIceBath(periodizationPhase);

  return {
    status,
    action,
    adjusted_session: adjustedSession,
    reason_code: reasonCode,
    explanation_text: explanationText,
    recovery_level: recoveryLevelInfo,
    suggest_ice_bath: suggestIceBath,
    hr_zones: hrZones,
    max_hr: maxHr,
    metrics: {
      lnrmssd_today: +safeToday.toFixed(4),
      lnrmssd_baseline_mean: +effectiveMean.toFixed(4),
      lnrmssd_baseline_sd: +effectiveSd.toFixed(4),
      rhr_today: rhrToday ? +rhrToday.toFixed(1) : null,
      rhr_baseline_mean: rhr28dMean ? +rhr28dMean.toFixed(1) : null,
      consecutive_low_days: consecutiveLowDays,
      swc: +swc.toFixed(4),
      delta: +delta.toFixed(4),
      delta_percent: +deltaPercent.toFixed(1),
      critical_wellness_factors: criticalFactors,
      cycle_phase: menstrualData?.phase || null,
    }
  };
}

/**
 * Calcula lnRMSSD a partir do RMSSD em ms
 */
function calculateLnRmssd(rmssdMs) {
  if (typeof rmssdMs !== 'number' || isNaN(rmssdMs) || !isFinite(rmssdMs) || rmssdMs <= 0) {
    return 0;
  }
  return Math.log(rmssdMs);
}

/**
 * Calcula média e desvio padrão amostral de um array numérico
 */
function calculateStats(values) {
  if (!Array.isArray(values) || values.length === 0) return { mean: 0, sd: 0 };
  const validValues = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (validValues.length === 0) return { mean: 0, sd: 0 };
  const mean = validValues.reduce((a, b) => a + b, 0) / validValues.length;
  if (validValues.length === 1) return { mean, sd: 0 };
  const variance = validValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / validValues.length;
  const sd = Math.sqrt(variance);
  return { mean, sd };
}

module.exports = {
  generateTrainingSuggestion,
  classifyHrvStatus,
  detectParasympatheticSaturation,
  calculateMaxHr,
  calculateHrZones,
  calculateEfficiencyFactor,
  calculateAerobicDecoupling,
  countCriticalWellnessFactors,
  calculateLnRmssd,
  calculateStats,
  applyAttentionAdjustment,
  applyRecoveryAdjustment,
  determineAction,
  generateExplanation,
  SWC_MULTIPLIER,
  MIN_SWC,
  SLEEP_CRITICAL_THRESHOLD,
  READINESS_CRITICAL_THRESHOLD,
  FATIGUE_CRITICAL_THRESHOLD,
  SORENESS_CRITICAL_THRESHOLD,
  STRESS_CRITICAL_THRESHOLD,
};
