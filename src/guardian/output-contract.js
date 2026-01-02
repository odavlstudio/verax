/**
 * CANONICAL OUTPUT CONTRACT
 * 
 * Single authoritative shape for all Guardian command outputs.
 * All commands (reality, scan, smoke, watchdog) must produce this structure.
 * 
 * CONTRACT RULES:
 * 1. Same fields, same types, same meaning across ALL commands
 * 2. Optional fields MUST be null when absent (not undefined, not missing)
 * 3. No conditional shape changes based on command type
 * 4. CLI and CI consumers ONLY read from this shape
 */

const { normalizeCanonicalVerdict } = require('./verdicts');

/**
 * Canonical output object structure
 * @typedef {Object} GuardianOutput
 * @property {string} version - Guardian version that produced this output
 * @property {string} command - Command that produced output (reality|smoke|scan|watchdog)
 * @property {string} verdict - Canonical verdict (READY|FRICTION|DO_NOT_LAUNCH|INSUFFICIENT_DATA|ERROR)
 * @property {number} exitCode - Exit code (0|1|2|3)
 * @property {Object} summary - Human-readable summary
 * @property {string} summary.headline - One-line verdict summary
 * @property {Array<string>} summary.reasons - Top reasons for verdict (max 5)
 * @property {Object|null} summary.coverage - Coverage statistics (null if not applicable)
 * @property {Object|null} artifacts - Artifact paths (null if no artifacts)
 * @property {string|null} artifacts.runDir - Run directory
 * @property {string|null} artifacts.snapshotPath - Snapshot JSON path
 * @property {string|null} artifacts.reportPath - HTML report path
 * @property {Object|null} policyStatus - Policy evaluation result (null if no policy)
 * @property {boolean} policyStatus.passed - Policy passed/failed
 * @property {string} policyStatus.name - Policy name
 * @property {Object} meta - Metadata and execution details
 * @property {string} meta.runId - Unique run identifier
 * @property {string} meta.timestamp - ISO timestamp
 * @property {string} meta.baseUrl - URL tested
 * @property {number} meta.durationMs - Execution duration in milliseconds
 */

/**
 * Create canonical output object
 * @param {Object} data - Raw command output data
 * @returns {GuardianOutput} Canonical output
 */
function createCanonicalOutput(data) {
  const {
    version = require('../../package.json').version,
    command = 'reality',
    verdict,
    exitCode,
    summary = {},
    artifacts = null,
    policyStatus = null,
    meta = {}
  } = data;

  // Normalize verdict to canonical form
  const canonicalVerdict = normalizeCanonicalVerdict(verdict) || 'ERROR';

  // Build canonical structure
  return {
    version,
    command,
    verdict: canonicalVerdict,
    exitCode,
    summary: {
      headline: summary.headline || generateDefaultHeadline(canonicalVerdict),
      reasons: Array.isArray(summary.reasons) ? summary.reasons.slice(0, 5) : [],
      coverage: summary.coverage || null
    },
    artifacts: artifacts ? {
      runDir: artifacts.runDir || null,
      snapshotPath: artifacts.snapshotPath || null,
      reportPath: artifacts.reportPath || artifacts.marketHtmlPath || null
    } : null,
    policyStatus: policyStatus ? {
      passed: Boolean(policyStatus.passed),
      name: policyStatus.name || 'unknown',
      details: policyStatus.details || null
    } : null,
    meta: {
      runId: meta.runId || 'unknown',
      timestamp: meta.timestamp || new Date().toISOString(),
      baseUrl: meta.baseUrl || 'unknown',
      durationMs: meta.durationMs || 0,
      ...meta
    }
  };
}

/**
 * Generate default headline for verdict
 * @param {string} verdict - Canonical verdict
 * @returns {string} Headline
 */
function generateDefaultHeadline(verdict) {
  switch (verdict) {
    case 'READY':
      return 'READY — Site passed critical user flows';
    case 'FRICTION':
      return 'FRICTION — Some flows slow or inconsistent';
    case 'DO_NOT_LAUNCH':
      return 'DO NOT LAUNCH — Critical path(s) broken';
    case 'INSUFFICIENT_DATA':
      return 'INSUFFICIENT DATA — Cannot make safe claims';
    case 'ERROR':
      return 'ERROR — Execution failed';
    default:
      return `UNKNOWN — Unrecognized verdict: ${verdict}`;
  }
}

/**
 * Validate canonical output shape
 * @param {Object} output - Output to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateCanonicalOutput(output) {
  const errors = [];

  if (!output || typeof output !== 'object') {
    return { valid: false, errors: ['Output must be an object'] };
  }

  // Required fields
  if (!output.version) errors.push('Missing required field: version');
  if (!output.command) errors.push('Missing required field: command');
  if (!output.verdict) errors.push('Missing required field: verdict');
  if (typeof output.exitCode !== 'number') errors.push('Missing or invalid field: exitCode');
  if (!output.summary) errors.push('Missing required field: summary');
  if (!output.meta) errors.push('Missing required field: meta');

  // Validate summary structure
  if (output.summary) {
    if (!output.summary.headline) errors.push('Missing summary.headline');
    if (!Array.isArray(output.summary.reasons)) errors.push('summary.reasons must be an array');
  }

  // Validate meta structure
  if (output.meta) {
    if (!output.meta.runId) errors.push('Missing meta.runId');
    if (!output.meta.timestamp) errors.push('Missing meta.timestamp');
    if (!output.meta.baseUrl) errors.push('Missing meta.baseUrl');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  createCanonicalOutput,
  validateCanonicalOutput,
  generateDefaultHeadline
};
