import { databaseStatus } from '../config/database.js';

export function health(req, res) {
  res.set('Cache-Control', 'no-store').json({
    status: 'ok',
    service: 'fyp-api',
    phase: 1,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: databaseStatus(),
    realtime: { status: req.app.get('io') ? 'initialized' : 'unavailable', authentication: 'required' },
  });
}

export function readiness(req, res) {
  const database = databaseStatus();
  const ready = database.status === 'connected';
  res.set('Cache-Control', 'no-store').status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    database,
    message: ready ? 'The database is connected.' : database.configured
      ? 'MongoDB is configured but disconnected. Check the server connection and restart if needed.'
      : 'Set MONGODB_URI in server/.env and restart the backend.',
  });
}
