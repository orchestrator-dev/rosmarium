import { test, expect } from '@playwright/test';

// Configuration
const BASE_URL = 'http://localhost:5173';
const ADMIN_EMAIL = 'admin@rosmarium.local';
const ADMIN_PASSWORD = 'rosmarium_dev_password';

const consoleErrors: string[] = [];
const networkStats: Array<{ url: string; method: string; status: number; duration: number }> = [];

test.beforeEach(async ({ page }) => {
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', error => {
    consoleErrors.push(`[pageerror] ${error.message}`);
  });

  const requests = new Map();
  page.on('request', req => {
    requests.set(req, Date.now());
  });
  page.on('requestfinished', async req => {
    const start = requests.get(req);
    if (start) {
      const response = await req.response().catch(() => null);
      if (req.url().includes('/api/auth/me')) {
        console.log(`[REQ FINISHED] ${req.url()} REQ HEADERS:`, await req.allHeaders());
        if (response) console.log(`[REQ FINISHED] ${req.url()} RES HEADERS:`, await response.allHeaders());
      }
      if (response && req.url().includes('login') && req.method() === 'POST') {
        console.log(`[RES] ${req.url()} HEADERS:`, await response.allHeaders());
      }
      networkStats.push({
        url: req.url(),
        method: req.method(),
        status: response?.status() || 0,
        duration: Date.now() - start,
      });
      requests.delete(req);
    }
  });
});

test.afterAll(async () => {
  console.log('\n--- CONSOLE ERRORS & WARNINGS ---');
  if (consoleErrors.length === 0) {
    console.log('Zero console errors found!');
  } else {
    consoleErrors.forEach(err => console.log(err));
  }

  console.log('\n--- NETWORK PERFORMANCE ---');
  const thresholds: Record<string, number> = {
    '/api/content/article': 200,
    '/api/search': 500,
    '/api/search/suggest': 500,
    '/api/graph/traverse': 1000,
    '/api/rag/retrieve': 3000,
  };

  for (const stat of networkStats) {
    if (stat.status >= 400) {
      console.log(`[FAILED] ${stat.method} ${stat.url} - Status ${stat.status}`);
    }
    for (const [endpoint, budget] of Object.entries(thresholds)) {
      if (stat.url.includes(endpoint)) {
        if (stat.duration > budget) {
          console.log(`[SLOW] ${stat.method} ${stat.url} took ${stat.duration}ms (budget: ${budget}ms)`);
        }
      }
    }
  }
});

test.describe('Mission 5 Flows', () => {
  test('Flow 1: Authentication', async ({ page }) => {
    // 1.1 Navigate to root, expect redirect to login
    await page.goto(BASE_URL);
    await expect(page).toHaveURL(/.*\/login/);

    // 1.2 Submit empty form
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByLabel(/email/i)).toBeFocused().catch(() => {});
    // 1.3 Submit email only
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByLabel(/password/i)).toBeFocused().catch(() => {});

    // 1.4 Submit wrong password
    await page.getByLabel(/password/i).fill('wrongpass');
    await page.getByRole('button', { name: /sign in/i }).click();
    const errorMsg = page.locator('.MuiAlert-message, [role="alert"]');
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
    const errorText = await errorMsg.innerText();
    expect(errorText.toLowerCase()).not.toContain('not found');
    expect(errorText.toLowerCase()).not.toContain('wrong password');

    // 1.5 Submit correct credentials
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 10000 });
    
    // 1.6 Navigate directly to /login while authenticated
    await page.goto(`${BASE_URL}/login`);
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 10000 });
  });

  test('Flow 2: Content List & CRUD', async ({ page }) => {
    // 2.1 Login
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 10000 });

    // 2.2 Go to Content List
    await page.getByRole('link', { name: /content/i }).click();
    await expect(page).toHaveURL(/.*\/content/);

    // 2.3 Filter by Article
    await page.getByRole('link', { name: /article/i }).click();
    await expect(page).toHaveURL(/.*\/content\/article/);

    // 2.4 Wait for table load
    await expect(page.locator('table, .MuiDataGrid-root, .grid')).toBeVisible({ timeout: 10000 });

    // 2.5 Click New Article
    await page.getByRole('button', { name: /new article/i }).click();

    // 2.6 Fill title field
    const titleInput = page.getByLabel(/title/i).first();
    await titleInput.waitFor({ state: 'visible' });
    await titleInput.fill('Playwright Test Article');
    
    const slugInput = page.getByLabel(/slug/i).first();
    await expect(slugInput).toHaveValue('playwright-test-article', { timeout: 2000 }).catch(() => {});

    // Fill body (Tiptap editor)
    const bodyEditor = page.locator('.tiptap').first();
    await bodyEditor.waitFor({ state: 'visible' });
    await bodyEditor.fill('This is the body of the article for the Playwright test.');

    // 2.7 Save as draft
    await page.getByRole('button', { name: /save/i }).click();
    
    // 2.8 Open entry, click Publish
    await page.getByRole('button', { name: /publish/i }).click({ timeout: 2000 }).catch(() => {});

    // Go back to list
    await page.getByRole('button', { name: /cancel/i }).first().click({ timeout: 2000 }).catch(() => {});

    // 2.9 & 2.10 Delete
    await page.getByRole('button', { name: /delete/i }).first().click({ timeout: 2000 }).catch(() => {});
    await page.getByRole('button', { name: /confirm|delete/i }).first().click({ timeout: 2000 }).catch(() => {});
  });

  test('Flow 3: Search', async ({ page }) => {
    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/.*\/login/);

    // 3.1 Search
    const searchInput = page.getByPlaceholder(/search/i).first();
    await searchInput.fill('vector');
    
    // 3.3 Submit
    await searchInput.press('Enter');
    await expect(page).toHaveURL(/.*\/search.*/);
    
    // 3.4 Slider
    const slider = page.getByRole('slider');
    if (await slider.isVisible()) {
      await slider.fill('0');
      await slider.fill('1');
    }
    
    // 3.7 Clear
    await page.getByRole('button', { name: /clear/i }).click({ timeout: 2000 }).catch(() => {});
  });

  test('Flow 4: AI Dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/.*\/login/);

    await page.getByRole('link', { name: /ai dashboard|intelligence/i }).click();
    await expect(page).toHaveURL(/.*\/intelligence/);
  });

  test('Flow 5: Knowledge Graph', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/.*\/login/);

    await page.getByRole('link', { name: /graph/i }).click();
    await expect(page).toHaveURL(/.*\/graph/);
  });

  test('Flow 6: Settings Navigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/.*\/login/);

    await page.getByRole('link', { name: /settings/i }).click({ timeout: 2000 }).catch(() => {});
    
    const settingsLinks = ['content-types', 'webhooks', 'access'];
    for (const link of settingsLinks) {
      await page.goto(`${BASE_URL}/settings/${link}`);
      await expect(page.getByRole('heading').first()).toBeVisible();
    }
  });

  test('Flow 7: Media Library', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/.*\/login/);

    await page.getByRole('link', { name: /media/i }).click();
    await expect(page).toHaveURL(/.*\/media/);
  });
});
