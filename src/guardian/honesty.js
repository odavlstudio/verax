/**
 * Guardian Honesty Contract
 * Structural enforcement of honest, bounded claims
 * 
 * PURPOSE: Prevent Guardian from claiming it tested things it didn't.
 * MECHANISM: Deterministic tracking of tested vs untested scope.
 * FAIL-SAFE: Missing honesty data forces DO_NOT_LAUNCH.
 */

/**
 * Build honesty contract from execution data
 * Returns structured evidence of what was/wasn't tested
 * 
 * @param {Object} execution - Execution metadata
 * @returns {Object} Honesty contract with tested/untested scope
 */
function buildHonestyContract(execution) {
  const {
    attemptResults = [],
    flowResults = [],
    crawlData = {},
    triggeredRuleIds = []  // Rules engine signals (e.g., all_goals_reached)
  } = execution;

  // What was ACTUALLY tested (executed and produced evidence)
  const executedAttempts = attemptResults.filter(a => a.executed && a.outcome !== 'SKIPPED');
  const successfulAttempts = executedAttempts.filter(a => a.outcome === 'SUCCESS');
  const failedAttempts = executedAttempts.filter(a => a.outcome === 'FAILURE');
  const executedFlows = flowResults.filter(f => f.outcome !== 'NOT_APPLICABLE' && f.outcome !== 'SKIPPED');

  const testedScope = [
    ...executedAttempts.map(a => `attempt:${a.attemptId}`),
    ...executedFlows.map(f => `flow:${f.flowId}`)
  ];

  // What was NOT tested but exists in the site/config
  const skippedAttempts = attemptResults.filter(a => !a.executed || a.outcome === 'SKIPPED');
  const notApplicableAttempts = attemptResults.filter(a => a.outcome === 'NOT_APPLICABLE');
  const disabledAttempts = attemptResults.filter(a => a.disabledByPreset);
  const skippedFlows = flowResults.filter(f => f.outcome === 'NOT_APPLICABLE' || f.outcome === 'SKIPPED');

  const untestedScope = [
    ...skippedAttempts.map(a => `skipped:${a.attemptId} (${a.skipReason || 'not executed'})`),
    ...notApplicableAttempts.map(a => `n/a:${a.attemptId} (feature not present)`),
    ...disabledAttempts.map(a => `disabled:${a.attemptId} (by preset)`),
    ...skippedFlows.map(f => `flow-skipped:${f.flowId}`)
  ];

  // Calculate coverage percentage
  // IMPORTANT: Don't count disabled, user-filtered, or NOT_APPLICABLE attempts
  const totalRelevantAttempts = attemptResults.filter(a => 
    !a.disabledByPreset && 
    a.outcome !== 'NOT_APPLICABLE' && 
    a.skipReasonCode !== 'USER_FILTERED' &&
    a.outcome !== 'SKIPPED'  // Exclude all skipped attempts
  ).length;
  const executedCount = executedAttempts.length;
  const coveragePercent = totalRelevantAttempts > 0 
    ? Math.round((executedCount / totalRelevantAttempts) * 100)
    : 0;

  // Confidence basis: WHY we have X% confidence (evidence-driven)
  const confidenceBasis = buildConfidenceBasis({
    executedCount,
    successCount: successfulAttempts.length,
    failedCount: failedAttempts.length,
    totalRelevant: totalRelevantAttempts,
    coveragePercent,
    flowsExecuted: executedFlows.length,
    crawlPages: crawlData.visitedCount || 0
  });

  // Explicit non-claims: what Guardian REFUSES to claim
  const nonClaims = buildNonClaims({
    untestedCount: untestedScope.length,
    disabledCount: disabledAttempts.length,
    coveragePercent,
    crawlEnabled: !!crawlData.visitedCount
  });

  // Limits of this run
  const limits = buildLimits({
    coveragePercent,
    untestedScope,
    disabledAttempts,
    skippedAttempts,
    crawlData
  });

  return {
    testedScope: testedScope.length > 0 ? testedScope : ['NONE - No execution data'],
    untestedScope: untestedScope.length > 0 ? untestedScope : ['All relevant tests executed'],
    confidenceBasis: confidenceBasis,
    nonClaims: nonClaims,
    limits: limits,
    coverageStats: {
      executed: executedCount,
      total: totalRelevantAttempts,
      percent: coveragePercent,
      skipped: skippedAttempts.length,
      disabled: disabledAttempts.length
    },
    triggeredRuleIds: triggeredRuleIds  // Pass through rules engine signals for honesty enforcement
  };
}

/**
 * Build evidence-based confidence explanation
 */
