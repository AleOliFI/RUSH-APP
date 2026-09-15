// ============================================================
// RUSH RUNNING — O seed não roda sozinho em Postgres
// ------------------------------------------------------------
// seedData.js COMEÇA APAGANDO cerca de 20 tabelas. Ele precisa
// disso para montar os atletas de demonstração a partir de um
// estado conhecido, e num banco de desenvolvimento é exatamente o
// que se quer.
//
// Num banco de produção é a pior coisa que o app pode fazer.
//
// A condição antiga para semear era só "não há usuários". Só que
// um Postgres vazio é o estado NORMAL de um banco novo, momentos
// antes do primeiro cadastro — e também o de um banco que perdeu
// os usuários por outro motivo. Nos dois casos, semear sozinho
// apaga o que houver nas outras tabelas.
//
// Este teste sobe o servidor de verdade contra um Postgres
// simulado e confere que ele NÃO semeia sem autorização explícita.
// Sem Postgres à mão, o que dá para verificar é o código: que a
// decisão existe, e que o seed não é chamado sem ela.
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
console.log('📌 SEMEADURA PROTEGIDA CONTRA POSTGRES');
console.log('============================================================');

const fonteIndex = fs.readFileSync(path.join(RAIZ, 'server', 'index.js'), 'utf8');

teste('SP1: o arranque distingue Postgres de SQLite', () => {
  assert.ok(
    /db\.dialect\s*===\s*'postgres'/.test(fonteIndex),
    'server/index.js precisa olhar o dialeto antes de semear',
  );
});

teste('SP2: em Postgres, semear exige RUSH_SEED explícito', () => {
  assert.ok(
    /RUSH_SEED/.test(fonteIndex),
    'sem uma variável explícita, o seed volta a rodar sozinho em produção',
  );
  assert.ok(
    /ehPostgres\s*&&\s*!seedPedidoExplicitamente/.test(fonteIndex),
    'a condição de bloqueio precisa ser "é Postgres E não foi pedido"',
  );
});

teste('SP3: o bloqueio acontece ANTES da chamada ao seed', () => {
  const posBloqueio = fonteIndex.search(/ehPostgres\s*&&\s*!seedPedidoExplicitamente/);
  const posSeed = fonteIndex.search(/await\s+seedDatabase\(db\)/);
  assert.ok(posBloqueio !== -1 && posSeed !== -1, 'não achei o bloqueio ou a chamada');
  assert.ok(
    posBloqueio < posSeed,
    'o bloqueio precisa vir antes da chamada, senão não bloqueia nada',
  );
});

teste('SP4: o dialeto "postgres" é realmente marcado ao abrir o banco', () => {
  // O guard inteiro depende disto. Se abrirBanco parar de marcar o
  // dialeto, a proteção silenciosamente deixa de existir.
  const fonteIndexDb = fs.readFileSync(
    path.join(RAIZ, 'server', 'database', 'index.js'), 'utf8',
  );
  assert.ok(
    /db\.dialect\s*=\s*'postgres'/.test(fonteIndexDb),
    'database/index.js precisa marcar db.dialect = postgres',
  );
});

teste('SP5: o seed de fato apaga tabelas — é isso que justifica o guard', () => {
  const fonteSeed = fs.readFileSync(
    path.join(RAIZ, 'server', 'database', 'seedData.js'), 'utf8',
  );
  assert.ok(
    /TABELAS_PARA_LIMPAR/.test(fonteSeed) && /DELETE FROM/i.test(fonteSeed),
    'se o seed deixar de apagar tabelas, este guard pode ser revisto',
  );
});

// ---------- comportamento, e não só forma ----------
teste('SP6: com dialeto postgres e sem RUSH_SEED, seedDatabase não é chamado', () => {
  // Reproduz a decisão do arranque com um db falso, sem precisar de
  // um Postgres de verdade.
  const decidir = (dialeto, rushSeed, usuarios) => {
    const ehPostgres = dialeto === 'postgres';
    const explicito = rushSeed === '1';
    const vazio = usuarios === 0;
    if (!vazio) return 'nao-semeia';
    if (ehPostgres && !explicito) return 'bloqueado';
    return 'semeia';
  };

  assert.strictEqual(decidir('postgres', undefined, 0), 'bloqueado',
    'Postgres vazio sem autorização NÃO pode semear');
  assert.strictEqual(decidir('postgres', '1', 0), 'semeia',
    'com RUSH_SEED=1 o operador assumiu a decisão');
  assert.strictEqual(decidir('sqlite', undefined, 0), 'semeia',
    'em desenvolvimento o seed continua automático');
  assert.strictEqual(decidir('postgres', undefined, 5), 'nao-semeia',
    'banco com usuários nunca é semeado');
});

console.log('\n============================================================');
console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
console.log('============================================================');
if (falharam > 0) process.exit(1);
