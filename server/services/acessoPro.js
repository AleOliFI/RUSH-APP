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
//
// E ela responde UMA pergunta: "esta conta tem assinatura ativa?".
// "Esta conta pode usar as ferramentas de treinador?" é outra, e quem
// responde são os `authorize` das rotas do módulo.
// ============================================================

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

  // O CARGO NÃO DÁ PRO.
  //
  // Antes, `coach`, `owner` e `admin` recebiam PRO só por serem o que
  // são. Combinado com POST /api/academies — que promovia a `owner`
  // qualquer conta logada, sem cobrar nada —, isso virava PRO
  // vitalício de graça para quem chamasse a rota: criar uma
  // assessoria vazia liberava o app inteiro.
  //
  // Agora acesso PRO é assinatura, e só. O cargo continua decidindo
  // as FERRAMENTAS de treinador (painel, prescrição, gestão de
  // atletas), que são controladas por `authorize` nas rotas — outra
  // pergunta, com outra resposta.
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

module.exports = { ehPro, diasDeTesteRestantes, PLANOS_PAGOS };
