import { determineExpectationStrength, getBaseScoreFromExpectationStrength } from './expectation-strength.js';
import { hasNetworkData, hasConsoleData, hasUiData } from './sensor-presence.js';
import { extractEvidenceSignals } from './evidence-signals.js';
import { generateExplanations, generateConfidenceExplanation } from './finalize.js';
import { scoreByFindingType } from './scoring/index.js';

// Base scores by finding type
// These are the default starting points before boosts/penalties are applied
const BASE_SCORES = {
  network_silent_failure: 70,
  validation_silent_failure: 60,
  missing_feedback_failure: 55,
  no_effect_silent_failure: 50,
  missing_network_action: 65,
  missing_state_action: 60,
  navigation_silent_failure: 75,
  partial_navigation_failure: 65,
  flow_silent_failure: 70,
  observed_break: 50
};

// Confidence level thresholds (CORE #3 — Determinism principle)
// These gates are based on VERAX's requirement for deterministic, evidence-backed confidence
const CONFIDENCE_THRESHOLDS = {
  HIGH_THRESHOLD: 80,
  MEDIUM_THRESHOLD: 55,
  SCORE_MIN: 0,
  SCORE_MAX: 100
};

// OBSERVED expectation strength caps (post-score adjustments)
// These enforce CORE #4 (Promise-Extraction) by downgrading confidence when expectations are only observed, not proven
const OBSERVED_STRENGTH_CAPS = {
  // Non-repeated observations cap to LOW (49)
  NON_REPEATED_LOW_CAP: 49,
  // HIGH level with OBSERVED strength downgrades to MEDIUM (79)
  HIGH_TO_MEDIUM_CAP: 79
};

// Missing-sensor penalty (enforces CORE #2 — Evidence Law)
const MISSING_SENSOR_PENALTY = 25;

// Expectation-strength mismatch penalty (enforces CORE #5 — No-Guessing)
const NON_PROVEN_PENALTY = 10;

/**
 * @param {any} params
 */
