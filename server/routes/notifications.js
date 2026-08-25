// ============================================================
// RUSH PERFORMANCE — Notifications Routes
// ============================================================

const express = require('express');
const { authenticate } = require('../middleware/auth');

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

  return router;
};
