/**
 * PHASE 18 — Determinism Diff Builder
 * 
 * Generates structured diffs between normalized artifacts from different runs.
 */

import { computeFindingIdentity as _computeFindingIdentity } from './finding-identity.js';

/**
 * PHASE 18: Diff reason codes
 * PHASE 25: Extended with new reason codes
 */
export const DIFF_REASON = {
  MISSING_ARTIFACT: 'DET_DIFF_MISSING_ARTIFACT',
  SCHEMA_MISMATCH: 'DET_DIFF_SCHEMA_MISMATCH',
  FINDING_ADDED: 'DET_DIFF_FINDING_ADDED',
  FINDING_REMOVED: 'DET_DIFF_FINDING_REMOVED',
  FINDING_STATUS_CHANGED: 'DET_DIFF_FINDING_STATUS_CHANGED',
  FINDING_SEVERITY_CHANGED: 'DET_DIFF_FINDING_SEVERITY_CHANGED',
  CONFIDENCE_CHANGED: 'DET_DIFF_CONFIDENCE_CHANGED',
  CONFIDENCE_REASONS_CHANGED: 'DET_DIFF_CONFIDENCE_REASONS_CHANGED',
  GUARDRAILS_CHANGED: 'DET_DIFF_GUARDRAILS_CHANGED',
  EVIDENCE_COMPLETENESS_CHANGED: 'DET_DIFF_EVIDENCE_COMPLETENESS_CHANGED',
  EVIDENCE_MISSING: 'DET_DIFF_EVIDENCE_MISSING',
  OBSERVATION_COUNT_CHANGED: 'DET_DIFF_OBSERVATION_COUNT_CHANGED',
  FIELD_VALUE_CHANGED: 'DET_DIFF_FIELD_VALUE_CHANGED',
  RUN_FINGERPRINT_MISMATCH: 'DET_DIFF_RUN_FINGERPRINT_MISMATCH',
};

/**
 * PHASE 18: Diff categories
 */
export const DIFF_CATEGORY = {
  FINDINGS: 'FINDINGS',
  EXPECTATIONS: 'EXPECTATIONS',
  OBSERVATIONS: 'OBSERVATIONS',
  EVIDENCE: 'EVIDENCE',
  STATUS: 'STATUS',
  ARTIFACTS: 'ARTIFACTS',
};

/**
 * PHASE 18: Diff severity
 */
export const DIFF_SEVERITY = {
  BLOCKER: 'BLOCKER',
  WARN: 'WARN',
  INFO: 'INFO',
};

function diffRunMeta(artifactA, artifactB) {
  return diffGeneric(artifactA, artifactB, 'runMeta');
}

function diffDeterminismContract(artifactA, artifactB) {
  return diffGeneric(artifactA, artifactB, 'determinismContract');
}

function diffReportArtifact(artifactA, artifactB, artifactName) {
  return diffGeneric(artifactA, artifactB, artifactName);
}

/**
 * PHASE 18: Diff artifacts
 * 
 * @param {Object} artifactA - First artifact (normalized)
 * @param {Object} artifactB - Second artifact (normalized)
 * @param {string} artifactName - Name of artifact
 * @param {Map} findingIdentityMap - Map of finding identity to finding (for matching)
 * @returns {Array} Array of diff objects
 */
