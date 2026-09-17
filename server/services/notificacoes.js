// ============================================================
// RUSH RUNNING — Notificações e Web Push
// ------------------------------------------------------------
// Toda notificação do app passa por criarNotificacao(). Antes cada
// rota fazia seu próprio INSERT, e qualquer coisa nova — como o push
// — teria de ser repetida em dez lugares e esquecida no décimo
// primeiro. Aqui grava-se a linha e dispara-se o push num ponto só.
//
// O envio é deliberadamente assíncrono e tolerante a falha: notificar
// é secundário à ação que a originou. Uma curtida não pode falhar
// porque o serviço de push do navegador está fora do ar.
// ============================================================

const { randomUUID: uuidv4 } = require('node:crypto');

let webpush = null;
let pushConfigurado = false;

/**
 * Liga o push, se as chaves VAPID existirem no ambiente.
 *
 * Sem chaves o app continua inteiro: as notificações são gravadas e
 * aparecem na central, apenas não chegam ao aparelho. É o estado
 * esperado em desenvolvimento e em qualquer deploy que ainda não
 * tenha cadastrado as variáveis.
 */
function configurarPush() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    pushConfigurado = false;
    return false;
  }

  try {
    webpush = require('web-push');
    webpush.setVapidDetails(
      VAPID_SUBJECT || 'mailto:contato@rushrunning.app',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
    );
    pushConfigurado = true;
  } catch (err) {
    console.error('Falha ao configurar Web Push:', err.message);
    pushConfigurado = false;
  }

  return pushConfigurado;
}

function pushDisponivel() {
  return pushConfigurado;
}

/** Título por tipo. O corpo vem da mensagem já gravada na linha. */
const TITULO_POR_TIPO = {
  like: 'Curtiram sua atividade',
  comment: 'Novo comentário',
  follow: 'Novo seguidor',
  achievement: 'Nova conquista',
  challenge: 'Desafio',
  status: 'Status atualizado',
  plan_assigned: 'Novo treino prescrito',
  system: 'RUSH RUNNING',
};

/** Para onde o toque na notificação leva o atleta. */
function rotaDe(notificacao) {
  switch (notificacao.type) {
    case 'like':
    case 'comment':
      return '/feed';
    case 'follow':
      return '/feed';
    case 'plan_assigned':
      return '/treinos';
    case 'achievement':
    case 'challenge':
      return '/perfil';
    default:
      return '/';
  }
}

/** O banco guarda booleanos como 0/1; ausência de linha vale o padrão. */
async function querPush(db, userId) {
  const settings = await db
    .prepare('SELECT notifications_enabled, push_notifications FROM user_settings WHERE user_id = ?')
    .get(userId);

  if (!settings) return true; // Padrão do schema: ambos ligados.
  return settings.notifications_enabled !== 0 && settings.push_notifications !== 0;
}

/**
 * Entrega a uma inscrição. Devolve 'ok', 'morta' (o navegador já
 * descartou a inscrição) ou 'erro' (falha temporária, que não deve
 * apagar nada).
 */
async function entregar(inscricao, payload) {
  try {
    await webpush.sendNotification(
      {
        endpoint: inscricao.endpoint,
        keys: { p256dh: inscricao.p256dh, auth: inscricao.auth },
      },
      payload,
    );
    return 'ok';
  } catch (err) {
    // 404/410 são a forma de o serviço dizer que a inscrição não existe
    // mais — desinstalaram o app, limparam o site, revogaram a permissão.
    if (err.statusCode === 404 || err.statusCode === 410) return 'morta';
    console.error('Falha ao enviar push:', err.statusCode || '', err.message);
    return 'erro';
  }
}

/**
 * Envia uma notificação já gravada para todos os aparelhos do atleta.
 * Exportada à parte para a rota de teste da tela de ajustes.
 */
async function enviarPush(db, userId, notificacao) {
  if (!pushConfigurado || !(await querPush(db, userId))) return { enviados: 0, removidos: 0 };

  const inscricoes = await db
    .prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?')
    .all(userId);
  if (inscricoes.length === 0) return { enviados: 0, removidos: 0 };

  const payload = JSON.stringify({
    title: notificacao.title || TITULO_POR_TIPO[notificacao.type] || 'RUSH RUNNING',
    body: notificacao.message || '',
    tag: notificacao.type,
    url: rotaDe(notificacao),
    notification_id: notificacao.id || null,
  });

  const resultados = await Promise.all(inscricoes.map((i) => entregar(i, payload)));

  let enviados = 0;
  let removidos = 0;
  // for..of em vez de forEach: o callback do forEach não espera
  // promessa, e as escritas abaixo ficariam soltas.
  for (const [indice, resultado] of resultados.entries()) {
    const endpoint = inscricoes[indice].endpoint;
    if (resultado === 'ok') {
      enviados += 1;
      await db.prepare("UPDATE push_subscriptions SET last_success_at = datetime('now') WHERE endpoint = ?").run(endpoint);
    } else if (resultado === 'morta') {
      removidos += 1;
      await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
    }
  }

  return { enviados, removidos };
}

/**
 * Grava a notificação e agenda o push.
 *
 * O INSERT é síncrono, para que quem chamou possa contar com a linha
 * existindo. O push sai num setImmediate, depois que a requisição (e
 * qualquer transação aberta) terminou — e só se a linha ainda estiver
 * lá, o que evita notificar sobre algo que a transação desfez.
 *
 * Nunca lança: uma notificação que falha não pode derrubar a ação.
 */
async function criarNotificacao(db, { userId, type, message, sourceUserId = null, activityId = null }) {
  if (!userId || !type) return null;

  const id = uuidv4();

  try {
    await db.prepare(`
      INSERT INTO notifications (id, user_id, type, source_user_id, activity_id, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, type, sourceUserId, activityId, message ?? null);
  } catch (err) {
    console.error('Falha ao gravar notificação:', err.message);
    return null;
  }

  setImmediate(async () => {
    try {
      const linha = await db.prepare('SELECT id, type, message FROM notifications WHERE id = ?').get(id);
      if (!linha) return; // A transação que a criou foi desfeita.
      enviarPush(db, userId, linha).catch(() => {});
    } catch (_) {
      // Banco fechado (fim de teste, desligamento) — nada a fazer.
    }
  });

  return id;
}

module.exports = { criarNotificacao, enviarPush, configurarPush, pushDisponivel };
