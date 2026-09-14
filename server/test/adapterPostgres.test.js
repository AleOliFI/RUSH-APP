// ============================================================
// RUSH RUNNING — Adaptador Postgres
// ------------------------------------------------------------
// O adaptador reescreve SQL. Se ele errar a tradução, o erro não
// aparece como exceção de tipo: aparece como consulta que devolve
// a linha errada, meses depois. Por isso cada regra de tradução é
// verificada aqui, e as que dependem do banco são executadas
// contra um Postgres de verdade.
//
// Sem DATABASE_URL_TEST apontando para um Postgres alcançável, os
// testes de execução são pulados e anunciados como pulados — nunca
// dados como aprovados.
// ============================================================

const assert = require('assert');
const { trocarPlaceholders, traduzir, Database } = require('../database/adapter');

let passaram = 0;
let falharam = 0;
let pulados = 0;

async function teste(nome, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${nome}`);
    passaram += 1;
  } catch (err) {
    console.log(`  ❌ [FAIL] ${nome}`);
    console.log(`     ${err.message}`);
    falharam += 1;
  }
}

(async () => {
  console.log('\n============================================================');
  console.log('📌 ADAPTADOR POSTGRES — TRADUÇÃO DE SQL');
  console.log('============================================================');

  await teste('A1: ? viram $1, $2… na ordem', () => {
    assert.strictEqual(
      trocarPlaceholders('INSERT INTO t (a, b, c) VALUES (?, ?, ?)'),
      'INSERT INTO t (a, b, c) VALUES ($1, $2, $3)',
    );
    assert.strictEqual(
      trocarPlaceholders('SELECT * FROM t WHERE a = ? AND b > ? LIMIT ?'),
      'SELECT * FROM t WHERE a = $1 AND b > $2 LIMIT $3',
    );
  });

  await teste('A2: ? dentro de aspas não é placeholder', () => {
    assert.strictEqual(
      trocarPlaceholders("SELECT * FROM t WHERE nome = 'e aí?' AND id = ?"),
      "SELECT * FROM t WHERE nome = 'e aí?' AND id = $1",
    );
    // Aspas escapadas ('') não podem fechar a string cedo demais.
    assert.strictEqual(
      trocarPlaceholders("SELECT 'a''b?' , ? FROM t"),
      "SELECT 'a''b?' , $1 FROM t",
    );
  });

  await teste('A3: datetime(\'now\') vira texto no mesmo formato do SQLite', () => {
    const s = traduzir("INSERT INTO t (criado) VALUES (datetime('now'))");
    assert.ok(s.includes("'YYYY-MM-DD HH24:MI:SS'"), 'faltou o formato');
    assert.ok(s.includes("now() at time zone 'utc'"), 'precisa ser UTC, como o SQLite');
    assert.ok(!s.includes("datetime('now')"), 'sobrou datetime do SQLite');
  });

  await teste('A4: datetime com deslocamento preserva o intervalo', () => {
    const s = traduzir("SELECT * FROM t WHERE d >= datetime('now', '-7 days')");
    assert.ok(s.includes("interval '-7 day"), `intervalo perdido: ${s}`);
  });

  await teste('A5: INSERT OR IGNORE vira ON CONFLICT DO NOTHING', () => {
    const { Database: _ } = require('../database/adapter');
    const db = Object.create(Database.prototype);
    db.pool = null;
    db._obterCliente = () => null;
    const stmt = db.prepare('INSERT OR IGNORE INTO t (a) VALUES (?)');
    assert.ok(/ON CONFLICT DO NOTHING/i.test(stmt.sql), stmt.sql);
    assert.ok(!/OR\s+IGNORE/i.test(stmt.sql), stmt.sql);
    assert.ok(stmt.sql.includes('$1'));
  });

  // ---------- Execução contra Postgres de verdade ----------
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    console.log('  ⏭️  [PULADO] Execução real: defina DATABASE_URL_TEST para exercer contra Postgres');
    pulados += 1;
  } else {
    const db = new Database(url);

    await teste('A6: exec/prepare/get/all/run contra Postgres real', async () => {
      await db.exec('DROP TABLE IF EXISTS adaptador_teste');
      await db.exec(`CREATE TABLE adaptador_teste (
        id TEXT PRIMARY KEY, nome TEXT NOT NULL, n INTEGER DEFAULT 0,
        criado TEXT DEFAULT (${"to_char((now() at time zone 'utc'), 'YYYY-MM-DD HH24:MI:SS')"})
      )`);

      const r = await db.prepare('INSERT INTO adaptador_teste (id, nome, n) VALUES (?, ?, ?)').run('a', 'Alfa', 1);
      assert.strictEqual(r.changes, 1, 'run deveria reportar 1 linha');

      const linha = await db.prepare('SELECT * FROM adaptador_teste WHERE id = ?').get('a');
      assert.strictEqual(linha.nome, 'Alfa');

      const ausente = await db.prepare('SELECT * FROM adaptador_teste WHERE id = ?').get('nao-existe');
      assert.strictEqual(ausente, undefined, 'get sem resultado deve ser undefined, como no better-sqlite3');

      await db.prepare('INSERT INTO adaptador_teste (id, nome) VALUES (?, ?)').run('b', 'Beta');
      const todas = await db.prepare('SELECT * FROM adaptador_teste ORDER BY id').all();
      assert.strictEqual(todas.length, 2);
    });

    await teste('A7: datetime(\'now\') grava no formato que o JavaScript já lê', async () => {
      const linha = await db.prepare('SELECT criado FROM adaptador_teste WHERE id = ?').get('a');
      assert.match(linha.criado, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, `formato inesperado: ${linha.criado}`);
      // O mesmo texto que o SQLite produzia precisa continuar virando data válida.
      const d = new Date(linha.criado.replace(' ', 'T') + 'Z');
      assert.ok(!Number.isNaN(d.getTime()), 'a data gravada não é parseável');
      assert.ok(Math.abs(Date.now() - d.getTime()) < 120000, 'a data não é "agora"');
    });

    await teste('A8: changes reporta 0 quando o UPDATE não acha nada', async () => {
      const achou = await db.prepare('UPDATE adaptador_teste SET n = 9 WHERE id = ?').run('a');
      assert.strictEqual(achou.changes, 1);
      const nao = await db.prepare('UPDATE adaptador_teste SET n = 9 WHERE id = ?').run('zzz');
      assert.strictEqual(nao.changes, 0, 'o código usa changes===0 para devolver 404');
    });

    await teste('A9: transação desfaz tudo quando o bloco lança', async () => {
      const inserir = db.transaction(async () => {
        await db.prepare('INSERT INTO adaptador_teste (id, nome) VALUES (?, ?)').run('c', 'Gama');
        throw new Error('falha proposital');
      });

      await assert.rejects(inserir(), /falha proposital/);
      const sobrou = await db.prepare('SELECT * FROM adaptador_teste WHERE id = ?').get('c');
      assert.strictEqual(sobrou, undefined, 'o ROLLBACK não desfez a inserção');
    });

    await teste('A10: transação confirma quando o bloco termina bem', async () => {
      const inserir = db.transaction(async () => {
        await db.prepare('INSERT INTO adaptador_teste (id, nome) VALUES (?, ?)').run('d', 'Delta');
        return 'ok';
      });
      assert.strictEqual(await inserir(), 'ok');
      assert.ok(await db.prepare('SELECT * FROM adaptador_teste WHERE id = ?').get('d'));
    });

    await teste('A11: transação aninhada não trava esperando conexão', async () => {
      const interna = db.transaction(async () => {
        await db.prepare('INSERT INTO adaptador_teste (id, nome) VALUES (?, ?)').run('e', 'Épsilon');
      });
      const externa = db.transaction(async () => {
        await interna();
        await db.prepare('INSERT INTO adaptador_teste (id, nome) VALUES (?, ?)').run('f', 'Fi');
      });

      // Sem o reaproveitamento do cliente, isto ficaria pendurado.
      await Promise.race([
        externa(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('travou: transação aninhada')), 5000)),
      ]);
      assert.ok(await db.prepare('SELECT * FROM adaptador_teste WHERE id = ?').get('f'));
    });

    await teste('A12: INSERT OR IGNORE não explode em chave repetida', async () => {
      await db.prepare('INSERT OR IGNORE INTO adaptador_teste (id, nome) VALUES (?, ?)').run('a', 'Repetido');
      const linha = await db.prepare('SELECT nome FROM adaptador_teste WHERE id = ?').get('a');
      assert.strictEqual(linha.nome, 'Alfa', 'IGNORE não pode sobrescrever');
    });

    await db.exec('DROP TABLE IF EXISTS adaptador_teste');
    await db.close();
  }

  console.log('\n============================================================');
  console.log(`   Passaram: ${passaram}   Falharam: ${falharam}   Pulados: ${pulados}`);
  console.log('============================================================');
  if (falharam > 0) process.exit(1);
})().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
