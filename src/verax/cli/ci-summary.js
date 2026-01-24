/**
 * CI One-Line Summary
 * 
 * Prints a deterministic one-line summary for CI logs.
 * OBSERVATIONAL ONLY - no verdicts, no trust badges, no judgments.
 */

/**
 * Generate CI one-line summary
 * @param {Object} context - Summary context
 * @returns {string} One-line summary
 */
export function generateCISummary(context = {}) {
  const {
    expectations = 0,
    interactions = 0,
    findings = 0,
    gaps = 0,
    silences = 0,
    runId = 'unknown'
  } = context;
  
  // Format: VERAX | expectations=... | interactions=... | findings=... | gaps=... | silences=... | run=...
  return `VERAX | expectations=${expectations} | interactions=${interactions} | findings=${findings} | gaps=${gaps} | silences=${silences} | run=${runId}`;
}

/**
 * Print CI one-line summary
 * @param {Object} context - Summary context
 */
export function printCISummary(context) {
  const summary = generateCISummary(context);
  console.error(summary);
}




