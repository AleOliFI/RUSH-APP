// ============================================================
// RUSH PERFORMANCE — Training Plans Routes
// ============================================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');
const { criarNotificacao } = require('../services/notificacoes');

module.exports = function trainingRoutes(db) {
  const router = express.Router();

  // -------------------------------------------------------
  // GET /api/training/plans — Lista planos de treino
  // -------------------------------------------------------
  router.get('/plans', authenticate, async (req, res) => {
    try {
      const { distance_km, level } = req.query;
      let query = 'SELECT tp.*, up.name as creator_name FROM training_plans tp JOIN user_profiles up ON up.user_id = tp.created_by WHERE 1=1';
      const params = [];

      if (distance_km) {
        const dist = parseInt(distance_km, 10);
        if (!isNaN(dist)) {
          query += ' AND tp.distance_km = ?';
          params.push(dist);
        }
      }

      if (level && ['beginner', 'intermediate', 'advanced'].includes(level)) {
        query += ' AND tp.level = ?';
        params.push(level);
      }

      // If athlete, show plans from their academy + public
      if (req.user.role === 'athlete' && req.user.academy_id) {
        query += ' AND (tp.academy_id = ? OR tp.academy_id IS NULL)';
        params.push(req.user.academy_id);
      }

      query += ' ORDER BY tp.created_at DESC';

      const plans = await db.prepare(query).all(...params);
      res.json({ plans });
    } catch (err) {
      console.error('Get plans error:', err);
      res.status(500).json({ error: 'Erro ao buscar planos de treino' });
    }
  });

  // -------------------------------------------------------
  // POST /api/training/plans — Criar plano de treino
  // -------------------------------------------------------
  router.post('/plans', authenticate, authorize('coach', 'owner', 'admin'), async (req, res) => {
    try {
      const { name, distance_km, duration_weeks, level, description, sessions } = req.body;

      if (!name || distance_km == null || duration_weeks == null || !level) {
        return res.status(400).json({ error: 'name, distance_km, duration_weeks e level são obrigatórios' });
      }

      const numDist = Number(distance_km);
      const numWeeks = Number(duration_weeks);

      if (isNaN(numDist) || numDist <= 0) {
        return res.status(400).json({ error: 'distance_km deve ser um número positivo' });
      }

      if (isNaN(numWeeks) || numWeeks < 1 || numWeeks > 52) {
        return res.status(400).json({ error: 'duration_weeks deve estar entre 1 e 52 semanas' });
      }

      if (!['beginner', 'intermediate', 'advanced'].includes(level)) {
        return res.status(400).json({ error: 'level deve ser beginner, intermediate ou advanced' });
      }

      const planId = uuidv4();

      const createPlan = db.transaction(async () => {
        await db.prepare(`
          INSERT INTO training_plans (id, name, distance_km, duration_weeks, level, description, created_by, academy_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(planId, String(name).trim(), numDist, numWeeks, level, description ? String(description).trim() : null, req.user.id, req.user.academy_id || null);

        // Create sessions if provided
        if (sessions && Array.isArray(sessions)) {
          const insertSession = db.prepare(`
            INSERT INTO training_sessions (id, plan_id, week_number, day_of_week, type, distance_km, duration_min, target_pace, target_hr_zone, description, is_fixed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          for (const session of sessions) {
            await insertSession.run(
              uuidv4(),
              planId,
              session.week_number || 1,
              session.day_of_week || 1,
              session.type || 'easy_run',
              session.distance_km != null ? Number(session.distance_km) : null,
              session.duration_min != null ? Number(session.duration_min) : null,
              session.target_pace ? String(session.target_pace) : null,
              session.target_hr_zone ? String(session.target_hr_zone) : null,
              session.description ? String(session.description) : null,
              session.is_fixed ? 1 : 0
            );
          }
        }
      });

      await createPlan();

      const plan = await db.prepare('SELECT * FROM training_plans WHERE id = ?').get(planId);
      const planSessions = await db.prepare('SELECT * FROM training_sessions WHERE plan_id = ? ORDER BY week_number, day_of_week').all(planId);

      res.status(201).json({ plan, sessions: planSessions });
    } catch (err) {
      console.error('Create plan error:', err);
      res.status(500).json({ error: 'Erro ao criar plano de treino' });
    }
  });

  // -------------------------------------------------------
  // GET /api/training/plans/:id — Detalhes do plano
  // -------------------------------------------------------
  router.get('/plans/:id', authenticate, async (req, res) => {
    try {
      const plan = await db.prepare(`
        SELECT tp.*, up.name as creator_name
        FROM training_plans tp
        JOIN user_profiles up ON up.user_id = tp.created_by
        WHERE tp.id = ?
      `).get(req.params.id);

      if (!plan) {
        return res.status(404).json({ error: 'Plano não encontrado' });
      }

      const sessions = await db.prepare('SELECT * FROM training_sessions WHERE plan_id = ? ORDER BY week_number, day_of_week').all(plan.id);

      // Group sessions by week
      const weeks = {};
      for (const session of sessions) {
        if (!weeks[session.week_number]) weeks[session.week_number] = [];
        weeks[session.week_number].push(session);
      }

      res.json({ plan, sessions, weeks });
    } catch (err) {
      console.error('Get plan details error:', err);
      res.status(500).json({ error: 'Erro ao buscar detalhes do plano' });
    }
  });

  // -------------------------------------------------------
  // POST /api/training/assign — Atribuir plano ao atleta
  // -------------------------------------------------------
  router.post('/assign', authenticate, authorize('coach', 'owner', 'admin'), async (req, res) => {
    try {
      const { user_id, plan_id, start_date } = req.body;

      if (!user_id || !plan_id || !start_date) {
        return res.status(400).json({ error: 'user_id, plan_id e start_date são obrigatórios' });
      }

      const startDateObj = new Date(start_date);
      if (isNaN(startDateObj.getTime())) {
        return res.status(400).json({ error: 'start_date deve ser uma data válida (YYYY-MM-DD)' });
      }

      const athlete = await db.prepare('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL').get(user_id);
      if (!athlete) {
        return res.status(404).json({ error: 'Atleta não encontrado' });
      }

      const plan = await db.prepare('SELECT * FROM training_plans WHERE id = ?').get(plan_id);
      if (!plan) {
        return res.status(404).json({ error: 'Plano não encontrado' });
      }

      // Calculate end date
      const endDateObj = new Date(startDateObj.getTime() + plan.duration_weeks * 7 * 24 * 60 * 60 * 1000);
      const formattedStartDate = startDateObj.toISOString().split('T')[0];
      const formattedEndDate = endDateObj.toISOString().split('T')[0];

      // Cancel any existing active plan
      await db.prepare("UPDATE assigned_plans SET status = 'cancelled', updated_at = datetime('now') WHERE user_id = ? AND status = 'active'").run(user_id);

      const assignId = uuidv4();
      await db.prepare(`
        INSERT INTO assigned_plans (id, user_id, plan_id, start_date, end_date, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(assignId, user_id, plan_id, formattedStartDate, formattedEndDate);

      // Notify athlete
      await criarNotificacao(db, {
        userId: user_id,
        type: 'plan_assigned',
        sourceUserId: req.user.id,
        message: `Novo plano atribuído: ${plan.name}`,
      });

      res.status(201).json({
        assignment: { id: assignId, user_id, plan_id, start_date: formattedStartDate, end_date: formattedEndDate },
        plan
      });
    } catch (err) {
      console.error('Assign plan error:', err);
      res.status(500).json({ error: 'Erro ao atribuir plano ao atleta' });
    }
  });

  // -------------------------------------------------------
  // GET /api/training/my-plan — Plano ativo do atleta
  // -------------------------------------------------------
  router.get('/my-plan', authenticate, async (req, res) => {
    try {
      const assignment = await db.prepare(`
        SELECT ap.*, tp.name as plan_name, tp.distance_km, tp.duration_weeks, tp.level
        FROM assigned_plans ap
        JOIN training_plans tp ON tp.id = ap.plan_id
        WHERE ap.user_id = ? AND ap.status = 'active'
        ORDER BY ap.created_at DESC LIMIT 1
      `).get(req.user.id);

      if (!assignment) {
        return res.json({ has_plan: false, plan: null, today_session: null });
      }

      // Calculate current week safely (handles future start date gracefully)
      const startDate = new Date(assignment.start_date);
      const today = new Date();
      const daysDiff = Math.floor((today - startDate) / (24 * 60 * 60 * 1000));
      const currentWeek = Math.max(1, Math.min(Math.floor(daysDiff / 7) + 1, assignment.duration_weeks));
      const dayOfWeek = today.getDay() || 7;

      // Update current week in database if changed
      if (assignment.current_week !== currentWeek) {
        await db.prepare("UPDATE assigned_plans SET current_week = ?, updated_at = datetime('now') WHERE id = ?").run(currentWeek, assignment.id);
      }

      // Get today's session
      const todaySession = await db.prepare(`
        SELECT * FROM training_sessions
        WHERE plan_id = ? AND week_number = ? AND day_of_week = ?
      `).get(assignment.plan_id, currentWeek, dayOfWeek);

      // Get all sessions for current week
      const weekSessions = await db.prepare(`
        SELECT * FROM training_sessions
        WHERE plan_id = ? AND week_number = ?
        ORDER BY day_of_week
      `).all(assignment.plan_id, currentWeek);

      // Get daily status for agent suggestion
      const todayStr = today.toISOString().split('T')[0];
      const dailyStatus = await db.prepare('SELECT * FROM daily_status WHERE user_id = ? AND date = ?').get(req.user.id, todayStr);

      res.json({
        has_plan: true,
        plan: {
          id: assignment.plan_id,
          name: assignment.plan_name,
          distance_km: assignment.distance_km,
          duration_weeks: assignment.duration_weeks,
          level: assignment.level,
          current_week: currentWeek,
          start_date: assignment.start_date,
          end_date: assignment.end_date,
        },
        today_session: todaySession || null,
        week_sessions: weekSessions,
        daily_status: dailyStatus || null,
      });
    } catch (err) {
      console.error('Get my plan error:', err);
      res.status(500).json({ error: 'Erro ao buscar plano ativo' });
    }
  });

  // -------------------------------------------------------
  // POST /api/training/generate-plan — Auto-generate plan
  // -------------------------------------------------------
  router.post('/generate-plan', authenticate, async (req, res) => {
    try {
      const { distance_km, level, duration_weeks = 12 } = req.body;

      if (distance_km == null || !level) {
        return res.status(400).json({ error: 'distance_km e level são obrigatórios' });
      }

      const numDist = Number(distance_km);
      if (![5, 10, 21, 42].includes(numDist)) {
        return res.status(400).json({ error: 'distance_km deve ser 5, 10, 21 ou 42' });
      }

      if (!['beginner', 'intermediate', 'advanced'].includes(level)) {
        return res.status(400).json({ error: 'level deve ser beginner, intermediate ou advanced' });
      }

      const numWeeks = Number(duration_weeks);
      if (isNaN(numWeeks) || numWeeks < 4 || numWeeks > 24) {
        return res.status(400).json({ error: 'duration_weeks deve estar entre 4 e 24 semanas' });
      }

      const planId = uuidv4();
      const planName = `Plano ${numDist}K - ${level === 'beginner' ? 'Iniciante' : level === 'intermediate' ? 'Intermediário' : 'Avançado'}`;

      // Training templates based on distance and level
      const templates = getTrainingTemplates(numDist, level);

      const createPlan = db.transaction(async () => {
        await db.prepare(`
          INSERT INTO training_plans (id, name, distance_km, duration_weeks, level, description, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(planId, planName, numDist, numWeeks, level,
          `Plano periodizado gerado automaticamente para ${numDist}km - nível ${level} (4 fases: Base, Build, Peak, Taper)`, req.user.id);

        const insertSession = db.prepare(`
          INSERT INTO training_sessions (id, plan_id, week_number, day_of_week, type, distance_km, duration_min, target_hr_zone, description, is_fixed)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (let week = 1; week <= numWeeks; week++) {
          const weekSessions = generateWeekSessions(templates, week, numWeeks, numDist, level);
          for (const session of weekSessions) {
            await insertSession.run(
              uuidv4(), planId, week, session.day_of_week,
              session.type, session.distance_km, session.duration_min,
              session.target_hr_zone, session.description, session.is_fixed ? 1 : 0
            );
          }
        }
      });

      await createPlan();

      // Auto-assign to user
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + numWeeks * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      await db.prepare("UPDATE assigned_plans SET status = 'cancelled', updated_at = datetime('now') WHERE user_id = ? AND status = 'active'").run(req.user.id);

      const assignId = uuidv4();
      await db.prepare(`
        INSERT INTO assigned_plans (id, user_id, plan_id, start_date, end_date, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(assignId, req.user.id, planId, startDate, endDate);

      const plan = await db.prepare('SELECT * FROM training_plans WHERE id = ?').get(planId);
      const sessions = await db.prepare('SELECT * FROM training_sessions WHERE plan_id = ? ORDER BY week_number, day_of_week').all(planId);

      res.status(201).json({ plan, sessions, assignment: { id: assignId, start_date: startDate, end_date: endDate } });
    } catch (err) {
      console.error('Generate plan error:', err);
      res.status(500).json({ error: 'Erro ao gerar plano de treinamento' });
    }
  });

  return router;
};

// ============================================================
// Helper: Training Templates
// ============================================================

function getTrainingTemplates(distanceKm, level) {
  const baseDistances = {
    5: { easy: 4, long: 6, interval: 3, tempo: 4 },
    10: { easy: 6, long: 10, interval: 5, tempo: 6 },
    21: { easy: 8, long: 16, interval: 6, tempo: 8 },
    42: { easy: 10, long: 25, interval: 8, tempo: 10 },
  };

  const multipliers = {
    beginner: 0.7,
    intermediate: 1.0,
    advanced: 1.2,
  };

  const base = baseDistances[distanceKm] || baseDistances[10];
  const mult = multipliers[level] || 1.0;

  return {
    easy: +(base.easy * mult).toFixed(1),
    long: +(base.long * mult).toFixed(1),
    interval: +(base.interval * mult).toFixed(1),
    tempo: +(base.tempo * mult).toFixed(1),
  };
}

/**
 * Gera sessões semanais com periodização fisiológica e salvaguardas biomecânicas.
 * Baseado em modelos de periodização linear reversa e blocos (Daniels, Pfitzinger, Seiler).
 */
function generateWeekSessions(templates, weekNumber, totalWeeks, distanceKm, level) {
  // 4 Fases de Periodização
  const phase = weekNumber <= Math.round(totalWeeks * 0.33) ? 'base'
    : weekNumber <= Math.round(totalWeeks * 0.66) ? 'build'
    : weekNumber <= totalWeeks - 2 ? 'peak'
    : 'taper';

  // Progressão de volume linear e suave (sem drops na transição Base -> Build)
  const baseFraction = Math.max(1, Math.round(totalWeeks * 0.33));
  const buildFraction = Math.max(1, Math.round(totalWeeks * 0.66) - baseFraction);

  const baseProgress = Math.min(1.0, weekNumber / baseFraction);
  const buildProgress = Math.min(1.0, Math.max(0, (weekNumber - baseFraction) / buildFraction));

  const volumeMultiplier = {
    base: 0.70 + baseProgress * 0.25,     // 0.70 -> 0.95
    build: 0.95 + buildProgress * 0.15,   // 0.95 -> 1.10
    peak: 1.10,                           // Sobrecarga de pico
    taper: 0.60,                          // Redução de volume de 40-50% no taper
  }[phase];

  const sessions = [];
  const weekDays = level === 'beginner' ? [2, 4, 6] : level === 'intermediate' ? [1, 3, 4, 6] : [1, 2, 3, 5, 6];
  const isPeakTestWeek = (phase === 'peak' && weekNumber === totalWeeks - 2);

  for (let i = 0; i < weekDays.length; i++) {
    const day = weekDays[i];
    let session;

    if (i === weekDays.length - 1) {
      // Última sessão da semana (Sábado, dia 6)
      if (isPeakTestWeek) {
        // Salvaguarda biomecânica: no final de semana de teste, o teste substitui o longão no Sábado
        const testDist = distanceKm <= 10 ? distanceKm : +(distanceKm / 2).toFixed(1);
        session = {
          day_of_week: day,
          type: 'test',
          distance_km: testDist,
          duration_min: Math.round(testDist * 5.0),
          target_hr_zone: 'Z4',
          description: `Simulado / Teste de Performance (${testDist}km) - TREINO FIXO`,
          is_fixed: true,
        };
      } else {
        session = {
          day_of_week: day,
          type: 'long_run',
          distance_km: +(templates.long * volumeMultiplier).toFixed(1),
          duration_min: Math.round(templates.long * volumeMultiplier * 6.5),
          target_hr_zone: 'Z2',
          description: `Longão ${phase === 'taper' ? '(taper)' : ''} - Manter ritmo confortável em Z2`,
          is_fixed: false,
        };
      }
    } else if (i === 1 && level !== 'beginner') {
      // Segunda sessão = Intervalado / Tempo run alternado
      if (isPeakTestWeek) {
        // Na semana de teste, faz polimento controlado (ritmo moderado Z3)
        session = {
          day_of_week: day,
          type: 'tempo',
          distance_km: +(templates.tempo * 0.8).toFixed(1),
          duration_min: Math.round(templates.tempo * 0.8 * 5.5),
          target_hr_zone: 'Z3',
          description: 'Polimento pré-teste: ritmo controlado em Z3 com baixo desgaste',
          is_fixed: false,
        };
      } else {
        const isInterval = weekNumber % 2 === 0;
        session = {
          day_of_week: day,
          type: isInterval ? 'interval' : 'tempo',
          distance_km: +(isInterval ? templates.interval : templates.tempo * volumeMultiplier).toFixed(1),
          duration_min: isInterval ? Math.round(templates.interval * 5) : Math.round(templates.tempo * volumeMultiplier * 5.5),
          target_hr_zone: isInterval ? 'Z4' : 'Z3',
          description: isInterval
            ? `Intervalado: ${Math.max(3, Math.round(templates.interval))}x1000m com recuperação`
            : `Tempo run em Z3 - Ritmo controlado`,
          is_fixed: false,
        };
      }
    } else {
      // Rodagem leve
      const easyMult = isPeakTestWeek ? volumeMultiplier * 0.85 : volumeMultiplier;
      session = {
        day_of_week: day,
        type: 'easy_run',
        distance_km: +(templates.easy * easyMult).toFixed(1),
        duration_min: Math.round(templates.easy * easyMult * 6),
        target_hr_zone: 'Z2',
        description: 'Rodagem leve em Z2 - Foco na base aeróbica',
        is_fixed: false,
      };
    }

    sessions.push(session);
  }

  // Na semana de teste do pico, prescrever trote regenerativo no Domingo pós-teste para remoção de lactato
  if (isPeakTestWeek) {
    sessions.push({
      day_of_week: 7,
      type: 'recovery',
      distance_km: 3.0,
      duration_min: 20,
      target_hr_zone: 'Z1',
      description: 'Trote regenerativo pós-teste em Z1 para recuperação ativa e eliminação de metabólitos',
      is_fixed: false,
    });
  }

  return sessions;
}
