// ============================================================
// RUSH RUNNING — Dados de demonstração
// ------------------------------------------------------------
// Este arquivo estava quebrado havia tempo: falhava com "table
// user_profiles has no column named id", e como o arranque o chama
// dentro de um try/catch que só avisa, a falha passava em silêncio.
// O resultado é que o deploy subia com o banco VAZIO em vez de com
// dados de exemplo.
//
// A causa era um schema antigo: o seed inseria colunas que não
// existem mais (id em user_profiles, runs_per_week e primary_goal em
// user_objectives, code e is_active em academies, session_type em
// training_sessions, avg_hr_bpm em activities) e valores que os CHECK
// recusam ('enterprise' como plano de assessoria, 'interval' como
// tipo de atividade). Foi reescrito contra o schema atual.
//
// Os atletas recebem também user_settings e privacy_settings, para
// se comportarem como quem se cadastrou pelo app — sem isso, uma
// conta semeada não teria preferência de notificação nenhuma.
// ============================================================

const bcrypt = require('bcryptjs');
const { randomUUID: uuidv4 } = require('node:crypto');
const { calculateLnRmssd } = require('../agent/trainingAgent');
const { getTrainingTemplates, generateWeekSessions } = require('../services/periodizacao');

/** Ordem importa: filhos antes dos pais, por causa das chaves estrangeiras. */
const TABELAS_PARA_LIMPAR = [
  'refresh_tokens',
  'privacy_settings',
  'user_settings',
  'challenge_participants',
  'challenges',
  'user_achievements',
  'notifications',
  'push_subscriptions',
  'comments',
  'likes',
  'follows',
  'activity_splits',
  'activity_tracks',
  'activity_hr_samples',
  'activity_trims',
  'activities',
  'assigned_plans',
  'training_sessions',
  'training_plans',
  'vo2max_estimates',
  'daily_status',
  'wellness_scores',
  'hrv_measurements',
  'user_objectives',
  'user_profiles',
  'users',
];

const ATLETAS = [
  {
    id: 'usr-alessandro-001', email: 'alessandro@rush.com', role: 'owner',
    name: 'Alessandro Oliveira', username: 'alessandro',
    bio: 'Fundador da RUSH Performance. Maratonista e entusiasta de VFC.',
    location: 'São Paulo, SP', weight_kg: 72.5, height_cm: 178,
    instagram: '@alessandro.run', strava: 'alessandro_rush',
    objetivo: { distancia: 42, nivel: 'intermediate', prova: '2026-11-15' },
  },
  {
    id: 'usr-coach-002', email: 'coach@rush.com', role: 'coach',
    name: 'Coach Ricardo Silva', username: 'coach_ricardo',
    bio: 'Treinador de corrida de alta performance. Especialista em periodização por VFC.',
    location: 'São Paulo, SP', weight_kg: 78.0, height_cm: 182,
    instagram: '@coach.ricardo', strava: 'ricardosilva_coach',
    objetivo: { distancia: 42, nivel: 'advanced', prova: null },
  },
  {
    id: 'usr-maria-003', email: 'maria@email.com', role: 'athlete',
    name: 'Maria Santos', username: 'maria_run',
    bio: 'Corredora amadora em busca dos 10km sub-45.',
    location: 'Curitiba, PR', weight_kg: 58.0, height_cm: 165,
    instagram: '@maria.running', strava: 'mariasantos_run',
    objetivo: { distancia: 10, nivel: 'intermediate', prova: null },
  },
  {
    id: 'usr-pedro-004', email: 'pedro@email.com', role: 'athlete',
    name: 'Pedro Costa', username: 'pedro_costa',
    bio: 'Treinando para a primeira meia maratona.',
    location: 'Belo Horizonte, MG', weight_kg: 75.0, height_cm: 176,
    instagram: '@pedro.costa', strava: 'pedrocosta_run',
    objetivo: { distancia: 21, nivel: 'beginner', prova: null },
  },
  {
    id: 'usr-ana-005', email: 'ana@email.com', role: 'athlete',
    name: 'Ana Paula Lima', username: 'ana_lima',
    bio: 'Corredora de 5km e apaixonada por treinos intervalados.',
    location: 'Rio de Janeiro, RJ', weight_kg: 55.0, height_cm: 162,
    instagram: '@ana.running', strava: 'anapaulalima',
    objetivo: { distancia: 5, nivel: 'intermediate', prova: null },
  },
];

