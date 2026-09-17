// ============================================================
// RUSH RUNNING — A conexão com o banco verifica quem atende
// ------------------------------------------------------------
// Em produção a conexão morria com SELF_SIGNED_CERT_IN_CHAIN: o
// pooler do Supabase assina o certificado com uma CA própria, fora
// das raízes públicas do Node.
//
// Existem duas saídas. `rejectUnauthorized: false` faz o app subir
// em uma linha, mantém o tráfego criptografado e desiste de conferir
// com quem está falando — um intermediário na rota passaria por
// banco sem ser notado. A outra é fixar a CA e continuar
// verificando. Foi a segunda.
//
// Este teste existe porque a primeira é tentadora justamente quando
// algo quebra e a pressa aperta. Se alguém desligar a verificação,
// falha aqui.
// ============================================================

const assert = require('assert');
const { X509Certificate } = require('node:crypto');
const { tlsPara } = require('../database/adapter');

let passaram = 0;
let falharam = 0;

function teste(nome, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${nome}`);
    passaram += 1;
  } catch (err) {
    console.log(`  ❌ [FAIL] ${nome}`);
    console.log(`     ${err.message}`);
    falharam += 1;
  }
}

console.log('\n============================================================');
console.log('📌 TLS DA CONEXÃO COM O BANCO');
console.log('============================================================\n');

const SUPABASE = 'postgresql://postgres.abc:senha@aws-1-us-east-1.pooler.supabase.com:6543/postgres';

teste('a verificação NUNCA é desligada fora de localhost', () => {
  for (const url of [
    SUPABASE,
    'postgresql://u:p@ep-qualquer.neon.tech:5432/db',
    'postgresql://u:p@banco.interno.exemplo:5432/db',
  ]) {
    const tls = tlsPara(url);
    assert.notStrictEqual(tls, false, `TLS não pode ser desligado para ${url}`);
    assert.strictEqual(tls.rejectUnauthorized, true,
      `rejectUnauthorized precisa ser true para ${url} — sem isso o app aceita qualquer servidor que se passe pelo banco`);
  }
});

teste('destino Supabase recebe a CA do Supabase', () => {
  const tls = tlsPara(SUPABASE);
  assert.ok(tls.ca, 'sem a CA fixada a conexão falha com SELF_SIGNED_CERT_IN_CHAIN');
  const cert = new X509Certificate(tls.ca);
  assert.ok(cert.ca, 'o certificado fixado precisa ser de uma autoridade');
  assert.match(cert.subject, /Supabase Root 2021 CA/);
  assert.strictEqual(
    cert.fingerprint256,
    '80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA',
    'a impressão digital mudou: o certificado foi trocado por outro',
  );
  assert.ok(new Date(cert.validTo) > new Date(), 'a CA fixada está vencida');
});

teste('outro provedor continua nas raízes públicas', () => {
  const tls = tlsPara('postgresql://u:p@ep-qualquer.neon.tech:5432/db');
  assert.strictEqual(tls.ca, undefined,
    'fixar a CA do Supabase para outro provedor quebraria a conexão por um motivo indecifrável');
});

teste('localhost segue sem TLS, para os testes não quebrarem', () => {
  assert.strictEqual(tlsPara('postgresql://u:p@localhost:5432/db'), false);
  assert.strictEqual(tlsPara('postgresql://u:p@127.0.0.1:5432/db'), false);
});

console.log('\n============================================================');
console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
console.log('============================================================');
if (falharam > 0) process.exit(1);
