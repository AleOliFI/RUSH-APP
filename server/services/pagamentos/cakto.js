// ============================================================
// RUSH RUNNING — Assinatura pela Cakto (somente no navegador)
// ------------------------------------------------------------
// O QUE ESTA CAMADA FAZ
//
// A Cakto é uma plataforma de checkout: o produto e a oferta são
// criados no painel dela, que gera um link de pagamento. O app não
// cria cobrança — ele manda a pessoa para esse link e espera o aviso
// (webhook) de que o pagamento foi aprovado. Quem libera o PRO é o
// servidor, ao receber o aviso; nunca o cliente.
//
// POR QUE UMA ROTA SEPARADA DA QUE JÁ EXISTE
//
// A rota /api/subscriptions/webhook autentica por cabeçalho
// (`Authorization: Bearer <segredo>`). A Cakto manda o segredo no
// CORPO da requisição, num campo `secret`. Naquela rota, todo aviso
// da Cakto tomaria 401. Pior: o payload da Cakto também tem um campo
// `event`, e aquela rota decide o formato por `if (body.event)` —
// então o aviso cairia no ramo do RevenueCat, não acharia `event.type`
// e devolveria 200 sem fazer nada. Falha silenciosa num caminho de
// pagamento é o pior tipo: a pessoa paga e nada acontece.
//
// O QUE AQUI ESTÁ CONFIRMADO E O QUE NÃO ESTÁ
//
// A documentação oficial (docs.cakto.com.br) está fora do alcance da
// rede deste ambiente — o que eu reuni veio de material de segunda
// mão. Por isso este arquivo não inventa formato: ele procura cada
// informação numa lista de caminhos possíveis e, quando não acha,
// devolve `null` em vez de supor. A rota trata o `null` como "não sei
// de quem é este pagamento" e registra para conferência manual, em
// vez de liberar ou ignorar.
//
// Antes de ligar em produção, confirme com um evento de teste real do
// painel da Cakto: os nomes dos campos de `data` e qual parâmetro do
// link de checkout volta no aviso. `lerEvento` loga o que não
// reconheceu, justamente para essa conferência.
// ============================================================

const crypto = require('crypto');

/** Eventos que dão acesso. */
const EVENTOS_QUE_LIBERAM = new Set([
  'purchase_approved',
  'subscription_renewed',
  'subscription_resumed',
]);

/** Eventos que tiram o acesso, e em que estado deixam a conta. */
const EVENTOS_QUE_SUSPENDEM = new Map([
  ['subscription_canceled', 'canceled'],
  ['subscription_paused', 'canceled'],
  ['subscription_late', 'canceled'],
  ['subscription_renewal_refused', 'canceled'],
  // Devolveu o dinheiro: não é só pausa, o acesso acaba.
  ['refund', 'expired'],
  ['chargeback', 'expired'],
]);

/** 'liberar' | 'suspender' | 'ignorar' — e, ao suspender, o status. */
function classificarEvento(evento) {
  if (EVENTOS_QUE_LIBERAM.has(evento)) return { acao: 'liberar' };
  if (EVENTOS_QUE_SUSPENDEM.has(evento)) {
    return { acao: 'suspender', status: EVENTOS_QUE_SUSPENDEM.get(evento) };
  }
  // purchase_refused, subscription_late_recovered e os que vierem
  // depois: não mexem no acesso por si.
  return { acao: 'ignorar' };
}

