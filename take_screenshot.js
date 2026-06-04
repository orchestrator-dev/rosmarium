import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Wait for the server to be ready
    let attempts = 0;
    while (attempts < 10) {
      try {
        await page.goto('http://localhost:5173/admin/ingestor', { waitUntil: 'networkidle2', timeout: 5000 });
        break;
      } catch (e) {
        attempts++;
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // Give it a moment to render any animations
    await new Promise(r => setTimeout(r, 2000));

    // Take screenshot
    await page.screenshot({ path: 'apps/rosmarium-www/public/docs/ingestor_ui.png' });
    
    await browser.close();
    console.log("Screenshot saved successfully");
  } catch (error) {
    console.error("Failed to take screenshot:", error);
    process.exit(1);
  }
})();
