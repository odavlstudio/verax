/**
 * PHASE 7 — DECISION SNAPSHOT
 * 
 * Computes a top-level decision snapshot that answers 6 mandatory questions:
 * 
 * 1. Do we have confirmed SILENT FAILURES?
 * 2. Where exactly are they?
 * 3. How severe are they (user-impact-wise)?
 * 4. What did VERAX NOT verify?
 * 5. Why was it not verified?
 * 6. How much confidence do we have in the findings?
 * 
 * Rules:
 * - Derived ONLY from existing data (findings, silences, coverage)
 * - No new detection logic
 * - No subjective language
 * - No recommendations or advice
 */

/**
 * Severity levels (user-impact-based, not technical)
 */
export const SEVERITY = {
  CRITICAL_USER_BLOCKER: 'critical_user_blocker',     // Prevents user from completing core task
  FLOW_BREAKING: 'flow_breaking',                     // Breaks expected navigation/state flow
  DEGRADING: 'degrading',                             // Reduces functionality but doesn't block
  INFORMATIONAL: 'informational'                      // Observable but no clear user impact
};

/**
 * Classify finding severity based on promise type and outcome
 * @param {Object} finding - Finding object
 * @returns {string} - Severity level from SEVERITY enum
 */
function classifyFindingSeverity(finding) {
  const promiseType = finding.promiseType || finding.type;
  const outcome = finding.outcome;
  
  // Navigation promises that fail are flow-breaking
  if (promiseType === 'navigation' && outcome === 'broken') {
    return SEVERITY.FLOW_BREAKING;
  }
  
  // Network actions that fail are critical (forms, submissions)
  if (promiseType === 'networkAction' && outcome === 'broken') {
    return SEVERITY.CRITICAL_USER_BLOCKER;
  }
  
  // State actions that fail are degrading
  if (promiseType === 'stateAction' && outcome === 'broken') {
    return SEVERITY.DEGRADING;
  }
  
  // Auth failures are critical user blockers
  if (promiseType === 'authentication' && outcome === 'broken') {
    return SEVERITY.CRITICAL_USER_BLOCKER;
  }
  
  // Timeout/unknown outcomes are degrading (cannot confirm impact)
  if (outcome === 'timeout' || outcome === 'unknown') {
    return SEVERITY.DEGRADING;
  }
  
  // Default to informational if unclear
  return SEVERITY.INFORMATIONAL;
}

/**
 * Compute confidence score (0.0 - 1.0) based on silences and coverage
 * @param {Object} detectTruth - Detect phase truth
 * @param {Object} observeTruth - Observe phase truth
 * @returns {Object} - Confidence assessment
 */
function computeConfidence(detectTruth, observeTruth) {
  const totalInteractions = observeTruth?.interactionsObserved || 0;
  const analyzed = detectTruth?.interactionsAnalyzed || 0;
  const skipped = detectTruth?.skips?.total || 0;
  const timeouts = observeTruth?.timeoutsCount || 0;
  const coverageGaps = detectTruth?.coverageGapsCount || 0;
  
  // Coverage ratio: how much was actually verified
  const coverageRatio = totalInteractions > 0 ? analyzed / totalInteractions : 0;
  
  // Silence penalty: reduce confidence for unknown outcomes
  const silencePenalty = (skipped + timeouts + coverageGaps) / Math.max(totalInteractions, 1);
  
  // Base confidence from coverage
  let confidenceScore = coverageRatio;
  
  // Apply silence penalty (max 50% reduction)
  confidenceScore = confidenceScore * (1 - Math.min(silencePenalty * 0.5, 0.5));
  
  // Clamp to 0-1 range
  confidenceScore = Math.max(0, Math.min(1, confidenceScore));
  
  // Classify confidence level
  let confidenceLevel = 'very_low';
  if (confidenceScore >= 0.9) {
    confidenceLevel = 'high';
  } else if (confidenceScore >= 0.7) {
    confidenceLevel = 'medium';
  } else if (confidenceScore >= 0.5) {
    confidenceLevel = 'low';
  }
  
  return {
    score: confidenceScore,
    level: confidenceLevel,
    coverageRatio,
    silencePenalty,
    factors: {
      totalInteractions,
      analyzed,
      skipped,
      timeouts,
      coverageGaps
    }
  };
}

