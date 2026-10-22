// ============================================================
// RUSH RUNNING — O treinador consegue fazer o que o servidor oferece
// ------------------------------------------------------------
// Quatro capacidades existiam no servidor e nenhuma tela as
// alcançava:
//
//   POST /training/plans      montar um plano
//   POST /training/assign     dar um plano a um atleta
//   POST /challenges          criar um desafio
//   GET  /challenges/:id/leaderboard   ver a classificação
//
// A última era a mais estranha: `challenges.leaderboard` estava
// escrita no cliente e ninguém a chamava. O atleta entrava no
// desafio, via a própria barra de progresso e não tinha como saber
// onde estava em relação aos outros — que é a informação principal
// de um desafio.
//
// Sobre montar plano: o treinador usa o GERADOR periodizado, o
// mesmo que monta o plano automático do atleta, em vez de um
// formulário de doze semanas. Uma lógica de prescrição só, num lugar
// só. A rota de geração ganhou `user_id` para isso.
//
// Este teste cobra o comportamento pelas rotas, e cobra também que
// atribuir plano exige vínculo: sem isso, um treinador trocava o
// plano de qualquer conta do app sabendo só o id — e atribuir
// CANCELA o plano ativo de quem recebe.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Database } = require('../database/sqlite');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO = path.join(RAIZ, 'data', `treinador-interface-test-${process.pid}.db`);
const PORTA = 3433;

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

/** Lê os arquivos de `src` uma vez só, para as checagens de ligação. */
function fontesDe(pasta, achados = []) {
  for (const item of fs.readdirSync(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, item.name);
    if (item.isDirectory()) fontesDe(caminho, achados);
    else if (/\.(ts|tsx)$/.test(item.name)) achados.push(caminho);
  }
  return achados;
}