/** Comparação que não vaza o segredo pelo tempo de resposta. */
function iguaisEmTempoConstante(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * O aviso veio mesmo da Cakto?
 *
 * Há relato de dois jeitos em uso: assinatura HMAC-SHA256 no cabeçalho
 * `x-cakto-signature` e o segredo no corpo. Quando o cabeçalho vem,
 * ele manda — é a prova mais forte, porque cobre o corpo inteiro.
 * Sem ele, cai no segredo do corpo.
 *
 * @param {object} corpo        Corpo já convertido em objeto.
 * @param {string} corpoBruto   O corpo exatamente como chegou (para o HMAC).
 * @param {object} cabecalhos   req.headers.
 * @param {string} segredo      CAKTO_WEBHOOK_SECRET.
 */
function conferirOrigem(corpo, corpoBruto, cabecalhos, segredo) {
  if (!segredo) return { ok: false, motivo: 'sem segredo configurado' };

  const assinatura = cabecalhos?.['x-cakto-signature'] || cabecalhos?.['X-Cakto-Signature'];
  if (assinatura && typeof corpoBruto === 'string' && corpoBruto.length > 0) {
    const esperada = crypto.createHmac('sha256', segredo).update(corpoBruto, 'utf8').digest('hex');
    const limpa = String(assinatura).replace(/^sha256=/i, '').trim();
    return iguaisEmTempoConstante(limpa.toLowerCase(), esperada)
      ? { ok: true, por: 'assinatura' }
      : { ok: false, motivo: 'assinatura não confere' };
  }

  if (corpo && typeof corpo.secret === 'string') {
    return iguaisEmTempoConstante(corpo.secret, segredo)
      ? { ok: true, por: 'segredo no corpo' }
      : { ok: false, motivo: 'segredo do corpo não confere' };
  }

  return { ok: false, motivo: 'o aviso não trouxe nem assinatura nem segredo' };
}

/** Lê um caminho aninhado ('data.customer.email') sem estourar. */
function valorEm(objeto, caminho) {
  return caminho.split('.').reduce((atual, parte) => (atual == null ? undefined : atual[parte]), objeto);
}

/** Primeiro caminho que tiver conteúdo de verdade. */
function primeiroQueExiste(objeto, caminhos) {
  for (const caminho of caminhos) {
    const valor = valorEm(objeto, caminho);
    if (valor !== undefined && valor !== null && String(valor).trim() !== '') {
      return { valor: String(valor).trim(), caminho };
    }
  }
  return null;
}

// Caminhos candidatos. A ordem importa: o mais específico primeiro.
// Nenhum deles é obrigatório — o que não existir vira `null`, e a
// rota decide o que fazer com a falta.
const CAMINHOS = {
  // Identificador do pedido, usado para não processar o mesmo aviso
  // duas vezes.
  pedido: ['data.id', 'data.refId', 'data.order.id', 'id'],
  // Quem pagou.
  email: ['data.customer.email', 'data.customer_email', 'customer.email', 'data.email'],
  // Referência que o app manda no link do checkout. Qual parâmetro a
  // Cakto devolve ainda não está confirmado na documentação oficial —
  // por isso a lista, e por isso o e-mail continua valendo de reserva.
  referencia: [
    'data.src', 'data.utm_source', 'data.metadata.rush_user_id',
    'data.external_reference', 'data.customer.external_id', 'data.tracking.src',
  ],
  valorCentavos: [],
  fimDoPeriodo: ['data.next_charge_date', 'data.subscription.next_charge_date', 'data.expires_at'],
};

/**
 * Extrai do aviso só o que a rota precisa. Nada é inventado: o que não
 * for encontrado volta `null`.
 */
function lerEvento(corpo) {
  const evento = typeof corpo?.event === 'string' ? corpo.event : null;

  const pedido = primeiroQueExiste(corpo, CAMINHOS.pedido);
  const email = primeiroQueExiste(corpo, CAMINHOS.email);
  const referencia = primeiroQueExiste(corpo, CAMINHOS.referencia);
  const fim = primeiroQueExiste(corpo, CAMINHOS.fimDoPeriodo);

  // O preço pode vir em reais (29.9) ou em centavos (2990), em campos
  // de nomes diferentes. Converter errado grava o valor errado no
  // histórico, então só aceita número e trata reais como reais.
  const precoBruto = valorEm(corpo, 'data.offer.price') ?? valorEm(corpo, 'data.amount') ?? valorEm(corpo, 'data.baseAmount');
  const preco = Number(precoBruto);
  const valorCentavos = Number.isFinite(preco) && preco > 0
    ? (Number.isInteger(preco) && preco >= 1000 ? preco : Math.round(preco * 100))
    : null;

  return {
    evento,
    pedidoId: pedido?.valor ?? null,
    email: email?.valor ? email.valor.toLowerCase() : null,
    referencia: referencia?.valor ?? null,
    valorCentavos,
    fimDoPeriodo: fim?.valor ?? null,
    // Para conferir contra um evento de teste real: mostra de onde
    // cada coisa saiu, e o que não saiu de lugar nenhum.
    origens: {
      pedido: pedido?.caminho ?? null,
      email: email?.caminho ?? null,
      referencia: referencia?.caminho ?? null,
    },
  };
}

module.exports = {
  classificarEvento,
  conferirOrigem,
  lerEvento,
  EVENTOS_QUE_LIBERAM,
  EVENTOS_QUE_SUSPENDEM,
};
