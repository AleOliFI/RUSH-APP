// ============================================================
// RUSH RUNNING — Rota literal tem de vir antes da coringa
// ------------------------------------------------------------
// O Express casa as rotas na ORDEM em que foram registradas. Uma
// rota coringa como GET /:username aceita qualquer coisa — então
// tudo que for registrado depois dela, com o mesmo verbo, nunca é
// alcançado.
//
// Foi o que aconteceu com a zona de privacidade: GET
// /users/privacy-zone estava declarado depois de GET /:username e
// era atendido pela busca de perfil, devolvendo "Usuário não
// encontrado". O PUT e o DELETE funcionavam, porque não existe
// /:username para esses verbos — então a zona era gravada e nunca
// lida de volta. A tela mostrava "nenhuma zona configurada" logo
// depois de a pessoa salvar uma, e nada no log acusava erro.
//
// O teste vale para todos os roteadores: é uma armadilha da forma
// do Express, não um descuido de um arquivo só.
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DIR_ROTAS = path.join(__dirname, '..', 'routes');

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

/** Segmentos não vazios do caminho: '/a/:b' → ['a', ':b']. */
function segmentos(caminho) {
  return caminho.split('/').filter(Boolean);
}

/** O caminho tem algum parâmetro? (`/:username`, `/:id/leaderboard`) */
function temParametro(caminho) {
  return segmentos(caminho).some((s) => s.startsWith(':'));
}

/**
 * O padrão engole o caminho literal?
 *
 * Compara segmento a segmento, e não só o primeiro: '/:id/leaderboard'
 * exige que o segundo segmento seja exatamente "leaderboard", então ele
 * NÃO alcança '/achievements/my' — os dois convivem em qualquer ordem.
 * Uma versão anterior deste teste olhava só o primeiro segmento e
 * acusava esse par como erro.
 */
function engole(padrao, literal) {
  const p = segmentos(padrao);
  const l = segmentos(literal);
  if (p.length !== l.length) return false;
  return p.every((seg, i) => seg.startsWith(':') || seg === l[i]);
}

/** Rotas do roteador, na ordem de registro. */
function rotasDe(router) {
  return router.stack
    .filter((camada) => camada.route)
    .map((camada) => ({
      caminho: camada.route.path,
      metodos: Object.keys(camada.route.methods).filter((m) => m !== '_all'),
    }));
}

console.log('\n============================================================');
console.log('📌 ORDEM DE ROTAS: LITERAL ANTES DA CORINGA');
console.log('============================================================');

const db = new Database(':memory:');
const arquivos = fs.readdirSync(DIR_ROTAS).filter((n) => n.endsWith('.js'));

assert.ok(arquivos.length > 0, 'nenhum roteador encontrado');

for (const arquivo of arquivos) {
  const criar = require(path.join(DIR_ROTAS, arquivo));
  if (typeof criar !== 'function') continue;

  let router;
  try {
    router = criar(db);
  } catch (err) {
    // Um roteador que precisa de outra coisa para montar não entra
    // no teste, mas também não passa despercebido.
    console.log(`  ⚠️  ${arquivo}: não foi possível montar (${err.message})`);
    continue;
  }
  if (!router || !Array.isArray(router.stack)) continue;

  const rotas = rotasDe(router);

  teste(`${arquivo}: nenhuma rota literal fica atrás de uma coringa`, () => {
    const engolidas = [];

    rotas.forEach((rota, i) => {
      if (temParametro(rota.caminho)) return;

      // Alguma coringa registrada ANTES desta, no mesmo verbo, que
      // realmente case com este caminho?
      for (let j = 0; j < i; j += 1) {
        const anterior = rotas[j];
        if (!temParametro(anterior.caminho)) continue;
        if (!engole(anterior.caminho, rota.caminho)) continue;

        const verbosEmComum = rota.metodos.filter((m) => anterior.metodos.includes(m));
        if (verbosEmComum.length > 0) {
          engolidas.push(
            `${verbosEmComum.join('/').toUpperCase()} ${rota.caminho} nunca é alcançada: ` +
            `${anterior.caminho} foi registrada antes e casa com ela`,
          );
        }
      }
    });

    assert.deepStrictEqual(engolidas, [], '\n     ' + engolidas.join('\n     '));
  });
}

// A rota que originou o teste, verificada pelo nome.
teste('users.js: GET /privacy-zone vem antes de GET /:username', () => {
  const router = require(path.join(DIR_ROTAS, 'users.js'))(db);
  const rotas = rotasDe(router);

  const posZona = rotas.findIndex((r) => r.caminho === '/privacy-zone' && r.metodos.includes('get'));
  const posCoringa = rotas.findIndex((r) => r.caminho === '/:username' && r.metodos.includes('get'));

  assert.ok(posZona !== -1, 'GET /privacy-zone sumiu do roteador');
  assert.ok(posCoringa !== -1, 'GET /:username sumiu do roteador');
  assert.ok(
    posZona < posCoringa,
    `GET /privacy-zone está na posição ${posZona} e /:username na ${posCoringa}: ` +
    'a leitura da zona volta a ser engolida pela busca de perfil',
  );
});

db.close();

console.log('\n============================================================');
console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
console.log('============================================================');
if (falharam > 0) process.exit(1);
