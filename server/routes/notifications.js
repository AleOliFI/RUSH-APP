// ============================================================
// RUSH PERFORMANCE — Notifications Routes
// ============================================================

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { criarNotificacao, enviarPush, pushDisponivel } = require('../services/notificacoes');

module.exports = function notificationsRoutes(db) {
  const router = express.Router();

  // -------------------------------------------------------
  // GET /api/notifications — Listar notificações
  // -------------------------------------------------------
  router.get('/', authenticate, (req, res) => {
    try {
      const { page = 1, limit = 30 } = req.query;
      const parsedPage = Math.max(1, parseInt(page, 10) || 1);
      const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
      const offset = (parsedPage - 1) * parsedLimit;

      const notifications = db.prepare(`
        SELECT n.*, up.name as source_name, up.username as source_username, up.avatar_url as source_avatar
        FROM notifications n
        LEFT JOIN user_profiles up ON up.user_id = n.source_user_id
        WHERE n.user_id = ?
        ORDER BY n.created_at DESC
        LIMIT ? OFFSET ?
      `).all(req.user.id, parsedLimit, offset);

      const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0').get(req.user.id);

      res.json({
        notifications,
        unread_count: unreadCount ? unreadCount.count : 0,
        page: parsedPage,
        limit: parsedLimit,
      });
    } catch (err) {
      console.error('Get notifications error:', err);
      res.status(500).json({ error: 'Erro ao buscar notificações' });
    }
  });

  // -------------------------------------------------------
  // PUT /api/notifications/read-all — Marcar todas como lidas
  // -------------------------------------------------------
  router.put('/read-all', authenticate, (req, res) => {
    try {
      db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0").run(req.user.id);
      res.json({ message: 'Todas as notificações marcadas como lidas' });
    } catch (err) {
      console.error('Read-all notifications error:', err);
      res.status(500).json({ error: 'Erro ao atualizar notificações' });
    }
  });

  // -------------------------------------------------------
  // PUT /api/notifications/:id/read — Marcar como lida
  // -------------------------------------------------------
  router.put('/:id/read', authenticate, (req, res) => {
    try {
      const notificationId = req.params.id;
      if (!notificationId) {
        return res.status(400).json({ error: 'ID da notificação obrigatório' });
      }

      const result = db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(notificationId, req.user.id);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Notificação não encontrada' });
      }

      res.json({ message: 'Notificação marcada como lida' });
    } catch (err) {
      console.error('Read notification error:', err);
      res.status(500).json({ error: 'Erro ao marcar notificação como lida' });
    }
  });

  // -------------------------------------------------------
  // GET /api/notifications/unread-count
  // -------------------------------------------------------
  router.get('/unread-count', authenticate, (req, res) => {
    try {
      const count = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0').get(req.user.id);
      res.json({ unread_count: count ? count.count : 0 });
    } catch (err) {
      console.error('Get unread count error:', err);
      res.status(500).json({ error: 'Erro ao obter contagem de notificações não lidas' });
    }
  });

  // =======================================================
  // WEB PUSH
  // =======================================================

  // -------------------------------------------------------
  // GET /api/notifications/push/key — Chave pública VAPID
  // -------------------------------------------------------
  // O navegador precisa dela para assinar. É pública por definição;
  // a privada nunca sai do servidor. `enabled: false` diz à tela que
  // o deploy não cadastrou as chaves, em vez de deixá-la oferecer um
  // botão que nunca funcionaria.
  router.get('/push/key', authenticate, (req, res) => {
    res.json({
      enabled: pushDisponivel(),
      public_key: pushDisponivel() ? process.env.VAPID_PUBLIC_KEY : null,
    });
  });

  // -------------------------------------------------------
  // POST /api/notifications/push/subscribe — Registrar aparelho
  // -------------------------------------------------------
  router.post('/push/subscribe', authenticate, (req, res) => {
    try {
      const { endpoint, keys } = req.body || {};

      if (!endpoint || typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint)) {
        return res.status(400).json({ error: 'Endpoint de push inválido' });
      }
      if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') {
        return res.status(400).json({ error: 'Chaves da inscrição ausentes' });
      }
      if (endpoint.length > 2000 || keys.p256dh.length > 500 || keys.auth.length > 500) {
        return res.status(400).json({ error: 'Dados da inscrição acima do tamanho aceito' });
      }

      // O endpoint é a chave: reinscrever o mesmo navegador atualiza a
      // linha, e um endpoint que mudou de dono passa a apontar para o
      // atleta que está logado agora — é o que acontece num aparelho
      // compartilhado, e manter o dono antigo mandaria a notificação
      // dele para a tela de outra pessoa.
      db.prepare(`
        INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, user_agent)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET
          user_id = excluded.user_id,
          p256dh = excluded.p256dh,
          auth = excluded.auth,
          user_agent = excluded.user_agent
      `).run(endpoint, req.user.id, keys.p256dh, keys.auth, (req.get('user-agent') || '').slice(0, 300));

      res.status(201).json({ subscribed: true });
    } catch (err) {
      console.error('Push subscribe error:', err);
      res.status(500).json({ error: 'Erro ao registrar o aparelho para notificações' });
    }
  });

  // -------------------------------------------------------
  // DELETE /api/notifications/push/subscribe — Remover aparelho
  // -------------------------------------------------------
  router.delete('/push/subscribe', authenticate, (req, res) => {
    try {
      const { endpoint } = req.body || {};
      if (!endpoint || typeof endpoint !== 'string') {
        return res.status(400).json({ error: 'Endpoint de push obrigatório' });
      }

      // Só apaga a própria inscrição: conhecer um endpoint alheio não
      // pode bastar para calar as notificações de outra pessoa.
      db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').run(endpoint, req.user.id);
      res.json({ subscribed: false });
    } catch (err) {
      console.error('Push unsubscribe error:', err);
      res.status(500).json({ error: 'Erro ao remover o aparelho' });
    }
  });

  // -------------------------------------------------------
  // POST /api/notifications/push/test — Notificação de teste
  // -------------------------------------------------------
  // Sem isto, a única forma de o atleta saber se o push funciona é
  // esperar alguém curtir uma corrida dele.
  router.post('/push/test', authenticate, async (req, res) => {
    try {
      if (!pushDisponivel()) {
        return res.status(503).json({ error: 'Push não está configurado neste servidor' });
      }

      const inscricoes = db
        .prepare('SELECT COUNT(*) as count FROM push_subscriptions WHERE user_id = ?')
        .get(req.user.id);
      if (!inscricoes.count) {
        return res.status(409).json({ error: 'Nenhum aparelho registrado para receber notificações' });
      }

      const resultado = await enviarPush(db, req.user.id, {
        type: 'system',
        message: 'Notificações do RUSH estão funcionando neste aparelho.',
      });

      res.json({
        sent: resultado.enviados,
        removed: resultado.removidos,
        message: resultado.enviados > 0
          ? 'Notificação de teste enviada'
          : 'Nenhum aparelho respondeu — verifique se as notificações estão liberadas no navegador',
      });
    } catch (err) {
      console.error('Push test error:', err);
      res.status(500).json({ error: 'Erro ao enviar a notificação de teste' });
    }
  });

  return router;
};
