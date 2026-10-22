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

/**
 * Link do checkout da Cakto, para quem está no navegador.
 *
 * REGRA DAS LOJAS: isto é só para a web. A Apple (diretriz 3.1.1) e o
 * Google proíbem o aplicativo da loja de apontar para pagamento
 * externo de conteúdo digital — um link desses dentro do app
 * empacotado é motivo conhecido de reprovação na revisão. Por isso a
 * função devolve `null` quando está rodando empacotado, e a tela não
 * mostra nem menciona o caminho web.
 *
 * O endereço vem de VITE_CAKTO_CHECKOUT_URL (o link de pagamento que
 * a Cakto gera ao criar o produto no painel). Sem a variável, não há
 * checkout web: a função devolve `null` e a tela volta a dizer que a
 * assinatura é feita pelo aplicativo.
 *
 * O identificador da conta vai junto na URL para o aviso de pagamento
 * conseguir dizer de quem foi a compra. QUAL parâmetro a Cakto
 * devolve no webhook ainda não está confirmado na documentação
 * oficial — por isso mandamos a referência em mais de um nome, e o
 * servidor também sabe casar pelo e-mail (server/services/pagamentos/cakto.js).
 *
 * @param {{id?: string, email?: string, name?: string}} usuario
 * @returns {string|null}
 */
export function linkDoCheckoutWeb(usuario) {
  if (ehAppNativo()) return null;

  const base = import.meta.env.VITE_CAKTO_CHECKOUT_URL;
  if (!base) return null;

  let url;
  try {
    url = new URL(base);
  } catch (_) {
    // Endereço mal configurado não vira link quebrado na cara do
    // usuário: some, e a tela cai no texto de sempre.
    return null;
  }

  if (usuario?.id) {
    url.searchParams.set('src', usuario.id);
    url.searchParams.set('external_reference', usuario.id);
  }
  if (usuario?.email) url.searchParams.set('email', usuario.email);
  if (usuario?.name) url.searchParams.set('name', usuario.name);

  return url.toString();
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
