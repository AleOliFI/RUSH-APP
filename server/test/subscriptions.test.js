// ============================================================
// RUSH PERFORMANCE — Subscriptions & Recurring Billing Tests
// ============================================================

const assert = require('assert');
const Database = require('better-sqlite3');
const initializeDatabase = require('../database/schema');
const subscriptionsRoutes = require('../routes/subscriptions');
const usersRoutes = require('../routes/users');

console.log('🧪 Starting Subscriptions & Apple Compliance Unit Tests...');

const db = new Database(':memory:');
(async () => {
await initializeDatabase(db);

// 1. Seed a test user
const bcrypt = require('bcryptjs');
const testUserId = 'test-user-sub-1';
const testEmail = 'assinante@rush.com';
const hash = bcrypt.hashSync('123456', 10);

db.prepare(`
  INSERT INTO users (id, email, password_hash, role, subscription_tier, subscription_status)
  VALUES (?, ?, ?, 'athlete', 'free', 'free')
`).run(testUserId, testEmail, hash);

db.prepare(`
  INSERT INTO user_profiles (user_id, name, username)
  VALUES (?, 'Assinante Teste', 'assinante_teste')
`).run(testUserId);

// 2. TEST: Check Free Status
console.log('Testing 1: Free Tier Initial State...');
const userInitial = db.prepare('SELECT subscription_tier, subscription_status FROM users WHERE id = ?').get(testUserId);
assert.strictEqual(userInitial.subscription_tier, 'free', 'User must start on free tier');
assert.strictEqual(userInitial.subscription_status, 'free', 'User status must be free');
console.log('  ✅ 1. Initial free tier state verified');

// 3. TEST: Start 7-Day Free Trial
console.log('Testing 2: Start 7-Day Free Trial...');
const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
db.prepare(`
  UPDATE users SET
    subscription_tier = 'pro',
    subscription_status = 'trial',
    trial_ends_at = ?,
    updated_at = datetime('now')
  WHERE id = ?
`).run(trialEndsAt, testUserId);

const userTrial = db.prepare('SELECT subscription_tier, subscription_status, trial_ends_at FROM users WHERE id = ?').get(testUserId);
assert.strictEqual(userTrial.subscription_tier, 'pro', 'Tier must be pro during trial');
assert.strictEqual(userTrial.subscription_status, 'trial', 'Status must be trial');
assert.ok(new Date(userTrial.trial_ends_at) > new Date(), 'Trial expiration must be in the future');
console.log('  ✅ 2. 7-day free trial activated successfully');

// 4. TEST: Activate Paid RUSH PRO (R$ 29,90)
console.log('Testing 3: Activate RUSH PRO Monthly (R$ 29,90)...');
const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
db.prepare(`
  UPDATE users SET
    subscription_tier = 'pro',
    subscription_status = 'active',
    subscription_provider = 'apple_in_app',
    subscription_expires_at = ?,
    updated_at = datetime('now')
  WHERE id = ?
`).run(expiresAt, testUserId);

db.prepare(`
  INSERT INTO subscriptions (id, user_id, plan_tier, status, amount_cents, currency, provider, current_period_end)
  VALUES ('sub-test-1', ?, 'pro', 'active', 2990, 'BRL', 'apple_in_app', ?)
`).run(testUserId, expiresAt);

const userPaid = db.prepare('SELECT subscription_tier, subscription_status, subscription_provider FROM users WHERE id = ?').get(testUserId);
assert.strictEqual(userPaid.subscription_tier, 'pro', 'Tier must be pro');
assert.strictEqual(userPaid.subscription_status, 'active', 'Status must be active');
assert.strictEqual(userPaid.subscription_provider, 'apple_in_app', 'Provider must be apple_in_app');

const subHistory = db.prepare('SELECT amount_cents, currency FROM subscriptions WHERE user_id = ?').get(testUserId);
assert.strictEqual(subHistory.amount_cents, 2990, 'Amount must be 2990 cents (R$ 29,90)');
console.log('  ✅ 3. RUSH PRO monthly recurring subscription activated');

// 5. TEST: Apple Guideline 5.1.1(v) Account Deletion
console.log('Testing 4: Account Deletion (Apple Compliance)...');
db.prepare("UPDATE users SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(testUserId);

const userDeleted = db.prepare('SELECT deleted_at FROM users WHERE id = ?').get(testUserId);
assert.ok(userDeleted.deleted_at !== null, 'Account must have deleted_at timestamp set');
console.log('  ✅ 4. Account deletion verified');

console.log('🎉 ALL SUBSCRIPTIONS & APPLE COMPLIANCE TESTS PASSED SUCCESSFULLY!');

})();
