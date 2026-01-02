/**
 * Stage 6: Verdict Card — Human Decision Card with Business Impact
 * 
 * Transforms technical data into business-oriented human-readable output.
 * NO fake certainty: uses "likely" or "risk" unless proven.
 */

/**
 * Generate verdict card from decision and signals
 * @param {Object} options - Card generation options
 * @returns {Object} Structured verdict card
 */
function generateVerdictCard(options) {
  const {
    finalDecision,
    humanPath,
    coverage,
    selectorConfidence,
    networkSafety,
    policyEval,
    baselineDiff,
    attemptResults = [],
    flowResults = [],
    siteIntelligence
  } = options;

  const verdict = finalDecision.finalVerdict;
  const severity = determineSeverity(verdict, finalDecision, attemptResults, flowResults);
  const impact = estimateBusinessImpact(verdict, attemptResults, flowResults, coverage, siteIntelligence);
  const headline = generateHeadline(verdict, impact, attemptResults, flowResults, humanPath);
  const bullets = generateBullets(verdict, attemptResults, flowResults, coverage, humanPath, siteIntelligence);
  const evidence = generateEvidence(attemptResults, flowResults, coverage, selectorConfidence, networkSafety, policyEval, baselineDiff);
  const nextActions = generateNextActions(verdict, impact, attemptResults, flowResults);

  return {
    headline,
    severity,
    impact,
    bullets: bullets.slice(0, 3),
    evidence: evidence.slice(0, 3),
    nextActions: nextActions.slice(0, 3)
  };
}

/**
 * Determine severity based on verdict and outcomes
 */
function determineSeverity(verdict, finalDecision, attemptResults, flowResults) {
  if (verdict === 'DO_NOT_LAUNCH') {
    // Check if critical path is broken
    const hasCriticalFailure = flowResults.some(f => 
      (f.outcome === 'FAILURE' || f.success === false) &&
      (f.flowId?.includes('checkout') || f.flowId?.includes('signup') || f.flowId?.includes('payment'))
    );
    
    if (hasCriticalFailure) return 'HIGH';
    
    const failureCount = attemptResults.filter(a => a.outcome === 'FAILURE').length;
    if (failureCount >= 2) return 'HIGH';
    
    return 'MEDIUM';
  }

  if (verdict === 'FRICTION') {
    const nearSuccessCount = attemptResults.filter(a => a.outcome === 'NEAR_SUCCESS').length;
    if (nearSuccessCount >= 2) return 'MEDIUM';
    
    const frictionCount = flowResults.filter(f => f.outcome === 'FRICTION').length;
    if (frictionCount >= 2) return 'MEDIUM';
    
    return 'LOW';
  }

  if (verdict === 'ERROR' || verdict === 'UNKNOWN') {
    return 'HIGH';
  }

  return 'LOW'; // READY
}

/**
 * Estimate business impact with honest confidence levels
 */
