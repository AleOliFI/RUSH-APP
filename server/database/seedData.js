// ============================================================
// RUSH PERFORMANCE — Programmatic Database Seeder
// ============================================================

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { calculateLnRmssd } = require('../agent/trainingAgent');

function seedDatabase(db) {
  console.log('🌱 Seeding database programmatically...');

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

  const passwordHash = bcrypt.hashSync('123456', 10);

  const users = [
    { id: 'usr-alessandro-001', email: 'alessandro@rush.com', role: 'owner', name: 'Alessandro Oliveira', username: 'alessandro', bio: 'Fundador da RUSH Performance. Maratonista e entusiasta de VFC.', location: 'São Paulo, SP', weight_kg: 72.5, height_cm: 178, instagram: '@alessandro.run', strava: 'alessandro_rush' },
    { id: 'usr-coach-002', email: 'coach@rush.com', role: 'coach', name: 'Coach Ricardo Silva', username: 'coach_ricardo', bio: 'Treinador de corrida de alta performance. Especialista em periodização por VFC.', location: 'São Paulo, SP', weight_kg: 78.0, height_cm: 182, instagram: '@coach.ricardo', strava: 'ricardosilva_coach' },
    { id: 'usr-maria-003', email: 'maria@email.com', role: 'athlete', name: 'Maria Santos', username: 'maria_run', bio: 'Corredora amadora em busca dos 10km sub-45.', location: 'Curitiba, PR', weight_kg: 58.0, height_cm: 165, instagram: '@maria.running', strava: 'mariasantos_run' },
    { id: 'usr-pedro-004', email: 'pedro@email.com', role: 'athlete', name: 'Pedro Costa', username: 'pedro_costa', bio: 'Treinando para a primeira meia maratona.', location: 'Belo Horizonte, MG', weight_kg: 75.0, height_cm: 176, instagram: '@pedro.costa', strava: 'pedrocosta_run' },
    { id: 'usr-ana-005', email: 'ana@email.com', role: 'athlete', name: 'Ana Paula Lima', username: 'ana_lima', bio: 'Corredora de 5km e apaixonada por treinos intervalados.', location: 'Rio de Janeiro, RJ', weight_kg: 55.0, height_cm: 162, instagram: '@ana.running', strava: 'anapaulalima' },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, role, academy_id, subscription_tier, subscription_status)
    VALUES (?, ?, ?, ?, ?, 'pro', 'active')
  `);

  const insertProfile = db.prepare(`
    INSERT INTO user_profiles (id, user_id, name, username, bio, location, weight_kg, height_cm, instagram, strava)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertObjectives = db.prepare(`
    INSERT INTO user_objectives (id, user_id, distance_km, level, runs_per_week, primary_goal, target_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const academyId = 'aca-rush-elite-001';
  db.prepare(`
    INSERT INTO academies (id, name, code, owner_id, plan_type, max_athletes, is_active)
    VALUES (?, 'RUSH Elite Performance', 'RUSH2026', ?, 'enterprise', 100, 1)
  `).run(academyId, users[0].id);

  for (const u of users) {
    insertUser.run(u.id, u.email, passwordHash, u.role, academyId);
    insertProfile.run(uuidv4(), u.id, u.name, u.username, u.bio, u.location, u.weight_kg, u.height_cm, u.instagram, u.strava);
    insertObjectives.run(uuidv4(), u.id, 42.195, 'intermediate', 4, 'Completar Maratona Sub-3h30', '2026-11-15');
  }

  // Seed HRV Measurements for Alessandro (last 14 days)
  const insertHrv = db.prepare(`
    INSERT INTO hrv_measurements (id, user_id, date, timestamp, rmssd_ms, lnrmssd, hr_rest_bpm, duration_seconds, source, device_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, 60, 'camera', 'Camera PPG')
  `);

  const insertDaily = db.prepare(`
    INSERT INTO daily_status (id, user_id, date, status, lnrmssd, lnrmssd_7d_mean, lnrmssd_7d_sd, suggested_action, explanation_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    const rmssd = 60 + Math.floor(Math.sin(i) * 10) + (i === 0 ? 5 : 0);
    const lnrmssd = calculateLnRmssd(rmssd);
    const hrRest = 50 + Math.floor(Math.cos(i) * 4);

    insertHrv.run(uuidv4(), users[0].id, dateStr, d.toISOString(), rmssd, lnrmssd, hrRest);
    insertDaily.run(
      uuidv4(),
      users[0].id,
      dateStr,
      'favorable',
      lnrmssd,
      4.15,
      0.12,
      'Treino intenso liberado',
      'Sistema parassimpático recuperado. O corpo está pronto para responder bem a cargas elevadas de treino.'
    );
  }

  // Seed Training Plan
  const planId = 'plan-maratona-42k';
  db.prepare(`
    INSERT INTO training_plans (id, academy_id, created_by, name, description, target_distance_km, duration_weeks, level, is_template)
    VALUES (?, ?, ?, 'Plano Maratona Performance 42K', 'Auto-periodização científica por VFC.', 42.195, 12, 'intermediate', 1)
  `).run(planId, academyId, users[1].id);

  const insertSession = db.prepare(`
    INSERT INTO training_sessions (id, plan_id, week_number, day_of_week, session_type, target_distance_km, target_duration_min, target_pace, target_hr_zone, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sessions = [
    { day: 1, type: 'easy_run', km: 8, min: 45, pace: '5:35', zone: 'Z2', desc: 'Rodagem leve aeróbica contínua em Z2' },
    { day: 2, type: 'interval', km: 10, min: 55, pace: '4:15', zone: 'Z4', desc: 'Aquecimento 2km + 6x 800m em Z4 com 90s trote + 2km soltura' },
    { day: 3, type: 'rest', km: 0, min: 0, pace: null, zone: null, desc: 'Descanso programado ou mobilidade ativa' },
    { day: 4, type: 'tempo', km: 12, min: 65, pace: '4:45', zone: 'Z3', desc: '2km leve + 8km em ritmo de limiar de lactato (Z3-Z4) + 2km desaquecimento' },
    { day: 5, type: 'recovery', km: 6, min: 35, pace: '6:00', zone: 'Z1', desc: 'Trote regenerativo leve para oxigenação mitocondrial' },
    { day: 6, type: 'long_run', km: 22, min: 120, pace: '5:30', zone: 'Z2', desc: 'Longão de resistência progressivo em Z2' },
    { day: 7, type: 'rest', km: 0, min: 0, pace: null, zone: null, desc: 'Descanso total e restauração neuromuscular' },
  ];

  for (const s of sessions) {
    insertSession.run(uuidv4(), planId, 1, s.day, s.type, s.km, s.min, s.pace, s.zone, s.desc);
  }

  // Assign Plan to Alessandro
  db.prepare(`
    INSERT INTO assigned_plans (id, user_id, plan_id, start_date, end_date, current_week, is_active)
    VALUES (?, ?, ?, date('now', '-7 days'), date('now', '+77 days'), 1, 1)
  `).run(uuidv4(), users[0].id, planId);

  // Seed Social Feed Activities
  const insertActivity = db.prepare(`
    INSERT INTO activities (id, user_id, type, title, description, date, distance_km, duration_seconds, avg_pace, avg_hr_bpm, max_hr_bpm, calories, privacy)
    VALUES (?, ?, ?, ?, ?, datetime('now', ?), ?, ?, ?, ?, ?, ?, 'public')
  `);

  insertActivity.run(uuidv4(), users[0].id, 'run', 'Longão de Domingo — 22KM', 'Ritmo controlado em Z2 do início ao fim com sensação ótima.', '-1 day', 22.0, 7260, '5:30/km', 148, 168, 1420);
  insertActivity.run(uuidv4(), users[2].id, 'interval', 'Tiros 6x 800m na Pista', 'Superação total! Pace de 4:10/km cravado.', '-2 days', 10.2, 3120, '4:15/km', 165, 185, 780);
  insertActivity.run(uuidv4(), users[3].id, 'run', 'Rodagem Regenerativa Leve', 'Recuperação ativa após o longão de sábado.', '-3 days', 6.5, 2340, '6:00/km', 132, 145, 410);

  console.log('✅ Database seeded successfully with demo athletes, coach, training plans & activities!');
}

module.exports = seedDatabase;
