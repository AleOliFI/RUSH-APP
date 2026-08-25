// ============================================================
// RUSH PERFORMANCE — Training Agent (VFC-Based)
//
// Algoritmo Científico de Modulação e Prescrição de Treinamento
// Baseado em evidências fisiológicas e de medicina do esporte:
// - Plews, D. J., Laursen, P. B., Kilding, A. E., & Buchheit, M. (2012, 2013, 2014):
//   Heart rate variability in elite endurance athletes: 7-day rolling baseline,
//   Smallest Worthwhile Change (SWC = 0.5 * SD), and parasympathetic hyperactivity/saturation.
// - Buchheit, M. (2014): Monitoring training status with HR measures: do all roads lead to Rome?
//   Frontiers in Physiology, 5, 73.
// - Kiviniemi, A. M., Hautala, A. J., Kinnunen, H., & Tulppo, M. P. (2007):
//   Daily exercise prescription on the basis of HR variability improves peak VO2max compared with predetermined training.
//   Int J Sports Med, 28(9), 748-755.
// - Carrasco-Poyatos, M., et al. (2022): HRV-guided training for endurance athletes: A systematic review and meta-analysis.
// - Manresa-Rocamora, A., et al. (2021): Heart rate variability-guided training for endurance sports: systematic review.
// - Flatt, A. A., & Esco, M. R. (2015, 2016): Smartphone-derived heart-rate variability and training load.
// - Hooper, S. L., & Mackinnon, L. T. (1995): Monitoring overtraining in athletes (Likert 1-5 wellness calibration).
// - Seiler, S. (2010): Polarized training model (80% low intensity Z1/Z2, 20% high intensity Z4/Z5).
// ============================================================

// Constantes de decisão fisiológica (Plews et al. 2013, Buchheit 2014)
const SWC_MULTIPLIER = 0.5;              // Smallest Worthwhile Change (0.5 * SD)
const MIN_SWC = 0.05;                    // Salvaguarda mínima para SWC (evita colapso do corredor quando SD=0)
const ATTENTION_LOWER_MULTIPLIER = 1.0;  // Limiar inferior de atenção (-1.0 * SWC)
const RECOVERY_LOWER_MULTIPLIER = 1.5;   // Limiar inferior de recuperação (-1.5 * SWC)
const SATURATION_UPPER_MULTIPLIER = 1.5; // Limiar superior de saturação parassimpática (+1.5 * SWC)

// Calibração de Bem-Estar — Escala Likert 1-5 (Hooper & Mackinnon 1995)
// 1 = pior/baixo, 5 = melhor/alto
const SLEEP_CRITICAL_THRESHOLD = 2;      // <= 2: sono péssimo/insuficiente (3 é normal)
const READINESS_CRITICAL_THRESHOLD = 2;  // <= 2: prontidão muito baixa (3 é normal)
const FATIGUE_CRITICAL_THRESHOLD = 4;    // >= 4: fadiga alta/extrema
const SORENESS_CRITICAL_THRESHOLD = 4;   // >= 4: dor muscular tardia intensa
const STRESS_CRITICAL_THRESHOLD = 4;     // >= 4: estresse elevado

// Reduções moduladas de treino
const REDUCTION_ATTENTION_VOLUME = 0.20; // Redução de 20% no volume para status attention
const REDUCTION_ATTENTION_INTENSITY = 0.10;
const REDUCTION_RECOVERY_VOLUME = 0.50;  // Redução de 50% no volume para status recovery

// Taper
const TAPER_WEEKS = 2;

/**
 * Conta fatores críticos de bem-estar (Hooper & Mackinnon, 1995)
 * Garante segurança contra objetos nulos ou incompletos.
 *
 * @param {Object} wellness
 * @returns {number} Quantidade de fatores críticos
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
 * Classifica o status autonômico diário baseado em lnRMSSD, baseline de 7 dias e SWC.
 *
 * Corredor Autonômico Padrão (Plews et al. 2013, Buchheit 2014, Kiviniemi et al. 2007):
 * - favorable: delta entre -swc e +1.5*swc (ou > +1.5*swc sem fadiga crítica)
 * - attention: delta entre -1.5*swc e -swc (ou > +1.5*swc com fadiga crítica / saturação parassimpática)
 * - recovery: delta < -1.5*swc (supressão parassimpática acentuada)
 *
 * @param {number} lnrmssdToday - lnRMSSD medido no dia
 * @param {number} mean7d - Média do lnRMSSD dos 7 dias anteriores
 * @param {number} sd7d - Desvio padrão do lnRMSSD dos 7 dias anteriores
 * @param {Object|null} wellnessScores - Questionário de bem-estar opcional
 * @returns {'favorable'|'attention'|'recovery'}
 */
