/**
 * PHASE 2: Canonical Type System for VERAX
 * 
 * Single source of truth for all valid types in the analysis pipeline:
 * - EXPECTATION_TYPE: Types of expectations extracted from source code
 * - FINDING_TYPE: Types of findings detected during analysis
 * - SKIP_REASON: Structured reasons why expectations were skipped
 * 
 * Validation happens at CREATION TIME, not at enforcement time.
 * No object may be created with an invalid type.
 */

/**
 * Valid expectation types extracted from source code.
 * These represent what the code is expected to do.
 */
export const EXPECTATION_TYPE = Object.freeze({
  // Navigation: Expects a URL change or page navigation
  NAVIGATION: 'navigation',
  
  // Network: Expects a network call to be made
  NETWORK: 'network',
  
  // State: Expects a state change or promise fulfillment
  STATE: 'state',
});

/**
 * Valid finding types detected during analysis.
 * These represent what the code is NOT doing that it should be.
 */
export const FINDING_TYPE = Object.freeze({
  // Silent Failures: Expectation not met with no observable effect
  SILENT_FAILURE: 'silent_failure',
  NETWORK_SILENT_FAILURE: 'network_silent_failure',
  VALIDATION_SILENT_FAILURE: 'validation_silent_failure',
  FLOW_SILENT_FAILURE: 'flow_silent_failure',
  DYNAMIC_ROUTE_SILENT_FAILURE: 'dynamic_route_silent_failure',
  
  // Observable Breaks: Expectation not met with visible effects
  OBSERVED_BREAK: 'observed_break',
  
  // UI Feedback: Missing user feedback after action
  MISSING_FEEDBACK_FAILURE: 'missing_feedback_failure',
  CSS_LOADING_FEEDBACK_FAILURE: 'css_loading_feedback_failure',
  
  // Route Issues: Problems with dynamic route detection
  DYNAMIC_ROUTE_MISMATCH: 'dynamic_route_mismatch',
  
  // Interactive: Issues with interactive elements
  NAVIGATION_SILENT_FAILURE: 'navigation_silent_failure',
  JOURNEY_STALL_SILENT_FAILURE: 'journey_stall_silent_failure',
  
  // Network: Issues with network calls
  MISSING_NETWORK_ACTION: 'missing_network_action',
  NETWORK_SUCCESS_NO_FEEDBACK: 'network_success_no_feedback',
});

/**
 * Structured reasons why expectations were skipped (not analyzed).
 * Distinguish between systemic failures and intentional filtering.
 */
export const SKIP_REASON = Object.freeze({
  // Systemic Failures: Pipeline cannot continue (force INCOMPLETE state)
  NO_EXPECTATIONS_EXTRACTED: 'NO_EXPECTATIONS_EXTRACTED',
  TIMEOUT_OBSERVE: 'TIMEOUT_OBSERVE',
  TIMEOUT_DETECT: 'TIMEOUT_DETECT',
  TIMEOUT_TOTAL: 'TIMEOUT_TOTAL',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  MISSING_SOURCE_DIR: 'MISSING_SOURCE_DIR',
  UNREACHABLE_URL: 'UNREACHABLE_URL',
  
  // Intentional Filtering: Skips that don't indicate truncation (COMPLETE is allowed)
  DYNAMIC_ROUTE_UNSUPPORTED: 'DYNAMIC_ROUTE_UNSUPPORTED',
  EXTERNAL_URL_SKIPPED: 'EXTERNAL_URL_SKIPPED',
  PARSE_ERROR: 'PARSE_ERROR',
  UNSUPPORTED_FILE: 'UNSUPPORTED_FILE',
  OBSERVATION_FAILED: 'OBSERVATION_FAILED',
  CONTRACT_VIOLATION: 'CONTRACT_VIOLATION',
});

/**
 * Validate that a type string is a valid expectation type.
 * @param {string} type - The type to validate
 * @returns {boolean} True if valid
 * @throws {Error} If invalid
 */
export function validateExpectationType(type) {
  // @ts-expect-error - Runtime string comparison against enum values
  if (!Object.values(EXPECTATION_TYPE).includes(type)) {
    throw new Error(
      `Invalid expectation type: "${type}". Must be one of: ${Object.values(EXPECTATION_TYPE).join(', ')}`
    );
  }
  return true;
}

/**
 * Validate that a type string is a valid finding type.
 * @param {string} type - The type to validate
 * @returns {boolean} True if valid
 * @throws {Error} If invalid
 */
export function validateFindingType(type) {
  // @ts-expect-error - Runtime string comparison against enum values
  if (!Object.values(FINDING_TYPE).includes(type)) {
    throw new Error(
      `Invalid finding type: "${type}". Must be one of: ${Object.values(FINDING_TYPE).join(', ')}`
    );
  }
  return true;
}

/**
 * Validate that a reason is a valid skip reason.
 * @param {string} reason - The reason to validate
 * @returns {string} Normalized valid skip reason
 * @throws {Error} If invalid and cannot be normalized
 */
export function validateSkipReason(reason) {
  // CRASH GUARD: Normalize undefined/invalid reasons instead of throwing
  if (reason === undefined || reason === null || reason === 'undefined') {
    console.warn(`[VERAX] Invalid skip reason "${reason}" normalized to OBSERVATION_FAILED`);
    return SKIP_REASON.OBSERVATION_FAILED;
  }
  
  // @ts-expect-error - Runtime string comparison against enum values
  if (!Object.values(SKIP_REASON).includes(reason)) {
    console.warn(`[VERAX] Unknown skip reason "${reason}" normalized to OBSERVATION_FAILED`);
    return SKIP_REASON.OBSERVATION_FAILED;
  }
  return reason;
}

/**
 * Check if a skip reason is a systemic failure.
 * Systemic failures force analysis state to INCOMPLETE.
 * @param {string} reason - The skip reason
 * @returns {boolean} True if this is a systemic failure
 */
export function isSystemicFailure(reason) {
  const systemicFailures = [
    SKIP_REASON.NO_EXPECTATIONS_EXTRACTED,
    SKIP_REASON.TIMEOUT_OBSERVE,
    SKIP_REASON.TIMEOUT_DETECT,
    SKIP_REASON.TIMEOUT_TOTAL,
    SKIP_REASON.BUDGET_EXCEEDED,
    SKIP_REASON.MISSING_SOURCE_DIR,
    SKIP_REASON.UNREACHABLE_URL,
  ];
  // @ts-expect-error - Runtime string comparison against enum values
  return systemicFailures.includes(reason);
}
