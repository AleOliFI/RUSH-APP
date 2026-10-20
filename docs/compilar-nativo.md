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

## Ícones

Os ícones da marca já estão aplicados: Android em todas as densidades
(`mipmap-*`, incluindo o `ic_launcher_foreground` do ícone adaptativo, com
fundo transparente e o símbolo dentro da zona segura) e iOS no
`AppIcon-512@2x.png` de 1024×1024. O fundo do adaptativo foi trocado de
branco para o carbono da marca.

O splash (`resources/splash.png`, 2732×2732) continua como master; as telas
de abertura em cada densidade ainda são as padrão do Capacitor. Para
gerá-las:

```bash
npm install --save-dev @capacitor/assets
npx capacitor-assets generate
```

## ⚠️ Um passo manual no Xcode que só você pode dar

`ios/App/App/PrivacyInfo.xcprivacy` existe no disco, mas **não está no
target do Xcode**. O projeto do Capacitor usa referências explícitas de
arquivo (`objectVersion = 60`, sem grupo sincronizado), então arquivo novo
não entra sozinho no build.

Editar o `project.pbxproj` programaticamente é possível, mas um erro ali
impede o projeto de abrir — e não há como verificar isso sem um Mac. Então:

1. abra `ios/App/App.xcworkspace` no Xcode;
2. arraste `PrivacyInfo.xcprivacy` para dentro do grupo **App**;
3. marque o target **App** em *Target Membership*;
4. confira que ele aparece em *Build Phases → Copy Bundle Resources*.

**Sem esse passo a Apple rejeita a submissão**, mesmo com o arquivo no
repositório.

---

## Os dois buracos conhecidos, que a submissão vai expor

Nenhum dos dois é configuração esquecida. São trabalho que falta, e é melhor
saber agora do que numa reprovação.

### 1. GPS em segundo plano — implementado, nunca testado

`src/hooks/useRunTracker.ts` usava só `navigator.geolocation`, que o sistema
suspende quando a tela bloqueia — justamente a situação de uma corrida real.
Agora, quando o app é nativo, ele usa
`@transistorsoft/capacitor-background-geolocation`
(`src/services/localizacaoEmSegundoPlano.ts`); na web segue pelo navegador.

Já declarados: `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE` e
`FOREGROUND_SERVICE_LOCATION` no Android; `UIBackgroundModes: location` e
`NSLocationAlwaysAndWhenInUseUsageDescription` no iOS.

**O que ainda é seu:**

- **A licença.** O plugin é comercial (licença `CUSTOM`). Confira os termos e
  o custo com a Transistor Software e aplique a chave de licença conforme as
  instruções deles — não inventei o nome da chave aqui porque não consegui
  abrir a documentação deles desta sessão.
- **A justificativa de background nas duas lojas.** A Google analisa pedido de
  localização em segundo plano com rigor e reprova justificativa vaga. A do
  app: medir a corrida inteira sem a pessoa precisar manter a tela acesa.
- **Testar correndo.** Nada disto rodou num aparelho. Localização em segundo
  plano só se prova com o celular no bolso, tela apagada, na rua. Compare a
  distância do RUSH com a de um relógio ou outro app na mesma corrida.

### 2. Notificações

`src/hooks/usePushNotifications.ts` é Web Push puro: service worker em
`/sw.js` e chaves VAPID. Isso **não funciona** dentro do app nativo, que
precisa de APNs no iOS e FCM no Android, via plugin de push do Capacitor.

O caminho web continua valendo para o site — o que existe hoje não some, só
não atende o app empacotado.

---

## Antes de submeter

- [ ] `VITE_API_URL` no build e `CORS_ORIGIN` no servidor
- [x] Ícones da marca em todas as densidades — feito
- [ ] `PrivacyInfo.xcprivacy` adicionado ao target no Xcode (passo manual acima)
- [ ] Telas de abertura (splash) por densidade
- [x] GPS em segundo plano implementado — **falta licenciar e testar na rua**
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
