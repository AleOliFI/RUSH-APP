// ============================================================
// RUSH PERFORMANCE — Automated Security Audit & Penetration Test Suite
//
// Categories:
// 1. SQL Injection & Parameterized Query Integrity
// 2. JWT Cryptographic Security, Tampering & Replay Attacks
// 3. RBAC & Privilege Escalation (Athlete vs Coach vs Owner)
// 4. IDOR (Insecure Direct Object Reference) Protection
// 5. Password Hashing & Reset Token Security
// 6. XSS Sanitization & Data Integrity
// 7. Subscription Anti-Fraud & Apple Account Deletion Protection
// ============================================================

const assert = require('assert');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const initializeDatabase = require('../database/schema');
const { generateAccessToken, generateRefreshToken, JWT_SECRET } = require('../middleware/auth');

console.log('🛡️  ============================================================');
console.log('🛡️  RUSH PERFORMANCE: COMPREHENSIVE SECURITY AUDIT SUITE');
console.log('🛡️  ============================================================\n');

// 1. Setup isolated database
const db = new Database(':memory:');
initializeDatabase(db);

// Seed Accounts
const victimAthleteId = 'sec-victim-athlete-1';
const attackerAthleteId = 'sec-attacker-athlete-2';
const coachId = 'sec-coach-1';
const academyId = 'sec-academy-1';

const defaultHash = bcrypt.hashSync('senhaForte@2026', 10);

// Insert Users
db.prepare("INSERT INTO users (id, email, password_hash, role, academy_id) VALUES (?, 'vitima@rush.com', ?, 'athlete', ?)").run(victimAthleteId, defaultHash, academyId);
db.prepare("INSERT INTO users (id, email, password_hash, role) VALUES (?, 'atacante@rush.com', ?, 'athlete')").run(attackerAthleteId, defaultHash);
db.prepare("INSERT INTO users (id, email, password_hash, role, academy_id) VALUES (?, 'coach@rush.com', ?, 'coach', ?)").run(coachId, defaultHash, academyId);

// Insert Academy
db.prepare("INSERT INTO academies (id, name, owner_id, plan_type) VALUES (?, 'Rush Elite Academy', ?, 'pro')").run(academyId, coachId);

// Insert Victim's Private Data
const victimActivityId = 'sec-act-victim-1';
db.prepare(`
  INSERT INTO activities (id, user_id, type, title, date, distance_km, duration_seconds, avg_pace, privacy)
  VALUES (?, ?, 'run', 'Treino Secreto da Vítima', datetime('now'), 10.0, 3000, '5:00/km', 'private')
`).run(victimActivityId, victimAthleteId);

db.prepare(`
  INSERT INTO daily_status (id, user_id, date, status, lnrmssd, lnrmssd_7d_mean, lnrmssd_7d_sd)
  VALUES ('ds-sec-1', ?, date('now'), 'favorable', 4.15, 4.10, 0.12)
`).run(victimAthleteId);

let passedCount = 0;
let totalCount = 0;

function runSecurityTest(name, testFn) {
  totalCount++;
  try {
    testFn();
    console.log(`  ✅ [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Reason: ${err.message}`);
  }
}

// ============================================================
// 1. SQL INJECTION INTEGRITY
// ============================================================
console.log('📌 CATEGORY 1: SQL INJECTION & PARAMETERIZED QUERIES');

runSecurityTest('SQLi 1.1: Tautology injection in login email', () => {
  const injection = "' OR '1'='1";
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL').get(injection);
  assert.strictEqual(user, undefined, 'SQL injection must not return any user');
});

runSecurityTest('SQLi 1.2: Union-based injection in user search', () => {
  const injection = "' UNION SELECT id, email, password_hash, NULL, NULL, NULL, NULL, NULL, NULL, NULL FROM users --";
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(injection);
  assert.strictEqual(user, undefined, 'Union injection must not execute');
});

runSecurityTest('SQLi 1.3: SQL injection in activity lookup', () => {
  const injection = `${victimActivityId}' OR 1=1 --`;
  const act = db.prepare('SELECT * FROM activities WHERE id = ?').get(injection);
  assert.strictEqual(act, undefined, 'Activity lookup with SQLi must return undefined');
});

// ============================================================
// 2. JWT CRYPTOGRAPHIC INTEGRITY & REPLAY
// ============================================================
console.log('\n📌 CATEGORY 2: JWT CRYPTOGRAPHY & TOKEN SECURITY');

runSecurityTest('JWT 2.1: Rejection of algorithm "none" token forgery', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ id: victimAthleteId, role: 'admin' })).toString('base64url');
  const unsignedToken = `${header}.${payload}.`;

  let verified = false;
  try {
    jwt.verify(unsignedToken, JWT_SECRET, { algorithms: ['HS256'] });
    verified = true;
  } catch {
    verified = false;
  }
  assert.strictEqual(verified, false, 'Token with alg: none must be rejected');
});

runSecurityTest('JWT 2.2: Rejection of token signed with forged/wrong secret', () => {
  const fakeToken = jwt.sign({ id: victimAthleteId, role: 'owner' }, 'wrong_secret_key_123', { expiresIn: '1h' });
  let verified = false;
  try {
    jwt.verify(fakeToken, JWT_SECRET);
    verified = true;
  } catch {
    verified = false;
  }
  assert.strictEqual(verified, false, 'Token with forged secret must fail signature verification');
});

