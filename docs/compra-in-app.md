# Compra in-app — configuração e o que falta

A verificação de recibo está pronta e testada no servidor. **Nada concede
RUSH PRO sem que a loja confirme.** A rota antiga `/subscriptions/activate`,
que dava PRO a qualquer conta autenticada que pedisse, continua fechada (501).

## A única porta

```
POST /api/subscriptions/verificar-compra
{ "loja": "apple" | "google", "recibo": "<comprovante da loja>" }
```

- **iOS** — `recibo` é a transação assinada (JWS do StoreKit 2). A verificação
  usa a biblioteca oficial da Apple, que confere a cadeia de certificados.
- **Android** — `recibo` é o token de compra. O servidor consulta o
  `androidpublisher` com a conta de serviço.

Respostas: `402` quando a loja não confirma, `409` quando o recibo já pertence
a outra conta, `200` com os dados da assinatura quando tudo confere.

`GET /api/subscriptions/lojas` diz quais lojas o servidor consegue verificar,
para o app não mostrar um botão que não tem como funcionar.

## Variáveis de ambiente

Sem elas, a verificação **falha fechada** — recusa tudo, em vez de liberar.

### Apple

| variável | o que é |
|---|---|
| `APPLE_BUNDLE_ID` | o bundle id do app (o mesmo do `capacitor.config.ts`) |
| `APPLE_ROOT_CA_G3_BASE64` | o certificado raiz da Apple, em base64 do DER |
| `APPLE_APP_APPLE_ID` | o id numérico do app; omitido no sandbox |
| `APPLE_ENVIRONMENT` | `sandbox` durante os testes; qualquer outra coisa = produção |

O certificado sai de <https://www.apple.com/certificateauthority/> — baixe
`AppleRootCA-G3.cer` e converta:

```bash
base64 -w0 AppleRootCA-G3.cer
```

Ele não está no repositório de propósito: é o que ancora toda a confiança da
verificação, e quem opera o app deve conferir o que colocou ali.

### Google

| variável | o que é |
|---|---|
| `GOOGLE_PLAY_PACKAGE` | o nome do pacote (o mesmo `appId`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | o JSON da conta de serviço, **inteiro** |

Cole o JSON inteiro, sem separar a chave privada: quebrar as linhas de uma
chave RSA ao copiá-la para outra variável é o erro mais comum aqui.

A conta de serviço precisa do papel adequado no Play Console e do escopo
`androidpublisher`.

## O que ainda falta

### 1. O plugin de compra nativo

`src/services/billing.js` tem a função `comprarNaLoja`, e ela é o único ponto
que falta. O contrato é curto: abrir a compra e **devolver o comprovante como
string** — transação assinada no iOS, token no Android. Nada mais; quem julga
é o servidor.

Hoje ela lança um aviso honesto em vez de fingir que comprou. Ligar um plugin
de compra exige aparelho de verdade e conta de desenvolvedor, então não foi
feito aqui.

### 2. Produtos cadastrados nas duas lojas

Os identificadores usados pelo app estão em `src/services/billing.js`:

```
rush_pro_monthly_2990    R$ 29,90 / mês
rush_pro_yearly_23880    R$ 238,80 / ano
```

Precisam existir com esses mesmos ids na App Store Connect e no Play Console.

### 3. Uma recomendação de banco que eu não apliquei

A proteção contra reaproveitar o recibo de outra conta é feita por consulta
antes de gravar. Isso cobre o caso real — alguém repassar um recibo — mas
duas requisições **simultâneas** poderiam, em tese, passar juntas.

O fechamento definitivo é um índice único:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_provider_sub_id
  ON subscriptions(provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;
```

Não apliquei porque mudança de schema precisa da sua palavra. É uma linha, e
eu recomendo.

## Como testar de verdade

Nada disto foi exercitado contra Apple ou Google: este ambiente não alcança
nenhuma das duas, e não há aparelho. O que existe são 13 testes adversários
(`server/test/verificacaoDeCompra.test.js`) sobre a regra — recibo forjado,
expirado, revogado, pausado, e o recibo legítimo reaproveitado por outra conta.

Quando houver sandbox:

- [ ] compra real no sandbox das duas lojas
- [ ] recibo de um app **diferente** — precisa ser recusado
- [ ] recibo de outra conta — precisa dar `409`
- [ ] assinatura expirada — precisa parar de valer
- [ ] reembolso pela loja — precisa revogar o PRO
- [ ] restaurar compras num aparelho novo
