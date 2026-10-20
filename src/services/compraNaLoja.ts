// ============================================================
// RUSH RUNNING — Compra na App Store e na Google Play
// ------------------------------------------------------------
// Esta é a emenda entre o app e a loja do aparelho. Ela faz UMA
// coisa: abrir a compra e devolver o comprovante como string.
//
// Quem julga o comprovante é o servidor — `/subscriptions/
// verificar-compra` pergunta à Apple e ao Google. O app não decide
// que alguém é PRO, e isso é deliberado: a versão anterior
// concedia PRO só porque o cliente pediu.
//
// O QUE O SERVIDOR ESPERA, E POR QUÊ É DIFERENTE EM CADA LOJA
//
//   iOS      → `jwsRepresentation`: a transação ASSINADA pela
//              Apple (StoreKit 2). A assinatura é o que prova.
//   Android  → `purchaseToken`: um token que não prova nada
//              sozinho; quem prova é o servidor do Google, quando
//              consultado com a nossa credencial.
//
// Os dois campos foram lidos dos tipos do plugin, não de memória:
// `SKTransaction.jwsRepresentation` e `GooglePlay.Transaction.
// purchaseToken`.
//
// ⚠️ NUNCA EXECUTADO. Compra in-app exige aparelho de verdade,
// conta de desenvolvedor e produto cadastrado na loja. O código
// está escrito contra os tipos reais do plugin, mas "compila" e
// "funciona" são coisas diferentes.
// ============================================================

import { PRODUTOS } from './billing';

/** `true` quando o app está empacotado, e não no navegador. */
function ehAppNativo(): boolean {
  return Boolean((window as any).Capacitor?.isNativePlatform?.());
}

/** O plugin publica tudo num global, à moda Cordova. */
function loja(): any {
  return (window as any).CdvPurchase;
}

/** Erro de desistência: a tela não deve mostrar alerta para ele. */
export class CompraCancelada extends Error {
  cancelado = true;
  constructor() {
    super('Compra cancelada.');
  }
}

let iniciada = false;

/**
 * Registra os produtos e inicializa a loja. Idempotente: chamar
 * duas vezes não registra os produtos duas vezes.
 */
async function prepararLoja(): Promise<any> {
  const cdv = loja();
  if (!cdv) throw new Error('O componente de compra não está disponível neste aparelho.');

  const { store, Platform, ProductType } = cdv;
  if (iniciada) return store;

  const plataforma = (window as any).Capacitor?.getPlatform?.() === 'ios'
    ? Platform.APPLE_APPSTORE
    : Platform.GOOGLE_PLAY;

  for (const id of Object.values(PRODUTOS)) {
    store.register([{ id, type: ProductType.PAID_SUBSCRIPTION, platform: plataforma }]);
  }

  await store.initialize([plataforma]);
  iniciada = true;
  return store;
}

/**
 * Extrai o comprovante da transação, conforme a loja.
 *
 * Devolve `null` quando o campo não veio — e nesse caso é melhor
 * falhar do que mandar string vazia ao servidor, que responderia
 * um 402 confuso.
 */
function comprovanteDe(transacao: any): string | null {
  // iOS: a transacao assinada pela Apple.
  if (typeof transacao?.jwsRepresentation === 'string' && transacao.jwsRepresentation) {
    return transacao.jwsRepresentation;
  }
  // Android: o token de compra.
  if (typeof transacao?.purchaseToken === 'string' && transacao.purchaseToken) {
    return transacao.purchaseToken;
  }
  return null;
}

/**
 * Abre a compra e resolve com o comprovante.
 *
 * O plugin entrega a transação por evento, não pelo retorno de
 * `order`. Por isso a promessa se resolve no `approved`, e não
 * quando `order` retorna — confundir os dois faria a compra
 * "funcionar" e o PRO nunca chegar.
 */
export async function comprarNaLoja(produtoId: string): Promise<string> {
  if (!ehAppNativo()) {
    throw new Error('A assinatura RUSH PRO é feita pelo aplicativo, na App Store ou no Google Play.');
  }

  const store = await prepararLoja();

  return new Promise<string>((resolver, rejeitar) => {
    let concluido = false;
    const encerrar = (fn: () => void) => { if (!concluido) { concluido = true; fn(); } };

    store.when()
      .approved((transacao: any) => {
        const comprovante = comprovanteDe(transacao);
        if (!comprovante) {
          encerrar(() => rejeitar(new Error('A loja não devolveu o comprovante da compra.')));
          return;
        }
        // `finish` só depois de o servidor confirmar seria o ideal;
        // aqui finalizamos para a loja não repetir a entrega, e a
        // verificação acontece em seguida. Se ela falhar, o
        // "restaurar compras" recupera — é para isso que ele existe.
        transacao.finish?.();
        encerrar(() => resolver(comprovante));
      })
      .finished(() => { /* nada a fazer: o comprovante já saiu no approved */ });

    const produto = store.get(produtoId);
    if (!produto) {
      encerrar(() => rejeitar(new Error(
        `O produto "${produtoId}" não está disponível nesta loja. `
        + 'Confirme se ele foi cadastrado e aprovado no console.',
      )));
      return;
    }

    const oferta = produto.getOffer?.() || produto.offers?.[0];
    if (!oferta) {
      encerrar(() => rejeitar(new Error('Este produto não tem oferta disponível na loja.')));
      return;
    }

    store.order(oferta).then((erro: any) => {
      if (!erro) return;
      // O plugin devolve o erro como valor, não como rejeição.
      const cancelou = /cancel/i.test(String(erro?.code ?? '')) || /cancel/i.test(String(erro?.message ?? ''));
      encerrar(() => rejeitar(cancelou ? new CompraCancelada() : new Error(
        erro?.message || 'Não foi possível concluir a compra na loja.',
      )));
    });
  });
}

/**
 * Restaurar compras — exigência da Apple para quem vende assinatura.
 *
 * Reapresenta à loja o que ela já guarda. O comprovante volta pelo
 * mesmo `approved`, e o servidor reconhece a assinatura.
 */
export async function restaurarNaLoja(): Promise<string> {
  if (!ehAppNativo()) {
    throw new Error('Restaurar compras só funciona no aplicativo.');
  }

  const store = await prepararLoja();

  return new Promise<string>((resolver, rejeitar) => {
    let concluido = false;
    const tempo = setTimeout(() => {
      if (!concluido) { concluido = true; rejeitar(new Error('Nenhuma assinatura ativa encontrada.')); }
    }, 30000);

    store.when().approved((transacao: any) => {
      const comprovante = comprovanteDe(transacao);
      if (!comprovante || concluido) return;
      concluido = true;
      clearTimeout(tempo);
      transacao.finish?.();
      resolver(comprovante);
    });

    store.restorePurchases().catch((err: any) => {
      if (concluido) return;
      concluido = true;
      clearTimeout(tempo);
      rejeitar(new Error(err?.message || 'Não foi possível restaurar as compras.'));
    });
  });
}
