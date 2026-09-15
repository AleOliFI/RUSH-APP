// ============================================================
// RUSH RUNNING — Os planos semeados estão inteiros
// ------------------------------------------------------------
// O plano de demonstração anunciava 12 semanas e tinha só a primeira.
// Nada quebrava: a tela da semana 1 funcionava, e o buraco só
// aparecia para quem tocasse em "semana 2" e encontrasse o calendário
// vazio. Um erro assim não lança, não falha um teste de rota e passa
// por qualquer revisão de diff.
//
// Este teste semeia um banco de verdade e confere o que ficou lá
// dentro: se a duração prometida bate com as semanas gravadas, se
// cada semana tem os sete dias, e se cada atleta saiu com um plano
// compatível com o objetivo dele.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Database } = require('../database/sqlite');

const CAMINHO = path.join(__dirname, '..', '..', 'data', `planos-test-${process.pid}.db`);

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
  for (const sufixo of ['', '-shm', '-wal']) {
    try { fs.unlinkSync(CAMINHO + sufixo); } catch (_) {}
  }
}

(async () => {
  console.log('\n============================================================');
  console.log('📌 PLANOS DE TREINO SEMEADOS');
  console.log('============================================================');

  limpar();
  const db = new Database(CAMINHO);
  process.env.QUIET = 'true';
  await require('../database/schema.js')(db);
  await require('../database/seedData.js')(db);

  await teste('S1: todo plano tem todas as semanas que promete', async () => {
    const planos = await db.prepare(`
      SELECT p.id, p.name, p.duration_weeks,
             COUNT(DISTINCT s.week_number) AS semanas
      FROM training_plans p
      LEFT JOIN training_sessions s ON s.plan_id = p.id
      GROUP BY p.id, p.name, p.duration_weeks
    `).all();

    assert.ok(planos.length > 0, 'o seed não criou nenhum plano');
    for (const p of planos) {
      assert.strictEqual(
        Number(p.semanas), Number(p.duration_weeks),
        `"${p.name}" anuncia ${p.duration_weeks} semanas mas só tem ${p.semanas} gravada(s)`
      );
    }
  });

  await teste('S2: nenhuma semana tem dia faltando nem repetido', async () => {
    const torto = await db.prepare(`
      SELECT p.name, s.week_number, COUNT(*) AS dias,
             COUNT(DISTINCT s.day_of_week) AS distintos
      FROM training_sessions s JOIN training_plans p ON p.id = s.plan_id
      GROUP BY p.name, s.week_number
      HAVING dias <> 7 OR distintos <> 7
    `).all();

    assert.strictEqual(torto.length, 0,
      'semanas incompletas ou com dia repetido: ' +
      torto.map((x) => `${x.name} sem.${x.week_number} (${x.dias} linhas, ${x.distintos} dias)`).join('; '));
  });

  await teste('S3: cada atleta recebe um plano compatível com o objetivo dele', async () => {
    const atribuicoes = await db.prepare(`
      SELECT up.name, ap.status, o.distance_km AS objetivo, o.level AS nivel,
             tp.distance_km AS plano_km, tp.level AS plano_nivel
      FROM assigned_plans ap
      JOIN user_profiles up ON up.user_id = ap.user_id
      JOIN user_objectives o ON o.user_id = ap.user_id
      JOIN training_plans tp ON tp.id = ap.plan_id
    `).all();

    assert.ok(atribuicoes.length > 0, 'nenhum atleta saiu com plano');
    for (const a of atribuicoes) {
      assert.strictEqual(Number(a.plano_km), Number(a.objetivo),
        `${a.name} quer ${a.objetivo}km e recebeu um plano de ${a.plano_km}km`);
      assert.strictEqual(a.plano_nivel, a.nivel,
        `${a.name} é ${a.nivel} e recebeu um plano ${a.plano_nivel}`);
      assert.strictEqual(a.status, 'active', `o plano de ${a.name} não está ativo`);
    }
  });

  await teste('S4: toda sessão de corrida tem volume, e descanso não tem', async () => {
    const semVolume = await db.prepare(`
      SELECT COUNT(*) AS c FROM training_sessions
      WHERE type <> 'rest' AND (distance_km IS NULL OR distance_km <= 0 OR duration_min <= 0)
    `).get();
    assert.strictEqual(Number(semVolume.c), 0, 'há sessão de treino com distância ou duração zerada');

    const descansoComVolume = await db.prepare(`
      SELECT COUNT(*) AS c FROM training_sessions WHERE type = 'rest' AND distance_km > 0
    `).get();
    assert.strictEqual(Number(descansoComVolume.c), 0, 'há dia de descanso com quilometragem');
  });

  await teste('S5: o volume do taper é menor que o do pico', async () => {
    const planos = await db.prepare('SELECT id, name, duration_weeks FROM training_plans').all();
    for (const p of planos) {
      const semanas = await db.prepare(`
        SELECT week_number AS w, SUM(distance_km) AS km
        FROM training_sessions WHERE plan_id = ?
        GROUP BY week_number ORDER BY week_number
      `).all(p.id);

      const total = Number(p.duration_weeks);
      const pico = Math.max(...semanas.filter((x) => x.w <= total - 2).map((x) => Number(x.km)));
      const taper = semanas.filter((x) => x.w > total - 2).map((x) => Number(x.km));

      for (const km of taper) {
        assert.ok(km < pico,
          `"${p.name}": semana de taper com ${km.toFixed(1)}km, não menos que o pico de ${pico.toFixed(1)}km`);
      }
    }
  });

  await db.close();
  limpar();

  console.log('\n============================================================');
  console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
  console.log('============================================================');
  if (falharam > 0) process.exit(1);
})().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
