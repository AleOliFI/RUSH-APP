// ============================================================
// RUSH RUNNING — O empacotamento nativo está coerente
// ------------------------------------------------------------
// O app virou também um app nativo (Capacitor), e isso cria uma
// classe de erro que NÃO aparece na web: o que funciona pelo
// navegador falha calado dentro do webview.
//
// O caso central é o endereço da API. Na web, `/api` resolve
// porque frontend e servidor saem da mesma origem. No app
// empacotado a origem é `https://localhost` (Android) ou
// `capacitor://localhost` (iOS), e `/api` aponta para o próprio
// webview — que não serve rota nenhuma. O app compila, instala,
// abre, e falha em toda chamada de rede sem erro visível.
//
// Este teste não compila nada: compilar exige SDK do Android e,
// para iOS, um Mac. Ele cobra a CONFIGURAÇÃO, que é o que dá para
// verificar honestamente daqui.
// ============================================================

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');

let passaram = 0;
let falharam = 0;

function registrar(ok, nome, detalhe) {
  if (ok) {
    console.log(`  ✅ [PASS] ${nome}`);
    passaram += 1;
  } else {
    console.log(`  ❌ [FAIL] ${nome}`);
    if (detalhe) console.log(`     ${detalhe}`);
    falharam += 1;
  }
}

console.log('\n============================================================');
console.log('📌 EMPACOTAMENTO NATIVO');
console.log('============================================================\n');

const config = fs.readFileSync(path.join(RAIZ, 'capacitor.config.ts'), 'utf8');
const api = fs.readFileSync(path.join(RAIZ, 'src', 'api.ts'), 'utf8');
const servidor = fs.readFileSync(path.join(RAIZ, 'server', 'index.js'), 'utf8');

// ------------------------------------------------------------
// 1. A URL da API precisa ser configuravel
// ------------------------------------------------------------

const semComentarios = api
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

registrar(/VITE_API_URL/.test(semComentarios),
  'C1: o endereço da API sai de VITE_API_URL',
  'API_BASE voltou a ser literal — dentro do webview isso não resolve');

registrar(/return '\/api'/.test(semComentarios),
  'C2: e cai em /api quando a variável não existe',
  'sem a queda, o app web quebraria junto');

// O .env deste projeto trazia VITE_API_URL=http://localhost:3001,
// SEM /api — e toda rota do servidor vive sob /api. Sem normalizar,
// essa forma faz o app chamar /auth/login e falhar calado.
registrar(/\/api\$\/\.test/.test(semComentarios) && /\$\{semBarra\}\/api/.test(semComentarios),
  'C2b: a variável aceita o endereço com ou sem o sufixo /api',
  'a forma sem /api (que o .env já usava) voltaria a falhar sem erro visível');

// ------------------------------------------------------------
// 2. O servidor precisa aceitar a origem do webview
// ------------------------------------------------------------

registrar(/capacitor:\/\/localhost/.test(servidor) && /https:\/\/localhost/.test(servidor),
  'C3: o CORS do servidor conhece as origens do app nativo',
  'sem elas o app empacotado leva CORS em toda chamada');

registrar(/CORS_ORIGIN/.test(servidor) && /split\(','\)/.test(servidor),
  'C4: CORS_ORIGIN aceita uma lista, e não uma origem só');

// ------------------------------------------------------------
// 3. Configuracao do Capacitor
// ------------------------------------------------------------

registrar(/webDir:\s*'dist'/.test(config), 'C5: o Capacitor publica o build do Vite (dist)');
registrar(/appId:\s*'[a-z0-9.]+'/.test(config), 'C6: há um appId em domínio reverso');

// androidScheme https nao e detalhe: com http o Android trata a
// origem como insegura e bloqueia APIs — entre elas geolocalizacao.
registrar(/androidScheme:\s*'https'/.test(config),
  'C7: o Android roda em contexto seguro (androidScheme https)',
  'com http o webview perde geolocalização e armazenamento');

// ------------------------------------------------------------
// 4. Os projetos nativos existem
// ------------------------------------------------------------

