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

const arranque = prontidao.then(async () => {
  try {
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
});

// ============================================================
// Initialize Express
// ============================================================

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Nenhuma rota é servida antes de o banco estar pronto.
app.use((req, res, next) => {
  arranque.then(() => next()).catch(next);
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
    const userCount = await db.prepare('SELECT COUNT(*) as count FROM users').get();
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