function estimateBusinessImpact(verdict, attemptResults, flowResults, coverage, siteIntelligence) {
  if (verdict === 'READY') {
    return {
      type: 'MINIMAL_RISK',
      summary: 'No significant user friction detected in tested flows',
      confidence: coverage?.percent >= 60 ? 'MODERATE' : 'LOW',
      assumptions: [
        `Tested ${coverage?.executed || 0} of ${coverage?.total || 0} planned scenarios`,
        'Untested areas may contain issues'
      ]
    };
  }

  // Identify critical path failures
  const criticalFlows = flowResults.filter(f => 
    (f.outcome === 'FAILURE' || f.success === false) &&
    (f.flowId?.includes('checkout') || f.flowId?.includes('payment') || f.flowId?.includes('signup') || f.flowId?.includes('contact'))
  );

  const criticalAttempts = attemptResults.filter(a =>
    a.outcome === 'FAILURE' &&
    (a.attemptId?.includes('checkout') || a.attemptId?.includes('payment') || a.attemptId?.includes('signup') || a.attemptId?.includes('contact'))
  );

  if (criticalFlows.length > 0 || criticalAttempts.length > 0) {
    const pathType = determinePathType(criticalFlows, criticalAttempts);
    
    if (pathType === 'CHECKOUT' || pathType === 'PAYMENT') {
      return {
        type: 'CONVERSION_RISK',
        summary: 'Users likely cannot complete purchases — revenue at risk',
        confidence: 'HIGH',
        assumptions: [
          'Checkout/payment path failed in testing',
          'Assumes similar failures in production'
        ]
      };
    }

    if (pathType === 'SIGNUP') {
      return {
        type: 'ACQUISITION_RISK',
        summary: 'New user signup likely blocked — growth at risk',
        confidence: 'HIGH',
        assumptions: [
          'Signup flow failed in testing',
          'Real users will encounter same issue'
        ]
      };
    }

    if (pathType === 'CONTACT') {
      return {
        type: 'LEAD_RISK',
        summary: 'Contact forms may not work — lead generation at risk',
        confidence: 'MODERATE',
        assumptions: [
          'Contact flow failed or not found',
          'Users may have alternate contact methods'
        ]
      };
    }
  }

  // Check for friction patterns
  const frictionFlows = flowResults.filter(f => f.outcome === 'FRICTION');
  const nearSuccessAttempts = attemptResults.filter(a => a.outcome === 'NEAR_SUCCESS');

  if (frictionFlows.length > 0 || nearSuccessAttempts.length > 0) {
    return {
      type: 'USER_FRICTION',
      summary: 'Some flows slow or inconsistent — user abandonment risk',
      confidence: 'MODERATE',
      assumptions: [
        `${frictionFlows.length + nearSuccessAttempts.length} flows had friction`,
        'Friction increases user abandonment likelihood'
      ]
    };
  }

  // Check mobile vs desktop
  if (siteIntelligence?.deviceIssues) {
    return {
      type: 'DEVICE_SPECIFIC_RISK',
      summary: 'Mobile or desktop experience degraded — partial user impact',
      confidence: 'MODERATE',
      assumptions: [
        'Issues detected on specific device types',
        'Affects subset of user base'
      ]
    };
  }

  return {
    type: 'GENERAL_RISK',
    summary: 'Site health concerns detected — user experience at risk',
    confidence: coverage?.percent >= 50 ? 'MODERATE' : 'LOW',
    assumptions: [
      'Based on partial coverage',
      'Full impact unclear'
    ]
  };
}

/**
 * Determine primary path type from failures
 */
function determinePathType(criticalFlows, criticalAttempts) {
  const allIds = [
    ...criticalFlows.map(f => f.flowId || ''),
    ...criticalAttempts.map(a => a.attemptId || '')
  ].join(' ').toLowerCase();

  if (allIds.includes('checkout') || allIds.includes('payment')) return 'CHECKOUT';
  if (allIds.includes('signup') || allIds.includes('register')) return 'SIGNUP';
  if (allIds.includes('contact')) return 'CONTACT';
  
  return 'OTHER';
}

/**
 * Generate headline based on verdict and impact
 */
function generateHeadline(verdict, impact, attemptResults, flowResults, humanPath) {
  if (verdict === 'READY') {
    return 'READY — Site passed critical user flows';
  }

  if (verdict === 'DO_NOT_LAUNCH') {
    if (impact.type === 'CONVERSION_RISK') {
      return 'DO NOT LAUNCH — Checkout path breaks for real users';
    }

    if (impact.type === 'ACQUISITION_RISK') {
      return 'DO NOT LAUNCH — Signup flow fails for new users';
    }

    if (impact.type === 'LEAD_RISK') {
      return 'DO NOT LAUNCH — Contact forms not functional';
    }

    const failureCount = attemptResults.filter(a => a.outcome === 'FAILURE').length;
    const flowFailureCount = flowResults.filter(f => f.outcome === 'FAILURE' || f.success === false).length;

    if (failureCount > 0 || flowFailureCount > 0) {
      return `DO NOT LAUNCH — ${failureCount + flowFailureCount} critical path(s) broken`;
    }

    return 'DO NOT LAUNCH — Critical site issues detected';
  }

  if (verdict === 'FRICTION') {
    const nearSuccessCount = attemptResults.filter(a => a.outcome === 'NEAR_SUCCESS').length;
    const frictionCount = flowResults.filter(f => f.outcome === 'FRICTION').length;

    if (nearSuccessCount > 0 || frictionCount > 0) {
      return `FRICTION — ${nearSuccessCount + frictionCount} flow(s) slow or inconsistent`;
    }

    return 'FRICTION — Some user flows show degraded performance';
  }

  if (verdict === 'ERROR') {
    return 'ERROR — Guardian encountered internal issues';
  }

  if (verdict === 'UNKNOWN') {
    return 'UNKNOWN — Unable to determine site readiness';
  }

  return `${verdict} — Review required`;
}

