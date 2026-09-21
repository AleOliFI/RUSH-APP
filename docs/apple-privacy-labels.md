# App Privacy (nutrition labels) — App Store Connect

> Conteúdo preparado para você transcrever no App Store Connect.
> **O envio é seu.**
>
> Mapeamento feito contra o schema real (`server/database/schema.js`), não
> contra um modelo. Se o app passar a coletar algo novo, este arquivo e a
> política precisam mudar junto — o teste `documentosLegais` cobra isso.

## Categorias a declarar

Nenhum dado abaixo é usado para **rastreamento** (ATT) nem para publicidade.
Todos são **vinculados à identidade** do usuário, porque ficam presos à conta.

| categoria da Apple | o que é | finalidade |
|---|---|---|
| Contact Info — Email Address | `users.email` | funcionalidade do app, autenticação |
| Contact Info — Name | `user_profiles.name`, `username` | funcionalidade do app |
| Health & Fitness — Health | VFC/RMSSD, FC, VO₂máx, prontidão, **ciclo menstrual** | funcionalidade do app |
| Health & Fitness — Fitness | atividades, distância, ritmo, parciais, calçados | funcionalidade do app |
| Location — Precise Location | `activity_tracks` (GPS da corrida) | funcionalidade do app |
| User Content — Photos or Videos | fotos anexadas às publicações | funcionalidade do app |
| User Content — Other User Content | publicações, comentários, bio | funcionalidade do app |
| Identifiers — User ID | `users.id`, tokens de sessão | funcionalidade do app |
| Purchases | `subscriptions` | funcionalidade do app |
| Sensitive Info | data de nascimento, gênero, peso, altura, ciclo menstrual | funcionalidade do app |

**Data Used to Track You:** nenhum.
**Data Linked to You:** todos os acima.
**Data Not Linked to You:** nenhum.

## Privacy manifest (`PrivacyInfo.xcprivacy`)

Obrigatório desde 2024. Precisa ser criado no projeto iOS quando ele existir,
declarando os tipos de dado coletados e as *required reason APIs* usadas.
Os SDKs de terceiros embarcados também precisam trazer o manifest deles.

## Outros requisitos da Apple já atendidos

- **Exclusão de conta dentro do app**: existe (`DeleteAccountScreen`). Declare
  que é exclusão lógica, com remoção física por solicitação — não descreva
  como apagamento imediato.
- **Política de privacidade com URL pública**: `https://<seu-domínio>/privacidade`

## Antes de enviar

- [ ] Preencher razão social e contato em `src/data/textosLegais.ts`
- [ ] Criar o `PrivacyInfo.xcprivacy` no projeto iOS (Fase 2)
- [ ] Revisão jurídica do texto
