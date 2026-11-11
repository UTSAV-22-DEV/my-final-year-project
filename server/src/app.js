import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { health } from './controllers/healthController.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { csrfProtection } from './middleware/csrf.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.trustedOrigins, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));
  app.get('/health', health);
  app.use('/api', csrfProtection, apiRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
