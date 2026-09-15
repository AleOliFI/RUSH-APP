// ============================================================
// RUSH RUNNING — Toda chamada de banco precisa de await
// ------------------------------------------------------------
// Com Postgres, uma chamada sem await devolve uma Promise em vez da
// linha. E `if (promessa)` é sempre verdadeiro, então o erro não
// lança: um INSERT some, um UPDATE não acontece, um `changes === 0`
// nunca é verdade. Nada disso aparece nos testes de rota, porque em
// SQLite a promessa já vem resolvida.
//
// Foi assim que três escritas passaram despercebidas na conversão —
// as que usavam um statement guardado em variável
// (`const inserir = db.prepare(...)` e depois `inserir.run(...)`),
// forma que o conversor automático não reconhecia. Uma delas gravava
// os splits de cada atividade.
//
// Este teste varre o código do servidor e falha se achar qualquer
// chamada de leitura ou escrita sem await.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const METODOS = '(get|all|run|pluck|iterate)';

function arquivosDoServidor() {
  const saida = [];
  const andar = (dir) => {
    for (const nome of fs.readdirSync(dir)) {
      const caminho = path.join(dir, nome);
      const info = fs.statSync(caminho);
      if (info.isDirectory()) {
        if (nome === 'node_modules' || nome === 'test') continue;
        andar(caminho);
      } else if (nome.endsWith('.js')) {
        saida.push(caminho);
      }
    }
  };
  andar(RAIZ);
  return saida;
}

/** Índice logo após o ')' que fecha, ignorando o que está entre aspas. */
function fimDoParenteses(texto, inicio) {
  if (inicio < 0) return -1;
  let nivel = 0;
  let aspas = null;
  for (let i = inicio; i < texto.length; i += 1) {
    const c = texto[i];
    if (aspas) {
      if (c === '\\') { i += 1; continue; }
      if (c === aspas) aspas = null;
    } else if (c === '"' || c === "'" || c === '`') {
      aspas = c;
    } else if (c === '(') {
      nivel += 1;
    } else if (c === ')') {
      nivel -= 1;
      if (nivel === 0) return i + 1;
    }
  }
  return -1;
}

/** Já existe um `await` (ou `(await`) imediatamente antes da posição? */
function temAwaitAntes(texto, posicao) {
  const antes = texto.slice(Math.max(0, posicao - 80), posicao);
  return /\(?await\s*$/.test(antes);
}

/**
 * Apaga comentarios, preservando as quebras de linha.
 *
 * Sem isso o proprio cabecalho deste arquivo — e o do adaptador, que
 * explica `db.prepare(sql).get(...)` em portugues — seriam lidos como
 * codigo e acusados. Os \n ficam onde estao para que o numero da linha
 * relatado continue sendo o numero real do arquivo.
 */
function semComentarios(texto) {
  let saida = '';
  let aspas = null;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (aspas) {
      saida += c;
      if (c === '\\') { saida += texto[i + 1] || ''; i += 1; continue; }
      if (c === aspas) aspas = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { aspas = c; saida += c; continue; }
    if (c === '/' && texto[i + 1] === '/') {
      while (i < texto.length && texto[i] !== '\n') i += 1;
      saida += '\n';
      continue;
    }
    if (c === '/' && texto[i + 1] === '*') {
      i += 2;
      while (i < texto.length && !(texto[i] === '*' && texto[i + 1] === '/')) {
        if (texto[i] === '\n') saida += '\n';
        i += 1;
      }
      i += 1;
      continue;
    }
    saida += c;
  }
  return saida;
}

function achar(textoBruto) {
  const texto = semComentarios(textoBruto);
  const problemas = [];

  // 1) db.prepare(...).get/all/run(...) — inclusive com quebra de linha.
  //
  // O fim do prepare() é achado contando parênteses, e não por regex:
  // SQL tem parêntese dentro, e olhar "algum .run() adiante" acusaria
  // falsamente um `const inserir = db.prepare(...)`, que é só a
  // preparação e não precisa de await.
  const direto = /db\s*\n?\s*\.prepare\s*\(/g;
  let m;
  while ((m = direto.exec(texto)) !== null) {
    const fim = fimDoParenteses(texto, texto.indexOf('(', m.index + 2));
    if (fim === -1) continue;

    let j = fim;
    while (j < texto.length && /\s/.test(texto[j])) j += 1;
    const encadeia = new RegExp(`^\\.${METODOS}\\s*\\(`).test(texto.slice(j));

    if (encadeia && !temAwaitAntes(texto, m.index)) {
      problemas.push({ linha: texto.slice(0, m.index).split('\n').length, tipo: 'db.prepare(...)' });
    }
  }

  // 2) Statement guardado em variável: const x = db.prepare(...) ... x.run(...)
  const nomes = new Set();
  for (const n of texto.matchAll(/const (\w+)\s*=\s*db\.prepare\(/g)) nomes.add(n[1]);
  for (const nome of nomes) {
    const uso = new RegExp(`(?<![.\\w])${nome}\\.${METODOS}\\s*\\(`, 'g');
    while ((m = uso.exec(texto)) !== null) {
      if (!temAwaitAntes(texto, m.index)) {
        problemas.push({ linha: texto.slice(0, m.index).split('\n').length, tipo: `${nome}.${m[1]}()` });
      }
    }
  }

  // 3) db.exec(...)
  const exec = /(?<![.\w])db\.exec\s*\(/g;
  while ((m = exec.exec(texto)) !== null) {
    if (!temAwaitAntes(texto, m.index)) {
      problemas.push({ linha: texto.slice(0, m.index).split('\n').length, tipo: 'db.exec()' });
    }
  }

  return problemas;
}

console.log('\n============================================================');
console.log('📌 AWAIT EM TODA CHAMADA DE BANCO');
console.log('============================================================');

const encontrados = [];
for (const arquivo of arquivosDoServidor()) {
  const relativo = path.relative(path.join(RAIZ, '..'), arquivo);
  for (const p of achar(fs.readFileSync(arquivo, 'utf-8'))) {
    encontrados.push(`${relativo}:${p.linha}  ${p.tipo}`);
  }
}

if (encontrados.length > 0) {
  console.log('  ❌ [FAIL] chamadas de banco sem await:');
  for (const e of encontrados) console.log('     ' + e);
  console.log('\n  Em Postgres isso devolve uma Promise no lugar da linha, e o erro');
  console.log('  não lança: a escrita some ou a leitura vira undefined.');
  console.log('============================================================');
  process.exit(1);
}

try {
  assert.strictEqual(encontrados.length, 0);
  console.log('  ✅ [PASS] nenhuma chamada de banco sem await');
} catch (e) {
  process.exit(1);
}
console.log('============================================================');
