// ============================================================
// RUSH RUNNING — Formatação de tempo e pace
// ------------------------------------------------------------
// Usado pelas rotas de atividades e pelo perfil público: os dois
// devolvem recordes e precisam do mesmo formato, senão a mesma
// corrida aparece como "24:31" em uma tela e "1471" na outra.
// ============================================================

/** Formata segundos em "h:mm:ss" ou "mm:ss". */
function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const sec = totalSeconds % 60;
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Formata segundos por km em "m:ss/km". */
function formatPaceFromSeconds(secondsPerKm) {
  if (!secondsPerKm || !isFinite(secondsPerKm)) return null;
  const m = Math.floor(secondsPerKm / 60);
  const sec = Math.round(secondsPerKm % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}/km`;
}

module.exports = { formatDuration, formatPaceFromSeconds };
