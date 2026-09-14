// ============================================================
// RUSH PERFORMANCE — M4 Challenger 1: Master Adversarial Stress Suite
// Exhaustive Route Error Handling, Input Validation & Security Verification
// ============================================================

const assert = require('assert');
const http = require('http');
const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Backend Modules
const initializeDatabase = require('../database/schema');
const { JWT_SECRET, generateAccessToken } = require('../middleware/auth');
const authRoutes = require('../routes/auth');
const usersRoutes = require('../routes/users');
const hrvRoutes = require('../routes/hrv');
const trainingRoutes = require('../routes/training');
const activitiesRoutes = require('../routes/activities');
const socialRoutes = require('../routes/social');
const challengesRoutes = require('../routes/challenges');
const academiesRoutes = require('../routes/academies');
const notificationsRoutes = require('../routes/notifications');

console.log('⚡ ============================================================');
console.log('⚡ RUSH-APP: M4 CHALLENGER 1 — MASTER ADVERSARIAL TEST SUITE');
console.log('⚡ Route Robustness, Error Handling & Attack Vector Stress');
console.log('⚡ ============================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

async function it(title, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${title}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${title}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
    failures.push({ title, error: err.message, stack: err.stack });
    process.exitCode = 1;
  }
}

let server;
let baseUrl;
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });

