/**
 * Runtime Readiness Detection
 * 
 * Verifies that the execution environment is ready to perform browser-based observation.
 * Runs BEFORE any browser/context/page creation.
 * Fails early and explicitly with proper incomplete reasons.
 */

import { existsSync } from 'fs';
import { spawnSync } from 'child_process';

/**
 * Check if Playwright is installed and browsers are available
 * @returns {Promise<{ready: boolean, reason?: string, message?: string}>}
 */
export async function checkRuntimeReadiness() {
  try {
    // Verify Playwright module is importable
    let chromium;
    try {
      const playwrightModule = await import('playwright');
      chromium = playwrightModule.chromium;
    } catch (error) {
      return {
        ready: false,
        reason: 'playwright_not_installed',
        message: 'Playwright is not installed. Run: npm install playwright',
      };
    }

    if (!chromium) {
      return {
        ready: false,
        reason: 'playwright_import_failed',
        message: 'Failed to import Playwright module',
      };
    }

    // Verify Chromium browser is available
    // This checks if the browser binary exists without launching
    const browserPath = chromium.executablePath();
    if (!browserPath || !existsSync(browserPath)) {
      return {
        ready: false,
        reason: 'browser_executable_not_found',
        message: 'Chromium browser executable not found. Run: npx playwright install chromium',
      };
    }

    // All checks passed
    return { ready: true };
  } catch (error) {
    return {
      ready: false,
      reason: 'runtime_readiness_check_failed',
      message: `Runtime readiness check failed: ${error.message}`,
    };
  }
}

/**
 * Attempt to install Chromium via Playwright (opt-in only)
 * Uses npx to avoid extra dependencies; inherits stdio for transparency.
 * @returns {{ok: boolean, message?: string}}
 */
export function installChromiumBrowser() {
  const result = spawnSync('npx', ['playwright', 'install', 'chromium'], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    return { ok: false, message: result.error.message };
  }
  if (result.status !== 0) {
    return { ok: false, message: `Installer exited with code ${result.status}` };
  }
  return { ok: true };
}

/**
 * Ensure runtime readiness with optional bootstrap install
 * @param {{ bootstrapBrowser?: boolean, readinessCheck?: Function, installer?: Function }} opts
 * @returns {Promise<{ready: boolean, reason?: string, message?: string, attemptedBootstrap: boolean}>}
 */
export async function ensureRuntimeReady({ bootstrapBrowser = false, readinessCheck = checkRuntimeReadiness, installer = installChromiumBrowser } = {}) {
  const initial = await readinessCheck();
  if (initial.ready) return { ...initial, attemptedBootstrap: false };

  if (!bootstrapBrowser) {
    return { ...initial, attemptedBootstrap: false };
  }

  console.log('Bootstrap enabled: installing Chromium via Playwright (opt-in)');
  const installResult = installer();
  if (!installResult.ok) {
    return {
      ready: false,
      reason: 'browser_bootstrap_failed',
      message: installResult.message || 'Chromium install failed',
      attemptedBootstrap: true,
    };
  }

  const postInstall = await readinessCheck();
  return { ...postInstall, attemptedBootstrap: true };
}

/**
 * Build human-readable message for missing runtime
 * @param {string} reason - The specific readiness failure reason
 * @returns {string}
 */
export function formatRuntimeReadinessMessage(reason) {
  const messages = {
    'playwright_not_installed':
      'Playwright is not installed.\nFix: Run `npm install playwright` or `npm ci`',
    'playwright_import_failed':
      'Failed to import Playwright module.\nFix: Reinstall dependencies: `npm ci`',
    'browser_executable_not_found':
      'Chromium browser is not installed.\nFix: Run `npx playwright install chromium`',
    'runtime_readiness_check_failed':
      'Runtime environment is not ready.\nFix: Check Playwright installation and try again',
    'browser_bootstrap_failed':
      'Bootstrap failed to install Chromium.\nFix: Run `npx playwright install chromium` manually',
  };
  return messages[reason] || `Runtime not ready: ${reason}`;
}
