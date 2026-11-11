import { randomUUID, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import request from 'supertest';
import { io as socketClient } from 'socket.io-client';
import { makePdf } from '../../tests/fixtures/documents.js';
import dotenv from 'dotenv';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
if (process.env.NODE_ENV === 'production') throw new Error('Live development smoke testing is disabled in production.');
const runId = randomUUID().replaceAll('-', ''); const dbName = `fyp_test_${runId}`;
process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.UPLOAD_DIR = fileURLToPath(new URL(`../../.local/live-ai-${runId}/`, import.meta.url));
const { config } = await import('../src/config/env.js');
const { createApp } = await import('../src/app.js');
const { initializeSockets } = await import('../src/services/socketService.js');
const { seedDemoUsers } = await import('./seed.js');
const models = await import('../src/models/index.js');
const { Project, Proposal, Evaluation } = models;
const app = createApp(); const server = createServer(app); const io = initializeSockets(server); app.set('io', io);
const sockets = []; let result;
const write = (method, url, cookie) => request(app)[method](url).set('X-FYP-Request', '1').set('Cookie', cookie || '');
const password = process.env.DEMO_PASSWORD || 'FypDemo2026!';
const received = [];
async function connect(cookie) {
  const socket = socketClient(`http://127.0.0.1:${server.address().port}`, { extraHeaders: { Cookie: cookie }, reconnection: false });
  sockets.push(socket); socket.on('notification', (record) => received.push(record));
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
}
async function delivered(predicate) {
  const end = Date.now() + 4000;
  while (!received.some(predicate)) { if (Date.now() > end) throw new Error('SOCKET_DELIVERY_FAILED'); await new Promise((resolve) => setTimeout(resolve, 20)); }
}

try {
  if (!config.mongoUri || !config.groqApiKey || !config.groqModel) throw new Error('MONGODB_AND_GROQ_CONFIGURATION_REQUIRED');
  await mongoose.connect(config.mongoUri, { dbName, serverSelectionTimeoutMS: 10000 });
  await Promise.all(Object.values(models).map((model) => model.createIndexes()));
  await seedDemoUsers({ connect: false });
  const login = async (role) => (await write('post', '/api/auth/login').send({ email: `${role}@fyp.demo`, password }).expect(200)).headers['set-cookie'][0].split(';')[0];
  const [studentCookie, teacherCookie] = await Promise.all(['student', 'teacher'].map(login));
  const project = await Project.findOne({ teamName: 'Team Horizon' }); const proposal = await Proposal.findOne({ project: project._id });
  await write('patch', `/api/proposals/${proposal._id}/review`, teacherCookie).send({ status: 'approved', comment: 'Synthetic report smoke-test project.' }).expect(200);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  await Promise.all([connect(studentCookie), connect(teacherCookie)]);
  const text = 'Synthetic academic project report. Abstract: A campus resource discovery prototype improves access to academic materials. Introduction: Students use fragmented channels. Problem: resources are difficult to find. Objectives: centralize resources and evaluate discoverability. Literature review: prior systems organize academic collaboration; this synthetic report has no cited experiments. Methodology: design a MERN prototype and test search tasks. Implementation: React, Express, MongoDB, role-based access and private document storage. Results: no quantitative user study has been completed. Conclusion: formal usability testing and performance evaluation remain future work. References: none.';
  const uploaded = await write('post', `/api/projects/${project._id}/submissions`, studentCookie).attach('document', makePdf(text), { filename: 'synthetic-report.pdf', contentType: 'application/pdf' }).expect(201);
  const report = uploaded.body.submission;
  const evaluated = await write('post', `/api/submissions/${report._id}/evaluate`, studentCookie);
  if (evaluated.status !== 201) throw new Error(evaluated.body.error?.code || 'AI_WORKFLOW_FAILED');
  const evaluation = evaluated.body.evaluation;
  await delivered((record) => record.resourceType === 'evaluation' && record.resourceId === evaluation._id);
  if ((await Project.findById(project._id)).aiAttemptsUsed !== 1) throw new Error('ATTEMPT_NOT_PERSISTED');
  await write('post', `/api/projects/${project._id}/final-submission`, studentCookie).send({ submissionId: report._id }).expect(200);
  const graded = await write('post', `/api/projects/${project._id}/final-grade`, teacherCookie).send({ criteria: evaluation.criteria.map((criterion) => ({ name: criterion.name, marks: Math.min(criterion.maxMarks, criterion.marks + 1) })), comment: 'Synthetic smoke test: teacher adjustment, not an institutional grade.' }).expect(200);
  await delivered((record) => record.type === 'grade');
  const original = await Evaluation.findById(evaluation._id);
  if (original.totalScore !== evaluation.totalScore) throw new Error('ORIGINAL_AI_SCORE_CHANGED');
  result = { status: 'passed', provider: 'Groq', model: config.groqModel, criteria: evaluation.criteria.length,
    actualUploadedPdfExtracted: true, actualProviderCall: true, aiScore: evaluation.totalScore,
    teacherScore: graded.body.project.finalGrade.score, successfulAttempts: 1,
    aiNotificationDelivered: true, gradeNotificationDelivered: true, originalAiScorePreserved: true };
} catch (error) {
  console.error(`[ai-workflow] Failed: ${error.code || error.message || error.name}`); process.exitCode = 1;
} finally {
  sockets.forEach((socket) => socket.disconnect()); await new Promise((resolve) => io.close(resolve));
  if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName && /^fyp_test_[a-f0-9]{32}$/.test(dbName)) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  const root = path.resolve(fileURLToPath(new URL('../../.local/', import.meta.url))); const target = path.resolve(config.uploadDir);
  if (target.startsWith(root + path.sep) && path.basename(target) === `live-ai-${runId}`) await fs.rm(target, { recursive: true, force: true });
}
if (result) console.log(JSON.stringify({ ...result, temporaryDataRemoved: true }));
