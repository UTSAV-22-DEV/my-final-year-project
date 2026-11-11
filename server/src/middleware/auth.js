import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

export async function userFromToken(token) {
  if (!token) throw new AppError(401, 'Please sign in to continue.', 'UNAUTHENTICATED');
  if (!config.jwtSecret) throw new AppError(503, 'Authentication is not configured.', 'AUTH_UNAVAILABLE');
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw new AppError(401, 'Your session is invalid or expired.', 'INVALID_TOKEN');
  }
  if (!payload.sub || !mongoose.isObjectIdOrHexString(payload.sub)) {
    throw new AppError(401, 'Your session is invalid or expired.', 'INVALID_TOKEN');
  }
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(503, 'Database unavailable.', 'DATABASE_UNAVAILABLE');
  }
  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || !user.isActive) throw new AppError(401, 'This account is unavailable.', 'UNAUTHENTICATED');
  if (payload.ver !== (user.tokenVersion || 0)) throw new AppError(401, 'Your session has ended. Please sign in again.', 'INVALID_TOKEN');
  return user;
}

export async function authenticate(req, res, next) {
  try {
    const match = /^Bearer (\S+)$/i.exec(req.headers.authorization || '');
    req.user = await userFromToken(match?.[1] || req.cookies?.[config.cookieName]);
    next();
  } catch (error) {
    next(error);
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError(401, 'Please sign in to continue.', 'UNAUTHENTICATED'));
    if (!roles.includes(req.user.role)) return next(new AppError(403, 'You do not have permission for this action.', 'FORBIDDEN'));
    next();
  };
}
