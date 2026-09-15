// ============================================================
// End-to-End HTTP Routes Test for HRV & Training Endpoints
// ============================================================

const assert = require('assert');
const express = require('express');
// Adaptador em vez do driver cru: as rotas agora usam transação
// assíncrona, que o better-sqlite3 recusa.
const { Database } = require('../database/sqlite');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const initializeDatabase = require('../database/schema');
const { generateAccessToken } = require('../middleware/auth');
const hrvRoutes = require('../routes/hrv');
const trainingRoutes = require('../routes/training');
const usersRoutes = require('../routes/users');

console.log('🧪 Starting End-to-End HTTP Route Tests...\n');

let passedTests = 0;
let totalTests = 0;

async function it(description, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ ${description}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function run() {
  const db = new Database(':memory:');
  await initializeDatabase(db);

  // Setup test user
  const userId = uuidv4();
  const token = generateAccessToken({ id: userId, email: 'e2e@rush.com', role: 'athlete', academy_id: null });

  await db.prepare(`
    INSERT INTO users (id, email, password_hash, role)
    VALUES (?, 'e2e@rush.com', 'hash', 'athlete')
  `).run(userId);

  await db.prepare(`
    INSERT INTO user_profiles (user_id, name, username)
    VALUES (?, 'E2E Athlete', 'e2e_athlete')
  `).run(userId);

  const app = express();
  app.use(express.json());
  app.use('/api/hrv', hrvRoutes(db));
  app.use('/api/training', trainingRoutes(db));
  // O VO2máx é gravado pelo teste de campo, que vive nas rotas de usuário.
  app.use('/api/users', usersRoutes(db));

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ------------------------------------------------------------------
    // Test 1: Day-1 Measurement POST /api/hrv/measurement
    // ------------------------------------------------------------------
    await it('POST /api/hrv/measurement on Day 1 returns 201 with complete status & stats', async () => {
      const res = await fetch(`${baseUrl}/api/hrv/measurement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rmssd_ms: 60,
          hr_rest_bpm: 54,
          duration_seconds: 60
        })
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.ok(data.measurement != null);
      assert.strictEqual(data.measurement.rmssd_ms, 60);
      assert.ok(data.daily_status != null, 'Day 1 daily_status must be present in response');
      assert.strictEqual(data.daily_status.status, 'favorable');
      assert.strictEqual(data.stats_7d.is_baseline_learning, true);
    });

    // ------------------------------------------------------------------
    // Test 2: GET /api/hrv/status on Day 1
    // ------------------------------------------------------------------
    await it('GET /api/hrv/status returns the day 1 status and measurement flag', async () => {
      const res = await fetch(`${baseUrl}/api/hrv/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.has_measured_today, true);
      assert.ok(data.status != null);
      assert.strictEqual(data.status.status, 'favorable');
    });

    // ------------------------------------------------------------------
    // Test 3: POST /api/hrv/wellness updates daily_status dynamically
    // ------------------------------------------------------------------
    await it('POST /api/hrv/wellness updates daily_status if measurement exists', async () => {
      // Post high fatigue/stress
      const res = await fetch(`${baseUrl}/api/hrv/wellness`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sleep: 1, // critical (<=2)
          fatigue: 5, // critical (>=4)
          soreness: 5, // critical (>=4)
          stress: 5, // critical (>=4)
          readiness: 1 // critical (<=2)
        })
      });

      assert.strictEqual(res.status, 201);

      // Verify status was updated to recovery
      const statusRes = await fetch(`${baseUrl}/api/hrv/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statusData = await statusRes.json();
      assert.strictEqual(statusData.status.status, 'recovery', 'Critical wellness must downgrade status to recovery');
    });

    // ------------------------------------------------------------------
    // Test 4: POST /api/training/generate-plan
    // ------------------------------------------------------------------
    await it('POST /api/training/generate-plan creates and assigns 4-phase periodized plan', async () => {
      const res = await fetch(`${baseUrl}/api/training/generate-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          distance_km: 10,
          level: 'intermediate',
          duration_weeks: 12
        })
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.ok(data.plan != null);
      assert.strictEqual(data.plan.distance_km, 10);
      assert.strictEqual(data.plan.duration_weeks, 12);
      assert.ok(data.sessions.length > 0);

      // Verify peak test week session placement
      const week10Sessions = data.sessions.filter(s => s.week_number === 10);
      const testSession = week10Sessions.find(s => s.type === 'test');
      assert.ok(testSession != null, 'Week 10 peak must have a test session');
      assert.strictEqual(testSession.day_of_week, 6, 'Test session must be on Saturday (day 6)');
      assert.strictEqual(testSession.is_fixed, 1);

      const sundaySession = week10Sessions.find(s => s.day_of_week === 7);
      assert.ok(sundaySession != null);
      assert.strictEqual(sundaySession.type, 'recovery', 'Sunday session after test must be recovery');
    });

    // ------------------------------------------------------------------
    // Test 5: GET /api/training/my-plan
    // ------------------------------------------------------------------
    await it('GET /api/training/my-plan returns active plan and current week sessions', async () => {
      const res = await fetch(`${baseUrl}/api/training/my-plan`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.has_plan, true);
      assert.ok(data.plan != null);
      assert.ok(Array.isArray(data.week_sessions));
    });

    // ------------------------------------------------------------------
    // Test 6: GET /api/hrv/history
    // ------------------------------------------------------------------
    await it('GET /api/hrv/history returns measurements and status history', async () => {
      const res = await fetch(`${baseUrl}/api/hrv/history?days=7`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.measurements));
      assert.strictEqual(data.days_range, 7);
      assert.strictEqual(data.total_measurements, 1);
    });

    // ------------------------------------------------------------------
    // Test 7: VO2max — só entra pelo teste de campo
    // ------------------------------------------------------------------
    // Não existe POST /api/hrv/vo2max por decisão de projeto: o VO2máx é
    // derivado de uma medição real (Cooper de 12 min, POST /users/field-test),
    // e não de um número digitado. Este teste fixa esse contrato.
    await it('VO2máx é gravado pelo teste de campo e lido em GET /api/hrv/vo2max', async () => {
      const notImplemented = await fetch(`${baseUrl}/api/hrv/vo2max`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ vo2max_value: 52.4, method: 'cooper_12min' }),
      });
      assert.strictEqual(notImplemented.status, 404, 'VO2máx não pode ser informado diretamente');

      const fieldTest = await fetch(`${baseUrl}/api/users/field-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          test_type: 'cooper_12min',
          distance_km: 2.85,
          duration_seconds: 720,
          avg_hr: 168,
          max_hr: 186,
          rest_hr: 54,
        }),
      });
      const fieldTestBody = await fieldTest.json().catch(() => ({}));
      assert.ok(
        [200, 201].includes(fieldTest.status),
        `teste de campo deve ser aceito (status ${fieldTest.status}: ${JSON.stringify(fieldTestBody)})`,
      );

      const getRes = await fetch(`${baseUrl}/api/hrv/vo2max`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      assert.strictEqual(getRes.status, 200);
      const data = await getRes.json();
      assert.strictEqual(data.has_estimate, true);
      // Cooper (1968): VO2máx = (metros - 504.9) / 44.73
      const expected = +(((2.85 * 1000) - 504.9) / 44.73).toFixed(1);
      assert.ok(
        Math.abs(data.vo2max - expected) < 1,
        `VO2máx deve seguir a fórmula de Cooper (esperado ~${expected}, recebido ${data.vo2max})`,
      );
      assert.ok(Array.isArray(data.history));
    });

  } finally {
    server.close();
  }

  console.log(`\n========================================`);
  console.log(`E2E Tests Passed: ${passedTests} / ${totalTests}`);
  console.log(`========================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

run();
