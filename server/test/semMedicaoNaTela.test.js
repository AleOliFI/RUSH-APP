// ============================================================
// RUSH RUNNING — Sem medição, a tela mostra ausência (não zero)
// ------------------------------------------------------------
// A tela inicial de quem ainda não mediu a VFC do dia dizia, ao
// mesmo tempo, "AGUARDANDO MEDIÇÃO" e:
//
//   PRONTIDÃO   0 %  —  e um "0" VERMELHO no resumo do topo
//   anel        0/100
//   cabeçalho   0% HRV
//   RHR         0 BPM   ↘ 0 bpm vs média   (seta verde de melhora)
//   HRV         0 MS    ✓ NORMAL           (selo verde)
//
// Nada disso foi medido. Zero por cento de prontidão é a pior nota
// possível, não a ausência de nota — e o vermelho do resumo dava a
// um atleta descansado a mesma cara de um exausto. O selo "NORMAL"
// era pior ainda: afirmava que a variabilidade cardíaca estava bem
// sem que existisse uma leitura.
//
// O app já sabia a diferença: `EMPTY_READINESS` existia e o gancho
// já a escolhia quando não havia medição. O que faltava era ela
// dizer isso às telas, em vez de entregar zeros que passavam por
// dado.
//
// Este teste abre o app num navegador de verdade, com uma conta sem
// medição hoje, e exige ausência na tela. Depois registra uma
// medição e exige que os números voltem — senão passaria se alguém
// simplesmente apagasse os indicadores.
// ============================================================

const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..', '..');
// 3001 não é escolha: o proxy do vite.config.ts aponta /api para
// localhost:3001 fixo. Em outra porta, nada chega ao servidor.
const PORTA_API = 3001;
const PORTA_WEB = 5193;

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (_) {
  try {
    ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
  } catch (_) {
    console.log('\n============================================================');
    console.log('📌 SEM MEDIÇÃO NA TELA');
    console.log('============================================================');
    console.log('  ⏭️  PULADO: Playwright não está disponível neste ambiente.');
    console.log('============================================================');
    process.exit(0);
  }
}

let passaram = 0;
let falharam = 0;

function registrar(ok, nome, detalhe) {
  if (ok) {
    console.log(`  ✅ [PASS] ${nome}`);
    passaram += 1;
  } else {
    console.log(`  ❌ [FAIL] ${nome}`);
    if (detalhe) console.log(`     ${detalhe}`);
    falharam += 1;
  }
}

function esperarPorta(url, tentativas = 90) {
  return new Promise((resolve) => {
    let n = 0;
    const tentar = () => {
      n += 1;
      const req = http.get(url, (res) => { res.resume(); resolve(true); });
      req.on('error', () => { if (n >= tentativas) return resolve(false); setTimeout(tentar, 500); });
      req.setTimeout(2000, () => {
        req.destroy();
        if (n >= tentativas) resolve(false); else setTimeout(tentar, 500);
      });
    };
    tentar();
  });
}

const processos = [];
function encerrarTudo() {
  for (const p of processos) {
    for (const sinal of ['SIGTERM', 'SIGKILL']) {
      try { process.kill(-p.pid, sinal); } catch (_) { try { p.kill(sinal); } catch (_) {} }
    }
  }
}

