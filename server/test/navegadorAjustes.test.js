// ============================================================
// RUSH RUNNING — Ajustes e privacidade num navegador de verdade
// ------------------------------------------------------------
// Os outros testes conferem a API e o estado do banco. Este abre a
// tela num Chromium, clica nos interruptores e confere o que a
// pessoa veria.
//
// Ele existe porque dois bugs passaram por tudo o que havia antes:
//
//   1. GET /users/privacy-zone era engolido por GET /:username, e a
//      zona nunca era lida de volta. Compilava, passava nos testes,
//      e a tela dizia "nenhuma zona configurada" logo depois de a
//      pessoa salvar uma.
//   2. privacy = "public" com aspas duplas derrubava o perfil
//      publico com 500.
//
// Nenhum dos dois aparecia sem exercitar o caminho inteiro.
//
// Sobre os icones: a fonte e um SUBCONJUNTO, e um icone que falta e
// desenhado como o NOME da ligadura. Nao da para detectar isso por
// texto — innerText devolve o nome da ligadura tanto faz o glifo
// existir ou nao. O que distingue e a LARGURA: um glifo ocupa um
// quadrado do tamanho da fonte, o nome escrito fica muito mais
// largo.
//
// O Playwright nao e dependencia do projeto. Quando ele nao estiver
// disponivel o teste AVISA e sai com 0, em vez de reprovar um
// ambiente que so nao tem navegador.
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
const PORTA_WEB = 5199;

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (_) {
  try {
    ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
  } catch (_) {
    console.log('\n============================================================');
    console.log('📌 AJUSTES NO NAVEGADOR');
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
  console.log('📌 AJUSTES NO NAVEGADOR');
  console.log('============================================================');

  // Banco proprio, para nao mexer no de desenvolvimento.
  const fs = require('fs');
  const dbTeste = path.join(RAIZ, 'data', `navegador-test-${process.pid}.db`);
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
    JWT_SECRET: 'teste-navegador',
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

  const web = spawn(
    'npx',
    ['vite', '--host', '127.0.0.1', '--port', String(PORTA_WEB), '--strictPort'],
    {
      cwd: RAIZ,
      env: process.env,
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

  /**
   * Login (quando necessário) e navegação até a tela de ajustes.
   *
   * Na segunda visita a sessão continua válida — o token fica guardado
   * no navegador — e não há formulário nenhum para preencher. Insistir
   * no login travaria aqui, que é justamente o que prova que a sessão
   * sobreviveu ao recarregamento.
   */
  async function abrirAjustes() {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    if ((await page.locator('input[type="email"]').count()) > 0) {
      await page.locator('input[type="email"]').first().fill('maria@email.com');
      await page.locator('input[type="password"]').first().fill('123456');
      await page.getByRole('button', { name: /entrar na plataforma/i }).click();
      await page.waitForTimeout(3000);
    }
    await page.getByRole('button', { name: /perfil/i }).last().click();
    await page.waitForTimeout(1500);
    const cartao = page.getByText(/ajustes|conta/i).first();
    await cartao.scrollIntoViewIfNeeded();
    await cartao.click();
    await page.waitForTimeout(2500);
  }

  try {
    await abrirAjustes();

    registrar(
      (await page.getByText(/ajustes e privacidade/i).count()) > 0,
      'B1: a tela de ajustes abre a partir do perfil',
    );

    const interruptores = await page.locator('[role="switch"]').count();
    registrar(interruptores >= 7, `B2: os interruptores renderizam (${interruptores})`,
      `esperava ao menos 7, achei ${interruptores}`);

    // ---- o interruptor grava de verdade ----
    const vo2 = page.locator('[role="switch"][aria-label="Mostrar VO₂ máx."]');
    const antes = await vo2.getAttribute('aria-checked');
    await vo2.click();
    await page.waitForTimeout(1500);
    const depois = await vo2.getAttribute('aria-checked');
    registrar(antes !== depois, 'B3: o interruptor muda ao ser tocado',
      `continuou em ${antes}`);

    // Recarregar prova que veio do banco, e nao do estado da tela.
    await abrirAjustes();
    const persistido = await page
      .locator('[role="switch"][aria-label="Mostrar VO₂ máx."]')
      .getAttribute('aria-checked');
    registrar(persistido === depois, 'B4: o valor persiste depois de recarregar a página',
      `salvou ${depois} e voltou ${persistido}`);

    // ---- zona de privacidade: salvar E ler de volta ----
    const btnLocal = page.getByRole('button', { name: /usar minha localiza/i });
    await btnLocal.scrollIntoViewIfNeeded();
    await btnLocal.click();
    await page.waitForTimeout(2500);

    const lat = await page.locator('input[placeholder="-23.550500"]').inputValue();
    const lon = await page.locator('input[placeholder="-46.633300"]').inputValue();
    registrar(!!lat && !!lon, 'B5: a localização do navegador preenche as coordenadas',
      `lat="${lat}" lon="${lon}"`);

    await page.locator('input[placeholder="Casa"]').fill('Casa');
    await page.getByRole('button', { name: /ativar zona|atualizar zona/i }).click();
    await page.waitForTimeout(2500);

    registrar(
      (await page.getByText(/zona ativa/i).count()) > 0,
      'B6: salvar a zona confirma na tela',
      'a tela não confirmou a zona depois de salvar',
    );

    // B7 é separado de B6 de propósito. Logo após salvar, a tela mostra
    // "Zona ativa" com a resposta do próprio PUT — e o PUT funcionava
    // mesmo com o bug de ordem de rotas. Só o RECARREGAMENTO passa pelo
    // GET, que era a chamada engolida por /:username. Uma versão anterior
    // deste teste parava no passo acima e continuava passando com o bug
    // reintroduzido.
    await abrirAjustes();
    const zonaAposRecarregar = await page.getByText(/zona ativa/i).count();
    registrar(
      zonaAposRecarregar > 0,
      'B7: a zona continua lá depois de recarregar (passa pelo GET)',
      'a tela diz "nenhuma zona configurada" depois de recarregar: ' +
      'a leitura da zona voltou a ser engolida por outra rota',
    );

    // ---- validação no cliente ----
    await page.locator('input[placeholder="-23.550500"]').fill('999');
    await page.getByRole('button', { name: /ativar zona|atualizar zona/i }).click();
    await page.waitForTimeout(1200);
    registrar(
      (await page.getByText(/latitude precisa ser/i).count()) > 0,
      'B8: latitude fora da faixa é barrada com aviso ao lado do campo',
    );

    // ---- ícones viraram glifo, não texto ----
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);

    const fonteOk = await page.evaluate(() =>
      [...document.fonts].some((f) => /Material Symbols/i.test(f.family) && f.status === 'loaded'));
    registrar(fonteOk, 'B9: a fonte de ícones carregou');

    const largos = await page.evaluate(() =>
      [...document.querySelectorAll('.material-symbols-outlined')]
        .map((s) => ({
          nome: s.textContent.trim(),
          largura: Math.round(s.getBoundingClientRect().width),
          fonte: parseFloat(getComputedStyle(s).fontSize),
        }))
        .filter((m) => m.largura > Math.max(40, m.fonte * 1.6)));

    registrar(largos.length === 0, 'B10: todo ícone renderizou como glifo, não como texto',
      largos.map((m) => `${m.nome} ocupa ${m.largura}px`).join(', '));

    // ---- layout ----
    const transbordo = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      cliente: document.documentElement.clientWidth,
    }));
    registrar(transbordo.scroll <= transbordo.cliente,
      'B11: a tela não transborda na horizontal em 414px',
      `scrollWidth ${transbordo.scroll} > clientWidth ${transbordo.cliente}`);

    registrar(errosDeJs.length === 0, 'B12: nenhum erro de JavaScript na página',
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
