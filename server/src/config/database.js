import mongoose from 'mongoose';
import { config } from './env.js';

// Database-dependent requests fail promptly while the service is unconfigured.
mongoose.set('bufferCommands', false);

export async function connectDatabase(uri = config.mongoUri) {
  if (!uri) return false;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  // Initialize indexes after connecting; model compilation must not try database
  // operations while buffering is disabled and the connection is still absent.
  await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));
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
