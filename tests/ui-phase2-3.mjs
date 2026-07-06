import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  try {
    console.log("Starting UI tests for Phase 2 (Page Builder) and Phase 3 (Personalization)...");
    
    // Test Page Builder
    console.log("Navigating to Page Builder...");
    await page.goto('http://localhost:5173/pages', { waitUntil: 'networkidle2' });
    
    await page.waitForSelector('h5');
    const title = await page.$eval('h5', el => el.textContent);
    if (!title.includes('Visual Page Builder')) {
        throw new Error(`Page Builder title mismatch. Expected "Visual Page Builder", found "${title}"`);
    }
    console.log("✅ Page Builder UI loaded correctly.");

    // Check if Canvas is empty
    await page.waitForSelector('h6');
    const canvasStatus = await page.$eval('h6', el => el.textContent);
    console.log("Canvas status:", canvasStatus);

    // Test Personalization
    console.log("Navigating to Personalization...");
    await page.goto('http://localhost:5173/personalization', { waitUntil: 'networkidle2' });

    await page.waitForSelector('h4');
    const persTitle = await page.$eval('h4', el => el.textContent);
    if (!persTitle.includes('Personalization Segments')) {
        throw new Error(`Personalization title mismatch. Expected "Personalization Segments", found "${persTitle}"`);
    }
    console.log("✅ Personalization UI loaded correctly.");

    // Check if table exists
    const tableExists = await page.$('table');
    if (!tableExists) throw new Error("Table not found on Personalization page");
    console.log("✅ Personalization table rendered.");

    console.log("🎉 All UI E2E tests passed successfully!");
  } catch (err) {
    console.error("UI Test failed:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