/**
 * Generate bullet points (max 3)
 */
function generateBullets(verdict, attemptResults, flowResults, coverage, humanPath, siteIntelligence) {
  const bullets = [];

  if (verdict === 'READY') {
    const successCount = attemptResults.filter(a => a.outcome === 'SUCCESS').length;
    const flowSuccessCount = flowResults.filter(f => f.outcome === 'SUCCESS' || f.success === true).length;
    
    if (successCount > 0 || flowSuccessCount > 0) {
      bullets.push(`${successCount + flowSuccessCount} user flow(s) completed successfully`);
    }

    if (coverage?.percent >= 50) {
      bullets.push(`${Math.round(coverage.percent)}% coverage across critical paths`);
    } else {
      bullets.push(`Limited testing coverage (${Math.round(coverage?.percent || 0)}%) — expand scope for confidence`);
    }

    if (humanPath && humanPath.length > 0) {
      bullets.push(`Users can navigate: ${humanPath.slice(0, 2).join(' → ')}`);
    }

    return bullets;
  }

  // Failures
  const failures = attemptResults.filter(a => a.outcome === 'FAILURE');
  const flowFailures = flowResults.filter(f => f.outcome === 'FAILURE' || f.success === false);

  if (failures.length > 0) {
    bullets.push(`${failures.length} attempt(s) failed: ${failures.slice(0, 2).map(f => f.attemptId).join(', ')}`);
  }

  if (flowFailures.length > 0) {
    bullets.push(`${flowFailures.length} flow(s) broken: ${flowFailures.slice(0, 2).map(f => f.flowId || 'unknown').join(', ')}`);
  }

  // Near success / friction
  const nearSuccess = attemptResults.filter(a => a.outcome === 'NEAR_SUCCESS');
  const friction = flowResults.filter(f => f.outcome === 'FRICTION');

  if (nearSuccess.length > 0) {
    bullets.push(`${nearSuccess.length} flow(s) partially worked but incomplete`);
  }

  if (friction.length > 0) {
    bullets.push(`${friction.length} flow(s) slow or timing out`);
  }

  // Coverage gaps
  if (coverage && coverage.gaps > 0) {
    bullets.push(`${coverage.gaps} scenario(s) not tested — impact unclear`);
  }

  return bullets;
}

/**
 * Generate evidence lines (max 3)
 */
function generateEvidence(attemptResults, flowResults, coverage, selectorConfidence, networkSafety, policyEval, baselineDiff) {
  const evidence = [];

  // Coverage evidence
  if (coverage) {
    evidence.push(`Tested ${coverage.executed || 0}/${coverage.total || 0} scenarios (${Math.round(coverage.percent || 0)}% coverage)`);
  }

  // Selector confidence
  if (selectorConfidence && selectorConfidence.avgConfidence) {
    const confidence = Math.round(selectorConfidence.avgConfidence * 100);
    evidence.push(`Element detection confidence: ${confidence}%`);
  }

  // Network safety
  if (networkSafety) {
    if (networkSafety.excessiveThirdParty) {
      evidence.push(`${networkSafety.thirdPartyCount || 0} third-party domains — privacy/performance risk`);
    } else if (networkSafety.httpWarnings && networkSafety.httpWarnings.length > 0) {
      evidence.push(`${networkSafety.httpWarnings.length} insecure HTTP request(s) detected`);
    } else if (networkSafety.totalRequests) {
      evidence.push(`${networkSafety.totalRequests} network requests analyzed`);
    }
  }

  // Policy violations
  if (policyEval && !policyEval.passed) {
    evidence.push(`Policy violations: ${policyEval.violations?.length || 0} issue(s)`);
  }

  // Baseline regression
  if (baselineDiff && baselineDiff.hasRegression) {
    evidence.push(`Baseline regression detected — site worse than previous run`);
  }

  // Attempt outcomes summary
  const totalAttempts = attemptResults.length;
  const successAttempts = attemptResults.filter(a => a.outcome === 'SUCCESS').length;
  const failureAttempts = attemptResults.filter(a => a.outcome === 'FAILURE').length;
  
  if (totalAttempts > 0) {
    evidence.push(`${successAttempts} passed, ${failureAttempts} failed of ${totalAttempts} attempts`);
  }

  return evidence;
}

