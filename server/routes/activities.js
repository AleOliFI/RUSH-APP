// ============================================================
// RUSH PERFORMANCE — Activities Routes
// ============================================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticate, optionalAuth } = require('../middleware/auth');

module.exports = function activitiesRoutes(db) {
  const router = express.Router();

  const VALID_ACTIVITY_TYPES = ['run', 'trail_run', 'treadmill', 'walk', 'cycling', 'swimming', 'strength', 'other'];
  const VALID_PRIVACY_LEVELS = ['public', 'followers', 'private'];

  // -------------------------------------------------------
  // POST /api/activities — Criar atividade
  // -------------------------------------------------------
  router.post('/', authenticate, (req, res) => {
    try {
      const {
        type, title, date, distance_km, duration_seconds,
        avg_pace, avg_hr, max_hr, calories, elevation_gain,
        rpe, rpe_score, feeling_notes, workout_rating, image_url, description,
        privacy = 'public', session_id, splits, shoe_id
      } = req.body;

      if (!type || distance_km == null || duration_seconds == null) {
        return res.status(400).json({ error: 'type, distance_km e duration_seconds são obrigatórios' });
      }

      if (!VALID_ACTIVITY_TYPES.includes(type)) {
        return res.status(400).json({ error: `Tipo de atividade inválido. Valores aceitos: ${VALID_ACTIVITY_TYPES.join(', ')}` });
      }

      const numDist = Number(distance_km);
      if (isNaN(numDist) || numDist < 0 || numDist > 500) {
        return res.status(400).json({ error: 'distance_km deve ser um número entre 0 e 500 km' });
      }

      const numDuration = Number(duration_seconds);
      if (isNaN(numDuration) || numDuration <= 0 || numDuration > 86400) {
        return res.status(400).json({ error: 'duration_seconds deve ser um número positivo de até 86400 segundos' });
      }

      const privacySetting = VALID_PRIVACY_LEVELS.includes(privacy) ? privacy : 'public';

      let numRpe = null;
      const effectiveRpe = rpe_score !== undefined ? rpe_score : rpe;
      if (effectiveRpe !== undefined && effectiveRpe !== null) {
        numRpe = Number(effectiveRpe);
        if (isNaN(numRpe) || numRpe < 1 || numRpe > 10) {
          return res.status(400).json({ error: 'rpe deve ser um número entre 1 e 10' });
        }
      }

      let numAvgHr = null;
      if (avg_hr !== undefined && avg_hr !== null) {
        numAvgHr = Number(avg_hr);
        if (isNaN(numAvgHr) || numAvgHr < 30 || numAvgHr > 250) {
          return res.status(400).json({ error: 'avg_hr deve ser um número entre 30 e 250 bpm' });
        }
      }

      let numMaxHr = null;
      if (max_hr !== undefined && max_hr !== null) {
        numMaxHr = Number(max_hr);
        if (isNaN(numMaxHr) || numMaxHr < 30 || numMaxHr > 250) {
          return res.status(400).json({ error: 'max_hr deve ser um número entre 30 e 250 bpm' });
        }
      }

      // Calçado utilizado (opcional) — precisa pertencer ao próprio atleta
      let effectiveShoeId = null;
      if (shoe_id) {
        const ownsShoe = db.prepare('SELECT id FROM shoes WHERE id = ? AND user_id = ?').get(shoe_id, req.user.id);
        if (!ownsShoe) {
          return res.status(400).json({ error: 'shoe_id inválido ou não pertence ao usuário' });
        }
        effectiveShoeId = shoe_id;
      }

      const id = uuidv4();
      const activityDate = date || new Date().toISOString();

      // Get daily status for display
      const todayStr = activityDate.split('T')[0];
      const dailyStatus = db.prepare('SELECT status FROM daily_status WHERE user_id = ? AND date = ?').get(req.user.id, todayStr);

      const createActivity = db.transaction(() => {
        db.prepare(`
          INSERT INTO activities (
            id, user_id, type, title, date, distance_km, duration_seconds,
            avg_pace, avg_hr, max_hr, calories, elevation_gain, rpe, rpe_score,
            feeling_notes, workout_rating, image_url, hrv_status_display, description, privacy, session_id, shoe_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, req.user.id, type, title ? String(title).trim() : `${type === 'run' ? 'Corrida' : type} de ${numDist} km`,
          activityDate, numDist, numDuration,
          avg_pace ? String(avg_pace).trim() : null, numAvgHr, numMaxHr,
          calories != null ? Number(calories) : null, elevation_gain != null ? Number(elevation_gain) : null,
          numRpe, numRpe, feeling_notes ? String(feeling_notes).trim() : null,
          workout_rating != null ? Number(workout_rating) : null,
          image_url ? String(image_url).trim() : null,
          dailyStatus?.status || null, description ? String(description).trim() : null, privacySetting, session_id || null, effectiveShoeId
        );

        // Create splits if provided
        if (splits && Array.isArray(splits)) {
          const insertSplit = db.prepare(`
            INSERT INTO activity_splits (id, activity_id, split_number, distance_km, duration_seconds, avg_pace, avg_hr, elevation_gain)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);

          for (const split of splits) {
            insertSplit.run(
              uuidv4(), id, split.split_number || 1, split.distance_km != null ? Number(split.distance_km) : null,
              split.duration_seconds != null ? Number(split.duration_seconds) : null, split.avg_pace || null,
              split.avg_hr != null ? Number(split.avg_hr) : null, split.elevation_gain != null ? Number(split.elevation_gain) : null
            );
          }
        }

        // Check achievements
        checkAndAwardAchievements(db, req.user.id, numDist, type);
      });

      createActivity();

      const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
      const activitySplits = db.prepare('SELECT * FROM activity_splits WHERE activity_id = ? ORDER BY split_number').all(id);

      res.status(201).json({ activity, splits: activitySplits });
    } catch (err) {
      console.error('Create activity error:', err);
      res.status(500).json({ error: 'Erro ao criar atividade' });
    }
  });

  // -------------------------------------------------------
  // GET /api/activities — Listar atividades do usuário
  // -------------------------------------------------------
  router.get('/', authenticate, (req, res) => {
    try {
      const { page = 1, limit = 20, type } = req.query;
      const parsedPage = Math.max(1, parseInt(page, 10) || 1);
      const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (parsedPage - 1) * parsedLimit;

      let query = 'SELECT * FROM activities WHERE user_id = ?';
      const params = [req.user.id];

      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }

      query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
      params.push(parsedLimit, offset);

      const activities = db.prepare(query).all(...params);
      const total = db.prepare('SELECT COUNT(*) as count FROM activities WHERE user_id = ?').get(req.user.id);

      // Get likes/comments count for each
      const enriched = activities.map(a => {
        const likes = db.prepare('SELECT COUNT(*) as count FROM likes WHERE activity_id = ?').get(a.id);
        const comments = db.prepare('SELECT COUNT(*) as count FROM comments WHERE activity_id = ?').get(a.id);
        return { ...a, likes_count: likes.count, comments_count: comments.count };
      });

      res.json({
        activities: enriched,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total: total.count,
          pages: Math.ceil(total.count / parsedLimit),
        }
      });
    } catch (err) {
      console.error('Get activities error:', err);
      res.status(500).json({ error: 'Erro ao buscar atividades' });
    }
  });

  // -------------------------------------------------------
  // GET /api/activities/stats/summary — Estatísticas
  // (MUST be defined BEFORE /:id to avoid Express matching
  //  "stats" as an :id parameter)
  // -------------------------------------------------------
  router.get('/stats/summary', authenticate, (req, res) => {
    try {
      const parsedDays = parseInt(req.query.days, 10);
      const days = (!isNaN(parsedDays) && parsedDays > 0 && parsedDays <= 365) ? parsedDays : 30;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const stats = db.prepare(`
        SELECT
          COUNT(*) as total_activities,
          COALESCE(SUM(distance_km), 0) as total_distance_km,
          COALESCE(SUM(duration_seconds), 0) as total_duration_seconds,
          COALESCE(AVG(distance_km), 0) as avg_distance_km,
          COALESCE(AVG(duration_seconds), 0) as avg_duration_seconds,
          COALESCE(AVG(avg_hr), 0) as avg_hr,
          COALESCE(MAX(distance_km), 0) as max_distance_km
        FROM activities
        WHERE user_id = ? AND date >= ?
      `).get(req.user.id, startDate);

      const byType = db.prepare(`
        SELECT type, COUNT(*) as count, SUM(distance_km) as total_km
        FROM activities
        WHERE user_id = ? AND date >= ?
        GROUP BY type
      `).all(req.user.id, startDate);

      const weeklyDistances = db.prepare(`
        SELECT
          strftime('%Y-W%W', date) as week,
          SUM(distance_km) as total_km,
          COUNT(*) as activities
        FROM activities
        WHERE user_id = ? AND date >= ?
        GROUP BY strftime('%Y-W%W', date)
        ORDER BY week
      `).all(req.user.id, startDate);

      res.json({
        period_days: days,
        stats: {
          ...stats,
          total_distance_km: +stats.total_distance_km.toFixed(1),
          avg_distance_km: +stats.avg_distance_km.toFixed(1),
          total_hours: +(stats.total_duration_seconds / 3600).toFixed(1),
        },
        by_type: byType,
        weekly: weeklyDistances,
      });
    } catch (err) {
      console.error('Get stats summary error:', err);
      res.status(500).json({ error: 'Erro ao buscar estatísticas de atividades' });
    }
  });

  // -------------------------------------------------------
  // GET /api/activities/records — Recordes pessoais (5/10/21/42 km)
  // -------------------------------------------------------
  // Uma atividade conta para uma distância oficial quando percorre pelo
  // menos aquela distância, com tolerância superior (ex.: 21.10 km conta
  // como meia-maratona; 25 km não). O tempo é normalizado para a distância
  // oficial pelo pace médio, que é a convenção usada por apps de corrida.
  router.get('/records', authenticate, (req, res) => {
    try {
      const DISTANCES = [
        { key: '5k', officialKm: 5, maxKm: 6.5 },
        { key: '10k', officialKm: 10, maxKm: 12.5 },
        { key: '21k', officialKm: 21.0975, maxKm: 24 },
        { key: '42k', officialKm: 42.195, maxKm: 47 },
      ];

      const records = {};

      for (const dist of DISTANCES) {
        const best = db.prepare(`
          SELECT id, title, date, distance_km, duration_seconds,
                 (duration_seconds * 1.0 / distance_km) as pace_seconds_per_km
          FROM activities
          WHERE user_id = ? AND type = 'run'
            AND distance_km >= ? AND distance_km <= ?
          ORDER BY pace_seconds_per_km ASC
          LIMIT 1
        `).get(req.user.id, dist.officialKm, dist.maxKm);

        if (!best) {
          records[dist.key] = null;
          continue;
        }

        const normalizedSeconds = Math.round(best.pace_seconds_per_km * dist.officialKm);
        records[dist.key] = {
          activity_id: best.id,
          title: best.title,
          date: best.date,
          distance_km: best.distance_km,
          duration_seconds: normalizedSeconds,
          formatted: formatDuration(normalizedSeconds),
          avg_pace: formatPaceFromSeconds(best.pace_seconds_per_km),
        };
      }

      res.json({ records });
    } catch (err) {
      console.error('Get records error:', err);
      res.status(500).json({ error: 'Erro ao calcular recordes pessoais' });
    }
  });

  // -------------------------------------------------------
  // GET /api/activities/:id — Detalhes da atividade
  // -------------------------------------------------------
  router.get('/:id', authenticate, (req, res) => {
    try {
      const activity = db.prepare(`
        SELECT a.*, up.name as user_name, up.username, up.avatar_url
        FROM activities a
        JOIN user_profiles up ON up.user_id = a.user_id
        WHERE a.id = ?
      `).get(req.params.id);

      if (!activity) {
        return res.status(404).json({ error: 'Atividade não encontrada' });
      }

      // Check privacy
      if (activity.user_id !== req.user.id && activity.privacy === 'private') {
        return res.status(403).json({ error: 'Atividade privada' });
      }

      if (activity.user_id !== req.user.id && activity.privacy === 'followers') {
        const isFollower = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?').get(req.user.id, activity.user_id);
        if (!isFollower) {
          return res.status(403).json({ error: 'Apenas seguidores podem ver esta atividade' });
        }
      }

      const splits = db.prepare('SELECT * FROM activity_splits WHERE activity_id = ? ORDER BY split_number').all(activity.id);
      const likes = db.prepare(`
        SELECT l.*, up.name, up.username FROM likes l
        JOIN user_profiles up ON up.user_id = l.user_id
        WHERE l.activity_id = ?
      `).all(activity.id);
      const comments = db.prepare(`
        SELECT c.*, up.name, up.username, up.avatar_url FROM comments c
        JOIN user_profiles up ON up.user_id = c.user_id
        WHERE c.activity_id = ?
        ORDER BY c.created_at ASC
      `).all(activity.id);

      const hasLiked = db.prepare('SELECT 1 FROM likes WHERE activity_id = ? AND user_id = ?').get(activity.id, req.user.id);

      res.json({
        activity,
        splits,
        likes: { count: likes.length, users: likes.slice(0, 10), has_liked: !!hasLiked },
        comments: { count: comments.length, items: comments },
      });
    } catch (err) {
      console.error('Get activity details error:', err);
      res.status(500).json({ error: 'Erro ao buscar detalhes da atividade' });
    }
  });

  // -------------------------------------------------------
  // PUT /api/activities/:id — Editar atividade (legenda, foto, privacidade)
  // -------------------------------------------------------
  router.put('/:id', authenticate, (req, res) => {
    try {
      const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
      if (!activity) {
        return res.status(404).json({ error: 'Atividade não encontrada' });
      }
      if (activity.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Sem permissão para editar esta atividade' });
      }

      const { title, description, feeling_notes, image_url, privacy, rpe_score, workout_rating, shoe_id } = req.body;
      const fields = [];
      const values = [];

      if (title !== undefined) { fields.push('title = ?'); values.push(title ? String(title).trim().slice(0, 120) : null); }
      if (description !== undefined) { fields.push('description = ?'); values.push(description ? String(description).trim().slice(0, 2000) : null); }
      if (feeling_notes !== undefined) { fields.push('feeling_notes = ?'); values.push(feeling_notes ? String(feeling_notes).trim().slice(0, 2000) : null); }
      if (image_url !== undefined) { fields.push('image_url = ?'); values.push(image_url ? String(image_url).trim() : null); }

      if (privacy !== undefined) {
        if (!VALID_PRIVACY_LEVELS.includes(privacy)) {
          return res.status(400).json({ error: `privacy inválido. Valores aceitos: ${VALID_PRIVACY_LEVELS.join(', ')}` });
        }
        fields.push('privacy = ?'); values.push(privacy);
      }

      if (rpe_score !== undefined && rpe_score !== null) {
        const numRpe = Number(rpe_score);
        if (isNaN(numRpe) || numRpe < 1 || numRpe > 10) {
          return res.status(400).json({ error: 'rpe_score deve ser um número entre 1 e 10' });
        }
        fields.push('rpe_score = ?'); values.push(numRpe);
        fields.push('rpe = ?'); values.push(numRpe);
      }

      if (workout_rating !== undefined && workout_rating !== null) {
        const numRating = Number(workout_rating);
        if (isNaN(numRating) || numRating < 1 || numRating > 5) {
          return res.status(400).json({ error: 'workout_rating deve ser um número entre 1 e 5' });
        }
        fields.push('workout_rating = ?'); values.push(numRating);
      }

      if (shoe_id !== undefined) {
        if (shoe_id === null || shoe_id === '') {
          fields.push('shoe_id = ?'); values.push(null);
        } else {
          const ownsShoe = db.prepare('SELECT id FROM shoes WHERE id = ? AND user_id = ?').get(shoe_id, req.user.id);
          if (!ownsShoe) {
            return res.status(400).json({ error: 'shoe_id inválido ou não pertence ao usuário' });
          }
          fields.push('shoe_id = ?'); values.push(shoe_id);
        }
      }

      if (!fields.length) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar' });
      }

      values.push(req.params.id);
      db.prepare(`UPDATE activities SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);

      const updated = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
      res.json({ activity: updated });
    } catch (err) {
      console.error('Update activity error:', err);
      res.status(500).json({ error: 'Erro ao atualizar atividade' });
    }
  });

  // -------------------------------------------------------
  // DELETE /api/activities/:id
  // -------------------------------------------------------
  router.delete('/:id', authenticate, (req, res) => {
    try {
      const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
      if (!activity) {
        return res.status(404).json({ error: 'Atividade não encontrada' });
      }

      if (activity.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({ error: 'Sem permissão para remover esta atividade' });
      }

      db.prepare('DELETE FROM activities WHERE id = ?').run(req.params.id);
      res.json({ message: 'Atividade removida com sucesso' });
    } catch (err) {
      console.error('Delete activity error:', err);
      res.status(500).json({ error: 'Erro ao remover atividade' });
    }
  });

  return router;
};

// ============================================================
// Helper: Check and award achievements
// ============================================================
function checkAndAwardAchievements(db, userId, distanceKm, type) {
  const achievements = db.prepare('SELECT * FROM achievements').all();
  const earned = db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?').all(userId);
  const earnedIds = new Set(earned.map(e => e.achievement_id));

  for (const ach of achievements) {
    if (earnedIds.has(ach.id)) continue;

    const criteria = JSON.parse(ach.criteria_json);

    // Single distance achievement
    if (criteria.distance_km && distanceKm >= criteria.distance_km) {
      awardAchievement(db, userId, ach.id, ach.name);
    }

    // Accumulated distance (30 days)
    if (criteria.distance_km_30d) {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const total = db.prepare('SELECT COALESCE(SUM(distance_km), 0) as total FROM activities WHERE user_id = ? AND date >= ?').get(userId, startDate);
      if (total.total >= criteria.distance_km_30d) {
        awardAchievement(db, userId, ach.id, ach.name);
      }
    }

    // Completed workouts
    if (criteria.completed_workouts) {
      const count = db.prepare('SELECT COUNT(*) as count FROM activities WHERE user_id = ? AND session_id IS NOT NULL').get(userId);
      if (count.count >= criteria.completed_workouts) {
        awardAchievement(db, userId, ach.id, ach.name);
      }
    }
  }
}

/**
 * Formata segundos em "h:mm:ss" ou "mm:ss".
 */
function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const sec = totalSeconds % 60;
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/**
 * Formata segundos por km em "m:ss/km".
 */
function formatPaceFromSeconds(secondsPerKm) {
  if (!secondsPerKm || !isFinite(secondsPerKm)) return null;
  const m = Math.floor(secondsPerKm / 60);
  const sec = Math.round(secondsPerKm % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}/km`;
}

function awardAchievement(db, userId, achievementId, achievementName) {
  try {
    db.prepare('INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)').run(userId, achievementId);
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, message)
      VALUES (?, ?, 'achievement', ?)
    `).run(uuidv4(), userId, `🏆 Nova conquista desbloqueada: ${achievementName}!`);
  } catch (e) {
    // Already earned, ignore
  }
}