function classifyHrvStatus(lnrmssdToday, mean7d, sd7d, wellnessScores = null) {
  const safeToday = (typeof lnrmssdToday === 'number' && !isNaN(lnrmssdToday)) ? lnrmssdToday : 0;
  const effectiveMean = (typeof mean7d === 'number' && !isNaN(mean7d) && mean7d > 0) ? mean7d : safeToday;
  const effectiveSd = (typeof sd7d === 'number' && !isNaN(sd7d) && sd7d >= 0) ? sd7d : 0;

  // SWC com salvaguarda mínima fisiológica (MIN_SWC = 0.05)
  const swc = Math.max(effectiveSd * SWC_MULTIPLIER, MIN_SWC);
  const delta = safeToday - effectiveMean;

  // Epsilon-safe rounded values to prevent IEEE 754 precision artifacts
  const roundedDelta = Math.round(delta * 1e8) / 1e8;
  const roundedSwc = Math.round(swc * 1e8) / 1e8;
  const satUpper = Math.round(swc * SATURATION_UPPER_MULTIPLIER * 1e8) / 1e8;
  const recLower = Math.round(swc * RECOVERY_LOWER_MULTIPLIER * 1e8) / 1e8;

  // Verificação de Hiperatividade / Saturação Parassimpática (Plews et al. 2013, Buchheit 2014)
  // lnRMSSD excessivamente elevado (> +1.5*SWC) acompanhado de sintomas de fadiga indica saturação.
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

  // Corredor de VFC
  if (roundedDelta >= -roundedSwc) {
    return 'favorable';
  } else if (roundedDelta >= -recLower) {
    return 'attention';
  } else {
    return 'recovery';
  }
}

/**
 * Aplica ajuste para status "attention"
 * Sincroniza proporcionalmente distance_km e duration_min em todos os tipos de treino.
 *
 * @param {Object} session
 * @returns {Object} Sessão ajustada
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
 * Sincroniza proporcionalmente distance_km e duration_min em todos os tipos de treino.
 *
 * @param {Object} session
 * @returns {Object} Sessão ajustada
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
 *
 * @param {'favorable'|'attention'|'recovery'} status
 * @param {Object} plannedSession
 * @param {number|null} weeksToRace
 * @returns {{action: string, adjustedSession: Object|null, reasonCode: string}}
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

  // Taper: respeitar plano original (Buchheit 2014)
  if (weeksToRace !== null && weeksToRace !== undefined && weeksToRace <= TAPER_WEEKS) {
    if (status === 'recovery' && session.is_fixed) {
      return { action: 'postpone', adjustedSession: null, reasonCode: 'TAPER_RECOVERY_FIXED' };
    }
    return { action: 'maintain', adjustedSession: session, reasonCode: 'TAPER_MAINTAIN' };
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
function generateExplanation(status, action, lnrmssdToday, mean7d, sd7d, wellness, reasonCode) {
  const deltaPercent = (typeof mean7d === 'number' && mean7d > 0)
    ? ((lnrmssdToday - mean7d) / mean7d) * 100
    : 0;
  const criticalFactors = countCriticalWellnessFactors(wellness);
  let text = '';

  switch (status) {
    case 'favorable':
      text = `✅ Sua VFC está ${Math.abs(deltaPercent).toFixed(0)}% ${deltaPercent >= 0 ? 'acima' : 'dentro'} da média dos últimos 7 dias. `;
      text += 'Você está pronto para treinar forte hoje!';
      break;

    case 'attention':
      if (deltaPercent > 0) {
        text = `⚠️ Sua VFC está ${Math.abs(deltaPercent).toFixed(0)}% acima da média dos últimos 7 dias com fadiga/estresse associados. `;
        text += 'Isso pode indicar hiperatividade ou saturação parassimpática (Plews et al., 2013). ';
        text += 'Sugerimos treino moderado ou regenerativo.';
      } else {
        text = `⚠️ Sua VFC está ${Math.abs(deltaPercent).toFixed(0)}% abaixo da média dos últimos 7 dias. `;
        text += 'Isso pode indicar fadiga acumulada ou estresse. ';
        text += 'Sugerimos reduzir o volume/intensidade do treino.';
      }
      break;

    case 'recovery':
      text = `🔴 Sua VFC está ${Math.abs(deltaPercent).toFixed(0)}% ${deltaPercent >= 0 ? 'em variação atípica' : 'abaixo da média dos últimos 7 dias'}. `;
      text += 'Seu sistema parassimpático está deprimido ou sobrecarregado (Buchheit, 2014; Kiviniemi et al., 2007). ';
      text += 'Recomendamos descanso ou treino leve para recuperação.';
      break;
  }

  if (criticalFactors >= 2 && wellness) {
    const factors = [];
    if (typeof wellness.sleep === 'number' && wellness.sleep <= SLEEP_CRITICAL_THRESHOLD) factors.push('sono');
    if (typeof wellness.fatigue === 'number' && wellness.fatigue >= FATIGUE_CRITICAL_THRESHOLD) factors.push('fadiga');
    if (typeof wellness.soreness === 'number' && wellness.soreness >= SORENESS_CRITICAL_THRESHOLD) factors.push('dor muscular');
    if (typeof wellness.stress === 'number' && wellness.stress >= STRESS_CRITICAL_THRESHOLD) factors.push('estresse');
    if (typeof wellness.readiness === 'number' && wellness.readiness <= READINESS_CRITICAL_THRESHOLD) factors.push('disposição');
    text += ` Além disso, ${criticalFactors} fatores de bem-estar estão críticos: ${factors.join(', ')}.`;
  }

  return text;
}

/**
 * FUNÇÃO PRINCIPAL DO AGENTE
 * Gera sugestão de treino baseada em VFC e bem-estar (Kiviniemi et al. 2007, Plews et al. 2013)
 *
 * @param {Object} params
 * @param {number} params.lnrmssdToday
 * @param {number} params.lnrmssd7dMean
 * @param {number} params.lnrmssd7dSd
 * @param {Object} [params.wellnessScores]
 * @param {Object} [params.plannedSession]
 * @param {number|null} [params.weeksToRace]
 * @returns {Object} Sugestão detalhada de treino com métricas científicas
 */
