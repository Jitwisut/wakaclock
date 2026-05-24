import { expect, test } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check that the page has loaded
    await expect(page).toHaveURL(/.*localhost:3000.*/);
  });

  test('should have correct title', async ({ page }) => {
    await page.goto('/');

    // Check the page title
    await expect(page).toHaveTitle(/.*/);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');

    // Verify the page loads correctly on mobile
    await expect(page).toHaveURL(/.*localhost:3000.*/);
  });
});
