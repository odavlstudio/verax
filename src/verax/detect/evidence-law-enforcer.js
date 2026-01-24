/**
 * STAGE 4.3: Evidence Law 2.0
 * 
 * Enforces evidence requirements for judgments.
 * 
 * RULES:
 * 1. FAILURE_* requires strong evidence
 * 2. MISLEADING requires strong acknowledgment + contradiction
 * 3. SILENT_FAILURE forbidden if silenceKind is recoverable
 * 
 * VIOLATIONS:
 * - Trigger VIOLATED_EVIDENCE_LAW error
 * - Exit code 50
 * 
 * NO exceptions, NO bypasses.
 */

import { JUDGMENT_TYPES } from './judgment-mapper.js';
import { SILENCE_KINDS as _SILENCE_KINDS, isSilenceRecoverable } from '../../cli/util/observation/silence-classifier.js';
import { ACKNOWLEDGMENT_LEVELS } from '../../cli/util/observation/progressive-acknowledgment.js';

/**
 * Evidence Law Violation Types
 */
export const VIOLATION_TYPES = {
  FAILURE_WITHOUT_STRONG_EVIDENCE: 'FAILURE_WITHOUT_STRONG_EVIDENCE',
  MISLEADING_WITHOUT_CONTRADICTION: 'MISLEADING_WITHOUT_CONTRADICTION',
  SILENT_FAILURE_WITH_RECOVERABLE_SILENCE: 'SILENT_FAILURE_WITH_RECOVERABLE_SILENCE',
  MISSING_REQUIRED_EVIDENCE: 'MISSING_REQUIRED_EVIDENCE',
};

/**
 * Evidence Law Error
 */
export class EvidenceLawViolation extends Error {
  constructor(violationType, message, context = {}) {
    super(message);
    this.name = 'EvidenceLawViolation';
    this.violationType = violationType;
    this.context = context;
    this.exitCode = 50;
  }
}

/**
 * Check if evidence is strong
 * 
 * Strong evidence includes:
 * - Network errors (5xx, timeout, failed)
 * - Console errors
 * - Auth blocks (401, 403)
 * - DOM evidence of failure
 * - Strong acknowledgment signals
 * 
 * @param {Object} evidence - Evidence object
 * @returns {boolean}
 */
export function hasStrongEvidence(evidence) {
  if (!evidence) return false;

  // Network evidence
  if (evidence.networkStatus) {
    const status = evidence.networkStatus;
    
    // Server errors
    if (status.lastResponseStatus >= 500) return true;
    
    // Auth blocks
    if (status.lastResponseStatus === 401 || status.lastResponseStatus === 403) return true;
    
    // Network failures
    if (status.networkFailed || status.timeouts > 0) return true;
  }

  // Console errors
  if (evidence.consoleErrors && evidence.consoleErrors.length > 0) return true;

  // Strong acknowledgment signals
  if (evidence.acknowledgment) {
    if (evidence.acknowledgment.level === ACKNOWLEDGMENT_LEVELS.STRONG) return true;
    if (evidence.acknowledgment.level === ACKNOWLEDGMENT_LEVELS.PARTIAL &&
        evidence.acknowledgment.confidence >= 0.7) return true;
  }

  // DOM evidence
  if (evidence.signals) {
    const signals = evidence.signals;
    
    // Error messages
    if (signals.errorMessageAppeared) return true;
    
    // Route changes
    if (signals.routeChanged) return true;
    
    // Network responses
    if (signals.networkResponseReceived) return true;
  }

  return false;
}

/**
 * Check if evidence shows contradiction (for MISLEADING judgment)
 * 
 * Contradiction = success UI + error indicators
 * 
 * @param {Object} evidence - Evidence object
 * @returns {boolean}
 */
export function hasContradiction(evidence) {
  if (!evidence) return false;

  // Success signals
  const hasSuccessSignal = evidence.signals?.successMessageAppeared || 
                          evidence.signals?.feedbackAppeared ||
                          evidence.signals?.routeChanged;
  
  // Error indicators
  const hasErrorIndicator = evidence.signals?.errorMessageAppeared ||
                           evidence.networkStatus?.lastResponseStatus >= 400 ||
                           evidence.consoleErrors?.length > 0 ||
                           evidence.networkStatus?.networkFailed;

  return hasSuccessSignal && hasErrorIndicator;
}

