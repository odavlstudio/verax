/**
 * PHASE 21.5 — Failure Summary Formatter
 * 
 * Formats failure summaries for CLI output.
 */

import { determineExitCode, getExitCodeMeaning as _getExitCodeMeaning } from './exit-codes.js';

/**
 * Format failure summary for CLI
 * 
 * @param {Object} ledgerSummary - Failure ledger summary
 * @param {string} determinismVerdict - Determinism verdict
 * @param {boolean} evidenceLawViolated - Whether Evidence Law was violated
 * @param {string} ledgerPath - Path to failure ledger file
 * @returns {string} Formatted summary
 */
export function formatFailureSummary(ledgerSummary, determinismVerdict = null, evidenceLawViolated = false, ledgerPath = null) {
  const lines = [];
  
  lines.push('\n═══════════════════════════════════════');
  lines.push('EXECUTION VERDICT');
  lines.push('═══════════════════════════════════════');
  
  // Determine verdict
  const highestSeverity = ledgerSummary.highestSeverity;
  let verdict = 'CLEAN';
  if (highestSeverity === 'BLOCKING') {
    verdict = 'BLOCKING';
  } else if (highestSeverity === 'DEGRADED') {
    verdict = 'DEGRADED';
  } else if (highestSeverity === 'WARNING') {
    verdict = 'WARNINGS';
  }
  
  lines.push(`Verdict: ${verdict}`);
  
  // Determinism verdict
  if (determinismVerdict) {
    lines.push(`Deterministic: ${determinismVerdict === 'DETERMINISTIC' ? 'YES' : 'NO'}`);
  } else {
    lines.push('Deterministic: UNKNOWN');
  }
  
  // Evidence Law status
  lines.push(`Evidence Law: ${evidenceLawViolated ? 'VIOLATED' : 'ENFORCED'}`);
  
  // Failure summary
  lines.push('');
  lines.push('Failures:');
  lines.push(`  BLOCKING: ${ledgerSummary.bySeverity?.BLOCKING || 0}`);
  lines.push(`  DEGRADED: ${ledgerSummary.bySeverity?.DEGRADED || 0}`);
  lines.push(`  WARNING: ${ledgerSummary.bySeverity?.WARNING || 0}`);
  
  // Ledger path
  if (ledgerPath) {
    lines.push('');
    lines.push(`See: ${ledgerPath}`);
  }
  
  return lines.join('\n');
}

/**
 * Get exit code from failure ledger and system state
 * 
 * @param {Object} ledgerSummary - Failure ledger summary
 * @param {string} determinismVerdict - Determinism verdict
 * @param {boolean} evidenceLawViolated - Whether Evidence Law was violated
 * @param {boolean} policyInvalid - Whether policy was invalid
 * @returns {number} Exit code
 */
export function getExitCodeFromLedger(ledgerSummary, determinismVerdict = null, evidenceLawViolated = false, policyInvalid = false) {
  return determineExitCode(ledgerSummary, determinismVerdict, evidenceLawViolated, policyInvalid);
}




