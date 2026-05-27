# RevenueCat — Setup para Produção

## 1. Criar conta e configurar o app

1. Acesse [app.revenuecat.com](https://app.revenuecat.com) e crie uma conta
2. Crie um novo **Project** → "RUSH"
3. Adicione dois apps:
   - **iOS** — bundle ID do app (`com.seudominio.rush`)
   - **Android** — package name (`com.seudominio.rush`)

## 2. Configurar produtos na App Store / Google Play

### App Store Connect
1. Em **In-App Purchases**, crie:
   - `rush_monthly` — Assinatura recorrente — R$ 19,90/mês
   - `rush_annual` — Assinatura recorrente — R$ 119,90/ano
2. Habilite **App Store Server Notifications** apontando para a URL do webhook abaixo

### Google Play Console
1. Em **Monetização > Assinaturas**, crie os mesmos produtos
2. Configure o **Real-time developer notifications** para o webhook

## 3. Configurar RevenueCat

1. Em **Entitlements**, crie: `premium`
2. Em **Products**, adicione `rush_monthly` e `rush_annual`
3. Em **Offerings**, crie o offering `default` com dois packages:
   - `$rc_monthly` → `rush_monthly`
   - `$rc_annual` → `rush_annual`
4. Vincule os produtos ao entitlement `premium`

## 4. Obter as API Keys

No dashboard RevenueCat → **Project Settings → API Keys**:
- Copie a chave **iOS** (começa com `appl_`)
- Copie a chave **Android** (começa com `goog_`)

Adicione ao `.env.local`:
```
EXPO_PUBLIC_RC_API_KEY_IOS=appl_xxxxxxxxxxxxxxxxxxxxxxxx
EXPO_PUBLIC_RC_API_KEY_ANDROID=goog_xxxxxxxxxxxxxxxxxxxxxxxx
```

## 5. Configurar o Webhook RevenueCat → Supabase

### Deploy da Edge Function
```bash
npx supabase functions deploy revenuecat-webhook --no-verify-jwt
```

### Configurar variáveis de ambiente na Edge Function
```bash
npx supabase secrets set REVENUECAT_WEBHOOK_AUTH_TOKEN=seu_token_secreto
```

### Registrar webhook no RevenueCat
1. RevenueCat → **Project Settings → Webhooks**
2. Adicione o endpoint: `https://<seu-projeto>.supabase.co/functions/v1/revenuecat-webhook`
3. Em **Authorization header**: coloque o mesmo valor de `REVENUECAT_WEBHOOK_AUTH_TOKEN`

## 6. Eventos tratados pelo webhook

| Evento | Ação no banco |
|--------|--------------|
| `INITIAL_PURCHASE` | `subscription_tier = 'premium'`, salva `expires_at` |
| `RENEWAL` | Atualiza `expires_at` |
| `CANCELLATION` | Mantém premium até `expires_at` |
| `EXPIRATION` | `subscription_tier = 'free'` |
| `BILLING_ISSUE` | `subscription_tier = 'free'` |
| `UNCANCELLATION` | `subscription_tier = 'premium'` |

## 7. Testar em sandbox

- **iOS**: use conta Sandbox da App Store Connect para testar compras
- **Android**: use conta de teste do Google Play Console
- No RevenueCat dashboard, o modo **Sandbox** mostra compras de teste em tempo real
