// ============================================================
// RUSH RUNNING — Envio de e-mail
// ------------------------------------------------------------
// O app passou a vida inteira sem nenhum caminho de e-mail. Isso
// não era um detalhe: a recuperação de senha devolvia o código na
// própria resposta HTTP porque não havia por onde mandá-lo, e o
// convite de atleta gravava "pending" e não avisava ninguém.
//
// Aqui o provedor fica atrás de UMA função. O resto do servidor
// não sabe que existe Resend, e trocar de provedor é mexer só
// neste arquivo.
//
// Falamos com a API por HTTP, sem SDK: o corpo é quatro campos e
// o fetch já vem no Node. Uma dependência a menos para auditar e
// para quebrar em produção.
//
// REGRA IMPORTANTE PARA QUEM CHAMAR: esta função NUNCA lança. Ela
// devolve `{ enviado, motivo }`. Quem chama decide o que fazer —
// e, em fluxo de autenticação, o que fazer é NÃO mudar a resposta,
// porque uma resposta diferente quando o envio falha vira um
// oráculo de quais e-mails existem.
// ============================================================

const ENDPOINT = 'https://api.resend.com/emails';

/** Há credencial e remetente configurados? */
function emailConfigurado() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/**
 * Envia um e-mail.
 *
 * @param {{ para: string, assunto: string, html: string, texto?: string }} msg
 * @returns {Promise<{ enviado: boolean, motivo?: string, id?: string }>}
 */
async function enviarEmail({ para, assunto, html, texto }) {
  if (!emailConfigurado()) {
    return { enviado: false, motivo: 'EMAIL_NAO_CONFIGURADO' };
  }

  try {
    const resposta = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [para],
        subject: assunto,
        html,
        ...(texto ? { text: texto } : {}),
      }),
    });

    if (!resposta.ok) {
      // O corpo do erro pode trazer o endereço de destino; ele fica
      // no log do servidor e nunca sobe para o cliente.
      const detalhe = await resposta.text().catch(() => '');
      console.error(`✉️  Envio recusado (${resposta.status}):`, detalhe.slice(0, 300));
      return { enviado: false, motivo: `HTTP_${resposta.status}` };
    }

    const corpo = await resposta.json().catch(() => ({}));
    return { enviado: true, id: corpo?.id };
  } catch (err) {
    console.error('✉️  Falha de rede ao enviar e-mail:', err.message);
    return { enviado: false, motivo: 'FALHA_DE_REDE' };
  }
}

/**
 * Modelo do código de recuperação. Texto curto de propósito: é um
 * e-mail transacional que a pessoa abre para ler seis dígitos.
 */
function modeloCodigoDeRecuperacao(codigo) {
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#0D0D0D;padding:32px;color:#F7F5F3">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;color:#FF5500">RUSH RUNNING</p>
      <h1 style="margin:0 0 16px;font-size:20px">Código para redefinir sua senha</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#A1A1AA">
        Use o código abaixo no app. Ele vale por 1 hora.
      </p>
      <p style="margin:0 0 24px;font-size:32px;font-weight:bold;letter-spacing:8px">${codigo}</p>
      <p style="margin:0;font-size:12px;color:#737373">
        Se não foi você que pediu, ignore este e-mail: sua senha continua a mesma.
      </p>
    </div>
  `;
  const texto =
    `RUSH RUNNING\n\nCódigo para redefinir sua senha: ${codigo}\n` +
    `Ele vale por 1 hora.\n\n` +
    `Se não foi você que pediu, ignore este e-mail: sua senha continua a mesma.`;
  return { html, texto };
}

module.exports = { enviarEmail, emailConfigurado, modeloCodigoDeRecuperacao };
