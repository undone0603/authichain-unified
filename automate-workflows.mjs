import { chromium } from 'playwright';

(async () => {
  // Launch headless browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();

  console.log('Navigating to GitHub Actions...');
  await page.goto('https://github.com/undone0603/authichain-unified/actions');
  
  // Take screenshot of current status
  await page.screenshot({ path: 'actions-status.png', fullPage: true });
  console.log('Screenshot saved to actions-status.png');

  await browser.close();
})();
