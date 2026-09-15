// ============================================================
// RUSH RUNNING — Zona de privacidade do percurso
// ------------------------------------------------------------
// Um traçado de GPS publicado começa e termina onde o atleta mora.
// Quem vê a corrida descobre o endereço — e não é preciso ser
// mal-intencionado para reparar nisso.
//
// A zona é um ponto e um raio. O que cai dentro dela é APAGADO
// antes de o traçado sair para outra pessoa. O dado bruto continua
// no banco: é do atleta, e ele precisa dele para ver a própria
// corrida inteira. O recorte acontece na leitura.
//
// Duas decisões que valem explicação:
//
// 1. Recortamos as PONTAS, não os pontos soltos. Se o atleta passa
//    de novo perto de casa no meio do percurso, aquele trecho
//    também é removido — mas o que garante a proteção é remover
//    todo o começo até a primeira saída da zona, e todo o fim a
//    partir da última entrada. Apagar só os pontos de dentro
//    deixaria a linha reta "apontando" para o centro da zona.
//
// 2. A distância usa a mesma Haversine do resto do app, para que
//    o raio configurado signifique a mesma coisa em todo lugar.
// ============================================================

const RAIO_TERRA_M = 6371000;

/** Distância em metros entre dois pontos {lat, lon}. */
function distanciaMetros(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Remove as pontas do traçado que caem dentro da zona.
 *
 * @param {Array<{lat:number, lon:number}>} pontos
 * @param {{lat:number, lon:number, radius_m:number}|null} zona
 * @returns {{points: Array, removed_start: number, removed_end: number, fully_hidden: boolean}}
 */
function recortarTracado(pontos, zona) {
  const vazio = { points: [], removed_start: 0, removed_end: 0, fully_hidden: false };
  if (!Array.isArray(pontos) || pontos.length === 0) return vazio;
  if (!zona || !Number.isFinite(zona.lat) || !Number.isFinite(zona.lon)) {
    return { points: pontos, removed_start: 0, removed_end: 0, fully_hidden: false };
  }

  const raio = Number(zona.radius_m) || 500;
  const dentro = (p) => distanciaMetros(p, zona) <= raio;

  // Primeiro ponto fora da zona.
  let inicio = 0;
  while (inicio < pontos.length && dentro(pontos[inicio])) inicio += 1;

  // A corrida inteira aconteceu dentro da zona: não há o que mostrar.
  if (inicio >= pontos.length) {
    return { points: [], removed_start: pontos.length, removed_end: 0, fully_hidden: true };
  }

  // Último ponto fora da zona.
  let fim = pontos.length - 1;
  while (fim > inicio && dentro(pontos[fim])) fim -= 1;

  return {
    points: pontos.slice(inicio, fim + 1),
    removed_start: inicio,
    removed_end: pontos.length - 1 - fim,
    fully_hidden: false,
  };
}

/** Lê a zona do atleta, ou null se ele não configurou nenhuma. */
async function lerZona(db, userId) {
  try {
    const linha = await db
      .prepare('SELECT lat, lon, radius_m, label FROM privacy_zones WHERE user_id = ?')
      .get(userId);
    return linha || null;
  } catch (_) {
    // Tabela ausente em bancos antigos: sem zona configurada.
    return null;
  }
}

/**
 * Aplica a zona ao traçado quando quem lê NÃO é o dono.
 *
 * O dono vê a própria corrida inteira — esconder dele seria esconder
 * o dado dele mesmo, e ele não conseguiria conferir o percurso.
 */
async function aplicarZona(db, { donoId, leitorId, pontos }) {
  if (!Array.isArray(pontos) || pontos.length === 0) {
    return { points: pontos || [], trimmed: false, fully_hidden: false };
  }
  if (donoId === leitorId) {
    return { points: pontos, trimmed: false, fully_hidden: false };
  }

  const zona = await lerZona(db, donoId);
  if (!zona) return { points: pontos, trimmed: false, fully_hidden: false };

  const r = recortarTracado(pontos, zona);
  return {
    points: r.points,
    trimmed: r.removed_start > 0 || r.removed_end > 0,
    fully_hidden: r.fully_hidden,
  };
}

module.exports = { recortarTracado, distanciaMetros, lerZona, aplicarZona };
