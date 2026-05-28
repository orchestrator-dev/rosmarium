import { test, expect } from '@playwright/test';

test.describe('Access Control Manager', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@rosmarium.local');
    await page.getByLabel('Password').fill('rosmarium_dev_password');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for navigation and verify we're logged in
    await page.waitForURL('/');
    
    // Navigate to access control
    await page.goto('/settings/access');
    await page.waitForLoadState('networkidle');
  });

  test('Flow 1: Verify users table loads with admin user', async ({ page }) => {
    // Ensure Users tab is active
    const usersTab = page.locator('button[role="tab"]', { hasText: 'Users' });
    await expect(usersTab).toHaveAttribute('aria-selected', 'true');

    // Wait for the users table to populate
    await page.waitForTimeout(1000);

    // Verify the admin user exists in the table
    const adminEmailCell = page.locator('td', { hasText: 'admin@rosmarium.local' });
    await expect(adminEmailCell).toBeVisible();

    // Verify it shows the "super_admin" role (since admin@rosmarium.local is a super admin in our seed)
    const roleSelect = adminEmailCell.locator('xpath=..').locator('.MuiSelect-select');
    await expect(roleSelect).toHaveText('super_admin');
  });

  test('Flow 2 & 3: Create API key and verify copy-once modal appears, then Revoke it', async ({ page }) => {
    // Navigate to API Keys tab
    const apiKeysTab = page.locator('button[role="tab"]', { hasText: 'API Keys' });
    await apiKeysTab.click();
    await expect(apiKeysTab).toHaveAttribute('aria-selected', 'true');

    const uniqueKeyName = `Test Key ${Date.now()}`;

    // Click "New API Key" button
    await page.getByRole('button', { name: 'New API Key' }).click();

    // Dialog should open
    const dialog = page.locator('.MuiDialog-paper');
    await expect(dialog).toBeVisible();

    // Fill out the form
    await dialog.locator('input[type="text"]').first().fill(uniqueKeyName);

    // Click "Create Key"
    await dialog.getByRole('button', { name: 'Create Key' }).click();

    // Wait for dialog to close
    await expect(dialog).not.toBeVisible();

    // Wait for the success alert to appear (copy-once modal)
    const alert = page.locator('.MuiAlert-root');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('API Key Created');
    
    // Dismiss the alert
    await alert.getByRole('button', { name: 'Dismiss' }).click();
    await expect(alert).not.toBeVisible();

    // Find the newly created API key in the list
    const keyRow = page.locator('tr', { hasText: uniqueKeyName });
    await expect(keyRow).toBeVisible();

    // Flow 3: Revoke it
    page.on('dialog', dialog => dialog.accept()); // Accept the browser confirmation dialog
    await keyRow.locator('button').click(); // Click the delete icon button

    // Verify it's removed from the list
    await expect(keyRow).not.toBeVisible();
  });
});
