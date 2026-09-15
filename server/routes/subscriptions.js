// ============================================================
// RUSH PERFORMANCE — Subscriptions & Recurring Billing Routes
// RUSH PRO (R$ 29,90/mês com 7 dias grátis de teste)
// ============================================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { criarNotificacao } = require('../services/notificacoes');

module.exports = function subscriptionsRoutes(db) {
  const router = express.Router();

  // -------------------------------------------------------
  // GET /api/subscriptions/status — Retorna status da assinatura
  // -------------------------------------------------------
  router.get('/status', authenticate, async (req, res) => {
    try {
      const user = await db.prepare(`
        SELECT id, email, role, subscription_tier, subscription_status,
               subscription_provider, trial_ends_at, subscription_expires_at
        FROM users WHERE id = ?
      `).get(req.user.id);

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      const now = new Date();
      let isPro = false;
      let trialDaysLeft = 0;

      // Coaches, owners and admins have PRO access by default
      if (['coach', 'owner', 'admin'].includes(user.role)) {
        isPro = true;
      } else if (user.subscription_tier === 'pro' || user.subscription_tier === 'lifetime') {
        if (user.subscription_status === 'active') {
          isPro = true;
        } else if (user.subscription_status === 'trial' && user.trial_ends_at) {
          const trialEnd = new Date(user.trial_ends_at);
          if (trialEnd > now) {
            isPro = true;
            trialDaysLeft = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
          }
        }
      }

      res.json({
        tier: user.subscription_tier || 'free',
        status: user.subscription_status || 'free',
        is_pro: isPro,
        trial_days_left: trialDaysLeft,
        trial_ends_at: user.trial_ends_at,
        expires_at: user.subscription_expires_at,
        provider: user.subscription_provider,
        monthly_price_brl: 29.90,
      });
    } catch (err) {
      console.error('Subscription status error:', err);
      res.status(500).json({ error: 'Erro ao consultar assinatura' });
    }
  });

  // -------------------------------------------------------
  // POST /api/subscriptions/start-trial — Iniciar 7 dias de teste grátis
  // -------------------------------------------------------
  router.post('/start-trial', authenticate, async (req, res) => {
    try {
      const user = await db.prepare('SELECT subscription_status, trial_ends_at FROM users WHERE id = ?').get(req.user.id);
      
      if (user && user.trial_ends_at) {
        return res.status(400).json({ error: 'Você já utilizou seu período de teste grátis.' });
      }

      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await db.prepare(`
        UPDATE users SET
          subscription_tier = 'pro',
          subscription_status = 'trial',
          trial_ends_at = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(trialEndsAt, req.user.id);

      // Notification
      await criarNotificacao(db, {
        userId: req.user.id,
        type: 'system',
        message: 'Parabéns! Seus 7 dias de teste do RUSH PRO foram ativados com sucesso.',
      });

      res.json({
        success: true,
        message: 'Período de teste grátis de 7 dias ativado!',
        tier: 'pro',
        status: 'trial',
        is_pro: true,
        trial_ends_at: trialEndsAt,
        trial_days_left: 7,
      });
    } catch (err) {
      console.error('Start trial error:', err);
      res.status(500).json({ error: 'Erro ao ativar período de teste' });
    }
  });

  // -------------------------------------------------------
  // POST /api/subscriptions/activate — Ativar assinatura RUSH PRO
  // -------------------------------------------------------
  router.post('/activate', authenticate, async (req, res) => {
    try {
      const { plan_type = 'monthly', provider = 'in_app' } = req.body;
      const days = plan_type === 'yearly' ? 365 : 30;
      const amountCents = plan_type === 'yearly' ? 23880 : 2990;
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const subId = uuidv4();

      db.transaction(async () => {
        await db.prepare(`
          UPDATE users SET
            subscription_tier = 'pro',
            subscription_status = 'active',
            subscription_provider = ?,
            subscription_expires_at = ?,
            updated_at = datetime('now')
          WHERE id = ?
        `).run(provider, expiresAt, req.user.id);

        await db.prepare(`
          INSERT INTO subscriptions (id, user_id, plan_tier, status, amount_cents, currency, provider, current_period_end)
          VALUES (?, ?, 'pro', 'active', ?, 'BRL', ?, ?)
        `).run(subId, req.user.id, amountCents, provider, expiresAt);

        await criarNotificacao(db, {
          userId: req.user.id,
          type: 'system',
          message: 'Sua assinatura RUSH PRO está ativa! Aproveite todos os recursos avançados.',
        });
      })();

      res.json({
        success: true,
        message: 'Assinatura RUSH PRO ativada com sucesso!',
        tier: 'pro',
        status: 'active',
        is_pro: true,
        expires_at: expiresAt,
      });
    } catch (err) {
      console.error('Activate subscription error:', err);
      res.status(500).json({ error: 'Erro ao ativar assinatura' });
    }
  });

  // -------------------------------------------------------
  // POST /api/subscriptions/cancel — Cancelar renovação automática
  // -------------------------------------------------------
  router.post('/cancel', authenticate, async (req, res) => {
    try {
      await db.prepare(`
        UPDATE users SET
          subscription_status = 'canceled',
          updated_at = datetime('now')
        WHERE id = ?
      `).run(req.user.id);

      await db.prepare(`
        UPDATE subscriptions SET
          status = 'canceled',
          canceled_at = datetime('now')
        WHERE user_id = ? AND status = 'active'
      `).run(req.user.id);

      res.json({
        success: true,
        message: 'Renovação automática cancelada com sucesso.',
      });
    } catch (err) {
      console.error('Cancel subscription error:', err);
      res.status(500).json({ error: 'Erro ao cancelar assinatura' });
    }
  });

  // -------------------------------------------------------
  // POST /api/subscriptions/webhook — Webhook Universal de Pagamentos
  // Suporta: RevenueCat (Apple Store / Google Play), Stripe e Asaas (Pix)
  // -------------------------------------------------------
  router.post('/webhook', async (req, res) => {
    try {
      const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || 'rush_webhook_secret_2026';
      const authHeader = req.headers.authorization || req.headers['x-webhook-token'];

      // Optional secret validation in production
      if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${webhookSecret}` && authHeader !== webhookSecret) {
        return res.status(401).json({ error: 'Webhook signature/token inválido' });
      }

      const body = req.body || {};

      // =======================================================
      // CASE 1: RevenueCat Webhook Event (Apple & Google Play)
      // =======================================================
      if (body.event) {
        const event = body.event;
        const type = event.type; // INITIAL_PURCHASE | RENEWAL | CANCELLATION | EXPIRATION | PRODUCT_CHANGE
        const appUserId = event.app_user_id;
        const expirationMs = event.expiration_at_ms;
        const priceInCents = Math.round((event.price || 29.90) * 100);
        const store = event.store === 'APP_STORE' ? 'apple_in_app' : event.store === 'PLAY_STORE' ? 'google_play' : 'revenuecat';

        const user = await db.prepare('SELECT id FROM users WHERE id = ? OR email = ?').get(appUserId, appUserId);
        if (user) {
          const expiresAt = expirationMs ? new Date(expirationMs).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

          if (type === 'INITIAL_PURCHASE' || type === 'RENEWAL' || type === 'NON_RENEWING_PURCHASE') {
            db.transaction(async () => {
              await db.prepare(`
                UPDATE users SET
                  subscription_tier = 'pro',
                  subscription_status = 'active',
                  subscription_provider = ?,
                  subscription_expires_at = ?,
                  updated_at = datetime('now')
                WHERE id = ?
              `).run(store, expiresAt, user.id);

              await db.prepare(`
                INSERT INTO subscriptions (id, user_id, plan_tier, status, amount_cents, currency, provider, current_period_end)
                VALUES (?, ?, 'pro', 'active', ?, 'BRL', ?, ?)
              `).run(uuidv4(), user.id, priceInCents, store, expiresAt);
            })();
          } else if (type === 'CANCELLATION') {
            await db.prepare("UPDATE users SET subscription_status = 'canceled', updated_at = datetime('now') WHERE id = ?").run(user.id);
          } else if (type === 'EXPIRATION') {
            await db.prepare("UPDATE users SET subscription_tier = 'free', subscription_status = 'expired', updated_at = datetime('now') WHERE id = ?").run(user.id);
          }
        }

        return res.json({ received: true, provider: 'revenuecat', type: type });
      }

      // =======================================================
      // CASE 2: Asaas / Pix Webhook Event (Pix Recorrente Brasil)
      // =======================================================
      if (body.event === 'PAYMENT_RECEIVED' || body.event === 'PAYMENT_CONFIRMED') {
        const payment = body.payment || {};
        const customerEmail = payment.customer?.email || payment.email;
        const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(customerEmail);

        if (user) {
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          await db.prepare(`
            UPDATE users SET
              subscription_tier = 'pro',
              subscription_status = 'active',
              subscription_provider = 'asaas_pix',
              subscription_expires_at = ?,
              updated_at = datetime('now')
            WHERE id = ?
          `).run(expiresAt, user.id);
        }

        return res.json({ received: true, provider: 'asaas_pix' });
      }

      // Default acknowledgment
      res.json({ received: true, status: 'processed' });
    } catch (err) {
      console.error('Webhook processing error:', err);
      res.status(500).json({ error: 'Erro ao processar webhook de pagamento' });
    }
  });

  return router;
};
