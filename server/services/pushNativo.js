// ============================================================
// RUSH RUNNING — Push para o aplicativo nativo
// ------------------------------------------------------------
// O Web Push do site não atende o app empacotado. São dois
// mundos diferentes:
//
//   navegador → inscrição com endpoint e chaves, enviada por
//               `web-push` com VAPID;
//   app       → token de dispositivo, enviado pelo FCM (que
//               repassa ao APNs no iOS).
//
// Este arquivo é só o segundo caso. O primeiro continua intacto
// em services/notificacoes.js.
//
// A credencial é a MESMA conta de serviço usada para verificar
// compras na Play — o que muda é o escopo. Uma credencial a menos
// para o dono do app administrar.
//
// FALHA FECHADA: sem FCM_PROJECT_ID e sem conta de serviço, não
// envia nada e diz por quê no log.
//
// ⚠️ NUNCA EXECUTADO contra o FCM. Push nativo exige aparelho,
// projeto Firebase e, no iOS, a chave do APNs carregada lá.
// ============================================================

const jwt = require('jsonwebtoken');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ESCOPO = 'https://www.googleapis.com/auth/firebase.messaging';

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

function pushNativoConfigurado() {
  return Boolean(process.env.FCM_PROJECT_ID && contaDeServico());
}

async function obterAccessToken(buscar) {
  const conta = contaDeServico();
  if (!conta) return null;

  const agora = Math.floor(Date.now() / 1000);
  const asserção = jwt.sign(
    { iss: conta.client_email, scope: ESCOPO, aud: TOKEN_URL, iat: agora, exp: agora + 3600 },
    conta.private_key,
    { algorithm: 'RS256' },
  );

  const r = await buscar(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: asserção,
    }).toString(),
  });

  if (!r.ok) {
    console.error(`📱 FCM recusou a credencial (${r.status}).`);
    return null;
  }
  return (await r.json())?.access_token || null;
}

/**
 * Entrega a UM token.
 *
 * @returns 'ok' | 'morto' | 'erro'
 *   'morto' quando o FCM diz que o token não existe mais —
 *   desinstalaram o app, ou o token foi rotacionado. Esse é o
 *   único caso em que a linha deve sair do banco; um erro
 *   temporário que apagasse o token calaria o aparelho para
 *   sempre.
 */
async function entregarAoDispositivo(token, notificacao, accessToken, deps = {}) {
  const buscar = deps.buscar || fetch;
  const url = `https://fcm.googleapis.com/v1/projects/${process.env.FCM_PROJECT_ID}/messages:send`;

  try {
    const r = await buscar(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title: notificacao.title || 'RUSH RUNNING',
            body: notificacao.message || '',
          },
          // `data` precisa ser string em todo valor: o FCM recusa
          // o envio inteiro se vier número ou null.
          data: {
            tipo: String(notificacao.type || ''),
            url: String(notificacao.url || '/'),
            notification_id: String(notificacao.id || ''),
          },
        },
      }),
    });

    if (r.ok) return 'ok';

    if (r.status === 404 || r.status === 400) {
      const detalhe = await r.text().catch(() => '');
      if (/UNREGISTERED|INVALID_ARGUMENT/i.test(detalhe)) return 'morto';
    }
    console.error(`📱 FCM recusou o envio (${r.status}).`);
    return 'erro';
  } catch (err) {
    console.error('📱 Falha de rede ao enviar push nativo:', err?.message || err);
    return 'erro';
  }
}

/**
 * Envia para todos os aparelhos nativos do atleta.
 *
 * Nunca lança: devolve a contagem. Push que falha não pode
 * derrubar a operação que o disparou — ninguém deve perder uma
 * corrida porque a notificação não saiu.
 */
async function enviarPushNativo(db, userId, notificacao, deps = {}) {
  if (!pushNativoConfigurado() && !deps.buscar) {
    return { enviados: 0, removidos: 0, motivo: 'FCM_NAO_CONFIGURADO' };
  }

  const dispositivos = await db
    .prepare('SELECT token FROM push_devices WHERE user_id = ?')
    .all(userId);
  if (dispositivos.length === 0) return { enviados: 0, removidos: 0 };

  const buscar = deps.buscar || fetch;
  const accessToken = deps.accessToken || await obterAccessToken(buscar);
  if (!accessToken) return { enviados: 0, removidos: 0, motivo: 'CREDENCIAL_RECUSADA' };

  let enviados = 0;
  let removidos = 0;

  for (const { token } of dispositivos) {
    const resultado = await entregarAoDispositivo(token, notificacao, accessToken, deps);
    if (resultado === 'ok') {
      enviados += 1;
      await db.prepare("UPDATE push_devices SET last_success_at = datetime('now') WHERE token = ?").run(token);
    } else if (resultado === 'morto') {
      removidos += 1;
      await db.prepare('DELETE FROM push_devices WHERE token = ?').run(token);
    }
  }

  return { enviados, removidos };
}

module.exports = { enviarPushNativo, pushNativoConfigurado };
