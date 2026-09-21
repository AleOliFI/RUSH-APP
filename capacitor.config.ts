// ============================================================
// RUSH RUNNING — Configuração do empacotamento nativo
// ------------------------------------------------------------
// O app nativo carrega o MESMO frontend que roda na web, a partir
// de dist/. O que muda é de onde ele fala com a API: na web o
// caminho relativo /api resolve sozinho; dentro do webview a
// origem é capacitor://localhost, e /api não aponta para lugar
// nenhum. Por isso VITE_API_URL precisa estar definida na hora do
// `npm run build` que antecede o `npx cap sync`.
//
// `androidScheme: 'https'` não é enfeite: com o esquema http o
// Android trata a origem como insegura e bloqueia armazenamento
// e APIs que o app usa — entre elas a geolocalização.
// ============================================================

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rushrunning.app',
  appName: 'RUSH RUNNING',
  webDir: 'dist',
  android: {
    // Sem isto o webview roda em http://localhost e perde contexto seguro.
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
