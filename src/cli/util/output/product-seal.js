/**
 * STAGE 6.6: Product Seal
 * 
 * PRODUCTION_GRADE seal is deterministically applied when:
 * 1. Coverage ratio ≥ minimum threshold (typically 0.9 = 90%)
 * 2. No evidence law violations
 * 3. Determinism verified (no timeout/incomplete status)
 * 
 * The seal is explicit in summary.json and human summary markdown.
 * It provides confidence that the flow has been thoroughly tested.
 */

/**
 * Compute PRODUCTION_GRADE seal
 * @param {Object} [context]
 * @param {string} [context.status] - Run status
 * @param {Object} [context.coverage] - Coverage data
 * @param {Array} [context.findings] - Findings array
 * @param {Object} [context.digest] - Digest data
 * @param {number} [context.minCoverageThreshold] - Minimum coverage ratio (default 0.9)
 * @returns {string|null} 'PRODUCTION_GRADE' or null
 */
export function computeProductionSeal(context = {}) {
  const {
    status = 'UNKNOWN',
    coverage = {},
    findings = [],
    digest = {},
    minCoverageThreshold = 0.9,
  } = context;
  
  // Check preconditions
  const checks = {
    statusOk: checkStatusCondition(status),
    coverageOk: checkCoverageCondition(coverage, minCoverageThreshold),
    noEvidenceViolations: checkNoEvidenceViolations(findings, digest),
    hasMeaningfulData: checkHasMeaningfulData(digest),
  };
  
  // All checks must pass
  if (Object.values(checks).every(Boolean)) {
    return 'PRODUCTION_GRADE';
  }
  
  return null;
}

/**
 * Check if status allows production seal
 * @param {string} status
 * @returns {boolean}
 */
function checkStatusCondition(status) {
  // Only COMPLETE status gets production seal
  // INCOMPLETE or TIMEOUT disqualifies
  return status === 'COMPLETE';
}

/**
 * Check coverage condition
 * @param {Object} coverage
 * @param {number} minThreshold
 * @returns {boolean}
 */
function checkCoverageCondition(coverage, minThreshold) {
  if (!coverage || typeof coverage.coverageRatio !== 'number') {
    return false;
  }
  
  const ratio = coverage.coverageRatio;
  const min = minThreshold || 0.9;
  
  return ratio >= min;
}

/**
 * Check no evidence violations exist
 * Evidence law violations are silent failures that indicate
 * the flow cannot be trusted
 * @param {Array} findings
 * @param {Object} digest
 * @returns {boolean}
 */
function checkNoEvidenceViolations(findings = [], digest = {}) {
  // No evidence violations means:
  // 1. No unreconciled silent failures
  // 2. Digest is complete
  // 3. No critical findings
  
  const silentFailures = findings.filter(f => f.type === 'SILENT_FAILURE');
  const criticalFindings = findings.filter(f => f.confidence?.severity === 'CRITICAL');
  
  // Any silent failure or critical finding disqualifies
  if (silentFailures.length > 0 || criticalFindings.length > 0) {
    return false;
  }
  
  // Digest must show complete evidence capture
  if (!digest.expectationsTotal || !digest.observed) {
    return false;
  }
  
  return true;
}

/**
 * Check if digest has meaningful data
 * @param {Object} digest
 * @returns {boolean}
 */
function checkHasMeaningfulData(digest = {}) {
  return (digest.expectationsTotal || 0) > 0;
}

/**
 * Get detailed explanation of why seal was or wasn't granted
 * @param {Object} [context]
 * @returns {Object} { sealed: boolean, reasons: Array<string> }
 */
