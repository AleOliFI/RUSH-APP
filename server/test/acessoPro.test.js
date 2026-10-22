// ============================================================
// RUSH RUNNING — Acesso PRO: uma regra só, e ela é do servidor
// ------------------------------------------------------------
// A mesma pergunta — "esta pessoa tem PRO?" — era respondida em três
// lugares, de três jeitos:
//
//   /api/users/me       dizia sim para `subscription_tier = 'pro'`
//                       mesmo com a assinatura vencida, e para
//                       qualquer um com status 'active' no plano
//                       grátis.
//   /api/subscriptions  exigia plano pago E status ativo (ou teste
//                       dentro do prazo).
//   AuthContext         olhava só o `subscription_tier` e ignorava o
//                       status por completo.
//
// A terceira é a que decidia o que a pessoa via, e ela lia um objeto
// guardado no localStorage. Resultado: quem cancelava a assinatura
// continuava com o app liberado, e quem soubesse editar o
// armazenamento do navegador se dava PRO sozinho.
//
// O feed tinha o problema inverso: `isPro` estava cravado em `false`
// no cliente porque a rota nunca mandou o campo. Ninguém jamais via o
// selo — nem quem pagava.
//
// Este teste cobra: a regra única decide certo nos casos de borda, as
// duas rotas concordam entre si, o feed manda o selo de verdade, e as
// colunas de cobrança de terceiros não vazam junto.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Database } = require('../database/sqlite');
const { ehPro, diasDeTesteRestantes } = require('../services/acessoPro');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO = path.join(RAIZ, 'data', `acesso-pro-test-${process.pid}.db`);
const PORTA = 3417;

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
  console.log('📌 ACESSO PRO — UMA REGRA SÓ');
  console.log('============================================================\n');

  limpar();
  process.env.QUIET = 'true';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'teste-acesso-pro';

  const db = new Database(CAMINHO);
  await require('../database/schema.js')(db);
  await require('../database/seedData.js')(db);

  const app = express();
  app.use(express.json());
  app.use('/api/users', require('../routes/users.js')(db));
  app.use('/api/subscriptions', require('../routes/subscriptions.js')(db));
  app.use('/api/social', require('../routes/social.js')(db));
  const servidor = app.listen(PORTA);
  const BASE = `http://127.0.0.1:${PORTA}/api`;

  const token = (id, role = 'athlete') =>
    jwt.sign({ id, role, academy_id: null }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const cab = (id, role) => ({ Authorization: `Bearer ${token(id, role)}` });

  const pegar = async (rota, id, role) => {
    const r = await fetch(`${BASE}${rota}`, { headers: cab(id, role) });
    return { status: r.status, corpo: await r.json() };
  };

  const atleta = await db.prepare("SELECT id FROM users WHERE role = 'athlete' LIMIT 1").get();
  assert.ok(atleta, 'o seed precisa ter ao menos um atleta');

  const definirAssinatura = (tier, status, trial = null) =>
    db.prepare('UPDATE users SET subscription_tier = ?, subscription_status = ?, trial_ends_at = ? WHERE id = ?')
      .run(tier, status, trial, atleta.id);

  const amanha = new Date(Date.now() + 86400000).toISOString();
  const ontem = new Date(Date.now() - 86400000).toISOString();

  // ---------- A regra, nos casos que importam ----------
  await teste('T1: a regra única decide certo nos casos de borda', () => {
    const agora = new Date('2026-10-22T12:00:00Z');
    const casos = [
      [{ role: 'coach' }, true, 'treinador trabalha no app'],
      [{ role: 'athlete', subscription_tier: 'pro', subscription_status: 'active' }, true, 'pro ativo'],
      [{ role: 'athlete', subscription_tier: 'lifetime', subscription_status: 'active' }, true, 'vitalício ativo'],
      [{ role: 'athlete', subscription_tier: 'pro', subscription_status: 'canceled' }, false, 'pro cancelado'],
      [{ role: 'athlete', subscription_tier: 'pro', subscription_status: 'expired' }, false, 'pro vencido'],
      [{ role: 'athlete', subscription_tier: 'free', subscription_status: 'active' }, false, 'grátis com status ativo'],
      [{ role: 'athlete', subscription_tier: 'pro', subscription_status: 'trial', trial_ends_at: '2026-10-30' }, true, 'teste no prazo'],
      [{ role: 'athlete', subscription_tier: 'pro', subscription_status: 'trial', trial_ends_at: '2026-10-01' }, false, 'teste vencido'],
      [{ role: 'athlete', subscription_tier: 'pro', subscription_status: 'trial' }, false, 'teste sem data de fim'],
      [{ role: 'athlete', subscription_tier: 'pro', subscription_status: 'trial', trial_ends_at: 'não é data' }, false, 'data de teste ilegível'],
      [null, false, 'sem usuário'],
    ];
    for (const [usuario, esperado, nome] of casos) {
      assert.strictEqual(ehPro(usuario, agora), esperado, `${nome}: esperava ${esperado}`);
    }
    assert.strictEqual(diasDeTesteRestantes({ subscription_status: 'trial', trial_ends_at: '2026-10-01' }, agora), 0,
      'teste vencido não tem dias restantes');
  });

  // ---------- Assinatura cancelada perde o acesso ----------
  await teste('T2: assinatura cancelada deixa de dar PRO em /users/me', async () => {
    definirAssinatura('pro', 'canceled');
    const me = await pegar('/users/me', atleta.id);
    assert.strictEqual(me.status, 200, `esperado 200, veio ${me.status}`);
    assert.strictEqual(me.corpo.is_pro, false,
      'quem cancelou não pode continuar com o app liberado');
  });

  await teste('T3: plano grátis com status "active" não vira PRO', async () => {
    definirAssinatura('free', 'active');
    const me = await pegar('/users/me', atleta.id);
    assert.strictEqual(me.corpo.is_pro, false,
      'status ativo sem plano pago não é assinatura');
  });

  // ---------- As duas rotas não podem divergir ----------
  await teste('T4: /users/me e /subscriptions/status dão a mesma resposta', async () => {
    const cenarios = [
      ['pro', 'active', null],
      ['pro', 'canceled', null],
      ['pro', 'expired', null],
      ['free', 'active', null],
      ['free', 'free', null],
      ['pro', 'trial', amanha],
      ['pro', 'trial', ontem],
      ['lifetime', 'active', null],
    ];
    for (const [tier, status, trial] of cenarios) {
      definirAssinatura(tier, status, trial);
      const me = await pegar('/users/me', atleta.id);
      const assinatura = await pegar('/subscriptions/status', atleta.id);
      assert.strictEqual(
        me.corpo.is_pro, assinatura.corpo.is_pro,
        `${tier}/${status}: /users/me disse ${me.corpo.is_pro} e /subscriptions disse ${assinatura.corpo.is_pro}`,
      );
    }
  });

  // ---------- O feed manda o selo de verdade ----------
  const autor = await db.prepare(`
    SELECT a.id, a.user_id FROM activities a WHERE a.privacy = 'public' LIMIT 1
  `).get();
  assert.ok(autor, 'o seed precisa ter uma atividade pública');

  const buscarNoFeed = async (quem) => {
    const r = await pegar('/social/feed?scope=global&limit=100', quem);
    assert.strictEqual(r.status, 200, `feed respondeu ${r.status}`);
    return (r.corpo.feed || []).find((p) => p.id === autor.id);
  };

  await teste('T5: o feed marca PRO quem de fato tem PRO', async () => {
    db.prepare("UPDATE users SET subscription_tier = 'pro', subscription_status = 'active' WHERE id = ?")
      .run(autor.user_id);
    const post = await buscarNoFeed(atleta.id);
    assert.ok(post, 'a atividade precisa aparecer no feed global');
    assert.strictEqual(post.is_pro, true, 'assinante ativo tem de receber o selo');
  });

  await teste('T6: o feed não marca PRO quem cancelou', async () => {
    db.prepare("UPDATE users SET subscription_tier = 'pro', subscription_status = 'canceled' WHERE id = ?")
      .run(autor.user_id);
    const post = await buscarNoFeed(atleta.id);
    assert.strictEqual(post.is_pro, false, 'cancelou, perdeu o selo');
  });

  await teste('T7: o feed manda a cidade do perfil, não a anotação da corrida', async () => {
    db.prepare("UPDATE user_profiles SET location = 'Itu, SP' WHERE user_id = ?").run(autor.user_id);
    db.prepare("UPDATE activities SET description = 'perna pesada hoje' WHERE id = ?").run(autor.id);
    const post = await buscarNoFeed(atleta.id);
    assert.strictEqual(post.location, 'Itu, SP',
      'o lugar vem do perfil; a descrição é legenda, não endereço');
  });

  await teste('T8: o status da assinatura alheia não vaza no feed', async () => {
    const post = await buscarNoFeed(atleta.id);
    for (const campo of ['subscription_tier', 'subscription_status', 'trial_ends_at', 'role']) {
      assert.ok(!(campo in post),
        `"${campo}" não pode viajar no feed — ele entra na consulta só para decidir o selo`);
    }
  });

  // ---------- O cliente obedece, não recalcula ----------
  await teste('T9: o cliente não recalcula o acesso PRO por conta própria', () => {
    const contexto = fs.readFileSync(path.join(RAIZ, 'src', 'context', 'AuthContext.tsx'), 'utf8');
    const semComentarios = contexto
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const trecho = /const isPro = [\s\S]*?;/.exec(semComentarios);
    assert.ok(trecho, 'não achei o cálculo de isPro no AuthContext');
    assert.ok(!/subscription_tier|'coach'|"coach"/.test(trecho[0]),
      `o cliente voltou a decidir sozinho: ${trecho[0].trim()}`);
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
