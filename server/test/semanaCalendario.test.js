// ============================================================
// RUSH RUNNING — Agrupar por semana sem strftime
// ------------------------------------------------------------
// `GET /api/activities/stats/summary` agrupava atividades com
// `strftime('%Y-W%W', date)` e dava 500 em PRODUÇÃO:
//
//   error: function strftime(unknown, text) does not exist
//   code: 42883
//
// `strftime` é do SQLite. O adaptador traduz `datetime('now')`,
// `date('now')` e `INSERT OR IGNORE/REPLACE` — não `strftime`.
// Como desenvolvimento roda SQLite e as suítes também, a rota
// passava em tudo e quebrava só onde importa. Este teste existe
// para que essa assimetria não volte.
//
// O agrupamento foi para JavaScript. A exigência não é "uma
// semana qualquer": é EXATAMENTE a mesma que o strftime dava,
// senão a correção trocaria um erro visível por números
// diferentes — que ninguém descobre.
//
// Por isso o teste compara contra o strftime do SQLite de
// verdade, data a data, em vez de contra a minha ideia de como
// ele funciona.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { chaveDaSemana } = require('../services/semanaCalendario');

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
console.log('📌 SEMANA DO CALENDÁRIO, SEM STRFTIME');
console.log('============================================================\n');

teste('a chave bate com o strftime do SQLite em 6 anos, dia a dia', () => {
  const db = new Database(':memory:');
  const consulta = db.prepare("SELECT strftime('%Y-W%W', ?) as semana");

  const divergentes = [];
  let conferidas = 0;

  // Seis anos cobrem bissextos e todas as combinações de dia da
  // semana na virada de ano — que é onde o %W tem o comportamento
  // menos óbvio (a semana 00, antes da primeira segunda-feira).
  for (let t = Date.UTC(2023, 0, 1); t <= Date.UTC(2028, 11, 31); t += 86400000) {
    const data = new Date(t).toISOString().slice(0, 10);
    const doSqlite = consulta.get(data).semana;
    const nosso = chaveDaSemana(data);
    conferidas += 1;
    if (doSqlite !== nosso && divergentes.length < 5) {
      divergentes.push(`${data}: sqlite=${doSqlite} nosso=${nosso}`);
    }
  }
  db.close();

  assert.ok(conferidas > 2000, `varredura curta demais: ${conferidas} datas`);
  assert.deepStrictEqual(divergentes, [],
    `a chave precisa ser idêntica à do strftime:\n       ${divergentes.join('\n       ')}`);
});

teste('a semana 00 existe, e é onde o %W é traiçoeiro', () => {
  // 2026 começa numa quinta: os dias 1 a 4 vêm antes da primeira
  // segunda-feira e pertencem à semana 00.
  assert.strictEqual(chaveDaSemana('2026-01-01'), '2026-W00');
  assert.strictEqual(chaveDaSemana('2026-01-04'), '2026-W00');
  assert.strictEqual(chaveDaSemana('2026-01-05'), '2026-W01', 'a primeira segunda abre a semana 01');
});

teste('data ilegível vira null em vez de quebrar o relatório', () => {
  for (const ruim of [null, undefined, '', 'nao-e-data', '2026-13-99x']) {
    const r = chaveDaSemana(ruim);
    assert.ok(r === null || /^\d{4}-W\d{2}$/.test(r), `entrada ${JSON.stringify(ruim)} devolveu ${r}`);
  }
});

teste('a chave ordena como texto na ordem cronológica', () => {
  // A consulta antiga terminava em ORDER BY week. O padStart existe
  // para isto: sem ele, 'W9' viria depois de 'W10'.
  const semanas = ['2026-01-05', '2026-03-10', '2026-11-30', '2026-01-01']
    .map(chaveDaSemana)
    .sort((a, b) => a.localeCompare(b));
  assert.deepStrictEqual(semanas, ['2026-W00', '2026-W01', '2026-W10', '2026-W48']);
});

teste('nenhuma rota usa strftime — o Postgres não a tem', () => {
  const achados = [];
  for (const pasta of ['routes', 'services', 'agent']) {
    const dir = path.join(RAIZ, 'server', pasta);
    if (!fs.existsSync(dir)) continue;
    for (const arquivo of fs.readdirSync(dir)) {
      if (!arquivo.endsWith('.js')) continue;
      const texto = fs.readFileSync(path.join(dir, arquivo), 'utf8');
      // Os comentários que explicam o problema citam o nome, e o
      // JSDoc do helper também. Só conta uso real, então os dois
      // tipos de comentário saem antes — bloco e linha.
      const semComentarios = texto
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
      if (/strftime\s*\(/.test(semComentarios)) {
        achados.push(`${pasta}/${arquivo}`);
      }
    }
  }
  assert.deepStrictEqual(achados, [],
    `strftime é do SQLite e dá 42883 em Postgres; achei em: ${achados.join(', ')}`);
});

console.log('\n============================================================');
console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
console.log('============================================================');
if (falharam > 0) process.exit(1);
