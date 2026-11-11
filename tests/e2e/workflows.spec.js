import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { config } from '../../server/src/config/env.js';
import { makePdf, makeDocx } from '../fixtures/documents.js';

test('group, proposal, private report, feedback and resource workflows', async ({ page }) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const marker = `UI-${randomUUID().slice(0, 8)}`;
  const password = process.env.DEMO_PASSWORD || 'FypDemo2026!';
  const ids = []; let projectId;
  const signIn = async (email) => {
    await page.goto('/login'); await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/dashboard/);
  };
  try {
    await signIn('admin@fyp.demo');
    const create = async (role) => {
      const response = await page.request.post('/api/admin/users', { headers: { 'X-FYP-Request': '1' }, data: { name: `${marker} ${role}`, email: `${role}-${marker.toLowerCase()}@test.example`, role, password } });
      expect(response.status()).toBe(201); const { user } = await response.json(); ids.push(user.id); return user;
    };
    const student = await create('student'); const teacher = await create('teacher');
    await page.goto('/admin/groups'); await page.getByRole('button', { name: 'Create group', exact: true }).click();
    await page.getByLabel('Group name', { exact: true }).fill(marker);
    await page.getByLabel('Project title', { exact: true }).fill(`${marker} project`);
    await page.getByRole('combobox', { name: 'Supervisor (optional)', exact: true }).selectOption({ label: teacher.name });
    await page.getByRole('checkbox', { name: new RegExp(`${marker} student`) }).check();
    await page.getByRole('button', { name: 'Save group', exact: true }).click();
    await expect(page.getByText('Project group created.', { exact: true })).toBeVisible();
    const projects = await (await page.request.get('/api/admin/projects?limit=100')).json();
    projectId = projects.projects.find((project) => project.teamName === marker)._id;
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(/login/);
    await signIn(student.email); await page.goto('/student/proposals');
    await page.getByRole('button', { name: 'New proposal', exact: true }).click();
    await page.getByRole('combobox', { name: 'Project group', exact: true }).selectOption(projectId);
    await page.getByLabel('Project title', { exact: true }).fill(`${marker} accessible education`);
    await page.getByLabel('Abstract', { exact: true }).fill('A project investigating accessible educational resources.');
    await page.getByLabel('Problem statement', { exact: true }).fill('Students cannot easily discover academic resources.');
    await page.getByLabel('Objectives (one per line)', { exact: true }).fill('Improve accessibility\nEvaluate usability');
    await page.getByLabel('Proposed methodology', { exact: true }).fill('Build a prototype and evaluate it with representative tasks.');
    await page.getByLabel('Project domain', { exact: true }).fill('Academic accessibility');
    await page.getByLabel('Technologies (one per line)', { exact: true }).fill('React\nMongoDB');
    await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
    await expect(page.getByText('Proposal submitted for review.', { exact: true })).toBeVisible();
    await page.goto('/student/documents'); await page.getByRole('button', { name: 'Upload document', exact: true }).click();
    await page.getByRole('combobox', { name: 'Project group', exact: true }).selectOption(projectId);
    await page.getByLabel('PDF or DOCX document', { exact: true }).setInputFiles({ name: 'academic-report.pdf', mimeType: 'application/pdf', buffer: makePdf() });
    await page.locator('form').getByRole('button', { name: 'Upload document', exact: true }).click();
    await expect(page.getByText('Document uploaded successfully.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(/login/);
    await signIn(teacher.email); await page.goto('/teacher/proposals');
    await page.getByLabel('Review comments', { exact: true }).fill('The proposed methodology is suitable.');
    await page.getByRole('button', { name: 'Save review', exact: true }).click();
    await expect(page.getByText('Review decision saved.', { exact: true })).toBeVisible();
    await page.goto('/teacher/documents');
    const download = page.waitForEvent('download'); await page.getByRole('link', { name: 'Download document', exact: true }).click();
    expect((await download).suggestedFilename()).toBe('academic-report.pdf');
    await page.getByRole('link', { name: 'Submission details', exact: true }).click();
    await page.getByRole('button', { name: 'Give feedback', exact: true }).click();
    await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('technical');
    await page.getByRole('combobox', { name: 'Submission review status', exact: true }).selectOption('revision_required');
    await page.getByLabel('Feedback', { exact: true }).fill('Add a technical design diagram.');
    await page.getByRole('button', { name: 'Save feedback', exact: true }).click();
    await expect(page.getByText('Feedback saved.', { exact: true })).toBeVisible();
    await page.goto('/teacher/resources'); await page.getByRole('button', { name: 'Share resource', exact: true }).click();
    await page.getByRole('combobox', { name: 'Project group', exact: true }).selectOption(projectId);
    await page.getByLabel('Resource title', { exact: true }).fill('Report guide');
    await page.getByLabel('PDF or DOCX document', { exact: true }).setInputFiles({ name: 'guide.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: makeDocx() });
    await page.locator('form').getByRole('button', { name: 'Share resource', exact: true }).click();
    await expect(page.getByText('Resource shared with your project group.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(/login/);
    await signIn(student.email); await page.goto('/student/feedback');
    await expect(page.getByText('Add a technical design diagram.', { exact: true })).toBeVisible();
    await page.goto('/student/resources');
    const resourceDownload = page.waitForEvent('download'); await page.getByRole('link', { name: 'Download resource', exact: true }).click();
    expect((await resourceDownload).suggestedFilename()).toBe('guide.docx');
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  } finally {
    // Remove only this test's exact IDs and unique marker; never clear the application DB.
    const connection = await mongoose.createConnection(config.mongoUri).asPromise();
    try {
      if (projectId) {
        const project = new mongoose.Types.ObjectId(projectId);
        for (const collection of ['submissions', 'resources']) {
          const records = await connection.collection(collection).find({ project }).toArray();
          for (const record of records) if (/^[a-zA-Z0-9_-]+\.(pdf|docx)$/.test(record.document.storageKey)) await fs.unlink(path.join(config.uploadDir, record.document.storageKey)).catch(() => {});
        }
        for (const collection of ['proposals', 'submissions', 'feedback', 'resources', 'notifications']) await connection.collection(collection).deleteMany({ project });
        await connection.collection('projects').deleteOne({ _id: project, teamName: marker });
      }
      await connection.collection('notifications').deleteMany({ message: { $regex: marker } });
      await connection.collection('users').deleteMany({ _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) }, name: { $regex: marker } });
    } finally { await connection.close(); }
  }
});
