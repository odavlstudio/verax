/**
 * Confidence Signals — Transparency Layer for Guardian Verdicts
 * 
 * Derives confidence levels from existing execution data and clearly
 * communicates what Guardian could and could NOT verify.
 * 
 * Stage 5 of DX BOOST
 */

/**
 * Calculate confidence level based on execution data
 * 
 * Confidence is derived from:
 * - Coverage: executed vs applicable attempts
 * - Critical skips: missing vs not applicable
 * - Execution stability: infra errors, timeouts
 * - Result quality: near-successes, partial completions
 * 
 * @param {Object} data - Execution data
 * @returns {Object} { level, reasons, limits }
 */
function calculateConfidence(data = {}) {
  const {
    coverage = {},
    attemptResults = [],
    counts = {}
  } = data;
  
  const planned = coverage.total || 0;
  const executed = counts.executedCount || coverage.executed || 0;
  const skippedMissing = (coverage.skippedMissing || []).length;
  const skippedNA = (coverage.skippedNotApplicable || []).length;
  const skippedDisabled = (coverage.skippedDisabledByPreset || []).length;
  const skippedFiltered = (coverage.skippedUserFiltered || []).length;
  
  // Count failures and their types
  const failures = attemptResults.filter(a => 
    a.outcome === 'FAILURE' || a.outcome === 'FRICTION'
  );
  
  const infraErrors = failures.filter(f => 
    (f.classification && f.classification.category === 'infrastructure') ||
    (f.error && (
      f.error.includes('timeout') || 
      f.error.includes('ETIMEDOUT') ||
      f.error.includes('ECONNREFUSED') ||
      f.error.includes('network')
    ))
  ).length;
  
  const criticalFailures = failures.filter(f =>
    f.classification && f.classification.severity === 'critical'
  ).length;
  
  // Calculate coverage ratio
  const coverageRatio = planned > 0 ? executed / planned : 0;
  
  // Determine confidence level
  let level = 'HIGH';
  const reasons = [];
  const limits = [];
  
  // Coverage assessment
  if (coverageRatio < 0.5) {
    level = 'LOW';
    reasons.push(`Only ${Math.round(coverageRatio * 100)}% of applicable attempts were executed`);
  } else if (coverageRatio < 0.8) {
    if (level === 'HIGH') level = 'MEDIUM';
    reasons.push(`${Math.round(coverageRatio * 100)}% coverage - some flows not tested`);
  }
  
  // Critical gaps
  if (skippedMissing > 0) {
    if (level === 'HIGH') level = 'MEDIUM';
    if (skippedMissing >= 3) level = 'LOW';
    reasons.push(`${skippedMissing} critical flow${skippedMissing !== 1 ? 's' : ''} could not be tested due to missing elements`);
    
    // Add specific limits
    const missingIds = coverage.skippedMissing || [];
    missingIds.slice(0, 3).forEach(id => {
      limits.push(`${id} was not tested (missing elements)`);
    });
    if (missingIds.length > 3) {
      limits.push(`+${missingIds.length - 3} more flows not tested`);
    }
  }
  
  // Infrastructure stability
  if (infraErrors > 0) {
    if (level === 'HIGH') level = 'MEDIUM';
    if (infraErrors >= 2) level = 'LOW';
    reasons.push(`${infraErrors} infrastructure error${infraErrors !== 1 ? 's' : ''} detected (timeouts, network issues)`);
  }
  
  // Critical failures
  if (criticalFailures > 0) {
    level = 'LOW';
    reasons.push(`${criticalFailures} critical failure${criticalFailures !== 1 ? 's' : ''} observed`);
  }
  
  // Not applicable skips (informational, doesn't lower confidence)
  if (skippedNA > 0) {
    const naIds = coverage.skippedNotApplicable || [];
    naIds.slice(0, 2).forEach(id => {
      limits.push(`${id} was not applicable to this site`);
    });
    if (naIds.length > 2) {
      limits.push(`+${naIds.length - 2} more not applicable`);
    }
  }
  
  // Disabled by preset (informational)
  if (skippedDisabled > 0) {
    limits.push(`${skippedDisabled} flow${skippedDisabled !== 1 ? 's' : ''} disabled by preset configuration`);
  }
  
  // User filtering (informational)
  if (skippedFiltered > 0) {
    limits.push(`${skippedFiltered} flow${skippedFiltered !== 1 ? 's' : ''} excluded by user filters`);
  }
  
  // Cap reasons at 3 most important
  const cappedReasons = reasons.slice(0, 3);
  
  // Cap limits at 5 most informative
  const cappedLimits = limits.slice(0, 5);
  
  return {
    level,
    reasons: cappedReasons,
    limits: cappedLimits
  };
}

