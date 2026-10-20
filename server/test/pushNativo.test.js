// ============================================================
// RUSH RUNNING — Push no app nativo, sem derrubar o da web
// ------------------------------------------------------------
// O push do site é Web Push: inscrição com endpoint e duas chaves,
// enviada por VAPID. O app empacotado não tem nada disso — ele tem
// um TOKEN de dispositivo, e o envio sai pelo FCM.
//
// A armadilha aqui não é fazer o nativo funcionar: é fazê-lo sem
// quebrar o que já funcionava. A mesma pessoa pode ter o site
// aberto no computador E o app no celular, e deve receber nos
// dois. Um caminho não substitui o outro.
//
// E há uma inversão que importa: sem chaves VAPID o Web Push não
// existe, mas o app nativo continua recebendo. Se o envio parasse
// na checagem de VAPID, instalar o app não adiantaria nada.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Database } = require('../database/sqlite');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO = path.join(RAIZ, 'data', `push-nativo-test-${process.pid}.db`);
const PORTA = 3414;

let passaram = 0;
let falharam = 0;

async function teste(nome, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${nome}`);
    passaram += 1;
  } catch (err) {
    console.log(`  ❌ [FAIL] ${nome}`);
    console.log(`     ${err.message}`);
    falharam += 1;
  }
}

function limpar() {
  for (const s of ['', '-shm', '-wal']) { try { fs.unlinkSync(CAMINHO + s); } catch (_) {} }
}

const { generateKeyPairSync } = require('node:crypto');
// Chave so deste teste, gerada na hora. O jsonwebtoken assina de
// verdade no fluxo OAuth; uma string qualquer faria o sign lancar e
// o teste falharia por um motivo que nao e o que ele mede.
const CHAVE_DE_TESTE = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
}).privateKey;

(async () => {
  console.log('\n============================================================');
  console.log('📌 PUSH NATIVO');
  console.log('============================================================\n');

  limpar();
  process.env.QUIET = 'true';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'teste-push-nativo';
  delete process.env.FCM_PROJECT_ID;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  const db = new Database(CAMINHO);
  await require('../database/schema.js')(db);

  const app = express();
  app.use(express.json());
  app.use('/api/notifications', require('../routes/notifications.js')(db));
  const servidor = app.listen(PORTA);
  const BASE = `http://127.0.0.1:${PORTA}/api`;

  const ATLETA = 'usr-push-nativo';
  const OUTRO = 'usr-push-outro';
  for (const [id, email] of [[ATLETA, 'push@rush.test'], [OUTRO, 'outro@rush.test']]) {
    await db.prepare("INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, 'x', 'athlete')").run(id, email);
  }

  const cab = (id) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt.sign({ id, role: 'athlete', academy_id: null }, process.env.JWT_SECRET, { expiresIn: '1h' })}`,
  });

  const registrar_ = async (id, corpo) => {
    const r = await fetch(`${BASE}/notifications/push/device`, {
      method: 'POST', headers: cab(id), body: JSON.stringify(corpo),
    });
    return { status: r.status, corpo: await r.json() };
  };

  const TOKEN = 'token-de-aparelho-abcdefghijklmnop';

  await teste('C1: o app registra o token do aparelho', async () => {
    const r = await registrar_(ATLETA, { token: TOKEN, platform: 'android' });
    assert.strictEqual(r.status, 201, `esperado 201, veio ${r.status}`);

    const linha = await db.prepare('SELECT * FROM push_devices WHERE token = ?').get(TOKEN);
    assert.ok(linha, 'o token não foi gravado');
    assert.strictEqual(linha.user_id, ATLETA);
    assert.strictEqual(linha.platform, 'android');
  });

  await teste('C2: plataforma inválida é recusada', async () => {
    const r = await registrar_(ATLETA, { token: 'outro-token-qualquer-123', platform: 'symbian' });
    assert.strictEqual(r.status, 400);
  });

  await teste('C3: token curto demais é recusado', async () => {
    const r = await registrar_(ATLETA, { token: 'abc', platform: 'ios' });
    assert.strictEqual(r.status, 400);
  });

  await teste('C4: aparelho que troca de dono passa a ser do novo', async () => {
    // Celular emprestado, ou conta trocada no mesmo aparelho. Manter
    // o dono antigo mandaria a notificação dele para a tela de outra
    // pessoa — que é vazamento, não bug de conveniência.
    const r = await registrar_(OUTRO, { token: TOKEN, platform: 'android' });
    assert.strictEqual(r.status, 201);

    const linha = await db.prepare('SELECT user_id FROM push_devices WHERE token = ?').get(TOKEN);
    assert.strictEqual(linha.user_id, OUTRO, 'o aparelho continuou apontando para o dono anterior');

    const quantas = await db.prepare('SELECT COUNT(*) as n FROM push_devices WHERE token = ?').get(TOKEN);
    assert.strictEqual(Number(quantas.n), 1, 'o mesmo token virou duas linhas');
  });

  await teste('C5: só o dono remove o próprio aparelho', async () => {
    const r = await fetch(`${BASE}/notifications/push/device`, {
      method: 'DELETE', headers: cab(ATLETA), body: JSON.stringify({ token: TOKEN }),
    });
    assert.strictEqual(r.status, 200);
    // O token agora e do OUTRO; o ATLETA nao pode tira-lo.
    const linha = await db.prepare('SELECT user_id FROM push_devices WHERE token = ?').get(TOKEN);
    assert.ok(linha, 'uma conta removeu o aparelho de outra');
  });

  await teste('C6: sem FCM configurado, nada é enviado e nada quebra', async () => {
    const { enviarPushNativo, pushNativoConfigurado } = require('../services/pushNativo');
    assert.strictEqual(pushNativoConfigurado(), false);

    const r = await enviarPushNativo(db, OUTRO, { title: 'oi', message: 'teste', type: 'system' });
    assert.strictEqual(r.enviados, 0);
    assert.strictEqual(r.motivo, 'FCM_NAO_CONFIGURADO');
  });

  await teste('C7: o envio chega ao FCM com o token certo', async () => {
    const { enviarPushNativo } = require('../services/pushNativo');
    process.env.FCM_PROJECT_ID = 'projeto-de-teste';

    const chamadas = [];
    const buscar = async (url, opcoes) => {
      chamadas.push({ url, corpo: opcoes?.body ? JSON.parse(opcoes.body) : null });
      return { ok: true, status: 200, json: async () => ({ name: 'enviado' }) };
    };

    const r = await enviarPushNativo(
      db, OUTRO,
      { title: 'RUSH', message: 'Prontidão calculada', type: 'system', id: 'n1' },
      { buscar, accessToken: 'token-falso' },
    );

    assert.strictEqual(r.enviados, 1, `esperado 1 envio, veio ${r.enviados}`);
    assert.strictEqual(chamadas.length, 1);
    assert.match(chamadas[0].url, /projeto-de-teste\/messages:send$/);
    assert.strictEqual(chamadas[0].corpo.message.token, TOKEN);
    assert.strictEqual(chamadas[0].corpo.message.notification.body, 'Prontidão calculada');

    // O FCM recusa o envio INTEIRO se algum valor de `data` nao for
    // string. Um `null` ali derrubaria toda notificacao sem id.
    for (const [chave, valor] of Object.entries(chamadas[0].corpo.message.data)) {
      assert.strictEqual(typeof valor, 'string', `data.${chave} não é string: ${typeof valor}`);
    }
  });

  await teste('C8: token morto é removido; erro temporário não', async () => {
    const { enviarPushNativo } = require('../services/pushNativo');

    const morto = async () => ({ ok: false, status: 404, text: async () => 'UNREGISTERED' });
    const r1 = await enviarPushNativo(db, OUTRO, { title: 'x', message: 'y', type: 'system' },
      { buscar: morto, accessToken: 'token-falso' });
    assert.strictEqual(r1.removidos, 1, 'o token morto não foi removido');
    assert.ok(!(await db.prepare('SELECT token FROM push_devices WHERE token = ?').get(TOKEN)));

    // Um erro temporario NAO pode apagar o token: calaria o aparelho
    // para sempre por causa de uma falha de rede.
    await registrar_(OUTRO, { token: TOKEN, platform: 'ios' });
    const instavel = async () => ({ ok: false, status: 503, text: async () => 'UNAVAILABLE' });
    const r2 = await enviarPushNativo(db, OUTRO, { title: 'x', message: 'y', type: 'system' },
      { buscar: instavel, accessToken: 'token-falso' });
    assert.strictEqual(r2.removidos, 0, 'uma falha temporária apagou o aparelho');
    assert.ok(await db.prepare('SELECT token FROM push_devices WHERE token = ?').get(TOKEN));
  });

  await teste('C9: sem VAPID o app nativo ainda recebe', async () => {
    // Esta e a inversao que importa, e ela precisa ser testada por
    // COMPORTAMENTO. A primeira versao deste teste comparava a
    // posicao das duas checagens no texto do arquivo — e passava
    // mesmo com a regressao aplicada, porque havia outra ocorrencia
    // de `pushConfigurado` mais abaixo. Media o texto, nao o efeito.
    //
    // Aqui o envio e chamado de verdade, com VAPID ausente (que e o
    // estado deste teste) e um aparelho registrado. Se a checagem de
    // Web Push voltar a barrar o caminho nativo, nada sai.
    const { enviarPush } = require('../services/notificacoes');
    process.env.FCM_PROJECT_ID = 'projeto-de-teste';

    const fetchOriginal = globalThis.fetch;
    const chamadas = [];
    globalThis.fetch = async (url, opcoes) => {
      const alvo = String(url);
      if (alvo.includes('oauth2.googleapis.com')) {
        return { ok: true, status: 200, json: async () => ({ access_token: 'token-falso' }) };
      }
      chamadas.push(alvo);
      return { ok: true, status: 200, json: async () => ({ name: 'enviado' }) };
    };
    // A conta de servico precisa existir para o OAuth ser tentado.
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: 'teste@exemplo.iam.gserviceaccount.com',
      private_key: CHAVE_DE_TESTE,
    });

    try {
      const r = await enviarPush(db, OUTRO, { title: 'RUSH', message: 'teste', type: 'system' });
      assert.strictEqual(r.enviados, 1,
        'sem chaves VAPID o app nativo deixou de receber — instalar o app não adiantaria nada');
      assert.ok(chamadas.some((u) => u.includes('messages:send')), 'o FCM não foi chamado');
    } finally {
      globalThis.fetch = fetchOriginal;
      delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    }
  });

  await teste('C10: o caminho do navegador continua de pé', async () => {
    const fonte = fs.readFileSync(path.join(RAIZ, 'server', 'services', 'notificacoes.js'), 'utf8');
    assert.match(fonte, /webpush\.sendNotification/, 'o envio por Web Push sumiu');
    const tabela = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='push_subscriptions'",
    ).get();
    assert.ok(tabela, 'a tabela de inscrições de navegador foi perdida');
  });

  servidor.close();
  db.close();
  limpar();

  console.log('\n============================================================');
  console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
  console.log('============================================================');
  if (falharam > 0) process.exit(1);
})();