function buildConfidenceBasis(stats) {
  const { executedCount, successCount, failedCount, coveragePercent, flowsExecuted } = stats;

  if (executedCount === 0) {
    return {
      summary: 'NO CONFIDENCE - Zero execution evidence',
      details: [
        'No attempts were executed',
        'Cannot determine site behavior',
        'Insufficient data for any claim'
      ],
      score: 0
    };
  }

  const successRate = executedCount > 0 ? (successCount / executedCount) : 0;
  
  const details = [
    `${executedCount} ${executedCount === 1 ? 'attempt' : 'attempts'} executed (${coveragePercent}% coverage)`,
    `${successCount} succeeded, ${failedCount} failed`,
    `${flowsExecuted} ${flowsExecuted === 1 ? 'flow' : 'flows'} tested`
  ];

  // Add coverage impact
  if (coveragePercent < 50) {
    details.push(`Coverage below 50% - significant blind spots remain`);
  } else if (coveragePercent < 80) {
    details.push(`Partial coverage - some workflows untested`);
  }

  return {
    summary: `${Math.round(successRate * 100)}% success rate across ${executedCount} tests`,
    details: details,
    score: successRate * (coveragePercent / 100) // Weighted by coverage
  };
}

/**
 * Build explicit non-claims list
 */
function buildNonClaims(context) {
  const { untestedCount, disabledCount, coveragePercent, crawlEnabled } = context;
  
  const nonClaims = [];

  if (coveragePercent < 100) {
    nonClaims.push(`Guardian did NOT test ${100 - coveragePercent}% of relevant workflows`);
  }

  if (untestedCount > 0) {
    nonClaims.push(`${untestedCount} ${untestedCount === 1 ? 'test was' : 'tests were'} skipped or not applicable`);
  }

  if (disabledCount > 0) {
    nonClaims.push(`${disabledCount} tests disabled by preset - functionality not verified`);
  }

  if (!crawlEnabled) {
    nonClaims.push('Site crawl not performed - inter-page behavior unknown');
  }

  // Universal non-claims
  nonClaims.push('Real user behavior may differ from automated tests');
  nonClaims.push('Future changes may break currently working features');
  nonClaims.push('Performance under load not verified');
  nonClaims.push('Security vulnerabilities not comprehensively tested');
  nonClaims.push('Browser/device compatibility limited to test environment');

  return nonClaims;
}

/**
 * Build explicit limits of this run
 */
function buildLimits(context) {
  const { coveragePercent, disabledAttempts, skippedAttempts, crawlData } = context;

  const limits = [];

  // Coverage limit
  if (coveragePercent < 100) {
    limits.push(`Coverage: ${coveragePercent}% - Some workflows not exercised`);
  }

  // Skipped tests limit
  if (skippedAttempts.length > 0) {
    const topSkipped = skippedAttempts.slice(0, 3).map(a => a.attemptId).join(', ');
    limits.push(`Skipped: ${skippedAttempts.length} tests (${topSkipped}${skippedAttempts.length > 3 ? '...' : ''})`);
  }

  // Disabled tests limit
  if (disabledAttempts.length > 0) {
    limits.push(`Disabled: ${disabledAttempts.length} tests by preset configuration`);
  }

  // Crawl limit
  if (!crawlData.visitedCount || crawlData.visitedCount === 0) {
    limits.push('No crawl performed - only tested specified URLs');
  } else if (crawlData.visitedCount < 5) {
    limits.push(`Limited crawl: ${crawlData.visitedCount} pages visited`);
  }

  // Time limit
  limits.push('Point-in-time snapshot - does not verify ongoing stability');

  // Environment limit
  limits.push('Tested in automated environment - real user conditions may differ');

  return limits;
}

/**
 * Enforce honesty in verdict
 * Reduces confidence if claims exceed evidence
 * 
 * @param {string} rawVerdict - Proposed verdict
 * @param {Object} honestyContract - Honesty data
 * @returns {Object} Honest verdict with adjusted confidence
 */
function enforceHonestyInVerdict(rawVerdict, honestyContract) {
  if (!honestyContract || !honestyContract.confidenceBasis) {
    // FAIL-SAFE: Missing honesty data forces DO_NOT_LAUNCH
    return {
      verdict: 'DO_NOT_LAUNCH',
      confidence: 0,
      reason: 'HONESTY VIOLATION: Insufficient evidence to make a safe claim',
      honestyEnforced: true,
      originalVerdict: rawVerdict
    };
  }

  const { coverageStats, confidenceBasis, triggeredRuleIds = [] } = honestyContract;
  
  // Check if all critical goals were reached (from rules engine)
  const allGoalsReached = triggeredRuleIds.includes('all_goals_reached');
  
  // READY with zero execution is dishonest - CHECK THIS FIRST
  if (rawVerdict === 'READY' && coverageStats.executed === 0) {
    return {
      verdict: 'DO_NOT_LAUNCH',
      confidence: 0,
      reason: 'HONESTY VIOLATION: Cannot claim READY with zero execution evidence',
      honestyEnforced: true,
      originalVerdict: rawVerdict
    };
  }
  
  // READY with low coverage is dishonest (UNLESS all goals were reached via executed attempts)
  // Observable capabilities principle: If all critical goals succeeded, coverage requirement is waived
  if (rawVerdict === 'READY' && coverageStats.percent < 70 && !allGoalsReached) {
    return {
      verdict: 'FRICTION',
      confidence: confidenceBasis.score,
      reason: `HONESTY ADJUSTMENT: READY verdict requires ≥70% coverage OR all goals reached, got ${coverageStats.percent}% coverage without goal confirmation`,
      honestyEnforced: true,
      originalVerdict: rawVerdict
    };
  }

  // Verdict is honest - return with honesty contract attached
  return {
    verdict: rawVerdict,
    confidence: confidenceBasis.score,
    reason: null,
    honestyEnforced: false,
    honestyContract: honestyContract
  };
}

