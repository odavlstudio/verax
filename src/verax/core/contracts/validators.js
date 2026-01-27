/**
 * VERAX Validators - Runtime contract enforcement
 * 
 * Implements the Evidence Law:
 * "A finding cannot be marked CONFIRMED without sufficient evidence."
 * 
 * All validators follow the pattern:
 * @returns {Object} { ok: boolean, errors: string[], downgrade?: string }
 * 
 * If a finding violates contracts, it should be downgraded to SUSPECTED
 * or dropped from the report if it's critical.
 */

import {
  CONFIDENCE_LEVEL,
  FINDING_STATUS,
  FINDING_TYPE,
  IMPACT,
  USER_RISK,
  OWNERSHIP,
  EVIDENCE_TYPE
} from './types.js';

/**
 * Validate a Finding object against contracts
 * 
 * Evidence Law Enforcement:
 * - If confidence.level === CONFIRMED, evidence must be substantive
 * - If evidence is missing or empty, finding cannot be CONFIRMED
 * - Returns { ok, errors, shouldDowngrade, suggestedStatus }
 * 
 * @param {Object} finding - Finding object to validate
 * @returns {Object} Validation result with enforcement recommendation
 */
export function validateFinding(finding) {
  const errors = [];
  let shouldDowngrade = false;
  let suggestedStatus = null;

  // Contract 1: Required top-level fields
  if (!finding) {
    return {
      ok: false,
      errors: ['Finding is null or undefined'],
      shouldDowngrade: false
    };
  }

  if (!finding.type) {
    errors.push('Missing required field: type');
  } else if (!Object.values(FINDING_TYPE).includes(finding.type)) {
    errors.push(`Invalid type: ${finding.type}. Must be one of: ${Object.values(FINDING_TYPE).join(', ')}`);
  }

  if (!finding.interaction || typeof finding.interaction !== 'object') {
    errors.push('Missing or invalid required field: interaction (must be object)');
  }

  if (!finding.what_happened || typeof finding.what_happened !== 'string') {
    errors.push('Missing or invalid required field: what_happened (must be non-empty string)');
  }

  if (!finding.what_was_expected || typeof finding.what_was_expected !== 'string') {
    errors.push('Missing or invalid required field: what_was_expected (must be non-empty string)');
  }

  if (!finding.what_was_observed || typeof finding.what_was_observed !== 'string') {
    errors.push('Missing or invalid required field: what_was_observed (must be non-empty string)');
  }

  // Contract 2: Evidence validation (CRITICAL for Evidence Law)
  const evidenceValidation = validateEvidence(finding.evidence);
  if (!evidenceValidation.ok) {
    errors.push(`Invalid evidence: ${evidenceValidation.errors.join('; ')}`);
    shouldDowngrade = true;
    suggestedStatus = FINDING_STATUS.SUSPECTED;
  }

  // Contract 3: Confidence validation
  const confidenceValidation = validateConfidence(finding.confidence);
  if (!confidenceValidation.ok) {
    errors.push(`Invalid confidence: ${confidenceValidation.errors.join('; ')}`);
    shouldDowngrade = true;
    suggestedStatus = FINDING_STATUS.SUSPECTED;
  }

  // Contract 4: Signals validation
  if (!finding.signals || typeof finding.signals !== 'object') {
    errors.push('Missing or invalid required field: signals (must be object)');
  } else {
    const signalsValidation = validateSignals(finding.signals);
    if (!signalsValidation.ok) {
      errors.push(`Invalid signals: ${signalsValidation.errors.join('; ')}`);
    }
  }

  // *** EVIDENCE LAW ENFORCEMENT ***  if (finding.status === FINDING_STATUS.CONFIRMED || finding.severity === 'CONFIRMED') {
    // EVIDENCE LAW v1: Check evidence structure first (context anchor + effect evidence)
    const evidenceLawResult = enforceEvidenceLawV1(finding.evidence);
    if (!evidenceLawResult.ok && evidenceLawResult.downgrade) {
      console.log(
        `EVIDENCE_LAW v1: downgraded CONFIRMED -> ${evidenceLawResult.downgrade} ` +
        `(missing: ${evidenceLawResult.missing.join(', ')})`
      );
      return {
        ok: true,
        errors: [],
        shouldDowngrade: true,
        suggestedStatus: evidenceLawResult.downgrade
      };
    }    if (finding.evidencePackage) {
      const missingFields = finding.evidencePackage.missingEvidence || [];
      const isComplete = finding.evidencePackage.isComplete === true;
      
      if (!isComplete || missingFields.length > 0) {        errors.push(
          `Evidence Law Violation (CRITICAL): Finding marked CONFIRMED but evidencePackage is incomplete. ` +
          `Missing fields: ${missingFields.join(', ')}. ` +
          `evidencePackage.isComplete=${isComplete}. ` +
          `This finding MUST be dropped, not downgraded.`
        );
        // Do not set shouldDowngrade - this is a critical failure that should drop the finding
        return {
          ok: false,
          errors,
          shouldDowngrade: false, // Fail closed - drop, don't downgrade
          suggestedStatus: null
        };
      }
    } else if (!isEvidenceSubstantive(finding.evidence)) {      errors.push(
        `Evidence Law Violation (CRITICAL): Finding marked CONFIRMED but lacks evidencePackage and evidence is insufficient. ` +
        `This finding MUST be dropped, not downgraded.`
      );
      // Do not set shouldDowngrade - this is a critical failure that should drop the finding
      return {
        ok: false,
        errors,
        shouldDowngrade: false, // Fail closed - drop, don't downgrade
        suggestedStatus: null
      };
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    shouldDowngrade,
    suggestedStatus
  };
}

