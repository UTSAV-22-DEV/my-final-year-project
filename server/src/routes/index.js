import { Router } from 'express';
import { health, readiness } from '../controllers/healthController.js';
import { currentUser } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

export const apiRouter = Router();
apiRouter.get('/health', health);
apiRouter.get('/health/ready', readiness);
apiRouter.get('/auth/me', authenticate, currentUser);
