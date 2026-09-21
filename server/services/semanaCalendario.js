// ============================================================
// RUSH RUNNING — Chave de semana do calendário
// ------------------------------------------------------------
// As estatísticas agrupavam atividades por semana com
// `strftime('%Y-W%W', date)`. Essa função é do SQLite: o Postgres
// não a tem, e a rota dava 500 em produção enquanto funcionava
// perfeitamente em desenvolvimento — o tipo de defeito que
// atravessa a suíte inteira sem ser notado, porque os testes
// rodam no banco que perdoa.
//
// Traduzir `strftime` no adaptador pareceria a saída óbvia, e é
// uma armadilha: nenhum formato do Postgres bate com o `%W` do
// SQLite. `WW` conta a semana 1 a partir de 1º de janeiro; `IW`
// segue a ISO 8601; o `%W` começa a contar na primeira segunda e
// chama de semana 00 os dias antes dela. Traduzir para qualquer
// um faria desenvolvimento e produção agruparem diferente, sem
// erro nenhum aparecendo — pior que o 500, porque ninguém
// descobre.
//
// Então a regra vive aqui, em JavaScript, e vale igual nos dois
// bancos. O teste compara esta função com o strftime do SQLite de
// verdade, data a data: o objetivo não é "uma semana qualquer", é
// exatamente a mesma que já era usada.
// ============================================================

/**
 * Chave de semana no formato do `strftime('%Y-W%W', date)` do SQLite.
 *
 * @param {string} data Data em 'YYYY-MM-DD' (ou ISO com hora; só a data conta).
 * @returns {string|null} 'YYYY-Www', ou null se a data não for legível.
 */
function chaveDaSemana(data) {
  if (!data) return null;

  const texto = String(data).slice(0, 10);
  const [ano, mes, dia] = texto.split('-').map(Number);
  if (!Number.isFinite(ano) || !Number.isFinite(mes) || !Number.isFinite(dia)) return null;

  // Tudo em UTC. `new Date('YYYY-MM-DD')` é meia-noite UTC, mas
  // getDay() responde no fuso local — a oeste de Greenwich isso
  // devolve o dia anterior, e a atividade cairia na semana errada.
  const momento = Date.UTC(ano, mes - 1, dia);
  if (Number.isNaN(momento)) return null;

  const primeiroDeJaneiro = Date.UTC(ano, 0, 1);
  const diaDoAno = Math.floor((momento - primeiroDeJaneiro) / 86400000) + 1;

  // getUTCDay() dá 0 para domingo; o %W conta a semana a partir da
  // segunda, então o domingo vira 6.
  const diaDaSemana = (new Date(momento).getUTCDay() + 6) % 7;

  // Semana 00 são os dias antes da primeira segunda-feira do ano.
  const semana = Math.floor((diaDoAno + 6 - diaDaSemana) / 7);

  return `${ano}-W${String(semana).padStart(2, '0')}`;
}

module.exports = { chaveDaSemana };
