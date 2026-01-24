/**
 * PHASE 25 — Truth-Aware Explanation Helpers
 * 
 * Generates explanation text that integrates:
 * - truthStatus (CONFIRMED/SUSPECTED/INFORMATIONAL/IGNORED)
 * - guardrailsOutcome
 * - evidenceIntent summary
 * - expectation strength
 * - sensor presence
 * 
 * All explanations reflect computed facts only.
 * No heuristic guessing.
 */


/**
 * Generate comprehensive confidence explanation
 * @typedef {Object} GenerateTruthAwareExplanationParams
 * @property {number} [confidenceScore] - Confidence score (0-1 or 0-100)
 * @property {string} [confidenceLevel] - Confidence level
 * @property {string} [truthStatus] - Truth status
 * @property {Object} [expectation] - Expectation data
 * @property {Object} [sensors] - Sensor data
 * @property {Object} [evidence] - Evidence data
 * @property {Object} [guardrailsOutcome] - Guardrails outcome
 * @property {Object} [evidenceIntent] - Evidence intent
 * @property {Array} [appliedInvariants] - Invariants applied
 * @property {Array} [reasonCodes] - Reason codes
 * @param {GenerateTruthAwareExplanationParams} params - Explanation context
 * @returns {Object} { whyThisConfidence: string, whatWouldIncreaseConfidence: string[], whatWouldReduceConfidence: string[] }
 */
export function generateTruthAwareExplanation(params = {}) {
  const {
    confidenceScore = 0,
    truthStatus = 'SUSPECTED',
    expectation = {},
    sensors = {},
    evidence = {},
    guardrailsOutcome = null,
    evidenceIntent = null,
    appliedInvariants = []
  } = params;

  // Normalize score to 0-100 range if needed
  const score = confidenceScore > 1 ? confidenceScore : Math.round(confidenceScore * 100);

  // === WHY THIS CONFIDENCE ===
  const whyParts = [];

  // Truth status explanation
  whyParts.push(getTruthStatusExplanation(truthStatus, score));

  // Expectation strength
  if (expectation.proof) {
    whyParts.push(getExpectationExplanation(expectation.proof));
  }

  // Sensor presence
  const sensorExplanation = getSensorExplanation(sensors);
  if (sensorExplanation) {
    whyParts.push(sensorExplanation);
  }

  // Evidence completeness
  if (evidence.isComplete === false) {
    whyParts.push('Evidence is incomplete, reducing confidence.');
  } else if (evidence.isComplete === true) {
    whyParts.push('Evidence is complete.');
  }

  // Guardrails impact
  if (guardrailsOutcome) {
    const guardrailsExplanation = getGuardrailsExplanation(guardrailsOutcome);
    if (guardrailsExplanation) {
      whyParts.push(guardrailsExplanation);
    }
  }

  // Evidence intent failures
  if (evidenceIntent && evidenceIntent.captureOutcomes) {
    const failureCount = Object.values(evidenceIntent.captureOutcomes)
      .filter(outcome => outcome.captured === false).length;
    if (failureCount > 0) {
      whyParts.push(`${failureCount} evidence capture failure(s) detected.`);
    }
  }

  // Invariant enforcement
  if (appliedInvariants.length > 0) {
    whyParts.push(`${appliedInvariants.length} invariant(s) enforced to ensure correctness.`);
  }

  const whyThisConfidence = whyParts.join(' ');

  // === WHAT WOULD INCREASE CONFIDENCE ===
  const increaseParts = [];

  // Based on truth status
  if (truthStatus === 'SUSPECTED' || truthStatus === 'INFORMATIONAL') {
    increaseParts.push('Upgrade to CONFIRMED status via additional evidence');
  }

  // Based on expectation
  if (expectation.proof !== 'PROVEN_EXPECTATION') {
    increaseParts.push('Achieve PROVEN expectation strength');
  }

  // Based on evidence
  if (evidence.isComplete === false) {
    increaseParts.push('Provide complete evidence package');
  }

  // Based on sensors
  if (!hasSensorData(sensors.network)) {
    increaseParts.push('Provide network sensor data');
  }
  if (!hasSensorData(sensors.console)) {
    increaseParts.push('Provide console sensor data');
  }
  if (!hasSensorData(sensors.uiSignals)) {
    increaseParts.push('Provide UI signal data');
  }

  const whatWouldIncreaseConfidence = increaseParts.length > 0
    ? increaseParts
    : ['Maintain current evidence and sensor quality'];

  // === WHAT WOULD REDUCE CONFIDENCE ===
  const reduceParts = [];

  // Determinism issues
  reduceParts.push('Non-deterministic execution detected');

  // Contradictions
  if (expectation.proof === 'UNPROVEN_EXPECTATION' && guardrailsOutcome?.downgraded) {
    reduceParts.push('Contradiction between expectation strength and guardrails outcome');
  }

  // Evidence loss
  reduceParts.push('Loss of evidence signals or completeness');

  // Guardrails downgrade
  if (guardrailsOutcome?.downgraded) {
    reduceParts.push('Guardrails outcome requesting downgrade');
  }

  const whatWouldReduceConfidence = reduceParts.length > 0
    ? reduceParts
    : ['Determinism violations', 'Evidence loss'];

  return {
    whyThisConfidence,
    whatWouldIncreaseConfidence,
    whatWouldReduceConfidence
  };
}

