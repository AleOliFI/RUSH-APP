// ============================================================
// RUSH RUNNING — Assinatura RUSH PRO
// ------------------------------------------------------------
// Este arquivo já foi escrito em volta do RevenueCat
// (`window.Purchases`). Saiu: a decisão foi usar StoreKit e Play
// Billing direto, sem intermediário. Todo aquele caminho virou
// código morto no mesmo instante, e código morto que fala de
// pagamento é pior do que inútil — parece que funciona.
//
// A REGRA QUE ORGANIZA TUDO AQUI
//
// O app NUNCA decide que alguém é PRO. Ele obtém da loja um
// comprovante, manda para o servidor, e o servidor pergunta à
// loja. A versão anterior chamava uma rota que concedia PRO só
// porque o cliente pediu — bastava estar logado.
//
// O QUE AINDA NÃO FOI PROVADO
//
// A emenda com a loja vive em `compraNaLoja.ts` e está escrita
// contra os tipos reais do plugin — mas nunca rodou num aparelho.
// Compra in-app exige celular de verdade, conta de desenvolvedor e
// produto cadastrado na loja. Compila; funcionar é outra coisa.
// ============================================================

import { subscriptions } from '../api';
import { comprarNaLoja, restaurarNaLoja } from './compraNaLoja';

/** Identificadores dos produtos, como cadastrados nas duas lojas. */
export const PRODUTOS = {
  mensal: 'rush_pro_monthly_2990',
  anual: 'rush_pro_yearly_23880',
};

/** `true` quando o app está rodando empacotado, e não no navegador. */
function ehAppNativo() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

/** Qual loja este aparelho usa. */
function lojaDoAparelho() {
  const plataforma = window.Capacitor?.getPlatform?.();
  if (plataforma === 'ios') return 'apple';
  if (plataforma === 'android') return 'google';
  return null;
}

async function assinar(produtoId) {
  const loja = lojaDoAparelho();

  if (!ehAppNativo() || !loja) {
    throw new Error(
      'A assinatura RUSH PRO é feita pelo aplicativo, na App Store ou no Google Play.',
    );
  }

  let comprovante;
  try {
    comprovante = await comprarNaLoja(produtoId);
  } catch (err) {
    // Desistir da compra não é erro: a tela não deve mostrar alerta.
    if (err?.cancelado || err?.userCancelled) return { cancelada: true };
    throw err;
  }

  // O servidor confere com a loja. Só a resposta dele concede PRO.
  return await subscriptions.verificarCompra(loja, comprovante);
}

export const billing = {
  /** Sete dias de teste. Não envolve pagamento, e é de uso único por conta. */
  async iniciarTesteGratis() {
    return await subscriptions.startTrial();
  },

  async assinarMensal() {
    return await assinar(PRODUTOS.mensal);
  },

  async assinarAnual() {
    return await assinar(PRODUTOS.anual);
  },

  /**
   * Restaurar compras — exigência da Apple para quem vende assinatura.
   *
   * Restaurar é reapresentar o comprovante que a loja já guarda: o
   * servidor reconhece a assinatura, vê que ela pertence a esta
   * conta e devolve o PRO. Por isso passa pelo mesmo caminho.
   */
  async restaurarCompras() {
    const loja = lojaDoAparelho();

    if (!ehAppNativo() || !loja) {
      // No navegador não há o que restaurar: basta ler o que o
      // servidor já sabe desta conta.
      const status = await subscriptions.status();
      return {
        sucesso: true,
        restaurada: status.is_pro,
        mensagem: status.is_pro
          ? 'Sua assinatura está ativa.'
          : 'Nenhuma assinatura ativa encontrada nesta conta.',
      };
    }

    const comprovante = await restaurarNaLoja();
    return await subscriptions.verificarCompra(loja, comprovante);
  },

  /** Quais lojas o servidor consegue verificar hoje. */
  async lojasDisponiveis() {
    return await subscriptions.lojas();
  },

  async cancelar() {
    return await subscriptions.cancel();
  },
};

export default billing;