export function explainProductionSeal(context = {}) {
  const {
    status = 'UNKNOWN',
    coverage = {},
    findings = [],
    digest = {},
    minCoverageThreshold = 0.9,
  } = context;
  
  const reasons = [];
  let allPass = true;
  
  // Status check
  if (status !== 'COMPLETE') {
    reasons.push(`Status is '${status}', not 'COMPLETE'`);
    allPass = false;
  } else {
    reasons.push(`✓ Status: COMPLETE`);
  }
  
  // Coverage check
  const coverageRatio = coverage?.coverageRatio || 0;
  if (coverageRatio < minCoverageThreshold) {
    reasons.push(`Coverage ${(coverageRatio * 100).toFixed(1)}% < ${(minCoverageThreshold * 100).toFixed(0)}% minimum`);
    allPass = false;
  } else {
    reasons.push(`✓ Coverage: ${(coverageRatio * 100).toFixed(1)}%`);
  }
  
  // Evidence violations check
  const silentFailures = findings.filter(f => f.type === 'SILENT_FAILURE');
  const criticalFindings = findings.filter(f => f.confidence?.severity === 'CRITICAL');
  
  if (silentFailures.length > 0) {
    reasons.push(`${silentFailures.length} silent failure(s) detected`);
    allPass = false;
  } else {
    reasons.push(`✓ No silent failures`);
  }
  
  if (criticalFindings.length > 0) {
    reasons.push(`${criticalFindings.length} critical finding(s)`);
    allPass = false;
  } else {
    reasons.push(`✓ No critical findings`);
  }
  
  // Data completeness check
  if (!digest.expectationsTotal || digest.expectationsTotal === 0) {
    reasons.push(`No expectations tested`);
    allPass = false;
  } else {
    reasons.push(`✓ ${digest.expectationsTotal} expectations tested`);
  }
  
  return {
    sealed: allPass && checkStatusCondition(status) && checkCoverageCondition(coverage, minCoverageThreshold),
    reasons,
  };
}

/**
 * Format seal information for display
 * @param {Object} context
 * @returns {string} Human-readable seal explanation
 */
export function formatProductionSealMessage(context = {}) {
  const seal = computeProductionSeal(context);
  const explanation = explainProductionSeal(context);
  
  const lines = [];
  
  if (seal === 'PRODUCTION_GRADE') {
    lines.push('🔒 PRODUCTION_GRADE Seal: ✅ GRANTED');
    lines.push('');
    lines.push('This execution meets all production grade criteria:');
  } else {
    lines.push('🔒 PRODUCTION_GRADE Seal: ❌ NOT GRANTED');
    lines.push('');
    lines.push('This execution does not meet production grade criteria:');
  }
  
  lines.push('');
  for (const reason of explanation.reasons) {
    lines.push(`  ${reason}`);
  }
  
  return lines.join('\n');
}

/**
 * Validate seal is correctly applied
 * @param {Object} summary
 * @param {Object} context
 * @returns {boolean} True if seal matches computed seal
 */
export function validateSealConsistency(summary = {}, context = {}) {
  const computedSeal = computeProductionSeal(context);
  const reportedSeal = summary.productionSeal;
  
  // Both must be the same
  if (computedSeal === reportedSeal) {
    return true;
  }
  
  // One is null, other is not
  if ((computedSeal === null) !== (reportedSeal === null)) {
    return false;
  }
  
  return true;
}

/**
 * Generate recommended minimum coverage threshold based on test scenario
 * @param {string} testType - 'critical-flow', 'integration', 'standard', 'smoke'
 * @returns {number} Recommended minimum coverage ratio (0-1)
 */
export function getRecommendedMinCoverage(testType = 'standard') {
  const thresholds = {
    'critical-flow': 0.95,      // 95% - mission critical
    'integration': 0.90,         // 90% - typical production
    'standard': 0.80,            // 80% - normal development
    'smoke': 0.50,               // 50% - quick verification
  };
  
  return thresholds[testType] || 0.90;
}

/**
 * Check if seal should be visible in output
 * @param {string} seal
 * @returns {boolean}
 */
export function shouldDisplaySeal(seal) {
  return seal === 'PRODUCTION_GRADE';
}

/**
 * Get seal display icon and color
 * @param {string} seal
 * @returns {Object} { icon: string, color: string, text: string }
 */
export function getSealDisplay(seal) {
  if (seal === 'PRODUCTION_GRADE') {
    return {
      icon: '🔒',
      color: 'green',
      text: 'PRODUCTION_GRADE',
      description: 'This execution meets production-grade criteria.',
    };
  }
  
  return {
    icon: '🔓',
    color: 'gray',
    text: 'NOT PRODUCTION_GRADE',
    description: 'This execution does not meet production-grade criteria.',
  };
}
