import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', async res => {
    if ((res.url().includes('/api/ingestor/jobs') || res.url().includes('/api/auth/api-keys')) && res.request().method() === 'POST') {
       console.log('API RESPONSE:', res.url(), res.status());
       if (res.status() >= 400) {
           const body = await res.text();
           console.log('ERROR BODY:', body);
       }
    }
  });

  console.log('Navigating to login page...');
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(2000);
  
  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    console.log('Filling login form...');
    await emailInput.fill('admin@rosmarium.local');
    await page.fill('input[type="password"]', 'rosmarium_dev_password');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  console.log('Navigating to Ingestor page...');
  await page.goto('http://localhost:5173/ingestor');
  await page.waitForTimeout(2000);

  console.log('Testing Database Ingestion...');
  await page.click('button:has-text("Database")');
  await page.waitForTimeout(1000);

  await page.fill('#ingestor-set-name', 'DB Import Test');
  
  // Fill connection string
  // Note: the inputs don't have IDs except in my new code, but let's use placeholders
  await page.fill('input[placeholder="postgres://user:pass@host:5432/db"]', 'postgres://postgres:rosmarium@localhost:5432/rosmarium');
  await page.fill('input[placeholder="SELECT * FROM articles"]', 'SELECT id, name FROM content_types');

  console.log('Clicking Start Import...');
  const startBtn = await page.$('button:has-text("Start Import")');
  if (startBtn) {
      console.log('Button disabled?', await startBtn.evaluate(b => b.disabled));
      await startBtn.click({ force: true });
  } else {
      console.log('Could not find Start Import button!');
  }
  
  console.log('Waiting for job to start...');
  await page.waitForTimeout(4000);
  
  await page.screenshot({ path: '/home/manu/.gemini/antigravity/brain/86255983-e839-4515-aafd-9837e70cbb8e/db_ingestor_test_ui.png', fullPage: true });
  console.log('Screenshot saved.');
  
  const errorText = await page.evaluate(() => {
     const alerts = document.querySelectorAll('[role="alert"], .MuiAlert-message, .error, .MuiFormHelperText-root.Mui-error');
     return Array.from(alerts).map(a => a.textContent).join('\n');
  });
  
  if (errorText) {
     console.log('Found error on page:', errorText);
  } else {
     console.log('No visible errors found for DB import.');
  }
  
  await browser.close();
})();
