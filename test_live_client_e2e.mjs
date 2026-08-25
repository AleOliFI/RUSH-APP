// ============================================================
// Live Backend + Client-Side API Integration Test Harness
// Milestone 1 Challenger 2
// ============================================================

import assert from 'node:assert';
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

global.localStorage = new MockLocalStorage();
global.window = new MockWindow();
global.CustomEvent = MockCustomEvent;

async function runLiveE2E() {
  console.log('⚡ [Challenger 2] Initializing Live Backend + Client API Integration Tests...\n');

  // Step 1: Re-seed database
  console.log('--- Step 1: Database Seed ---');
  const { default: seed } = await import('./seed.js').catch(async () => {
    // seed.js is CommonJS
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    return { default: require('./seed.js') };
  });
  console.log('✔ Database seeded cleanly');

  // Step 2: Start Express Server
  console.log('\n--- Step 2: Express Server Start (Port 3097) ---');
  process.env.PORT = '3097';
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  require('./server/index');
  await new Promise((resolve) => setTimeout(resolve, 600));

  // Step 3: Direct all /api fetch calls to http://127.0.0.1:3097/api
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const fullUrl = url.startsWith('/api') ? `http://127.0.0.1:3097${url}` : url;
    return originalFetch(fullUrl, options);
  };

  // Step 4: Import src/api.js
  const {
    auth,
    users,
    hrv,
    training,
    activities,
    notifications,
    social,
    setAuth,
    clearAuth,
    getUser,
    getToken,
    getRefreshToken,
    request,
  } = await import('./src/api.js');

  try {
    // --------------------------------------------------------
    // Scenario 1: New Athlete Registration & Onboarding Lifecycle
    // --------------------------------------------------------
    console.log('\n--- Scenario 1: Full Athlete Registration & Onboarding Lifecycle ---');
    clearAuth();
    const athleteEmail = `athlete_${Date.now()}@rush.com`;
    const athleteUsername = `athlete_${Date.now()}`;

    const regResponse = await auth.register({
      email: athleteEmail,
      password: 'password123',
      name: 'Corredor Challenger',
      username: athleteUsername,
    });

    setAuth(regResponse);
    assert.strictEqual(getUser().email, athleteEmail);
    assert.strictEqual(getUser().role, 'athlete');
    assert.strictEqual(getUser().has_onboarding, false, 'New user must have has_onboarding: false');
    assert(Boolean(getToken()), 'Access token must be present in storage');
    assert(Boolean(getRefreshToken()), 'Refresh token must be present in storage');
    console.log('  ✔ Registration completed, tokens stored, has_onboarding: false confirmed');

    // Query me endpoint
    const meBefore = await users.me();
    assert.strictEqual(meBefore.email, athleteEmail);
    assert.strictEqual(meBefore.has_onboarding, false);
    console.log('  ✔ users.me() returns has_onboarding: false before onboarding');

    // Complete onboarding
    console.log('  -> Completing onboarding (setting objectives and generating plan)...');
    const objResult = await users.objectives({ distance_km: 21, level: 'intermediate' });
    assert.strictEqual(objResult.distance_km, 21);
    assert.strictEqual(objResult.level, 'intermediate');

    const planResult = await training.generatePlan({ distance_km: 21, level: 'intermediate' });
    assert(Boolean(planResult.plan), 'Training plan generated successfully');

    // Verify me endpoint now returns has_onboarding: true
    const meAfter = await users.me();
    assert.strictEqual(meAfter.has_onboarding, true, 'has_onboarding must transition to true after setting objectives');
    console.log('  ✔ users.me() returns has_onboarding: true after onboarding completion');

    // --------------------------------------------------------
    // Scenario 2: Dashboard Data Retrieval with Valid Session
    // --------------------------------------------------------
    console.log('\n--- Scenario 2: Dashboard API Ingestion ---');
    const [hrvData, myPlanData, statsData, notifData, feedData] = await Promise.all([
      hrv.status(),
      training.myPlan(),
      activities.stats(30),
      notifications.unreadCount(),
      social.feed('following', 1),
    ]);

    assert(Boolean(hrvData), 'hrv.status() must return data');
    assert.strictEqual(myPlanData.has_plan, true, 'training.myPlan() must return active plan created in onboarding');
    assert.strictEqual(myPlanData.plan.distance_km, 21);
    assert(Boolean(statsData.stats), 'activities.stats() must return stats object');
    assert(typeof notifData.unread_count === 'number', 'notifications.unreadCount() must return unread_count number');
    assert(Array.isArray(feedData.feed), 'social.feed() must return feed array');
    console.log('  ✔ All dashboard and social APIs loaded successfully with authenticated session');

    // --------------------------------------------------------
    // Scenario 3: Real JWT Expiration & Transparent Refresh Rotation
    // --------------------------------------------------------
    console.log('\n--- Scenario 3: Live JWT 401 Interception & Transparent Refresh Rotation ---');
    const initialAccessToken = getToken();
    const initialRefreshToken = getRefreshToken();

    // Advance 1.1s so JWT iat timestamp advances
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Intentionally corrupt access token to simulate expiration (backend will return 401 TOKEN_EXPIRED / INVALID)
    localStorage.setItem('rush_token', 'expired.invalid.jwt_token_payload');

    console.log('  -> Sending request with tampered/expired access token...');
    const userProfileAfterRefresh = await users.me();
    assert.strictEqual(userProfileAfterRefresh.email, athleteEmail, 'Request must succeed transparently after refresh');

    const rotatedAccessToken = getToken();
    const rotatedRefreshToken = getRefreshToken();

    assert.notStrictEqual(rotatedAccessToken, 'expired.invalid.jwt_token_payload', 'Access token must be updated with new valid token');
    assert.notStrictEqual(rotatedAccessToken, initialAccessToken, 'Access token must be newly issued');
    assert.notStrictEqual(rotatedRefreshToken, initialRefreshToken, 'Refresh token must be rotated atomically');
    console.log('  ✔ 401 intercepted: refresh token rotated and access token transparently updated in storage');

    // --------------------------------------------------------
    // Scenario 4: Concurrent Parallel Requests Triggering Refresh
    // --------------------------------------------------------
    console.log('\n--- Scenario 4: Live Concurrency Stress Test (10 parallel requests on expired token) ---');
    localStorage.setItem('rush_token', 'expired.invalid.jwt_token_concurrency');
    const tokenBeforeStress = getToken();
    const refreshBeforeStress = getRefreshToken();

    const parallelCalls = [
      users.me(),
      training.myPlan(),
      activities.stats(30),
      notifications.unreadCount(),
      social.feed('following', 1),
      users.profile(),
      hrv.status(),
      users.me(),
      training.myPlan(),
      activities.stats(30),
    ];

    const batchResults = await Promise.all(parallelCalls);
    assert.strictEqual(batchResults.length, 10, 'All 10 concurrent requests must resolve successfully');
    const tokenAfterStress = getToken();
    const refreshAfterStress = getRefreshToken();
    assert.notStrictEqual(tokenAfterStress, tokenBeforeStress);
    assert.notStrictEqual(refreshAfterStress, refreshBeforeStress);
    console.log('  ✔ All 10 parallel requests resolved without race condition collisions or 401 failures');

    // --------------------------------------------------------
    // Scenario 5: Logout and Refresh Revocation
    // --------------------------------------------------------
    console.log('\n--- Scenario 5: Logout Revocation ---');
    const currentRefresh = getRefreshToken();
    await auth.logout();
    clearAuth();
    assert.strictEqual(getToken(), null);
    assert.strictEqual(getRefreshToken(), null);
    assert.strictEqual(getUser(), null);

    // Verify that attempting to use the revoked refresh token fails
    let refreshErr = null;
    try {
      await auth.refresh(currentRefresh);
    } catch (e) {
      refreshErr = e;
    }
    assert(Boolean(refreshErr), 'Refresh with revoked token must fail');
    console.log('  ✔ Logout cleared local storage and revoked refresh token on server');

    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL LIVE BACKEND + CLIENT INTEGRATION TESTS PASSED! 🎉');
    console.log('='.repeat(60) + '\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ LIVE E2E TEST FAILED:', err);
    process.exit(1);
  }
}

runLiveE2E();
