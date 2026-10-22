// ============================================================
// RUSH RUNNING — O app não preenche o que a pessoa não disse
// ------------------------------------------------------------
// Três invenções que chegavam à tela como se fossem dado do usuário:
//
// 1. CATEGORIA. Quem não assinava aparecia como "AGE-GROUP" —
//    categoria de competição por faixa etária — e quem assinava
//    aparecia como "PRO". Ninguém declarou categoria nenhuma: o selo
//    era deduzido de pagar ou não pagar. Para um corredor recreativo
//    de 60 anos que assinou, o app anunciava "PRO" no perfil, que na
//    corrida significa atleta profissional.
//
// 2. FRASE DO PERFIL. Sem bio preenchida, o app escrevia
//    "Treine mais forte quando seu corpo permitir." no lugar onde
//    vai a frase da pessoa. Quem lia o perfil via aquilo como algo
//    que ela escreveu.
//
// 3. FOTO DO TÊNIS. Um par sem foto recebia uma das quatro imagens
//    de catálogo pela POSIÇÃO na lista: o primeiro par virava um
//    Alphafly. (Esse caminho estava em `toShoe`, que nenhuma tela
//    chamava — a rota do servidor sempre devolveu `image_url` de
//    verdade ou nulo. Ninguém chegou a ver foto errada; o código
//    ficou pronto para quando alguém ligasse.)
//
// Este teste abre o app num navegador de verdade, com uma conta sem
// assinatura e sem bio, e exige que nada disso apareça. Depois liga a
// assinatura e exige que o selo PRO volte — senão o teste passaria
// só porque o selo sumiu de vez.
// ============================================================

const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..', '..');
// 3001 não é escolha: o proxy do vite.config.ts aponta /api para
// localhost:3001 fixo. Em qualquer outra porta o app carrega e
// nenhuma chamada chega ao servidor — o login simplesmente não passa.
const PORTA_API = 3001;
const PORTA_WEB = 5190;

const FRASE_INVENTADA = 'Treine mais forte quando seu corpo permitir';

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (_) {
  try {
    ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
  } catch (_) {
    console.log('\n============================================================');
    console.log('📌 SEM DADOS INVENTADOS');
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
  console.log('📌 SEM DADOS INVENTADOS');
  console.log('============================================================\n');

  const dbTeste = path.join(RAIZ, 'data', `inventado-test-${process.pid}.db`);
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

  // Prepara o banco ANTES de subir o servidor: ele só semeia banco
  // vazio, então o que deixarmos aqui sobrevive.
  const { Database } = require('../database/sqlite');
  const db = new Database(dbTeste);
  await require('../database/schema.js')(db);
  await require('../database/seedData.js')(db);

  // Conta nomeada, não "o primeiro atleta": o seed pode reordenar.
  const conta = await db.prepare('SELECT id, email FROM users WHERE email = ?').get('maria@email.com');
  assert.ok(conta, 'o seed precisa da conta maria@email.com');

  const deixarSemAssinaturaESemBio = () => {
    db.prepare("UPDATE users SET subscription_tier = 'free', subscription_status = 'free', subscription_expires_at = NULL WHERE id = ?").run(conta.id);
    db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(conta.id);
    db.prepare("UPDATE user_profiles SET bio = NULL, location = NULL WHERE user_id = ?").run(conta.id);
  };
  deixarSemAssinaturaESemBio();
  db.close();

  const ambienteApi = {
    ...process.env,
    PORT: String(PORTA_API),
    JWT_SECRET: 'teste-sem-inventado',
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
  const ctx = await browser.newContext({ viewport: { width: 414, height: 900 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  const BASE = `http://127.0.0.1:${PORTA_WEB}`;

  const entrar = async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    if ((await page.locator('input[type="email"]').count()) > 0) {
      await page.locator('input[type="email"]').first().fill(conta.email);
      await page.locator('input[type="password"]').first().fill('123456');
      await page.getByRole('button', { name: /entrar na plataforma/i }).click();
      await page.waitForTimeout(4500);
    }
  };

  try {
    await entrar();

    const inicio = await page.locator('body').innerText();

    // A frase de reserva também é o slogan da tela de login, onde ela
    // é o app falando, e não o usuário. Se o login não passar, o teste
    // leria o slogan e acusaria o app errado — ou pior, passaria por
    // não achar nada. Então exige estar dentro antes de medir.
    const entrou = !/entrar na plataforma/i.test(inicio);
    registrar(entrou, 'C0: a conta de teste entrou no app',
      'sem entrar, os testes abaixo mediriam a tela de login');
    if (!entrou) throw new Error('não foi possível entrar com a conta de teste');

    registrar(!/AGE-?GROUP/i.test(inicio),
      'C1: a tela inicial não inventa categoria de competição',
      'quem não assina não é "AGE-GROUP" — ninguém declarou categoria nenhuma');

    registrar(!inicio.includes(FRASE_INVENTADA),
      'C2: a tela inicial não escreve uma frase no lugar da pessoa',
      'a bio está vazia; o app não pode preencher por ela');

    await page.getByRole('button', { name: /perfil/i }).last().click();
    await page.waitForTimeout(2500);
    const perfil = await page.locator('body').innerText();

    registrar(!/AGE-?GROUP/i.test(perfil),
      'C3: o perfil não inventa categoria de competição');

    registrar(!perfil.includes(FRASE_INVENTADA),
      'C4: o perfil não inventa a frase do atleta');

    registrar(!/\bnull\b/.test(perfil),
      'C5: a ausência do selo não vaza como "null" na tela',
      'sem selo, não se escreve nada — nem a palavra null');

    // Agora com assinatura: o selo tem de voltar. Sem esta parte, o
    // teste passaria se alguém simplesmente apagasse o selo do app.
    const db2 = new (require('../database/sqlite').Database)(dbTeste);
    db2.prepare("UPDATE users SET subscription_tier = 'pro', subscription_status = 'active' WHERE id = ?").run(conta.id);
    db2.close();

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(4000);
    await page.getByRole('button', { name: /perfil/i }).last().click();
    await page.waitForTimeout(2500);
    const perfilPro = await page.locator('body').innerText();

    registrar(/\bPRO\b/.test(perfilPro),
      'C6: quem assina continua recebendo o selo PRO',
      'o selo precisa existir de verdade — senão C1–C4 passariam por ele ter sumido');
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
