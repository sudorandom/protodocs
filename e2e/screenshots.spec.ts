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

    // Verify syntax keyword tooltip works
    const syntaxKeyword = page.locator('span', { hasText: 'syntax' }).first();
    await expect(syntaxKeyword).toBeVisible();
    await syntaxKeyword.click();
    await expect(page.locator('div', { hasText: 'Protobuf Keyword' }).first()).toBeVisible();
    await expect(page.locator('a', { hasText: 'View Docs ↗' })).toBeVisible();

    // Close the tooltip
    await page.locator('div.fixed.z-50 button').first().click();

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

  test('prioritized paths and file highlights', async ({ page }) => {
    // Navigate with query parameters setting google/protobuf prioritized and descriptor.proto highlighted
    await page.goto('/?descriptors=/googleapis.binpb,/gnostic.binpb,/protovalidate.binpb&prioritizedPaths=google/protobuf&highlightedFiles=google/protobuf/descriptor.proto');
    
    // The google/protobuf/ folder and descriptor.proto file with its Core badge should be visible
    await expect(page.locator('span', { hasText: 'google/protobuf/' }).first()).toBeVisible();
    await expect(page.locator('span', { hasText: 'descriptor.proto' }).first()).toBeVisible();
    await expect(page.locator('span', { hasText: '★' }).first()).toBeVisible();
  });

  test('quickbrowse outline browser and navigation', async ({ page }) => {
    // Navigate directly to the eliza.proto file to activate the Quick Browse button
    await page.goto('/?descriptors=/eliza.binpb#/files/connectrpc/eliza/v1/eliza.proto');
    
    // Verify the Quick Browse button in the top navbar is visible
    const fabButton = page.locator('button[title*="Quick Browse Outline"]');
    await expect(fabButton).toBeVisible();

    // Click the button to open the modal
    await fabButton.click();
    
    // Verify modal and search input is visible
    const searchInput = page.locator('input[placeholder*="Search services, messages, enums"]');
    await expect(searchInput).toBeVisible();

    // Fill search query to filter
    await searchInput.fill('ElizaService');
    
    // Verify the ElizaService item is visible with its service badge
    const item = page.locator('span', { hasText: 'ElizaService' }).first();
    await expect(item).toBeVisible();
    await expect(page.locator('span', { hasText: 'service' }).first()).toBeVisible();

    // Click the item to navigate
    await item.click();

    // Verify the modal is closed
    await expect(searchInput).not.toBeVisible();
  });

  test('home page hash navigation and logo clicks', async ({ page }) => {
    // Start at a file page
    await page.goto('/?descriptors=/googleapis.binpb,/gnostic.binpb,/protovalidate.binpb#/files/google/api/http.proto');
    await expect(page.locator('[id=".google.api.HttpRule"]')).toBeVisible();

    // Click the home logo link in the sidebar
    const logoLink = page.locator('div.flex.items-center.gap-2.truncate.cursor-pointer').first();
    await expect(logoLink).toBeVisible();
    await logoLink.click();

    // Verify hash changed to #/ and Welcome message is visible
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.locator('h2', { hasText: 'Welcome to ProtoDocs' })).toBeVisible();

    // Navigate to a file manually via sidebar
    const fileLink = page.locator('span', { hasText: 'http.proto' }).first();
    await expect(fileLink).toBeVisible();
    await fileLink.click();
    await expect(page.locator('[id=".google.api.HttpRule"]')).toBeVisible();

    // Go back using browser back button
    await page.goBack();

    // Verify hash goes back to #/ and Welcome message is visible again
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.locator('h2', { hasText: 'Welcome to ProtoDocs' })).toBeVisible();
  });
});
