import puppeteer from "puppeteer";

async function run() {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Set a nice desktop viewport
    await page.setViewport({ width: 1280, height: 800 });

    console.log("Navigating to login...");
    await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });
    
    // Check if we need to login
    const url = page.url();
    if (url.includes("/login")) {
        console.log("Logging in...");
        await page.type('input[type="email"]', "admin@rosmarium.local");
        await page.type('input[type="password"]', "rosmarium_dev_password");
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: "networkidle2" });
    }

    console.log("Navigating to Ingestor...");
    await page.goto("http://localhost:5173/ingestor", { waitUntil: "networkidle2" });
    
    // Wait a bit for any data fetching or animations
    await new Promise(r => setTimeout(r, 2000));

    console.log("Taking screenshot...");
    await page.screenshot({ path: "apps/rosmarium-www/public/docs/ingestor_ui.png" });
    console.log("Saved screenshot to apps/rosmarium-www/public/docs/ingestor_ui.png");

    await browser.close();
}

run().catch(console.error);