/**
 * Extract unverified items with reasons
 * @param {Object} detectTruth - Detect phase truth
 * @param {Object} observeTruth - Observe phase truth
 * @returns {Array} - List of unverified items with reasons
 */
function extractUnverified(detectTruth, observeTruth) {
  const unverified = [];
  
  // Coverage gaps (expectations not evaluated)
  const coverageGaps = detectTruth?.coverageGapsCount || 0;
  if (coverageGaps > 0) {
    unverified.push({
      category: 'expectations',
      count: coverageGaps,
      reason: 'budget_exceeded'
    });
  }
  
  // Skipped interactions by reason
  const skips = detectTruth?.skips?.reasons || [];
  for (const skipReason of skips) {
    unverified.push({
      category: 'interactions',
      count: skipReason.count,
      reason: skipReason.code
    });
  }
  
  // Timeouts
  const timeouts = observeTruth?.timeoutsCount || 0;
  if (timeouts > 0) {
    unverified.push({
      category: 'interactions',
      count: timeouts,
      reason: 'timeout'
    });
  }
  
  // External navigations blocked
  const externalBlocked = observeTruth?.externalNavigationBlockedCount || 0;
  if (externalBlocked > 0) {
    unverified.push({
      category: 'navigations',
      count: externalBlocked,
      reason: 'external_blocked'
    });
  }
  
  return unverified;
}

/**
 * Compute decision snapshot from scan results
 * @param {Array} findings - Array of findings
 * @param {Object} detectTruth - Detect phase truth
 * @param {Object} observeTruth - Observe phase truth
 * @param {Object} _silences - Silence data (unused parameter, kept for API compatibility)
 * @returns {Object} - Decision snapshot answering 6 mandatory questions
 */
export function computeDecisionSnapshot(findings, detectTruth, observeTruth, _silences) {
  // Question 1: Do we have confirmed SILENT FAILURES?
  const confirmedFailures = findings.filter(f => 
    f.outcome === 'broken' || f.type === 'silent_failure'
  );
  const hasConfirmedFailures = confirmedFailures.length > 0;
  
  // Question 2: Where exactly are they?
  const failureLocations = confirmedFailures.map(f => ({
    type: f.promiseType || f.type,
    fromPath: f.fromPath,
    toPath: f.toPath,
    selector: f.interaction?.selector,
    description: f.description || f.reason
  }));
  
  // Question 3: How severe are they (user-impact-wise)?
  const severityCounts = {
    [SEVERITY.CRITICAL_USER_BLOCKER]: 0,
    [SEVERITY.FLOW_BREAKING]: 0,
    [SEVERITY.DEGRADING]: 0,
    [SEVERITY.INFORMATIONAL]: 0
  };
  
  const failuresBySeverity = confirmedFailures.map(f => {
    const severity = classifyFindingSeverity(f);
    severityCounts[severity]++;
    return {
      severity,
      finding: f
    };
  });
  
  // Question 4: What did VERAX NOT verify?
  const unverified = extractUnverified(detectTruth, observeTruth);
  const totalUnverified = unverified.reduce((sum, u) => sum + u.count, 0);
  
  // Question 5: Why was it not verified?
  const unverifiedReasons = {};
  for (const item of unverified) {
    if (!unverifiedReasons[item.reason]) {
      unverifiedReasons[item.reason] = 0;
    }
    unverifiedReasons[item.reason] += item.count;
  }
  
  // Question 6: How much confidence do we have in the findings?
  const confidence = computeConfidence(detectTruth, observeTruth);
  
  return {
    // Question 1
    hasConfirmedFailures,
    confirmedFailureCount: confirmedFailures.length,
    
    // Question 2
    failureLocations,
    
    // Question 3
    severityCounts,
    failuresBySeverity: failuresBySeverity.map(f => ({
      severity: f.severity,
      type: f.finding.promiseType || f.finding.type,
      description: f.finding.description || f.finding.reason,
      fromPath: f.finding.fromPath
    })),
    
    // Question 4
    totalUnverified,
    unverifiedByCategory: unverified.reduce((acc, u) => {
      if (!acc[u.category]) {
        acc[u.category] = 0;
      }
      acc[u.category] += u.count;
      return acc;
    }, {}),
    
    // Question 5
    unverifiedReasons,
    unverifiedDetails: unverified,
    
    // Question 6
    confidence: {
      level: confidence.level,
      score: confidence.score,
      coverageRatio: confidence.coverageRatio,
      factors: confidence.factors
    }
  };
}

