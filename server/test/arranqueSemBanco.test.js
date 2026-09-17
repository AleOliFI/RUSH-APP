// ============================================================
// RUSH RUNNING — O servidor não morre quando o banco não vem
// ------------------------------------------------------------
// `initializeDatabase` é uma promessa. Quando ela rejeita — banco
// fora do ar, senha recusada, certificado negado — e ninguém a
// observa durante o arranque, o Node dispara unhandledRejection e
// MATA o processo antes da primeira requisição.
//
// Isso aconteceu em produção: a Vercel devolvia
// FUNCTION_INVOCATION_FAILED e o painel de erros ficava vazio, sem
// uma única linha de log, porque não havia processo para escrever
// nenhuma. Um DATABASE_URL com host errado ficava indistinguível
// de um bug de código — e o operador não tinha por onde começar.
//
// Este teste sobe o servidor de verdade contra um host que não
// existe e cobra dois comportamentos: continuar vivo, e dizer por
// que não pode servir.
// ============================================================

const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const PORTA = 3977;

let passaram = 0;
let falharam = 0;

function teste(nome, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  ✅ [PASS] ${nome}`); passaram += 1; })
    .catch((err) => {
      console.log(`  ❌ [FAIL] ${nome}`);
      console.log(`     ${err.message}`);
      falharam += 1;
    });
}

console.log('\n============================================================');
console.log('📌 ARRANQUE COM BANCO INACESSÍVEL');
console.log('============================================================\n');

// O host .invalid é reservado justamente para isto: nunca resolve,
// em nenhuma rede, então o teste não depende de DNS externo.
const URL_MORTA = 'postgresql://u:p@banco-que-nao-existe.invalid:6543/postgres';

function subirServidor() {
  const filho = spawn(process.execPath, ['-e', `
    const app = require(${JSON.stringify(path.join(RAIZ, 'api', 'index.js'))});
    app.listen(${PORTA}, () => console.log('ouvindo'));
  `], {
    cwd: RAIZ,
    env: { ...process.env, DATABASE_URL: URL_MORTA, PORT: String(PORTA), RUSH_SEED: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return new Promise((ok, falha) => {
    const limite = setTimeout(() => falha(new Error('o servidor não anunciou a porta em 20s')), 20000);
    filho.stdout.on('data', (d) => {
      if (d.toString().includes('ouvindo')) { clearTimeout(limite); ok(filho); }
    });
    filho.on('exit', (codigo) => {
      clearTimeout(limite);
      falha(new Error(`o processo morreu no arranque (código ${codigo}) em vez de reportar a falha`));
    });
  });
}

(async () => {
  let filho = null;

  await teste('o processo sobrevive a um banco inacessível', async () => {
    filho = await subirServidor();
    // Tempo de sobra para a rejeição acontecer e derrubar o processo,
    // se o `.catch` do arranque tiver sumido de novo.
    await new Promise((r) => setTimeout(r, 4000));
    assert.strictEqual(filho.exitCode, null, 'o servidor não pode morrer por unhandledRejection');
  });

  await teste('responde 503 dizendo que o banco está indisponível', async () => {
    assert.ok(filho, 'o servidor precisa estar de pé');
    const r = await fetch(`http://127.0.0.1:${PORTA}/api/health`);
    assert.strictEqual(r.status, 503, 'banco fora deve ser 503, não 500 nem silêncio');
    const corpo = await r.json();
    assert.ok(corpo.code, 'a resposta precisa trazer um código para o operador distinguir a causa');
  });

  await teste('a resposta não vaza o host nem a porta do banco', async () => {
    const r = await fetch(`http://127.0.0.1:${PORTA}/api/health`);
    const texto = await r.text();
    assert.ok(!/banco-que-nao-existe\.invalid/.test(texto),
      'a mensagem crua do driver traz host e porta; ela pertence ao log, não ao corpo público');
  });

  if (filho) filho.kill('SIGKILL');

  console.log('\n============================================================');
  console.log(`   Passaram: ${passaram}   Falharam: ${falharam}`);
  console.log('============================================================');
  if (falharam > 0) process.exit(1);
})();
