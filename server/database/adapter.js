// ============================================================
// RUSH RUNNING — Adaptador SQLite → Postgres
// ------------------------------------------------------------
// O app nasceu sobre better-sqlite3, que é síncrono: as 399
// chamadas de banco espalhadas por 16 arquivos fazem
// db.prepare(sql).get(...) e recebem a linha na hora.
//
// Postgres é rede, e rede em Node é assíncrona. Não há como
// manter a chamada síncrona — mas há como manter a *forma* dela.
// Este adaptador expõe exatamente a mesma superfície
// (prepare/get/all/run/exec/transaction/pragma), só que devolvendo
// promessas. Assim a mudança em cada ponto de chamada é
// acrescentar `await`, e não reescrever a consulta.
//
// O que ele traduz sozinho, para que nenhuma das 319 consultas
// precise ser editada:
//   ?              → $1, $2, …  (respeitando aspas e literais)
//   datetime('now')→ o mesmo texto 'YYYY-MM-DD HH:MM:SS' em UTC,
//                    para que todo o JavaScript que já lê essas
//                    datas continue lendo a mesma coisa
//   INSERT OR IGNORE / OR REPLACE → ON CONFLICT
//
// O que ele NÃO esconde, de propósito: tipos. Booleanos gravados
// como 0/1 e ids TEXT continuam assim no Postgres, porque mudar
// isso mexeria na leitura de todo o frontend.
// ============================================================

const { Pool, types } = require('pg');

// ------------------------------------------------------------
// O node-postgres devolve bigint como STRING, para não perder
// precisão acima de 2^53. Só que COUNT(*) é bigint, e o app compara
// contagens com número: `count === 0` vira `'0' === 0`, que é falso.
// Esse é o tipo de erro que não lança — só faz o seed não rodar e
// um `if` nunca entrar.
//
// Contagens deste app não chegam perto de 2^53, então ler int8 como
// número é seguro e devolve o mesmo comportamento do SQLite.
// ------------------------------------------------------------
const OID_INT8 = 20;
const OID_NUMERIC = 1700;
types.setTypeParser(OID_INT8, (v) => (v === null ? null : Number(v)));
// numeric também vem como string, pela mesma razão. As colunas do app
// são REAL/INTEGER, mas AVG() e SUM() sobre elas podem devolver numeric.
types.setTypeParser(OID_NUMERIC, (v) => (v === null ? null : Number(v)));

/**
 * Troca os `?` posicionais por `$n`, sem tocar nos que estão
 * dentro de aspas. Uma string como 'a?b' não é placeholder.
 */
function trocarPlaceholders(sql) {
  let saida = '';
  let n = 0;
  let aspasSimples = false;
  let aspasDuplas = false;

  for (let i = 0; i < sql.length; i += 1) {
    const c = sql[i];

    if (c === "'" && !aspasDuplas) {
      // '' dentro de string é aspas escapada, não fim da string.
      if (aspasSimples && sql[i + 1] === "'") {
        saida += "''";
        i += 1;
        continue;
      }
      aspasSimples = !aspasSimples;
      saida += c;
      continue;
    }

    if (c === '"' && !aspasSimples) {
      aspasDuplas = !aspasDuplas;
      saida += c;
      continue;
    }

    if (c === '?' && !aspasSimples && !aspasDuplas) {
      n += 1;
      saida += `$${n}`;
      continue;
    }

    saida += c;
  }

  return saida;
}

/**
 * datetime('now') no SQLite devolve TEXTO 'YYYY-MM-DD HH:MM:SS' em
 * UTC. Manter exatamente esse formato é o que permite não mexer em
 * nenhuma das telas nem em nenhum comparador de data do backend.
 */
const AGORA_TEXTO = "to_char((now() at time zone 'utc'), 'YYYY-MM-DD HH24:MI:SS')";

function traduzir(sql) {
  let s = sql;

  // datetime('now') e datetime('now', '-7 days') / '+1 hour' etc.
  s = s.replace(/datetime\(\s*'now'\s*,\s*'([+-]?\d+)\s+(\w+?)s?'\s*\)/gi,
    (_, qtd, unidade) =>
      `to_char((now() at time zone 'utc') + interval '${qtd} ${unidade}', 'YYYY-MM-DD HH24:MI:SS')`);
  s = s.replace(/datetime\(\s*'now'\s*\)/gi, AGORA_TEXTO);

  // date('now') → só a data.
  s = s.replace(/\bdate\(\s*'now'\s*\)/gi, "to_char((now() at time zone 'utc'), 'YYYY-MM-DD')");

  // INSERT OR IGNORE / OR REPLACE não existem no Postgres.
  s = s.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO');
  s = s.replace(/\bINSERT\s+OR\s+REPLACE\s+INTO\b/gi, 'INSERT INTO');

  return s;
}

