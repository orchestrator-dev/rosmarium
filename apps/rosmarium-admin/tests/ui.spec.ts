import { test, expect } from '@playwright/test';

test('UI renders and basic layout is visible', async ({ page }) => {
  // Navigate to the Admin UI
  await page.goto('http://localhost:5173');

  // Verify the page loaded
  await expect(page).toHaveTitle(/Rosmarium/i);

  // Take a screenshot for visual validation
  await page.screenshot({ path: 'ui-snapshot.png', fullPage: true });
});
