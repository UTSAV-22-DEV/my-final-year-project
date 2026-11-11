import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { io as socketClient } from 'socket.io-client';
import { makePdf } from '../../tests/fixtures/documents.js';

const runId = randomUUID().replaceAll('-', ''); const dbName = `fyp_test_${runId}`;
process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'notification-integration-test-signing-key-only';
process.env.UPLOAD_DIR = fileURLToPath(new URL(`../../.local/notification-uploads-${runId}/`, import.meta.url));
const { config } = await import('../src/config/env.js');
const { createApp } = await import('../src/app.js');
const { initializeSockets } = await import('../src/services/socketService.js');
const { notify } = await import('../src/services/notificationService.js');
const { seedDemoUsers } = await import('../scripts/seed.js');
const { hashPassword } = await import('../src/services/passwordService.js');
const { rubric } = await import('../src/config/rubric.js');
const models = await import('../src/models/index.js');
const { User, Project, Proposal, Submission, Evaluation, Notification } = models;
const app = createApp(); const server = createServer(app); const io = initializeSockets(server); app.set('io', io);
const password = process.env.DEMO_PASSWORD || 'FypDemo2026!';
const sockets = []; const received = new Map();
const write = (method, url, cookie) => request(app)[method](url).set('Cookie', cookie || '').set('X-FYP-Request', '1');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate) { const end = Date.now() + 4000; while (!predicate()) { if (Date.now() > end) throw new Error('Expected socket event was not delivered.'); await pause(15); } }
async function connect(cookie) {
  const socket = socketClient(`http://127.0.0.1:${server.address().port}`, { extraHeaders: { Cookie: cookie }, reconnection: false, timeout: 2000 });
  sockets.push(socket); received.set(socket, []); socket.on('notification', (record) => received.get(socket).push(record));
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  return socket;
}
async function login(email) { return (await write('post', '/api/auth/login').send({ email, password }).expect(200)).headers['set-cookie'][0].split(';')[0]; }
let student, teacher, outsider, studentCookie, teacherCookie, outsiderCookie, first, second, teacherSocket, outsiderSocket, group, stable, report;
const operation = () => ({ app, user: teacher });
before(async () => {
  if (!config.mongoUri) throw new Error('MONGODB_URI is required for notification integration tests.');
  await mongoose.connect(config.mongoUri, { dbName: dbName, serverSelectionTimeoutMS: 10000 });
  await Promise.all(Object.values(models).map((model) => model.createIndexes()));
  await seedDemoUsers({ connect: false });
  student = await User.findOne({ role: 'student' }); teacher = await User.findOne({ role: 'teacher' });
  outsider = await User.create({ name: 'Other Student', email: 'other@test.example', role: 'student', passwordHash: await hashPassword(password) });
  [studentCookie, teacherCookie, outsiderCookie] = await Promise.all([student.email, teacher.email, outsider.email].map(login));
  group = await Project.findOne({ teamName: 'Team Horizon' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  [first, second, teacherSocket, outsiderSocket] = await Promise.all([studentCookie, studentCookie, teacherCookie, outsiderCookie].map(connect));
});
after(async () => {
  sockets.forEach((socket) => socket.disconnect()); await new Promise((resolve) => io.close(resolve));
  if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName && /^fyp_test_[a-f0-9]{32}$/.test(dbName)) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  const root = path.resolve(fileURLToPath(new URL('../../.local/', import.meta.url))); const target = path.resolve(config.uploadDir);
  if (target.startsWith(root + path.sep) && path.basename(target) === `notification-uploads-${runId}`) await fs.rm(target, { recursive: true, force: true });
});

test('authenticated sockets join only server-controlled private rooms', () => {
  assert.equal(first.connected, true);
  const rooms = io.sockets.sockets.get(first.id).rooms;
  assert.ok(rooms.has(`user:${student._id}`)); assert.ok(!rooms.has(`user:${teacher._id}`));
  first.emit('join', `user:${teacher._id}`); first.emit('subscribe', String(outsider._id));
  assert.equal(rooms.size, 2);
});
test('anonymous sockets are rejected', async () => {
  const socket = socketClient(`http://127.0.0.1:${server.address().port}`, { reconnection: false, timeout: 2000 });
  try { const failure = await new Promise((resolve) => socket.once('connect_error', resolve)); assert.equal(failure.message, 'Authentication required.'); } finally { socket.disconnect(); }
});
test('persistence precedes real delivery to multiple sessions of the same user', async () => {
  [stable] = await notify(operation(), [student._id], { title: 'Test academic update', message: 'A test-only persisted event.', eventKey: 'test-stable-event' });
  assert.ok(await Notification.findById(stable._id));
  await until(() => [first, second].every((socket) => received.get(socket).some((record) => record._id === String(stable._id))));
});
test('concurrent retries do not create or emit duplicate business events', async () => {
  await Promise.all(Array.from({ length: 5 }, () => notify(operation(), [student._id, student._id], { title: 'Test academic update', message: 'A test-only persisted event.', eventKey: 'test-stable-event' })));
  await pause(50);
  assert.equal(await Notification.countDocuments({ recipient: student._id, eventKey: 'test-stable-event' }), 1);
  assert.equal(received.get(first).filter((record) => record._id === String(stable._id)).length, 1);
});
test('a student never receives another student’s private event', async () => {
  const [record] = await notify(operation(), [outsider._id], { title: 'Private other update', message: 'For another account only.', eventKey: 'test-other-user' });
  await until(() => received.get(outsiderSocket).some((item) => item._id === String(record._id)));
  await pause(40); assert.equal(received.get(first).some((item) => item._id === String(record._id)), false);
  await write('patch', `/api/notifications/${record._id}/read`, studentCookie).expect(404);
  await write('delete', `/api/notifications/${record._id}`, studentCookie).expect(404);
});
test('unread counts, filters, pagination, individual reads and deletion are persisted', async () => {
  for (let index = 0; index < 7; index++) await notify(operation(), [student._id], { title: `Test pagination ${index}`, message: 'Isolated pagination fixture.', eventKey: `test-page-${index}` });
  const count = await request(app).get('/api/notifications/unread-count').set('Cookie', studentCookie).expect(200);
  assert.equal(count.body.unreadCount, await Notification.countDocuments({ recipient: student._id, readAt: null }));
  const page = await request(app).get('/api/notifications?page=2&limit=3&unread=true').set('Cookie', studentCookie).expect(200);
  assert.equal(page.body.notifications.length, 3); assert.equal(page.body.pagination.page, 2);
  const id = page.body.notifications[0]._id;
  await write('patch', `/api/notifications/${id}/read`, studentCookie).expect(200);
  assert.ok((await Notification.findById(id)).readAt);
  await write('delete', `/api/notifications/${id}`, studentCookie).expect(200);
  assert.equal(await Notification.findById(id), null);
  await request(app).get('/api/notifications?limit=0').set('Cookie', studentCookie).expect(400);
});
test('mark-all-read is account-scoped and retrying a read event does not make it unread', async () => {
  await write('patch', '/api/notifications/read-all', studentCookie).expect(200);
  assert.equal(await Notification.countDocuments({ recipient: student._id, readAt: null }), 0);
  assert.equal(await Notification.countDocuments({ recipient: outsider._id, readAt: null }), 1);
  await notify(operation(), [student._id], { title: 'Test academic update', message: 'A test-only persisted event.', eventKey: 'test-stable-event' });
  assert.ok((await Notification.findById(stable._id)).readAt);
});
test('reconnection recovers notifications from the database after an offline interval', async () => {
  first.disconnect();
  const [record] = await notify(operation(), [student._id], { title: 'Offline update', message: 'Persisted while one session was disconnected.', eventKey: 'test-offline-recovery' });
  await until(() => received.get(second).some((item) => item._id === String(record._id)));
  first.connect(); await new Promise((resolve, reject) => { first.once('connect', resolve); first.once('connect_error', reject); });
  const history = await request(app).get('/api/notifications').set('Cookie', studentCookie).expect(200);
  assert.ok(history.body.notifications.some((item) => item._id === String(record._id)));
});
test('proposal decisions generate real student notifications', async () => {
  const proposal = await Proposal.findOne({ project: group._id });
  await write('patch', `/api/proposals/${proposal._id}/review`, teacherCookie).send({ status: 'approved', comment: 'Proposal review event test.' }).expect(200);
  await until(() => received.get(first).some((record) => record.resourceType === 'proposal'));
});
test('document submissions deliver privately to the assigned teacher', async () => {
  report = (await write('post', `/api/projects/${group._id}/submissions`, studentCookie).attach('document', makePdf(), { filename: 'report.pdf', contentType: 'application/pdf' }).expect(201)).body.submission;
  await until(() => received.get(teacherSocket).some((record) => record.resourceType === 'submission' && record.resourceId === report._id));
});
test('feedback and AI completion workflows persist and emit their own resource references', async () => {
  await write('post', '/api/feedback', teacherCookie).send({ projectId: group._id, message: 'Review the methodology.' }).expect(201);
  await until(() => received.get(first).some((record) => record.resourceType === 'feedback'));
  app.set('evaluationModel', 'automated-external-api-mock-only');
  app.set('evaluateReport', async () => ({ criteria: rubric.map((criterion) => ({ name: criterion.name, marks: criterion.maxMarks / 2, explanation: 'Automated API boundary mock.', strengths: ['Clear intent.'], weaknesses: ['Needs evidence.'], improvements: ['Add results.'] })), suggestions: 'Add measured results.' }));
  const result = await write('post', `/api/submissions/${report._id}/evaluate`, studentCookie).expect(201);
  await until(() => received.get(first).some((record) => record.resourceType === 'evaluation' && record.resourceId === result.body.evaluation._id));
  assert.equal(await Evaluation.countDocuments({ project: group._id }), 1);
});
test('final submission and finalized grades generate authentic workflow notifications', async () => {
  await write('post', `/api/projects/${group._id}/final-submission`, studentCookie).send({ submissionId: report._id }).expect(200);
  await until(() => received.get(teacherSocket).some((record) => record.title === 'Final report submitted'));
  await write('post', `/api/projects/${group._id}/final-grade`, teacherCookie).send({ criteria: rubric.map((criterion) => ({ name: criterion.name, marks: criterion.maxMarks - 1 })), comment: 'Teacher finalization test.' }).expect(200);
  await until(() => received.get(first).some((record) => record.type === 'grade'));
});
test('database failure emits no fake success and retains already-saved document files', async (context) => {
  const before = await Notification.countDocuments();
  context.mock.method(Notification, 'updateOne', async () => { throw new Error('Test database write failure.'); });
  await assert.rejects(notify(operation(), [student._id], { title: 'Failure', message: 'Must not emit.', eventKey: 'failed-write' }), { code: 'NOTIFICATION_PERSISTENCE_FAILED' });
  // Use a separate draft project because final submissions are immutable.
  const project = await Project.create({ title: 'Failure handling project', teamName: 'Failure group', createdBy: outsider._id, members: [outsider._id], supervisor: teacher._id });
  const response = await write('post', `/api/projects/${project._id}/submissions`, outsiderCookie).attach('document', makePdf(), { filename: 'notify-failure.pdf', contentType: 'application/pdf' }).expect(503);
  assert.equal(response.body.error.code, 'NOTIFICATION_PERSISTENCE_FAILED');
  const saved = await Submission.findOne({ project: project._id });
  assert.ok(saved); await fs.access(path.join(config.uploadDir, saved.document.storageKey));
  assert.equal(await Notification.countDocuments(), before);
});
test('socket sessions expire and logout disconnects every account session', async () => {
  const token = jwt.sign({ ver: 0 }, config.jwtSecret, { subject: String(student._id), expiresIn: 2 });
  const expiring = await connect(`${config.cookieName}=${token}`);
  await new Promise((resolve) => expiring.once('disconnect', resolve));
  assert.equal(expiring.connected, false);
  await write('post', '/api/auth/logout', studentCookie).expect(204);
  await until(() => !first.connected && !second.connected);
  await request(app).get('/api/notifications').set('Cookie', studentCookie).expect(401);
});