(async () => {
  console.log('\n============================================================');
  console.log('📌 SEM MEDIÇÃO NA TELA');
  console.log('============================================================\n');

  const dbTeste = path.join(RAIZ, 'data', `sem-medicao-test-${process.pid}.db`);
  const limpar = () => {
    for (const s of ['', '-shm', '-wal']) { try { fs.unlinkSync(dbTeste + s); } catch (_) {} }
  };
  limpar();

  const jaOcupada = await new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORTA_API}/api/health`, (res) => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
  if (jaOcupada) {
    console.log(`  ⏭️  PULADO: já há algo escutando em ${PORTA_API}.`);
    process.exit(0);
  }

  const { Database } = require('../database/sqlite');
  const db = new Database(dbTeste);
  await require('../database/schema.js')(db);
  await require('../database/seedData.js')(db);

  const conta = await db.prepare('SELECT id, email FROM users WHERE email = ?').get('maria@email.com');
  assert.ok(conta, 'o seed precisa da conta maria@email.com');

  const hoje = new Date().toISOString().split('T')[0];
  // Garante a precondição em vez de torcer por ela: sem isto, o
  // teste passaria ou falharia conforme o seed mudasse de datas.
  db.prepare('DELETE FROM hrv_measurements WHERE user_id = ? AND date(created_at) = ?').run(conta.id, hoje);
  db.prepare('DELETE FROM daily_status WHERE user_id = ? AND date = ?').run(conta.id, hoje);
  db.close();

  const ambienteApi = {
    ...process.env,
    PORT: String(PORTA_API),
    JWT_SECRET: 'teste-sem-medicao',
    QUIET: 'true',
    RUSH_DB_PATH: dbTeste,
    DATABASE_URL: '',
  };
  delete ambienteApi.POSTGRES_URL;
  delete ambienteApi.VERCEL;

  processos.push(spawn('node', [path.join(RAIZ, 'server', 'index.js')], {
    cwd: RAIZ, env: ambienteApi, stdio: 'ignore', detached: true,
  }));
  processos.push(spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PORTA_WEB), '--strictPort'], {
    cwd: RAIZ, env: { ...process.env, VITE_API_URL: '' }, stdio: 'ignore', detached: true,
  }));

  const apiOk = await esperarPorta(`http://127.0.0.1:${PORTA_API}/api/health`);
  const webOk = await esperarPorta(`http://127.0.0.1:${PORTA_WEB}/`);
  if (!apiOk || !webOk) {
    registrar(false, 'os servidores subiram', `api=${apiOk} web=${webOk}`);
    encerrarTudo(); limpar();
    process.exit(1);
  }

  const candidatos = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].filter(Boolean);
  const executavel = candidatos.find((c) => { try { return fs.existsSync(c); } catch (_) { return false; } });

  const browser = await chromium.launch({
    ...(executavel ? { executablePath: executavel } : {}),
    args: ['--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 414, height: 896 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  const BASE = `http://127.0.0.1:${PORTA_WEB}`;

  const entrar = async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    if ((await page.locator('input[type="email"]').count()) > 0) {
      await page.locator('input[type="email"]').first().fill(conta.email);
      await page.locator('input[type="password"]').first().fill('123456');
      await page.getByRole('button', { name: /entrar na plataforma/i }).click();
      await page.waitForTimeout(5000);
    }
  };

  try {
    await entrar();
    const tela = await page.locator('body').innerText();

    const entrou = !/entrar na plataforma/i.test(tela);
    registrar(entrou, 'C0: a conta entrou no app');
    if (!entrou) throw new Error('não foi possível entrar');

    registrar(/AGUARDANDO MEDIÇÃO|SEM MEDIÇÃO HOJE/i.test(tela),
      'C1: a tela declara que não há medição do dia',
      'precondição do teste: sem isso, as checagens abaixo não medem nada');

    const linhaCom = (expressao) => (tela.match(expressao) || [])[0];

    registrar(!/\b0\s*MS\b/i.test(tela),
      'C2: não mostra "0 ms" de variabilidade sem ter medido',
      linhaCom(/[^\n]*0\s*MS[^\n]*/i));

    registrar(!/\bNORMAL\b/.test(tela),
      'C3: não afirma que a variabilidade está NORMAL sem leitura',
      linhaCom(/[^\n]*NORMAL[^\n]*/));

    registrar(!/\b0\s*BPM\b/i.test(tela),
      'C4: não mostra "0 bpm" de repouso sem ter medido',
      linhaCom(/[^\n]*0\s*BPM[^\n]*/i));

    registrar(!/\b0\s*\/\s*100\b/.test(tela),
      'C5: o anel de prontidão não marca 0/100',
      linhaCom(/[^\n]*0\s*\/\s*100[^\n]*/));

    registrar(!/\b0\s*%/.test(tela),
      'C6: a prontidão não aparece como 0% — é a pior nota, não "sem nota"',
      linhaCom(/[^\n]*\b0\s*%[^\n]*/));

    // ---------- E com medição, os números voltam ----------
    // Sem esta parte, apagar os indicadores do app faria C2–C6
    // passarem.
    const db2 = new (require('../database/sqlite').Database)(dbTeste);
    const idMedicao = `hrv-teste-${process.pid}`;
    // Colunas conforme server/database/schema.js: `lnrmssd` é
    // obrigatória e `timestamp` também.
    await db2.prepare(`
      INSERT INTO hrv_measurements (id, user_id, timestamp, rmssd_ms, lnrmssd, hr_rest_bpm, rhr_bpm, duration_seconds)
      VALUES (?, ?, datetime('now'), 62.5, ?, 48, 48, 60)
    `).run(idMedicao, conta.id, Math.log(62.5));
    db2.close();

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    const comMedicao = await page.locator('body').innerText();

    registrar(/\b62\b|\b63\b/.test(comMedicao) && /\bMS\b/i.test(comMedicao),
      'C7: medido, o RMSSD aparece na tela',
      'os indicadores precisam existir de verdade — senão C2–C6 passariam por omissão');

    registrar(/\b48\b/.test(comMedicao),
      'C8: medido, a frequência de repouso aparece na tela');
  } catch (err) {
    registrar(false, 'o percurso pelo app falhou', err.message);
  }

  await browser.close();
  encerrarTudo();
  limpar();

  console.log('\n============================================================');
  console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
  console.log('============================================================');
  process.exit(falharam > 0 ? 1 : 0);
})().catch((err) => {
  console.error('❌ Erro fatal:', err);
  encerrarTudo();
  process.exit(1);
});
