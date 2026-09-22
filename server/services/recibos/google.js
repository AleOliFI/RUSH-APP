// ============================================================
// RUSH RUNNING — Verificação de compra na Google Play
// ------------------------------------------------------------
// O Android não entrega recibo assinado como a Apple: entrega um
// TOKEN de compra, que por si só não prova nada. Quem prova é o
// servidor do Google, consultado com credencial nossa.
//
// São dois passos:
//   1. trocar a chave da conta de serviço por um access token
//      (fluxo JWT bearer do OAuth2);
//   2. perguntar ao androidpublisher o estado daquela assinatura.
//
// Sem SDK: o passo 1 é um JWT RS256 (jsonwebtoken já é dependência
// do projeto) e o passo 2 é um GET. O pacote oficial do Google
// traria dezenas de dependências para fazer exatamente isto.
//
// FALHA FECHADA, como no lado da Apple: sem credencial, nada é
// verificado e nada é concedido.
// ============================================================

const jwt = require('jsonwebtoken');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ESCOPO = 'https://www.googleapis.com/auth/androidpublisher';
const BASE_API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

/**
 * A conta de serviço vem como o JSON que o Google Cloud entrega,
 * inteiro, numa variável de ambiente. Guardar o JSON cru evita o
 * erro classico de quebrar a chave privada ao copiar as quebras de
 * linha para uma variavel separada.
 */
function contaDeServico() {
  const bruto = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!bruto) return null;
  try {
    const conta = JSON.parse(bruto);
    return conta.client_email && conta.private_key ? conta : null;
  } catch (_) {
    return null;
  }
}

function googleConfigurado() {
  return Boolean(process.env.GOOGLE_PLAY_PACKAGE && contaDeServico());
}

/** Troca a chave da conta de servico por um access token. */
async function obterAccessToken(buscar) {
  const conta = contaDeServico();
  if (!conta) return null;

  const agora = Math.floor(Date.now() / 1000);
  const asserção = jwt.sign(
    {
      iss: conta.client_email,
      scope: ESCOPO,
      aud: TOKEN_URL,
      iat: agora,
      exp: agora + 3600,
    },
    conta.private_key,
    { algorithm: 'RS256' },
  );

  const resposta = await buscar(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: asserção,
    }).toString(),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '');
    console.error(`🤖 Google recusou a credencial (${resposta.status}):`, detalhe.slice(0, 200));
    return null;
  }
  const corpo = await resposta.json();
  return corpo?.access_token || null;
}

/**
 * Estados que o Google considera assinatura valendo. Pausada e em
 * periodo de graca NAO entram: quem pausou nao deve continuar com
 * PRO, e periodo de graca e cobranca que falhou.
 */
const ESTADOS_ATIVOS = new Set([
  'SUBSCRIPTION_STATE_ACTIVE',
  'SUBSCRIPTION_STATE_CANCELED', // cancelada mas ainda dentro do periodo pago
]);

/**
 * Verifica um token de compra e devolve o que o Google diz.
 *
 * Nunca lança: devolve `{ valido, motivo }`.
 *
 * @param {string} tokenDeCompra
 * @param {object} [deps] injeção para teste (`buscar` no lugar de fetch)
 */
async function verificarCompraGoogle(tokenDeCompra, deps = {}) {
  const buscar = deps.buscar || fetch;

  if (!deps.buscar && !googleConfigurado()) {
    return { valido: false, motivo: 'GOOGLE_NAO_CONFIGURADO' };
  }
  if (typeof tokenDeCompra !== 'string' || tokenDeCompra.length < 10) {
    return { valido: false, motivo: 'TOKEN_AUSENTE' };
  }

  try {
    const token = deps.accessToken || await obterAccessToken(buscar);
    if (!token) return { valido: false, motivo: 'CREDENCIAL_RECUSADA' };

    const pacote = process.env.GOOGLE_PLAY_PACKAGE || deps.pacote;
    const url = `${BASE_API}/applications/${encodeURIComponent(pacote)}`
      + `/purchases/subscriptionsv2/tokens/${encodeURIComponent(tokenDeCompra)}`;

    const resposta = await buscar(url, { headers: { Authorization: `Bearer ${token}` } });

    if (resposta.status === 404 || resposta.status === 400) {
      // Token que o Google nao reconhece. E o caso de um token
      // inventado, ou de um token de outro aplicativo.
      return { valido: false, motivo: 'COMPRA_DESCONHECIDA' };
    }
    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => '');
      console.error(`🤖 Play recusou a consulta (${resposta.status}):`, detalhe.slice(0, 200));
      return { valido: false, motivo: `HTTP_${resposta.status}` };
    }

    const compra = await resposta.json();
    const estado = String(compra?.subscriptionState || '');
    if (!ESTADOS_ATIVOS.has(estado)) {
      return { valido: false, motivo: `ESTADO_${estado || 'DESCONHECIDO'}` };
    }

    // A data de expiracao vive no item de linha, nao na raiz.
    const item = Array.isArray(compra?.lineItems) ? compra.lineItems[0] : null;
    const expira = item?.expiryTime ? new Date(item.expiryTime) : null;
    if (!expira || Number.isNaN(expira.getTime())) {
      return { valido: false, motivo: 'SEM_DATA_DE_EXPIRACAO' };
    }
    if (expira <= new Date()) {
      return { valido: false, motivo: 'ASSINATURA_EXPIRADA' };
    }

    return {
      valido: true,
      dados: {
        loja: 'google_play',
        // O proprio token identifica a assinatura ao longo das
        // renovacoes; e ele que amarra a compra a uma conta so.
        idDaAssinatura: tokenDeCompra,
        idDaTransacao: String(compra?.latestOrderId || ''),
        produto: String(item?.productId || ''),
        expiraEm: expira.toISOString(),
      },
    };
  } catch (err) {
    console.error('🤖 Falha ao verificar compra no Google:', err?.message || err);
    return { valido: false, motivo: 'FALHA_DE_REDE' };
  }
}

module.exports = { verificarCompraGoogle, googleConfigurado };
