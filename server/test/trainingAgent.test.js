// ============================================================
// Scientific Logic & HRV Unit and Integration Tests
// ============================================================

const assert = require('assert');
const {
  classifyHrvStatus,
  countCriticalWellnessFactors,
  generateTrainingSuggestion,
  calculateLnRmssd,
  calculateStats,
  applyAttentionAdjustment,
  applyRecoveryAdjustment,
  SWC_MULTIPLIER,
  MIN_SWC,
  SLEEP_CRITICAL_THRESHOLD,
  READINESS_CRITICAL_THRESHOLD,
  FATIGUE_CRITICAL_THRESHOLD,
  SORENESS_CRITICAL_THRESHOLD,
  STRESS_CRITICAL_THRESHOLD
} = require('../agent/trainingAgent');

console.log('🧪 Starting Training Agent Scientific Unit Tests...\n');

let passedTests = 0;
let totalTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ ${description}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// ------------------------------------------------------------------
// 1. Math and Stats Verification
// ------------------------------------------------------------------
console.log('--- 1. Math, Log and Stats Safety ---');

it('calculateLnRmssd correctly computes natural log for normal RMSSD', () => {
  const ln = calculateLnRmssd(50);
  assert.ok(Math.abs(ln - Math.log(50)) < 1e-6);
});

it('calculateLnRmssd safely handles zero, negative, NaN or non-numbers without throwing', () => {
  assert.strictEqual(calculateLnRmssd(0), 0);
  assert.strictEqual(calculateLnRmssd(-10), 0);
  assert.strictEqual(calculateLnRmssd(NaN), 0);
  assert.strictEqual(calculateLnRmssd(null), 0);
  assert.strictEqual(calculateLnRmssd(undefined), 0);
});

it('calculateStats correctly computes mean and standard deviation', () => {
  const stats = calculateStats([4.0, 4.2, 3.8]);
  assert.strictEqual(+stats.mean.toFixed(2), 4.0);
  assert.ok(stats.sd > 0.15 && stats.sd < 0.17);
});

it('calculateStats handles single element, empty, or invalid arrays', () => {
  const empty = calculateStats([]);
  assert.strictEqual(empty.mean, 0);
  assert.strictEqual(empty.sd, 0);

  const single = calculateStats([4.5]);
  assert.strictEqual(single.mean, 4.5);
  assert.strictEqual(single.sd, 0);

  const withNans = calculateStats([4.0, NaN, 4.0]);
  assert.strictEqual(withNans.mean, 4.0);
  assert.strictEqual(withNans.sd, 0);
});

// ------------------------------------------------------------------
// 2. Wellness Calibration (Hooper & Mackinnon 1995)
// ------------------------------------------------------------------
console.log('\n--- 2. Wellness Calibration ---');

it('Normal score (3/5) does NOT trigger critical penalties', () => {
  const normalWellness = { sleep: 3, fatigue: 3, soreness: 3, stress: 3, readiness: 3 };
  const criticalCount = countCriticalWellnessFactors(normalWellness);
  assert.strictEqual(criticalCount, 0, 'Normal scores of 3 must not be critical');
});

it('Critical thresholds trigger only for <=2 (sleep/readiness) and >=4 (fatigue/soreness/stress)', () => {
  const criticalSleepReadiness = { sleep: 2, fatigue: 3, soreness: 3, stress: 3, readiness: 2 };
  assert.strictEqual(countCriticalWellnessFactors(criticalSleepReadiness), 2);

  const criticalFatigueStress = { sleep: 4, fatigue: 4, soreness: 4, stress: 5, readiness: 4 };
  assert.strictEqual(countCriticalWellnessFactors(criticalFatigueStress), 3);

  const severeExhaustion = { sleep: 1, fatigue: 5, soreness: 5, stress: 5, readiness: 1 };
  assert.strictEqual(countCriticalWellnessFactors(severeExhaustion), 5);
});

it('countCriticalWellnessFactors handles null or partial objects safely', () => {
  assert.strictEqual(countCriticalWellnessFactors(null), 0);
  assert.strictEqual(countCriticalWellnessFactors({}), 0);
  assert.strictEqual(countCriticalWellnessFactors({ sleep: 1 }), 1);
});

// ------------------------------------------------------------------
// 3. HRV Classification Corridor (Plews 2013, Buchheit 2014, Kiviniemi 2007)
// ------------------------------------------------------------------
console.log('\n--- 3. HRV Classification & Smallest Worthwhile Change (SWC) ---');