/**
 * Generate next actions (max 3) — human hints, not code fixes
 */
function generateNextActions(verdict, impact, attemptResults, flowResults) {
  const actions = [];

  if (verdict === 'READY') {
    actions.push('Proceed with deployment');
    actions.push('Monitor production for 24h after launch');
    actions.push('Review untested areas if critical');
    return actions;
  }

  if (verdict === 'DO_NOT_LAUNCH') {
    if (impact.type === 'CONVERSION_RISK') {
      actions.push('Fix checkout/payment flow before launch');
      actions.push('Test manually to confirm issue');
      actions.push('Consider revenue loss if deployed broken');
    } else if (impact.type === 'ACQUISITION_RISK') {
      actions.push('Fix signup flow before launch');
      actions.push('Verify new user experience manually');
      actions.push('Risk: no new users can join');
    } else if (impact.type === 'LEAD_RISK') {
      actions.push('Fix or verify contact forms');
      actions.push('Ensure alternate contact methods work');
      actions.push('Risk: lost leads and support requests');
    } else {
      const failures = [...attemptResults.filter(a => a.outcome === 'FAILURE'), ...flowResults.filter(f => f.outcome === 'FAILURE' || f.success === false)];
      if (failures.length > 0) {
        actions.push(`Review failed flow(s): ${failures.slice(0, 2).map(f => f.attemptId || f.flowId).join(', ')}`);
      }
      actions.push('Do not deploy until issues resolved');
      actions.push('Re-run Guardian after fixes');
    }
    return actions;
  }

  if (verdict === 'FRICTION') {
    actions.push('Review slow or inconsistent flows');
    actions.push('Decide if acceptable to launch with friction');
    actions.push('Monitor user abandonment if deployed');
    return actions;
  }

  if (verdict === 'ERROR' || verdict === 'UNKNOWN') {
    actions.push('Check Guardian logs for error details');
    actions.push('Verify site is accessible');
    actions.push('Re-run Guardian or test manually');
    return actions;
  }

  return actions;
}

/**
 * Format verdict card for CLI output
 */
function formatVerdictCard(card) {
  const lines = [];
  
  lines.push('');
  lines.push('━'.repeat(70));
  lines.push(`${card.headline}`);
  lines.push('━'.repeat(70));
  
  lines.push('');
  lines.push(`Severity: ${card.severity}`);
  lines.push(`Impact: ${card.impact.summary}`);
  lines.push(`Confidence: ${card.impact.confidence}`);
  
  if (card.bullets.length > 0) {
    lines.push('');
    lines.push('Key Points:');
    card.bullets.forEach(bullet => lines.push(`  • ${bullet}`));
  }
  
  if (card.evidence.length > 0) {
    lines.push('');
    lines.push('Evidence:');
    card.evidence.forEach(ev => lines.push(`  • ${ev}`));
  }
  
  if (card.nextActions.length > 0) {
    lines.push('');
    lines.push('Next Actions:');
    card.nextActions.forEach((action, i) => lines.push(`  ${i + 1}. ${action}`));
  }
  
  if (card.impact.assumptions && card.impact.assumptions.length > 0) {
    lines.push('');
    lines.push('Assumptions:');
    card.impact.assumptions.forEach(assumption => lines.push(`  • ${assumption}`));
  }
  
  lines.push('━'.repeat(70));
  
  return lines.join('\n');
}

module.exports = {
  generateVerdictCard,
  formatVerdictCard,
  determineSeverity,
  estimateBusinessImpact,
  generateHeadline,
  generateBullets,
  generateEvidence,
  generateNextActions
};
