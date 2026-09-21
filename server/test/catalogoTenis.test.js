// ============================================================
// RUSH RUNNING — Catálogo de tênis da garagem
// ------------------------------------------------------------
// Cadastrar um par era preencher tudo do zero. O catálogo encurta
// isso, mas traz um risco próprio: uma lista de modelos é dado
// afirmado dentro do app. Se ela inventar um modelo, ou cravar uma
// versão que não existe, o app passa a mentir com cara de precisão.
//
// Por isso as duas regras da lista viram teste aqui:
//
//   1. SÓ FAMÍLIAS, sem número de versão. "Nike Pegasus", nunca
//      "Nike Pegasus 41" — numeração muda todo ano e envelheceria
//      sem ninguém ver.
//   2. A vida útil vem da CATEGORIA, não do modelo. Nenhum par
//      carrega quilometragem própria, porque não existe fonte
//      verificada para isso par a par.
//
// A segunda metade abre o navegador e confere que escolher um
// modelo realmente preenche o formulário — sem isso o catálogo
// seria só um arquivo bonito que ninguém alcança.
// ============================================================

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const RAIZ = path.join(__dirname, '..', '..');
const PORTA_API = 3001;
const PORTA_WEB = 5195;

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

console.log('\n============================================================');
console.log('📌 CATÁLOGO DE TÊNIS');
console.log('============================================================\n');

const fonte = fs.readFileSync(path.join(RAIZ, 'src', 'data', 'catalogoTenis.ts'), 'utf8');

// Os nomes ficam entre `nome: '...'`.
const nomes = [...fonte.matchAll(/nome:\s*'([^']+)'/g)].map((m) => m[1]);

registrar(nomes.length >= 40, 'C1: o catálogo tem modelos suficientes para valer a pena',
  `só encontrei ${nomes.length} modelos`);

// Regra 1 — nenhuma versão numérica solta no fim do nome.
// "Fresh Foam 1080" e "GT-2000" são NOME de família, não versão:
// a ressalva está na lista abaixo e é deliberadamente curta.
const familiasComNumeroNoNome = ['Fresh Foam 1080', 'Fresh Foam 880', 'Fresh Foam 860', 'GT-2000'];
const comVersao = nomes.filter((n) => /\s\d+$|\sv\d+$/i.test(n) && !familiasComNumeroNoNome.some((f) => n.endsWith(f)));
registrar(comVersao.length === 0, 'C2: nenhum modelo cravou número de versão',
  `versões que envelheceriam sozinhas: ${comVersao.join(', ')}`);

// Regra 2 — vida útil só existe por categoria.
const temKmPorModelo = /\{\s*nome:[^}]*(vidaUtilKm|maxKm|max_km)\s*:/.test(fonte);
registrar(!temKmPorModelo, 'C3: nenhum modelo carrega quilometragem própria',
  'apareceu vida útil por modelo — isso seria número sem fonte verificada');

const duplicados = nomes.filter((n, i) => nomes.indexOf(n) !== i);
registrar(duplicados.length === 0, 'C4: não há modelo repetido', duplicados.join(', '));

