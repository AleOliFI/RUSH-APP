// ============================================================
// RUSH PERFORMANCE — Unified Billing & In-App Purchase Service
//
// Suporta:
// 1. RevenueCat SDK (Apple App Store + Google Play Store)
// 2. Web Checkout & Pix Recorrente (Asaas / Stripe)
// ============================================================

import { subscriptions } from '../api';

// ------------------------------------------------------------
// A conclusao de compra esta suspensa de proposito.
//
// O caminho anterior chamava `subscriptions.activate`, que
// concedia PRO no servidor SEM nenhuma comprovacao de pagamento —
// bastava estar logado. A rota foi fechada, e a concessao passou a
// exigir recibo verificado pelo servidor (StoreKit / Play Billing),
// que ainda sera construido.
//
// Falhar aqui, com mensagem clara, e melhor do que chamar uma rota
// que responde 501 e devolver "erro desconhecido" para quem tentou
// pagar.
// ------------------------------------------------------------
const MENSAGEM_INDISPONIVEL =
  'A assinatura ainda não pode ser concluída. A compra pelas lojas está em implementação.';

/**
 * Sempre lanca. O `@returns {never}` nao e enfeite: sem ele o
 * TypeScript infere `void` no retorno de quem chama e as telas
 * passam a achar que existe um caminho de sucesso aqui.
 *
 * @returns {never}
 */
function compraIndisponivel() {
  throw new Error(MENSAGEM_INDISPONIVEL);
}

const REVENUECAT_PUBLIC_KEY = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY || 'test_QVdSKIsEdHtkQrZlFpYIDMDByiH';
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
          return compraIndisponivel();
        }
      } catch (err) {
        if (!err.userCancelled) {
          throw new Error(err.message || 'Erro ao processar compra na App Store / Google Play');
        }
        return { cancelled: true };
      }
    }

    // 2. Ambiente Web: ativação direta ou redirecionamento de checkout
    return compraIndisponivel();
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
          return compraIndisponivel();
        }
      } catch (err) {
        if (!err.userCancelled) {
          throw new Error(err.message || 'Erro ao processar compra anual');
        }
        return { cancelled: true };
      }
    }

    return compraIndisponivel();
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
          // Restaurar tambem passa a depender de recibo verificado.
          return compraIndisponivel();
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
