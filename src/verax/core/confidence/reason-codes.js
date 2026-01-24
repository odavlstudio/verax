/**
 * PHASE 25 — Reason Codes Generator
 * 
 * Produces deterministic, ordered reason codes derived from:
 * - Expectation strength
 * - Sensor presence/non-triviality
 * - Evidence signals
 * - Guardrails outcomes
 * - Evidence intent failures
 * 
 * Guarantees: Same inputs → Same reason list (order matters)
 */

// eslint-disable-next-line no-unused-vars
import { normalizeSensorState, SENSOR_STATE } from '../../shared/sensors/normalize-sensor-state.js';

/**
 * Canonical reason code categories (ordered by priority)
 */
const REASON_CATEGORIES = {
  CRITICAL: 'CRITICAL',      // 1. Contradiction, unproven expectation
  TRUTH_LOCK: 'TRUTH_LOCK',  // 2. Truth lock violations
  EVIDENCE: 'EVIDENCE',      // 3. Evidence completeness/gaps
  GUARDRAILS: 'GUARDRAILS',  // 4. Guardrails outcomes
  SENSORS: 'SENSORS',        // 5. Sensor presence/absence
  EXPECTATION: 'EXPECTATION' // 6. Expectation strength
};

/**
 * Canonical reason codes (deterministically ordered)
 */
const REASON_CODES = {
  // CRITICAL (1)
  CONTRADICTION_DETECTED: { code: 'CONTRADICTION_DETECTED', category: REASON_CATEGORIES.CRITICAL, priority: 1 },
  UNPROVEN_EXPECTATION: { code: 'UNPROVEN_EXPECTATION', category: REASON_CATEGORIES.CRITICAL, priority: 2 },
  
  // TRUTH_LOCK (2)
  TRUTH_LOCK_APPLIED: { code: 'TRUTH_LOCK_APPLIED', category: REASON_CATEGORIES.TRUTH_LOCK, priority: 10 },
  NON_DETERMINISTIC_CAP: { code: 'NON_DETERMINISTIC_CAP', category: REASON_CATEGORIES.TRUTH_LOCK, priority: 11 },
  EVIDENCE_COMPLETENESS_REQUIRED: { code: 'EVIDENCE_COMPLETENESS_REQUIRED', category: REASON_CATEGORIES.TRUTH_LOCK, priority: 12 },
  
  // EVIDENCE (3)
  INCOMPLETE_EVIDENCE: { code: 'INCOMPLETE_EVIDENCE', category: REASON_CATEGORIES.EVIDENCE, priority: 20 },
  EVIDENCE_INTENT_FAILURES: { code: 'EVIDENCE_INTENT_FAILURES', category: REASON_CATEGORIES.EVIDENCE, priority: 21 },
  EVIDENCE_SIGNALS_PRESENT: { code: 'EVIDENCE_SIGNALS_PRESENT', category: REASON_CATEGORIES.EVIDENCE, priority: 22 },
  
  // GUARDRAILS (4)
  GUARDRAILS_DOWNGRADE: { code: 'GUARDRAILS_DOWNGRADE', category: REASON_CATEGORIES.GUARDRAILS, priority: 30 },
  GUARDRAILS_ADJUSTMENT: { code: 'GUARDRAILS_ADJUSTMENT', category: REASON_CATEGORIES.GUARDRAILS, priority: 31 },
  GUARDRAILS_CONFIDENCE_DELTA: { code: 'GUARDRAILS_CONFIDENCE_DELTA', category: REASON_CATEGORIES.GUARDRAILS, priority: 32 },
  
  // SENSORS (5)
  NETWORK_DATA_PRESENT: { code: 'NETWORK_DATA_PRESENT', category: REASON_CATEGORIES.SENSORS, priority: 40 },
  NETWORK_DATA_ABSENT: { code: 'NETWORK_DATA_ABSENT', category: REASON_CATEGORIES.SENSORS, priority: 41 },
  CONSOLE_DATA_PRESENT: { code: 'CONSOLE_DATA_PRESENT', category: REASON_CATEGORIES.SENSORS, priority: 42 },
  CONSOLE_DATA_ABSENT: { code: 'CONSOLE_DATA_ABSENT', category: REASON_CATEGORIES.SENSORS, priority: 43 },
  UI_SIGNALS_PRESENT: { code: 'UI_SIGNALS_PRESENT', category: REASON_CATEGORIES.SENSORS, priority: 44 },
  UI_SIGNALS_ABSENT: { code: 'UI_SIGNALS_ABSENT', category: REASON_CATEGORIES.SENSORS, priority: 45 },
  
  // EXPECTATION (6)
  EXPECTATION_PROVEN: { code: 'EXPECTATION_PROVEN', category: REASON_CATEGORIES.EXPECTATION, priority: 50 },
  EXPECTATION_OBSERVED: { code: 'EXPECTATION_OBSERVED', category: REASON_CATEGORIES.EXPECTATION, priority: 51 },
  EXPECTATION_WEAK: { code: 'EXPECTATION_WEAK', category: REASON_CATEGORIES.EXPECTATION, priority: 52 }
};

