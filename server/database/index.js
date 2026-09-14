// ============================================================
// RUSH RUNNING — Escolha do banco
// ------------------------------------------------------------
// Uma interface, duas implementações. Com DATABASE_URL apontando
// para um Postgres, o app usa Postgres; sem ela, usa o arquivo
// SQLite de sempre.
//
// A regra é essa e só essa, para que o mesmo código rode nos dois
// lados sem ramificação espalhada pelas rotas.
// ============================================================

const path = require('path');

/**
 * @param {string} [caminhoSqlite] Arquivo a usar quando não houver DATABASE_URL.
 */
function abrirBanco(caminhoSqlite) {
  const url = process.env.DATABASE_URL;

  if (url && /^postgres(ql)?:\/\//.test(url)) {
    const { Database } = require('./adapter');
    const db = new Database(url);
    db.dialect = 'postgres';
    return db;
  }

  const { Database } = require('./sqlite');
  return new Database(
    caminhoSqlite || path.join(__dirname, '..', '..', 'data', 'rush_performance.db'),
  );
}

module.exports = { abrirBanco };
