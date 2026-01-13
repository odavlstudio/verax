/**
 * WAVE 4: CONFIDENCE ENGINE (PRODUCTION GRADE)
 * 
 * Deterministic, evidence-based scoring for findings.
 * Output: { score, level, explain, factors }
 * 
 * MANDATORY RULES:
 * 1. Same inputs always produce same score and explanations
 * 2. HIGH level requires PROVEN expectation AND sensors present WITH DATA
 * 3. All scores clamped to [0, 100]
 * 4. Explanations ordered by importance, max 8 items
 * 
 * PHASE 3: EVIDENCE INTEGRITY
 * - Sensors must contain NON-TRIVIAL data to count as "present"
 * - Empty/placeholder sensor data does NOT count
 * - Sensor failures tracked as silence events
 */

/**
 * Check if network sensor contains non-trivial data.
 * STRICT: Must have actual network activity captured.
 */
function hasNetworkData(networkSummary) {
  if (!networkSummary || typeof networkSummary !== 'object') return false;
  
  // Check for any actual network activity
  const hasRequests = (networkSummary.totalRequests || 0) > 0;
  const hasFailures = (networkSummary.failedRequests || 0) > 0;
  const hasSlow = (networkSummary.slowRequests || 0) > 0;
  const hasFailedUrls = Array.isArray(networkSummary.topFailedUrls) && networkSummary.topFailedUrls.length > 0;
  const hasSlowUrls = Array.isArray(networkSummary.topSlowUrls) && networkSummary.topSlowUrls.length > 0;
  
  return hasRequests || hasFailures || hasSlow || hasFailedUrls || hasSlowUrls;
}

/**
 * Check if console sensor contains non-trivial data.
 * STRICT: Must have actual console messages captured.
 */
function hasConsoleData(consoleSummary) {
  if (!consoleSummary || typeof consoleSummary !== 'object') return false;
  
  // Check for any actual console activity
  const hasMessages = (consoleSummary.totalMessages || 0) > 0;
  const hasErrors = (consoleSummary.errors || 0) > 0;
  const hasWarnings = (consoleSummary.warnings || 0) > 0;
  const hasEntries = Array.isArray(consoleSummary.entries) && consoleSummary.entries.length > 0;
  
  return hasMessages || hasErrors || hasWarnings || hasEntries;
}

/**
 * Check if UI sensor contains non-trivial data.
 * STRICT: Must have meaningful UI changes captured.
 */
function hasUiData(uiSignals) {
  if (!uiSignals || typeof uiSignals !== 'object') return false;
  
  // Check diff object if it exists
  const diff = uiSignals.diff || uiSignals;
  
  // Check for any meaningful UI changes
  const hasAnyDelta = diff.hasAnyDelta === true || diff.changed === true;
  const hasDomChange = diff.domChanged === true;
  const hasVisibleChange = diff.visibleChanged === true;
  const hasAriaChange = diff.ariaChanged === true;
  const hasFocusChange = diff.focusChanged === true;
  const hasTextChange = diff.textChanged === true;
  
  return hasAnyDelta || hasDomChange || hasVisibleChange || hasAriaChange || hasFocusChange || hasTextChange;
}

const BASE_SCORES = {
  network_silent_failure: 70,
  validation_silent_failure: 60, // VALIDATION INTELLIGENCE v1
  missing_feedback_failure: 55,
  no_effect_silent_failure: 50,
  missing_network_action: 65,
  missing_state_action: 60,
  navigation_silent_failure: 75, // NAVIGATION INTELLIGENCE v2
  partial_navigation_failure: 65, // NAVIGATION INTELLIGENCE v2
  flow_silent_failure: 70, // FLOW INTELLIGENCE v1
  observed_break: 50 // OBSERVED expectations (runtime-derived, lower confidence)
};

/**
 * Get base score from expectation strength.
 */
