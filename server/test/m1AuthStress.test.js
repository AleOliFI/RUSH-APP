// ============================================================
// RUSH PERFORMANCE — Milestone 1 Auth & Session Stress Test
// Empirical challenger verification suite
// ============================================================

const assert = require('assert');
const http = require('http');
const express = require('express');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const initializeDatabase = require('../database/schema');
const authRoutes = require('../routes/auth');
const usersRoutes = require('../routes/users');
const { JWT_SECRET } = require('../middleware/auth');

console.log('🔥 ============================================================');
console.log('🔥 STARTING M1 EMPIRICAL AUTH & SESSION STRESS TEST SUITE');
console.log('🔥 ============================================================\n');

let passedTests = 0;
let totalTests = 0;
const failureLogs = [];

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failureLogs.push({ name, error: err.message, stack: err.stack });
    process.exitCode = 1;
  }
}

// Setup in-memory test app and database
const db = new Database(':memory:');
initializeDatabase(db);

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes(db));
app.use('/api/users', usersRoutes(db));

let server;
let baseUrl;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
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
        } catch (e) {
          json = { raw: data };
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

async function runSuite() {
  // Start server on dynamic port
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`  📡 Ephemeral test server running at ${baseUrl}\n`);
      resolve();
    });
  });

  // ============================================================
  // Category 1: Input Validation & Edge Cases on Registration
  // ============================================================
  console.log('--- 1. Input Validation & Edge Cases (Register) ---');

  await test('Register with missing email returns 400', async () => {
    const res = await makeRequest('POST', '/api/auth/register', {
      password: 'password123',
      name: 'Test User',
      username: 'test_user_1',
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error);
  });

  await test('Register with blank email returns 400', async () => {
    const res = await makeRequest('POST', '/api/auth/register', {
      email: '   ',
      password: 'password123',
      name: 'Test User',
      username: 'test_user_2',
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error);
  });

  await test('Register with malformed email (no @) returns 400', async () => {
    const res = await makeRequest('POST', '/api/auth/register', {
      email: 'notanemail',
      password: 'password123',
      name: 'Test User',
      username: 'test_user_3',
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Formato de email inválido');
  });

  await test('Register with malformed email (missing domain) returns 400', async () => {
    const res = await makeRequest('POST', '/api/auth/register', {
      email: 'user@nodomain',
      password: 'password123',
      name: 'Test User',
      username: 'test_user_4',
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Formato de email inválido');
  });

  await test('Register with short password (< 6 chars) returns 400', async () => {
    const res = await makeRequest('POST', '/api/auth/register', {
      email: 'shortpass@rush.com',
      password: '12345',
      name: 'Short Pass User',
      username: 'short_pass_user',
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Senha deve ter pelo menos 6 caracteres');
  });

  await test('Register with invalid username (special characters) returns 400', async () => {
    const res = await makeRequest('POST', '/api/auth/register', {
      email: 'baduser@rush.com',
      password: 'password123',
      name: 'Bad User',
      username: 'bad!user@#$',
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('Username deve conter'));
  });

  await test('Register with invalid username (< 3 chars) returns 400', async () => {
    const res = await makeRequest('POST', '/api/auth/register', {
      email: 'shortname@rush.com',
      password: 'password123',
      name: 'Short Name',
      username: 'ab',
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('Username deve conter'));
  });

  // ============================================================
  // Category 2: Privilege Escalation Prevention
  // ============================================================
  console.log('\n--- 2. Privilege Escalation Prevention ---');

  await test('Registration attempting role: "owner" is forced to "athlete"', async () => {
    const res = await makeRequest('POST', '/api/auth/register', {
      email: 'hacker_owner@rush.com',
      password: 'password123',
      name: 'Hacker Owner',
      username: 'hacker_owner',
      role: 'owner',
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.user.role, 'athlete');

    // Direct DB check
    const dbUser = db.prepare('SELECT role FROM users WHERE email = ?').get('hacker_owner@rush.com');
    assert.strictEqual(dbUser.role, 'athlete');
  });

  await test('Registration attempting role: "admin" is forced to "athlete"', async () => {
    const res = await makeRequest('POST', '/api/auth/register', {
      email: 'hacker_admin@rush.com',
      password: 'password123',
      name: 'Hacker Admin',
      username: 'hacker_admin',
      role: 'admin',
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.user.role, 'athlete');

    const dbUser = db.prepare('SELECT role FROM users WHERE email = ?').get('hacker_admin@rush.com');
    assert.strictEqual(dbUser.role, 'athlete');
  });

  await test('Duplicate email registration returns 409 Conflict', async () => {
    const res = await makeRequest('POST', '/api/auth/register', {
      email: 'hacker_admin@rush.com',
      password: 'password123',
      name: 'Duplicate Admin',
      username: 'diff_username',
    });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.error, 'Email já cadastrado');
  });

  await test('Duplicate username registration returns 409 Conflict', async () => {
    const res = await makeRequest('POST', '/api/auth/register', {
      email: 'diff_email@rush.com',
      password: 'password123',
      name: 'Duplicate Username',
      username: 'hacker_admin',
    });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.error, 'Username já em uso');
  });

  // ============================================================
  // Category 3: Login Stress & Edge Cases
  // ============================================================
  console.log('\n--- 3. Login Edge Cases ---');

  await test('Login with blank fields returns 400', async () => {
    const res1 = await makeRequest('POST', '/api/auth/login', { email: '', password: '123' });
    assert.strictEqual(res1.status, 400);

    const res2 = await makeRequest('POST', '/api/auth/login', { email: 'a@b.com', password: '' });
    assert.strictEqual(res2.status, 400);
  });

  await test('Login with non-existent user returns 401', async () => {
    const res = await makeRequest('POST', '/api/auth/login', {
      email: 'nobody_12345@rush.com',
      password: 'somepassword',
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'Email ou senha incorretos');
  });

  await test('Login with wrong password returns 401', async () => {
    const res = await makeRequest('POST', '/api/auth/login', {
      email: 'hacker_owner@rush.com',
      password: 'wrong_password',
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'Email ou senha incorretos');
  });

  let validToken = '';
  let validRefreshToken = '';
  let athleteUserId = '';

  await test('Login with valid credentials returns 200, JWT tokens, and user info', async () => {
    const res = await makeRequest('POST', '/api/auth/login', {
      email: 'hacker_owner@rush.com',
      password: 'password123',
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    assert.ok(res.body.refreshToken);
    assert.strictEqual(res.body.user.email, 'hacker_owner@rush.com');
    assert.strictEqual(res.body.user.role, 'athlete');

    validToken = res.body.token;
    validRefreshToken = res.body.refreshToken;
    athleteUserId = res.body.user.id;
  });

  // ============================================================
  // Category 4: Authenticated Endpoint Protection (GET /api/users/me & /api/auth/me)
  // ============================================================
  console.log('\n--- 4. Authenticated Endpoint Edge Cases ---');

  await test('GET /api/users/me with missing Authorization header returns 401', async () => {
    const res = await makeRequest('GET', '/api/users/me');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'Token de acesso não fornecido');
  });

  await test('GET /api/users/me with malformed Bearer prefix returns 401', async () => {
    const res = await makeRequest('GET', '/api/users/me', null, {
      Authorization: `Token ${validToken}`,
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'Token de acesso não fornecido');
  });

  await test('GET /api/users/me with invalid JWT signature returns 401', async () => {
    const invalidToken = jwt.sign({ id: athleteUserId }, 'wrong_secret_key');
    const res = await makeRequest('GET', '/api/users/me', null, {
      Authorization: `Bearer ${invalidToken}`,
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'Token inválido');
  });

  await test('GET /api/users/me with expired JWT returns 401 with code TOKEN_EXPIRED', async () => {
    const expiredToken = jwt.sign(
      { id: athleteUserId, email: 'hacker_owner@rush.com', role: 'athlete' },
      JWT_SECRET,
      { expiresIn: -1 } // Already expired
    );
    const res = await makeRequest('GET', '/api/users/me', null, {
      Authorization: `Bearer ${expiredToken}`,
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'Token expirado');
    assert.strictEqual(res.body.code, 'TOKEN_EXPIRED');
  });

  await test('GET /api/users/me with valid token returns 200, user data, and has_onboarding flag', async () => {
    const res = await makeRequest('GET', '/api/users/me', null, {
      Authorization: `Bearer ${validToken}`,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.id, athleteUserId);
    assert.strictEqual(res.body.email, 'hacker_owner@rush.com');
    assert.strictEqual(typeof res.body.has_onboarding, 'boolean');
  });

  await test('GET /api/auth/me with valid token returns 200 and matches user profile', async () => {
    const res = await makeRequest('GET', '/api/auth/me', null, {
      Authorization: `Bearer ${validToken}`,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.id, athleteUserId);
  });

  // ============================================================
  // Category 5: Refresh Token Rotation, Replay, and Race Conditions
  // ============================================================
  console.log('\n--- 5. Refresh Token Mechanics & Concurrency Stress ---');

  let secondRefreshToken = '';

  await test('POST /api/auth/refresh with valid token performs successful rotation', async () => {
    const res = await makeRequest('POST', '/api/auth/refresh', {
      refresh_token: validRefreshToken,
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    assert.ok(res.body.refreshToken);
    assert.notStrictEqual(res.body.refreshToken, validRefreshToken, 'Refresh token must rotate to a new string');

    secondRefreshToken = res.body.refreshToken;
  });

  await test('Replay of already consumed refresh token is rejected with 401', async () => {
    // Attempt to use validRefreshToken again (which was already rotated)
    const res = await makeRequest('POST', '/api/auth/refresh', {
      refresh_token: validRefreshToken,
    });
    assert.strictEqual(res.status, 401);
    assert.ok(res.body.error.includes('não encontrado ou já revogado'));
  });

  await test('Concurrent refresh token calls: 10 parallel requests with same token -> exactly 1 succeeds, 9 fail with 401', async () => {
    // Start with secondRefreshToken
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        makeRequest('POST', '/api/auth/refresh', {
          refresh_token: secondRefreshToken,
        })
      );
    }

    const results = await Promise.all(promises);
    const successCount = results.filter((r) => r.status === 200).length;
    const failCount = results.filter((r) => r.status === 401).length;

    console.log(`     [Concurrency Result] 200 OK: ${successCount}, 401 Rejected: ${failCount}`);
    assert.strictEqual(successCount, 1, 'Exactly one concurrent refresh call must succeed');
    assert.strictEqual(failCount, 9, 'All duplicate concurrent refresh calls must be rejected (401)');

    const successfulResult = results.find((r) => r.status === 200);
    secondRefreshToken = successfulResult.body.refreshToken;
  });

  await test('POST /api/auth/logout invalidates all active refresh tokens for user', async () => {
    // Perform logout
    const resLogout = await makeRequest('POST', '/api/auth/logout', null, {
      Authorization: `Bearer ${validToken}`,
    });
    assert.strictEqual(resLogout.status, 200);

    // Attempt refresh with the latest rotated token
    const resRefresh = await makeRequest('POST', '/api/auth/refresh', {
      refresh_token: secondRefreshToken,
    });
    assert.strictEqual(resRefresh.status, 401);
    assert.ok(resRefresh.body.error.includes('não encontrado ou já revogado'));
  });

  // ============================================================
  // Category 6: Seed Accounts Authentication & Onboarding Lifecycle
  // ============================================================
  console.log('\n--- 6. Seed Accounts & Onboarding Lifecycle ---');

  // Insert seed-like users into test db
  const seedPasswordHash = require('bcryptjs').hashSync('123456', 10);
  const alessandroId = '00000000-0000-4000-8000-000000000001';
  db.prepare('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)').run(alessandroId, 'alessandro@rush.com', seedPasswordHash, 'owner');
  db.prepare('INSERT INTO user_profiles (user_id, name, username) VALUES (?, ?, ?)').run(alessandroId, 'Alessandro', 'alessandro_rush');
  db.prepare('INSERT INTO user_objectives (user_id, distance_km, level) VALUES (?, ?, ?)').run(alessandroId, 42, 'advanced');

  await test('Seed account alessandro@rush.com logs in with 123456 and has_onboarding: true', async () => {
    const res = await makeRequest('POST', '/api/auth/login', {
      email: 'alessandro@rush.com',
      password: '123456',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'owner');
    assert.strictEqual(res.body.user.has_onboarding, true);
  });

  // Test newly registered athlete onboarding transition
  let freshAthleteToken = '';
  let freshAthleteUserId = '';

  await test('Newly registered athlete without objectives has has_onboarding: false', async () => {
    const res = await makeRequest('POST', '/api/auth/register', {
      email: 'newbie@rush.com',
      password: 'password123',
      name: 'Newbie Runner',
      username: 'newbie_runner',
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.user.has_onboarding, false);
    freshAthleteToken = res.body.token;
    freshAthleteUserId = res.body.user.id;

    // Check GET /api/users/me returns has_onboarding: false
    const meRes = await makeRequest('GET', '/api/users/me', null, {
      Authorization: `Bearer ${freshAthleteToken}`,
    });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.has_onboarding, false);
  });

  await test('Completing onboarding via PUT /api/users/objectives sets valid distance & level', async () => {
    const objRes = await makeRequest('PUT', '/api/users/objectives', {
      distance_km: 21,
      level: 'intermediate',
    }, {
      Authorization: `Bearer ${freshAthleteToken}`,
    });
    assert.strictEqual(objRes.status, 200);
    assert.strictEqual(objRes.body.distance_km, 21);
    assert.strictEqual(objRes.body.level, 'intermediate');

    // Check GET /api/users/me now reflects has_onboarding: true
    const meRes = await makeRequest('GET', '/api/users/me', null, {
      Authorization: `Bearer ${freshAthleteToken}`,
    });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.has_onboarding, true);
    assert.strictEqual(meRes.body.distance_km, 21);
    assert.strictEqual(meRes.body.level, 'intermediate');
  });

  await test('Reject invalid distance_km in PUT /api/users/objectives (not in 5/10/21/42)', async () => {
    const res = await makeRequest('PUT', '/api/users/objectives', {
      distance_km: 15, // Invalid distance
      level: 'beginner',
    }, {
      Authorization: `Bearer ${freshAthleteToken}`,
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('5, 10, 21 ou 42'));
  });

  // Clean up
  server.close();
  db.close();

  console.log(`\n========================================`);
  console.log(`M1 Stress Test Summary: ${passedTests} / ${totalTests} Passed`);
  console.log(`========================================\n`);

  if (failureLogs.length > 0) {
    console.error('Failures encountered:', failureLogs);
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal suite error:', err);
  process.exit(1);
});
