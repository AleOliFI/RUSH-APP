// ============================================================
// RUSH PERFORMANCE — Training Plans Routes
// ============================================================

const express = require('express');
const { randomUUID: uuidv4 } = require('node:crypto');
const { authenticate, authorize } = require('../middleware/auth');
const { criarNotificacao } = require('../services/notificacoes');
// A periodizacao mora em services/: o seed gera o plano de
// demonstracao pelo mesmo caminho que esta rota.
const { getTrainingTemplates, generateWeekSessions, faseDaSemana } = require('../services/periodizacao');
const { posicaoNoPlano } = require('../services/semanaDoPlano');

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

      // Resumo por semana: fase, volume e quantas sessoes de corrida.
      //
      // A FASE vem daqui, e nao da tela. Ela e derivada de
      // week_number e duration_weeks pela mesma funcao que gera o
      // plano — se a tela recalculasse, seriam duas contas para a
      // mesma resposta, e elas divergiriam no primeiro ajuste de
      // periodizacao.
      const totalSemanas = Number(plan.duration_weeks) || 0;
      const resumoSemanas = Object.keys(weeks)
        .map(Number)
        .sort((a, b) => a - b)
        .map((numero) => {
          const doDia = weeks[numero];
          const km = doDia.reduce((soma, x) => soma + (Number(x.distance_km) || 0), 0);
          return {
            week_number: numero,
            phase: faseDaSemana(numero, totalSemanas),
            total_km: +km.toFixed(1),
            session_count: doDia.filter((x) => x.type !== 'rest').length,
            rest_count: doDia.filter((x) => x.type === 'rest').length,
            has_test: doDia.some((x) => x.type === 'test'),
          };
        });

      const volumeTotal = resumoSemanas.reduce((soma, x) => soma + x.total_km, 0);

      // Quais sessoes ESTE atleta ja cumpriu. Uma atividade guarda o
      // session_id do treino que ela realizou, entao "feito" e um dado
      // e nao uma estimativa. Sem isto a tela teria de inventar o
      // progresso, ou nao mostrar nenhum.
      const cumpridas = await db.prepare(`
        SELECT DISTINCT a.session_id
        FROM activities a
        JOIN training_sessions ts ON ts.id = a.session_id
        WHERE a.user_id = ? AND ts.plan_id = ? AND a.session_id IS NOT NULL
      `).all(req.user.id, plan.id);

      const idsCumpridos = cumpridas.map((x) => x.session_id);
      const kmCumpridos = sessions
        .filter((x) => idsCumpridos.includes(x.id))
        .reduce((soma, x) => soma + (Number(x.distance_km) || 0), 0);

      // A atribuicao diz em que semana o atleta esta e quando termina.
      const minhaAtribuicao = await db.prepare(`
        SELECT start_date, end_date, current_week, status
        FROM assigned_plans
        WHERE user_id = ? AND plan_id = ? AND status = 'active'
        ORDER BY created_at DESC LIMIT 1
      `).get(req.user.id, plan.id);

      res.json({
        plan,
        sessions,
        weeks,
        week_summary: resumoSemanas,
        assignment: minhaAtribuicao || null,
        completed_session_ids: idsCumpridos,
        completed_km: +kmCumpridos.toFixed(1),
        totals: {
          weeks: resumoSemanas.length,
          sessions: sessions.length,
          total_km: +volumeTotal.toFixed(1),
        },
      });
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

      // A mesma funcao que a prescricao do treinador usa. Se cada
      // lado fizesse a propria conta, uma sessao gravada na
      // semana 6 poderia ser procurada na 5 — e o sintoma seria
      // "o treino nao apareceu", sem erro nenhum no log.
      const today = new Date();
      const { week_number: currentWeek, day_of_week: dayOfWeek } =
        posicaoNoPlano(assignment.start_date, assignment.duration_weeks, today);

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
