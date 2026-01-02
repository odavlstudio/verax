/**
 * Guardian First-Run Detection & Initialization
 * Deterministically detects first run and coordinates welcome behavior.
 */

const fs = require('fs');
const path = require('path');

function hasRunBefore(stateDir = '.odavl-guardian') {
  try {
    const filePath = path.join(stateDir, '.first-run-state.json');
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function markAsRun(stateDir = '.odavl-guardian') {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    const filePath = path.join(stateDir, '.first-run-state.json');
    fs.writeFileSync(filePath, JSON.stringify({ firstRunAt: new Date().toISOString() }, null, 2));
  } catch (e) {
    // Silently ignore state write failures (e.g., permission issues)
  }
}

function isFirstRun(stateDir = '.odavl-guardian') {
  return !hasRunBefore(stateDir);
}

function printWelcome(label = 'ODAVL Guardian') {
  const lines = [
    '',
    `Welcome to ${label}!`,
    'Running first-time setup…',
    ''
  ];
  console.log(lines.join('\n'));
}

function printFirstRunHint() {
  console.log("\nTip: Try 'guardian smoke <url>' for a fast CI-ready check.\n");
}

function printFirstRunIntroIfNeeded(config, argv) {
  // Detect quiet mode from config or CLI args
  const isQuiet = (config && config.output && config.output.quiet) || argv.includes('--quiet');
  const isCI = process.env.CI === 'true';
  
  // Only print welcome on first run and not in CI/quiet mode
  if (isFirstRun() && !isQuiet && !isCI) {
    printWelcome();
    printFirstRunHint();
  }
}

module.exports = {
  isFirstRun,
  hasRunBefore,
  markAsRun,
  printWelcome,
  printFirstRunHint,
  printFirstRunIntroIfNeeded
};