/** Marca consultas que precisam do ON CONFLICT DO NOTHING ao final. */
function precisaIgnorarConflito(sql) {
  return /\bINSERT\s+OR\s+IGNORE\b/i.test(sql);
}

class Statement {
  constructor(pool, sql, obterCliente) {
    this.sqlOriginal = sql;
    this.pool = pool;
    this.obterCliente = obterCliente;

    let traduzido = traduzir(sql);
    if (precisaIgnorarConflito(sql) && !/ON\s+CONFLICT/i.test(traduzido)) {
      traduzido = `${traduzido.replace(/;\s*$/, '')} ON CONFLICT DO NOTHING`;
    }
    this.sql = trocarPlaceholders(traduzido);
  }

  async _executar(params) {
    const cliente = this.obterCliente();
    const alvo = cliente || this.pool;
    return alvo.query(this.sql, params);
  }

  /** Uma linha, ou undefined — como o better-sqlite3. */
  async get(...params) {
    const r = await this._executar(params);
    return r.rows[0];
  }

  async all(...params) {
    const r = await this._executar(params);
    return r.rows;
  }

  /**
   * Escrita. `changes` existe porque o código o consulta para saber
   * se um UPDATE encontrou alguma linha.
   */
  async run(...params) {
    const r = await this._executar(params);
    return { changes: r.rowCount ?? 0, rows: r.rows };
  }
}

// ------------------------------------------------------------
// TLS da conexão com o banco.
//
// Em localhost não há TLS, e exigi-lo quebraria os testes.
//
// Fora dele a verificação fica ligada — sempre. O Supabase assina
// o certificado do pooler com uma CA própria, que não está entre
// as raízes públicas do Node: sem ela a conexão morre com
// SELF_SIGNED_CERT_IN_CHAIN. A saída fácil seria `rejectUnauthorized:
// false`, que mantém o tráfego criptografado mas deixa de conferir
// COM QUEM se está falando. Aqui a CA é fixada em vez disso.
//
// A CA do Supabase só entra quando o destino é do Supabase. Para
// qualquer outro provedor valem as raízes públicas de sempre, senão
// trocar de banco quebraria a conexão por um motivo que ninguém
// adivinharia.
// ------------------------------------------------------------
function tlsPara(connectionString) {
  const url = connectionString || '';
  if (/localhost|127\.0\.0\.1/.test(url)) return false;
  if (/supabase\.(com|co)\b/.test(url)) {
    const { SUPABASE_ROOT_2021_CA } = require('./certificados/supabaseRootCa');
    return { ca: SUPABASE_ROOT_2021_CA, rejectUnauthorized: true };
  }
  return { rejectUnauthorized: true };
}

class Database {
  constructor(connectionString, opcoes = {}) {
    this.pool = new Pool({
      connectionString,
      // Provedores gerenciados (Neon, Supabase, Vercel) exigem TLS.
      // Em localhost não há TLS e forçá-lo quebraria o teste.
      ssl: tlsPara(connectionString),
      max: opcoes.max ?? 5,
    });

    // Cliente da transação em curso, se houver. Enquanto estiver
    // definido, toda consulta vai por ele — senão a transação
    // abriria em uma conexão e as consultas em outra, e o BEGIN
    // não valeria para nada.
    this._clienteTransacao = null;
    this._obterCliente = () => this._clienteTransacao;
  }

  prepare(sql) {
    return new Statement(this.pool, sql, this._obterCliente);
  }

  async exec(sql) {
    const cliente = this._clienteTransacao;
    const alvo = cliente || this.pool;
    await alvo.query(traduzir(sql));
  }

  /**
   * Mesma assinatura do better-sqlite3 — devolve uma função que roda
   * o bloco inteiro em uma transação — porém assíncrona.
   *
   * Transações aninhadas reaproveitam o cliente já aberto em vez de
   * abrir outra, que travaria esperando uma conexão do pool.
   */
  transaction(fn) {
    return async (...args) => {
      if (this._clienteTransacao) return fn(...args);

      const cliente = await this.pool.connect();
      this._clienteTransacao = cliente;
      try {
        await cliente.query('BEGIN');
        const resultado = await fn(...args);
        await cliente.query('COMMIT');
        return resultado;
      } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        this._clienteTransacao = null;
        cliente.release();
      }
    };
  }

  /** PRAGMA é do SQLite. No Postgres não há equivalente nem necessidade. */
  pragma() {
    return null;
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = { Database, trocarPlaceholders, traduzir, tlsPara };
