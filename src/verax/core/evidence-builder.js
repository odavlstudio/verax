/**
 * PHASE 16 — Evidence Hardening: Mandatory Evidence Packages
 * PHASE 21.1 — Evidence Law Hard Lock: Unbreakable invariant enforcement
 * 
 * Central evidence builder that creates standardized Evidence Packages
 * for all findings. Ensures completeness and enforces Evidence Law.
 * 
 * HARD LOCK RULES:
 * - buildEvidencePackage() MUST return complete evidencePackage or throw EvidenceBuildError
 * - No silent failures allowed
 * - CONFIRMED findings without complete evidencePackage is IMPOSSIBLE
 */

// Facade: delegates to internal modules; public API unchanged
import { EvidenceBuildError } from './evidence-builder/errors.js';
import { buildEvidencePackage, checkMissingEvidence } from './evidence-builder/build-evidence.js';
import { validateEvidencePackage, validateEvidencePackageStrict } from './evidence-builder/validate-evidence.js';
import { buildAndEnforceEvidencePackage } from './evidence-builder/enforce-evidence.js';

/**
 * PHASE 16: Evidence Package Schema
 * 
 * @typedef {Object} EvidencePackage
 * @property {Object} trigger - What triggered the finding (AST/DOM source + context)
 * @property {Object} before - Before state (screenshot, URL, DOM signature)
 * @property {Object} action - Action trace (interaction + timing)
 * @property {Object} after - After state (screenshot, URL, DOM signature)
 * @property {Object} signals - All sensor signals (network, console, ui feedback, route)
 * @property {Object} justification - Confidence reasons and verdict rationale
 * @property {Array<string>} missingEvidence - Fields that are missing (if any)
 * @property {boolean} isComplete - Whether all required fields are present
 */

/**
 * PHASE 16: Required fields for CONFIRMED findings
 * PHASE 21.1: Hard lock - these fields are MANDATORY for CONFIRMED
 */
// REQUIRED_FIELDS_CONFIRMED constant lives in validator module; behavior unchanged

/**
 * PHASE 21.1: Evidence Build Error
 * Thrown when evidence building fails - must NOT be silently caught
 */
export { EvidenceBuildError };

// Internal capture failure handling moved to enforce-evidence.js; behavior unchanged

/**
 * PHASE 16: Build standardized Evidence Package
 * 
 * @param {Object} params - Evidence building parameters
 * @param {Object} params.expectation - Promise/expectation
 * @param {Object} params.trace - Interaction trace
 * @param {Object} params.evidence - Existing evidence (optional, will be merged)
 * @param {Object} params.confidence - Confidence result (optional)
 * @returns {Object} Evidence Package
 */
export { buildEvidencePackage };

/**
 * Build trigger section (AST/DOM source + context)
 */
// Internal helper moved; behavior unchanged

/**
 * Build before state (screenshot, URL, DOM signature)
 */
// Internal helper moved; behavior unchanged

/**
 * Build action trace (interaction + timing)
 */
// Internal helper moved; behavior unchanged

/**
 * Build after state (screenshot, URL, DOM signature)
 */
// Internal helper moved; behavior unchanged

/**
 * Build signals section (network, console, ui feedback, route)
 */
// Internal helper moved; behavior unchanged

/**
 * Build justification (confidence reasons and verdict rationale)
 */
// Internal helper moved; behavior unchanged

/**
 * Check for missing evidence fields
 */
export { checkMissingEvidence };

/**
 * PHASE 16: Validate evidence package completeness for CONFIRMED findings
 * 
 * @param {Object} evidencePackage - Evidence package to validate
 * @param {string} severity - Finding severity (CONFIRMED or SUSPECTED)
 * @returns {Object} { isComplete, missingFields, shouldDowngrade }
 */
export { validateEvidencePackage };

/**
 * PHASE 21.1: Strict validation for CONFIRMED findings
 * 
 * HARD LOCK: If finding is CONFIRMED and evidencePackage is incomplete,
 * this function throws EvidenceBuildError (fail closed, not open).
 * 
 * @param {Object} evidencePackage - Evidence package to validate
 * @param {string} severity - Finding severity (must be CONFIRMED for strict validation)
 * @throws {EvidenceBuildError} If CONFIRMED finding has incomplete evidencePackage
 */
export { validateEvidencePackageStrict };

/**
 * PHASE 16: Build evidence package and enforce completeness
 * PHASE 21.1: Hard lock - throws EvidenceBuildError on failure (no silent failures)
 * PHASE 22: Evidence System Hardening - records evidence intent and capture failures
 * 
 * @param {Object} finding - Finding object
 * @param {Object} params - Evidence building parameters
 * @param {Array<Object>} captureFailures - Array of EvidenceCaptureFailure objects (optional)
 * @returns {Object} Finding with evidencePackage and potentially downgraded severity
 * @throws {EvidenceBuildError} If evidence building fails or CONFIRMED finding has incomplete evidence
 */
export { buildAndEnforceEvidencePackage };




