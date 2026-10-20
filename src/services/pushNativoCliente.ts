// ============================================================
// RUSH RUNNING — Registro de push no aplicativo nativo
// ------------------------------------------------------------
// No navegador, push é service worker + VAPID. No app empacotado
// nada disso vale: o sistema entrega um TOKEN de dispositivo, via
// APNs no iOS e FCM no Android, e é esse token que o servidor
// guarda.
//
// Os dois caminhos convivem. A mesma pessoa pode ter o site aberto
// no computador e o app no celular, e deve receber nos dois.
//
// ⚠️ NUNCA EXECUTADO. Push nativo exige aparelho de verdade,
// projeto Firebase e, no iOS, a chave do APNs carregada lá.
// ============================================================

import { notifications as notificationsApi } from '../api';

export function ehAppNativo(): boolean {
  return Boolean((window as any).Capacitor?.isNativePlatform?.());
}

function plataforma(): 'ios' | 'android' | null {
  const p = (window as any).Capacitor?.getPlatform?.();
  return p === 'ios' || p === 'android' ? p : null;
}

/** Carregado sob demanda: no navegador este módulo não existe. */
async function carregarPlugin() {
  const { PushNotifications } = await import('@capacitor/push-notifications');
  return PushNotifications;
}

/**
 * Estado da permissão de notificação no app nativo, SEM pedir nada.
 *
 * A tela de ajustes precisa saber em que pé está antes de mostrar o
 * botão — perguntar ao sistema já na abertura seria pedir permissão
 * sem a pessoa ter clicado em nada.
 */
export async function permissaoNativaConcedida(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!ehAppNativo()) return 'prompt';
  try {
    const Push = await carregarPlugin();
    const r = await Push.checkPermissions();
    if (r.receive === 'granted') return 'granted';
    if (r.receive === 'denied') return 'denied';
    return 'prompt';
  } catch (_) {
    return 'prompt';
  }
}

export type ResultadoPushNativo =
  | { estado: 'ligado'; token: string }
  | { estado: 'bloqueado' }
  | { estado: 'indisponivel' }
  | { estado: 'erro'; mensagem: string };

/**
 * Pede permissão, registra no APNs/FCM e manda o token ao servidor.
 *
 * O token chega por EVENTO, não pelo retorno de `register()`. Tratar
 * o retorno como sucesso faria o app parecer registrado sem nunca
 * ter mandado token nenhum — e o push simplesmente não chegaria,
 * sem erro em lugar algum.
 */
export async function ligarPushNativo(): Promise<ResultadoPushNativo> {
  const sistema = plataforma();
  if (!ehAppNativo() || !sistema) return { estado: 'indisponivel' };

  try {
    const Push = await carregarPlugin();

    let permissao = await Push.checkPermissions();
    if (permissao.receive === 'prompt' || permissao.receive === 'prompt-with-rationale') {
      permissao = await Push.requestPermissions();
    }
    if (permissao.receive !== 'granted') {
      return { estado: 'bloqueado' };
    }

    return await new Promise<ResultadoPushNativo>((resolver) => {
      let concluido = false;
      const encerrar = (r: ResultadoPushNativo) => { if (!concluido) { concluido = true; resolver(r); } };

      // Sem limite de tempo, uma falha silenciosa do APNs deixaria a
      // tela girando para sempre.
      const tempo = setTimeout(
        () => encerrar({ estado: 'erro', mensagem: 'O aparelho não respondeu ao registro de notificações.' }),
        20000,
      );

      Push.addListener('registration', async (t: { value: string }) => {
        clearTimeout(tempo);
        try {
          await notificationsApi.pushRegistrarDispositivo(t.value, sistema);
          encerrar({ estado: 'ligado', token: t.value });
        } catch (err: any) {
          encerrar({ estado: 'erro', mensagem: err?.message || 'Falha ao registrar o aparelho.' });
        }
      });

      Push.addListener('registrationError', (e: any) => {
        clearTimeout(tempo);
        encerrar({ estado: 'erro', mensagem: String(e?.error || 'Falha no registro de notificações.') });
      });

      Push.register();
    });
  } catch (err: any) {
    return { estado: 'erro', mensagem: err?.message || 'Não foi possível ativar as notificações.' };
  }
}

/** Desliga: tira o token do servidor e remove os ouvintes. */
export async function desligarPushNativo(token: string | null): Promise<void> {
  try {
    if (token) await notificationsApi.pushRemoverDispositivo(token);
    if (!ehAppNativo()) return;
    const Push = await carregarPlugin();
    await Push.removeAllListeners();
  } catch (err: any) {
    console.error('Push nativo não desligou:', err?.message || err);
  }
}
