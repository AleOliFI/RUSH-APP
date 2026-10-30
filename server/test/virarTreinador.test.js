// ============================================================
// RUSH RUNNING — O caminho honesto para virar treinador
// ------------------------------------------------------------
// POST /api/academies criava a assessoria E promovia quem chamava a
// `owner`, exigindo apenas estar logado: qualquer atleta virava dono
// chamando a API direto, e — enquanto o cargo dava PRO — isso era
// também o caminho para o produto pago de graça.
//
// A rota foi fechada para quem já é treinador. Isso tapou o furo e,
// junto, tirou do app o único caminho para alguém SE TORNAR
// treinador: era preciso já ser.
//
// Este fluxo é a reposição: a pessoa pede, um administrador decide.
//
// POR QUE SÓ `admin` DECIDE, e não `owner`: qualquer treinador que
// cria uma assessoria vira `owner`. Se `owner` pudesse aprovar,
// donos fabricariam treinadores uns aos outros e o furo voltaria
// pela porta dos fundos — com mais passos.
//
// O QUE ESTÁ EM JOGO NUMA APROVAÇÃO: treinador enxerga a prontidão
// fisiológica e o histórico dos atletas dele. Promover por engano
// não é cadastrar alguém a mais; é dar a um estranho a leitura de
// dado de saúde de outras pessoas.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Database } = require('../database/sqlite');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO = path.join(RAIZ, 'data', `virar-treinador-test-${process.pid}.db`);
const PORTA = 3441;

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
  console.log('📌 VIRAR TREINADOR — PEDIDO E APROVAÇÃO');
  console.log('============================================================\n');

  limpar();
  process.env.QUIET = 'true';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'teste-virar-treinador';

  const db = new Database(CAMINHO);
  await require('../database/schema.js')(db);
  await require('../database/seedData.js')(db);

  const app = express();
  app.use(express.json());
  app.use('/api/academies', require('../routes/academies.js')(db));
  app.use('/api/users', require('../routes/users.js')(db));
  const servidor = app.listen(PORTA);
  const BASE = `http://127.0.0.1:${PORTA}/api`;

  const atleta = await db.prepare("SELECT id FROM users WHERE email = 'pedro@email.com'").get();
  const treinador = await db.prepare("SELECT id, academy_id FROM users WHERE role = 'coach' LIMIT 1").get();
  const dono = await db.prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1").get();
  assert.ok(atleta && treinador, 'o seed precisa de atleta e treinador');

  // Um administrador: o seed não tem nenhum, e é ele quem decide.
  const adminId = 'usr-admin-teste';
  db.prepare("INSERT INTO users (id, email, password_hash, role) VALUES (?, 'admin@rush.com', 'x', 'admin')").run(adminId);
  db.prepare("INSERT INTO user_profiles (user_id, name, username) VALUES (?, 'Admin', 'admin_rush')").run(adminId);

  // Sem assinatura de propósito: o seed dá 'pro'/'active' a TODAS as
  // contas, e T12 precisa provar que virar treinador não libera o
  // produto pago. Com a assinatura do seed, ele passaria por engano.
  db.prepare("UPDATE users SET role = 'athlete', academy_id = NULL, subscription_tier = 'free', subscription_status = 'free' WHERE id = ?").run(atleta.id);

  const token = (id, role) => jwt.sign({ id, role, academy_id: null }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const cab = (id, role) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token(id, role)}` });

  const postar = async (rota, corpo, id, role) => {
    const r = await fetch(`${BASE}${rota}`, { method: 'POST', headers: cab(id, role), body: JSON.stringify(corpo) });
    let c = {}; try { c = await r.json(); } catch (_) {}
    return { status: r.status, corpo: c };
  };
  const pegar = async (rota, id, role) => {
    const r = await fetch(`${BASE}${rota}`, { headers: cab(id, role) });
    let c = {}; try { c = await r.json(); } catch (_) {}
    return { status: r.status, corpo: c };
  };

  const cargoDe = async (id) => (await db.prepare('SELECT role FROM users WHERE id = ?').get(id)).role;

  let pedidoId = null;

  // ---------- Pedir ----------
  await teste('T1: o atleta consegue pedir, e o pedido nasce pendente', async () => {
    const r = await postar('/academies/solicitacoes',
      { nome_da_assessoria: 'Equipe Corre Itu', mensagem: 'Treino 20 atletas há 6 anos' },
      atleta.id, 'athlete');

    assert.strictEqual(r.status, 201, `esperado 201, veio ${r.status}: ${JSON.stringify(r.corpo)}`);
    assert.strictEqual(r.corpo.solicitacao.status, 'pendente');
    assert.strictEqual(await cargoDe(atleta.id), 'athlete',
      'PEDIR não pode promover ninguém — senão o furo voltou com outro nome');
    pedidoId = r.corpo.solicitacao.id;
  });

  await teste('T2: pedir duas vezes não cria dois pedidos', async () => {
    const r = await postar('/academies/solicitacoes', { nome_da_assessoria: 'Outra' }, atleta.id, 'athlete');
    assert.strictEqual(r.status, 409, `esperado 409, veio ${r.status}`);
    const n = await db.prepare("SELECT COUNT(*) as n FROM solicitacoes_treinador WHERE user_id = ? AND status = 'pendente'").get(atleta.id);
    assert.strictEqual(Number(n.n), 1, 'o administrador não pode decidir duas vezes a mesma coisa');
  });

  await teste('T3: quem já é treinador não pede', async () => {
    // Nome válido de propósito: com um nome curto o 400 da validação
    // chegaria antes, e o teste não provaria nada sobre o cargo.
    const r = await postar('/academies/solicitacoes', { nome_da_assessoria: 'Equipe do Coach' }, treinador.id, 'coach');
    assert.strictEqual(r.status, 409, `esperado 409, veio ${r.status}`);
  });

  await teste('T4: pedido sem nome de assessoria é recusado', async () => {
    const outro = await db.prepare("SELECT id FROM users WHERE role = 'athlete' AND id != ? LIMIT 1").get(atleta.id);
    const r = await postar('/academies/solicitacoes', { nome_da_assessoria: ' ' }, outro.id, 'athlete');
    assert.strictEqual(r.status, 400, `esperado 400, veio ${r.status}`);
  });

  // ---------- Quem pode decidir ----------
  await teste('T5: atleta não vê a fila nem decide', async () => {
    assert.strictEqual((await pegar('/academies/solicitacoes', atleta.id, 'athlete')).status, 403);
    const r = await postar(`/academies/solicitacoes/${pedidoId}/decidir`, { aprovar: true }, atleta.id, 'athlete');
    assert.strictEqual(r.status, 403, `esperado 403, veio ${r.status}`);
    assert.strictEqual(await cargoDe(atleta.id), 'athlete', 'ninguém se aprova');
  });

  await teste('T6: treinador não decide', async () => {
    const r = await postar(`/academies/solicitacoes/${pedidoId}/decidir`, { aprovar: true }, treinador.id, 'coach');
    assert.strictEqual(r.status, 403, `esperado 403, veio ${r.status}`);
  });

  await teste('T7: dono de assessoria TAMBÉM não decide', async () => {
    // Esta é a que importa: `owner` é qualquer treinador que criou uma
    // assessoria. Se ele aprovasse, donos fabricariam treinadores uns
    // aos outros e o furo voltaria pela porta dos fundos.
    assert.ok(dono, 'o seed precisa de um owner');
    const r = await postar(`/academies/solicitacoes/${pedidoId}/decidir`, { aprovar: true }, dono.id, 'owner');
    assert.strictEqual(r.status, 403, `esperado 403, veio ${r.status}`);
    assert.strictEqual(await cargoDe(atleta.id), 'athlete');
  });

  // ---------- Recusar ----------
  await teste('T8: o administrador recusa, com motivo, e ninguém é promovido', async () => {
    const r = await postar(`/academies/solicitacoes/${pedidoId}/decidir`,
      { aprovar: false, motivo: 'Faltou comprovar a experiência' }, adminId, 'admin');

    assert.strictEqual(r.status, 200, `esperado 200, veio ${r.status}: ${JSON.stringify(r.corpo)}`);
    assert.strictEqual(r.corpo.solicitacao.status, 'recusada');
    assert.strictEqual(r.corpo.solicitacao.motivo_da_recusa, 'Faltou comprovar a experiência');
    assert.strictEqual(await cargoDe(atleta.id), 'athlete');
  });

  await teste('T9: decidir de novo o mesmo pedido é recusado', async () => {
    const r = await postar(`/academies/solicitacoes/${pedidoId}/decidir`, { aprovar: true }, adminId, 'admin');
    assert.strictEqual(r.status, 409, `esperado 409, veio ${r.status}`);
    assert.strictEqual(await cargoDe(atleta.id), 'athlete',
      'reabrir um pedido decidido não pode promover por fora do fluxo');
  });

  await teste('T10: quem foi recusado pode pedir de novo', async () => {
    const r = await postar('/academies/solicitacoes', { nome_da_assessoria: 'Equipe Corre Itu' }, atleta.id, 'athlete');
    assert.strictEqual(r.status, 201, `esperado 201, veio ${r.status}`);
    pedidoId = r.corpo.solicitacao.id;
  });

  // ---------- Aprovar ----------
  await teste('T11: aprovado, a conta vira treinador e consegue criar a assessoria', async () => {
    const r = await postar(`/academies/solicitacoes/${pedidoId}/decidir`, { aprovar: true }, adminId, 'admin');
    assert.strictEqual(r.status, 200, `esperado 200, veio ${r.status}`);
    assert.strictEqual(await cargoDe(atleta.id), 'coach', 'a aprovação precisa promover');

    // E a promoção de fato abre a porta que estava fechada.
    const criada = await postar('/academies', { name: 'Equipe Corre Itu' }, atleta.id, 'coach');
    assert.strictEqual(criada.status, 201,
      `o caminho tem de terminar numa assessoria criada — veio ${criada.status}`);
  });

  await teste('T12: aprovar não dá PRO de brinde', async () => {
    // O cargo deixou de dar acesso pago (server/services/acessoPro.js).
    // Se a aprovação voltasse a dar, o furo antigo teria renascido
    // dentro do fluxo novo.
    const me = await pegar('/users/me', atleta.id, 'coach');
    assert.strictEqual(me.corpo.is_pro, false,
      'virar treinador não pode liberar o produto pago');
  });

  await teste('T13: a pessoa consegue acompanhar o próprio pedido', async () => {
    const r = await pegar('/academies/solicitacoes/minha', atleta.id, 'coach');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.corpo.solicitacao.status, 'aprovada');
  });

  await teste('T14: a decisão fica registrada — quem decidiu e quando', async () => {
    const linha = await db.prepare('SELECT * FROM solicitacoes_treinador WHERE id = ?').get(pedidoId);
    assert.strictEqual(linha.decidido_por, adminId, 'sem isso, não há a quem perguntar depois');
    assert.ok(linha.decidido_em, 'a data da decisão precisa ficar');
  });

  await teste('T15: a pessoa é avisada da decisão', async () => {
    const aviso = await db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ? AND type = 'system'
      ORDER BY created_at DESC
    `).all(atleta.id);
    assert.ok(aviso.length >= 2,
      'recusa e aprovação precisam avisar — senão a pessoa fica esperando sem saber');
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