/**
 * Generate canonical, deterministically-ordered reason codes
 * @typedef {Object} GenerateReasonCodesParams
 * @property {Object} [expectation] - Expectation data
 * @property {Object} [sensors] - Sensor data
 * @property {Object} [comparisons] - Comparison data
 * @property {Object} [evidence] - Evidence data
 * @property {Object} [guardrailsOutcome] - Guardrails outcome
 * @property {Object} [evidenceIntent] - Evidence intent
 * @property {Array} [appliedInvariants] - Invariants applied
 * @property {string} [truthStatus] - Truth status
 * @param {GenerateReasonCodesParams} params - Computation context
 * @returns {Array<string>} Ordered reason codes (deterministic, no duplicates)
 */
export function generateReasonCodes(params = {}) {
  const {
    expectation = {},
    sensors = {},
    evidence = {},
    guardrailsOutcome = null,
    evidenceIntent = null,
    appliedInvariants = []
  } = params || {};

  const reasonSet = new Map(); // Use Map to maintain insertion order and prevent duplicates

  // === CRITICAL (Priority 1-9) ===
  
  // Check for contradiction (unproven expectation + guardrails downgrade)
  if (expectation.proof === 'UNPROVEN_EXPECTATION' && guardrailsOutcome?.downgraded) {
    reasonSet.set(REASON_CODES.CONTRADICTION_DETECTED.code, REASON_CODES.CONTRADICTION_DETECTED);
  }
  
  // Unproven expectation
  if (expectation.proof === 'UNPROVEN_EXPECTATION') {
    reasonSet.set(REASON_CODES.UNPROVEN_EXPECTATION.code, REASON_CODES.UNPROVEN_EXPECTATION);
  }

  // === TRUTH_LOCK (Priority 10-19) ===
  
  // Map applied invariants to reason codes
  if (appliedInvariants && appliedInvariants.length > 0) {
    reasonSet.set(REASON_CODES.TRUTH_LOCK_APPLIED.code, REASON_CODES.TRUTH_LOCK_APPLIED);
    
    // Add specific truth lock codes
    for (const invariantCode of appliedInvariants) {
      if (invariantCode.includes('NON_DETERMINISTIC')) {
        reasonSet.set(REASON_CODES.NON_DETERMINISTIC_CAP.code, REASON_CODES.NON_DETERMINISTIC_CAP);
      }
      if (invariantCode.includes('CONFIRMED') || invariantCode.includes('COMPLETENESS')) {
        reasonSet.set(REASON_CODES.EVIDENCE_COMPLETENESS_REQUIRED.code, REASON_CODES.EVIDENCE_COMPLETENESS_REQUIRED);
      }
    }
  }

  // === EVIDENCE (Priority 20-29) ===
  
  // Evidence completeness
  if (evidence.isComplete === false) {
    reasonSet.set(REASON_CODES.INCOMPLETE_EVIDENCE.code, REASON_CODES.INCOMPLETE_EVIDENCE);
  }
  
  // Evidence intent failures
  if (evidenceIntent && evidenceIntent.captureOutcomes) {
    const captureFailures = Object.values(evidenceIntent.captureOutcomes)
      .filter(outcome => outcome.captured === false).length;
    if (captureFailures > 0) {
      reasonSet.set(REASON_CODES.EVIDENCE_INTENT_FAILURES.code, REASON_CODES.EVIDENCE_INTENT_FAILURES);
    }
  }
  
  // Evidence signals
  if (evidence.signals && Object.keys(evidence.signals).length > 0) {
    reasonSet.set(REASON_CODES.EVIDENCE_SIGNALS_PRESENT.code, REASON_CODES.EVIDENCE_SIGNALS_PRESENT);
  }

  // === GUARDRAILS (Priority 30-39) ===
  
  if (guardrailsOutcome) {
    if (guardrailsOutcome.downgraded) {
      reasonSet.set(REASON_CODES.GUARDRAILS_DOWNGRADE.code, REASON_CODES.GUARDRAILS_DOWNGRADE);
    }
    
    if (guardrailsOutcome.confidenceDelta && guardrailsOutcome.confidenceDelta !== 0) {
      reasonSet.set(REASON_CODES.GUARDRAILS_CONFIDENCE_DELTA.code, REASON_CODES.GUARDRAILS_CONFIDENCE_DELTA);
      reasonSet.set(REASON_CODES.GUARDRAILS_ADJUSTMENT.code, REASON_CODES.GUARDRAILS_ADJUSTMENT);
    }
  }

  // === SENSORS (Priority 40-49) ===
  
  // Network sensor
  if (hasNetworkData(sensors.network)) {
    reasonSet.set(REASON_CODES.NETWORK_DATA_PRESENT.code, REASON_CODES.NETWORK_DATA_PRESENT);
  } else if (sensors.network !== undefined && sensors.network !== null) {
    reasonSet.set(REASON_CODES.NETWORK_DATA_ABSENT.code, REASON_CODES.NETWORK_DATA_ABSENT);
  }
  
  // Console sensor
  if (hasConsoleData(sensors.console)) {
    reasonSet.set(REASON_CODES.CONSOLE_DATA_PRESENT.code, REASON_CODES.CONSOLE_DATA_PRESENT);
  } else if (sensors.console !== undefined && sensors.console !== null) {
    reasonSet.set(REASON_CODES.CONSOLE_DATA_ABSENT.code, REASON_CODES.CONSOLE_DATA_ABSENT);
  }
  
  // UI signals
  if (hasUISignals(sensors.uiSignals)) {
    reasonSet.set(REASON_CODES.UI_SIGNALS_PRESENT.code, REASON_CODES.UI_SIGNALS_PRESENT);
  } else if (sensors.uiSignals !== undefined && sensors.uiSignals !== null) {
    reasonSet.set(REASON_CODES.UI_SIGNALS_ABSENT.code, REASON_CODES.UI_SIGNALS_ABSENT);
  }

  // === EXPECTATION (Priority 50-59) ===
  
  if (expectation.proof === 'PROVEN_EXPECTATION') {
    reasonSet.set(REASON_CODES.EXPECTATION_PROVEN.code, REASON_CODES.EXPECTATION_PROVEN);
  } else if (expectation.proof === 'OBSERVED_EXPECTATION') {
    reasonSet.set(REASON_CODES.EXPECTATION_OBSERVED.code, REASON_CODES.EXPECTATION_OBSERVED);
  } else if (expectation.proof === 'WEAK_EXPECTATION') {
    reasonSet.set(REASON_CODES.EXPECTATION_WEAK.code, REASON_CODES.EXPECTATION_WEAK);
  }

  // Sort by priority and return codes
  const sortedReasons = Array.from(reasonSet.values())
    .sort((a, b) => a.priority - b.priority)
    .map(reasonObj => reasonObj.code);

  return sortedReasons;
}

