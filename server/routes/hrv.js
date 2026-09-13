// ============================================================
// RUSH PERFORMANCE — HRV & Wellness Routes
// ============================================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { generateTrainingSuggestion, calculateLnRmssd, calculateStats } = require('../agent/trainingAgent');
const { getCyclePhase, calcMenstrualSymptomScore } = require('../agent/menstrualModule');

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

    // Calculate 28-day rolling baseline (excluding today) (Plews et al. 2013, Buchheit 2014)
    const twentyEightDaysAgo = new Date(new Date(todayStr).getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const recent28dMeasurements = db.prepare(`
      SELECT lnrmssd, hr_rest_bpm, rhr_bpm FROM hrv_measurements
      WHERE user_id = ? AND timestamp >= ? AND timestamp < ?
      ORDER BY timestamp DESC
    `).all(userId, twentyEightDaysAgo, todayStr);

    const lnValues28 = recent28dMeasurements.map(m => m.lnrmssd).filter(v => typeof v === 'number' && !isNaN(v));
    const rhrValues28 = recent28dMeasurements.map(m => m.rhr_bpm || m.hr_rest_bpm).filter(v => typeof v === 'number' && !isNaN(v));

    let stats28 = calculateStats(lnValues28);
    let rhrStats28 = calculateStats(rhrValues28);

    // Initializing baseline flow
    if (stats28.mean === 0 || lnValues28.length === 0) {
      stats28 = { mean: measurement.lnrmssd, sd: 0.08 };
    }

    const currentRhr = measurement.rhr_bpm || measurement.hr_rest_bpm;
    if (rhrStats28.mean === 0 || rhrValues28.length === 0) {
      rhrStats28 = { mean: currentRhr || 55, sd: 4 };
    }

    // Calculate 7-day rolling baseline for comparison
    const sevenDaysAgo = new Date(new Date(todayStr).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const recent7d = db.prepare(`
      SELECT lnrmssd FROM hrv_measurements
      WHERE user_id = ? AND timestamp >= ? AND timestamp < ?
      ORDER BY timestamp DESC
    `).all(userId, sevenDaysAgo, todayStr);
    const lnValues7 = recent7d.map(m => m.lnrmssd).filter(v => typeof v === 'number' && !isNaN(v));
    const stats7 = calculateStats(lnValues7);

    // Calculate consecutive low days (SWC threshold)
    const swc = Math.max((stats28.sd || 0.08) * 0.5, 0.05);
    const pastMeasurements = db.prepare(`
      SELECT lnrmssd FROM hrv_measurements
      WHERE user_id = ? AND timestamp < ?
      ORDER BY timestamp DESC LIMIT 14
    `).all(userId, todayStr);

    let consecutiveLowDays = (measurement.lnrmssd < stats28.mean - swc) ? 1 : 0;
    if (consecutiveLowDays > 0) {
      for (const m of pastMeasurements) {
        if (m.lnrmssd < stats28.mean - swc) {
          consecutiveLowDays++;
        } else {
          break;
        }
      }
    }

    // Update consecutive_low_days on measurement
    try {
      db.prepare('UPDATE hrv_measurements SET consecutive_low_days = ? WHERE id = ?').run(consecutiveLowDays, measurement.id);
    } catch (_) {}

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
      target_pace: null, target_hr_zone: 'Z2', is_fixed: false,
      description: 'Treino padrão'
    };

    // Check Menstrual Profile for female athletes
    const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
    let menstrualData = null;
    if (profile?.gender === 'female') {
      const menstrualProf = db.prepare('SELECT * FROM user_menstrual_profile WHERE user_id = ?').get(userId);
      if (menstrualProf?.lmp_date) {
        const phase = getCyclePhase(menstrualProf.lmp_date, menstrualProf.cycle_length_days, todayStr);
        const todayTracking = db.prepare('SELECT * FROM menstrual_tracking WHERE user_id = ? AND date = ?').get(userId, todayStr);
        const symptomScore = calcMenstrualSymptomScore(todayTracking);
        menstrualData = { phase, symptomScore };
      }
    }

    // User Profile for Gellish Max HR calculation
    const userProfileData = profile ? {
      age: profile.date_of_birth ? Math.max(15, new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()) : 30,
      gender: profile.gender || 'male',
      weightKg: profile.weight_kg,
      heightCm: profile.height_cm,
    } : { age: 30, gender: 'male' };

    const suggestion = generateTrainingSuggestion({
      lnrmssdToday: measurement.lnrmssd,
      rhrToday: currentRhr,
      lnrmssd28dMean: stats28.mean,
      lnrmssd28dSd: stats28.sd || 0.08,
      rhr28dMean: rhrStats28.mean,
      rhr28dSd: rhrStats28.sd || 4,
      lnrmssd7dMean: stats7.mean || stats28.mean,
      lnrmssd7dSd: stats7.sd || stats28.sd || 0.05,
      consecutiveLowDays,
      wellnessScores: wellnessData,
      menstrualData,
      plannedSession: defaultSession,
      weeksToRace,
      userProfile: userProfileData,
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
      stats28.mean, stats28.sd || 0.05,
      JSON.stringify(wellnessData), suggestion.reason_code,
      suggestion.action, suggestion.explanation_text
    );

    return { suggestion, stats28, stats7, consecutiveLowDays, sampleCount: lnValues28.length };
  }

  // -------------------------------------------------------
  // POST /api/hrv/measurement — Registrar medição de VFC
  // -------------------------------------------------------
  router.post('/measurement', authenticate, (req, res) => {
    try {
      const { rmssd_ms, hr_rest_bpm, rhr_bpm, duration_seconds, device_id, timestamp } = req.body;
      const effectiveRhr = rhr_bpm != null ? rhr_bpm : hr_rest_bpm;

      if (!rmssd_ms || !effectiveRhr) {
        return res.status(400).json({ error: 'rmssd_ms e hr_rest_bpm / rhr_bpm são obrigatórios' });
      }

      const numRmssd = Number(rmssd_ms);
      const numHrRest = Number(effectiveRhr);
      const numDuration = Number(duration_seconds) || 60;

      if (isNaN(numRmssd) || numRmssd < 10 || numRmssd > 200) {
        return res.status(400).json({ error: 'RMSSD deve ser um número entre 10 e 200 ms' });
      }

      if (isNaN(numHrRest) || numHrRest < 30 || numHrRest > 120) {
        return res.status(400).json({ error: 'FC de repouso deve ser um número entre 30 e 120 bpm' });
      }

      const id = uuidv4();
      const lnrmssd = calculateLnRmssd(numRmssd);
      const ts = timestamp || new Date().toISOString();
      const today = ts.split('T')[0];

      db.prepare(`
        INSERT INTO hrv_measurements (id, user_id, timestamp, rmssd_ms, lnrmssd, hr_rest_bpm, rhr_bpm, device_id, duration_seconds)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, req.user.id, ts, numRmssd, lnrmssd, numHrRest, numHrRest, device_id || null, numDuration);

      // Recalculate daily status
      const statusCalculation = recalculateDailyStatus(req.user.id, today);

      res.status(201).json({
        measurement: {
          id,
          rmssd_ms: numRmssd,
          lnrmssd: +lnrmssd.toFixed(4),
          hr_rest_bpm: numHrRest,
          rhr_bpm: numHrRest,
          duration_seconds: numDuration,
          timestamp: ts,
        },
        daily_status: statusCalculation?.suggestion || null,
        stats_28d: {
          mean: +(statusCalculation?.stats28.mean || lnrmssd).toFixed(4),
          sd: +(statusCalculation?.stats28.sd || 0.08).toFixed(4),
          sample_size: statusCalculation?.sampleCount || 0,
        },
        consecutive_low_days: statusCalculation?.consecutiveLowDays || 0,
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
  // GET /api/hrv/status — Status do dia com métricas e zonas
  // -------------------------------------------------------
  router.get('/status', authenticate, (req, res) => {
    try {
      const today = req.query.date || new Date().toISOString().split('T')[0];

      let status = db.prepare('SELECT * FROM daily_status WHERE user_id = ? AND date = ?').get(req.user.id, today);
      const wellness = db.prepare('SELECT * FROM wellness_scores WHERE user_id = ? AND date = ?').get(req.user.id, today);
      const measurement = db.prepare(`
        SELECT * FROM hrv_measurements WHERE user_id = ? AND timestamp >= ? ORDER BY timestamp DESC LIMIT 1
      `).get(req.user.id, today);

      let calculation = null;
      if (measurement) {
        calculation = recalculateDailyStatus(req.user.id, today);
        status = db.prepare('SELECT * FROM daily_status WHERE user_id = ? AND date = ?').get(req.user.id, today);
      }

      res.json({
        date: today,
        status: status || null,
        wellness: wellness || null,
        measurement: measurement || null,
        suggestion: calculation?.suggestion || null,
        has_measured_today: !!measurement,
        has_wellness_today: !!wellness,
      });
    } catch (err) {
      console.error('HRV status error:', err);
      res.status(500).json({ error: 'Erro ao buscar status de VFC' });
    }
  });

  // -------------------------------------------------------
  // GET /api/hrv/history — Histórico de VFC (7, 28, 60 dias)
  // -------------------------------------------------------
  router.get('/history', authenticate, (req, res) => {
    try {
      const days = Math.min(90, Math.max(7, Number(req.query.days) || 28));
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const measurements = db.prepare(`
        SELECT id, timestamp, rmssd_ms, lnrmssd, hr_rest_bpm, rhr_bpm, consecutive_low_days, quality_score
        FROM hrv_measurements
        WHERE user_id = ? AND timestamp >= ?
        ORDER BY timestamp ASC
      `).all(req.user.id, startDate);

      const wellness = db.prepare(`
        SELECT date, sleep, fatigue, soreness, stress, readiness
        FROM wellness_scores
        WHERE user_id = ? AND date >= ?
        ORDER BY date ASC
      `).all(req.user.id, startDate.split('T')[0]);

      const statuses = db.prepare(`
        SELECT date, status, lnrmssd, lnrmssd_7d_mean, reason_code, suggested_action
        FROM daily_status
        WHERE user_id = ? AND date >= ?
        ORDER BY date ASC
      `).all(req.user.id, startDate.split('T')[0]);

      res.json({
        period_days: days,
        measurements,
        wellness,
        daily_statuses: statuses,
      });
    } catch (err) {
      console.error('HRV history error:', err);
      res.status(500).json({ error: 'Erro ao buscar histórico de VFC' });
    }
  });

  // -------------------------------------------------------
  // GET /api/hrv/vo2max — Última estimativa de VO2max + histórico
  // -------------------------------------------------------
  router.get('/vo2max', authenticate, (req, res) => {
    try {
      const latest = db.prepare(`
        SELECT id, date, vo2max_value, method, notes
        FROM vo2max_estimates
        WHERE user_id = ?
        ORDER BY date DESC LIMIT 1
      `).get(req.user.id);

      const history = db.prepare(`
        SELECT date, vo2max_value, method
        FROM vo2max_estimates
        WHERE user_id = ?
        ORDER BY date DESC LIMIT 12
      `).all(req.user.id);

      // Variação percentual contra a estimativa mais antiga disponível na janela
      let trendPercent = null;
      if (history.length >= 2) {
        const oldest = history[history.length - 1];
        if (oldest.vo2max_value > 0) {
          trendPercent = +(((history[0].vo2max_value - oldest.vo2max_value) / oldest.vo2max_value) * 100).toFixed(1);
        }
      }

      res.json({
        has_estimate: !!latest,
        vo2max: latest ? +latest.vo2max_value.toFixed(1) : null,
        method: latest?.method || null,
        date: latest?.date || null,
        trend_percent: trendPercent,
        history,
      });
    } catch (err) {
      console.error('VO2max fetch error:', err);
      res.status(500).json({ error: 'Erro ao buscar VO2max' });
    }
  });

  // -------------------------------------------------------
  // GET /api/hrv/zones — Zonas de FC calculadas (Z1-Z5)
  // -------------------------------------------------------
  router.get('/zones', authenticate, (req, res) => {
    try {
      const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.user.id);
      const userProfileData = profile ? {
        age: profile.date_of_birth ? Math.max(15, new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()) : 30,
        gender: profile.gender || 'male',
        weightKg: profile.weight_kg,
        heightCm: profile.height_cm,
      } : { age: 30, gender: 'male' };

      const { calculateMaxHr, calculateHrZones } = require('../agent/trainingAgent');
      const maxHr = calculateMaxHr(userProfileData);
      const zones = calculateHrZones(maxHr);

      res.json({ max_hr: maxHr, zones });
    } catch (err) {
      console.error('Zones calculation error:', err);
      res.status(500).json({ error: 'Erro ao calcular zonas de FC' });
    }
  });

  return router;
};
