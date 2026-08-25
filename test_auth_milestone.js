// ============================================================
// Comprehensive Auth & Session Verification Test Suite (M1)
// ============================================================

const assert = require('assert');

async function main() {
  console.log('🧪 Starting Milestone 1 Auth & Session Test Suite...\n');

  // Step 1: Re-seed database
  console.log('--- Step 1: Testing Seed Idempotency ---');
  require('./seed.js');
  console.log('✅ Seed completed successfully');

  // Step 2: Spin up Express server
  console.log('\n--- Step 2: Starting API Server ---');
  process.env.PORT = '3099';
  require('./server/index');

  // Allow server to bind
  await new Promise((resolve) => setTimeout(resolve, 500));

  const BASE_URL = 'http://127.0.0.1:3099/api';

  async function apiCall(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  }

  try {
    // ------------------------------------------------------------
    // Test 1: Register new user (with role escalation attempt)
    // ------------------------------------------------------------
    console.log('\n--- Test 1: User Registration ---');
    const newEmail = `runner_${Date.now()}@test.com`;
    const newUsername = `runner_${Date.now()}`;
    
    const regRes = await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: newEmail,
        password: 'password123',
        name: 'Novo Corredor',
        username: newUsername,
        role: 'admin', // Attempt privilege escalation
      }),
    });

    assert.strictEqual(regRes.status, 201, `Expected 201 Created, got ${regRes.status}: ${JSON.stringify(regRes.data)}`);
    assert.strictEqual(regRes.data.user.role, 'athlete', 'Role MUST be forced to athlete');
    assert.strictEqual(regRes.data.user.has_onboarding, false, 'New user without objectives must have has_onboarding: false');
    assert(Boolean(regRes.data.token), 'Must return access token');
    assert(Boolean(regRes.data.refreshToken), 'Must return refresh token');
    console.log('✅ Registration successful and role escalation prevented');

    const newAccessToken = regRes.data.token;
    const newRefreshToken = regRes.data.refreshToken;

    // ------------------------------------------------------------
    // Test 2: Validation errors on Register
    // ------------------------------------------------------------
    console.log('\n--- Test 2: Registration Validation Errors ---');
    // Duplicate email
    const dupRes = await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: newEmail,
        password: 'password123',
        name: 'Outro Nome',
        username: `unique_${Date.now()}`,
      }),
    });
    assert.strictEqual(dupRes.status, 409, 'Expected 409 on duplicate email');
    assert.strictEqual(dupRes.data.error, 'Email já cadastrado');
    console.log('✅ Duplicate email rejected (409)');

    // Short password
    const shortPw = await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: `short_${Date.now()}@test.com`,
        password: '123',
        name: 'Curto',
        username: `short_${Date.now()}`,
      }),
    });
    assert.strictEqual(shortPw.status, 400, 'Expected 400 on short password');
    console.log('✅ Short password rejected (400)');

    // Invalid email
    const badEmail = await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'invalid-email',
        password: 'password123',
        name: 'Invalido',
        username: `inv_${Date.now()}`,
      }),
    });
    assert.strictEqual(badEmail.status, 400, 'Expected 400 on invalid email');
    console.log('✅ Invalid email rejected (400)');

    // ------------------------------------------------------------
    // Test 3: Login with Seed Account
    // ------------------------------------------------------------
    console.log('\n--- Test 3: Login with Seed Account (alessandro@rush.com) ---');
    const loginRes = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'alessandro@rush.com',
        password: '123456',
      }),
    });

    assert.strictEqual(loginRes.status, 200, `Expected 200 OK, got ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
    assert.strictEqual(loginRes.data.user.email, 'alessandro@rush.com');
    assert.strictEqual(loginRes.data.user.role, 'owner');
    assert.strictEqual(loginRes.data.user.has_onboarding, true, 'Alessandro has objectives, has_onboarding must be true');
    assert(Boolean(loginRes.data.token), 'Must return token');
    assert(Boolean(loginRes.data.refreshToken), 'Must return refreshToken');
    console.log('✅ Seed login successful, has_onboarding is true');

    const alessandroToken = loginRes.data.token;
    const alessandroRefresh = loginRes.data.refreshToken;

    // ------------------------------------------------------------
    // Test 4: Login with Bad Credentials
    // ------------------------------------------------------------
    console.log('\n--- Test 4: Login with Wrong Password ---');
    const badLogin = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'alessandro@rush.com',
        password: 'wrongpassword',
      }),
    });
    assert.strictEqual(badLogin.status, 401, 'Expected 401 Unauthorized');
    assert.strictEqual(badLogin.data.error, 'Email ou senha incorretos');
    console.log('✅ Bad login rejected with 401 and descriptive message');

    // ------------------------------------------------------------
    // Test 5: GET /api/users/me Endpoint
    // ------------------------------------------------------------
    console.log('\n--- Test 5: GET /api/users/me ---');
    const meRes = await apiCall('/users/me', {
      headers: { Authorization: `Bearer ${alessandroToken}` },
    });
    assert.strictEqual(meRes.status, 200, `Expected 200, got ${meRes.status}`);
    assert.strictEqual(meRes.data.email, 'alessandro@rush.com');
    assert.strictEqual(meRes.data.has_onboarding, true);
    assert(Boolean(meRes.data.profile), 'Profile should be populated');
    assert(Boolean(meRes.data.objectives), 'Objectives should be populated');
    assert(Boolean(meRes.data.settings), 'Settings should be populated');
    console.log('✅ GET /api/users/me returned full profile and has_onboarding: true');

    // Check GET /api/users/me for new user without onboarding
    const newMeRes = await apiCall('/users/me', {
      headers: { Authorization: `Bearer ${newAccessToken}` },
    });
    assert.strictEqual(newMeRes.status, 200);
    assert.strictEqual(newMeRes.data.has_onboarding, false, 'New user must have has_onboarding: false');
    console.log('✅ GET /api/users/me for new user returned has_onboarding: false');

    // ------------------------------------------------------------
    // Test 6: Complete Onboarding via PUT /api/users/objectives
    // ------------------------------------------------------------
    console.log('\n--- Test 6: Onboarding Completion (PUT /api/users/objectives) ---');
    const objRes = await apiCall('/users/objectives', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${newAccessToken}` },
      body: JSON.stringify({
        distance_km: 10,
        level: 'beginner',
      }),
    });
    assert.strictEqual(objRes.status, 200, 'Expected 200 on setting objectives');

    // Now re-check /users/me
    const updatedMe = await apiCall('/users/me', {
      headers: { Authorization: `Bearer ${newAccessToken}` },
    });
    assert.strictEqual(updatedMe.data.has_onboarding, true, 'After objectives set, has_onboarding must be true');
    console.log('✅ Objectives saved and has_onboarding transitioned from false to true');

    // ------------------------------------------------------------
    // Test 7: Token Refresh & Rotation
    // ------------------------------------------------------------
    console.log('\n--- Test 7: Refresh Token Rotation & Invalidation ---');
    const refreshRes = await apiCall('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: alessandroRefresh }),
    });
    assert.strictEqual(refreshRes.status, 200, 'Expected 200 on valid refresh');
    assert(Boolean(refreshRes.data.access_token || refreshRes.data.token), 'Must return new access token');
    assert(Boolean(refreshRes.data.refresh_token || refreshRes.data.refreshToken), 'Must return new refresh token');

    const rotatedAccessToken = refreshRes.data.access_token || refreshRes.data.token;
    const rotatedRefreshToken = refreshRes.data.refresh_token || refreshRes.data.refreshToken;

    // Test that the OLD refresh token is now revoked
    const oldRefreshRes = await apiCall('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: alessandroRefresh }),
    });
    assert.strictEqual(oldRefreshRes.status, 401, 'Old refresh token must be revoked after rotation');
    console.log('✅ Refresh token rotated; old refresh token invalidated');

    // Test that new access token works
    const testWithNewToken = await apiCall('/users/me', {
      headers: { Authorization: `Bearer ${rotatedAccessToken}` },
    });
    assert.strictEqual(testWithNewToken.status, 200, 'New access token must be valid');
    console.log('✅ Rotated access token authenticated successfully');

    // ------------------------------------------------------------
    // Test 8: Logout Revocation
    // ------------------------------------------------------------
    console.log('\n--- Test 8: Logout Revocation ---');
    const logoutRes = await apiCall('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${rotatedAccessToken}` },
    });
    assert.strictEqual(logoutRes.status, 200, 'Expected 200 on logout');

    // Refresh with the rotated token must now fail
    const postLogoutRefresh = await apiCall('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: rotatedRefreshToken }),
    });
    assert.strictEqual(postLogoutRefresh.status, 401, 'Refresh after logout must be revoked (401)');
    console.log('✅ Logout successfully cleared refresh tokens');

    console.log('\n🎉 ALL MILESTONE 1 VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failure:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
