// ============================================================
// Adversarial & Boundary Stress Test Suite for Training Agent
// Milestone 3 (R3) - Empirical Challenger Suite
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
  determineAction,
  generateExplanation,
  SWC_MULTIPLIER,
  MIN_SWC,
  SLEEP_CRITICAL_THRESHOLD,
  READINESS_CRITICAL_THRESHOLD,
  FATIGUE_CRITICAL_THRESHOLD,
  SORENESS_CRITICAL_THRESHOLD,
  STRESS_CRITICAL_THRESHOLD
} = require('../agent/trainingAgent');

console.log('🧪 Starting Adversarial & Boundary Stress Testing Harness (M3 Challenger 1)...\n');

let passedTests = 0;
let totalTests = 0;
const findings = [];

function testCase(category, description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.log(`  ⚠️ [DISCOVERY/FAIL] ${description}`);
    console.log(`     Details: ${err.message}`);
    findings.push({ category, description, error: err.message });
  }
}

// ------------------------------------------------------------------
// SECTION 1: Extreme Values & Mathematical Edge Cases
// ------------------------------------------------------------------
console.log('--- 1. Division-by-Zero, Outliers & Logarithm Safety ---');

testCase('MATH', 'Division-by-zero defense: mean7d=0, sd7d=0 produces safe metrics without NaN or Infinity', () => {
  const result = generateTrainingSuggestion({
    lnrmssdToday: 4.2,
    lnrmssd7dMean: 0,
    lnrmssd7dSd: 0,
    wellnessScores: { sleep: 3, fatigue: 3, soreness: 3, stress: 3, readiness: 3 },
    plannedSession: { type: 'easy_run', distance_km: 10, duration_min: 60 }
  });

  assert.ok(!Number.isNaN(result.metrics.delta), 'Delta must not be NaN');
  assert.ok(!Number.isNaN(result.metrics.delta_percent), 'Delta percent must not be NaN');
  assert.ok(Number.isFinite(result.metrics.delta_percent), 'Delta percent must be finite');
  assert.strictEqual(result.metrics.delta_percent, 0, 'When mean7d=0 fallback sets delta_percent=0');
  assert.strictEqual(result.metrics.swc, MIN_SWC, 'SWC must fall back to MIN_SWC');
});

testCase('MATH', 'Negative baseline defense: negative mean7d & sd7d handled safely', () => {
  const result = generateTrainingSuggestion({
    lnrmssdToday: 4.0,
    lnrmssd7dMean: -3.5,
    lnrmssd7dSd: -1.0,
    wellnessScores: null,
    plannedSession: null
  });

  assert.ok(Number.isFinite(result.metrics.lnrmssd_7d_mean));
  assert.ok(result.metrics.lnrmssd_7d_sd >= 0);
  assert.ok(['favorable', 'attention', 'recovery'].includes(result.status));
});

testCase('MATH', 'Extreme lnRMSSD: lnrmssdToday = 0 (RMSSD ~ 1ms)', () => {
  const result = generateTrainingSuggestion({
    lnrmssdToday: 0,
    lnrmssd7dMean: 4.0,
    lnrmssd7dSd: 0.2,
    wellnessScores: null,
    plannedSession: { type: 'easy_run', distance_km: 8, duration_min: 45 }
  });

  assert.strictEqual(result.status, 'recovery');
  assert.strictEqual(result.action, 'light');
  assert.strictEqual(result.metrics.lnrmssd_today, 0);
  assert.strictEqual(result.metrics.delta, -4.0);
  assert.strictEqual(result.metrics.delta_percent, -100);
});

testCase('MATH', 'Extreme lnRMSSD: lnrmssdToday = -2.5 (fractional RMSSD / extreme depression)', () => {
  const result = generateTrainingSuggestion({
    lnrmssdToday: -2.5,
    lnrmssd7dMean: 4.0,
    lnrmssd7dSd: 0.2,
    wellnessScores: null,
    plannedSession: { type: 'easy_run', distance_km: 8, duration_min: 45 }
  });

  assert.strictEqual(result.status, 'recovery');
  assert.strictEqual(result.metrics.lnrmssd_today, -2.5);
  assert.strictEqual(result.metrics.delta, -6.5);
});

