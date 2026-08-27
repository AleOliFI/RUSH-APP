// ============================================================
// RUSH PERFORMANCE — Main Server
// Express API + SQLite Database
// ============================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const initializeDatabase = require('./database/schema');

// ============================================================
// Initialize Database
// ============================================================

const seedDatabase = require('./database/seedData');

const DB_PATH = process.env.VERCEL
  ? path.join('/tmp', 'rush_performance.db')
  : path.join(__dirname, '..', 'data', 'rush_performance.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
initializeDatabase(db);

// Auto-seed if running on Vercel or database is newly initialized
try {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (!userCount || userCount.count === 0) {
    console.log('⚡ Initializing database with seed data...');
    seedDatabase(db);
  }
} catch (e) {
  console.warn('Auto-seed check warning:', e.message);
}

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

// ============================================================
// Health Check
// ============================================================

app.get('/api/health', (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const activityCount = db.prepare('SELECT COUNT(*) as count FROM activities').get();
  const hrvCount = db.prepare('SELECT COUNT(*) as count FROM hrv_measurements').get();

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