(async () => {
  console.log('\n============================================================');
  console.log('📌 O TREINADOR TEM INTERFACE');
  console.log('============================================================\n');

  limpar();
  process.env.QUIET = 'true';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'teste-treinador-interface';

  const db = new Database(CAMINHO);
  await require('../database/schema.js')(db);
  await require('../database/seedData.js')(db);

  const app = express();
  app.use(express.json());
  app.use('/api/training', require('../routes/training.js')(db));
  app.use('/api/challenges', require('../routes/challenges.js')(db));
  const servidor = app.listen(PORTA);
  const BASE = `http://127.0.0.1:${PORTA}/api`;

  const treinador = await db.prepare("SELECT id, academy_id FROM users WHERE role = 'coach' LIMIT 1").get();
  assert.ok(treinador && treinador.academy_id, 'o seed precisa de um treinador com assessoria');

  const aluno = await db
    .prepare("SELECT id FROM users WHERE role = 'athlete' AND academy_id = ? LIMIT 1")
    .get(treinador.academy_id);
  assert.ok(aluno, 'o seed precisa de um atleta na assessoria do treinador');

  // Alguém de fora da assessoria, para a checagem de vínculo.
  //
  // Criado aqui, e não procurado no seed: no seed todos os atletas
  // são da mesma assessoria, então procurar devolvia nada e os dois
  // testes de autorização eram PULADOS em silêncio — justamente os
  // que importam.
  const estranho = { id: 'usr-estranho-teste' };
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, academy_id)
    VALUES (?, 'estranho@exemplo.com', 'x', 'athlete', NULL)
  `).run(estranho.id);
  db.prepare("INSERT INTO user_profiles (user_id, name, username) VALUES (?, 'Estranho', 'estranho')")
    .run(estranho.id);

  const token = (id, role, academyId) =>
    jwt.sign({ id, role, academy_id: academyId }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const cab = (id, role, academyId) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token(id, role, academyId)}`,
  });

  const comoTreinador = () => cab(treinador.id, 'coach', treinador.academy_id);

  const postar = async (rota, corpo, cabecalhos) => {
    const r = await fetch(`${BASE}${rota}`, {
      method: 'POST', headers: cabecalhos, body: JSON.stringify(corpo),
    });
    let c = {}; try { c = await r.json(); } catch (_) {}
    return { status: r.status, corpo: c };
  };

  const planoAtivoDe = async (userId) =>
    db.prepare("SELECT * FROM assigned_plans WHERE user_id = ? AND status = 'active'").get(userId);

  // ---------- Montar plano para o atleta ----------
  let planoGerado = null;

  await teste('T1: o treinador monta um plano periodizado para o aluno', async () => {
    const r = await postar('/training/generate-plan',
      { distance_km: 10, level: 'intermediate', duration_weeks: 8, user_id: aluno.id },
      comoTreinador());

    assert.strictEqual(r.status, 201, `esperado 201, veio ${r.status}: ${JSON.stringify(r.corpo)}`);

    // Guardado ANTES das asserções: se T1 parar no meio, T2 ainda
    // precisa ter o que comparar. Sem isto, T2 passava a vazio
    // justamente quando T1 falhava.
    planoGerado = r.corpo?.plan?.id ?? null;
    assert.ok(planoGerado, 'a resposta precisa trazer o plano criado');

    assert.ok(Array.isArray(r.corpo.sessions) && r.corpo.sessions.length > 0,
      'um plano sem sessões chega ao atleta como semanas em branco');
    assert.strictEqual(r.corpo.plan.duration_weeks, 8);

    const atribuido = await planoAtivoDe(aluno.id);
    assert.ok(atribuido, 'o plano precisa ficar ativo PARA O ALUNO');
    assert.strictEqual(atribuido.plan_id, planoGerado);
  });

  await teste('T2: o plano foi para o aluno, não para o treinador', async () => {
    assert.ok(planoGerado, 'T1 precisa ter criado o plano para esta checagem valer');
    // Conta as linhas em vez de pegar a primeira: o treinador já tem
    // plano do seed, e `.get()` devolvia aquela — a checagem passava
    // mesmo com o plano novo indo parar na conta dele.
    const quantas = await db
      .prepare('SELECT COUNT(*) as n FROM assigned_plans WHERE user_id = ? AND plan_id = ?')
      .get(treinador.id, planoGerado);
    assert.strictEqual(Number(quantas.n), 0,
      'o gerador atribuía sempre a quem chamava; com user_id, o destino é o aluno');
  });

  await teste('T3: o aluno é avisado de que o plano dele mudou', async () => {
    const aviso = await db
      .prepare("SELECT * FROM notifications WHERE user_id = ? AND type = 'plan_assigned' ORDER BY created_at DESC")
      .get(aluno.id);
    assert.ok(aviso, 'o plano do atleta foi trocado sem ele pedir — ele precisa saber');
  });

  // ---------- Atribuir plano da biblioteca ----------
  await teste('T4: o treinador atribui um plano que já existe', async () => {
    const r = await postar('/training/assign',
      { user_id: aluno.id, plan_id: planoGerado, start_date: '2026-11-01' },
      comoTreinador());

    assert.strictEqual(r.status, 201, `esperado 201, veio ${r.status}: ${JSON.stringify(r.corpo)}`);
    const ativo = await planoAtivoDe(aluno.id);
    assert.strictEqual(ativo.start_date, '2026-11-01');
  });

  // ---------- O vínculo ----------
  {
    await teste('T5: não dá para trocar o plano de quem não é seu aluno', async () => {
      const antes = await planoAtivoDe(estranho.id);

      const r = await postar('/training/assign',
        { user_id: estranho.id, plan_id: planoGerado, start_date: '2026-11-01' },
        comoTreinador());
      assert.strictEqual(r.status, 404, `esperado 404, veio ${r.status}`);

      const depois = await planoAtivoDe(estranho.id);
      assert.deepStrictEqual(
        depois ? depois.plan_id : null,
        antes ? antes.plan_id : null,
        'atribuir cancela o plano ativo: um estranho não pode perder o dele',
      );
    });

    await teste('T6: nem montar plano para quem não é seu aluno', async () => {
      const r = await postar('/training/generate-plan',
        { distance_km: 5, level: 'beginner', duration_weeks: 6, user_id: estranho.id },
        comoTreinador());
      assert.strictEqual(r.status, 404, `esperado 404, veio ${r.status}`);
    });
  }

  await teste('T7: atleta não monta plano para outra pessoa', async () => {
    const r = await postar('/training/generate-plan',
      { distance_km: 5, level: 'beginner', duration_weeks: 6, user_id: treinador.id },
      cab(aluno.id, 'athlete', treinador.academy_id));
    assert.strictEqual(r.status, 403, `esperado 403, veio ${r.status}`);
  });

  await teste('T8: o atleta continua montando o próprio plano', async () => {
    const r = await postar('/training/generate-plan',
      { distance_km: 5, level: 'beginner', duration_weeks: 6 },
      cab(aluno.id, 'athlete', treinador.academy_id));
    assert.strictEqual(r.status, 201, `o caminho antigo não pode ter quebrado: veio ${r.status}`);
    const ativo = await planoAtivoDe(aluno.id);
    assert.strictEqual(ativo.plan_id, r.corpo.plan.id);
  });

  // ---------- Desafio e classificação ----------
  let desafioId = null;

  await teste('T9: o treinador cria um desafio', async () => {
    const r = await postar('/challenges', {
      name: 'Desafio de teste',
      description: 'Criado pela tela de gestão',
      type: 'distance',
      target_value: 100,
      target_unit: 'km',
      start_date: '2026-10-01',
      end_date: '2026-10-31',
    }, comoTreinador());

    assert.strictEqual(r.status, 201, `esperado 201, veio ${r.status}: ${JSON.stringify(r.corpo)}`);
    assert.strictEqual(r.corpo.name, 'Desafio de teste');
    desafioId = r.corpo.id;
  });

  await teste('T10: a classificação mostra quem entrou, ordenada e com a sua linha marcada', async () => {
    await postar(`/challenges/${desafioId}/join`, {}, cab(aluno.id, 'athlete', treinador.academy_id));
    await postar(`/challenges/${desafioId}/update-progress`, { progress_value: 40 },
      cab(aluno.id, 'athlete', treinador.academy_id));

    const r = await fetch(`${BASE}/challenges/${desafioId}/leaderboard`, {
      headers: cab(aluno.id, 'athlete', treinador.academy_id),
    });
    assert.strictEqual(r.status, 200, `esperado 200, veio ${r.status}`);
    const corpo = await r.json();

    assert.ok(Array.isArray(corpo.leaderboard) && corpo.leaderboard.length >= 1,
      'quem entrou tem de aparecer');
    const minha = corpo.leaderboard.find((l) => l.is_me);
    assert.ok(minha, 'a linha de quem está olhando precisa vir marcada');
    assert.strictEqual(minha.rank, 1);
    assert.strictEqual(minha.progress_pct, 40, '40 de 100 km são 40%');
  });

  // ---------- As telas estão de fato ligadas ----------
  const fontes = fontesDe(path.join(RAIZ, 'src'));
  const texto = Object.fromEntries(fontes.map((f) => [path.relative(RAIZ, f), fs.readFileSync(f, 'utf8')]));
  const alguemChama = (expressao) =>
    Object.entries(texto).filter(([nome, conteudo]) => nome !== 'src/api.ts' && expressao.test(conteudo));

  await teste('T11: cada capacidade tem alguém no app que a chama', () => {
    const casos = [
      [/training\.gerarParaAtleta\s*\(|gerarPlano\s*\(/, 'montar plano para o atleta'],
      [/training\.atribuir\s*\(|atribuirPlano\s*\(/, 'atribuir plano'],
      [/challenges\.criar\s*\(/, 'criar desafio'],
      [/challenges\.leaderboard\s*\(/, 'classificação do desafio'],
    ];
    for (const [expressao, nome] of casos) {
      const onde = alguemChama(expressao);
      assert.ok(onde.length > 0, `"${nome}" voltou a não ter chamador no app`);
    }
  });

  await teste('T12: a tela de plano está alcançável pela navegação', () => {
    const shell = texto['src/RushShell.tsx'];
    assert.ok(/CoachPlanScreen/.test(shell), 'a tela precisa estar montada no shell');
    assert.ok(/coachView === 'plano'/.test(shell), 'precisa de uma condição que a exiba');
    const ficha = texto['src/screens/CoachAthleteScreen.tsx'];
    // `onClick={onPlano}`, e não só o nome em algum lugar do arquivo:
    // tirar o onClick deixando o parâmetro declarado passava antes.
    assert.ok(/onClick=\{\s*onPlano\s*\}/.test(ficha),
      'o botão da ficha precisa estar LIGADO ao onPlano, não só declará-lo');
    assert.ok(/onPlano=\{\s*\(\s*\)\s*=>\s*setCoachView\('plano'\)\s*\}/.test(shell),
      'e o shell precisa ligar esse botão à navegação para a tela de plano');
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
