# Compilar o app nativo

> **Por que este guia existe:** o projeto Capacitor está configurado e os
> diretórios `android/` e `ios/` estão gerados e versionados. O que **não**
> foi feito aqui é a compilação: o ambiente onde este trabalho rodou não tem
> o SDK do Android (e `dl.google.com`, sua única origem, está bloqueado no
> proxy), nem um Mac para o Xcode. Então o build nunca foi executado — nem
> uma vez. Trate este guia como instruções verificadas contra a configuração
> do projeto, **não** como um caminho já percorrido.

## O passo que não pode ser esquecido

Dentro do app nativo, o frontend **não** fala com a API por caminho relativo.
Na web, `/api` resolve porque tudo sai da mesma origem; no webview a origem é
`https://localhost` (Android) ou `capacitor://localhost` (iOS), e `/api` não
aponta para nada.

Por isso o build precisa da URL absoluta da API:

```bash
VITE_API_URL="https://SEU-DOMINIO/api" npm run build
npx cap sync
```

Se você rodar `npm run build` sem `VITE_API_URL`, o app compila, instala,
abre — e falha em **toda** chamada de rede, sem erro óbvio na tela. É o
tropeço mais provável desta fase.

E no servidor, defina `CORS_ORIGIN` com o seu domínio. As origens do webview
(`capacitor://localhost` e `https://localhost`) são adicionadas
automaticamente pelo `server/index.js`; você não precisa listá-las.

## Android

**Precisa:** Android Studio (traz o SDK), JDK 21.

```bash
VITE_API_URL="https://SEU-DOMINIO/api" npm run build
npx cap sync android
npx cap open android      # abre no Android Studio
```

No Android Studio: *Build → Build Bundle(s) / APK(s) → Build APK(s)* para
testar, ou *Build → Generate Signed Bundle* para gerar o `.aab` que a Play
Console aceita.

Pela linha de comando, com o SDK instalado e `ANDROID_HOME` definido:

```bash
cd android && ./gradlew assembleDebug        # APK de teste
cd android && ./gradlew bundleRelease        # AAB para a loja (precisa assinatura)
```

## iOS

**Precisa:** um Mac, Xcode e conta no Apple Developer Program.

```bash
VITE_API_URL="https://SEU-DOMINIO/api" npm run build
npx cap sync ios
npx cap open ios          # abre no Xcode
```

No Xcode, configure o *Team* de assinatura, e então *Product → Archive*.

## Ícones e splash

`resources/icon.png` (1024×1024) e `resources/splash.png` (2732×2732) estão
gerados a partir da marca. Para espalhá-los em todas as densidades:

```bash
npm install --save-dev @capacitor/assets
npx capacitor-assets generate
```

Até rodar isso, o app usa os ícones padrão do Capacitor — o que serve para
testar, mas **não** para submeter.

---

## Os dois buracos conhecidos, que a submissão vai expor

Nenhum dos dois é configuração esquecida. São trabalho que falta, e é melhor
saber agora do que numa reprovação.

### 1. GPS em segundo plano — o mais grave

`src/hooks/useRunTracker.ts` usa `navigator.geolocation`. Dentro do webview,
isso funciona **enquanto o app está na frente e a tela acesa**. Quando a
pessoa bloqueia o celular e o põe no bolso — ou seja, numa corrida de verdade
— o sistema suspende a geolocalização do webview e a distância para de
acumular.

O manifesto já declara `ACCESS_FINE_LOCATION` e `ACCESS_COARSE_LOCATION`, que
cobrem o primeiro plano. O que falta:

- um plugin de localização em segundo plano;
- no Android, `ACCESS_BACKGROUND_LOCATION` e um *foreground service* com
  notificação persistente;
- no iOS, o modo de background `location` e a chave
  `NSLocationAlwaysAndWhenInUseUsageDescription`;
- justificativa escrita nas duas lojas — a Google analisa pedido de
  localização em segundo plano com rigor, e reprova justificativa vaga.

### 2. Notificações

`src/hooks/usePushNotifications.ts` é Web Push puro: service worker em
`/sw.js` e chaves VAPID. Isso **não funciona** dentro do app nativo, que
precisa de APNs no iOS e FCM no Android, via plugin de push do Capacitor.

O caminho web continua valendo para o site — o que existe hoje não some, só
não atende o app empacotado.

---

## Antes de submeter

- [ ] `VITE_API_URL` no build e `CORS_ORIGIN` no servidor
- [ ] Ícones gerados em todas as densidades
- [ ] GPS em segundo plano resolvido, ou o app assumido como "corrida com a
      tela acesa"
- [ ] Push nativo, se as notificações forem parte da proposta
- [ ] Compra in-app: a verificação de recibo no servidor está pronta e
      testada (`docs/compra-in-app.md`). Falta o plugin de compra nativo e as
      credenciais das duas lojas
- [ ] Política de privacidade publicada em URL acessível sem login
      (`/privacidade` já existe) e razão social preenchida em
      `src/data/textosLegais.ts`
- [ ] Declaração de apps de saúde no Play Console
      (`docs/declaracao-saude-google.md`)
- [ ] Privacy labels e `PrivacyInfo.xcprivacy` no App Store Connect
      (`docs/apple-privacy-labels.md`)
