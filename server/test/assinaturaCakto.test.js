// ============================================================
// RUSH RUNNING — Assinatura pela web (Cakto)
// ------------------------------------------------------------
// Quem abre o app pelo navegador não tem loja para comprar: o botão
// de assinar só podia dar erro. A compra na web agora passa pelo
// checkout da Cakto, e quem libera o PRO é o aviso (webhook) que ela
// manda ao servidor — nunca o cliente.
//
// O QUE ESTE TESTE PROTEGE
//
// 1. Fecha por falta de configuração. Sem CAKTO_WEBHOOK_SECRET a rota
//    não atende ninguém. A rota irmã já teve segredo literal num
//    repositório público; aqui não há valor de reserva nenhum.
// 2. Não aceita aviso sem credencial, nem com credencial errada.
// 3. Aviso repetido não vira duas assinaturas. Webhook repete —
//    é o comportamento normal dele, não a exceção.
// 4. Reembolso e cancelamento tiram o acesso, cada um no seu estado.
// 5. Pagamento sem conta correspondente não é engolido em silêncio.
// 6. O PRO liberado aqui é o mesmo que o resto do app enxerga: a
//    conferência é feita por /users/me, não pelo que a rota gravou.
//
// O QUE ESTE TESTE NÃO PODE PROVAR
//
// O formato exato do aviso da Cakto. A documentação oficial está fora
// do alcance da rede deste ambiente, e o que reuni veio de material
// de segunda mão. Por isso o leitor em server/services/pagamentos/cakto.js
// procura cada campo numa lista de caminhos possíveis e devolve null
// quando não acha — e o teste exercita tanto o formato documentado
// quanto a falta. Confirme com um evento de teste do painel antes de
// ligar em produção.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Database } = require('../database/sqlite');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO = path.join(RAIZ, 'data', `cakto-test-${process.pid}.db`);
const PORTA = 3421;
const SEGREDO = 'segredo-de-teste-da-cakto';

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
  console.log('📌 ASSINATURA PELA WEB (CAKTO)');
  console.log('============================================================\n');

  limpar();
  process.env.QUIET = 'true';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'teste-cakto';

  const db = new Database(CAMINHO);
  await require('../database/schema.js')(db);
  await require('../database/seedData.js')(db);

  // O mesmo `verify` do servidor de verdade (server/index.js): sem o
  // corpo original não há como conferir assinatura HMAC.
  const app = express();
  app.use(express.json({
    verify: (req, _res, buffer) => { if (buffer && buffer.length) req.rawBody = buffer.toString('utf8'); },
  }));
  app.use('/api/subscriptions', require('../routes/subscriptions.js')(db));
  app.use('/api/users', require('../routes/users.js')(db));
  const servidor = app.listen(PORTA);
  const BASE = `http://127.0.0.1:${PORTA}/api`;

  const atleta = await db.prepare("SELECT id, email FROM users WHERE role = 'athlete' LIMIT 1").get();
  assert.ok(atleta, 'o seed precisa ter um atleta');

  const zerarAssinatura = () => {
    db.prepare("UPDATE users SET subscription_tier = 'free', subscription_status = 'free', subscription_provider = NULL, subscription_expires_at = NULL WHERE id = ?").run(atleta.id);
    db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(atleta.id);
  };

  const avisar = async (corpo, { segredoNoCorpo = SEGREDO, cabecalhos = {} } = {}) => {
    const payload = segredoNoCorpo === null ? corpo : { secret: segredoNoCorpo, ...corpo };
    const r = await fetch(`${BASE}/subscriptions/webhook/cakto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...cabecalhos },
      body: JSON.stringify(payload),
    });
    let corpoResposta = {};
    try { corpoResposta = await r.json(); } catch (_) {}
    return { status: r.status, corpo: corpoResposta };
  };

  const compraAprovada = (pedido, email) => ({
    event: 'purchase_approved',
    data: {
      id: pedido,
      refId: `ref-${pedido}`,
      customer: { name: 'Atleta Teste', email },
      offer: { id: 'oferta-pro', name: 'RUSH PRO Mensal', price: 29.9 },
    },
  });

  const souPro = async () => {
    const token = jwt.sign({ id: atleta.id, role: 'athlete', academy_id: null }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const r = await fetch(`${BASE}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
    return (await r.json()).is_pro;
  };

  const contarAssinaturas = async () =>
    (await db.prepare('SELECT COUNT(*) as n FROM subscriptions WHERE user_id = ?').get(atleta.id)).n;

  // O seed entrega atleta já assinante. Sem zerar, "continua PRO"
  // não distinguiria "a rota não liberou" de "já era PRO antes".
  zerarAssinatura();

  // ---------- 1. Fecha por falta de configuração ----------
  await teste('T1: sem CAKTO_WEBHOOK_SECRET a rota não atende ninguém', async () => {
    delete process.env.CAKTO_WEBHOOK_SECRET;
    const r = await avisar(compraAprovada('ped-sem-config', atleta.email));
    assert.strictEqual(r.status, 503, `esperado 503, veio ${r.status}`);
    assert.strictEqual(await souPro(), false, 'não pode liberar PRO sem configuração');
  });

  process.env.CAKTO_WEBHOOK_SECRET = SEGREDO;

  // ---------- 2. Credencial ----------
  await teste('T2: aviso sem segredo nenhum é recusado', async () => {
    const r = await avisar(compraAprovada('ped-sem-segredo', atleta.email), { segredoNoCorpo: null });
    assert.strictEqual(r.status, 401, `esperado 401, veio ${r.status}`);
    assert.strictEqual(await souPro(), false, 'aviso anônimo não pode liberar nada');
  });

  await teste('T3: aviso com segredo errado é recusado', async () => {
    const r = await avisar(compraAprovada('ped-segredo-errado', atleta.email), { segredoNoCorpo: 'chute' });
    assert.strictEqual(r.status, 401, `esperado 401, veio ${r.status}`);
    assert.strictEqual(await souPro(), false);
  });

  await teste('T4: assinatura HMAC no cabeçalho, quando vier, tem de bater', async () => {
    const crypto = require('crypto');
    const corpo = compraAprovada('ped-hmac', atleta.email);
    const bruto = JSON.stringify({ secret: SEGREDO, ...corpo });
    const certa = crypto.createHmac('sha256', SEGREDO).update(bruto, 'utf8').digest('hex');

    const errada = await avisar(corpo, { cabecalhos: { 'x-cakto-signature': 'f'.repeat(64) } });
    assert.strictEqual(errada.status, 401, 'assinatura errada tem de ser recusada');
    assert.strictEqual(await souPro(), false);

    const ok = await avisar(corpo, { cabecalhos: { 'x-cakto-signature': certa } });
    assert.strictEqual(ok.status, 200, `assinatura certa devia passar, veio ${ok.status}`);
  });

  zerarAssinatura();

  // ---------- 3. Liberar ----------
  await teste('T5: compra aprovada libera o PRO que o resto do app enxerga', async () => {
    const r = await avisar(compraAprovada('ped-001', atleta.email));
    assert.strictEqual(r.status, 200, `esperado 200, veio ${r.status}: ${JSON.stringify(r.corpo)}`);
    assert.strictEqual(r.corpo.acao, 'liberado');
    assert.strictEqual(await souPro(), true, '/users/me precisa concordar que a conta é PRO');

    const assinatura = await db.prepare('SELECT * FROM subscriptions WHERE provider_subscription_id = ?').get('ped-001');
    assert.ok(assinatura, 'a assinatura tem de ficar registrada');
    assert.strictEqual(assinatura.provider, 'cakto');
    assert.strictEqual(assinatura.amount_cents, 2990, 'R$ 29,90 são 2990 centavos');
  });

  // ---------- 4. Repetição ----------
  await teste('T6: o mesmo aviso duas vezes não vira duas assinaturas', async () => {
    const antes = await contarAssinaturas();
    const r = await avisar(compraAprovada('ped-001', atleta.email));
    assert.strictEqual(r.status, 200, 'repetição não é erro');
    assert.strictEqual(r.corpo.acao, 'repetido');
    assert.strictEqual(await contarAssinaturas(), antes, 'não pode gravar de novo');
  });

  // ---------- 5. Perder o acesso ----------
  await teste('T7: cancelamento tira o acesso', async () => {
    const r = await avisar({ event: 'subscription_canceled', data: { id: 'ped-001', customer: { email: atleta.email } } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(await souPro(), false, 'cancelou, perdeu o acesso');
    const u = await db.prepare('SELECT subscription_status FROM users WHERE id = ?').get(atleta.id);
    assert.strictEqual(u.subscription_status, 'canceled');
  });

  zerarAssinatura();

  await teste('T8: reembolso tira o acesso e derruba o plano', async () => {
    await avisar(compraAprovada('ped-002', atleta.email));
    assert.strictEqual(await souPro(), true, 'precondição: a compra liberou');

    const r = await avisar({ event: 'refund', data: { id: 'ped-002', customer: { email: atleta.email } } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(await souPro(), false, 'devolveu o dinheiro, acabou o acesso');
    const u = await db.prepare('SELECT subscription_tier, subscription_status FROM users WHERE id = ?').get(atleta.id);
    assert.strictEqual(u.subscription_tier, 'free', 'reembolso não deixa o plano como pro');
    assert.strictEqual(u.subscription_status, 'expired');
  });

  zerarAssinatura();

  // ---------- 6. Casar pela referência do link ----------
  await teste('T9: a referência do link do checkout identifica a conta', async () => {
    const r = await avisar({
      event: 'purchase_approved',
      data: {
        id: 'ped-003',
        src: atleta.id,
        customer: { email: 'outro-email-de-pagamento@exemplo.com' },
        offer: { price: 29.9 },
      },
    });
    assert.strictEqual(r.status, 200, `esperado 200, veio ${r.status}`);
    assert.strictEqual(await souPro(), true,
      'quem pagou com outro e-mail ainda assim é identificado pela referência do link');
  });

  zerarAssinatura();

  // ---------- 7. Nada de silêncio ----------
  await teste('T10: pagamento sem conta correspondente não é engolido', async () => {
    const r = await avisar(compraAprovada('ped-004', 'ninguem-por-aqui@exemplo.com'));
    assert.strictEqual(r.status, 202,
      'nem 200 (que daria por resolvido) nem 500 (que faria a Cakto repetir para sempre)');
    assert.strictEqual(r.corpo.conciliar, true, 'a resposta tem de pedir conferência manual');
  });

  await teste('T11: evento que não mexe no acesso não mexe no acesso', async () => {
    zerarAssinatura();
    const r = await avisar({ event: 'purchase_refused', data: { id: 'ped-005', customer: { email: atleta.email } } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.corpo.acao, 'ignorado');
    assert.strictEqual(await souPro(), false, 'pagamento recusado não libera nada');
  });

  // ---------- 8. A regra das lojas ----------
  await teste('T12: o checkout web não aparece dentro do app empacotado', () => {
    const billing = fs.readFileSync(path.join(RAIZ, 'src', 'services', 'billing.js'), 'utf8');
    const fn = /export function linkDoCheckoutWeb[\s\S]*?\n}/.exec(billing);
    assert.ok(fn, 'não achei linkDoCheckoutWeb');
    assert.ok(/if \(ehAppNativo\(\)\) return null;/.test(fn[0]),
      'a Apple (3.1.1) e o Google reprovam app de loja que aponta para pagamento externo: '
      + 'o link tem de sumir quando está rodando empacotado');
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
