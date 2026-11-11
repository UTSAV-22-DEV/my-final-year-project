import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const serverRoot = fileURLToPath(new URL('../../', import.meta.url));
dotenv.config({ path: path.join(serverRoot, '.env'), quiet: true });

export function readConfig(source = process.env) {
  const port = Number(source.PORT || 4000);
  const maxFileSizeMb = Number(source.MAX_FILE_SIZE_MB || 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  if (!Number.isInteger(maxFileSizeMb) || maxFileSizeMb < 1 || maxFileSizeMb > 50) {
    throw new Error('MAX_FILE_SIZE_MB must be an integer between 1 and 50.');
  }
  const clientOrigin = source.CLIENT_ORIGIN || 'http://localhost:5173';
  if (new URL(clientOrigin).origin !== clientOrigin) {
    throw new Error('CLIENT_ORIGIN must be an origin without a path or trailing slash.');
  }
  const jwtSecret = source.JWT_SECRET || '';
  if (jwtSecret && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters when configured.');
  }
  return {
    nodeEnv: source.NODE_ENV || 'development',
    port,
    clientOrigin,
    mongoUri: source.MONGODB_URI || '',
    jwtSecret,
    cookieName: 'fyp_session',
    sessionSeconds: 8 * 60 * 60,
    xaiApiKey: source.XAI_API_KEY || '',
    xaiModel: source.XAI_MODEL || '',
    trustedOrigins: source.NODE_ENV === 'production' ? [clientOrigin] : [...new Set([clientOrigin, clientOrigin.replace('localhost', '127.0.0.1')])],
    uploadDir: path.resolve(serverRoot, source.UPLOAD_DIR || 'uploads'),
    maxFileSize: maxFileSizeMb * 1024 * 1024,
  };
}

export const config = readConfig();
