/**
 * Stage 5: Fail-Safe Error Handling
 * 
 * Ensures ANY unexpected error still produces:
 * - sanitized decision.json
 * - meta.status = ERROR
 * - finalVerdict = ERROR or UNKNOWN
 * - appropriate exit code
 */

const fs = require('fs');
const path = require('path');
const { sanitizeArtifact } = require('./artifact-sanitizer');
const { resolveBaseDir, ensurePathWithinBase } = require('./path-safety');
const { createLogger } = require('./obs-logger');

/**
 * Write error decision artifact
 * @param {Object} options - Error decision options
 * @returns {string} Path to written decision.json
 */
function writeErrorDecision(options) {
  const {
    runDir,
    baseUrl,
    error,
    determinismHash = null,
    mode = 'advisory',
    baseDir: rawBaseDir
  } = options;

  const baseDir = resolveBaseDir(rawBaseDir);
  const safeRunDir = runDir
    ? ensurePathWithinBase(baseDir, runDir, 'runDir')
    : ensurePathWithinBase(baseDir, path.join(baseDir, `error-${Date.now()}`), 'runDir');

  const decision = {
    runId: path.basename(safeRunDir),
    url: baseUrl || 'unknown',
    timestamp: new Date().toISOString(),
    preset: 'unknown',
    policyName: 'unknown',
    finalVerdict: 'ERROR',
    exitCode: 3,
    verdictSource: 'error_handler',
    verdictHistory: ['ERROR'],
    meta: {
      status: 'ERROR',
      errorMessage: error?.message || 'Unknown error',
      errorStack: error?.stack || null
    },
    determinismHash: determinismHash || null,
    mode: mode || 'advisory',
    coverage: {},
    networkSafety: {},
    secretFindings: [],
    humanPath: null,
    reasons: ['Internal error occurred during execution'],
    actionHints: [
      {
        category: 'ERROR',
        title: 'Guardian encountered an internal error',
        description: error?.message || 'Unknown error',
        priority: 1,
        actions: [
          'Check error logs for details',
          'Verify input configuration',
          'Report issue if problem persists'
        ]
      }
    ],
    resolved: {},
    attestation: {},
    counts: {
      attemptsExecuted: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      nearSuccess: 0
    },
    inputs: {
      policy: { passed: false, exitCode: 3, summary: 'Execution failed' },
      baseline: {},
      market: {},
      flows: { total: 0, failures: 0, frictions: 0 }
    },
    outcomes: {
      flows: [],
      attempts: []
    },
    coverage: {
      total: 0,
      executed: 0,
      gaps: 0,
      skipped: [],
      disabled: []
    },
    auditSummary: {
      tested: [],
      notTested: {
        disabledByPreset: [],
        userFiltered: [],
        notApplicable: [],
        missing: []
      }
    },
    sections: {
      'Final Verdict': {
        summary: 'ERROR: Internal execution failure',
        explanation: error?.message || 'Guardian encountered an unexpected error during execution',
        details: []
      }
    },
    explanation: {
      summary: 'ERROR: Internal execution failure',
      explanation: error?.message || 'Guardian encountered an unexpected error during execution'
    },
    honestyContract: {
      testedScope: [],
      untestedScope: [],
      limits: ['Execution failed before completion'],
      nonClaims: [],
      coverageStats: {},
      confidenceBasis: {},
      disclaimer: 'Guardian encountered an error and could not complete testing.'
    }
  };

  // Ensure runDir exists
  if (!fs.existsSync(safeRunDir)) {
    fs.mkdirSync(safeRunDir, { recursive: true });
  }

  const decisionPath = path.join(safeRunDir, 'decision.json');
  const sanitizedDecision = sanitizeArtifact(decision);
  fs.writeFileSync(decisionPath, JSON.stringify(sanitizedDecision, null, 2));
  
  return decisionPath;
}

/**
 * Wrap execution with fail-safe error handling
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Fail-safe options
 * @returns {Promise<Object>} Result or error result
 */
async function executeWithFailSafe(fn, options = {}) {
  const {
    runDir,
    baseUrl,
    determinismHash,
    mode,
    baseDir: rawBaseDir,
    logger: providedLogger,
    runId,
  } = options;

  const baseDir = resolveBaseDir(rawBaseDir);
  const logger = providedLogger || createLogger({ command: 'fail-safe', url: baseUrl, baseDir, runId, logFileName: runId ? `run-${runId}.log` : null });
  logger.start({ command: 'fail-safe', url: baseUrl, runDir });

  try {
    const result = await fn();
    logger.end({ exitCode: result?.exitCode ?? 0, url: baseUrl, runDir });
    return result;
  } catch (error) {
    console.error(`\n❌ FATAL ERROR: ${error.message}`);
    
    if (process.env.GUARDIAN_DEBUG && error.stack) {
      console.error(error.stack);
    }

    logger.error(error, { exitCode: 3, url: baseUrl, runDir });

    // Write error decision artifact
    let decisionPath = null;
    try {
      decisionPath = writeErrorDecision({
        runDir,
        baseUrl,
        error,
        determinismHash,
        mode,
        baseDir
      });
      console.error(`\n💾 Error decision written to: ${decisionPath}`);
    } catch (writeErr) {
      console.error(`⚠️  Failed to write error decision: ${writeErr.message}`);
    }

    logger.end({ exitCode: 3, url: baseUrl, runDir, decisionPath });

    // Return error result structure
    return {
      exitCode: 3,
      error: error.message,
      errorStack: error.stack,
      runDir: runDir || null,
      decisionPath,
      finalDecision: {
        finalVerdict: 'ERROR',
        exitCode: 3,
        reasons: ['Internal error occurred']
      }
    };
  }
}

module.exports = {
  writeErrorDecision,
  executeWithFailSafe
};
