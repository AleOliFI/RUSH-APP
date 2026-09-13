// ============================================================
// RUSH PERFORMANCE — Gear Routes (Garagem de Tênis)
// Frota de calçados com quilometragem acumulada automaticamente
// a partir das atividades vinculadas (activities.shoe_id).
// ============================================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');

// Limites de desgaste (fração da vida útil consumida)
const WARNING_THRESHOLD = 0.65;
const CRITICAL_THRESHOLD = 0.9;

/**
 * Converte segundos por km em pace "m:ss /km".
 */
function formatPace(secondsPerKm) {
  if (!secondsPerKm || !isFinite(secondsPerKm) || secondsPerKm <= 0) return null;
  const min = Math.floor(secondsPerKm / 60);
  const sec = Math.round(secondsPerKm % 60);
  return `${min}:${sec < 10 ? '0' : ''}${sec} /km`;
}

/**
 * Deriva status de desgaste a partir da fração consumida.
 * O percentual de degradação da entressola é um PROXY linear de uso,
 * não uma medição física do material.
 */
function deriveStatus(shoe, currentKm, sessionsCount) {
  if (shoe.retired_at) {
    return { status: 'RETIRED', statusLabel: 'Aposentado' };
  }
  const consumed = currentKm / shoe.max_km;
  if (consumed >= CRITICAL_THRESHOLD) {
    return { status: 'CRITICAL', statusLabel: 'Crítico: Colapso de Espuma' };
  }
  if (consumed >= WARNING_THRESHOLD) {
    return { status: 'WARNING', statusLabel: 'Atenção: Entressola Média' };
  }
  if (sessionsCount === 0 && currentKm <= 0) {
    return { status: 'NEW', statusLabel: 'Novo' };
  }
  return { status: 'OPTIMAL', statusLabel: 'Amortecimento Ótimo' };
}

