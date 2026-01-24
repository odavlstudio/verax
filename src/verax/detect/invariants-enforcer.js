/**
 * Phase 4: Final Output Invariants (Trust Lock)
 *
 * Strict gate applied only to user-facing outputs (REPORT.json, SUMMARY.md, console).
 * Findings violating any invariant are dropped silently. Purity and determinism are required.
 * 
 * PHASE 1: Integrated with Constitution Validator for Evidence Law enforcement.
 */

import { validateFindingConstitution, applyValidationResult } from './constitution-validator.js';
import { getTimeProvider as _getTimeProvider } from '../../cli/util/support/time-provider.js';

const KNOWN_IMPACTS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'UNKNOWN'];
const _VALID_STATUSES = ['CONFIRMED', 'SUSPECTED', 'INFORMATIONAL'];

function _isValidEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object') return false;
  const keys = Object.keys(evidence);
  if (keys.length === 0) return false;

  const signals = Object.values(evidence).filter(v => {
    if (v === true || v === false) return true;
    if (typeof v === 'number' && v !== 0) return true;
    if (typeof v === 'string' && v.length > 0) return true;
    if (Array.isArray(v)) return v.length > 0; // arrays must contain at least one element
    if (v && typeof v === 'object') return Object.keys(v).length > 0;
    return false;
  });

  return signals.length > 0;
}

function _isValidConfidence(confidence) {
  if (confidence === 0) return true;
  if (!confidence) return false;

  if (typeof confidence === 'number') {
    return confidence >= 0 && confidence <= 1;
  }

  if (typeof confidence === 'object') {
    const hasLevel = (typeof confidence.level === 'string' && confidence.level.length > 0) || typeof confidence.level === 'number';
    const hasScore = typeof confidence.score === 'number';
    return hasLevel || hasScore;
  }

  return false;
}

function isValidPromise(promise) {
  if (!promise || typeof promise !== 'object') return false;

  const { kind, value, type, expected, actual, expected_signal } = promise;

  const kindValueValid = typeof kind === 'string' && kind.length > 0 && typeof value === 'string' && value.length > 0;
  const typeValid = typeof type === 'string' && type.length > 0;
  const expectationValid = (typeof expected === 'string' && expected.length > 0) ||
    (typeof actual === 'string' && actual.length > 0) ||
    (typeof expected_signal === 'string' && expected_signal.length > 0);

  return kindValueValid || (typeValid && expectationValid);
}

function isValidImpact(impact) {
  return typeof impact === 'string' && KNOWN_IMPACTS.includes(impact);
}

function isInternalErrorFlag(finding) {
  const internalMarkers = [
    'INTERNAL_ERROR',
    'internal-error',
    'internalError',
    'TIMEOUT_ERROR',
    'CRASH',
    'FATAL',
    'BROWSER_CRASH'
  ];

  if (internalMarkers.some(marker =>
    finding.reason?.includes?.(marker) ||
    finding.errorMessage?.includes?.(marker) ||
    finding.errorStack?.includes?.(marker)
  )) {
    return true;
  }

  if (finding.reason?.toLowerCase?.().includes('internal error')) {
    return true;
  }

  return false;
}

function isValidId(id) {
  return typeof id === 'string' && id.trim().length > 0;
}

function isValidCause(cause, evidence) {
  if (!cause || typeof cause !== 'object') return false;
  if (!cause.id || !cause.statement) return false;

  if (Array.isArray(cause.evidence_refs) && cause.evidence_refs.length > 0) {
    if (!evidence || typeof evidence !== 'object') return false;
    return cause.evidence_refs.every(ref => typeof ref === 'string' && ref in evidence);
  }

  return true;
}

export function filterCausesWithEvidence(evidence, causes) {
  if (!Array.isArray(causes)) return [];
  return causes.filter(cause => isValidCause(cause, evidence));
}

