import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env';
import { logger } from './config/logger';
import { connectDB } from './config/database';
import { swaggerSpec } from './config/swagger';
import router from './routes/index';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware';

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: env.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// ── Body Parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// ── Logging ───────────────────────────────────────────────────────────────────
if (env.nodeEnv !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  }));
}

// ── Swagger Docs ──────────────────────────────────────────────────────────────
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      tagsSorter: 'alpha',
    },
    customSiteTitle: 'Sales + ZATCA API Docs',
    customCss: '.swagger-ui .topbar { background-color: #1a365d; }',
  })
);

// Serve swagger JSON for frontend tools
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api', router);

// ── 404 & Error Handlers ──────────────────────────────────────────────────────
app.use(notFoundMiddleware);
app.use(errorMiddleware);

// ── Start Server ──────────────────────────────────────────────────────────────
async function bootstrap() {
  await connectDB();

  app.listen(env.port, () => {
    logger.info(`
╔══════════════════════════════════════════════════════╗
║       Sales + Inventory + ZATCA Backend              ║
╠══════════════════════════════════════════════════════╣
║  Status  : Running ✅                                ║
║  Port    : ${env.port}                                       ║
║  Env     : ${env.nodeEnv.padEnd(10)}                            ║
║  ZATCA   : ${env.zatca.env.padEnd(10)} mode                     ║
║  Docs    : http://localhost:${env.port}/api/docs          ║
╚══════════════════════════════════════════════════════╝
    `);
  });
}

if (process.env.VERCEL !== '1') {
  bootstrap().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default app;