/**
 * Canonical network sensor presence check
 * @private
 */
function detectNetworkData(networkSummary) {
  if (!networkSummary || typeof networkSummary !== 'object') return false;
  const hasRequests = (networkSummary.totalRequests || 0) > 0;
  const hasFailures = (networkSummary.failedRequests || 0) > 0;
  const hasSlow = (networkSummary.slowRequests || 0) > 0;
  return hasRequests || hasFailures || hasSlow;
}

function hasNetworkData(networkSummary) {
  const result = detectNetworkData(networkSummary);
  normalizeSensorState(networkSummary, { hasData: detectNetworkData });
  return result;
}

/**
 * Canonical console sensor presence check
 * @private
 */
function detectConsoleData(consoleSummary) {
  if (!consoleSummary || typeof consoleSummary !== 'object') return false;
  const hasErrors = (consoleSummary.errors || 0) > 0;
  const hasWarnings = (consoleSummary.warnings || 0) > 0;
  const hasLogs = (consoleSummary.logs || 0) > 0;
  return hasErrors || hasWarnings || hasLogs;
}

function hasConsoleData(consoleSummary) {
  const result = detectConsoleData(consoleSummary);
  normalizeSensorState(consoleSummary, { hasData: detectConsoleData });
  return result;
}

/**
 * Canonical UI signals sensor presence check
 * @private
 */
function detectUISignals(uiSignals) {
  if (!uiSignals || typeof uiSignals !== 'object') return false;
  return Object.keys(uiSignals).length > 0;
}

function hasUISignals(uiSignals) {
  const result = detectUISignals(uiSignals);
  normalizeSensorState(uiSignals, { hasData: detectUISignals });
  return result;
}

/**
 * Get canonical reason code metadata
 */
export function getReasonCodeMetadata(code) {
  return Object.values(REASON_CODES).find(reason => reason.code === code) || null;
}

/**
 * Export codes for testing
 */
export { REASON_CODES };
