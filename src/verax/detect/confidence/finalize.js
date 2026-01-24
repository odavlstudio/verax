/**
 * generateExplanations: Collects all reason strings from boosts and penalties
 * 
 * Order: penalties first, then boosts, then non-PROVEN expectation strength
 * (This order matches the "most surprising/reducing factors first" principle)
 * 
 * CORE #5 (No Guessing): Explanations come only from applied rules or explicit condition checks
 * CORE #2 (Evidence Law): Every explanation corresponds to observable evidence
 * 
 * @param {array} boosts - Applied boost reason strings
 * @param {array} penalties - Applied penalty reason strings
 * @param {string} expectationStrength - 'PROVEN', 'INFERRED', or 'OBSERVED'
 * @returns {array} Unique, deduplicated explanation strings in priority order
 */
export function generateExplanations(boosts, penalties, expectationStrength) {
  const explain = [];

  // Penalties (reducing factors) listed first — "what blocks confidence"
  if (penalties.length > 0) {
    explain.push(...penalties);
  }

  // Boosts (supporting factors) listed second — "what supports confidence"
  if (boosts.length > 0) {
    explain.push(...boosts);
  }

  // Non-PROVEN expectations noted last — "what remains uncertain"
  if (expectationStrength !== 'PROVEN') {
    explain.push(`Expectation: ${expectationStrength}`);
  }

  // Deduplicate while preserving order
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
 * generateConfidenceExplanation: Creates 3-layer explanation of confidence level
 * 
 * LAYER 1: whyThisConfidence — Why this specific level was assigned
 *   - Explains gates used (PROVEN check, sensor coverage, score threshold)
 *   - Identifies key evidence (boosts, penalties)
 *   - Notes missing data or unproven expectations
 * 
 * LAYER 2: whatWouldIncreaseConfidence — How to move UP from current level
 *   - Only shown if level < HIGH
 *   - Suggests: proving expectation, enabling sensors, adding evidence
 * 
 * LAYER 3: whatWouldReduceConfidence — How to move DOWN from current level
 *   - Only shown if level > LOW
 *   - Lists factors that would cause downgrade (sensor loss, evidence loss, penalty gain)
 * 
 * CORE #5 (No Guessing): All suggestions based on visible invariants/gates in index.js
 * CORE #4 (Promise-Extraction): "Increase" suggestions come from code promises (PROVEN)
 * 
 * @param {object} config - Explanation configuration
 * @returns {object} { whyThisConfidence, whatWouldIncreaseConfidence, whatWouldReduceConfidence }
 */
export function generateConfidenceExplanation({
  level,
  score: _score,
  expectationStrength,
  sensorsWithData,
  allSensorsWithData,
  evidenceSignals: _evidenceSignals,
  boosts,
  penalties,
  attemptMeta,
  boundaryExplanation = null
}) {
  const whyThisConfidence = [];
  const whatWouldIncreaseConfidence = [];
  const whatWouldReduceConfidence = [];

  // Boundary explanation: why this score crossed a threshold
  if (boundaryExplanation) {
    whyThisConfidence.push(boundaryExplanation);
  }

  // ===== LAYER 1: Why this confidence level =====
  if (level === 'HIGH') {
    whyThisConfidence.push('High confidence: expectation is proven and all sensors captured evidence');
    if (expectationStrength === 'PROVEN') {
      whyThisConfidence.push('Expectation is proven from source code');
    }
    if (allSensorsWithData) {
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
    if (!allSensorsWithData) {
      const missing = [];
      if (!sensorsWithData.network) missing.push('network');
      if (!sensorsWithData.console) missing.push('console');
      if (!sensorsWithData.ui) missing.push('UI');
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
    if (!allSensorsWithData) {
      whyThisConfidence.push('Some sensors were not active, reducing confidence');
    }
    if (attemptMeta && !attemptMeta.repeated) {
      whyThisConfidence.push('Not repeated (single observation may be unreliable)');
    }
  }

  // ===== LAYER 2: What would INCREASE confidence (if level < HIGH) =====
  if (level !== 'HIGH') {
    // Gate 1: PROVEN expectation (CORE #4 - Promise-Extraction)
    if (expectationStrength !== 'PROVEN') {
      whatWouldIncreaseConfidence.push('Make the expectation proven by adding explicit code that promises the behavior');
    }
    // Gate 2: All sensors present (CORE #2 - Evidence Law)
    if (!allSensorsWithData) {
      const missing = [];
      if (!sensorsWithData.network) missing.push('network monitoring');
      if (!sensorsWithData.console) missing.push('console error detection');
      if (!sensorsWithData.ui) missing.push('UI change detection');
      whatWouldIncreaseConfidence.push(`Enable missing sensors: ${missing.join(', ')}`);
    }
    // Repeated observations increase OBSERVED strength
    if (attemptMeta && !attemptMeta.repeated && level === 'LOW') {
      whatWouldIncreaseConfidence.push('Repeat the interaction multiple times to confirm consistency');
    }
    // Strong evidence boosts score
    if (boosts.length === 0) {
      whatWouldIncreaseConfidence.push('Add stronger evidence signals (network requests, console errors, UI changes)');
    }
  }

  // ===== LAYER 3: What would REDUCE confidence (if level > LOW) =====
  if (level !== 'LOW') {
    // Loss of PROVEN expectation
    if (expectationStrength === 'PROVEN') {
      whatWouldReduceConfidence.push('If expectation becomes unproven (code changes, expectation removed)');
    }
    // Loss of sensor coverage
    if (allSensorsWithData) {
      whatWouldReduceConfidence.push('If sensors become unavailable or disabled');
    }
    // Loss of positive signals (boosts)
    if (boosts.length > 0) {
      whatWouldReduceConfidence.push('If positive evidence signals disappear (network succeeds, UI feedback appears)');
    }
  }
  // For HIGH confidence, note the penalty penalties that would drop it
  if (penalties.length === 0 && level === 'HIGH') {
    whatWouldReduceConfidence.push('If uncertainty factors appear (URL changes, partial effects, missing data)');
  }

  return {
    whyThisConfidence: whyThisConfidence.length > 0 ? whyThisConfidence : ['Confidence based on available evidence'],
    whatWouldIncreaseConfidence: whatWouldIncreaseConfidence.length > 0 ? whatWouldIncreaseConfidence : ['Already at maximum confidence for available evidence'],
    whatWouldReduceConfidence: whatWouldReduceConfidence.length > 0 ? whatWouldReduceConfidence : ['No factors would reduce confidence further']
  };
}
