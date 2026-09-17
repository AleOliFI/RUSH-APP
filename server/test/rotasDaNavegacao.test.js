// ============================================================
// RUSH RUNNING — Todo botão de navegação leva a uma rota real
// ------------------------------------------------------------
// A barra inferior legada apontava para '/training' e '/profile'.
// Nenhuma das duas existe: as rotas do shell são '/treinos' e
// '/perfil'. O roteador tem um catch-all — `<Route path="*"
// element={<Navigate to="/" replace />}` — então os dois botões
// levavam para a Início SEM ERRO NENHUM.
//
// Esse é o pior tipo de defeito de navegação: nada quebra, nada
// aparece no console, e quem usa conclui que o app travou. E como
// a barra só aparece em /coach, quem testava pelo shell novo nunca
// esbarrava nele.
//
// O teste lê os dois arquivos e cobra que todo caminho oferecido
// por um botão exista entre as rotas declaradas.
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
const nav = fs.readFileSync(path.join(RAIZ, 'src', 'components', 'BottomNav.jsx'), 'utf8');

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

function caminhosDaBarra() {
  const bloco = nav.match(/const tabs = \[([\s\S]*?)\n\];/);
  assert.ok(bloco, 'a lista de abas sumiu de BottomNav.jsx');
  return [...bloco[1].matchAll(/path: '([^']+)'/g)].map((m) => m[1]);
}

teste('todo caminho da barra inferior existe no roteador', () => {
  const declaradas = new Set([...rotasDoShell(), ...rotasAvulsas()]);
  assert.ok(declaradas.size >= 6, 'a leitura das rotas falhou — nada a verificar');

  const perdidos = caminhosDaBarra().filter((c) => !declaradas.has(c));

  assert.deepStrictEqual(perdidos, [],
    'estes botões caem no catch-all e voltam para a Início em silêncio: ' +
    `${perdidos.join(', ')}\n       rotas que existem: ${[...declaradas].sort().join(', ')}`);
});

teste('a barra não some sozinha do roteador', () => {
  // Se BottomNav deixar de ser renderizado, o teste acima passa vazio
  // sem que ninguém perceba que a navegação inteira sumiu.
  assert.match(app, /<BottomNav \/>/, 'BottomNav não é mais renderizado em App.jsx');
});

console.log('\n============================================================');
console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
console.log('============================================================');
if (falharam > 0) process.exit(1);