export function diffArtifacts(artifactA, artifactB, artifactName, findingIdentityMap = null) {
  const diffs = [];
  
  // Check if artifacts exist
  if (!artifactA && artifactB) {
    diffs.push({
      category: DIFF_CATEGORY.ARTIFACTS,
      severity: DIFF_SEVERITY.BLOCKER,
      reasonCode: DIFF_REASON.MISSING_ARTIFACT,
      message: `Artifact ${artifactName} missing in first run`,
      artifact: artifactName,
    });
    return diffs;
  }
  
  if (artifactA && !artifactB) {
    diffs.push({
      category: DIFF_CATEGORY.ARTIFACTS,
      severity: DIFF_SEVERITY.BLOCKER,
      reasonCode: DIFF_REASON.MISSING_ARTIFACT,
      message: `Artifact ${artifactName} missing in second run`,
      artifact: artifactName,
    });
    return diffs;
  }
  
  if (!artifactA && !artifactB) {
    return diffs; // Both missing, no diff
  }
  
  // Artifact-specific diffing
  if (artifactName === 'findings') {
    diffs.push(...diffFindings(artifactA, artifactB, findingIdentityMap));
  } else if (artifactName === 'runMeta') {
    diffs.push(...diffRunMeta(artifactA, artifactB));
  } else if (artifactName === 'determinismContract') {
    diffs.push(...diffDeterminismContract(artifactA, artifactB));
  } else if (artifactName === 'confidenceReport' || artifactName === 'guardrailsReport' || artifactName === 'evidenceIntent') {
    diffs.push(...diffReportArtifact(artifactA, artifactB, artifactName));
  } else {
    // Generic diff for other artifacts
    diffs.push(...diffGeneric(artifactA, artifactB, artifactName));
  }
  
  return diffs;
}

/**
 * Diff findings artifacts
 */
function diffFindings(artifactA, artifactB, findingIdentityMap) {
  const diffs = [];
  
  const findingsA = artifactA.findings || [];
  const findingsB = artifactB.findings || [];
  
  // Check counts
  if (findingsA.length !== findingsB.length) {
    diffs.push({
      category: DIFF_CATEGORY.FINDINGS,
      severity: DIFF_SEVERITY.BLOCKER,
      reasonCode: DIFF_REASON.OBSERVATION_COUNT_CHANGED,
      message: `Finding count changed: ${findingsA.length} → ${findingsB.length}`,
      artifact: 'findings',
      field: 'findings.length',
      oldValue: findingsA.length,
      newValue: findingsB.length,
    });
  }
  
  // Build identity maps if not provided
  const mapA = new Map();
  const mapB = new Map();
  
  for (const finding of findingsA) {
    const identity = findingIdentityMap ? findingIdentityMap.get(finding) : computeFindingIdentitySimple(finding);
    mapA.set(identity, finding);
  }
  
  for (const finding of findingsB) {
    const identity = findingIdentityMap ? findingIdentityMap.get(finding) : computeFindingIdentitySimple(finding);
    mapB.set(identity, finding);
  }
  
  // Find added findings
  for (const [identity, finding] of mapB) {
    if (!mapA.has(identity)) {
      diffs.push({
        category: DIFF_CATEGORY.FINDINGS,
        severity: DIFF_SEVERITY.BLOCKER,
        reasonCode: DIFF_REASON.FINDING_ADDED,
        message: `Finding added: ${finding.type || 'unknown'}`,
        artifact: 'findings',
        findingIdentity: identity,
        finding: finding,
      });
    }
  }
  
  // Find removed findings
  for (const [identity, finding] of mapA) {
    if (!mapB.has(identity)) {
      diffs.push({
        category: DIFF_CATEGORY.FINDINGS,
        severity: DIFF_SEVERITY.BLOCKER,
        reasonCode: DIFF_REASON.FINDING_REMOVED,
        message: `Finding removed: ${finding.type || 'unknown'}`,
        artifact: 'findings',
        findingIdentity: identity,
        finding: finding,
      });
    }
  }
  
  // Find changed findings
  for (const [identity, findingA] of mapA) {
    const findingB = mapB.get(identity);
    if (findingB) {
      diffs.push(...diffFinding(findingA, findingB, identity));
    }
  }
  
  return diffs;
}

/**
 * Diff individual finding
 */
