// ============================================================
// RUSH PERFORMANCE — Database Schema (SQLite)
// ============================================================

module.exports = function initializeDatabase(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ============================================================
  // USUÁRIOS E AUTENTICAÇÃO
  // ============================================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'athlete' CHECK (role IN ('athlete', 'coach', 'owner', 'admin')),
      academy_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT DEFAULT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_academy ON users(academy_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      avatar_url TEXT DEFAULT NULL,
      bio TEXT DEFAULT NULL,
      location TEXT DEFAULT NULL,
      date_of_birth TEXT DEFAULT NULL,
      gender TEXT DEFAULT NULL CHECK (gender IN ('male', 'female', 'other', NULL)),
      weight_kg REAL DEFAULT NULL,
      height_cm REAL DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_profiles_username ON user_profiles(username);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      language TEXT DEFAULT 'pt-BR',
      timezone TEXT DEFAULT 'America/Sao_Paulo',
      notifications_enabled INTEGER DEFAULT 1,
      email_notifications INTEGER DEFAULT 1,
      push_notifications INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_objectives (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      distance_km INTEGER NOT NULL CHECK (distance_km IN (5, 10, 21, 42)),
      target_race_date TEXT DEFAULT NULL,
      level TEXT NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ============================================================
  // ASSESSORIAS (SLC)
  // ============================================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS academies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cnpj TEXT DEFAULT NULL,
      description TEXT DEFAULT NULL,
      location TEXT DEFAULT NULL,
      logo_url TEXT DEFAULT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_type TEXT NOT NULL DEFAULT 'basic' CHECK (plan_type IN ('basic', 'pro', 'elite')),
      max_athletes INTEGER NOT NULL DEFAULT 50,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_academies_owner ON academies(owner_id);
  `);

  // ============================================================
  // DISPOSITIVOS WEARABLE
  // ============================================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS wearable_devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      brand TEXT NOT NULL,
      device_id TEXT NOT NULL,
      device_type TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      access_token TEXT DEFAULT NULL,
      refresh_token TEXT DEFAULT NULL,
      token_expires_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, device_id)
    );

    CREATE INDEX IF NOT EXISTS idx_wearable_user ON wearable_devices(user_id);
  `);

  // ============================================================
  // MONITORAMENTO VFC
  // ============================================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS hrv_measurements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      timestamp TEXT NOT NULL,
      rmssd_ms REAL NOT NULL CHECK (rmssd_ms BETWEEN 10 AND 200),
      lnrmssd REAL NOT NULL,
      hr_rest_bpm INTEGER NOT NULL CHECK (hr_rest_bpm BETWEEN 30 AND 120),
      device_id TEXT REFERENCES wearable_devices(id) ON DELETE SET NULL,
      duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 60),
      quality_score REAL DEFAULT NULL CHECK (quality_score BETWEEN 0 AND 1),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_hrv_user_ts ON hrv_measurements(user_id, timestamp);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS wellness_scores (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      sleep INTEGER NOT NULL CHECK (sleep BETWEEN 1 AND 5),
      fatigue INTEGER NOT NULL CHECK (fatigue BETWEEN 1 AND 5),
      soreness INTEGER NOT NULL CHECK (soreness BETWEEN 1 AND 5),
      stress INTEGER NOT NULL CHECK (stress BETWEEN 1 AND 5),
      readiness INTEGER NOT NULL CHECK (readiness BETWEEN 1 AND 5),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_wellness_user_date ON wellness_scores(user_id, date);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_status (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('favorable', 'attention', 'recovery')),
      lnrmssd REAL NOT NULL,
      lnrmssd_7d_mean REAL NOT NULL,
      lnrmssd_7d_sd REAL NOT NULL,
      wellness_summary TEXT DEFAULT NULL,
      reason_code TEXT DEFAULT NULL,
      suggested_action TEXT DEFAULT NULL,
      explanation_text TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_status_user_date ON daily_status(user_id, date);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS vo2max_estimates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      vo2max_value REAL NOT NULL CHECK (vo2max_value BETWEEN 20 AND 100),
      method TEXT NOT NULL,
      device_id TEXT REFERENCES wearable_devices(id) ON DELETE SET NULL,
      notes TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_vo2max_user_date ON vo2max_estimates(user_id, date);
  `);

  // ============================================================
  // PLANOS E TREINOS
  // ============================================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS training_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      distance_km INTEGER NOT NULL CHECK (distance_km IN (5, 10, 21, 42)),
      duration_weeks INTEGER NOT NULL CHECK (duration_weeks > 0),
      level TEXT NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced')),
      description TEXT DEFAULT NULL,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      academy_id TEXT REFERENCES academies(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_plans_distance ON training_plans(distance_km);
    CREATE INDEX IF NOT EXISTS idx_plans_level ON training_plans(level);
    CREATE INDEX IF NOT EXISTS idx_plans_creator ON training_plans(created_by);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS training_sessions (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
      week_number INTEGER NOT NULL CHECK (week_number > 0),
      day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
      type TEXT NOT NULL CHECK (type IN ('easy_run', 'interval', 'long_run', 'strength', 'recovery', 'test', 'tempo', 'rest', 'other')),
      distance_km REAL DEFAULT NULL,
      duration_min INTEGER DEFAULT NULL,
      target_pace TEXT DEFAULT NULL,
      target_hr_zone TEXT DEFAULT NULL,
      description TEXT DEFAULT NULL,
      is_fixed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_plan ON training_sessions(plan_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_week ON training_sessions(week_number);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS assigned_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      current_week INTEGER DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_assigned_user ON assigned_plans(user_id);
    CREATE INDEX IF NOT EXISTS idx_assigned_status ON assigned_plans(status);
  `);

  // ============================================================
  // ATIVIDADES
  // ============================================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('run', 'bike', 'strength', 'swim', 'walk', 'other')),
      title TEXT DEFAULT NULL,
      date TEXT NOT NULL,
      distance_km REAL NOT NULL CHECK (distance_km > 0),
      duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
      avg_pace TEXT DEFAULT NULL,
      avg_hr INTEGER DEFAULT NULL CHECK (avg_hr BETWEEN 30 AND 220 OR avg_hr IS NULL),
      max_hr INTEGER DEFAULT NULL CHECK (max_hr BETWEEN 30 AND 220 OR max_hr IS NULL),
      calories INTEGER DEFAULT NULL,
      elevation_gain REAL DEFAULT NULL,
      rpe INTEGER DEFAULT NULL CHECK (rpe BETWEEN 1 AND 10 OR rpe IS NULL),
      hrv_status_display TEXT DEFAULT NULL,
      description TEXT DEFAULT NULL,
      privacy TEXT NOT NULL DEFAULT 'public' CHECK (privacy IN ('public', 'followers', 'private')),
      session_id TEXT REFERENCES training_sessions(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_activities_user_date ON activities(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_activities_privacy ON activities(privacy, date);
    CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_splits (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      split_number INTEGER NOT NULL CHECK (split_number > 0),
      distance_km REAL NOT NULL,
      duration_seconds INTEGER NOT NULL,
      avg_pace TEXT DEFAULT NULL,
      avg_hr INTEGER DEFAULT NULL,
      elevation_gain REAL DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_splits_activity ON activity_splits(activity_id);
  `);

  // ============================================================
  // SOCIAL
  // ============================================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS follows (
      follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      followed_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (follower_id, followed_id),
      CHECK (follower_id != followed_id)
    );

    CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
    CREATE INDEX IF NOT EXISTS idx_follows_followed ON follows(followed_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS likes (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(activity_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_likes_activity ON likes(activity_id);
    CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_comments_activity ON comments(activity_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'achievement', 'challenge', 'status', 'plan_assigned', 'system')),
      source_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      activity_id TEXT REFERENCES activities(id) ON DELETE SET NULL,
      message TEXT DEFAULT NULL,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications(user_id, read);
  `);

  // ============================================================
  // CONQUISTAS E DESAFIOS
  // ============================================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '🏆',
      criteria_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
      earned_at TEXT DEFAULT (datetime('now')),
      is_viewed INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, achievement_id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('distance', 'long_run_count', 'consistency', 'elevation', 'pace')),
      target_value REAL NOT NULL CHECK (target_value > 0),
      target_unit TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      academy_id TEXT REFERENCES academies(id) ON DELETE SET NULL,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS challenge_participants (
      challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      progress_value REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT DEFAULT NULL,
      PRIMARY KEY (challenge_id, user_id)
    );
  `);

  // ============================================================
  // PRIVACIDADE
  // ============================================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS privacy_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      public_activities INTEGER DEFAULT 1,
      show_hrv_status INTEGER DEFAULT 0,
      show_vo2max INTEGER DEFAULT 0,
      show_achievements INTEGER DEFAULT 1,
      allow_messages INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ============================================================
  // API TOKENS & REFRESH TOKENS
  // ============================================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_refresh_token ON refresh_tokens(token);
  `);

  // ============================================================
  // SEED DATA — Achievements
  // ============================================================

  const achievementCount = db.prepare('SELECT COUNT(*) as count FROM achievements').get();
  if (achievementCount.count === 0) {
    const insertAchievement = db.prepare(`
      INSERT INTO achievements (id, name, description, icon, criteria_json) VALUES (?, ?, ?, ?, ?)
    `);

    const achievements = [
      ['ach-5km', 'Primeiros 5 km', 'Completou a primeira atividade de 5 km!', '🎯', '{"distance_km": 5}'],
      ['ach-10km', 'Primeiros 10 km', 'Completou a primeira atividade de 10 km!', '🔥', '{"distance_km": 10}'],
      ['ach-21km', 'Primeira Meia-Maratona', 'Completou a primeira atividade de 21 km!', '⚡', '{"distance_km": 21}'],
      ['ach-42km', 'Primeira Maratona', 'Completou a primeira atividade de 42 km!', '👑', '{"distance_km": 42}'],
      ['ach-100km', '100 km Acumulados', 'Correu 100 km em 30 dias!', '💯', '{"distance_km_30d": 100}'],
      ['ach-500km', '500 km Acumulados', 'Correu 500 km em 90 dias!', '🚀', '{"distance_km_90d": 500}'],
      ['ach-hrv7d', 'VFC Consistente 7d', 'Manteve status Favorável por 7 dias seguidos!', '💚', '{"hrv_favorable_days": 7}'],
      ['ach-hrv30d', 'VFC Consistente 30d', 'Manteve status Favorável por 30 dias seguidos!', '🏅', '{"hrv_favorable_days": 30}'],
      ['ach-vo2-5', 'VO₂máx +5%', 'Evoluiu 5% no VO₂máx!', '📈', '{"vo2max_improvement_pct": 5}'],
      ['ach-interval', 'Primeiro Intervalado', 'Completou o primeiro treino intervalado!', '⏱️', '{"activity_type": "interval"}'],
      ['ach-10wk', '10 Treinos Completos', 'Completou 10 treinos planejados!', '✅', '{"completed_workouts": 10}'],
      ['ach-50wk', '50 Treinos Completos', 'Completou 50 treinos planejados!', '🏆', '{"completed_workouts": 50}'],
    ];

    const insertMany = db.transaction((items) => {
      for (const item of items) {
        insertAchievement.run(...item);
      }
    });

    insertMany(achievements);
  }

  if (process.env.NODE_ENV !== 'test' && !process.env.QUIET) {
    console.log('✅ Database initialized successfully');
  }
};
