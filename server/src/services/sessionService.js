import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const cookieOptions = { httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax', path: '/' };

export function createSession(res, user) {
  if (!config.jwtSecret) throw new AppError(503, 'Authentication is not configured.', 'AUTH_UNAVAILABLE');
  const token = jwt.sign({ ver: user.tokenVersion || 0 }, config.jwtSecret, {
    algorithm: 'HS256', subject: String(user._id), expiresIn: config.sessionSeconds,
  });
  res.cookie(config.cookieName, token, { ...cookieOptions, maxAge: config.sessionSeconds * 1000 });
}

export function clearSessionCookie(res) { res.clearCookie(config.cookieName, cookieOptions); }

export function safeUser(user) {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role,
    department: user.department || '', studentId: user.studentId || '', isActive: user.isActive, createdAt: user.createdAt };
}
