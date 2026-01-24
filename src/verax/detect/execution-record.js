/**
 * STAGE 5.1: Execution Record
 * 
 * Track execution state for every promise.
 * 
 * EXECUTION RECORD:
 * - attempted: boolean - was execution attempted?
 * - observed: boolean - was outcome observed?
 * - skipped: boolean - was execution skipped?
 * - skipReason: string - why was it skipped?
 * - evidenceRefs: Array<string> - references to evidence
 * 
 * NO SILENT SKIPS: Every promise must have an execution record.
 * NO AMBIGUITY: Every state must be explicit.
 */

/**
 * Execution state types
 */
export const EXECUTION_STATES = {
  ATTEMPTED_AND_OBSERVED: 'attempted_and_observed',
  ATTEMPTED_NOT_OBSERVED: 'attempted_not_observed',
  SKIPPED: 'skipped',
};

/**
 * Create execution record from promise and observation
 * 
 * @param {Object} promiseCapture - Promise from STAGE 3
 * @param {Object|null} observation - Observation from STAGE 3
 * @param {string|null} [explicitSkipReason] - Optional explicit skip reason
 * @returns {Object} - Execution record
 */
export function createExecutionRecord(promiseCapture, observation, explicitSkipReason = null) {
  const promiseId = promiseCapture.id;
  // Use `kind` as the public field for tests; fall back to `promiseKind`
  const promiseKind = promiseCapture.kind ?? promiseCapture.promiseKind ?? 'unknown';

  // Determine execution flags based on provided observation/skip
  let attempted = false;
  let observed = false;
  let skipped = false;

  if (explicitSkipReason) {
    attempted = false;
    observed = false;
    skipped = true;
  } else if (observation) {
    // If we have an observation entry, consider it attempted
    attempted = observation.attempted ?? true;
    observed = observation.observed ?? false;
    skipped = false;
  } else {
    // No observation provided → treat as skipped (unclassified)
    attempted = false;
    observed = false;
    skipped = true;
  }

  // Extract skip reason
  let skipReason = null;
  if (skipped) {
    skipReason = explicitSkipReason || observation?.skipReason || observation?.reason || 'unknown';
  }

  // Extract evidence refs (optional, not asserted in tests)
  const evidenceRefs = [];
  if (observation?.evidenceFiles) {
    evidenceRefs.push(...observation.evidenceFiles);
  }
  if (observation?.signals) {
    Object.keys(observation.signals).forEach(signal => {
      if (observation.signals[signal]) {
        evidenceRefs.push(`signal:${signal}`);
      }
    });
  }

  return {
    promiseId,
    promiseKind,
    attempted,
    observed,
    skipped,
    skipReason,
    evidenceRefs: evidenceRefs.sort(),
    state: deriveExecutionState(attempted, observed, skipped),
  };
}

/**
 * Derive execution state from flags
 * 
 * @param {boolean} attempted - Was execution attempted?
 * @param {boolean} observed - Was outcome observed?
 * @param {boolean} skipped - Was execution skipped?
 * @returns {string} - EXECUTION_STATES value
 */
function deriveExecutionState(attempted, observed, skipped) {
  if (skipped) {
    return EXECUTION_STATES.SKIPPED;
  }

  if (attempted && observed) {
    return EXECUTION_STATES.ATTEMPTED_AND_OBSERVED;
  }

  if (attempted && !observed) {
    return EXECUTION_STATES.ATTEMPTED_NOT_OBSERVED;
  }

  // Should never reach here if skipped is properly set
  return EXECUTION_STATES.SKIPPED;
}

/**
 * Validate execution record structure
 * 
 * @param {Object} executionRecord - Execution record
 * @returns {Object} - { valid: boolean, errors: Array<string> }
 */
export function validateExecutionRecord(executionRecord) {
  const errors = [];

  // Required fields
  const requiredFields = ['promiseId', 'attempted', 'observed', 'skipped', 'state'];
  for (const field of requiredFields) {
    if (executionRecord[field] === undefined && executionRecord[field] !== false) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate booleans
  if (typeof executionRecord.attempted !== 'boolean') {
    errors.push('attempted must be boolean');
  }
  if (typeof executionRecord.observed !== 'boolean') {
    errors.push('observed must be boolean');
  }
  if (typeof executionRecord.skipped !== 'boolean') {
    errors.push('skipped must be boolean');
  }

  // Validate skip reason required when skipped
  if (executionRecord.skipped && !executionRecord.skipReason) {
    errors.push('skipReason required when skipped=true');
  }

  // Validate state consistency
  if (executionRecord.skipped && executionRecord.attempted) {
    errors.push('Inconsistent state: skipped=true but attempted=true');
  }

  if (executionRecord.observed && !executionRecord.attempted) {
    errors.push('Inconsistent state: observed=true but attempted=false');
  }

  // Validate evidenceRefs is array when present
  if (executionRecord.evidenceRefs !== undefined && !Array.isArray(executionRecord.evidenceRefs)) {
    errors.push('evidenceRefs must be an array');
  }

  return errors;
}

/**
 * Check if execution record is complete
 * 
 * @param {Object} executionRecord - Execution record
 * @returns {boolean}
 */
export function isExecutionComplete(executionRecord) {
  return executionRecord.attempted && executionRecord.observed;
}

/**
 * Check if execution was attempted but not observed
 * 
 * @param {Object} executionRecord - Execution record
 * @returns {boolean}
 */
export function isExecutionIncomplete(executionRecord) {
  return executionRecord.attempted && !executionRecord.observed;
}

/**
 * Create execution records for all promises
 * 
 * Ensures EVERY promise has an execution record.
 * 
 * @param {Array<Object>} promiseCaptures - Promise captures
 * @param {Array<Object>} observations - Observations
 * @returns {Array<Object>} - Execution records
 */
export function createExecutionRecords(promiseCaptures, observations, skips = []) {
  // Index observations and skips by promiseId (test contract)
  const observationMap = new Map();
  for (const obs of observations || []) {
    const id = obs.promiseId ?? obs.id;
    if (id) {
      observationMap.set(id, {
        attempted: obs.attempted ?? true,
        observed: obs.observed ?? false,
        skipReason: obs.skipReason ?? null,
        evidenceFiles: obs.evidenceFiles ?? [],
        signals: obs.signals ?? null,
      });
    }
  }

  const skipMap = new Map();
  for (const s of skips || []) {
    if (s.promiseId) {
      skipMap.set(s.promiseId, s.reason || 'unknown');
    }
  }

  // Create execution record for each promise
  const executionRecords = [];
  for (const promise of promiseCaptures || []) {
    const explicitSkipReason = skipMap.get(promise.id) ?? null;
    const observation = observationMap.get(promise.id) ?? null;
    const record = createExecutionRecord(promise, observation, explicitSkipReason ?? undefined);
    // If no observation and no explicit skip, mark as skipped with unclassified reason
    if (!observation && !explicitSkipReason) {
      record.skipped = true;
      record.skipReason = 'no_observation';
      record.state = deriveExecutionState(record.attempted, record.observed, record.skipped);
    }
    executionRecords.push(record);
  }

  return executionRecords;
}
