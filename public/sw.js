// ============================================================
// RUSH RUNNING — Service Worker (apenas notificações)
// ------------------------------------------------------------
// Este worker existe só para receber push. Ele NÃO faz cache de
// nada: o app não é offline-first, e um cache mal resolvido aqui
// serviria versão velha do app depois de cada deploy — um problema
// bem pior do que não ter cache.
// ============================================================

// Assume o controle assim que instala, para que a primeira inscrição
// não precise de um recarregamento da página para funcionar.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener('push', (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch (_) {
    // Payload que não é JSON: mostra como texto em vez de sumir.
    dados = { body: evento.data ? evento.data.text() : '' };
  }

  const titulo = dados.title || 'RUSH RUNNING';

  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.body || '',
      icon: '/assets/logo.svg',
      badge: '/assets/logo.svg',
      // A tag agrupa por tipo: dez curtidas viram uma linha, não dez.
      tag: dados.tag || 'rush',
      renotify: true,
      data: { url: dados.url || '/', notification_id: dados.notification_id || null },
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || '/';

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      // Se o app já está aberto, navega na aba existente em vez de
      // abrir uma segunda cópia por cima da primeira.
      for (const janela of janelas) {
        if (janela.url.includes(self.location.origin) && 'focus' in janela) {
          janela.navigate(destino).catch(() => {});
          return janela.focus();
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
