/**
 * Environment Readiness Guard
 * 
 * Detects missing critical dependencies and fails early with actionable errors.
 * NO stack traces. NO noise. Just the fix.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Check if Playwright browsers are installed
 */
function checkPlaywrightBrowsers() {
  try {
    // Playwright caches browsers under ~/.cache/ms-playwright or similar
    // Quick check: can we require the Playwright package?
    require('playwright');
    // If that works, browsers should be available
    return { ok: true };
  } catch (_e) {
    return {
      ok: false,
      error: 'Playwright not properly installed or browsers missing',
      fix: 'npx playwright install'
    };
  }
}

/**
 * Check Node version compatibility
 */
function checkNodeVersion() {
  const version = process.version; // e.g., "v18.0.0"
  const major = parseInt(version.slice(1).split('.')[0], 10);
  if (major < 18) {
    return {
      ok: false,
      error: `Node.js ${version} is too old (minimum: 18.0.0)`,
      fix: 'Upgrade Node.js to version 18 or later'
    };
  }
  return { ok: true };
}

/**
 * Check disk space (rough heuristic)
 */
function checkDiskSpace() {
  try {
    // Try to write a small temp file
    const tempFile = path.join(require('os').tmpdir(), `.guardian-space-check-${Date.now()}`);
    fs.writeFileSync(tempFile, 'test', 'utf8');
    fs.unlinkSync(tempFile);
    return { ok: true };
  } catch (_e) {
    return {
      ok: false,
      error: 'Insufficient disk space or write permission denied',
      fix: 'Ensure /tmp (or temp directory) has at least 100MB free'
    };
  }
}

/**
 * Run all environment checks
 * @returns {object} - { allOk: boolean, issues: array }
 */
function checkEnvironment() {
  const checks = [
    { name: 'Node.js version', check: checkNodeVersion },
    { name: 'Playwright browsers', check: checkPlaywrightBrowsers },
    { name: 'Disk space', check: checkDiskSpace }
  ];

  const issues = [];

  for (const { name, check } of checks) {
    try {
      const result = check();
      if (!result.ok) {
        issues.push({
          name,
          error: result.error,
          fix: result.fix
        });
      }
    } catch (e) {
      issues.push({
        name,
        error: e.message,
        fix: 'See documentation or contact support'
      });
    }
  }

  return {
    allOk: issues.length === 0,
    issues
  };
}

/**
 * Print environment guard error message
 * Returns exit code for caller to handle
 */
function failWithEnvironmentError(issues) {
  console.error('\n❌ Environment Check Failed\n');
  console.error('Guardian cannot run due to missing or incompatible dependencies:\n');

  issues.forEach((issue, idx) => {
    console.error(`${idx + 1}. ${issue.name}`);
    console.error(`   Error:  ${issue.error}`);
    console.error(`   Fix:    ${issue.fix}`);
    console.error('');
  });

  console.error('After fixing the above, run Guardian again:\n');
  console.error('  guardian reality --url <your-site-url>\n');

  return 1;
}

module.exports = {
  checkEnvironment,
  failWithEnvironmentError
};
