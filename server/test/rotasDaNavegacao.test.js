// ============================================================
// RUSH RUNNING — Todo botão de navegação leva a uma rota real
// ------------------------------------------------------------
// A barra inferior legada apontava para '/training' e '/profile'.
// Nenhuma das duas existia: as rotas do shell são '/treinos' e
// '/perfil'. Como o roteador tem um catch-all — `<Route path="*"
// element={<Navigate to="/" replace />}` — os dois botões levavam
// para a Início SEM ERRO NENHUM.
//
// Esse é o pior tipo de defeito de navegação: nada quebra, nada
// aparece no console, e quem usa conclui que o app travou.
//
// Aquela barra foi removida junto com o painel legado que ela
// servia. Mas o defeito não era dela — era da distância entre quem
// oferece o botão e quem declara a rota. Essa distância continua
// existindo na navegação nova, em três saltos:
//
//   BottomNav.tsx  --onTabChange('treinos')-->  TabType
//   RushShell.tsx  --TAB_TO_PATH['treinos']-->  '/treinos'
//   App.jsx        --SHELL_PATHS----------->    rota registrada
//
// Basta um desses elos discordar para o botão cair no catch-all de
// novo. O teste percorre os três.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');

let passaram = 0;
let falharam = 0;

function teste(nome, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${nome}`);
    passaram += 1;
  } catch (err) {
    console.log(`  ❌ [FAIL] ${nome}`);
    console.log(`     ${err.message}`);
    falharam += 1;
  }
}

console.log('\n============================================================');
console.log('📌 ROTAS DA NAVEGAÇÃO');
console.log('============================================================\n');

const app = fs.readFileSync(path.join(RAIZ, 'src', 'App.jsx'), 'utf8');
const shell = fs.readFileSync(path.join(RAIZ, 'src', 'RushShell.tsx'), 'utf8');
const nav = fs.readFileSync(
  path.join(RAIZ, 'src', 'components', 'rush', 'BottomNav.tsx'),
  'utf8',
);

/** Rotas do shell, declaradas em SHELL_PATHS. */
function rotasDoShell() {
  const bloco = app.match(/const SHELL_PATHS = \[([^\]]*)\]/);
  assert.ok(bloco, 'SHELL_PATHS sumiu de src/App.jsx — o teste precisa ser atualizado junto');
  return [...bloco[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** Rotas declaradas uma a uma, como <Route path="/coach" …>. */
function rotasAvulsas() {
  return [...app.matchAll(/path="([^"*]+)"/g)].map((m) => m[1]);
}

/** O mapa aba → rota que o shell usa para navegar. */
function mapaDeAbas() {
  const bloco = shell.match(/const TAB_TO_PATH[^=]*= \{([\s\S]*?)\n\};/);
  assert.ok(bloco, 'TAB_TO_PATH sumiu de src/RushShell.tsx');
  return Object.fromEntries(
    [...bloco[1].matchAll(/'?([\w-]+)'?:\s*'([^']+)'/g)].map((m) => [m[1], m[2]]),
  );
}

/** As abas que os botões da barra realmente pedem. */
function abasDaBarra() {
  return [...nav.matchAll(/onTabChange\('([^']+)'\)/g)].map((m) => m[1]);
}

teste('toda aba pedida por um botão existe no mapa do shell', () => {
  const mapa = mapaDeAbas();
  const pedidas = abasDaBarra();
  assert.ok(pedidas.length >= 6, `a barra precisa oferecer as abas; li ${pedidas.length}`);

  const perdidas = pedidas.filter((aba) => !(aba in mapa));
  assert.deepStrictEqual(perdidas, [],
    `estas abas não existem em TAB_TO_PATH: ${perdidas.join(', ')}\n` +
    `       abas conhecidas: ${Object.keys(mapa).join(', ')}`);
});

teste('toda rota do mapa do shell está registrada no roteador', () => {
  const declaradas = new Set([...rotasDoShell(), ...rotasAvulsas()]);
  assert.ok(declaradas.size >= 6, 'a leitura das rotas falhou — nada a verificar');

  const perdidas = Object.entries(mapaDeAbas())
    .filter(([, rota]) => !declaradas.has(rota))
    .map(([aba, rota]) => `${aba} → ${rota}`);

  assert.deepStrictEqual(perdidas, [],
    'estas abas caem no catch-all e voltam para a Início em silêncio: ' +
    `${perdidas.join(', ')}\n       rotas que existem: ${[...declaradas].sort().join(', ')}`);
});

teste('a barra não some sozinha do shell', () => {
  // Sem esta verificação, apagar a <BottomNav /> faria os testes acima
  // passarem lendo um arquivo que ninguém mais monta.
  assert.match(shell, /<BottomNav\b/, 'RushShell não monta mais a BottomNav');
});

teste('/coach, que já foi o painel legado, não cai em lugar nenhum', () => {
  // O link pode estar salvo no navegador de quem usava o painel antigo.
  // Sem rota própria ele cairia no catch-all: funcionaria por acidente,
  // e pararia de funcionar no dia em que o catch-all mudasse.
  assert.match(app, /path="\/coach"[^>]*element=\{<Navigate to="\/perfil"/,
    '/coach precisa redirecionar explicitamente para /perfil');
});

console.log('\n============================================================');
console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
console.log('============================================================');
if (falharam > 0) process.exit(1);
