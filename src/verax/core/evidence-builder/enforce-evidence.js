/**
 * Internal: Evidence enforcement orchestration
 */

import { EvidenceBuildError } from './errors.js';
import { buildEvidencePackage } from './build-evidence.js';
import { validateEvidencePackage, validateEvidencePackageStrict, REQUIRED_FIELDS_CONFIRMED } from './validate-evidence.js';
import {
  EvidenceCaptureFailure,
  EVIDENCE_CAPTURE_STAGE,
  EVIDENCE_CAPTURE_FAILURE_CODES
} from '../evidence/evidence-capture-service.js';

const FAILURE_CODE_BY_STAGE = {
  [EVIDENCE_CAPTURE_STAGE.BEFORE_SCREENSHOT]: EVIDENCE_CAPTURE_FAILURE_CODES.SCREENSHOT_FAILED,
  [EVIDENCE_CAPTURE_STAGE.AFTER_SCREENSHOT]: EVIDENCE_CAPTURE_FAILURE_CODES.SCREENSHOT_FAILED,
  [EVIDENCE_CAPTURE_STAGE.DOM_SIGNATURE]: EVIDENCE_CAPTURE_FAILURE_CODES.DOM_SIGNATURE_FAILED,
  [EVIDENCE_CAPTURE_STAGE.URL]: EVIDENCE_CAPTURE_FAILURE_CODES.URL_CAPTURE_FAILED,
  [EVIDENCE_CAPTURE_STAGE.UISIGNALS]: EVIDENCE_CAPTURE_FAILURE_CODES.UISIGNALS_CAPTURE_FAILED,
  [EVIDENCE_CAPTURE_STAGE.NETWORK]: EVIDENCE_CAPTURE_FAILURE_CODES.NETWORK_CAPTURE_FAILED
};

function buildCaptureFailuresFromTrace(captureOutcomes = []) {
  const failures = [];
  for (const outcome of captureOutcomes) {
    if (!outcome || (outcome.status !== 'failed' && outcome.status !== 'partial')) {
      continue;
    }

    const stageKey = outcome.stage && EVIDENCE_CAPTURE_STAGE[outcome.stage]
      ? EVIDENCE_CAPTURE_STAGE[outcome.stage]
      : outcome.stage || 'UNKNOWN_STAGE';
    const reasonCode = FAILURE_CODE_BY_STAGE[stageKey] || EVIDENCE_CAPTURE_FAILURE_CODES.UNKNOWN_ERROR;
    const reason = outcome.error?.message || 'Evidence capture failed';

    failures.push(
      new EvidenceCaptureFailure(stageKey, reasonCode, reason)
    );
  }
  return failures;
}

/**
 * Build evidence package and enforce completeness
 * 
 * @param {Object} finding - Finding object
 * @param {Object} params - Evidence building parameters
 * @param {Array<Object>} captureFailures - Array of EvidenceCaptureFailure objects (optional)
 * @returns {Object} Finding with evidencePackage and potentially downgraded severity
 * @throws {EvidenceBuildError} If evidence building fails or CONFIRMED finding has incomplete evidence
 */
export function buildAndEnforceEvidencePackage(finding, params, captureFailures = []) {
  // Build evidence package - throws if it fails
  let evidencePackage;
  try {
    evidencePackage = buildEvidencePackage(params);
  } catch (error) {
    // Re-throw as EvidenceBuildError if not already
    if (error instanceof EvidenceBuildError) {
      throw error;
    }
    throw new EvidenceBuildError(
      `Evidence building failed: ${error.message}`,
      REQUIRED_FIELDS_CONFIRMED,
      null
    );
  }
  
  // Record capture failures in evidence package metadata
  const traceCaptureFailures = buildCaptureFailuresFromTrace(params?.trace?.captureOutcomes || []);
  const allCaptureFailures = [...(captureFailures || []), ...traceCaptureFailures];

  if (allCaptureFailures && allCaptureFailures.length > 0) {
    evidencePackage.captureFailures = allCaptureFailures.map(f => f.toJSON ? f.toJSON() : f);
  }
  
  // Strict validation for CONFIRMED findings
  const severity = finding.severity || finding.status || 'SUSPECTED';
  if (severity === 'CONFIRMED') {
    validateEvidencePackageStrict(evidencePackage, severity);
  }
  
  // For SUSPECTED findings, allow partial evidence
  const validation = validateEvidencePackage(evidencePackage, severity);
  
  // Downgrade CONFIRMED if evidence incomplete (with evidence intent tracking)
  let finalSeverity = severity;
  let downgradeReason = null;
  
  if (validation.shouldDowngrade) {
    finalSeverity = 'SUSPECTED';
    downgradeReason = validation.downgradeReason;
    
    if (allCaptureFailures && allCaptureFailures.length > 0) {
      const failureCodes = allCaptureFailures.map(f => f.reasonCode || 'UNKNOWN').join(', ');
      downgradeReason += ` [Evidence Intent: Capture failures: ${failureCodes}]`;
    }
    
    if (validation.missingFields && validation.missingFields.length > 0) {
      downgradeReason += ` [Missing fields: ${validation.missingFields.join(', ')}]`;
    }
  }
  
  // Attach evidence package to finding
  return {
    ...finding,
    severity: finalSeverity,
    evidencePackage,
    evidenceCompleteness: {
      isComplete: validation.isComplete,
      missingFields: validation.missingFields,
      downgraded: validation.shouldDowngrade,
      downgradeReason,
      captureFailures: allCaptureFailures.length > 0 ? allCaptureFailures.map(f => f.toJSON ? f.toJSON() : f) : []
    },
  };
}
