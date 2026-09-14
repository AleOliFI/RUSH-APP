// ============================================================
// M3 CHALLENGER 2 — Comprehensive Empirical Test Suite
// Exhaustive verification of HRV routes, Day-1 lifecycle,
// wellness recalculations, and 4-Phase Periodization Matrix.
// ============================================================

const assert = require('assert');
const express = require('express');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

const initializeDatabase = require('../database/schema');
const { generateAccessToken } = require('../middleware/auth');
const hrvRoutes = require('../routes/hrv');
const trainingRoutes = require('../routes/training');

console.log('🧪 ========================================================');
console.log('🧪 M3 CHALLENGER 2 — ADVERSARIAL & MATRIX TEST SUITE');
console.log('🧪 ========================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    failures.push({ name, error: err });
    failedTests++;
  }
}

async function runSuite() {
  const db = new Database(':memory:');
  await initializeDatabase(db);

  // Setup test users
  const athlete1Id = uuidv4();
  const athlete1Token = generateAccessToken({ id: athlete1Id, email: 'athlete1@rush.com', role: 'athlete', academy_id: null });

  db.prepare(`
    INSERT INTO users (id, email, password_hash, role)
    VALUES (?, 'athlete1@rush.com', 'dummy_hash', 'athlete')
  `).run(athlete1Id);

  db.prepare(`
    INSERT INTO user_profiles (user_id, name, username)
    VALUES (?, 'Athlete One', 'athlete_one')
  `).run(athlete1Id);

  const coachId = uuidv4();
  const coachToken = generateAccessToken({ id: coachId, email: 'coach@rush.com', role: 'coach', academy_id: null });

  db.prepare(`
    INSERT INTO users (id, email, password_hash, role)
    VALUES (?, 'coach@rush.com', 'dummy_hash', 'coach')
  `).run(coachId);

  db.prepare(`
    INSERT INTO user_profiles (user_id, name, username)
    VALUES (?, 'Coach One', 'coach_one')
  `).run(coachId);

  const app = express();
  app.use(express.json());
  app.use('/api/hrv', hrvRoutes(db));
  app.use('/api/training', trainingRoutes(db));

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const headers = (token = athlete1Token) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  try {
    // ==================================================================
    // SUITE 1: DAY-1 ATHLETE LIFECYCLE & WELLNESS RECALCULATION
    // ==================================================================
    console.log('--- SUITE 1: DAY-1 ATHLETE LIFECYCLE & WELLNESS RECALCULATION ---');

    await test('1.1 Fresh user initial GET /api/hrv/status returns clean empty state', async () => {
      const res = await fetch(`${baseUrl}/api/hrv/status`, { headers: headers() });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.has_measured_today, false);
      assert.strictEqual(data.has_wellness_today, false);
      assert.strictEqual(data.status, null);
      assert.strictEqual(data.measurement, null);
      assert.strictEqual(data.wellness, null);
    });

    await test('1.2 Fresh user records first HRV measurement -> status is established as favorable baseline', async () => {
      const res = await fetch(`${baseUrl}/api/hrv/measurement`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          rmssd_ms: 55,
          hr_rest_bpm: 52,
          duration_seconds: 60,
          device_id: null,
        })
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();

      // Verify measurement details
      assert.ok(data.measurement != null, 'Measurement must be returned');
      assert.strictEqual(data.measurement.rmssd_ms, 55);
      assert.strictEqual(data.measurement.hr_rest_bpm, 52);
      assert.strictEqual(data.measurement.duration_seconds, 60);
      assert.ok(Math.abs(data.measurement.lnrmssd - Math.log(55)) < 1e-4);

      // Verify Day-1 daily status
      assert.ok(data.daily_status != null, 'Daily status suggestion must be returned');
      assert.strictEqual(data.daily_status.status, 'favorable', 'Day-1 status must default to favorable');
      assert.strictEqual(data.daily_status.action, 'maintain');
      assert.ok(data.daily_status.explanation_text.length > 0);

      // Verify stats_7d Day-1 learning mode
      assert.ok(data.stats_7d != null);
      assert.strictEqual(data.stats_7d.is_baseline_learning, true);
      assert.strictEqual(data.stats_7d.sample_size, 0);
      assert.strictEqual(data.stats_7d.mean, +(Math.log(55)).toFixed(4));
    });

    await test('1.3 GET /api/hrv/status returns complete status object for Day-1 athlete', async () => {
      const res = await fetch(`${baseUrl}/api/hrv/status`, { headers: headers() });
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.strictEqual(data.has_measured_today, true);
      assert.strictEqual(data.has_wellness_today, false);
      assert.ok(data.measurement != null);
      assert.strictEqual(data.measurement.rmssd_ms, 55);

      assert.ok(data.status != null);
      assert.strictEqual(data.status.status, 'favorable');
      assert.strictEqual(data.status.reason_code, 'FAVORABLE_MAINTAIN');
      assert.ok(data.status.explanation_text.includes('VFC'));
      assert.strictEqual(data.status.suggested_action, 'maintain');
      assert.ok(typeof data.status.lnrmssd === 'number');
      assert.ok(typeof data.status.lnrmssd_7d_mean === 'number');
      assert.ok(typeof data.status.lnrmssd_7d_sd === 'number');
    });

    await test('1.4 User posts neutral wellness ratings -> status remains favorable', async () => {
      const res = await fetch(`${baseUrl}/api/hrv/wellness`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          sleep: 3,
          fatigue: 3,
          soreness: 3,
          stress: 3,
          readiness: 3
        })
      });

      assert.strictEqual(res.status, 201);
      const wellness = await res.json();
      assert.strictEqual(wellness.sleep, 3);
      assert.strictEqual(wellness.readiness, 3);

      const statusRes = await fetch(`${baseUrl}/api/hrv/status`, { headers: headers() });
      const statusData = await statusRes.json();
      assert.strictEqual(statusData.has_wellness_today, true);
      assert.strictEqual(statusData.status.status, 'favorable');
    });

    await test('1.5 User updates wellness ratings to 2 critical scores -> status recalculates to attention', async () => {
      const res = await fetch(`${baseUrl}/api/hrv/wellness`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          sleep: 2,      // critical (<=2)
          fatigue: 3,
          soreness: 3,
          stress: 3,
          readiness: 2   // critical (<=2)
        })
      });

      assert.strictEqual(res.status, 201);

      const statusRes = await fetch(`${baseUrl}/api/hrv/status`, { headers: headers() });
      const statusData = await statusRes.json();
      assert.strictEqual(statusData.status.status, 'attention', '2 critical wellness factors must downgrade favorable -> attention');
      assert.strictEqual(statusData.status.suggested_action, 'reduce');
      assert.ok(statusData.status.explanation_text.includes('fatores de bem-estar estão críticos'));
    });

    await test('1.6 User updates wellness ratings to 3+ critical scores -> status recalculates to recovery', async () => {
      const res = await fetch(`${baseUrl}/api/hrv/wellness`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          sleep: 1,      // critical (<=2)
          fatigue: 5,    // critical (>=4)
          soreness: 4,   // critical (>=4)
          stress: 4,     // critical (>=4)
          readiness: 1   // critical (<=2)
        })
      });

      assert.strictEqual(res.status, 201);

      const statusRes = await fetch(`${baseUrl}/api/hrv/status`, { headers: headers() });
      const statusData = await statusRes.json();
      assert.strictEqual(statusData.status.status, 'recovery', '3+ critical wellness factors must downgrade to recovery');
      assert.ok(['rest', 'light'].includes(statusData.status.suggested_action));
    });

    await test('1.7 Order independence: Fresh user posts wellness BEFORE measurement, then records HRV', async () => {
      const freshUserId = uuidv4();
      const freshUserToken = generateAccessToken({ id: freshUserId, email: 'fresh2@rush.com', role: 'athlete', academy_id: null });

      db.prepare("INSERT INTO users (id, email, password_hash, role) VALUES (?, 'fresh2@rush.com', 'hash', 'athlete')").run(freshUserId);
      db.prepare("INSERT INTO user_profiles (user_id, name, username) VALUES (?, 'Fresh Two', 'fresh_two')").run(freshUserId);

      // Post wellness first with severe exhaustion
      const wRes = await fetch(`${baseUrl}/api/hrv/wellness`, {
        method: 'POST',
        headers: headers(freshUserToken),
        body: JSON.stringify({ sleep: 1, fatigue: 5, soreness: 5, stress: 5, readiness: 1 })
      });
      assert.strictEqual(wRes.status, 201);

      // Check status: has wellness, no measurement, status null
      const s1Res = await fetch(`${baseUrl}/api/hrv/status`, { headers: headers(freshUserToken) });
      const s1Data = await s1Res.json();
      assert.strictEqual(s1Data.has_wellness_today, true);
      assert.strictEqual(s1Data.has_measured_today, false);
      assert.strictEqual(s1Data.status, null);

      // Now post first HRV measurement
      const mRes = await fetch(`${baseUrl}/api/hrv/measurement`, {
        method: 'POST',
        headers: headers(freshUserToken),
        body: JSON.stringify({ rmssd_ms: 70, hr_rest_bpm: 50, duration_seconds: 60 })
      });
      assert.strictEqual(mRes.status, 201);
      const mData = await mRes.json();

      // Measurement should have combined with existing wellness scores to output recovery
      assert.strictEqual(mData.daily_status.status, 'recovery');

      const s2Res = await fetch(`${baseUrl}/api/hrv/status`, { headers: headers(freshUserToken) });
      const s2Data = await s2Res.json();
      assert.strictEqual(s2Data.has_measured_today, true);
      assert.strictEqual(s2Data.has_wellness_today, true);
      assert.strictEqual(s2Data.status.status, 'recovery');
    });

    await test('1.8 HRV measurement input validation (boundary checks and rejections)', async () => {
      // RMSSD < 10
      let res = await fetch(`${baseUrl}/api/hrv/measurement`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ rmssd_ms: 9, hr_rest_bpm: 60, duration_seconds: 60 })
      });
      assert.strictEqual(res.status, 400);

      // RMSSD > 200
      res = await fetch(`${baseUrl}/api/hrv/measurement`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ rmssd_ms: 201, hr_rest_bpm: 60, duration_seconds: 60 })
      });
      assert.strictEqual(res.status, 400);

      // HR Rest < 30
      res = await fetch(`${baseUrl}/api/hrv/measurement`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ rmssd_ms: 50, hr_rest_bpm: 29, duration_seconds: 60 })
      });
      assert.strictEqual(res.status, 400);

      // HR Rest > 120
      res = await fetch(`${baseUrl}/api/hrv/measurement`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ rmssd_ms: 50, hr_rest_bpm: 121, duration_seconds: 60 })
      });
      assert.strictEqual(res.status, 400);

      // Duration < 60
      res = await fetch(`${baseUrl}/api/hrv/measurement`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ rmssd_ms: 50, hr_rest_bpm: 60, duration_seconds: 59 })
      });
      assert.strictEqual(res.status, 400);

      // Missing fields
      res = await fetch(`${baseUrl}/api/hrv/measurement`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ rmssd_ms: 50 })
      });
      assert.strictEqual(res.status, 400);
    });

    await test('1.9 Wellness input validation (1-5 Likert scale constraints)', async () => {
      // Out of bounds (< 1)
      let res = await fetch(`${baseUrl}/api/hrv/wellness`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ sleep: 0, fatigue: 3, soreness: 3, stress: 3, readiness: 3 })
      });
      assert.strictEqual(res.status, 400);

      // Out of bounds (> 5)
      res = await fetch(`${baseUrl}/api/hrv/wellness`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ sleep: 3, fatigue: 6, soreness: 3, stress: 3, readiness: 3 })
      });
      assert.strictEqual(res.status, 400);

      // Missing field
      res = await fetch(`${baseUrl}/api/hrv/wellness`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ sleep: 3, fatigue: 3, soreness: 3, stress: 3 })
      });
      assert.strictEqual(res.status, 400);
    });

    // ==================================================================
    // SUITE 2: PERIODIZATION PLAN GENERATION MATRIX (12 COMBINATIONS)
    // ==================================================================
    console.log('\n--- SUITE 2: PERIODIZATION PLAN GENERATION MATRIX (12 COMBINATIONS) ---');

    const distances = [5, 10, 21, 42];
    const levels = ['beginner', 'intermediate', 'advanced'];

    for (const dist of distances) {
      for (const lvl of levels) {
        const dur = 12; // Standard 12-week periodization
        await test(`2.1 Matrix Generation: Plan ${dist}K - Level ${lvl} (${dur} weeks)`, async () => {
          const userForPlanId = uuidv4();
          const tokenForPlan = generateAccessToken({ id: userForPlanId, email: `matrix_${dist}_${lvl}@rush.com`, role: 'athlete', academy_id: null });

          db.prepare("INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, 'hash', 'athlete')").run(userForPlanId, `matrix_${dist}_${lvl}@rush.com`);
          db.prepare("INSERT INTO user_profiles (user_id, name, username) VALUES (?, 'Matrix User', ?)").run(userForPlanId, `matrix_${dist}_${lvl}`);

          const res = await fetch(`${baseUrl}/api/training/generate-plan`, {
            method: 'POST',
            headers: headers(tokenForPlan),
            body: JSON.stringify({
              distance_km: dist,
              level: lvl,
              duration_weeks: dur
            })
          });

          assert.strictEqual(res.status, 201, `Failed to generate plan for ${dist}k / ${lvl}`);
          const data = await res.json();

          // Check plan properties
          assert.strictEqual(data.plan.distance_km, dist);
          assert.strictEqual(data.plan.level, lvl);
          assert.strictEqual(data.plan.duration_weeks, dur);
          assert.ok(data.plan.name.includes(`${dist}K`));

          // Check assignment
          assert.ok(data.assignment != null);
          assert.strictEqual(data.assignment.start_date.split('T')[0], new Date().toISOString().split('T')[0]);

          // Check sessions collection
          const sessions = data.sessions;
          assert.ok(Array.isArray(sessions));

          // Expected weekly days per level
          const expectedDaysPerWeek = lvl === 'beginner' ? 3 : lvl === 'intermediate' ? 4 : 5;
          const expectedWeeklyDays = lvl === 'beginner' ? [2, 4, 6] : lvl === 'intermediate' ? [1, 3, 4, 6] : [1, 2, 3, 5, 6];

          // Verify week by week
          for (let w = 1; w <= dur; w++) {
            const weekSessions = sessions.filter(s => s.week_number === w);
            const isPeakWeek = (w === dur - 2);

            if (isPeakWeek) {
              // Peak test week has regular days + Sunday recovery session (day 7)
              assert.strictEqual(weekSessions.length, expectedDaysPerWeek + 1,
                `Week ${w} (Peak Test) for ${lvl} should have ${expectedDaysPerWeek + 1} sessions (including Sunday recovery)`);

              // Verify peak test session on Saturday (Day 6)
              const satSession = weekSessions.find(s => s.day_of_week === 6);
              assert.ok(satSession != null, `Week ${w} Saturday must have test session`);
              assert.strictEqual(satSession.type, 'test');
              assert.strictEqual(satSession.is_fixed, 1);
              assert.strictEqual(satSession.target_hr_zone, 'Z4');

              // Verify biomechanical distance scaling for peak test
              const expectedTestDist = dist <= 10 ? dist : +(dist / 2).toFixed(1);
              assert.strictEqual(satSession.distance_km, expectedTestDist,
                `Peak test distance for ${dist}k plan should be ${expectedTestDist}km`);

              // Verify Sunday recovery session (Day 7)
              const sunSession = weekSessions.find(s => s.day_of_week === 7);
              assert.ok(sunSession != null, `Week ${w} Sunday must have recovery session`);
              assert.strictEqual(sunSession.type, 'recovery');
              assert.strictEqual(sunSession.target_hr_zone, 'Z1');
              assert.strictEqual(sunSession.distance_km, 3.0);
            } else {
              assert.strictEqual(weekSessions.length, expectedDaysPerWeek,
                `Week ${w} for ${lvl} should have ${expectedDaysPerWeek} sessions`);

              // Verify assigned days match scheduled days
              const daysInWeek = weekSessions.map(s => s.day_of_week);
              assert.deepStrictEqual(daysInWeek, expectedWeeklyDays);

              // Saturday session must be long_run
              const satSession = weekSessions.find(s => s.day_of_week === 6);
              assert.ok(satSession != null);
              assert.strictEqual(satSession.type, 'long_run');
              assert.strictEqual(satSession.target_hr_zone, 'Z2');
            }
          }

          // Verify phase classification and volume progression
          const baseEnd = Math.round(dur * 0.33);
          const buildEnd = Math.round(dur * 0.66);

          // Long run distances in base week 1 vs build week vs taper
          const week1LongRun = sessions.find(s => s.week_number === 1 && s.day_of_week === 6);
          const buildLongRun = sessions.find(s => s.week_number === buildEnd && s.day_of_week === 6);
          const taperLongRun = sessions.find(s => s.week_number === dur && s.day_of_week === 6);

          assert.ok(buildLongRun.distance_km > week1LongRun.distance_km,
            `Build long run (${buildLongRun.distance_km}km) must be greater than base week 1 (${week1LongRun.distance_km}km)`);
          assert.ok(taperLongRun.distance_km < buildLongRun.distance_km,
            `Taper long run (${taperLongRun.distance_km}km) must be less than build long run (${buildLongRun.distance_km}km)`);
          assert.ok(taperLongRun.description.includes('(taper)'));
        });
      }
    }

    // ==================================================================
    // SUITE 3: PERIODIZATION DURATIONS (8, 12, 16, 24 WEEKS) & VALIDATION
    // ==================================================================
    console.log('\n--- SUITE 3: PERIODIZATION DURATIONS (8, 12, 16, 24 WEEKS) & VALIDATION ---');

    for (const edgeDur of [8, 16, 24]) {
      await test(`3.1 Periodization Duration: 21K Intermediate with ${edgeDur} weeks`, async () => {
        const uid = uuidv4();
        const tok = generateAccessToken({ id: uid, email: `dur_${edgeDur}@rush.com`, role: 'athlete', academy_id: null });
        db.prepare("INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, 'hash', 'athlete')").run(uid, `dur_${edgeDur}@rush.com`);
        db.prepare("INSERT INTO user_profiles (user_id, name, username) VALUES (?, 'Dur User', ?)").run(uid, `dur_${edgeDur}`);

        const res = await fetch(`${baseUrl}/api/training/generate-plan`, {
          method: 'POST',
          headers: headers(tok),
          body: JSON.stringify({ distance_km: 21, level: 'intermediate', duration_weeks: edgeDur })
        });

        assert.strictEqual(res.status, 201);
        const data = await res.json();
        assert.strictEqual(data.plan.duration_weeks, edgeDur);

        // Peak test week must always be edgeDur - 2
        const peakWeek = edgeDur - 2;
        const peakSessions = data.sessions.filter(s => s.week_number === peakWeek);
        const testSession = peakSessions.find(s => s.type === 'test');
        assert.ok(testSession != null, `Test session must exist at week ${peakWeek}`);
        assert.strictEqual(testSession.day_of_week, 6);
        assert.strictEqual(testSession.distance_km, 10.5); // 21 / 2
      });
    }

    await test('3.2 Validation on invalid generate-plan parameters', async () => {
      // Invalid distance (15km)
      let res = await fetch(`${baseUrl}/api/training/generate-plan`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ distance_km: 15, level: 'intermediate', duration_weeks: 12 })
      });
      assert.strictEqual(res.status, 400);

      // Invalid level ('ultra')
      res = await fetch(`${baseUrl}/api/training/generate-plan`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ distance_km: 10, level: 'ultra', duration_weeks: 12 })
      });
      assert.strictEqual(res.status, 400);

      // Invalid duration (< 4)
      res = await fetch(`${baseUrl}/api/training/generate-plan`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ distance_km: 10, level: 'intermediate', duration_weeks: 3 })
      });
      assert.strictEqual(res.status, 400);

      // Invalid duration (> 24)
      res = await fetch(`${baseUrl}/api/training/generate-plan`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ distance_km: 10, level: 'intermediate', duration_weeks: 25 })
      });
      assert.strictEqual(res.status, 400);
    });

    // ==================================================================
    // SUITE 4: TRAINING PLAN RETRIEVAL & INTEGRATION
    // ==================================================================
    console.log('\n--- SUITE 4: TRAINING PLAN RETRIEVAL & INTEGRATION ---');

    await test('4.1 Athlete with assigned plan retrieves active plan via GET /api/training/my-plan', async () => {
      // Generate a plan for athlete1
      const genRes = await fetch(`${baseUrl}/api/training/generate-plan`, {
        method: 'POST',
        headers: headers(athlete1Token),
        body: JSON.stringify({ distance_km: 10, level: 'intermediate', duration_weeks: 12 })
      });
      assert.strictEqual(genRes.status, 201);

      const res = await fetch(`${baseUrl}/api/training/my-plan`, { headers: headers(athlete1Token) });
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.strictEqual(data.has_plan, true);
      assert.ok(data.plan != null);
      assert.strictEqual(data.plan.distance_km, 10);
      assert.ok(typeof data.plan.current_week === 'number');
      assert.ok(Array.isArray(data.week_sessions));
      assert.ok(data.week_sessions.length > 0);
    });

    await test('4.2 Athlete without assigned plan receives has_plan: false from GET /api/training/my-plan', async () => {
      const freshAthleteId = uuidv4();
      const freshAthleteToken = generateAccessToken({ id: freshAthleteId, email: 'no_plan@rush.com', role: 'athlete', academy_id: null });
      db.prepare("INSERT INTO users (id, email, password_hash, role) VALUES (?, 'no_plan@rush.com', 'hash', 'athlete')").run(freshAthleteId);
      db.prepare("INSERT INTO user_profiles (user_id, name, username) VALUES (?, 'No Plan', 'no_plan')").run(freshAthleteId);

      const res = await fetch(`${baseUrl}/api/training/my-plan`, { headers: headers(freshAthleteToken) });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.has_plan, false);
      assert.strictEqual(data.plan, null);
      assert.strictEqual(data.today_session, null);
    });

    await test('4.3 GET /api/training/plans allows filtering by distance and level', async () => {
      const res = await fetch(`${baseUrl}/api/training/plans?distance_km=10&level=intermediate`, { headers: headers() });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.plans));
      assert.ok(data.plans.every(p => p.distance_km === 10 && p.level === 'intermediate'));
    });

    await test('4.4 Coach can manually create custom plan with sessions (POST /api/training/plans)', async () => {
      const res = await fetch(`${baseUrl}/api/training/plans`, {
        method: 'POST',
        headers: headers(coachToken),
        body: JSON.stringify({
          name: 'Plano Personalizado Coach 10K',
          distance_km: 10,
          duration_weeks: 8,
          level: 'advanced',
          description: 'Plano focado em VO2max',
          sessions: [
            { week_number: 1, day_of_week: 1, type: 'easy_run', distance_km: 8, duration_min: 45, target_hr_zone: 'Z2' },
            { week_number: 1, day_of_week: 3, type: 'interval', distance_km: 10, duration_min: 50, target_hr_zone: 'Z4' },
            { week_number: 1, day_of_week: 6, type: 'long_run', distance_km: 16, duration_min: 90, target_hr_zone: 'Z2' },
          ]
        })
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.plan.name, 'Plano Personalizado Coach 10K');
      assert.strictEqual(data.sessions.length, 3);
    });

    await test('4.5 Athlete cannot create plan directly via POST /api/training/plans (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/training/plans`, {
        method: 'POST',
        headers: headers(athlete1Token), // athlete role
        body: JSON.stringify({
          name: 'Plano Atleta',
          distance_km: 10,
          duration_weeks: 8,
          level: 'beginner'
        })
      });

      assert.strictEqual(res.status, 403);
    });

    // ==================================================================
    // SUITE 5: REST DAYS POSITIONING & BIOMECHANICAL SPACING
    // ==================================================================
    console.log('\n--- SUITE 5: REST DAYS POSITIONING & BIOMECHANICAL SPACING ---');

    await test('5.1 Rest day verification: Beginner level has guaranteed recovery days between workouts', async () => {
      // Beginner workout days are Tue (2), Thu (4), Sat (6)
      // Rest days are Mon (1), Wed (3), Fri (5), Sun (7)
      const u = uuidv4();
      const tok = generateAccessToken({ id: u, email: 'rest_beg@rush.com', role: 'athlete', academy_id: null });
      db.prepare("INSERT INTO users (id, email, password_hash, role) VALUES (?, 'rest_beg@rush.com', 'hash', 'athlete')").run(u);
      db.prepare("INSERT INTO user_profiles (user_id, name, username) VALUES (?, 'Rest Beg', 'rest_beg')").run(u);

      const res = await fetch(`${baseUrl}/api/training/generate-plan`, {
        method: 'POST', headers: headers(tok),
        body: JSON.stringify({ distance_km: 5, level: 'beginner', duration_weeks: 8 })
      });
      const data = await res.json();

      // Check non-peak weeks have exact spacing
      for (let w = 1; w <= 8; w++) {
        if (w === 6) continue; // peak week has Sunday recovery
        const weekDays = data.sessions.filter(s => s.week_number === w).map(s => s.day_of_week);
        assert.deepStrictEqual(weekDays, [2, 4, 6], `Week ${w} must have non-consecutive days`);
      }
    });

    await test('5.2 Rest day verification: Advanced level has rest day (Thu/Sun) and no two high-intensity days adjacent', async () => {
      // Advanced workout days are Mon (1), Tue (2), Wed (3), Fri (5), Sat (6)
      // Day 1: easy_run, Day 2: interval/tempo, Day 3: easy_run, Day 4: REST, Day 5: easy_run, Day 6: long_run, Day 7: REST
      const u = uuidv4();
      const tok = generateAccessToken({ id: u, email: 'rest_adv@rush.com', role: 'athlete', academy_id: null });
      db.prepare("INSERT INTO users (id, email, password_hash, role) VALUES (?, 'rest_adv@rush.com', 'hash', 'athlete')").run(u);
      db.prepare("INSERT INTO user_profiles (user_id, name, username) VALUES (?, 'Rest Adv', 'rest_adv')").run(u);

      const res = await fetch(`${baseUrl}/api/training/generate-plan`, {
        method: 'POST', headers: headers(tok),
        body: JSON.stringify({ distance_km: 42, level: 'advanced', duration_weeks: 16 })
      });
      const data = await res.json();

      for (let w = 1; w <= 16; w++) {
        const weekSessions = data.sessions.filter(s => s.week_number === w);
        const day2 = weekSessions.find(s => s.day_of_week === 2);
        const day3 = weekSessions.find(s => s.day_of_week === 3);

        if (day2 && ['interval', 'tempo'].includes(day2.type)) {
          // Day 3 immediately following MUST be easy_run
          assert.strictEqual(day3.type, 'easy_run', `Day 3 after high intensity day 2 in week ${w} must be easy_run`);
        }
      }
    });

  } finally {
    server.close();
  }

  console.log('\n========================================================');
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED:      ${passedTests}`);
  console.log(`FAILED:      ${failedTests}`);
  console.log('========================================================\n');

  if (failedTests > 0) {
    console.error('Failed test details:');
    failures.forEach(f => {
      console.error(`- ${f.name}: ${f.error.message}`);
    });
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
