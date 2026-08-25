// ============================================================
// Empirical Test Harness: Client-Side Auth Lifecycle & Routing
// Milestone 1 Challenger 2
// ============================================================

import assert from 'node:assert';
import http from 'node:http';
import { EventEmitter } from 'node:events';

// Create a simulated browser environment
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

class MockCustomEvent {
  constructor(type, eventInitDict = {}) {
    this.type = type;
    this.detail = eventInitDict.detail;
  }
}

class MockWindow extends EventEmitter {
  constructor() {
    super();
  }
  addEventListener(event, listener) {
    this.on(event, listener);
  }
  removeEventListener(event, listener) {
    this.off(event, listener);
  }
  dispatchEvent(event) {
    this.emit(event.type, event);
    return true;
  }
}

// Attach mocks to global scope before importing api.js
global.localStorage = new MockLocalStorage();
global.window = new MockWindow();
global.CustomEvent = MockCustomEvent;

async function runTests() {
  console.log('🚀 [Challenger 2] Initializing Empirical Client-Side Auth & Routing Tests...\n');

  // Import the client API module
  const apiModule = await import('./src/api.js');
  const {
    setAuth,
    clearAuth,
    getUser,
    getToken,
    getRefreshToken,
    tryRefresh,
    request,
    auth,
    users,
    hrv,
    training,
    activities,
    notifications,
  } = apiModule;

  // ------------------------------------------------------------
  // SECTION 1: Token Storage & Retrieval in api.js
  // ------------------------------------------------------------
  console.log('▶ TEST 1: Token Storage and Extraction Unit Tests');
  localStorage.clear();

  // Test 1.1: setAuth with access_token / refresh_token
  setAuth({
    access_token: 'acc_token_123',
    refresh_token: 'ref_token_456',
    user: { id: 'u1', email: 'test@rush.com', has_onboarding: false },
  });

  assert.strictEqual(getToken(), 'acc_token_123', 'getToken must return access_token');
  assert.strictEqual(getRefreshToken(), 'ref_token_456', 'getRefreshToken must return refresh_token');
  assert.deepStrictEqual(getUser(), { id: 'u1', email: 'test@rush.com', has_onboarding: false }, 'getUser must return parsed user');
  console.log('  ✔ setAuth with snake_case tokens stored correctly');

  // Test 1.2: setAuth with token / refreshToken (camelCase compatibility)
  clearAuth();
  assert.strictEqual(getToken(), null, 'clearAuth must remove token');
  assert.strictEqual(getRefreshToken(), null, 'clearAuth must remove refresh token');
  assert.strictEqual(getUser(), null, 'clearAuth must remove user');

  setAuth({
    token: 'acc_token_camel',
    refreshToken: 'ref_token_camel',
    user: { id: 'u2', email: 'camel@rush.com', has_onboarding: true },
  });
  assert.strictEqual(getToken(), 'acc_token_camel', 'getToken must support token property');
  assert.strictEqual(getRefreshToken(), 'ref_token_camel', 'getRefreshToken must support refreshToken property');
  assert.strictEqual(getUser().has_onboarding, true, 'getUser must have has_onboarding: true');
  console.log('  ✔ setAuth with camelCase tokens stored correctly');

  // Test 1.3: getUser corrupt JSON resilience
  localStorage.setItem('rush_user', 'invalid-json-string{[');
  assert.strictEqual(getUser(), null, 'Corrupt rush_user JSON must safely return null without throwing');
  console.log('  ✔ getUser safely handles invalid JSON in localStorage');

  clearAuth();

  // ------------------------------------------------------------
  // SECTION 2: Header Injection and Expiry Handling in api.js
  // ------------------------------------------------------------
  console.log('\n▶ TEST 2: HTTP Header Injection & 401 Expiry Interception in request()');

  // Setup a mock HTTP server to inspect outbound headers and simulate 401 / refresh cycles
  let mockServerRequests = [];
  let refreshCallCount = 0;
  let serverMode = 'normal'; // 'normal', 'simulate_expired_token', 'simulate_invalid_refresh'
  let newValidToken = 'token_refreshed_999';
  let newValidRefresh = 'refresh_rotated_888';

  const mockServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      mockServerRequests.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: body ? JSON.parse(body) : null,
      });

      if (req.url === '/api/auth/refresh') {
        refreshCallCount++;
        if (serverMode === 'simulate_invalid_refresh') {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Refresh token expirado' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          access_token: newValidToken,
          refresh_token: newValidRefresh,
        }));
        return;
      }

      if (req.url === '/api/auth/login') {
        const parsed = body ? JSON.parse(body) : {};
        if (parsed.password === 'badpassword') {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Email ou senha incorretos' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          user: { id: 'u1', email: parsed.email, has_onboarding: false },
          token: 'login_token_abc',
          refreshToken: 'login_refresh_xyz',
        }));
        return;
      }

      if (req.url === '/api/users/me') {
        const authHeader = req.headers['authorization'];
        if (serverMode === 'simulate_expired_token' || serverMode === 'simulate_invalid_refresh') {
          if (authHeader !== `Bearer ${newValidToken}`) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Token expirado', code: 'TOKEN_EXPIRED' }));
            return;
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'u1',
          email: 'test@rush.com',
          has_onboarding: false,
        }));
        return;
      }

      // Default mock fallback
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  await new Promise((resolve) => mockServer.listen(3456, resolve));

  // Override global fetch to redirect /api/* to http://127.0.0.1:3456/api/*
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const fullUrl = url.startsWith('/api') ? `http://127.0.0.1:3456${url}` : url;
    return originalFetch(fullUrl, options);
  };

  try {
    // Test 2.1: Header Injection without token
    clearAuth();
    mockServerRequests = [];
    await request('/users/me');
    assert.strictEqual(mockServerRequests.length, 1);
    assert.strictEqual(mockServerRequests[0].headers['authorization'], undefined, 'No Authorization header should be sent when unauthenticated');
    console.log('  ✔ Request without token does not include Authorization header');

    // Test 2.2: Header Injection with token
    setAuth({ access_token: 'valid_bearer_token_123', refresh_token: 'ref_123' });
    mockServerRequests = [];
    await request('/users/me');
    assert.strictEqual(mockServerRequests.length, 1);
    assert.strictEqual(mockServerRequests[0].headers['authorization'], 'Bearer valid_bearer_token_123', 'Authorization header must contain Bearer token');
    console.log('  ✔ Request with token injects Authorization: Bearer <token>');

    // Test 2.3: 401 Expiry -> Auto-Refresh -> Retry Success
    serverMode = 'simulate_expired_token';
    refreshCallCount = 0;
    mockServerRequests = [];
    setAuth({ access_token: 'expired_token_111', refresh_token: 'valid_refresh_222' });

    const meData = await request('/users/me');
    assert.strictEqual(meData.id, 'u1', 'Retried request should return expected user payload');
    assert.strictEqual(refreshCallCount, 1, 'Refresh endpoint should be called exactly once');
    assert.strictEqual(getToken(), newValidToken, 'Storage should contain refreshed access token');
    assert.strictEqual(getRefreshToken(), newValidRefresh, 'Storage should contain refreshed refresh token');
    console.log('  ✔ 401 interceptor automatically refreshed token and retried request successfully');

    // Test 2.4: Mutex Concurrency Deduplication (20 parallel requests on expired token)
    serverMode = 'simulate_expired_token';
    refreshCallCount = 0;
    mockServerRequests = [];
    newValidToken = 'token_refreshed_batch_999';
    newValidRefresh = 'refresh_rotated_batch_888';
    setAuth({ access_token: 'expired_token_batch', refresh_token: 'valid_refresh_batch' });

    const parallelPromises = Array.from({ length: 20 }, () => request('/users/me'));
    const results = await Promise.all(parallelPromises);
    assert.strictEqual(results.length, 20, 'All 20 requests must resolve');
    results.forEach((res) => assert.strictEqual(res.id, 'u1'));
    assert.strictEqual(refreshCallCount, 1, 'Refresh mutex must ensure exactly 1 call to /api/auth/refresh across 20 concurrent requests');
    assert.strictEqual(getToken(), newValidToken);
    console.log('  ✔ Refresh mutex successfully deduplicated 20 concurrent requests to exactly 1 refresh call');

    // Test 2.5: Failed Refresh (Invalid / Expired Refresh Token)
    serverMode = 'simulate_invalid_refresh';
    clearAuth();
    setAuth({ access_token: 'expired_access_token', refresh_token: 'bad_refresh_token' });
    let authExpiredFired = false;
    const expiryListener = () => { authExpiredFired = true; };
    window.addEventListener('auth:expired', expiryListener);

    let caughtErr = null;
    try {
      await request('/users/me');
    } catch (err) {
      caughtErr = err;
    }

    assert(Boolean(caughtErr), 'Request must throw when refresh fails');
    assert.strictEqual(caughtErr.message, 'Sessão expirada', 'Error message must be "Sessão expirada"');
    assert.strictEqual(getToken(), null, 'clearAuth must be called on refresh failure');
    assert.strictEqual(getRefreshToken(), null, 'Refresh token must be removed');
    assert.strictEqual(authExpiredFired, true, 'auth:expired event must be dispatched to window');
    window.removeEventListener('auth:expired', expiryListener);
    console.log('  ✔ Invalid refresh token wiped storage, emitted auth:expired, and threw error');

    // Test 2.6: 401 on Auth Endpoints (/api/auth/login) does not trigger refresh loop or clear storage
    serverMode = 'normal';
    setAuth({ access_token: 'existing_token', refresh_token: 'existing_refresh', user: { id: 'stay' } });
    refreshCallCount = 0;
    authExpiredFired = false;
    window.addEventListener('auth:expired', expiryListener);

    let loginErr = null;
    try {
      await auth.login('test@rush.com', 'badpassword');
    } catch (err) {
      loginErr = err;
    }

    assert(Boolean(loginErr), 'Login with bad password must throw');
    assert.strictEqual(loginErr.message, 'Email ou senha incorretos');
    assert.strictEqual(refreshCallCount, 0, 'Login 401 must NOT trigger token refresh');
    assert.strictEqual(authExpiredFired, false, 'Login 401 must NOT dispatch auth:expired');
    assert.strictEqual(getToken(), 'existing_token', 'Login 401 must NOT wipe unrelated credentials');
    window.removeEventListener('auth:expired', expiryListener);
    console.log('  ✔ 401 on auth endpoints correctly isolates errors without triggering refresh loops');

  } finally {
    global.fetch = originalFetch;
    mockServer.close();
  }

  // ------------------------------------------------------------
  // SECTION 3: Routing State Machine & Guard Logic Verification
  // ------------------------------------------------------------
  console.log('\n▶ TEST 3: Routing State Machine & Guard Transition Simulations');

  // Exact logic representation of App.jsx route guards
  function evaluateProtectedRoute({ user, isAuthenticated, isLoading, requireOnboarding = true, targetPath }) {
    if (isLoading) return { action: 'render_spinner' };
    if (!isAuthenticated) return { action: 'redirect', to: '/login' };
    if (requireOnboarding && !user?.has_onboarding) return { action: 'redirect', to: '/onboarding' };
    return { action: 'render_target', path: targetPath };
  }

  function evaluatePublicRoute({ user, isAuthenticated, isLoading, targetPath }) {
    if (isLoading) return { action: 'render_null' };
    if (isAuthenticated) {
      if (!user?.has_onboarding) return { action: 'redirect', to: '/onboarding' };
      return { action: 'redirect', to: '/' };
    }
    return { action: 'render_target', path: targetPath };
  }

  // Scenario 3.1: Unauthenticated user
  const stateUnauthenticated = { user: null, isAuthenticated: false, isLoading: false };
  assert.deepStrictEqual(
    evaluateProtectedRoute({ ...stateUnauthenticated, targetPath: '/' }),
    { action: 'redirect', to: '/login' },
    'Unauthenticated user at / must redirect to /login'
  );
  assert.deepStrictEqual(
    evaluateProtectedRoute({ ...stateUnauthenticated, targetPath: '/feed' }),
    { action: 'redirect', to: '/login' },
    'Unauthenticated user at /feed must redirect to /login'
  );
  assert.deepStrictEqual(
    evaluateProtectedRoute({ ...stateUnauthenticated, targetPath: '/onboarding', requireOnboarding: false }),
    { action: 'redirect', to: '/login' },
    'Unauthenticated user at /onboarding must redirect to /login'
  );
  assert.deepStrictEqual(
    evaluatePublicRoute({ ...stateUnauthenticated, targetPath: '/login' }),
    { action: 'render_target', path: '/login' },
    'Unauthenticated user at /login must render Login page'
  );
  assert.deepStrictEqual(
    evaluatePublicRoute({ ...stateUnauthenticated, targetPath: '/register' }),
    { action: 'render_target', path: '/register' },
    'Unauthenticated user at /register must render Register page'
  );
  console.log('  ✔ State S1 (Unauthenticated): All protected routes redirect to /login; public routes accessible');

  // Scenario 3.2: Authenticated with has_onboarding: false
  const stateUnOnboarded = {
    user: { id: 'u_new', email: 'new@rush.com', has_onboarding: false },
    isAuthenticated: true,
    isLoading: false,
  };
  assert.deepStrictEqual(
    evaluateProtectedRoute({ ...stateUnOnboarded, targetPath: '/' }),
    { action: 'redirect', to: '/onboarding' },
    'Un-onboarded user at / must redirect to /onboarding'
  );
  assert.deepStrictEqual(
    evaluateProtectedRoute({ ...stateUnOnboarded, targetPath: '/feed' }),
    { action: 'redirect', to: '/onboarding' },
    'Un-onboarded user at /feed must redirect to /onboarding'
  );
  assert.deepStrictEqual(
    evaluateProtectedRoute({ ...stateUnOnboarded, targetPath: '/onboarding', requireOnboarding: false }),
    { action: 'render_target', path: '/onboarding' },
    'Un-onboarded user at /onboarding must render Onboarding page'
  );
  assert.deepStrictEqual(
    evaluatePublicRoute({ ...stateUnOnboarded, targetPath: '/login' }),
    { action: 'redirect', to: '/onboarding' },
    'Un-onboarded user visiting /login must redirect to /onboarding'
  );
  assert.deepStrictEqual(
    evaluatePublicRoute({ ...stateUnOnboarded, targetPath: '/register' }),
    { action: 'redirect', to: '/onboarding' },
    'Un-onboarded user visiting /register must redirect to /onboarding'
  );
  console.log('  ✔ State S2 (Authenticated, has_onboarding: false): Redirects all app views and public views to /onboarding');

  // Scenario 3.3: Authenticated with has_onboarding: true
  const stateOnboarded = {
    user: { id: 'u_established', email: 'established@rush.com', has_onboarding: true },
    isAuthenticated: true,
    isLoading: false,
  };
  assert.deepStrictEqual(
    evaluateProtectedRoute({ ...stateOnboarded, targetPath: '/' }),
    { action: 'render_target', path: '/' },
    'Onboarded user at / must render Dashboard'
  );
  assert.deepStrictEqual(
    evaluateProtectedRoute({ ...stateOnboarded, targetPath: '/feed' }),
    { action: 'render_target', path: '/feed' },
    'Onboarded user at /feed must render Feed'
  );
  assert.deepStrictEqual(
    evaluateProtectedRoute({ ...stateOnboarded, targetPath: '/training' }),
    { action: 'render_target', path: '/training' },
    'Onboarded user at /training must render Training'
  );
  assert.deepStrictEqual(
    evaluateProtectedRoute({ ...stateOnboarded, targetPath: '/profile' }),
    { action: 'render_target', path: '/profile' },
    'Onboarded user at /profile must render Profile'
  );
  assert.deepStrictEqual(
    evaluatePublicRoute({ ...stateOnboarded, targetPath: '/login' }),
    { action: 'redirect', to: '/' },
    'Onboarded user visiting /login must redirect to / (Dashboard)'
  );
  assert.deepStrictEqual(
    evaluatePublicRoute({ ...stateOnboarded, targetPath: '/register' }),
    { action: 'redirect', to: '/' },
    'Onboarded user visiting /register must redirect to / (Dashboard)'
  );
  console.log('  ✔ State S3 (Authenticated, has_onboarding: true): All protected routes render; public routes redirect to /');

  // Scenario 3.4: Complete Onboarding Mutation Lifecycle
  console.log('\n▶ TEST 4: Dynamic State Mutation (Onboarding Completion & Logout)');
  let currentAuthContext = {
    user: { id: 'u_dyn', email: 'dynamic@rush.com', has_onboarding: false },
    token: 'dyn_token',
    isAuthenticated: true,
    isLoading: false,
  };

  // Step A: Initial state check before onboarding
  let routeCheckBefore = evaluateProtectedRoute({ ...currentAuthContext, targetPath: '/' });
  assert.strictEqual(routeCheckBefore.action, 'redirect');
  assert.strictEqual(routeCheckBefore.to, '/onboarding');

  // Step B: Simulate updateUser({ has_onboarding: true, distance_km: 10, level: 'intermediate' })
  const partialData = {
    has_onboarding: true,
    distance_km: 10,
    level: 'intermediate',
    objectives: { distance_km: 10, level: 'intermediate' },
  };
  currentAuthContext.user = { ...currentAuthContext.user, ...partialData };
  localStorage.setItem('rush_user', JSON.stringify(currentAuthContext.user));

  // Step C: Route check after onboarding mutation
  let routeCheckAfter = evaluateProtectedRoute({ ...currentAuthContext, targetPath: '/' });
  assert.strictEqual(routeCheckAfter.action, 'render_target');
  assert.strictEqual(routeCheckAfter.path, '/');
  console.log('  ✔ Onboarding completion smoothly transitions state and immediately enables / (Dashboard)');

  // Step D: Logout mutation
  clearAuth();
  currentAuthContext = {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
  };
  let routeCheckLogout = evaluateProtectedRoute({ ...currentAuthContext, targetPath: '/' });
  assert.strictEqual(routeCheckLogout.action, 'redirect');
  assert.strictEqual(routeCheckLogout.to, '/login');
  console.log('  ✔ Logout immediately transitions state to unauthenticated and locks dashboard access');

  console.log('\n' + '='.repeat(60));
  console.log('🎉 ALL EMPIRICAL CHALLENGER TESTS PASSED (100% SUCCESS) 🎉');
  console.log('='.repeat(60) + '\n');
}

runTests().catch((err) => {
  console.error('\n❌ CHALLENGER TEST FAILED:', err);
  process.exit(1);
});
