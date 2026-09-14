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
      reset_token TEXT DEFAULT NULL,
      reset_token_expires TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT DEFAULT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_academy ON users(academy_id);
  `);

  // Subscriptions & Auth Migrations
  try { db.exec(`ALTER TABLE users ADD COLUMN reset_token TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN reset_token_expires TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free'`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'free'`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN subscription_provider TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN subscription_id TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN trial_ends_at TEXT DEFAULT NULL`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN subscription_expires_at TEXT DEFAULT NULL`); } catch (_) {}

  // Subscriptions history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_tier TEXT NOT NULL DEFAULT 'pro',
      status TEXT NOT NULL DEFAULT 'active',
      amount_cents INTEGER DEFAULT 2990,
      currency TEXT DEFAULT 'BRL',
      provider TEXT DEFAULT 'manual',
      provider_subscription_id TEXT DEFAULT NULL,
      started_at TEXT DEFAULT (datetime('now')),
      current_period_end TEXT DEFAULT NULL,
      canceled_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
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
      instagram TEXT DEFAULT NULL,
      strava TEXT DEFAULT NULL,
      pace_5k TEXT DEFAULT NULL,
      hr_max_tested INTEGER DEFAULT NULL,
      hr_rest_tested INTEGER DEFAULT NULL,
      prior_hrv_rmssd REAL DEFAULT NULL,
      custom_zones_json TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_profiles_username ON user_profiles(username);
  `);

  try {
    db.exec(`ALTER TABLE user_profiles ADD COLUMN instagram TEXT DEFAULT NULL`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE user_profiles ADD COLUMN strava TEXT DEFAULT NULL`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE user_profiles ADD COLUMN pace_5k TEXT DEFAULT NULL`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE user_profiles ADD COLUMN hr_max_tested INTEGER DEFAULT NULL`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE user_profiles ADD COLUMN hr_rest_tested INTEGER DEFAULT NULL`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE user_profiles ADD COLUMN prior_hrv_rmssd REAL DEFAULT NULL`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE user_profiles ADD COLUMN custom_zones_json TEXT DEFAULT NULL`);
  } catch (_) {}

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
      -- Calibração declarada pelo atleta na entrada:
      -- focus: o que ele quer do plano (prova, pace, prevenção, volume)
      -- typical_weekly_km: volume que ele já sustenta hoje
      -- active_injuries: lesões em curso, como registro informativo
      focus TEXT DEFAULT NULL CHECK (focus IN ('race', 'pace', 'injury_prevention', 'volume') OR focus IS NULL),
      typical_weekly_km REAL DEFAULT NULL CHECK (typical_weekly_km IS NULL OR (typical_weekly_km >= 0 AND typical_weekly_km <= 300)),
      active_injuries TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrações para bancos que já existem: colunas novas da calibração.
  // Sem CHECK aqui — o ALTER TABLE do SQLite não aceita — então a rota
  // valida os mesmos limites antes de gravar.
  for (const coluna of [
    'focus TEXT DEFAULT NULL',
    'typical_weekly_km REAL DEFAULT NULL',
    'active_injuries TEXT DEFAULT NULL',
  ]) {
    try {
      db.exec(`ALTER TABLE user_objectives ADD COLUMN ${coluna}`);
    } catch (_) { /* coluna já existe */ }
  }

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
      rhr_bpm REAL DEFAULT NULL,
      consecutive_low_days INTEGER DEFAULT 0,
      device_id TEXT REFERENCES wearable_devices(id) ON DELETE SET NULL,
      duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 60),
      quality_score REAL DEFAULT NULL CHECK (quality_score BETWEEN 0 AND 1),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_hrv_user_ts ON hrv_measurements(user_id, timestamp);
  `);

  // Migrações dinâmicas para tabelas existentes
  try {
    db.exec(`ALTER TABLE hrv_measurements ADD COLUMN rhr_bpm REAL DEFAULT NULL`);
  } catch (_) { /* coluna já existe */ }
  try {
    db.exec(`ALTER TABLE hrv_measurements ADD COLUMN consecutive_low_days INTEGER DEFAULT 0`);
  } catch (_) { /* coluna já existe */ }

  // ============================================================
  // CICLO MENSTRUAL & BASELINES POR FASE (McNulty et al. 2020)
  // ============================================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_menstrual_profile (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      lmp_date TEXT DEFAULT NULL,
      cycle_length_days INTEGER DEFAULT 28,
      uses_hormonal_contraceptive INTEGER DEFAULT 0,
      contraceptive_type TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS menstrual_tracking (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      phase TEXT NOT NULL CHECK (phase IN ('menstrual', 'follicular', 'ovulatory', 'luteal')),
      cramp_level INTEGER DEFAULT 0 CHECK (cramp_level BETWEEN 0 AND 5),
      bloating_level INTEGER DEFAULT 0 CHECK (bloating_level BETWEEN 0 AND 5),
      energy_level INTEGER DEFAULT 3 CHECK (energy_level BETWEEN 0 AND 5),
      mood_level INTEGER DEFAULT 3 CHECK (mood_level BETWEEN 0 AND 5),
      bleeding_intensity TEXT DEFAULT NULL CHECK (bleeding_intensity IN ('none', 'light', 'moderate', 'heavy', NULL)),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_menstrual_user_date ON menstrual_tracking(user_id, date);

    CREATE TABLE IF NOT EXISTS hrv_phase_baselines (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      phase TEXT NOT NULL CHECK (phase IN ('menstrual', 'follicular', 'ovulatory', 'luteal', 'global')),
      lnrmssd_mean REAL NOT NULL DEFAULT 0,
      lnrmssd_sd REAL NOT NULL DEFAULT 0,
      rhr_mean REAL NOT NULL DEFAULT 0,
      rhr_sd REAL NOT NULL DEFAULT 0,
      sample_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, phase)
    );
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
      type TEXT NOT NULL CHECK (type IN ('run', 'trail_run', 'treadmill', 'walk', 'cycling', 'swimming', 'strength', 'other')),
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
      image_url TEXT DEFAULT NULL,
      rpe_score INTEGER DEFAULT NULL,
      feeling_notes TEXT DEFAULT NULL,
      workout_rating INTEGER DEFAULT NULL,
      privacy TEXT NOT NULL DEFAULT 'public' CHECK (privacy IN ('public', 'followers', 'private')),
      session_id TEXT REFERENCES training_sessions(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_activities_user_date ON activities(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_activities_privacy ON activities(privacy, date);
    CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
  `);

  // ------------------------------------------------------------
  // Migração: a tabela antiga só aceitava 6 tipos de atividade
  // ('run','bike','strength','swim','walk','other'), enquanto a rota
  // sempre aceitou 8 — com nomes diferentes. Gravar trilha, esteira,
  // pedal ou natação violava o CHECK e devolvia 500 ao cliente.
  //
  // O SQLite não altera um CHECK: a tabela precisa ser recriada. A cópia
  // usa as colunas que a tabela REALMENTE tem (migrações anteriores
  // acrescentaram algumas), traduz os nomes antigos e confere a
  // contagem de linhas antes de descartar a original.
  // ------------------------------------------------------------
  try {
    const definicaoAtual = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'activities'")
      .get()?.sql || '';

    if (definicaoAtual.includes("'bike'")) {
      const colunas = db.prepare('PRAGMA table_info(activities)').all().map((c) => c.name);
      const listaColunas = colunas.map((c) => `"${c}"`).join(', ');
      const listaSelecao = colunas
        .map((c) =>
          c === 'type'
            ? `CASE type WHEN 'bike' THEN 'cycling' WHEN 'swim' THEN 'swimming' ELSE type END`
            : `"${c}"`,
        )
        .join(', ');

      const antes = db.prepare('SELECT COUNT(*) AS total FROM activities').get().total;

      db.pragma('foreign_keys = OFF');
      const migrar = db.transaction(() => {
        db.exec(`
          CREATE TABLE activities_migradas (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type TEXT NOT NULL CHECK (type IN ('run', 'trail_run', 'treadmill', 'walk', 'cycling', 'swimming', 'strength', 'other')),
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
            image_url TEXT DEFAULT NULL,
            rpe_score INTEGER DEFAULT NULL,
            feeling_notes TEXT DEFAULT NULL,
            workout_rating INTEGER DEFAULT NULL,
            privacy TEXT NOT NULL DEFAULT 'public' CHECK (privacy IN ('public', 'followers', 'private')),
            session_id TEXT REFERENCES training_sessions(id) ON DELETE SET NULL,
            shoe_id TEXT DEFAULT NULL REFERENCES shoes(id) ON DELETE SET NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );
        `);

        db.exec(`INSERT INTO activities_migradas (${listaColunas}) SELECT ${listaSelecao} FROM activities;`);

        const depois = db.prepare('SELECT COUNT(*) AS total FROM activities_migradas').get().total;
        if (depois !== antes) {
          throw new Error(`migração de activities copiou ${depois} de ${antes} linhas — abortada`);
        }

        db.exec('DROP TABLE activities;');
        db.exec('ALTER TABLE activities_migradas RENAME TO activities;');
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_activities_user_date ON activities(user_id, date);
          CREATE INDEX IF NOT EXISTS idx_activities_privacy ON activities(privacy, date);
          CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
          CREATE INDEX IF NOT EXISTS idx_activities_shoe ON activities(shoe_id);
        `);
      });

      migrar();

      const orfas = db.pragma('foreign_key_check');
      db.pragma('foreign_keys = ON');
      if (Array.isArray(orfas) && orfas.length > 0) {
        console.error('⚠️  Referências órfãs após migrar activities:', orfas.length);
      }
      console.log(`✅ Tabela activities migrada para 8 tipos (${antes} atividades preservadas)`);
    }
  } catch (err) {
    console.error('Erro ao migrar os tipos de atividade:', err.message);
  }

  try {
    db.exec(`ALTER TABLE activities ADD COLUMN image_url TEXT DEFAULT NULL`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE activities ADD COLUMN rpe_score INTEGER DEFAULT NULL`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE activities ADD COLUMN feeling_notes TEXT DEFAULT NULL`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE activities ADD COLUMN workout_rating INTEGER DEFAULT NULL`);
  } catch (_) {}

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

    -- Inscrições de Web Push. O endpoint é a identidade da inscrição
    -- perante o serviço do navegador, por isso é ele a chave primária:
    -- o mesmo atleta tem uma linha por navegador/aparelho, e reinstalar
    -- o app gera um endpoint novo em vez de duplicar o antigo.
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      last_success_at TEXT DEFAULT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
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
  // TRAÇADO GPS — polilinha bruta de cada atividade
  // ------------------------------------------------------------
  // Guardamos o percurso como UMA linha por atividade (points_json),
  // e não uma linha por ponto: uma corrida de 1h a 1 Hz gera ~3.600
  // pontos, o que inflaria a tabela sem nenhum ganho de consulta —
  // o traçado só é lido inteiro (mapa e exportação .GPX).
  // Cada ponto: { lat, lon, t (epoch ms), acc (m), alt (m|null) }.
  // ============================================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_tracks (
      activity_id TEXT PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
      points_json TEXT NOT NULL,
      point_count INTEGER NOT NULL DEFAULT 0,
      started_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ============================================================
  // RECORTE DE ATIVIDADE — o que havia antes do corte
  // ------------------------------------------------------------
  // Recortar altera dado medido (distância, duração, traçado). Os
  // valores originais ficam guardados aqui para que o corte possa
  // ser desfeito — sem isso, um corte errado destruiria o registro
  // da corrida para sempre.
  // ============================================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_trims (
      activity_id TEXT PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
      original_distance_km REAL NOT NULL,
      original_duration_seconds INTEGER NOT NULL,
      original_avg_pace TEXT DEFAULT NULL,
      original_points_json TEXT DEFAULT NULL,
      original_hr_samples_json TEXT DEFAULT NULL,
      trim_start_seconds INTEGER NOT NULL DEFAULT 0,
      trim_end_seconds INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ============================================================
  // AMOSTRAS DE FC — série cardíaca bruta de cada atividade
  // ------------------------------------------------------------
  // Mesma estratégia do traçado GPS: UMA linha por atividade, com
  // a série em JSON. A cinta BLE entrega ~1 leitura por segundo,
  // então uma corrida de 1 h gera ~3.600 amostras — inúteis como
  // linhas separadas, já que a série só é lida inteira (curva de
  // FC e distribuição por zonas).
  // Cada amostra: { t (segundos desde a largada), bpm }.
  // ============================================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_hr_samples (
      activity_id TEXT PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
      samples_json TEXT NOT NULL,
      sample_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ============================================================
  // GEAR — Frota de calçados (Gear Garage / Aposentadoria)
  // ============================================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS shoes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      model_type TEXT DEFAULT NULL,
      colorway TEXT DEFAULT NULL,
      plate_technology TEXT DEFAULT NULL,
      image_url TEXT DEFAULT NULL,
      initial_km REAL NOT NULL DEFAULT 0 CHECK (initial_km >= 0),
      max_km REAL NOT NULL DEFAULT 800 CHECK (max_km > 0),
      is_default INTEGER NOT NULL DEFAULT 0,
      retired_at TEXT DEFAULT NULL,
      purchased_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_shoes_user ON shoes(user_id);
    CREATE INDEX IF NOT EXISTS idx_shoes_retired ON shoes(user_id, retired_at);
  `);

  // Vínculo atividade -> calçado (quilometragem acumula automaticamente)
  try {
    db.exec(`ALTER TABLE activities ADD COLUMN shoe_id TEXT DEFAULT NULL REFERENCES shoes(id) ON DELETE SET NULL`);
  } catch (_) {}
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_activities_shoe ON activities(shoe_id)`);
  } catch (_) {}

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
