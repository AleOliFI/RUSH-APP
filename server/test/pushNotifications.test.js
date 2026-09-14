// ============================================================
// RUSH RUNNING — Web Push: servidor → serviço de push
// ------------------------------------------------------------
// O registro de um push real exige que o navegador fale com
// android.clients.google.com, o que nenhum ambiente de teste
// automatizado tem como fazer. O que dá para verificar de verdade —
// e é onde mora o risco — é a perna do servidor: se ele cifra, se
// assina com VAPID, se respeita a preferência do atleta, se limpa as
// inscrições mortas e se uma falha de push derruba a notificação.
//
// Para isso este teste levanta um serviço de push falso em localhost.
// Do ponto de vista do web-push, um serviço de push é só uma URL que
// recebe POST — então o que trafega aqui é exatamente o que
// trafegaria para o Google.
//
// As chaves VAPID são geradas aqui dentro: o teste não pode depender
// de um .env presente, que é justamente o que não existe em CI.
// ============================================================

const https = require('https');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const os = require('os');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const webpush = require('web-push');

const CAMINHO_DB = path.join(__dirname, '..', '..', 'data', `push-test-${process.pid}.db`);

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

function parDeChavesDoNavegador() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    p256dh: ecdh.getPublicKey().toString('base64url'),
    auth: crypto.randomBytes(16).toString('base64url'),
  };
}

