/**
 * Global Invariants Enforcement
 * 
 * Production lock: ensures VERAX philosophy cannot be violated.
 * Any finding that violates invariants is dropped silently.
 * 
 * Invariants:
 * 1. Every finding MUST have evidence, confidence, and signals
 * 2. Every finding MUST be derived from proven expectation OR observable sensor
 * 3. No finding may exist with missing evidence or contradictory signals
 * 4. Ambiguous findings (low confidence + conflicting signals) are dropped
 */

import { isProvenExpectation } from '../shared/expectation-prover.js';

/**
 * Production lock flag - when enabled, enforces all invariants strictly
 */
export const VERAX_PRODUCTION_LOCK = true;

/**
 * Minimum confidence threshold for ambiguous findings
 */
const AMBIGUITY_CONFIDENCE_THRESHOLD = 60; // Score, not level

/**
 * Enforce all invariants on a finding
 * @param {Object} finding - Finding object to validate
 * @param {Object} trace - Associated trace (for sensor evidence)
 * @param {Object} matchedExpectation - Matched expectation if any
 * @returns {Object} { shouldDrop: boolean, reason: string }
 */
export function enforceInvariants(finding, trace = {}, matchedExpectation = null) {
  if (!VERAX_PRODUCTION_LOCK) {
    // Production lock disabled - skip checks (development mode only)
    return { shouldDrop: false, reason: null };
  }
  
  // INVARIANT 1: Every finding MUST have evidence
  if (!finding.evidence || typeof finding.evidence !== 'object') {
    return {
      shouldDrop: true,
      reason: 'missing_evidence',
      message: 'Finding lacks evidence object'
    };
  }
  
  // INVARIANT 2: Every finding MUST have confidence
  if (!finding.confidence || typeof finding.confidence !== 'object') {
    return {
      shouldDrop: true,
      reason: 'missing_confidence',
      message: 'Finding lacks confidence object'
    };
  }
  
  // INVARIANT 3: Every finding MUST have signals (Phase 9)
  if (!finding.signals || typeof finding.signals !== 'object') {
    return {
      shouldDrop: true,
      reason: 'missing_signals',
      message: 'Finding lacks signals object (impact, userRisk, ownership)'
    };
  }
  
  // INVARIANT 4: Required signal fields must exist
  const requiredSignals = ['impact', 'userRisk', 'ownership', 'grouping'];
  for (const field of requiredSignals) {
    if (!finding.signals[field]) {
      return {
        shouldDrop: true,
        reason: `missing_signal_${field}`,
        message: `Finding signals missing required field: ${field}`
      };
    }
  }
  
  // INVARIANT 5: Impact, userRisk, ownership must be valid enums
  const validImpacts = ['LOW', 'MEDIUM', 'HIGH'];
  if (!validImpacts.includes(finding.signals.impact)) {
    return {
      shouldDrop: true,
      reason: 'invalid_impact',
      message: `Finding has invalid impact: ${finding.signals.impact}`
    };
  }
  
  const validUserRisks = ['BLOCKS', 'CONFUSES', 'DEGRADES'];
  if (!validUserRisks.includes(finding.signals.userRisk)) {
    return {
      shouldDrop: true,
      reason: 'invalid_userRisk',
      message: `Finding has invalid userRisk: ${finding.signals.userRisk}`
    };
  }
  
  const validOwnership = ['FRONTEND', 'BACKEND', 'INTEGRATION', 'ACCESSIBILITY', 'PERFORMANCE'];
  if (!validOwnership.includes(finding.signals.ownership)) {
    return {
      shouldDrop: true,
      reason: 'invalid_ownership',
      message: `Finding has invalid ownership: ${finding.signals.ownership}`
    };
  }
  
  // INVARIANT 6: Finding MUST be derived from proven expectation OR observable sensor
  // Check for proven expectation using the canonical isProvenExpectation function
  const hasProvenExpectation = matchedExpectation && isProvenExpectation(matchedExpectation);
  
  // Check for observed expectation (runtime-derived, also valid as it comes from observable behavior)
  const hasObservedExpectation = trace?.observedExpectation || finding.expectationId;
  
  // Check for observable sensor evidence (at least one sensor must have activity)
  const sensors = trace?.sensors || {};
  const findingEvidence = finding.evidence || {};
  const hasObservableSensor = (
    (sensors.network?.totalRequests || 0) > 0 ||
    (sensors.console?.errors?.length || 0) > 0 ||
    sensors.uiSignals?.diff?.changed === true ||
    sensors.focus ||
    sensors.aria ||
    sensors.timing ||
    sensors.loading ||
    sensors.state ||
    findingEvidence.beforeUrl ||
    findingEvidence.afterUrl ||
    findingEvidence.beforeScreenshot ||
    findingEvidence.afterScreenshot ||
    findingEvidence.before ||
    findingEvidence.after
  );
  
  // Finding must have at least one grounding: proven expectation, observed expectation, or sensor evidence
  if (!hasProvenExpectation && !hasObservedExpectation && !hasObservableSensor) {
    return {
      shouldDrop: true,
      reason: 'ungrounded_finding',
      message: 'Finding not derived from proven expectation, observed expectation, or observable sensor'
    };
  }
  
  // INVARIANT 7: Ambiguity guard - low confidence + conflicting signals = drop
  const confidenceScore = finding.confidence?.score || 0;
  const confidenceLevel = finding.confidence?.level || 'UNKNOWN';
  
  // Only apply ambiguity guard if confidence is below threshold AND level is LOW
  // High/MEDIUM confidence findings are trusted even if score is slightly below threshold
  if (confidenceScore < AMBIGUITY_CONFIDENCE_THRESHOLD && confidenceLevel === 'LOW') {
    // Check for conflicting sensor signals
    const hasConflictingSignals = detectConflictingSignals(finding, trace);
    
    if (hasConflictingSignals) {
      return {
        shouldDrop: true,
        reason: 'ambiguous_finding',
        message: `Low confidence finding (score: ${confidenceScore}, level: ${confidenceLevel}) with conflicting sensor signals - dropped for safety`
      };
    }
  }
  
  // INVARIANT 8: Contradictory signals check
  const hasContradiction = detectContradictorySignals(finding);
  if (hasContradiction) {
    return {
      shouldDrop: true,
      reason: 'contradictory_signals',
      message: 'Finding has contradictory signals (e.g., HIGH impact but LOW confidence with no evidence)'
    };
  }
  
  // All invariants passed
  return {
    shouldDrop: false,
    reason: null
  };
}

