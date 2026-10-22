// ============================================================
// RUSH RUNNING — As contas de demonstração não vão para produção
// ------------------------------------------------------------
// A tela de login listava, em letras legíveis, quatro contas de
// teste com a senha ao lado ("SENHA PADRÃO: 123456"). Era cômodo
// durante o desenvolvimento e é um convite em produção: qualquer
// pessoa que abrisse o app entrava como a atleta de demonstração —
// e uma das contas é de treinador, que enxerga os dados dos alunos.
//
// A correção não foi esconder o bloco com CSS nem com um `if` de
// tempo de execução: foi prendê-lo a `import.meta.env.DEV`, que o
// Vite substitui por `false` ao compilar. O bloco inteiro vira
// código morto e some do pacote — não fica escondido, não existe.
//
// Este teste compila o pacote de produção de verdade e procura as
// strings nos arquivos gerados. Se alguém trocar a guarda por algo
// que só esconde, as strings reaparecem e isto falha.
// ============================================================

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const RAIZ = path.join(__dirname, '..', '..');

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
console.log('📌 CREDENCIAIS DE DEMONSTRAÇÃO FORA DO PACOTE DE PRODUÇÃO');
console.log('============================================================\n');

// ---------- 1. Compila como a Vercel compila ----------
const saida = fs.mkdtempSync(path.join(os.tmpdir(), 'rush-build-'));
const build = spawnSync(
  'npx',
  ['vite', 'build', '--mode', 'production', '--outDir', saida, '--emptyOutDir', '--logLevel', 'error'],
  { cwd: RAIZ, encoding: 'utf8', timeout: 240000, env: { ...process.env, VITE_API_URL: '' } },
);

if (build.status !== 0) {
  registrar(false, 'o pacote de produção compila',
    (build.stderr || build.stdout || 'sem saída').slice(0, 600));
  console.log('\n============================================================');
  console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
  console.log('============================================================');
  process.exit(1);
}
registrar(true, 'C1: o pacote de produção compila');

// ---------- 2. Junta tudo o que foi gerado ----------
function arquivosDe(pasta) {
  const achados = [];
  for (const item of fs.readdirSync(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, item.name);
    if (item.isDirectory()) achados.push(...arquivosDe(caminho));
    else achados.push(caminho);
  }
  return achados;
}

const texto = arquivosDe(saida)
  .filter((f) => /\.(js|css|html|map)$/i.test(f))
  .map((f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return ''; } })
  .join('\n');

registrar(texto.length > 10000, 'C2: os arquivos gerados foram lidos',
  `li apenas ${texto.length} caracteres — sem conteúdo o teste não prova nada`);

// ---------- 3. Nada de credencial no que o navegador baixa ----------
// E-mail de atleta, e-mail de treinador, o rótulo da senha e o
// título do bloco. Qualquer um deles presente significa que o
// bloco voltou ao pacote.
const PROIBIDAS = [
  'alessandro@rush.com',
  'coach@rush.com',
  'SENHA PADRÃO',
  'CONTAS DE DEMONSTRAÇÃO',
];

for (const proibida of PROIBIDAS) {
  registrar(!texto.includes(proibida),
    `C3: "${proibida}" não aparece no pacote de produção`,
    'a guarda de DEV não está removendo o bloco das credenciais');
}

// ---------- 4. A guarda é a do Vite, não um `if` de execução ----------
// `import.meta.env.DEV` é trocado por `false` na compilação; uma
// variável lida em tempo de execução (ou um `hidden` no CSS) deixaria
// o texto no arquivo — por isso o teste acima é a prova, e este aqui
// só explica o porquê para quem for mexer.
const login = fs.readFileSync(path.join(RAIZ, 'src', 'screens', 'LoginScreen.tsx'), 'utf8');
registrar(/import\.meta\.env\.DEV/.test(login),
  'C4: a tela de login prende as credenciais a import.meta.env.DEV',
  'sem isso o bloco pode voltar ao pacote na próxima mudança');

fs.rmSync(saida, { recursive: true, force: true });

console.log('\n============================================================');
console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
console.log('============================================================');
process.exit(falharam > 0 ? 1 : 0);
