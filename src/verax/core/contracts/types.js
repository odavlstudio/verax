/**
 * VERAX Core Contracts - Canonical Type Definitions
 * 
 * This module defines the single source of truth for all core VERAX types:
 * Finding, Evidence, Observation, Confidence, and associated enums.
 * 
 * These definitions enforce strict runtime contracts and form the foundation
 * for the Evidence Law: findings without sufficient evidence cannot be Confirmed.
 */

/**
 * Confidence Levels - measure of certainty in a finding
 */
export const CONFIDENCE_LEVEL = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  UNPROVEN: 'UNPROVEN'
};

/**
 * Finding Status - the evaluation outcome
 */
export const FINDING_STATUS = {
  CONFIRMED: 'CONFIRMED',      // Evidence law satisfied: sufficient evidence exists
  SUSPECTED: 'SUSPECTED',      // Needs evidence: signal observed but evidence incomplete
  INFORMATIONAL: 'INFORMATIONAL', // Observation recorded, no claim of failure
  UNPROVEN: 'UNPROVEN',        // Evidence Law v1: insufficient evidence to support claim
  DROPPED: 'DROPPED'           // Violated contracts, removed from report
};

/**
 * Finding Type - category of silent failure
 */
export const FINDING_TYPE = {
  NAVIGATION_SILENT_FAILURE: 'navigation_silent_failure',
  NETWORK_SILENT_FAILURE: 'network_silent_failure',
  STATE_SILENT_FAILURE: 'state_silent_failure',
  OBSERVED_BREAK: 'observed_break',
  SILENT_FAILURE: 'silent_failure',
  FLOW_SILENT_FAILURE: 'flow_silent_failure'
};

/**
 * Impact Level - severity of the silence
 */
export const IMPACT = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
};

/**
 * User Risk - how the silence affects the user
 */
export const USER_RISK = {
  BLOCKS: 'BLOCKS',       // User action is blocked from completion
  CONFUSES: 'CONFUSES',   // User is confused about what happened
  DEGRADES: 'DEGRADES'    // User experience is degraded
};

/**
 * Ownership - which layer failed
 */
export const OWNERSHIP = {
  FRONTEND: 'FRONTEND',
  BACKEND: 'BACKEND',
  INTEGRATION: 'INTEGRATION',
  ACCESSIBILITY: 'ACCESSIBILITY',
  PERFORMANCE: 'PERFORMANCE'
};

/**
 * Evidence Type - what provides proof
 */
export const EVIDENCE_TYPE = {
  NETWORK_ACTIVITY: 'network_activity',
  DOM_CHANGE: 'dom_change',
  STATE_CHANGE: 'state_change',
  URL_CHANGE: 'url_change',
  SCREENSHOT: 'screenshot',
  CONSOLE_OUTPUT: 'console_output',
  SENSOR_DATA: 'sensor_data'
};

/**
 * Canonical Finding Interface
 * 
 * @typedef {Object} Finding
 * @property {string} type - One of FINDING_TYPE
 * @property {string} [status] - One of FINDING_STATUS (defaults to SUSPECTED if evidence insufficient)
 * @property {Object} interaction - The user interaction that triggered analysis
 * @property {Object} evidence - Proof of the gap (REQUIRED for CONFIRMED status)
 * @property {Object} confidence - Certainty assessment
 * @property {Object} signals - Impact classification (impact, userRisk, ownership, grouping)
 * @property {string} what_happened - Factual description of what occurred
 * @property {string} what_was_expected - Factual description of code promise
 * @property {string} what_was_observed - Factual description of observed outcome
 * @property {string} why_it_matters - Human explanation of the gap
 * @property {string} [humanSummary] - Human-readable summary
 * @property {string} [actionHint] - Recommended next step
 * @property {Object} [promise] - Promise descriptor from source code
 * @property {string} [id] - Optional unique identifier
 * @property {string} [findingId] - Optional deterministic ID based on expectation
 * @property {string} [expectationId] - Optional reference to matched expectation
 */

/**
 * Canonical Evidence Interface
 * 
 * @typedef {Object} Evidence
 * @property {string} [type] - One of EVIDENCE_TYPE
 * @property {boolean} [hasDomChange] - Whether DOM structure changed
 * @property {boolean} [hasUrlChange] - Whether URL changed
 * @property {boolean} [hasNetworkActivity] - Whether network requests occurred
 * @property {boolean} [hasStateChange] - Whether application state changed
 * @property {string} [beforeUrl] - URL before interaction
 * @property {string} [afterUrl] - URL after interaction
 * @property {string} [before] - Before state (screenshot path or data)
 * @property {string} [after] - After state (screenshot path or data)
 * @property {Object} [beforeDom] - DOM structure before
 * @property {Object} [afterDom] - DOM structure after
 * @property {Array} [networkRequests] - Network activity captured
 * @property {Array} [consoleLogs] - Console messages
 * @property {Object} [sensors] - Sensor data (navigation, uiSignals, etc.)
 * @property {string} [source] - Source file reference
 * @property {string} [expectedTarget] - Expected target for navigation/network
 * @property {boolean} [targetReached] - Whether expected target was reached
 */

/**
 * Canonical Confidence Interface
 * 
 * @typedef {Object} Confidence
 * @property {string} level - One of CONFIDENCE_LEVEL
 * @property {number} score - 0-100 confidence percentage
 * @property {Array} [factors] - List of confidence factors
 * @property {string} [explanation] - Detailed explanation of confidence level
 */

/**
 * Canonical Observation Interface
 * 
 * @typedef {Object} Observation
 * @property {string} type - Type of observation
 * @property {string} selector - Element selector
 * @property {string} label - Human-readable label
 * @property {Object} sensors - Sensor readings before and after
 * @property {Array} [evidence] - Array of evidence items from observation
 */

/**
 * Canonical Signals Interface
 * 
 * @typedef {Object} Signals
 * @property {string} impact - One of IMPACT
 * @property {string} userRisk - One of USER_RISK
 * @property {string} ownership - One of OWNERSHIP
 * @property {Object} grouping - Grouping metadata
 * @property {string} [grouping.groupByRoute] - Route pattern
 * @property {string} [grouping.groupByFailureType] - Type of failure
 * @property {string} [grouping.groupByFeature] - Feature area
 */

/**
 * Verify all enum exports are available
 */
export const ALL_ENUMS = {
  CONFIDENCE_LEVEL,
  FINDING_STATUS,
  FINDING_TYPE,
  IMPACT,
  USER_RISK,
  OWNERSHIP,
  EVIDENCE_TYPE
};

export default {
  CONFIDENCE_LEVEL,
  FINDING_STATUS,
  FINDING_TYPE,
  IMPACT,
  USER_RISK,
  OWNERSHIP,
  EVIDENCE_TYPE
};



