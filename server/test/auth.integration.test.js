import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-integration-test-signing-key-only';
const { config } = await import('../src/config/env.js');
const { createApp } = await import('../src/app.js');
const models = await import('../src/models/index.js');
const { seedDemoUsers } = await import('../scripts/seed.js');
const { hashPassword } = await import('../src/services/passwordService.js');
const { User, Project } = models;
const databaseName = `fyp_test_${randomUUID().replaceAll('-', '')}`;
const app = createApp();
const password = process.env.DEMO_PASSWORD || 'FypDemo2026!';
const write = (method, path) => request(app)[method](path).set('X-FYP-Request', '1');
async function signIn(role) {
  const response = await write('post', '/api/auth/login').send({ email: `${role}@fyp.demo`, password }).expect(200);
  return response.headers['set-cookie'][0].split(';')[0];
}
let studentCookie, teacherCookie, adminCookie, privateProject, student;

before(async () => {
  if (!config.mongoUri) throw new Error('MongoDB integration tests require MONGODB_URI in server/.env.');
  // Never test in or clear the configured application database.
  await mongoose.connect(config.mongoUri, { dbName: databaseName, serverSelectionTimeoutMS: 10000 });
  await Promise.all(Object.values(models).map((model) => model.createIndexes()));
  await seedDemoUsers({ connect: false });
  await seedDemoUsers({ connect: false });
  assert.equal(await User.countDocuments(), 3);
  assert.equal(await Project.countDocuments(), 1);
  const outsider = await User.create({ name: 'Private Student', email: 'private@test.example', role: 'student', passwordHash: await hashPassword(password) });
  privateProject = await Project.create({ title: 'Private project', createdBy: outsider._id, members: [outsider._id] });
  student = await User.findOne({ email: 'student@fyp.demo' });
  [studentCookie, teacherCookie, adminCookie] = await Promise.all(['student', 'teacher', 'admin'].map(signIn));
});

after(async () => {
  if (mongoose.connection.readyState === 1 && mongoose.connection.name === databaseName && /^fyp_test_[a-f0-9]{32}$/.test(databaseName)) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});

test('all three demo users log in with HttpOnly cookies and safe response projections', async () => {
  for (const role of ['student', 'teacher', 'admin']) {
    const response = await write('post', '/api/auth/login').send({ email: `${role}@fyp.demo`, password }).expect(200);
    assert.equal(response.body.user.role, role);
    assert.match(response.headers['set-cookie'][0], /HttpOnly/);
    assert.match(response.headers['set-cookie'][0], /SameSite=Lax/);
    assert.equal(response.body.token, undefined);
    assert.equal(response.body.user.passwordHash, undefined);
    assert.equal(response.body.user.tokenVersion, undefined);
  }
});

test('invalid passwords and unknown emails return the same authentication error', async () => {
  const wrong = await write('post', '/api/auth/login').send({ email: 'student@fyp.demo', password: 'incorrect-password' }).expect(401);
  const unknown = await write('post', '/api/auth/login').send({ email: 'unknown@test.example', password }).expect(401);
  assert.deepEqual(wrong.body, unknown.body);
});

test('registration normalizes email, rejects duplicates and blocks privileged self-registration', async () => {
  const values = { name: 'New Student', email: ' NEW@test.example ', password };
  const created = await write('post', '/api/auth/register').send(values).expect(201);
  assert.equal(created.body.user.email, 'new@test.example');
  assert.equal(created.body.user.role, 'student');
  await write('post', '/api/auth/register').send(values).expect(409);
  for (const role of ['admin', 'teacher']) await write('post', '/api/auth/register').send({ ...values, role }).expect(403);
  await write('post', '/api/auth/login').send({ email: { $ne: '' }, password }).expect(400);
});

test('JWT signature verification, session restoration and tamper rejection work', async () => {
  const token = decodeURIComponent(studentCookie.slice(studentCookie.indexOf('=') + 1));
  const claims = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  assert.equal(claims.sub, String(student._id));
  const response = await request(app).get('/api/auth/me').set('Cookie', studentCookie).expect(200);
  assert.equal(response.body.user.email, 'student@fyp.demo');
  assert.equal(response.body.user.assignedProjects.length, 1);
  await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid-token').expect(401);
  await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
});