function getBaseScoreFromExpectationStrength(expectationStrength) {
  if (expectationStrength === 'PROVEN') {
    return 70;
  }
  if (expectationStrength === 'OBSERVED') {
    return 55;
  }
  if (expectationStrength === 'WEAK') {
    return 50;
  }
  return 0; // UNKNOWN
}

/**
 * Main confidence computation function.
 * @param {Object} params - { findingType, expectation, sensors, comparisons, attemptMeta }
 * @returns {Object} - { score, level, explain, factors }
 */
export function computeConfidence({ findingType, expectation, sensors = {}, comparisons = {}, attemptMeta = {} }) {
  const boosts = [];
  const penalties = [];
  
  // Extract sensor data (with defaults for missing sensors)
  const networkSummary = sensors.network || {};
  const consoleSummary = sensors.console || {};
  const uiSignals = sensors.uiSignals || {};
  
  // === STEP 1: DETERMINE EXPECTATION STRENGTH ===
  const expectationStrength = determineExpectationStrength(expectation);
  
  // === STEP 1B: SET BASE SCORE FROM EXPECTATION STRENGTH ===
  let baseScore = BASE_SCORES[findingType] || 50;
  // Override with expectation-strength-based score if available
  const strengthBasedScore = getBaseScoreFromExpectationStrength(expectationStrength);
  if (strengthBasedScore > 0) {
    baseScore = strengthBasedScore;
  }
  
  // === STEP 2: EXTRACT EVIDENCE SIGNALS ===
  const evidenceSignals = extractEvidenceSignals({
    networkSummary,
    consoleSummary,
    uiSignals,
    comparisons
  });
  
  // === STEP 3: SENSOR PRESENCE CHECK (STRICT - must contain data) ===
  // PHASE 3: Sensors only count as "present" if they contain non-trivial data
  const sensorsPresent = {
    network: hasNetworkData(networkSummary),
    console: hasConsoleData(consoleSummary),
    ui: hasUiData(uiSignals)
  };
  
  const allSensorsPresent = sensorsPresent.network && sensorsPresent.console && sensorsPresent.ui;
  
  // === STEP 4: COMPUTE BOOSTS AND PENALTIES (TYPE-SPECIFIC) ===
  let totalBoosts = 0;
  let totalPenalties = 0;
  
  const typeResults = scoreByFindingType({
    findingType,
    expectation,
    expectationStrength,
    networkSummary,
    consoleSummary,
    uiSignals,
    evidenceSignals,
    comparisons,
    attemptMeta,
    boosts,
    penalties
  });
  
  totalBoosts = typeResults.totalBoosts;
  totalPenalties = typeResults.totalPenalties;
  
  // === STEP 5: APPLY GLOBAL PENALTIES ===
  
  // -15 if sensors missing (can't trust silent failure claim without sensors)
  if (!allSensorsPresent) {
    const missingSensors = [];
    if (!sensorsPresent.network) missingSensors.push('network');
    if (!sensorsPresent.console) missingSensors.push('console');
    if (!sensorsPresent.ui) missingSensors.push('ui');
    
    const penalty = 15;
    totalPenalties += penalty;
    penalties.push(`Missing sensor data: ${missingSensors.join(', ')}`);
  }
  
  // -10 if expectation not proven
  if (expectationStrength !== 'PROVEN') {
    totalPenalties += 10;
    penalties.push(`Expectation strength is ${expectationStrength}, not PROVEN`);
  }
  
  // === STEP 6: COMPUTE FINAL SCORE ===
  let score = baseScore + totalBoosts - totalPenalties;
  score = Math.max(0, Math.min(100, score)); // Clamp to [0, 100]
  
  // === STEP 7: DETERMINE LEVEL WITH HARD RULES ===
  let level = 'LOW';
  let boundaryExplanation = null; // Phase 3: Track near-threshold decisions
  
  if (score >= 80) {
    // HARD RULE: HIGH level requires PROVEN expectation AND all sensors present
    if (expectationStrength === 'PROVEN' && allSensorsPresent) {
      level = 'HIGH';
      
      // Phase 3: Near-threshold detection (within 2 points of boundary)
      if (score < 82) {
        boundaryExplanation = `Near threshold: score ${score.toFixed(1)} >= 80 threshold, assigned HIGH (proven expectation + all sensors)`;
      }
    } else {
      // Cap at MEDIUM if missing evidence
      level = 'MEDIUM';
      score = Math.min(score, 79);
      
      // Phase 3: Boundary explanation for capped score
      boundaryExplanation = `Capped at MEDIUM: score would be ${(baseScore + totalBoosts - totalPenalties).toFixed(1)} but ${expectationStrength !== 'PROVEN' ? 'expectation not proven' : 'sensors missing'}, kept score <= 79`;
    }
  } else if (score >= 55) {
    level = 'MEDIUM';
    
    // Phase 3: Near-threshold detection
    if (score < 57) {
      boundaryExplanation = `Near threshold: score ${score.toFixed(1)} >= 55 threshold, assigned MEDIUM (above LOW boundary)`;
    } else if (score > 77) {
      boundaryExplanation = `Near threshold: score ${score.toFixed(1)} < 80 threshold, kept MEDIUM (below HIGH boundary)`;
    }
  } else {
    level = 'LOW';
    
    // Phase 3: Near-threshold detection
    if (score > 52) {
      boundaryExplanation = `Near threshold: score ${score.toFixed(1)} < 55 threshold, kept LOW (below MEDIUM boundary)`;
    }
  }
  
  // === STEP 8: GENERATE EXPLANATIONS (ORDERED BY IMPORTANCE) ===
  const explain = generateExplanations(boosts, penalties, expectationStrength, evidenceSignals);

  // OBSERVED expectations are conservatively capped
  if (expectationStrength === 'OBSERVED') {
    if (!attemptMeta?.repeated) {
      level = 'LOW';
      score = Math.min(score, 49);
    } else if (level === 'HIGH') {
      level = 'MEDIUM';
      score = Math.min(score, 79);
    }
  }
  
  // === STEP 9: ASSEMBLE FINAL OUTPUT ===
  const finalExplain = explain.slice(0, 8); // Max 8 reasons
  
  // === STEP 10: GENERATE CONFIDENCE EXPLANATIONS (PHASE 9) ===
  const confidenceExplanation = generateConfidenceExplanation({
    level,
    score: Math.round(score),
    expectationStrength,
    sensorsPresent,
    allSensorsPresent,
    evidenceSignals,
    boosts,
    penalties,
    attemptMeta,
    boundaryExplanation // Phase 3: Include boundary reasoning
  });
  
  return {
    score: Math.round(score),
    level,
    explain: finalExplain,
    factors: {
      expectationStrength,
      sensorsPresent,
      evidenceSignals,
      penalties,
      boosts
    },
    confidenceExplanation,
    boundaryExplanation // Phase 3: Surface boundary reasoning in output
  };
}

