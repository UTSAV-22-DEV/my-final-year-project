import bcrypt from 'bcrypt';
import { AppError } from '../utils/AppError.js';

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new AppError(400, 'Passwords need at least 12 characters and at most 72 UTF-8 bytes.', 'INVALID_PASSWORD');
  }
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72) return false;
  return bcrypt.compare(password, hash);
}
