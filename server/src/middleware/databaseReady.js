import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function databaseReady(req, res, next) {
  if (mongoose.connection.readyState !== 1) return next(new AppError(503, 'Database unavailable.', 'DATABASE_UNAVAILABLE'));
  if (!config.jwtSecret) return next(new AppError(503, 'Authentication unavailable.', 'AUTH_UNAVAILABLE'));
  next();
}
