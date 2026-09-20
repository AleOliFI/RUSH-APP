// ============================================================
// RUSH RUNNING — O health conta contas ativas, não linhas
// ------------------------------------------------------------
// A exclusão de conta no RUSH é lógica: users.js faz
// `UPDATE users SET deleted_at = ...`, nunca DELETE. A linha fica
// no banco para sempre — o que é o comportamento certo, porque
// atividades, comentários e seguidores apontam para ela.
//
// O /api/health fazia `SELECT COUNT(*) FROM users` sem filtro.
// Consequência: um banco com uma conta excluída e nenhuma ativa
// reportava `users: 1`. E esse é justamente o número que se olha
// para responder "já tem gente usando?" — a pergunta que decide se
// um app recém-publicado está de pé ou vazio.
//
// Este teste sobe o servidor de verdade e cobra o ciclo inteiro:
// cadastrar sobe a conta, excluir desce, e a linha continua lá.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO = path.join(RAIZ, 'data', `health-test-${process.pid}.db`);
const PORTA = 3412;
const BASE = `http://127.0.0.1:${PORTA}/api`;

let passaram = 0;
let falharam = 0;
let servidor = null;

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

function encerrar() {
  if (servidor) { try { process.kill(-servidor.pid, 'SIGKILL'); } catch (_) {} }
}

/** Espera a porta responder, em vez de dormir um tempo fixo e torcer. */
function esperarPorta(limiteMs = 30000) {
  const fim = Date.now() + limiteMs;
  return new Promise((resolve) => {
    const tentar = () => {
      const req = http.get(`${BASE}/health`, (res) => { res.resume(); resolve(true); });
      req.on('error', () => {
        if (Date.now() > fim) return resolve(false);
        setTimeout(tentar, 400);
      });
      req.setTimeout(2000, () => { req.destroy(); });
    };
    tentar();
  });
}

const contarUsuarios = async () => (await (await fetch(`${BASE}/health`)).json()).database.users;

(async () => {
  console.log('\n============================================================');
  console.log('📌 HEALTH CONTA CONTAS ATIVAS');
  console.log('============================================================\n');

  limpar();

  // DATABASE_URL vai VAZIA de proposito: o servidor carrega o .env
  // sozinho, e herda-la aqui apontaria este teste para o Postgres de
  // producao — onde ele cadastraria e excluiria contas de verdade.
  const ambiente = {
    ...process.env,
    PORT: String(PORTA),
    JWT_SECRET: 'teste-health',
    QUIET: 'true',
    RUSH_DB_PATH: CAMINHO,
    DATABASE_URL: '',
  };
  delete ambiente.POSTGRES_URL;
  delete ambiente.VERCEL;

  servidor = spawn('node', [path.join(RAIZ, 'server', 'index.js')], {
    cwd: RAIZ, env: ambiente, stdio: 'ignore', detached: true,
  });

  if (!(await esperarPorta())) {
    console.log('  ❌ [FAIL] o servidor não subiu');
    encerrar(); limpar();
    process.exit(1);
  }

  const base = await contarUsuarios();
  const marca = Date.now();
  const email = `health-${marca}@rush.invalid`;
  let token = null;

  await teste('T1: cadastrar sobe a contagem', async () => {
    const r = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email, password: 'senha123', name: 'Teste Health', username: `health${marca}`.slice(0, 28),
      }),
    });
    const corpo = await r.json();
    assert.strictEqual(r.status, 201, `esperado 201, veio ${r.status}: ${JSON.stringify(corpo)}`);
    token = corpo.access_token || corpo.token;
    assert.ok(token, 'o registro precisa devolver token');

    assert.strictEqual(await contarUsuarios(), base + 1, 'a conta nova tem de aparecer na contagem');
  });

  await teste('T2: excluir a conta faz a contagem DESCER', async () => {
    // Este e o ponto do teste. Antes do filtro de deleted_at, a
    // contagem ficava em base+1 para sempre.
    const r = await fetch(`${BASE}/users/me`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password: 'senha123' }),
    });
    assert.strictEqual(r.status, 200, `esperado 200 ao excluir, veio ${r.status}`);

    assert.strictEqual(await contarUsuarios(), base,
      'conta excluída não pode continuar sendo contada — era exatamente o defeito');
  });

  await teste('T3: a linha continua no banco, só não é contada', async () => {
    // A exclusão é lógica de propósito: atividades e comentários
    // apontam para essa linha. Se ela tivesse sumido, o problema
    // seria outro e pior.
    const { Database } = require('../database/sqlite');
    const db = new Database(CAMINHO);
    const linha = await db.prepare('SELECT deleted_at FROM users WHERE email = ?').get(email);
    db.close();
    assert.ok(linha, 'a linha não pode ter sido apagada fisicamente');
    assert.ok(linha.deleted_at, 'a linha precisa estar marcada como excluída');
  });

  encerrar();
  limpar();

  console.log('\n============================================================');
  console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
  console.log('============================================================');
  process.exit(falharam > 0 ? 1 : 0);
})().catch((err) => {
  console.error('❌ Erro fatal:', err);
  encerrar(); limpar();
  process.exit(1);
});
