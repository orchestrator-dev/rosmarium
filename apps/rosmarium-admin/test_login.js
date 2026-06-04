import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', async res => {
    if (res.url().includes('/api/ingestor/jobs') && res.request().method() === 'POST') {
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

  console.log('Filling URL and Name...');
  await page.fill('#ingestor-start-url', 'https://rosmarium.com/');
  await page.fill('#ingestor-set-name', 'Test Import');

  console.log('Clicking Start Import...');
  const startBtn = await page.$('button:has-text("Start Import")');
  if (startBtn) {
      await startBtn.click({ force: true });
  } else {
      console.log('Could not find Start Import button!');
  }
  
  console.log('Waiting for job to start...');
  await page.waitForTimeout(3000);
  
  const errorText = await page.evaluate(() => {
     const alerts = document.querySelectorAll('[role="alert"], .MuiAlert-message, .error, .MuiFormHelperText-root.Mui-error');
     return Array.from(alerts).map(a => a.textContent).join('\n');
  });
  
  if (errorText) {
     console.log('Found error on page:', errorText);
  } else {
     console.log('No visible errors found. The error is gone!');
  }
  
  const pageText = await page.evaluate(() => document.body.innerText);
  console.log('Page text snapshot:');
  console.log(pageText.substring(0, 500));
  
  await browser.close();
})();
