// ============================================================
// RUSH PERFORMANCE — Users & Profiles Routes
// ============================================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

module.exports = function usersRoutes(db) {
  const router = express.Router();

  // -------------------------------------------------------
  // GET /api/users/me — Authenticated current user profile & state
  // MUST be defined before /:username to avoid route param collision
  // -------------------------------------------------------
  router.get('/me', authenticate, async (req, res) => {
    try {
      const user = await db.prepare('SELECT id, email, role, academy_id, subscription_tier, subscription_status, trial_ends_at, subscription_expires_at, created_at FROM users WHERE id = ? AND deleted_at IS NULL').get(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      const profile = await db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.user.id);
      const objectives = await db.prepare('SELECT * FROM user_objectives WHERE user_id = ?').get(req.user.id);
      const settings = await db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.user.id);
      const privacy = await db.prepare('SELECT * FROM privacy_settings WHERE user_id = ?').get(req.user.id);

      const isPro = ['coach', 'owner', 'admin'].includes(user.role) || 
                    user.subscription_tier === 'pro' || 
                    (user.subscription_status === 'trial' && user.trial_ends_at && new Date(user.trial_ends_at) > new Date()) ||
                    (user.subscription_status === 'active');

      const hasOnboarding = !!(objectives && objectives.distance_km && objectives.level);

      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        academy_id: user.academy_id,
        subscription_tier: user.subscription_tier || 'free',
        subscription_status: user.subscription_status || 'free',
        is_pro: isPro,
        created_at: user.created_at,
        has_onboarding: hasOnboarding,
        name: profile?.name || user.email.split('@')[0],
        username: profile?.username || user.email.split('@')[0],
        bio: profile?.bio || null,
        location: profile?.location || null,
        avatar_url: profile?.avatar_url || null,
        date_of_birth: profile?.date_of_birth || null,
        gender: profile?.gender || null,
        weight_kg: profile?.weight_kg || null,
        height_cm: profile?.height_cm || null,
        distance_km: objectives?.distance_km,
        level: objectives?.level,
        profile,
        objectives: objectives
          ? {
              ...objectives,
              // A coluna guarda JSON; o cliente sempre recebe uma lista.
              active_injuries: objectives.active_injuries
                ? JSON.parse(objectives.active_injuries)
                : [],
            }
          : objectives,
        settings,
        privacy,
      });
    } catch (err) {
      console.error('Users /me error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // -------------------------------------------------------
  // GET /api/users/profile
  // -------------------------------------------------------
  router.get('/profile', authenticate, async (req, res) => {
    try {
      const profile = await db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.user.id);
      if (!profile) {
        return res.status(404).json({ error: 'Perfil não encontrado' });
      }

      // Count followers, following, activities
      const followers = await db.prepare('SELECT COUNT(*) as count FROM follows WHERE followed_id = ?').get(req.user.id);
      const following = await db.prepare('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?').get(req.user.id);
      const activities = await db.prepare('SELECT COUNT(*) as count FROM activities WHERE user_id = ?').get(req.user.id);
      const totalDistance = await db.prepare('SELECT COALESCE(SUM(distance_km), 0) as total FROM activities WHERE user_id = ?').get(req.user.id);
      const achievements = await db.prepare('SELECT COUNT(*) as count FROM user_achievements WHERE user_id = ?').get(req.user.id);

      res.json({
        ...profile,
        stats: {
          followers: followers.count,
          following: following.count,
          activities: activities.count,
          total_distance_km: +totalDistance.total.toFixed(1),
          achievements: achievements.count,
        }
      });
    } catch (err) {
      console.error('Users /profile error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // -------------------------------------------------------
  // PUT /api/users/profile
  // -------------------------------------------------------
  router.put('/profile', authenticate, async (req, res) => {
    try {
      const { name, username, bio, location, date_of_birth, gender, weight_kg, height_cm, avatar_url } = req.body;

      // Check username uniqueness & format
      if (username !== undefined) {
        const cleanUsername = String(username).trim().toLowerCase();
        if (!/^[a-z0-9_]{3,30}$/i.test(cleanUsername)) {
          return res.status(400).json({ error: 'Username deve conter de 3 a 30 caracteres alfanuméricos ou _' });
        }
        const existing = await db.prepare('SELECT user_id FROM user_profiles WHERE username = ? AND user_id != ?').get(cleanUsername, req.user.id);
        if (existing) {
          return res.status(409).json({ error: 'Username já em uso' });
        }
      }

      if (weight_kg !== undefined && weight_kg !== null) {
        const numWeight = Number(weight_kg);
        if (isNaN(numWeight) || numWeight < 20 || numWeight > 500) {
          return res.status(400).json({ error: 'weight_kg deve ser um número entre 20 e 500 kg' });
        }
      }

      if (height_cm !== undefined && height_cm !== null) {
        const numHeight = Number(height_cm);
        if (isNaN(numHeight) || numHeight < 50 || numHeight > 300) {
          return res.status(400).json({ error: 'height_cm deve ser um número entre 50 e 300 cm' });
        }
      }

      if (gender !== undefined && gender !== null && !['male', 'female', 'other', 'prefer_not_to_say'].includes(gender)) {
        return res.status(400).json({ error: 'gender inválido' });
      }

      const fields = [];
      const values = [];

      if (name !== undefined) { fields.push('name = ?'); values.push(String(name).trim()); }
      if (username !== undefined) { fields.push('username = ?'); values.push(String(username).trim().toLowerCase()); }
      if (bio !== undefined) { fields.push('bio = ?'); values.push(bio ? String(bio).trim() : null); }
      if (location !== undefined) { fields.push('location = ?'); values.push(location ? String(location).trim() : null); }
      if (date_of_birth !== undefined) { fields.push('date_of_birth = ?'); values.push(date_of_birth || null); }
      if (gender !== undefined) { fields.push('gender = ?'); values.push(gender || null); }
      if (weight_kg !== undefined) { fields.push('weight_kg = ?'); values.push(weight_kg != null ? Number(weight_kg) : null); }
      if (height_cm !== undefined) { fields.push('height_cm = ?'); values.push(height_cm != null ? Number(height_cm) : null); }
      if (avatar_url !== undefined) { fields.push('avatar_url = ?'); values.push(avatar_url ? String(avatar_url).trim() : null); }
      if (req.body.instagram !== undefined) { fields.push('instagram = ?'); values.push(req.body.instagram ? String(req.body.instagram).trim() : null); }
      if (req.body.strava !== undefined) { fields.push('strava = ?'); values.push(req.body.strava ? String(req.body.strava).trim() : null); }
      if (req.body.pace_5k !== undefined) { fields.push('pace_5k = ?'); values.push(req.body.pace_5k ? String(req.body.pace_5k).trim() : null); }
      if (req.body.hr_max_tested !== undefined) { fields.push('hr_max_tested = ?'); values.push(req.body.hr_max_tested ? parseInt(req.body.hr_max_tested, 10) : null); }
      if (req.body.hr_rest_tested !== undefined) { fields.push('hr_rest_tested = ?'); values.push(req.body.hr_rest_tested ? parseInt(req.body.hr_rest_tested, 10) : null); }
      if (req.body.prior_hrv_rmssd !== undefined) { fields.push('prior_hrv_rmssd = ?'); values.push(req.body.prior_hrv_rmssd ? parseFloat(req.body.prior_hrv_rmssd) : null); }
      if (req.body.custom_zones_json !== undefined) { fields.push('custom_zones_json = ?'); values.push(req.body.custom_zones_json ? String(req.body.custom_zones_json) : null); }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar' });
      }

      fields.push("updated_at = datetime('now')");
      values.push(req.user.id);

      await db.prepare(`UPDATE user_profiles SET ${fields.join(', ')} WHERE user_id = ?`).run(...values);

      const updated = await db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.user.id);
      res.json(updated);
    } catch (err) {
      console.error('Users update profile error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // -------------------------------------------------------
  // GET /api/users/devices — Sensores BLE pareados
  // -------------------------------------------------------
  router.get('/devices', authenticate, async (req, res) => {
    try {
      const devices = await db.prepare(`
        SELECT id, brand, device_id, device_type, is_active, created_at, updated_at
        FROM wearable_devices
        WHERE user_id = ?
        ORDER BY is_active DESC, updated_at DESC
      `).all(req.user.id);

      res.json({ devices });
    } catch (err) {
      console.error('List devices error:', err);
      res.status(500).json({ error: 'Erro ao listar sensores' });
    }
  });

  // -------------------------------------------------------
  // POST /api/users/devices — Registrar sensor pareado
  // -------------------------------------------------------
  const VALID_DEVICE_TYPES = ['heart_rate', 'footpod', 'power', 'watch', 'other'];

  router.post('/devices', authenticate, async (req, res) => {
    try {
      const { brand, device_id, device_type = 'heart_rate' } = req.body;

      if (!brand || !String(brand).trim()) {
        return res.status(400).json({ error: 'brand é obrigatório' });
      }
      if (!device_id || !String(device_id).trim()) {
        return res.status(400).json({ error: 'device_id é obrigatório' });
      }
      if (!VALID_DEVICE_TYPES.includes(device_type)) {
        return res.status(400).json({ error: `device_type inválido. Valores aceitos: ${VALID_DEVICE_TYPES.join(', ')}` });
      }

      const cleanDeviceId = String(device_id).trim().slice(0, 120);
      const existing = await db.prepare('SELECT id FROM wearable_devices WHERE user_id = ? AND device_id = ?')
        .get(req.user.id, cleanDeviceId);

      if (existing) {
        await db.prepare(`
          UPDATE wearable_devices
          SET brand = ?, device_type = ?, is_active = 1, updated_at = datetime('now')
          WHERE id = ?
        `).run(String(brand).trim().slice(0, 80), device_type, existing.id);
        const updated = await db.prepare('SELECT id, brand, device_id, device_type, is_active FROM wearable_devices WHERE id = ?').get(existing.id);
        return res.json(updated);
      }

      const id = uuidv4();
      await db.prepare(`
        INSERT INTO wearable_devices (id, user_id, brand, device_id, device_type, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(id, req.user.id, String(brand).trim().slice(0, 80), cleanDeviceId, device_type);

      const created = await db.prepare('SELECT id, brand, device_id, device_type, is_active FROM wearable_devices WHERE id = ?').get(id);
      res.status(201).json(created);
    } catch (err) {
      console.error('Register device error:', err);
      res.status(500).json({ error: 'Erro ao registrar sensor' });
    }
  });

  // -------------------------------------------------------
  // DELETE /api/users/devices/:id — Desparear sensor
  // -------------------------------------------------------
  router.delete('/devices/:id', authenticate, async (req, res) => {
    try {
      const device = await db.prepare('SELECT id FROM wearable_devices WHERE id = ? AND user_id = ?')
        .get(req.params.id, req.user.id);
      if (!device) {
        return res.status(404).json({ error: 'Sensor não encontrado' });
      }

      await db.prepare('DELETE FROM wearable_devices WHERE id = ?').run(req.params.id);
      res.json({ success: true, id: req.params.id });
    } catch (err) {
      console.error('Delete device error:', err);
      res.status(500).json({ error: 'Erro ao remover sensor' });
    }
  });

  // -------------------------------------------------------
  // POST /api/users/field-test — Processar teste de campo para iniciantes/avançados
  // -------------------------------------------------------
  router.post('/field-test', authenticate, async (req, res) => {
    try {
      const { test_type, distance_km, duration_seconds, avg_hr, max_hr, rest_hr } = req.body;

      if (!test_type) {
        return res.status(400).json({ error: 'test_type é obrigatório' });
      }

      const numDist = Number(distance_km) || 0;
      const numDur = Number(duration_seconds) || 720; // 12 min padrão
      const numAvgHr = Number(avg_hr) || 165;
      const numMaxHr = Number(max_hr) || 185;
      const numRestHr = Number(rest_hr) || 55;

      // Calcular Pace Médio do Teste (segundos por km)
      let paceSecondsPerKm = numDist > 0 ? numDur / numDist : 330; // ~5:30/km fallback
      const paceMin = Math.floor(paceSecondsPerKm / 60);
      const paceSec = Math.floor(paceSecondsPerKm % 60);
      const paceFormatted = `${paceMin}:${paceSec < 10 ? '0' : ''}${paceSec}`;

      // Paces calculados para as 5 Zonas (baseado no pace do teste de 12/30 min):
      // Z1: Pace de teste + 80s a 120s
      // Z2: Pace de teste + 45s a 75s (base aeróbica)
      // Z3: Pace de teste + 15s a 35s (maratona)
      // Z4: Pace de teste (limiar / 10k)
      // Z5: Pace de teste - 15s a 30s (tiros 3k/5k)
      const formatPaceDelta = (deltaSec) => {
        const total = Math.max(120, paceSecondsPerKm + deltaSec);
        const m = Math.floor(total / 60);
        const s = Math.floor(total % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}/km`;
      };

      const calculatedPaces = {
        Z1: `${formatPaceDelta(90)} – ${formatPaceDelta(130)}`,
        Z2: `${formatPaceDelta(45)} – ${formatPaceDelta(75)}`,
        Z3: `${formatPaceDelta(15)} – ${formatPaceDelta(35)}`,
        Z4: `${formatPaceDelta(0)} – ${formatPaceDelta(10)}`,
        Z5: `< ${formatPaceDelta(-15)}`,
      };

      // Zonas de FC (Karvonen / FCmax)
      const effectiveMaxHr = Math.max(140, numMaxHr);
      const calculatedHrZones = {
        Z1: { minBpm: Math.round(effectiveMaxHr * 0.50), maxBpm: Math.round(effectiveMaxHr * 0.60), pace: calculatedPaces.Z1 },
        Z2: { minBpm: Math.round(effectiveMaxHr * 0.60), maxBpm: Math.round(effectiveMaxHr * 0.70), pace: calculatedPaces.Z2 },
        Z3: { minBpm: Math.round(effectiveMaxHr * 0.70), maxBpm: Math.round(effectiveMaxHr * 0.80), pace: calculatedPaces.Z3 },
        Z4: { minBpm: Math.round(effectiveMaxHr * 0.80), maxBpm: Math.round(effectiveMaxHr * 0.90), pace: calculatedPaces.Z4 },
        Z5: { minBpm: Math.round(effectiveMaxHr * 0.90), maxBpm: effectiveMaxHr, pace: calculatedPaces.Z5 },
      };

      // Persistir no perfil do usuário
      await db.prepare(`
        UPDATE user_profiles SET
          pace_5k = ?,
          hr_max_tested = ?,
          hr_rest_tested = ?,
          custom_zones_json = ?,
          updated_at = datetime('now')
        WHERE user_id = ?
      `).run(paceFormatted, effectiveMaxHr, numRestHr, JSON.stringify(calculatedHrZones), req.user.id);

      // -------------------------------------------------------
      // VO2max indireto — apenas para o protocolo de Cooper (12 min).
      // Fórmula original de Cooper (1968): VO2max = (metros - 504.9) / 44.73
      // Só é válida para um esforço máximo de 12 minutos, por isso o
      // cálculo é restrito a esse protocolo (com tolerância de +/- 1 min).
      // -------------------------------------------------------
      let vo2maxEstimate = null;
      const isCooper = String(test_type).toLowerCase().includes('cooper');
      if (isCooper && numDist > 0 && numDur >= 660 && numDur <= 780) {
        const meters = numDist * 1000;
        const rawVo2 = (meters - 504.9) / 44.73;
        if (rawVo2 >= 20 && rawVo2 <= 100) {
          vo2maxEstimate = +rawVo2.toFixed(1);
          const today = new Date().toISOString().split('T')[0];
          await db.prepare(`
            INSERT INTO vo2max_estimates (id, user_id, date, vo2max_value, method, notes)
            VALUES (?, ?, ?, ?, 'cooper_12min', ?)
          `).run(
            uuidv4(),
            req.user.id,
            today,
            vo2maxEstimate,
            `Teste de Cooper: ${numDist} km em ${Math.round(numDur / 60)} min`,
          );
        }
      }

      res.json({
        success: true,
        test_type,
        test_pace: `${paceFormatted}/km`,
        max_hr: effectiveMaxHr,
        rest_hr: numRestHr,
        zones: calculatedHrZones,
        vo2max: vo2maxEstimate,
        message: vo2maxEstimate
          ? `Teste processado! Zonas individualizadas salvas e VO2max estimado em ${vo2maxEstimate} ml/kg/min.`
          : 'Teste de campo processado e zonas individualizadas salvas!',
      });
    } catch (err) {
      console.error('Field test error:', err);
      res.status(500).json({ error: 'Erro ao processar teste de campo' });
    }
  });

  // -------------------------------------------------------
  // PUT /api/users/objectives
  // -------------------------------------------------------
  router.put('/objectives', authenticate, async (req, res) => {
    try {
      const {
        distance_km, target_race_date, level,
        focus, typical_weekly_km, active_injuries,
      } = req.body;

      if (!distance_km || !level) {
        return res.status(400).json({ error: 'distance_km e level são obrigatórios' });
      }

      const numDistance = Number(distance_km);
      if (![5, 10, 21, 42].includes(numDistance)) {
        return res.status(400).json({ error: 'distance_km deve ser 5, 10, 21 ou 42' });
      }

      if (!['beginner', 'intermediate', 'advanced'].includes(level)) {
        return res.status(400).json({ error: 'level deve ser beginner, intermediate ou advanced' });
      }

      // Campos da calibração — todos opcionais, para não quebrar quem já
      // salva objetivos só com distância e nível.
      const FOCOS = ['race', 'pace', 'injury_prevention', 'volume'];
      if (focus != null && !FOCOS.includes(focus)) {
        return res.status(400).json({ error: `focus deve ser um de: ${FOCOS.join(', ')}` });
      }

      let numWeeklyKm = null;
      if (typical_weekly_km != null && typical_weekly_km !== '') {
        numWeeklyKm = Number(typical_weekly_km);
        if (isNaN(numWeeklyKm) || numWeeklyKm < 0 || numWeeklyKm > 300) {
          return res.status(400).json({ error: 'typical_weekly_km deve ser um número entre 0 e 300' });
        }
      }

      // Lesões ativas são guardadas como lista de identificadores. É
      // registro informativo: o agente NÃO ajusta a carga por lesão, porque
      // isso exige critério clínico que o app não tem.
      const LESOES = ['shin_splints', 'plantar_fasciitis', 'it_band', 'knee', 'achilles', 'other'];
      let injuriesJson = null;
      if (active_injuries !== undefined) {
        if (active_injuries === null) {
          injuriesJson = null;
        } else if (Array.isArray(active_injuries)) {
          const invalidas = active_injuries.filter((i) => !LESOES.includes(i));
          if (invalidas.length > 0) {
            return res.status(400).json({ error: `lesão inválida: ${invalidas.join(', ')}` });
          }
          injuriesJson = active_injuries.length > 0 ? JSON.stringify(active_injuries) : null;
        } else {
          return res.status(400).json({ error: 'active_injuries deve ser uma lista' });
        }
      }

      await db.prepare(`
        INSERT INTO user_objectives (
          user_id, distance_km, target_race_date, level,
          focus, typical_weekly_km, active_injuries
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          distance_km = excluded.distance_km,
          target_race_date = excluded.target_race_date,
          level = excluded.level,
          focus = COALESCE(excluded.focus, user_objectives.focus),
          typical_weekly_km = COALESCE(excluded.typical_weekly_km, user_objectives.typical_weekly_km),
          active_injuries = COALESCE(excluded.active_injuries, user_objectives.active_injuries),
          updated_at = datetime('now')
      `).run(
        req.user.id, numDistance, target_race_date || null, level,
        focus || null, numWeeklyKm, injuriesJson,
      );

      const objectives = await db.prepare('SELECT * FROM user_objectives WHERE user_id = ?').get(req.user.id);
      res.json({
        ...objectives,
        // A coluna guarda JSON; o cliente recebe a lista já pronta.
        active_injuries: objectives.active_injuries ? JSON.parse(objectives.active_injuries) : [],
      });
    } catch (err) {
      console.error('Users objectives error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // ATENCAO A ORDEM: estas rotas precisam vir ANTES de GET
  // /:username. O Express casa na ordem de registro, e '/:username'
  // aceita qualquer coisa — com o bloco la embaixo, uma chamada a
  // GET /users/privacy-zone era atendida pela busca de perfil e
  // voltava "Usuario nao encontrado". O PUT e o DELETE funcionavam
  // (nao ha '/:username' para esses verbos), entao a zona era
  // gravada e nunca lida de volta: a tela dizia "nenhuma zona
  // configurada" logo depois de salvar uma.

  // =======================================================
  // ZONA DE PRIVACIDADE DO PERCURSO
  // =======================================================
  // Um traçado publicado começa e termina onde o atleta mora. Sem
  // esta zona, publicar uma corrida entrega o endereço.

  const RAIO_MINIMO_M = 100;
  const RAIO_MAXIMO_M = 2000;

  router.get('/privacy-zone', authenticate, async (req, res) => {
    try {
      const zona = await db
        .prepare('SELECT lat, lon, radius_m, label, updated_at FROM privacy_zones WHERE user_id = ?')
        .get(req.user.id);
      res.json({ zone: zona || null, limits: { min_radius_m: RAIO_MINIMO_M, max_radius_m: RAIO_MAXIMO_M } });
    } catch (err) {
      console.error('Get privacy zone error:', err);
      res.status(500).json({ error: 'Erro ao buscar a zona de privacidade' });
    }
  });

  router.put('/privacy-zone', authenticate, async (req, res) => {
    try {
      const { lat, lon, radius_m, label } = req.body || {};

      const latitude = Number(lat);
      const longitude = Number(lon);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        return res.status(400).json({ error: 'Latitude inválida' });
      }
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return res.status(400).json({ error: 'Longitude inválida' });
      }

      const raio = Math.round(Number(radius_m) || 500);
      if (raio < RAIO_MINIMO_M || raio > RAIO_MAXIMO_M) {
        return res.status(400).json({
          error: `O raio precisa ficar entre ${RAIO_MINIMO_M} e ${RAIO_MAXIMO_M} metros`,
        });
      }

      const rotulo = typeof label === 'string' ? label.trim().slice(0, 60) || null : null;

      await db.prepare(`
        INSERT INTO privacy_zones (user_id, lat, lon, radius_m, label)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          lat = excluded.lat, lon = excluded.lon, radius_m = excluded.radius_m,
          label = excluded.label, updated_at = datetime('now')
      `).run(req.user.id, latitude, longitude, raio, rotulo);

      const zona = await db
        .prepare('SELECT lat, lon, radius_m, label, updated_at FROM privacy_zones WHERE user_id = ?')
        .get(req.user.id);
      res.json({ zone: zona });
    } catch (err) {
      console.error('Save privacy zone error:', err);
      res.status(500).json({ error: 'Erro ao salvar a zona de privacidade' });
    }
  });

  // Remover a zona volta a publicar o percurso inteiro — a tela
  // precisa deixar isso claro antes de chamar.
  router.delete('/privacy-zone', authenticate, async (req, res) => {
    try {
      await db.prepare('DELETE FROM privacy_zones WHERE user_id = ?').run(req.user.id);
      res.json({ zone: null });
    } catch (err) {
      console.error('Delete privacy zone error:', err);
      res.status(500).json({ error: 'Erro ao remover a zona de privacidade' });
    }
  });

  // -------------------------------------------------------
  // GET /api/users/:username
  // -------------------------------------------------------
  router.get('/:username', authenticate, async (req, res) => {
    try {
      const profile = await db.prepare(`
        SELECT p.*, u.role, u.created_at as member_since
        FROM user_profiles p
        JOIN users u ON u.id = p.user_id
        WHERE p.username = ? AND u.deleted_at IS NULL
      `).get(req.params.username);

      if (!profile) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      // Stats
      const followers = await db.prepare('SELECT COUNT(*) as count FROM follows WHERE followed_id = ?').get(profile.user_id);
      const following = await db.prepare('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?').get(profile.user_id);
      // privacy = 'public' com aspas SIMPLES: em SQL, aspas duplas sao
      // identificador, nao texto. Com "public" o banco procurava uma
      // COLUNA chamada public, nao achava, e esta rota devolvia 500 para
      // qualquer perfil — o Postgres faria o mesmo, e de forma ainda
      // mais estrita.
      const activities = await db.prepare("SELECT COUNT(*) as count FROM activities WHERE user_id = ? AND privacy = 'public'").get(profile.user_id);
      const totalDistance = await db.prepare('SELECT COALESCE(SUM(distance_km), 0) as total FROM activities WHERE user_id = ?').get(profile.user_id);

      // Is following?
      const isFollowing = await db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?').get(req.user.id, profile.user_id);

      // Privacy
      const privacy = await db.prepare('SELECT * FROM privacy_settings WHERE user_id = ?').get(profile.user_id);

      // Latest VO2max
      let vo2max = null;
      if (privacy?.show_vo2max) {
        vo2max = await db.prepare('SELECT vo2max_value, date FROM vo2max_estimates WHERE user_id = ? ORDER BY date DESC LIMIT 1').get(profile.user_id);
      }

      // Achievements
      let achievements = [];
      if (privacy?.show_achievements) {
        achievements = await db.prepare(`
          SELECT a.*, ua.earned_at
          FROM user_achievements ua
          JOIN achievements a ON a.id = ua.achievement_id
          WHERE ua.user_id = ?
          ORDER BY ua.earned_at DESC LIMIT 10
        `).all(profile.user_id);
      }

      res.json({
        ...profile,
        stats: {
          followers: followers.count,
          following: following.count,
          activities: activities.count,
          total_distance_km: +totalDistance.total.toFixed(1),
        },
        is_following: !!isFollowing,
        is_own_profile: profile.user_id === req.user.id,
        vo2max,
        achievements,
      });
    } catch (err) {
      console.error('Users get username error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // -------------------------------------------------------
  // PUT /api/users/settings
  // -------------------------------------------------------
  router.put('/settings', authenticate, async (req, res) => {
    try {
      const { language, timezone, notifications_enabled, email_notifications, push_notifications } = req.body;

      const fields = [];
      const values = [];

      if (language !== undefined) { fields.push('language = ?'); values.push(language); }
      if (timezone !== undefined) { fields.push('timezone = ?'); values.push(timezone); }
      if (notifications_enabled !== undefined) { fields.push('notifications_enabled = ?'); values.push(notifications_enabled ? 1 : 0); }
      if (email_notifications !== undefined) { fields.push('email_notifications = ?'); values.push(email_notifications ? 1 : 0); }
      if (push_notifications !== undefined) { fields.push('push_notifications = ?'); values.push(push_notifications ? 1 : 0); }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar' });
      }

      fields.push("updated_at = datetime('now')");
      values.push(req.user.id);

      await db.prepare(`UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = ?`).run(...values);

      const settings = await db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.user.id);
      res.json(settings);
    } catch (err) {
      console.error('Users update settings error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // -------------------------------------------------------
  // PUT /api/users/privacy
  // -------------------------------------------------------
  router.put('/privacy', authenticate, async (req, res) => {
    try {
      const { public_activities, show_hrv_status, show_vo2max, show_achievements, allow_messages } = req.body;

      const fields = [];
      const values = [];

      if (public_activities !== undefined) { fields.push('public_activities = ?'); values.push(public_activities ? 1 : 0); }
      if (show_hrv_status !== undefined) { fields.push('show_hrv_status = ?'); values.push(show_hrv_status ? 1 : 0); }
      if (show_vo2max !== undefined) { fields.push('show_vo2max = ?'); values.push(show_vo2max ? 1 : 0); }
      if (show_achievements !== undefined) { fields.push('show_achievements = ?'); values.push(show_achievements ? 1 : 0); }
      if (allow_messages !== undefined) { fields.push('allow_messages = ?'); values.push(allow_messages ? 1 : 0); }

      if (fields.length > 0) {
        fields.push("updated_at = datetime('now')");
        values.push(req.user.id);
        await db.prepare(`UPDATE privacy_settings SET ${fields.join(', ')} WHERE user_id = ?`).run(...values);
      }

      const privacy = await db.prepare('SELECT * FROM privacy_settings WHERE user_id = ?').get(req.user.id);
      res.json(privacy);
    } catch (err) {
      console.error('Users update privacy error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // -------------------------------------------------------
  // DELETE /api/users/me — Exclusão definitiva de conta (Apple 5.1.1)
  // -------------------------------------------------------
  router.delete('/me', authenticate, async (req, res) => {
    try {
      // Exclusão é irreversível: exigir a senha impede que um token roubado
      // ou um aparelho destravado apaguem a conta de outra pessoa.
      const { password } = req.body || {};
      if (!password) {
        return res.status(400).json({ error: 'Informe sua senha para confirmar a exclusão' });
      }

      const user = await db
        .prepare('SELECT id, password_hash FROM users WHERE id = ? AND deleted_at IS NULL')
        .get(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      const senhaConfere = await bcrypt.compare(String(password), user.password_hash);
      if (!senhaConfere) {
        return res.status(401).json({ error: 'Senha incorreta' });
      }

      await db.prepare("UPDATE users SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(req.user.id);

      // Sessões abertas param de valer imediatamente.
      try {
        await db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(req.user.id);
      } catch (_) { /* tabela pode não existir em bancos antigos */ }

      res.json({ success: true, message: 'Conta excluída com sucesso.' });
    } catch (err) {
      console.error('Delete account error:', err);
      res.status(500).json({ error: 'Erro ao excluir conta' });
    }
  });

  return router;
};
