import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import request from 'supertest';
import { makePdf } from '../../tests/fixtures/documents.js';

const runId = randomUUID().replaceAll('-', ''); const databaseName = `fyp_test_${runId}`;
process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'assessment-integration-test-signing-key-only';
process.env.UPLOAD_DIR = fileURLToPath(new URL(`../../.local/assessment-uploads-${runId}/`, import.meta.url));
const { config } = await import('../src/config/env.js');
const { createApp } = await import('../src/app.js');
const models = await import('../src/models/index.js');
const { seedDemoUsers } = await import('../scripts/seed.js');
const { rubric } = await import('../src/config/rubric.js');
const { AppError } = await import('../src/utils/AppError.js');
const { hashPassword } = await import('../src/services/passwordService.js');
const { User, Project, Proposal, Evaluation } = models;
const app = createApp(); app.set('evaluationModel', 'automated-test-only');
const password = process.env.DEMO_PASSWORD || 'FypDemo2026!';
const write = (method, url, cookie) => request(app)[method](url).set('X-FYP-Request', '1').set('Cookie', cookie || '');
const valid = () => ({ criteria: rubric.map((criterion) => ({ name: criterion.name, marks: criterion.maxMarks / 2, explanation: 'Automated API mock, not actual Grok output.', strengths: ['Clear objectives.'], weaknesses: ['More evidence needed.'], improvements: ['Measure the outcomes.'] })), suggestions: 'Expand the evidence.' });
let studentCookie, teacherCookie, outsiderCookie, group, report, finalReport, firstEvaluation;
async function login(email) { return (await write('post', '/api/auth/login').send({ email, password }).expect(200)).headers['set-cookie'][0].split(';')[0]; }
before(async () => {
  if (!config.mongoUri) throw new Error('MONGODB_URI is required for assessment integration tests.');
  await mongoose.connect(config.mongoUri, { dbName: databaseName, serverSelectionTimeoutMS: 10000 });
  await Promise.all(Object.values(models).map((model) => model.createIndexes()));
  await seedDemoUsers({ connect: false });
  await User.create({ name: 'Unassigned Teacher', email: 'unassigned@test.example', role: 'teacher', passwordHash: await hashPassword(password) });
  [studentCookie, teacherCookie, outsiderCookie] = await Promise.all(['student@fyp.demo', 'teacher@fyp.demo', 'unassigned@test.example'].map(login));
  group = await Project.findOne({ teamName: 'Team Horizon' });
  const proposal = await Proposal.findOne({ project: group._id });
  await write('patch', `/api/proposals/${proposal._id}/review`, teacherCookie).send({ status: 'approved', comment: 'Approved for the assessment test.' }).expect(200);
  report = (await write('post', `/api/projects/${group._id}/submissions`, studentCookie).attach('document', makePdf('Introduction, methodology, implementation and results for an academic project.'), { filename: 'report.pdf', contentType: 'application/pdf' }).expect(201)).body.submission;
});
after(async () => {
  if (mongoose.connection.readyState === 1 && mongoose.connection.name === databaseName && /^fyp_test_[a-f0-9]{32}$/.test(databaseName)) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  const root = path.resolve(fileURLToPath(new URL('../../.local/', import.meta.url))); const target = path.resolve(config.uploadDir);
  if (target.startsWith(root + path.sep) && path.basename(target) === `assessment-uploads-${runId}`) await fs.rm(target, { recursive: true, force: true });
});