/**
 * Determine expectation strength from proof metadata.
 */
function determineExpectationStrength(expectation = {}) {
  if (!expectation || Object.keys(expectation).length === 0) {
    return 'UNKNOWN';
  }

  if (expectation.expectationStrength === 'OBSERVED') {
    return 'OBSERVED';
  }
  
  // If expectation has PROVEN_EXPECTATION marker, it's proven
  if (expectation.proof === 'PROVEN_EXPECTATION') {
    return 'PROVEN';
  }
  
  // If it has explicit source reference (AST analysis, TS cross-file, etc.), it's proven
  if (expectation.explicit === true || expectation.sourceRef) {
    return 'PROVEN';
  }
  
  // Static expectations from HTML parsing are considered PROVEN if they have evidence
  if (expectation.evidence && expectation.evidence.source) {
    return 'PROVEN';
  }
  
  // If it has some metadata but not proven, it's weak
  return 'WEAK';
}

/**
 * Extract deterministic evidence signals from runtime data.
 */
function extractEvidenceSignals({ networkSummary, consoleSummary, uiSignals, comparisons }) {
  const signals = {
    urlChanged: comparisons?.hasUrlChange === true,
    domChanged: comparisons?.hasDomChange === true,
    screenshotChanged: comparisons?.hasVisibleChange === true,
    networkFailed: (networkSummary?.failedRequests || 0) > 0,
    consoleErrors: (consoleSummary?.hasErrors === true),
    uiFeedbackDetected: hasAnyFeedback(uiSignals),
    slowRequests: (networkSummary?.slowRequestsCount || 0) > 0
  };
  
  return signals;
}

