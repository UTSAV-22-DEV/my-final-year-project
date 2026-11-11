import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User, Project, Proposal, Submission, Evaluation, Feedback, Notification, Resource } from '../src/models/index.js';

const id = () => new mongoose.Types.ObjectId();
const creator = id();
const project = () => ({ title: 'Academic project', createdBy: creator, members: [creator] });
const file = { originalName: 'report.pdf', storageKey: 'report-test.pdf', mimeType: 'application/pdf', size: 120 };
const evaluation = () => ({ project: id(), submission: id(), requestedBy: creator, attempt: 1 });
const criteria = () => Array.from({ length: 10 }, (_, index) => ({ name: `Test criterion ${index + 1}`, maxMarks: 10, marks: 8 }));

test('all eight models accept a minimal structurally valid document', async () => {
  const documents = [
    new User({ name: 'Student', email: 'student@example.edu', role: 'student', passwordHash: `$2b$12$${'x'.repeat(53)}` }),
    new Project(project()),
    new Proposal({ project: id(), submittedBy: creator, title: 'Idea', abstract: 'Proposal abstract' }),
    new Submission({ project: id(), submittedBy: creator, document: file }),
    new Evaluation(evaluation()),
    new Feedback({ project: id(), author: creator, message: 'Please review the methodology.' }),
    new Notification({ recipient: creator, type: 'system', title: 'Update', message: 'A workspace update.' }),
    new Resource({ title: 'Report guide', uploadedBy: creator, document: file }),
  ];
  for (const document of documents) await document.validate();
});

test('a group must contain its creator, unique members, and at most two attempts', async () => {
  await assert.rejects(new Project({ ...project(), members: [] }).validate());
  await assert.rejects(new Project({ ...project(), members: [id()] }).validate());
  await assert.rejects(new Project({ ...project(), members: [creator, creator] }).validate());
  await assert.rejects(new Project({ ...project(), aiAttemptsUsed: 3 }).validate());
  await assert.rejects(new Project({ ...project(), aiAttemptsUsed: 1.5 }).validate());
});

test('completed AI evaluations require ten weighted criteria and an accurate total', async () => {
  const valid = { ...evaluation(), status: 'completed', model: 'test-model-only', criteria: criteria(), totalScore: 80 };
  await new Evaluation(valid).validate();
  await assert.rejects(new Evaluation({ ...valid, totalScore: 90 }).validate());
  await assert.rejects(new Evaluation({ ...valid, criteria: criteria().slice(0, 9) }).validate());
  const overweight = criteria();
  overweight[0].maxMarks = 11;
  await assert.rejects(new Evaluation({ ...valid, criteria: overweight }).validate());
  const excessMarks = criteria();
  excessMarks[0].marks = 11;
  await assert.rejects(new Evaluation({ ...valid, criteria: excessMarks, totalScore: 83 }).validate());
  await assert.rejects(new Evaluation({ ...valid, attempt: 3 }).validate());
  assert.ok(Evaluation.schema.indexes().some(([keys, options]) => keys.project && keys.attempt && options.unique));
});

test('final grades need an identified reviewer and stay independent of AI scores', async () => {
  await assert.rejects(new Project({ ...project(), finalGrade: { score: 70 } }).validate());
  await assert.rejects(new Project({ ...project(), finalGrade: { score: 101, finalizedBy: id(), finalizedAt: new Date() } }).validate());
  const document = new Project({ ...project(), finalGrade: { score: 90, finalizedBy: id(), finalizedAt: new Date() } });
  await document.validate();
  assert.equal(document.aiAttemptsUsed, 0);
});

test('file keys cannot escape storage and restricted resources need a project', async () => {
  await assert.rejects(new Submission({ project: id(), submittedBy: creator, document: { ...file, storageKey: '../report.pdf' } }).validate());
  await assert.rejects(new Resource({ title: 'Guide', uploadedBy: creator, audience: 'project', document: file }).validate());
});

test('user roles are constrained, emails normalized and password hashes never serialized', async () => {
  const document = new User({ name: 'Admin', email: ' ADMIN@Example.edu ', role: 'admin', passwordHash: `$2b$12$${'x'.repeat(53)}` });
  await document.validate();
  assert.equal(document.email, 'admin@example.edu');
  assert.equal(document.toJSON().passwordHash, undefined);
  document.role = 'superuser';
  await assert.rejects(document.validate());
});
