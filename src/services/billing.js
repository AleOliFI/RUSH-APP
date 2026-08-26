// ============================================================
// RUSH PERFORMANCE — Unified Billing & In-App Purchase Service
//
// Suporta:
// 1. RevenueCat SDK (Apple App Store + Google Play Store)
// 2. Web Checkout & Pix Recorrente (Asaas / Stripe)
// ============================================================

import { subscriptions } from '../api';

const REVENUECAT_PUBLIC_KEY = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY || 'appl_rush_demo_key';
const RUSH_PRO_MONTHLY_ID = 'rush_pro_monthly_2990'; // R$ 29,90 / mês com 7 dias trial
const RUSH_PRO_YEARLY_ID = 'rush_pro_yearly_23880'; // R$ 238,80 / ano

export const billing = {
  /**
   * Inicializa o motor de pagamentos (detecta nativo vs web)
   */
  async init(userId) {
    if (window.Purchases) {
      try {
        await window.Purchases.configure({
          apiKey: REVENUECAT_PUBLIC_KEY,
          appUserID: userId,
        });
        console.log('✅ RevenueCat IAP initialized successfully for user:', userId);
      } catch (e) {
        console.warn('RevenueCat init skipped (Web environment):', e.message);
      }
    }
  },

  /**
   * Inicia o teste grátis de 7 dias (RUSH PRO)
   */
  async startFreeTrial() {
    return await subscriptions.startTrial();
  },

  /**
   * Assinar Plano Mensal (R$ 29,90/mês)
   */
  async purchaseMonthly(userId) {
    // 1. Se estiver rodando como app nativo (iOS / Android) via RevenueCat
    if (window.Purchases) {
      try {
        const { customerInfo } = await window.Purchases.purchaseProduct(RUSH_PRO_MONTHLY_ID);
        const isPro = Boolean(customerInfo?.entitlements?.active?.pro);
        if (isPro) {
          return await subscriptions.activate('monthly', 'apple_in_app');
        }
      } catch (err) {
        if (!err.userCancelled) {
          throw new Error(err.message || 'Erro ao processar compra na App Store / Google Play');
        }
        return { cancelled: true };
      }
    }

    // 2. Ambiente Web: ativação direta ou redirecionamento de checkout
    return await subscriptions.activate('monthly', 'web_checkout');
  },

  /**
   * Assinar Plano Anual com Desconto (R$ 238,80/ano)
   */
  async purchaseYearly(userId) {
    if (window.Purchases) {
      try {
        const { customerInfo } = await window.Purchases.purchaseProduct(RUSH_PRO_YEARLY_ID);
        const isPro = Boolean(customerInfo?.entitlements?.active?.pro);
        if (isPro) {
          return await subscriptions.activate('yearly', 'apple_in_app');
        }
      } catch (err) {
        if (!err.userCancelled) {
          throw new Error(err.message || 'Erro ao processar compra anual');
        }
        return { cancelled: true };
      }
    }

    return await subscriptions.activate('yearly', 'web_checkout');
  },

  /**
   * Restaurar Compras Anteriores (Obrigatório para Apple App Store)
   */
  async restorePurchases() {
    if (window.Purchases) {
      try {
        const customerInfo = await window.Purchases.restorePurchases();
        const isPro = Boolean(customerInfo?.entitlements?.active?.pro);
        if (isPro) {
          await subscriptions.activate('monthly', 'apple_in_app');
          return { success: true, restored: true };
        }
        return { success: true, restored: false, message: 'Nenhuma assinatura ativa encontrada para este Apple ID.' };
      } catch (err) {
        throw new Error('Erro ao restaurar compras: ' + err.message);
      }
    }

    // Web Fallback: consulta o backend
    const status = await subscriptions.status();
    return {
      success: true,
      restored: status.is_pro,
      message: status.is_pro ? 'Sua assinatura foi restaurada com sucesso!' : 'Nenhuma assinatura ativa encontrada.',
    };
  },

  /**
   * Cancelar Renovação
   */
  async cancelSubscription() {
    return await subscriptions.cancel();
  },
};

export default billing;