/**
 * Format confidence block for CLI output
 * 
 * @param {Object} confidence - Confidence data from calculateConfidence
 * @param {string} verdict - Canonical verdict (READY, FRICTION, DO_NOT_LAUNCH)
 * @returns {string}
 */
function formatConfidenceBlock(confidence = {}, verdict = 'UNKNOWN') {
  const { level = 'MEDIUM', reasons = [], limits = [] } = confidence;
  
  const lines = [];
  
  lines.push('━'.repeat(70));
  lines.push('CONFIDENCE ASSESSMENT');
  lines.push('━'.repeat(70));
  lines.push('');
  
  // Level and explanation
  lines.push(`Confidence Level: ${level}`);
  lines.push('');
  
  // Context-aware explanation based on verdict and level
  let explanation = '';
  if (level === 'HIGH') {
    if (verdict === 'READY') {
      explanation = 'Based on comprehensive execution coverage and stable results.';
    } else if (verdict === 'FRICTION') {
      explanation = 'Issues were detected with high execution confidence.';
    } else {
      explanation = 'Critical failures observed with strong signal quality.';
    }
  } else if (level === 'MEDIUM') {
    if (verdict === 'READY') {
      explanation = 'Core flows passed, but some gaps in coverage or stability.';
    } else {
      explanation = 'Issues detected, but test coverage had some limitations.';
    }
  } else {
    if (verdict === 'READY') {
      explanation = 'Limited execution coverage. Proceed with caution.';
    } else if (verdict === 'FRICTION') {
      explanation = 'Issues detected, but test execution faced significant gaps.';
    } else {
      explanation = 'Critical failures AND test coverage limitations detected.';
    }
  }
  
  lines.push(explanation);
  
  // Why confidence is not higher (if applicable)
  if (reasons.length > 0) {
    lines.push('');
    lines.push('Confidence Factors:');
    reasons.forEach(reason => {
      lines.push(`  • ${reason}`);
    });
  }
  
  // What Guardian could NOT verify
  if (limits.length > 0) {
    lines.push('');
    lines.push('Testing Limits:');
    limits.forEach(limit => {
      lines.push(`  • ${limit}`);
    });
  }
  
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Check if confidence signals should be shown
 * Skip in quiet mode, CI, or non-TTY
 * 
 * @param {Array} args - CLI arguments
 * @returns {boolean}
 */
function shouldShowConfidence(args = []) {
  if (args.includes('--quiet') || args.includes('-q')) {
    return false;
  }
  
  if (!process.stdout.isTTY) {
    return false;
  }
  
  return true;
}

/**
 * Print confidence signals to console
 * 
 * @param {Object} data - Execution data
 * @param {Object} config - Guardian config
 * @param {Array} args - CLI arguments
 */
function printConfidenceSignals(data = {}, config = {}, args = []) {
  if (!shouldShowConfidence(args)) {
    return;
  }
  
  const confidence = calculateConfidence(data);
  const verdict = data.verdict?.verdict || data.verdict?.canonicalVerdict || 'UNKNOWN';
  const block = formatConfidenceBlock(confidence, verdict);
  
  console.log('');
  console.log(block);
}

module.exports = {
  calculateConfidence,
  formatConfidenceBlock,
  shouldShowConfidence,
  printConfidenceSignals
};