testCase('MATH', 'calculateStats with corrupted arrays containing non-numbers, NaNs, and single values', () => {
  assert.deepStrictEqual(calculateStats(null), { mean: 0, sd: 0 });
  assert.deepStrictEqual(calculateStats(undefined), { mean: 0, sd: 0 });
  assert.deepStrictEqual(calculateStats('not-an-array'), { mean: 0, sd: 0 });
  assert.deepStrictEqual(calculateStats([NaN, NaN, null, 'text']), { mean: 0, sd: 0 });

  const uniform = calculateStats([4.2, 4.2, 4.2, 4.2]);
  assert.strictEqual(+uniform.mean.toFixed(2), 4.2);
  assert.strictEqual(uniform.sd, 0);
});

testCase('MATH_EDGE', 'calculateLnRmssd non-finite inputs: Infinity and -Infinity', () => {
  // Evaluates whether Infinity is safely intercepted
  assert.strictEqual(calculateLnRmssd(Infinity), 0, 'Infinity should return safe 0');
});

// ------------------------------------------------------------------
// SECTION 2: Precision Boundary Testing & Corridors
// ------------------------------------------------------------------
console.log('\n--- 2. Precision Boundary & Corridors (-swc, -1.5*swc, +1.5*swc) ---');

testCase('BOUNDARY', 'Exact Boundary: delta === -swc (3.90 with mean 4.00, sd 0.20)', () => {
  const mean = 4.00;
  const sd = 0.20; // swc = 0.10
  // Note: 3.90 - 4.00 in floating point is -0.10000000000000009
  const status = classifyHrvStatus(3.90, mean, sd);
  assert.strictEqual(status, 'favorable', 'Exact -swc boundary must be favorable');
});

testCase('BOUNDARY', 'Exact Boundary: delta === -1.5*swc (3.85 with mean 4.00, sd 0.20)', () => {
  const mean = 4.00;
  const sd = 0.20; // swc = 0.10, -1.5*swc = -0.15
  const status = classifyHrvStatus(3.85, mean, sd);
  assert.strictEqual(status, 'attention', 'Exact -1.5*swc boundary must be attention');
});

testCase('BOUNDARY', 'Exact Boundary: delta === +1.5*swc (4.15 with mean 4.00, sd 0.20) with high fatigue', () => {
  const mean = 4.00;
  const sd = 0.20; // swc = 0.10, +1.5*swc = +0.15
  const fatigueWellness = { sleep: 3, fatigue: 4, soreness: 3, stress: 3, readiness: 3 };
  const status = classifyHrvStatus(4.15, mean, sd, fatigueWellness);
  assert.strictEqual(status, 'favorable', 'Exact +1.5*swc should remain within standard corridor');
});

testCase('BOUNDARY', 'Zero SD baseline enforces MIN_SWC floor (0.05)', () => {
  const mean = 4.00;
  const sd = 0.00; // SWC = 0.05. -swc = -0.05, -1.5*swc = -0.075
  assert.strictEqual(classifyHrvStatus(3.95, mean, sd), 'favorable');   // delta = -0.05
  assert.strictEqual(classifyHrvStatus(3.949, mean, sd), 'attention');  // delta = -0.051
  assert.strictEqual(classifyHrvStatus(3.925, mean, sd), 'attention');  // delta = -0.075
  assert.strictEqual(classifyHrvStatus(3.924, mean, sd), 'recovery');   // delta = -0.076
});

// ------------------------------------------------------------------
// SECTION 3: Parasympathetic Saturation & Wellness Cascades
// ------------------------------------------------------------------
console.log('\n--- 3. Parasympathetic Saturation Triggers & Wellness Downgrades ---');

testCase('SATURATION', 'Saturation triggered individually by fatigue >= 4, stress >= 4, or criticalCount >= 2', () => {
  const mean = 4.00;
  const sd = 0.20;
  const highHrv = 4.25; // delta = +0.25 (> +0.15)

  assert.strictEqual(classifyHrvStatus(highHrv, mean, sd, { fatigue: 4, stress: 3 }), 'attention');
  assert.strictEqual(classifyHrvStatus(highHrv, mean, sd, { fatigue: 2, stress: 4 }), 'attention');
  assert.strictEqual(classifyHrvStatus(highHrv, mean, sd, { sleep: 2, readiness: 2, fatigue: 3, stress: 3 }), 'attention');
  assert.strictEqual(classifyHrvStatus(highHrv, mean, sd, { sleep: 2, readiness: 3, fatigue: 3, stress: 3 }), 'favorable');
});

