import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db';
import authRouter, { cleanupExpiredSessions } from './routes/auth';
import todosRouter from './routes/todos';
import diaryRouter from './routes/diary';
import scheduleRouter from './routes/schedule';
import habitsRouter from './routes/habits';
import goalsRouter from './routes/goals';
import featureRequestsRouter from './routes/featureRequests';
import wishItemsRouter from './routes/wishItems';
import monthlyGoalsRouter from './routes/monthlyGoals';
import routinesRouter from './routes/routines';
import weeklyGoalsRouter from './routes/weeklyGoals';
import budgetRouter from './routes/budget';

const app = express();
const PORT = 3001;

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // SPAのインライン処理を許可
}));

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
}));

// CORS: production は自ドメインのみ、dev は localhost 許可
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ['https://35-227-242-58.sslip.io']
  : ['http://localhost:5173', 'http://localhost:3001'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Auth routes (認証不要)
app.use('/api/auth', authRouter);

// Auth middleware: AUTH_PASSWORD が設定されていれば全 /api/* を保護
app.use('/api', (req, res, next) => {
  const authPassword = process.env.AUTH_PASSWORD;
  if (!authPassword) {
    next();
    return;
  }

  const token = req.cookies?.techo_session;
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const session = db.prepare(
    'SELECT * FROM auth_sessions WHERE token = ? AND expires_at > datetime(\'now\')'
  ).get(token);

  if (!session) {
    res.clearCookie('techo_session', { path: '/' });
    res.status(401).json({ error: 'Session expired' });
    return;
  }

  next();
});

app.use('/api/todos', todosRouter);
app.use('/api/diary', diaryRouter);
app.use('/api/schedules', scheduleRouter);
app.use('/api/habits', habitsRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/feature-requests', featureRequestsRouter);
app.use('/api/wish-items', wishItemsRouter);
app.use('/api/monthly-goals', monthlyGoalsRouter);
app.use('/api/routines', routinesRouter);
app.use('/api/weekly-goals', weeklyGoalsRouter);
app.use('/api/budget', budgetRouter);

// Serve static files in production
const __filename = fileURLToPath(import.meta.url);
const __dirname_server = path.dirname(__filename);
const distPath = path.join(__dirname_server, '..', 'dist');

if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Cleanup expired sessions every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
