import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { health } from './controllers/healthController.js';
import { errorHandler, notFound } from './middleware/errors.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '100kb' }));
  app.get('/health', health);
  app.use('/api', apiRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
