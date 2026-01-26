/**
 * PHASE 4 — TRACEABILITY DIAGNOSTICS COLLECTOR
 * 
 * Captures deterministic diagnostic information for every attempted expectation,
 * enabling transparent troubleshooting without opaque "action-failed" messages.
 */

/**
 * Diagnostic outcome codes
 */
const PHASE_OUTCOMES = {
  SUCCESS: 'SUCCESS',
  SELECTOR_NOT_FOUND: 'SELECTOR_NOT_FOUND',
  ELEMENT_HIDDEN: 'ELEMENT_HIDDEN',
  ELEMENT_DISABLED: 'ELEMENT_DISABLED',
  NOT_CLICKABLE: 'NOT_CLICKABLE',
  NAV_TIMEOUT: 'NAV_TIMEOUT',
  OUTCOME_TIMEOUT: 'OUTCOME_TIMEOUT',
  BLOCKED_BY_AUTH: 'BLOCKED_BY_AUTH',
  RUNTIME_NOT_READY: 'RUNTIME_NOT_READY',
  UNSUPPORTED_PROMISE: 'UNSUPPORTED_PROMISE',
  UNKNOWN_FAILURE: 'UNKNOWN_FAILURE',
};

/**
 * DiagnosticsCollector accumulates attempt diagnostics
 */
export class DiagnosticsCollector {
  constructor() {
    this.diagnostics = [];
  }

  /**
   * Record a diagnostic entry for an expectation attempt
   * 
   * @param {Object} entry - Diagnostic entry with:
   *   - expectationId: string
   *   - kind: string (navigate, submit, validation, click, other)
   *   - sourceRef: { file, line }
   *   - selector: string | null
   *   - phaseOutcome: one of PHASE_OUTCOMES
   *   - evidenceSignals: { urlChanged?, domChanged?, feedbackSeen?, networkSeen? }
   *   - shortReason: string (max ~120 chars)
   *   - details: object (optional)
   */
  record(entry) {
    // Normalize and validate
    const diagnostic = {
      expectationId: entry.expectationId,
      kind: entry.kind || 'other',
      sourceRef: entry.sourceRef || null,
      selector: entry.selector || null,
      phaseOutcome: entry.phaseOutcome || PHASE_OUTCOMES.UNKNOWN_FAILURE,
      evidenceSignals: {
        urlChanged: entry.evidenceSignals?.urlChanged === true,
        domChanged: entry.evidenceSignals?.domChanged === true,
        feedbackSeen: entry.evidenceSignals?.feedbackSeen === true,
        networkSeen: entry.evidenceSignals?.networkSeen === true,
      },
      shortReason: (entry.shortReason || '').substring(0, 120),
      details: entry.details || null,
    };

    this.diagnostics.push(diagnostic);
  }

  /**
   * Get all recorded diagnostics
   */
  getAll() {
    return this.diagnostics;
  }

  /**
   * Get diagnostics by expectation ID (for quick lookup)
   */
  getByExpectationId(expectationId) {
    return this.diagnostics.filter(d => d.expectationId === expectationId);
  }

  /**
   * Get count by phase outcome
   */
  countByOutcome() {
    const counts = {};
    for (const diagnostic of this.diagnostics) {
      const outcome = diagnostic.phaseOutcome;
      counts[outcome] = (counts[outcome] || 0) + 1;
    }
    return counts;
  }
}

/**
 * Helper to convert attempt result to diagnostic entry
 * Deterministically classifies attempt reasons to phase outcomes.
 */
export function attemptToDiagnostic(expectation, attempt) {
  const expectationId = expectation.id;
  const kind = expectation.category || expectation.type || 'other';
  const sourceRef = expectation.source
    ? {
        file: expectation.source.file || null,
        line: expectation.source.line || null,
      }
    : null;
  const selector = expectation.selector || expectation.promise?.selector || null;

  // Determine phase outcome from attempt reason and signals
  let phaseOutcome = PHASE_OUTCOMES.UNKNOWN_FAILURE;
  let shortReason = attempt.reason || 'unknown';

  if (attempt.reason === 'success' || attempt.reason === 'acknowledged') {
    phaseOutcome = PHASE_OUTCOMES.SUCCESS;
    shortReason = 'Expectation met';
  } else if (attempt.reason === 'selector-not-found') {
    phaseOutcome = PHASE_OUTCOMES.SELECTOR_NOT_FOUND;
    shortReason = 'Element selector not found in DOM';
  } else if (attempt.reason === 'element-not-visible') {
    phaseOutcome = PHASE_OUTCOMES.ELEMENT_HIDDEN;
    shortReason = 'Element found but hidden from view';
  } else if (attempt.reason === 'element-disabled') {
    phaseOutcome = PHASE_OUTCOMES.ELEMENT_DISABLED;
    shortReason = 'Element found but disabled';
  } else if (attempt.reason === 'not-clickable') {
    phaseOutcome = PHASE_OUTCOMES.NOT_CLICKABLE;
    shortReason = 'Element not in clickable state';
  } else if (attempt.reason === 'navigation-timeout') {
    phaseOutcome = PHASE_OUTCOMES.NAV_TIMEOUT;
    shortReason = 'Navigation did not complete in time';
  } else if (attempt.reason === 'outcome-timeout') {
    phaseOutcome = PHASE_OUTCOMES.OUTCOME_TIMEOUT;
    shortReason = 'Expectation not met within timeout';
  } else if (attempt.reason === 'blocked-by-auth') {
    phaseOutcome = PHASE_OUTCOMES.BLOCKED_BY_AUTH;
    shortReason = 'Action blocked by authentication state';
  } else if (attempt.reason === 'runtime-not-ready') {
    phaseOutcome = PHASE_OUTCOMES.RUNTIME_NOT_READY;
    shortReason = 'Runtime not ready for interaction';
  } else if (attempt.reason === 'unsupported-promise') {
    phaseOutcome = PHASE_OUTCOMES.UNSUPPORTED_PROMISE;
    shortReason = 'Expectation type not supported';
  } else if (attempt.reason?.startsWith('error:')) {
    phaseOutcome = PHASE_OUTCOMES.UNKNOWN_FAILURE;
    const errorMsg = attempt.reason.substring(6);
    shortReason = `Error: ${errorMsg.substring(0, 110)}`;
  }

  // Build evidence signals from attempt
  const evidenceSignals = {
    urlChanged: attempt.evidence?.urlChanged === true,
    domChanged: attempt.evidence?.domChanged === true,
    feedbackSeen: attempt.signals?.feedbackSeen === true,
    networkSeen: attempt.evidence?.networkRequestCount > 0,
  };

  return {
    expectationId,
    kind,
    sourceRef,
    selector,
    phaseOutcome,
    evidenceSignals,
    shortReason,
    details: {
      actionTaken: attempt.action || null,
    },
  };
}

export { PHASE_OUTCOMES };
