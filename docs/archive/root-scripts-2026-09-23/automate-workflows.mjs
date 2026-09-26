import { chromium } from 'playwright';

const repoActionsUrl = 'https://github.com/undone0603/authichain-unified/actions';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 }
  });

  const page = await context.newPage();

  console.log(`Opening ${repoActionsUrl}`);
  await page.goto(repoActionsUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 120000
  });

  await page.screenshot({
    path: 'actions-status.png',
    fullPage: true
  });

  console.log('Saved screenshot: actions-status.png');
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
