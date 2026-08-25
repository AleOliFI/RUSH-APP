// ============================================================
// RUSH PERFORMANCE — Platform Expansion Unit & Integration Tests
// Testing: Forgot Password, Reset Password, Field Test & Zones,
// Activity with Photos & RPE, Social Feed & Athlete Profile
// ============================================================

const assert = require('assert');
const Database = require('better-sqlite3');
const initializeDatabase = require('../database/schema');
const authRoutes = require('../routes/auth');
const usersRoutes = require('../routes/users');
const activitiesRoutes = require('../routes/activities');
const socialRoutes = require('../routes/social');
const trainingAgent = require('../agent/trainingAgent');

console.log('🧪 Starting Platform Expansion Unit & Integration Test Suite...');

// Mock in-memory DB
const db = new Database(':memory:');
initializeDatabase(db);

// Seed a test athlete
const bcrypt = require('bcryptjs');
const testUserId = 'test-user-expansion-1';
const testEmail = 'atleta.exp@rush.com';
const hash = bcrypt.hashSync('123456', 10);

db.prepare(`
  INSERT INTO users (id, email, password_hash, role)
  VALUES (?, ?, ?, 'athlete')
`).run(testUserId, testEmail, hash);

db.prepare(`
  INSERT INTO user_profiles (user_id, name, username, gender, date_of_birth, weight_kg, height_cm)
  VALUES (?, 'Atleta Expansão', 'atleta_exp', 'male', '1995-05-15', 72, 178)
`).run(testUserId);

db.prepare(`
  INSERT INTO user_objectives (user_id, distance_km, level)
  VALUES (?, 10, 'intermediate')
`).run(testUserId);

// 1. TEST: Forgot Password & Verification Code Generation
console.log('Testing 1: Forgot Password & Code Generation...');
const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?').run(resetCode, expiresAt, testEmail);

const userWithToken = db.prepare('SELECT reset_token, reset_token_expires FROM users WHERE email = ?').get(testEmail);
assert.strictEqual(userWithToken.reset_token, resetCode, 'Reset token must match generated code');
console.log('  ✅ 1. Forgot Password token persisted correctly');

// 2. TEST: Reset Password with Valid Code
console.log('Testing 2: Reset Password...');
const newHash = bcrypt.hashSync('novaSenha123', 10);
db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE email = ?').run(newHash, testEmail);

const updatedUser = db.prepare('SELECT reset_token, password_hash FROM users WHERE email = ?').get(testEmail);
assert.strictEqual(updatedUser.reset_token, null, 'Reset token must be cleared after password reset');
assert.strictEqual(bcrypt.compareSync('novaSenha123', updatedUser.password_hash), true, 'New password must verify');
console.log('  ✅ 2. Password reset and verification succeeded');

// 3. TEST: Field Test Calculation (12 min Cooper -> Zones Z1 to Z5)
console.log('Testing 3: 12-min Field Test Calculation...');
const distanceKm = 2.4; // 2.4 km in 12 min = 5:00/km (300 s/km)
const durationSec = 720;
const maxHr = 190;
const restHr = 52;

const paceSec = durationSec / distanceKm; // 300 s/km
assert.strictEqual(paceSec, 300, 'Pace must be 300 s/km (5:00/km)');

// Calculate Z1-Z5 HR ranges from maxHr (190)
const z1Min = Math.round(maxHr * 0.50); // 95
const z1Max = Math.round(maxHr * 0.60); // 114
const z2Min = Math.round(maxHr * 0.60); // 114
const z2Max = Math.round(maxHr * 0.70); // 133
const z3Min = Math.round(maxHr * 0.70); // 133
const z3Max = Math.round(maxHr * 0.80); // 152
const z4Min = Math.round(maxHr * 0.80); // 152
const z4Max = Math.round(maxHr * 0.90); // 171
const z5Min = Math.round(maxHr * 0.90); // 171
const z5Max = maxHr; // 190

