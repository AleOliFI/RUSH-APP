// ============================================================
// RUSH RUNNING — A marca é a entregue, e não uma improvisação
// ------------------------------------------------------------
// O app vinha exibindo três marcas diferentes ao mesmo tempo:
//
//   • public/assets/logo.svg — duas barras (uma com opacidade) e
//     "RUSH" em Arial Black. Provisório.
//   • um fallback dentro do Header, montado com <span> inclinados
//     em #FF5500/#FF6B00/#FFAA00, que aparecia sempre que a
//     imagem falhasse.
//   • a tela de login, que redesenhava as barras na mão, sem PRO.
//
//   • e um favicon roxo (#863bff) que não é da marca.
//
// O design system entregue define UMA marca: três barras em
// #FF5500 / #FF7700 / #FF9933, "RUSH" em Anton e o selo PRO.
// Este teste existe para nenhuma dessas variantes voltar.
//
// Detalhe que não é capricho: dentro do app a marca é componente
// (SVG no DOM, que enxerga a fonte da página); o arquivo solto
// leva Anton embutida, porque SVG carregado como <img> não vê
// fonte nenhuma e sairia em Impact.
// ============================================================

const fs = require('fs');
const path = require('path');

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
console.log('📌 LOGO DA MARCA');
console.log('============================================================\n');

// As três barras, exatamente como vieram no design system.
const BARRAS = [
  { d: 'M12 36L28 12H38L22 36H12Z', cor: '#FF5500' },
  { d: 'M26 36L42 12H52L36 36H26Z', cor: '#FF7700' },
  { d: 'M40 36L56 12H66L50 36H40Z', cor: '#FF9933' },
];

const componente = fs.readFileSync(path.join(RAIZ, 'src', 'components', 'rush', 'RushLogo.tsx'), 'utf8');

const faltando = BARRAS.filter((b) => !componente.includes(b.d) || !componente.includes(b.cor));
registrar(faltando.length === 0, 'C1: o componente traz as três barras entregues, sem redesenho',
  `barras diferentes do original: ${faltando.map((b) => b.cor).join(', ')}`);

// O JSX quebra linha entre a tag e o texto, então a busca é por
// palavra isolada, e não por ">RUSH<".
registrar(/Anton/.test(componente) && /\bRUSH\b/.test(componente) && /\bPRO\b/.test(componente),
  'C2: o wordmark é RUSH + PRO em Anton', 'a marca perdeu o wordmark ou a fonte');

// Quem usa a marca usa o componente.
const header = fs.readFileSync(path.join(RAIZ, 'src', 'components', 'rush', 'Header.tsx'), 'utf8');
const login = fs.readFileSync(path.join(RAIZ, 'src', 'screens', 'LoginScreen.tsx'), 'utf8');

registrar(/<RushLogo/.test(header) && /<RushLogo/.test(login),
  'C3: cabeçalho e login usam a mesma marca',
  'alguma tela voltou a montar a marca por conta própria');

registrar(!/svg-fallback/.test(header),
  'C4: o fallback improvisado do cabeçalho não existe mais',
  'o <img> com onError montando barras na mão voltou');

// A improvisação tinha assinatura própria: <span> inclinado com
// as cores antigas. Se ela reaparecer em qualquer tela, é regressão.
function arquivos(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const c = path.join(dir, e.name);
    if (e.isDirectory()) arquivos(c, acc);
    else if (/\.tsx?$/.test(e.name)) acc.push(c);
  }
  return acc;
}
const improvisando = arquivos(path.join(RAIZ, 'src'))
  .filter((f) => /skew-x-\[-20deg\]/.test(fs.readFileSync(f, 'utf8')));
registrar(improvisando.length === 0, 'C5: nenhuma tela desenha as barras à mão',
  improvisando.map((f) => path.relative(RAIZ, f)).join(', '));

// O arquivo solto: mesmas barras E fonte embutida.
const arquivoSvg = fs.readFileSync(path.join(RAIZ, 'public', 'assets', 'logo.svg'), 'utf8');
const barrasNoArquivo = BARRAS.every((b) => arquivoSvg.includes(b.d) && arquivoSvg.includes(b.cor));
registrar(barrasNoArquivo, 'C6: o logo.svg solto é a mesma marca',
  'o arquivo e o componente divergiram');

registrar(/@font-face/.test(arquivoSvg) && /data:font\/woff2;base64,/.test(arquivoSvg),
  'C7: o logo.svg carrega Anton embutida',
  'sem a fonte embutida o wordmark sai em Impact quando usado como imagem');

registrar(!/Arial Black/.test(arquivoSvg), 'C8: o logo provisório em Arial Black foi embora');

// Favicon: símbolo da marca, não o placeholder roxo.
const favicon = fs.readFileSync(path.join(RAIZ, 'public', 'favicon.svg'), 'utf8');
registrar(!/863bff/i.test(favicon), 'C9: o favicon roxo de placeholder saiu');
registrar(BARRAS.every((b) => favicon.includes(b.d)) && /#FF5500/i.test(favicon),
  'C10: o favicon usa o símbolo da marca, com a mesma geometria',
  'o favicon redesenhou as barras em vez de reaproveitá-las');

console.log('\n============================================================');
console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
console.log('============================================================');
process.exit(falharam > 0 ? 1 : 0);
