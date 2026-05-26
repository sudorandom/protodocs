import { test, expect } from '@playwright/test';

test.describe('Screenshot tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage config to prevent cached descriptor configs from interfering
    await page.addInitScript(() => {
      window.localStorage.removeItem('protodocs_config');
    });
  });

  test('message detail page', async ({ page }) => {
    // Navigate to a specific message symbol within a file
    await page.goto('/?descriptors=/googleapis.binpb,/gnostic.binpb,/protovalidate.binpb#/files/google/api/http.proto?symbol=.google.api.HttpRule');
    await expect(page.locator('[id=".google.api.HttpRule"]')).toBeVisible();
    await page.waitForTimeout(500);

    // Click on CustomHttpPattern type link to trigger the pinned tooltip showing "Go to Definition" / "Find References"
    await page.locator('span', { hasText: 'CustomHttpPattern' }).first().click();
    await expect(page.locator('button', { hasText: 'Go to Definition' })).toBeVisible();
    await page.waitForTimeout(300);

    await page.screenshot({ path: 'e2e/screenshots/01-message-detail.png' });
  });

  test('service detail page', async ({ page }) => {
    // Navigate to a specific service symbol
    await page.goto('/?descriptors=/googleapis.binpb,/gnostic.binpb,/protovalidate.binpb#/files/google/bytestream/bytestream.proto?symbol=.google.bytestream.ByteStream');
    await expect(page.locator('[id=".google.bytestream.ByteStream"]')).toBeVisible();
    await page.waitForTimeout(500);

    // Click on the QueryWriteStatus RPC row to expand the Try-it-now tester
    await page.locator('span', { hasText: 'QueryWriteStatus' }).first().click();
    // Wait for the Try-it-now panel to expand and the "Send Request" button to be visible
    await expect(page.locator('button', { hasText: 'Send Request' })).toBeVisible();
    await page.waitForTimeout(300);

    await page.screenshot({ path: 'e2e/screenshots/02-service-detail.png' });
  });

  test('file source page', async ({ page }) => {
    // View a general protobuf file layout
    await page.goto('/?descriptors=/googleapis.binpb,/gnostic.binpb,/protovalidate.binpb#/files/google/api/resource.proto');
    await expect(page.locator('span', { hasText: 'resource.proto' }).first()).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/03-file-source.png' });
  });

  test('search results page', async ({ page }) => {
    // Use resource.proto instead of the home screen to avoid home screen text dependency
    await page.goto('/?descriptors=/googleapis.binpb,/gnostic.binpb,/protovalidate.binpb#/files/google/api/resource.proto');
    await expect(page.locator('span', { hasText: 'resource.proto' }).first()).toBeVisible();

    const searchInput = page.getByPlaceholder('Search types or files...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('error');

    // Wait for the absolute search dropdown to be visible
    await expect(page.locator('.absolute.top-full')).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/04-search-results.png' });
  });
});

