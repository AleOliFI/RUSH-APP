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

  // O SQLite depende de um módulo nativo, que só existe onde foi
  // compilado. Na Vercel ele não é — o build avisa que o script de
  // instalação do better-sqlite3 não roda —, então cair aqui em
  // produção significa uma coisa só: DATABASE_URL não chegou ao
  // ambiente. Sem esta mensagem o sintoma seria um erro de módulo
  // nativo, que manda o operador investigar compilação quando o
  // problema é uma variável faltando.
  let Database;
  try {
    ({ Database } = require('./sqlite'));
  } catch (causa) {
    const erro = new Error(
      'DATABASE_URL não está definida e o SQLite não pôde ser carregado. ' +
      'Em produção o app usa Postgres: defina DATABASE_URL no ambiente. ' +
      `(causa original: ${causa.message})`,
    );
    erro.code = 'DATABASE_URL_AUSENTE';
    throw erro;
  }

  return new Database(
    caminhoSqlite || path.join(__dirname, '..', '..', 'data', 'rush_performance.db'),
  );
}

module.exports = { abrirBanco };