test('failed API requests do not consume attempts or leave a lease', async () => {
  app.set('evaluateReport', async () => { throw new AppError(502, 'Test upstream failure.', 'AI_UNAVAILABLE'); });
  await write('post', `/api/submissions/${report._id}/evaluate`, studentCookie).expect(502);
  assert.equal(await Evaluation.countDocuments(), 0); const project = await Project.findById(group._id); assert.equal(project.aiAttemptsUsed, 0); assert.equal(project.evaluationLock, undefined);
});
test('invalid documents do not consume attempts', async () => {
  const corrupt = (await write('post', `/api/projects/${group._id}/submissions`, studentCookie).attach('document', Buffer.from('%PDF-1.4\ncorrupt'), { filename: 'corrupt.pdf', contentType: 'application/pdf' }).expect(201)).body.submission;
  app.set('evaluateReport', async () => { throw new Error('The API must not be called for an invalid report.'); });
  await write('post', `/api/submissions/${corrupt._id}/evaluate`, studentCookie).expect(422);
  assert.equal(await Evaluation.countDocuments(), 0);
});
test('first successful evaluation is persisted as attempt one with a document snapshot', async () => {
  app.set('evaluateReport', async () => valid());
  const response = await write('post', `/api/submissions/${report._id}/evaluate`, studentCookie).expect(201);
  firstEvaluation = response.body.evaluation;
  assert.equal(firstEvaluation.attempt, 1); assert.equal(firstEvaluation.totalScore, 50); assert.equal(firstEvaluation.document.originalName, 'report.pdf');
  assert.equal((await Project.findById(group._id)).aiAttemptsUsed, 1);
});
test('invalid AI results do not consume the remaining attempt', async () => {
  app.set('evaluateReport', async () => { const value = valid(); value.criteria[0].marks = 100; return value; });
  await write('post', `/api/submissions/${report._id}/evaluate`, studentCookie).expect(502);
  assert.equal(await Evaluation.countDocuments(), 1);
});
test('concurrent requests cannot bypass the lease and second successful attempt', async () => {
  let begin, finish; const entered = new Promise((resolve) => { begin = resolve; }); const release = new Promise((resolve) => { finish = resolve; });
  app.set('evaluateReport', async () => { begin(); await release; return valid(); });
  const first = write('post', `/api/submissions/${report._id}/evaluate`, studentCookie).then((response) => response);
  await entered;
  const second = await write('post', `/api/submissions/${report._id}/evaluate`, studentCookie).expect(409);
  assert.equal(second.body.error.code, 'EVALUATION_IN_PROGRESS');
  finish(); const response = await first; assert.equal(response.status, 201); assert.equal(response.body.evaluation.attempt, 2);
  assert.equal(await Evaluation.countDocuments(), 2); assert.equal((await Project.findById(group._id)).aiAttemptsUsed, 2);
});
test('a third successful evaluation is rejected without another model call', async () => {
  app.set('evaluateReport', async () => { throw new Error('The model must not be called after two attempts.'); });
  const response = await write('post', `/api/submissions/${report._id}/evaluate`, studentCookie).expect(409);
  assert.equal(response.body.error.code, 'ATTEMPT_LIMIT');
});
test('unassigned teachers cannot read or grade the project evaluation', async () => {
  await request(app).get(`/api/evaluations/${firstEvaluation._id}`).set('Cookie', teacherCookie).expect(200);
  await request(app).get(`/api/evaluations/${firstEvaluation._id}`).set('Cookie', outsiderCookie).expect(404);
  await write('post', `/api/projects/${group._id}/final-grade`, outsiderCookie).send({}).expect(404);
  const other = await User.create({ name: 'Outside student', email: 'outside@test.example', role: 'student', passwordHash: await hashPassword(password) });
  const cookie = await login(other.email);
  await write('post', `/api/submissions/${report._id}/evaluate`, cookie).expect(404);
});
test('final report submission preserves evaluations and locks further evaluation and uploads', async () => {
  finalReport = (await write('post', `/api/projects/${group._id}/submissions`, studentCookie).attach('document', makePdf('Revised final academic report.'), { filename: 'final.pdf', contentType: 'application/pdf' }).expect(201)).body.submission;
  await Project.updateOne({ _id: group._id }, { $set: { evaluationLock: { id: 'stale-crashed-worker', at: new Date(Date.now() - 6 * 60 * 1000) } } });
  await write('post', `/api/projects/${group._id}/final-submission`, studentCookie).send({ submissionId: finalReport._id }).expect(200);
  await write('post', `/api/submissions/${report._id}/evaluate`, studentCookie).expect(409);
  await write('post', `/api/projects/${group._id}/submissions`, studentCookie).attach('document', makePdf(), { filename: 'late.pdf', contentType: 'application/pdf' }).expect(409);
  assert.equal(await Evaluation.countDocuments(), 2);
});
test('teacher score validation rejects marks above the rubric maximum', async () => {
  const criteria = rubric.map((criterion) => ({ name: criterion.name, marks: criterion.maxMarks })); criteria[0].marks = 6;
  await write('post', `/api/projects/${group._id}/final-grade`, teacherCookie).send({ criteria, comment: 'Invalid score test.' }).expect(400);
});
test('assigned teacher adjusts and finalizes marks while original AI marks remain immutable', async () => {
  const criteria = rubric.map((criterion, index) => ({ name: criterion.name, marks: criterion.maxMarks - (index === 0 ? 1 : 0) }));
  const response = await write('post', `/api/projects/${group._id}/final-grade`, teacherCookie).send({ criteria, comment: 'Teacher reviewed the final report.', totalScore: 1 }).expect(200);
  assert.equal(response.body.project.finalGrade.score, 99); assert.equal(response.body.project.status, 'completed');
  const original = await Evaluation.findById(firstEvaluation._id); assert.equal(original.totalScore, 50); assert.equal(original.criteria[0].marks, 2.5);
  assert.ok(response.body.project.finalGrade.finalizedBy); assert.ok(response.body.project.finalGrade.finalizedAt);
  await write('post', `/api/projects/${group._id}/final-grade`, teacherCookie).send({ criteria, comment: 'Second finalization.' }).expect(409);
  await write('post', `/api/projects/${group._id}/final-grade`, studentCookie).send({ criteria, comment: 'Unauthorized.' }).expect(403);
});