/**
 * Enforce evidence law for a judgment
 * 
 * THROWS EvidenceLawViolation if law is violated
 * 
 * This is the main entry point for evidence law enforcement.
 * Can accept either:
 * 1. judgment (string) + observation (object) - for use during judgment creation
 * 2. judgment (object) + evidence (object) - for use after judgment creation
 * 
 * @param {string|Object} judgmentOrType - Judgment type (string) or judgment object
 * @param {Object} observationOrEvidence - Observation or evidence object
 * @throws {EvidenceLawViolation}
 */
export function enforceEvidenceLaw(judgmentOrType, observationOrEvidence) {
  // Determine if we're dealing with a judgment object or just the type
  let judgmentType;
  let evidence;

  if (typeof judgmentOrType === 'string') {
    // Called with judgment type string + observation
    judgmentType = judgmentOrType;
    evidence = buildEvidenceFromObservation(observationOrEvidence);
  } else {
    // Called with judgment object + evidence
    judgmentType = judgmentOrType.judgment;
    evidence = observationOrEvidence;
  }

  // RULE 1: FAILURE_* requires strong evidence
  if (judgmentType === JUDGMENT_TYPES.FAILURE_SILENT || 
      judgmentType === JUDGMENT_TYPES.FAILURE_MISLEADING) {
    
    if (!hasStrongEvidence(evidence)) {
      throw new EvidenceLawViolation(
        VIOLATION_TYPES.FAILURE_WITHOUT_STRONG_EVIDENCE,
        `Judgment ${judgmentType} requires strong evidence but none found`,
        { judgmentType }
      );
    }
  }

  // RULE 2: MISLEADING requires strong acknowledgment + contradiction
  if (judgmentType === JUDGMENT_TYPES.FAILURE_MISLEADING) {
    if (!hasContradiction(evidence)) {
      throw new EvidenceLawViolation(
        VIOLATION_TYPES.MISLEADING_WITHOUT_CONTRADICTION,
        `Judgment FAILURE_MISLEADING requires contradiction (success signal + error indicator). No contradiction found.`,
        { judgmentType }
      );
    }
  }

  // RULE 3: SILENT_FAILURE forbidden if silenceKind is recoverable
  if (judgmentType === JUDGMENT_TYPES.FAILURE_SILENT) {
    const silenceKind = evidence.silenceKind;
    
    if (silenceKind && isSilenceRecoverable(silenceKind)) {
      throw new EvidenceLawViolation(
        VIOLATION_TYPES.SILENT_FAILURE_WITH_RECOVERABLE_SILENCE,
        `Recoverable silence cannot be FAILURE_SILENT: ${silenceKind}`,
        { judgmentType, silenceKind }
      );
    }
  }
}

/**
 * Build evidence object from observation
 * 
 * Converts STAGE 3 observation format to evidence format for law enforcement
 * 
 * @param {Object} observation - Observation from STAGE 3
 * @returns {Object} - Evidence object
 */
function buildEvidenceFromObservation(observation) {
  return {
    acknowledgment: {
      level: observation.acknowledgmentLevel,
    },
    silenceKind: observation.silenceKind,
    signals: convertSignalsToFlags(observation.signals),
    networkStatus: observation.networkStatus || null,
    consoleErrors: observation.consoleErrors || [],
  };
}

/**
 * Convert signals array to flag object
 * 
 * @param {Array<string>} signals - Signals array
 * @returns {Object} - Flags object
 */
function convertSignalsToFlags(signals) {
  if (!signals || !Array.isArray(signals)) {
    return {};
  }

  const flags = {};
  for (const signal of signals) {
    if (signal === 'error') {
      flags.errorMessageAppeared = true;
    } else if (signal === 'navigation') {
      flags.routeChanged = true;
    } else if (signal === 'network') {
      flags.networkResponseReceived = true;
    } else if (signal === 'success') {
      flags.successMessageAppeared = true;
    } else if (signal === 'feedback') {
      flags.feedbackAppeared = true;
    }
  }
  return flags;
}

/**
 * Enforce evidence law for a judgment object (legacy interface)
 * 
 * THROWS EvidenceLawViolation if law is violated
 * 
 * @param {Object} judgment - Judgment object
 * @param {Object} evidence - Evidence object
 * @throws {EvidenceLawViolation}
 */
export function enforceEvidenceLawForJudgment(judgment, evidence) {
  const violations = checkEvidenceLaw(judgment, evidence);
  
  if (violations.length > 0) {
    const firstViolation = violations[0];
    throw new EvidenceLawViolation(
      firstViolation.type,
      firstViolation.message,
      {
        judgment: judgment.judgment,
        promiseId: judgment.promiseId,
        violations,
      }
    );
  }
}

