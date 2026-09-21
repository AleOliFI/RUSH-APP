// ============================================================
// RUSH RUNNING — O app não baixa mais imagens (exceto o Story)
// ------------------------------------------------------------
// Eram NOVE botões de "baixar imagem" espalhados: foto do atleta,
// avatar do perfil, imagem do treino (em três telas diferentes),
// foto do feed, imagem do tênis na garagem e na aposentadoria, e o
// botão grande do visualizador. Mais um utilitário de ~160 linhas e
// um toast global só para avisar que o arquivo saiu.
//
// Tudo isso ocupava espaço de tela e de bundle para entregar o que
// o próprio navegador já faz com um toque longo na imagem.
//
// O Story é o caso à parte e fica: no computador não existe
// compartilhamento nativo, então sem o download dele não haveria
// como guardar o story de jeito nenhum.
//
// Este teste existe para o botão não voltar sem querer.
// ============================================================

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const SRC = path.join(RAIZ, 'src');

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

/** Todos os .ts/.tsx de src, menos o exportador de story. */
function arquivos(dir, acc = []) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) arquivos(completo, acc);
    else if (/\.tsx?$/.test(entrada.name)) acc.push(completo);
  }
  return acc;
}

console.log('\n============================================================');
console.log('📌 SEM DOWNLOAD DE IMAGEM (EXCETO O STORY)');
console.log('============================================================\n');

const todos = arquivos(SRC);
const STORY = path.join(SRC, 'components', 'rush', 'StoryExporterModal.tsx');

registrar(!fs.existsSync(path.join(SRC, 'utils', 'imageDownload.ts')),
  'C1: o utilitário de download de imagem não existe mais');

registrar(!fs.existsSync(path.join(SRC, 'components', 'rush', 'DownloadToast.tsx')),
  'C2: o toast global de download não existe mais');

const aindaImporta = todos.filter((f) => /imageDownload/.test(fs.readFileSync(f, 'utf8')));
registrar(aindaImporta.length === 0, 'C3: nenhum arquivo ainda importa o utilitário',
  aindaImporta.map((f) => path.relative(RAIZ, f)).join(', '));

// O rótulo visível. O Story fica de fora porque o download dele é
// a única forma de salvar no computador.
const comBotao = todos
  .filter((f) => f !== STORY)
  .filter((f) => /Baixar Imagem|Baixar Foto|Baixar avatar|Baixar imagem/i.test(fs.readFileSync(f, 'utf8')));
registrar(comBotao.length === 0, 'C4: nenhuma tela oferece "baixar imagem"',
  comBotao.map((f) => path.relative(RAIZ, f)).join(', '));

// Ninguém mais escuta o evento que o utilitário disparava.
const comEvento = todos.filter((f) => /rush-image-downloaded/.test(fs.readFileSync(f, 'utf8')));
registrar(comEvento.length === 0, 'C5: o evento global de download não tem mais ouvintes',
  comEvento.map((f) => path.relative(RAIZ, f)).join(', '));

// E o Story continua inteiro — o corte não podia levá-lo junto.
const story = fs.readFileSync(STORY, 'utf8');
registrar(/anchor\.download\s*=/.test(story) && /nav\.share\(/.test(story),
  'C6: o Story mantém salvar e compartilhar',
  'o Story perdeu o download — no computador ele fica sem saída nenhuma');

console.log('\n============================================================');
console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
console.log('============================================================');
process.exit(falharam > 0 ? 1 : 0);
