// ============================================================
// RUSH RUNNING — Privacidade e termos, e o que eles prometem
// ------------------------------------------------------------
// As duas lojas exigem uma política de privacidade com URL
// pública. Isso é fácil de cumprir mal: publica-se um texto
// genérico, o app segue coletando outra coisa, e a política vira
// uma declaração falsa — o que, com dado de saúde sob LGPD, é bem
// pior do que não ter página nenhuma.
//
// Por isso este teste não confere só que a página existe. Ele
// amarra o TEXTO ao SCHEMA: cada categoria de dado que o app
// realmente coleta precisa aparecer descrita. Se alguém adicionar
// coleta nova sem atualizar a política, isto quebra — que é
// exatamente quando precisa doer.
//
// E confere a armadilha de roteamento: a rota não pode passar por
// PublicRoute, que redireciona quem JÁ está autenticado. Uma
// política que some para quem usa o app não cumpre a exigência.
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
console.log('📌 DOCUMENTOS LEGAIS');
console.log('============================================================\n');

const textos = fs.readFileSync(path.join(RAIZ, 'src', 'data', 'textosLegais.ts'), 'utf8');
const tela = fs.readFileSync(path.join(RAIZ, 'src', 'screens', 'LegalScreen.tsx'), 'utf8');
const rotas = fs.readFileSync(path.join(RAIZ, 'src', 'App.jsx'), 'utf8');
const ajustes = fs.readFileSync(path.join(RAIZ, 'src', 'screens', 'SettingsScreen.tsx'), 'utf8');
const schema = fs.readFileSync(path.join(RAIZ, 'server', 'database', 'schema.js'), 'utf8');

// ------------------------------------------------------------
// 1. As rotas existem e sao publicas de verdade
// ------------------------------------------------------------

registrar(/path="\/privacidade"/.test(rotas) && /path="\/termos"/.test(rotas),
  'C1: as rotas /privacidade e /termos existem');

// O <Route> de cada documento nao pode estar envolvido por
// PublicRoute (que expulsa quem esta logado) nem por ProtectedRoute
// (que expulsa quem nao esta).
const linhasDeRota = rotas
  .split('\n')
  .filter((l) => /path="\/(privacidade|termos)"/.test(l));
const rotaProtegida = linhasDeRota.some((l) => /PublicRoute|ProtectedRoute/.test(l));
registrar(linhasDeRota.length === 2 && !rotaProtegida,
  'C2: as duas páginas abrem sem login E sem serem expulsas por já estar logado',
  linhasDeRota.join(' | '));

// Os caminhos podem vir como atributo literal ou de uma lista
// (href={doc.href}); o que importa e que os dois estejam la.
registrar(/['"]\/privacidade['"]/.test(ajustes) && /['"]\/termos['"]/.test(ajustes),
  'C3: os Ajustes levam aos dois documentos');

// ------------------------------------------------------------
// 2. O texto cobre o que o app COLETA de verdade
// ------------------------------------------------------------

// Cada item: uma tabela/coluna que prova a coleta, e um termo que
// precisa aparecer na politica descrevendo-a.
const COBERTURA = [
  { prova: 'CREATE TABLE IF NOT EXISTS hrv_measurements', termo: /variabilidade da frequ[êe]ncia card[íi]aca|VFC/i, o: 'VFC' },
  { prova: 'CREATE TABLE IF NOT EXISTS activity_hr_samples', termo: /frequ[êe]ncia card[íi]aca durante as atividades|batida a batida/i, o: 'amostras de FC' },
  { prova: 'CREATE TABLE IF NOT EXISTS menstrual_tracking', termo: /ciclo menstrual/i, o: 'ciclo menstrual' },
  { prova: 'CREATE TABLE IF NOT EXISTS activity_tracks', termo: /GPS|localiza[çc][ãa]o/i, o: 'GPS / localização' },
  { prova: 'CREATE TABLE IF NOT EXISTS privacy_zones', termo: /zonas de privacidade/i, o: 'zonas de privacidade' },
  { prova: 'CREATE TABLE IF NOT EXISTS push_subscriptions', termo: /notifica[çc][õo]es/i, o: 'notificações' },
  { prova: 'CREATE TABLE IF NOT EXISTS wearable_devices', termo: /dispositivos vest[íi]veis|sensor/i, o: 'wearables' },
  { prova: 'CREATE TABLE IF NOT EXISTS subscriptions', termo: /assinatura/i, o: 'assinatura' },
  { prova: 'CREATE TABLE IF NOT EXISTS academies', termo: /treinador|assessoria/i, o: 'compartilhamento com treinador' },
  { prova: 'CREATE TABLE IF NOT EXISTS shoes', termo: /cal[çc]ados/i, o: 'calçados' },
  { prova: 'CREATE TABLE IF NOT EXISTS comments', termo: /coment[áa]rios/i, o: 'comentários' },
  { prova: 'CREATE TABLE IF NOT EXISTS follows', termo: /seguidores/i, o: 'seguidores' },
  { prova: 'date_of_birth', termo: /data de nascimento/i, o: 'data de nascimento' },
  { prova: 'weight_kg', termo: /peso/i, o: 'peso' },
  { prova: 'gender', termo: /g[êe]nero/i, o: 'gênero' },
];

const naoCobertos = COBERTURA
  .filter((c) => schema.includes(c.prova))
  .filter((c) => !c.termo.test(textos));

registrar(naoCobertos.length === 0,
  'C4: toda categoria de dado coletada aparece descrita na política',
  `o app coleta mas a política não menciona: ${naoCobertos.map((c) => c.o).join(', ')}`);

// ------------------------------------------------------------
// 3. Honestidades que o texto nao pode perder
// ------------------------------------------------------------

registrar(/exclus[ãa]o é lógica|permanece na base/i.test(textos),
  'C5: a política admite que a exclusão de conta é lógica',
  'DELETE /users/me faz UPDATE deleted_at — descrever como apagamento total seria declaração falsa');

registrar(/n[ãa]o é um dispositivo médico/i.test(textos) && /n[ãa]o substitui/i.test(textos),
  'C6: os termos dizem que o app não é dispositivo médico',
  'um app que prescreve carga a partir de VFC precisa dizer isso');

registrar(/art\. 11|sens[íi]vel/i.test(textos),
  'C7: a política reconhece dado de saúde como sensível sob a LGPD');

registrar(/n[ãa]o vende dados|n[ãa]o os compartilha com anunciantes/i.test(textos),
  'C8: a política declara que não há venda de dados nem publicidade');

// ------------------------------------------------------------
// 4. Os marcadores pendentes sao visiveis, e nao inventados
// ------------------------------------------------------------

// Eu nao invento razao social nem CNPJ. Os marcadores precisam
// continuar berrando ate alguem preenche-los.
registrar(/PREENCHER/.test(textos),
  'C9: os campos que dependem do dono seguem marcados, sem dado inventado');

const docs = ['declaracao-saude-google.md', 'apple-privacy-labels.md']
  .filter((f) => fs.existsSync(path.join(RAIZ, 'docs', f)));
registrar(docs.length === 2, 'C10: os dois guias de console foram escritos',
  `faltando: ${['declaracao-saude-google.md', 'apple-privacy-labels.md'].filter((f) => !docs.includes(f)).join(', ')}`);

console.log('\n============================================================');
console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
console.log('============================================================');
process.exit(falharam > 0 ? 1 : 0);
