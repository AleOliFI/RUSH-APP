// ============================================================
// RUSH RUNNING — Encerrar uma corrida sem quilometragem
// ------------------------------------------------------------
// O relato foi direto: "se o usuário começa a corrida e não anda
// nenhum quilômetro, eu não consigo encerrar".
//
// Era verdade, e o beco sem saída estava em ActiveRunModal: com
// `distanceKm <= 0` a tela escrevia um erro e dava `return`. Não
// salvava, não fechava, não deixava voltar. Esteira, corrida em
// ambiente fechado ou GPS sem fixação caíam todos aí — e o app
// ficava preso em tela cheia, sem botão de saída.
//
// O backend nunca foi o problema: `activities.js` aceita
// `distance_km` de 0 a 500. Quem recusava era o app.
//
// Este teste corre um navegador de verdade com a geolocalização
// TRAVADA num ponto só. Sem movimento não há distância, que é
// exatamente o cenário relatado, sem precisar simular nada.
// ============================================================

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..', '..');
// 3001 porque é para lá que o proxy /api do vite.config aponta.
const PORTA_API = 3001;
const PORTA_WEB = 5197;

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (_) {
  try {
    ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
  } catch (_) {
    console.log('\n============================================================');
    console.log('📌 ENCERRAR CORRIDA SEM DISTÂNCIA');
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

function esperarPorta(url, tentativas = 40) {
  return new Promise((resolve) => {
    let n = 0;
    const tentar = () => {
      n += 1;
      const req = http.get(url, (res) => { res.resume(); resolve(true); });
      req.on('error', () => {
        if (n >= tentativas) return resolve(false);
        setTimeout(tentar, 500);
      });
      req.setTimeout(2000, () => {
        req.destroy();
        if (n >= tentativas) resolve(false);
        else setTimeout(tentar, 500);
      });
    };
    tentar();
  });
}

const processos = [];

function encerrarTudo() {
  for (const p of processos) {
    for (const sinal of ['SIGTERM', 'SIGKILL']) {
      try { process.kill(-p.pid, sinal); } catch (_) {
        try { p.kill(sinal); } catch (_) {}
      }
    }
  }
}

(async () => {
  console.log('\n============================================================');
  console.log('📌 ENCERRAR CORRIDA SEM DISTÂNCIA');
  console.log('============================================================');

  const dbTeste = path.join(RAIZ, 'data', `sem-distancia-test-${process.pid}.db`);
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

  // DATABASE_URL vai VAZIA de propósito: o seed apaga ~20 tabelas antes
  // de inserir, e herdar a URL de produção do .env destruiria dados reais.
  const ambienteApi = {
    ...process.env,
    PORT: String(PORTA_API),
    JWT_SECRET: 'teste-sem-distancia',
    QUIET: 'true',
    RUSH_DB_PATH: dbTeste,
    DATABASE_URL: '',
  };
  delete ambienteApi.POSTGRES_URL;
  delete ambienteApi.VERCEL;

  processos.push(spawn('node', [path.join(RAIZ, 'server', 'index.js')], {
    cwd: RAIZ, env: ambienteApi, stdio: 'ignore', detached: true,
  }));

  // O vite NAO pode herdar VITE_API_URL do .env. Se herdar, o app sob
  // teste passa a falar com o endereco configurado la — e se um dia
  // esse endereco for o de PRODUCAO, estes testes escrevem no banco
  // real. Vazia, a variavel devolve o app ao proxy /api do vite, que
  // aponta para o servidor descartavel deste teste. Mesmo cuidado que
  // DATABASE_URL recebe do lado da API.
  const ambienteWeb = { ...process.env, VITE_API_URL: '' };

  processos.push(spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PORTA_WEB), '--strictPort'], {
    cwd: RAIZ, env: ambienteWeb, stdio: 'ignore', detached: true,
  }));

  const apiOk = await esperarPorta(`http://127.0.0.1:${PORTA_API}/api/health`);
  const webOk = await esperarPorta(`http://127.0.0.1:${PORTA_WEB}/`);

  if (!apiOk || !webOk) {
    console.log(`  ❌ [FAIL] servidores não subiram (api=${apiOk} web=${webOk})`);
    encerrarTudo();
    process.exit(1);
  }

  const candidatos = [
    process.env.CHROMIUM_PATH,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  ].filter(Boolean);
  const executavel = candidatos.find((c) => { try { return fs.existsSync(c); } catch (_) { return false; } });

  const browser = await chromium.launch({
    ...(executavel ? { executablePath: executavel } : {}),
    args: ['--no-sandbox'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 900 },
    permissions: ['geolocation'],
    // O ponto NÃO muda durante o teste inteiro. É isso que reproduz o
    // relato: o cronômetro anda, a distância não sai do zero.
    geolocation: { latitude: -23.5613, longitude: -46.6565, accuracy: 8 },
    locale: 'pt-BR',
  });
  const page = await ctx.newPage();
  const errosDeJs = [];
  page.on('pageerror', (e) => errosDeJs.push(e.message));

  const BASE = `http://127.0.0.1:${PORTA_WEB}`;

  /** Abre o app, faz login se a tela pedir, e dispara uma corrida até o estágio ao vivo. */
  async function correrAteOAoVivo() {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    if ((await page.locator('input[type="email"]').count()) > 0) {
      await page.locator('input[type="email"]').first().fill('maria@email.com');
      await page.locator('input[type="password"]').first().fill('123456');
      await page.getByRole('button', { name: /entrar na plataforma/i }).click();
      await page.waitForTimeout(3500);
    }

    await abrirHudEDisparar();
  }

  /**
   * Abre o HUD e larga. O modal é carregado sob demanda (React.lazy) e,
   * num vite frio, esse primeiro import pode levar bem mais que os 30 s
   * padrão do Playwright — por isso a espera é explícita e longa.
   */
  async function abrirHudEDisparar() {
    await page.locator('#active-run-trigger').click();
    const disparar = page.getByRole('button', { name: /disparar cron/i });
    await disparar.waitFor({ state: 'visible', timeout: 120000 });
    await disparar.click();
    // 3 s de contagem regressiva + alguns segundos de corrida parada.
    await page.waitForTimeout(8000);
  }

  try {
    await correrAteOAoVivo();

    const distancia = await page.locator('text=/^0\\.00$/').count();
    registrar(distancia > 0, 'C1: sem movimento a distância fica em 0,00 km (o cenário relatado)',
      'o HUD nao mostrou 0.00 — o cenario do relato nao foi reproduzido');

    await page.getByRole('button', { name: /encerrar/i }).click();
    await page.waitForTimeout(1500);

    const perguntou = await page.locator('text=/nenhuma dist[âa]ncia registrada/i').count();
    registrar(perguntou > 0, 'C2: encerrar com 0 km abre a escolha em vez de travar',
      'a tela nao perguntou nada — era aqui que o app ficava preso');

    const temDescartar = await page.getByRole('button', { name: /^descartar$/i }).count();
    const temSalvar = await page.getByRole('button', { name: /salvar mesmo assim/i }).count();
    registrar(temDescartar > 0 && temSalvar > 0,
      'C3: as duas saídas existem — descartar e salvar mesmo assim',
      `descartar=${temDescartar} salvar=${temSalvar}`);

    // ---------- A saída por descarte ----------
    await page.getByRole('button', { name: /^descartar$/i }).click();
    await page.waitForTimeout(2000);

    const voltouParaOApp = await page.locator('#active-run-trigger').count();
    registrar(voltouParaOApp > 0, 'C4: descartar fecha a corrida e devolve o atleta ao app',
      'o modal de corrida nao fechou — o beco sem saida continua de pe');

    // ---------- A saída por gravação ----------
    // Vale provar as duas: "salvar mesmo assim" manda distance_km = 0
    // para a API, e se o backend recusasse o atleta voltaria a ficar preso.
    await abrirHudEDisparar();
    await page.getByRole('button', { name: /encerrar/i }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /salvar mesmo assim/i }).click();
    await page.waitForTimeout(4000);

    const salvouEFechou = await page.locator('#active-run-trigger').count();
    registrar(salvouEFechou > 0, 'C5: salvar mesmo assim grava 0 km e também fecha',
      'gravar com 0 km falhou — a API recusou ou a tela nao fechou');

    registrar(errosDeJs.length === 0, 'C6: nenhum erro de JavaScript no caminho inteiro',
      errosDeJs.join(' | '));
  } catch (err) {
    registrar(false, 'o fluxo de encerramento falhou', err.message);
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