test('backend role guards permit own dashboards and reject cross-role operations', async () => {
  await request(app).get('/api/student/dashboard').set('Cookie', studentCookie).expect(200);
  await request(app).get('/api/teacher/dashboard').set('Cookie', teacherCookie).expect(200);
  await request(app).get('/api/admin/dashboard').set('Cookie', adminCookie).expect(200);
  await request(app).get('/api/admin/users').set('Cookie', studentCookie).expect(403);
  await request(app).get('/api/admin/users').set('Cookie', teacherCookie).expect(403);
  const admin = await request(app).get('/api/admin/users').set('Cookie', adminCookie).expect(200);
  assert.ok(admin.body.users.length >= 3);
  assert.ok(admin.body.users.every((user) => user.passwordHash === undefined));
  await request(app).get('/api/student/dashboard').expect(401);
});

test('students and teachers cannot access another group by changing a URL', async () => {
  await request(app).get(`/api/projects/${privateProject._id}`).set('Cookie', studentCookie).expect(404);
  await request(app).get(`/api/projects/${privateProject._id}`).set('Cookie', teacherCookie).expect(404);
  await request(app).get(`/api/projects/${privateProject._id}`).set('Cookie', adminCookie).expect(200);
  const list = await request(app).get('/api/projects').set('Cookie', studentCookie).expect(200);
  assert.equal(list.body.projects.length, 1);
  assert.notEqual(list.body.projects[0]._id, String(privateProject._id));
});

test('administrators create accounts, deactivate sessions and cannot lock out administrators', async () => {
  const created = await write('post', '/api/admin/users').set('Cookie', adminCookie).send({ name: 'Managed Student', email: 'managed@test.example', role: 'student', password }).expect(201);
  const signedIn = await write('post', '/api/auth/login').send({ email: 'managed@test.example', password }).expect(200);
  const cookie = signedIn.headers['set-cookie'][0].split(';')[0];
  await write('patch', `/api/admin/users/${created.body.user.id}/status`).set('Cookie', adminCookie).send({ isActive: false }).expect(200);
  await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
  await write('post', '/api/auth/login').send({ email: 'managed@test.example', password }).expect(403);
  await write('patch', `/api/admin/users/${created.body.user.id}/status`).set('Cookie', adminCookie).send({ isActive: true }).expect(200);
  await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
  const admin = await User.findOne({ email: 'admin@fyp.demo' });
  await write('patch', `/api/admin/users/${admin._id}/status`).set('Cookie', adminCookie).send({ isActive: false }).expect(403);
});

test('CSRF protection rejects cross-origin or missing-header mutations', async () => {
  await request(app).post('/api/auth/login').send({ email: 'student@fyp.demo', password }).expect(403);
  await write('post', '/api/auth/login').set('Origin', 'https://untrusted.example').send({ email: 'student@fyp.demo', password }).expect(403);
});

test('dashboard counts and teacher assignments come from persisted records', async () => {
  const student = await request(app).get('/api/student/dashboard').set('Cookie', studentCookie).expect(200);
  assert.equal(student.body.counts.projects, 1);
  assert.equal(student.body.counts.pendingProposals, 1);
  assert.equal(student.body.counts.pendingSubmissions, 1);
  const teacher = await User.findOne({ email: 'teacher@fyp.demo' }).populate('assignedProjects');
  assert.equal(teacher.assignedProjects.length, 1);
});

test('logout clears the cookie and revokes previously issued JWTs', async () => {
  const cookie = await signIn('student');
  const response = await write('post', '/api/auth/logout').set('Cookie', cookie).expect(204);
  assert.match(response.headers['set-cookie'][0], /Expires=Thu, 01 Jan 1970/);
  await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
  await write('post', '/api/auth/logout').set('Cookie', cookie).expect(204);
  await signIn('student');
});
