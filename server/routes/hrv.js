// ============================================================
// RUSH PERFORMANCE — HRV & Wellness Routes
// ============================================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { generateTrainingSuggestion, calculateLnRmssd, calculateStats } = require('../agent/trainingAgent');

module.exports = function hrvRoutes(db) {
  const router = express.Router();

  /**
   * Helper function to recalculate and persist daily status for a given user and date.
   */
  function recalculateDailyStatus(userId, todayDate) {
    const todayStr = todayDate || new Date().toISOString().split('T')[0];

    // Find today's latest measurement
    const measurement = db.prepare(`
      SELECT * FROM hrv_measurements
      WHERE user_id = ? AND timestamp >= ?
      ORDER BY timestamp DESC LIMIT 1
    `).get(userId, todayStr);

    if (!measurement) return null;

    // Calculate 7-day rolling baseline (excluding today)
    const sevenDaysAgo = new Date(new Date(todayStr).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const recentMeasurements = db.prepare(`
      SELECT lnrmssd FROM hrv_measurements
      WHERE user_id = ? AND timestamp >= ? AND timestamp < ?
      ORDER BY timestamp DESC
    `).all(userId, sevenDaysAgo, todayStr);

    const lnValues = recentMeasurements.map(m => m.lnrmssd);
    let stats = calculateStats(lnValues);

    // Day-1 / Initializing baseline flow: fallback to today's measurement if no 7d history
    if (stats.mean === 0 || lnValues.length === 0) {
      stats = { mean: measurement.lnrmssd, sd: 0.08 };
    }

    // Today's wellness scores
    const wellness = db.prepare('SELECT * FROM wellness_scores WHERE user_id = ? AND date = ?').get(userId, todayStr);
    const wellnessData = wellness
      ? { sleep: wellness.sleep, fatigue: wellness.fatigue, soreness: wellness.soreness, stress: wellness.stress, readiness: wellness.readiness }
      : { sleep: 3, fatigue: 3, soreness: 3, stress: 3, readiness: 3 };

    // Today's active plan & session
    const assignedPlan = db.prepare(`
      SELECT ap.*, tp.duration_weeks FROM assigned_plans ap
      JOIN training_plans tp ON tp.id = ap.plan_id
      WHERE ap.user_id = ? AND ap.status = 'active'
      ORDER BY ap.created_at DESC LIMIT 1
    `).get(userId);

    let plannedSession = null;
    let weeksToRace = null;

    if (assignedPlan) {
      const dayOfWeek = new Date(todayStr).getDay() || 7; // 1=Mon, 7=Sun
      plannedSession = db.prepare(`
        SELECT * FROM training_sessions
        WHERE plan_id = ? AND week_number = ? AND day_of_week = ?
      `).get(assignedPlan.plan_id, assignedPlan.current_week, dayOfWeek);

      const objectives = db.prepare('SELECT * FROM user_objectives WHERE user_id = ?').get(userId);
      if (objectives?.target_race_date) {
        const raceDate = new Date(objectives.target_race_date);
        const todayDateObj = new Date(todayStr);
        weeksToRace = Math.max(0, Math.ceil((raceDate - todayDateObj) / (7 * 24 * 60 * 60 * 1000)));
      }
    }

    const defaultSession = plannedSession || {
      type: 'easy_run', distance_km: 8, duration_min: 45,
      target_pace: null, target_hr_zone: 'Z2', is_fixed: false
    };

    const suggestion = generateTrainingSuggestion({
      lnrmssdToday: measurement.lnrmssd,
      lnrmssd7dMean: stats.mean,
      lnrmssd7dSd: stats.sd || 0.05,
      wellnessScores: wellnessData,
      plannedSession: defaultSession,
      weeksToRace,
    });

    const statusId = uuidv4();
    db.prepare(`
      INSERT INTO daily_status (id, user_id, date, status, lnrmssd, lnrmssd_7d_mean, lnrmssd_7d_sd, wellness_summary, reason_code, suggested_action, explanation_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET
        status = excluded.status,
        lnrmssd = excluded.lnrmssd,
        lnrmssd_7d_mean = excluded.lnrmssd_7d_mean,
        lnrmssd_7d_sd = excluded.lnrmssd_7d_sd,
        wellness_summary = excluded.wellness_summary,
        reason_code = excluded.reason_code,
        suggested_action = excluded.suggested_action,
        explanation_text = excluded.explanation_text
    `).run(
      statusId, userId, todayStr, suggestion.status, measurement.lnrmssd,
      stats.mean, stats.sd || 0.05,
      JSON.stringify(wellnessData), suggestion.reason_code,
      suggestion.action, suggestion.explanation_text
    );

    return { suggestion, stats, lnValuesCount: lnValues.length };
  }

  // -------------------------------------------------------
  // POST /api/hrv/measurement — Registrar medição de VFC
  // -------------------------------------------------------
  router.post('/measurement', authenticate, (req, res) => {
    try {
      const { rmssd_ms, hr_rest_bpm, duration_seconds, device_id, timestamp } = req.body;

      if (!rmssd_ms || !hr_rest_bpm || !duration_seconds) {
        return res.status(400).json({ error: 'rmssd_ms, hr_rest_bpm e duration_seconds são obrigatórios' });
      }

      const numRmssd = Number(rmssd_ms);
      const numHrRest = Number(hr_rest_bpm);
      const numDuration = Number(duration_seconds);

      if (isNaN(numRmssd) || numRmssd < 10 || numRmssd > 200) {
        return res.status(400).json({ error: 'RMSSD deve ser um número entre 10 e 200 ms' });
      }

      if (isNaN(numHrRest) || numHrRest < 30 || numHrRest > 120) {
        return res.status(400).json({ error: 'FC de repouso deve ser um número entre 30 e 120 bpm' });
      }

      if (isNaN(numDuration) || numDuration < 60) {
        return res.status(400).json({ error: 'Duração da medição deve ser de pelo menos 60 segundos' });
      }

      const id = uuidv4();
      const lnrmssd = calculateLnRmssd(numRmssd);
      const ts = timestamp || new Date().toISOString();
      const today = ts.split('T')[0];

      db.prepare(`
        INSERT INTO hrv_measurements (id, user_id, timestamp, rmssd_ms, lnrmssd, hr_rest_bpm, device_id, duration_seconds)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, req.user.id, ts, numRmssd, lnrmssd, numHrRest, device_id || null, numDuration);

      // Recalculate daily status (handles Day-1 and established baselines)
      const statusCalculation = recalculateDailyStatus(req.user.id, today);

      res.status(201).json({
        measurement: {
          id,
          rmssd_ms: numRmssd,
          lnrmssd: +lnrmssd.toFixed(4),
          hr_rest_bpm: numHrRest,
          duration_seconds: numDuration,
          timestamp: ts,
        },
        daily_status: statusCalculation?.suggestion || null,
        stats_7d: {
          mean: +(statusCalculation?.stats.mean || lnrmssd).toFixed(4),
          sd: +(statusCalculation?.stats.sd || 0.08).toFixed(4),
          sample_size: statusCalculation?.lnValuesCount || 0,
          is_baseline_learning: (statusCalculation?.lnValuesCount || 0) === 0
        }
      });
    } catch (err) {
      console.error('HRV measurement error:', err);
      res.status(500).json({ error: 'Erro ao registrar medição de VFC' });
    }
  });

  // -------------------------------------------------------
  // POST /api/hrv/wellness — Registrar bem-estar
  // -------------------------------------------------------
  router.post('/wellness', authenticate, (req, res) => {
    try {
      const { sleep, fatigue, soreness, stress, readiness, date } = req.body;

      if (sleep == null || fatigue == null || soreness == null || stress == null || readiness == null) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios: sleep, fatigue, soreness, stress, readiness (1-5)' });
      }

      const numSleep = Number(sleep);
      const numFatigue = Number(fatigue);
      const numSoreness = Number(soreness);
      const numStress = Number(stress);
      const numReadiness = Number(readiness);

      const values = [numSleep, numFatigue, numSoreness, numStress, numReadiness];
      if (values.some(v => isNaN(v) || v < 1 || v > 5)) {
        return res.status(400).json({ error: 'Valores da escala de bem-estar devem estar entre 1 e 5' });
      }

      const today = date || new Date().toISOString().split('T')[0];
      const id = uuidv4();

      db.prepare(`
        INSERT INTO wellness_scores (id, user_id, date, sleep, fatigue, soreness, stress, readiness)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, date) DO UPDATE SET
          sleep = excluded.sleep,
          fatigue = excluded.fatigue,
          soreness = excluded.soreness,
          stress = excluded.stress,
          readiness = excluded.readiness
      `).run(id, req.user.id, today, numSleep, numFatigue, numSoreness, numStress, numReadiness);

      // If a measurement exists today, update daily status dynamically
      recalculateDailyStatus(req.user.id, today);

      const score = db.prepare('SELECT * FROM wellness_scores WHERE user_id = ? AND date = ?').get(req.user.id, today);

      res.status(201).json(score);
    } catch (err) {
      console.error('Wellness error:', err);
      res.status(500).json({ error: 'Erro ao registrar bem-estar' });
    }
  });

  // -------------------------------------------------------
  // GET /api/hrv/status — Status do dia
  // -------------------------------------------------------
  router.get('/status', authenticate, (req, res) => {
    try {
      const today = req.query.date || new Date().toISOString().split('T')[0];

      let status = db.prepare('SELECT * FROM daily_status WHERE user_id = ? AND date = ?').get(req.user.id, today);
      const wellness = db.prepare('SELECT * FROM wellness_scores WHERE user_id = ? AND date = ?').get(req.user.id, today);
      const measurement = db.prepare(`
        SELECT * FROM hrv_measurements WHERE user_id = ? AND timestamp >= ? ORDER BY timestamp DESC LIMIT 1
      `).get(req.user.id, today);

      // If measurement exists but daily_status is missing, compute it now
      if (measurement && !status) {
        recalculateDailyStatus(req.user.id, today);
        status = db.prepare('SELECT * FROM daily_status WHERE user_id = ? AND date = ?').get(req.user.id, today);
      }

      res.json({
        date: today,
        status: status || null,
        wellness: wellness || null,
        measurement: measurement || null,
        has_measured_today: !!measurement,
        has_wellness_today: !!wellness,
      });
    } catch (err) {
      console.error('Get status error:', err);
      res.status(500).json({ error: 'Erro ao obter status diário' });
    }
  });

  // -------------------------------------------------------
  // GET /api/hrv/history — Histórico de VFC
  // -------------------------------------------------------
  router.get('/history', authenticate, (req, res) => {
    try {
      const parsedDays = parseInt(req.query.days, 10);
      const days = (!isNaN(parsedDays) && parsedDays > 0 && parsedDays <= 365) ? parsedDays : 30;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const startDateStr = startDate.split('T')[0];

      const measurements = db.prepare(`
        SELECT * FROM hrv_measurements
        WHERE user_id = ? AND timestamp >= ?
        ORDER BY timestamp DESC
      `).all(req.user.id, startDate);

      const statuses = db.prepare(`
        SELECT * FROM daily_status
        WHERE user_id = ? AND date >= ?
        ORDER BY date DESC
      `).all(req.user.id, startDateStr);

      const wellnessScores = db.prepare(`
        SELECT * FROM wellness_scores
        WHERE user_id = ? AND date >= ?
        ORDER BY date DESC
      `).all(req.user.id, startDateStr);

      res.json({
        measurements,
        statuses,
        wellness_scores: wellnessScores,
        total_measurements: measurements.length,
        days_range: days,
      });
    } catch (err) {
      console.error('Get history error:', err);
      res.status(500).json({ error: 'Erro ao buscar histórico de VFC' });
    }
  });

  // -------------------------------------------------------
  // GET /api/hrv/vo2max — Histórico de VO2max
  // -------------------------------------------------------
  router.get('/vo2max', authenticate, (req, res) => {
    try {
      const estimates = db.prepare(`
        SELECT * FROM vo2max_estimates WHERE user_id = ? ORDER BY date DESC LIMIT 20
      `).all(req.user.id);

      res.json({ estimates });
    } catch (err) {
      console.error('Get VO2max error:', err);
      res.status(500).json({ error: 'Erro ao buscar estimativas de VO2max' });
    }
  });

  // -------------------------------------------------------
  // POST /api/hrv/vo2max — Registrar VO2max
  // -------------------------------------------------------
  router.post('/vo2max', authenticate, (req, res) => {
    try {
      const { vo2max_value, method, date, device_id, notes } = req.body;

      if (vo2max_value == null || !method) {
        return res.status(400).json({ error: 'vo2max_value e method são obrigatórios' });
      }

      const numVo2max = Number(vo2max_value);
      if (isNaN(numVo2max) || numVo2max < 20 || numVo2max > 100) {
        return res.status(400).json({ error: 'vo2max_value deve ser um número entre 20 e 100 ml/kg/min' });
      }

      const id = uuidv4();
      const today = date || new Date().toISOString().split('T')[0];

      db.prepare(`
        INSERT INTO vo2max_estimates (id, user_id, date, vo2max_value, method, device_id, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, req.user.id, today, numVo2max, String(method).trim(), device_id || null, notes || null);

      res.status(201).json({ id, vo2max_value: numVo2max, method: String(method).trim(), date: today });
    } catch (err) {
      console.error('Post VO2max error:', err);
      res.status(500).json({ error: 'Erro ao registrar estimativa de VO2max' });
    }
  });

  return router;
};