/**
 * Check evidence law without throwing
 * 
 * @param {Object} judgment - Judgment object
 * @param {Object} evidence - Evidence object
 * @returns {Array<Object>} - Array of violations
 */
export function checkEvidenceLaw(judgment, evidence) {
  const violations = [];

  // RULE 1: FAILURE_* requires strong evidence
  if (judgment.judgment === JUDGMENT_TYPES.FAILURE_SILENT || 
      judgment.judgment === JUDGMENT_TYPES.FAILURE_MISLEADING) {
    
    if (!hasStrongEvidence(evidence)) {
      violations.push({
        type: VIOLATION_TYPES.FAILURE_WITHOUT_STRONG_EVIDENCE,
        message: `Judgment ${judgment.judgment} requires strong evidence but none found`,
        judgment: judgment.judgment,
        promiseId: judgment.promiseId,
      });
    }
  }

  // RULE 2: MISLEADING requires strong acknowledgment + contradiction
  if (judgment.judgment === JUDGMENT_TYPES.FAILURE_MISLEADING) {
    const hasStrongAck = evidence.acknowledgment?.level === ACKNOWLEDGMENT_LEVELS.STRONG;
    const hasContra = hasContradiction(evidence);
    
    if (!hasStrongAck || !hasContra) {
      violations.push({
        type: VIOLATION_TYPES.MISLEADING_WITHOUT_CONTRADICTION,
        message: `Judgment FAILURE_MISLEADING requires strong acknowledgment + contradiction`,
        judgment: judgment.judgment,
        promiseId: judgment.promiseId,
        hasStrongAck,
        hasContra,
      });
    }
  }

  // RULE 3: SILENT_FAILURE forbidden if silenceKind is recoverable
  if (judgment.judgment === JUDGMENT_TYPES.FAILURE_SILENT) {
    const silenceKind = judgment.context?.silenceKind;
    
    if (silenceKind && isSilenceRecoverable(silenceKind)) {
      violations.push({
        type: VIOLATION_TYPES.SILENT_FAILURE_WITH_RECOVERABLE_SILENCE,
        message: `Judgment FAILURE_SILENT forbidden with recoverable silence: ${silenceKind}`,
        judgment: judgment.judgment,
        promiseId: judgment.promiseId,
        silenceKind,
      });
    }
  }

  // RULE 4: Evidence refs must not be empty for failures
  if ((judgment.judgment === JUDGMENT_TYPES.FAILURE_SILENT || 
       judgment.judgment === JUDGMENT_TYPES.FAILURE_MISLEADING) &&
      (!judgment.evidenceRefs || judgment.evidenceRefs.length === 0)) {
    
    violations.push({
      type: VIOLATION_TYPES.MISSING_REQUIRED_EVIDENCE,
      message: `Judgment ${judgment.judgment} requires evidence references`,
      judgment: judgment.judgment,
      promiseId: judgment.promiseId,
    });
  }

  return violations;
}

/**
 * Validate all judgments against evidence law
 * 
 * @param {Array<Object>} judgments - Array of judgments
 * @param {Map<string, Object>} evidenceMap - Map of promiseId to evidence
 * @returns {Object} - { valid: boolean, violations: Array }
 */
export function validateAllJudgments(judgments, evidenceMap) {
  const allViolations = [];

  for (const judgment of judgments) {
    const evidence = evidenceMap.get(judgment.promiseId) || {};
    const violations = checkEvidenceLaw(judgment, evidence);
    
    allViolations.push(...violations);
  }

  return {
    valid: allViolations.length === 0,
    violations: allViolations,
  };
}

/**
 * Get evidence summary for judgment
 * 
 * @param {Object} evidence - Evidence object
 * @returns {Object} - Evidence summary
 */
export function summarizeEvidence(evidence) {
  return {
    hasStrongEvidence: hasStrongEvidence(evidence),
    hasContradiction: hasContradiction(evidence),
    acknowledgmentLevel: evidence.acknowledgment?.level || 'none',
    networkStatus: evidence.networkStatus?.lastResponseStatus || null,
    consoleErrorCount: evidence.consoleErrors?.length || 0,
    detectedSignals: evidence.signals ? Object.keys(evidence.signals).filter(k => evidence.signals[k]) : [],
  };
}
