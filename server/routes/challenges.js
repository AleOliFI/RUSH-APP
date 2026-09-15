// ============================================================
// RUSH PERFORMANCE — Challenges Routes
// ============================================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');
const { criarNotificacao } = require('../services/notificacoes');

module.exports = function challengesRoutes(db) {
  const router = express.Router();

  const VALID_CHALLENGE_TYPES = ['distance', 'consistency', 'elevation', 'pace', 'time'];

  // -------------------------------------------------------
  // GET /api/challenges — Listar desafios
  // -------------------------------------------------------
  router.get('/', authenticate, async (req, res) => {
    try {
      const { status = 'active' } = req.query;
      const today = new Date().toISOString().split('T')[0];

      let challenges;
      if (status === 'active') {
        challenges = await db.prepare(`
          SELECT c.*, up.name as creator_name,
            (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id) as participants_count
          FROM challenges c
          LEFT JOIN user_profiles up ON up.user_id = c.created_by
          WHERE c.end_date >= ?
          ORDER BY c.start_date DESC
        `).all(today);
      } else {
        challenges = await db.prepare(`
          SELECT c.*, up.name as creator_name,
            (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id) as participants_count
          FROM challenges c
          LEFT JOIN user_profiles up ON up.user_id = c.created_by
          WHERE c.end_date < ?
          ORDER BY c.end_date DESC LIMIT 50
        `).all(today);
      }

      // Check participation
      const enriched = await Promise.all(challenges.map(async (c) => {
        const participation = await db.prepare('SELECT * FROM challenge_participants WHERE challenge_id = ? AND user_id = ?').get(c.id, req.user.id);
        return {
          ...c,
          is_participating: !!participation,
          my_progress: participation?.progress_value || 0,
          my_status: participation?.status || null,
          progress_pct: (participation && c.target_value > 0) ? +((participation.progress_value / c.target_value) * 100).toFixed(1) : 0,
        };
      }));

      res.json({ challenges: enriched });
    } catch (err) {
      console.error('Get challenges error:', err);
      res.status(500).json({ error: 'Erro ao buscar desafios' });
    }
  });

  // -------------------------------------------------------
  // POST /api/challenges — Criar desafio
  // -------------------------------------------------------
  router.post('/', authenticate, authorize('coach', 'owner', 'admin'), async (req, res) => {
    try {
      const { name, description, type, target_value, target_unit, start_date, end_date } = req.body;

      if (!name || !type || target_value == null || !target_unit || !start_date || !end_date) {
        return res.status(400).json({ error: 'Campos obrigatórios: name, type, target_value, target_unit, start_date, end_date' });
      }

      if (!VALID_CHALLENGE_TYPES.includes(type)) {
        return res.status(400).json({ error: `type deve ser um dos seguintes: ${VALID_CHALLENGE_TYPES.join(', ')}` });
      }

      const numTarget = Number(target_value);
      if (isNaN(numTarget) || numTarget <= 0) {
        return res.status(400).json({ error: 'target_value deve ser um número positivo' });
      }

      const startDateObj = new Date(start_date);
      const endDateObj = new Date(end_date);
      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        return res.status(400).json({ error: 'start_date e end_date devem ser datas válidas' });
      }

      if (endDateObj < startDateObj) {
        return res.status(400).json({ error: 'end_date deve ser posterior ou igual a start_date' });
      }

      const id = uuidv4();
      const formattedStartDate = startDateObj.toISOString().split('T')[0];
      const formattedEndDate = endDateObj.toISOString().split('T')[0];

      await db.prepare(`
        INSERT INTO challenges (id, name, description, type, target_value, target_unit, start_date, end_date, academy_id, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, String(name).trim(), description ? String(description).trim() : '', type, numTarget, String(target_unit).trim(), formattedStartDate, formattedEndDate, req.user.academy_id || null, req.user.id);

      const challenge = await db.prepare('SELECT * FROM challenges WHERE id = ?').get(id);
      res.status(201).json(challenge);
    } catch (err) {
      console.error('Create challenge error:', err);
      res.status(500).json({ error: 'Erro ao criar desafio' });
    }
  });

  // -------------------------------------------------------
  // POST /api/challenges/:id/join — Participar
  // -------------------------------------------------------
  router.post('/:id/join', authenticate, async (req, res) => {
    try {
      const challengeId = req.params.id;
      if (!challengeId) {
        return res.status(400).json({ error: 'ID do desafio obrigatório' });
      }

      const challenge = await db.prepare('SELECT * FROM challenges WHERE id = ?').get(challengeId);
      if (!challenge) {
        return res.status(404).json({ error: 'Desafio não encontrado' });
      }

      const today = new Date().toISOString().split('T')[0];
      if (challenge.end_date < today) {
        return res.status(400).json({ error: 'Este desafio já encerrou' });
      }

      const existing = await db.prepare('SELECT 1 FROM challenge_participants WHERE challenge_id = ? AND user_id = ?').get(challenge.id, req.user.id);
      if (existing) {
        return res.status(409).json({ error: 'Você já participa deste desafio' });
      }

      await db.prepare(`
        INSERT INTO challenge_participants (challenge_id, user_id, progress_value, status)
        VALUES (?, ?, 0, 'active')
      `).run(challenge.id, req.user.id);

      res.json({ message: 'Participação confirmada', challenge });
    } catch (err) {
      console.error('Join challenge error:', err);
      res.status(500).json({ error: 'Erro ao participar do desafio' });
    }
  });

  // -------------------------------------------------------
  // GET /api/challenges/:id/leaderboard — Ranking
  // -------------------------------------------------------
  router.get('/:id/leaderboard', authenticate, async (req, res) => {
    try {
      const challengeId = req.params.id;
      if (!challengeId) {
        return res.status(400).json({ error: 'ID do desafio obrigatório' });
      }

      const challenge = await db.prepare('SELECT * FROM challenges WHERE id = ?').get(challengeId);
      if (!challenge) {
        return res.status(404).json({ error: 'Desafio não encontrado' });
      }

      const leaderboard = await db.prepare(`
        SELECT cp.*, up.name, up.username, up.avatar_url
        FROM challenge_participants cp
        JOIN user_profiles up ON up.user_id = cp.user_id
        WHERE cp.challenge_id = ?
        ORDER BY cp.progress_value DESC
      `).all(challengeId);

      const ranked = leaderboard.map((p, idx) => ({
        ...p,
        rank: idx + 1,
        progress_pct: challenge.target_value > 0 ? +((p.progress_value / challenge.target_value) * 100).toFixed(1) : 0,
        is_me: p.user_id === req.user.id,
      }));

      res.json({ challenge, leaderboard: ranked });
    } catch (err) {
      console.error('Get leaderboard error:', err);
      res.status(500).json({ error: 'Erro ao buscar ranking do desafio' });
    }
  });

  // -------------------------------------------------------
  // POST /api/challenges/:id/update-progress — Atualizar progresso
  // -------------------------------------------------------
  router.post('/:id/update-progress', authenticate, async (req, res) => {
    try {
      const { progress_value } = req.body;
      const challengeId = req.params.id;

      if (!challengeId) {
        return res.status(400).json({ error: 'ID do desafio obrigatório' });
      }

      if (progress_value == null) {
        return res.status(400).json({ error: 'progress_value é obrigatório' });
      }

      const numProgress = Number(progress_value);
      if (isNaN(numProgress) || numProgress < 0) {
        return res.status(400).json({ error: 'progress_value deve ser um número não-negativo' });
      }

      const challenge = await db.prepare('SELECT * FROM challenges WHERE id = ?').get(challengeId);
      if (!challenge) {
        return res.status(404).json({ error: 'Desafio não encontrado' });
      }

      const participant = await db.prepare('SELECT * FROM challenge_participants WHERE challenge_id = ? AND user_id = ?').get(challengeId, req.user.id);
      if (!participant) {
        return res.status(403).json({ error: 'Você não participa deste desafio' });
      }

      const newStatus = numProgress >= challenge.target_value ? 'completed' : 'active';
      const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;

      await db.prepare(`
        UPDATE challenge_participants SET progress_value = ?, status = ?, completed_at = ?
        WHERE challenge_id = ? AND user_id = ?
      `).run(numProgress, newStatus, completedAt, challengeId, req.user.id);

      if (newStatus === 'completed' && participant.status !== 'completed') {
        await criarNotificacao(db, {
          userId: req.user.id,
          type: 'challenge',
          message: `🎉 Parabéns! Você completou o desafio "${challenge.name}"!`,
        });
      }

      res.json({ progress_value: numProgress, status: newStatus, completed: newStatus === 'completed' });
    } catch (err) {
      console.error('Update challenge progress error:', err);
      res.status(500).json({ error: 'Erro ao atualizar progresso do desafio' });
    }
  });

  // -------------------------------------------------------
  // GET /api/challenges/achievements/my — Conquistas do usuário
  // -------------------------------------------------------
  router.get('/achievements/my', authenticate, async (req, res) => {
    try {
      const earned = await db.prepare(`
        SELECT a.*, ua.earned_at, ua.is_viewed
        FROM user_achievements ua
        JOIN achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = ?
        ORDER BY ua.earned_at DESC
      `).all(req.user.id);

      const allAchievements = await db.prepare('SELECT * FROM achievements').all();

      // Mark as viewed
      await db.prepare("UPDATE user_achievements SET is_viewed = 1 WHERE user_id = ? AND is_viewed = 0").run(req.user.id);

      res.json({
        earned,
        all: allAchievements,
        total_earned: earned.length,
        total_available: allAchievements.length,
      });
    } catch (err) {
      console.error('Get achievements error:', err);
      res.status(500).json({ error: 'Erro ao buscar conquistas' });
    }
  });

  return router;
};