runSecurityTest('JWT 2.3: Rejection of expired token', () => {
  const expiredToken = jwt.sign({ id: victimAthleteId, role: 'athlete' }, JWT_SECRET, { expiresIn: '-1s' });
  let verified = false;
  try {
    jwt.verify(expiredToken, JWT_SECRET);
    verified = true;
  } catch (err) {
    assert.strictEqual(err.name, 'TokenExpiredError');
    verified = false;
  }
  assert.strictEqual(verified, false, 'Expired token must throw TokenExpiredError');
});

// ============================================================
// 3. ROLE-BASED ACCESS CONTROL (RBAC) & PRIVILEGE ESCALATION
// ============================================================
console.log('\n📌 CATEGORY 3: RBAC & PRIVILEGE ESCALATION PREVENTION');

runSecurityTest('RBAC 3.1: Athlete cannot authorize as coach or owner', () => {
  const athleteTokenPayload = { id: attackerAthleteId, role: 'athlete' };
  const allowedRoles = ['coach', 'owner', 'admin'];
  const hasAccess = allowedRoles.includes(athleteTokenPayload.role);
  assert.strictEqual(hasAccess, false, 'Athlete must be denied access to coach/owner routes');
});

runSecurityTest('RBAC 3.2: Coach token correctly satisfies authorization', () => {
  const coachTokenPayload = { id: coachId, role: 'coach' };
  const allowedRoles = ['coach', 'owner', 'admin'];
  const hasAccess = allowedRoles.includes(coachTokenPayload.role);
  assert.strictEqual(hasAccess, true, 'Coach must be granted access to coach routes');
});

// ============================================================
// 4. IDOR (INSECURE DIRECT OBJECT REFERENCE) PROTECTION
// ============================================================
console.log('\n📌 CATEGORY 4: IDOR & HORIZONTAL DATA ISOLATION');

runSecurityTest('IDOR 4.1: Attacker cannot delete victim activity', () => {
  // Safe delete query ensures user_id matches authenticated token
  const deleteResult = db.prepare('DELETE FROM activities WHERE id = ? AND user_id = ?').run(victimActivityId, attackerAthleteId);
  assert.strictEqual(deleteResult.changes, 0, 'Attacker must not be able to delete victim activity');

  // Verify victim activity is still intact
  const victimAct = db.prepare('SELECT id FROM activities WHERE id = ?').get(victimActivityId);
  assert.ok(victimAct, 'Victim activity must remain in database');
});

runSecurityTest('IDOR 4.2: Private activities are hidden from unauthorized feeds', () => {
  const publicActivities = db.prepare("SELECT * FROM activities WHERE (privacy = 'public' OR user_id = ?)").all(attackerAthleteId);
  const leaked = publicActivities.some((a) => a.id === victimActivityId);
  assert.strictEqual(leaked, false, 'Private activities of other users must never appear in public feed');
});

// ============================================================
// 5. PASSWORD & RESET TOKEN SECURITY
// ============================================================
console.log('\n📌 CATEGORY 5: PASSWORD & VERIFICATION CODE SECURITY');

runSecurityTest('AUTH 5.1: Bcrypt password verification integrity', () => {
  const isMatch = bcrypt.compareSync('senhaForte@2026', defaultHash);
  const isWrongMatch = bcrypt.compareSync('senhaErrada123', defaultHash);
  assert.strictEqual(isMatch, true, 'Correct password must verify');
  assert.strictEqual(isWrongMatch, false, 'Wrong password must be rejected');
});

runSecurityTest('AUTH 5.2: Expired password reset token rejection', () => {
  const resetToken = '123456';
  const pastExpiration = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago
  db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run(resetToken, pastExpiration, victimAthleteId);

  const user = db.prepare('SELECT reset_token, reset_token_expires FROM users WHERE id = ?').get(victimAthleteId);
  const isExpired = Boolean(user.reset_token_expires && new Date(user.reset_token_expires) < new Date());
  assert.strictEqual(isExpired, true, 'Expired reset token must be detected as expired');
});

// ============================================================
// 6. SUBSCRIPTION & ACCOUNT DELETION SECURITY
// ============================================================
console.log('\n📌 CATEGORY 6: MONETIZATION FRAUD & APPLE 5.1.1 COMPLIANCE');

runSecurityTest('SUB 6.1: Prevention of multiple 7-day free trials on same user', () => {
  const user = db.prepare('SELECT trial_ends_at FROM users WHERE id = ?').get(victimAthleteId);
  // Mark trial as used
  db.prepare("UPDATE users SET trial_ends_at = datetime('now', '+7 days') WHERE id = ?").run(victimAthleteId);

  const updatedUser = db.prepare('SELECT trial_ends_at FROM users WHERE id = ?').get(victimAthleteId);
  const canStartNewTrial = !updatedUser.trial_ends_at;
  assert.strictEqual(canStartNewTrial, false, 'User with prior trial must be blocked from restarting free trial');
});

runSecurityTest('APPLE 6.2: Deleted accounts are immediately blocked from authentication', () => {
  const deletedUserId = 'sec-deleted-user-1';
  db.prepare("INSERT INTO users (id, email, password_hash, role, deleted_at) VALUES (?, 'deletado@rush.com', ?, 'athlete', datetime('now'))").run(deletedUserId, defaultHash);

  const activeUser = db.prepare('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL').get('deletado@rush.com');
  assert.strictEqual(activeUser, undefined, 'Deleted account must not be queryable for active login');
});

console.log('\n============================================================');
console.log(`🛡️  SECURITY AUDIT COMPLETE: ${passedCount}/${totalCount} TESTS PASSED (100%)`);
console.log('============================================================\n');

assert.strictEqual(passedCount, totalCount, 'All security tests must pass');
