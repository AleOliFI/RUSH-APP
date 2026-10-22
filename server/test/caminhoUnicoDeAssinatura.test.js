// ============================================================
// RUSH RUNNING — Um caminho só para assinar
// ------------------------------------------------------------
// O app tinha dois modais de assinatura. O ProCheckoutModal é o que
// as telas abrem. O UpgradeProModal.jsx, com 310 linhas, não era
// aberto por tela nenhuma — e tinha deixado de funcionar: chamava
// `billing.purchaseMonthly`, `billing.purchaseYearly` e
// `billing.startFreeTrial`, nomes que sumiram quando o pagamento
// passou do RevenueCat para StoreKit e Play Billing direto. Se
// alguém o tivesse aberto, daria erro na cara do usuário.
//
// Código de pagamento morto é pior do que código morto comum:
// quem lê o repositório acha que existe um caminho de compra ali.
//
// Este teste impede a volta: nenhum componente pode chamar função de
// billing que não existe, e o arquivo apagado não pode reaparecer.
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

function arquivosDe(pasta) {
  const achados = [];
  for (const item of fs.readdirSync(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, item.name);
    if (item.isDirectory()) achados.push(...arquivosDe(caminho));
    else if (/\.(ts|tsx|js|jsx)$/.test(item.name)) achados.push(caminho);
  }
  return achados;
}

console.log('\n============================================================');
console.log('📌 UM CAMINHO SÓ PARA ASSINAR');
console.log('============================================================\n');

const SRC = path.join(RAIZ, 'src');
const fontes = arquivosDe(SRC);

teste('T1: o modal morto não voltou ao repositório', () => {
  assert.ok(!fs.existsSync(path.join(SRC, 'components', 'UpgradeProModal.jsx')),
    'UpgradeProModal.jsx foi apagado por estar morto e quebrado');
  const sobrou = fontes.filter((f) => /UpgradeProModal/.test(fs.readFileSync(f, 'utf8')));
  assert.strictEqual(sobrou.length, 0,
    `ainda há referência a ele em: ${sobrou.map((f) => path.relative(RAIZ, f)).join(', ')}`);
});

teste('T2: ninguém chama função de billing que não existe', () => {
  const billing = fs.readFileSync(path.join(SRC, 'services', 'billing.js'), 'utf8');

  // O objeto exportado é `export const billing = { ... }`; pega os
  // nomes de método declarados dentro dele.
  const corpo = /export const billing = \{([\s\S]*?)\n\};/.exec(billing);
  assert.ok(corpo, 'não achei o objeto billing exportado');
  const existentes = new Set(
    [...corpo[1].matchAll(/^\s{2}(?:async\s+)?([A-Za-z_$][\w$]*)\s*[(:]/gm)].map((m) => m[1]),
  );
  assert.ok(existentes.size > 0, 'não consegui ler os métodos de billing');

  const chamadas = [];
  for (const arquivo of fontes) {
    if (arquivo.endsWith(path.join('services', 'billing.js'))) continue;
    const texto = fs.readFileSync(arquivo, 'utf8');
    for (const m of texto.matchAll(/\bbilling\.([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (!existentes.has(m[1])) chamadas.push(`${path.relative(RAIZ, arquivo)} → billing.${m[1]}()`);
    }
  }
  assert.strictEqual(chamadas.length, 0,
    `chamada a método inexistente (quebraria na mão do usuário):\n       ${chamadas.join('\n       ')}`);
});

teste('T3: o modal que sobrou é o que as telas abrem', () => {
  const checkout = path.join(SRC, 'components', 'rush', 'ProCheckoutModal.tsx');
  assert.ok(fs.existsSync(checkout), 'ProCheckoutModal.tsx precisa existir');
  const usado = fontes.some(
    (f) => f !== checkout && /ProCheckoutModal/.test(fs.readFileSync(f, 'utf8')),
  );
  assert.ok(usado, 'o único modal de assinatura também ficou sem quem o abra');
});

console.log('\n============================================================');
console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
console.log('============================================================');
process.exit(falharam > 0 ? 1 : 0);