testCase('WELLNESS', 'Cascade downgrade: favorable HRV with 3 critical wellness factors becomes RECOVERY', () => {
  const result = generateTrainingSuggestion({
    lnrmssdToday: 4.10,
    lnrmssd7dMean: 4.00,
    lnrmssd7dSd: 0.20,
    wellnessScores: { sleep: 1, fatigue: 5, soreness: 5, stress: 3, readiness: 3 },
    plannedSession: { type: 'long_run', distance_km: 18, duration_min: 110, target_hr_zone: 'Z2' }
  });

  assert.strictEqual(result.status, 'recovery', '3 critical factors must directly force status to recovery');
  assert.strictEqual(result.action, 'light');
  assert.strictEqual(result.adjusted_session.distance_km, 9.0, 'Long run distance must be halved in recovery');
  assert.strictEqual(result.adjusted_session.duration_min, 55, 'Long run duration must be halved in recovery');
});

testCase('WELLNESS', 'Cascade downgrade: attention HRV with 2 critical wellness factors becomes RECOVERY', () => {
  const result = generateTrainingSuggestion({
    lnrmssdToday: 3.88,
    lnrmssd7dMean: 4.00,
    lnrmssd7dSd: 0.20,
    wellnessScores: { sleep: 2, fatigue: 4, soreness: 3, stress: 3, readiness: 3 },
    plannedSession: { type: 'interval', distance_km: 10, duration_min: 50, target_hr_zone: 'Z4' }
  });

  assert.strictEqual(result.status, 'recovery', 'Attention + 2 critical factors must escalate to recovery');
  assert.strictEqual(result.adjusted_session.type, 'easy_run');
  assert.strictEqual(result.adjusted_session.target_hr_zone, 'Z2');
});

// ------------------------------------------------------------------
// SECTION 4: Pace Synchronization & Workout Transformation
// ------------------------------------------------------------------
console.log('\n--- 4. Pace Consistency & Synchronized Volume Reduction ---');

testCase('PACE', 'Attention Volume Reductions maintain strictly consistent running pace', () => {
  const sessions = [
    { type: 'long_run', distance_km: 24.0, duration_min: 144, target_hr_zone: 'Z2' },     // pace 6.0 min/km
    { type: 'interval', distance_km: 12.0, duration_min: 54, target_hr_zone: 'Z4' },      // pace 4.5 min/km
    { type: 'tempo', distance_km: 10.0, duration_min: 48, target_hr_zone: 'Z4' },         // pace 4.8 min/km
    { type: 'easy_run', distance_km: 12.0, duration_min: 72, target_hr_zone: 'Z2' },      // pace 6.0 min/km
    { type: 'recovery_run', distance_km: 6.0, duration_min: 39, target_hr_zone: 'Z1' },   // pace 6.5 min/km
  ];

  for (const session of sessions) {
    const origPace = session.duration_min / session.distance_km;
    const adjusted = applyAttentionAdjustment(session);

    assert.ok(adjusted.distance_km > 0);
    assert.ok(adjusted.duration_min > 0);

    const adjPace = adjusted.duration_min / adjusted.distance_km;
    const paceRatio = adjPace / origPace;

    assert.ok(
      paceRatio >= 0.96 && paceRatio <= 1.04,
      `${session.type} pace ratio ${paceRatio.toFixed(3)} must remain within 4% of original`
    );
  }
});

testCase('PACE', 'Recovery Volume Reductions maintain pace for long_run, easy_run, and recovery_run', () => {
  const sessions = [
    { type: 'long_run', distance_km: 20.0, duration_min: 120, target_hr_zone: 'Z2' },     // pace 6.0 min/km
    { type: 'easy_run', distance_km: 10.0, duration_min: 60, target_hr_zone: 'Z2' },      // pace 6.0 min/km
    { type: 'recovery_run', distance_km: 6.0, duration_min: 39, target_hr_zone: 'Z1' },   // pace 6.5 min/km
  ];

  for (const session of sessions) {
    const origPace = session.duration_min / session.distance_km;
    const adjusted = applyRecoveryAdjustment(session);

    assert.ok(adjusted.distance_km > 0);
    assert.ok(adjusted.duration_min > 0);

    const adjPace = adjusted.duration_min / adjusted.distance_km;
    const paceRatio = adjPace / origPace;

    assert.ok(
      paceRatio >= 0.96 && paceRatio <= 1.04,
      `${session.type} recovery pace ratio ${paceRatio.toFixed(3)} must remain within 4% of original`
    );
    assert.strictEqual(adjusted.target_hr_zone, 'Z1', `${session.type} must be adjusted to Z1 in recovery`);
  }
});

