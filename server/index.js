// ============================================================
// RUSH PERFORMANCE — Main Server
// Express API + SQLite Database
// ============================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { abrirBanco } = require('./database');
const initializeDatabase = require('./database/schema');

// ============================================================
// Initialize Database
// ============================================================

const seedDatabase = require('./database/seedData');

// RUSH_DB_PATH existe para os testes: sem ela nao ha como subir o
// servidor apontando para um arquivo descartavel, e um teste acabaria
// escrevendo no banco de desenvolvimento — ou, com DATABASE_URL
// definida, no Postgres de producao, que o seed limpa.
const DB_PATH = process.env.RUSH_DB_PATH
  ? path.resolve(process.env.RUSH_DB_PATH)
  : process.env.VERCEL
    ? path.join('/tmp', 'rush_performance.db')
    : path.join(__dirname, '..', 'data', 'rush_performance.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Com DATABASE_URL apontando para um Postgres, o app usa Postgres;
// sem ela, o arquivo SQLite de sempre. É a única chave da virada.
const db = abrirBanco(DB_PATH);

/**
 * O schema agora é assíncrono, porque o mesmo código precisa valer
 * para Postgres. Guardamos a promessa e fazemos toda requisição
 * esperá-la: numa função serverless, a primeira requisição chega
 * junto com o arranque a frio, e servir antes das tabelas existirem
 * daria um 500 difícil de explicar.
 */
const prontidao = initializeDatabase(db);

// Web Push. Sem as chaves VAPID no ambiente o app segue inteiro: as
// notificações continuam sendo gravadas e aparecem na central, apenas
// não chegam ao aparelho. O aviso serve para isso não passar batido
// num deploy que esqueceu de cadastrar as variáveis.
const { configurarPush } = require('./services/notificacoes');
if (!configurarPush()) {
  console.warn('⚠️  Web Push desligado: defina VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY.');
}

// ============================================================
// Semeadura automática — só onde ela é inofensiva
// ------------------------------------------------------------
// O seed não apenas insere: ele COMEÇA APAGANDO cerca de 20
// tabelas, porque precisa de um estado conhecido para montar os
// atletas de demonstração. Isso é exatamente o que se quer num
// banco de desenvolvimento e exatamente o que não se pode fazer
// num banco de produção.
//
// A condição antiga era só "não há usuários". Mas um Postgres
// vazio é o estado NORMAL de um banco novo em produção, momentos
// antes de alguém se cadastrar — e também o estado de um banco
// que perdeu os usuários por outro motivo. Em qualquer dos casos,
// semear sozinho destrói o que estiver nas outras tabelas.
//
// Então: em SQLite (desenvolvimento) o seed continua automático.
// Em Postgres ele só roda se alguém pedir explicitamente, com
// RUSH_SEED=1 — uma decisão, e não um efeito colateral do deploy.
// ============================================================

const ehPostgres = db.dialect === 'postgres';
const seedPedidoExplicitamente = process.env.RUSH_SEED === '1';

// ------------------------------------------------------------
// A promessa do schema pode rejeitar: banco fora do ar, senha
// recusada, certificado negado. Se ninguém a observar durante o
// arranque, o Node dispara unhandledRejection e DERRUBA o processo
// antes da primeira requisição chegar. Numa função serverless isso
// vira FUNCTION_INVOCATION_FAILED sem uma única linha de log — e o
// motivo real morre junto com o processo, que é o pior desfecho
// possível: um erro de configuração fica indistinguível de um erro
// de código.
//
// Guardamos a falha aqui para que ela vire resposta HTTP e linha de
// log, em vez de silêncio.
// ------------------------------------------------------------
let falhaDeArranque = null;

const arranque = prontidao.then(async () => {
  try {
    // Conta TODAS as linhas, inclusive contas excluídas: aqui a
    // pergunta não é "há usuários ativos?", é "este banco já foi
    // usado?". Uma conta excluída responde que sim — e o seed começa
    // apagando ~20 tabelas. Filtrar `deleted_at` aqui abriria a porta
    // para apagar um banco que só parecia vazio.
    const userCount = await db.prepare('SELECT COUNT(*) as count FROM users').get();
    const bancoVazio = !userCount || Number(userCount.count) === 0;

    if (!bancoVazio) return;

    if (ehPostgres && !seedPedidoExplicitamente) {
      console.warn(
        '⚠️  Banco Postgres sem usuários, e a semeadura NÃO foi executada.\n' +
        '    O seed apaga cerca de 20 tabelas antes de inserir, então em Postgres\n' +
        '    ele exige uma decisão explícita. Para semear, rode o deploy uma vez\n' +
        '    com RUSH_SEED=1 — e só faça isso num banco que possa ser apagado.',
      );
      return;
    }

    console.log('⚡ Initializing database with seed data...');
    await seedDatabase(db);
  } catch (e) {
    console.warn('Auto-seed check warning:', e.message);
  }
}).catch((e) => {
  falhaDeArranque = e;
  console.error('❌ Banco indisponível no arranque:', e.code || '', e.message);
});

// ============================================================
// Initialize Express
// ============================================================

const app = express();
const PORT = process.env.PORT || 3001;

// ------------------------------------------------------------
// CORS
// ------------------------------------------------------------
// Era `origin: '*'`. Com autenticacao por Bearer em cabecalho e
// sem cookie de sessao, isso nao abre CSRF — mas tambem nao ha
// motivo para qualquer site do mundo poder chamar esta API em
// nome de quem tenha um token.
//
// O app nativo entra aqui: o webview do Capacitor apresenta
// origem `capacitor://localhost` (iOS) ou `https://localhost`
// (Android, por causa do androidScheme). Sem essas duas na lista,
// o app empacotado leva CORS na cara e nao fala com o servidor.
//
// CORS_ORIGIN aceita varias origens separadas por virgula. Sem a
// variavel, segue liberado — mudar o padrao para restritivo aqui
// derrubaria a producao atual sem aviso; a restricao e ligada por
// configuracao, de proposito.
const ORIGENS_NATIVAS = ['capacitor://localhost', 'https://localhost'];

const origensPermitidas = process.env.CORS_ORIGIN
  ? [...process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean), ...ORIGENS_NATIVAS]
  : '*';

