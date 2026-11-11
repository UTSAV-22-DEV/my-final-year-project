import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { initializeSockets } from './services/socketService.js';
import './models/index.js';

const app = createApp();
const httpServer = createServer(app);
const io = initializeSockets(httpServer);
app.set('io', io);

try {
  const connected = await connectDatabase();
  console.log(connected ? '[database] MongoDB connected.' : '[database] MONGODB_URI is missing. Database features are unavailable.');
} catch (error) {
  console.error(`[database] Connection failed (${error.name}). Check MONGODB_URI and network access. Readiness will return 503.`);
}

httpServer.on('error', async (error) => {
  console.error(`[server] Cannot listen (${error.code || error.name}).`);
  await disconnectDatabase();
  process.exit(1);
});

httpServer.listen(config.port, () => {
  console.log(`[server] Listening at http://localhost:${config.port}`);
  console.log(`[server] Health: http://localhost:${config.port}/api/health`);
});

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 10000).unref();
  io.close(async () => {
    await disconnectDatabase();
    clearTimeout(timeout);
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
