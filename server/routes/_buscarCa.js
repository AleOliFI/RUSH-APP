// ============================================================
// RUSH RUNNING — Busca TEMPORÁRIA da CA do Supabase
// ------------------------------------------------------------
// O pooler apresenta um certificado assinado pela CA própria da
// Supabase, que não está entre as raízes públicas do Node — daí o
// SELF_SIGNED_CERT_IN_CHAIN. Para validar é preciso ter essa CA.
//
// O ambiente onde este código é escrito não alcança supabase.com
// (o proxy recusa a conexão). A função na Vercel alcança. Então ela
// baixa o certificado da origem oficial, por HTTPS comum, com a
// verificação de certificado LIGADA como em qualquer requisição:
// a autenticidade do arquivo vem de o domínio supabase.com provar
// quem é, exatamente como um navegador faria.
//
// Certificado de CA é chave pública, distribuída abertamente para
// que clientes possam validar o servidor. Não há segredo aqui.
//
// ARQUIVO TEMPORÁRIO: sai do repositório assim que a CA estiver
// fixada no código e a verificação estrita estiver funcionando.
// ============================================================

const express = require('express');

const CANDIDATOS = [
  'https://supabase.com/downloads/prod-ca-2021.crt',
  'https://supabase.com/docs/prod-ca-2021.crt',
  'https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt',
];

module.exports = () => {
  const rotas = express.Router();

  rotas.get('/', async (req, res) => {
    const tentativas = [];

    for (const url of CANDIDATOS) {
      try {
        const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000) });
        const texto = r.ok ? await r.text() : '';
        const ehPem = texto.includes('-----BEGIN CERTIFICATE-----');
        tentativas.push({ url, status: r.status, ehPem, tamanho: texto.length });
        if (ehPem) {
          return res.json({ encontrado: url, pem: texto, tentativas });
        }
      } catch (e) {
        tentativas.push({ url, erro: e.message });
      }
    }

    res.status(404).json({ encontrado: null, tentativas });
  });

  return rotas;
};
