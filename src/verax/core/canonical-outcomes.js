/**
 * CANONICAL OUTCOME TAXONOMY
 * 
 * Single source of truth for all outcome classifications in VERAX.
 * Every interaction outcome, silence, gap, and finding must map to exactly ONE of these types.
 * 
 * NO free-form or implicit outcome types allowed.
 * NO semantic drift between outputs.
 */

/**
 * Canonical Outcome Types - Mutually Exclusive Categories
 */
export const CANONICAL_OUTCOMES = {
  // Code/user interaction broke (promise unmet, expectation failed)
  SILENT_FAILURE: 'SILENT_FAILURE',
  
  // Evaluation was not completed due to time/interaction/data limits (not a failure, just incomplete coverage)
  COVERAGE_GAP: 'COVERAGE_GAP',
  
  // Interaction executed but outcome cannot be asserted (ambiguity: SPA fallback, no DOM change signal, missing sensor)
  UNPROVEN_INTERACTION: 'UNPROVEN_INTERACTION',
  
  // Intentionally prevented (destructive action, external navigation, safety policy)
  SAFETY_BLOCK: 'SAFETY_BLOCK',
  
  // No problem detected; for informational artifacts (e.g., expectations without matching interactions)
  INFORMATIONAL: 'INFORMATIONAL'
};

/**
 * Outcome Definitions - For documentation and validation
 */
export const OUTCOME_DEFINITIONS = {
  SILENT_FAILURE: {
    title: 'Silent Failure',
    description: 'User action executed, code ran, but expected observable change did not occur and no error was presented to user',
    example: 'User clicks "Save" → page loads without spinning wheel → data is not saved but user receives no error message',
    implication: 'Gap between user expectation and actual system behavior'
  },
  
  COVERAGE_GAP: {
    title: 'Coverage Gap',
    description: 'Interaction or expectation discovered but not evaluated due to scan budget limit (time, page count, interaction count)',
    example: '500 pages discovered but scan budget allows only 100 pages → 400 pages not evaluated',
    implication: 'Incomplete scan; behaviors on skipped interactions are unknown'
  },
  
  UNPROVEN_INTERACTION: {
    title: 'Unproven Interaction',
    description: 'Interaction executed but outcome ambiguous: no expectation matched, or observable change is ambiguous, or expectation-driven path failed',
    example: 'User clicks SPA link → no observable change (SPA routing ambiguous) → cannot assert if routing worked or if feature is broken',
    implication: 'Behavior is unknown; cannot determine if code matches reality'
  },
  
  SAFETY_BLOCK: {
    title: 'Safety Block',
    description: 'Interaction prevented intentionally: destructive text, external navigation, or safety policy blocks execution',
    example: 'User clicks "Delete Account" → blocked by safety policy → behavior untested',
    implication: 'Intentional limitation; not a failure, just a boundary'
  },
  
  INFORMATIONAL: {
    title: 'Informational',
    description: 'Metadata or artifact without direct outcome status (e.g., expectation defined but no matching interaction found)',
    example: 'Manifest defines logout expectation → but no logout interaction discovered on site',
    implication: 'Context for interpretation but not a test failure or success'
  }
};

/**
 * Map silence reason codes to canonical outcomes
 * 
 * Used by SilenceTracker and verdict-engine to classify silence entries
 * with explicit outcome types.
 */
export function mapSilenceReasonToOutcome(reason) {
  // Timeouts, failures → SILENT_FAILURE (promise unmet)
  if (reason.includes('timeout') || reason.includes('failed') || reason.includes('error')) {
    return CANONICAL_OUTCOMES.SILENT_FAILURE;
  }
  
  // Budget/limit exceeded → COVERAGE_GAP (incomplete scan)
  if (reason.includes('budget') || reason.includes('limit') || reason.includes('exceeded')) {
    return CANONICAL_OUTCOMES.COVERAGE_GAP;
  }
  
  // Safety/destructive/external → SAFETY_BLOCK (intentional)
  if (reason.includes('destructive') || reason.includes('external') || reason.includes('unsafe') || reason.includes('safety')) {
    return CANONICAL_OUTCOMES.SAFETY_BLOCK;
  }
  
  // Incremental reuse → COVERAGE_GAP (unchanged, so gap in new scan)
  if (reason.includes('incremental')) {
    return CANONICAL_OUTCOMES.COVERAGE_GAP;
  }
  
  // No expectation found → INFORMATIONAL (metadata, not a test result)
  if (reason.includes('no_expectation')) {
    return CANONICAL_OUTCOMES.INFORMATIONAL;
  }
  
  // Discovery error (selector mismatch, link not found) → COVERAGE_GAP (could not evaluate)
  if (reason.includes('discovery') || reason.includes('no_matching_selector')) {
    return CANONICAL_OUTCOMES.COVERAGE_GAP;
  }
  
  // Sensor unavailable → COVERAGE_GAP (incomplete data)
  if (reason.includes('sensor')) {
    return CANONICAL_OUTCOMES.COVERAGE_GAP;
  }
  
  // Default: treat as coverage gap if unknown
  return CANONICAL_OUTCOMES.COVERAGE_GAP;
}

/**
 * Map finding type to canonical outcome
 * 
 * Used by finding-detector.js to classify findings explicitly
 */
export function mapFindingTypeToOutcome(findingType) {
  // All forms of silent failure → SILENT_FAILURE
  if (findingType.includes('silent_failure') || 
      findingType.includes('unobserved') ||
      findingType.includes('observed_break')) {
    return CANONICAL_OUTCOMES.SILENT_FAILURE;
  }
  
  // Default to SILENT_FAILURE for findings (they represent observed problems)
  return CANONICAL_OUTCOMES.SILENT_FAILURE;
}

/**
 * Validate that an outcome is canonical
 */
export function isValidOutcome(outcome) {
  return Object.values(CANONICAL_OUTCOMES).includes(outcome);
}

/**
 * Format outcome for human display
 */
export function formatOutcomeForDisplay(outcome) {
  if (!isValidOutcome(outcome)) {
    throw new Error(`Invalid outcome type: ${outcome}`);
  }
  
  const definition = OUTCOME_DEFINITIONS[outcome];
  return {
    type: outcome,
    title: definition.title,
    description: definition.description
  };
}

export default CANONICAL_OUTCOMES;