/**
 * Detect conflicting sensor signals (ambiguity indicator)
 * Returns true if signals conflict (ambiguous finding)
 */
function detectConflictingSignals(finding, trace) {
  const sensors = trace?.sensors || {};
  const evidence = finding.evidence || {};
  const confidenceScore = finding.confidence?.score || 0;
  
  // Only check conflicts for low-confidence findings (high confidence findings are trusted)
  if (confidenceScore >= AMBIGUITY_CONFIDENCE_THRESHOLD) {
    return false;
  }
  
  // Conflict: Network success but no UI change (partial success)
  // This is actually a valid finding type - not a conflict
  if (finding.type === 'partial_success_silent_failure') {
    return false; // Explicitly allowed finding type
  }
  
  // Conflict: High impact but insufficient evidence for low confidence
  if (finding.signals?.impact === 'HIGH') {
    const hasSensorActivity = (
      (sensors.network?.totalRequests || 0) > 0 ||
      (sensors.console?.errors?.length || 0) > 0 ||
      sensors.uiSignals?.diff?.changed === true ||
      sensors.focus ||
      sensors.aria ||
      sensors.timing ||
      sensors.loading
    );
    
    // For HIGH impact + LOW confidence, need strong evidence (not just beforeUrl)
    const hasStrongEvidence = (
      evidence.afterUrl ||
      evidence.beforeScreenshot ||
      evidence.afterScreenshot ||
      (evidence.networkRequests || 0) > 0 ||
      evidence.urlChanged === false || // Explicitly checked
      evidence.domChanged === false ||
      evidence.uiChanged === false
    );
    
    // If only beforeUrl exists without sensor activity or strong evidence, it's ambiguous for HIGH impact
    if (!hasSensorActivity && !hasStrongEvidence && evidence.beforeUrl) {
      // HIGH impact with only beforeUrl (weak evidence) and no sensor activity is ambiguous
      return true;
    }
    
    // No evidence at all
    if (!hasSensorActivity && !hasStrongEvidence && !evidence.beforeUrl) {
      return true;
    }
  }
  
  // Conflict: BLOCKS userRisk but no blocking evidence
  if (finding.signals?.userRisk === 'BLOCKS') {
    const hasBlockingEvidence = (
      finding.type?.includes('navigation') ||
      finding.type?.includes('auth') ||
      finding.type?.includes('loading_stuck') ||
      finding.type?.includes('freeze_like') ||
      finding.type === 'observed_break' ||
      (sensors.network?.totalRequests || 0) > 0 ||
      evidence.urlChanged === false || // Explicitly checked and failed
      (evidence.networkRequests || 0) > 0 ||
      evidence.afterUrl // Navigation happened
    );
    
    // BLOCKS requires blocking-type evidence, not just beforeUrl
    if (!hasBlockingEvidence) {
      // BLOCKS claim without blocking evidence - ambiguous
      return true;
    }
  }
  
  // Conflict: BACKEND ownership but no network evidence
  if (finding.signals?.ownership === 'BACKEND' && confidenceScore < AMBIGUITY_CONFIDENCE_THRESHOLD) {
    const hasNetworkEvidence = (
      sensors.network?.totalRequests > 0 ||
      evidence.networkRequests > 0 ||
      finding.type?.includes('network') ||
      finding.type?.includes('auth')
    );
    
    if (!hasNetworkEvidence) {
      // BACKEND ownership without network evidence - ambiguous
      return true;
    }
  }
  
  return false;
}

