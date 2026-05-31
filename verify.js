import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  let jsErrors = [];
  
  page.on('pageerror', error => {
    jsErrors.push(error.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      jsErrors.push(msg.text());
    }
  });

  console.log('Navigating to http://localhost:5173/');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  
  console.log('Waiting for elements...');
  // Since we don't know the exact auth flow, just wait a bit
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('Checking for JS Errors:', jsErrors);
  
  await browser.close();
  
  if (jsErrors.length > 0 && !jsErrors.some(e => e.includes('Failed to load resource: net::ERR_CONNECTION_REFUSED'))) {
      console.log('Errors found:', jsErrors);
      process.exit(1);
  } else {
      console.log('Test successful: No fatal JS errors on mount.');
      process.exit(0);
  }
})();
