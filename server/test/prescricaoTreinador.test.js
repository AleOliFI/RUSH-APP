// ============================================================
// RUSH RUNNING — A prescrição do treinador chega ao atleta
// ------------------------------------------------------------
// A rota POST /academies/athlete/:id/prescribe notificava o
// atleta, devolvia "Treino prescrito e enviado com sucesso!" e
// NÃO GRAVAVA NADA. Zero INSERT. O atleta recebia o aviso, abria
// o app e não encontrava treino nenhum.
//
// Nada quebrava: a resposta era 200, o treinador via a confirmação
// e só o atleta descobria — não encontrando o que lhe disseram que
// estava lá.
//
// Duas armadilhas do modelo, que estes testes fixam:
//
// 1. Uma sessão vive na chave (plan_id, week_number, day_of_week).
//    Não há coluna de data. Quem grava e quem procura precisam
//    calcular a semana igual, senão a sessão cai num dia que o app
//    não consulta — sem erro nenhum.
//
// 2. Todo dia do plano já tem sessão, inclusive descanso. Inserir
//    outra no mesmo dia deixaria "o treino de hoje" ambíguo,
//    porque /training/my-plan busca com .get(). Prescrever
//    SUBSTITUI o dia.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Database } = require('../database/sqlite');
const { posicaoNoPlano } = require('../services/semanaDoPlano');