/**
 * Detect contradictory signals within finding itself
 */
function detectContradictorySignals(finding) {
  const evidence = finding.evidence || {};
  
  // Contradiction: HIGH impact but LOW confidence with weak evidence
  if (finding.signals?.impact === 'HIGH' && finding.confidence?.level === 'LOW') {
    // For HIGH impact + LOW confidence, need strong evidence (multiple pieces or actionable evidence)
    const hasStrongEvidence = (
      (evidence.afterUrl && evidence.beforeUrl) || // Navigation occurred
      (evidence.beforeScreenshot && evidence.afterScreenshot) || // Both screenshots
      (evidence.networkRequests || 0) > 0 ||
      evidence.urlChanged === false || // Explicitly checked
      evidence.domChanged === false ||
      evidence.uiChanged === false
    );
    
    // Only beforeUrl alone is weak evidence for HIGH impact
    if (!hasStrongEvidence) {
      // HIGH impact + LOW confidence + weak evidence = contradiction
      return true;
    }
  }
  
  // Contradiction: BACKEND ownership but no network evidence
  if (finding.signals?.ownership === 'BACKEND') {
    const hasNetworkEvidence = (
      (evidence.networkRequests || 0) > 0 ||
      finding.type?.includes('network') ||
      finding.type?.includes('auth')
    );
    
    if (!hasNetworkEvidence) {
      // BACKEND ownership without network evidence
      return true;
    }
  }
  
  // Contradiction: PERFORMANCE ownership but no timing/loading evidence
  if (finding.signals?.ownership === 'PERFORMANCE') {
    const hasPerformanceEvidence = (
      finding.type?.includes('loading') ||
      finding.type?.includes('freeze') ||
      finding.type?.includes('feedback_gap') ||
      finding.evidence?.timingBreakdown
    );
    
    if (!hasPerformanceEvidence) {
      // PERFORMANCE ownership without performance evidence
      return true;
    }
  }
  
  return false;
}

/**
 * Validate finding structure (non-destructive check)
 * Returns validation result without modifying finding
 */
export function validateFindingStructure(finding) {
  const errors = [];
  
  if (!finding.type) {
    errors.push('Missing type field');
  }
  
  if (!finding.evidence) {
    errors.push('Missing evidence object');
  }
  
  if (!finding.confidence) {
    errors.push('Missing confidence object');
  }
  
  if (!finding.signals) {
    errors.push('Missing signals object');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}



