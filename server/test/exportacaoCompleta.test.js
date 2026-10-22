// ============================================================
// RUSH RUNNING — A exportação leva TUDO, não a primeira página
// ------------------------------------------------------------
// O app exportava `recentActivitiesRaw`, que é o resultado de
// `activities.list(1)` — ou seja, 20 atividades, o limite padrão da
// rota. Quem tinha 300 corridas baixava 20 e não tinha como saber.
//
// Na tela de exclusão de conta isso era pior do que um dado
// faltando. O botão "Baixar minhas atividades" é a ÚLTIMA chance da
// pessoa de levar os próprios dados — logo abaixo ela apaga a conta,
// e a exclusão não tem volta. Ela baixava 20 de 300, apagava, e só
// descobriria depois.
//
// Este teste não confere o texto do código: ele cria 105 atividades,
// aperta o botão num navegador de verdade e CONTA AS LINHAS do
// arquivo que saiu. 105 força a paginação (o limite por requisição é
// 100), então também prova que o laço de páginas funciona.
// ============================================================

const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..', '..');
const PORTA_API = 3001;
const PORTA_WEB = 5188;
const QUANTAS = 105;

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (_) {
  try {
    ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
  } catch (_) {
    console.log('\n============================================================');
    console.log('📌 EXPORTAÇÃO COMPLETA');
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

function esperarPorta(url, tentativas = 80) {
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
  console.log('📌 EXPORTAÇÃO COMPLETA');
  console.log('============================================================\n');

  const dbTeste = path.join(RAIZ, 'data', `exportacao-test-${process.pid}.db`);
  for (const s of ['', '-shm', '-wal']) { try { fs.unlinkSync(dbTeste + s); } catch (_) {} }

  const jaOcupada = await new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORTA_API}/api/health`, (res) => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
  if (jaOcupada) {
    console.log(`  ⏭️  PULADO: já há algo escutando em ${PORTA_API}.`);
    process.exit(0);
  }

  // DATABASE_URL vazia: o seed apaga ~20 tabelas antes de inserir.
  const ambienteApi = {
    ...process.env,
    PORT: String(PORTA_API),
    JWT_SECRET: 'teste-exportacao',
    QUIET: 'true',
    RUSH_DB_PATH: dbTeste,
    DATABASE_URL: '',
  };
  delete ambienteApi.POSTGRES_URL;
  delete ambienteApi.VERCEL;

  processos.push(spawn('node', [path.join(RAIZ, 'server', 'index.js')], {
    cwd: RAIZ, env: ambienteApi, stdio: 'ignore', detached: true,
  }));

  // O vite NÃO pode herdar VITE_API_URL: se herdar, o app sob teste
  // fala com o endereço configurado lá, e não com este servidor.
  const ambienteWeb = { ...process.env, VITE_API_URL: '' };
  processos.push(spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PORTA_WEB), '--strictPort'], {
    cwd: RAIZ, env: ambienteWeb, stdio: 'ignore', detached: true,
  }));

  const apiOk = await esperarPorta(`http://127.0.0.1:${PORTA_API}/api/health`);
  const webOk = await esperarPorta(`http://127.0.0.1:${PORTA_WEB}/`);
  if (!apiOk || !webOk) {
    registrar(false, 'os servidores subiram', `api=${apiOk} web=${webOk}`);
    encerrarTudo();
    process.exit(1);
  }

  const BASE_API = `http://127.0.0.1:${PORTA_API}/api`;

  // ---------- Semeia 105 atividades pela própria rota do app ----------
  const login = await fetch(`${BASE_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'maria@email.com', password: '123456' }),
  }).then((r) => r.json());

  const token = login?.token;
  if (!token) {
    registrar(false, 'login da conta de demonstração', JSON.stringify(login).slice(0, 160));
    encerrarTudo();
    process.exit(1);
  }

  for (let i = 0; i < QUANTAS; i += 1) {
    const dia = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
    await fetch(`${BASE_API}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        type: 'run',
        title: `Corrida ${i + 1}`,
        date: dia,
        distance_km: 5 + (i % 7),
        duration_seconds: 1800 + i,
      }),
    });
  }

  const conferencia = await fetch(`${BASE_API}/activities?page=1&limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const totalNoBanco = Number(conferencia?.pagination?.total) || 0;

  registrar(totalNoBanco > 100,
    `C1: a conta de teste tem ${totalNoBanco} atividades (mais de uma página)`,
    'sem passar de 100 o teste não exercitaria a paginação');

  // ---------- Exporta pelo navegador ----------
  const candidatos = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].filter(Boolean);
  const executavel = candidatos.find((c) => { try { return fs.existsSync(c); } catch (_) { return false; } });

  const browser = await chromium.launch({
    ...(executavel ? { executablePath: executavel } : {}),
    args: ['--no-sandbox'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 900 },
    locale: 'pt-BR',
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const BASE = `http://127.0.0.1:${PORTA_WEB}`;

  // Quais páginas da rota foram pedidas durante a exportação.
  const paginasPedidas = [];
  page.on('request', (r) => {
    const m = /\/activities\?page=(\d+)&limit=(\d+)/.exec(r.url());
    if (m) paginasPedidas.push({ pagina: Number(m[1]), limite: Number(m[2]) });
  });

  try {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    if ((await page.locator('input[type="email"]').count()) > 0) {
      await page.locator('input[type="email"]').first().fill('maria@email.com');
      await page.locator('input[type="password"]').first().fill('123456');
      await page.getByRole('button', { name: /entrar na plataforma/i }).click();
      await page.waitForTimeout(4000);
    }

    // Perfil → "Conta" (subtítulo "Excluir conta e dados"): é onde o dano
    // era maior, porque logo abaixo do download vem a exclusão.
    await page.getByRole('button', { name: /perfil/i }).last().click();
    await page.waitForTimeout(2500);

    // O botão "Conta" do perfil abre Ajustes; a exclusão fica um
    // nível abaixo, no fim daquela tela.
    const conta = page.getByRole('button', { name: /excluir conta e dados/i }).first();
    await conta.scrollIntoViewIfNeeded();
    await conta.click();
    await page.waitForTimeout(2500);

    const excluir = page.getByRole('button', { name: /excluir conta/i }).last();
    await excluir.scrollIntoViewIfNeeded();
    await excluir.click();
    await page.waitForTimeout(3000);

    // O número que a tela mostra precisa ser o REAL, não o da primeira
    // página. Dizer "você tem 20" para quem tem 106 subnotifica
    // exatamente quem tem mais a perder.
    const textoDaTela = await page.locator('body').innerText();
    const diz106 = new RegExp(`${totalNoBanco}\\s+atividades registradas`, 'i').test(textoDaTela);
    registrar(diz106,
      `C2: a tela de exclusão anuncia as ${totalNoBanco} atividades reais`,
      `não encontrei o total real no texto da tela`);

    paginasPedidas.length = 0;

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.getByRole('button', { name: /baixar minhas atividades/i }).click(),
    ]);

    const destino = path.join(RAIZ, 'data', `export-${process.pid}.csv`);
    await download.saveAs(destino);
    const csv = fs.readFileSync(destino, 'utf8');
    fs.unlinkSync(destino);

    // Cabeçalho + uma linha por atividade, menos a linha vazia final.
    const linhas = csv.trim().split('\n');
    const dados = linhas.length - 1;

    registrar(dados === totalNoBanco,
      `C3: o CSV traz as ${totalNoBanco} atividades, e não as 20 da primeira página`,
      `o arquivo veio com ${dados} linhas de dados`);

    const paginas = paginasPedidas.map((p) => p.pagina).sort((a, b) => a - b);
    registrar(paginas.includes(1) && paginas.includes(2),
      'C4: a exportação pediu mais de uma página ao servidor',
      `páginas pedidas: ${paginas.join(', ') || 'nenhuma'}`);

    registrar(paginasPedidas.every((p) => p.limite === 100),
      'C5: pede no limite máximo, para fazer menos idas ao servidor',
      `limites usados: ${[...new Set(paginasPedidas.map((p) => p.limite))].join(', ')}`);
  } catch (err) {
    registrar(false, 'o fluxo de exportação falhou', err.message);
  }

  await browser.close();
  encerrarTudo();
  for (const s of ['', '-shm', '-wal']) { try { fs.unlinkSync(dbTeste + s); } catch (_) {} }

  console.log('\n============================================================');
  console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
  console.log('============================================================');
  process.exit(falharam > 0 ? 1 : 0);
})().catch((err) => {
  console.error('❌ Erro fatal:', err);
  encerrarTudo();
  process.exit(1);
});
