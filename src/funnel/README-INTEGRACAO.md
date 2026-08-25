# Integração Funil de Captura — RUSH Performance

> Nota: essa integração já foi feita no projeto real (`rush-sports-performance-hub`)
> em 2026-08-24, com 4 correções aplicadas antes de copiar os arquivos (ver commit
> `feat(funnel): captura de leads`). Este README documenta o funil como referência.

## O que este funil faz

```
Visitante → Preenche e-mail → PDF baixa AUTOMATICAMENTE
                             → E-mail vai para PLANILHA GOOGLE
                             → E-mail vai para MAILERLITE
                             → Pop-up nunca mais aparece
                             → Banner de upsell do Ebook 10K aparece
```

---

## 1. Dependências

Só precisa do `lucide-react`. Se ainda não tem:
```bash
npm install lucide-react
```

---

## 2. Arquivos e Onde Colocar

```
SEU-PROJETO/
├── public/
│   └── downloads/
│       └── guia-5km.pdf          ← Coloque o PDF aqui
│
├── app/
│   ├── layout.tsx                ← Edite este arquivo (passo 5)
│   └── api/
│       └── funnel/
│           └── subscribe/
│               └── route.ts      ← Copie o api-subscribe-route.ts para cá
│
├── src/  (ou onde ficam seus componentes)
│   └── funnel/                   ← Copie esta pasta inteira
│       ├── FunnelProvider.tsx
│       ├── LeadCapturePopup.tsx
│       ├── LeadCaptureBar.tsx
│       ├── LeadCaptureInline.tsx
│       ├── EbookUpsellBanner.tsx
│       └── MetaPixel.tsx
```

---

## 3. Configurar Google Sheets (receber dados na planilha)

1. Abra o [Google Sheets](https://sheets.google.com) e crie uma planilha nova
2. Na primeira linha, crie os cabeçalhos:

| A | B | C | D |
|---|---|---|---|
| Email | Origem | Data | Página |

3. Vá em **Extensões → Apps Script**
4. Apague todo o código e cole o conteúdo do arquivo `google-sheets-script.js`
5. Clique em **Implantar → Nova implantação**
6. Tipo: **App da Web**
7. Executar como: **Eu**
8. Quem tem acesso: **Qualquer pessoa**
9. Clique em **Implantar** e **copie a URL** gerada
10. Cole essa URL no `.env.local` (próximo passo)

---

## 4. Configurar `.env.local`

Crie ou edite o arquivo `.env.local` na raiz do seu projeto:

```env
# Google Sheets (obrigatório para planilha)
GOOGLE_SHEET_WEBHOOK="https://script.google.com/macros/s/SEU_ID_AQUI/exec"

# MailerLite (opcional — pode configurar depois)
MAILERLITE_API_KEY="seu_token_aqui"
MAILERLITE_GROUP_ID="id_do_grupo"

# Meta Pixel (opcional — pode configurar depois)
NEXT_PUBLIC_META_PIXEL_ID="seu_pixel_id"
```

> IMPORTANTE: Mesmo sem MailerLite e Meta Pixel, o funil funciona!
> Os dados vão para a planilha e o PDF é baixado normalmente.

---

## 5. Editar o `app/layout.tsx`

Adicione os imports e componentes:

```tsx
import { FunnelProvider } from '@/funnel/FunnelProvider';
import LeadCapturePopup from '@/funnel/LeadCapturePopup';
import LeadCaptureBar from '@/funnel/LeadCaptureBar';
import MetaPixel from '@/funnel/MetaPixel';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <MetaPixel />
        <FunnelProvider>
          <LeadCapturePopup />
          {children}
          <LeadCaptureBar />
        </FunnelProvider>
      </body>
    </html>
  );
}
```

---

## 6. Usar nos artigos (opcional)

Para colocar o card de captura dentro de um artigo:

```tsx
import LeadCaptureInline from '@/funnel/LeadCaptureInline';

// Dentro do conteúdo do artigo:
<LeadCaptureInline />
```

Para mostrar o banner de upsell do Ebook 10K:

```tsx
import EbookUpsellBanner from '@/funnel/EbookUpsellBanner';

// No final de artigos ou páginas:
<EbookUpsellBanner />
```

---

## 7. Testar

1. Rode o projeto: `npm run dev`
2. Espere 8 segundos ou role 40% da página → Pop-up aparece
3. Digite um e-mail e envie
4. O PDF deve baixar automaticamente
5. Confira a planilha do Google Sheets → os dados devem aparecer
6. O pop-up não deve mais aparecer naquele navegador

---

## Resumo dos Componentes

| Componente | Quando aparece | O que faz |
|---|---|---|
| `LeadCapturePopup` | Após 8s ou 40% scroll | Modal centralizado pedindo e-mail |
| `LeadCaptureBar` | Após 3s em todas páginas | Barra fixa no rodapé |
| `LeadCaptureInline` | Dentro de artigos | Card CTA no meio do conteúdo |
| `EbookUpsellBanner` | Após inscrição | Promove o Ebook 10K (R$47) |
| `FunnelProvider` | Sempre (layout) | Gerencia estado do funil |
| `MetaPixel` | Sempre (layout) | Rastreamento Facebook/Meta |
| `api-subscribe-route` | Quando e-mail é enviado | Salva dados na planilha + MailerLite |