function _enforceFinalInvariant(finding) {
  if (!finding) return null;

  // PHASE 1: Use constitution validator for systematic enforcement
  const constitutionResult = validateFindingConstitution(finding);
  if (!constitutionResult.valid) {
    // Constitution violation - drop with optional downgrade
    if (constitutionResult.action === 'DOWNGRADE' && constitutionResult.downgrade) {
      finding = { ...finding, ...constitutionResult.downgrade };
    } else {
      return null; // DROP
    }
  }

  // Additional invariants beyond constitution
  if (isInternalErrorFlag(finding)) return null;
  if (!isValidImpact(finding.impact)) return null;
  if (!isValidId(finding.id)) return null;
  if (!isValidPromise(finding.promise)) return null;

  const causes = filterCausesWithEvidence(finding.evidence, finding.causes);

  return { ...finding, causes };
}

function buildEnforcementSnapshot() {
  return {
    evidenceLawEnforced: true,
    contractVersion: 1,
    droppedCount: 0,
    downgradedCount: 0,
    downgrades: [],
    dropped: []
  };
}

export function enforceFinalInvariantsWithReport(findings) {
  if (!Array.isArray(findings)) {
    return { findings: [], enforcement: buildEnforcementSnapshot() };
  }

  const enforcement = buildEnforcementSnapshot();
  const validFindings = [];

  for (const original of findings) {
    const constitutionResult = validateFindingConstitution(original);
    const sanitized = applyValidationResult(original, constitutionResult);

    if (sanitized === null) {
      enforcement.droppedCount += 1;
      enforcement.dropped.push({ id: original?.id, reason: constitutionResult.reason || 'constitution_violation' });
      continue;
    }

    if (!isValidId(sanitized.id)) {
      enforcement.droppedCount += 1;
      enforcement.dropped.push({ id: sanitized?.id, reason: 'invalid_id' });
      continue;
    }

    if (!isValidPromise(sanitized.promise)) {
      enforcement.droppedCount += 1;
      enforcement.dropped.push({ id: sanitized?.id, reason: 'invalid_promise' });
      continue;
    }

    if (!isValidImpact(sanitized.impact)) {
      enforcement.droppedCount += 1;
      enforcement.dropped.push({ id: sanitized?.id, reason: 'invalid_impact' });
      continue;
    }

    if (isInternalErrorFlag(sanitized)) {
      enforcement.droppedCount += 1;
      enforcement.dropped.push({ id: sanitized?.id, reason: 'internal_error_marker' });
      continue;
    }

    const causes = filterCausesWithEvidence(sanitized.evidence, sanitized.causes);
    const finalFinding = { ...sanitized, causes };

    if (constitutionResult.action === 'DOWNGRADE' && constitutionResult.downgrade) {
      enforcement.downgradedCount += 1;
      enforcement.downgrades.push({
        id: finalFinding.id,
        reason: constitutionResult.reason || 'downgraded_by_constitution',
        originalStatus: original?.status,
        downgradeToStatus: finalFinding.status
      });
    }

    validFindings.push(finalFinding);
  }

  const deduped = deduplicateFindings(validFindings);

  // CRITICAL: Sorting must be locale-independent for determinism.
  const sorted = deduped.sort((a, b) => {
    const aId = (a.id || '').toString();
    const bId = (b.id || '').toString();
    return aId.localeCompare(bId, 'en', { sensitivity: 'base' });
  });

  return { findings: sorted, enforcement };
}

export function deduplicateFindings(findings) {
  const seen = new Set();
  const deduped = [];

  for (const finding of findings) {
    const promiseKey = finding.promise ? JSON.stringify(finding.promise) : 'nopromise';
    const key = `${finding.id || 'unknown'}|${finding.location || 'unknown'}|${promiseKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(finding);
  }

  return deduped;
}

export function enforceFinalInvariants(findings) {
  return enforceFinalInvariantsWithReport(findings).findings;
}








