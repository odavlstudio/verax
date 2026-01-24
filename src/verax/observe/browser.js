import { chromium } from 'playwright';
import { DEFAULT_SCAN_BUDGET } from '../shared/scan-budget.js';

export async function createBrowser() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();
  return { browser, page };
}

export async function navigateToUrl(page, url, scanBudget = DEFAULT_SCAN_BUDGET) {
  let stableWait = scanBudget.navigationStableWaitMs;
  try {
    if (url.startsWith('file:') || url.includes('localhost:') || url.includes('127.0.0.1')) {
      stableWait = 200; // Short wait for local fixtures
    }
  } catch {
    // Ignore config errors
  }
  // Use domcontentloaded first for faster timeout, then wait for networkidle separately
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: scanBudget.initialNavigationTimeoutMs });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
    // Network idle timeout is acceptable, continue
  });
  await page.waitForTimeout(stableWait);
}

export async function closeBrowser(browser) {
  try {
    // Close all contexts first
    const contexts = browser.contexts();
    for (const context of contexts) {
      try {
        await context.close({ timeout: 5000 }).catch(() => {});
      } catch (e) {
        // Ignore context close errors
      }
    }
    await browser.close({ timeout: 5000 }).catch(() => {});
  } catch (e) {
    // Ignore browser close errors - best effort cleanup
  }
}




