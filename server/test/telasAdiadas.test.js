// ============================================================
// RUSH RUNNING — As telas adiadas realmente montam
// ------------------------------------------------------------
// Sete telas e modais passaram a ser carregadas sob demanda com
// React.lazy, tirando ~90 kB da primeira carga.
//
// Esse ganho vem com um risco que NENHUM teste de servidor pega, e
// que o build tambem nao pega: `lazy` quebra em RUNTIME. Um caminho
// de import errado, um export que nao e o esperado, um Suspense
// faltando — tudo isso compila, empacota, passa em tsc, e so falha
// quando alguem abre a tela. O sintoma e a tela ficar presa no
// fallback: um retangulo escuro, para sempre, sem erro visivel.
//
// Este teste abre o app num Chromium de verdade e exige que cada
// tela adiada apareca com conteudo.
// ============================================================

const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const RAIZ = path.join(__dirname, '..', '..');
// A porta e 3001 porque vite.config.ts aponta o proxy de /api para la,
// e esse arquivo e de configuracao de build: o teste se adapta a ele, e
// nao o contrario. Se a porta ja estiver ocupada o teste PULA — seguir
// em frente testaria o servidor de outra pessoa achando que e o nosso.
const PORTA_API = 3001;
const PORTA_WEB = 5198;

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (_) {
  try {
    ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
  } catch (_) {
    console.log('\n============================================================');
    console.log('📌 TELAS CARREGADAS SOB DEMANDA');
    console.log('============================================================');
    console.log('  ⏭️  PULADO: Playwright não está disponível neste ambiente.');
    console.log('     Este teste abre a tela num navegador; sem ele, os demais');
    console.log('     testes continuam cobrindo API e banco.');
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

/** Espera uma URL responder, ou desiste depois de `tentativas`. */
function esperarPorta(url, tentativas = 40) {
  return new Promise((resolve) => {
    let n = 0;
    const tentar = () => {
      n += 1;
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        if (n >= tentativas) return resolve(false);
        setTimeout(tentar, 500);
      });
      // destroy() sozinho nao emite 'error' em toda versao do Node: sem
      // este resolve/retry explicito, uma conexao aceita mas lenta (vite
      // subindo a frio) penduraria a espera para sempre.
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

/**
 * Encerra o GRUPO de processos, e nao so o filho direto.
 *
 * `npx vite` e um processo pai que lanca o vite de verdade. Matar so o
 * pai deixa o vite orfao segurando a porta, e a proxima execucao falha
 * com --strictPort dizendo "os servidores nao subiram" — um erro que
 * nao tem nada a ver com o codigo em teste.
 *
 * `detached: true` no spawn poe cada filho no proprio grupo, e o PID
 * negativo manda o sinal para o grupo inteiro. SIGTERM primeiro, para
 * o vite conseguir liberar a porta.
 */
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
  console.log('📌 TELAS CARREGADAS SOB DEMANDA');
  console.log('============================================================');

  // Banco proprio, para nao mexer no de desenvolvimento.
  const fs = require('fs');
  const dbTeste = path.join(RAIZ, 'data', `adiadas-test-${process.pid}.db`);
  for (const s of ['', '-shm', '-wal']) { try { fs.unlinkSync(dbTeste + s); } catch (_) {} }

  // A porta 3001 esta livre?
  const jaOcupada = await new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORTA_API}/api/health`, (res) => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });

  if (jaOcupada) {
    console.log(`  ⏭️  PULADO: já há algo escutando em ${PORTA_API}.`);
    console.log('     O teste precisa dessa porta (é para onde o vite.config manda /api)');
    console.log('     e não vai testar um servidor que não subiu aqui.');
    encerrarTudo();
    process.exit(0);
  }

  // O servidor precisa receber o banco descartavel EXPLICITAMENTE.
  // Ele carrega o .env sozinho, e se houver DATABASE_URL la o app sobe
  // em Postgres — que e onde roda a producao. O seed comeca apagando
  // ~20 tabelas, entao rodar este teste com DATABASE_URL herdada
  // destruiria dados reais. DATABASE_URL vai vazia de proposito.
  const ambienteApi = {
    ...process.env,
    PORT: String(PORTA_API),
    JWT_SECRET: 'teste-adiadas',
    QUIET: 'true',
    RUSH_DB_PATH: dbTeste,
    DATABASE_URL: '',
  };
  delete ambienteApi.POSTGRES_URL;
  delete ambienteApi.VERCEL;

  const api = spawn('node', [path.join(RAIZ, 'server', 'index.js')], {
    cwd: RAIZ,
    env: ambienteApi,
    stdio: 'ignore',
    detached: true,
  });
  processos.push(api);

  // O vite NAO pode herdar VITE_API_URL do .env. Se herdar, o app sob
  // teste passa a falar com o endereco configurado la — e se um dia
  // esse endereco for o de PRODUCAO, estes testes escrevem no banco
  // real. Vazia, a variavel devolve o app ao proxy /api do vite, que
  // aponta para o servidor descartavel deste teste. Mesmo cuidado que
  // DATABASE_URL recebe do lado da API.
  const ambienteWeb = { ...process.env, VITE_API_URL: '' };

  const web = spawn(
    'npx',
    ['vite', '--host', '127.0.0.1', '--port', String(PORTA_WEB), '--strictPort'],
    {
      cwd: RAIZ,
      env: ambienteWeb,
      stdio: 'ignore',
      detached: true,
    },
  );
  processos.push(web);

  const apiOk = await esperarPorta(`http://127.0.0.1:${PORTA_API}/api/health`);
  const webOk = await esperarPorta(`http://127.0.0.1:${PORTA_WEB}/`);

  if (!apiOk || !webOk) {
    console.log(`  ❌ [FAIL] servidores não subiram (api=${apiOk} web=${webOk})`);
    encerrarTudo();
    process.exit(1);
  }

  // Sem executablePath, o Playwright usa o navegador que ele mesmo
  // instalou — o caso normal. O caminho fixo so entra quando existe de
  // fato (este ambiente traz o Chromium fora do lugar padrao): cravá-lo
  // sempre quebraria uma instalacao comum com ENOENT.
  const fsMod = require('fs');
  const candidatos = [
    process.env.CHROMIUM_PATH,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  ].filter(Boolean);
  const executavel = candidatos.find((c) => { try { return fsMod.existsSync(c); } catch (_) { return false; } });

  const browser = await chromium.launch({
    ...(executavel ? { executablePath: executavel } : {}),
    args: ['--no-sandbox'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 900 },
    permissions: ['geolocation'],
    geolocation: { latitude: -23.5613, longitude: -46.6565 },
    locale: 'pt-BR',
  });
  const page = await ctx.newPage();

  const errosDeJs = [];
  page.on('pageerror', (e) => errosDeJs.push(e.message));

  const BASE = `http://127.0.0.1:${PORTA_WEB}`;

  /** Entra no app. A sessao pode sobreviver entre visitas; o login so aparece quando precisa. */
  async function entrar(email) {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    if ((await page.locator('input[type="email"]').count()) > 0) {
      await page.locator('input[type="email"]').first().fill(email);
      await page.locator('input[type="password"]').first().fill('123456');
      await page.getByRole('button', { name: /entrar na plataforma/i }).click();
      await page.waitForTimeout(3500);
    }
  }

  try {
    // ---------- 1. Modal adiada: a garagem de tenis ----------
    await entrar('maria@email.com');
    await page.getByRole('button', { name: /perfil/i }).last().click();
    await page.waitForTimeout(1500);

    const garagem = page.getByText(/garagem|t[eê]nis/i).first();
    if (await garagem.count()) {
      await garagem.scrollIntoViewIfNeeded();
      await garagem.click();
      await page.waitForTimeout(3000);
    }

    const abriuGaragem = await page.locator('text=/garagem/i').count();
    registrar(abriuGaragem > 0, 'C1: a garagem de tênis (modal adiada) monta ao ser aberta',
      'a modal nao apareceu — sinal classico de lazy preso no fallback');

    // ---------- 2. Telas adiadas do treinador ----------
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await entrar('coach@rush.com');

    await page.getByRole('button', { name: /perfil/i }).last().click();
    await page.waitForTimeout(2000);

    const entradaTreinador = page.getByText(/assessoria|treinador|atletas/i).first();
    registrar(await entradaTreinador.count() > 0,
      'C2: a conta de treinador vê a entrada do módulo',
      'nao achei como chegar no modulo do treinador');

    if (await entradaTreinador.count()) {
      await entradaTreinador.scrollIntoViewIfNeeded();
      await entradaTreinador.click();
      await page.waitForTimeout(3500);
    }

    // Preso no fallback = <div aria-busy> vazio e nada escrito.
    const textoVisivel = (await page.locator('body').innerText()).trim();
    const aindaCarregando = await page.locator('[aria-busy="true"]').count();

    registrar(aindaCarregando === 0,
      'C3: nenhuma tela ficou presa no fallback de carregamento',
      `${aindaCarregando} elemento(s) ainda com aria-busy depois de 3,5s`);

    registrar(textoVisivel.length > 200,
      'C4: a tela do treinador tem conteúdo de verdade',
      `a pagina tem so ${textoVisivel.length} caracteres — provavel fallback vazio`);

    registrar(errosDeJs.length === 0, 'C5: nenhum erro de JavaScript ao abrir as telas adiadas',
      errosDeJs.join(' | '));
  } catch (err) {
    registrar(false, 'a navegação falhou', err.message);
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
