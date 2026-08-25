// ============================================================
// RUSH PERFORMANCE — Master E2E Acceptance Test Runner
// Verificação Integral de Critérios de Aceitação (R1, R2, R3, R4)
// ============================================================

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Backend Modules
const initializeDatabase = require('../database/schema');
const { JWT_SECRET } = require('../middleware/auth');
const authRoutes = require('../routes/auth');
const usersRoutes = require('../routes/users');
const hrvRoutes = require('../routes/hrv');
const trainingRoutes = require('../routes/training');
const activitiesRoutes = require('../routes/activities');
const socialRoutes = require('../routes/social');
const challengesRoutes = require('../routes/challenges');
const academiesRoutes = require('../routes/academies');
const notificationsRoutes = require('../routes/notifications');
const {
  classifyHrvStatus,
  generateTrainingSuggestion,
  calculateLnRmssd,
  calculateStats,
  countCriticalWellnessFactors,
  applyAttentionAdjustment,
  applyRecoveryAdjustment,
  determineAction,
  SWC_MULTIPLIER,
  MIN_SWC,
} = require('../agent/trainingAgent');

console.log('🏁 ============================================================');
console.log('🏁 RUSH-APP: MASTER E2E ACCEPTANCE TEST SUITE');
console.log('🏁 Authoritative Verification of Requirements R1, R2, R3, R4');
console.log('🏁 ============================================================\n');

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

// Helper: HTTP request against test server
let server;
let baseUrl;

