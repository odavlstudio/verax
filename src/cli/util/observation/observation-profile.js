/**
 * STAGE 3.1: Promise-Aware Observation Profiles
 * 
 * Maps promise.kind → observationExpectationProfile
 * Profile defines required/optional/forbidden signals and grace period per kind
 * 
 * Non-negotiables:
 * - Deterministic across all promise types
 * - Evidence-driven (only observable signals)
 * - Bounded grace windows
 * - No speculation
 */

/**
 * Base signal types available from observation
 */
const AVAILABLE_SIGNALS = {
  // Navigation signals
  ROUTE_CHANGED: 'routeChanged',
  NAVIGATION_CHANGED: 'navigationChanged',
  URL_CHANGED: 'urlChanged',

  // DOM signals
  DOM_CHANGED: 'domChanged',
  MEANINGFUL_UI_CHANGE: 'meaningfulUIChange',
  CONTENT_APPEARED: 'contentAppeared',

  // Feedback signals
  FEEDBACK_APPEARED: 'feedbackAppeared',
  TOAST_APPEARED: 'toastAppeared',
  MODAL_APPEARED: 'modalAppeared',
  ERROR_MESSAGE_APPEARED: 'errorMessageAppeared',
  SUCCESS_MESSAGE_APPEARED: 'successMessageAppeared',

  // Loading signals
  LOADING_STARTED: 'loadingStarted',
  LOADING_RESOLVED: 'loadingResolved',

  // Network signals
  NETWORK_REQUEST_SENT: 'networkRequestSent',
  NETWORK_RESPONSE_RECEIVED: 'networkResponseReceived',
  NETWORK_SETTLED: 'networkSettled',
  API_ERROR_DETECTED: 'apiErrorDetected',
  API_SUCCESS_DETECTED: 'apiSuccessDetected',

  // Auth signals
  AUTH_REQUIRED_DETECTED: 'authRequiredDetected',
  AUTH_CHALLENGE_DETECTED: 'authChallengeDetected',
};

/**
 * Observation Expectation Profile for each promise kind
 * 
 * @typedef {Object} ObservationProfile
 * @property {string} kind - Promise kind (navigate, network.request, feedback.toast, etc.)
 * @property {Array<string>} requiredSignals - At least ONE of these must appear
 * @property {Array<string>} optionalSignals - May appear, but not required
 * @property {Array<string>} forbiddenSignals - If ANY appear, classify as failure/misleading
 * @property {number} minStabilityWindowMs - Min time signal must persist
 * @property {number} graceTimeoutMs - Max wait for acknowledgment
 */

/**
 * Navigation Promise Profile
 * Expected: URL changes or client-side route change
 */
const NAVIGATE_PROFILE = {
  kind: 'navigate',
  requiredSignals: [
    AVAILABLE_SIGNALS.ROUTE_CHANGED,
    AVAILABLE_SIGNALS.NAVIGATION_CHANGED,
    AVAILABLE_SIGNALS.URL_CHANGED,
  ],
  optionalSignals: [
    AVAILABLE_SIGNALS.DOM_CHANGED,
    AVAILABLE_SIGNALS.CONTENT_APPEARED,
  ],
  forbiddenSignals: [
    // None - navigation is pretty unambiguous
  ],
  minStabilityWindowMs: 500, // Route change must persist
  graceTimeoutMs: 5000, // Max 5s to change route
};

/**
 * Network Request Promise Profile (REST/HTTP)
 * Expected: Network request sent + response handling (success or error)
 */
const NETWORK_REQUEST_PROFILE = {
  kind: 'network.request',
  requiredSignals: [
    AVAILABLE_SIGNALS.NETWORK_REQUEST_SENT,
    AVAILABLE_SIGNALS.NETWORK_RESPONSE_RECEIVED,
  ],
  optionalSignals: [
    AVAILABLE_SIGNALS.LOADING_RESOLVED,
    AVAILABLE_SIGNALS.FEEDBACK_APPEARED,
    AVAILABLE_SIGNALS.DOM_CHANGED,
    AVAILABLE_SIGNALS.API_SUCCESS_DETECTED,
    AVAILABLE_SIGNALS.API_ERROR_DETECTED,
  ],
  forbiddenSignals: [
    // None - network is observable
  ],
  minStabilityWindowMs: 300, // Response must be complete
  graceTimeoutMs: 10000, // Max 10s for network round trip
};