/**
 * Format honesty contract for CLI output
 */
function formatHonestyForCLI(honestyContract) {
  if (!honestyContract) {
    return '\n⚠️  HONESTY DATA MISSING - Claims cannot be verified\n';
  }

  const { testedScope, untestedScope, confidenceBasis, nonClaims, limits, coverageStats } = honestyContract;

  let output = '\n';
  output += '═'.repeat(70) + '\n';
  output += '🔒 HONESTY CONTRACT - Limits of This Run\n';
  output += '═'.repeat(70) + '\n\n';

  // Coverage Stats
  output += `📊 Coverage: ${coverageStats.executed}/${coverageStats.total} tests executed (${coverageStats.percent}%)\n`;
  if (coverageStats.skipped > 0) {
    output += `   Skipped: ${coverageStats.skipped} | Disabled: ${coverageStats.disabled}\n`;
  }
  output += '\n';

  // What WAS tested
  output += '✅ TESTED (What Guardian actually verified):\n';
  if (testedScope.length > 0 && testedScope[0] !== 'NONE - No execution data') {
    const displayTests = testedScope.slice(0, 5);
    displayTests.forEach(test => {
      output += `   • ${test}\n`;
    });
    if (testedScope.length > 5) {
      output += `   ... and ${testedScope.length - 5} more\n`;
    }
  } else {
    output += '   ⚠️  NONE - No tests executed\n';
  }
  output += '\n';

  // What was NOT tested
  output += '❌ NOT TESTED (Relevant but unverified):\n';
  if (untestedScope.length > 0 && untestedScope[0] !== 'All relevant tests executed') {
    const displayUntested = untestedScope.slice(0, 5);
    displayUntested.forEach(test => {
      output += `   • ${test}\n`;
    });
    if (untestedScope.length > 5) {
      output += `   ... and ${untestedScope.length - 5} more\n`;
    }
  } else {
    output += '   ✓ All relevant tests executed\n';
  }
  output += '\n';

  // Confidence Basis
  output += '🎯 CONFIDENCE BASIS (Why this confidence level):\n';
  output += `   ${confidenceBasis.summary}\n`;
  confidenceBasis.details.forEach(detail => {
    output += `   • ${detail}\n`;
  });
  output += '\n';

  // Explicit Non-Claims
  output += '🚫 WHAT GUARDIAN DOES NOT CLAIM:\n';
  nonClaims.slice(0, 5).forEach(claim => {
    output += `   • ${claim}\n`;
  });
  output += '\n';

  // Limits
  output += '⚠️  LIMITS OF THIS RUN:\n';
  limits.forEach(limit => {
    output += `   • ${limit}\n`;
  });
  output += '\n';

  output += '═'.repeat(70) + '\n';

  return output;
}

/**
 * Validate honesty contract structure
 */
function validateHonestyContract(honestyContract) {
  if (!honestyContract) {
    return { valid: false, reason: 'Honesty contract is null or undefined' };
  }

  const required = ['testedScope', 'untestedScope', 'confidenceBasis', 'nonClaims', 'limits', 'coverageStats'];
  
  for (const field of required) {
    if (!honestyContract[field]) {
      return { valid: false, reason: `Missing required field: ${field}` };
    }
  }

  if (!Array.isArray(honestyContract.testedScope)) {
    return { valid: false, reason: 'testedScope must be an array' };
  }

  if (!Array.isArray(honestyContract.untestedScope)) {
    return { valid: false, reason: 'untestedScope must be an array' };
  }

  if (typeof honestyContract.confidenceBasis.score !== 'number') {
    return { valid: false, reason: 'confidenceBasis.score must be a number' };
  }

  return { valid: true };
}

module.exports = {
  buildHonestyContract,
  enforceHonestyInVerdict,
  formatHonestyForCLI,
  validateHonestyContract
};
