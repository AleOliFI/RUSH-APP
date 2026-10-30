// ============================================================
// RUSH RUNNING — Cobrar a assinatura nas rotas pagas
// ------------------------------------------------------------
// Esconder um botão não é cobrar. Enquanto a checagem viver só no
// cliente, basta chamar a rota direto para ter o recurso — e o
// cliente é um arquivo que qualquer pessoa lê.
//
// Por isso a porta é esta, no servidor. A tela também esconde, mas
// por educação: quem manda é aqui.
//
// 402 (Payment Required) e não 403: o cliente precisa distinguir
// "você não pode" de "você ainda não assinou", porque a segunda tem
// conserto com um botão.
// ============================================================

const { ehPro } = require('../services/acessoPro');
const { RECURSOS_PRO, CODIGO_SEM_ASSINATURA } = require('../services/recursosPro');

/**
 * @param {object} db
 * @param {keyof typeof RECURSOS_PRO} recurso Qual porta é esta.
 */
function exigirAssinatura(db, recurso) {
  const descricao = RECURSOS_PRO[recurso];
  if (!descricao) {
    // Erro de programação, e não de quem usa: falha alto, na subida
    // do servidor, em vez de liberar a rota calado.
    throw new Error(`exigirAssinatura: recurso desconhecido "${recurso}"`);
  }

  return async function conferirAssinatura(req, res, next) {
    try {
      // Lê do banco, não do token: o token é assinado no login e
      // sobrevive ao cancelamento da assinatura por dias.
      const usuario = await db
        .prepare(`
          SELECT id, role, subscription_tier, subscription_status, trial_ends_at
          FROM users WHERE id = ? AND deleted_at IS NULL
        `)
        .get(req.user.id);

      if (!usuario) {
        return res.status(401).json({ error: 'Sessão inválida' });
      }

      if (!ehPro(usuario)) {
        return res.status(402).json({
          error: descricao.explicacao,
          code: CODIGO_SEM_ASSINATURA,
          recurso,
          titulo: descricao.titulo,
        });
      }

      return next();
    } catch (err) {
      console.error('Erro ao conferir assinatura:', err);
      // Falha FECHADA: um erro aqui não pode virar acesso liberado.
      return res.status(500).json({ error: 'Erro ao verificar a assinatura' });
    }
  };
}

module.exports = { exigirAssinatura };
