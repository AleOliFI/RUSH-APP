// ============================================================
// RUSH PERFORMANCE — Seed Data Script
// Popula o banco com dados realistas para demonstração (Idempotente)
// ============================================================

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { calculateLnRmssd } = require('./server/agent/trainingAgent');

const DB_PATH = path.join(__dirname, 'data', 'rush_performance.db');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
const initializeDatabase = require('./server/database/schema');
initializeDatabase(db);

console.log('🌱 Seeding database...\n');

// ============================================================
// Idempotency: Clean tables in proper FK order
// ============================================================

const cleanDatabase = db.transaction(() => {
  db.pragma('foreign_keys = OFF');
  db.prepare('DELETE FROM refresh_tokens').run();
  db.prepare('DELETE FROM privacy_settings').run();
  db.prepare('DELETE FROM challenge_participants').run();
  db.prepare('DELETE FROM challenges').run();
  db.prepare('DELETE FROM user_achievements').run();
  db.prepare('DELETE FROM notifications').run();
  db.prepare('DELETE FROM comments').run();
  db.prepare('DELETE FROM likes').run();
  db.prepare('DELETE FROM follows').run();
  db.prepare('DELETE FROM activity_splits').run();
  db.prepare('DELETE FROM activities').run();
  db.prepare('DELETE FROM assigned_plans').run();
  db.prepare('DELETE FROM training_sessions').run();
  db.prepare('DELETE FROM training_plans').run();
  db.prepare('DELETE FROM vo2max_estimates').run();
  db.prepare('DELETE FROM daily_status').run();
  db.prepare('DELETE FROM wellness_scores').run();
  db.prepare('DELETE FROM hrv_measurements').run();
  db.prepare('DELETE FROM wearable_devices').run();
  db.prepare('DELETE FROM academies').run();
  db.prepare('DELETE FROM user_objectives').run();
  db.prepare('DELETE FROM user_settings').run();
  db.prepare('DELETE FROM user_profiles').run();
  db.prepare('DELETE FROM users').run();
  db.pragma('foreign_keys = ON');
});

cleanDatabase();
console.log('🧹 Cleaned existing database tables');

// ============================================================
// Users & Academies (Deterministic IDs)
// ============================================================

const passwordHash = bcrypt.hashSync('123456', 10);

const ACADEMY_ID = '00000000-0000-4000-8000-000000000010';

const users = [
  { id: '00000000-0000-4000-8000-000000000001', email: 'alessandro@rush.com', name: 'Alessandro', username: 'alessandro_rush', role: 'owner' },
  { id: '00000000-0000-4000-8000-000000000002', email: 'coach@rush.com', name: 'Carlos Silva', username: 'coach_carlos', role: 'coach' },
  { id: '00000000-0000-4000-8000-000000000003', email: 'maria@email.com', name: 'Maria Fernandes', username: 'maria_runs', role: 'athlete' },
  { id: '00000000-0000-4000-8000-000000000004', email: 'pedro@email.com', name: 'Pedro Santos', username: 'pedro_runner', role: 'athlete' },
  { id: '00000000-0000-4000-8000-000000000005', email: 'ana@email.com', name: 'Ana Costa', username: 'ana_pace', role: 'athlete' },
  { id: '00000000-0000-4000-8000-000000000006', email: 'joao@email.com', name: 'João Lima', username: 'joao_km', role: 'athlete' },
  { id: '00000000-0000-4000-8000-000000000007', email: 'lucia@email.com', name: 'Lúcia Oliveira', username: 'lucia_fit', role: 'athlete' },
];

const insertUser = db.prepare('INSERT INTO users (id, email, password_hash, role, academy_id) VALUES (?, ?, ?, ?, ?)');
const insertProfile = db.prepare('INSERT INTO user_profiles (user_id, name, username, bio, location) VALUES (?, ?, ?, ?, ?)');
const insertSettings = db.prepare('INSERT INTO user_settings (user_id) VALUES (?)');
const insertPrivacy = db.prepare('INSERT INTO privacy_settings (user_id, public_activities, show_hrv_status, show_vo2max, show_achievements) VALUES (?, 1, 1, 1, 1)');

