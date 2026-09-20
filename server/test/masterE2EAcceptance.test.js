// ============================================================
// RUSH PERFORMANCE — Master E2E Acceptance Test Runner
// Verificação Integral de Critérios de Aceitação (R1, R2, R3, R4)
// ============================================================

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
// Adaptador em vez do driver cru: as rotas agora usam transação
// assíncrona, que o better-sqlite3 recusa.
const { Database } = require('../database/sqlite');
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
    // Sem Content-Length o corpo vai em chunked, e uma resposta de erro
    // enviada antes de o servidor drenar a requisição deixa o socket
    // reaproveitável em estado sujo — a requisição seguinte morre com
    // "socket hang up". Declarar o tamanho evita isso.
    const payload =
      body == null ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const reqOptions = {
      method,
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: targetUrl.pathname + targetUrl.search,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': payload.length } : {}),
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

    if (payload) {
      req.write(payload);
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

  // Health check endpoint
  app.get('/api/health', async (req, res) => {
    const userCount = await db.prepare('SELECT COUNT(*) as count FROM users').get();
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

  await db.prepare('INSERT INTO users (id, email, password_hash, role, academy_id) VALUES (?, ?, ?, ?, ?)').run(OWNER_ID, 'alessandro@rush.com', passwordHash, 'owner', ACADEMY_ID);
  await db.prepare('INSERT INTO user_profiles (user_id, name, username) VALUES (?, ?, ?)').run(OWNER_ID, 'Alessandro', 'alessandro_rush');
  await db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(OWNER_ID);
  await db.prepare('INSERT INTO privacy_settings (user_id) VALUES (?)').run(OWNER_ID);
  await db.prepare('INSERT INTO user_objectives (user_id, distance_km, level) VALUES (?, ?, ?)').run(OWNER_ID, 42, 'advanced');

  await db.prepare('INSERT INTO users (id, email, password_hash, role, academy_id) VALUES (?, ?, ?, ?, ?)').run(COACH_ID, 'coach@rush.com', passwordHash, 'coach', ACADEMY_ID);
  await db.prepare('INSERT INTO user_profiles (user_id, name, username) VALUES (?, ?, ?)').run(COACH_ID, 'Carlos Coach', 'coach_carlos');
  await db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(COACH_ID);
  await db.prepare('INSERT INTO privacy_settings (user_id) VALUES (?)').run(COACH_ID);

  await db.prepare('INSERT INTO users (id, email, password_hash, role, academy_id) VALUES (?, ?, ?, ?, ?)').run(ATHLETE_ID, 'maria@email.com', passwordHash, 'athlete', ACADEMY_ID);
  await db.prepare('INSERT INTO user_profiles (user_id, name, username) VALUES (?, ?, ?)').run(ATHLETE_ID, 'Maria Fernandes', 'maria_runs');
  await db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(ATHLETE_ID);
  await db.prepare('INSERT INTO privacy_settings (user_id) VALUES (?)').run(ATHLETE_ID);
  await db.prepare('INSERT INTO user_objectives (user_id, distance_km, level) VALUES (?, ?, ?)').run(ATHLETE_ID, 10, 'beginner');

  await db.prepare(`INSERT INTO academies (id, name, description, location, owner_id, plan_type, max_athletes) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
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
  // O design system foi dividido: o legado (páginas .jsx remanescentes)
  // ficou em src/styles/rush-legacy.css e o novo em rush-running.css.
  const legacyCssPath = path.join(rootDir, 'src', 'styles', 'rush-legacy.css');
  const rushCssPath = path.join(rootDir, 'src', 'styles', 'rush-running.css');

  await it('R2.1: a tipografia dos dois design systems é servida pelo próprio app, sem CDN', () => {
    assert.ok(fs.existsSync(indexHtmlPath), 'index.html must exist');
    const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

    // As fontes deixaram de vir do Google Fonts: sem rede, os nomes das
    // ligaduras do Material Symbols apareceriam como texto cru na tela.
    assert.ok(
      !htmlContent.includes('fonts.googleapis.com') && !htmlContent.includes('fonts.gstatic.com'),
      'index.html must not depend on the Google Fonts CDN',
    );
    assert.ok(htmlContent.includes('/fonts/fonts.css'), 'index.html must link the locally hosted stylesheet');

    const fontsCssPath = path.join(rootDir, 'public', 'fonts', 'fonts.css');
    assert.ok(fs.existsSync(fontsCssPath), 'public/fonts/fonts.css must exist');
    const fontsCss = fs.readFileSync(fontsCssPath, 'utf8');

    // Design system novo (RUSH RUNNING) e legado (painel da assessoria).
    for (const family of ['Anton', 'Manrope', 'JetBrains Mono', 'Material Symbols Outlined', 'Inter', 'Big Shoulders Display']) {
      assert.ok(fontsCss.includes(`font-family: '${family}'`), `fonts.css must declare ${family}`);
    }

    // Cada @font-face precisa apontar para um arquivo que realmente existe.
    const referenced = [...fontsCss.matchAll(/url\(\/fonts\/([^)]+)\)/g)].map((m) => m[1]);
    assert.ok(referenced.length > 0, 'fonts.css must reference local font files');
    for (const file of referenced) {
      assert.ok(
        fs.existsSync(path.join(rootDir, 'public', 'fonts', file)),
        `fonts.css references missing file ${file}`,
      );
    }

    assert.ok(htmlContent.includes('theme-color') && htmlContent.includes('#0D0D0D'), 'index.html must specify dark theme-color #0D0D0D');
  });

  await it('R2.5: todo ícone usado no código existe na fonte reduzida', () => {
    // A fonte de ícones é um SUBCONJUNTO: contém só os ícones listados em
    // public/fonts/icons.txt. Um ícone novo que não passou por
    // scripts/atualizar-fontes.sh não existe na fonte, e o navegador
    // renderiza o NOME DA LIGADURA como texto cru no lugar do glifo.
    const listaPath = path.join(rootDir, 'public', 'fonts', 'icons.txt');
    assert.ok(fs.existsSync(listaPath), 'public/fonts/icons.txt must exist');

    const naFonte = new Set(
      fs.readFileSync(listaPath, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean),
    );

    const { execFileSync } = require('child_process');
    const usados = execFileSync('python3', [path.join(rootDir, 'scripts', 'listar-icones.py')], {
      encoding: 'utf8',
      env: { ...process.env, RAIZ: rootDir },
    })
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    assert.ok(usados.length > 0, 'icon scan must find icons in the source');

    const faltando = usados.filter((icone) => !naFonte.has(icone));
    assert.deepStrictEqual(
      faltando,
      [],
      `ícones usados no código e ausentes da fonte: ${faltando.join(', ')} — rode scripts/atualizar-fontes.sh`,
    );
  });

  await it('R2.2: as duas folhas de design definem suas paletas escuras e a ordem de cascata é explícita', () => {
    assert.ok(fs.existsSync(indexCssPath), 'src/index.css must exist');
    assert.ok(fs.existsSync(legacyCssPath), 'src/styles/rush-legacy.css must exist');
    assert.ok(fs.existsSync(rushCssPath), 'src/styles/rush-running.css must exist');

    const rootCss = fs.readFileSync(indexCssPath, 'utf8');
    // A ordem das camadas precisa ser declarada antes dos imports, senão os
    // utilitários do Tailwind perdem para o design system legado.
    assert.ok(rootCss.includes('@layer theme, base, rush-legacy, components, utilities'), 'index.css must declare the cascade layer order');
    assert.ok(rootCss.includes('@import "tailwindcss"'), 'index.css must import tailwindcss');
    assert.ok(rootCss.includes('layer(rush-legacy)'), 'index.css must import the legacy sheet into the rush-legacy layer');

    const legacyCss = fs.readFileSync(legacyCssPath, 'utf8');
    assert.ok(legacyCss.includes('#0f0f0f'), 'legacy CSS must define background token #0f0f0f');
    assert.ok(legacyCss.includes('#1a1a1a'), 'legacy CSS must define card background token #1a1a1a');
    assert.ok(legacyCss.includes('#FF3800'), 'legacy CSS must define primary brand token #FF3800');
    assert.ok(legacyCss.includes('Big Shoulders Display') || legacyCss.includes('Big Shoulders'), 'legacy CSS must use Big Shoulders Display for headlines');

    const rushCss = fs.readFileSync(rushCssPath, 'utf8');
    assert.ok(rushCss.includes('#0D0D0D'), 'rush-running CSS must define background token #0D0D0D');
    assert.ok(rushCss.includes('Anton'), 'rush-running CSS must use Anton for headlines');
    assert.ok(rushCss.includes('255, 85, 0'), 'rush-running CSS must define the kinetic orange glow');
  });

  await it('R2.3: shell legado mantém o limite de 430px e o ícone-fonte é protegido contra falha de carregamento', () => {
    const legacyCss = fs.readFileSync(legacyCssPath, 'utf8');
    assert.ok(legacyCss.includes('.app-shell'), 'legacy CSS must define .app-shell');
    assert.ok(legacyCss.includes('max-width: 430px') || legacyCss.includes('max-width:430px'), 'legacy CSS must restrict mobile shell to 430px');
    assert.ok(legacyCss.includes('.bottom-nav'), 'legacy CSS must define .bottom-nav');

    // Sem a fonte Material Symbols o navegador renderiza o nome da ligadura
    // como texto e destrói o layout: os glifos ficam ocultos até ela chegar.
    const rushCss = fs.readFileSync(rushCssPath, 'utf8');
    assert.ok(rushCss.includes('icons-ready'), 'rush-running CSS must guard icons until the icon font loads');

    const mainJs = fs.readFileSync(path.join(rootDir, 'src', 'main.jsx'), 'utf8');
    assert.ok(mainJs.includes('icons-ready'), 'main.jsx must set the icons-ready flag');
    assert.ok(mainJs.includes('measureText'), 'main.jsx must detect the icon font by measuring text, not document.fonts.check');
  });

  await it('R2.4: as 8 telas do design system novo existem, são montadas pelo shell e nenhuma página legada sobrevive', () => {
    // As páginas .jsx antigas (src/pages/Login, Onboarding, Dashboard, Feed,
    // Training, Profile) foram removidas: o app autenticado é montado pelo
    // RushShell a partir das telas em src/screens.
    //
    // CoachDashboard.jsx era a última delas, e caiu junto com a barra
    // inferior legada que só existia para servi-la: o módulo do treinador
    // dentro do shell faz tudo o que ela fazia, e mais.
    const screens = [
      'LoginScreen', 'OnboardingScreen', 'HomeScreen', 'MeasurementScreen',
      'WorkoutsScreen', 'FeedScreen', 'ProScreen', 'ProfileScreen',
    ];

    for (const screen of screens) {
      const screenPath = path.join(rootDir, 'src', 'screens', `${screen}.tsx`);
      assert.ok(fs.existsSync(screenPath), `src/screens/${screen}.tsx must exist`);
    }

    const shell = fs.readFileSync(path.join(rootDir, 'src', 'RushShell.tsx'), 'utf8');
    for (const screen of ['HomeScreen', 'MeasurementScreen', 'WorkoutsScreen', 'FeedScreen', 'ProScreen', 'ProfileScreen']) {
      assert.ok(shell.includes(`<${screen}`), `RushShell must render ${screen}`);
    }

    const appJsx = fs.readFileSync(path.join(rootDir, 'src', 'App.jsx'), 'utf8');
    assert.ok(appJsx.includes('RushShell'), 'App.jsx must route the authenticated area through RushShell');
    assert.ok(appJsx.includes('LoginScreen'), 'App.jsx must route /login through LoginScreen');
    assert.ok(appJsx.includes('OnboardingScreen'), 'App.jsx must route /onboarding through OnboardingScreen');

    for (const orphan of ['Login', 'Onboarding', 'Dashboard', 'Feed', 'Training', 'Profile', 'CoachDashboard']) {
      assert.ok(
        !fs.existsSync(path.join(rootDir, 'src', 'pages', `${orphan}.jsx`)),
        `src/pages/${orphan}.jsx was replaced by src/screens and must not come back`,
      );
    }

    // A barra legada saiu com o painel que ela servia. Se voltar, volta a
    // duplicar a navegação do shell — que é de onde veio o defeito dos
    // botões apontando para rotas inexistentes.
    assert.ok(
      !fs.existsSync(path.join(rootDir, 'src', 'components', 'BottomNav.jsx')),
      'src/components/BottomNav.jsx era a nav do painel legado e não deve voltar; a barra do app é src/components/rush/BottomNav.tsx',
    );

    // O módulo do treinador que substituiu o painel precisa estar montado.
    for (const coachScreen of ['CoachDashboardScreen', 'CoachAthleteScreen', 'CoachAthletesScreen', 'CoachPrescribeScreen']) {
      assert.ok(shell.includes(`<${coachScreen}`), `RushShell must render ${coachScreen}`);
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

  await it('R4.2b: os 8 tipos de atividade que a rota aceita são realmente graváveis', async () => {
    // A tabela antiga só permitia 6 tipos, com nomes diferentes dos que a
    // rota aceita: trilha, esteira, pedal e natação passavam na validação e
    // estouravam o CHECK do banco, devolvendo 500 ao cliente.
    const tipos = ['run', 'trail_run', 'treadmill', 'walk', 'cycling', 'swimming', 'strength', 'other'];

    for (const type of tipos) {
      const res = await request('POST', '/api/activities', {
        type,
        distance_km: 5,
        duration_seconds: 1800,
        title: `Aceitação ${type}`,
      }, {
        Authorization: `Bearer ${seedLoginToken}`,
      });
      assert.strictEqual(res.status, 201, `tipo ${type} deveria ser aceito, veio ${res.status}`);
      assert.strictEqual(res.body.activity.type, type, `tipo ${type} não foi gravado como enviado`);
    }
  });

  await it('R4.2c: exclusão de conta exige a senha e encerra o acesso', async () => {
    // App Store 5.1.1 exige exclusão dentro do app. Sendo irreversível, o
    // endpoint não pode se contentar com o token: um aparelho destravado
    // ou um token vazado apagaria a conta de outra pessoa.
    const email = `delete-${Date.now()}@rush.test`;
    const senha = 'SenhaForte12345';

    const registro = await request('POST', '/api/auth/register', {
      email, password: senha, name: 'Conta Descartável', username: `del${Date.now()}`.slice(0, 20),
    });
    assert.strictEqual(registro.status, 201, 'cadastro de apoio deve funcionar');
    const auth = { Authorization: `Bearer ${registro.body.access_token || registro.body.token}` };

    const semSenha = await request('DELETE', '/api/users/me', {}, auth);
    assert.strictEqual(semSenha.status, 400, 'sem senha deve ser recusado');

    const senhaErrada = await request('DELETE', '/api/users/me', { password: 'outra-senha' }, auth);
    assert.strictEqual(senhaErrada.status, 401, 'senha errada deve ser recusada');

    const intacta = await request('GET', '/api/users/me', null, auth);
    assert.strictEqual(intacta.status, 200, 'tentativa falha não pode excluir a conta');

    const excluida = await request('DELETE', '/api/users/me', { password: senha }, auth);
    assert.strictEqual(excluida.status, 200, 'senha correta deve excluir');

    const sumiu = await request('GET', '/api/users/me', null, auth);
    assert.strictEqual(sumiu.status, 404, 'conta excluída não pode mais ser lida');

    const login = await request('POST', '/api/auth/login', { email, password: senha });
    assert.ok(login.status >= 400, 'login deve ficar bloqueado após a exclusão');
  });

  await it('R4.2d: recorte de percurso recalcula a distância a partir dos pontos e pode ser desfeito', async () => {
    // Recortar não é digitar outro número: a distância é refeita somando
    // Haversine entre os pontos que sobram dentro da janela.
    const auth = { Authorization: `Bearer ${seedLoginToken}` };

    // 60 pontos a cada 10 s, 0,001° de latitude entre eles (~111 m cada).
    const t0 = Date.now() - 700000;
    const track = [];
    const hrSamples = [];
    for (let i = 0; i < 60; i++) {
      track.push({ lat: -22.97 + i * 0.001, lon: -43.18, t: t0 + i * 10000, acc: 5 });
      hrSamples.push({ t: i * 10, bpm: 150 });
    }

    const criada = await request('POST', '/api/activities', {
      type: 'run', title: 'Recorte de teste', distance_km: 6.6, duration_seconds: 590,
      track, hr_samples: hrSamples,
    }, auth);
    assert.strictEqual(criada.status, 201);
    const id = criada.body.activity.id;

    const semJanela = await request('POST', `/api/activities/${id}/trim`, { start_seconds: 100, end_seconds: 100 }, auth);
    assert.strictEqual(semJanela.status, 400, 'janela vazia deve ser recusada');

    const cortada = await request('POST', `/api/activities/${id}/trim`, { start_seconds: 0, end_seconds: 390 }, auth);
    assert.strictEqual(cortada.status, 200);

    // 40 pontos restantes, ~111 m entre cada par: cerca de 4,34 km.
    const distancia = cortada.body.activity.distance_km;
    assert.ok(
      Math.abs(distancia - 4.34) < 0.2,
      `distância recalculada deveria ficar perto de 4,34 km, veio ${distancia}`,
    );
    assert.strictEqual(cortada.body.activity.duration_seconds, 390);

    const detalhe = await request('GET', `/api/activities/${id}`, null, auth);
    assert.strictEqual(detalhe.body.track.length, 40, 'o traçado deve ficar só com os pontos da janela');
    assert.strictEqual(detalhe.body.hr_samples.length, 40, 'a série de FC acompanha o recorte');
    assert.ok(detalhe.body.trim, 'o original precisa ficar registrado para permitir desfazer');

    const desfeita = await request('POST', `/api/activities/${id}/trim/undo`, {}, auth);
    assert.strictEqual(desfeita.status, 200);
    assert.strictEqual(desfeita.body.activity.distance_km, 6.6, 'desfazer restaura a distância original');
    assert.strictEqual(desfeita.body.activity.duration_seconds, 590);

    const restaurada = await request('GET', `/api/activities/${id}`, null, auth);
    assert.strictEqual(restaurada.body.track.length, 60, 'desfazer restaura o traçado inteiro');
    assert.strictEqual(restaurada.body.trim, null, 'sem recorte pendente após desfazer');
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

  await it('R4.5b: perfil público respeita as flags de privacidade do dono e não vaza dados de cálculo', async () => {
    // O atleta novo registra uma corrida pública de 10 km.
    const corrida = await request('POST', '/api/activities', {
      type: 'run',
      title: 'Dez quilômetros públicos',
      distance_km: 10.2,
      duration_seconds: 2700,
      privacy: 'public',
    }, {
      Authorization: `Bearer ${newAthleteToken}`,
    });
    assert.strictEqual(corrida.status, 201);

    // E outra, mais rápida, porém privada: não pode virar recorde público.
    const privada = await request('POST', '/api/activities', {
      type: 'run',
      title: 'Dez quilômetros privados',
      distance_km: 10.2,
      duration_seconds: 2100,
      privacy: 'private',
    }, {
      Authorization: `Bearer ${newAthleteToken}`,
    });
    assert.strictEqual(privada.status, 201);

    // Com atividades e conquistas visíveis, o recorde aparece.
    const abrindo = await request('PUT', '/api/users/privacy', {
      public_activities: true,
      show_achievements: true,
    }, {
      Authorization: `Bearer ${newAthleteToken}`,
    });
    assert.strictEqual(abrindo.status, 200);

    const visivel = await request('GET', `/api/social/user/${newAthleteId}/profile`, null, {
      Authorization: `Bearer ${seedLoginToken}`,
    });
    assert.strictEqual(visivel.status, 200);
    const perfilVisivel = visivel.body.profile;
    assert.ok(perfilVisivel.records, 'recordes deveriam estar visíveis');
    assert.ok(perfilVisivel.records['10k'], 'deveria haver recorde de 10 km');
    // 2700 s em 10.2 km, normalizado para 10 km: a corrida privada (2100 s)
    // seria mais rápida e não pode ter sido considerada.
    assert.strictEqual(perfilVisivel.records['10k'].duration_seconds, Math.round((2700 / 10.2) * 10));
    assert.strictEqual(perfilVisivel.privacy.records_hidden, false);

    // Peso, altura e data de nascimento são dados de cálculo, não de vitrine.
    for (const campo of ['weight_kg', 'height_cm', 'date_of_birth', 'gender']) {
      assert.ok(!(campo in perfilVisivel), `${campo} não pode sair no perfil público`);
    }

    // Escondendo as conquistas, os recordes somem sem esconder o perfil.
    const fechando = await request('PUT', '/api/users/privacy', {
      show_achievements: false,
    }, {
      Authorization: `Bearer ${newAthleteToken}`,
    });
    assert.strictEqual(fechando.status, 200);

    const oculto = await request('GET', `/api/social/user/${newAthleteId}/profile`, null, {
      Authorization: `Bearer ${seedLoginToken}`,
    });
    assert.strictEqual(oculto.status, 200);
    assert.strictEqual(oculto.body.profile.records, null);
    assert.strictEqual(oculto.body.profile.privacy.records_hidden, true);
    assert.ok(oculto.body.profile.recent_activities.length > 0, 'atividades continuam públicas');

    // Escondendo as atividades, some tudo: lista, contagem e quilometragem.
    const privando = await request('PUT', '/api/users/privacy', {
      public_activities: false,
    }, {
      Authorization: `Bearer ${newAthleteToken}`,
    });
    assert.strictEqual(privando.status, 200);

    const fechado = await request('GET', `/api/social/user/${newAthleteId}/profile`, null, {
      Authorization: `Bearer ${seedLoginToken}`,
    });
    assert.strictEqual(fechado.status, 200);
    assert.strictEqual(fechado.body.profile.privacy.activities_hidden, true);
    assert.deepStrictEqual(fechado.body.profile.recent_activities, []);
    assert.strictEqual(fechado.body.profile.stats.activities, 0);
    assert.strictEqual(fechado.body.profile.stats.total_km, 0);

    // Mas o próprio dono continua vendo o que é dele.
    const proprio = await request('GET', `/api/social/user/${newAthleteId}/profile`, null, {
      Authorization: `Bearer ${newAthleteToken}`,
    });
    assert.strictEqual(proprio.status, 200);
    assert.strictEqual(proprio.body.profile.is_self, true);
    assert.ok(proprio.body.profile.stats.activities > 0, 'o dono vê as próprias atividades');

    // Devolve a privacidade ao estado aberto para não contaminar os testes seguintes.
    await request('PUT', '/api/users/privacy', {
      public_activities: true,
      show_achievements: true,
    }, {
      Authorization: `Bearer ${newAthleteToken}`,
    });
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