function request(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(urlPath, baseUrl);
    const reqOptions = {
      method,
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: targetUrl.pathname + targetUrl.search,
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

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

// Master Test Execution
async function runMasterSuite() {
  // Initialize in-memory database and test Express server
  const db = new Database(':memory:');
  process.env.NODE_ENV = 'test';
  process.env.QUIET = 'true';
  initializeDatabase(db);

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

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    res.json({ status: 'healthy', database: { users: userCount.count } });
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

  // Seed demo data into test in-memory database
  const passwordHash = bcrypt.hashSync('123456', 10);
  const ACADEMY_ID = '00000000-0000-4000-8000-000000000010';
  const OWNER_ID = '00000000-0000-4000-8000-000000000001';
  const COACH_ID = '00000000-0000-4000-8000-000000000002';
  const ATHLETE_ID = '00000000-0000-4000-8000-000000000003';

  db.prepare('INSERT INTO users (id, email, password_hash, role, academy_id) VALUES (?, ?, ?, ?, ?)').run(OWNER_ID, 'alessandro@rush.com', passwordHash, 'owner', ACADEMY_ID);
  db.prepare('INSERT INTO user_profiles (user_id, name, username) VALUES (?, ?, ?)').run(OWNER_ID, 'Alessandro', 'alessandro_rush');
  db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(OWNER_ID);
  db.prepare('INSERT INTO privacy_settings (user_id) VALUES (?)').run(OWNER_ID);
  db.prepare('INSERT INTO user_objectives (user_id, distance_km, level) VALUES (?, ?, ?)').run(OWNER_ID, 42, 'advanced');

  db.prepare('INSERT INTO users (id, email, password_hash, role, academy_id) VALUES (?, ?, ?, ?, ?)').run(COACH_ID, 'coach@rush.com', passwordHash, 'coach', ACADEMY_ID);
  db.prepare('INSERT INTO user_profiles (user_id, name, username) VALUES (?, ?, ?)').run(COACH_ID, 'Carlos Coach', 'coach_carlos');
  db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(COACH_ID);
  db.prepare('INSERT INTO privacy_settings (user_id) VALUES (?)').run(COACH_ID);

  db.prepare('INSERT INTO users (id, email, password_hash, role, academy_id) VALUES (?, ?, ?, ?, ?)').run(ATHLETE_ID, 'maria@email.com', passwordHash, 'athlete', ACADEMY_ID);
  db.prepare('INSERT INTO user_profiles (user_id, name, username) VALUES (?, ?, ?)').run(ATHLETE_ID, 'Maria Fernandes', 'maria_runs');
  db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(ATHLETE_ID);
  db.prepare('INSERT INTO privacy_settings (user_id) VALUES (?)').run(ATHLETE_ID);
  db.prepare('INSERT INTO user_objectives (user_id, distance_km, level) VALUES (?, ?, ?)').run(ATHLETE_ID, 10, 'beginner');

  db.prepare(`INSERT INTO academies (id, name, description, location, owner_id, plan_type, max_athletes) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    ACADEMY_ID, 'Rush Performance', 'Assessoria VFC', 'São Paulo - SP', OWNER_ID, 'pro', 150
  );

  // ============================================================
  // CATEGORY 1: LOGIN & AUTENTICAÇÃO (REQUIREMENT R1)
  // ============================================================
  console.log('\n============================================================');
  console.log('📌 CATEGORY 1: LOGIN & AUTH ACCEPTANCE CRITERIA (R1)');
  console.log('============================================================');

  let seedLoginToken = '';
  let seedRefreshToken = '';
  let newAthleteToken = '';
  let newAthleteRefreshToken = '';
  let newAthleteId = '';

  await it('R1.1: POST /api/auth/register with new email/password returns 201 and valid JWT tokens', async () => {
    const regRes = await request('POST', '/api/auth/register', {
      email: 'newrunner@rush.com',
      password: 'password123',
      name: 'New Runner',
      username: 'newrunner',
    });

    assert.strictEqual(regRes.status, 201, `Expected 201, got ${regRes.status}: ${JSON.stringify(regRes.body)}`);
    assert.ok(regRes.body.token, 'Response must include JWT token');
    assert.ok(regRes.body.refreshToken, 'Response must include refreshToken');
    assert.strictEqual(regRes.body.user.email, 'newrunner@rush.com');
    assert.strictEqual(regRes.body.user.role, 'athlete', 'Public registration must default to athlete role');
    assert.strictEqual(regRes.body.user.has_onboarding, false, 'New user without distance/level should have has_onboarding: false');

    newAthleteToken = regRes.body.token;
    newAthleteRefreshToken = regRes.body.refreshToken;
    newAthleteId = regRes.body.user.id;
  });

  await it('R1.2: POST /api/auth/login with seed credentials (alessandro@rush.com / 123456) returns 200, JWT token, and has_onboarding: true', async () => {
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'alessandro@rush.com',
      password: '123456',
    });

    assert.strictEqual(loginRes.status, 200, `Expected 200, got ${loginRes.status}: ${JSON.stringify(loginRes.body)}`);
    assert.ok(loginRes.body.token, 'Expected JWT access token');
    assert.ok(loginRes.body.refreshToken, 'Expected refresh token');
    assert.strictEqual(loginRes.body.user.email, 'alessandro@rush.com');
    assert.strictEqual(loginRes.body.user.has_onboarding, true, 'Seed user with objectives must have has_onboarding: true');

    seedLoginToken = loginRes.body.token;
    seedRefreshToken = loginRes.body.refreshToken;
  });

  await it('R1.3: POST /api/auth/login with invalid credentials returns 401 Unauthorized', async () => {
    const badLogin = await request('POST', '/api/auth/login', {
      email: 'alessandro@rush.com',
      password: 'wrongpassword',
    });
    assert.strictEqual(badLogin.status, 401);
    assert.ok(badLogin.body.error, 'Error message must be present in JSON body');
  });

  await it('R1.4: Protected routes access: GET /api/users/me with valid Bearer token returns 200 and athlete profile', async () => {
    const meRes = await request('GET', '/api/users/me', null, {
      Authorization: `Bearer ${seedLoginToken}`,
    });

    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.email, 'alessandro@rush.com');
    assert.strictEqual(meRes.body.has_onboarding, true);
    assert.strictEqual(meRes.body.distance_km, 42);
  });

  await it('R1.5: Protected routes rejection: GET /api/users/me with invalid/missing token returns 401', async () => {
    const noToken = await request('GET', '/api/users/me');
    assert.strictEqual(noToken.status, 401);

    const badToken = await request('GET', '/api/users/me', null, {
      Authorization: 'Bearer invalid.jwt.token',
    });
    assert.strictEqual(badToken.status, 401);
  });

  await it('R1.6: Refresh token rotation: POST /api/auth/refresh rotates consumed token and returns new pair', async () => {
    const refreshRes = await request('POST', '/api/auth/refresh', {
      refreshToken: newAthleteRefreshToken,
    });

    assert.strictEqual(refreshRes.status, 200);
    assert.ok(refreshRes.body.token, 'Must return new access token');
    assert.ok(refreshRes.body.refreshToken, 'Must return new refresh token');
    assert.notStrictEqual(refreshRes.body.refreshToken, newAthleteRefreshToken, 'Refresh token must rotate');

    // Consumed token cannot be reused (replay protection)
    const replayRes = await request('POST', '/api/auth/refresh', {
      refreshToken: newAthleteRefreshToken,
    });
    assert.strictEqual(replayRes.status, 401, 'Replayed refresh token must be rejected with 401');

    // Update with fresh token
    newAthleteToken = refreshRes.body.token;
    newAthleteRefreshToken = refreshRes.body.refreshToken;
  });

  await it('R1.7: Athlete Onboarding Flow: PUT /api/users/objectives updates goals and flips has_onboarding to true', async () => {
    const setObjRes = await request('PUT', '/api/users/objectives', {
      distance_km: 21,
      level: 'intermediate',
    }, {
      Authorization: `Bearer ${newAthleteToken}`,
    });

    assert.strictEqual(setObjRes.status, 200);
    assert.strictEqual(setObjRes.body.distance_km, 21);
    assert.strictEqual(setObjRes.body.level, 'intermediate');

    const meAfter = await request('GET', '/api/users/me', null, {
      Authorization: `Bearer ${newAthleteToken}`,
    });
    assert.strictEqual(meAfter.status, 200);
    assert.strictEqual(meAfter.body.has_onboarding, true, 'User now has objectives -> has_onboarding is true');
  });

  await it('R1.8: POST /api/auth/logout invalidates session tokens', async () => {
    const logoutRes = await request('POST', '/api/auth/logout', null, {
      Authorization: `Bearer ${newAthleteToken}`,
    });
    assert.strictEqual(logoutRes.status, 200);

    const refreshAfterLogout = await request('POST', '/api/auth/refresh', {
      refreshToken: newAthleteRefreshToken,
    });
    assert.strictEqual(refreshAfterLogout.status, 401, 'Refresh after logout must fail');
  });

  // ============================================================
  // CATEGORY 2: DESIGN SYSTEM & UI ASSETS (REQUIREMENT R2)
  // ============================================================
  console.log('\n============================================================');
  console.log('📌 CATEGORY 2: DESIGN SYSTEM ACCEPTANCE CRITERIA (R2)');
  console.log('============================================================');

  const rootDir = path.join(__dirname, '..', '..');
  const indexHtmlPath = path.join(rootDir, 'index.html');
  const indexCssPath = path.join(rootDir, 'src', 'index.css');

  await it('R2.1: index.html loads required typography fonts (Inter, Big Shoulders Display, JetBrains Mono)', () => {
    assert.ok(fs.existsSync(indexHtmlPath), 'index.html must exist');
    const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
    assert.ok(htmlContent.includes('Inter'), 'index.html must link Inter font');
    assert.ok(htmlContent.includes('Big+Shoulders+Display') || htmlContent.includes('Big Shoulders'), 'index.html must link Big Shoulders Display font');
    assert.ok(htmlContent.includes('JetBrains+Mono') || htmlContent.includes('JetBrains Mono'), 'index.html must link JetBrains Mono font');
    assert.ok(htmlContent.includes('theme-color') && htmlContent.includes('#0f0f0f'), 'index.html must specify dark theme-color #0f0f0f');
  });

  await it('R2.2: src/index.css defines dark palette (#0f0f0f, #1a1a1a) and Rush Orange (#FF3800)', () => {
    assert.ok(fs.existsSync(indexCssPath), 'src/index.css must exist');
    const cssContent = fs.readFileSync(indexCssPath, 'utf8');
    assert.ok(cssContent.includes('#0f0f0f'), 'CSS must define background token #0f0f0f');
    assert.ok(cssContent.includes('#1a1a1a'), 'CSS must define card background token #1a1a1a');
    assert.ok(cssContent.includes('#FF3800'), 'CSS must define primary brand token #FF3800');
    assert.ok(cssContent.includes('Big Shoulders Display') || cssContent.includes('Big Shoulders'), 'CSS must use Big Shoulders Display for headlines');
  });

  await it('R2.3: Mobile-first shell and BottomNav enforce max-width 430px constraint', () => {
    const cssContent = fs.readFileSync(indexCssPath, 'utf8');
    assert.ok(cssContent.includes('.app-shell'), 'CSS must define .app-shell');
    assert.ok(cssContent.includes('max-width: 430px') || cssContent.includes('max-width:430px'), 'CSS must restrict mobile shell to 430px');
    assert.ok(cssContent.includes('.bottom-nav'), 'CSS must define .bottom-nav');
  });

  await it('R2.4: All 6 Page views (Login, Onboarding, Dashboard, Feed, Training, Profile) and BottomNav exist and use design system classes', () => {
    const pages = [
      { file: 'src/pages/Login.jsx', required: ['display-massive', 'text-gradient', 'btn-primary'] },
      { file: 'src/pages/Onboarding.jsx', required: ['heading-xl', 'distance-grid', 'btn'] },
      { file: 'src/pages/Dashboard.jsx', required: ['status-hero', 'scoreboard', 'card-surface'] },
      { file: 'src/pages/Feed.jsx', required: ['feed-card', 'scoreboard', 'feed-actions'] },
      { file: 'src/pages/Training.jsx', required: ['card-surface', 'display-massive', 'scoreboard'] },
      { file: 'src/pages/Profile.jsx', required: ['profile-stats', 'scoreboard', 'orange-glow'] },
      { file: 'src/components/BottomNav.jsx', required: ['bottom-nav', 'nav-item'] },
    ];

    for (const page of pages) {
      const pagePath = path.join(rootDir, page.file);
      assert.ok(fs.existsSync(pagePath), `${page.file} must exist`);
      const content = fs.readFileSync(pagePath, 'utf8');
      for (const reqClass of page.required) {
        assert.ok(content.includes(reqClass), `${page.file} must contain design class "${reqClass}"`);
      }
    }
  });

  // ============================================================
  // CATEGORY 3: TRAINING AGENT VFC & SCIENTIFIC LOGIC (REQUIREMENT R3)
  // ============================================================
  console.log('\n============================================================');
  console.log('📌 CATEGORY 3: TRAINING AGENT (VFC) ACCEPTANCE CRITERIA (R3)');
  console.log('============================================================');

  await it('R3.1: lnRMSSD calculation & rolling 7-day stats handle normal, boundary and edge inputs safely', () => {
    const lnVal = calculateLnRmssd(65);
    assert.strictEqual(+lnVal.toFixed(4), 4.1744);

    // Safeguards against non-positive and non-finite
    assert.strictEqual(calculateLnRmssd(0), 0);
    assert.strictEqual(calculateLnRmssd(-10), 0);
    assert.strictEqual(calculateLnRmssd(Infinity), 0);
    assert.strictEqual(calculateLnRmssd(NaN), 0);

    const stats = calculateStats([4.1, 4.2, 4.0, 4.3, 4.1, 4.2, 4.1]);
    assert.ok(stats.mean > 4.0 && stats.mean < 4.3);
    assert.ok(stats.sd > 0);
  });

  await it('R3.2: Daily HRV status classification follows Smallest Worthwhile Change (SWC) corridor', () => {
    const mean = 4.0;
    const sd = 0.20; // SWC = 0.10

    // Favorable: within [-SWC, +1.5*SWC]
    assert.strictEqual(classifyHrvStatus(4.00, mean, sd), 'favorable');
    assert.strictEqual(classifyHrvStatus(3.90, mean, sd), 'favorable'); // Exact -SWC boundary
    assert.strictEqual(classifyHrvStatus(4.10, mean, sd), 'favorable');

    // Attention: between -1.5*SWC and -SWC
    assert.strictEqual(classifyHrvStatus(3.87, mean, sd), 'attention');
    assert.strictEqual(classifyHrvStatus(3.85, mean, sd), 'attention'); // Exact -1.5*SWC boundary

    // Recovery: < -1.5*SWC
    assert.strictEqual(classifyHrvStatus(3.80, mean, sd), 'recovery');
    assert.strictEqual(classifyHrvStatus(3.50, mean, sd), 'recovery');
  });

  await it('R3.3: Parasympathetic Hyperactivity / Saturation (> +1.5*SWC with high fatigue/stress) triggers Attention', () => {
    const mean = 4.0;
    const sd = 0.20; // SWC = 0.10, +1.5*SWC = +0.15 -> threshold 4.15

    // High HRV without fatigue remains favorable
    assert.strictEqual(classifyHrvStatus(4.25, mean, sd, { fatigue: 2, stress: 2 }), 'favorable');

    // High HRV with fatigue >= 4 triggers attention (parasympathetic saturation)
    assert.strictEqual(classifyHrvStatus(4.25, mean, sd, { fatigue: 4, stress: 2 }), 'attention');
    assert.strictEqual(classifyHrvStatus(4.25, mean, sd, { fatigue: 2, stress: 4 }), 'attention');
  });

  await it('R3.4: Minimum SWC floor (MIN_SWC = 0.05) prevents division/corridor collapse when SD = 0', () => {
    const mean = 4.0;
    const sd = 0.0; // SD is zero on Day 1 or identical values
    // Delta = -0.06 -> exceeds MIN_SWC (0.05) -> attention
    assert.strictEqual(classifyHrvStatus(3.94, mean, sd), 'attention');
    // Delta = -0.10 -> exceeds 1.5*MIN_SWC (0.075) -> recovery
    assert.strictEqual(classifyHrvStatus(3.90, mean, sd), 'recovery');
  });

  await it('R3.5: Training suggestion modulates planned session synchronously based on HRV status', () => {
    const planned = {
      type: 'interval',
      distance_km: 10,
      duration_min: 50,
      target_hr_zone: 'Z4',
      is_fixed: false,
    };

    // Favorable -> Maintain
    const fav = generateTrainingSuggestion({
      lnrmssdToday: 4.10,
      lnrmssd7dMean: 4.00,
      lnrmssd7dSd: 0.20,
      plannedSession: planned,
    });
    assert.strictEqual(fav.status, 'favorable');
    assert.strictEqual(fav.action, 'maintain');
    assert.strictEqual(fav.adjusted_session.distance_km, 10);

    // Attention -> Reduce volume by 20%
    const att = generateTrainingSuggestion({
      lnrmssdToday: 3.88,
      lnrmssd7dMean: 4.00,
      lnrmssd7dSd: 0.20,
      plannedSession: planned,
    });
    assert.strictEqual(att.status, 'attention');
    assert.strictEqual(att.action, 'reduce');
    assert.strictEqual(att.adjusted_session.distance_km, 8.0);
    assert.strictEqual(att.adjusted_session.duration_min, 40);

    // Recovery -> Convert hard interval into safe Z2 easy run
    const rec = generateTrainingSuggestion({
      lnrmssdToday: 3.70,
      lnrmssd7dMean: 4.00,
      lnrmssd7dSd: 0.20,
      plannedSession: planned,
    });
    assert.strictEqual(rec.status, 'recovery');
    assert.strictEqual(rec.adjusted_session.type, 'easy_run');
    assert.strictEqual(rec.adjusted_session.target_hr_zone, 'Z2');
    assert.ok(rec.adjusted_session.distance_km <= 5.0);
  });

  await it('R3.6: Auto-periodization generator creates 4-phase plan (Base, Build, Peak, Taper) via API', async () => {
    const planRes = await request('POST', '/api/training/generate-plan', {
      distance_km: 21,
      level: 'intermediate',
      duration_weeks: 12,
    }, {
      Authorization: `Bearer ${seedLoginToken}`,
    });

    assert.strictEqual(planRes.status, 201);
    assert.strictEqual(planRes.body.plan.distance_km, 21);
    assert.strictEqual(planRes.body.plan.duration_weeks, 12);
    assert.strictEqual(planRes.body.plan.level, 'intermediate');

    // Retrieve active plan
    const myPlanRes = await request('GET', '/api/training/my-plan', null, {
      Authorization: `Bearer ${seedLoginToken}`,
    });
    assert.strictEqual(myPlanRes.status, 200);
    assert.strictEqual(myPlanRes.body.has_plan, true);
    assert.ok(Array.isArray(myPlanRes.body.week_sessions));
    assert.ok(myPlanRes.body.week_sessions.length > 0);
  });

  // ============================================================
  // CATEGORY 4: QUALIDADE DE CÓDIGO & ROUTE HARDENING (REQUIREMENT R4)
  // ============================================================
  console.log('\n============================================================');
  console.log('📌 CATEGORY 4: CODE QUALITY & ROUTE HARDENING (R4)');
  console.log('============================================================');

  await it('R4.1: Server health check returns 200 healthy status with JSON structure', async () => {
    const health = await request('GET', '/api/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.status, 'healthy');
  });

  await it('R4.2: Structured error handling: Non-existent route returns 404 with JSON { error }', async () => {
    const res404 = await request('GET', '/api/non-existent-endpoint');
    assert.strictEqual(res404.status, 404);
    assert.ok(res404.body.error, 'Response must include structured error property');
  });

  await it('R4.3: Route hardening: Validation rejections across routes return 400 with structured JSON', async () => {
    // 1. Invalid HRV measurement (out-of-range RMSSD)
    const hrvBad = await request('POST', '/api/hrv/measurement', {
      rmssd_ms: 999, // Max allowed is 200
      hr_rest_bpm: 60,
      duration_seconds: 120,
    }, {
      Authorization: `Bearer ${seedLoginToken}`,
    });
    assert.strictEqual(hrvBad.status, 400);
    assert.ok(hrvBad.body.error);

    // 2. Invalid Wellness score (< 1 or > 5)
    const wellnessBad = await request('POST', '/api/hrv/wellness', {
      sleep: 6, // Max allowed is 5
      fatigue: 3,
      soreness: 3,
      stress: 3,
      readiness: 3,
    }, {
      Authorization: `Bearer ${seedLoginToken}`,
    });
    assert.strictEqual(wellnessBad.status, 400);
    assert.ok(wellnessBad.body.error);

    // 3. Invalid Activity (invalid type)
    const actBad = await request('POST', '/api/activities', {
      type: 'invalid_sport_type',
      distance_km: 10,
      duration_seconds: 3000,
    }, {
      Authorization: `Bearer ${seedLoginToken}`,
    });
    assert.strictEqual(actBad.status, 400);
    assert.ok(actBad.body.error);

    // 4. Invalid Training Plan generation parameter
    const planBad = await request('POST', '/api/training/generate-plan', {
      distance_km: 99, // Allowed: 5, 10, 21, 42
      level: 'intermediate',
    }, {
      Authorization: `Bearer ${seedLoginToken}`,
    });
    assert.strictEqual(planBad.status, 400);
    assert.ok(planBad.body.error);
  });

  await it('R4.4: Role authorization security: Regular athlete cannot create training plan or academy invite (403 Forbidden)', async () => {
    // Athlete attempting coach endpoint POST /api/training/plans
    const coachPlanAttempt = await request('POST', '/api/training/plans', {
      name: 'Unauthorized Plan',
      distance_km: 10,
      duration_weeks: 8,
      level: 'beginner',
    }, {
      Authorization: `Bearer ${newAthleteToken}`, // Role is athlete
    });
    assert.strictEqual(coachPlanAttempt.status, 403);
    assert.ok(coachPlanAttempt.body.error);

    // Athlete attempting coach endpoint POST /api/academies/invite
    const inviteAttempt = await request('POST', '/api/academies/invite', {
      email: 'someone@email.com',
    }, {
      Authorization: `Bearer ${newAthleteToken}`,
    });
    assert.strictEqual(inviteAttempt.status, 403);
    assert.ok(inviteAttempt.body.error);
  });

  await it('R4.5: Social interaction workflow: Feed, Likes, Comments, Followers and Searches execute without errors', async () => {
    // 1. Log an activity
    const newAct = await request('POST', '/api/activities', {
      type: 'run',
      title: 'Treino de Teste Aceitação',
      distance_km: 12.5,
      duration_seconds: 3600,
      avg_pace: '4:48',
      rpe: 7,
      privacy: 'public',
    }, {
      Authorization: `Bearer ${seedLoginToken}`,
    });
    assert.strictEqual(newAct.status, 201);
    const activityId = newAct.body.activity.id;

    // 2. Fetch feed
    const feed = await request('GET', '/api/social/feed?scope=global', null, {
      Authorization: `Bearer ${seedLoginToken}`,
    });
    assert.strictEqual(feed.status, 200);
    assert.ok(Array.isArray(feed.body.feed));

    // 3. Like activity
    const likeRes = await request('POST', `/api/social/like/${activityId}`, null, {
      Authorization: `Bearer ${newAthleteToken}`,
    });
    assert.strictEqual(likeRes.status, 200);
    assert.strictEqual(likeRes.body.liked, true);

    // 4. Comment on activity
    const commentRes = await request('POST', `/api/social/comment/${activityId}`, {
      content: 'Excelente treino! 💪',
    }, {
      Authorization: `Bearer ${newAthleteToken}`,
    });
    assert.strictEqual(commentRes.status, 201);
    assert.strictEqual(commentRes.body.content, 'Excelente treino! 💪');

    // 5. Follow user
    const followRes = await request('POST', `/api/social/follow/${OWNER_ID}`, null, {
      Authorization: `Bearer ${newAthleteToken}`,
    });
    assert.strictEqual(followRes.status, 200);
    assert.strictEqual(followRes.body.following, true);

    // 6. Search users
    const searchRes = await request('GET', '/api/social/search?q=Alessandro', null, {
      Authorization: `Bearer ${newAthleteToken}`,
    });
    assert.strictEqual(searchRes.status, 200);
    assert.ok(searchRes.body.users.length > 0);
  });

  await it('R4.6: Challenges and Notifications workflows execute with try/catch and input validation', async () => {
    // 1. List challenges
    const chList = await request('GET', '/api/challenges', null, {
      Authorization: `Bearer ${seedLoginToken}`,
    });
    assert.strictEqual(chList.status, 200);

    // 2. Read notifications
    const notifs = await request('GET', '/api/notifications', null, {
      Authorization: `Bearer ${seedLoginToken}`,
    });
    assert.strictEqual(notifs.status, 200);
    assert.ok(Array.isArray(notifs.body.notifications));

    // 3. Mark all notifications as read
    const readAll = await request('PUT', '/api/notifications/read-all', null, {
      Authorization: `Bearer ${seedLoginToken}`,
    });
    assert.strictEqual(readAll.status, 200);
  });

  await it('R4.7: Codebase audit confirms zero debug console.log statements in production routes', () => {
    const routeFiles = [
      'server/routes/auth.js',
      'server/routes/users.js',
      'server/routes/hrv.js',
      'server/routes/training.js',
      'server/routes/activities.js',
      'server/routes/social.js',
      'server/routes/challenges.js',
      'server/routes/academies.js',
      'server/routes/notifications.js',
      'server/agent/trainingAgent.js',
    ];

    for (const file of routeFiles) {
      const fullPath = path.join(rootDir, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        if (line.includes('console.log(')) {
          assert.fail(`Found prohibited console.log in production file ${file} at line ${idx + 1}: ${line}`);
        }
      }
    }
  });

  // Cleanup test server
  await new Promise((resolve) => server.close(resolve));
  db.close();

  // Summary Report
  console.log('\n============================================================');
  console.log(`🏆 MASTER E2E ACCEPTANCE SUITE SUMMARY:`);
  console.log(`   Total Tests:  ${totalTests}`);
  console.log(`   Passed Tests: ${passedTests}`);
  console.log(`   Failed Tests: ${failedTests}`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    console.error(`💥 SUITE FAILED with ${failedTests} failure(s).`);
    process.exit(1);
  } else {
    console.log('🎉 ALL ACCEPTANCE CRITERIA VERIFIED AND PASSED SUCCESSFULLY!');
  }
}

runMasterSuite().catch((err) => {
  console.error('Fatal test harness error:', err);
  process.exit(1);
});
