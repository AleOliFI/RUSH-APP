// ============================================================
// RUSH PERFORMANCE — Users & Profiles Routes
// ============================================================

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');

module.exports = function usersRoutes(db) {
  const router = express.Router();

  // -------------------------------------------------------
  // GET /api/users/me — Authenticated current user profile & state
  // MUST be defined before /:username to avoid route param collision
  // -------------------------------------------------------
  router.get('/me', authenticate, (req, res) => {
    try {
      const user = db.prepare('SELECT id, email, role, academy_id, created_at FROM users WHERE id = ? AND deleted_at IS NULL').get(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.user.id);
      const objectives = db.prepare('SELECT * FROM user_objectives WHERE user_id = ?').get(req.user.id);
      const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.user.id);
      const privacy = db.prepare('SELECT * FROM privacy_settings WHERE user_id = ?').get(req.user.id);

      const hasOnboarding = !!(objectives && objectives.distance_km && objectives.level);

      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        academy_id: user.academy_id,
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
        objectives,
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
  router.get('/profile', authenticate, (req, res) => {
    try {
      const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.user.id);
      if (!profile) {
        return res.status(404).json({ error: 'Perfil não encontrado' });
      }

      // Count followers, following, activities
      const followers = db.prepare('SELECT COUNT(*) as count FROM follows WHERE followed_id = ?').get(req.user.id);
      const following = db.prepare('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?').get(req.user.id);
      const activities = db.prepare('SELECT COUNT(*) as count FROM activities WHERE user_id = ?').get(req.user.id);
      const totalDistance = db.prepare('SELECT COALESCE(SUM(distance_km), 0) as total FROM activities WHERE user_id = ?').get(req.user.id);
      const achievements = db.prepare('SELECT COUNT(*) as count FROM user_achievements WHERE user_id = ?').get(req.user.id);

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
  router.put('/profile', authenticate, (req, res) => {
    try {
      const { name, username, bio, location, date_of_birth, gender, weight_kg, height_cm, avatar_url } = req.body;

      // Check username uniqueness & format
      if (username !== undefined) {
        const cleanUsername = String(username).trim().toLowerCase();
        if (!/^[a-z0-9_]{3,30}$/i.test(cleanUsername)) {
          return res.status(400).json({ error: 'Username deve conter de 3 a 30 caracteres alfanuméricos ou _' });
        }
        const existing = db.prepare('SELECT user_id FROM user_profiles WHERE username = ? AND user_id != ?').get(cleanUsername, req.user.id);
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

      if (fields.length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar' });
      }

      fields.push("updated_at = datetime('now')");
      values.push(req.user.id);

      db.prepare(`UPDATE user_profiles SET ${fields.join(', ')} WHERE user_id = ?`).run(...values);

      const updated = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.user.id);
      res.json(updated);
    } catch (err) {
      console.error('Users update profile error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // -------------------------------------------------------
  // PUT /api/users/objectives
  // -------------------------------------------------------
  router.put('/objectives', authenticate, (req, res) => {
    try {
      const { distance_km, target_race_date, level } = req.body;

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

      db.prepare(`
        INSERT INTO user_objectives (user_id, distance_km, target_race_date, level)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          distance_km = excluded.distance_km,
          target_race_date = excluded.target_race_date,
          level = excluded.level,
          updated_at = datetime('now')
      `).run(req.user.id, numDistance, target_race_date || null, level);

      const objectives = db.prepare('SELECT * FROM user_objectives WHERE user_id = ?').get(req.user.id);
      res.json(objectives);
    } catch (err) {
      console.error('Users objectives error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // -------------------------------------------------------
  // GET /api/users/:username
  // -------------------------------------------------------
  router.get('/:username', authenticate, (req, res) => {
    try {
      const profile = db.prepare(`
        SELECT p.*, u.role, u.created_at as member_since
        FROM user_profiles p
        JOIN users u ON u.id = p.user_id
        WHERE p.username = ? AND u.deleted_at IS NULL
      `).get(req.params.username);

      if (!profile) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      // Stats
      const followers = db.prepare('SELECT COUNT(*) as count FROM follows WHERE followed_id = ?').get(profile.user_id);
      const following = db.prepare('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?').get(profile.user_id);
      const activities = db.prepare('SELECT COUNT(*) as count FROM activities WHERE user_id = ? AND privacy = "public"').get(profile.user_id);
      const totalDistance = db.prepare('SELECT COALESCE(SUM(distance_km), 0) as total FROM activities WHERE user_id = ?').get(profile.user_id);

      // Is following?
      const isFollowing = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?').get(req.user.id, profile.user_id);

      // Privacy
      const privacy = db.prepare('SELECT * FROM privacy_settings WHERE user_id = ?').get(profile.user_id);

      // Latest VO2max
      let vo2max = null;
      if (privacy?.show_vo2max) {
        vo2max = db.prepare('SELECT vo2max_value, date FROM vo2max_estimates WHERE user_id = ? ORDER BY date DESC LIMIT 1').get(profile.user_id);
      }

      // Achievements
      let achievements = [];
      if (privacy?.show_achievements) {
        achievements = db.prepare(`
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
  router.put('/settings', authenticate, (req, res) => {
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

      db.prepare(`UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = ?`).run(...values);

      const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.user.id);
      res.json(settings);
    } catch (err) {
      console.error('Users update settings error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // -------------------------------------------------------
  // PUT /api/users/privacy
  // -------------------------------------------------------
  router.put('/privacy', authenticate, (req, res) => {
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
        db.prepare(`UPDATE privacy_settings SET ${fields.join(', ')} WHERE user_id = ?`).run(...values);
      }

      const privacy = db.prepare('SELECT * FROM privacy_settings WHERE user_id = ?').get(req.user.id);
      res.json(privacy);
    } catch (err) {
      console.error('Users update privacy error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  return router;
};
