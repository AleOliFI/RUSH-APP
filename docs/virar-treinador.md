# Como alguém vira treinador no RUSH

## O que mudou, e por quê

`POST /api/academies` criava a assessoria **e** promovia quem chamava a
`owner`, exigindo apenas estar logado. Qualquer atleta virava dono de
assessoria chamando a API direto — e, enquanto o cargo concedia PRO,
esse era também o caminho para o produto pago de graça. Reproduzi antes
de corrigir: `athlete/is_pro:false` → `POST /api/academies 201` →
`owner/is_pro:true`.

A rota foi fechada para quem já é treinador. Isso tapou o furo e, junto,
tirou do app o único caminho para alguém **se tornar** treinador.

Este documento descreve a reposição: **a pessoa pede, um administrador
decide.**

---

## O que você precisa fazer uma vez

**Nomear o primeiro administrador.** Hoje nenhuma conta tem
`role = 'admin'` — nem o seed cria uma. Sem isso, a fila de pedidos não
tem quem a decida.

É um passo de bootstrap que não tem como ser automático: se o app
pudesse criar o primeiro administrador sozinho, qualquer pessoa poderia
ser ele. No banco de produção, uma vez:

```sql
UPDATE users SET role = 'admin' WHERE email = 'seu-email@exemplo.com';
```

Depois disso, a conta passa a ver **Perfil → Pedidos para treinar**, e
todo o resto acontece dentro do app.

> Atenção: `admin` é o cargo mais alto. Quem o tem decide quem vira
> treinador — e treinador enxerga dado de saúde dos atletas dele. Dê a
> poucas contas, e a contas que você controla.

---

## O fluxo, do lado de quem pede

1. **Perfil → Quero treinar atletas.** O botão só aparece para quem
   ainda não é treinador.
2. A pessoa informa o nome da assessoria que quer abrir e, se quiser,
   uma mensagem.
3. O pedido entra na fila. A mesma tela passa a mostrar o estado:
   na fila, aprovado ou recusado — e, quando recusado, o motivo.
4. Aprovado, a conta vira treinador e a tela oferece **Criar minha
   assessoria**, que leva à criação de sempre.

Quem foi recusado pode pedir de novo. Quem tem um pedido na fila não
consegue abrir um segundo — há um índice único no banco, então nem dois
toques simultâneos no botão criam dois pedidos.

---

## O fluxo, do lado de quem decide

**Perfil → Pedidos para treinar**, visível apenas para `admin`.

A fila mostra, de cada pedido: o nome da assessoria, quem pediu, o
e-mail e o que a pessoa escreveu. Ao lado do botão fica o aviso do que
está em jogo — aprovar dá àquela conta a leitura da prontidão
fisiológica e do histórico dos atletas que aceitarem treinar com ela.

Recusar aceita um motivo, que chega a quem pediu.

Toda decisão grava **quem decidiu e quando**, e dispara uma notificação
para a pessoa. Um pedido já decidido não pode ser decidido de novo.

---

## Por que `owner` não aprova

`owner` é qualquer treinador que criou uma assessoria. Se `owner`
pudesse aprovar, donos fabricariam treinadores uns aos outros e o furo
voltaria pela porta dos fundos, só que com mais passos.

`server/test/virarTreinador.test.js` (T7) falha se alguém afrouxar isso.

---

## O que a aprovação **não** dá

Não dá RUSH PRO. O cargo deixou de conceder acesso pago
(`server/services/acessoPro.js`); treinador que quiser as análises
assina como qualquer um. T12 do mesmo arquivo falha se isso mudar.