testCase('PACE', 'Recovery conversions for hard workouts (interval / tempo) convert to safe easy_run capped at 5km / 30min', () => {
  const interval = { type: 'interval', distance_km: 15.0, duration_min: 75, target_hr_zone: 'Z4' };
  const adjInterval = applyRecoveryAdjustment(interval);

  assert.strictEqual(adjInterval.type, 'easy_run');
  assert.strictEqual(adjInterval.distance_km, 5.0, 'Cap at 5.0km');
  assert.strictEqual(adjInterval.duration_min, 30);
  assert.strictEqual(adjInterval.target_hr_zone, 'Z2');
});

// ------------------------------------------------------------------
// SECTION 5: Fixed Sessions, Tapering & Null Input Robustness
// ------------------------------------------------------------------
console.log('\n--- 5. Fixed Sessions, Tapering & Null Input Robustness ---');

testCase('PERIODIZATION', 'Fixed session in recovery status returns action: postpone and null adjustedSession', () => {
  const fixedTestSession = { type: 'test', distance_km: 10, duration_min: 50, is_fixed: true };
  const decision = determineAction('recovery', fixedTestSession, null);
  assert.strictEqual(decision.action, 'postpone');
  assert.strictEqual(decision.adjustedSession, null);
  assert.strictEqual(decision.reasonCode, 'RECOVERY_FIXED_SESSION');
});

testCase('PERIODIZATION', 'Fixed session in attention status: test session is postponed, non-test is maintained', () => {
  const fixedTest = { type: 'test', distance_km: 10, duration_min: 50, is_fixed: true };
  const testDecision = determineAction('attention', fixedTest, null);
  assert.strictEqual(testDecision.action, 'postpone');

  const fixedLong = { type: 'long_run', distance_km: 20, duration_min: 120, is_fixed: true };
  const longDecision = determineAction('attention', fixedLong, null);
  assert.strictEqual(longDecision.action, 'maintain');
});

testCase('PERIODIZATION', 'Taper period (weeksToRace <= 2): preserves taper schedule except when fixed session in recovery', () => {
  const taperSession = { type: 'easy_run', distance_km: 5, duration_min: 30, is_fixed: false };

  const favDecision = determineAction('favorable', taperSession, 1);
  assert.strictEqual(favDecision.action, 'maintain');

  const attDecision = determineAction('attention', taperSession, 2);
  assert.strictEqual(attDecision.action, 'maintain');

  const fixedInTaper = { type: 'test', distance_km: 5, duration_min: 25, is_fixed: true };
  const recFixedDecision = determineAction('recovery', fixedInTaper, 1);
  assert.strictEqual(recFixedDecision.action, 'postpone');
});

testCase('ROBUSTNESS', 'generateTrainingSuggestion handling null/partial inputs when lnrmssdToday is valid', () => {
  const result = generateTrainingSuggestion({
    lnrmssdToday: 3.90,
    lnrmssd7dMean: null,
    lnrmssd7dSd: undefined,
    wellnessScores: null,
    plannedSession: null,
    weeksToRace: undefined
  });
  assert.ok(result.status != null);
  assert.ok(result.adjusted_session != null);
  assert.strictEqual(result.metrics.swc, MIN_SWC);
});

testCase('ROBUSTNESS_EDGE', 'generateTrainingSuggestion handling completely empty object `{}` without lnrmssdToday', () => {
  // Evaluates whether omitting lnrmssdToday throws TypeError
  try {
    generateTrainingSuggestion({});
  } catch (e) {
    throw new Error(`generateTrainingSuggestion({}) threw: ${e.message}`);
  }
});

// ------------------------------------------------------------------
// SUMMARY & FINDINGS LOG
// ------------------------------------------------------------------
console.log(`\n======================================================`);
console.log(`Empirical Stress Harness Execution Completed:`);
console.log(`  Total Tests Run: ${totalTests}`);
console.log(`  Passed:          ${passedTests}`);
console.log(`  Findings/Fails:  ${findings.length}`);
console.log(`======================================================\n`);

if (findings.length > 0) {
  console.log('📌 EMPIRICALLY CONFIRMED FINDINGS:');
  findings.forEach((f, idx) => {
    console.log(`\n[Finding ${idx + 1}] Category: ${f.category} | ${f.description}`);
    console.log(`  Observation: ${f.error}`);
  });
}
