// ============================================================
// RUSH RUNNING — Localização que sobrevive à tela bloqueada
// ------------------------------------------------------------
// O rastreamento da corrida usava `navigator.geolocation`. Na web
// isso é o certo; dentro do app nativo é uma armadilha: o sistema
// suspende a geolocalização do webview quando a tela bloqueia.
//
// Ou seja, exatamente na situação real — celular no bolso, tela
// apagada, correndo — a distância parava de acumular. E parava em
// SILÊNCIO: nenhum erro, só quilômetro que não aparece.
//
// Aqui o app passa a usar um plugin nativo quando está empacotado,
// e segue com o navegador quando é web. A emenda é estreita de
// propósito: este arquivo só entrega posição no mesmo formato que
// o `useRunTracker` já consumia, e toda a lógica de distância,
// filtro de salto e pace continua onde estava.
//
// ⚠️ NADA DISTO FOI EXECUTADO NUM APARELHO.
// Localização em segundo plano só se prova correndo na rua com o
// celular no bolso. O código está escrito contra os tipos reais do
// plugin, mas "compila" e "funciona" são coisas diferentes, e a
// segunda ainda não foi verificada.
// ============================================================

import type { Location } from '@transistorsoft/background-geolocation-types';

/** `true` quando o app está empacotado, e não rodando no navegador. */
export function ehAppNativo(): boolean {
  return Boolean((window as any).Capacitor?.isNativePlatform?.());
}

/**
 * O plugin é carregado sob demanda.
 *
 * Importá-lo no topo faria o bundle da WEB carregar um módulo que
 * só serve ao app nativo — e, pior, o `import` do plugin toca
 * APIs do Capacitor que não existem no navegador.
 */
async function carregarPlugin() {
  const modulo: any = await import('@transistorsoft/capacitor-background-geolocation');
  return modulo.default || modulo.BackgroundGeolocation || modulo;
}

/**
 * Converte a posição do plugin para o formato do navegador.
 *
 * O detalhe que quebraria calado: o plugin entrega `timestamp` como
 * STRING ISO; o `GeolocationPosition` do navegador entrega número em
 * milissegundos. O cálculo de pace divide por essa diferença de
 * tempo — com string, a conta vira NaN e o pace some sem erro.
 */
function paraFormatoDoNavegador(local: Location): GeolocationPosition {
  const momento = typeof local.timestamp === 'number'
    ? local.timestamp
    : Date.parse(String(local.timestamp));

  return {
    coords: {
      latitude: local.coords.latitude,
      longitude: local.coords.longitude,
      accuracy: local.coords.accuracy,
      altitude: local.coords.altitude ?? null,
      altitudeAccuracy: local.coords.altitude_accuracy ?? null,
      heading: local.coords.heading ?? null,
      speed: local.coords.speed ?? null,
      toJSON() { return this; },
    },
    timestamp: Number.isFinite(momento) ? momento : Date.now(),
    toJSON() { return this; },
  } as GeolocationPosition;
}

let inscricao: any = null;

/**
 * Liga o rastreamento nativo.
 *
 * @returns `true` se ligou; `false` se este aparelho não tem o
 *          plugin — e aí quem chama cai no navegador.
 */
export async function iniciarLocalizacaoNativa(
  aoReceberPosicao: (posicao: GeolocationPosition) => void,
  aoErrar: (mensagem: string) => void,
): Promise<boolean> {
  if (!ehAppNativo()) return false;

  try {
    const bg = await carregarPlugin();

    inscricao = bg.onLocation(
      (local: Location) => aoReceberPosicao(paraFormatoDoNavegador(local)),
      (codigo: number) => {
        // 1 = permissão negada, 2 = indisponível, 408 = tempo esgotado.
        aoErrar(codigo === 1
          ? 'Permissão de localização negada. Autorize o acesso ao GPS para medir a distância.'
          : 'Sinal de GNSS indisponível. Vá para uma área aberta e tente novamente.');
      },
    );

    await bg.ready({
      desiredAccuracy: 0, // DESIRED_ACCURACY_HIGH
      distanceFilter: 5,
      // Corrida acabou, rastreamento acaba. Nada de continuar
      // seguindo a pessoa depois que o app sai.
      stopOnTerminate: true,
      startOnBoot: false,
      // O Android exige um serviço em primeiro plano, com
      // notificação visível, para manter o GPS vivo com a tela
      // apagada. Isso não é opcional, e é melhor assim: a pessoa
      // vê que está sendo rastreada.
      foregroundService: true,
      notification: {
        title: 'RUSH RUNNING',
        text: 'Corrida em andamento — medindo distância e ritmo.',
      },
      backgroundPermissionRationale: {
        title: 'Permitir localização o tempo todo?',
        message: 'Para medir a corrida inteira com o celular no bolso e a tela '
          + 'bloqueada, o RUSH precisa da localização em segundo plano.',
        positiveAction: 'Permitir',
        negativeAction: 'Agora não',
      },
      // O app não envia posição para servidor nenhum por conta do
      // plugin: o traçado sobe junto com a corrida, no fim.
      autoSync: false,
      debug: false,
      logLevel: 0,
    });

    await bg.start();
    return true;
  } catch (err: any) {
    console.error('Localização nativa não iniciou:', err?.message || err);
    aoErrar('Não foi possível iniciar o rastreamento de localização.');
    return false;
  }
}

/** Desliga o rastreamento nativo e solta a inscrição. */
export async function pararLocalizacaoNativa(): Promise<void> {
  try {
    if (inscricao?.remove) inscricao.remove();
    inscricao = null;
    if (!ehAppNativo()) return;
    const bg = await carregarPlugin();
    await bg.stop();
  } catch (err: any) {
    console.error('Localização nativa não parou:', err?.message || err);
  }
}