/**
 * Check if any UI feedback is present (error, loading, status, etc.).
 */
function hasAnyFeedback(uiSignals = {}) {
  const before = uiSignals.before || {};
  const after = uiSignals.after || {};
  
  return (
    before.hasErrorSignal || after.hasErrorSignal ||
    before.hasLoadingIndicator || after.hasLoadingIndicator ||
    before.hasStatusSignal || after.hasStatusSignal ||
    before.hasLiveRegion || after.hasLiveRegion ||
    before.hasDialog || after.hasDialog ||
    (before.disabledElements?.length || 0) > 0 ||
    (after.disabledElements?.length || 0) > 0
  );
}

/**
 * Type-specific scoring dispatch.
 */
function scoreByFindingType({
  findingType,
  expectation,
  expectationStrength,
  networkSummary,
  consoleSummary,
  uiSignals: _uiSignals,
  evidenceSignals,
  comparisons: _comparisons,
  attemptMeta: _attemptMeta,
  boosts,
  penalties
}) {
  let totalBoosts = 0;
  let totalPenalties = 0;
  
  switch (findingType) {
    case 'network_silent_failure':
      totalBoosts = scoreNetworkSilentFailure({
        networkSummary,
        consoleSummary,
        evidenceSignals,
        boosts,
        penalties
      });
      totalPenalties = penalizeNetworkSilentFailure({
        evidenceSignals,
        penalties
      });
      break;
      
    case 'validation_silent_failure':
      totalBoosts = scoreValidationSilentFailure({
        networkSummary,
        consoleSummary,
        evidenceSignals,
        boosts,
        penalties
      });
      totalPenalties = penalizeValidationSilentFailure({
        evidenceSignals,
        penalties
      });
      break;
      
    case 'missing_feedback_failure':
      totalBoosts = scoreMissingFeedbackFailure({
        networkSummary,
        evidenceSignals,
        boosts,
        penalties
      });
      totalPenalties = penalizeMissingFeedbackFailure({
        evidenceSignals,
        penalties
      });
      break;
      
    case 'no_effect_silent_failure':
      totalBoosts = scoreNoEffectSilentFailure({
        expectation,
        evidenceSignals,
        boosts,
        penalties
      });
      totalPenalties = penalizeNoEffectSilentFailure({
        evidenceSignals,
        penalties
      });
      break;
      
    case 'missing_network_action':
      totalBoosts = scoreMissingNetworkAction({
        expectation,
        expectationStrength,
        evidenceSignals,
        boosts,
        penalties
      });
      totalPenalties = penalizeMissingNetworkAction({
        evidenceSignals,
        penalties
      });
      break;
      
    case 'missing_state_action':
      totalBoosts = scoreMissingStateAction({
        expectation,
        expectationStrength,
        evidenceSignals,
        boosts,
        penalties
      });
      totalPenalties = penalizeMissingStateAction({
        evidenceSignals,
        penalties
      });
      break;
      
    case 'navigation_silent_failure':
      totalBoosts = scoreNavigationSilentFailure({
        expectation,
        expectationStrength,
        evidenceSignals,
        boosts,
        penalties
      });
      totalPenalties = penalizeNavigationSilentFailure({
        evidenceSignals,
        penalties
      });
      break;
      
    case 'partial_navigation_failure':
      totalBoosts = scorePartialNavigationFailure({
        expectation,
        expectationStrength,
        evidenceSignals,
        boosts,
        penalties
      });
      totalPenalties = penalizePartialNavigationFailure({
        evidenceSignals,
        penalties
      });
      break;
  }
  
  return { totalBoosts, totalPenalties };
}