module.exports = function gearRoutes(db) {
  const router = express.Router();

  /**
   * Monta o objeto de calçado no formato consumido pelo app,
   * somando a quilometragem das atividades vinculadas.
   */
  function buildShoe(shoe) {
    const usage = db.prepare(`
      SELECT
        COUNT(*) as sessions_count,
        COALESCE(SUM(distance_km), 0) as distance_km,
        COALESCE(SUM(duration_seconds), 0) as duration_seconds
      FROM activities
      WHERE shoe_id = ?
    `).get(shoe.id);

    const loggedKm = usage.distance_km || 0;
    const currentKm = +(shoe.initial_km + loggedKm).toFixed(1);
    const secondsPerKm = loggedKm > 0 ? usage.duration_seconds / loggedKm : 0;
    const consumedPct = Math.round((currentKm / shoe.max_km) * 100);
    const { status, statusLabel } = deriveStatus(shoe, currentKm, usage.sessions_count);

    return {
      id: shoe.id,
      name: shoe.name,
      modelType: shoe.model_type || 'Rodagem Geral',
      imageUrl: shoe.image_url || null,
      currentKm,
      maxKm: shoe.max_km,
      status,
      statusLabel,
      foamDegradationPct: Math.min(100, Math.max(0, consumedPct)),
      isDefault: !!shoe.is_default,
      colorway: shoe.colorway || '',
      plateTechnology: shoe.plate_technology || '',
      avgPace: formatPace(secondsPerKm) || '—',
      sessionsCount: usage.sessions_count,
      retiredAt: shoe.retired_at,
      purchasedAt: shoe.purchased_at,
    };
  }

  // -------------------------------------------------------
  // GET /api/gear/shoes — Frota completa + resumo agregado
  // -------------------------------------------------------
  router.get('/shoes', authenticate, (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT * FROM shoes WHERE user_id = ?
        ORDER BY retired_at IS NOT NULL, is_default DESC, created_at ASC
      `).all(req.user.id);

      const shoes = rows.map(buildShoe);
      const active = shoes.filter((s) => s.status !== 'RETIRED');
      const retired = shoes.filter((s) => s.status === 'RETIRED');

      const totalKm = +shoes.reduce((sum, s) => sum + s.currentKm, 0).toFixed(1);
      const avgHealth = active.length
        ? Math.round(active.reduce((sum, s) => sum + (100 - s.foamDegradationPct), 0) / active.length)
        : 0;

      res.json({
        shoes,
        summary: {
          total_km: totalKm,
          active_count: active.length,
          retired_count: retired.length,
          avg_health_pct: Math.max(0, Math.min(100, avgHealth)),
          optimal_count: active.filter((s) => s.status === 'OPTIMAL' || s.status === 'NEW').length,
          warning_count: active.filter((s) => s.status === 'WARNING').length,
          critical_count: active.filter((s) => s.status === 'CRITICAL').length,
        },
      });
    } catch (err) {
      console.error('Get shoes error:', err);
      res.status(500).json({ error: 'Erro ao buscar frota de calçados' });
    }
  });

  // -------------------------------------------------------
  // POST /api/gear/shoes — Cadastrar novo par
  // -------------------------------------------------------
  router.post('/shoes', authenticate, (req, res) => {
    try {
      const {
        name,
        model_type,
        colorway,
        plate_technology,
        image_url,
        initial_km,
        max_km,
        is_default,
        purchased_at,
      } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'name é obrigatório' });
      }

      const numInitial = Number(initial_km) || 0;
      const numMax = Number(max_km) || 800;

      if (isNaN(numInitial) || numInitial < 0 || numInitial > 5000) {
        return res.status(400).json({ error: 'initial_km deve estar entre 0 e 5000' });
      }
      if (isNaN(numMax) || numMax < 50 || numMax > 5000) {
        return res.status(400).json({ error: 'max_km deve estar entre 50 e 5000' });
      }

      const id = uuidv4();
      const makeDefault = is_default ? 1 : 0;

      const insert = db.transaction(() => {
        if (makeDefault) {
          db.prepare('UPDATE shoes SET is_default = 0 WHERE user_id = ?').run(req.user.id);
        }
        db.prepare(`
          INSERT INTO shoes (id, user_id, name, model_type, colorway, plate_technology,
                             image_url, initial_km, max_km, is_default, purchased_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          req.user.id,
          name.trim().slice(0, 80),
          model_type || null,
          colorway || null,
          plate_technology || null,
          image_url || null,
          numInitial,
          numMax,
          makeDefault,
          purchased_at || null,
        );
      });
      insert();

      const created = db.prepare('SELECT * FROM shoes WHERE id = ?').get(id);
      res.status(201).json(buildShoe(created));
    } catch (err) {
      console.error('Create shoe error:', err);
      res.status(500).json({ error: 'Erro ao cadastrar calçado' });
    }
  });

  // -------------------------------------------------------
  // PUT /api/gear/shoes/:id — Editar par
  // -------------------------------------------------------
  router.put('/shoes/:id', authenticate, (req, res) => {
    try {
      const shoe = db.prepare('SELECT * FROM shoes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
      if (!shoe) {
        return res.status(404).json({ error: 'Calçado não encontrado' });
      }

      const fields = [];
      const values = [];
      const { name, model_type, colorway, plate_technology, image_url, max_km, is_default } = req.body;

      if (name !== undefined) {
        if (!String(name).trim()) return res.status(400).json({ error: 'name não pode ser vazio' });
        fields.push('name = ?'); values.push(String(name).trim().slice(0, 80));
      }
      if (model_type !== undefined) { fields.push('model_type = ?'); values.push(model_type || null); }
      if (colorway !== undefined) { fields.push('colorway = ?'); values.push(colorway || null); }
      if (plate_technology !== undefined) { fields.push('plate_technology = ?'); values.push(plate_technology || null); }
      if (image_url !== undefined) { fields.push('image_url = ?'); values.push(image_url || null); }
      if (max_km !== undefined) {
        const numMax = Number(max_km);
        if (isNaN(numMax) || numMax < 50 || numMax > 5000) {
          return res.status(400).json({ error: 'max_km deve estar entre 50 e 5000' });
        }
        fields.push('max_km = ?'); values.push(numMax);
      }

      const apply = db.transaction(() => {
        if (is_default !== undefined && is_default) {
          db.prepare('UPDATE shoes SET is_default = 0 WHERE user_id = ?').run(req.user.id);
          fields.push('is_default = ?'); values.push(1);
        } else if (is_default !== undefined) {
          fields.push('is_default = ?'); values.push(0);
        }

        if (fields.length) {
          values.push(req.params.id);
          db.prepare(`UPDATE shoes SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
        }
      });
      apply();

      const updated = db.prepare('SELECT * FROM shoes WHERE id = ?').get(req.params.id);
      res.json(buildShoe(updated));
    } catch (err) {
      console.error('Update shoe error:', err);
      res.status(500).json({ error: 'Erro ao atualizar calçado' });
    }
  });

  // -------------------------------------------------------
  // POST /api/gear/shoes/:id/retire — Aposentar par
  // -------------------------------------------------------
  router.post('/shoes/:id/retire', authenticate, (req, res) => {
    try {
      const shoe = db.prepare('SELECT * FROM shoes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
      if (!shoe) {
        return res.status(404).json({ error: 'Calçado não encontrado' });
      }
      if (shoe.retired_at) {
        return res.status(400).json({ error: 'Calçado já está aposentado' });
      }

      db.prepare(`
        UPDATE shoes SET retired_at = datetime('now'), is_default = 0, updated_at = datetime('now')
        WHERE id = ?
      `).run(req.params.id);

      const updated = db.prepare('SELECT * FROM shoes WHERE id = ?').get(req.params.id);
      res.json(buildShoe(updated));
    } catch (err) {
      console.error('Retire shoe error:', err);
      res.status(500).json({ error: 'Erro ao aposentar calçado' });
    }
  });

  // -------------------------------------------------------
  // POST /api/gear/shoes/:id/reactivate — Voltar à rotação
  // -------------------------------------------------------
  router.post('/shoes/:id/reactivate', authenticate, (req, res) => {
    try {
      const shoe = db.prepare('SELECT * FROM shoes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
      if (!shoe) {
        return res.status(404).json({ error: 'Calçado não encontrado' });
      }

      db.prepare("UPDATE shoes SET retired_at = NULL, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
      const updated = db.prepare('SELECT * FROM shoes WHERE id = ?').get(req.params.id);
      res.json(buildShoe(updated));
    } catch (err) {
      console.error('Reactivate shoe error:', err);
      res.status(500).json({ error: 'Erro ao reativar calçado' });
    }
  });

  // -------------------------------------------------------
  // DELETE /api/gear/shoes/:id — Remover par da frota
  // -------------------------------------------------------
  router.delete('/shoes/:id', authenticate, (req, res) => {
    try {
      const shoe = db.prepare('SELECT * FROM shoes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
      if (!shoe) {
        return res.status(404).json({ error: 'Calçado não encontrado' });
      }

      db.prepare('DELETE FROM shoes WHERE id = ?').run(req.params.id);
      res.json({ success: true, id: req.params.id });
    } catch (err) {
      console.error('Delete shoe error:', err);
      res.status(500).json({ error: 'Erro ao remover calçado' });
    }
  });

  return router;
};
