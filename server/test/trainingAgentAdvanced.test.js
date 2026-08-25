const assert = require('assert');
const {
  generateTrainingSuggestion,
  classifyHrvStatus,
  detectParasympatheticSaturation,
  calculateMaxHr,
  calculateHrZones,
  calculateEfficiencyFactor,
  calculateAerobicDecoupling,
  calculateLnRmssd,
  calculateStats
} = require('../agent/trainingAgent');

console.log('🧪 Running trainingAgentAdvanced unit tests...');

// 1. calculateMaxHr (Gellish)
const maxHrMale30 = calculateMaxHr({ age: 30, gender: 'male', weightKg: 75, heightCm: 180 });
assert.strictEqual(typeof maxHrMale30, 'number', 'maxHr deve ser número');
assert.ok(maxHrMale30 >= 180 && maxHrMale30 <= 195, `maxHr esperado ~188, obteve ${maxHrMale30}`);

const maxHrFemale30 = calculateMaxHr({ age: 30, gender: 'female', weightKg: 60, heightCm: 165 });
assert.ok(maxHrFemale30 < maxHrMale30, 'Fórmula Gellish para mulher tem offset menor');

// 2. calculateHrZones (Z1 a Z5)
const zones = calculateHrZones(190);
assert.strictEqual(zones.Z1.name, 'Regenerativa');
assert.strictEqual(zones.Z2.minBpm, 114); // 60% de 190
assert.strictEqual(zones.Z2.maxBpm, 133); // 70% de 190
assert.strictEqual(zones.Z4.minBpm, 152); // 80% de 190
assert.strictEqual(zones.Z5.maxBpm, 190);

// 3. calculateEfficiencyFactor & calculateAerobicDecoupling
const ef1 = calculateEfficiencyFactor(180, 140); // 180 m/min / 140 bpm = 1.286
assert.strictEqual(ef1, 1.286);

const decouplingGood = calculateAerobicDecoupling(1.40, 1.36); // ~2.9% drop
assert.strictEqual(decouplingGood.status, 'consolidated', '< 5% deve ser consolidado');
assert.ok(decouplingGood.decouplingPercent < 5.0);

const decouplingHigh = calculateAerobicDecoupling(1.40, 1.20); // ~14.3% drop
assert.strictEqual(decouplingHigh.status, 'limited', '> 8% deve ser limitado');

// 4. detectParasympatheticSaturation
const satTrue = detectParasympatheticSaturation(-0.15, 0.08, 48, 50, { readiness: 4, fatigue: 2 });
assert.strictEqual(satTrue, true, 'lnRMSSD abaixo com RHR baixa e boa prontidão deve ser saturação parassimpática');

const satFalse = detectParasympatheticSaturation(-0.15, 0.08, 65, 50, { readiness: 2, fatigue: 4 });
assert.strictEqual(satFalse, false, 'lnRMSSD abaixo com RHR alta e fadiga alta NÃO é saturação (é fadiga real)');

// 5. generateTrainingSuggestion com 28d baseline e ciclo menstrual
const resultFolicular = generateTrainingSuggestion({
  lnrmssdToday: 4.10,
  rhrToday: 52,
  lnrmssd28dMean: 4.05,
  lnrmssd28dSd: 0.12,
  rhr28dMean: 54,
  rhr28dSd: 3,
  consecutiveLowDays: 0,
  wellnessScores: { sleep: 4, fatigue: 2, soreness: 2, stress: 2, readiness: 4 },
  menstrualData: { phase: 'follicular', symptomScore: 0.0 },
  plannedSession: { type: 'interval', distance_km: 8, duration_min: 45 },
});

assert.strictEqual(resultFolicular.status, 'favorable', 'Status deve ser favorable');
assert.strictEqual(resultFolicular.action, 'maintain', 'Ação deve ser manter o treino forte');
assert.ok(resultFolicular.hr_zones.Z2 != null, 'Deve retornar zonas calculadas');
assert.strictEqual(resultFolicular.metrics.cycle_phase, 'follicular');

// 6. generateTrainingSuggestion com 3 dias de VFC baixa (Recuperação escalonada)
const resultRec3 = generateTrainingSuggestion({
  lnrmssdToday: 3.50,
  rhrToday: 68,
  lnrmssd28dMean: 4.05,
  lnrmssd28dSd: 0.12,
  rhr28dMean: 54,
  rhr28dSd: 3,
  consecutiveLowDays: 3,
  wellnessScores: { sleep: 2, fatigue: 4, soreness: 4, stress: 4, readiness: 2 },
  plannedSession: { type: 'interval', distance_km: 8, duration_min: 45 },
});

assert.strictEqual(resultRec3.status, 'recovery');
assert.strictEqual(resultRec3.action, 'rest', '3 dias consecutivos deve ser descanso passivo');
assert.strictEqual(resultRec3.recovery_level.level, 3);
assert.ok(resultRec3.adjusted_session.recovery_activities.length > 0);

console.log('✅ All trainingAgentAdvanced tests passed!');