function generateTrainingSuggestion({
  lnrmssdToday,
  lnrmssd7dMean,
  lnrmssd7dSd,
  wellnessScores,
  plannedSession,
  weeksToRace = null
} = {}) {
  const safeToday = (typeof lnrmssdToday === 'number' && !isNaN(lnrmssdToday)) ? lnrmssdToday : 0;
  const safeMean = (typeof lnrmssd7dMean === 'number' && !isNaN(lnrmssd7dMean) && lnrmssd7dMean > 0)
    ? lnrmssd7dMean
    : safeToday;
  const safeSd = (typeof lnrmssd7dSd === 'number' && !isNaN(lnrmssd7dSd) && lnrmssd7dSd >= 0)
    ? lnrmssd7dSd
    : 0;
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

  // Passo 1: Classificar status VFC com corredor autonômico e saturação
  let status = classifyHrvStatus(safeToday, safeMean, safeSd, safeWellness);

  // Passo 2: Avaliar fatores subjetivos de bem-estar (Hooper & Mackinnon 1995)
  const criticalFactors = countCriticalWellnessFactors(safeWellness);

  if (criticalFactors >= 3) {
    status = 'recovery';
  } else if (criticalFactors >= 2) {
    if (status === 'favorable') {
      status = 'attention';
    } else if (status === 'attention') {
      status = 'recovery';
    }
  }

  // Passo 3: Determinar ação e ajuste de treino
  const { action, adjustedSession, reasonCode } = determineAction(
    status, safeSession, weeksToRace
  );

  // Passo 4: Gerar texto explicativo
  const explanationText = generateExplanation(
    status, action, safeToday, safeMean, safeSd,
    safeWellness, reasonCode
  );

  // Passo 5: Calcular métricas autonômicas e SWC
  const swc = Math.max(safeSd * SWC_MULTIPLIER, MIN_SWC);
  const delta = safeToday - safeMean;
  const deltaPercent = safeMean > 0 ? ((safeToday - safeMean) / safeMean) * 100 : 0;

  return {
    status,
    action,
    adjusted_session: adjustedSession,
    reason_code: reasonCode,
    explanation_text: explanationText,
    metrics: {
      lnrmssd_today: +safeToday.toFixed(4),
      lnrmssd_7d_mean: +safeMean.toFixed(4),
      lnrmssd_7d_sd: +safeSd.toFixed(4),
      swc: +swc.toFixed(4),
      delta: +delta.toFixed(4),
      delta_percent: +deltaPercent.toFixed(1),
      critical_wellness_factors: criticalFactors,
    }
  };
}

/**
 * Calcula lnRMSSD a partir do RMSSD em ms
 * lnRMSSD = ln(RMSSD_ms) (Plews et al. 2012)
 *
 * @param {number} rmssdMs
 * @returns {number}
 */
function calculateLnRmssd(rmssdMs) {
  if (typeof rmssdMs !== 'number' || isNaN(rmssdMs) || !isFinite(rmssdMs) || rmssdMs <= 0) {
    return 0;
  }
  return Math.log(rmssdMs);
}

/**
 * Calcula média e desvio padrão amostral de um array numérico
 *
 * @param {number[]} values
 * @returns {{mean: number, sd: number}}
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