const manifesto = path.join(RAIZ, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
registrar(fs.existsSync(manifesto), 'C8: o projeto Android foi gerado');

if (fs.existsSync(manifesto)) {
  const xml = fs.readFileSync(manifesto, 'utf8');
  registrar(/ACCESS_FINE_LOCATION/.test(xml),
    'C9: o Android declara permissão de localização',
    'sem ela o webview não recebe posição e toda corrida termina com 0 km');
}

registrar(fs.existsSync(path.join(RAIZ, 'ios', 'App')), 'C10: o projeto iOS foi gerado');

// ------------------------------------------------------------
// iOS: as duas coisas sem as quais nao se publica
// ------------------------------------------------------------

// Sem esta chave o iOS ENCERRA o app quando ele pede localizacao.
// Nao e reprovacao na revisao — e o app fechando na primeira corrida.
const infoPlist = path.join(RAIZ, 'ios', 'App', 'App', 'Info.plist');
if (fs.existsSync(infoPlist)) {
  const plist = fs.readFileSync(infoPlist, 'utf8');
  registrar(/NSLocationWhenInUseUsageDescription/.test(plist),
    'C10b: o Info.plist descreve o uso de localização',
    'sem esta chave o sistema encerra o app ao pedir GPS');

  // Pedir permissao que o app nao usa e motivo de reprovacao. Nao ha
  // plugin de localizacao em segundo plano aqui ainda.
  registrar(!/NSLocationAlwaysAndWhenInUseUsageDescription/.test(plist),
    'C10c: não declara localização em segundo plano, que ainda não existe',
    'declarar permissão não usada é motivo de reprovação');
}

// Obrigatorio pela Apple desde 2024.
const manifestoPrivacidade = path.join(RAIZ, 'ios', 'App', 'App', 'PrivacyInfo.xcprivacy');
registrar(fs.existsSync(manifestoPrivacidade), 'C10d: o manifesto de privacidade do iOS existe');

if (fs.existsSync(manifestoPrivacidade)) {
  const xml = fs.readFileSync(manifestoPrivacidade, 'utf8');
  // O app coleta dado de saude e localizacao precisa. Se o manifesto
  // nao disser isso, ele esta mentindo por omissao.
  for (const [chave, rotulo] of [
    ['NSPrivacyCollectedDataTypeHealth', 'saúde'],
    ['NSPrivacyCollectedDataTypePreciseLocation', 'localização precisa'],
  ]) {
    registrar(xml.includes(chave), `C10e: o manifesto declara ${rotulo}`);
  }
}

// O icone precisa ser a MARCA, e nao o padrao que o Capacitor instala.
// O padrao e um arquivo com data de criacao do template; a checagem
// aqui e pelo conteudo: o PNG da marca tem fundo carbono.
const iconeAndroid = path.join(RAIZ, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi', 'ic_launcher.png');
if (fs.existsSync(iconeAndroid)) {
  const png = fs.readFileSync(iconeAndroid);
  // Largura/altura ficam nos bytes 16..24 do cabecalho IHDR.
  const largura = png.readUInt32BE(16);
  registrar(largura === 192, 'C10f: o ícone xxxhdpi tem a dimensão certa (192px)', `veio ${largura}px`);
}

// Os assets copiados para dentro do android/ sao build, nao fonte.
const gitignoreAndroid = fs.existsSync(path.join(RAIZ, 'android', '.gitignore'))
  ? fs.readFileSync(path.join(RAIZ, 'android', '.gitignore'), 'utf8')
  : '';
registrar(/assets\/public/.test(gitignoreAndroid),
  'C11: a cópia do dist dentro do android/ fica fora do versionamento',
  'são 2,7 MB de build que mudam a cada compilação');

// ------------------------------------------------------------
// 5. Os limites conhecidos estao ESCRITOS, nao escondidos
// ------------------------------------------------------------

const guia = path.join(RAIZ, 'docs', 'compilar-nativo.md');
registrar(fs.existsSync(guia), 'C12: existe guia de compilação');

if (fs.existsSync(guia)) {
  const texto = fs.readFileSync(guia, 'utf8');
  registrar(/segundo plano/i.test(texto) && /ACCESS_BACKGROUND_LOCATION/.test(texto),
    'C13: o guia avisa que o GPS não sobrevive à tela bloqueada',
    'é o limite mais grave da fase; escondê-lo vira reprovação na loja');
  registrar(/APNs|FCM/.test(texto),
    'C14: o guia avisa que o push web não atende o app nativo');
  registrar(/VITE_API_URL/.test(texto),
    'C15: o guia destaca a variável sem a qual o app falha calado');
}

console.log('\n============================================================');
console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
console.log('============================================================');
process.exit(falharam > 0 ? 1 : 0);