/**
 * Validate an Evidence object
 * Evidence is REQUIRED for any CONFIRMED finding.
 * 
 * @param {Object} evidence - Evidence object to validate
 * @returns {Object} { ok: boolean, errors: string[] }
 */
export function validateEvidence(evidence) {
  const errors = [];

  if (!evidence) {
    errors.push('Evidence object is missing');
    return { ok: false, errors };
  }

  if (typeof evidence !== 'object') {
    errors.push('Evidence must be an object');
    return { ok: false, errors };
  }

  // Evidence should contain at least one substantive field
  const substantiveFields = [
    'hasDomChange',
    'hasUrlChange',
    'hasNetworkActivity',
    'hasStateChange',
    'networkRequests',
    'consoleLogs',
    'before',
    'after',
    'beforeDom',
    'afterDom'
  ];

  const hasAtLeastOneField = substantiveFields.some(
    field => evidence[field] !== undefined && evidence[field] !== null
  );

  if (!hasAtLeastOneField && !evidence.sensors) {
    errors.push(
      'Evidence object is empty. Must contain at least one of: ' +
      substantiveFields.join(', ') + ', or sensors data'
    );
  }

  // Optional: validate specific evidence fields if present
  if (evidence.type && !Object.values(EVIDENCE_TYPE).includes(evidence.type)) {
    errors.push(`Invalid evidence type: ${evidence.type}`);
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

/**
 * Validate a Confidence object
 * 
 * @param {Object} confidence - Confidence object to validate
 * @returns {Object} { ok: boolean, errors: string[] }
 */
export function validateConfidence(confidence) {
  const errors = [];

  if (!confidence || typeof confidence !== 'object') {
    errors.push('Confidence must be a non-empty object');
    return { ok: false, errors };
  }

  if (!confidence.level) {
    errors.push('Missing required field: confidence.level');
  } else if (!Object.values(CONFIDENCE_LEVEL).includes(confidence.level)) {
    errors.push(
      `Invalid confidence level: ${confidence.level}. ` +
      `Must be one of: ${Object.values(CONFIDENCE_LEVEL).join(', ')}`
    );
  }

  // Contract v1: Accept both score01 (0-1) and legacy score (0-100) for backward compat
  if (confidence.score01 !== undefined) {
    if (typeof confidence.score01 !== 'number' || confidence.score01 < 0 || confidence.score01 > 1) {
      errors.push(`Invalid confidence.score01: ${confidence.score01}. Must be a number 0-1`);
    }
  } else if (confidence.score !== undefined) {
    if (typeof confidence.score !== 'number' || confidence.score < 0 || confidence.score > 100) {
      errors.push(`Invalid confidence.score: ${confidence.score}. Must be a number 0-100`);
    }
  } else {
    errors.push('Missing required field: confidence.score01 or confidence.score');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

/**
 * Validate a Signals object
 * 
 * @param {Object} signals - Signals object to validate
 * @returns {Object} { ok: boolean, errors: string[] }
 */
export function validateSignals(signals) {
  const errors = [];

  if (!signals || typeof signals !== 'object') {
    errors.push('Signals must be a non-empty object');
    return { ok: false, errors };
  }

  if (!signals.impact) {
    errors.push('Missing required field: signals.impact');
  } else if (!Object.values(IMPACT).includes(signals.impact)) {
    errors.push(
      `Invalid impact: ${signals.impact}. ` +
      `Must be one of: ${Object.values(IMPACT).join(', ')}`
    );
  }

  if (!signals.userRisk) {
    errors.push('Missing required field: signals.userRisk');
  } else if (!Object.values(USER_RISK).includes(signals.userRisk)) {
    errors.push(
      `Invalid userRisk: ${signals.userRisk}. ` +
      `Must be one of: ${Object.values(USER_RISK).join(', ')}`
    );
  }

  if (!signals.ownership) {
    errors.push('Missing required field: signals.ownership');
  } else if (!Object.values(OWNERSHIP).includes(signals.ownership)) {
    errors.push(
      `Invalid ownership: ${signals.ownership}. ` +
      `Must be one of: ${Object.values(OWNERSHIP).join(', ')}`
    );
  }

  if (!signals.grouping || typeof signals.grouping !== 'object') {
    errors.push('Missing or invalid required field: signals.grouping (must be object)');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

/**
 * EVIDENCE LAW v1: Check if CONFIRMED finding has complete evidence structure
 * 
 * Rule A (Context Anchor): Must have beforeUrl OR beforeScreenshot OR before
 * Rule B (Effect Evidence): Must have afterUrl OR after OR flags OR quantitative indicators
 * 
 * @param {Object} evidence - Evidence object to validate
 * @returns {Object} { ok: boolean, downgrade: 'UNPROVEN'|'SUSPECTED'|null, missing: string[] }
 */
export function enforceEvidenceLawV1(evidence) {
  if (!evidence || typeof evidence !== 'object' || Object.keys(evidence).length === 0) {
    return { ok: false, downgrade: 'UNPROVEN', missing: ['evidence object'] };
  }

  const missing = [];

  // Rule A: Context anchor (before state)
  const hasContextAnchor = evidence.beforeUrl || evidence.beforeScreenshot || evidence.before;
  if (!hasContextAnchor) {
    missing.push('context anchor (beforeUrl/beforeScreenshot/before)');
  }

  // Rule B: Effect evidence (after state or change indicators)
  const hasEffectEvidence = 
    evidence.afterUrl || 
    evidence.afterScreenshot || 
    evidence.after ||
    evidence.urlChanged === true ||
    evidence.domChanged === true ||
    evidence.uiChanged === true ||
    (typeof evidence.networkRequests === 'number' && evidence.networkRequests > 0) ||
    (Array.isArray(evidence.networkRequests) && evidence.networkRequests.length > 0) ||
    (typeof evidence.consoleErrors === 'number' && evidence.consoleErrors > 0) ||
    (Array.isArray(evidence.consoleErrors) && evidence.consoleErrors.length > 0) ||
    evidence.timingBreakdown;

  if (!hasEffectEvidence) {
    missing.push('effect evidence (after/flags/quantitative)');
  }

  // Downgrade logic
  if (!hasContextAnchor && !hasEffectEvidence) {
    return { ok: false, downgrade: 'UNPROVEN', missing };
  }
  if (!hasContextAnchor || !hasEffectEvidence) {
    return { ok: false, downgrade: 'SUSPECTED', missing };
  }

  return { ok: true, downgrade: null, missing: [] };
}

/**
 * EVIDENCE LAW: Determine if evidence is sufficient for CONFIRMED status
 * 
 * Substantive evidence means:
 * - At least one positive signal (dom change, url change, network activity, etc.)
 * - OR concrete sensor data from interaction
 * - NOT just empty object or missing evidence
 * 
 * @param {Object} evidence - Evidence object to evaluate
 * @returns {boolean} True if evidence is substantive enough for CONFIRMED status
 */
export function isEvidenceSubstantive(evidence) {
  if (!evidence || typeof evidence !== 'object') {
    return false;
  }

  // Check for positive signal indicators
  const hasPositiveSignal = 
    evidence.hasDomChange === true ||
    evidence.hasUrlChange === true ||
    evidence.hasNetworkActivity === true ||
    evidence.hasStateChange === true ||
    (Array.isArray(evidence.networkRequests) && evidence.networkRequests.length > 0) ||
    (Array.isArray(evidence.consoleLogs) && evidence.consoleLogs.length > 0) ||
    (evidence.before && evidence.after);

  if (hasPositiveSignal) {
    return true;
  }

  // Check for sensor data
  if (evidence.sensors && typeof evidence.sensors === 'object' && Object.keys(evidence.sensors).length > 0) {
    return true;
  }

  return false;
}

/**
 * Enforce contracts on a finding array
 * 
 * Returns findings with status downgraded if necessary, filters out
 * findings that violate critical contracts.
 * 
 * @param {Array} findings - Array of findings to validate
 * @returns {Object} { valid: Array, dropped: Array, downgrades: Array }
 */
export function enforceContractsOnFindings(findings) {
  if (!Array.isArray(findings)) {
    return { valid: [], dropped: [], downgrades: [] };
  }

  const valid = [];
  const dropped = [];
  const downgrades = [];

  for (const finding of findings) {
    const validation = validateFinding(finding);

    if (!validation.ok && !validation.shouldDowngrade) {
      // Critical contract violation - drop
      dropped.push({
        finding,
        reason: validation.errors.join('; ')
      });
      continue;
    }

    if (validation.shouldDowngrade && validation.suggestedStatus) {
      // Downgrade the finding
      const downgraded = { ...finding, status: validation.suggestedStatus };
      downgrades.push({
        original: finding,
        downgraded,
        reason: validation.errors.join('; ')
      });
      valid.push(downgraded);
    } else {
      // Valid finding
      valid.push(finding);
    }
  }

  return { valid, dropped, downgrades };
}

export default {
  validateFinding,
  validateEvidence,
  validateConfidence,
  validateSignals,
  isEvidenceSubstantive,
  enforceEvidenceLawV1,
  enforceContractsOnFindings
};



