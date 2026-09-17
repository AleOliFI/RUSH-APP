// ============================================================
// RUSH PERFORMANCE — Academies (SLC) Routes
// ============================================================

const express = require('express');
const { randomUUID: uuidv4 } = require('node:crypto');
const { authenticate, authorize } = require('../middleware/auth');
const { criarNotificacao } = require('../services/notificacoes');
// A conta de semana/dia e a MESMA que /training/my-plan usa: se as duas
// divergirem, a sessao gravada cai num dia que o app nao procura.
const { posicaoNoPlano } = require('../services/semanaDoPlano');

module.exports = function academiesRoutes(db) {
  const router = express.Router();

  const VALID_PLAN_TYPES = ['basic', 'pro', 'elite'];

  // -------------------------------------------------------
  // POST /api/academies — Criar assessoria
  // -------------------------------------------------------
  router.post('/', authenticate, async (req, res) => {
    try {
      const { name, cnpj, description, location, plan_type = 'basic' } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Nome da assessoria é obrigatório' });
      }

      const planType = VALID_PLAN_TYPES.includes(plan_type) ? plan_type : 'basic';
      const maxAthletes = { basic: 50, pro: 150, elite: 500 }[planType] || 50;
      const id = uuidv4();

      const createAcademy = db.transaction(async () => {
        await db.prepare(`
          INSERT INTO academies (id, name, cnpj, description, location, owner_id, plan_type, max_athletes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, name.trim(), cnpj ? String(cnpj).trim() : null, description ? String(description).trim() : null, location ? String(location).trim() : null, req.user.id, planType, maxAthletes);

        // Update user role and academy
        await db.prepare("UPDATE users SET role = 'owner', academy_id = ?, updated_at = datetime('now') WHERE id = ?").run(id, req.user.id);
      });

      await createAcademy();

      const academy = await db.prepare('SELECT * FROM academies WHERE id = ?').get(id);
      res.status(201).json(academy);
    } catch (err) {
      console.error('Create academy error:', err);
      res.status(500).json({ error: 'Erro ao criar assessoria' });
    }
  });

  // -------------------------------------------------------
  // GET /api/academies/my — Minha assessoria
  // -------------------------------------------------------
  router.get('/my', authenticate, authorize('owner', 'coach', 'admin'), async (req, res) => {
    try {
      if (!req.user.academy_id) {
        return res.status(404).json({ error: 'Assessoria não encontrada' });
      }

      const academy = await db.prepare('SELECT * FROM academies WHERE id = ?').get(req.user.academy_id);
      if (!academy) {
        return res.status(404).json({ error: 'Assessoria não encontrada' });
      }

      const athletes = await db.prepare(`
        SELECT u.id, u.email, u.role, u.created_at as joined_at,
          up.name, up.username, up.avatar_url
        FROM users u
        JOIN user_profiles up ON up.user_id = u.id
        WHERE u.academy_id = ? AND u.deleted_at IS NULL AND u.role = 'athlete'
        ORDER BY up.name
      `).all(academy.id);

      const coaches = await db.prepare(`
        SELECT u.id, u.email, u.role,
          up.name, up.username
        FROM users u
        JOIN user_profiles up ON up.user_id = u.id
        WHERE u.academy_id = ? AND u.deleted_at IS NULL AND u.role IN ('coach', 'owner')
        ORDER BY up.name
      `).all(academy.id);

      res.json({
        academy,
        athletes_count: athletes.length,
        coaches_count: coaches.length,
        max_athletes: academy.max_athletes,
        athletes,
        coaches,
      });
    } catch (err) {
      console.error('Get my academy error:', err);
      res.status(500).json({ error: 'Erro ao buscar assessoria' });
    }
  });

  // -------------------------------------------------------
  // GET /api/academies/dashboard — Dashboard da assessoria
  // -------------------------------------------------------
  router.get('/dashboard', authenticate, authorize('owner', 'coach', 'admin'), async (req, res) => {
    try {
      if (!req.user.academy_id) {
        return res.status(400).json({ error: 'Usuário não vinculado a uma assessoria' });
      }

      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Athletes with today's status
      const athleteStatuses = await db.prepare(`
        SELECT u.id, up.name, up.username, up.avatar_url,
          ds.status, ds.lnrmssd, ds.suggested_action, ds.explanation_text,
          -- A base entra junto porque o valor absoluto nao diz nada: um
          -- lnRMSSD de 34 so vira sinal quando comparado com a media do
          -- proprio atleta. Sem isto a tela mostraria um numero solto.
          ds.lnrmssd_7d_mean, ds.lnrmssd_7d_sd
        FROM users u
        JOIN user_profiles up ON up.user_id = u.id
        LEFT JOIN daily_status ds ON ds.user_id = u.id AND ds.date = ?
        WHERE u.academy_id = ? AND u.role = 'athlete' AND u.deleted_at IS NULL
        ORDER BY
          CASE ds.status
            WHEN 'recovery' THEN 1
            WHEN 'attention' THEN 2
            WHEN 'favorable' THEN 3
            ELSE 4
          END, up.name
      `).all(today, req.user.academy_id);

      // Stats
      // TODAS as contagens abaixo filtram por role = 'athlete', igual a
      // lista de atletas. Antes, so `totalAthletes` e a lista filtravam:
      // o treinador e o dono da assessoria entravam no numerador e
      // ficavam fora do denominador. Na tela isso aparecia como "1 de 3
      // mediram" com os tres atletas marcados como "nao mediu" — o
      // resumo e a lista contando populacoes diferentes.
      const statusCounts = await db.prepare(`
        SELECT ds.status, COUNT(*) as count
        FROM daily_status ds
        JOIN users u ON u.id = ds.user_id
        WHERE u.academy_id = ? AND u.role = 'athlete' AND u.deleted_at IS NULL AND ds.date = ?
        GROUP BY ds.status
      `).all(req.user.academy_id, today);

      const activitiesLast30d = await db.prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(a.distance_km), 0) as total_km
        FROM activities a
        JOIN users u ON u.id = a.user_id
        WHERE u.academy_id = ? AND u.role = 'athlete' AND u.deleted_at IS NULL AND a.date >= ?
      `).get(req.user.academy_id, thirtyDaysAgo);

      const totalAthletes = await db.prepare("SELECT COUNT(*) as count FROM users WHERE academy_id = ? AND role = 'athlete' AND deleted_at IS NULL").get(req.user.academy_id);
      const measuredToday = await db.prepare(`
        SELECT COUNT(DISTINCT ds.user_id) as count
        FROM daily_status ds
        JOIN users u ON u.id = ds.user_id
        WHERE u.academy_id = ? AND u.role = 'athlete' AND u.deleted_at IS NULL AND ds.date = ?
      `).get(req.user.academy_id, today);

      res.json({
        date: today,
        athletes: athleteStatuses,
        summary: {
          total_athletes: totalAthletes ? totalAthletes.count : 0,
          measured_today: measuredToday ? measuredToday.count : 0,
          not_measured: (totalAthletes ? totalAthletes.count : 0) - (measuredToday ? measuredToday.count : 0),
          status_breakdown: statusCounts.reduce((acc, s) => { acc[s.status] = s.count; return acc; }, {}),
          last_30d: {
            activities: activitiesLast30d ? activitiesLast30d.count : 0,
            total_km: activitiesLast30d ? +activitiesLast30d.total_km.toFixed(1) : 0,
          }
        }
      });
    } catch (err) {
      console.error('Get academy dashboard error:', err);
      res.status(500).json({ error: 'Erro ao carregar dashboard da assessoria' });
    }
  });

  // -------------------------------------------------------
  // POST /api/academies/invite — Convidar atleta
  // -------------------------------------------------------
  router.post('/invite', authenticate, authorize('owner', 'coach', 'admin'), async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email do atleta é obrigatório' });
      }

      const cleanEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'Formato de email inválido' });
      }

      if (!req.user.academy_id) {
        return res.status(400).json({ error: 'Você não está vinculado a uma assessoria' });
      }

      // Check limit
      const academy = await db.prepare('SELECT * FROM academies WHERE id = ?').get(req.user.academy_id);
      if (!academy) {
        return res.status(404).json({ error: 'Assessoria não encontrada' });
      }

      const currentCount = await db.prepare("SELECT COUNT(*) as count FROM users WHERE academy_id = ? AND role = 'athlete' AND deleted_at IS NULL").get(req.user.academy_id);

      if (currentCount && currentCount.count >= academy.max_athletes) {
        return res.status(403).json({ error: `Limite de ${academy.max_athletes} atletas atingido. Faça upgrade do plano.` });
      }

      const user = await db.prepare('SELECT id, academy_id FROM users WHERE email = ? AND deleted_at IS NULL').get(cleanEmail);

      if (!user) {
        return res.json({ status: 'pending', message: 'Usuário não encontrado. Um convite será enviado quando ele se cadastrar.' });
      }

      if (user.academy_id) {
        return res.status(409).json({ error: 'Atleta já vinculado a uma assessoria' });
      }

      // Link athlete to academy
      await db.prepare("UPDATE users SET academy_id = ?, role = 'athlete', updated_at = datetime('now') WHERE id = ?").run(req.user.academy_id, user.id);

      // Notify
      await criarNotificacao(db, {
        userId: user.id,
        type: 'system',
        sourceUserId: req.user.id,
        message: `Você foi vinculado à assessoria ${academy.name}`,
      });

      res.json({ status: 'linked', message: 'Atleta vinculado com sucesso' });
    } catch (err) {
      console.error('Invite athlete error:', err);
      res.status(500).json({ error: 'Erro ao convidar atleta' });
    }
  });

  // -------------------------------------------------------
  // GET /api/academies/athlete/:id — Detalhes do atleta (coach view)
  // -------------------------------------------------------
  router.get('/athlete/:id', authenticate, authorize('owner', 'coach', 'admin'), async (req, res) => {
    try {
      const athleteId = req.params.id;
      if (!athleteId) {
        return res.status(400).json({ error: 'ID do atleta obrigatório' });
      }

      if (!req.user.academy_id) {
        return res.status(400).json({ error: 'Você não está vinculado a uma assessoria' });
      }

      const athlete = await db.prepare(`
        SELECT u.id, u.email, u.created_at, up.*, uo.*
        FROM users u
        JOIN user_profiles up ON up.user_id = u.id
        LEFT JOIN user_objectives uo ON uo.user_id = u.id
        WHERE u.id = ? AND u.academy_id = ? AND u.deleted_at IS NULL
      `).get(athleteId, req.user.academy_id);

      if (!athlete) {
        return res.status(404).json({ error: 'Atleta não encontrado' });
      }

      // HRV history (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const hrvHistory = await db.prepare('SELECT * FROM daily_status WHERE user_id = ? AND date >= ? ORDER BY date DESC').all(athleteId, thirtyDaysAgo);
      const recentActivities = await db.prepare('SELECT * FROM activities WHERE user_id = ? ORDER BY date DESC LIMIT 10').all(athleteId);
      const vo2max = await db.prepare('SELECT * FROM vo2max_estimates WHERE user_id = ? ORDER BY date DESC LIMIT 5').all(athleteId);

      // Current plan
      const plan = await db.prepare(`
        SELECT ap.*, tp.name as plan_name, tp.distance_km, tp.level, tp.duration_weeks
        FROM assigned_plans ap
        JOIN training_plans tp ON tp.id = ap.plan_id
        WHERE ap.user_id = ? AND ap.status = 'active'
        LIMIT 1
      `).get(athleteId);

      // As zonas do ATLETA, calculadas aqui pelas mesmas funcoes que
      // /hrv/zones usa. O treinador precisa delas para prescrever: "Z4"
      // e uma letra, "161-181 bpm dele" e uma instrucao. Calcular no
      // cliente recriaria a regra de zonas num segundo lugar, e foi
      // exatamente assim que a FCmax medida passou a ser ignorada.
      const { calculateMaxHr, calculateHrZones } = require('../agent/trainingAgent');
      const perfilParaZonas = {
        age: athlete.date_of_birth
          ? Math.max(15, new Date().getFullYear() - new Date(athlete.date_of_birth).getFullYear())
          : 30,
        gender: athlete.gender || 'male',
        weightKg: athlete.weight_kg,
        heightCm: athlete.height_cm,
        hrMaxTested: athlete.hr_max_tested,
      };
      const maxHrAtleta = calculateMaxHr(perfilParaZonas);
      const medidaValida = Number(athlete.hr_max_tested) >= 120 && Number(athlete.hr_max_tested) <= 220;

      res.json({
        athlete,
        hrv_history: hrvHistory,
        recent_activities: recentActivities,
        vo2max_history: vo2max,
        current_plan: plan || null,
        max_hr: maxHrAtleta,
        max_hr_source: medidaValida ? 'field_test' : 'age_estimate',
        hr_zones: calculateHrZones(maxHrAtleta),
      });
    } catch (err) {
      console.error('Get athlete details error:', err);
      res.status(500).json({ error: 'Erro ao buscar atleta' });
    }
  });

  // -------------------------------------------------------
  // POST /api/academies/register-athlete — Cadastro direto de aluno pelo treinador
  // -------------------------------------------------------
  router.post('/register-athlete', authenticate, authorize('owner', 'coach', 'admin'), async (req, res) => {
    try {
      const { email, password, name, username, distance_km, level, weight_kg, gender } = req.body;

      if (!email || !name) {
        return res.status(400).json({ error: 'Nome e email são obrigatórios' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanUsername = username ? username.trim().toLowerCase() : cleanEmail.split('@')[0] + Math.floor(Math.random() * 900 + 100);

      // Check if user already exists
      const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
      if (existing) {
        return res.status(409).json({ error: 'Email já cadastrado na plataforma' });
      }

      if (!req.user.academy_id) {
        return res.status(400).json({ error: 'Você precisa estar vinculado a uma assessoria para cadastrar alunos' });
      }

      const bcrypt = require('bcryptjs');
      const athleteId = uuidv4();
      const tempPassword = password || '123456';
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const targetDist = Number(distance_km) || 5;
      const targetLevel = ['beginner', 'intermediate', 'advanced'].includes(level) ? level : 'beginner';

      const createAthleteTransaction = db.transaction(async () => {
        await db.prepare(`
          INSERT INTO users (id, email, password_hash, role, academy_id)
          VALUES (?, ?, ?, 'athlete', ?)
        `).run(athleteId, cleanEmail, passwordHash, req.user.academy_id);

        await db.prepare(`
          INSERT INTO user_profiles (user_id, name, username, weight_kg, gender)
          VALUES (?, ?, ?, ?, ?)
        `).run(athleteId, name.trim(), cleanUsername, weight_kg ? Number(weight_kg) : null, gender || null);

        await db.prepare(`
          INSERT INTO user_objectives (user_id, distance_km, level)
          VALUES (?, ?, ?)
        `).run(athleteId, targetDist, targetLevel);

        await db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(athleteId);
        await db.prepare('INSERT INTO privacy_settings (user_id) VALUES (?)').run(athleteId);
      });

      await createAthleteTransaction();

      res.status(201).json({
        success: true,
        athlete: {
          id: athleteId,
          email: cleanEmail,
          name: name.trim(),
          username: cleanUsername,
          distance_km: targetDist,
          level: targetLevel,
          temporary_password: tempPassword,
        },
        message: 'Atleta cadastrado com sucesso na assessoria!',
      });
    } catch (err) {
      console.error('Register athlete error:', err);
      res.status(500).json({ error: 'Erro ao cadastrar atleta' });
    }
  });

  // -------------------------------------------------------
  // POST /api/academies/athlete/:id/prescribe — Prescrever treino para o atleta
  // -------------------------------------------------------
  router.post('/athlete/:id/prescribe', authenticate, authorize('owner', 'coach', 'admin'), async (req, res) => {
    try {
      const athleteId = req.params.id;
      const { title, type, distance_km, duration_min, target_pace, target_hr_zone, description, notes, data_treino } = req.body;

      if (!athleteId || !type) {
        return res.status(400).json({ error: 'ID do atleta e tipo de treino são obrigatórios' });
      }

      // Check if athlete belongs to coach's academy
      const athlete = await db.prepare('SELECT id FROM users WHERE id = ? AND academy_id = ? AND deleted_at IS NULL').get(athleteId, req.user.academy_id);
      if (!athlete) {
        return res.status(404).json({ error: 'Atleta não encontrado na sua assessoria' });
      }

      // -------------------------------------------------------
      // Gravar a sessao — o passo que faltava.
      // -------------------------------------------------------
      // Ate aqui esta rota so notificava o atleta e devolvia o
      // payload de volta, respondendo "Treino prescrito e enviado
      // com sucesso". O treino nao era gravado em lugar nenhum: o
      // atleta recebia o aviso, abria o app e nao encontrava nada.
      //
      // Uma sessao vive na chave (plan_id, week_number,
      // day_of_week) — nao ha coluna de data. Entao a prescricao
      // precisa do plano ativo do atleta para ter onde morar.
      const atribuicao = await db.prepare(`
        SELECT ap.*, tp.duration_weeks
        FROM assigned_plans ap
        JOIN training_plans tp ON tp.id = ap.plan_id
        WHERE ap.user_id = ? AND ap.status = 'active'
        ORDER BY ap.created_at DESC LIMIT 1
      `).get(athleteId);

      if (!atribuicao) {
        return res.status(409).json({
          error: 'Este atleta não tem plano ativo, e uma sessão precisa de um plano para existir. ' +
                 'Atribua um plano antes de prescrever.',
        });
      }

      const { week_number, day_of_week } = posicaoNoPlano(
        atribuicao.start_date, atribuicao.duration_weeks, data_treino || new Date(),
      );

      // Todo dia do plano ja tem uma sessao — inclusive os de
      // descanso. Inserir outra no mesmo dia deixaria "o treino de
      // hoje" ambiguo, porque /training/my-plan busca com .get() e
      // pegaria uma das duas sem criterio. Prescrever SUBSTITUI o
      // dia, que e tambem o que o treinador quer dizer.
      const anterior = await db.prepare(
        'SELECT id, type FROM training_sessions WHERE plan_id = ? AND week_number = ? AND day_of_week = ?'
      ).get(atribuicao.plan_id, week_number, day_of_week);

      if (anterior) {
        await db.prepare('DELETE FROM training_sessions WHERE id = ?').run(anterior.id);
      }

      const sessaoId = uuidv4();
      await db.prepare(`
        INSERT INTO training_sessions
          (id, plan_id, week_number, day_of_week, type, distance_km, duration_min,
           target_pace, target_hr_zone, description, is_fixed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        sessaoId, atribuicao.plan_id, week_number, day_of_week, type,
        Number(distance_km) || null, Number(duration_min) || null,
        target_pace || null, target_hr_zone || null,
        description || notes || 'Sessão personalizada pelo treinador.',
      );

      // is_fixed = 1: o agente de VFC ajusta o volume de sessoes
      // comuns quando a prontidao cai, e uma prescricao do
      // treinador nao deve ser remexida sem que ele saiba.

      // Notify athlete of coach's prescription
      const coachProfile = await db.prepare('SELECT name FROM user_profiles WHERE user_id = ?').get(req.user.id);

      await criarNotificacao(db, {
        userId: athleteId,
        type: 'plan_assigned',
        sourceUserId: req.user.id,
        message: `Seu treinador ${coachProfile?.name || 'do RUSH'} prescreveu uma nova sessão: ${title || type} (${distance_km || 5} km)`,
      });

      const gravada = await db.prepare('SELECT * FROM training_sessions WHERE id = ?').get(sessaoId);

      res.status(201).json({
        success: true,
        session: gravada,
        replaced: anterior ? { id: anterior.id, type: anterior.type } : null,
        week_number,
        day_of_week,
        message: anterior
          ? `Treino prescrito: substituiu a sessão de ${anterior.type} da semana ${week_number}.`
          : `Treino prescrito na semana ${week_number}.`,
      });
    } catch (err) {
      console.error('Prescribe workout error:', err);
      res.status(500).json({ error: 'Erro ao prescrever treino' });
    }
  });

  return router;
};
