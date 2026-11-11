import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import request from 'supertest';
import { io as connectSocket } from 'socket.io-client';
import { makePdf, makeDocx } from '../../tests/fixtures/documents.js';

const runId = randomUUID().replaceAll('-', '');
process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'workflow-integration-test-signing-key-only';
process.env.UPLOAD_DIR = fileURLToPath(new URL(`../../.local/test-uploads-${runId}/`, import.meta.url));
process.env.MAX_FILE_SIZE_MB = '1';
const { config } = await import('../src/config/env.js');
const { createApp } = await import('../src/app.js');
const { initializeSockets } = await import('../src/services/socketService.js');
const models = await import('../src/models/index.js');
const { seedDemoUsers } = await import('../scripts/seed.js');
const { User, Project, Proposal, Submission, Feedback, Resource, Notification } = models;
const databaseName = `fyp_test_${runId}`;
const app = createApp(); const server = createServer(app); const io = initializeSockets(server); app.set('io', io);
const password = process.env.DEMO_PASSWORD || 'FypDemo2026!';
const write = (method, url, cookie) => request(app)[method](url).set('X-FYP-Request', '1').set('Cookie', cookie || '');
async function login(email) { return (await write('post', '/api/auth/login').send({ email, password }).expect(200)).headers['set-cookie'][0].split(';')[0]; }
let adminCookie, teacherCookie, studentCookie, memberCookie, outsiderCookie, outsiderTeacherCookie;
let member, member2, teacher, group, proposal, submission, feedback, resource;
const proposalFields = { title: 'Accessible learning resources', abstract: 'A centralized academic accessibility application.', problemStatement: 'Academic resources are hard to find.', objectives: ['Improve discoverability'], methodology: 'Iterative design and user testing.', domain: 'Education', technologies: ['React', 'MongoDB'] };

before(async () => {
  if (!config.mongoUri) throw new Error('MONGODB_URI is required for live workflow tests.');
  await mongoose.connect(config.mongoUri, { dbName: databaseName, serverSelectionTimeoutMS: 10000 });
  await Promise.all(Object.values(models).map((model) => model.createIndexes()));
  await seedDemoUsers({ connect: false });
  [adminCookie, teacherCookie, studentCookie] = await Promise.all(['admin', 'teacher', 'student'].map((role) => login(`${role}@fyp.demo`)));
  teacher = await User.findOne({ email: 'teacher@fyp.demo' });
  const createUser = async (name, email, role) => (await write('post', '/api/admin/users', adminCookie).send({ name, email, role, password }).expect(201)).body.user;
  member = await createUser('Group Student', 'member@test.example', 'student');
  member2 = await createUser('Second Member', 'member2@test.example', 'student');
  await createUser('Outside Student', 'outsider@test.example', 'student');
  await createUser('Outside Teacher', 'outsiderteacher@test.example', 'teacher');
  [memberCookie, outsiderCookie, outsiderTeacherCookie] = await Promise.all(['member@test.example', 'outsider@test.example', 'outsiderteacher@test.example'].map(login));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
});

after(async () => {
  await new Promise((resolve) => io.close(resolve));
  if (mongoose.connection.readyState === 1 && mongoose.connection.name === databaseName && /^fyp_test_[a-f0-9]{32}$/.test(databaseName)) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  const localRoot = path.resolve(fileURLToPath(new URL('../../.local/', import.meta.url)));
  const uploadRoot = path.resolve(config.uploadDir);
  if (uploadRoot.startsWith(localRoot + path.sep) && path.basename(uploadRoot) === `test-uploads-${runId}`) await fs.rm(uploadRoot, { recursive: true, force: true });
});