const seedUsers = db.transaction(() => {
  // Create users first
  for (const user of users) {
    insertUser.run(user.id, user.email, passwordHash, user.role, null);
    insertProfile.run(user.id, user.name, user.username, `Corredor focado em alta performance.`, 'São Paulo, SP');
    insertSettings.run(user.id);
    insertPrivacy.run(user.id);
  }

  // Create academy
  db.prepare(`INSERT INTO academies (id, name, description, location, owner_id, plan_type, max_athletes) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    ACADEMY_ID, 'Rush Performance', 'Assessoria de corrida com base científica em VFC', 'São Paulo - SP', users[0].id, 'pro', 150
  );

  // Link users to academy
  for (const user of users) {
    db.prepare('UPDATE users SET academy_id = ? WHERE id = ?').run(ACADEMY_ID, user.id);
  }
});

seedUsers();
console.log(`✅ ${users.length} users created`);

// ============================================================
// Objectives
// ============================================================

const objectives = [
  { userId: users[0].id, distance: 42, level: 'advanced' },
  { userId: users[2].id, distance: 10, level: 'beginner' },
  { userId: users[3].id, distance: 21, level: 'intermediate' },
  { userId: users[4].id, distance: 5, level: 'beginner' },
  { userId: users[5].id, distance: 42, level: 'advanced' },
  { userId: users[6].id, distance: 10, level: 'intermediate' },
];

const insertObjective = db.prepare('INSERT INTO user_objectives (user_id, distance_km, level) VALUES (?, ?, ?)');
objectives.forEach(o => insertObjective.run(o.userId, o.distance, o.level));
console.log(`✅ ${objectives.length} objectives set`);

// ============================================================
// Follows (social connections)
// ============================================================

const insertFollow = db.prepare('INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES (?, ?)');
const seedFollows = db.transaction(() => {
  for (let i = 0; i < users.length; i++) {
    for (let j = 0; j < users.length; j++) {
      if (i !== j && (i === 0 || j === 0 || Math.random() > 0.3)) {
        insertFollow.run(users[i].id, users[j].id);
      }
    }
  }
});
seedFollows();
console.log('✅ Social follows created');

// ============================================================
// HRV Measurements (last 14 days)
// ============================================================

const insertHrv = db.prepare(`INSERT INTO hrv_measurements (id, user_id, timestamp, rmssd_ms, lnrmssd, hr_rest_bpm, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)`);
const insertDailyStatus = db.prepare(`INSERT INTO daily_status (id, user_id, date, status, lnrmssd, lnrmssd_7d_mean, lnrmssd_7d_sd, reason_code, suggested_action, explanation_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const seedHrv = db.transaction(() => {
  const athletes = users.filter(u => u.role === 'athlete' || u.role === 'owner');
  for (const user of athletes) {
    const baseRmssd = 45 + Math.random() * 25; // 45-70 ms
    for (let d = 14; d >= 0; d--) {
      const date = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const variation = (Math.random() - 0.45) * 12;
      const rmssd = Math.max(20, Math.min(160, baseRmssd + variation));
      const lnrmssd = calculateLnRmssd ? calculateLnRmssd(rmssd) : Math.log(rmssd);
      const hrRest = Math.round(52 + Math.random() * 12);

      insertHrv.run(uuidv4(), user.id, `${dateStr}T07:00:00Z`, +rmssd.toFixed(1), +lnrmssd.toFixed(4), hrRest, 300);

      // Status
      let status = 'favorable';
      if (rmssd < baseRmssd * 0.75) {
        status = 'recovery';
      } else if (rmssd < baseRmssd * 0.88) {
        status = 'attention';
      }

      insertDailyStatus.run(
        uuidv4(), user.id, dateStr, status, +lnrmssd.toFixed(4),
        +(calculateLnRmssd ? calculateLnRmssd(baseRmssd) : Math.log(baseRmssd)).toFixed(4), 0.08, 'SEED_DATA',
        status === 'favorable' ? 'maintain' : status === 'attention' ? 'reduce' : 'rest',
        status === 'favorable' ? '✅ VFC estável dentro do SWC. Treino principal liberado.' : status === 'attention' ? '⚠️ VFC moderadamente suprimida. Volume reduzido em 25%.' : '🔴 Recuperação necessária. Descanso ativo ou repouso total.'
      );
    }
  }
});
seedHrv();
console.log('✅ HRV measurements created (14 days)');

// ============================================================
// Wellness Scores (last 7 days)
// ============================================================

const insertWellness = db.prepare(`INSERT INTO wellness_scores (id, user_id, date, sleep, fatigue, soreness, stress, readiness) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

const seedWellness = db.transaction(() => {
  const athletes = users.filter(u => u.role === 'athlete' || u.role === 'owner');
  for (const user of athletes) {
    for (let d = 7; d >= 0; d--) {
      const dateStr = new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      insertWellness.run(
        uuidv4(), user.id, dateStr,
        Math.min(5, Math.max(2, Math.ceil(Math.random() * 5))),
        Math.min(5, Math.max(1, Math.ceil(Math.random() * 4))),
        Math.min(5, Math.max(1, Math.ceil(Math.random() * 4))),
        Math.min(5, Math.max(1, Math.ceil(Math.random() * 3))),
        Math.min(5, Math.max(2, Math.ceil(Math.random() * 5))),
      );
    }
  }
});
seedWellness();
console.log('✅ Wellness scores created');

// ============================================================
// Activities (last 30 days)
// ============================================================

const insertActivity = db.prepare(`
  INSERT INTO activities (id, user_id, type, title, date, distance_km, duration_seconds, avg_pace, avg_hr, rpe, description, privacy)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'public')
`);

const runTitles = [
  'Rodagem matinal Z2', 'Treino intervalado 6x800m', 'Longão de domingo',
  'Tempo run 5km ritmo prova', 'Corrida regenerativa pós-VFC', 'Treino base aeróbica',
  'Fartlek progressivo', 'Rodagem suave'
];

const seedActivities = db.transaction(() => {
  for (const user of users) {
    const numActivities = 6 + Math.floor(Math.random() * 8);
    for (let i = 0; i < numActivities; i++) {
      const daysAgo = Math.floor(Math.random() * 28);
      const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const distance = +(4 + Math.random() * 16).toFixed(1);
      const paceMin = 4.2 + Math.random() * 1.8;
      const duration = Math.round(distance * paceMin * 60);
      const pace = `${Math.floor(paceMin)}:${String(Math.round((paceMin % 1) * 60)).padStart(2, '0')}`;

      insertActivity.run(
        uuidv4(), user.id, 'run',
        runTitles[Math.floor(Math.random() * runTitles.length)],
        date.toISOString(),
        distance, duration, pace,
        Math.round(135 + Math.random() * 28),
        Math.ceil(Math.random() * 4 + 4),
        `Treino de corrida com ${distance} km em ritmo médio de ${pace}/km.`
      );
    }
  }
});
seedActivities();
console.log('✅ Activities created');

// ============================================================
// Likes & Comments
// ============================================================

const allActivities = db.prepare('SELECT id, user_id FROM activities ORDER BY date DESC LIMIT 40').all();
const insertLike = db.prepare('INSERT OR IGNORE INTO likes (id, activity_id, user_id) VALUES (?, ?, ?)');
const insertComment = db.prepare('INSERT INTO comments (id, activity_id, user_id, content) VALUES (?, ?, ?, ?)');

const comments = [
  'Boa corrida! 💪', 'Pace monstro! 🔥', 'Que treino consistente! 🏃', 'Inspirador demais!',
  'Treino forte! 👏', 'VFC favorável dá nisso! 🚀', 'Cada km conta!', 'Bora pra cima! 🎯',
  'Ótimo ritmo!', 'Constância absurda!', 'Show! 💯', 'Parabéns pela dedicação!'
];

const seedSocial = db.transaction(() => {
  for (const activity of allActivities) {
    for (const user of users) {
      if (user.id !== activity.user_id && Math.random() > 0.4) {
        insertLike.run(uuidv4(), activity.id, user.id);
      }
    }
    if (Math.random() > 0.5) {
      const commenter = users[Math.floor(Math.random() * users.length)];
      if (commenter.id !== activity.user_id) {
        insertComment.run(uuidv4(), activity.id, commenter.id, comments[Math.floor(Math.random() * comments.length)]);
      }
    }
  }
});
seedSocial();
console.log('✅ Likes & comments created');

// ============================================================
// Challenges
// ============================================================

const insertChallenge = db.prepare(`
  INSERT INTO challenges (id, name, description, type, target_value, target_unit, start_date, end_date, academy_id, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertParticipant = db.prepare(`INSERT INTO challenge_participants (challenge_id, user_id, progress_value, status) VALUES (?, ?, ?, ?)`);

const seedChallenges = db.transaction(() => {
  const now = new Date();
  const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const ch1 = '00000000-0000-4000-8000-000000000101';
  insertChallenge.run(ch1, 'Desafio 100 km RUSH', 'Corra 100 km durante o mês de agosto com foco na consistência!', 'distance', 100, 'km', startDate, endDate, ACADEMY_ID, users[0].id);

  const ch2 = '00000000-0000-4000-8000-000000000102';
  insertChallenge.run(ch2, 'Consistência: 20 Treinos', 'Complete 20 sessões de treino guiadas por VFC', 'consistency', 20, 'atividades', startDate, endDate, ACADEMY_ID, users[0].id);

  // Add participants
  for (const user of users.filter(u => u.role === 'athlete' || u.role === 'owner')) {
    const progress1 = +(Math.random() * 85).toFixed(1);
    insertParticipant.run(ch1, user.id, progress1, progress1 >= 100 ? 'completed' : 'active');

    const progress2 = Math.floor(Math.random() * 18);
    insertParticipant.run(ch2, user.id, progress2, progress2 >= 20 ? 'completed' : 'active');
  }
});
seedChallenges();
console.log('✅ Challenges created');

// ============================================================
// Achievements
// ============================================================

const insertUserAchievement = db.prepare('INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)');
const allAchievements = db.prepare('SELECT id FROM achievements').all();

const seedAchievements = db.transaction(() => {
  for (const user of users) {
    const numAch = 3 + Math.floor(Math.random() * 3);
    const shuffled = [...allAchievements].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(numAch, shuffled.length); i++) {
      insertUserAchievement.run(user.id, shuffled[i].id);
    }
  }
});
seedAchievements();
console.log('✅ Achievements awarded');

// ============================================================
// VO2max
// ============================================================

const insertVo2 = db.prepare('INSERT INTO vo2max_estimates (id, user_id, date, vo2max_value, method) VALUES (?, ?, ?, ?, ?)');
const seedVo2 = db.transaction(() => {
  for (const user of users.filter(u => u.role === 'athlete' || u.role === 'owner')) {
    const baseVo2 = 42 + Math.random() * 14;
    for (let m = 3; m >= 0; m--) {
      const dateStr = new Date(Date.now() - m * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      insertVo2.run(uuidv4(), user.id, dateStr, +(baseVo2 + (3 - m) * 0.6 + (Math.random() - 0.5)).toFixed(1), 'wearable');
    }
  }
});
seedVo2();
console.log('✅ VO₂máx estimates created');

// ============================================================
// Training Plans & Assigned Plans for Athletes
// ============================================================

const insertPlan = db.prepare(`
  INSERT INTO training_plans (id, name, distance_km, duration_weeks, level, description, created_by, academy_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertSession = db.prepare(`
  INSERT INTO training_sessions (id, plan_id, week_number, day_of_week, type, distance_km, duration_min, target_pace, target_hr_zone, description)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertAssignedPlan = db.prepare(`
  INSERT INTO assigned_plans (id, user_id, plan_id, start_date, end_date, current_week, status)
  VALUES (?, ?, ?, ?, ?, ?, 'active')
`);

const seedPlans = db.transaction(() => {
  const plan42k = '00000000-0000-4000-8000-000000000201';
  insertPlan.run(plan42k, 'Plano Maratona Performance 42K', 42, 12, 'advanced', 'Periodização 4 fases para Maratona com controle de VFC', users[1].id, ACADEMY_ID);

  const plan21k = '00000000-0000-4000-8000-000000000202';
  insertPlan.run(plan21k, 'Plano Meia-Maratona 21K', 21, 10, 'intermediate', 'Construção de volume e limiar anaeróbio', users[1].id, ACADEMY_ID);

  const plan10k = '00000000-0000-4000-8000-000000000203';
  insertPlan.run(plan10k, 'Plano Evolução 10K', 10, 8, 'beginner', 'Transição para 10K com segurança e adaptação neuromuscular', users[1].id, ACADEMY_ID);

  // Add sample sessions for week 1 of 42k
  const sessionTypes = [
    { day: 1, type: 'easy_run', km: 8, min: 45, pace: '5:35', zone: 'Z2', desc: 'Rodagem leve aeróbica de início de semana' },
    { day: 2, type: 'interval', km: 10, min: 55, pace: '4:20', zone: 'Z4', desc: 'Sessão intervalada 6x800m com 90s trote' },
    { day: 3, type: 'rest', km: 0, min: 0, pace: null, zone: null, desc: 'Descanso e recuperação passiva' },
    { day: 4, type: 'tempo', km: 12, min: 60, pace: '4:50', zone: 'Z3', desc: 'Corrida em ritmo de limiar 8km contínuos' },
    { day: 5, type: 'recovery', km: 6, min: 35, pace: '6:00', zone: 'Z1', desc: 'Trote regenerativo leve' },
    { day: 6, type: 'long_run', km: 24, min: 130, pace: '5:25', zone: 'Z2', desc: 'Longão de resistência progressivo' },
    { day: 7, type: 'rest', km: 0, min: 0, pace: null, zone: null, desc: 'Descanso e avaliação de bem-estar' },
  ];

  for (const s of sessionTypes) {
    insertSession.run(uuidv4(), plan42k, 1, s.day, s.type, s.km, s.min, s.pace, s.zone, s.desc);
    insertSession.run(uuidv4(), plan21k, 1, s.day, s.type, Math.round(s.km * 0.7), Math.round(s.min * 0.75), s.pace, s.zone, s.desc);
  }

  // Assign plans to Alessandro (42k) and Pedro (21k) and Maria (10k)
  const today = new Date();
  const startDate = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = new Date(today.getTime() + 70 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  insertAssignedPlan.run(uuidv4(), users[0].id, plan42k, startDate, endDate, 2);
  insertAssignedPlan.run(uuidv4(), users[3].id, plan21k, startDate, endDate, 2);
  insertAssignedPlan.run(uuidv4(), users[2].id, plan10k, startDate, endDate, 1);
});

seedPlans();
console.log('✅ Training plans & active assignments created');

// ============================================================
// Done
// ============================================================

db.close();

console.log('\n🎉 Seed completed successfully!\n');
console.log('📧 Test accounts (senha: 123456):');
console.log('   Owner:   alessandro@rush.com');
console.log('   Coach:   coach@rush.com');
console.log('   Athlete: maria@email.com');
console.log('   Athlete: pedro@email.com');
console.log('   Athlete: ana@email.com');
console.log('');
console.log('▶️  Run: npm run server');
console.log('');