/**
 * GraphQL Promise Profile
 * Expected: GraphQL endpoint request + response
 */
const NETWORK_GRAPHQL_PROFILE = {
  kind: 'network.graphql',
  requiredSignals: [
    AVAILABLE_SIGNALS.NETWORK_REQUEST_SENT,
    AVAILABLE_SIGNALS.NETWORK_RESPONSE_RECEIVED,
  ],
  optionalSignals: [
    AVAILABLE_SIGNALS.LOADING_RESOLVED,
    AVAILABLE_SIGNALS.FEEDBACK_APPEARED,
    AVAILABLE_SIGNALS.DOM_CHANGED,
    AVAILABLE_SIGNALS.API_SUCCESS_DETECTED,
    AVAILABLE_SIGNALS.API_ERROR_DETECTED,
  ],
  forbiddenSignals: [],
  minStabilityWindowMs: 300,
  graceTimeoutMs: 15000, // GraphQL may take longer
};

/**
 * WebSocket Promise Profile
 * Expected: WebSocket connection established + messages exchanged
 */
const NETWORK_WS_PROFILE = {
  kind: 'network.ws',
  requiredSignals: [
    AVAILABLE_SIGNALS.NETWORK_REQUEST_SENT,
    // WebSocket "response" is implicit in connection establishment
  ],
  optionalSignals: [
    AVAILABLE_SIGNALS.DOM_CHANGED,
    AVAILABLE_SIGNALS.FEEDBACK_APPEARED,
  ],
  forbiddenSignals: [],
  minStabilityWindowMs: 200,
  graceTimeoutMs: 5000, // Connection should establish quickly
};

/**
 * Feedback Promise Profile (Toast, Modal, etc.)
 * Expected: Feedback element appears + remains visible for observable window
 */
const FEEDBACK_TOAST_PROFILE = {
  kind: 'feedback.toast',
  requiredSignals: [
    AVAILABLE_SIGNALS.TOAST_APPEARED,
    AVAILABLE_SIGNALS.FEEDBACK_APPEARED,
  ],
  optionalSignals: [
    AVAILABLE_SIGNALS.SUCCESS_MESSAGE_APPEARED,
    AVAILABLE_SIGNALS.ERROR_MESSAGE_APPEARED,
  ],
  forbiddenSignals: [
    // Spinner alone is not sufficient acknowledgment for feedback promise
    AVAILABLE_SIGNALS.LOADING_STARTED,
  ],
  minStabilityWindowMs: 400, // Toast must be visible long enough to read
  graceTimeoutMs: 3000, // Toast should appear quickly
};

/**
 * Modal/Dialog Feedback Profile
 * Expected: Modal appears + is interactive
 */
const FEEDBACK_MODAL_PROFILE = {
  kind: 'feedback.modal',
  requiredSignals: [
    AVAILABLE_SIGNALS.MODAL_APPEARED,
    AVAILABLE_SIGNALS.DOM_CHANGED,
  ],
  optionalSignals: [
    AVAILABLE_SIGNALS.FEEDBACK_APPEARED,
    AVAILABLE_SIGNALS.CONTENT_APPEARED,
  ],
  forbiddenSignals: [
    AVAILABLE_SIGNALS.LOADING_STARTED,
  ],
  minStabilityWindowMs: 500, // Modal must remain visible
  graceTimeoutMs: 3000,
};

/**
 * Notification/Snackbar Feedback Profile
 */
const FEEDBACK_NOTIFICATION_PROFILE = {
  kind: 'feedback.notification',
  requiredSignals: [
    AVAILABLE_SIGNALS.FEEDBACK_APPEARED,
  ],
  optionalSignals: [
    AVAILABLE_SIGNALS.SUCCESS_MESSAGE_APPEARED,
    AVAILABLE_SIGNALS.ERROR_MESSAGE_APPEARED,
    AVAILABLE_SIGNALS.DOM_CHANGED,
  ],
  forbiddenSignals: [
    AVAILABLE_SIGNALS.LOADING_STARTED,
  ],
  minStabilityWindowMs: 300,
  graceTimeoutMs: 3000,
};

