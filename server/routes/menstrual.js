// ============================================================
// RUSH PERFORMANCE — Menstrual Cycle Routes
// ============================================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { getCyclePhase, getPhaseTrainingRecommendation, calcMenstrualSymptomScore } = require('../agent/menstrualModule');

module.exports = function menstrualRoutes(db) {
  const router = express.Router();

  // -------------------------------------------------------
  // POST /api/menstrual/profile — Salvar/atualizar perfil menstrual
  // -------------------------------------------------------
  router.post('/profile', authenticate, (req, res) => {
    try {
      const userId = req.user.id;
      const { lmp_date, cycle_length_days, uses_hormonal_contraceptive, contraceptive_type } = req.body;

      if (!lmp_date) {
        return res.status(400).json({ error: 'lmp_date (data do último período) é obrigatório' });
      }

      const safeCycleLength = Math.max(21, Math.min(35, Number(cycle_length_days) || 28));
      const safeContraceptive = uses_hormonal_contraceptive ? 1 : 0;

      db.prepare(`
        INSERT INTO user_menstrual_profile (user_id, lmp_date, cycle_length_days, uses_hormonal_contraceptive, contraceptive_type, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          lmp_date = excluded.lmp_date,
          cycle_length_days = excluded.cycle_length_days,
          uses_hormonal_contraceptive = excluded.uses_hormonal_contraceptive,
          contraceptive_type = excluded.contraceptive_type,
          updated_at = datetime('now')
      `).run(userId, lmp_date, safeCycleLength, safeContraceptive, contraceptive_type || null);

      const profile = db.prepare('SELECT * FROM user_menstrual_profile WHERE user_id = ?').get(userId);
      res.json({ success: true, profile });
    } catch (err) {
      console.error('Menstrual profile error:', err);
      res.status(500).json({ error: 'Erro ao salvar perfil menstrual' });
    }
  });

  // -------------------------------------------------------
  // GET /api/menstrual/profile — Obter perfil menstrual
  // -------------------------------------------------------
  router.get('/profile', authenticate, (req, res) => {
    try {
      const profile = db.prepare('SELECT * FROM user_menstrual_profile WHERE user_id = ?').get(req.user.id);
      res.json({ has_profile: !!profile, profile: profile || null });
    } catch (err) {
      console.error('Menstrual profile get error:', err);
      res.status(500).json({ error: 'Erro ao obter perfil menstrual' });
    }
  });

  // -------------------------------------------------------
  // POST /api/menstrual/tracking — Registrar sintomas diários
  // -------------------------------------------------------
  router.post('/tracking', authenticate, (req, res) => {
    try {
      const userId = req.user.id;
      const today = req.body.date || new Date().toISOString().split('T')[0];
      const { cramp_level = 0, bloating_level = 0, energy_level = 3, mood_level = 3, bleeding_intensity } = req.body;

      const profile = db.prepare('SELECT * FROM user_menstrual_profile WHERE user_id = ?').get(userId);
      const phase = profile?.lmp_date
        ? getCyclePhase(profile.lmp_date, profile.cycle_length_days, today)
        : 'follicular';

      const id = uuidv4();
      db.prepare(`
        INSERT INTO menstrual_tracking (id, user_id, date, phase, cramp_level, bloating_level, energy_level, mood_level, bleeding_intensity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, date) DO UPDATE SET
          phase = excluded.phase,
          cramp_level = excluded.cramp_level,
          bloating_level = excluded.bloating_level,
          energy_level = excluded.energy_level,
          mood_level = excluded.mood_level,
          bleeding_intensity = excluded.bleeding_intensity
      `).run(
        id, userId, today, phase,
        Math.max(0, Math.min(5, Number(cramp_level) || 0)),
        Math.max(0, Math.min(5, Number(bloating_level) || 0)),
        Math.max(0, Math.min(5, Number(energy_level) || 3)),
        Math.max(0, Math.min(5, Number(mood_level) || 3)),
        bleeding_intensity || null
      );

      const tracking = db.prepare('SELECT * FROM menstrual_tracking WHERE user_id = ? AND date = ?').get(userId, today);
      const symptomScore = calcMenstrualSymptomScore(tracking);
      const recommendation = getPhaseTrainingRecommendation(phase, 'favorable');

      res.status(201).json({ success: true, tracking, phase, symptom_score: symptomScore, recommendation });
    } catch (err) {
      console.error('Menstrual tracking error:', err);
      res.status(500).json({ error: 'Erro ao registrar tracking menstrual' });
    }
  });

  // -------------------------------------------------------
  // GET /api/menstrual/today — Dados da fase atual e recomendação
  // -------------------------------------------------------
  router.get('/today', authenticate, (req, res) => {
    try {
      const userId = req.user.id;
      const today = req.query.date || new Date().toISOString().split('T')[0];

      const profile = db.prepare('SELECT * FROM user_menstrual_profile WHERE user_id = ?').get(userId);
      if (!profile || !profile.lmp_date) {
        return res.json({ has_profile: false });
      }

      const phase = getCyclePhase(profile.lmp_date, profile.cycle_length_days, today);
      const tracking = db.prepare('SELECT * FROM menstrual_tracking WHERE user_id = ? AND date = ?').get(userId, today);
      const symptomScore = calcMenstrualSymptomScore(tracking);
      const recommendation = getPhaseTrainingRecommendation(phase, 'favorable');

      res.json({
        has_profile: true,
        phase,
        cycle_length_days: profile.cycle_length_days,
        uses_hormonal_contraceptive: !!profile.uses_hormonal_contraceptive,
        tracking: tracking || null,
        symptom_score: symptomScore,
        recommendation,
      });
    } catch (err) {
      console.error('Menstrual today error:', err);
      res.status(500).json({ error: 'Erro ao buscar dados do ciclo menstrual' });
    }
  });

  return router;
};
