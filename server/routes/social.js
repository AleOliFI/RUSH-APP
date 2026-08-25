// ============================================================
// RUSH PERFORMANCE — Social Routes (Feed, Follows, Likes, Comments)
// ============================================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');

module.exports = function socialRoutes(db) {
  const router = express.Router();

  // -------------------------------------------------------
  // GET /api/social/feed — Feed de atividades
  // -------------------------------------------------------
  router.get('/feed', authenticate, (req, res) => {
    try {
      const { page = 1, limit = 20, scope = 'following' } = req.query;
      const parsedPage = Math.max(1, parseInt(page, 10) || 1);
      const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (parsedPage - 1) * parsedLimit;

      let activities;

      if (scope === 'global') {
        // Feed global (public activities)
        activities = db.prepare(`
          SELECT a.*, up.name, up.username, up.avatar_url
          FROM activities a
          JOIN user_profiles up ON up.user_id = a.user_id
          JOIN users u ON u.id = a.user_id AND u.deleted_at IS NULL
          WHERE a.privacy = 'public'
          ORDER BY a.date DESC
          LIMIT ? OFFSET ?
        `).all(parsedLimit, offset);
      } else if (scope === 'academy' && req.user.academy_id) {
        // Feed da assessoria
        activities = db.prepare(`
          SELECT a.*, up.name, up.username, up.avatar_url
          FROM activities a
          JOIN user_profiles up ON up.user_id = a.user_id
          JOIN users u ON u.id = a.user_id AND u.deleted_at IS NULL
          WHERE u.academy_id = ? AND a.privacy IN ('public', 'followers')
          ORDER BY a.date DESC
          LIMIT ? OFFSET ?
        `).all(req.user.academy_id, parsedLimit, offset);
      } else {
        // Feed de quem o user segue + próprio
        activities = db.prepare(`
          SELECT a.*, up.name, up.username, up.avatar_url
          FROM activities a
          JOIN user_profiles up ON up.user_id = a.user_id
          WHERE (
            a.user_id = ?
            OR (a.user_id IN (SELECT followed_id FROM follows WHERE follower_id = ?) AND a.privacy IN ('public', 'followers'))
          )
          ORDER BY a.date DESC
          LIMIT ? OFFSET ?
        `).all(req.user.id, req.user.id, parsedLimit, offset);
      }

      // Enrich with likes/comments
      const enriched = activities.map(a => {
        const likesCount = db.prepare('SELECT COUNT(*) as count FROM likes WHERE activity_id = ?').get(a.id);
        const commentsCount = db.prepare('SELECT COUNT(*) as count FROM comments WHERE activity_id = ?').get(a.id);
        const hasLiked = db.prepare('SELECT 1 FROM likes WHERE activity_id = ? AND user_id = ?').get(a.id, req.user.id);

        // Format duration
        const hours = Math.floor((a.duration_seconds || 0) / 3600);
        const mins = Math.floor(((a.duration_seconds || 0) % 3600) / 60);
        const durationFormatted = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;

        return {
          ...a,
          duration_formatted: durationFormatted,
          likes_count: likesCount.count,
          comments_count: commentsCount.count,
          has_liked: !!hasLiked,
          initials: a.name ? a.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??',
        };
      });

      res.json({ feed: enriched, page: parsedPage, limit: parsedLimit });
    } catch (err) {
      console.error('Get feed error:', err);
      res.status(500).json({ error: 'Erro ao buscar feed' });
    }
  });

  // -------------------------------------------------------
  // POST /api/social/follow/:userId — Seguir
  // -------------------------------------------------------
  router.post('/follow/:userId', authenticate, (req, res) => {
    try {
      const targetId = req.params.userId;

      if (!targetId || targetId === req.user.id) {
        return res.status(400).json({ error: 'Você não pode seguir a si mesmo' });
      }

      const target = db.prepare('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL').get(targetId);
      if (!target) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      const existing = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?').get(req.user.id, targetId);
      if (existing) {
        return res.status(409).json({ error: 'Você já segue este usuário' });
      }

      db.prepare('INSERT INTO follows (follower_id, followed_id) VALUES (?, ?)').run(req.user.id, targetId);

      // Notify
      const profile = db.prepare('SELECT name FROM user_profiles WHERE user_id = ?').get(req.user.id);
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, source_user_id, message)
        VALUES (?, ?, 'follow', ?, ?)
      `).run(uuidv4(), targetId, req.user.id, `${profile?.name || 'Alguém'} começou a seguir você`);

      const followers = db.prepare('SELECT COUNT(*) as count FROM follows WHERE followed_id = ?').get(targetId);
      res.json({ following: true, followers_count: followers.count });
    } catch (err) {
      console.error('Follow error:', err);
      res.status(500).json({ error: 'Erro ao seguir usuário' });
    }
  });

  // -------------------------------------------------------
  // DELETE /api/social/follow/:userId — Deixar de seguir
  // -------------------------------------------------------
  router.delete('/follow/:userId', authenticate, (req, res) => {
    try {
      const targetId = req.params.userId;
      if (!targetId) {
        return res.status(400).json({ error: 'ID do usuário obrigatório' });
      }

      db.prepare('DELETE FROM follows WHERE follower_id = ? AND followed_id = ?').run(req.user.id, targetId);
      const followers = db.prepare('SELECT COUNT(*) as count FROM follows WHERE followed_id = ?').get(targetId);
      res.json({ following: false, followers_count: followers ? followers.count : 0 });
    } catch (err) {
      console.error('Unfollow error:', err);
      res.status(500).json({ error: 'Erro ao deixar de seguir' });
    }
  });

  // -------------------------------------------------------
  // GET /api/social/followers — Seguidores
  // -------------------------------------------------------
  router.get('/followers', authenticate, (req, res) => {
    try {
      const userId = req.query.user_id || req.user.id;
      const followers = db.prepare(`
        SELECT up.*, f.created_at as followed_at
        FROM follows f
        JOIN user_profiles up ON up.user_id = f.follower_id
        WHERE f.followed_id = ?
        ORDER BY f.created_at DESC
      `).all(userId);

      res.json({ followers, count: followers.length });
    } catch (err) {
      console.error('Get followers error:', err);
      res.status(500).json({ error: 'Erro ao buscar seguidores' });
    }
  });

  // -------------------------------------------------------
  // GET /api/social/following — Seguindo
  // -------------------------------------------------------
  router.get('/following', authenticate, (req, res) => {
    try {
      const userId = req.query.user_id || req.user.id;
      const following = db.prepare(`
        SELECT up.*, f.created_at as followed_at
        FROM follows f
        JOIN user_profiles up ON up.user_id = f.followed_id
        WHERE f.follower_id = ?
        ORDER BY f.created_at DESC
      `).all(userId);

      res.json({ following, count: following.length });
    } catch (err) {
      console.error('Get following error:', err);
      res.status(500).json({ error: 'Erro ao buscar seguidos' });
    }
  });

  // -------------------------------------------------------
  // POST /api/social/like/:activityId — Curtir
  // -------------------------------------------------------
  router.post('/like/:activityId', authenticate, (req, res) => {
    try {
      const activityId = req.params.activityId;
      if (!activityId) {
        return res.status(400).json({ error: 'ID da atividade obrigatório' });
      }

      const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
      if (!activity) {
        return res.status(404).json({ error: 'Atividade não encontrada' });
      }

      const existing = db.prepare('SELECT id FROM likes WHERE activity_id = ? AND user_id = ?').get(activityId, req.user.id);

      if (existing) {
        // Unlike
        db.prepare('DELETE FROM likes WHERE id = ?').run(existing.id);
        const count = db.prepare('SELECT COUNT(*) as count FROM likes WHERE activity_id = ?').get(activityId);
        return res.json({ liked: false, likes_count: count.count });
      }

      // Like
      db.prepare('INSERT INTO likes (id, activity_id, user_id) VALUES (?, ?, ?)').run(uuidv4(), activityId, req.user.id);

      // Notify activity owner
      if (activity.user_id !== req.user.id) {
        const profile = db.prepare('SELECT name FROM user_profiles WHERE user_id = ?').get(req.user.id);
        db.prepare(`
          INSERT INTO notifications (id, user_id, type, source_user_id, activity_id, message)
          VALUES (?, ?, 'like', ?, ?, ?)
        `).run(uuidv4(), activity.user_id, req.user.id, activityId, `${profile?.name || 'Alguém'} curtiu sua atividade`);
      }

      const count = db.prepare('SELECT COUNT(*) as count FROM likes WHERE activity_id = ?').get(activityId);
      res.json({ liked: true, likes_count: count.count });
    } catch (err) {
      console.error('Like error:', err);
      res.status(500).json({ error: 'Erro ao processar curtida' });
    }
  });

  // -------------------------------------------------------
  // POST /api/social/comment/:activityId — Comentar
  // -------------------------------------------------------
  router.post('/comment/:activityId', authenticate, (req, res) => {
    try {
      const { content } = req.body;
      const activityId = req.params.activityId;

      if (!activityId) {
        return res.status(400).json({ error: 'ID da atividade obrigatório' });
      }

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: 'Conteúdo do comentário é obrigatório' });
      }

      if (content.trim().length > 1000) {
        return res.status(400).json({ error: 'Comentário deve ter no máximo 1000 caracteres' });
      }

      const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
      if (!activity) {
        return res.status(404).json({ error: 'Atividade não encontrada' });
      }

      const id = uuidv4();
      db.prepare('INSERT INTO comments (id, activity_id, user_id, content) VALUES (?, ?, ?, ?)').run(id, activityId, req.user.id, content.trim());

      // Notify activity owner
      if (activity.user_id !== req.user.id) {
        const profile = db.prepare('SELECT name FROM user_profiles WHERE user_id = ?').get(req.user.id);
        db.prepare(`
          INSERT INTO notifications (id, user_id, type, source_user_id, activity_id, message)
          VALUES (?, ?, 'comment', ?, ?, ?)
        `).run(uuidv4(), activity.user_id, req.user.id, activityId, `${profile?.name || 'Alguém'} comentou na sua atividade`);
      }

      const comment = db.prepare(`
        SELECT c.*, up.name, up.username, up.avatar_url
        FROM comments c
        JOIN user_profiles up ON up.user_id = c.user_id
        WHERE c.id = ?
      `).get(id);

      res.status(201).json(comment);
    } catch (err) {
      console.error('Comment error:', err);
      res.status(500).json({ error: 'Erro ao adicionar comentário' });
    }
  });

  // -------------------------------------------------------
  // DELETE /api/social/comment/:commentId
  // -------------------------------------------------------
  router.delete('/comment/:commentId', authenticate, (req, res) => {
    try {
      const commentId = req.params.commentId;
      if (!commentId) {
        return res.status(400).json({ error: 'ID do comentário obrigatório' });
      }

      const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
      if (!comment) {
        return res.status(404).json({ error: 'Comentário não encontrado' });
      }

      if (comment.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({ error: 'Sem permissão para deletar este comentário' });
      }

      db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
      res.json({ message: 'Comentário removido' });
    } catch (err) {
      console.error('Delete comment error:', err);
      res.status(500).json({ error: 'Erro ao remover comentário' });
    }
  });

  // -------------------------------------------------------
  // GET /api/social/search — Buscar usuários
  // -------------------------------------------------------
  router.get('/search', authenticate, (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        return res.status(400).json({ error: 'Busca deve ter pelo menos 2 caracteres' });
      }

      const cleanQ = q.trim();
      const users = db.prepare(`
        SELECT up.*, u.role
        FROM user_profiles up
        JOIN users u ON u.id = up.user_id
        WHERE u.deleted_at IS NULL AND (up.name LIKE ? OR up.username LIKE ?)
        LIMIT 20
      `).all(`%${cleanQ}%`, `%${cleanQ}%`);

      const enriched = users.map(u => {
        const isFollowing = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?').get(req.user.id, u.user_id);
        return { ...u, is_following: !!isFollowing };
      });

      res.json({ users: enriched });
    } catch (err) {
      console.error('Search users error:', err);
      res.status(500).json({ error: 'Erro na busca de usuários' });
    }
  });

  return router;
};