// Toda categoria usada precisa existir em CATEGORIAS.
const categoriasUsadas = new Set([...fonte.matchAll(/categoria:\s*'([^']+)'/g)].map((m) => m[1]));
const categoriasDeclaradas = new Set(
  [...fonte.matchAll(/^\s{2}(\w+):\s*\{\s*$/gm)].map((m) => m[1]),
);
const orfas = [...categoriasUsadas].filter((c) => !categoriasDeclaradas.has(c));
registrar(orfas.length === 0, 'C5: toda categoria usada está declarada em CATEGORIAS',
  `categorias sem definição (o app leria undefined): ${orfas.join(', ')}`);

const modal = fs.readFileSync(path.join(RAIZ, 'src', 'components', 'rush', 'GearGarageModal.tsx'), 'utf8');
registrar(/buscarModelos\(/.test(modal) && /handleEscolherModelo/.test(modal),
  'C6: a garagem está ligada no catálogo',
  'o catálogo existe mas nenhuma tela o alcança');

// ------------------------------------------------------------
// Segunda metade: o preenchimento acontece de verdade?
// ------------------------------------------------------------

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (_) {
  try {
    ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
  } catch (_) {
    console.log('  ⏭️  a parte de navegador foi pulada: Playwright indisponível.');
    console.log('\n============================================================');
    console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
    console.log('============================================================');
    process.exit(falharam > 0 ? 1 : 0);
  }
}

function esperarPorta(url, tentativas = 40) {
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
  const dbTeste = path.join(RAIZ, 'data', `catalogo-test-${process.pid}.db`);
  for (const s of ['', '-shm', '-wal']) { try { fs.unlinkSync(dbTeste + s); } catch (_) {} }

  const jaOcupada = await new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORTA_API}/api/health`, (res) => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
  if (jaOcupada) {
    console.log(`  ⏭️  a parte de navegador foi pulada: já há algo em ${PORTA_API}.`);
    console.log(`\n   Passaram: ${passaram}   Falharam: ${falharam}`);
    process.exit(falharam > 0 ? 1 : 0);
  }

  // DATABASE_URL vazia de propósito: o seed apaga ~20 tabelas.
  const ambienteApi = {
    ...process.env,
    PORT: String(PORTA_API),
    JWT_SECRET: 'teste-catalogo',
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
    cwd: RAIZ, env: process.env, stdio: 'ignore', detached: true,
  }));

  const apiOk = await esperarPorta(`http://127.0.0.1:${PORTA_API}/api/health`);
  const webOk = await esperarPorta(`http://127.0.0.1:${PORTA_WEB}/`);
  if (!apiOk || !webOk) {
    registrar(false, 'os servidores subiram para o teste de navegador', `api=${apiOk} web=${webOk}`);
    encerrarTudo();
    process.exit(1);
  }

  const candidatos = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].filter(Boolean);
  const executavel = candidatos.find((c) => { try { return fs.existsSync(c); } catch (_) { return false; } });

  const browser = await chromium.launch({
    ...(executavel ? { executablePath: executavel } : {}),
    args: ['--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 414, height: 900 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  const BASE = `http://127.0.0.1:${PORTA_WEB}`;

  try {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    if ((await page.locator('input[type="email"]').count()) > 0) {
      await page.locator('input[type="email"]').first().fill('maria@email.com');
      await page.locator('input[type="password"]').first().fill('123456');
      await page.getByRole('button', { name: /entrar na plataforma/i }).click();
      await page.waitForTimeout(3500);
    }

    await page.getByRole('button', { name: /perfil/i }).last().click();
    await page.waitForTimeout(1500);

    const entradaGaragem = page.getByText(/garagem/i).first();
    await entradaGaragem.scrollIntoViewIfNeeded();
    await entradaGaragem.click();

    // A garagem é carregada sob demanda; num vite frio o import demora.
    const nome = page.locator('#shoe-name');
    await page.getByRole('button', { name: /adicionar/i }).first().waitFor({ state: 'visible', timeout: 120000 });
    await page.getByRole('button', { name: /adicionar/i }).first().click();
    await nome.waitFor({ state: 'visible', timeout: 30000 });

    await nome.fill('pegasus');
    await page.waitForTimeout(800);

    // O nome acessível do botão traz nome + categoria ("Nike Pegasus
    // Rodagem"), então a âncora é no começo, e não no fim.
    const sugestao = page.getByRole('button', { name: /^nike pegasus\b/i }).first();
    registrar(await sugestao.count() > 0, 'C7: digitar o nome traz sugestões do catálogo',
      'nenhuma sugestao apareceu ao digitar "pegasus"');

    await sugestao.click();
    await page.waitForTimeout(500);

    const nomePreenchido = await nome.inputValue();
    const usoPreenchido = await page.locator('#shoe-type').inputValue();
    const vidaUtil = await page.locator('#shoe-max').inputValue();

    registrar(nomePreenchido === 'Nike Pegasus', 'C8: escolher o modelo preenche o nome', nomePreenchido);
    registrar(usoPreenchido.length > 0, 'C9: o uso principal vem preenchido pela categoria', usoPreenchido);
    registrar(Number(vidaUtil) > 0 && Number(vidaUtil) !== 800,
      'C10: a vida útil vem da categoria, e não do 800 padrão do formulário', vidaUtil);
  } catch (err) {
    registrar(false, 'o fluxo do catálogo na garagem falhou', err.message);
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
