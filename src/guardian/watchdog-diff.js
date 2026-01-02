/**
 * Watchdog Diff Engine
 * 
 * Compares current Guardian run against baseline to detect degradation.
 */

/**
 * Verdict severity ranking (higher = worse)
 */
const VERDICT_SEVERITY = {
  'READY': 0,
  'FRICTION': 1,
  'DO_NOT_LAUNCH': 2,
  'ERROR': 3,
  'UNKNOWN': 3
};

/**
 * Compare current run against baseline
 */
function compareToBaseline(currentRun, baseline) {
  if (!baseline) {
    return {
      degraded: false,
      severity: null,
      reasons: [],
      transitions: null,
      error: 'No baseline available for comparison'
    };
  }

  const reasons = [];
  let maxSeverity = 'LOW';
  const { finalDecision, attemptResults = [], coverageSignal } = currentRun;

  // Check verdict transition
  const currentVerdict = finalDecision?.finalVerdict || 'UNKNOWN';
  const baselineVerdict = baseline.finalVerdict;
  
  const currentSeverityRank = VERDICT_SEVERITY[currentVerdict] || 3;
  const baselineSeverityRank = VERDICT_SEVERITY[baselineVerdict] || 0;

  let transitions = null;
  if (currentVerdict !== baselineVerdict) {
    transitions = { from: baselineVerdict, to: currentVerdict };
    
    // Determine if this is a degradation
    if (currentSeverityRank > baselineSeverityRank) {
      // Downgrade detected
      if (baselineVerdict === 'READY' && currentVerdict === 'FRICTION') {
        reasons.push('Verdict downgraded from READY to FRICTION');
        maxSeverity = 'MEDIUM';
      } else if (baselineVerdict === 'READY' && currentVerdict === 'DO_NOT_LAUNCH') {
        reasons.push('Verdict downgraded from READY to DO_NOT_LAUNCH');
        maxSeverity = 'HIGH';
      } else if (baselineVerdict === 'FRICTION' && currentVerdict === 'DO_NOT_LAUNCH') {
        reasons.push('Verdict downgraded from FRICTION to DO_NOT_LAUNCH');
        maxSeverity = 'HIGH';
      } else if (currentVerdict === 'ERROR') {
        reasons.push(`Verdict changed to ERROR (from ${baselineVerdict})`);
        maxSeverity = 'HIGH';
      } else if (currentSeverityRank > baselineSeverityRank) {
        reasons.push(`Verdict changed from ${baselineVerdict} to ${currentVerdict}`);
        maxSeverity = 'MEDIUM';
      }
    }
    // If currentSeverityRank <= baselineSeverityRank, it's an improvement, not degradation
  }

  // Check humanPath outcome changes (failures where there were successes)
  const baselineAttempts = baseline.humanPath?.attempts || [];
  const currentAttempts = attemptResults.map(a => ({ attemptId: a.attemptId, outcome: a.outcome }));
  
  for (const baselineAttempt of baselineAttempts) {
    const currentAttempt = currentAttempts.find(a => a.attemptId === baselineAttempt.attemptId);
    if (currentAttempt && baselineAttempt.outcome === 'SUCCESS' && currentAttempt.outcome === 'FAILURE') {
      reasons.push(`Attempt "${baselineAttempt.attemptId}" now fails (was SUCCESS)`);
      maxSeverity = upgradeSeverity(maxSeverity, 'HIGH');
    }
  }

  // Check coverage drop
  const currentCoverage = coverageSignal?.percent || 0;
  const baselineCoverage = baseline.coverage?.percent || 0;
  const coverageDrop = baselineCoverage - currentCoverage;
  
  if (coverageDrop >= 20) {
    reasons.push(`Coverage dropped ${coverageDrop.toFixed(0)}% (from ${baselineCoverage.toFixed(0)}% to ${currentCoverage.toFixed(0)}%)`);
    maxSeverity = upgradeSeverity(maxSeverity, 'MEDIUM');
  }

  // Check selector confidence degradation
  const currentConfidence = finalDecision?.coverageInfo?.avgConfidence || 0;
  const baselineConfidence = baseline.selectorConfidence?.avgConfidence || 0;
  const confidenceDrop = baselineConfidence - currentConfidence;
  
  if (confidenceDrop >= 0.2) {
    reasons.push(`Selector confidence dropped ${(confidenceDrop * 100).toFixed(0)}%`);
    maxSeverity = upgradeSeverity(maxSeverity, 'MEDIUM');
  }

  // Degraded if any reasons found
  const degraded = reasons.length > 0;

  return {
    degraded,
    severity: degraded ? maxSeverity : null,
    reasons,
    transitions,
    baselineVerdict,
    currentVerdict
  };
}

/**
 * Upgrade severity if new severity is worse
 */
function upgradeSeverity(current, proposed) {
  const ranks = { 'LOW': 0, 'MEDIUM': 1, 'HIGH': 2 };
  return (ranks[proposed] > ranks[current]) ? proposed : current;
}

/**
 * Determine if alert should be emitted
 */
function shouldAlert(diffResult) {
  return diffResult.degraded === true;
}

/**
 * Format watchdog alert message
 */
function formatWatchdogAlert(diffResult, timestamp = new Date().toISOString()) {
  if (!diffResult.degraded) {
    return null;
  }

  const lines = [];
  lines.push('━'.repeat(70));
  lines.push('🚨 WATCHDOG ALERT — Site Degradation Detected');
  lines.push('━'.repeat(70));
  lines.push('');
  
  if (diffResult.transitions) {
    lines.push(`Verdict: ${diffResult.transitions.from} → ${diffResult.transitions.to}`);
  }
  
  lines.push(`Severity: ${diffResult.severity}`);
  lines.push('');
  lines.push('What Changed:');
  diffResult.reasons.forEach((reason, i) => {
    lines.push(`  ${i + 1}. ${reason}`);
  });
  
  lines.push('');
  lines.push(`Timestamp: ${timestamp}`);
  lines.push('━'.repeat(70));
  
  return lines.join('\n');
}

module.exports = {
  compareToBaseline,
  shouldAlert,
  formatWatchdogAlert,
  VERDICT_SEVERITY
};
