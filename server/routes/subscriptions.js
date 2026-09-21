// ============================================================
// RUSH PERFORMANCE — Subscriptions & Recurring Billing Routes
// RUSH PRO (R$ 29,90/mês com 7 dias grátis de teste)
// ============================================================

const express = require('express');
const { randomUUID: uuidv4 } = require('node:crypto');
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
  // POST /api/subscriptions/activate — DESATIVADA
  // -------------------------------------------------------
  // Esta rota concedia PRO por 30 ou 365 dias a QUALQUER conta
  // autenticada que a chamasse. Sem recibo, sem webhook, sem
  // verificacao nenhuma: bastava estar logado e fazer o pedido.
  // E era exatamente o caminho que o checkout web usava.
  //
  // A concessao de PRO passa a ter duas portas, e so duas:
  //
  //   1. o webhook autenticado (/webhook, logo abaixo), e
  //   2. a validacao de recibo de loja no servidor, que ainda
  //      sera construida (StoreKit e Play Billing).
  //
  // Ate a segunda existir, esta rota responde 501. Fechar agora e
  // melhor do que manter de pe um caminho que da PRO de graca: o
  // custo e um botao de assinatura que ainda nao conclui; o custo
  // de deixar aberto e a receita inteira.
  router.post('/activate', authenticate, async (_req, res) => {
    res.status(501).json({
      error: 'A assinatura ainda não pode ser concluída por aqui.',
      code: 'ATIVACAO_SEM_COMPROVACAO',
      detail:
        'A ativação do RUSH PRO passou a exigir comprovação de pagamento verificada pelo servidor. '
        + 'A compra pelas lojas está em implementação.',
    });
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
      // Este segredo tinha um valor literal como fallback, num
      // repositorio PUBLICO, e a checagem so rodava quando
      // NODE_ENV era exatamente 'production'. Qualquer pessoa que
      // lesse o GitHub podia chamar este webhook e se dar PRO.
      //
      // Agora falha FECHADA: sem a variavel de ambiente a rota nao
      // atende ninguem, em ambiente nenhum. Um webhook de pagamento
      // que aceita chamada sem credencial nao e um webhook, e uma
      // porta aberta.
      const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error('⚠️  PAYMENT_WEBHOOK_SECRET não definido — webhook de pagamento recusando tudo.');
        return res.status(503).json({ error: 'Webhook de pagamento não configurado' });
      }

      const authHeader = req.headers.authorization || req.headers['x-webhook-token'];
      if (authHeader !== `Bearer ${webhookSecret}` && authHeader !== webhookSecret) {
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
