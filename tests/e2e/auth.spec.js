import { test, expect } from '@playwright/test';
import '../../server/src/config/env.js';

for (const role of ['student', 'teacher', 'admin']) {
  test(`${role} login, restoration, authorization and logout`, async ({ page, isMobile }) => {
    await page.goto(`/${role}/dashboard`);
    await expect(page).toHaveURL(/login/);
    await page.getByLabel('Email address').fill(`${role}@fyp.demo`);
    await page.getByLabel('Password', { exact: true }).fill(process.env.DEMO_PASSWORD || 'FypDemo2026!');
    await page.getByRole('button', { name: 'Show password', exact: true }).click();
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${role}/dashboard`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Welcome, Demo.');
    const cookies = await page.context().cookies();
    expect(cookies.find((cookie) => cookie.name === 'fyp_session')?.httpOnly).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('fyp.accessToken'))).toBeNull();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Welcome, Demo.');
    const response = await page.request.get('/api/admin/users');
    expect(response.status()).toBe(role === 'admin' ? 200 : 403);
    await expect(page.getByRole('status', { name: 'Loading workspace data' })).toHaveCount(0);
    const width = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(width.content).toBeLessThanOrEqual(width.viewport);
    await page.screenshot({ path: `test-results/${role}-${isMobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
    if (isMobile) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await page.getByRole('link', { name: role === 'admin' ? 'Settings' : 'Profile', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(role === 'admin' ? 'System status' : 'Your profile');
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(/login/);
    await page.goto(`/${role}/dashboard`);
    await expect(page).toHaveURL(/login/);
  });
}
