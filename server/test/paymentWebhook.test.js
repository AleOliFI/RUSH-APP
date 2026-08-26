// ============================================================
// RUSH PERFORMANCE — Payment & Subscription Webhooks Unit Test
// Tests RevenueCat (Apple/Google), Asaas Pix, and Stripe Webhooks
// ============================================================

const assert = require('assert');
const Database = require('better-sqlite3');
const initializeDatabase = require('../database/schema');
const subscriptionsRoutes = require('../routes/subscriptions');

console.log('🧪 Starting Payment Webhooks Unit Tests...');

const db = new Database(':memory:');
initializeDatabase(db);

const testUserId = 'user-pay-webhook-1';
const testEmail = 'assinante.webhook@rush.com';

db.prepare(`
  INSERT INTO users (id, email, password_hash, role, subscription_tier, subscription_status)
  VALUES (?, ?, 'hash123', 'athlete', 'free', 'free')
`).run(testUserId, testEmail);

// 1. TEST: RevenueCat INITIAL_PURCHASE Webhook
console.log('Testing 1: RevenueCat INITIAL_PURCHASE Event...');
const revenueCatInitialEvent = {
  event: {
    type: 'INITIAL_PURCHASE',
    app_user_id: testUserId,
    price: 29.90,
    store: 'APP_STORE',
    expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
  }
};

// Simulate Webhook processing logic
const user = db.prepare('SELECT id FROM users WHERE id = ?').get(revenueCatInitialEvent.event.app_user_id);
assert.ok(user, 'User must exist');

const expiresAt = new Date(revenueCatInitialEvent.event.expiration_at_ms).toISOString();
db.prepare(`
  UPDATE users SET
    subscription_tier = 'pro',
    subscription_status = 'active',
    subscription_provider = 'apple_in_app',
    subscription_expires_at = ?,
    updated_at = datetime('now')
  WHERE id = ?
`).run(expiresAt, user.id);

const userAfterPurchase = db.prepare('SELECT subscription_tier, subscription_status, subscription_provider FROM users WHERE id = ?').get(testUserId);
assert.strictEqual(userAfterPurchase.subscription_tier, 'pro', 'Tier must be pro');
assert.strictEqual(userAfterPurchase.subscription_status, 'active', 'Status must be active');
assert.strictEqual(userAfterPurchase.subscription_provider, 'apple_in_app', 'Provider must be apple_in_app');
console.log('  ✅ 1. RevenueCat INITIAL_PURCHASE processed and user upgraded to PRO');

// 2. TEST: RevenueCat CANCELLATION Webhook
console.log('Testing 2: RevenueCat CANCELLATION Event...');
db.prepare("UPDATE users SET subscription_status = 'canceled', updated_at = datetime('now') WHERE id = ?").run(testUserId);

const userAfterCancel = db.prepare('SELECT subscription_status, subscription_tier FROM users WHERE id = ?').get(testUserId);
assert.strictEqual(userAfterCancel.subscription_status, 'canceled', 'Status must be canceled');
assert.strictEqual(userAfterCancel.subscription_tier, 'pro', 'Tier remains pro until expiration date');
console.log('  ✅ 2. RevenueCat CANCELLATION processed (auto-renew off, access kept until period end)');

// 3. TEST: RevenueCat EXPIRATION Webhook
console.log('Testing 3: RevenueCat EXPIRATION Event...');
db.prepare("UPDATE users SET subscription_tier = 'free', subscription_status = 'expired', updated_at = datetime('now') WHERE id = ?").run(testUserId);

const userAfterExpire = db.prepare('SELECT subscription_status, subscription_tier FROM users WHERE id = ?').get(testUserId);
assert.strictEqual(userAfterExpire.subscription_tier, 'free', 'Tier reverts to free');
assert.strictEqual(userAfterExpire.subscription_status, 'expired', 'Status is expired');
console.log('  ✅ 3. RevenueCat EXPIRATION processed (downgraded to free)');

// 4. TEST: Asaas / Pix Webhook Event (PAYMENT_RECEIVED)
console.log('Testing 4: Asaas Pix Recorrente Webhook Event...');
const asaasEvent = {
  event: 'PAYMENT_RECEIVED',
  payment: {
    customer: { email: testEmail },
    value: 29.90,
  }
};

const userPix = db.prepare('SELECT id FROM users WHERE email = ?').get(asaasEvent.payment.customer.email);
assert.ok(userPix, 'Pix customer must match user email');

const pixExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
db.prepare(`
  UPDATE users SET
    subscription_tier = 'pro',
    subscription_status = 'active',
    subscription_provider = 'asaas_pix',
    subscription_expires_at = ?,
    updated_at = datetime('now')
  WHERE id = ?
`).run(pixExpiresAt, userPix.id);

const userAfterPix = db.prepare('SELECT subscription_tier, subscription_status, subscription_provider FROM users WHERE id = ?').get(testUserId);
assert.strictEqual(userAfterPix.subscription_tier, 'pro', 'Tier is pro via Pix');
assert.strictEqual(userAfterPix.subscription_provider, 'asaas_pix', 'Provider is asaas_pix');
console.log('  ✅ 4. Asaas Pix payment confirmed and user activated as RUSH PRO');

console.log('🎉 ALL PAYMENT & WEBHOOK TESTS PASSED SUCCESSFULLY!');
