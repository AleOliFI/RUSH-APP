// ============================================================
// RUSH RUNNING — Verificação de compra na App Store
// ------------------------------------------------------------
// O app recebe da loja uma transação ASSINADA (JWS, StoreKit 2).
// O que chega do dispositivo é, do ponto de vista do servidor,
// texto vindo de um cliente — e cliente mente. Só a assinatura da
// Apple distingue uma compra real de uma string inventada.
//
// A verificação é feita pela biblioteca OFICIAL da Apple
// (@apple/app-store-server-library), e isso foi escolha
// deliberada: validar a cadeia de certificados x509 à mão é curto
// para escrever e longo para acertar. Os dois modos de errar são
// ruins — recusar compra legítima irrita quem pagou; aceitar
// recibo forjado dá PRO de graça para qualquer um.
//
// FALHA FECHADA: sem configuração completa, nada é verificado e
// nada é concedido. Um verificador que "passa" quando não está
// configurado é pior do que não ter verificador.
// ============================================================

const { SignedDataVerifier, Environment } = require('@apple/app-store-server-library');

/**
 * O certificado raiz da Apple (AppleRootCA-G3), em base64 do DER.
 *
 * Vem por variável de ambiente e não embutido no repositório por um
 * motivo prático: este é o material que ancora TODA a confiança da
 * verificação. Quem opera o app baixa de
 * https://www.apple.com/certificateauthority/ e confere o que pôs lá.
 *
 *   base64 -w0 AppleRootCA-G3.cer
 */
function certificadosRaiz() {
  const bruto = (process.env.APPLE_ROOT_CA_G3_BASE64 || '').trim();
  if (!bruto) return [];
  return [Buffer.from(bruto, 'base64')];
}

function appleConfigurado() {
  return Boolean(
    process.env.APPLE_BUNDLE_ID
    && (process.env.APPLE_ROOT_CA_G3_BASE64 || '').trim(),
  );
}

/** Produção por padrão. Sandbox só quando pedido explicitamente. */
function ambiente() {
  return String(process.env.APPLE_ENVIRONMENT || '').toLowerCase() === 'sandbox'
    ? Environment.SANDBOX
    : Environment.PRODUCTION;
}

/**
 * Verifica uma transação assinada e devolve o que ela diz.
 *
 * Nunca lança para quem chama: devolve `{ valido, motivo }`. O motivo
 * é um código curto, para a rota registrar no log sem despejar o
 * conteúdo do recibo na resposta.
 *
 * @param {string} transacaoAssinada  o campo signedTransaction
 * @param {object} [deps]  injeção para teste; em produção fica vazio
 * @returns {Promise<{valido: boolean, motivo?: string, dados?: object}>}
 */
async function verificarTransacaoApple(transacaoAssinada, deps = {}) {
  if (!appleConfigurado() && !deps.verificador) {
    return { valido: false, motivo: 'APPLE_NAO_CONFIGURADO' };
  }
  if (typeof transacaoAssinada !== 'string' || transacaoAssinada.length < 20) {
    return { valido: false, motivo: 'TRANSACAO_AUSENTE' };
  }

  try {
    const verificador = deps.verificador || new SignedDataVerifier(
      certificadosRaiz(),
      // Checagem online de revogação e de validade das datas. Ligada:
      // uma assinatura revogada precisa deixar de valer na hora.
      true,
      ambiente(),
      process.env.APPLE_BUNDLE_ID,
      process.env.APPLE_APP_APPLE_ID ? Number(process.env.APPLE_APP_APPLE_ID) : undefined,
    );

    const payload = await verificador.verifyAndDecodeTransaction(transacaoAssinada);

    // A biblioteca ja confere bundleId e assinatura. O que resta e
    // regra de negocio: a assinatura vale AGORA?
    const expiraEm = payload.expiresDate ? new Date(Number(payload.expiresDate)) : null;
    if (!expiraEm || Number.isNaN(expiraEm.getTime())) {
      return { valido: false, motivo: 'SEM_DATA_DE_EXPIRACAO' };
    }
    if (expiraEm <= new Date()) {
      return { valido: false, motivo: 'ASSINATURA_EXPIRADA' };
    }
    // Reembolso e cancelamento pela Apple preenchem revocationDate.
    if (payload.revocationDate) {
      return { valido: false, motivo: 'TRANSACAO_REVOGADA' };
    }

    return {
      valido: true,
      dados: {
        loja: 'apple_app_store',
        // originalTransactionId identifica a ASSINATURA ao longo das
        // renovacoes; transactionId muda a cada cobranca. E o original
        // que serve de chave para nao deixar a mesma compra virar PRO
        // em duas contas.
        idDaAssinatura: String(payload.originalTransactionId || payload.transactionId),
        idDaTransacao: String(payload.transactionId || ''),
        produto: String(payload.productId || ''),
        expiraEm: expiraEm.toISOString(),
      },
    };
  } catch (err) {
    // A excecao da biblioteca traz o motivo da recusa; ela fica no
    // log, e o cliente recebe so um codigo.
    console.error('🍎 Recibo da Apple recusado:', err?.message || err);
    return { valido: false, motivo: 'ASSINATURA_INVALIDA' };
  }
}

module.exports = { verificarTransacaoApple, appleConfigurado };
