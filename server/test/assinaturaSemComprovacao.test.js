// ============================================================
// RUSH RUNNING — PRO exige comprovação, e o webhook exige segredo
// ------------------------------------------------------------
// Duas falhas que davam a assinatura de graça, por caminhos
// diferentes:
//
// S2 — POST /subscriptions/activate gravava
//      `subscription_tier = 'pro'` por 30 ou 365 dias para
//      QUALQUER conta autenticada que pedisse. Sem recibo, sem
//      webhook, sem nada. E era o caminho que o checkout web do
//      billing.js usava.
//
// S3 — POST /subscriptions/webhook tinha o segredo com fallback
//      literal no código (`'rush_webhook_secret_2026'`), num
//      repositório PÚBLICO, e a validação só rodava quando
//      NODE_ENV era exatamente 'production'. Quem lesse o GitHub
//      podia chamar o webhook e se dar PRO.
//
// O teste do webhook é de falha FECHADA: sem a variável de
// ambiente, a rota não atende ninguém. É o oposto do que ela
// fazia — atender todo mundo quando não configurada.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Database } = require('../database/sqlite');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO = path.join(RAIZ, 'data', `assinatura-test-${process.pid}.db`);
const PORTA = 3412;

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

(async () => {
  console.log('\n============================================================');
  console.log('📌 ASSINATURA SEM COMPROVAÇÃO');
  console.log('============================================================\n');

  limpar();
  process.env.QUIET = 'true';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'teste-assinatura';
  // Sem segredo: e exatamente o estado em que a rota antiga
  // aceitava qualquer chamada.
  delete process.env.PAYMENT_WEBHOOK_SECRET;

  const db = new Database(CAMINHO);
  await require('../database/schema.js')(db);

  const app = express();
  app.use(express.json());
  app.use('/api/subscriptions', require('../routes/subscriptions.js')(db));
  const servidor = app.listen(PORTA);
  const BASE = `http://127.0.0.1:${PORTA}/api`;

  const ID = 'usr-assinante';
  await db.prepare(`
    INSERT INTO users (id, email, password_hash, role, subscription_tier)
    VALUES (?, ?, 'x', 'athlete', 'free')
  `).run(ID, 'assinante@rush.test');

  const token = jwt.sign({ id: ID, role: 'athlete', academy_id: null }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const cab = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  await teste('C1: /activate não concede mais PRO a quem só pediu', async () => {
    const r = await fetch(`${BASE}/subscriptions/activate`, {
      method: 'POST', headers: cab, body: JSON.stringify({ plan_type: 'yearly' }),
    });
    assert.ok(r.status >= 400, `a rota respondeu ${r.status} — ainda existe caminho de ativação sem prova`);
  });

  await teste('C2: e o banco continua com a conta em free', async () => {
    const u = await db.prepare('SELECT subscription_tier, subscription_status FROM users WHERE id = ?').get(ID);
    assert.strictEqual(u.subscription_tier, 'free',
      `a conta virou "${u.subscription_tier}" sem nenhum pagamento`);

    const assinaturas = await db.prepare('SELECT COUNT(*) as n FROM subscriptions WHERE user_id = ?').get(ID);
    assert.strictEqual(Number(assinaturas.n), 0, 'foi gravada uma assinatura que ninguém pagou');
  });

  await teste('C3: sem PAYMENT_WEBHOOK_SECRET o webhook recusa tudo', async () => {
    const r = await fetch(`${BASE}/subscriptions/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: { type: 'INITIAL_PURCHASE', app_user_id: ID, store: 'APP_STORE' } }),
    });
    assert.strictEqual(r.status, 503, `esperado 503 (falha fechada), veio ${r.status}`);

    const u = await db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(ID);
    assert.strictEqual(u.subscription_tier, 'free', 'o webhook concedeu PRO sem credencial');
  });

  await teste('C4: com segredo configurado, chamada sem credencial dá 401', async () => {
    process.env.PAYMENT_WEBHOOK_SECRET = 'segredo-so-deste-teste';
    const r = await fetch(`${BASE}/subscriptions/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: { type: 'INITIAL_PURCHASE', app_user_id: ID, store: 'APP_STORE' } }),
    });
    assert.strictEqual(r.status, 401, `esperado 401, veio ${r.status}`);

    const u = await db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(ID);
    assert.strictEqual(u.subscription_tier, 'free', 'o webhook concedeu PRO sem o token certo');
  });

  await teste('C5: a validação não depende mais de NODE_ENV', async () => {
    // A checagem antiga so rodava em 'production'. Este teste roda
    // fora dela — e C3 e C4 ja provaram que a rota recusa. Aqui a
    // asserção é sobre o código, para o gate não voltar.
    const fonte = fs.readFileSync(path.join(RAIZ, 'server', 'routes', 'subscriptions.js'), 'utf8');
    const semComentarios = fonte
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.ok(!/NODE_ENV[\s\S]{0,80}webhookSecret/.test(semComentarios),
      'a validação do webhook voltou a depender de NODE_ENV');
  });

  await teste('C6: o segredo literal saiu do código', async () => {
    const fonte = fs.readFileSync(path.join(RAIZ, 'server', 'routes', 'subscriptions.js'), 'utf8');
    const semComentarios = fonte
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.ok(!/rush_webhook_secret_2026/.test(semComentarios),
      'o segredo continua escrito no código, e o repositório é público');
    assert.ok(!/PAYMENT_WEBHOOK_SECRET\s*\|\|/.test(semComentarios),
      'voltou a existir um fallback para quando a variável não está definida');
  });

  await teste('C7: o checkout do app não chama mais a rota fechada', async () => {
    const billing = fs.readFileSync(path.join(RAIZ, 'src', 'services', 'billing.js'), 'utf8');
    const semComentarios = billing
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.ok(!/subscriptions\.activate\(/.test(semComentarios),
      'billing.js ainda chama subscriptions.activate');
  });

  await teste('C8: o teste grátis continua funcionando, e só uma vez', async () => {
    // Fechar a ativação paga não podia levar junto o trial, que é
    // legítimo: não envolve pagamento nenhum.
    const primeira = await fetch(`${BASE}/subscriptions/start-trial`, { method: 'POST', headers: cab });
    assert.strictEqual(primeira.status, 200, `o trial deveria funcionar, veio ${primeira.status}`);

    const segunda = await fetch(`${BASE}/subscriptions/start-trial`, { method: 'POST', headers: cab });
    assert.strictEqual(segunda.status, 400, 'o trial precisa ser de uso único por conta');
  });

  servidor.close();
  db.close();
  limpar();

  console.log('\n============================================================');
  console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
  console.log('============================================================');
  if (falharam > 0) process.exit(1);
})();
