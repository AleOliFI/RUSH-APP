// ============================================================
// RUSH RUNNING — Três defeitos que só apareceram usando o app
// ------------------------------------------------------------
// Os testes de rota do módulo do treinador passavam, e mesmo assim
// o app tinha três problemas que só um passeio de verdade mostrou.
// Ficam presos aqui.
//
// 1. BECO SEM SAÍDA NA NAVEGAÇÃO. O módulo do treinador vive dentro
//    da aba Perfil, e o painel da equipe não tem botão de sair.
//    Tocar em "Perfil" na barra de baixo só trocava a rota, sem
//    zerar a navegação interna da aba — e devolvia o painel de
//    novo. Quem abrisse o painel não voltava mais ao próprio perfil
//    na sessão inteira. Valia também para Ajustes e Excluir conta.
//
// 2. UNIDADE DO DESAFIO SUMIDA. A coluna é `target_unit` e a rota
//    devolve `c.*`; o feed lia `activeChallenge.unit`, que nunca
//    existiu. A unidade sumia nas três leituras, e um desafio de
//    "100 km" aparecia igual a um de "100 treinos".
//
// 3. NÍVEL EM INGLÊS NA TELA. A ficha do atleta e o plano completo
//    imprimiam `plan.level` cru — "Semana 1 de 6 • beginner". O app
//    já traduzia isso em três outros lugares.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');

let passaram = 0;
let falharam = 0;

function teste(nome, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${nome}`);
    passaram += 1;
  } catch (err) {
    console.log(`  ❌ [FAIL] ${nome}`);
    console.log(`     ${err.message}`);
    falharam += 1;
  }
}

const ler = (...partes) => fs.readFileSync(path.join(RAIZ, ...partes), 'utf8');

console.log('\n============================================================');
console.log('📌 ACHADOS DO PASSEIO PELO APP');
console.log('============================================================\n');

teste('T1: tocar numa aba zera a navegação interna da aba Perfil', () => {
  const shell = ler('src', 'RushShell.tsx');
  const fn = /const goToTab = useCallback\(([\s\S]*?)\n  \);/.exec(shell);
  assert.ok(fn, 'não achei goToTab');
  assert.ok(/setCoachView\(null\)/.test(fn[1]),
    'sem isto, quem abre o painel da equipe não volta ao próprio perfil: '
    + 'o painel não tem botão de sair e a aba devolve o painel de novo');
  assert.ok(/setProfileView\('perfil'\)/.test(fn[1]),
    'o mesmo beco existe em Ajustes e Excluir conta');
});

teste('T2: o painel da equipe continua sem botão de sair próprio', () => {
  // Não é cobrança de botão: é a razão de T1 existir. Se um dia o
  // painel ganhar saída própria, este teste cai e quem mexer vai ler
  // T1 e decidir conscientemente.
  const painel = ler('src', 'screens', 'CoachDashboardScreen.tsx');
  const temSaida = /onVoltar/.test(painel);
  assert.ok(!temSaida,
    'o painel ganhou saída própria — reavalie T1, que existe porque ele não tinha');
});

teste('T3: o feed lê a unidade do desafio pelo nome que o servidor manda', () => {
  const feed = ler('src', 'screens', 'FeedScreen.tsx');
  assert.ok(!/activeChallenge\.unit\b/.test(feed),
    '`unit` não existe: a coluna é target_unit e a rota devolve c.*');
  assert.ok(/activeChallenge\.target_unit/.test(feed),
    'sem a unidade, "100 km" e "100 treinos" aparecem iguais');

  // E o nome do campo tem de bater com o schema, não com a minha memória.
  const schema = ler('server', 'database', 'schema.js');
  assert.ok(/target_unit TEXT NOT NULL/.test(schema),
    'a coluna mudou de nome; o feed precisa acompanhar');
});

teste('T4: nenhuma tela imprime o nível de treino cru em inglês', () => {
  const telas = ['CoachAthleteScreen', 'FullPlanScreen'];
  for (const tela of telas) {
    const texto = ler('src', 'screens', `${tela}.tsx`);
    // `{plan.level}` sem passar pelo tradutor.
    const cru = /\{\s*plan\.level\s*\}|\$\{plan\.level\}|` • \$\{plan\.level\}`/.test(texto);
    assert.ok(!cru, `${tela} voltou a mostrar "beginner" na tela`);
    if (/plan\.level/.test(texto)) {
      assert.ok(/rotuloDoNivel\(/.test(texto),
        `${tela} usa plan.level sem traduzir`);
    }
  }
});

teste('T5: a tradução de nível tem uma fonte só', () => {
  const niveis = ler('src', 'data', 'niveis.ts');
  for (const esperado of ['beginner', 'intermediate', 'advanced']) {
    assert.ok(niveis.includes(esperado), `o nível ${esperado} sumiu da lista`);
  }
  // As telas que oferecem escolha de nível bebem da mesma lista.
  for (const tela of ['CoachPlanScreen', 'CoachAthletesScreen']) {
    const texto = ler('src', 'screens', `${tela}.tsx`);
    assert.ok(/NIVEIS_DE_TREINO/.test(texto),
      `${tela} voltou a ter a própria lista de níveis, que vai divergir`);
  }
});

console.log('\n============================================================');
console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
console.log('============================================================');
process.exit(falharam > 0 ? 1 : 0);