/**
 * Format decision snapshot for human reading
 * @param {Object} snapshot - Decision snapshot
 * @returns {string} - Formatted text
 */
export function formatDecisionSnapshot(snapshot) {
  const lines = [];
  
  lines.push('=== DECISION SNAPSHOT ===');
  lines.push('');
  
  // Question 1: Confirmed failures?
  lines.push(`1. CONFIRMED SILENT FAILURES: ${snapshot.hasConfirmedFailures ? 'YES' : 'NO'}`);
  lines.push(`   Count: ${snapshot.confirmedFailureCount}`);
  lines.push('');
  
  // Question 2: Where?
  if (snapshot.failureLocations.length > 0) {
    lines.push('2. FAILURE LOCATIONS:');
    for (const loc of snapshot.failureLocations.slice(0, 5)) {
      lines.push(`   - ${loc.type}: ${loc.fromPath} → ${loc.toPath || 'unknown'}`);
      if (loc.selector) {
        lines.push(`     Selector: ${loc.selector}`);
      }
    }
    if (snapshot.failureLocations.length > 5) {
      lines.push(`   ... and ${snapshot.failureLocations.length - 5} more`);
    }
  } else {
    lines.push('2. FAILURE LOCATIONS: None');
  }
  lines.push('');
  
  // Question 3: How severe?
  lines.push('3. SEVERITY BREAKDOWN:');
  lines.push(`   Critical user blockers: ${snapshot.severityCounts.critical_user_blocker}`);
  lines.push(`   Flow-breaking issues: ${snapshot.severityCounts.flow_breaking}`);
  lines.push(`   Degrading issues: ${snapshot.severityCounts.degrading}`);
  lines.push(`   Informational: ${snapshot.severityCounts.informational}`);
  lines.push('');
  
  // Question 4: What NOT verified?
  lines.push('4. NOT VERIFIED:');
  lines.push(`   Total: ${snapshot.totalUnverified}`);
  for (const [category, count] of Object.entries(snapshot.unverifiedByCategory)) {
    lines.push(`   - ${category}: ${count}`);
  }
  lines.push('');
  
  // Question 5: Why not verified?
  lines.push('5. REASONS NOT VERIFIED:');
  for (const [reason, count] of Object.entries(snapshot.unverifiedReasons)) {
    lines.push(`   - ${reason}: ${count}`);
  }
  lines.push('');
  
  // Question 6: Confidence?
  lines.push('6. CONFIDENCE IN FINDINGS:');
  lines.push(`   Level: ${snapshot.confidence.level.toUpperCase()}`);
  lines.push(`   Score: ${(snapshot.confidence.score * 100).toFixed(1)}%`);
  lines.push(`   Coverage: ${(snapshot.confidence.coverageRatio * 100).toFixed(1)}% of interactions verified`);
  lines.push('');
  
  return lines.join('\n');
}
