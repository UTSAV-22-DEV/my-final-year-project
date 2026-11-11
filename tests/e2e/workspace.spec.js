import { test, expect } from '@playwright/test';

test('workspace loads, routes navigate, and live services report accurately', async ({ page, request, isMobile }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  const body = await health.json();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Great projects start here');
  await expect(page.getByRole('heading', { name: 'Database', exact: true }).locator('..')).toContainText(body.database.status === 'connected' ? 'Connected' : 'Setup required');
  const width = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(width.content).toBeLessThanOrEqual(width.viewport);
  await page.screenshot({ path: `test-results/workspace-${isMobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
  if (isMobile) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('link', { name: 'AI evaluations', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'AI evaluations' })).toBeVisible();
  await expect(page.getByText('Two AI-assisted attempts before final submission')).toBeVisible();
  await page.getByRole('link', { name: 'View system status' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'System status' })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh status' }).click();
  await expect(page.getByText('Service availability')).toBeVisible();
  await page.goto('/not-a-page');
  await expect(page.getByRole('heading', { name: 'This path is still unwritten.' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