it('Standard corridor classification with normal SD (0.20 -> SWC=0.10)', () => {
  const mean = 4.0;
  const sd = 0.20; // SWC = 0.10

  // Favorable: delta >= -0.10 and delta <= +0.15
  assert.strictEqual(classifyHrvStatus(4.00, mean, sd), 'favorable'); // delta = 0
  assert.strictEqual(classifyHrvStatus(4.08, mean, sd), 'favorable'); // delta = +0.08
  assert.strictEqual(classifyHrvStatus(3.91, mean, sd), 'favorable'); // delta = -0.09 (within -swc)

  // Attention: delta between -1.5*swc (-0.15) and -swc (-0.10)
  assert.strictEqual(classifyHrvStatus(3.88, mean, sd), 'attention'); // delta = -0.12

  // Recovery: delta < -1.5*swc (-0.15)
  assert.strictEqual(classifyHrvStatus(3.80, mean, sd), 'recovery'); // delta = -0.20
  assert.strictEqual(classifyHrvStatus(3.50, mean, sd), 'recovery'); // delta = -0.50
});

it('Minimum SWC Floor (MIN_SWC=0.05) prevents collapse when SD=0', () => {
  const mean = 4.0;
  const sd = 0; // SWC becomes MIN_SWC = 0.05

  // -0.001 fluctuation must be FAVORABLE, NOT recovery
  assert.strictEqual(classifyHrvStatus(3.999, mean, sd), 'favorable');
  assert.strictEqual(classifyHrvStatus(3.96, mean, sd), 'favorable'); // delta = -0.04 >= -0.05

  // Attention: delta between -0.075 and -0.05
  assert.strictEqual(classifyHrvStatus(3.94, mean, sd), 'attention'); // delta = -0.06

  // Recovery: delta < -0.075
  assert.strictEqual(classifyHrvStatus(3.90, mean, sd), 'recovery'); // delta = -0.10
});

it('Parasympathetic Saturation / Hyperactivity detection (Plews et al. 2013)', () => {
  const mean = 4.0;
  const sd = 0.20; // SWC = 0.10, +1.5*SWC = +0.15

  // Spike with high fatigue indicates parasympathetic saturation
  const saturatedWellness = { sleep: 3, fatigue: 4, soreness: 3, stress: 3, readiness: 3 };
  assert.strictEqual(classifyHrvStatus(4.25, mean, sd, saturatedWellness), 'attention');

  // Spike with good recovery indicates high autonomic readiness (favorable)
  const freshWellness = { sleep: 5, fatigue: 1, soreness: 1, stress: 1, readiness: 5 };
  assert.strictEqual(classifyHrvStatus(4.25, mean, sd, freshWellness), 'favorable');
});

// ------------------------------------------------------------------
// 4. Workout Adjustment Synchronization (Duration & Distance)
// ------------------------------------------------------------------
console.log('\n--- 4. Workout Adjustment Synchronization ---');

it('applyAttentionAdjustment synchronizes distance and duration for all workout types', () => {
  // Long Run: 20km / 120min -> 16km / 96min (-20%)
  const longRun = { type: 'long_run', distance_km: 20.0, duration_min: 120, target_hr_zone: 'Z2' };
  const adjLong = applyAttentionAdjustment(longRun);
  assert.strictEqual(adjLong.distance_km, 16.0);
  assert.strictEqual(adjLong.duration_min, 96);

  // Interval: 8km / 50min -> 6.4km / 40min (-20%)
  const interval = { type: 'interval', distance_km: 8.0, duration_min: 50, target_hr_zone: 'Z4' };
  const adjInterval = applyAttentionAdjustment(interval);
  assert.strictEqual(adjInterval.distance_km, 6.4);
  assert.strictEqual(adjInterval.duration_min, 40);

  // Tempo: 10km / 60min, Z4 -> 8km / 48min, Z3
  const tempo = { type: 'tempo', distance_km: 10.0, duration_min: 60, target_hr_zone: 'Z4' };
  const adjTempo = applyAttentionAdjustment(tempo);
  assert.strictEqual(adjTempo.distance_km, 8.0);
  assert.strictEqual(adjTempo.duration_min, 48);
  assert.strictEqual(adjTempo.target_hr_zone, 'Z3');

  // Easy Run: 10km / 60min -> 8.5km / 51min (-15%)
  const easy = { type: 'easy_run', distance_km: 10.0, duration_min: 60, target_hr_zone: 'Z2' };
  const adjEasy = applyAttentionAdjustment(easy);
  assert.strictEqual(adjEasy.distance_km, 8.5);
  assert.strictEqual(adjEasy.duration_min, 51);
});

