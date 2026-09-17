#!/usr/bin/env node
// ============================================================
// RUSH RUNNING — Executa TODAS as suítes de teste
// ------------------------------------------------------------
// `npm test` rodava uma suíte só: masterE2EAcceptance. As outras
// vinte e tantas existiam, passavam, e não protegiam nada — porque
// nenhum processo automático as chamava. Um teste que ninguém roda
// é documentação, não rede de segurança.
//
// Isso importa especialmente para os testes escritos depois de um
// incidente: o do arranque sem banco, o do ESM no servidor, o do
// TLS, o das rotas da navegação. Todos existem para impedir que um
// defeito específico volte, e todos eram invisíveis para `npm test`.
//
// Roda uma por vez, em processos separados, porque várias sobem
// servidor e banco próprios e disputariam porta se corressem juntas.
// Não para na primeira falha: o relatório completo vale mais do que
// o primeiro erro, já que uma mudança costuma quebrar várias suítes
// pelo mesmo motivo.
// ============================================================

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PASTA = path.join(__dirname, '..', 'server', 'test');
const TEMPO_LIMITE_MS = 300000;

const suites = fs
  .readdirSync(PASTA)
  .filter((nome) => nome.endsWith('.test.js'))
  .sort();

if (suites.length === 0) {
  console.error('Nenhuma suíte encontrada em server/test — isso é um erro, não um sucesso.');
  process.exit(1);
}

console.log(`\nRodando ${suites.length} suítes de server/test\n`);

const falharam = [];
const comeco = Date.now();

for (const suite of suites) {
  const inicio = Date.now();
  const r = spawnSync(process.execPath, [path.join(PASTA, suite)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: TEMPO_LIMITE_MS,
  });
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);

  // `status` é null quando o processo morreu por sinal — estouro de
  // tempo, por exemplo. Tratar isso como sucesso esconderia justamente
  // a suíte que travou.
  const passou = r.status === 0;
  if (passou) {
    console.log(`  ✅ ${suite}  (${segundos}s)`);
  } else {
    const motivo = r.status === null ? `morreu por ${r.signal || 'sinal desconhecido'}` : `saiu com ${r.status}`;
    console.log(`  ❌ ${suite}  (${segundos}s, ${motivo})`);
    falharam.push({ suite, saida: (r.stdout || '').toString() + (r.stderr || '').toString() });
  }
}

const total = ((Date.now() - comeco) / 1000).toFixed(1);
console.log(`\n${'='.repeat(60)}`);
console.log(`   ${suites.length - falharam.length}/${suites.length} suítes passaram em ${total}s`);
console.log('='.repeat(60));

for (const { suite, saida } of falharam) {
  console.log(`\n--- ${suite} ---`);
  console.log(saida.split('\n').slice(-25).join('\n'));
}

process.exit(falharam.length > 0 ? 1 : 0);
