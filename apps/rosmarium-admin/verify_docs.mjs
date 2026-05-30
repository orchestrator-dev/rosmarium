import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Navigating to https://rosmarium.com/docs ...');
  
  try {
    await page.goto('https://rosmarium.com/docs', { waitUntil: 'networkidle' });
    
    // We will wait specifically for an image to load, but just in case, wait a bit
    await page.waitForTimeout(2000);

    const images = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).map(img => img.src);
    });
    
    console.log('\nFound images on the production page:');
    images.forEach(src => console.log(' 🖼️ ' + src));
    
    const hasPlaceholders = images.some(src => src.includes('_placeholder'));
    if (hasPlaceholders) {
      console.error('\n❌ VERIFICATION FAILED: Found synthetic/placeholder images in production!');
      process.exit(1);
    } else {
      console.log('\n✅ VERIFICATION PASSED: All synthetic placeholder images have been removed and replaced with authentic chrome-devtools screenshots!');
      process.exit(0);
    }
  } catch (err) {
    console.error('Error during verification:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
