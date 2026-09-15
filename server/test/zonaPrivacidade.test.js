// ============================================================
// RUSH RUNNING — Zona de privacidade do percurso
// ------------------------------------------------------------
// Esta é a única parte do app onde um erro expõe o endereço de
// alguém. Os testes abaixo tratam cada engano possível como a
// falha que ele seria na vida real, e não como um assert a mais.
// ============================================================

const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { Database } = require('../database/sqlite');
const { recortarTracado, distanciaMetros, aplicarZona } = require('../services/zonaPrivacidade');

let passaram = 0;
let falharam = 0;

async function teste(nome, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${nome}`);
    passaram += 1;
  } catch (err) {
    console.log(`  ❌ [FAIL] ${nome}`);
    console.log(`     ${err.message}`);
    falharam += 1;
  }
}

/** Casa fictícia em São Paulo. */
const CASA = { lat: -23.5505, lon: -46.6333, radius_m: 500 };

/** Desloca um ponto N metros para o norte. */
function aoNorte(metros) {
  return { lat: CASA.lat + metros / 111320, lon: CASA.lon };
}

(async () => {
  console.log('\n============================================================');
  console.log('📌 ZONA DE PRIVACIDADE DO PERCURSO');
  console.log('============================================================');

  await teste('Z1: a Haversine mede o que o raio promete', () => {
    const d = distanciaMetros(CASA, aoNorte(1000));
    assert.ok(Math.abs(d - 1000) < 5, `esperado ~1000 m, veio ${d.toFixed(1)}`);
  });

  await teste('Z2: corrida que sai de casa e volta perde as duas pontas', () => {
    // Sai de casa (0 m), vai até 3 km ao norte e volta.
    const pontos = [];
    for (const m of [0, 200, 400, 800, 1500, 3000, 1500, 800, 400, 200, 0]) {
      pontos.push(aoNorte(m));
    }
    const r = recortarTracado(pontos, CASA);

    assert.strictEqual(r.removed_start, 3, 'os pontos a 0, 200 e 400 m estão dentro do raio de 500');
    assert.strictEqual(r.removed_end, 3, 'as três voltas finais também');
    assert.strictEqual(r.points.length, 5);

    // O que sobrou não pode ter NENHUM ponto dentro da zona.
    for (const p of r.points) {
      assert.ok(distanciaMetros(p, CASA) > CASA.radius_m,
        `sobrou um ponto a ${distanciaMetros(p, CASA).toFixed(0)} m de casa`);
    }
  });

  await teste('Z3: o ponto que sobra é o primeiro FORA da zona, não o de dentro', () => {
    const pontos = [aoNorte(0), aoNorte(499), aoNorte(501), aoNorte(2000)];
    const r = recortarTracado(pontos, CASA);
    assert.strictEqual(r.removed_start, 2, '499 m ainda está dentro do raio de 500');
    assert.ok(Math.abs(distanciaMetros(r.points[0], CASA) - 501) < 2);
  });

  await teste('Z4: corrida inteira dentro da zona não mostra nada', () => {
    const pontos = [aoNorte(0), aoNorte(100), aoNorte(200), aoNorte(50)];
    const r = recortarTracado(pontos, CASA);
    assert.strictEqual(r.points.length, 0, 'não pode sobrar nenhum ponto');
    assert.strictEqual(r.fully_hidden, true, 'a tela precisa saber que escondeu tudo');
  });

  await teste('Z5: corrida longe de casa não é tocada', () => {
    const pontos = [aoNorte(5000), aoNorte(6000), aoNorte(7000)];
    const r = recortarTracado(pontos, CASA);
    assert.strictEqual(r.points.length, 3);
    assert.strictEqual(r.removed_start, 0);
    assert.strictEqual(r.removed_end, 0);
  });

  await teste('Z6: passar perto de casa no MEIO não corta o percurso em dois', () => {
    // Sai longe, passa rente a casa, e termina longe. O recorte é de
    // pontas: o meio continua, senão a corrida ficaria partida.
    const pontos = [aoNorte(3000), aoNorte(1500), aoNorte(100), aoNorte(1500), aoNorte(3000)];
    const r = recortarTracado(pontos, CASA);
    assert.strictEqual(r.removed_start, 0, 'começou longe: nada a cortar no início');
    assert.strictEqual(r.removed_end, 0, 'terminou longe: nada a cortar no fim');
    assert.strictEqual(r.points.length, 5);
  });

  await teste('Z7: sem zona configurada, o traçado sai inteiro', () => {
    const pontos = [aoNorte(0), aoNorte(1000)];
    const r = recortarTracado(pontos, null);
    assert.strictEqual(r.points.length, 2);
  });

  await teste('Z8: raio maior esconde mais', () => {
    const pontos = [aoNorte(0), aoNorte(600), aoNorte(1200), aoNorte(3000)];
    const curto = recortarTracado(pontos, { ...CASA, radius_m: 500 });
    const longo = recortarTracado(pontos, { ...CASA, radius_m: 1000 });
    assert.strictEqual(curto.removed_start, 1);
    assert.strictEqual(longo.removed_start, 2, 'com 1 km de raio, o ponto a 600 m também some');
  });

  // ---------- Contra o banco, com dono e visitante ----------
  const caminho = path.join(__dirname, '..', '..', 'data', `zona-test-${process.pid}.db`);
  const db = new Database(caminho);
  process.env.QUIET = 'true';
  await require('../database/schema.js')(db);

  const dono = crypto.randomUUID();
  const visitante = crypto.randomUUID();
  for (const [id, apelido] of [[dono, 'dono'], [visitante, 'visita']]) {
    await db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?,?,?)')
      .run(id, `${apelido}-${id}@t.test`, 'x');
    await db.prepare('INSERT INTO user_profiles (user_id, name, username) VALUES (?,?,?)')
      .run(id, apelido, `${apelido}_${id.slice(0, 8)}`);
  }
  await db.prepare('INSERT INTO privacy_zones (user_id, lat, lon, radius_m) VALUES (?,?,?,?)')
    .run(dono, CASA.lat, CASA.lon, 500);

  const percurso = [aoNorte(0), aoNorte(200), aoNorte(1500), aoNorte(3000), aoNorte(200), aoNorte(0)];

  await teste('Z9: o dono vê a própria corrida inteira', async () => {
    const r = await aplicarZona(db, { donoId: dono, leitorId: dono, pontos: percurso });
    assert.strictEqual(r.points.length, 6, 'esconder do próprio dono seria esconder o dado dele');
    assert.strictEqual(r.trimmed, false);
  });

  await teste('Z10: o visitante NÃO vê onde a corrida começou nem terminou', async () => {
    const r = await aplicarZona(db, { donoId: dono, leitorId: visitante, pontos: percurso });
    assert.strictEqual(r.trimmed, true, 'deveria ter recortado');
    assert.strictEqual(r.points.length, 2);
    for (const p of r.points) {
      assert.ok(distanciaMetros(p, CASA) > 500,
        `VAZOU: ponto a ${distanciaMetros(p, CASA).toFixed(0)} m da casa do atleta`);
    }
  });

  await teste('Z11: atleta sem zona configurada não é afetado', async () => {
    const r = await aplicarZona(db, { donoId: visitante, leitorId: dono, pontos: percurso });
    assert.strictEqual(r.points.length, 6);
    assert.strictEqual(r.trimmed, false);
  });

  await db.close();
  try { fs.unlinkSync(caminho); } catch (_) {}
  for (const sufixo of ['-shm', '-wal']) {
    try { fs.unlinkSync(caminho + sufixo); } catch (_) {}
  }

  console.log('\n============================================================');
  console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
  console.log('============================================================');
  if (falharam > 0) process.exit(1);
})().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