(async () => {
  console.log('\n============================================================');
  console.log('📌 WEB PUSH — SERVIDOR ATÉ O SERVIÇO DE PUSH');
  console.log('============================================================');

  // Chaves próprias, para o teste valer com ou sem .env.
  const chaves = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = chaves.publicKey;
  process.env.VAPID_PRIVATE_KEY = chaves.privateKey;
  process.env.VAPID_SUBJECT = 'mailto:teste@rushrunning.app';

  // O serviço falso precisa ser HTTPS: o web-push usa https.request
  // sempre, porque todo serviço de push real é TLS. Em vez de desligar
  // a verificação — que esconderia justamente o tipo de erro que este
  // teste deveria pegar — geramos um certificado e o declaramos
  // confiável só para este processo.
  const dirCert = fs.mkdtempSync(path.join(os.tmpdir(), 'rush-push-'));
  const arquivoChave = path.join(dirCert, 'key.pem');
  const arquivoCert = path.join(dirCert, 'cert.pem');
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', arquivoChave, '-out', arquivoCert,
    '-days', '1', '-subj', '/CN=127.0.0.1',
    '-addext', 'subjectAltName=IP:127.0.0.1',
  ], { stdio: 'ignore' });
  const certificado = fs.readFileSync(arquivoCert);
  https.globalAgent.options.ca = [certificado];

  const recebidas = [];
  const servico = https.createServer({ key: fs.readFileSync(arquivoChave), cert: certificado }, (req, res) => {
    const pedacos = [];
    req.on('data', (c) => pedacos.push(c));
    req.on('end', () => {
      recebidas.push({ url: req.url, headers: req.headers, body: Buffer.concat(pedacos) });
      // 410 é como um serviço real diz "essa inscrição não existe mais".
      if (req.url.includes('/morta')) { res.writeHead(410); res.end(); }
      else { res.writeHead(201); res.end(); }
    });
  });
  await new Promise((r) => servico.listen(0, '127.0.0.1', r));
  const base = `https://127.0.0.1:${servico.address().port}`;

  const db = new Database(CAMINHO_DB);
  await require('../database/schema.js')(db);
  const servicoNotif = require('../services/notificacoes.js');
  const { criarNotificacao, enviarPush, configurarPush, pushDisponivel } = servicoNotif;

  const uid = crypto.randomUUID();
  db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?,?,?)').run(uid, `push-${uid}@t.test`, 'x');
  db.prepare('INSERT INTO user_profiles (user_id, name, username) VALUES (?,?,?)').run(uid, 'Push Tester', `push_${uid.slice(0, 8)}`);

  await teste('P1: configurarPush liga com as chaves VAPID no ambiente', () => {
    assert.strictEqual(configurarPush(), true);
    assert.strictEqual(pushDisponivel(), true);
  });

  const viva = parDeChavesDoNavegador();
  const morta = parDeChavesDoNavegador();
  db.prepare('INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth) VALUES (?,?,?,?)')
    .run(`${base}/viva`, uid, viva.p256dh, viva.auth);
  db.prepare('INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth) VALUES (?,?,?,?)')
    .run(`${base}/morta`, uid, morta.p256dh, morta.auth);

  await teste('P2: entrega na inscrição viva e apaga a que respondeu 410', async () => {
    const r = await enviarPush(db, uid, { id: 'n1', type: 'like', message: 'Fulano curtiu sua atividade' });
    assert.strictEqual(r.enviados, 1, 'a inscrição viva deveria receber');
    assert.strictEqual(r.removidos, 1, 'a inscrição de endpoint morto deveria sair do banco');

    const restantes = db.prepare('SELECT endpoint FROM push_subscriptions WHERE user_id = ?').all(uid);
    assert.strictEqual(restantes.length, 1);
    assert.ok(restantes[0].endpoint.endsWith('/viva'));
  });

  await teste('P3: o POST vai assinado com VAPID e com o corpo cifrado', () => {
    const entrega = recebidas.find((x) => x.url === '/viva');
    assert.ok(entrega, 'o serviço de push deveria ter recebido um POST');
    assert.match(entrega.headers.authorization || '', /^vapid /, 'faltou o cabeçalho VAPID assinado');
    assert.strictEqual(entrega.headers['content-encoding'], 'aes128gcm', 'o corpo precisa vir cifrado');
    assert.ok(entrega.body.length > 50, 'corpo cifrado suspeitosamente pequeno');
    // A prova de que cifrou: a mensagem não aparece em claro no que trafegou.
    assert.ok(!entrega.body.includes(Buffer.from('curtiu')), 'a mensagem viajou em texto puro');
  });

  await teste('P4: push desligado nas preferências não envia nada', async () => {
    db.prepare('INSERT INTO user_settings (user_id, push_notifications) VALUES (?, 0)').run(uid);
    const antes = recebidas.length;
    const r = await enviarPush(db, uid, { id: 'n2', type: 'like', message: 'não deveria sair' });
    assert.strictEqual(r.enviados, 0);
    assert.strictEqual(recebidas.length, antes, 'nada podia ter ido pela rede');
  });

  await teste('P5: notifications_enabled desligado silencia o push inteiro', async () => {
    db.prepare('UPDATE user_settings SET push_notifications = 1, notifications_enabled = 0 WHERE user_id = ?').run(uid);
    const antes = recebidas.length;
    const r = await enviarPush(db, uid, { id: 'n3', type: 'like', message: 'também não' });
    assert.strictEqual(r.enviados, 0);
    assert.strictEqual(recebidas.length, antes);
  });

  await teste('P6: criarNotificacao grava a linha e dispara o push', async () => {
    db.prepare('UPDATE user_settings SET notifications_enabled = 1 WHERE user_id = ?').run(uid);
    const antes = recebidas.length;

    const id = criarNotificacao(db, { userId: uid, type: 'follow', message: 'Alguém começou a seguir você' });
    assert.ok(id, 'deveria devolver o id da notificação');

    const linha = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
    assert.strictEqual(linha.type, 'follow');
    assert.strictEqual(linha.read, 0);

    await new Promise((r) => setTimeout(r, 900));
    assert.strictEqual(recebidas.length, antes + 1, 'o push deveria ter saído logo após o INSERT');
  });

  await teste('P7: serviço de push fora do ar não impede a notificação nem apaga a inscrição', async () => {
    db.prepare('UPDATE push_subscriptions SET endpoint = ? WHERE user_id = ?')
      .run('https://127.0.0.1:1/inexistente', uid);

    const id = criarNotificacao(db, { userId: uid, type: 'comment', message: 'com o serviço fora do ar' });
    assert.ok(id, 'a notificação precisa ser gravada mesmo com o push falhando');
    assert.ok(db.prepare('SELECT 1 FROM notifications WHERE id = ?').get(id));

    await new Promise((r) => setTimeout(r, 1500));
    const sobreviveu = db.prepare('SELECT COUNT(*) c FROM push_subscriptions WHERE user_id = ?').get(uid);
    assert.strictEqual(sobreviveu.c, 1, 'falha de rede é temporária e não pode apagar a inscrição');
  });

  await teste('P8: sem chaves VAPID o app segue gravando notificações, só não envia', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    assert.strictEqual(configurarPush(), false);
    assert.strictEqual(pushDisponivel(), false);

    db.prepare('UPDATE push_subscriptions SET endpoint = ? WHERE user_id = ?').run(`${base}/viva2`, uid);
    const antes = recebidas.length;

    const id = criarNotificacao(db, { userId: uid, type: 'achievement', message: 'Conquista sem push' });
    assert.ok(id, 'a central precisa continuar recebendo a linha');
    await new Promise((r) => setTimeout(r, 600));
    assert.strictEqual(recebidas.length, antes, 'sem chaves, nada pode sair pela rede');

    // Devolve o ambiente para os testes seguintes.
    process.env.VAPID_PUBLIC_KEY = chaves.publicKey;
    process.env.VAPID_PRIVATE_KEY = chaves.privateKey;
    configurarPush();
  });

  db.close();
  servico.close();
  try { fs.rmSync(dirCert, { recursive: true, force: true }); } catch (_) {}
  try { fs.unlinkSync(CAMINHO_DB); } catch (_) {}
  for (const sufixo of ['-shm', '-wal']) {
    try { fs.unlinkSync(CAMINHO_DB + sufixo); } catch (_) {}
  }

  console.log('\n============================================================');
  console.log(`   Passaram: ${passaram}`);
  console.log(`   Falharam: ${falharam}`);
  console.log('============================================================');
  if (falharam > 0) process.exit(1);
})().catch((err) => {
  console.error('❌ Erro fatal na suíte de push:', err);
  process.exit(1);
});
