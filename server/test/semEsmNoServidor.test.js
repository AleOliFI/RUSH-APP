// ============================================================
// RUSH RUNNING — Nada de ESM puro no caminho do servidor
// ------------------------------------------------------------
// `uuid@14` é ESM puro (`"type": "module"`). O Node 22 desta
// máquina aceita `require()` de um módulo ESM, então
// `require('uuid')` funcionava em desenvolvimento e nos testes —
// e quebrava na Vercel, cujo runtime não aceita:
//
//   Error [ERR_REQUIRE_ESM]: require() of ES Module
//   /var/task/node_modules/uuid/dist-node/index.js
//   from /var/task/server/database/seedData.js not supported.
//
// O processo saía com status 1 no carregamento do módulo, antes de
// qualquer rota existir. A falha não aparecia em teste nenhum
// porque a máquina de teste é justamente a que perdoa.
//
// A saída foi `crypto.randomUUID`, embutido no Node, mesmo formato
// v4. Este teste guarda a fronteira: se alguém reintroduzir um
// `require` de pacote ESM no código que a Vercel carrega, ele falha
// AQUI, e não em produção.
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
console.log('📌 SEM ESM PURO NO CAMINHO DO SERVIDOR');
console.log('============================================================\n');

/** Todo .js que a função serverless pode carregar — testes ficam de fora. */
function arquivosDoServidor(dir, achados = []) {
  for (const nome of fs.readdirSync(dir)) {
    const completo = path.join(dir, nome);
    if (fs.statSync(completo).isDirectory()) {
      if (nome === 'test' || nome === 'node_modules') continue;
      arquivosDoServidor(completo, achados);
    } else if (nome.endsWith('.js')) {
      achados.push(completo);
    }
  }
  return achados;
}

/**
 * ESM puro = `"type": "module"` E nenhuma porta de entrada CommonJS.
 *
 * Só olhar o `type` não serve: `bcryptjs` é `"type": "module"` mas
 * publica um build UMD sob a condição `require` do campo `exports`,
 * e `require('bcryptjs')` funciona em qualquer runtime. O que quebra
 * é o pacote que NÃO oferece saída nenhuma para CommonJS — como o
 * `uuid@14`, cujo `exports` só tem `import`.
 */
function ehPacoteEsm(nome) {
  try {
    const pkg = path.join(RAIZ, 'node_modules', nome, 'package.json');
    const j = JSON.parse(fs.readFileSync(pkg, 'utf8'));
    if (j.type !== 'module') return false;
    // Uma condição `require` em qualquer ramo do exports basta.
    if (j.exports && JSON.stringify(j.exports).includes('"require"')) return false;
    // Um `main` .cjs também é entrada CommonJS válida.
    if (typeof j.main === 'string' && j.main.endsWith('.cjs')) return false;
    return true;
  } catch {
    return false;
  }
}

teste('nenhum arquivo do servidor faz require() de pacote ESM puro', () => {
  const arquivos = [...arquivosDoServidor(path.join(RAIZ, 'server')), path.join(RAIZ, 'api', 'index.js')];
  assert.ok(arquivos.length > 20, 'a varredura precisa realmente achar os arquivos');

  const culpados = [];
  for (const arquivo of arquivos) {
    const texto = fs.readFileSync(arquivo, 'utf8');
    for (const m of texto.matchAll(/require\(\s*['"]([^'".][^'"]*)['"]\s*\)/g)) {
      const pacote = m[1].startsWith('@') ? m[1].split('/').slice(0, 2).join('/') : m[1].split('/')[0];
      if (ehPacoteEsm(pacote)) {
        culpados.push(`${path.relative(RAIZ, arquivo)} → ${pacote}`);
      }
    }
  }

  assert.deepStrictEqual(culpados, [],
    'o runtime da Vercel recusa require() de ESM e o processo morre no carregamento:\n       ' +
    culpados.join('\n       '));
});

teste('randomUUID entrega o mesmo formato que o uuid v4 entregava', () => {
  const { randomUUID } = require('node:crypto');
  const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  for (let i = 0; i < 200; i += 1) {
    const id = randomUUID();
    assert.ok(V4.test(id), `id fora do formato v4: ${id}`);
  }
});

teste('os ids continuam únicos', () => {
  const { randomUUID } = require('node:crypto');
  const vistos = new Set();
  for (let i = 0; i < 5000; i += 1) vistos.add(randomUUID());
  assert.strictEqual(vistos.size, 5000, 'colisão de id quebraria chave primária');
});

console.log('\n============================================================');
console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
console.log('============================================================');
if (falharam > 0) process.exit(1);
