// ============================================================
// RUSH RUNNING — Web Push no navegador
// ------------------------------------------------------------
// Ligar o push tem três portas em série, e cada uma pode estar
// fechada por um motivo diferente: o navegador pode não suportar,
// o servidor pode não ter chaves VAPID, e o atleta pode ter negado
// a permissão. A tela precisa saber qual delas travou — dizer só
// "não foi possível" deixa a pessoa sem o que fazer.
//
// Uma porta em especial não tem volta: permissão negada só é
// revertida nas configurações do navegador, não por um botão nosso.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { notifications as notificationsApi } from '../api';

export type PushStatus =
  /** Ainda verificando o que o navegador e o servidor suportam. */
  | 'verificando'
  /** O navegador não tem service worker ou PushManager. */
  | 'sem_suporte'
  /** O servidor não cadastrou as chaves VAPID. */
  | 'servidor_sem_chaves'
  /** Tudo pronto, mas o atleta ainda não autorizou. */
  | 'desligado'
  /** O atleta negou. Só as configurações do navegador revertem. */
  | 'bloqueado'
  /** Inscrito e recebendo. */
  | 'ligado';

export interface PushData {
  status: PushStatus;
  isBusy: boolean;
  error: string | null;
  /** Mensagem do último teste, para a tela mostrar o resultado. */
  testMessage: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  sendTest: () => Promise<void>;
}

/** A chave VAPID viaja em base64url; o PushManager exige bytes. */
function base64UrlParaUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const preenchido = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const normalizado = preenchido.replace(/-/g, '+').replace(/_/g, '/');
  const bruto = window.atob(normalizado);
  // O buffer é criado explicitamente: applicationServerKey exige um
  // ArrayBuffer de verdade, não um SharedArrayBuffer.
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i += 1) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

function navegadorSuporta(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function usePushNotifications(enabled = true): PushData {
  const [status, setStatus] = useState<PushStatus>('verificando');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  /** Descobre em qual das três portas estamos, sem pedir nada ao atleta. */
  const verificar = useCallback(async () => {
    if (!navegadorSuporta()) {
      setStatus('sem_suporte');
      return;
    }

    try {
      const chave = await notificationsApi.pushKey();
      if (!chave?.enabled || !chave?.public_key) {
        setStatus('servidor_sem_chaves');
        return;
      }
      setPublicKey(chave.public_key);

      if (Notification.permission === 'denied') {
        setStatus('bloqueado');
        return;
      }

      // Permissão concedida não basta: a inscrição pode ter sido
      // descartada pelo navegador sem avisar ninguém.
      const registro = await navigator.serviceWorker.getRegistration('/sw.js');
      const inscricao = registro ? await registro.pushManager.getSubscription() : null;
      setStatus(inscricao ? 'ligado' : 'desligado');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível verificar as notificações');
      setStatus('desligado');
    }
  }, []);

  useEffect(() => {
    if (enabled) verificar();
  }, [enabled, verificar]);

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setIsBusy(true);
    setError(null);
    setTestMessage(null);

    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') {
        setStatus(permissao === 'denied' ? 'bloqueado' : 'desligado');
        return;
      }

      const registro = await navigator.serviceWorker.register('/sw.js');
      // Sem esperar ficar pronto, o subscribe falha no primeiro clique
      // depois de uma instalação limpa.
      await navigator.serviceWorker.ready;

      const inscricao =
        (await registro.pushManager.getSubscription()) ||
        (await registro.pushManager.subscribe({
          // Sem isto o Chrome recusa: só aceita push que gera notificação visível.
          userVisibleOnly: true,
          applicationServerKey: base64UrlParaUint8Array(publicKey),
        }));

      await notificationsApi.pushSubscribe(inscricao.toJSON());
      setStatus('ligado');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível ativar as notificações');
    } finally {
      setIsBusy(false);
    }
  }, [publicKey]);

  const disable = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    setTestMessage(null);

    try {
      const registro = await navigator.serviceWorker.getRegistration('/sw.js');
      const inscricao = registro ? await registro.pushManager.getSubscription() : null;

      if (inscricao) {
        // O servidor primeiro: se a ordem fosse inversa e a rede caísse,
        // ficaria uma inscrição órfã no banco, recebendo para ninguém.
        await notificationsApi.pushUnsubscribe(inscricao.endpoint).catch(() => {});
        await inscricao.unsubscribe();
      }

      setStatus('desligado');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível desativar as notificações');
    } finally {
      setIsBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    setTestMessage(null);
    try {
      const resposta = await notificationsApi.pushTest();
      setTestMessage(resposta?.message || 'Notificação de teste enviada');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar a notificação de teste');
    } finally {
      setIsBusy(false);
    }
  }, []);

  return { status, isBusy, error, testMessage, enable, disable, sendTest };
}
