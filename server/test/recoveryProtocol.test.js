const assert = require('assert');
const {
  getRecoveryLevel,
  buildRecoverySession,
  getRecoveryActivities,
  shouldSuggestIceBath,
  applyTaperAdjustment,
  OVERREACHING_THRESHOLD
} = require('../agent/recoveryProtocol');

console.log('🧪 Running recoveryProtocol unit tests...');

// 1. getRecoveryLevel
assert.strictEqual(getRecoveryLevel(1).level, 1, '1 dia RED deve ser nível 1');
assert.strictEqual(getRecoveryLevel(2).level, 2, '2 dias RED deve ser nível 2');
assert.strictEqual(getRecoveryLevel(3).level, 3, '3 dias RED deve ser nível 3');
assert.strictEqual(getRecoveryLevel(5).level, 4, '5 dias RED deve ser nível 4 (overreaching)');
assert.strictEqual(getRecoveryLevel(7).level, 4, '7 dias RED deve ser nível 4');

// 2. buildRecoverySession
const s1 = buildRecoverySession(1, { type: 'interval', distance_km: 10, duration_min: 50 });
assert.strictEqual(s1.type, 'easy_run', 'Nível 1 com treino intenso deve converter para easy_run');
assert.strictEqual(s1.target_hr_zone, 'Z2', 'Nível 1 deve usar Z2');
assert.strictEqual(s1.distance_km, 5.0, 'Nível 1 deve ter 50% de volume');

const s2 = buildRecoverySession(2, { type: 'long_run', distance_km: 16 });
assert.strictEqual(s2.type, 'active_recovery', 'Nível 2 deve ser active_recovery');
assert.strictEqual(s2.target_hr_zone, 'Z1', 'Nível 2 deve usar Z1');

const s3 = buildRecoverySession(3, { type: 'tempo', distance_km: 8 });
assert.strictEqual(s3.type, 'rest', 'Nível 3 deve ser rest');
assert.strictEqual(s3.distance_km, 0, 'Nível 3 não deve ter distância');

const s4 = buildRecoverySession(4, { type: 'interval' });
assert.strictEqual(s4.type, 'rest', 'Nível 4 deve ser rest');
assert.ok(s4.description.includes('overreaching'), 'Nível 4 deve mencionar overreaching');

// 3. shouldSuggestIceBath
assert.strictEqual(shouldSuggestIceBath('competition'), true, 'Fase competition deve permitir banho de gelo');
assert.strictEqual(shouldSuggestIceBath('base'), false, 'Fase base NÃO deve sugerir banho de gelo');
assert.strictEqual(shouldSuggestIceBath('build'), false, 'Fase build NÃO deve sugerir banho de gelo');

// 4. applyTaperAdjustment
const t1 = applyTaperAdjustment({ type: 'long_run', distance_km: 20, duration_min: 120 }, 1);
assert.strictEqual(t1.distance_km, 10, 'Taper de 1 semana deve reduzir volume em 50%');
assert.strictEqual(t1.duration_min, 60, 'Duração de taper deve reduzir para 60 min');
assert.strictEqual(t1.is_taper, true, 'is_taper flag deve ser true');

console.log('✅ All recoveryProtocol tests passed!');
