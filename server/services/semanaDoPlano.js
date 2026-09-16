// ============================================================
// RUSH RUNNING — Onde cada dia cai dentro do plano
// ------------------------------------------------------------
// Uma sessão de treino vive na chave (plan_id, week_number,
// day_of_week). Não há coluna de data: a data é derivada do
// início do plano.
//
// Isso significa que quem GRAVA uma sessão e quem a PROCURA
// precisam calcular a semana e o dia exatamente do mesmo jeito.
// Um erro de um dia aqui não lança exceção nenhuma — a sessão
// simplesmente não aparece para o atleta, e ninguém descobre por
// quê.
//
// Por isso a conta mora num lugar só. A rota /training/my-plan e
// a prescrição do treinador chamam esta função, e não uma cópia
// dela.
// ============================================================

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Converte 'YYYY-MM-DD' (ou um Date) em meia-noite LOCAL.
 *
 * `new Date('2026-09-08')` é interpretado como meia-noite UTC, mas
 * `getDay()` responde no fuso local. Num servidor a oeste de
 * Greenwich, essa combinação devolve o dia anterior — a sessão de
 * terça seria gravada como segunda. O Vercel roda em UTC e o erro
 * não aparece lá, mas ele não depende de nós para existir.
 *
 * Montando a data pelos componentes, os dois lados da conta ficam
 * no mesmo fuso e o dia da semana é o do calendário de quem lê.
 */
function meiaNoiteLocal(valor) {
  if (valor instanceof Date) {
    return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  const d = new Date(valor);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Semana e dia do plano correspondentes a uma data.
 *
 * @param {string} dataInicio  `start_date` do assigned_plan (YYYY-MM-DD)
 * @param {number} totalSemanas `duration_weeks` do plano
 * @param {Date|string} [quando] A data em questão; hoje, por padrão.
 * @returns {{week_number: number, day_of_week: number}}
 *   `day_of_week` segue a convenção do schema: 1 = segunda … 7 = domingo.
 */
function posicaoNoPlano(dataInicio, totalSemanas, quando = new Date()) {
  const inicio = meiaNoiteLocal(dataInicio);
  const data = meiaNoiteLocal(quando);

  // Com as duas pontas em meia-noite local, a divisão dá dias
  // inteiros e o horário do dia não interfere.
  const dias = Math.round((data - inicio) / UM_DIA_MS);

  // Antes do início, a semana 1; depois do fim, a última. O plano
  // não tem semana 0 nem semana 13 — o CHECK da tabela recusaria.
  const semana = Math.max(1, Math.min(Math.floor(dias / 7) + 1, Number(totalSemanas) || 1));

  // getDay() devolve 0 para domingo; o schema usa 7.
  const dia = data.getDay() || 7;

  return { week_number: semana, day_of_week: dia };
}

module.exports = { posicaoNoPlano, meiaNoiteLocal };
