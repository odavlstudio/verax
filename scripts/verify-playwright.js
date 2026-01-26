/**
 * Playwright Headless Smoke Test (Windows-friendly)
 * - Verifies package presence, chromium availability, executable path
 * - Launches headless, navigates to about:blank, closes
 * - Logs precise failure reason and categorization
 */

import { chromium } from 'playwright';

const result = {
  checks: {
    package: false,
    chromiumExecutable: null,
  },
  smoke: {
    ok: false,
    error: null,
    category: null,
  },
};

async function main() {
  try {
    // 1) Package presence
    result.checks.package = true;

    // 2) Chromium executable path (best-effort)
    try {
      const execPath = chromium.executablePath?.();
      result.checks.chromiumExecutable = execPath || null;
    } catch {
      result.checks.chromiumExecutable = null;
    }

    // 3) Headless launch smoke test
    const launchArgs = [];
    const launchOptions = { headless: true, args: launchArgs, timeout: 45000 };

    let browser;
    try {
      browser = await chromium.launch(launchOptions);
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await browser.close();
      result.smoke.ok = true;
    } catch (err) {
      result.smoke.ok = false;
      result.smoke.error = String(err && err.message ? err.message : err);
      // Categorize conservatively by signature
      const msg = (result.smoke.error || '').toLowerCase();
      if (msg.includes('executable doesn\'t exist') || msg.includes('executable not found') || msg.includes('not found')) {
        result.smoke.category = 'missing browser';
      } else if (msg.includes('sandbox') && (msg.includes('no usable sandbox') || msg.includes('setuid'))) {
        result.smoke.category = 'sandbox restriction';
      } else if (msg.includes('timeout')) {
        result.smoke.category = 'timeout';
      } else if (msg.includes('eacces') || msg.includes('eprem') || msg.includes('permission')) {
        result.smoke.category = 'permission / path issue';
      } else {
        result.smoke.category = 'unknown';
      }
      try { if (browser) await browser.close(); } catch (_err) { /* ignore close errors */ }
    }
  } catch (outer) {
    result.smoke.ok = false;
    result.smoke.error = String(outer && outer.message ? outer.message : outer);
    result.smoke.category = 'unknown';
  }

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.smoke.ok ? 0 : 1);
}

main();
