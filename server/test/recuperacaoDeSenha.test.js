// ============================================================
// RUSH RUNNING — A recuperação de senha não entrega mais a conta
// ------------------------------------------------------------
// A rota POST /auth/forgot-password devolvia o código de
// redefinição NO CORPO DA RESPOSTA:
//
//     res.json({ success: true, code: resetCode })
//
// E a tela de login exibia esse código, com o texto "Em produção
// ele é enviado por email" — mas não existia nenhum envio de
// e-mail no projeto inteiro. Ou seja, em produção qualquer pessoa
// que soubesse o e-mail de outra pedia o código, recebia na hora
// e trocava a senha. Tomada de conta completa, sem passar perto
// da caixa de entrada da vítima.
//
// Havia um segundo vazamento, mais silencioso: a rota respondia
// 404 para e-mail não cadastrado e 200 para cadastrado. Isso é um
// verificador de quem tem conta no RUSH — e num app de saúde essa
// informação sozinha já é sensível.
//
// Este teste cobra as duas coisas, e cobra também que a falha de
// envio não crie um terceiro oráculo pela porta dos fundos.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { Database } = require('../database/sqlite');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO = path.join(RAIZ, 'data', `recuperacao-test-${process.pid}.db`);
const PORTA = 3411;

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
  console.log('📌 RECUPERAÇÃO DE SENHA');
  console.log('============================================================\n');

  limpar();
  process.env.QUIET = 'true';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'teste-recuperacao';
  // Sem credencial: o envio falha de proposito, que e o cenario
  // mais perigoso — o que tentaria "ajudar" devolvendo o codigo.
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;

  const db = new Database(CAMINHO);
  await require('../database/schema.js')(db);

  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth.js')(db));
  const servidor = app.listen(PORTA);
  const BASE = `http://127.0.0.1:${PORTA}/api`;

  const bcrypt = require('bcryptjs');
  const EMAIL_REAL = 'existe@rush.test';
  const ID = 'usr-recuperacao';
  await db.prepare(`
    INSERT INTO users (id, email, password_hash, role)
    VALUES (?, ?, ?, 'athlete')
  `).run(ID, EMAIL_REAL, await bcrypt.hash('senha-antiga', 10));

  const pedir = async (email) => {
    const r = await fetch(`${BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return { status: r.status, corpo: await r.json() };
  };

  let respostaExistente;
  let respostaInexistente;

  await teste('C1: a resposta NÃO carrega o código de redefinição', async () => {
    respostaExistente = await pedir(EMAIL_REAL);
    const texto = JSON.stringify(respostaExistente.corpo);
    assert.ok(!('code' in respostaExistente.corpo), `a resposta ainda traz "code": ${texto}`);

    // E o código gravado no banco não pode aparecer em lugar nenhum
    // do corpo — nem sob outro nome.
    const linha = await db.prepare('SELECT reset_token FROM users WHERE id = ?').get(ID);
    assert.ok(linha.reset_token, 'o código deveria ter sido gerado e gravado');
    assert.ok(!texto.includes(linha.reset_token),
      `o código ${linha.reset_token} vazou na resposta: ${texto}`);
  });

  await teste('C2: e-mail cadastrado e não cadastrado respondem exatamente igual', async () => {
    respostaInexistente = await pedir('ninguem@rush.test');
    assert.strictEqual(respostaInexistente.status, respostaExistente.status,
      `status diferentes: ${respostaExistente.status} vs ${respostaInexistente.status} — isso diz quem tem conta`);
    assert.deepStrictEqual(respostaInexistente.corpo, respostaExistente.corpo,
      'corpos diferentes revelam quais e-mails existem');
  });

  await teste('C3: o envio falhando não muda a resposta', async () => {
    // Não há credencial neste teste, então o envio falhou nas duas
    // chamadas acima. Se a rota tratasse a falha de forma visível,
    // C1 ou C2 já teriam quebrado — aqui a asserção é explícita.
    assert.strictEqual(respostaExistente.status, 200,
      'a rota precisa responder 200 mesmo com o envio falhando');
    assert.ok(!/falh|erro|indispon/i.test(JSON.stringify(respostaExistente.corpo)),
      'a resposta não pode denunciar a falha de envio');
  });

  await teste('C4: o código gerado ainda funciona para redefinir', async () => {
    // Fechar o vazamento não pode ter quebrado a funcionalidade.
    const { reset_token } = await db.prepare('SELECT reset_token FROM users WHERE id = ?').get(ID);
    const r = await fetch(`${BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL_REAL, code: reset_token, new_password: 'senha-nova-123' }),
    });
    const corpo = await r.json();
    assert.strictEqual(r.status, 200, `esperado 200, veio ${r.status}: ${JSON.stringify(corpo)}`);
    assert.ok(corpo.token, 'a redefinição devolve sessão nova');

    const depois = await db.prepare('SELECT password_hash, reset_token FROM users WHERE id = ?').get(ID);
    assert.ok(await bcrypt.compare('senha-nova-123', depois.password_hash), 'a senha não mudou');
    assert.strictEqual(depois.reset_token, null, 'o código precisa ser queimado depois do uso');
  });

  await teste('C5: reset-password não revela se a conta existe', async () => {
    const chutar = async (email) => {
      const r = await fetch(`${BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: '000000', new_password: 'qualquer-coisa' }),
      });
      return { status: r.status, corpo: await r.json() };
    };
    const existe = await chutar(EMAIL_REAL);
    const naoExiste = await chutar('ninguem@rush.test');
    assert.strictEqual(existe.status, naoExiste.status,
      `status diferentes (${existe.status} vs ${naoExiste.status}) dizem quem tem conta`);
    assert.deepStrictEqual(existe.corpo, naoExiste.corpo, 'as mensagens precisam ser idênticas');
  });

  await teste('C6: a tela de login não exibe mais o código', async () => {
    const tela = fs.readFileSync(path.join(RAIZ, 'src', 'screens', 'LoginScreen.tsx'), 'utf8');
    assert.ok(!/Código gerado/i.test(tela), 'a tela ainda mostra o código na interface');
    assert.ok(!/res\?\.code/.test(tela), 'a tela ainda lê o código da resposta');
  });

  await teste('C7: o código usa entropia de crypto, e não Math.random', async () => {
    // Um código de redefinição é credencial. Math.random não é
    // imprevisível o bastante para isso.
    const rota = fs.readFileSync(path.join(RAIZ, 'server', 'routes', 'auth.js'), 'utf8');
    // Sem tirar os comentários, esta asserção se acusa sozinha: o
    // comentário da própria correção cita "Math.random" para dizer
    // por que ele não serve aqui.
    const semComentarios = rota
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    const trecho = semComentarios.slice(
      semComentarios.indexOf("router.post('/forgot-password'"),
      semComentarios.indexOf("router.post('/reset-password'"),
    );
    assert.ok(!/Math\.random/.test(trecho), 'o código de recuperação ainda vem de Math.random');
    assert.ok(/randomInt/.test(trecho), 'esperado randomInt de node:crypto');
  });

  servidor.close();
  db.close();
  limpar();

  console.log('\n============================================================');
  console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
  console.log('============================================================');
  if (falharam > 0) process.exit(1);
})();
