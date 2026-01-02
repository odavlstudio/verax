/**
 * Stage 5: CI Gate Modes
 * 
 * Advisory mode: never blocks deploy (exit 0)
 * Gate mode: blocks based on verdict mapping
 */

const { mapExitCodeFromCanonical } = require('./verdicts');

/**
 * Parse CI gate mode from CLI args or environment
 * @param {Array} argv - Process argv
 * @param {Object} env - Process environment
 * @returns {string} 'advisory' or 'gate'
 */
function parseCiGateMode(argv, env) {
  // Explicit flag only. Environment variables no longer change mode.
  const modeIndex = argv.indexOf('--mode');
  if (modeIndex !== -1 && argv[modeIndex + 1]) {
    const mode = argv[modeIndex + 1].toLowerCase();
    if (mode === 'advisory' || mode === 'gate') {
      return mode;
    }
  }

  // Default to strict enforcement (gate)
  return 'gate';
}

/**
 * Compute exit code based on verdict and mode
 * @param {string} verdict - Final verdict (READY, FRICTION, DO_NOT_LAUNCH, ERROR, UNKNOWN)
 * @param {string} mode - CI gate mode ('advisory' or 'gate')
 * @returns {number} Exit code
 */
function computeExitCode(verdict, mode, logger = console.log, assignProcessExit = true) {
  const normalizedMode = mode === 'advisory' ? 'advisory' : 'gate';

  if (normalizedMode === 'advisory') {
    // Advisory mode: never blocks deploy
    printAdvisoryWarning(logger);
    const exitCode = 0;
    if (assignProcessExit && typeof process !== 'undefined') {
      process.exitCode = exitCode;
    }
    return exitCode;
  }

  const exitCode = mapExitCodeFromCanonical(verdict);
  if (assignProcessExit && typeof process !== 'undefined') {
    process.exitCode = exitCode;
  }
  return exitCode;
}

/**
 * Format mode explanation for CLI output
 * @param {string} mode - CI gate mode
 * @returns {string} Explanation text
 */
function formatModeExplanation(mode) {
  if (mode === 'advisory') {
    return '⚙️  Mode: ADVISORY (exit 0, informational only)';
  }
  return '🚧 Mode: GATE (blocks deploy on failures)';
}

const ADVISORY_WARNING = '⚠️  Guardian is running in ADVISORY mode. CI WILL NOT FAIL on critical verdicts.';

function printAdvisoryWarning(logger = console.log) {
  logger(ADVISORY_WARNING);
}

/**
 * Validate mode value
 * @param {string} mode - Mode to validate
 * @returns {Object} Validation result
 */
function validateMode(mode) {
  if (mode !== 'advisory' && mode !== 'gate') {
    return {
      valid: false,
      error: `Invalid mode: ${mode}. Must be 'advisory' or 'gate'.`
    };
  }
  return { valid: true, mode };
}

module.exports = {
  parseCiGateMode,
  computeExitCode,
  formatModeExplanation,
  validateMode,
  ADVISORY_WARNING,
  printAdvisoryWarning
};
