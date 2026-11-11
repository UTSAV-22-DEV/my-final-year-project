import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../server/src/config/env.js';
import { Evaluation } from '../../server/src/models/Evaluation.js';
import { rubric, rubricVersion } from '../../server/src/config/rubric.js';
import { makePdf } from '../fixtures/documents.js';

test('separate student and teacher sessions receive persisted live feedback and grades', async ({ page, browser, request, isMobile }) => {
  test.setTimeout(120000); page.setDefaultTimeout(15000);
  const marker = `RT-${randomUUID().slice(0, 8)}`; const ids = []; let projectId;
  const password = process.env.DEMO_PASSWORD || 'FypDemo2026!';
  const teacherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' }); const teacherPage = await teacherContext.newPage();
  const errors = []; page.on('pageerror', (error) => errors.push(error.message)); teacherPage.on('pageerror', (error) => errors.push(error.message));
  const login = async (target, email) => { await target.goto('/login'); await target.getByLabel('Email address').fill(email); await target.getByLabel('Password', { exact: true }).fill(password); await target.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(target).toHaveURL(/dashboard/); };
  const headers = { 'X-FYP-Request': '1' };
  try {
    expect((await request.post('/api/auth/login', { headers, data: { email: 'admin@fyp.demo', password } })).ok()).toBe(true);
    const createUser = async (role) => { const result = await request.post('/api/admin/users', { headers, data: { name: `${marker} ${role}`, email: `${role}-${marker.toLowerCase()}@test.example`, role, password } }); expect(result.status()).toBe(201); const { user } = await result.json(); ids.push(user.id); return user; };
    const student = await createUser('student'); const teacher = await createUser('teacher');
    const created = await request.post('/api/admin/projects', { headers, data: { teamName: marker, title: `${marker} project`, members: [student.id], teacherId: teacher.id } });
    expect(created.status()).toBe(201); projectId = (await created.json()).project._id;
    await login(page, student.email); await login(teacherPage, teacher.email);
    await page.goto('/student/notifications'); await expect(page.getByText(/Live updates connected/)).toBeVisible();
    await page.getByRole('button', { name: 'Mark all as read', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Notifications, 0 unread', exact: true })).toBeVisible(); await page.goto('/student/dashboard');
    const teacherCount = (await (await teacherPage.request.get('/api/notifications/unread-count')).json()).unreadCount;
    const proposed = await page.request.post('/api/proposals', { headers, data: { projectId, title: `${marker} accessibility`, abstract: 'Accessible resource discovery.', problemStatement: 'Academic resources are fragmented.', objectives: ['Improve discovery'], methodology: 'Prototype and usability testing.', domain: 'Education', technologies: ['React', 'MongoDB'] } });
    expect(proposed.status()).toBe(201);
    await expect(teacherPage.getByRole('button', { name: `Notifications, ${teacherCount + 1} unread`, exact: true })).toBeVisible();
    await teacherPage.goto('/teacher/proposals'); await teacherPage.getByLabel('Review comments', { exact: true }).fill('Approved for the live notification test.');
    await teacherPage.getByRole('button', { name: 'Save review', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Notifications, 1 unread', exact: true })).toBeVisible();
    await page.goto('/student/notifications'); await page.getByRole('button', { name: 'Mark all as read', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Notifications, 0 unread', exact: true })).toBeVisible(); await page.goto('/student/dashboard');
    await teacherPage.goto('/teacher/feedback'); await teacherPage.getByRole('button', { name: 'Give feedback', exact: true }).click();
    await teacherPage.getByRole('combobox', { name: 'Assigned project', exact: true }).selectOption(projectId);
    await teacherPage.getByLabel('Feedback', { exact: true }).fill('Live feedback: add a reproducible evaluation method.');
    await teacherPage.getByRole('button', { name: 'Save feedback', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Notifications, 1 unread', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/student\/dashboard/);
    await page.getByRole('button', { name: 'Notifications, 1 unread', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Latest notifications' })).toBeVisible();
    await page.screenshot({ path: `test-results/live-notifications-${isMobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
    await page.getByRole('button', { name: /^New supervisor feedback/ }).click();
    await expect(page).toHaveURL(/student\/feedback/);
    await expect(page.getByText('Live feedback: add a reproducible evaluation method.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Notifications, 0 unread', exact: true })).toBeVisible();
    await page.reload(); await expect(page.getByRole('button', { name: 'Notifications, 0 unread', exact: true })).toBeVisible();
    await page.goto('/student/notifications');
    await page.getByRole('button', { name: 'Delete notification: New supervisor feedback', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Delete notification: New supervisor feedback', exact: true })).toHaveCount(0);
    const uploaded = await page.request.post(`/api/projects/${projectId}/submissions`, { headers, multipart: { document: { name: 'final-report.pdf', mimeType: 'application/pdf', buffer: makePdf() } } });
    expect(uploaded.status()).toBe(201); const report = (await uploaded.json()).submission;
    // Only the external AI result is a temporary, explicitly named test fixture.
    // Final submission, grading, sockets and notification persistence are real.
    const connection = await mongoose.createConnection(config.mongoUri).asPromise();
    try {
      const stored = await connection.collection('submissions').findOne({ _id: new mongoose.Types.ObjectId(report._id) });
      const evaluation = new Evaluation({ project: projectId, submission: report._id, requestedBy: student.id, attempt: 1, status: 'completed', model: 'automated-browser-fixture-not-provider-output', rubricVersion,
        document: stored.document, totalScore: 50, suggestions: 'Automated browser fixture.', completedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
        criteria: rubric.map((criterion) => ({ ...criterion, marks: criterion.maxMarks / 2, explanation: 'Automated browser fixture.', strengths: ['Clear intent.'], weaknesses: ['Needs evidence.'], improvements: ['Add measured results.'] })) });
      await evaluation.validate(); await connection.collection('evaluations').insertOne(evaluation.toObject());
      await connection.collection('projects').updateOne({ _id: new mongoose.Types.ObjectId(projectId) }, { $set: { aiAttemptsUsed: 1 } });
    } finally { await connection.close(); }
    expect((await page.request.post(`/api/projects/${projectId}/final-submission`, { headers, data: { submissionId: report._id } })).ok()).toBe(true);
    await page.goto('/student/dashboard');
    await teacherPage.goto(`/teacher/evaluations?project=${projectId}`);
    await teacherPage.getByRole('spinbutton', { name: 'Teacher marks for Abstract and Summary', exact: true }).fill('5');
    await teacherPage.getByLabel('Teacher comments', { exact: true }).fill('Final report reviewed; teacher adjustment is recorded.');
    await teacherPage.getByRole('button', { name: 'Finalize grade', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Notifications, 1 unread', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Notifications, 1 unread', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Notifications, 1 unread', exact: true }).click();
    await page.getByRole('button', { name: /^Final grade available/ }).click();
    await expect(page).toHaveURL(/student\/evaluations\?project=/);
    await expect(page.getByRole('heading', { name: 'Teacher-finalized grade', exact: true })).toBeVisible();
    await expect(page.getByText('52.5 / 100', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Notifications, 0 unread', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await teacherContext.close();
    const connection = await mongoose.createConnection(config.mongoUri).asPromise();
    try {
      if (projectId) {
        const project = new mongoose.Types.ObjectId(projectId);
        for (const name of ['submissions', 'resources']) for (const record of await connection.collection(name).find({ project }).toArray()) if (/^[a-zA-Z0-9_-]+\.(pdf|docx)$/.test(record.document.storageKey)) await fs.unlink(path.join(config.uploadDir, record.document.storageKey)).catch(() => {});
        for (const name of ['submissions', 'proposals', 'feedback', 'resources', 'evaluations', 'notifications']) await connection.collection(name).deleteMany({ project });
        await connection.collection('projects').deleteOne({ _id: project, teamName: marker });
      }
      await connection.collection('notifications').deleteMany({ message: { $regex: marker } });
      await connection.collection('users').deleteMany({ _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) }, name: { $regex: marker } });
    } finally { await connection.close(); }
  }
});