// ============================================================
// TYPE-SPECIFIC SCORING FUNCTIONS
// ============================================================

function scoreNetworkSilentFailure({ networkSummary: _networkSummary, consoleSummary: _consoleSummary, evidenceSignals, boosts, penalties: _penalties }) {
  let total = 0;
  
  // +10 if network failed
  if (evidenceSignals.networkFailed) {
    total += 10;
    boosts.push('Network request failed');
  }
  
  // +8 if console errors
  if (evidenceSignals.consoleErrors) {
    total += 8;
    boosts.push('Console errors present');
  }
  
  // +6 if network failed AND no UI feedback
  if (evidenceSignals.networkFailed && !evidenceSignals.uiFeedbackDetected) {
    total += 6;
    boosts.push('Silent failure: no user feedback on network error');
  }
  
  return total;
}

function penalizeNetworkSilentFailure({ evidenceSignals, penalties }) {
  let total = 0;
  
  // -10 if UI feedback present (shouldn't be silent failure)
  if (evidenceSignals.uiFeedbackDetected) {
    total += 10;
    penalties.push('UI feedback detected (suggests not silent)');
  }
  
  return total;
}

function scoreValidationSilentFailure({ networkSummary: _networkSummary, consoleSummary: _consoleSummary, evidenceSignals, boosts, penalties: _penalties }) {
  let total = 0;
  
  // +10 if console errors (validation errors logged)
  if (evidenceSignals.consoleErrors) {
    total += 10;
    if (boosts) boosts.push('Validation errors in console');
  }
  
  // +8 if no UI feedback with console errors
  if (evidenceSignals.consoleErrors && !evidenceSignals.uiFeedbackDetected) {
    total += 8;
    if (boosts) boosts.push('Silent validation: errors logged but no visible feedback');
  }
  
  return total;
}

function penalizeValidationSilentFailure({ evidenceSignals, penalties }) {
  let total = 0;
  
  // -10 if error feedback visible
  if (evidenceSignals.uiFeedbackDetected) {
    total += 10;
    penalties.push('Error feedback visible (not silent)');
  }
  
  return total;
}

function scoreMissingFeedbackFailure({ networkSummary: _networkSummary, evidenceSignals, boosts, penalties: _penalties }) {
  let total = 0;
  
  // +10 if slow/pending requests
  if (evidenceSignals.slowRequests) {
    total += 10;
    boosts.push('Slow requests detected');
  }
  
  // +8 if network activity without loading feedback
  if (evidenceSignals.networkFailed && !evidenceSignals.uiFeedbackDetected) {
    total += 8;
    boosts.push('Network activity without user feedback');
  }
  
  return total;
}

function penalizeMissingFeedbackFailure({ evidenceSignals, penalties }) {
  let total = 0;
  
  // -10 if loading feedback detected
  if (evidenceSignals.uiFeedbackDetected) {
    total += 10;
    penalties.push('Loading indicator detected');
  }
  
  return total;
}

function scoreNoEffectSilentFailure({ expectation: _expectation, evidenceSignals, boosts, penalties: _penalties }) {
  let total = 0;
  
  // +10 if URL should have changed but didn't
  if (!evidenceSignals.urlChanged) {
    total += 10;
    boosts.push('Expected URL change did not occur');
  }
  
  // +6 if DOM unchanged
  if (!evidenceSignals.domChanged) {
    total += 6;
    boosts.push('DOM state unchanged');
  }
  
  // +5 if screenshot unchanged
  if (!evidenceSignals.screenshotChanged) {
    total += 5;
    boosts.push('No visible changes');
  }
  
  return total;
}

