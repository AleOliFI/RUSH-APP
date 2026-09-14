// ============================================================
// RUSH RUNNING — Adaptador SQLite
// ------------------------------------------------------------
// Espelho do adaptador Postgres: mesma superfície, mesmas
// promessas. Existe para que o app fale com UMA interface só, e a
// escolha do banco seja uma variável de ambiente em vez de uma
// reescrita.
//
// Por que não usar o better-sqlite3 direto durante a migração: o
// db.transaction() dele recusa um callback que devolve promessa
// ("Transaction function cannot return a promise"). Como as 16
// transações do app precisam ser assíncronas para funcionar no
// Postgres, aqui elas são conduzidas na mão, com BEGIN/COMMIT.
// ============================================================

const BetterSqlite3 = require('better-sqlite3');

class Statement {
  constructor(stmt) {
    this.stmt = stmt;
  }

  // Assíncronas de propósito: quem chama não deve saber qual banco
  // está atrás. `await` sobre um valor pronto não custa nada.
  async get(...params) {
    return this.stmt.get(...params);
  }

  async all(...params) {
    return this.stmt.all(...params);
  }

  async run(...params) {
    const r = this.stmt.run(...params);
    return { changes: r.changes, lastInsertRowid: r.lastInsertRowid };
  }
}

class Database {
  constructor(caminho) {
    this.raw = new BetterSqlite3(caminho);
    this.dialect = 'sqlite';
    this._profundidade = 0;
  }

  prepare(sql) {
    return new Statement(this.raw.prepare(sql));
  }

  async exec(sql) {
    this.raw.exec(sql);
  }

  /**
   * Transação assíncrona conduzida na mão.
   *
   * O aninhamento usa SAVEPOINT porque BEGIN dentro de BEGIN é erro
   * no SQLite — e há transações que chamam outras (a migração de
   * activities é uma delas).
   */
  transaction(fn) {
    return async (...args) => {
      const aninhada = this._profundidade > 0;
      const ponto = `rush_sp_${this._profundidade}`;

      this.raw.exec(aninhada ? `SAVEPOINT ${ponto}` : 'BEGIN');
      this._profundidade += 1;

      try {
        const resultado = await fn(...args);
        this.raw.exec(aninhada ? `RELEASE ${ponto}` : 'COMMIT');
        return resultado;
      } catch (err) {
        try {
          this.raw.exec(aninhada ? `ROLLBACK TO ${ponto}` : 'ROLLBACK');
        } catch (_) {
          // Transação já desfeita por erro do próprio SQLite.
        }
        throw err;
      } finally {
        this._profundidade -= 1;
      }
    };
  }

  pragma(texto) {
    return this.raw.pragma(texto);
  }

  async close() {
    this.raw.close();
  }
}

module.exports = { Database };
