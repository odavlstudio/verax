/**
 * Wave 6 — Run Overview
 * 
 * Generates a clear, human-readable overview of the scan run.
 */

/**
 * Generate run overview data structure
 * @param {Object} context - Scan context
 * @returns {Object} Overview data
 */
export function generateRunOverview(context = {}) {
  const {
    manifest = null,
    expectationsSummary = { total: 0, navigation: 0, networkActions: 0, stateActions: 0 },
    interactionsObserved = 0,
    contextCheck = null,
    verdict = 'UNKNOWN',
    findingsCount = 0
  } = context;
  
  const projectType = manifest?.projectType || 'unknown';
  const expectationsTotal = expectationsSummary.total || 0;
  
  // Determine validation status
  let validationStatus = 'skipped';
  let validationReason = 'No routes to validate';
  
  if (contextCheck && contextCheck.ran) {
    if (contextCheck.verdict === 'VALID_CONTEXT') {
      validationStatus = 'validated';
      validationReason = `${contextCheck.matchedRoutesCount} routes matched`;
    } else if (contextCheck.verdict === 'INVALID_CONTEXT') {
      validationStatus = 'mismatch';
      validationReason = 'URL does not match project';
    } else if (contextCheck.verdict === 'INVALID_CONTEXT_FORCED') {
      validationStatus = 'forced';
      validationReason = 'Scan continued with --force despite mismatch';
    }
  }
  
  // Generate trust statement
  let trustLevel = 'low';
  const trustReasons = [];
  
  if (verdict === 'VERIFIED') {
    trustLevel = 'high';
    trustReasons.push(`All ${expectationsTotal} expectations validated`);
    trustReasons.push(`${interactionsObserved} interactions tested`);
    if (validationStatus === 'validated') {
      trustReasons.push('Context validated');
    }
  } else if (verdict === 'ISSUES_FOUND') {
    trustLevel = 'high';
    trustReasons.push(`${expectationsTotal} expectations analyzed`);
    trustReasons.push(`${interactionsObserved} interactions tested`);
    trustReasons.push(`${findingsCount} issue(s) detected`);
  } else if (verdict === 'NO_EXPECTATIONS_FOUND') {
    trustLevel = 'low';
    trustReasons.push('No code-derived expectations found');
    trustReasons.push('Cannot validate without expectations');
  } else if (verdict === 'INVALID_CONTEXT' || verdict === 'INVALID_CONTEXT_FORCED') {
    trustLevel = 'partial';
    trustReasons.push(`${expectationsTotal} expectations found`);
    if (validationStatus === 'forced') {
      trustReasons.push('Context mismatch (forced scan)');
    } else {
      trustReasons.push('Context mismatch - scan stopped early');
    }
    if (interactionsObserved === 0) {
      trustReasons.push('No interactions executed');
    }
  }
  
  // Adjust trust level based on interactions
  if (expectationsTotal > 0 && interactionsObserved === 0 && verdict !== 'INVALID_CONTEXT') {
    trustLevel = 'partial';
    if (!trustReasons.some(r => r.includes('No interactions'))) {
      trustReasons.push('No interactions executed - validation incomplete');
    }
  }
  
  // Explicitly mention skipped expectations
  if (context?.expectationsUnused !== undefined && context.expectationsUnused > 0) {
    if (trustLevel === 'high') {
      trustLevel = 'partial';
    }
    trustReasons.push(`${context.expectationsUnused} expectation(s) unused - partial validation`);
  }
  
  return {
    projectType: projectType,
    expectationsFound: expectationsTotal,
    expectationsByType: {
      navigation: expectationsSummary.navigation || 0,
      networkActions: expectationsSummary.networkActions || 0,
      stateActions: expectationsSummary.stateActions || 0
    },
    interactionsExecuted: interactionsObserved,
    validationStatus: validationStatus,
    validationReason: validationReason,
    trustLevel: trustLevel,
    trustReasons: trustReasons
  };
}

/**
 * Print run overview console block
 * @param {Object} overview - Overview data from generateRunOverview
 * @param {boolean} isCI - Whether in CI mode
 */
export function printRunOverview(overview, isCI = false) {
  if (isCI) {
    // Compact CI format
    console.error(`VERAX Run: ${overview.projectType} | ${overview.expectationsFound} expectations | ${overview.interactionsExecuted} interactions | ${overview.validationStatus}`);
    return;
  }
  
  // Full format
  console.error('\n' + '═'.repeat(60));
  console.error('Run Overview');
  console.error('═'.repeat(60));
  
  console.error(`Project Type: ${overview.projectType}`);
  
  console.error(`\nExpectations Found: ${overview.expectationsFound}`);
  if (overview.expectationsFound > 0) {
    const types = [];
    if (overview.expectationsByType.navigation > 0) {
      types.push(`navigation (${overview.expectationsByType.navigation})`);
    }
    if (overview.expectationsByType.networkActions > 0) {
      types.push(`network actions (${overview.expectationsByType.networkActions})`);
    }
    if (overview.expectationsByType.stateActions > 0) {
      types.push(`state actions (${overview.expectationsByType.stateActions})`);
    }
    if (types.length > 0) {
      console.error(`  Types: ${types.join(', ')}`);
    }
  }
  
  console.error(`\nInteractions Executed: ${overview.interactionsExecuted}`);
  
  console.error(`\nValidation Status: ${overview.validationStatus}`);
  console.error(`  ${overview.validationReason}`);
  
  // Trust statement
  console.error(`\nTrust Assessment: ${overview.trustLevel.toUpperCase()}`);
  const trustPrefix = overview.trustLevel === 'high' 
    ? 'This result is trustworthy because'
    : overview.trustLevel === 'partial'
    ? 'This result is limited because'
    : 'This result cannot be trusted because';
  
  console.error(`  ${trustPrefix}:`);
  overview.trustReasons.forEach(reason => {
    console.error(`  • ${reason}`);
  });
  
  console.error('═'.repeat(60) + '\n');
}




