// ============================================================
// RUSH RUNNING — A assinatura precisa comprar alguma coisa
// ------------------------------------------------------------
// `is_pro` era calculado, informado ao cliente e nunca cobrado:
// nenhuma rota exigia assinatura e nenhuma tela escondia nada. Quem
// pagava R$ 29,90 por mês comprava um selo laranja no perfil.
//
// Isso tem dois lados, e os dois estão aqui.
//
// O LADO DE FORA. Esconder botão não é cobrar: o cliente é um
// arquivo que qualquer pessoa lê, e a rota responde a quem chamar.
// Por isso a porta é o middleware do servidor, e é ele que este
// teste bate — com conta grátis, com assinatura vencida, com teste
// expirado e com cargo de treinador (que também não dá PRO).
//
// O LADO DE DENTRO. Fechar demais é tão ruim quanto não fechar.
// Continua grátis: medir VFC e ver a prontidão de HOJE (é saúde —
// não se cobra para avisar alguém que não deveria treinar forte),
// registrar corrida, o plano, o feed, os sensores que a pessoa
// comprou, e — isto é lei, não cortesia — exportar os próprios dados
// e excluir a conta.
//
// O histórico de VFC não fecha: encurta para 7 dias e AVISA que
// encurtou, porque uma série curta passando por completa é outro
// tipo de mentira.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Database } = require('../database/sqlite');
const { RECURSOS_PRO, CODIGO_SEM_ASSINATURA, DIAS_DE_VFC_SEM_ASSINATURA } = require('../services/recursosPro');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO = path.join(RAIZ, 'data', `paywall-test-${process.pid}.db`);
const PORTA = 3437;

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
  console.log('📌 PAYWALL — A ASSINATURA COMPRA ALGUMA COISA');
  console.log('============================================================\n');

  limpar();
  process.env.QUIET = 'true';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'teste-paywall';

  const db = new Database(CAMINHO);
  await require('../database/schema.js')(db);
  await require('../database/seedData.js')(db);

  const app = express();
  app.use(express.json());
  app.use('/api/hrv', require('../routes/hrv.js')(db));
  app.use('/api/activities', require('../routes/activities.js')(db));
  app.use('/api/users', require('../routes/users.js')(db));
  const servidor = app.listen(PORTA);
  const BASE = `http://127.0.0.1:${PORTA}/api`;

  const conta = await db.prepare("SELECT id FROM users WHERE email = 'maria@email.com'").get();
  assert.ok(conta, 'o seed precisa da conta maria@email.com');

  const token = (role = 'athlete') =>
    jwt.sign({ id: conta.id, role, academy_id: null }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const cab = (role) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token(role)}` });

  const definir = (tier, status, trial = null, role = 'athlete') =>
    db.prepare('UPDATE users SET subscription_tier = ?, subscription_status = ?, trial_ends_at = ?, role = ? WHERE id = ?')
      .run(tier, status, trial, role, conta.id);

  const pegar = async (rota, role) => {
    const r = await fetch(`${BASE}${rota}`, { headers: cab(role) });
    let corpo = {}; try { corpo = await r.json(); } catch (_) {}
    return { status: r.status, corpo };
  };
  const postar = async (rota, dados, role) => {
    const r = await fetch(`${BASE}${rota}`, { method: 'POST', headers: cab(role), body: JSON.stringify(dados) });
    let corpo = {}; try { corpo = await r.json(); } catch (_) {}
    return { status: r.status, corpo };
  };

  const PAGAS = [
    ['/hrv/vo2max', 'vo2max', (role) => pegar('/hrv/vo2max', role)],
    ['/activities/training-load', 'carga_de_treino', (role) => pegar('/activities/training-load', role)],
    ['/users/field-test', 'protocolo_de_campo',
      (role) => postar('/users/field-test', { distance_m: 2800, duration_min: 12, max_hr: 190 }, role)],
  ];

  // ---------- A porta fecha ----------
  await teste('T1: conta grátis é recusada em todas as rotas pagas, com 402', async () => {
    definir('free', 'free');
    for (const [rota, recurso, chamar] of PAGAS) {
      const r = await chamar();
      assert.strictEqual(r.status, 402,
        `${rota}: esperado 402 (Payment Required), veio ${r.status}`);
      assert.strictEqual(r.corpo.code, CODIGO_SEM_ASSINATURA,
        `${rota}: a resposta precisa trazer o código, não só um texto`);
      assert.strictEqual(r.corpo.recurso, recurso, `${rota}: recurso errado`);
      assert.ok(r.corpo.error && r.corpo.error.length > 20,
        `${rota}: a mensagem precisa dizer o que há do outro lado da porta`);
    }
  });

  await teste('T2: assinatura cancelada perde o acesso', async () => {
    definir('pro', 'canceled');
    for (const [rota, , chamar] of PAGAS) {
      const r = await chamar();
      assert.strictEqual(r.status, 402, `${rota}: cancelou, perdeu — veio ${r.status}`);
    }
  });

  await teste('T3: teste gratuito vencido perde o acesso', async () => {
    definir('pro', 'trial', new Date(Date.now() - 86400000).toISOString());
    for (const [rota, , chamar] of PAGAS) {
      const r = await chamar();
      assert.strictEqual(r.status, 402, `${rota}: teste venceu — veio ${r.status}`);
    }
  });

  await teste('T4: cargo de treinador não abre a porta', async () => {
    // O cargo dá as ferramentas de treinador, não a assinatura.
    definir('free', 'free', null, 'coach');
    for (const [rota, , chamar] of PAGAS) {
      const r = await chamar('coach');
      assert.strictEqual(r.status, 402, `${rota}: cargo não é assinatura — veio ${r.status}`);
    }
    definir('free', 'free');
  });

  await teste('T5: o token antigo não serve de passe', async () => {
    // Assina, pega um token, cancela. O token continua válido e
    // assinado — se a checagem lesse dele, o acesso sobreviveria ao
    // cancelamento por horas.
    definir('pro', 'active');
    const passe = token();
    definir('pro', 'canceled');
    const r = await fetch(`${BASE}/hrv/vo2max`, { headers: { Authorization: `Bearer ${passe}` } });
    assert.strictEqual(r.status, 402,
      'a assinatura tem de ser lida do banco a cada chamada, não do token');
  });

  // ---------- A porta abre ----------
  await teste('T6: quem assina entra', async () => {
    definir('pro', 'active');
    for (const [rota, , chamar] of PAGAS) {
      const r = await chamar();
      assert.notStrictEqual(r.status, 402, `${rota}: assinante não pode esbarrar na porta`);
      assert.ok(r.status < 500, `${rota}: respondeu ${r.status}`);
    }
  });

  await teste('T7: teste gratuito dentro do prazo entra', async () => {
    definir('pro', 'trial', new Date(Date.now() + 3 * 86400000).toISOString());
    const r = await pegar('/hrv/vo2max');
    assert.notStrictEqual(r.status, 402, 'teste válido é assinatura');
  });

  // ---------- O que NÃO pode fechar ----------
  await teste('T8: o ciclo de treino e os direitos sobre os dados ficam de graça', async () => {
    definir('free', 'free');
    const livres = [
      ['/hrv/status', 'a prontidão de hoje é saúde — não se cobra por ela'],
      ['/hrv/zones', 'sem as zonas o atleta não sabe o que "Z4" quer dizer'],
      ['/activities?page=1&limit=5', 'o histórico é dele'],
      ['/activities/stats/summary', 'o resumo do próprio treino'],
      ['/activities/records', 'os próprios recordes'],
      ['/users/me', 'o próprio perfil'],
    ];
    for (const [rota, porque] of livres) {
      const r = await pegar(rota);
      assert.notStrictEqual(r.status, 402, `${rota} não pode ser paga: ${porque}`);
    }
  });

  // ---------- O histórico encurta, não fecha ----------
  await teste('T9: sem assinatura, a série de VFC encurta e diz que encurtou', async () => {
    definir('free', 'free');
    const r = await pegar('/hrv/history?days=28');
    assert.strictEqual(r.status, 200, 'o histórico não fecha a porta');
    assert.strictEqual(r.corpo.period_days, DIAS_DE_VFC_SEM_ASSINATURA,
      `a janela precisa cair para ${DIAS_DE_VFC_SEM_ASSINATURA} dias`);
    assert.strictEqual(r.corpo.limitado_por_assinatura, true,
      'uma série curta passando por completa é outro tipo de mentira');
    assert.strictEqual(r.corpo.dias_pedidos, 28, 'a resposta precisa dizer o que foi pedido');
  });

  await teste('T10: com assinatura, a série vem inteira e sem aviso', async () => {
    definir('pro', 'active');
    const r = await pegar('/hrv/history?days=28');
    assert.strictEqual(r.corpo.period_days, 28);
    assert.strictEqual(r.corpo.limitado_por_assinatura, false);
  });

  // ---------- Os dois lados dizem a mesma coisa ----------
  await teste('T11: o texto da tela é o mesmo texto da API', () => {
    const tela = fs.readFileSync(path.join(RAIZ, 'src', 'components', 'rush', 'BloqueioPro.tsx'), 'utf8');
    for (const [chave, { titulo, explicacao }] of Object.entries(RECURSOS_PRO)) {
      assert.ok(tela.includes(explicacao),
        `o texto de "${chave}" diverge entre a tela e a API — a pessoa leria motivos diferentes para a mesma porta`);
      assert.ok(tela.includes(titulo), `o título de "${chave}" diverge`);
    }
  });

  await teste('T12: toda rota paga passa pelo middleware, e não por checagem solta', () => {
    const rotas = ['hrv', 'activities', 'users']
      .map((n) => fs.readFileSync(path.join(RAIZ, 'server', 'routes', `${n}.js`), 'utf8'))
      .join('\n');
    for (const alvo of [
      "router.get('/vo2max', authenticate, exigirAssinatura(db, 'vo2max')",
      "router.get('/training-load', authenticate, exigirAssinatura(db, 'carga_de_treino')",
      "router.post('/field-test', authenticate, exigirAssinatura(db, 'protocolo_de_campo')",
    ]) {
      assert.ok(rotas.includes(alvo), `a porta saiu da rota: ${alvo}`);
    }
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
