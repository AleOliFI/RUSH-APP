// ============================================================
// RUSH RUNNING — Treinador cria a própria assessoria
// ------------------------------------------------------------
// `POST /api/academies` existia desde sempre no backend, e nada no
// app o chamava. Quem entrava como treinador sem assessoria via a
// tela dizer "Nenhuma assessoria" e não tinha o que fazer: sem
// assessoria não há atletas, não há convite, não há prescrição —
// a jornada inteira do treinador ficava atrás de uma porta sem
// maçaneta.
//
// A rota faz mais do que inserir uma linha: PROMOVE a conta a
// `owner` e grava o `academy_id`. Isso é o que faz o resto do
// módulo passar a funcionar, e é o que a tela precisa recarregar
// depois de criar — senão o app continua mostrando "Nenhuma
// assessoria" para quem acabou de criar uma.
//
// Este teste cobra a rota de verdade e, no fim, confere que a tela
// está ligada nela. Uma coisa sem a outra deixaria o beco sem saída
// de pé.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Database } = require('../database/sqlite');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO = path.join(RAIZ, 'data', `criar-assessoria-test-${process.pid}.db`);
const PORTA = 3407;

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
  console.log('📌 CRIAR ASSESSORIA');
  console.log('============================================================\n');

  limpar();
  process.env.QUIET = 'true';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'teste-criar-assessoria';

  const db = new Database(CAMINHO);
  await require('../database/schema.js')(db);
  await require('../database/seedData.js')(db);

  const app = express();
  app.use(express.json());
  app.use('/api/academies', require('../routes/academies.js')(db));
  const servidor = app.listen(PORTA);
  const BASE = `http://127.0.0.1:${PORTA}/api`;

  // Um treinador SEM assessoria — exatamente o estado que travava.
  // `users` guarda só identidade e papel; nome e username vivem em
  // user_profiles. Para este teste basta a linha de users.
  const semAssessoriaId = 'usr-treinador-sem-assessoria';
  await db.prepare(`
    INSERT INTO users (id, email, password_hash, role, academy_id)
    VALUES (?, ?, ?, 'coach', NULL)
  `).run(semAssessoriaId, 'sem-assessoria@rush.test', 'x');

  const token = (u) => jwt.sign(
    { id: u.id, role: u.role, academy_id: u.academy_id ?? null },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );
  const cab = (u) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token(u)}` });
  const treinador = { id: semAssessoriaId, role: 'coach', academy_id: null };

  const criar = async (corpo, quem = treinador) => {
    const r = await fetch(`${BASE}/academies`, {
      method: 'POST', headers: cab(quem), body: JSON.stringify(corpo),
    });
    return { status: r.status, corpo: await r.json() };
  };

  await teste('T1: a assessoria é gravada e devolvida', async () => {
    const r = await criar({ name: 'Assessoria Teste', location: 'Itu', plan_type: 'pro' });
    assert.strictEqual(r.status, 201, `esperado 201, veio ${r.status}: ${JSON.stringify(r.corpo)}`);
    assert.ok(r.corpo.id, 'a resposta precisa trazer o id da assessoria criada');
    assert.strictEqual(r.corpo.name, 'Assessoria Teste');

    const naBase = await db.prepare('SELECT * FROM academies WHERE id = ?').get(r.corpo.id);
    assert.ok(naBase, 'a assessoria tem de existir no banco, não só na resposta');
    assert.strictEqual(naBase.location, 'Itu');
  });

  await teste('T2: a conta é promovida a owner e ganha o academy_id', async () => {
    // É isto que destrava o resto do módulo. Sem a promoção, a tela
    // continuaria dizendo "Nenhuma assessoria" logo após criar uma.
    const u = await db.prepare('SELECT role, academy_id FROM users WHERE id = ?').get(semAssessoriaId);
    assert.strictEqual(u.role, 'owner', 'quem cria a assessoria passa a ser o responsável por ela');
    assert.ok(u.academy_id, 'o academy_id precisa ficar gravado na conta');
  });

  await teste('T3: o plano escolhido define as vagas', async () => {
    const u = await db.prepare('SELECT academy_id FROM users WHERE id = ?').get(semAssessoriaId);
    const a = await db.prepare('SELECT plan_type, max_athletes FROM academies WHERE id = ?').get(u.academy_id);
    assert.strictEqual(a.plan_type, 'pro');
    assert.strictEqual(Number(a.max_athletes), 150, 'pro vale 150 atletas; a tela mostra esse número');
  });

  await teste('T4: nome vazio é recusado com 400, e não com 500', async () => {
    const r = await criar({ name: '   ' }, { id: 'outro-treinador', role: 'coach', academy_id: null });
    assert.strictEqual(r.status, 400, `esperado 400, veio ${r.status}`);
    assert.match(String(r.corpo.error || ''), /nome/i, 'o erro precisa dizer o que faltou');
  });

  await teste('T5: plano inválido cai no basic em vez de quebrar', async () => {
    const forasteiro = { id: 'usr-treinador-plano-invalido', role: 'coach', academy_id: null };
    await db.prepare(`
      INSERT INTO users (id, email, password_hash, role, academy_id)
      VALUES (?, ?, ?, 'coach', NULL)
    `).run(forasteiro.id, 'plano-invalido@rush.test', 'x');

    const r = await criar({ name: 'Plano Estranho', plan_type: 'inexistente' }, forasteiro);
    assert.strictEqual(r.status, 201);
    const a = await db.prepare('SELECT plan_type, max_athletes FROM academies WHERE id = ?').get(r.corpo.id);
    assert.strictEqual(a.plan_type, 'basic');
    assert.strictEqual(Number(a.max_athletes), 50);
  });

  await teste('T6: a tela está ligada na rota, e recarrega o usuário depois', async () => {
    // Sem esta verificação, a rota poderia continuar perfeita e o beco
    // sem saída continuar de pé — que foi o estado durante toda a vida
    // do endpoint até aqui.
    const tela = fs.readFileSync(path.join(RAIZ, 'src', 'screens', 'CoachDashboardScreen.tsx'), 'utf8');
    const hook = fs.readFileSync(path.join(RAIZ, 'src', 'hooks', 'useAssessoria.ts'), 'utf8');
    const shell = fs.readFileSync(path.join(RAIZ, 'src', 'RushShell.tsx'), 'utf8');

    assert.match(hook, /academies\.create\(/, 'useAssessoria precisa chamar academies.create');
    assert.match(tela, /criarAssessoria\(/, 'a tela do painel precisa chamar criarAssessoria');
    assert.match(shell, /onAssessoriaCriada=/, 'o shell precisa passar onAssessoriaCriada');
    assert.match(shell, /onAssessoriaCriada=\{async \(\) => \{[\s\S]*?await reload\(\)/,
      'depois de criar, o shell precisa recarregar o usuário — sem isso a tela segue dizendo "Nenhuma assessoria"');
  });

  servidor.close();
  db.close();
  limpar();

  console.log('\n============================================================');
  console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
  console.log('============================================================');
  if (falharam > 0) process.exit(1);
})();
