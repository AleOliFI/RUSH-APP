// ============================================================
// RUSH PERFORMANCE — Menstrual Cycle Module
//
// Integra o ciclo menstrual à prescrição de treino via VFC.
// Baseado em evidências de medicina esportiva feminina:
// - McNulty et al. (2020): variação de RMSSD por fase do ciclo menstrual
// - Ansdell et al. (2021): periodização e plasticidade neuromuscular feminina
// - Lebrun et al. (2003): impacto das fases hormonais na performance
// ============================================================

const CYCLE_PHASES = {
  MENSTRUAL: 'menstrual',   // Dias 1–5 (Estrogênio e Progesterona baixos)
  FOLLICULAR: 'follicular', // Dias 6–13 (Estrogênio subindo, alta recuperação)
  OVULATORY: 'ovulatory',   // Dia 14 ±1 (Pico de Estrogênio e LH)
  LUTEAL: 'luteal',         // Dias 15–fim do ciclo (Progesterona dominante, queda natural de VFC)
};

const SYMPTOM_DEGRADATION_THRESHOLD = 0.60; // Score > 60% → degradar nível de VFC

/**
 * Determina a fase do ciclo menstrual dado a data do LMP (Last Menstrual Period).
 * @param {string} lmpDate - Data do início do último período (YYYY-MM-DD)
 * @param {number} cycleLength - Duração média do ciclo em dias (padrão: 28)
 * @param {string} today - Data de hoje (YYYY-MM-DD, padrão: hoje)
 * @returns {'menstrual'|'follicular'|'ovulatory'|'luteal'}
 */
function getCyclePhase(lmpDate, cycleLength = 28, today = null) {
  if (!lmpDate) return CYCLE_PHASES.FOLLICULAR;

  const lmp = new Date(lmpDate + 'T00:00:00Z');
  const todayDate = new Date((today || new Date().toISOString().split('T')[0]) + 'T00:00:00Z');
  const diffDays = Math.floor((todayDate - lmp) / (1000 * 60 * 60 * 24));
  const safeCycle = Math.max(21, Math.min(35, cycleLength || 28));

  // Normalizar para dentro do ciclo atual (1-indexed)
  const dayInCycle = (((diffDays % safeCycle) + safeCycle) % safeCycle) + 1;

  const ovulationDay = Math.round(safeCycle / 2); // Ex: dia 14 num ciclo de 28
  if (dayInCycle <= 5) return CYCLE_PHASES.MENSTRUAL;
  if (dayInCycle >= ovulationDay - 1 && dayInCycle <= ovulationDay + 1) return CYCLE_PHASES.OVULATORY;
  if (dayInCycle < ovulationDay - 1) return CYCLE_PHASES.FOLLICULAR;
  return CYCLE_PHASES.LUTEAL;
}

/**
 * Calcula o score de sintomas menstruais (0.0 a 1.0).
 * Score alto (> 0.6) indica que os sintomas devem degradar o status de VFC.
 *
 * @param {Object} tracking
 * @param {number} tracking.cramp_level 0–5 (cólica)
 * @param {number} tracking.bloating_level 0–5 (inchaço)
 * @param {number} tracking.energy_level 0–5 (5 = ótimo, invertido no cálculo)
 * @param {number} tracking.mood_level 0–5 (5 = ótimo, invertido no cálculo)
 * @returns {number} 0.0–1.0
 */
function calcMenstrualSymptomScore(tracking) {
  if (!tracking || typeof tracking !== 'object') return 0;

  const cramp = typeof tracking.cramp_level === 'number' ? Math.max(0, Math.min(5, tracking.cramp_level)) : 0;
  const bloating = typeof tracking.bloating_level === 'number' ? Math.max(0, Math.min(5, tracking.bloating_level)) : 0;
  const energy = typeof tracking.energy_level === 'number' ? 5 - Math.max(0, Math.min(5, tracking.energy_level)) : 2;
  const mood = typeof tracking.mood_level === 'number' ? 5 - Math.max(0, Math.min(5, tracking.mood_level)) : 2;

  return +( (cramp + bloating + energy + mood) / 20 ).toFixed(2);
}

/**
 * Ajusta o status de VFC levando em conta a fase do ciclo e sintomas.
 * @param {'favorable'|'attention'|'recovery'} vfcStatus
 * @param {'menstrual'|'follicular'|'ovulatory'|'luteal'} phase
 * @param {number} symptomScore 0.0–1.0
 * @returns {'favorable'|'attention'|'recovery'}
 */
function adjustStatusForCycle(vfcStatus, phase, symptomScore = 0) {
  const score = typeof symptomScore === 'number' ? symptomScore : 0;
  if (score < SYMPTOM_DEGRADATION_THRESHOLD) return vfcStatus;

  if (vfcStatus === 'favorable') return 'attention';
  if (vfcStatus === 'attention') return 'recovery';
  return 'recovery';
}

/**
 * Retorna recomendação de treino específica para a fase do ciclo.
 * Fonte: Ansdell et al. (2021), McNulty et al. (2020)
 *
 * @param {'menstrual'|'follicular'|'ovulatory'|'luteal'} phase
 * @param {'favorable'|'attention'|'recovery'} vfcStatus
 * @returns {{modifier: string, note: string, intensityBias: 'high'|'moderate'|'low'}}
 */
function getPhaseTrainingRecommendation(phase, vfcStatus) {
  const recommendations = {
    menstrual: {
      modifier: 'Fase Menstrual — Priorize conforto e escuta do corpo',
      note: 'Estrogênio e progesterona baixos. Percepção de esforço pode ser maior. Treinos em Z1/Z2 recomendados.',
      intensityBias: 'low',
    },
    follicular: {
      modifier: '🟢 Janela de Ouro — Fase Folicular',
      note: 'Estrogênio em ascensão: máxima recuperação neuromuscular e maior estabilidade de VFC. Ideal para HIIT, VAM e tiros.',
      intensityBias: 'high',
    },
    ovulatory: {
      modifier: '🔵 Pico Ovulatório — Máxima Força & Energia',
      note: 'Pico hormonal. Alta disponibilidade de energia. Atenção ao aquecimento para preservar estabilidade articular.',
      intensityBias: 'high',
    },
    luteal: {
      modifier: '🟡 Fase Lútea — Foco em Base Aeróbica & Gordura',
      note: 'Progesterona dominante: corpo queima mais gordura em Z2. VFC ligeiramente mais baixa por natureza (-3% a -8%).',
      intensityBias: 'moderate',
    },
  };

  return recommendations[phase] || recommendations.follicular;
}

module.exports = {
  getCyclePhase,
  calcMenstrualSymptomScore,
  getPhaseTrainingRecommendation,
  adjustStatusForCycle,
  CYCLE_PHASES,
  SYMPTOM_DEGRADATION_THRESHOLD,
};
