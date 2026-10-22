// ============================================================
// RUSH RUNNING — Quem tem acesso PRO
// ------------------------------------------------------------
// A mesma pergunta era respondida em três lugares, de três jeitos
// diferentes:
//
//   /api/users/me        — PRO para quem tem tier 'pro', mesmo com a
//                          assinatura vencida; e para qualquer um com
//                          status 'active', mesmo no plano grátis.
//   /api/subscriptions   — PRO só com tier pro/lifetime E status
//                          'active' (ou teste dentro do prazo).
//   AuthContext (cliente) — PRO para tier pro/lifetime, ignorando o
//                          status por completo.
//
// Na prática: uma assinatura cancelada continuava liberando o app
// porque o cliente decidia sozinho, a partir de um objeto guardado no
// localStorage. Quem cancelava não perdia nada.
//
// A regra agora mora aqui, e só aqui. O servidor responde `is_pro`; o
// cliente obedece, não recalcula.
// ============================================================

const CARGOS_COM_ACESSO = ['coach', 'owner', 'admin'];
const PLANOS_PAGOS = ['pro', 'lifetime'];

/**
 * O usuário tem acesso PRO neste instante?
 *
 * @param {object} usuario Linha da tabela `users` (role, subscription_tier,
 *   subscription_status, trial_ends_at).
 * @param {Date} [agora] Momento de referência — injetável para teste.
 */
function ehPro(usuario, agora = new Date()) {
  if (!usuario) return false;

  // Treinador, dono e administrador usam o app para trabalhar.
  if (CARGOS_COM_ACESSO.includes(usuario.role)) return true;

  if (!PLANOS_PAGOS.includes(usuario.subscription_tier)) return false;

  if (usuario.subscription_status === 'active') return true;

  // Teste gratuito: vale enquanto não vence. Sem data, não vale.
  if (usuario.subscription_status === 'trial' && usuario.trial_ends_at) {
    const fim = new Date(usuario.trial_ends_at);
    return !Number.isNaN(fim.getTime()) && fim > agora;
  }

  return false;
}

/** Dias que ainda restam do teste gratuito (0 quando não há teste válido). */
function diasDeTesteRestantes(usuario, agora = new Date()) {
  if (!usuario || usuario.subscription_status !== 'trial' || !usuario.trial_ends_at) return 0;
  const fim = new Date(usuario.trial_ends_at);
  if (Number.isNaN(fim.getTime()) || fim <= agora) return 0;
  return Math.max(0, Math.ceil((fim - agora) / (1000 * 60 * 60 * 24)));
}

module.exports = { ehPro, diasDeTesteRestantes, CARGOS_COM_ACESSO, PLANOS_PAGOS };
