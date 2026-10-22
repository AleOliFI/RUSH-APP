// ============================================================
// RUSH RUNNING — Ninguém se promove sozinho, e cargo não é assinatura
// ------------------------------------------------------------
// Dois defeitos que juntos davam PRO vitalício de graça a qualquer
// pessoa com conta no app.
//
// 1. POST /api/academies só exigia estar logado — e a rota promove
//    quem chama a `owner`, gravando o academy_id. Qualquer atleta
//    virava dono de assessoria chamando a API direto.
//
// 2. `ehPro` devolvia true para os cargos coach, owner e admin.
//
// Encadeados: criar uma assessoria vazia liberava o aplicativo
// inteiro, para sempre, sem pagar nada. Reproduzi antes de corrigir —
// `antes: athlete/is_pro false` → `POST /academies 201` →
// `depois: owner/is_pro true`.
//
// As duas correções são independentes de propósito: cada uma
// sozinha já fecharia o encadeamento, e este teste cobra as duas.
// Defesa em profundidade aqui vale a pena, porque o prêmio para
// quem furar é o produto pago inteiro.
//
// O cargo continua decidindo as FERRAMENTAS de treinador — essa é
// outra pergunta, respondida pelos `authorize` das rotas.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Database } = require('../database/sqlite');
const { ehPro } = require('../services/acessoPro');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO = path.join(RAIZ, 'data', `autopromocao-test-${process.pid}.db`);
const PORTA = 3429;

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
  console.log('📌 AUTOPROMOÇÃO PROIBIDA — E CARGO NÃO É ASSINATURA');
  console.log('============================================================\n');

  limpar();
  process.env.QUIET = 'true';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'teste-autopromocao';

  const db = new Database(CAMINHO);
  await require('../database/schema.js')(db);
  await require('../database/seedData.js')(db);

  const app = express();
  app.use(express.json());
  app.use('/api/academies', require('../routes/academies.js')(db));
  app.use('/api/users', require('../routes/users.js')(db));
  const servidor = app.listen(PORTA);
  const BASE = `http://127.0.0.1:${PORTA}/api`;

  const token = (id, role, academyId = null) =>
    jwt.sign({ id, role, academy_id: academyId }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const cab = (id, role, academyId) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token(id, role, academyId)}`,
  });

  const atleta = await db.prepare("SELECT id FROM users WHERE email = 'pedro@email.com'").get();
  assert.ok(atleta, 'o seed precisa da conta pedro@email.com');

  // Atleta comum, sem assinatura e sem assessoria.
  db.prepare("UPDATE users SET role = 'athlete', academy_id = NULL, subscription_tier = 'free', subscription_status = 'free' WHERE id = ?")
    .run(atleta.id);

  const souPro = async (id, role, academyId) => {
    const r = await fetch(`${BASE}/users/me`, { headers: cab(id, role, academyId) });
    return (await r.json()).is_pro;
  };

  const criarAssessoria = async (id, role, academyId) =>
    fetch(`${BASE}/academies`, {
      method: 'POST',
      headers: cab(id, role, academyId),
      body: JSON.stringify({ name: 'Assessoria de Teste' }),
    });

  // ---------- A porta ----------
  await teste('T1: atleta não cria assessoria e não se promove a dono', async () => {
    const antes = await db.prepare('SELECT role FROM users WHERE id = ?').get(atleta.id);
    assert.strictEqual(antes.role, 'athlete', 'precondição: começa como atleta');

    const r = await criarAssessoria(atleta.id, 'athlete');
    assert.strictEqual(r.status, 403, `esperado 403, veio ${r.status}`);

    const depois = await db.prepare('SELECT role, academy_id FROM users WHERE id = ?').get(atleta.id);
    assert.strictEqual(depois.role, 'athlete', 'o cargo não pode ter mudado');
    assert.ok(!depois.academy_id, 'nenhuma assessoria pode ter sido vinculada');

    const quantas = await db.prepare('SELECT COUNT(*) as n FROM academies WHERE owner_id = ?').get(atleta.id);
    assert.strictEqual(Number(quantas.n), 0, 'nenhuma assessoria pode ter sido criada');
  });

  // ---------- O prêmio ----------
  await teste('T2: cargo nenhum dá PRO — nem coach, nem owner, nem admin', async () => {
    for (const cargo of ['coach', 'owner', 'admin']) {
      assert.strictEqual(ehPro({ role: cargo }), false,
        `${cargo} sem assinatura não pode ser PRO`);
      assert.strictEqual(ehPro({ role: cargo, subscription_tier: 'free', subscription_status: 'free' }), false,
        `${cargo} no plano grátis não pode ser PRO`);
    }
    assert.strictEqual(ehPro({ role: 'coach', subscription_tier: 'pro', subscription_status: 'active' }), true,
      'treinador que assina é PRO como qualquer assinante');
  });

  await teste('T3: virar dono de assessoria não libera o app', async () => {
    // Promoção feita por fora, como se um administrador tivesse feito.
    db.prepare("UPDATE users SET role = 'owner' WHERE id = ?").run(atleta.id);
    assert.strictEqual(await souPro(atleta.id, 'owner'), false,
      'o caminho inteiro do furo: virar dono não pode liberar o produto pago');
  });

  await teste('T4: o encadeamento todo, do começo ao fim, não acontece mais', async () => {
    db.prepare("UPDATE users SET role = 'athlete', academy_id = NULL, subscription_tier = 'free', subscription_status = 'free' WHERE id = ?")
      .run(atleta.id);

    assert.strictEqual(await souPro(atleta.id, 'athlete'), false, 'precondição: não é PRO');
    const r = await criarAssessoria(atleta.id, 'athlete');
    assert.strictEqual(r.status, 403, 'a rota tem de recusar');

    const linha = await db.prepare('SELECT role FROM users WHERE id = ?').get(atleta.id);
    assert.strictEqual(await souPro(atleta.id, linha.role), false,
      'depois da tentativa, continua sem PRO');
  });

  // ---------- Quem já é treinador continua trabalhando ----------
  await teste('T5: treinador de verdade continua podendo criar a assessoria', async () => {
    const treinador = await db.prepare("SELECT id FROM users WHERE role = 'coach' LIMIT 1").get();
    assert.ok(treinador, 'o seed precisa de um treinador');
    db.prepare('UPDATE users SET academy_id = NULL WHERE id = ?').run(treinador.id);

    const r = await criarAssessoria(treinador.id, 'coach');
    assert.strictEqual(r.status, 201,
      `fechar a porta não pode trancar quem tem a chave — veio ${r.status}`);
  });

  servidor.close();
  try { db.close(); } catch (_) {}
  limpar();

  console.log('\n============================================================');
  console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
  console.log('============================================================');
  process.exit(falharam > 0 ? 1 : 0);
})().catch((err) => {
  console.error('❌ Erro fatal:', err);
  limpar();
  process.exit(1);
});
