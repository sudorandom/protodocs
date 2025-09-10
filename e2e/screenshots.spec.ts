import { test, expect } from '@playwright/test';

test.describe('Screenshot tests', () => {
  test('main package list page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Available Packages' })).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/01-package-list.png', fullPage: true });
  });

  test('package index page', async ({ page }) => {
    await page.goto('/package/buf.registry.owner.v1');
    await expect(page.getByRole('main').getByRole('heading', { name: 'buf.registry.owner.v1' })).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/02-package-index.png', fullPage: true });
  });

  test('message detail page', async ({ page }) => {
    await page.goto('/package/buf.registry.owner.v1/messages/Owner');
    await expect(page.getByRole('heading', { name: 'Owner', exact: true })).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/03-message-detail.png', fullPage: true });
  });

  test('service detail page', async ({ page }) => {
    await page.goto('/package/buf.registry.owner.v1/services/OrganizationService');
    await expect(page.getByRole('heading', { name: 'OrganizationService' })).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/04-service-detail.png', fullPage: true });
  });

  test('file source page', async ({ page }) => {
    await page.goto('/package/buf.registry.owner.v1/files/buf+registry+owner+v1+owner.proto');
    await expect(page.getByRole('heading', { name: 'buf/registry/owner/v1/owner.proto' })).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/05-file-source.png', fullPage: true });
  });
});