function penalizeNoEffectSilentFailure({ evidenceSignals, penalties }) {
  let total = 0;
  
  // -10 if network activity (might be a real effect)
  if (evidenceSignals.networkFailed) {
    total += 10;
    penalties.push('Network activity detected (potential effect)');
  }
  
  // -8 if UI feedback changed
  if (evidenceSignals.uiFeedbackDetected) {
    total += 8;
    penalties.push('UI feedback changed (potential effect)');
  }
  
  return total;
}

function scoreMissingNetworkAction({ expectation, expectationStrength, evidenceSignals, boosts, penalties: _penalties }) {
  let total = 0;
  
  // +10 if PROVEN expectation
  if (expectationStrength === 'PROVEN') {
    total += 10;
    boosts.push('Code promise verified via AST analysis');
  }
  
  // +8 if zero network activity (strong evidence of missing action)
  if (!evidenceSignals.networkFailed && (expectation?.totalRequests || 0) === 0) {
    total += 8;
    boosts.push('Zero network activity despite code promise');
  }
  
  // +6 if console errors may explain why action didn't fire
  if (evidenceSignals.consoleErrors) {
    total += 6;
    boosts.push('Console errors may have prevented action');
  }
  
  return total;
}

function penalizeMissingNetworkAction({ evidenceSignals, penalties }) {
  let total = 0;
  
  // -15 if there WAS network activity (promise may be fulfilled differently)
  if (evidenceSignals.networkFailed) {
    total += 15;
    penalties.push('Other network requests occurred');
  }
  
  return total;
}

function scoreMissingStateAction({ expectation: _expectation, expectationStrength, evidenceSignals, boosts, penalties: _penalties }) {
  let total = 0;
  
  // +10 if PROVEN expectation
  if (expectationStrength === 'PROVEN') {
    total += 10;
    boosts.push('State mutation proven via cross-file analysis');
  }
  
  // +8 if no DOM changes
  if (!evidenceSignals.domChanged) {
    total += 8;
    boosts.push('DOM unchanged (no state mutation visible)');
  }
  
  return total;
}

function penalizeMissingStateAction({ evidenceSignals, penalties }) {
  let total = 0;
  
  // -10 if network activity (async state update possible)
  if (evidenceSignals.networkFailed) {
    total += 10;
    penalties.push('Network activity (deferred state update possible)');
  }
  
  // -8 if UI feedback
  if (evidenceSignals.uiFeedbackDetected) {
    total += 8;
    penalties.push('UI feedback suggests state managed differently');
  }
  
  return total;
}

// NAVIGATION INTELLIGENCE v2: Navigation failure scoring
function scoreNavigationSilentFailure({ expectation: _expectation, expectationStrength: _expectationStrength, evidenceSignals, boosts, penalties: _penalties }) {
  let total = 0;
  
  // +10 if URL should have changed but didn't
  if (!evidenceSignals.urlChanged) {
    total += 10;
    boosts.push('Expected URL change did not occur');
  }
  
  // +8 if no UI feedback
  if (!evidenceSignals.uiFeedbackDetected) {
    total += 8;
    boosts.push('No user-visible feedback on navigation failure');
  }
  
  // +6 if console errors (navigation errors logged)
  if (evidenceSignals.consoleErrors) {
    total += 6;
    boosts.push('Navigation errors in console');
  }
  
  return total;
}

function penalizeNavigationSilentFailure({ evidenceSignals, penalties }) {
  let total = 0;
  
  // -10 if UI feedback present (shouldn't be silent failure)
  if (evidenceSignals.uiFeedbackDetected) {
    total += 10;
    penalties.push('UI feedback detected (suggests navigation feedback provided)');
  }
  
  // -5 if URL changed (navigation might have succeeded)
  if (evidenceSignals.urlChanged) {
    total += 5;
    penalties.push('URL changed (navigation may have succeeded)');
  }
  
  return total;
}