test('admin creates a persisted group and assigns an active supervisor', async () => {
  const response = await write('post', '/api/admin/projects', adminCookie).send({ teamName: 'Workflow group', title: 'Accessible learning resources', members: [member.id], teacherId: String(teacher._id) }).expect(201);
  group = response.body.project;
  assert.equal(String((await Project.findById(group._id)).supervisor), String(teacher._id));
  await write('post', '/api/admin/projects', studentCookie).send({}).expect(403);
});
test('admin adds members and the database prevents multiple active groups', async () => {
  await write('patch', `/api/admin/projects/${group._id}/group`, adminCookie).send({ teamName: group.teamName, title: group.title, members: [member.id, member2.id] }).expect(200);
  await write('post', '/api/admin/projects', adminCookie).send({ teamName: 'Conflicting group', title: 'Duplicate membership', members: [member.id] }).expect(409);
  await assert.rejects(Project.create({ title: 'Concurrent duplicate', createdBy: member.id, members: [member.id] }), { code: 11000 });
  const response = await write('patch', `/api/admin/projects/${group._id}/supervisor`, adminCookie).send({ teacherId: String(teacher._id) }).expect(200);
  assert.equal(response.body.project.supervisor._id, String(teacher._id));
});
test('a student views their own group and cannot see another group', async () => {
  const response = await request(app).get(`/api/projects/${group._id}`).set('Cookie', memberCookie).expect(200);
  assert.equal(response.body.project.members.length, 2);
  await request(app).get(`/api/projects/${group._id}`).set('Cookie', outsiderCookie).expect(404);
  await request(app).get(`/api/projects/${group._id}`).set('Cookie', studentCookie).expect(404);
});
test('student creates, edits and submits a complete proposal with an audit trail', async () => {
  const created = await write('post', '/api/proposals', memberCookie).send({ ...proposalFields, projectId: group._id, submit: false }).expect(201);
  proposal = created.body.proposal;
  await write('patch', `/api/proposals/${proposal._id}`, memberCookie).send(proposalFields).expect(200);
  await write('post', `/api/proposals/${proposal._id}/submit`, memberCookie).expect(200);
  const own = await request(app).get(`/api/proposals/${proposal._id}`).set('Cookie', memberCookie).expect(200);
  assert.equal(own.body.proposal.status, 'pending');
  assert.equal(own.body.proposal.auditTrail.length, 2);
});
test('an unauthorized teacher cannot review another teacher’s proposal', async () => {
  await write('patch', `/api/proposals/${proposal._id}/review`, outsiderTeacherCookie).send({ status: 'approved', comment: 'Unauthorized' }).expect(404);
  await write('patch', `/api/proposals/${proposal._id}`, outsiderCookie).send(proposalFields).expect(404);
});
test('assigned teacher requests revision and a student resubmits before approval', async () => {
  await write('patch', `/api/proposals/${proposal._id}/review`, teacherCookie).send({ status: 'revision_requested', comment: 'Clarify the evaluation methodology.' }).expect(200);
  await write('patch', `/api/proposals/${proposal._id}`, memberCookie).send({ ...proposalFields, methodology: 'User testing with accessible navigation tasks.' }).expect(200);
  await write('post', `/api/proposals/${proposal._id}/submit`, memberCookie).expect(200);
  await write('patch', `/api/proposals/${proposal._id}/review`, teacherCookie).send({ status: 'approved', comment: 'Ready to begin.' }).expect(200);
  const saved = await Proposal.findById(proposal._id);
  assert.equal(saved.status, 'approved'); assert.equal(saved.auditTrail.length, 5);
  assert.equal((await Project.findById(group._id)).status, 'active');
});
test('student uploads a valid PDF into private storage', async () => {
  const response = await write('post', `/api/projects/${group._id}/submissions`, memberCookie).attach('document', makePdf(), { filename: 'report.pdf', contentType: 'application/pdf' }).expect(201);
  submission = response.body.submission;
  assert.equal(submission.project, group._id); assert.equal(submission.revision, 1);
  assert.equal(JSON.stringify(response.body).includes(config.uploadDir), false);
  assert.ok((await fs.stat(path.join(config.uploadDir, submission.document.storageKey))).size > 0);
});
test('invalid file types, spoofed PDF bytes and oversized files are rejected', async () => {
  await write('post', `/api/projects/${group._id}/submissions`, memberCookie).attach('document', Buffer.from('executable'), { filename: 'bad.exe', contentType: 'application/pdf' }).expect(415);
  await write('post', `/api/projects/${group._id}/submissions`, memberCookie).attach('document', Buffer.from('not a PDF'), { filename: 'spoof.pdf', contentType: 'application/pdf' }).expect(422);
  await write('post', `/api/projects/${group._id}/submissions`, memberCookie).attach('document', Buffer.alloc(1024 * 1024 + 1), { filename: 'large.pdf', contentType: 'application/pdf' }).expect(413);
  await write('post', `/api/projects/${group._id}/submissions`, memberCookie).expect(400);
  assert.equal(await Submission.countDocuments({ project: group._id }), 1);
});
test('assigned teachers download documents and outsiders cannot', async () => {
  await request(app).get(`/api/submissions/${submission._id}/download`).set('Cookie', teacherCookie).expect(200).expect('Content-Disposition', /report.pdf/);
  await request(app).get(`/api/submissions/${submission._id}/download`).set('Cookie', memberCookie).expect(200);
  await request(app).get(`/api/submissions/${submission._id}/download`).set('Cookie', outsiderTeacherCookie).expect(404);
  await request(app).get(`/api/submissions/${submission._id}/download`).set('Cookie', outsiderCookie).expect(404);
});
test('resubmission keeps the previous report and increments its revision', async () => {
  const response = await write('post', `/api/submissions/${submission._id}/replace`, memberCookie).attach('document', makePdf('Updated academic report.'), { filename: 'updated.pdf', contentType: 'application/pdf' }).expect(201);
  assert.equal(response.body.submission.revision, 2); assert.equal(response.body.submission.supersedes, submission._id);
  await request(app).get(`/api/submissions/${submission._id}/download`).set('Cookie', memberCookie).expect(200);
  submission = response.body.submission;
});
test('teacher feedback is categorized, updates review status and is visible to the group', async () => {
  const response = await write('post', '/api/feedback', teacherCookie).send({ projectId: group._id, submissionId: submission._id, category: 'documentation', submissionStatus: 'revision_required', message: 'Add a clear methodology diagram.' }).expect(201);
  feedback = response.body.feedback;
  assert.equal((await Submission.findById(submission._id)).reviewStatus, 'revision_required');
  const list = await request(app).get('/api/feedback').set('Cookie', memberCookie).expect(200);
  assert.ok(list.body.feedback.some((item) => item._id === feedback._id && item.author.name));
  await write('post', '/api/feedback', outsiderTeacherCookie).send({ projectId: group._id, message: 'Not assigned' }).expect(404);
  await write('patch', `/api/feedback/${feedback._id}`, teacherCookie).send({ message: 'The revised diagram is clear.', category: 'technical', submissionStatus: 'reviewed' }).expect(200);
  assert.equal((await Feedback.findById(feedback._id)).category, 'technical');
});
test('teachers share valid DOCX resources and only authorized students download them', async () => {
  const response = await write('post', `/api/projects/${group._id}/resources`, teacherCookie).field('title', 'Report writing guide').field('description', 'Guidance for the project report.').attach('document', makeDocx(), { filename: 'guide.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }).expect(201);
  resource = response.body.resource;
  assert.ok(await Resource.findById(resource._id));
  await request(app).get(`/api/resources/${resource._id}/download`).set('Cookie', memberCookie).expect(200);
  await request(app).get(`/api/resources/${resource._id}/download`).set('Cookie', outsiderCookie).expect(404);
});
test('real workflow notifications persist before authenticated socket delivery', async () => {
  const socket = connectSocket(`http://127.0.0.1:${server.address().port}`, { extraHeaders: { Cookie: memberCookie }, reconnection: false });
  try {
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    const delivered = new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Notification delivery timed out.')), 4000); socket.once('notification', (record) => { clearTimeout(timer); resolve(record); }); });
    await write('post', '/api/feedback', teacherCookie).send({ projectId: group._id, message: 'Your group is making progress.' }).expect(201);
    const record = await delivered;
    assert.equal(String(record.recipient), member.id); assert.ok(await Notification.findById(record._id));
    const list = await request(app).get('/api/notifications').set('Cookie', memberCookie).expect(200);
    assert.ok(list.body.notifications.some((item) => item._id === record._id));
  } finally { socket.disconnect(); }
});
test('admin can remove a member and former membership no longer authorizes private records', async () => {
  await write('patch', `/api/admin/projects/${group._id}/group`, adminCookie).send({ teamName: group.teamName, title: group.title, members: [member2.id] }).expect(200);
  await request(app).get(`/api/projects/${group._id}`).set('Cookie', memberCookie).expect(404);
  assert.equal(String((await Project.findById(group._id)).createdBy), member2.id);
});