const CAMINHO = path.join(__dirname, '..', '..', 'data', `prescricao-test-${process.pid}.db`);
const PORTA = 3403;

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
  console.log('📌 PRESCRIÇÃO DO TREINADOR');
  console.log('============================================================');

  limpar();
  process.env.QUIET = 'true';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'teste-prescricao';

  const db = new Database(CAMINHO);
  await require('../database/schema.js')(db);
  await require('../database/seedData.js')(db);

  const app = express();
  app.use(express.json());
  app.use('/api/academies', require('../routes/academies.js')(db));
  app.use('/api/training', require('../routes/training.js')(db));
  const servidor = app.listen(PORTA);

  const coach = await db.prepare("SELECT id, role, academy_id FROM users WHERE role = 'coach'").get();
  const atletaId = 'usr-maria-003';
  await db.prepare('UPDATE users SET academy_id = ? WHERE id = ?').run(coach.academy_id, atletaId);

  const atleta = { id: atletaId, role: 'athlete', academy_id: coach.academy_id };
  const token = (u) => jwt.sign({ id: u.id, role: u.role, academy_id: u.academy_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const cab = (u) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token(u)}` });
  const BASE = `http://127.0.0.1:${PORTA}/api`;

  const meuPlano = async () => (await fetch(`${BASE}/training/my-plan`, { headers: cab(atleta) })).json();

  const prescrever = async (corpo) => {
    const r = await fetch(`${BASE}/academies/athlete/${atletaId}/prescribe`, {
      method: 'POST', headers: cab(coach), body: JSON.stringify(corpo),
    });
    return { status: r.status, corpo: await r.json() };
  };

  await teste('T1: a sessão prescrita é gravada e vira o treino de hoje do atleta', async () => {
    const antes = await meuPlano();
    assert.ok(antes.has_plan, 'a atleta precisa ter plano ativo para o teste valer');

    const { status, corpo } = await prescrever({
      title: 'Tiros de Limiar 5x1200m', type: 'interval',
      distance_km: 12, duration_min: 60,
      target_pace: '4:15-4:25/km', target_hr_zone: 'Z4',
      description: 'Aquecimento 2.5km + 5x1200m @4:18/km',
    });
    assert.strictEqual(status, 201, `esperava 201, veio ${status}: ${corpo.error || ''}`);
    assert.ok(corpo.session && corpo.session.id, 'a resposta precisa trazer a sessão gravada');

    const depois = await meuPlano();
    const hoje = depois.today_session;
    assert.ok(hoje, 'o atleta ficou sem treino de hoje');
    assert.strictEqual(Number(hoje.distance_km), 12, 'não é a sessão prescrita');
    assert.strictEqual(hoje.target_hr_zone, 'Z4');
    assert.match(String(hoje.description), /5x1200m/);
  });

  await teste('T2: prescrever SUBSTITUI o dia, não acrescenta uma segunda sessão', async () => {
    const plano = await meuPlano();
    const { week_number, day_of_week } = posicaoNoPlano(
      plano.plan.start_date, plano.plan.duration_weeks, new Date(),
    );

    const quantas = await db.prepare(
      'SELECT COUNT(*) AS c FROM training_sessions WHERE plan_id = ? AND week_number = ? AND day_of_week = ?'
    ).get(plano.plan.id, week_number, day_of_week);

    assert.strictEqual(Number(quantas.c), 1,
      `o dia ficou com ${quantas.c} sessões; /training/my-plan usa .get() e pegaria uma delas sem critério`);
  });

  await teste('T3: a sessão prescrita é marcada como fixa', async () => {
    // O agente de VFC reduz volume de sessões comuns quando a
    // prontidão cai. Uma prescrição do treinador não deve ser
    // remexida sem que ele saiba.
    const plano = await meuPlano();
    assert.strictEqual(Number(plano.today_session.is_fixed), 1);
  });

  await teste('T4: o atleta é notificado, com o nome do treinador', async () => {
    const n = await db.prepare(
      "SELECT message FROM notifications WHERE user_id = ? AND type = 'plan_assigned' ORDER BY created_at DESC LIMIT 1"
    ).get(atletaId);
    assert.ok(n, 'nenhuma notificação chegou');
    assert.match(n.message, /Ricardo/, 'a notificação deveria nomear o treinador');
  });

  await teste('T5: prescrever duas vezes no mesmo dia continua deixando uma sessão só', async () => {
    await prescrever({ type: 'tempo', distance_km: 8, duration_min: 45, target_hr_zone: 'Z3' });

    const plano = await meuPlano();
    const { week_number, day_of_week } = posicaoNoPlano(
      plano.plan.start_date, plano.plan.duration_weeks, new Date(),
    );
    const quantas = await db.prepare(
      'SELECT COUNT(*) AS c FROM training_sessions WHERE plan_id = ? AND week_number = ? AND day_of_week = ?'
    ).get(plano.plan.id, week_number, day_of_week);

    assert.strictEqual(Number(quantas.c), 1);
    assert.strictEqual(plano.today_session.type, 'tempo', 'a segunda prescrição deveria valer');
  });

  await teste('T6: a semana gravada é a mesma que o app procura', async () => {
    // Esta é a armadilha silenciosa: se a prescrição calculasse a
    // semana de um jeito e my-plan de outro, a sessão existiria no
    // banco e nunca apareceria para o atleta.
    const plano = await meuPlano();
    const { corpo } = await prescrever({ type: 'long_run', distance_km: 18, duration_min: 110 });

    assert.strictEqual(corpo.week_number, plano.plan.current_week,
      `gravou na semana ${corpo.week_number} e o app procura na ${plano.plan.current_week}`);

    const depois = await meuPlano();
    assert.strictEqual(Number(depois.today_session.distance_km), 18,
      'a sessão foi gravada mas o app não a encontrou');
  });

  await teste('T7: atleta de outra assessoria é recusado', async () => {
    const forasteiro = await db.prepare(
      "SELECT id FROM users WHERE academy_id IS NULL OR academy_id <> ? LIMIT 1"
    ).get(coach.academy_id);

    if (!forasteiro) return; // nada a testar neste seed

    const r = await fetch(`${BASE}/academies/athlete/${forasteiro.id}/prescribe`, {
      method: 'POST', headers: cab(coach),
      body: JSON.stringify({ type: 'easy_run', distance_km: 5 }),
    });
    assert.strictEqual(r.status, 404, 'um treinador não pode prescrever fora da própria assessoria');
  });

  await teste('T8: sem plano ativo, a recusa é clara em vez de um erro genérico', async () => {
    await db.prepare("UPDATE assigned_plans SET status = 'cancelled' WHERE user_id = ?").run(atletaId);

    const { status, corpo } = await prescrever({ type: 'easy_run', distance_km: 5 });
    assert.strictEqual(status, 409, `esperava 409, veio ${status}`);
    assert.match(String(corpo.error), /plano ativo/i,
      'a mensagem precisa dizer o que fazer, não só que falhou');
  });

  servidor.close();
  await db.close();
  limpar();

  console.log('\n============================================================');
  console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
  console.log('============================================================');
  process.exit(falharam > 0 ? 1 : 0);
})().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