app.use(cors({
  origin: origensPermitidas,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Nenhuma rota é servida antes de o banco estar pronto — e, se ele
// nunca ficar, a resposta diz isso em vez de o processo morrer. O
// corpo não carrega a mensagem crua do driver, que costuma trazer
// host e porta: o motivo completo fica no log, o código do erro
// basta para o cliente distinguir 'indisponível' de 'bug'.
app.use((req, res, next) => {
  arranque.then(() => {
    if (falhaDeArranque) {
      res.status(503).json({
        error: 'Banco de dados indisponível',
        code: falhaDeArranque.code || 'DB_UNAVAILABLE',
      });
      return;
    }
    next();
  }, next);
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/health') {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// ============================================================
// Routes
// ============================================================

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const hrvRoutes = require('./routes/hrv');
const trainingRoutes = require('./routes/training');
const activitiesRoutes = require('./routes/activities');
const socialRoutes = require('./routes/social');
const challengesRoutes = require('./routes/challenges');
const academiesRoutes = require('./routes/academies');
const notificationsRoutes = require('./routes/notifications');
const menstrualRoutes = require('./routes/menstrual');
const subscriptionsRoutes = require('./routes/subscriptions');
const gearRoutes = require('./routes/gear');

app.use('/api/auth', authRoutes(db));
app.use('/api/users', usersRoutes(db));
app.use('/api/hrv', hrvRoutes(db));
app.use('/api/training', trainingRoutes(db));
app.use('/api/activities', activitiesRoutes(db));
app.use('/api/social', socialRoutes(db));
app.use('/api/challenges', challengesRoutes(db));
app.use('/api/academies', academiesRoutes(db));
app.use('/api/notifications', notificationsRoutes(db));
app.use('/api/menstrual', menstrualRoutes(db));
app.use('/api/subscriptions', subscriptionsRoutes(db));
app.use('/api/gear', gearRoutes(db));

// ============================================================
// Health Check
// ============================================================

// O health check é a primeira coisa que alguem olha quando o deploy
// parece fora do ar — entao ele precisa falhar alto. Se o banco nao
// responde, a resposta e 503 com o motivo, e nao um 200 com numeros
// vazios que faria o monitoramento dizer que esta tudo bem.
app.get('/api/health', async (req, res) => {
  try {
    // `deleted_at IS NULL` porque a exclusão de conta é lógica: a linha
    // fica no banco para sempre (users.js faz UPDATE, não DELETE). Sem o
    // filtro este número conta contas que já não existem para quem usa o
    // app — e é justamente o número que se olha para saber se há gente
    // dentro. Um banco com uma conta excluída e nenhuma ativa reportaria
    // `users: 1`.
    //
    // activities e hrv_measurements não têm `deleted_at`, então seguem
    // como estão. Vale saber que as atividades de uma conta excluída
    // continuam sendo contadas aqui: elas não são apagadas junto.
    const userCount = await db.prepare('SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL').get();
    const activityCount = await db.prepare('SELECT COUNT(*) as count FROM activities').get();
    const hrvCount = await db.prepare('SELECT COUNT(*) as count FROM hrv_measurements').get();

    res.json({
      status: 'healthy',
      app: 'Rush Performance API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      database: {
        users: userCount.count,
        activities: activityCount.count,
        hrv_measurements: hrvCount.count,
      }
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      app: 'Rush Performance API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      error: 'banco de dados indisponivel',
      detail: err.message,
    });
  }
});

// ============================================================
// API Documentation endpoint
// ============================================================

app.get('/api', (req, res) => {
  res.json({
    name: 'Rush Performance API',
    version: '1.0.0',
    description: 'API para o app Rush Performance — Monitoramento de VFC e ajuste inteligente de treinos para corredores',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Criar conta',
        'POST /api/auth/login': 'Login',
        'POST /api/auth/refresh': 'Renovar token',
        'POST /api/auth/logout': 'Logout',
        'GET /api/auth/me': 'Dados do usuário autenticado',
      },
      users: {
        'GET /api/users/profile': 'Meu perfil',
        'PUT /api/users/profile': 'Atualizar perfil',
        'PUT /api/users/objectives': 'Definir objetivo (5/10/21/42 km)',
        'PUT /api/users/settings': 'Configurações',
        'PUT /api/users/privacy': 'Privacidade',
        'GET /api/users/:username': 'Perfil público de um usuário',
      },
      hrv: {
        'POST /api/hrv/measurement': 'Registrar medição de VFC (RMSSD)',
        'POST /api/hrv/wellness': 'Registrar questionário de bem-estar',
        'GET /api/hrv/status': 'Status do dia (favorável/atenção/recuperação)',
        'GET /api/hrv/history': 'Histórico de VFC (últimos N dias)',
        'POST /api/hrv/vo2max': 'Registrar VO₂máx',
        'GET /api/hrv/vo2max': 'Histórico de VO₂máx',
      },
      training: {
        'GET /api/training/plans': 'Listar planos de treino',
        'POST /api/training/plans': 'Criar plano (coach)',
        'GET /api/training/plans/:id': 'Detalhes do plano',
        'POST /api/training/assign': 'Atribuir plano ao atleta (coach)',
        'GET /api/training/my-plan': 'Meu plano ativo + treino do dia',
        'POST /api/training/generate-plan': 'Gerar plano automático (auto-periodização)',
      },
      activities: {
        'POST /api/activities': 'Registrar atividade',
        'GET /api/activities': 'Minhas atividades',
        'GET /api/activities/:id': 'Detalhes da atividade',
        'DELETE /api/activities/:id': 'Remover atividade',
        'GET /api/activities/stats/summary': 'Estatísticas (últimos N dias)',
      },
      social: {
        'GET /api/social/feed': 'Feed (following/academy/global)',
        'POST /api/social/follow/:userId': 'Seguir',
        'DELETE /api/social/follow/:userId': 'Deixar de seguir',
        'GET /api/social/followers': 'Meus seguidores',
        'GET /api/social/following': 'Quem sigo',
        'POST /api/social/like/:activityId': 'Curtir/descurtir',
        'POST /api/social/comment/:activityId': 'Comentar',
        'DELETE /api/social/comment/:commentId': 'Remover comentário',
        'GET /api/social/search': 'Buscar usuários',
      },
      challenges: {
        'GET /api/challenges': 'Listar desafios',
        'POST /api/challenges': 'Criar desafio (coach)',
        'POST /api/challenges/:id/join': 'Participar',
        'GET /api/challenges/:id/leaderboard': 'Ranking',
        'POST /api/challenges/:id/update-progress': 'Atualizar progresso',
        'GET /api/challenges/achievements/my': 'Minhas conquistas',
      },
      academies: {
        'POST /api/academies': 'Criar assessoria',
        'GET /api/academies/my': 'Minha assessoria',
        'GET /api/academies/dashboard': 'Dashboard da assessoria (coach)',
        'POST /api/academies/invite': 'Convidar atleta',
        'GET /api/academies/athlete/:id': 'Detalhes do atleta (coach)',
      },
      notifications: {
        'GET /api/notifications': 'Listar notificações',
        'PUT /api/notifications/read-all': 'Marcar todas como lidas',
        'PUT /api/notifications/:id/read': 'Marcar como lida',
        'GET /api/notifications/unread-count': 'Contagem de não lidas',
      },
      system: {
        'GET /api/health': 'Health check',
        'GET /api': 'Documentação da API',
      }
    }
  });
});

// ============================================================
// Error handling
// ============================================================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado', path: req.path });
});

// ============================================================
// Start Server (Standalone / Local Development)
// ============================================================

if (require.main === module && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log('');
    console.log('🏃 ═══════════════════════════════════════════');
    console.log('   RUSH PERFORMANCE — API Server');
    console.log('   ─────────────────────────────────────────');
    console.log(`   🌐 Server:    http://localhost:${PORT}`);
    console.log(`   📚 API Docs:  http://localhost:${PORT}/api`);
    console.log(`   💚 Health:    http://localhost:${PORT}/api/health`);
    console.log(`   🗄️  Database:  ${DB_PATH}`);
    console.log('   ─────────────────────────────────────────');
    console.log('   Endpoints: auth, users, hrv, training,');
    console.log('   activities, social, challenges, academies,');
    console.log('   notifications');
    console.log('🏃 ═══════════════════════════════════════════');
    console.log('');
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.close();
  process.exit(0);
});

module.exports = app;
