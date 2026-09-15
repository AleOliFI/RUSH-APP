// ============================================================
// RUSH RUNNING — A FCmáx medida vence a estimada
// ------------------------------------------------------------
// O app tinha duas fontes de verdade para a frequência cardíaca
// máxima, e consultava a errada.
//
// O teste de campo mede a FCmáx do atleta e grava em
// user_profiles.hr_max_tested. Mas /api/hrv/zones, a distribuição
// por zona de cada treino e a sugestão diária recalculavam tudo
// pela fórmula por idade — uma média populacional — mesmo com o
// número real no banco.
//
// O tamanho do erro, medido: um atleta de 30 anos com FCmáx real
// de 201 recebia zonas montadas sobre 188. O treino de limiar saía
// como 150–169 bpm quando o limiar dele começa em 161. Ou seja: ele
// treinava em Z3 achando que estava em Z4, e o app ainda lhe dizia
// "zonas individualizadas salvas" ao fim do teste.
//
// A precedência mora dentro de calculateMaxHr, e não em cada
// chamador, justamente para que nenhuma tela volte a usar a
// estimativa por esquecimento. Estes testes cobrem as duas coisas:
// a regra, e o fato de cada chamador passar o campo.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { calculateMaxHr, calculateHrZones } = require('../agent/trainingAgent');

const RAIZ = path.join(__dirname, '..');

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

console.log('\n============================================================');
console.log('📌 FCMÁX MEDIDA VENCE A ESTIMADA');
console.log('============================================================');

const ATLETA = { age: 30, gender: 'male', weightKg: 75, heightCm: 180 };

teste('F1: sem teste de campo, a estimativa por idade continua valendo', () => {
  const estimada = calculateMaxHr(ATLETA);
  assert.ok(estimada > 150 && estimada < 210, `estimativa fora do razoável: ${estimada}`);
});

teste('F2: com FCmáx medida, ela é usada exatamente como está', () => {
  assert.strictEqual(calculateMaxHr({ ...ATLETA, hrMaxTested: 201 }), 201);
});

teste('F3: vale também quando a medida é MENOR que a estimativa', () => {
  // O caso perigoso de se errar: prescrever acima do que o atleta
  // aguenta é pior do que prescrever abaixo.
  const estimada = calculateMaxHr(ATLETA);
  const medida = 178;
  assert.ok(medida < estimada, 'o caso de teste precisa ter medida < estimada');
  assert.strictEqual(calculateMaxHr({ ...ATLETA, hrMaxTested: medida }), medida);
});

teste('F4: valor impossível é ignorado em favor da estimativa', () => {
  const estimada = calculateMaxHr(ATLETA);
  for (const absurdo of [300, 40, 0, -1, NaN, 'abc', {}, []]) {
    assert.strictEqual(
      calculateMaxHr({ ...ATLETA, hrMaxTested: absurdo }), estimada,
      `${JSON.stringify(absurdo)} não podia ter sido aceito como FCmáx`,
    );
  }
});

teste('F5: número em texto é aceito (o driver devolve assim às vezes)', () => {
  // node-postgres entrega alguns tipos numéricos como string. Se a
  // comparação fosse estrita, a FCmáx medida seria descartada em
  // Postgres e mantida em SQLite — o pior tipo de divergência.
  assert.strictEqual(calculateMaxHr({ ...ATLETA, hrMaxTested: '195' }), 195);
});

teste('F6: null e undefined caem na estimativa, sem erro', () => {
  const estimada = calculateMaxHr(ATLETA);
  assert.strictEqual(calculateMaxHr({ ...ATLETA, hrMaxTested: null }), estimada);
  assert.strictEqual(calculateMaxHr({ ...ATLETA, hrMaxTested: undefined }), estimada);
});

teste('F7: as zonas inteiras se deslocam junto com a FCmáx', () => {
  const comTeste = calculateHrZones(calculateMaxHr({ ...ATLETA, hrMaxTested: 201 }));
  const semTeste = calculateHrZones(calculateMaxHr(ATLETA));

  for (const z of ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']) {
    assert.ok(
      comTeste[z].minBpm > semTeste[z].minBpm,
      `${z} não subiu com uma FCmáx maior (${semTeste[z].minBpm} → ${comTeste[z].minBpm})`,
    );
  }
  // Z5 termina na própria FCmáx: é o teto, e não uma fração dele.
  assert.strictEqual(comTeste.Z5.maxBpm, 201);
});

teste('F8: as zonas continuam contíguas e crescentes', () => {
  const z = calculateHrZones(calculateMaxHr({ ...ATLETA, hrMaxTested: 201 }));
  const ordem = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];
  for (let i = 0; i < ordem.length; i += 1) {
    const atual = z[ordem[i]];
    assert.ok(atual.maxBpm > atual.minBpm, `${ordem[i]} tem faixa invertida`);
    if (i > 0) {
      assert.strictEqual(
        atual.minBpm, z[ordem[i - 1]].maxBpm,
        `há um buraco entre ${ordem[i - 1]} e ${ordem[i]}`,
      );
    }
  }
});

// ---------- cada chamador precisa passar o campo ----------
// A regra acima só protege quem a alimenta. Um chamador que esqueça
// de passar hrMaxTested volta a prescrever pela estimativa, sem erro
// nenhum aparecer.

const CHAMADORES = [
  ['routes/hrv.js', path.join(RAIZ, 'routes', 'hrv.js'), 2],
  ['routes/activities.js', path.join(RAIZ, 'routes', 'activities.js'), 1],
];

for (const [nome, caminho, minimo] of CHAMADORES) {
  teste(`F9: ${nome} passa hrMaxTested ao montar o perfil`, () => {
    const fonte = fs.readFileSync(caminho, 'utf8');
    const quantos = (fonte.match(/hrMaxTested\s*:/g) || []).length;
    assert.ok(
      quantos >= minimo,
      `esperava ao menos ${minimo} ocorrência(s) de hrMaxTested, achei ${quantos} — ` +
      'algum ponto voltou a calcular zonas pela estimativa por idade',
    );
  });
}

teste('F10: /hrv/zones informa a origem da FCmáx', () => {
  // Sem isso a tela não tem como distinguir "medido em você" de
  // "média de gente da sua idade", e apresentar os dois do mesmo
  // jeito é enganar quem lê.
  const fonte = fs.readFileSync(path.join(RAIZ, 'routes', 'hrv.js'), 'utf8');
  assert.ok(/max_hr_source/.test(fonte), 'a resposta precisa dizer de onde veio a FCmáx');
  assert.ok(/'field_test'/.test(fonte) && /'age_estimate'/.test(fonte),
    'as duas origens precisam existir');
});

console.log('\n============================================================');
console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
console.log('============================================================');
if (falharam > 0) process.exit(1);
