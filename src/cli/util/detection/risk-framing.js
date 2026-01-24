/**
 * Risk Framing (Report Usefulness)
 *
 * Generates a deterministic, user-centric risk summary that frames
 * how a finding affects user workflow, using existing fields only:
 * - silenceKind (from classifier)
 * - severity (existing finding field)
 * - confidence (existing finding field)
 *
 * No detection changes. No business logic. Deterministic.
 */

/**
 * Generate a deterministic, single-sentence risk summary.
 * @param {Object} finding - Existing finding object with silenceKind, severity, confidence
 * @returns {{ riskSummary?: string }} - Empty object if not applicable; riskSummary if silent failure
 */
export function generateRiskSummary(finding) {
  // Only apply to CONFIRMED/SUSPECTED silent failures
  const status = (finding.status || finding.severity || '').toUpperCase();
  const type = String(finding.type || '').toLowerCase();
  const isSilentFailure = type.includes('silent_failure');
  if (!isSilentFailure || (status !== 'CONFIRMED' && status !== 'SUSPECTED')) {
    return {};
  }

  const silenceKind = finding.silenceKind || 'UNKNOWN_SILENCE';
  const severity = String(finding.severity || 'MEDIUM').toUpperCase();
  const confidence = typeof finding.confidence === 'number' ? finding.confidence : 0.5;
  const lowConfidence = confidence < 0.7;

  // Deterministic risk mapping: (silenceKind, severity) → base statement
  let baseRisk = 'Expected outcome did not occur; user may be confused or blocked.';

  if (silenceKind === 'NO_NAVIGATION') {
    if (severity === 'HIGH') {
      baseRisk = 'Users cannot proceed to next step; action silently failed.';
    } else if (severity === 'MEDIUM') {
      baseRisk = 'Navigation was expected but did not occur; user may be blocked.';
    } else {
      baseRisk = 'Navigation may have failed; user impact depends on workflow.';
    }
  } else if (silenceKind === 'BLOCKED_WITHOUT_MESSAGE') {
    if (severity === 'HIGH') {
      baseRisk = 'Request was blocked without notification; user unaware action failed.';
    } else if (severity === 'MEDIUM') {
      baseRisk = 'Request may have failed silently; user may retry or abandon.';
    } else {
      baseRisk = 'Request block detected but user awareness unclear.';
    }
  } else if (silenceKind === 'STALLED_LOADING') {
    if (severity === 'HIGH') {
      baseRisk = 'Loading indicator without progress; user likely to abandon workflow.';
    } else if (severity === 'MEDIUM') {
      baseRisk = 'Loading appeared but did not complete; user may wait or abandon.';
    } else {
      baseRisk = 'Potential stalled loading; user impact unclear.';
    }
  } else if (silenceKind === 'NO_UI_CHANGE') {
    if (severity === 'HIGH') {
      baseRisk = 'Expected change did not occur; user unaware of the failure.';
    } else if (severity === 'MEDIUM') {
      baseRisk = 'No visible change detected; user may assume success or failure.';
    } else {
      baseRisk = 'UI change may not have occurred; unclear if critical.';
    }
  } else if (silenceKind === 'NO_FEEDBACK') {
    if (severity === 'HIGH') {
      baseRisk = 'No acknowledgment given to user; action appears unprocessed.';
    } else if (severity === 'MEDIUM') {
      baseRisk = 'Feedback was expected but not shown; user unsure of outcome.';
    } else {
      baseRisk = 'Feedback may be missing; user impact unclear.';
    }
  } else if (silenceKind === 'UNKNOWN_SILENCE') {
    if (severity === 'HIGH') {
      baseRisk = 'Expected outcome did not occur; user may misinterpret the failure.';
    } else if (severity === 'MEDIUM') {
      baseRisk = 'Unexpected behavior observed; user may be confused.';
    } else {
      baseRisk = 'Outcome uncertain; user impact unclear.';
    }
  }

  // Prepend low-confidence qualifier deterministically
  const riskSummary = lowConfidence
    ? `Risk uncertain due to incomplete evidence; ${baseRisk}`
    : baseRisk;

  return { riskSummary };
}