/**
 * Get explanation text for truth status
 */
function getTruthStatusExplanation(status, score) {
  switch (status) {
    case 'CONFIRMED':
      return `Status is CONFIRMED with ${score}% confidence based on proven evidence.`;
    case 'SUSPECTED':
      return `Status is SUSPECTED with ${score}% confidence; requires additional confirmation.`;
    case 'INFORMATIONAL':
      return `Status is INFORMATIONAL with ${score}% confidence; insufficient for decision-making.`;
    case 'IGNORED':
      return `Status is IGNORED; finding has been ruled out or suppressed.`;
    default:
      return `Status is ${status} with ${score}% confidence.`;
  }
}

/**
 * Get explanation text for expectation proof
 */
function getExpectationExplanation(proof) {
  switch (proof) {
    case 'PROVEN_EXPECTATION':
      return 'Expectation is proven via explicit test or declaration.';
    case 'OBSERVED_EXPECTATION':
      return 'Expectation is observed in sensor data.';
    case 'WEAK_EXPECTATION':
      return 'Expectation is weak or implicit.';
    case 'UNPROVEN_EXPECTATION':
      return 'Expectation is unproven; confidence capped accordingly.';
    default:
      return `Expectation proof: ${proof}.`;
  }
}

/**
 * Get explanation text for sensor presence
 */
function getSensorExplanation(sensors) {
  const parts = [];
  
  if (hasSensorData(sensors.network)) {
    parts.push('network activity');
  }
  if (hasSensorData(sensors.console)) {
    parts.push('console messages');
  }
  if (hasSensorData(sensors.uiSignals)) {
    parts.push('UI signal changes');
  }

  if (parts.length > 0) {
    return `Sensor data present: ${parts.join(', ')}.`;
  }
  
  return 'No sensor data available; confidence limited by absent signals.';
}

/**
 * Get explanation text for guardrails outcome
 */
function getGuardrailsExplanation(guardrailsOutcome) {
  if (!guardrailsOutcome) return null;

  const parts = [];

  if (guardrailsOutcome.downgraded) {
    parts.push(`Guardrails downgraded finding to ${guardrailsOutcome.finalDecision || 'SUSPECTED'}`);
  }

  if (guardrailsOutcome.confidenceDelta && guardrailsOutcome.confidenceDelta !== 0) {
    const direction = guardrailsOutcome.confidenceDelta > 0 ? 'increased' : 'decreased';
    const magnitude = Math.abs(guardrailsOutcome.confidenceDelta);
    parts.push(`Guardrails ${direction} confidence by ${magnitude.toFixed(2)}`);
  }

  return parts.length > 0 ? parts.join('; ') + '.' : null;
}

/**
 * Check if sensor has non-trivial data
 */
function hasSensorData(sensorData) {
  if (!sensorData || typeof sensorData !== 'object') return false;
  
  // Check for non-trivial content
  const hasKeys = Object.keys(sensorData).length > 0;
  const hasValues = Object.values(sensorData).some(v => v !== null && v !== undefined && v !== '');
  
  return hasKeys && hasValues;
}

/**
 * Generate bounded explanation strings (max 8)
 * 
 * @param {Object} explanation - Full explanation object
 * @returns {Array} Bounded array of explanation strings (max 8)
 */
export function boundExplanationStrings(explanation) {
  const strings = [];

  if (explanation.whyThisConfidence) {
    strings.push(explanation.whyThisConfidence);
  }

  if (Array.isArray(explanation.whatWouldIncreaseConfidence)) {
    explanation.whatWouldIncreaseConfidence.forEach((item, idx) => {
      if (idx < 2) { // Max 2 increase items
        strings.push(`To increase: ${item}`);
      }
    });
  }

  if (Array.isArray(explanation.whatWouldReduceConfidence)) {
    explanation.whatWouldReduceConfidence.forEach((item, idx) => {
      if (idx < 2) { // Max 2 reduce items
        strings.push(`To reduce: ${item}`);
      }
    });
  }

  return strings.slice(0, 8); // Max 8 total
}
