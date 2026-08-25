const assert = require('assert');
const {
  getCyclePhase,
  calcMenstrualSymptomScore,
  getPhaseTrainingRecommendation,
  adjustStatusForCycle,
  CYCLE_PHASES
} = require('../agent/menstrualModule');

console.log('🧪 Running menstrualModule unit tests...');

// 1. getCyclePhase
const lmp = '2026-08-01'; // Dia 1 do ciclo de 28 dias
assert.strictEqual(getCyclePhase(lmp, 28, '2026-08-03'), CYCLE_PHASES.MENSTRUAL, 'Dia 3 deve ser menstrual');
assert.strictEqual(getCyclePhase(lmp, 28, '2026-08-10'), CYCLE_PHASES.FOLLICULAR, 'Dia 10 deve ser follicular');
assert.strictEqual(getCyclePhase(lmp, 28, '2026-08-14'), CYCLE_PHASES.OVULATORY, 'Dia 14 deve ser ovulatory');
assert.strictEqual(getCyclePhase(lmp, 28, '2026-08-20'), CYCLE_PHASES.LUTEAL, 'Dia 20 deve ser luteal');
assert.strictEqual(getCyclePhase(lmp, 28, '2026-08-28'), CYCLE_PHASES.LUTEAL, 'Dia 28 deve ser luteal');
assert.strictEqual(getCyclePhase(lmp, 28, '2026-08-29'), CYCLE_PHASES.MENSTRUAL, 'Dia 29 deve iniciar novo ciclo (menstrual)');

// 2. calcMenstrualSymptomScore
const zeroScore = calcMenstrualSymptomScore({ cramp_level: 0, bloating_level: 0, energy_level: 5, mood_level: 5 });
assert.strictEqual(zeroScore, 0.0, 'Sem sintomas deve ser score 0.0');

const severeScore = calcMenstrualSymptomScore({ cramp_level: 5, bloating_level: 5, energy_level: 0, mood_level: 0 });
assert.strictEqual(severeScore, 1.0, 'Sintomas máximos devem ser score 1.0');

// 3. adjustStatusForCycle
assert.strictEqual(adjustStatusForCycle('favorable', 'menstrual', 0.75), 'attention', 'GREEN com sintomas severos degrada para YELLOW');
assert.strictEqual(adjustStatusForCycle('attention', 'menstrual', 0.75), 'recovery', 'YELLOW com sintomas severos degrada para RED');
assert.strictEqual(adjustStatusForCycle('favorable', 'follicular', 0.1), 'favorable', 'GREEN com sintomas leves mantém GREEN');

// 4. getPhaseTrainingRecommendation
const folRec = getPhaseTrainingRecommendation('follicular', 'favorable');
assert.strictEqual(folRec.intensityBias, 'high', 'Folicular deve ter bias de alta intensidade');
assert.ok(folRec.note.includes('Estrogênio'), 'Nota deve mencionar estrogênio');

console.log('✅ All menstrualModule tests passed!');
