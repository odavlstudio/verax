import { chromium } from 'playwright';

const STABLE_WAIT_MS = 2000;

export async function createBrowser() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();
  return { browser, page };
}

export async function navigateToUrl(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(STABLE_WAIT_MS);
}

export async function closeBrowser(browser) {
  await browser.close();
}

