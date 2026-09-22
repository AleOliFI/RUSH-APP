// ============================================================
// RUSH RUNNING — Compra só vira PRO se a loja confirmar
// ------------------------------------------------------------
// A rota anterior (/activate) concedia PRO por 30 ou 365 dias a
// qualquer conta autenticada que pedisse. Sem recibo, sem webhook,
// sem nada. Ela foi fechada, e esta é a porta que a substitui.
//
// Aqui o teste é adversário de propósito. Verificação de recibo é
// o tipo de código em que "passou nos testes felizes" não quer
// dizer nada: o que importa é o que acontece quando alguém está
// tentando não pagar.
//
// Os ataques cobrados:
//   • recibo inventado
//   • assinatura expirada
//   • assinatura revogada (reembolso)
//   • assinatura pausada no Google
//   • recibo VÁLIDO de outra pessoa, reaproveitado
//   • o mesmo recibo repetido, tentando duplicar assinatura
//   • servidor sem credencial nenhuma (precisa falhar FECHADO)
//
// Os verificadores reais falam com Apple e Google pela rede, então
// aqui eles são substituídos no cache de módulos do Node. O que
// está sob teste é a REGRA: o que a rota faz com cada veredito.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Database } = require('../database/sqlite');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO = path.join(RAIZ, 'data', `verificacao-compra-test-${process.pid}.db`);
const PORTA = 3413;

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

// ------------------------------------------------------------
// Substitui os verificadores ANTES de a rota ser carregada.
// A rota os importa no topo; se ela carregar primeiro, fica com os
// verdadeiros e o teste tentaria falar com a Apple pela rede.
// ------------------------------------------------------------
const caminhoApple = require.resolve('../services/recibos/apple');
const caminhoGoogle = require.resolve('../services/recibos/google');

/** O que o verificador falso vai responder na próxima chamada. */
let respostaApple = { valido: false, motivo: 'NAO_CONFIGURADO' };
let respostaGoogle = { valido: false, motivo: 'NAO_CONFIGURADO' };

require.cache[caminhoApple] = {
  id: caminhoApple, filename: caminhoApple, loaded: true, exports: {
    verificarTransacaoApple: async () => respostaApple,
    appleConfigurado: () => true,
  },
};
require.cache[caminhoGoogle] = {
  id: caminhoGoogle, filename: caminhoGoogle, loaded: true, exports: {
    verificarCompraGoogle: async () => respostaGoogle,
    googleConfigurado: () => true,
  },
};