export function computeConfidence(params = {}) {
  const { findingType, expectation, sensors = {}, comparisons = {}, attemptMeta = {} } = params;
  const boosts = [];
  const penalties = [];

  const networkSummary = sensors.network || {};
  const consoleSummary = sensors.console || {};
  const uiSignals = sensors.uiSignals || {};

  const expectationStrength = determineExpectationStrength(expectation);

  let baseScore = BASE_SCORES[findingType] || 50;
  const strengthBasedScore = getBaseScoreFromExpectationStrength(expectationStrength);
  if (strengthBasedScore > 0) {
    baseScore = strengthBasedScore;
  }

  const evidenceSignals = extractEvidenceSignals({
    networkSummary,
    consoleSummary,
    uiSignals,
    comparisons
  });

  const sensorObjectsProvided = {
    network: sensors.network !== undefined,
    console: sensors.console !== undefined,
    ui: sensors.uiSignals !== undefined
  };

  const sensorsWithData = {
    network: hasNetworkData(networkSummary),
    console: hasConsoleData(consoleSummary),
    ui: hasUiData(uiSignals)
  };

  const allSensorObjectsProvided = sensorObjectsProvided.network && sensorObjectsProvided.console && sensorObjectsProvided.ui;
  const allSensorsWithData = sensorsWithData.network && sensorsWithData.console && sensorsWithData.ui;

  const { totalBoosts, totalPenalties } = scoreByFindingType({
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

  let cumulativeBoosts = totalBoosts;
  let cumulativePenalties = totalPenalties;

  // CORE #2 (Evidence Law): Enforce that complete sensor data is available
  // Missing sensors significantly reduce confidence (cannot verify observation without data)
  if (!allSensorObjectsProvided) {
    const missingSensors = [];
    if (!sensorObjectsProvided.network) missingSensors.push('network');
    if (!sensorObjectsProvided.console) missingSensors.push('console');
    if (!sensorObjectsProvided.ui) missingSensors.push('ui');

    cumulativePenalties += MISSING_SENSOR_PENALTY;
    penalties.push(`Missing sensor data: ${missingSensors.join(', ')}`);
  }

  // CORE #5 (No-Guessing): Reduce confidence if expectation is not PROVEN from code
  // PROVEN expectations come from static analysis (AST, explicit code promises)
  // OBSERVED/WEAK expectations lack proof and are treated with skepticism
  if (expectationStrength !== 'PROVEN') {
    cumulativePenalties += NON_PROVEN_PENALTY;
    penalties.push(`Expectation strength is ${expectationStrength}, not PROVEN`);
  }

  let score = baseScore + cumulativeBoosts - cumulativePenalties;
  // Clamp score to valid range (CORE #3 — Determinism: all outputs are bounded and deterministic)
  score = Math.max(CONFIDENCE_THRESHOLDS.SCORE_MIN, Math.min(CONFIDENCE_THRESHOLDS.SCORE_MAX, score));

  let level = 'LOW';
  let boundaryExplanation = null;

  // HIGH level gate (CORE #2 Evidence Law + CORE #4 Promise-Extraction)
  // HIGH confidence requires:
  //   1. Score >= 80 (numeric evidence strength)
  //   2. Expectation PROVEN from code (not guessed/inferred)
  //   3. ALL sensors have data (complete observation)
  // Without all three, confidence is capped at MEDIUM even with high numeric score
  if (score >= CONFIDENCE_THRESHOLDS.HIGH_THRESHOLD) {
    if (expectationStrength === 'PROVEN' && allSensorsWithData) {
      level = 'HIGH';
      if (score < 82) {
        boundaryExplanation = `Near threshold: score ${score.toFixed(1)} >= ${CONFIDENCE_THRESHOLDS.HIGH_THRESHOLD} threshold, assigned HIGH (proven expectation + all sensors)`;
      }
    } else {
      // Score is high numerically, but gating rules prevent HIGH confidence
      level = 'MEDIUM';
      // When all sensors were provided, cap score at 79 (just below HIGH threshold)
      // This prevents borderline MEDIUM from appearing numerically close to HIGH
      if (allSensorObjectsProvided) {
        score = Math.min(score, 79);
      }
      // When no sensors have data, enforce a minimum score of 76
      // This maintains score separation between different confidence states
      const anySensorWithData = sensorsWithData.network || sensorsWithData.console || sensorsWithData.ui;
      if (!anySensorWithData) {
        score = Math.max(score, 76);
      }

      if (expectationStrength !== 'PROVEN') {
        boundaryExplanation = `Assigned MEDIUM: score ${score.toFixed(1)} >= ${CONFIDENCE_THRESHOLDS.HIGH_THRESHOLD} but expectation not proven`;
      } else if (!allSensorsWithData) {
        boundaryExplanation = `Assigned MEDIUM: score ${score.toFixed(1)} >= ${CONFIDENCE_THRESHOLDS.HIGH_THRESHOLD} but sensors lack data`;
      }
    }
  } else if (score >= CONFIDENCE_THRESHOLDS.MEDIUM_THRESHOLD) {
    // MEDIUM threshold: score is strong enough to suggest potential failure
    level = 'MEDIUM';

    if (score < 57) {
      boundaryExplanation = `Near threshold: score ${score.toFixed(1)} >= ${CONFIDENCE_THRESHOLDS.MEDIUM_THRESHOLD} threshold, assigned MEDIUM (above LOW boundary)`;
    } else if (score > 77) {
      boundaryExplanation = `Near threshold: score ${score.toFixed(1)} < ${CONFIDENCE_THRESHOLDS.HIGH_THRESHOLD} threshold, kept MEDIUM (below HIGH boundary)`;
    }
  } else {
    // LOW threshold: score below 55 indicates insufficient evidence
    level = 'LOW';

    if (score > 52) {
      boundaryExplanation = `Near threshold: score ${score.toFixed(1)} < ${CONFIDENCE_THRESHOLDS.MEDIUM_THRESHOLD} threshold, kept LOW (below MEDIUM boundary)`;
    }
  }

  const explain = generateExplanations(boosts, penalties, expectationStrength);

  // CORE #4 (Promise-Extraction): Apply strict rules for OBSERVED expectations
  // OBSERVED expectations lack proof from code analysis; they are single-observation inferences
  // Rules:
  //   - Non-repeated observations: downgrade to LOW and cap score (cannot verify one-off observations)
  //   - Repeated observations in HIGH: downgrade to MEDIUM (repeated observation is more trustworthy but not proven)
  if (expectationStrength === 'OBSERVED') {
    if (!attemptMeta?.repeated) {
      // Single, non-repeated OBSERVED finding → force LOW confidence (risk of false positive)
      level = 'LOW';
      score = Math.min(score, OBSERVED_STRENGTH_CAPS.NON_REPEATED_LOW_CAP);
    } else if (level === 'HIGH') {
      // Repeated OBSERVED finding with high score → allow MEDIUM but not HIGH
      // Repetition adds credibility but is not proof (CORE #4)
      level = 'MEDIUM';
      score = Math.min(score, OBSERVED_STRENGTH_CAPS.HIGH_TO_MEDIUM_CAP);
    }
  }

  // Truncate explanations to top 8 items for readability
  // All logic is preserved; only display is limited
  const finalExplain = explain.slice(0, 8);

  const confidenceExplanation = generateConfidenceExplanation({
    level,
    score: Math.round(score),
    expectationStrength,
    sensorsWithData,
    allSensorsWithData,
    evidenceSignals,
    boosts,
    penalties,
    attemptMeta,
    boundaryExplanation
  });

  return {
    score: Math.round(score),
    level,
    explain: finalExplain,
    factors: {
      expectationStrength,
      sensorsPresent: sensorsWithData,
      evidenceSignals,
      penalties,
      boosts
    },
    confidenceExplanation,
    boundaryExplanation
  };
}

export { hasNetworkData, hasConsoleData, hasUiData };
