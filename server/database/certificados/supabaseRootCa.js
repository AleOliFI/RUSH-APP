// ============================================================
// RUSH RUNNING — CA raiz do Supabase
// ------------------------------------------------------------
// O pooler do Supabase apresenta um certificado assinado por esta
// autoridade, que não está entre as raízes públicas do Node. Sem
// ela, a conexão morre com SELF_SIGNED_CERT_IN_CHAIN — e a saída
// fácil seria desligar a verificação, aceitando falar com qualquer
// um que se passe pelo banco. Fixar a CA mantém a verificação
// ligada e ainda restringe a confiança a UMA autoridade, o que é
// mais estreito do que confiar nas centenas de raízes públicas.
//
//   Subject/Issuer: C=US, ST=Delware, L=New Castle,
//                   O=Supabase Inc, CN=Supabase Root 2021 CA
//   Validade:       2021-04-28 → 2031-04-26
//   SHA-256:        80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:
//                   82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
//
// Procedência, dita com todas as letras: este arquivo foi baixado
// de supabase-downloads.s3-ap-southeast-1.amazonaws.com, porque os
// caminhos em supabase.com responderam 404. Um bucket S3 não prova
// por si só quem é o dono. O que prova é o uso: uma CA falsa NÃO
// validaria o certificado que o pooler apresenta, e a conexão
// continuaria falhando. Ela funcionar é a evidência de que é a
// certa — e é por isso que a verificação estrita ficou ligada em
// vez de contornada.
//
// Por que um .js e não um .crt: o empacotador da Vercel inclui o
// que é alcançado por `require`, mas nem sempre arquivos soltos
// lidos com `fs` em runtime. Um certificado que some no deploy
// traria o erro de volta sem explicação nenhuma.
//
// Expira em abril de 2031.
// ============================================================

const SUPABASE_ROOT_2021_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----
`;

module.exports = { SUPABASE_ROOT_2021_CA };
