/**
 * Internal: Evidence validation utilities
 */

import { EvidenceBuildError } from './errors.js';
import { checkMissingEvidence } from './build-evidence.js';

/**
 * Required fields for CONFIRMED findings
 */
export const REQUIRED_FIELDS_CONFIRMED = [
  'trigger.source',
  'before.screenshot',
  'after.screenshot',
  'before.url',
  'after.url',
  'action.interaction',
  'signals.network',
  'signals.uiSignals',
];

/**
 * Validate evidence package completeness for CONFIRMED findings
 * 
 * @param {Object} evidencePackage - Evidence package to validate
 * @param {string} severity - Finding severity (CONFIRMED or SUSPECTED)
 * @returns {Object} { isComplete, missingFields, shouldDowngrade }
 */
export function validateEvidencePackage(evidencePackage, severity) {
  const missing = checkMissingEvidence(evidencePackage);
  const isComplete = missing.length === 0;
  
  // CONFIRMED findings MUST have complete evidence
  const shouldDowngrade = severity === 'CONFIRMED' && !isComplete;
  
  return {
    isComplete,
    missingFields: missing,
    shouldDowngrade,
    downgradeReason: shouldDowngrade 
      ? `Evidence Law Violation: Missing required evidence fields: ${missing.join(', ')}`
      : null,
  };
}

/**
 * Strict validation for CONFIRMED findings
 * 
 * HARD LOCK: If finding is CONFIRMED and evidencePackage is incomplete,
 * this function throws EvidenceBuildError (fail closed, not open).
 * 
 * @param {Object} evidencePackage - Evidence package to validate
 * @param {string} severity - Finding severity (must be CONFIRMED for strict validation)
 * @throws {EvidenceBuildError} If CONFIRMED finding has incomplete evidencePackage
 */
export function validateEvidencePackageStrict(evidencePackage, severity) {
  if (!evidencePackage || typeof evidencePackage !== 'object') {
    throw new EvidenceBuildError(
      'Evidence Law Violation: evidencePackage is missing or invalid',
      REQUIRED_FIELDS_CONFIRMED,
      null
    );
  }
  
  if (severity === 'CONFIRMED' || severity === 'CONFIRMED') {
    const missing = checkMissingEvidence(evidencePackage);
    const isComplete = missing.length === 0;
    
    if (!isComplete) {
      throw new EvidenceBuildError(
        `Evidence Law Violation: CONFIRMED finding requires complete evidencePackage. Missing fields: ${missing.join(', ')}`,
        missing,
        evidencePackage
      );
    }
    
    // Additional strict check: evidencePackage.isComplete must be true
    if (evidencePackage.isComplete !== true) {
      throw new EvidenceBuildError(
        `Evidence Law Violation: CONFIRMED finding has evidencePackage.isComplete !== true`,
        missing.length > 0 ? missing : REQUIRED_FIELDS_CONFIRMED,
        evidencePackage
      );
    }
  }
  
  return {
    isComplete: evidencePackage.isComplete === true,
    missingFields: checkMissingEvidence(evidencePackage),
    valid: true
  };
}
