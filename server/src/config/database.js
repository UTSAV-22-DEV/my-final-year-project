import mongoose from 'mongoose';
import { config } from './env.js';

// Database-dependent requests fail promptly while the service is unconfigured.
mongoose.set('bufferCommands', false);

export async function connectDatabase(uri = config.mongoUri) {
  if (!uri) return false;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  return true;
}

export function databaseStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return {
    configured: Boolean(config.mongoUri),
    status: states[mongoose.connection.readyState] || 'disconnected',
  };
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
