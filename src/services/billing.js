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
// O QUE AINDA FALTA, E ESTÁ MARCADO
//
// `comprarNaLoja` é a emenda com o plugin nativo de compra, que
// precisa de um aparelho de verdade para ser ligado e testado.
// Enquanto não existir, ela avisa em vez de fingir. O resto do
// caminho — mandar o comprovante, tratar a resposta — está pronto
// e é o mesmo para as duas lojas.
// ============================================================

import { subscriptions } from '../api';

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

/**
 * Abre a compra na loja do aparelho e devolve o comprovante.
 *
 * ⚠️ PONTO DE LIGAÇÃO COM O PLUGIN NATIVO — ainda não implementado.
 *
 * Quando o plugin de compra for instalado, é aqui que ele entra, e
 * o contrato é curto: devolver a transação assinada (iOS) ou o
 * token de compra (Android) como string. Nada mais. Quem julga o
 * comprovante é o servidor.
 *
 * Até lá, lançar é o comportamento correto: um botão que parece
 * comprar e não compra é pior do que um aviso honesto.
 */
async function comprarNaLoja(_produtoId) {
  throw new Error(
    'A compra pela loja ainda não está ligada neste aplicativo. '
    + 'A verificação no servidor já está pronta; falta o plugin de compra nativo.',
  );
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

    const comprovante = await comprarNaLoja(null);
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