function scorePartialNavigationFailure({ expectation: _expectation, expectationStrength: _expectationStrength, evidenceSignals, boosts, penalties: _penalties }) {
  let total = 0;
  
  // +10 if history changed but target not reached
  if (evidenceSignals.urlChanged && !evidenceSignals.uiFeedbackDetected) {
    total += 10;
    boosts.push('Navigation started but target not reached');
  }
  
  // +8 if no UI feedback
  if (!evidenceSignals.uiFeedbackDetected) {
    total += 8;
    boosts.push('No user-visible feedback on partial navigation');
  }
  
  return total;
}

function penalizePartialNavigationFailure({ evidenceSignals, penalties }) {
  let total = 0;
  
  // -10 if UI feedback present (shouldn't be partial failure)
  if (evidenceSignals.uiFeedbackDetected) {
    total += 10;
    penalties.push('UI feedback detected (suggests navigation feedback provided)');
  }
  
  return total;
}

// ============================================================
// EXPLANATION GENERATION (ORDERED BY IMPORTANCE)
// ============================================================

function generateExplanations(boosts, penalties, expectationStrength, _evidenceSignals) {
  const explain = [];
  
  // Add penalties first (most important negatives)
  if (penalties.length > 0) {
    explain.push(...penalties);
  }
  
  // Add boosts (evidence in favor)
  if (boosts.length > 0) {
    explain.push(...boosts);
  }
  
  // Add expectation strength note if not proven
  if (expectationStrength !== 'PROVEN') {
    explain.push(`Expectation: ${expectationStrength}`);
  }
  
  // Remove duplicates while preserving order
  const seen = new Set();
  const unique = [];
  for (const item of explain) {
    if (!seen.has(item)) {
      seen.add(item);
      unique.push(item);
    }
  }
  
  return unique;
}

/**
 * Generate confidence explanation for Phase 9: Reality Confidence & Explanation Layer.
 * Provides whyThisConfidence, whatWouldIncreaseConfidence, whatWouldReduceConfidence.
 * Phase 3: Also includes boundaryExplanation for near-threshold decisions.
 */
