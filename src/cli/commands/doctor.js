/**
 * VERAX Doctor (Phase 8.1)
 * Environment diagnostics for enterprise hardening.
 * Never throws on check failures; only invalid usage should bubble out.
 */

import { existsSync } from 'fs';
import { platform } from 'os';
import { createRequire } from 'module';
import { UsageError } from '../util/errors.js';

export async function doctorCommand(options = {}) {
  const { json = false, extraFlags = [] } = options;

  if (extraFlags.length > 0) {
    throw new UsageError(`Unknown flag(s): ${extraFlags.join(', ')}`);
  }

  const checks = [];
  const recommendations = [];
  const platformName = platform();
  const nodeVersion = process.versions.node;
  let playwrightVersion = null;
  let playwright = null;
  let chromiumPath = null;
  const require = createRequire(import.meta.url);

  const addCheck = (name, status, details, recommendation) => {
    checks.push({ name, status, details });
    if (recommendation) {
      recommendations.push(recommendation);
    }
  };

  // 1) Node.js version
  const nodeMajor = parseInt(nodeVersion.split('.')[0], 10);
  if (Number.isFinite(nodeMajor) && nodeMajor >= 18) {
    addCheck('Node.js version', 'pass', `Detected v${nodeVersion} (>=18 required)`);
  } else {
    addCheck('Node.js version', 'fail', `Detected v${nodeVersion} (<18)`, 'Upgrade Node.js to v18+');
  }

  // 2) Playwright package presence + version
  try {
    playwright = await import('playwright');
    try {
      const pkg = require('playwright/package.json');
      playwrightVersion = pkg?.version || null;
    } catch {
      playwrightVersion = null;
    }
    addCheck('Playwright package', 'pass', `Installed${playwrightVersion ? ` v${playwrightVersion}` : ''}`);
  } catch (error) {
    addCheck(
      'Playwright package',
      'fail',
      'Not installed or not resolvable',
      'npm install -D playwright'
    );
  }

  // 3) Playwright Chromium binaries
  if (playwright && playwright.chromium) {
    try {
      chromiumPath = playwright.chromium.executablePath();
      if (chromiumPath && existsSync(chromiumPath)) {
        addCheck('Playwright Chromium', 'pass', `Executable found at ${chromiumPath}`);
      } else {
        addCheck(
          'Playwright Chromium',
          'fail',
          'Chromium binary not found',
          'npx playwright install --with-deps chromium'
        );
      }
    } catch (error) {
      addCheck(
        'Playwright Chromium',
        'fail',
        `Unable to resolve Chromium executable (${error.message})`,
        'npx playwright install --with-deps chromium'
      );
    }
  } else {
    addCheck(
      'Playwright Chromium',
      'fail',
      'Skipped because Playwright is missing',
      'npm install -D playwright && npx playwright install --with-deps chromium'
    );
  }

  // 4) Headless launch smoke test
  if (playwright && playwright.chromium && chromiumPath && existsSync(chromiumPath)) {
    /** @type {any} */
    let browser = null;
    try {
      // Configurable timeout via env (default 5000ms, CI can override to 3000ms)
      const smokeTimeoutMs = parseInt(process.env.VERAX_DOCTOR_SMOKE_TIMEOUT_MS || '5000', 10);
      
      // Wrap entire smoke test in hard timeout
      const smokeTestPromise = (async () => {
        browser = await playwright.chromium.launch({ headless: true, timeout: smokeTimeoutMs });
        const page = await browser.newPage();
        await page.goto('about:blank', { timeout: smokeTimeoutMs });
        return true;
      })();
      
      // Race against timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Smoke test timed out')), smokeTimeoutMs);
      });
      
      await Promise.race([smokeTestPromise, timeoutPromise]);
      addCheck('Headless smoke test', 'pass', 'Chromium launched headless and closed successfully');
    } catch (error) {
      addCheck(
        'Headless smoke test',
        'fail',
        `Headless launch failed: ${error.message}`,
        platformName === 'linux'
          ? 'Try: npx playwright install --with-deps chromium && launch with --no-sandbox in constrained environments'
          : 'Reinstall playwright: npx playwright install --with-deps chromium'
      );
    } finally {
      // CRITICAL: Always close browser to prevent hanging processes
      // Bound close operation too (max 2s)
      if (browser) {
        try {
          const closePromise = browser.close();
          const closeTimeout = new Promise((resolve) => setTimeout(resolve, 2000));
          await Promise.race([closePromise, closeTimeout]);
        } catch (closeError) {
          // Ignore close errors - force kill if needed
          try {
            await browser.close();
          } catch {
            // Final attempt failed, process will clean up
          }
        }
      }
    }
  } else {
    addCheck(
      'Headless smoke test',
      'fail',
      'Skipped because Chromium executable is unavailable',
      'npx playwright install --with-deps chromium'
    );
  }

  // 5) Linux sandbox guidance
  if (platformName === 'linux') {
    const ciHints = detectCIHints();
    const detailParts = ['Sandbox guidance: if launch fails, use --no-sandbox or ensure libnss3/libatk are installed'];
    if (ciHints) detailParts.push(`Detected CI: ${ciHints}`);
    addCheck('Linux sandbox guidance', 'pass', detailParts.join(' | '));
  }

  const ok = checks.every((c) => c.status === 'pass');

  if (json) {
    const report = {
      ok,
      platform: platformName,
      nodeVersion,
      playwrightVersion,
      checks,
      recommendations,
    };
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  // Human-readable output
  console.log('VERAX Doctor — Environment Diagnostics');
  checks.forEach((c) => {
    const label = c.status === 'pass' ? 'PASS' : 'FAIL';
    console.log(`[${label}] ${c.name}: ${c.details}`);
  });
  console.log(`
Overall: ${ok ? 'OK' : 'Issues found'} (${checks.filter(c => c.status === 'fail').length} failing checks)`);
  if (recommendations.length > 0) {
    console.log('\nRecommended actions:');
    recommendations.forEach((r) => console.log(`- ${r}`));
  }

  return { ok, checks, recommendations };
}

function detectCIHints() {
  if (process.env.GITHUB_ACTIONS === 'true') return 'GITHUB_ACTIONS';
  if (process.env.CI === 'true') return 'CI';
  if (process.env.BITBUCKET_BUILD_NUMBER) return 'BITBUCKET';
  if (process.env.GITLAB_CI) return 'GITLAB_CI';
  return '';
}