function diffFinding(findingA, findingB, identity) {
  const diffs = [];
  
  // Check status/severity
  const statusA = findingA.severity || findingA.status;
  const statusB = findingB.severity || findingB.status;
  if (statusA !== statusB) {
    diffs.push({
      category: DIFF_CATEGORY.FINDINGS,
      severity: DIFF_SEVERITY.BLOCKER,
      reasonCode: DIFF_REASON.FINDING_SEVERITY_CHANGED,
      message: `Finding severity changed: ${statusA} → ${statusB}`,
      artifact: 'findings',
      findingIdentity: identity,
      field: 'severity',
      oldValue: statusA,
      newValue: statusB,
    });
  }
  
  // Check confidence
  const confA = findingA.confidence || 0;
  const confB = findingB.confidence || 0;
  if (Math.abs(confA - confB) > 0.001) {
    diffs.push({
      category: DIFF_CATEGORY.FINDINGS,
      severity: DIFF_SEVERITY.WARN,
      reasonCode: DIFF_REASON.CONFIDENCE_CHANGED,
      message: `Finding confidence changed: ${confA.toFixed(3)} → ${confB.toFixed(3)}`,
      artifact: 'findings',
      findingIdentity: identity,
      field: 'confidence',
      oldValue: confA,
      newValue: confB,
    });
  }
  
  // Check confidence reasons
  const reasonsA = findingA.confidenceReasons || [];
  const reasonsB = findingB.confidenceReasons || [];
  const reasonsASorted = [...reasonsA].sort((a, b) => String(a).localeCompare(String(b), 'en'));
  const reasonsBSorted = [...reasonsB].sort((a, b) => String(a).localeCompare(String(b), 'en'));
  if (JSON.stringify(reasonsASorted) !== JSON.stringify(reasonsBSorted)) {
    diffs.push({
      category: DIFF_CATEGORY.FINDINGS,
      severity: DIFF_SEVERITY.WARN,
      reasonCode: DIFF_REASON.CONFIDENCE_REASONS_CHANGED,
      message: `Finding confidence reasons changed`,
      artifact: 'findings',
      findingIdentity: identity,
      field: 'confidenceReasons',
      oldValue: reasonsASorted,
      newValue: reasonsBSorted,
    });
  }
  
  // Check guardrails
  const guardrailsA = findingA.guardrails;
  const guardrailsB = findingB.guardrails;
  if (guardrailsA || guardrailsB) {
    if (!guardrailsA || !guardrailsB) {
      diffs.push({
        category: DIFF_CATEGORY.FINDINGS,
        severity: DIFF_SEVERITY.WARN,
        reasonCode: DIFF_REASON.GUARDRAILS_CHANGED,
        message: `Finding guardrails presence changed`,
        artifact: 'findings',
        findingIdentity: identity,
        field: 'guardrails',
      });
    } else if (guardrailsA.finalDecision !== guardrailsB.finalDecision) {
      diffs.push({
        category: DIFF_CATEGORY.FINDINGS,
        severity: DIFF_SEVERITY.WARN,
        reasonCode: DIFF_REASON.GUARDRAILS_CHANGED,
        message: `Finding guardrails decision changed: ${guardrailsA.finalDecision} → ${guardrailsB.finalDecision}`,
        artifact: 'findings',
        findingIdentity: identity,
        field: 'guardrails.finalDecision',
        oldValue: guardrailsA.finalDecision,
        newValue: guardrailsB.finalDecision,
      });
    }
  }
  
  // Check evidence completeness
  const evidenceA = findingA.evidenceCompleteness;
  const evidenceB = findingB.evidenceCompleteness;
  if (evidenceA || evidenceB) {
    if (!evidenceA || !evidenceB) {
      diffs.push({
        category: DIFF_CATEGORY.EVIDENCE,
        severity: DIFF_SEVERITY.BLOCKER,
        reasonCode: DIFF_REASON.EVIDENCE_COMPLETENESS_CHANGED,
        message: `Finding evidence completeness presence changed`,
        artifact: 'findings',
        findingIdentity: identity,
        field: 'evidenceCompleteness',
      });
    } else if (evidenceA.isComplete !== evidenceB.isComplete) {
      diffs.push({
        category: DIFF_CATEGORY.EVIDENCE,
        severity: DIFF_SEVERITY.BLOCKER,
        reasonCode: DIFF_REASON.EVIDENCE_COMPLETENESS_CHANGED,
        message: `Finding evidence completeness changed: ${evidenceA.isComplete} → ${evidenceB.isComplete}`,
        artifact: 'findings',
        findingIdentity: identity,
        field: 'evidenceCompleteness.isComplete',
        oldValue: evidenceA.isComplete,
        newValue: evidenceB.isComplete,
      });
    }
  }
  
  // Check evidencePackage presence
  const evidencePackageA = findingA.evidencePackage;
  const evidencePackageB = findingB.evidencePackage;
  if (!evidencePackageA && evidencePackageB) {
    diffs.push({
      category: DIFF_CATEGORY.EVIDENCE,
      severity: DIFF_SEVERITY.BLOCKER,
      reasonCode: DIFF_REASON.EVIDENCE_MISSING,
      message: `Finding evidence package missing in first run`,
      artifact: 'findings',
      findingIdentity: identity,
      field: 'evidencePackage',
    });
  } else if (evidencePackageA && !evidencePackageB) {
    diffs.push({
      category: DIFF_CATEGORY.EVIDENCE,
      severity: DIFF_SEVERITY.BLOCKER,
      reasonCode: DIFF_REASON.EVIDENCE_MISSING,
      message: `Finding evidence package missing in second run`,
      artifact: 'findings',
      findingIdentity: identity,
      field: 'evidencePackage',
    });
  } else if (evidencePackageA && evidencePackageB) {
    if (evidencePackageA.isComplete !== evidencePackageB.isComplete) {
      diffs.push({
        category: DIFF_CATEGORY.EVIDENCE,
        severity: DIFF_SEVERITY.BLOCKER,
        reasonCode: DIFF_REASON.EVIDENCE_COMPLETENESS_CHANGED,
        message: `Evidence completeness changed: ${evidencePackageA.isComplete} → ${evidencePackageB.isComplete}`,
        artifact: 'findings',
        findingIdentity: identity,
        field: 'evidencePackage.isComplete',
        oldValue: evidencePackageA.isComplete,
        newValue: evidencePackageB.isComplete,
      });
    }
    const missingA = Array.isArray(evidencePackageA.missingEvidence)
      ? [...evidencePackageA.missingEvidence].sort((a, b) => String(a).localeCompare(String(b), 'en'))
      : [];
    const missingB = Array.isArray(evidencePackageB.missingEvidence)
      ? [...evidencePackageB.missingEvidence].sort((a, b) => String(a).localeCompare(String(b), 'en'))
      : [];
    if (missingA.join('|') !== missingB.join('|')) {
      diffs.push({
        category: DIFF_CATEGORY.EVIDENCE,
        severity: DIFF_SEVERITY.BLOCKER,
        reasonCode: DIFF_REASON.EVIDENCE_MISSING,
        message: `Missing evidence changed`,
        artifact: 'findings',
        findingIdentity: identity,
        field: 'evidencePackage.missingEvidence',
        oldValue: missingA,
        newValue: missingB,
      });
    }
  }
  
  return diffs;
}

/**
 * Diff generic artifacts
 */
function diffGeneric(artifactA, artifactB, artifactName) {
  const diffs = [];
  
  // Simple deep comparison
  const jsonA = JSON.stringify(artifactA, null, 2);
  const jsonB = JSON.stringify(artifactB, null, 2);
  
  if (jsonA !== jsonB) {
    diffs.push({
      category: DIFF_CATEGORY.ARTIFACTS,
      severity: DIFF_SEVERITY.WARN,
      reasonCode: DIFF_REASON.FIELD_VALUE_CHANGED,
      message: `Artifact ${artifactName} content changed`,
      artifact: artifactName,
    });
  }
  
  return diffs;
}

/**
 * Simple finding identity computation (fallback)
 */
function computeFindingIdentitySimple(finding) {
  const parts = [
    finding.type || 'unknown',
    finding.interaction?.type || '',
    finding.interaction?.selector || '',
    finding.expectation?.targetPath || '',
    finding.expectation?.urlPath || '',
  ];
  return parts.join('|');
}




