# Assinatura pela web (Cakto)

Quem abre o RUSH pelo navegador não tem loja para comprar. A compra na
web passa pelo checkout da Cakto; nas lojas continua pela App Store e
pelo Google Play, sem mudança.

**Quem libera o PRO é sempre o servidor**, ao receber o aviso de
pagamento. O aplicativo nunca decide que alguém é assinante.

---

## O que falta você fazer (eu não tenho acesso, e não devo ter)

1. **Criar o produto na Cakto.** Ao criar o produto, a Cakto já gera a
   oferta padrão, o checkout e o link de pagamento
   (`https://pay.cakto.com.br/{id_da_oferta}`). Não existe endpoint
   separado de "criar checkout".
2. **Cadastrar o webhook** apontando para:

   ```
   https://<seu-domínio>/api/subscriptions/webhook/cakto
   ```

   Marque pelo menos: `purchase_approved`, `subscription_renewed`,
   `subscription_resumed`, `subscription_canceled`,
   `subscription_paused`, `subscription_late`,
   `subscription_renewal_refused`, `refund` e `chargeback`.

3. **Pôr duas variáveis de ambiente na Vercel** (eu não toco no
   `.env` nem nas configurações da conta, como combinamos):

   | Variável | Onde | O que é |
   |---|---|---|
   | `CAKTO_WEBHOOK_SECRET` | servidor | o segredo que a Cakto mostra ao criar o webhook |
   | `VITE_CAKTO_CHECKOUT_URL` | build do front | o link de pagamento da oferta |

   **Sem `CAKTO_WEBHOOK_SECRET` a rota recusa todo aviso (503).** É de
   propósito: a rota irmã já teve um segredo literal escrito num
   repositório público, e qualquer pessoa que lesse o GitHub podia se
   dar PRO. Aqui não há valor de reserva nenhum.

   Sem `VITE_CAKTO_CHECKOUT_URL` o botão de assinar no navegador não
   aparece, e a tela volta a dizer que a assinatura é feita pelo
   aplicativo. Nada quebra.

4. **Disparar um evento de teste pelo painel** e conferir os dois
   pontos da seção seguinte.

---

## O que eu não consegui confirmar

A documentação oficial da Cakto (`docs.cakto.com.br`) está fora do
alcance da rede deste ambiente de desenvolvimento. O que montei veio de
material de segunda mão: um espelho da documentação e integrações
públicas no GitHub. **Dois pontos precisam ser conferidos com um evento
de teste real antes de confiar nisto em produção:**

1. **Os nomes dos campos dentro de `data`.** O leitor
   (`server/services/pagamentos/cakto.js`) não supõe formato: procura
   cada informação numa lista de caminhos possíveis e devolve `null`
   quando não encontra. O que ele leu de onde fica registrado no log
   em `origens`, justamente para essa conferência.

2. **Qual parâmetro do link de checkout volta no aviso.** O app manda o
   identificador da conta como `src` e `external_reference`. Se a Cakto
   não devolver nenhum dos dois, o servidor cai no e-mail de quem
   pagou — que funciona no caso comum, porque o campo vai preenchido no
   link.

   Quando nem a referência nem o e-mail casam com uma conta, o servidor
   **não engole o pagamento**: responde 202, registra o aviso completo
   no log e pede conferência manual. Devolver erro faria a Cakto repetir
   para sempre sem resolver; responder 200 daria o caso por encerrado.

---

## A regra das lojas (importante para a publicação)

A diretriz 3.1.1 da Apple e a política equivalente do Google proíbem o
aplicativo distribuído pela loja de apontar para pagamento externo de
conteúdo digital. Um link desses dentro do app empacotado é motivo
conhecido de reprovação na revisão.

Por isso `linkDoCheckoutWeb()` devolve `null` quando está rodando
empacotado: no app nativo o checkout da Cakto não aparece nem é
mencionado. `server/test/assinaturaCakto.test.js` (T12) falha se alguém
tirar essa guarda.

---

## Como o acesso é concedido e retirado

| Evento | O que acontece |
|---|---|
| `purchase_approved`, `subscription_renewed`, `subscription_resumed` | libera: plano `pro`, status `active` |
| `subscription_canceled`, `subscription_paused`, `subscription_late`, `subscription_renewal_refused` | status `canceled` |
| `refund`, `chargeback` | status `expired` e plano volta a `free` |
| qualquer outro (ex.: `purchase_refused`) | não mexe no acesso |

O PRO concedido aqui é o mesmo que o resto do app enxerga: quem decide é
`server/services/acessoPro.js`, a regra única usada por `/users/me`,
`/subscriptions/status` e pelo selo do feed.

**Aviso repetido não vira assinatura duplicada.** O identificador do
pedido vai em `subscriptions.provider_subscription_id`, que tem índice
único — a segunda entrega esbarra no banco, que é o único lugar onde
uma corrida entre dois avisos simultâneos fecha de verdade.
