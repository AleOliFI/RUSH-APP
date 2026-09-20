// ============================================================
// RUSH RUNNING — Apagar o próprio comentário
// ------------------------------------------------------------
// A rota DELETE /api/social/comment/:id existia e já validava tudo
// o que precisava — dono, 404, 403 — e nenhuma tela a chamava.
// Quem comentava não tinha como desfazer.
//
// O obstáculo não era a rota: era o mapeamento da resposta na
// ActivityCommentsModal, que DESCARTAVA o `user_id` de cada
// comentário. Sem ele a tela não tinha como saber quais
// comentários eram de quem estava lendo, e por isso não podia
// oferecer o botão só para o dono.
//
// Este teste cobra os dois lados: a rota continua recusando quem
// não é dono, e a tela está de fato ligada nela.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Database } = require('../database/sqlite');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO = path.join(RAIZ, 'data', `apagar-comentario-test-${process.pid}.db`);
const PORTA = 3409;

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
  console.log('📌 APAGAR O PRÓPRIO COMENTÁRIO');
  console.log('============================================================\n');

  limpar();
  process.env.QUIET = 'true';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'teste-apagar-comentario';

  const db = new Database(CAMINHO);
  await require('../database/schema.js')(db);
  await require('../database/seedData.js')(db);

  const app = express();
  app.use(express.json());
  app.use('/api/social', require('../routes/social.js')(db));
  const servidor = app.listen(PORTA);
  const BASE = `http://127.0.0.1:${PORTA}/api`;

  const atividade = await db.prepare('SELECT id, user_id FROM activities LIMIT 1').get();
  assert.ok(atividade, 'o seed precisa ter ao menos uma atividade');

  const [autor, estranho] = await db
    .prepare("SELECT id FROM users WHERE role = 'athlete' LIMIT 2")
    .all();
  assert.ok(autor && estranho && autor.id !== estranho.id, 'o teste precisa de dois atletas distintos');

  const token = (id, role = 'athlete') =>
    jwt.sign({ id, role, academy_id: null }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const cab = (id, role) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token(id, role)}` });

  const comentar = async (quem, texto) => {
    const r = await fetch(`${BASE}/social/comment/${atividade.id}`, {
      method: 'POST', headers: cab(quem), body: JSON.stringify({ content: texto }),
    });
    return { status: r.status, corpo: await r.json() };
  };

  const apagar = async (quem, commentId, role) => {
    const r = await fetch(`${BASE}/social/comment/${commentId}`, { method: 'DELETE', headers: cab(quem, role) });
    return { status: r.status, corpo: await r.json() };
  };

  const contar = async () =>
    (await db.prepare('SELECT COUNT(*) as n FROM comments WHERE activity_id = ?').get(atividade.id)).n;

  let meuComentario = null;

  await teste('T1: o dono apaga o próprio comentário e ele some do banco', async () => {
    const criado = await comentar(autor.id, 'comentário que vai embora');
    assert.strictEqual(criado.status, 201, `esperado 201 ao comentar, veio ${criado.status}`);
    const id = criado.corpo.comment?.id || criado.corpo.id;
    assert.ok(id, `a resposta precisa trazer o id: ${JSON.stringify(criado.corpo)}`);

    const antes = await contar();
    const r = await apagar(autor.id, id);
    assert.strictEqual(r.status, 200, `esperado 200, veio ${r.status}: ${JSON.stringify(r.corpo)}`);

    assert.strictEqual(await contar(), antes - 1, 'o contador da atividade precisa cair');
    const sobrou = await db.prepare('SELECT 1 FROM comments WHERE id = ?').get(id);
    assert.ok(!sobrou, 'o comentário tem de sumir do banco, não só da resposta');
  });

  await teste('T2: um terceiro não apaga comentário alheio', async () => {
    const criado = await comentar(autor.id, 'comentário protegido');
    meuComentario = criado.corpo.comment?.id || criado.corpo.id;

    const r = await apagar(estranho.id, meuComentario);
    assert.strictEqual(r.status, 403, `esperado 403, veio ${r.status}`);

    const aindaEsta = await db.prepare('SELECT 1 FROM comments WHERE id = ?').get(meuComentario);
    assert.ok(aindaEsta, 'o comentário não pode ser apagado por quem não é o dono');
  });

  await teste('T3: comentário inexistente responde 404, e não 500', async () => {
    const r = await apagar(autor.id, 'id-que-nao-existe');
    assert.strictEqual(r.status, 404, `esperado 404, veio ${r.status}`);
  });

  await teste('T4: a tela carrega o dono de cada comentário', async () => {
    // Este era o obstáculo real: o mapeamento descartava c.user_id, e
    // sem ele a tela não tinha como distinguir os próprios comentários.
    const modal = fs.readFileSync(
      path.join(RAIZ, 'src', 'components', 'rush', 'ActivityCommentsModal.tsx'), 'utf8');
    assert.match(modal, /authorId:\s*c\.user_id/,
      'o mapeamento precisa carregar o dono; sem ele o botão não tem como aparecer só para quem pode');
  });

  await teste('T5: o botão só aparece para o dono, e chama a rota', async () => {
    const modal = fs.readFileSync(
      path.join(RAIZ, 'src', 'components', 'rush', 'ActivityCommentsModal.tsx'), 'utf8');
    assert.match(modal, /social\.deleteComment\(/, 'a tela precisa chamar social.deleteComment');
    assert.match(modal, /comm\.authorId === currentUserId/,
      'o botão precisa ser condicionado ao dono — oferecer para todos seria prometer uma ação que dá 403');
    assert.match(modal, /window\.confirm\(/, 'apagar é irreversível e precisa de confirmação');
  });

  servidor.close();
  db.close();
  limpar();

  console.log('\n============================================================');
  console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
  console.log('============================================================');
  if (falharam > 0) process.exit(1);
})();