function request(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(urlPath, baseUrl);
    const reqOptions = {
      method,
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: targetUrl.pathname + targetUrl.search,
      agent: httpAgent,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = data ? JSON.parse(data) : {};
        } catch {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);

    if (body !== null) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function expectErrorResponse(res, expectedStatus, expectedErrorSnippet = null) {
  assert.strictEqual(
    res.status,
    expectedStatus,
    `Expected HTTP ${expectedStatus}, but got HTTP ${res.status}: ${JSON.stringify(res.body)}`
  );
  assert(
    typeof res.body === 'object' && res.body !== null,
    `Response body must be JSON object, got: ${typeof res.body}`
  );
  assert(
    typeof res.body.error === 'string' && res.body.error.length > 0,
    `Response body must contain non-empty 'error' string, got: ${JSON.stringify(res.body)}`
  );
  if (expectedErrorSnippet) {
    assert(
      res.body.error.toLowerCase().includes(expectedErrorSnippet.toLowerCase()),
      `Expected error message to include '${expectedErrorSnippet}', but got: '${res.body.error}'`
    );
  }
}

async function runAdversarialSuite() {
  const db = new Database(':memory:');
  process.env.NODE_ENV = 'test';
  process.env.QUIET = 'true';
  await initializeDatabase(db);

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes(db));
  app.use('/api/users', usersRoutes(db));
  app.use('/api/hrv', hrvRoutes(db));
  app.use('/api/training', trainingRoutes(db));
  app.use('/api/activities', activitiesRoutes(db));
  app.use('/api/social', socialRoutes(db));
  app.use('/api/challenges', challengesRoutes(db));
  app.use('/api/academies', academiesRoutes(db));
  app.use('/api/notifications', notificationsRoutes(db));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy' });
  });

  // Global unhandled error handler
  app.use((err, req, res, next) => {
    res.status(500).json({ error: 'Erro interno do servidor', message: err.message });
  });

  // Global 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint não encontrado', path: req.path });
  });

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  // Seed baseline test entities
  const passwordHash = bcrypt.hashSync('123456', 10);
  const ACADEMY_ID = '00000000-0000-4000-8000-000000000010';
  const OWNER_ID = '00000000-0000-4000-8000-000000000001';
  const COACH_ID = '00000000-0000-4000-8000-000000000002';
  const ATHLETE_ID = '00000000-0000-4000-8000-000000000003';
  const PEER_ATHLETE_ID = '00000000-0000-4000-8000-000000000004';
  const UNLINKED_COACH_ID = '00000000-0000-4000-8000-000000000005';

  db.prepare('INSERT INTO users (id, email, password_hash, role, academy_id) VALUES (?, ?, ?, ?, ?)').run(OWNER_ID, 'owner@rush.com', passwordHash, 'owner', ACADEMY_ID);
  db.prepare('INSERT INTO user_profiles (user_id, name, username) VALUES (?, ?, ?)').run(OWNER_ID, 'Academy Owner', 'academy_owner');
  db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(OWNER_ID);
  db.prepare('INSERT INTO privacy_settings (user_id) VALUES (?)').run(OWNER_ID);

  db.prepare('INSERT INTO users (id, email, password_hash, role, academy_id) VALUES (?, ?, ?, ?, ?)').run(COACH_ID, 'coach@rush.com', passwordHash, 'coach', ACADEMY_ID);
  db.prepare('INSERT INTO user_profiles (user_id, name, username) VALUES (?, ?, ?)').run(COACH_ID, 'Carlos Coach', 'coach_carlos');
  db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(COACH_ID);
  db.prepare('INSERT INTO privacy_settings (user_id) VALUES (?)').run(COACH_ID);

  db.prepare('INSERT INTO users (id, email, password_hash, role, academy_id) VALUES (?, ?, ?, ?, ?)').run(UNLINKED_COACH_ID, 'unlinked_coach@rush.com', passwordHash, 'coach', null);
  db.prepare('INSERT INTO user_profiles (user_id, name, username) VALUES (?, ?, ?)').run(UNLINKED_COACH_ID, 'Unlinked Coach', 'unlinked_coach');
  db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(UNLINKED_COACH_ID);
  db.prepare('INSERT INTO privacy_settings (user_id) VALUES (?)').run(UNLINKED_COACH_ID);

  db.prepare('INSERT INTO users (id, email, password_hash, role, academy_id) VALUES (?, ?, ?, ?, ?)').run(ATHLETE_ID, 'athlete@rush.com', passwordHash, 'athlete', ACADEMY_ID);
  db.prepare('INSERT INTO user_profiles (user_id, name, username) VALUES (?, ?, ?)').run(ATHLETE_ID, 'Alessandro Atleta', 'alessandro_runner');
  db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(ATHLETE_ID);
  db.prepare('INSERT INTO privacy_settings (user_id) VALUES (?)').run(ATHLETE_ID);
  db.prepare('INSERT INTO user_objectives (user_id, distance_km, level) VALUES (?, ?, ?)').run(ATHLETE_ID, 21, 'intermediate');

  db.prepare('INSERT INTO users (id, email, password_hash, role, academy_id) VALUES (?, ?, ?, ?, ?)').run(PEER_ATHLETE_ID, 'peer@rush.com', passwordHash, 'athlete', null);
  db.prepare('INSERT INTO user_profiles (user_id, name, username) VALUES (?, ?, ?)').run(PEER_ATHLETE_ID, 'Peer Runner', 'peer_runner');
  db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(PEER_ATHLETE_ID);
  db.prepare('INSERT INTO privacy_settings (user_id) VALUES (?)').run(PEER_ATHLETE_ID);

  db.prepare(`
    INSERT INTO academies (id, name, owner_id, plan_type, max_athletes)
    VALUES (?, ?, ?, 'pro', 150)
  `).run(ACADEMY_ID, 'Rush Elite Academy', OWNER_ID);

  const athleteToken = generateAccessToken({ id: ATHLETE_ID, email: 'athlete@rush.com', role: 'athlete', academy_id: ACADEMY_ID });
  const coachToken = generateAccessToken({ id: COACH_ID, email: 'coach@rush.com', role: 'coach', academy_id: ACADEMY_ID });
  const unlinkedCoachToken = generateAccessToken({ id: UNLINKED_COACH_ID, email: 'unlinked_coach@rush.com', role: 'coach', academy_id: null });
  const peerToken = generateAccessToken({ id: PEER_ATHLETE_ID, email: 'peer@rush.com', role: 'athlete', academy_id: null });

  const athleteAuth = { Authorization: `Bearer ${athleteToken}` };
  const coachAuth = { Authorization: `Bearer ${coachToken}` };
  const unlinkedCoachAuth = { Authorization: `Bearer ${unlinkedCoachToken}` };
  const peerAuth = { Authorization: `Bearer ${peerToken}` };

  console.log('\n============================================================');
  console.log('📌 SUITE 1: AUTHENTICATION & TOKEN ADVERSARIAL STRESS');
  console.log('============================================================');

  await it('1.1 Protected endpoints reject missing Authorization header with 401 and JSON error', async () => {
    const endpoints = [
      { method: 'GET', path: '/api/auth/me' },
      { method: 'POST', path: '/api/auth/logout' },
      { method: 'GET', path: '/api/users/me' },
      { method: 'GET', path: '/api/users/profile' },
      { method: 'PUT', path: '/api/users/profile', body: { name: 'Test' } },
      { method: 'PUT', path: '/api/users/objectives', body: { distance_km: 10, level: 'beginner' } },
      { method: 'GET', path: '/api/hrv/status' },
      { method: 'POST', path: '/api/hrv/measurement', body: { rmssd_ms: 50, hr_rest_bpm: 60, duration_seconds: 60 } },
      { method: 'GET', path: '/api/training/my-plan' },
      { method: 'GET', path: '/api/activities' },
      { method: 'GET', path: '/api/social/feed' },
      { method: 'GET', path: '/api/challenges' },
      { method: 'GET', path: '/api/notifications' },
    ];

    for (const ep of endpoints) {
      const res = await request(ep.method, ep.path, ep.body || null);
      expectErrorResponse(res, 401, 'Token de acesso não fornecido');
    }
  });

  await it('1.2 Protected endpoints reject malformed Bearer formats with 401 and JSON error', async () => {
    const malformedHeaders = [
      { Authorization: 'Bearer' },
      { Authorization: 'Bearer ' },
      { Authorization: 'Basic dXNlcjpwYXNz' },
      { Authorization: 'Token abcdef123456' },
      { Authorization: 'Bearer invalid_signature_jwt_token_payload' },
      { Authorization: `Bearer ${jwt.sign({ id: ATHLETE_ID }, 'wrong_secret_key_12345')}` },
    ];

    for (const headers of malformedHeaders) {
      const res = await request('GET', '/api/users/me', null, headers);
      expectErrorResponse(res, 401);
    }
  });

  await it('1.3 Protected endpoints reject expired JWT token with 401 and code TOKEN_EXPIRED', async () => {
    const expiredToken = jwt.sign(
      { id: ATHLETE_ID, email: 'athlete@rush.com', role: 'athlete' },
      JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const res = await request('GET', '/api/users/me', null, { Authorization: `Bearer ${expiredToken}` });
    expectErrorResponse(res, 401, 'Token expirado');
    assert.strictEqual(res.body.code, 'TOKEN_EXPIRED');
  });

  await it('1.4 Role authorization barrier: Athlete is forbidden (403) from coach/owner endpoints', async () => {
    const coachOnlyEndpoints = [
      { method: 'POST', path: '/api/training/plans', body: { name: 'Plano', distance_km: 10, duration_weeks: 8, level: 'beginner' } },
      { method: 'POST', path: '/api/training/assign', body: { user_id: ATHLETE_ID, plan_id: 'plan-1', start_date: '2026-09-01' } },
      { method: 'GET', path: '/api/academies/my' },
      { method: 'GET', path: '/api/academies/dashboard' },
      { method: 'POST', path: '/api/academies/invite', body: { email: 'invite@rush.com' } },
      { method: 'GET', path: `/api/academies/athlete/${ATHLETE_ID}` },
      { method: 'POST', path: '/api/challenges', body: { name: 'Desafio', type: 'distance', target_value: 50, target_unit: 'km', start_date: '2026-09-01', end_date: '2026-09-30' } },
    ];

    for (const ep of coachOnlyEndpoints) {
      const res = await request(ep.method, ep.path, ep.body || null, athleteAuth);
      expectErrorResponse(res, 403, 'Acesso não autorizado');
    }
  });

  console.log('\n============================================================');
  console.log('📌 SUITE 2: REGISTRATION & LOGIN ADVERSARIAL STRESS');
  console.log('============================================================');

  await it('2.1 Register rejects empty or missing required fields with 400', async () => {
    const invalidPayloads = [
      {},
      { email: 'new@rush.com' },
      { email: 'new@rush.com', password: 'password123' },
      { email: 'new@rush.com', password: 'password123', name: 'Name' },
      { name: 'Name', username: 'username_test' },
      { email: '', password: '', name: '', username: '' },
    ];

    for (const body of invalidPayloads) {
      const res = await request('POST', '/api/auth/register', body);
      expectErrorResponse(res, 400, 'Campos obrigatórios');
    }
  });

  await it('2.2 Register rejects invalid email formats with 400', async () => {
    const badEmails = [
      'plainaddress',
      '#@%^%#$@#$@#.com',
      '@example.com',
      'Joe Smith <email@example.com>',
      'email.example.com',
      'email@example@example.com',
      'email with spaces@domain.com',
    ];

    for (const email of badEmails) {
      const res = await request('POST', '/api/auth/register', {
        email,
        password: 'password123',
        name: 'Bad Email User',
        username: 'bad_email_usr',
      });
      expectErrorResponse(res, 400, 'Formato de email inválido');
    }
  });

  await it('2.3 Register rejects invalid usernames (length/characters) with 400', async () => {
    const badUsernames = [
      'ab',                       // Too short (< 3)
      'a'.repeat(31),              // Too long (> 30)
      'user@name',                // Disallowed special chars
      'user-name',                // Hyphen not allowed by regex /^[a-z0-9_]{3,30}$/
      'user name',                // Space
      'user$123',                 // Special char
    ];

    for (const username of badUsernames) {
      const res = await request('POST', '/api/auth/register', {
        email: `valid_${Math.random().toString(36).substring(7)}@rush.com`,
        password: 'password123',
        name: 'Valid Name',
        username,
      });
      expectErrorResponse(res, 400, 'Username');
    }
  });

  await it('2.4 Register rejects short password (< 6 chars) with 400', async () => {
    const res = await request('POST', '/api/auth/register', {
      email: 'shortpass@rush.com',
      password: '12345',
      name: 'Short Pass',
      username: 'short_pass_user',
    });
    expectErrorResponse(res, 400, 'Senha deve ter pelo menos 6 caracteres');
  });

  await it('2.5 Register rejects duplicate email (409) and duplicate username (409)', async () => {
    // Duplicate email
    const resDupEmail = await request('POST', '/api/auth/register', {
      email: 'athlete@rush.com',
      password: 'password123',
      name: 'Duplicate Athlete',
      username: 'unique_user_name_99',
    });
    expectErrorResponse(resDupEmail, 409, 'Email já cadastrado');

    // Duplicate username
    const resDupUser = await request('POST', '/api/auth/register', {
      email: 'fresh_unique_email_88@rush.com',
      password: 'password123',
      name: 'Duplicate Username',
      username: 'alessandro_runner',
    });
    expectErrorResponse(resDupUser, 409, 'Username já em uso');
  });

  await it('2.6 SQL injection strings in registration and login are safely handled without 500 crashes', async () => {
    const sqliStrings = [
      "' OR '1'='1",
      "admin' --",
      "'; DROP TABLE users; --",
      "' UNION SELECT null, null, null, null --",
      "' OR 1=1 --",
      `" OR ""="`,
    ];

    for (const sqli of sqliStrings) {
      // Login SQLi attempt
      const resLogin = await request('POST', '/api/auth/login', {
        email: sqli,
        password: sqli,
      });
      expectErrorResponse(resLogin, 401, 'Email ou senha incorretos');

      // Register SQLi attempt
      const resReg = await request('POST', '/api/auth/register', {
        email: `${sqli}@attack.com`,
        password: 'password123',
        name: sqli,
        username: 'sqli_attacker',
      });
      assert([400, 409].includes(resReg.status), `Expected 400/409 for SQLi register, got ${resReg.status}`);
      assert(typeof resReg.body.error === 'string');
    }
  });

  await it('2.7 Refresh token rejects missing, corrupted, or unauthenticated tokens with 400/401', async () => {
    // Missing token
    const resMissing = await request('POST', '/api/auth/refresh', {});
    expectErrorResponse(resMissing, 400, 'Refresh token obrigatório');

    // Corrupted token
    const resCorrupt = await request('POST', '/api/auth/refresh', { refresh_token: 'corrupted.jwt.string' });
    expectErrorResponse(resCorrupt, 401, 'Refresh token inválido');

    // Valid JWT signature but not in DB
    const ghostToken = jwt.sign({ id: ATHLETE_ID, type: 'refresh' }, JWT_SECRET);
    const resGhost = await request('POST', '/api/auth/refresh', { refresh_token: ghostToken });
    expectErrorResponse(resGhost, 401, 'não encontrado');
  });

  console.log('\n============================================================');
  console.log('📌 SUITE 3: USERS & PROFILES ADVERSARIAL STRESS');
  console.log('============================================================');

  await it('3.1 PUT /api/users/profile rejects empty update body with 400', async () => {
    const res = await request('PUT', '/api/users/profile', {}, athleteAuth);
    expectErrorResponse(res, 400, 'Nenhum campo para atualizar');
  });

  await it('3.2 PUT /api/users/profile rejects out-of-bounds weight, height, and gender with 400', async () => {
    // Negative weight
    const resNegWeight = await request('PUT', '/api/users/profile', { weight_kg: -10 }, athleteAuth);
    expectErrorResponse(resNegWeight, 400, 'weight_kg');

    // Extreme weight
    const resExtremeWeight = await request('PUT', '/api/users/profile', { weight_kg: 999 }, athleteAuth);
    expectErrorResponse(resExtremeWeight, 400, 'weight_kg');

    // Negative height
    const resNegHeight = await request('PUT', '/api/users/profile', { height_cm: 20 }, athleteAuth);
    expectErrorResponse(resNegHeight, 400, 'height_cm');

    // Extreme height
    const resExtremeHeight = await request('PUT', '/api/users/profile', { height_cm: 400 }, athleteAuth);
    expectErrorResponse(resExtremeHeight, 400, 'height_cm');

    // Invalid gender enum
    const resBadGender = await request('PUT', '/api/users/profile', { gender: 'alien_cyborg' }, athleteAuth);
    expectErrorResponse(resBadGender, 400, 'gender inválido');
  });

  await it('3.3 PUT /api/users/profile rejects username collision with 409', async () => {
    const res = await request('PUT', '/api/users/profile', { username: 'coach_carlos' }, athleteAuth);
    expectErrorResponse(res, 409, 'Username já em uso');
  });

  await it('3.4 PUT /api/users/objectives rejects invalid distances and invalid levels with 400', async () => {
    const invalidDistances = [-1, 0, 3, 7, 15, 30, 100];
    for (const distance_km of invalidDistances) {
      const res = await request('PUT', '/api/users/objectives', { distance_km, level: 'intermediate' }, athleteAuth);
      expectErrorResponse(res, 400);
    }

    const invalidLevels = ['olympian', 'amateur', 'god_level', 123];
    for (const level of invalidLevels) {
      const res = await request('PUT', '/api/users/objectives', { distance_km: 21, level }, athleteAuth);
      expectErrorResponse(res, 400, 'level deve ser beginner, intermediate ou advanced');
    }
  });

  await it('3.5 GET /api/users/:username returns 404 for non-existent users and handles SQLi paths safely', async () => {
    const res404 = await request('GET', '/api/users/non_existent_ghost_user_9999', null, athleteAuth);
    expectErrorResponse(res404, 404, 'Usuário não encontrado');

    const resSqli = await request('GET', '/api/users/' + encodeURIComponent("' OR '1'='1"), null, athleteAuth);
    expectErrorResponse(resSqli, 404, 'Usuário não encontrado');
  });

  await it('3.6 PUT /api/users/settings rejects empty body with 400', async () => {
    const res = await request('PUT', '/api/users/settings', {}, athleteAuth);
    expectErrorResponse(res, 400, 'Nenhum campo para atualizar');
  });

  await it('3.7 PUT /api/users/privacy updates successfully and returns structured JSON', async () => {
    const res = await request('PUT', '/api/users/privacy', {
      public_activities: false,
      show_hrv_status: true,
    }, athleteAuth);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.public_activities, 0);
    assert.strictEqual(res.body.show_hrv_status, 1);
  });

  console.log('\n============================================================');
  console.log('📌 SUITE 4: HRV, WELLNESS & VO2MAX ADVERSARIAL STRESS');
  console.log('============================================================');

  await it('4.1 POST /api/hrv/measurement rejects missing fields with 400', async () => {
    const invalidPayloads = [
      {},
      { rmssd_ms: 45 },
      { rmssd_ms: 45, hr_rest_bpm: 55 },
      { hr_rest_bpm: 55, duration_seconds: 60 },
    ];

    for (const body of invalidPayloads) {
      const res = await request('POST', '/api/hrv/measurement', body, athleteAuth);
      expectErrorResponse(res, 400, 'obrigatórios');
    }
  });

  await it('4.2 POST /api/hrv/measurement rejects out-of-range RMSSD (< 10 or > 200 ms) with 400', async () => {
    const badRmssd = [-50, 0, 5, 9.9, 200.1, 999, 'not_a_number'];
    for (const rmssd_ms of badRmssd) {
      const res = await request('POST', '/api/hrv/measurement', {
        rmssd_ms,
        hr_rest_bpm: 60,
        duration_seconds: 60,
      }, athleteAuth);
      expectErrorResponse(res, 400);
    }
  });

  await it('4.3 POST /api/hrv/measurement rejects out-of-range Resting HR (< 30 or > 120 bpm) with 400', async () => {
    const badHr = [-10, 0, 25, 29, 121, 200, 999, 'bpm_invalid'];
    for (const hr_rest_bpm of badHr) {
      const res = await request('POST', '/api/hrv/measurement', {
        rmssd_ms: 50,
        hr_rest_bpm,
        duration_seconds: 60,
      }, athleteAuth);
      expectErrorResponse(res, 400);
    }
  });

  await it('4.4 POST /api/hrv/measurement rejects duration < 60 seconds with 400', async () => {
    const badDurations = [-60, 0, 30, 59, 'quick_test'];
    for (const duration_seconds of badDurations) {
      const res = await request('POST', '/api/hrv/measurement', {
        rmssd_ms: 50,
        hr_rest_bpm: 60,
        duration_seconds,
      }, athleteAuth);
      expectErrorResponse(res, 400);
    }
  });

  await it('4.5 POST /api/hrv/wellness rejects missing fields and out-of-range (1-5) Likert scores with 400', async () => {
    // Missing fields
    const resMissing = await request('POST', '/api/hrv/wellness', { sleep: 3, fatigue: 3 }, athleteAuth);
    expectErrorResponse(resMissing, 400, 'Todos os campos são obrigatórios');

    // Out of range (0, 6, -1, 100, NaN)
    const badScores = [
      { sleep: 0, fatigue: 3, soreness: 3, stress: 3, readiness: 3 },
      { sleep: 3, fatigue: 6, soreness: 3, stress: 3, readiness: 3 },
      { sleep: 3, fatigue: 3, soreness: -1, stress: 3, readiness: 3 },
      { sleep: 3, fatigue: 3, soreness: 3, stress: 10, readiness: 3 },
      { sleep: 3, fatigue: 3, soreness: 3, stress: 3, readiness: 'great' },
    ];

    for (const body of badScores) {
      const res = await request('POST', '/api/hrv/wellness', body, athleteAuth);
      expectErrorResponse(res, 400, 'Valores da escala de bem-estar devem estar entre 1 e 5');
    }
  });

  await it('4.6 VO2máx não aceita valor informado direto; o teste de campo valida a entrada', async () => {
    // Decisão de projeto: não existe POST /api/hrv/vo2max. O VO2máx vem de
    // uma medição (Cooper de 12 min), não de um número digitado pelo atleta.
    const res = await request('POST', '/api/hrv/vo2max', { vo2max_value: 50, method: 'cooper_test' }, athleteAuth);
    assert.strictEqual(res.status, 404, 'POST /api/hrv/vo2max não deve existir');

    // O caminho legítimo rejeita entrada incompleta.
    const semTipo = await request('POST', '/api/users/field-test', { distance_km: 2.8 }, athleteAuth);
    expectErrorResponse(semTipo, 400, 'test_type é obrigatório');
  });

  await it('4.7 GET /api/hrv/history handles boundary days parameters safely without error', async () => {
    const queryParams = ['days=0', 'days=-10', 'days=9999', 'days=abc', 'days=365'];
    for (const param of queryParams) {
      const res = await request('GET', `/api/hrv/history?${param}`, null, athleteAuth);
      assert.strictEqual(res.status, 200);
      assert(Array.isArray(res.body.measurements));
      assert(typeof res.body.days_range === 'number');
    }
  });

  console.log('\n============================================================');
  console.log('📌 SUITE 5: TRAINING PLANS & ASSIGNMENT ADVERSARIAL STRESS');
  console.log('============================================================');

  await it('5.1 POST /api/training/plans rejects invalid distance, duration_weeks, or level with 400', async () => {
    // Negative distance
    const resNegDist = await request('POST', '/api/training/plans', {
      name: 'Plano Negativo',
      distance_km: -5,
      duration_weeks: 12,
      level: 'intermediate',
    }, coachAuth);
    expectErrorResponse(resNegDist, 400, 'distance_km deve ser um número positivo');

    // Invalid duration weeks (0 or > 52)
    const resBadWeeks0 = await request('POST', '/api/training/plans', {
      name: 'Plano Zero Semanas',
      distance_km: 10,
      duration_weeks: 0,
      level: 'intermediate',
    }, coachAuth);
    expectErrorResponse(resBadWeeks0, 400, 'duration_weeks deve estar entre 1 e 52');

    const resBadWeeks100 = await request('POST', '/api/training/plans', {
      name: 'Plano 100 Semanas',
      distance_km: 10,
      duration_weeks: 100,
      level: 'intermediate',
    }, coachAuth);
    expectErrorResponse(resBadWeeks100, 400, 'duration_weeks deve estar entre 1 e 52');

    // Invalid level
    const resBadLevel = await request('POST', '/api/training/plans', {
      name: 'Plano Master',
      distance_km: 10,
      duration_weeks: 8,
      level: 'legendary',
    }, coachAuth);
    expectErrorResponse(resBadLevel, 400, 'level deve ser beginner, intermediate ou advanced');
  });

  await it('5.2 POST /api/training/assign rejects missing/invalid athlete, plan, or date with 400/404', async () => {
    // Missing fields
    const resMissing = await request('POST', '/api/training/assign', { user_id: ATHLETE_ID }, coachAuth);
    expectErrorResponse(resMissing, 400, 'user_id, plan_id e start_date são obrigatórios');

    // Invalid date format
    const resBadDate = await request('POST', '/api/training/assign', {
      user_id: ATHLETE_ID,
      plan_id: 'any-plan',
      start_date: 'not-a-valid-date-str',
    }, coachAuth);
    expectErrorResponse(resBadDate, 400, 'start_date deve ser uma data válida');

    // Non-existent athlete
    const resGhostAthlete = await request('POST', '/api/training/assign', {
      user_id: '00000000-0000-4000-8000-999999999999',
      plan_id: 'any-plan',
      start_date: '2026-09-01',
    }, coachAuth);
    expectErrorResponse(resGhostAthlete, 404, 'Atleta não encontrado');

    // Non-existent plan
    const resGhostPlan = await request('POST', '/api/training/assign', {
      user_id: ATHLETE_ID,
      plan_id: '00000000-0000-4000-8000-999999999999',
      start_date: '2026-09-01',
    }, coachAuth);
    expectErrorResponse(resGhostPlan, 404, 'Plano não encontrado');
  });

  await it('5.3 GET /api/training/plans/:id returns 404 for non-existent plan ID', async () => {
    const res = await request('GET', '/api/training/plans/non-existent-plan-id-404', null, athleteAuth);
    expectErrorResponse(res, 404, 'Plano não encontrado');
  });

  await it('5.4 POST /api/training/generate-plan rejects invalid distance, level, or duration with 400', async () => {
    // Invalid distance (must be 5, 10, 21, or 42)
    const resBadDist = await request('POST', '/api/training/generate-plan', {
      distance_km: 15,
      level: 'intermediate',
    }, athleteAuth);
    expectErrorResponse(resBadDist, 400, 'distance_km deve ser 5, 10, 21 ou 42');

    // Invalid level
    const resBadLevel = await request('POST', '/api/training/generate-plan', {
      distance_km: 10,
      level: 'super_pro',
    }, athleteAuth);
    expectErrorResponse(resBadLevel, 400, 'level deve ser beginner, intermediate ou advanced');

    // Invalid duration (< 4 or > 24)
    const resBadDuration = await request('POST', '/api/training/generate-plan', {
      distance_km: 10,
      level: 'beginner',
      duration_weeks: 30,
    }, athleteAuth);
    expectErrorResponse(resBadDuration, 400, 'duration_weeks deve estar entre 4 e 24 semanas');
  });

  console.log('\n============================================================');
  console.log('📌 SUITE 6: ACTIVITIES & ANALYTICS ADVERSARIAL STRESS');
  console.log('============================================================');

  await it('6.1 POST /api/activities rejects missing required fields and invalid activity types with 400', async () => {
    const resMissing = await request('POST', '/api/activities', { distance_km: 10 }, athleteAuth);
    expectErrorResponse(resMissing, 400, 'type, distance_km e duration_seconds são obrigatórios');

    const invalidTypes = ['skydiving', 'hang_gliding', 'paragliding', 'rocket_propulsion', 'gaming', 123];
    for (const type of invalidTypes) {
      const res = await request('POST', '/api/activities', {
        type,
        distance_km: 5.0,
        duration_seconds: 1500,
      }, athleteAuth);
      expectErrorResponse(res, 400, 'Tipo de atividade inválido');
    }
  });

  await it('6.2 POST /api/activities rejects negative/extreme distance and duration with 400', async () => {
    // Negative distance
    const resNegDist = await request('POST', '/api/activities', {
      type: 'run',
      distance_km: -5,
      duration_seconds: 1800,
    }, athleteAuth);
    expectErrorResponse(resNegDist, 400, 'distance_km deve ser um número entre 0 e 500 km');

    // Extreme distance (> 500 km)
    const resExtremeDist = await request('POST', '/api/activities', {
      type: 'run',
      distance_km: 999,
      duration_seconds: 1800,
    }, athleteAuth);
    expectErrorResponse(resExtremeDist, 400, 'distance_km deve ser um número entre 0 e 500 km');

    // Negative/Zero duration
    const resZeroDuration = await request('POST', '/api/activities', {
      type: 'run',
      distance_km: 5,
      duration_seconds: 0,
    }, athleteAuth);
    expectErrorResponse(resZeroDuration, 400, 'duration_seconds deve ser um número positivo');

    // Extreme duration (> 86400 seconds)
    const resExtremeDuration = await request('POST', '/api/activities', {
      type: 'run',
      distance_km: 5,
      duration_seconds: 100000,
    }, athleteAuth);
    expectErrorResponse(resExtremeDuration, 400, 'duration_seconds deve ser um número positivo de até 86400 segundos');
  });

  await it('6.3 POST /api/activities rejects invalid avg_hr, max_hr, and rpe bounds with 400', async () => {
    // Bad avg_hr
    const resBadAvgHr = await request('POST', '/api/activities', {
      type: 'run', distance_km: 5, duration_seconds: 1800, avg_hr: 15,
    }, athleteAuth);
    expectErrorResponse(resBadAvgHr, 400, 'avg_hr');

    // Bad max_hr
    const resBadMaxHr = await request('POST', '/api/activities', {
      type: 'run', distance_km: 5, duration_seconds: 1800, max_hr: 300,
    }, athleteAuth);
    expectErrorResponse(resBadMaxHr, 400, 'max_hr');

    // Bad rpe (< 1 or > 10)
    const resBadRpe0 = await request('POST', '/api/activities', {
      type: 'run', distance_km: 5, duration_seconds: 1800, rpe: 0,
    }, athleteAuth);
    expectErrorResponse(resBadRpe0, 400, 'rpe');

    const resBadRpe11 = await request('POST', '/api/activities', {
      type: 'run', distance_km: 5, duration_seconds: 1800, rpe: 11,
    }, athleteAuth);
    expectErrorResponse(resBadRpe11, 400, 'rpe');
  });

  await it('6.4 GET and DELETE /api/activities/:id returns 404 for non-existent activities and 403 for unauthorized access', async () => {
    // 404 on non-existent activity
    const res404 = await request('GET', '/api/activities/non-existent-activity-id-404', null, athleteAuth);
    expectErrorResponse(res404, 404, 'Atividade não encontrada');

    const resDel404 = await request('DELETE', '/api/activities/non-existent-activity-id-404', null, athleteAuth);
    expectErrorResponse(resDel404, 404, 'Atividade não encontrada');

    // Create private activity by athlete
    const createRes = await request('POST', '/api/activities', {
      type: 'run',
      title: 'Treino Secreto',
      distance_km: 10,
      duration_seconds: 3000,
      privacy: 'private',
    }, athleteAuth);
    assert.strictEqual(createRes.status, 201);
    const privateActivityId = createRes.body.activity.id;

    // Peer athlete tries to view private activity -> 403 Forbidden
    const resForbiddenView = await request('GET', `/api/activities/${privateActivityId}`, null, peerAuth);
    expectErrorResponse(resForbiddenView, 403, 'Atividade privada');

    // Peer athlete tries to delete athlete's activity -> 403 Forbidden
    const resForbiddenDel = await request('DELETE', `/api/activities/${privateActivityId}`, null, peerAuth);
    expectErrorResponse(resForbiddenDel, 403, 'Sem permissão');
  });

  await it('6.5 GET /api/activities/stats/summary safely handles out-of-bounds days parameters', async () => {
    const statsRes1 = await request('GET', '/api/activities/stats/summary?days=-10', null, athleteAuth);
    assert.strictEqual(statsRes1.status, 200);
    assert.strictEqual(statsRes1.body.period_days, 30); // Fallback to 30

    const statsRes2 = await request('GET', '/api/activities/stats/summary?days=9999', null, athleteAuth);
    assert.strictEqual(statsRes2.status, 200);
    assert.strictEqual(statsRes2.body.period_days, 30);
  });

  console.log('\n============================================================');
  console.log('📌 SUITE 7: SOCIAL WORKFLOW ADVERSARIAL STRESS');
  console.log('============================================================');

  await it('7.1 POST /api/social/follow/:userId rejects self-following (400), non-existent user (404), duplicate follow (409)', async () => {
    // Self follow
    const resSelf = await request('POST', `/api/social/follow/${ATHLETE_ID}`, null, athleteAuth);
    expectErrorResponse(resSelf, 400, 'Você não pode seguir a si mesmo');

    // Non-existent target
    const resGhost = await request('POST', '/api/social/follow/ghost-user-id-404', null, athleteAuth);
    expectErrorResponse(resGhost, 404, 'Usuário não encontrado');

    // Follow peer once (200)
    const resFollow1 = await request('POST', `/api/social/follow/${PEER_ATHLETE_ID}`, null, athleteAuth);
    assert.strictEqual(resFollow1.status, 200);

    // Follow again -> 409 Conflict
    const resFollow2 = await request('POST', `/api/social/follow/${PEER_ATHLETE_ID}`, null, athleteAuth);
    expectErrorResponse(resFollow2, 409, 'Você já segue este usuário');
  });

  await it('7.2 POST /api/social/like/:activityId and comment/:activityId return 404 for non-existent activities', async () => {
    const resLike404 = await request('POST', '/api/social/like/ghost-activity-id', null, athleteAuth);
    expectErrorResponse(resLike404, 404, 'Atividade não encontrada');

    const resComment404 = await request('POST', '/api/social/comment/ghost-activity-id', { content: 'Legal!' }, athleteAuth);
    expectErrorResponse(resComment404, 404, 'Atividade não encontrada');
  });

  await it('7.3 POST /api/social/comment/:activityId rejects empty comments or comments > 1000 chars with 400', async () => {
    // Create a public activity first
    const actRes = await request('POST', '/api/activities', {
      type: 'run',
      title: 'Corrida Social',
      distance_km: 8,
      duration_seconds: 2400,
      privacy: 'public',
    }, athleteAuth);
    const activityId = actRes.body.activity.id;

    // Empty content
    const resEmpty = await request('POST', `/api/social/comment/${activityId}`, { content: '' }, peerAuth);
    expectErrorResponse(resEmpty, 400, 'Conteúdo do comentário é obrigatório');

    // Blank whitespace content
    const resBlank = await request('POST', `/api/social/comment/${activityId}`, { content: '   ' }, peerAuth);
    expectErrorResponse(resBlank, 400, 'Conteúdo do comentário é obrigatório');

    // Comment > 1000 characters
    const resTooLong = await request('POST', `/api/social/comment/${activityId}`, { content: 'a'.repeat(1001) }, peerAuth);
    expectErrorResponse(resTooLong, 400, 'máximo 1000 caracteres');
  });

  await it('7.4 DELETE /api/social/comment/:commentId returns 404 for non-existent and 403 for other user comment', async () => {
    const resDel404 = await request('DELETE', '/api/social/comment/ghost-comment-id', null, athleteAuth);
    expectErrorResponse(resDel404, 404, 'Comentário não encontrado');
  });

  await it('7.5 GET /api/social/search rejects queries shorter than 2 chars with 400 and safely handles SQLi queries', async () => {
    const resShort = await request('GET', '/api/social/search?q=a', null, athleteAuth);
    expectErrorResponse(resShort, 400, 'pelo menos 2 caracteres');

    const resEmpty = await request('GET', '/api/social/search?q=', null, athleteAuth);
    expectErrorResponse(resEmpty, 400, 'pelo menos 2 caracteres');

    // SQLi search query
    const resSqli = await request('GET', '/api/social/search?q=' + encodeURIComponent("' OR '1'='1"), null, athleteAuth);
    assert.strictEqual(resSqli.status, 200);
    assert(Array.isArray(resSqli.body.users));
  });

  console.log('\n============================================================');
  console.log('📌 SUITE 8: CHALLENGES, ACADEMIES & NOTIFICATIONS ADVERSARIAL');
  console.log('============================================================');

  await it('8.1 POST /api/challenges rejects invalid challenge type, negative target, or reversed dates with 400', async () => {
    // Bad type
    const resBadType = await request('POST', '/api/challenges', {
      name: 'Desafio Voador',
      type: 'flying',
      target_value: 100,
      target_unit: 'km',
      start_date: '2026-09-01',
      end_date: '2026-09-30',
    }, coachAuth);
    expectErrorResponse(resBadType, 400, 'type deve ser um dos seguintes');

    // Negative target
    const resNegTarget = await request('POST', '/api/challenges', {
      name: 'Desafio Negativo',
      type: 'distance',
      target_value: -10,
      target_unit: 'km',
      start_date: '2026-09-01',
      end_date: '2026-09-30',
    }, coachAuth);
    expectErrorResponse(resNegTarget, 400, 'target_value deve ser um número positivo');

    // End date before start date
    const resBadDates = await request('POST', '/api/challenges', {
      name: 'Desafio Temporal',
      type: 'distance',
      target_value: 50,
      target_unit: 'km',
      start_date: '2026-09-30',
      end_date: '2026-09-01',
    }, coachAuth);
    expectErrorResponse(resBadDates, 400, 'end_date deve ser posterior ou igual a start_date');
  });

  await it('8.2 Challenge participation rejects non-existent challenge (404), negative progress (400), unjoined updates (403)', async () => {
    // Join non-existent challenge
    const resJoinGhost = await request('POST', '/api/challenges/ghost-challenge-id/join', null, athleteAuth);
    expectErrorResponse(resJoinGhost, 404, 'Desafio não encontrado');

    // Leaderboard non-existent challenge
    const resLeadGhost = await request('GET', '/api/challenges/ghost-challenge-id/leaderboard', null, athleteAuth);
    expectErrorResponse(resLeadGhost, 404, 'Desafio não encontrado');

    // Update progress on non-existent challenge
    const resProgGhost = await request('POST', '/api/challenges/ghost-challenge-id/update-progress', { progress_value: 10 }, athleteAuth);
    expectErrorResponse(resProgGhost, 404, 'Desafio não encontrado');

    // Create active challenge
    const chalRes = await request('POST', '/api/challenges', {
      name: 'Desafio 50k Setembro',
      type: 'distance',
      target_value: 50,
      target_unit: 'km',
      start_date: '2026-08-01',
      end_date: '2026-09-30',
    }, coachAuth);
    const challengeId = chalRes.body.id;

    // Update progress before joining -> 403 Forbidden
    const resProgNotJoined = await request('POST', `/api/challenges/${challengeId}/update-progress`, { progress_value: 10 }, peerAuth);
    expectErrorResponse(resProgNotJoined, 403, 'Você não participa deste desafio');

    // Peer joins
    await request('POST', `/api/challenges/${challengeId}/join`, null, peerAuth);

    // Negative progress_value
    const resProgNeg = await request('POST', `/api/challenges/${challengeId}/update-progress`, { progress_value: -15 }, peerAuth);
    expectErrorResponse(resProgNeg, 400, 'progress_value deve ser um número não-negativo');
  });

  await it('8.3 POST /api/academies/invite rejects invalid email, unlinked coach, or already linked athletes', async () => {
    // Invalid email
    const resBadEmail = await request('POST', '/api/academies/invite', { email: 'bad_email_format' }, coachAuth);
    expectErrorResponse(resBadEmail, 400, 'Formato de email inválido');

    // Coach not linked to academy (400)
    const resUnlinkedCoach = await request('POST', '/api/academies/invite', { email: 'fresh_runner@rush.com' }, unlinkedCoachAuth);
    expectErrorResponse(resUnlinkedCoach, 400, 'Você não está vinculado a uma assessoria');

    // Athlete already linked to academy -> 409 Conflict
    const resAlreadyLinked = await request('POST', '/api/academies/invite', { email: 'athlete@rush.com' }, coachAuth);
    expectErrorResponse(resAlreadyLinked, 409, 'Atleta já vinculado');
  });

  await it('8.4 GET /api/academies/athlete/:id returns 404 for non-existent athlete or athlete from different academy', async () => {
    // Non-existent athlete
    const resGhost = await request('GET', '/api/academies/athlete/ghost-athlete-id-404', null, coachAuth);
    expectErrorResponse(resGhost, 404, 'Atleta não encontrado');

    // Athlete from different academy / unlinked (peer)
    const resUnlinked = await request('GET', `/api/academies/athlete/${PEER_ATHLETE_ID}`, null, coachAuth);
    expectErrorResponse(resUnlinked, 404, 'Atleta não encontrado');
  });

  await it('8.5 PUT /api/notifications/:id/read returns 404 for non-existent notification ID', async () => {
    const resGhost = await request('PUT', '/api/notifications/ghost-notif-id-404/read', null, athleteAuth);
    expectErrorResponse(resGhost, 404, 'Notificação não encontrada');
  });

  await it('8.6 PUT /api/notifications/read-all and GET /unread-count return structured JSON', async () => {
    const resReadAll = await request('PUT', '/api/notifications/read-all', null, athleteAuth);
    assert.strictEqual(resReadAll.status, 200);
    assert.strictEqual(resReadAll.body.message, 'Todas as notificações marcadas como lidas');

    const resUnread = await request('GET', '/api/notifications/unread-count', null, athleteAuth);
    assert.strictEqual(resUnread.status, 200);
    assert.strictEqual(typeof resUnread.body.unread_count, 'number');
  });

  console.log('\n============================================================');
  console.log('📌 SUITE 9: UNKNOWN ENDPOINTS & CRASH RESILIENCE');
  console.log('============================================================');

  await it('9.1 Non-existent API routes return HTTP 404 with structured JSON { error } without throwing unhandled exceptions', async () => {
    const badRoutes = [
      '/api/unknown_endpoint_xyz',
      '/api/auth/undefined_action',
      '/api/users/profile/subpath/not_found',
      '/api/activities/nested/deep/random',
      '/api/training/plans/action/does_not_exist',
    ];

    for (const path of badRoutes) {
      const res = await request('GET', path, null, athleteAuth);
      expectErrorResponse(res, 404, 'Endpoint não encontrado');
      assert.strictEqual(res.body.path, path);
    }
  });

  await it('9.2 Server processes batches of rapid adversarial payloads without crashing, leaking state, or throwing 500', async () => {
    const batchSize = 10;
    const totalBatches = 10;
    let totalAdversarialCalls = 0;

    for (let b = 0; b < totalBatches; b++) {
      const promises = [
        request('POST', '/api/auth/login', { email: `attack_batch_${b}@fake.com`, password: 'wrong' }),
        request('POST', '/api/hrv/measurement', { rmssd_ms: -10, hr_rest_bpm: 250, duration_seconds: 10 }, athleteAuth),
        request('POST', '/api/activities', { type: 'invalid_type', distance_km: -5, duration_seconds: -100 }, athleteAuth),
        request('POST', '/api/training/plans', { name: 'Invalid', distance_km: 15, duration_weeks: -1, level: 'god' }, coachAuth),
        request('GET', `/api/users/fake_user_${b}`, null, athleteAuth),
        request('GET', `/api/activities/fake_act_${b}`, null, athleteAuth),
        request('POST', `/api/social/follow/fake_user_${b}`, null, athleteAuth),
        request('POST', `/api/social/like/fake_act_${b}`, null, athleteAuth),
        request('POST', `/api/challenges/fake_chal_${b}/join`, null, athleteAuth),
        request('GET', `/api/training/plans/fake_plan_${b}`, null, athleteAuth),
      ];

      const results = await Promise.all(promises);
      totalAdversarialCalls += results.length;

      for (const res of results) {
        assert(
          [400, 401, 403, 404, 409].includes(res.status),
          `Expected 4xx HTTP code, but received ${res.status}: ${JSON.stringify(res.body)}`
        );
        assert(
          typeof res.body.error === 'string' && res.body.error.length > 0,
          `Expected structured error in body, got: ${JSON.stringify(res.body)}`
        );
      }
    }

    assert.strictEqual(totalAdversarialCalls, batchSize * totalBatches);

    // Confirm server is still 100% healthy
    const healthRes = await request('GET', '/api/health');
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthRes.body.status, 'healthy');
  });

  // Cleanup
  httpAgent.destroy();
  await new Promise((resolve) => server.close(resolve));
  db.close();

  console.log('\n============================================================');
  console.log('🏆 M4 CHALLENGER 1 MASTER ADVERSARIAL SUITE SUMMARY:');
  console.log(`   Total Tests:  ${totalTests}`);
  console.log(`   Passed Tests: ${passedTests}`);
  console.log(`   Failed Tests: ${failedTests}`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    console.error('❌ Failures occurred during adversarial stress testing:');
    failures.forEach((f, idx) => console.error(`  ${idx + 1}. ${f.title} -> ${f.error}`));
    process.exit(1);
  } else {
    console.log('🎉 100% OF ADVERSARIAL TESTS PASSED: All endpoints return structured JSON 4xx errors with zero unhandled 500 crashes!');
  }
}

runAdversarialSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
