// ============================================================
// RUSH PERFORMANCE — Activities Routes
// ============================================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { criarNotificacao } = require('../services/notificacoes');
const { calculateMaxHr, calculateHrZones } = require('../agent/trainingAgent');
const { formatDuration, formatPaceFromSeconds } = require('../utils/formatters');
const { aplicarZona } = require('../services/zonaPrivacidade');

module.exports = function activitiesRoutes(db) {
  const router = express.Router();

  const VALID_ACTIVITY_TYPES = ['run', 'trail_run', 'treadmill', 'walk', 'cycling', 'swimming', 'strength', 'other'];
  const VALID_PRIVACY_LEVELS = ['public', 'followers', 'private'];

  // Limite de pontos por atividade. A 1 Hz isso cobre ~5h30 de corrida;
  // acima disso o traçado é reamostrado para não estourar a linha do banco.
  const MAX_TRACK_POINTS = 20000;

  /**
   * Valida e normaliza a polilinha recebida do rastreador.
   * Descarta pontos sem coordenadas válidas em vez de gravar lixo.
   * Retorna null quando não sobra nenhum ponto aproveitável.
   */
  function sanitizeTrack(track) {
    if (!Array.isArray(track) || track.length === 0) return null;

    const points = [];
    for (const raw of track) {
      if (!raw || typeof raw !== 'object') continue;
      const lat = Number(raw.lat);
      const lon = Number(raw.lon ?? raw.lng);
      if (!isFinite(lat) || !isFinite(lon)) continue;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

      const t = Number(raw.t ?? raw.timestamp);
      const acc = Number(raw.acc ?? raw.accuracy);
      const alt = Number(raw.alt ?? raw.altitude);

      points.push({
        lat: +lat.toFixed(6),
        lon: +lon.toFixed(6),
        t: isFinite(t) && t > 0 ? Math.round(t) : null,
        acc: isFinite(acc) && acc >= 0 ? +acc.toFixed(1) : null,
        alt: isFinite(alt) ? +alt.toFixed(1) : null,
      });
    }

    if (points.length === 0) return null;

    if (points.length <= MAX_TRACK_POINTS) return points;

    // Reamostragem uniforme preservando o primeiro e o último ponto.
    const step = points.length / MAX_TRACK_POINTS;
    const reduced = [];
    for (let i = 0; i < MAX_TRACK_POINTS; i++) reduced.push(points[Math.floor(i * step)]);
    reduced[reduced.length - 1] = points[points.length - 1];
    return reduced;
  }

  /**
   * Limite de amostras de FC por atividade. A ~1 Hz cobre mais de 5 h de
   * corrida; acima disso a série é reamostrada.
   */
  const MAX_HR_SAMPLES = 20000;

  /**
   * Valida a série cardíaca vinda do rastreador. Amostras fora da faixa
   * fisiológica são descartadas em vez de virarem lixo no banco.
   */
  function sanitizeHrSamples(samples) {
    if (!Array.isArray(samples) || samples.length === 0) return null;

    const clean = [];
    for (const raw of samples) {
      if (!raw || typeof raw !== 'object') continue;
      const t = Number(raw.t ?? raw.seconds);
      const bpm = Number(raw.bpm ?? raw.hr);
      if (!isFinite(t) || t < 0) continue;
      if (!isFinite(bpm) || bpm < 30 || bpm > 250) continue;
      clean.push({ t: Math.round(t), bpm: Math.round(bpm) });
    }

    if (clean.length === 0) return null;
    if (clean.length <= MAX_HR_SAMPLES) return clean;

    const step = clean.length / MAX_HR_SAMPLES;
    const reduced = [];
    for (let i = 0; i < MAX_HR_SAMPLES; i++) reduced.push(clean[Math.floor(i * step)]);
    reduced[reduced.length - 1] = clean[clean.length - 1];
    return reduced;
  }

  /** Lê a série cardíaca gravada; null quando a atividade não tem uma. */
  async function readHrSamples(activityId) {
    const row = await db
      .prepare('SELECT samples_json, sample_count FROM activity_hr_samples WHERE activity_id = ?')
      .get(activityId);
    if (!row) return null;
    try {
      const samples = JSON.parse(row.samples_json);
      if (!Array.isArray(samples) || samples.length === 0) return null;
      return { samples, sample_count: row.sample_count };
    } catch {
      return null;
    }
  }

  /**
   * Reparte a série cardíaca nas cinco zonas do atleta.
   * O tempo de cada amostra é o intervalo até a amostra seguinte, e não uma
   * fatia fixa: a cinta pode falhar leituras e uma contagem simples de
   * amostras distorceria a distribuição.
   * Devolve null quando não há zonas ou série — a interface deve dizer que
   * o treino não teve cinta, não desenhar um gráfico vazio.
   */
  async function buildZoneDistribution(userId, samples) {
    if (!samples || samples.length < 2) return null;

    const profile = await db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
    const maxHr = calculateMaxHr({
      age: profile?.date_of_birth
        ? Math.max(15, new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear())
        : 30,
      gender: profile?.gender || 'male',
      weightKg: profile?.weight_kg,
      heightCm: profile?.height_cm,
    });
    const zones = calculateHrZones(maxHr);

    const seconds = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 };
    let total = 0;

    for (let i = 0; i < samples.length - 1; i++) {
      const span = Math.max(0, samples[i + 1].t - samples[i].t);
      if (span === 0) continue;
      const bpm = samples[i].bpm;

      let key = 'Z1';
      for (const zone of ['Z5', 'Z4', 'Z3', 'Z2', 'Z1']) {
        if (bpm >= zones[zone].minBpm) { key = zone; break; }
      }

      seconds[key] += span;
      total += span;
    }

    if (total === 0) return null;

    return {
      max_hr_reference: maxHr,
      // A FC máxima é estimada por idade quando não há teste de campo: a
      // interface precisa dizer isso ao lado do gráfico.
      max_hr_is_estimated: true,
      total_seconds: total,
      zones: Object.fromEntries(
        Object.entries(seconds).map(([zone, sec]) => [
          zone,
          {
            name: zones[zone].name,
            min_bpm: zones[zone].minBpm,
            max_bpm: zones[zone].maxBpm,
            seconds: sec,
            percent: +((sec / total) * 100).toFixed(1),
          },
        ]),
      ),
    };
  }

  /** Distância entre dois pontos GPS, em metros (fórmula de Haversine). */
  function haversineMeters(a, b) {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  /** Lê o traçado gravado; devolve null quando a atividade não tem percurso. */
  async function readTrack(activityId) {
    const row = await db.prepare('SELECT points_json, point_count, started_at FROM activity_tracks WHERE activity_id = ?').get(activityId);
    if (!row) return null;
    try {
      const points = JSON.parse(row.points_json);
      if (!Array.isArray(points) || points.length === 0) return null;
      return { points, point_count: row.point_count, started_at: row.started_at };
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------
  // POST /api/activities — Criar atividade
  // -------------------------------------------------------
  router.post('/', authenticate, async (req, res) => {
    try {
      const {
        type, title, date, distance_km, duration_seconds,
        avg_pace, avg_hr, max_hr, calories, elevation_gain,
        rpe, rpe_score, feeling_notes, workout_rating, image_url, description,
        privacy = 'public', session_id, splits, shoe_id, track, hr_samples
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
        const ownsShoe = await db.prepare('SELECT id FROM shoes WHERE id = ? AND user_id = ?').get(shoe_id, req.user.id);
        if (!ownsShoe) {
          return res.status(400).json({ error: 'shoe_id inválido ou não pertence ao usuário' });
        }
        effectiveShoeId = shoe_id;
      }

      const id = uuidv4();
      const activityDate = date || new Date().toISOString();

      // Get daily status for display
      const todayStr = activityDate.split('T')[0];
      const dailyStatus = await db.prepare('SELECT status FROM daily_status WHERE user_id = ? AND date = ?').get(req.user.id, todayStr);

      const createActivity = db.transaction(async () => {
        await db.prepare(`
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
            await insertSplit.run(
              uuidv4(), id, split.split_number || 1, split.distance_km != null ? Number(split.distance_km) : null,
              split.duration_seconds != null ? Number(split.duration_seconds) : null, split.avg_pace || null,
              split.avg_hr != null ? Number(split.avg_hr) : null, split.elevation_gain != null ? Number(split.elevation_gain) : null
            );
          }
        }

        // Série cardíaca (opcional) — o HUD coleta amostra a amostra da
        // cinta BLE; sem gravá-las não há curva de FC nem zonas do treino.
        const cleanHrSamples = sanitizeHrSamples(hr_samples);
        if (cleanHrSamples) {
          await db.prepare(`
            INSERT INTO activity_hr_samples (activity_id, samples_json, sample_count)
            VALUES (?, ?, ?)
          `).run(id, JSON.stringify(cleanHrSamples), cleanHrSamples.length);
        }

        // Traçado GPS (opcional) — gravado como polilinha única
        const trackPoints = sanitizeTrack(track);
        if (trackPoints) {
          const firstTimestamp = trackPoints.find((p) => p.t != null)?.t ?? null;
          await db.prepare(`
            INSERT INTO activity_tracks (activity_id, points_json, point_count, started_at)
            VALUES (?, ?, ?, ?)
          `).run(
            id,
            JSON.stringify(trackPoints),
            trackPoints.length,
            firstTimestamp != null ? new Date(firstTimestamp).toISOString() : activityDate
          );
        }

        // Check achievements
        await checkAndAwardAchievements(db, req.user.id, numDist, type);
      });

      await createActivity();

      const activity = await db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
      const activitySplits = await db.prepare('SELECT * FROM activity_splits WHERE activity_id = ? ORDER BY split_number').all(id);
      const savedTrack = await readTrack(id);

      res.status(201).json({
        activity,
        splits: activitySplits,
        track_point_count: savedTrack ? savedTrack.point_count : 0,
        hr_sample_count: await readHrSamples(id)?.sample_count || 0,
      });
    } catch (err) {
      console.error('Create activity error:', err);
      res.status(500).json({ error: 'Erro ao criar atividade' });
    }
  });

  // -------------------------------------------------------
  // GET /api/activities — Listar atividades do usuário
  // -------------------------------------------------------
  router.get('/', authenticate, async (req, res) => {
    try {
      const { page = 1, limit = 20, type, from, to } = req.query;
      const parsedPage = Math.max(1, parseInt(page, 10) || 1);
      const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (parsedPage - 1) * parsedLimit;

      let query = 'SELECT * FROM activities WHERE user_id = ?';
      const params = [req.user.id];

      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }

      // Janela de datas — usada pelo calendário mensal, que precisa do mês
      // inteiro e não da paginação por quantidade.
      if (from) {
        query += ' AND date >= ?';
        params.push(String(from));
      }
      if (to) {
        query += ' AND date <= ?';
        params.push(String(to));
      }

      query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
      params.push(parsedLimit, offset);

      const activities = await db.prepare(query).all(...params);
      let countQuery = 'SELECT COUNT(*) as count FROM activities WHERE user_id = ?';
      const countParams = [req.user.id];
      if (type) { countQuery += ' AND type = ?'; countParams.push(type); }
      if (from) { countQuery += ' AND date >= ?'; countParams.push(String(from)); }
      if (to) { countQuery += ' AND date <= ?'; countParams.push(String(to)); }
      const total = await db.prepare(countQuery).get(...countParams);

      // Get likes/comments count for each
      const enriched = await Promise.all(activities.map(async (a) => {
        const likes = await db.prepare('SELECT COUNT(*) as count FROM likes WHERE activity_id = ?').get(a.id);
        const comments = await db.prepare('SELECT COUNT(*) as count FROM comments WHERE activity_id = ?').get(a.id);
        const trackRow = await db.prepare('SELECT point_count FROM activity_tracks WHERE activity_id = ?').get(a.id);
        const hrRow = await db.prepare('SELECT sample_count FROM activity_hr_samples WHERE activity_id = ?').get(a.id);
        return {
          ...a,
          likes_count: likes.count,
          comments_count: comments.count,
          has_track: !!trackRow,
          track_point_count: trackRow ? trackRow.point_count : 0,
          has_hr_series: !!hrRow,
          hr_sample_count: hrRow ? hrRow.sample_count : 0,
        };
      }));

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
  router.get('/stats/summary', authenticate, async (req, res) => {
    try {
      const parsedDays = parseInt(req.query.days, 10);
      const days = (!isNaN(parsedDays) && parsedDays > 0 && parsedDays <= 365) ? parsedDays : 30;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const stats = await db.prepare(`
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

      const byType = await db.prepare(`
        SELECT type, COUNT(*) as count, SUM(distance_km) as total_km
        FROM activities
        WHERE user_id = ? AND date >= ?
        GROUP BY type
      `).all(req.user.id, startDate);

      const weeklyDistances = await db.prepare(`
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
  // GET /api/activities/training-load — Carga aguda x crônica (ACWR)
  // -------------------------------------------------------
  // Razão entre carga aguda (7 dias) e carga crônica (média semanal das
  // últimas 4 semanas), conforme Gabbett (2016). A carga de cada sessão é
  // a sRPE de Foster (1998): duração em minutos x RPE. Quando o atleta não
  // registrou RPE, a sessão entra apenas pela duração (equivalente a RPE 1),
  // e a resposta sinaliza quantas sessões estão nessa condição para que a
  // interface não apresente o número como se fosse completo.
  router.get('/training-load', authenticate, async (req, res) => {
    try {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const acuteStart = new Date(now - 7 * dayMs).toISOString();
      const chronicStart = new Date(now - 28 * dayMs).toISOString();

      const rows = await db.prepare(`
        SELECT date, duration_seconds, rpe_score, rpe
        FROM activities
        WHERE user_id = ? AND date >= ?
        ORDER BY date ASC
      `).all(req.user.id, chronicStart);

      let acuteLoad = 0;
      let chronicLoad = 0;
      let sessionsWithoutRpe = 0;

      for (const row of rows) {
        const minutes = (row.duration_seconds || 0) / 60;
        const rpe = row.rpe_score ?? row.rpe;
        if (rpe == null) sessionsWithoutRpe++;
        const load = minutes * (rpe != null ? rpe : 1);

        chronicLoad += load;
        if (row.date >= acuteStart) acuteLoad += load;
      }

      // Carga crônica é a MÉDIA semanal das 4 semanas.
      const chronicWeekly = chronicLoad / 4;
      const ratio = chronicWeekly > 0 ? +(acuteLoad / chronicWeekly).toFixed(2) : null;

      let zone = null;
      if (ratio != null) {
        if (ratio < 0.8) zone = 'destreinamento';
        else if (ratio <= 1.3) zone = 'ideal';
        else if (ratio <= 1.5) zone = 'atencao';
        else zone = 'sobrecarga';
      }

      res.json({
        acute_load: Math.round(acuteLoad),
        chronic_weekly_load: Math.round(chronicWeekly),
        acwr: ratio,
        zone,
        sessions_28d: rows.length,
        sessions_without_rpe: sessionsWithoutRpe,
        // Sem 28 dias de histórico a razão não é interpretável.
        has_enough_history: rows.length >= 4 && chronicWeekly > 0,
      });
    } catch (err) {
      console.error('Training load error:', err);
      res.status(500).json({ error: 'Erro ao calcular carga de treino' });
    }
  });

  // -------------------------------------------------------
  // GET /api/activities/records — Recordes pessoais (5/10/21/42 km)
  // -------------------------------------------------------
  // Uma atividade conta para uma distância oficial quando percorre pelo
  // menos aquela distância, com tolerância superior (ex.: 21.10 km conta
  // como meia-maratona; 25 km não). O tempo é normalizado para a distância
  // oficial pelo pace médio, que é a convenção usada por apps de corrida.
  router.get('/records', authenticate, async (req, res) => {
    try {
      const DISTANCES = [
        { key: '5k', officialKm: 5, maxKm: 6.5 },
        { key: '10k', officialKm: 10, maxKm: 12.5 },
        { key: '21k', officialKm: 21.0975, maxKm: 24 },
        { key: '42k', officialKm: 42.195, maxKm: 47 },
      ];

      const records = {};

      for (const dist of DISTANCES) {
        const best = await db.prepare(`
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
  router.get('/:id', authenticate, async (req, res) => {
    try {
      const activity = await db.prepare(`
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
        const isFollower = await db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?').get(req.user.id, activity.user_id);
        if (!isFollower) {
          return res.status(403).json({ error: 'Apenas seguidores podem ver esta atividade' });
        }
      }

      const splits = await db.prepare('SELECT * FROM activity_splits WHERE activity_id = ? ORDER BY split_number').all(activity.id);
      const likes = await db.prepare(`
        SELECT l.*, up.name, up.username FROM likes l
        JOIN user_profiles up ON up.user_id = l.user_id
        WHERE l.activity_id = ?
      `).all(activity.id);
      const comments = await db.prepare(`
        SELECT c.*, up.name, up.username, up.avatar_url FROM comments c
        JOIN user_profiles up ON up.user_id = c.user_id
        WHERE c.activity_id = ?
        ORDER BY c.created_at ASC
      `).all(activity.id);

      const hasLiked = await db.prepare('SELECT 1 FROM likes WHERE activity_id = ? AND user_id = ?').get(activity.id, req.user.id);

      const trackBruto = await readTrack(activity.id);
      // A zona de privacidade só age sobre quem NÃO é o dono. Esta é a
      // única rota que entrega o traçado a terceiros — o GPX e o
      // recorte já são restritos ao dono por 403.
      const zonaAplicada = trackBruto
        ? await aplicarZona(db, {
            donoId: activity.user_id,
            leitorId: req.user.id,
            pontos: trackBruto.points,
          })
        : null;

      const hr = await readHrSamples(activity.id);
      const recorte = await db
        .prepare('SELECT trim_start_seconds, trim_end_seconds, original_distance_km, original_duration_seconds FROM activity_trims WHERE activity_id = ?')
        .get(activity.id);

      res.json({
        activity,
        splits,
        track: zonaAplicada ? zonaAplicada.points : null,
        // A tela avisa que o começo e o fim foram escondidos, em vez
        // de mostrar um percurso truncado sem explicação.
        privacy_zone_applied: zonaAplicada ? zonaAplicada.trimmed : false,
        privacy_zone_hid_all: zonaAplicada ? zonaAplicada.fully_hidden : false,
        hr_samples: hr ? hr.samples : null,
        trim: recorte || null,
        zone_distribution: hr ? await buildZoneDistribution(activity.user_id, hr.samples) : null,
        likes: { count: likes.length, users: likes.slice(0, 10), has_liked: !!hasLiked },
        comments: { count: comments.length, items: comments },
      });
    } catch (err) {
      console.error('Get activity details error:', err);
      res.status(500).json({ error: 'Erro ao buscar detalhes da atividade' });
    }
  });

  // -------------------------------------------------------
  // GET /api/activities/:id/gpx — Exportação do percurso em GPX 1.1
  // -------------------------------------------------------
  // Só exporta o que foi realmente medido: pontos sem altitude saem sem
  // <ele>, e pontos sem horário saem sem <time>. Nada é interpolado.
  router.get('/:id/gpx', authenticate, async (req, res) => {
    try {
      const activity = await db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
      if (!activity) {
        return res.status(404).json({ error: 'Atividade não encontrada' });
      }
      if (activity.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Sem permissão para exportar esta atividade' });
      }

      const track = await readTrack(activity.id);
      if (!track) {
        return res.status(404).json({ error: 'Esta atividade não tem traçado GPS gravado' });
      }

      const esc = (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

      const segments = track.points.map((p) => {
        const parts = [`      <trkpt lat="${p.lat}" lon="${p.lon}">`];
        if (p.alt != null) parts.push(`        <ele>${p.alt}</ele>`);
        if (p.t != null) parts.push(`        <time>${new Date(p.t).toISOString()}</time>`);
        parts.push('      </trkpt>');
        return parts.join('\n');
      }).join('\n');

      const gpx = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="RUSH Running" xmlns="http://www.topografix.com/GPX/1/1">',
        '  <metadata>',
        `    <name>${esc(activity.title || 'Atividade RUSH')}</name>`,
        `    <time>${esc(new Date(track.started_at || activity.date).toISOString())}</time>`,
        '  </metadata>',
        '  <trk>',
        `    <name>${esc(activity.title || 'Atividade RUSH')}</name>`,
        '    <trkseg>',
        segments,
        '    </trkseg>',
        '  </trk>',
        '</gpx>',
        ''
      ].join('\n');

      const safeName = String(activity.title || 'atividade')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'atividade';

      res.setHeader('Content-Type', 'application/gpx+xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="rush-${safeName}.gpx"`);
      res.send(gpx);
    } catch (err) {
      console.error('Export GPX error:', err);
      res.status(500).json({ error: 'Erro ao exportar o percurso' });
    }
  });

  // -------------------------------------------------------
  // PUT /api/activities/:id — Editar atividade (legenda, foto, privacidade)
  // -------------------------------------------------------
  router.put('/:id', authenticate, async (req, res) => {
    try {
      const activity = await db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
      if (!activity) {
        return res.status(404).json({ error: 'Atividade não encontrada' });
      }
      if (activity.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Sem permissão para editar esta atividade' });
      }

      const { title, description, feeling_notes, image_url, privacy, rpe_score, workout_rating, shoe_id, type } = req.body;
      const fields = [];
      const values = [];

      // Trocar o tipo é o caso de "marquei como corrida e era esteira".
      if (type !== undefined) {
        if (!VALID_ACTIVITY_TYPES.includes(type)) {
          return res.status(400).json({ error: `Tipo de atividade inválido. Valores aceitos: ${VALID_ACTIVITY_TYPES.join(', ')}` });
        }
        fields.push('type = ?'); values.push(type);
      }

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
          const ownsShoe = await db.prepare('SELECT id FROM shoes WHERE id = ? AND user_id = ?').get(shoe_id, req.user.id);
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
      await db.prepare(`UPDATE activities SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);

      const updated = await db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
      res.json({ activity: updated });
    } catch (err) {
      console.error('Update activity error:', err);
      res.status(500).json({ error: 'Erro ao atualizar atividade' });
    }
  });

  // -------------------------------------------------------
  // POST /api/activities/:id/trim — Recortar o percurso
  // -------------------------------------------------------
  // Para quem esqueceu de parar o relógio. A distância e a duração
  // NÃO são digitadas: são recalculadas a partir dos pontos que
  // sobram dentro da janela, somando Haversine entre eles. Os
  // valores originais ficam guardados para permitir desfazer.
  router.post('/:id/trim', authenticate, async (req, res) => {
    try {
      const activity = await db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
      if (!activity) {
        return res.status(404).json({ error: 'Atividade não encontrada' });
      }
      if (activity.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Sem permissão para editar esta atividade' });
      }

      const track = await readTrack(activity.id);
      if (!track) {
        return res.status(400).json({
          error: 'Esta atividade não tem traçado GPS: não há como recortar o percurso',
        });
      }

      const inicio = Number(req.body?.start_seconds ?? 0);
      const fim = Number(req.body?.end_seconds);
      if (!isFinite(inicio) || inicio < 0) {
        return res.status(400).json({ error: 'start_seconds deve ser um número não negativo' });
      }
      if (!isFinite(fim) || fim <= inicio) {
        return res.status(400).json({ error: 'end_seconds deve ser maior que start_seconds' });
      }

      // O traçado guarda horário absoluto; a janela chega em segundos
      // desde a largada.
      const pontos = track.points.filter((p) => p.t != null);
      if (pontos.length < 2) {
        return res.status(400).json({ error: 'O traçado não tem horários suficientes para recortar' });
      }
      const t0 = pontos[0].t;

      const dentro = pontos.filter((p) => {
        const segundos = (p.t - t0) / 1000;
        return segundos >= inicio && segundos <= fim;
      });

      if (dentro.length < 2) {
        return res.status(400).json({ error: 'A janela escolhida deixa menos de dois pontos de GPS' });
      }

      // Distância refeita ponto a ponto.
      let metros = 0;
      for (let i = 1; i < dentro.length; i++) {
        metros += haversineMeters(dentro[i - 1], dentro[i]);
      }
      const novaDistancia = +(metros / 1000).toFixed(3);
      if (novaDistancia <= 0) {
        return res.status(400).json({ error: 'A janela escolhida não cobre distância nenhuma' });
      }

      const novaDuracao = Math.max(1, Math.round((dentro[dentro.length - 1].t - dentro[0].t) / 1000));
      const novoPace = formatPaceFromSeconds(novaDuracao / novaDistancia);

      const hr = await readHrSamples(activity.id);
      const hrDentro = hr
        ? hr.samples.filter((amostra) => amostra.t >= inicio && amostra.t <= fim)
        : null;

      const recortar = db.transaction(async () => {
        // Guarda o original apenas na primeira vez: recortes seguintes não
        // podem sobrescrever o registro do que foi de fato medido.
        const jaTemOriginal = await db
          .prepare('SELECT activity_id FROM activity_trims WHERE activity_id = ?')
          .get(activity.id);

        if (!jaTemOriginal) {
          await db.prepare(`
            INSERT INTO activity_trims (
              activity_id, original_distance_km, original_duration_seconds, original_avg_pace,
              original_points_json, original_hr_samples_json, trim_start_seconds, trim_end_seconds
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            activity.id, activity.distance_km, activity.duration_seconds, activity.avg_pace,
            JSON.stringify(track.points), hr ? JSON.stringify(hr.samples) : null,
            Math.round(inicio), Math.round(fim),
          );
        } else {
          await db.prepare(`
            UPDATE activity_trims SET trim_start_seconds = ?, trim_end_seconds = ? WHERE activity_id = ?
          `).run(Math.round(inicio), Math.round(fim), activity.id);
        }

        await db.prepare(`
          UPDATE activities
          SET distance_km = ?, duration_seconds = ?, avg_pace = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(novaDistancia, novaDuracao, novoPace, activity.id);

        await db.prepare(`
          UPDATE activity_tracks SET points_json = ?, point_count = ? WHERE activity_id = ?
        `).run(JSON.stringify(dentro), dentro.length, activity.id);

        if (hrDentro && hrDentro.length > 0) {
          await db.prepare(`
            UPDATE activity_hr_samples SET samples_json = ?, sample_count = ? WHERE activity_id = ?
          `).run(JSON.stringify(hrDentro), hrDentro.length, activity.id);
        }

        // Os splits foram calculados sobre o percurso inteiro e deixam de
        // valer: apagar é mais honesto do que manter parciais de um trecho
        // que não existe mais.
        await db.prepare('DELETE FROM activity_splits WHERE activity_id = ?').run(activity.id);
      });

      await recortar();

      res.json({
        activity: await db.prepare('SELECT * FROM activities WHERE id = ?').get(activity.id),
        removed: {
          distance_km: +(activity.distance_km - novaDistancia).toFixed(3),
          duration_seconds: activity.duration_seconds - novaDuracao,
          points: track.points.length - dentro.length,
        },
        can_undo: true,
      });
    } catch (err) {
      console.error('Trim activity error:', err);
      res.status(500).json({ error: 'Erro ao recortar a atividade' });
    }
  });

  // -------------------------------------------------------
  // POST /api/activities/:id/trim/undo — Desfazer o recorte
  // -------------------------------------------------------
  router.post('/:id/trim/undo', authenticate, async (req, res) => {
    try {
      const activity = await db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
      if (!activity) {
        return res.status(404).json({ error: 'Atividade não encontrada' });
      }
      if (activity.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Sem permissão para editar esta atividade' });
      }

      const original = await db
        .prepare('SELECT * FROM activity_trims WHERE activity_id = ?')
        .get(activity.id);
      if (!original) {
        return res.status(404).json({ error: 'Esta atividade não foi recortada' });
      }

      const desfazer = db.transaction(async () => {
        await db.prepare(`
          UPDATE activities
          SET distance_km = ?, duration_seconds = ?, avg_pace = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(
          original.original_distance_km,
          original.original_duration_seconds,
          original.original_avg_pace,
          activity.id,
        );

        if (original.original_points_json) {
          const pontos = JSON.parse(original.original_points_json);
          await db.prepare(`
            UPDATE activity_tracks SET points_json = ?, point_count = ? WHERE activity_id = ?
          `).run(original.original_points_json, pontos.length, activity.id);
        }

        if (original.original_hr_samples_json) {
          const amostras = JSON.parse(original.original_hr_samples_json);
          await db.prepare(`
            UPDATE activity_hr_samples SET samples_json = ?, sample_count = ? WHERE activity_id = ?
          `).run(original.original_hr_samples_json, amostras.length, activity.id);
        }

        await db.prepare('DELETE FROM activity_trims WHERE activity_id = ?').run(activity.id);
      });

      await desfazer();

      res.json({
        activity: await db.prepare('SELECT * FROM activities WHERE id = ?').get(activity.id),
        restored: true,
      });
    } catch (err) {
      console.error('Undo trim error:', err);
      res.status(500).json({ error: 'Erro ao desfazer o recorte' });
    }
  });

  // -------------------------------------------------------
  // DELETE /api/activities/:id
  // -------------------------------------------------------
  router.delete('/:id', authenticate, async (req, res) => {
    try {
      const activity = await db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
      if (!activity) {
        return res.status(404).json({ error: 'Atividade não encontrada' });
      }

      if (activity.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({ error: 'Sem permissão para remover esta atividade' });
      }

      await db.prepare('DELETE FROM activities WHERE id = ?').run(req.params.id);
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
async function checkAndAwardAchievements(db, userId, distanceKm, type) {
  const achievements = await db.prepare('SELECT * FROM achievements').all();
  const earned = await db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?').all(userId);
  const earnedIds = new Set(earned.map(e => e.achievement_id));

  for (const ach of achievements) {
    if (earnedIds.has(ach.id)) continue;

    const criteria = JSON.parse(ach.criteria_json);

    // Single distance achievement
    if (criteria.distance_km && distanceKm >= criteria.distance_km) {
      await awardAchievement(db, userId, ach.id, ach.name);
    }

    // Accumulated distance (30 days)
    if (criteria.distance_km_30d) {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const total = await db.prepare('SELECT COALESCE(SUM(distance_km), 0) as total FROM activities WHERE user_id = ? AND date >= ?').get(userId, startDate);
      if (total.total >= criteria.distance_km_30d) {
        await awardAchievement(db, userId, ach.id, ach.name);
      }
    }

    // Completed workouts
    if (criteria.completed_workouts) {
      const count = await db.prepare('SELECT COUNT(*) as count FROM activities WHERE user_id = ? AND session_id IS NOT NULL').get(userId);
      if (count.count >= criteria.completed_workouts) {
        await awardAchievement(db, userId, ach.id, ach.name);
      }
    }
  }
}

async function awardAchievement(db, userId, achievementId, achievementName) {
  try {
    await db.prepare('INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)').run(userId, achievementId);
    await criarNotificacao(db, {
      userId,
      type: 'achievement',
      message: `🏆 Nova conquista desbloqueada: ${achievementName}!`,
    });
  } catch (e) {
    // Already earned, ignore
  }
}
