import { test, expect } from '@playwright/test';

test.describe('Screenshot tests', () => {
  test('main package list page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Available Packages' })).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/01-package-list.png' });
  });

  test('package index page', async ({ page }) => {
    await page.goto('/package/google.api');
    await expect(page.getByRole('main').getByRole('heading', { name: 'google.api' })).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/02-package-index.png' });
  });

  test('message detail page', async ({ page }) => {
    await page.goto('/package/google.api/messages/HttpRule');
    await expect(page.getByRole('heading', { name: 'HttpRule', exact: true })).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/03-message-detail.png' });
  });

  test('service detail page', async ({ page }) => {
    await page.goto('/package/google.bytestream/services/ByteStream');
    await expect(page.getByRole('heading', { name: 'ByteStream', exact: true })).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/04-service-detail.png' });
  });

  test('file source page', async ({ page }) => {
    await page.goto('/package/google.api/files/google+api+resource.proto');
    await expect(page.getByRole('heading', { name: 'google/api/resource.proto' })).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/05-file-source.png' });
  });
});