it('applyRecoveryAdjustment synchronizes distance and duration for all workout types', () => {
  // Long Run: 20km / 120min -> 10km / 60min, Z1 (-50%)
  const longRun = { type: 'long_run', distance_km: 20.0, duration_min: 120, target_hr_zone: 'Z2' };
  const adjLong = applyRecoveryAdjustment(longRun);
  assert.strictEqual(adjLong.distance_km, 10.0);
  assert.strictEqual(adjLong.duration_min, 60);
  assert.strictEqual(adjLong.target_hr_zone, 'Z1');

  // Interval / Tempo -> easy_run 5km / 30min / Z2
  const interval = { type: 'interval', distance_km: 10.0, duration_min: 50, target_hr_zone: 'Z4' };
  const adjInterval = applyRecoveryAdjustment(interval);
  assert.strictEqual(adjInterval.type, 'easy_run');
  assert.strictEqual(adjInterval.distance_km, 5.0);
  assert.strictEqual(adjInterval.duration_min, 30);
  assert.strictEqual(adjInterval.target_hr_zone, 'Z2');

  // Easy Run Z2 -> 70% volume in Z1
  const easyZ2 = { type: 'easy_run', distance_km: 10.0, duration_min: 60, target_hr_zone: 'Z2' };
  const adjEasyZ2 = applyRecoveryAdjustment(easyZ2);
  assert.strictEqual(adjEasyZ2.distance_km, 7.0);
  assert.strictEqual(adjEasyZ2.duration_min, 42);
  assert.strictEqual(adjEasyZ2.target_hr_zone, 'Z1');

  // Easy Run Z3 -> rest (0km, 0min)
  const easyZ3 = { type: 'easy_run', distance_km: 10.0, duration_min: 60, target_hr_zone: 'Z3' };
  const adjEasyZ3 = applyRecoveryAdjustment(easyZ3);
  assert.strictEqual(adjEasyZ3.type, 'rest');
  assert.strictEqual(adjEasyZ3.distance_km, 0);
  assert.strictEqual(adjEasyZ3.duration_min, 0);
});

// ------------------------------------------------------------------
// 5. Training Suggestion Integration & Null-Safety
// ------------------------------------------------------------------
console.log('\n--- 5. Training Suggestion & Null-Safety ---');

it('generateTrainingSuggestion handles null plannedSession and null wellnessScores gracefully', () => {
  const result = generateTrainingSuggestion({
    lnrmssdToday: 4.1,
    lnrmssd7dMean: 4.0,
    lnrmssd7dSd: 0.15,
    wellnessScores: null,
    plannedSession: null,
  });

  assert.strictEqual(result.status, 'favorable');
  assert.strictEqual(result.action, 'maintain');
  assert.ok(result.adjusted_session != null);
  assert.ok(result.metrics.delta_percent !== Infinity);
  assert.strictEqual(result.metrics.critical_wellness_factors, 0);
});

it('generateTrainingSuggestion handles mean7d === 0 without returning Infinity%', () => {
  const result = generateTrainingSuggestion({
    lnrmssdToday: 4.1,
    lnrmssd7dMean: 0,
    lnrmssd7dSd: 0,
    wellnessScores: { sleep: 3, fatigue: 3, soreness: 3, stress: 3, readiness: 3 },
    plannedSession: { type: 'easy_run', distance_km: 8, duration_min: 45 },
  });

  assert.strictEqual(result.metrics.delta_percent, 0);
  assert.ok(!result.explanation_text.includes('Infinity%'));
});

it('Wellness downgrade rules: 2 critical factors downgrades favorable to attention', () => {
  const result = generateTrainingSuggestion({
    lnrmssdToday: 4.1,
    lnrmssd7dMean: 4.0,
    lnrmssd7dSd: 0.15,
    wellnessScores: { sleep: 2, fatigue: 4, soreness: 3, stress: 3, readiness: 3 }, // 2 critical
    plannedSession: { type: 'long_run', distance_km: 20, duration_min: 120, target_hr_zone: 'Z2' },
  });

  assert.strictEqual(result.status, 'attention');
  assert.strictEqual(result.action, 'reduce');
  assert.strictEqual(result.adjusted_session.distance_km, 16.0);
});

it('Wellness downgrade rules: 3 critical factors downgrades attention to recovery', () => {
  const result = generateTrainingSuggestion({
    lnrmssdToday: 3.88, // attention based on VFC
    lnrmssd7dMean: 4.0,
    lnrmssd7dSd: 0.15,
    wellnessScores: { sleep: 2, fatigue: 4, soreness: 4, stress: 3, readiness: 3 }, // 3 critical
    plannedSession: { type: 'interval', distance_km: 10, duration_min: 60, target_hr_zone: 'Z4' },
  });

  assert.strictEqual(result.status, 'recovery');
  assert.strictEqual(result.action, 'light');
  assert.strictEqual(result.adjusted_session.type, 'easy_run');
});

console.log(`\n========================================`);
console.log(`Tests Passed: ${passedTests} / ${totalTests}`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