(async () => {
  console.log('\n============================================================');
  console.log('📌 VERIFICAÇÃO DE COMPRA');
  console.log('============================================================\n');

  limpar();
  process.env.QUIET = 'true';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'teste-verificacao-compra';

  const db = new Database(CAMINHO);
  await require('../database/schema.js')(db);

  const app = express();
  app.use(express.json());
  app.use('/api/subscriptions', require('../routes/subscriptions.js')(db));
  const servidor = app.listen(PORTA);
  const BASE = `http://127.0.0.1:${PORTA}/api`;

  // Duas contas: a que compra, e a que vai tentar reaproveitar.
  const COMPRADOR = 'usr-comprador';
  const OPORTUNISTA = 'usr-oportunista';
  for (const [id, email] of [[COMPRADOR, 'comprou@rush.test'], [OPORTUNISTA, 'esperto@rush.test']]) {
    await db.prepare(`
      INSERT INTO users (id, email, password_hash, role, subscription_tier)
      VALUES (?, ?, 'x', 'athlete', 'free')
    `).run(id, email);
  }

  const cab = (id) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt.sign({ id, role: 'athlete', academy_id: null }, process.env.JWT_SECRET, { expiresIn: '1h' })}`,
  });

  const verificar = async (id, corpo) => {
    const r = await fetch(`${BASE}/subscriptions/verificar-compra`, {
      method: 'POST', headers: cab(id), body: JSON.stringify(corpo),
    });
    return { status: r.status, corpo: await r.json() };
  };

  const tier = async (id) => (await db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(id)).subscription_tier;

  const daquiAUmMes = () => new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

  // ---------- Recusas ----------

  await teste('C1: recibo que a loja não reconhece não vira PRO', async () => {
    respostaApple = { valido: false, motivo: 'ASSINATURA_INVALIDA' };
    const r = await verificar(COMPRADOR, { loja: 'apple', recibo: 'recibo-inventado' });
    assert.strictEqual(r.status, 402, `esperado 402, veio ${r.status}`);
    assert.strictEqual(await tier(COMPRADOR), 'free', 'a conta virou PRO com recibo inválido');
  });

  await teste('C2: assinatura expirada não vira PRO', async () => {
    respostaApple = { valido: false, motivo: 'ASSINATURA_EXPIRADA' };
    const r = await verificar(COMPRADOR, { loja: 'apple', recibo: 'recibo-velho' });
    assert.strictEqual(r.status, 402);
    assert.strictEqual(await tier(COMPRADOR), 'free');
  });

  await teste('C3: assinatura revogada (reembolso) não vira PRO', async () => {
    respostaApple = { valido: false, motivo: 'TRANSACAO_REVOGADA' };
    const r = await verificar(COMPRADOR, { loja: 'apple', recibo: 'recibo-reembolsado' });
    assert.strictEqual(r.status, 402);
    assert.strictEqual(await tier(COMPRADOR), 'free');
  });

  await teste('C4: assinatura pausada no Google não vira PRO', async () => {
    respostaGoogle = { valido: false, motivo: 'ESTADO_SUBSCRIPTION_STATE_PAUSED' };
    const r = await verificar(COMPRADOR, { loja: 'google', recibo: 'token-pausado' });
    assert.strictEqual(r.status, 402);
    assert.strictEqual(await tier(COMPRADOR), 'free');
  });

  await teste('C5: loja desconhecida é recusada com 400', async () => {
    const r = await verificar(COMPRADOR, { loja: 'pirata', recibo: 'x' });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(await tier(COMPRADOR), 'free');
  });

  await teste('C6: corpo sem recibo é recusado com 400', async () => {
    const r = await verificar(COMPRADOR, { loja: 'apple' });
    assert.strictEqual(r.status, 400);
  });

  // ---------- A compra legitima ----------

  const RECIBO_BOM = 'assinatura-legitima-123';

  await teste('C7: compra confirmada pela loja concede PRO', async () => {
    respostaApple = {
      valido: true,
      dados: {
        loja: 'apple_app_store',
        idDaAssinatura: RECIBO_BOM,
        idDaTransacao: 'txn-1',
        produto: 'rush_pro_monthly_2990',
        expiraEm: daquiAUmMes(),
      },
    };
    const r = await verificar(COMPRADOR, { loja: 'apple', recibo: RECIBO_BOM });
    assert.strictEqual(r.status, 200, `esperado 200, veio ${r.status}: ${JSON.stringify(r.corpo)}`);
    assert.strictEqual(r.corpo.is_pro, true);
    assert.strictEqual(await tier(COMPRADOR), 'pro');

    const linha = await db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(COMPRADOR);
    assert.ok(linha, 'a assinatura precisa ficar registrada');
    assert.strictEqual(linha.provider_subscription_id, RECIBO_BOM,
      'sem gravar o id da assinatura, não há como impedir o reaproveitamento');
  });

  // ---------- O ataque que importa ----------

  await teste('C8: o MESMO recibo não vira PRO numa segunda conta', async () => {
    // A loja confirmaria: o recibo e legitimo. Mas ele ja pertence a
    // outra pessoa. Sem esta checagem, uma assinatura paga viraria
    // PRO para quantas contas quisessem.
    const r = await verificar(OPORTUNISTA, { loja: 'apple', recibo: RECIBO_BOM });
    assert.strictEqual(r.status, 409, `esperado 409, veio ${r.status}: ${JSON.stringify(r.corpo)}`);
    assert.strictEqual(await tier(OPORTUNISTA), 'free',
      'uma assinatura paga virou PRO em duas contas');
  });

  await teste('C9: e a conta original continua intacta', async () => {
    assert.strictEqual(await tier(COMPRADOR), 'pro');
    const n = await db.prepare('SELECT COUNT(*) as n FROM subscriptions WHERE provider_subscription_id = ?').get(RECIBO_BOM);
    assert.strictEqual(Number(n.n), 1, 'a tentativa criou uma segunda linha para a mesma assinatura');
  });

  await teste('C10: renovação atualiza a assinatura em vez de duplicar', async () => {
    const novaData = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
    respostaApple.dados.expiraEm = novaData;
    const r = await verificar(COMPRADOR, { loja: 'apple', recibo: RECIBO_BOM });
    assert.strictEqual(r.status, 200);

    const linhas = await db.prepare('SELECT COUNT(*) as n FROM subscriptions WHERE provider_subscription_id = ?').get(RECIBO_BOM);
    assert.strictEqual(Number(linhas.n), 1, 'a renovação duplicou a assinatura');

    const u = await db.prepare('SELECT subscription_expires_at FROM users WHERE id = ?').get(COMPRADOR);
    assert.strictEqual(u.subscription_expires_at, novaData, 'a nova data de expiração não foi gravada');
  });

  // ---------- Falha fechada ----------

  await teste('C11: sem credencial configurada, nada é concedido', async () => {
    // Recarrega os verificadores DE VERDADE, sem nenhuma variavel de
    // ambiente: e o estado de um servidor recem-implantado.
    delete require.cache[caminhoApple];
    delete require.cache[caminhoGoogle];
    delete process.env.APPLE_BUNDLE_ID;
    delete process.env.APPLE_ROOT_CA_G3_BASE64;
    delete process.env.GOOGLE_PLAY_PACKAGE;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    const { verificarTransacaoApple, appleConfigurado } = require('../services/recibos/apple');
    const { verificarCompraGoogle, googleConfigurado } = require('../services/recibos/google');

    assert.strictEqual(appleConfigurado(), false);
    assert.strictEqual(googleConfigurado(), false);

    const a = await verificarTransacaoApple('qualquer-coisa');
    const g = await verificarCompraGoogle('qualquer-coisa');
    assert.strictEqual(a.valido, false, 'a Apple passou sem configuração');
    assert.strictEqual(g.valido, false, 'o Google passou sem configuração');
  });

  await teste('C12: /activate continua fechada', async () => {
    const r = await fetch(`${BASE}/subscriptions/activate`, {
      method: 'POST', headers: cab(OPORTUNISTA), body: JSON.stringify({ plan_type: 'yearly' }),
    });
    assert.ok(r.status >= 400, `a rota antiga respondeu ${r.status}`);
    assert.strictEqual(await tier(OPORTUNISTA), 'free');
  });

  await teste('C13: o app não decide sozinho quem é PRO', async () => {
    // billing.js chegou a ser escrito em volta do RevenueCat e de uma
    // ativacao direta. Se qualquer um dos dois voltar, a verificacao
    // no servidor deixa de ser o unico caminho.
    const billing = fs.readFileSync(path.join(RAIZ, 'src', 'services', 'billing.js'), 'utf8');
    const semComentarios = billing
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.ok(!/subscriptions\.activate\(/.test(semComentarios), 'billing voltou a chamar activate');
    assert.ok(!/window\.Purchases/.test(semComentarios), 'o caminho do RevenueCat voltou');
    assert.ok(/verificarCompra\(/.test(semComentarios), 'billing precisa mandar o comprovante ao servidor');
  });

  servidor.close();
  db.close();
  limpar();

  console.log('\n============================================================');
  console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
  console.log('============================================================');
  if (falharam > 0) process.exit(1);
})();
