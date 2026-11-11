import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';
import request from 'supertest';
import { io as createSocketClient } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { initializeSockets } from '../src/services/socketService.js';
import { readConfig } from '../src/config/env.js';
import { filterDocument } from '../src/config/upload.js';
import { allowRoles } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/errors.js';
import { requireFields, validateObjectId } from '../src/middleware/validate.js';
import { hashPassword, verifyPassword } from '../src/services/passwordService.js';

test('liveness is available without a database and readiness reports the truth', async () => {
  const app = createApp();
  const response = await request(app).get('/api/health').expect(200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.phase, 1);
  assert.equal(response.body.database.status, 'disconnected');
  assert.equal(response.headers['x-powered-by'], undefined);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  await request(app).get('/health').expect(200);
  const ready = await request(app).get('/api/health/ready').expect(503);
  assert.equal(ready.body.status, 'not_ready');
  assert.equal(ready.body.database.status, 'disconnected');
});

test('unknown routes and unauthenticated sessions return structured errors', async () => {
  const app = createApp();
  const missing = await request(app).get('/api/missing').expect(404);
  assert.equal(missing.body.error.code, 'NOT_FOUND');
  const session = await request(app).get('/api/auth/me').expect(401);
  assert.equal(session.body.error.code, 'UNAUTHENTICATED');
});

test('CORS only advertises the configured frontend origin', async () => {
  const app = createApp();
  const good = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
  assert.equal(good.headers['access-control-allow-origin'], process.env.CLIENT_ORIGIN || 'http://localhost:5173');
  const other = await request(app).get('/api/health').set('Origin', 'https://untrusted.example');
  assert.notEqual(other.headers['access-control-allow-origin'], 'https://untrusted.example');
});

test('text and record-ID validation fail before controller execution', async () => {
  const app = express();
  app.use(express.json());
  app.post('/records/:id', requireFields('title'), validateObjectId(), (req, res) => res.json({ valid: true }));
  app.use(errorHandler);
  await request(app).post('/records/123').send({ title: ' ' }).expect(400);
  await request(app).post('/records/123').send({ title: 'Project' }).expect(400);
  await request(app).post('/records/0123456789abcdef01234567').send({ title: 'Project' }).expect(200);
  const invalid = await request(app).post('/records/123').set('Content-Type', 'application/json').send('{').expect(400);
  assert.equal(invalid.body.error.code, 'INVALID_JSON');
});

test('role guard rejects a student on a teacher route and allows a teacher', async () => {
  const app = express();
  app.use((req, res, next) => { req.user = { role: req.headers['x-test-role'] }; next(); });
  app.get('/teacher', allowRoles('teacher'), (req, res) => res.json({ allowed: true }));
  app.use(errorHandler);
  await request(app).get('/teacher').set('x-test-role', 'student').expect(403);
  await request(app).get('/teacher').set('x-test-role', 'teacher').expect(200);
});

test('upload filter permits PDF and DOCX and rejects spoofed extensions', () => {
  const filter = (originalname, mimetype) => new Promise((resolve, reject) => {
    filterDocument({}, { originalname, mimetype }, (error, allowed) => error ? reject(error) : resolve(allowed));
  });
  return Promise.all([
    assert.doesNotReject(() => filter('report.pdf', 'application/pdf')),
    assert.doesNotReject(() => filter('report.DOCX', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
    assert.rejects(() => filter('program.exe', 'application/pdf'), { status: 415 }),
    assert.rejects(() => filter('report.pdf', 'text/html'), { status: 415 }),
  ]);
});

test('bcrypt stores a non-plaintext hash and checks the complete allowed password', async () => {
  const password = 'Example-only-password!';
  const hash = await hashPassword(password);
  assert.notEqual(hash, password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
  await assert.rejects(() => hashPassword('short'), { code: 'INVALID_PASSWORD' });
  await assert.rejects(() => hashPassword('😀'.repeat(20)), { code: 'INVALID_PASSWORD' });
});

test('environment configuration rejects invalid values and has no default secret', () => {
  const config = readConfig({});
  assert.equal(config.port, 4000);
  assert.equal(config.jwtSecret, '');
  assert.equal(config.mongoUri, '');
  assert.throws(() => readConfig({ PORT: 'invalid' }), /PORT/);
  assert.throws(() => readConfig({ JWT_SECRET: 'short' }), /JWT_SECRET/);
  assert.throws(() => readConfig({ CLIENT_ORIGIN: 'https://example.com/path' }), /CLIENT_ORIGIN/);
  assert.throws(() => readConfig({ MAX_FILE_SIZE_MB: '0' }), /MAX_FILE_SIZE_MB/);
});

test('Socket.IO initializes and rejects anonymous real-time connections', async (context) => {
  const app = createApp();
  const server = createServer(app);
  const io = initializeSockets(server);
  app.set('io', io);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve) => io.close(resolve)));
  const health = await request(app).get('/api/health');
  assert.equal(health.body.realtime.status, 'initialized');
  const client = createSocketClient(`http://127.0.0.1:${server.address().port}`, { reconnection: false, timeout: 2000 });
  context.after(() => client.disconnect());
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Socket authentication test timed out.')), 4000);
    client.on('connect', () => { clearTimeout(timeout); reject(new Error('Anonymous socket was accepted.')); });
    client.on('connect_error', (error) => {
      clearTimeout(timeout);
      try { assert.equal(error.message, 'Authentication required.'); resolve(); } catch (failure) { reject(failure); }
    });
  });
});
