/**
 * Verdict mapping utilities
 * Canonical user-facing verdicts: READY, FRICTION, DO_NOT_LAUNCH
 * Internal engine verdicts (legacy): OBSERVED, PARTIAL, INSUFFICIENT_DATA
 */

function toCanonicalVerdict(internalVerdict) {
  switch (String(internalVerdict || '').toUpperCase()) {
    // Internal engine verdicts
    case 'OBSERVED':
      return 'READY';
    case 'PARTIAL':
      return 'FRICTION';
    case 'INSUFFICIENT_DATA':
      return 'DO_NOT_LAUNCH';
    // Synonyms from other components
    case 'PASS':
    case 'SUCCESS':
      return 'READY';
    case 'WARN':
    case 'WARNING':
    case 'FRICTION':
      return 'FRICTION';
    case 'FAIL':
    case 'FAILURE':
    case 'DO_NOT_LAUNCH':
      return 'DO_NOT_LAUNCH';
    default:
      return 'DO_NOT_LAUNCH';
  }
}

function toInternalVerdict(canonicalVerdict) {
  switch (String(canonicalVerdict || '').toUpperCase()) {
    case 'READY':
      return 'OBSERVED';
    case 'FRICTION':
      return 'PARTIAL';
    case 'DO_NOT_LAUNCH':
      return 'INSUFFICIENT_DATA';
    default:
      return 'INSUFFICIENT_DATA';
  }
}

function mapExitCodeFromCanonical(canonicalVerdict) {
  switch (String(canonicalVerdict || '').toUpperCase()) {
    case 'READY':
      return 0;
    case 'FRICTION':
      return 1;
    case 'DO_NOT_LAUNCH':
    default:
      return 2;
  }
}

// Alias for toCanonicalVerdict - used for clarity in some contexts
function normalizeCanonicalVerdict(verdict) {
  return toCanonicalVerdict(verdict);
}

module.exports = { toCanonicalVerdict, toInternalVerdict, mapExitCodeFromCanonical, normalizeCanonicalVerdict };

// Journey scan mapping (SAFE/RISK/DO_NOT_LAUNCH → canonical)
function toCanonicalJourneyVerdict(journeyVerdict) {
  switch (String(journeyVerdict || '').toUpperCase()) {
    case 'SAFE':
      return 'READY';
    case 'RISK':
      return 'FRICTION';
    case 'DO_NOT_LAUNCH':
      return 'DO_NOT_LAUNCH';
    default:
      return 'DO_NOT_LAUNCH';
  }
}

module.exports.toCanonicalJourneyVerdict = toCanonicalJourneyVerdict;
