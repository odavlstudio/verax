import { existsSync, mkdirSync, rmSync, statSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { UsageError } from '../support/errors.js';
import { resolveVeraxOutDir } from '../support/default-output-dir.js';

function parseNodeMajor(version) {
  const m = String(version || '').match(/^v?(\d+)\./);
  return m ? Number(m[1]) : null;
}

function isDirEmpty(dirPath) {
  try {
    const entries = readdirSync(dirPath);
    return entries.length === 0;
  } catch {
    return false;
  }
}

function buildPrereqUsageError(reason, action) {
  const err = new UsageError(reason);
  if (action) err.action = action;
  return err;
}

function checkNodeVersion() {
  const major = parseNodeMajor(process.version);
  if (!Number.isFinite(major) || major < 18) {
    throw buildPrereqUsageError(
      `Unsupported Node.js runtime: ${process.version}.`,
      'Install Node.js 18+ and retry.'
    );
  }
}

function checkOutWritable(outPath) {
  const absoluteOut = resolve(outPath);
  const existed = existsSync(absoluteOut);
  let created = false;

  if (existed) {
    const st = statSync(absoluteOut);
    if (!st.isDirectory()) {
      throw buildPrereqUsageError(
        `--out must be a directory path. Found a file at: ${absoluteOut}`,
        'Choose a writable directory for --out (or omit it to use the default output directory).'
      );
    }
  } else {
    try {
      mkdirSync(absoluteOut, { recursive: true });
      created = true;
    } catch (e) {
      throw buildPrereqUsageError(
        `Cannot create output directory: ${absoluteOut}`,
        'Choose a writable --out path and retry.'
      );
    }
  }

  const probeName = '.verax_preflight_write_probe';
  const probePath = join(absoluteOut, probeName);
  try {
    writeFileSync(probePath, 'ok\n', { encoding: 'utf8' });
    unlinkSync(probePath);
  } catch (e) {
    // Best-effort cleanup of probe file.
    try {
      if (existsSync(probePath)) unlinkSync(probePath);
    } catch {
      // ignore
    }
    // Cleanup created directory if it's empty to avoid leaving partial outputs.
    if (created) {
      try {
        if (isDirEmpty(absoluteOut)) rmSync(absoluteOut, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }

    const code = e?.code ? ` (${e.code})` : '';
    throw buildPrereqUsageError(
      `Output directory is not writable: ${absoluteOut}${code}`,
      'Fix filesystem permissions for --out (or choose a different directory) and retry.'
    );
  }

  return { absoluteOut, created };
}

async function checkPlaywrightAndChromium({ testMode = false } = {}) {
  if (process.env.VERAX_TEST_PREFLIGHT_PLAYWRIGHT_IMPORT_FAIL === '1') {
    throw buildPrereqUsageError(
      'Playwright is not available (simulated).',
      'Install Playwright (npm i playwright) and retry.'
    );
  }

  let playwright;
  try {
    playwright = await import('playwright');
  } catch (e) {
    throw buildPrereqUsageError(
      'Playwright is not installed or cannot be imported.',
      'Install Playwright (npm i playwright) and retry.'
    );
  }

  if (process.env.VERAX_TEST_PREFLIGHT_CHROMIUM_LAUNCH_FAIL === '1') {
    throw buildPrereqUsageError(
      'Chromium launch failed (simulated).',
      'Install Playwright browsers (npx playwright install chromium) and retry.'
    );
  }

  if (testMode) {
    return;
  }

  const chromium = playwright?.chromium;
  if (!chromium || typeof chromium.launch !== 'function') {
    throw buildPrereqUsageError(
      'Playwright Chromium is unavailable in this installation.',
      'Reinstall Playwright and its browsers (npx playwright install chromium) and retry.'
    );
  }

  // Keep it fast and deterministic: quick launch, immediate close, bounded timeout.
  const timeoutMs = 5000;
  const launchPromise = chromium.launch({ headless: true });
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('preflight_launch_timeout')), timeoutMs)
  );

  let browser = null;
  try {
    // eslint-disable-next-line no-await-in-loop
    browser = await Promise.race([launchPromise, timeoutPromise]);
  } catch (e) {
    const action =
      String(e?.message || '').includes('preflight_launch_timeout')
        ? 'Chromium launch timed out. Ensure Playwright Chromium is installed and runnable, then retry.'
        : 'Install Playwright browsers (npx playwright install chromium) and retry.';

    throw buildPrereqUsageError('Chromium could not be launched for observation.', action);
  } finally {
    try {
      if (browser) await browser.close();
    } catch {
      // ignore
    }
  }
}

export async function runPreflight({ outPath } = /** @type {{ outPath?: string }} */ ({})) {
  checkNodeVersion();

  const projectRoot = resolve(process.cwd());
  const defaultOut = resolveVeraxOutDir(projectRoot, outPath || null);
  const out = checkOutWritable(defaultOut);

  try {
    const testMode = process.env.VERAX_TEST_MODE === '1';
    await checkPlaywrightAndChromium({ testMode });
  } catch (e) {
    // If we created the output dir purely for preflight and it's still empty, remove it.
    if (out?.created) {
      try {
        if (isDirEmpty(out.absoluteOut)) rmSync(out.absoluteOut, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    throw e;
  }

  return { ok: true, outDir: out.absoluteOut };
}