async function seedDatabase(db) {
  console.log('🌱 Semeando o banco com dados de demonstração…');

  // Sem transação envolvendo tudo: se algo falhar, é melhor ver onde
  // parou do que receber um banco vazio e um erro genérico.
  for (const tabela of TABELAS_PARA_LIMPAR) {
    try {
      await db.prepare(`DELETE FROM ${tabela}`).run();
    } catch (_) {
      // Tabela pode não existir em bancos antigos; seguir adiante.
    }
  }

  const senhaHash = bcrypt.hashSync('123456', 10);

  const academiaId = 'aca-rush-elite-001';

  const inserirUsuario = db.prepare(`
    INSERT INTO users (id, email, password_hash, role, academy_id, subscription_tier, subscription_status)
    VALUES (?, ?, ?, ?, ?, 'pro', 'active')
  `);
  const inserirPerfil = db.prepare(`
    INSERT INTO user_profiles (user_id, name, username, bio, location, weight_kg, height_cm, instagram, strava)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const inserirObjetivo = db.prepare(`
    INSERT INTO user_objectives (user_id, distance_km, level, target_race_date)
    VALUES (?, ?, ?, ?)
  `);
  const inserirPreferencias = db.prepare('INSERT INTO user_settings (user_id) VALUES (?)');
  const inserirPrivacidade = db.prepare('INSERT INTO privacy_settings (user_id) VALUES (?)');

  for (const atleta of ATLETAS) {
    await inserirUsuario.run(atleta.id, atleta.email, senhaHash, atleta.role, academiaId);
    await inserirPerfil.run(
      atleta.id, atleta.name, atleta.username, atleta.bio, atleta.location,
      atleta.weight_kg, atleta.height_cm, atleta.instagram, atleta.strava,
    );
    await inserirObjetivo.run(
      atleta.id, atleta.objetivo.distancia, atleta.objetivo.nivel, atleta.objetivo.prova,
    );
    await inserirPreferencias.run(atleta.id);
    await inserirPrivacidade.run(atleta.id);
  }

  // A assessoria vem depois dos atletas: ela referencia o dono, e
  // criá-la antes obrigaria a desligar as chaves estrangeiras — que é
  // como o código antigo escondia justamente este problema.
  // 'elite' é o maior plano que o CHECK aceita; 'enterprise' não existe.
  await db.prepare(`
    INSERT INTO academies (id, name, description, location, owner_id, plan_type, max_athletes)
    VALUES (?, 'RUSH Elite Performance', 'Assessoria de demonstração.', 'São Paulo, SP', ?, 'elite', 100)
  `).run(academiaId, ATLETAS[0].id);

  // --- 14 dias de VFC para o atleta principal ---
  // A tabela não tem coluna `date`: a data sai do timestamp.
  const inserirVfc = db.prepare(`
    INSERT INTO hrv_measurements (id, user_id, timestamp, rmssd_ms, lnrmssd, hr_rest_bpm, duration_seconds)
    VALUES (?, ?, ?, ?, ?, ?, 60)
  `);
  const inserirStatusDiario = db.prepare(`
    INSERT INTO daily_status (id, user_id, date, status, lnrmssd, lnrmssd_7d_mean, lnrmssd_7d_sd, suggested_action, explanation_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const hoje = new Date();
  for (let i = 13; i >= 0; i -= 1) {
    const dia = new Date(hoje.getTime() - i * 24 * 60 * 60 * 1000);
    const dataTexto = dia.toISOString().split('T')[0];
    const rmssd = 60 + Math.floor(Math.sin(i) * 10) + (i === 0 ? 5 : 0);
    const lnrmssd = calculateLnRmssd(rmssd);
    const fcRepouso = 50 + Math.floor(Math.cos(i) * 4);

    await inserirVfc.run(uuidv4(), ATLETAS[0].id, dia.toISOString(), rmssd, lnrmssd, fcRepouso);
    await inserirStatusDiario.run(
      uuidv4(), ATLETAS[0].id, dataTexto, 'favorable', lnrmssd, 4.15, 0.12,
      'Treino intenso liberado',
      'Sistema parassimpático recuperado. O corpo está pronto para responder bem a cargas elevadas de treino.',
    );
  }

  // --- Planos de treino ---
  // Antes daqui havia uma unica semana escrita a mao, e o plano de
  // maratona anunciava 12 semanas tendo so a primeira: quem abrisse a
  // semana 2 no app encontrava o calendario vazio.
  //
  // Agora cada plano e gerado pela mesma periodizacao que a rota
  // /training/generate-plan usa (services/periodizacao.js), semana a
  // semana, das 12. Nao ha numero inventado aqui: o volume, a fase e o
  // tipo de cada sessao saem da funcao que o app usa de verdade.
  //
  // Um plano por combinacao de distancia e nivel que aparece entre os
  // atletas, e cada atleta recebe o seu. A lista sai dos proprios
  // objetivos, entao incluir um atleta novo la em cima ja cria o plano
  // dele aqui embaixo.
  const SEMANAS = 12;
  const NOME_NIVEL = { beginner: 'Iniciante', intermediate: 'Intermediário', advanced: 'Avançado' };
  const NOME_DISTANCIA = { 5: '5K', 10: '10K', 21: 'Meia Maratona', 42: 'Maratona' };

  /**
   * Ritmo medio da sessao, em min:seg por km.
   *
   * Nao e um dado novo: e a divisao da duracao pela distancia que a
   * propria sessao ja traz. A coluna existe e a tela mostra, entao
   * calcular aqui evita que ela apareca vazia.
   */
  const ritmo = (km, min) => {
    if (!km || !min) return null;
    const segundos = Math.round((min * 60) / km);
    return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
  };

  const inserirPlano = db.prepare(`
    INSERT INTO training_plans (id, academy_id, created_by, name, description, distance_km, duration_weeks, level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const inserirSessao = db.prepare(`
    INSERT INTO training_sessions (id, plan_id, week_number, day_of_week, type, distance_km, duration_min, target_pace, target_hr_zone, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const inserirAtribuicao = db.prepare(`
    INSERT INTO assigned_plans (id, user_id, plan_id, start_date, end_date, current_week, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `);

  const emDias = (n) => new Date(hoje.getTime() + n * 86400000).toISOString().split('T')[0];

  const planosPorChave = new Map();
  let totalSessoes = 0;

  for (const atleta of ATLETAS) {
    const { distancia, nivel } = atleta.objetivo;
    const chave = `${distancia}-${nivel}`;

    if (!planosPorChave.has(chave)) {
      const planoId = `plan-${distancia}k-${nivel}`;
      await inserirPlano.run(
        planoId, academiaId, ATLETAS[1].id,
        `Plano ${NOME_DISTANCIA[distancia]} — ${NOME_NIVEL[nivel]}`,
        `Periodização em 4 fases (base, build, peak, taper) ao longo de ${SEMANAS} semanas, com ajuste diário por VFC.`,
        distancia, SEMANAS, nivel,
      );

      const templates = getTrainingTemplates(distancia, nivel);
      for (let semana = 1; semana <= SEMANAS; semana += 1) {
        const sessoes = generateWeekSessions(templates, semana, SEMANAS, distancia, nivel);

        // A periodizacao devolve so os dias de treino. Os outros dias
        // entram como descanso: o calendario da semana mostra os sete
        // dias, e um dia em branco seria lido como falha de carregamento
        // em vez de folga prescrita.
        const diasComTreino = new Set(sessoes.map((x) => x.day_of_week));
        for (let dia = 1; dia <= 7; dia += 1) {
          if (diasComTreino.has(dia)) continue;
          sessoes.push({
            day_of_week: dia, type: 'rest', distance_km: 0, duration_min: 0,
            target_hr_zone: null, description: 'Descanso programado — recuperação é parte do treino',
          });
        }

        sessoes.sort((a, b) => a.day_of_week - b.day_of_week);
        for (const s of sessoes) {
          await inserirSessao.run(
            uuidv4(), planoId, semana, s.day_of_week, s.type,
            s.distance_km, s.duration_min, ritmo(s.distance_km, s.duration_min),
            s.target_hr_zone, s.description,
          );
          totalSessoes += 1;
        }
      }

      planosPorChave.set(chave, planoId);
    }

    // Todos comecam na semana 2: o app tem uma semana de historico
    // para mostrar em vez de um plano que ainda nao comecou.
    await inserirAtribuicao.run(
      uuidv4(), atleta.id, planosPorChave.get(chave),
      emDias(-7), emDias(SEMANAS * 7 - 7), 2,
    );
  }

  // --- Atividades do feed ---
  // O CHECK de `type` só aceita os 8 tipos de esporte: um treino
  // intervalado é uma corrida, e o que o distingue é a descrição.
  const inserirAtividade = db.prepare(`
    INSERT INTO activities (id, user_id, type, title, description, date, distance_km, duration_seconds, avg_pace, avg_hr, max_hr, calories, privacy)
    VALUES (?, ?, 'run', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'public')
  `);

  /** Instante N dias atrás, no formato de texto que o app grava. */
  const diasAtras = (n) =>
    new Date(hoje.getTime() - n * 86400000).toISOString().replace('T', ' ').slice(0, 19);

  await inserirAtividade.run(uuidv4(), ATLETAS[0].id, 'Longão de Domingo — 22KM',
    'Ritmo controlado em Z2 do início ao fim com sensação ótima.', diasAtras(1), 22.0, 7260, '5:30/km', 148, 168, 1420);
  await inserirAtividade.run(uuidv4(), ATLETAS[2].id, 'Tiros 6x 800m na Pista',
    'Superação total! Pace de 4:10/km cravado.', diasAtras(2), 10.2, 3120, '4:15/km', 165, 185, 780);
  await inserirAtividade.run(uuidv4(), ATLETAS[3].id, 'Rodagem Regenerativa Leve',
    'Recuperação ativa após o longão de sábado.', diasAtras(3), 6.5, 2340, '6:00/km', 132, 145, 410);

  console.log(
    `✅ Banco semeado: ${ATLETAS.length} atletas, ${planosPorChave.size} planos de ` +
    `${SEMANAS} semanas (${totalSessoes} sessões), 14 dias de VFC e 3 atividades.`
  );
}

module.exports = seedDatabase;