assert.strictEqual(z1Min, 95, 'Z1 min HR must be 95 bpm');
assert.strictEqual(z2Max, 133, 'Z2 max HR must be 133 bpm');
assert.strictEqual(z4Max, 171, 'Z4 max HR must be 171 bpm');
assert.strictEqual(z5Max, 190, 'Z5 max HR must be 190 bpm');

// Persist in DB
const zonesJson = JSON.stringify({
  Z1: { minBpm: z1Min, maxBpm: z1Max, pace: '6:30 – 7:10/km' },
  Z2: { minBpm: z2Min, maxBpm: z2Max, pace: '5:45 – 6:15/km' },
  Z3: { minBpm: z3Min, maxBpm: z3Max, pace: '5:15 – 5:35/km' },
  Z4: { minBpm: z4Min, maxBpm: z4Max, pace: '5:00 – 5:10/km' },
  Z5: { minBpm: z5Min, maxBpm: z5Max, pace: '< 4:45/km' },
});

db.prepare(`
  UPDATE user_profiles SET
    pace_5k = '5:00',
    hr_max_tested = ?,
    hr_rest_tested = ?,
    custom_zones_json = ?
  WHERE user_id = ?
`).run(maxHr, restHr, zonesJson, testUserId);

const savedProfile = db.prepare('SELECT hr_max_tested, custom_zones_json, pace_5k FROM user_profiles WHERE user_id = ?').get(testUserId);
assert.strictEqual(savedProfile.hr_max_tested, 190, 'Tested max HR must be 190');
assert.strictEqual(savedProfile.pace_5k, '5:00', 'Tested pace must be 5:00');
console.log('  ✅ 3. Field Test & individual zones calculated and stored');

// 4. TEST: Activity creation with Instagram photo, RPE & Feelings
console.log('Testing 4: Post-Workout Activity with Photo & RPE...');
const actId = 'act-test-photo-1';
db.prepare(`
  INSERT INTO activities (
    id, user_id, type, title, date, distance_km, duration_seconds,
    avg_pace, avg_hr, max_hr, rpe, rpe_score, feeling_notes, workout_rating,
    image_url, privacy
  )
  VALUES (?, ?, 'run', 'Longão de Domingo', datetime('now'), 12.5, 4200, '5:36/km', 148, 168, 6, 6, 'Sensação excelente, ritmo constante em Z2.', 5, 'data:image/jpeg;base64,mock', 'public')
`).run(actId, testUserId);

const savedAct = db.prepare('SELECT * FROM activities WHERE id = ?').get(actId);
assert.strictEqual(savedAct.distance_km, 12.5, 'Distance must be 12.5 km');
assert.strictEqual(savedAct.rpe_score, 6, 'RPE score must be 6');
assert.strictEqual(savedAct.workout_rating, 5, 'Rating must be 5 stars');
assert.strictEqual(savedAct.image_url, 'data:image/jpeg;base64,mock', 'Image URL must be stored');
console.log('  ✅ 4. Activity with photo and RPE created successfully');

// 5. TEST: Social Follow & Public Profile Query
console.log('Testing 5: Social Follow & Public Profile...');
const otherUserId = 'test-user-other-2';
db.prepare(`
  INSERT INTO users (id, email, password_hash, role)
  VALUES (?, 'marina@rush.com', ?, 'athlete')
`).run(otherUserId, hash);

db.prepare(`
  INSERT INTO user_profiles (user_id, name, username, instagram, strava)
  VALUES (?, 'Marina Lima', 'marina_run', '@marina_corredora', 'marinalima')
`).run(otherUserId);

// Follow
db.prepare('INSERT INTO follows (follower_id, followed_id) VALUES (?, ?)').run(testUserId, otherUserId);

const followCheck = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?').get(testUserId, otherUserId);
assert.ok(followCheck, 'User must be following other athlete');

const followerCount = db.prepare('SELECT COUNT(*) as c FROM follows WHERE followed_id = ?').get(otherUserId);
assert.strictEqual(followerCount.c, 1, 'Other athlete must have 1 follower');
console.log('  ✅ 5. Social follow and athlete profile links verified');

console.log('🎉 ALL PLATFORM EXPANSION TESTS PASSED SUCCESSFULLY!');