function generateConfidenceExplanation({
  level,
  score: _score,
  expectationStrength,
  sensorsPresent,
  allSensorsPresent,
  evidenceSignals: _evidenceSignals,
  boosts,
  penalties,
  attemptMeta,
  boundaryExplanation = null // Phase 3: Optional boundary reasoning
}) {
  const whyThisConfidence = [];
  const whatWouldIncreaseConfidence = [];
  const whatWouldReduceConfidence = [];
  
  // Phase 3: If near threshold, include boundary reasoning first
  if (boundaryExplanation) {
    whyThisConfidence.push(boundaryExplanation);
  }
  
  // WHY THIS CONFIDENCE: Explain current level
  if (level === 'HIGH') {
    whyThisConfidence.push('High confidence: expectation is proven and all sensors captured evidence');
    if (expectationStrength === 'PROVEN') {
      whyThisConfidence.push('Expectation is proven from source code');
    }
    if (allSensorsPresent) {
      whyThisConfidence.push('All sensors (network, console, UI) were active');
    }
    if (boosts.length > 0) {
      whyThisConfidence.push(`Strong evidence: ${boosts.length} positive signal(s)`);
    }
  } else if (level === 'MEDIUM') {
    whyThisConfidence.push('Medium confidence: some evidence suggests a failure, but uncertainty remains');
    if (expectationStrength === 'PROVEN') {
      whyThisConfidence.push('Expectation is proven from source code');
    } else {
      whyThisConfidence.push(`Expectation strength: ${expectationStrength} (not proven)`);
    }
    if (!allSensorsPresent) {
      const missing = [];
      if (!sensorsPresent.network) missing.push('network');
      if (!sensorsPresent.console) missing.push('console');
      if (!sensorsPresent.ui) missing.push('UI');
      whyThisConfidence.push(`Missing sensor data: ${missing.join(', ')}`);
    }
    if (penalties.length > 0) {
      whyThisConfidence.push(`Reducing factors: ${penalties.length} uncertainty signal(s)`);
    }
  } else {
    whyThisConfidence.push('Low confidence: limited evidence or expectation not proven');
    if (expectationStrength !== 'PROVEN') {
      whyThisConfidence.push(`Expectation strength: ${expectationStrength} (not proven from code)`);
    }
    if (!allSensorsPresent) {
      whyThisConfidence.push('Some sensors were not active, reducing confidence');
    }
    if (attemptMeta && !attemptMeta.repeated) {
      whyThisConfidence.push('Not repeated (single observation may be unreliable)');
    }
  }
  
  // WHAT WOULD INCREASE CONFIDENCE
  if (level !== 'HIGH') {
    if (expectationStrength !== 'PROVEN') {
      whatWouldIncreaseConfidence.push('Make the expectation proven by adding explicit code that promises the behavior');
    }
    if (!allSensorsPresent) {
      const missing = [];
      if (!sensorsPresent.network) missing.push('network monitoring');
      if (!sensorsPresent.console) missing.push('console error detection');
      if (!sensorsPresent.ui) missing.push('UI change detection');
      whatWouldIncreaseConfidence.push(`Enable missing sensors: ${missing.join(', ')}`);
    }
    if (attemptMeta && !attemptMeta.repeated && level === 'LOW') {
      whatWouldIncreaseConfidence.push('Repeat the interaction multiple times to confirm consistency');
    }
    if (boosts.length === 0) {
      whatWouldIncreaseConfidence.push('Add stronger evidence signals (network requests, console errors, UI changes)');
    }
  }
  
  // WHAT WOULD REDUCE CONFIDENCE
  if (level !== 'LOW') {
    if (expectationStrength === 'PROVEN') {
      whatWouldReduceConfidence.push('If expectation becomes unproven (code changes, expectation removed)');
    }
    if (allSensorsPresent) {
      whatWouldReduceConfidence.push('If sensors become unavailable or disabled');
    }
    if (boosts.length > 0) {
      whatWouldReduceConfidence.push('If positive evidence signals disappear (network succeeds, UI feedback appears)');
    }
  }
  if (penalties.length === 0 && level === 'HIGH') {
    whatWouldReduceConfidence.push('If uncertainty factors appear (URL changes, partial effects, missing data)');
  }
  
  return {
    whyThisConfidence: whyThisConfidence.length > 0 ? whyThisConfidence : ['Confidence based on available evidence'],
    whatWouldIncreaseConfidence: whatWouldIncreaseConfidence.length > 0 ? whatWouldIncreaseConfidence : ['Already at maximum confidence for available evidence'],
    whatWouldReduceConfidence: whatWouldReduceConfidence.length > 0 ? whatWouldReduceConfidence : ['No factors would reduce confidence further']
  };
}

// ============================================================
// LEGACY EXPORTS (FOR BACKWARD COMPATIBILITY)
// ============================================================

// PHASE 3: Export sensor validation functions for testing
export { hasNetworkData, hasConsoleData, hasUiData };

// Detect error feedback (legacy helper)
function _detectErrorFeedback(uiSignals) {
  const before = uiSignals?.before || {};
  const after = uiSignals?.after || {};
  return after.hasErrorSignal && !before.hasErrorSignal;
}

// Detect loading feedback (legacy helper)
function _detectLoadingFeedback(uiSignals) {
  const after = uiSignals?.after || {};
  return after.hasLoadingIndicator;
}

// Detect status feedback (legacy helper)
function _detectStatusFeedback(uiSignals) {
  const after = uiSignals?.after || {};
  return after.hasStatusSignal || after.hasLiveRegion || after.hasDialog;
}