/**
 * State Change Promise Profile
 * Expected: DOM change OR state mutation with observable UI effect
 */
const STATE_PROMISE_PROFILE = {
  kind: 'state',
  requiredSignals: [
    AVAILABLE_SIGNALS.DOM_CHANGED,
    AVAILABLE_SIGNALS.MEANINGFUL_UI_CHANGE,
  ],
  optionalSignals: [
    AVAILABLE_SIGNALS.CONTENT_APPEARED,
    AVAILABLE_SIGNALS.FEEDBACK_APPEARED,
  ],
  forbiddenSignals: [
    // Spinner-only without meaningful UI change is weak
  ],
  minStabilityWindowMs: 400, // UI change must persist
  graceTimeoutMs: 5000,
};

/**
 * Complete profile map by kind
 */
export const OBSERVATION_PROFILES = {
  // Navigation
  navigate: NAVIGATE_PROFILE,

  // Network
  'network.request': NETWORK_REQUEST_PROFILE,
  'network.graphql': NETWORK_GRAPHQL_PROFILE,
  'network.ws': NETWORK_WS_PROFILE,

  // Feedback
  'feedback.toast': FEEDBACK_TOAST_PROFILE,
  'feedback.modal': FEEDBACK_MODAL_PROFILE,
  'feedback.notification': FEEDBACK_NOTIFICATION_PROFILE,

  // State
  state: STATE_PROMISE_PROFILE,
  'state.redux': STATE_PROMISE_PROFILE,
  'state.zustand': STATE_PROMISE_PROFILE,
  'state.react': STATE_PROMISE_PROFILE,
};

/**
 * Get observation profile for a promise
 * 
 * @param {Object} promise - Promise object with kind property
 * @returns {Object|null} ObservationProfile or null if not found
 */
export function getObservationProfile(promise) {
  if (!promise || !promise.kind) {
    return null;
  }

  const profile = OBSERVATION_PROFILES[promise.kind];
  if (!profile) {
    // Return generic profile for unknown kinds
    return {
      kind: promise.kind,
      requiredSignals: [
        AVAILABLE_SIGNALS.DOM_CHANGED,
        AVAILABLE_SIGNALS.FEEDBACK_APPEARED,
      ],
      optionalSignals: [
        AVAILABLE_SIGNALS.LOADING_RESOLVED,
      ],
      forbiddenSignals: [],
      minStabilityWindowMs: 300,
      graceTimeoutMs: 5000,
    };
  }

  return profile;
}

/**
 * Validate if signals satisfy profile requirements
 * 
 * @param {Object} signals - Observed signals object
 * @param {Object} profile - ObservationProfile
 * @returns {Object} {satisfied: boolean, matchedSignals: string[], reason?: string}
 */
export function validateSignalsAgainstProfile(signals, profile) {
  if (!signals || !profile) {
    return { satisfied: false, matchedSignals: [], reason: 'missing-profile-or-signals' };
  }

  // Check forbidden signals first
  const forbiddenMatched = profile.forbiddenSignals.filter(sig => signals[sig] === true);
  if (forbiddenMatched.length > 0) {
    return {
      satisfied: false,
      matchedSignals: forbiddenMatched,
      reason: `forbidden-signals-present: ${forbiddenMatched.join(', ')}`,
    };
  }

  // Check if at least one required signal is present
  const requiredMatched = profile.requiredSignals.filter(sig => signals[sig] === true);
  if (requiredMatched.length === 0) {
    return {
      satisfied: false,
      matchedSignals: [],
      reason: `no-required-signals: required one of [${profile.requiredSignals.join(', ')}]`,
    };
  }

  // Profile satisfied
  const _allMatched = [...requiredMatched, ...profile.optionalSignals.filter(sig => signals[sig] === true)];
  return {
    satisfied: true,
    matchedSignals: requiredMatched,
    optionalMatched: profile.optionalSignals.filter(sig => signals[sig] === true),
  };
}

/**
 * Export signal constants for use in observation code
 */
export { AVAILABLE_SIGNALS };
