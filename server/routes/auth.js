// ============================================================
// RUSH PERFORMANCE — Auth Routes
// ============================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID: uuidv4, randomInt } = require('node:crypto');
const { generateAccessToken, authenticate, JWT_SECRET } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const { enviarEmail, modeloCodigoDeRecuperacao } = require('../services/email');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/i;

async function generateUniqueRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: 'refresh', jti: uuidv4() },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

module.exports = function authRoutes(db) {
  const router = express.Router();

  // -------------------------------------------------------
  // POST /api/auth/register
  // -------------------------------------------------------
  router.post('/register', async (req, res) => {
    try {
      const { email, password, name, username, distance_km, level } = req.body;

      if (!email || !password || !name || !username) {
        return res.status(400).json({ error: 'Campos obrigatórios: email, password, name, username' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const normalizedUsername = username.trim().toLowerCase();

      if (!EMAIL_REGEX.test(normalizedEmail)) {
        return res.status(400).json({ error: 'Formato de email inválido' });
      }

      if (!USERNAME_REGEX.test(normalizedUsername)) {
        return res.status(400).json({ error: 'Username deve conter de 3 a 30 caracteres alfanuméricos ou _' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
      }

      // Enforce default role 'athlete' on public registration to prevent privilege escalation
      const role = 'athlete';

      // Check existing user
      const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
      if (existing) {
        return res.status(409).json({ error: 'Email já cadastrado' });
      }

      const existingUsername = await db.prepare('SELECT user_id FROM user_profiles WHERE username = ?').get(normalizedUsername);
      if (existingUsername) {
        return res.status(409).json({ error: 'Username já em uso' });
      }

      const userId = uuidv4();
      const passwordHash = await bcrypt.hash(password, 10);

      // Has onboarding flag calculation
      const hasOnboarding = !!(distance_km && level && [5, 10, 21, 42].includes(Number(distance_km)));

      // Transaction: create user + profile + settings + privacy + optional objectives
      const createUser = db.transaction(async () => {
        await db.prepare('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)').run(userId, normalizedEmail, passwordHash, role);

        await db.prepare('INSERT INTO user_profiles (user_id, name, username) VALUES (?, ?, ?)').run(userId, name.trim(), normalizedUsername);

        await db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(userId);

        await db.prepare('INSERT INTO privacy_settings (user_id) VALUES (?)').run(userId);

        if (hasOnboarding) {
          await db.prepare('INSERT INTO user_objectives (user_id, distance_km, level) VALUES (?, ?, ?)').run(userId, Number(distance_km), level);
        }
      });

      await createUser();

      const userPayload = { id: userId, email: normalizedEmail, role, academy_id: null };
      const accessToken = generateAccessToken(userPayload);
      const refreshToken = await generateUniqueRefreshToken(userPayload);

      // Store refresh token
      const refreshId = uuidv4();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db.prepare('INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)').run(refreshId, userId, refreshToken, expiresAt);

      const userResponse = {
        id: userId,
        email: normalizedEmail,
        name: name.trim(),
        username: normalizedUsername,
        role,
        academy_id: null,
        avatar_url: null,
        has_onboarding: hasOnboarding,
      };

      res.status(201).json({
        message: 'Usuário criado com sucesso',
        user: userResponse,
        token: accessToken,
        refreshToken: refreshToken,
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // -------------------------------------------------------
  // POST /api/auth/login
  // -------------------------------------------------------
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const user = await db.prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL').get(normalizedEmail);
      if (!user) {
        return res.status(401).json({ error: 'Email ou senha incorretos' });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Email ou senha incorretos' });
      }

      const profile = await db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(user.id);
      const objectives = await db.prepare('SELECT * FROM user_objectives WHERE user_id = ?').get(user.id);

      const hasOnboarding = !!(objectives && objectives.distance_km && objectives.level);

      const tokenPayload = { id: user.id, email: user.email, role: user.role, academy_id: user.academy_id };
      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = await generateUniqueRefreshToken(tokenPayload);

      // Store refresh token
      const refreshId = uuidv4();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db.prepare('INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)').run(refreshId, user.id, refreshToken, expiresAt);

      const userResponse = {
        id: user.id,
        email: user.email,
        role: user.role,
        academy_id: user.academy_id,
        name: profile?.name || user.email.split('@')[0],
        username: profile?.username || user.email.split('@')[0],
        avatar_url: profile?.avatar_url || null,
        has_onboarding: hasOnboarding,
        distance_km: objectives?.distance_km,
        level: objectives?.level,
      };

      res.json({
        user: userResponse,
        token: accessToken,
        refreshToken: refreshToken,
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // -------------------------------------------------------
  // POST /api/auth/refresh
  // -------------------------------------------------------
  router.post('/refresh', async (req, res) => {
    try {
      const { refresh_token, refreshToken } = req.body;
      const tokenToVerify = refresh_token || refreshToken;

      if (!tokenToVerify) {
        return res.status(400).json({ error: 'Refresh token obrigatório' });
      }

      // Verify JWT signature and payload
      let decoded;
      try {
        decoded = jwt.verify(tokenToVerify, JWT_SECRET);
      } catch (e) {
        return res.status(401).json({ error: 'Refresh token inválido ou expirado' });
      }

      // Check if token exists in DB
      const stored = await db.prepare('SELECT * FROM refresh_tokens WHERE token = ? AND user_id = ?').get(tokenToVerify, decoded.id);
      if (!stored) {
        return res.status(401).json({ error: 'Refresh token não encontrado ou já revogado' });
      }

      // Check expiration
      if (new Date(stored.expires_at) < new Date()) {
        await db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(stored.id);
        return res.status(401).json({ error: 'Refresh token expirado' });
      }

      // Get user
      const user = await db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(decoded.id);
      if (!user) {
        return res.status(401).json({ error: 'Usuário não encontrado' });
      }

      // Generate new unique tokens
      const tokenPayload = { id: user.id, email: user.email, role: user.role, academy_id: user.academy_id };
      const newAccessToken = generateAccessToken(tokenPayload);
      const newRefreshToken = await generateUniqueRefreshToken(tokenPayload);

      // Rotate refresh token atomically: remove consumed token, insert fresh rotated token
      const rotateToken = db.transaction(async () => {
        await db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(stored.id);
        const refreshId = uuidv4();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await db.prepare('INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)').run(refreshId, user.id, newRefreshToken, expiresAt);
      });
      await rotateToken();

      res.json({
        token: newAccessToken,
        refreshToken: newRefreshToken,
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
      });
    } catch (err) {
      console.error('Refresh error:', err);
      return res.status(401).json({ error: 'Refresh token inválido' });
    }
  });

  // -------------------------------------------------------
  // POST /api/auth/logout
  // -------------------------------------------------------
  router.post('/logout', authenticate, async (req, res) => {
    try {
      await db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(req.user.id);
      res.json({ message: 'Logout realizado com sucesso' });
    } catch (err) {
      console.error('Logout error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // -------------------------------------------------------
  // GET /api/auth/me
  // -------------------------------------------------------
  router.get('/me', authenticate, async (req, res) => {
    try {
      const user = await db.prepare('SELECT id, email, role, academy_id, created_at FROM users WHERE id = ? AND deleted_at IS NULL').get(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      const profile = await db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.user.id);
      const objectives = await db.prepare('SELECT * FROM user_objectives WHERE user_id = ?').get(req.user.id);
      const settings = await db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.user.id);
      const privacy = await db.prepare('SELECT * FROM privacy_settings WHERE user_id = ?').get(req.user.id);

      const hasOnboarding = !!(objectives && objectives.distance_km && objectives.level);

      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        academy_id: user.academy_id,
        created_at: user.created_at,
        has_onboarding: hasOnboarding,
        name: profile?.name || user.email.split('@')[0],
        username: profile?.username || user.email.split('@')[0],
        avatar_url: profile?.avatar_url || null,
        bio: profile?.bio || null,
        location: profile?.location || null,
        date_of_birth: profile?.date_of_birth || null,
        gender: profile?.gender || null,
        weight_kg: profile?.weight_kg || null,
        height_cm: profile?.height_cm || null,
        distance_km: objectives?.distance_km,
        level: objectives?.level,
        profile,
        objectives,
        settings,
        privacy,
      });
    } catch (err) {
      console.error('Me error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // -------------------------------------------------------
  // POST /api/auth/forgot-password
  // -------------------------------------------------------
  // A resposta e IDENTICA nos tres casos: e-mail cadastrado, nao
  // cadastrado, e envio que falhou. Qualquer diferenca entre eles
  // — status, texto, ate tempo de resposta — transforma esta rota
  // num verificador de quais e-mails tem conta no RUSH.
  const RESPOSTA_RECUPERACAO = {
    success: true,
    message: 'Se este e-mail tiver conta no RUSH, o código de recuperação chega em instantes.',
  };

  router.post('/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email é obrigatório' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const user = await db.prepare('SELECT id, email FROM users WHERE email = ? AND deleted_at IS NULL').get(normalizedEmail);

      // Sem conta: responde igual e nao faz mais nada.
      if (!user) {
        return res.json(RESPOSTA_RECUPERACAO);
      }

      // Codigo de 6 digitos, com entropia de crypto. Math.random nao
      // e imprevisivel o bastante para credencial de redefinicao.
      const resetCode = String(randomInt(100000, 1000000));
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora

      await db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run(resetCode, expiresAt, user.id);

      // O codigo sai POR E-MAIL e so por e-mail. Devolve-lo aqui —
      // como esta rota fazia — entrega a conta de qualquer pessoa
      // a quem souber o endereco dela.
      const { html, texto } = modeloCodigoDeRecuperacao(resetCode);
      const envio = await enviarEmail({
        para: user.email,
        assunto: 'Código para redefinir sua senha — RUSH RUNNING',
        html,
        texto,
      });

      if (!envio.enviado) {
        // Falhou: registra e segue com a MESMA resposta. Quem pediu
        // nao consegue distinguir isso de um envio bem-sucedido.
        console.error(`✉️  Código de recuperação não enviado (${envio.motivo}).`);
      }

      res.json(RESPOSTA_RECUPERACAO);
    } catch (err) {
      console.error('Forgot password error:', err);
      res.status(500).json({ error: 'Erro ao processar recuperação de senha' });
    }
  });

  // -------------------------------------------------------
  // POST /api/auth/reset-password
  // -------------------------------------------------------
  router.post('/reset-password', async (req, res) => {
    try {
      const { email, code, new_password } = req.body;

      if (!email || !code || !new_password) {
        return res.status(400).json({ error: 'Email, código e nova senha são obrigatórios' });
      }

      if (new_password.length < 6) {
        return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const user = await db.prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL').get(normalizedEmail);

      // Conta inexistente e codigo errado respondem a MESMA coisa.
      // Um 404 aqui dizia "este e-mail nao tem conta" para quem
      // chutasse qualquer codigo.
      if (!user || !user.reset_token || user.reset_token !== String(code).trim()) {
        return res.status(400).json({ error: 'Código de recuperação inválido' });
      }

      if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
        return res.status(400).json({ error: 'Código de recuperação expirado. Solicite outro.' });
      }

      const passwordHash = await bcrypt.hash(new_password, 10);
      await db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?').run(passwordHash, user.id);

      // Auto login: generate fresh tokens
      const userPayload = { id: user.id, email: user.email, role: user.role, academy_id: user.academy_id };
      const accessToken = generateAccessToken(userPayload);
      const refreshToken = await generateUniqueRefreshToken(userPayload);

      const profile = await db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(user.id);
      const objectives = await db.prepare('SELECT * FROM user_objectives WHERE user_id = ?').get(user.id);
      const hasOnboarding = !!(objectives && objectives.distance_km && objectives.level);

      res.json({
        success: true,
        message: 'Senha redefinida com sucesso!',
        token: accessToken,
        refreshToken: refreshToken,
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: profile?.name || user.email.split('@')[0],
          username: profile?.username || user.email.split('@')[0],
          role: user.role,
          has_onboarding: hasOnboarding,
        }
      });
    } catch (err) {
      console.error('Reset password error:', err);
      res.status(500).json({ error: 'Erro ao redefinir senha' });
    }
  });

  return router;
};
