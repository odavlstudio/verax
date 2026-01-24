/**
 * STAGE 3.4: Silence Classifier
 * 
 * When acknowledgment.level === 'none', classify why:
 * - TRUE_SILENCE: No signals at all, likely error or hang
 * - SLOW_ACKNOWLEDGMENT: Signals detected after grace timeout
 * - BLOCKED_BY_AUTH: Auth challenge or login redirect required
 * - SERVER_SIDE_ONLY: Backend change, no client-side evidence
 * - UI_RENDER_FAILURE: Promise executed but UI didn't render
 * - NETWORK_TIMEOUT: Request never completed
 * 
 * Deterministic classification based purely on observable evidence
 */

export const SILENCE_KINDS = {
  NONE: 'none',
  TRUE_SILENCE: 'true_silence',
  SLOW_ACKNOWLEDGMENT: 'slow_acknowledgment',
  BLOCKED_BY_AUTH: 'blocked_by_auth',
  SERVER_SIDE_ONLY: 'server_side_only',
  UI_RENDER_FAILURE: 'ui_render_failure',
  NETWORK_TIMEOUT: 'network_timeout',
  USER_NAVIGATION: 'user_navigation',
  RECOVERABLE: 'recoverable',
  UNRECOVERABLE: 'unrecoverable',
};

/**
 * Classify silence when no acknowledgment detected
 * 
 * @typedef {Object} SilenceClassification
 * @property {string} kind - SILENCE_KINDS.*
 * @property {string} reason - Detailed explanation
 * @property {string} evidence - What we observed that led to this classification
 * @property {boolean} recoverable - Whether the silence might be transient
 * 
 * @param {Object} context - Classification context
 * @property {Object} context.signals - Observed signals
 * @property {number} context.elapsedMs - Time waited
 * @property {number} context.graceTimeoutMs - Max grace period
 * @property {Object} context.networkEvents - Network activity
 * @property {Object} context.consoleOutput - Console logs/errors
 * @property {Object} context.domSnapshot - Before/after DOM
 * @property {Array<string>} context.errors - Collected errors
 * @property {boolean} context.userNavigated - User navigated during wait
 * 
 * @returns {SilenceClassification}
 */
export function classifySilence(context = {}) {
  const {
    signals = {},
    elapsedMs = 0,
    graceTimeoutMs = 5000,
    networkEvents: _networkEvents = {},
    consoleOutput: _consoleOutput = {},
    domSnapshot: _domSnapshot = {},
    errors: _errors = [],
    userNavigated = false,
  } = context;

  // Check for user navigation (intentional interruption)
  if (userNavigated) {
    return {
      kind: SILENCE_KINDS.USER_NAVIGATION,
      reason: 'User navigated away during promise evaluation',
      evidence: 'Navigation detected before acknowledgment',
      recoverable: false,
    };
  }

  // Check for auth-related silence
  if (isAuthBlocked(context)) {
    return {
      kind: SILENCE_KINDS.BLOCKED_BY_AUTH,
      reason: 'Promise blocked by authentication requirement',
      evidence: getAuthBlockedEvidence(context),
      recoverable: true,
    };
  }

  // Check for network timeout
  if (isNetworkTimeout(context)) {
    return {
      kind: SILENCE_KINDS.NETWORK_TIMEOUT,
      reason: 'Network request timed out or was never sent',
      evidence: getNetworkTimeoutEvidence(context),
      recoverable: true,
    };
  }

  // Check for UI render failure
  if (isUIRenderFailure(context)) {
    return {
      kind: SILENCE_KINDS.UI_RENDER_FAILURE,
      reason: 'Promise executed but UI did not update',
      evidence: getUIRenderFailureEvidence(context),
      recoverable: false,
    };
  }

  // Check for server-side-only changes
  if (isServerSideOnly(context)) {
    return {
      kind: SILENCE_KINDS.SERVER_SIDE_ONLY,
      reason: 'Backend acknowledged but no client-side change detected',
      evidence: getServerSideOnlyEvidence(context),
      recoverable: false,
    };
  }

  // Check for slow acknowledgment (signals after timeout)
  if (elapsedMs >= graceTimeoutMs && Object.keys(signals).some(k => signals[k] === true)) {
    return {
      kind: SILENCE_KINDS.SLOW_ACKNOWLEDGMENT,
      reason: 'Signals detected but after grace timeout expired',
      evidence: `Waited ${elapsedMs}ms, timeout is ${graceTimeoutMs}ms`,
      recoverable: false,
    };
  }

  // Default: true silence
  return {
    kind: SILENCE_KINDS.TRUE_SILENCE,
    reason: 'No observable acknowledgment detected within timeout',
    evidence: 'No signals, no network activity, no DOM change',
    recoverable: false,
  };
}

/**
 * Check if silence is due to auth blocking
 */
function isAuthBlocked(context) {
  const { consoleOutput = {}, networkEvents = {}, domSnapshot = {}, errors = [] } = context;

  // Look for 401/403 responses
  const authErrors = networkEvents.responses?.filter(r => r.status === 401 || r.status === 403);
  if (authErrors?.length > 0) {
    return true;
  }

  // Look for auth-related console errors
  const authKeywords = ['unauthorized', '401', '403', 'auth', 'login required'];
  const authConsoleErrors = (consoleOutput.errors || []).filter(msg =>
    authKeywords.some(kw => msg.toLowerCase().includes(kw))
  );
  if (authConsoleErrors.length > 0) {
    return true;
  }

  // Look for redirect to login page
  if (domSnapshot.afterHtml?.includes('login') || domSnapshot.afterHtml?.includes('auth')) {
    return true;
  }

  // Look for auth errors in console
  const authErrors2 = errors.filter(e => e.toLowerCase().includes('auth') || e.toLowerCase().includes('login'));
  if (authErrors2.length > 0) {
    return true;
  }

  return false;
}

/**
 * Get evidence for auth blocking
 */
function getAuthBlockedEvidence(context) {
  const { networkEvents = {}, consoleOutput = {} } = context;

  const authErrors = networkEvents.responses?.filter(r => r.status === 401 || r.status === 403);
  if (authErrors?.length > 0) {
    return `Received ${authErrors[0].status} response (auth required)`;
  }

  const authKeywords = ['unauthorized', 'login required'];
  const authConsoleErrors = (consoleOutput.errors || []).filter(msg =>
    authKeywords.some(kw => msg.toLowerCase().includes(kw))
  );
  if (authConsoleErrors.length > 0) {
    return `Console error: ${authConsoleErrors[0]}`;
  }

  return 'Auth-related error detected';
}

/**
 * Check if silence is due to network timeout
 */
function isNetworkTimeout(context) {
  const { networkEvents = {}, elapsedMs = 0, errors = [] } = context;

  // Check for network timeout
  const timeouts = networkEvents.timeouts || [];
  if (timeouts.length > 0) {
    return true;
  }

  // Check for timeout errors
  const timeoutErrors = errors.filter(e => e.toLowerCase().includes('timeout'));
  if (timeoutErrors.length > 0) {
    return true;
  }

  // No response received within timeout window
  if (networkEvents.requestsSent && !networkEvents.responsesReceived && elapsedMs > 100) {
    return true;
  }

  return false;
}

/**
 * Get evidence for network timeout
 */
function getNetworkTimeoutEvidence(context) {
  const { networkEvents = {}, elapsedMs = 0 } = context;

  if (networkEvents.timeouts?.length > 0) {
    return `Network request timed out after ${networkEvents.timeouts[0].waitMs}ms`;
  }

  if (networkEvents.requestsSent && !networkEvents.responsesReceived) {
    return `Sent ${networkEvents.requestsSent} requests but no responses received in ${elapsedMs}ms`;
  }

  return 'Network timeout detected';
}

/**
 * Check if silence is due to UI render failure
 */
function isUIRenderFailure(context) {
  const { domSnapshot = {}, networkEvents = {}, consoleOutput = {} } = context;

  // Network succeeded but DOM didn't change
  if (networkEvents.responsesReceived && !domSnapshot.changed) {
    return true;
  }

  // API call succeeded (200) but no UI update
  const successResponses = networkEvents.responses?.filter(r => r.status >= 200 && r.status < 300);
  if (successResponses?.length > 0 && !domSnapshot.changed) {
    return true;
  }

  // Check for React/render errors
  const renderErrors = (consoleOutput.errors || []).filter(msg =>
    msg.toLowerCase().includes('render') || msg.toLowerCase().includes('component')
  );
  if (renderErrors.length > 0) {
    return true;
  }

  return false;
}

/**
 * Get evidence for UI render failure
 */
function getUIRenderFailureEvidence(context) {
  const { networkEvents = {}, domSnapshot: _domSnapshot = {}, consoleOutput = {} } = context;

  const successResponses = networkEvents.responses?.filter(r => r.status >= 200 && r.status < 300);
  if (successResponses?.length > 0) {
    return `API returned success (${successResponses[0].status}) but DOM did not change`;
  }

  const renderErrors = (consoleOutput.errors || []).filter(msg => msg.toLowerCase().includes('render'));
  if (renderErrors.length > 0) {
    return `Render error: ${renderErrors[0]}`;
  }

  return 'Promise executed but UI failed to update';
}

/**
 * Check if silence is due to server-side-only changes
 */
function isServerSideOnly(context) {
  const { networkEvents = {}, domSnapshot = {}, consoleOutput: _consoleOutput = {} } = context;

  // Network request succeeded without visible feedback
  const successResponses = networkEvents.responses?.filter(r => r.status >= 200 && r.status < 300);
  if (successResponses?.length > 0 && !domSnapshot.changed) {
    // Could be server-side change with no UI feedback
    // Usually happens with data mutations that don't require UI change
    return true;
  }

  return false;
}

/**
 * Get evidence for server-side-only changes
 */
function getServerSideOnlyEvidence(context) {
  const { networkEvents = {} } = context;

  const successResponses = networkEvents.responses?.filter(r => r.status >= 200 && r.status < 300);
  if (successResponses?.length > 0) {
    return `Request succeeded (${successResponses[0].status}) without client-side UI feedback`;
  }

  return 'Server acknowledged request without client-side change';
}

/**
 * Determine if silence is temporary/recoverable
 * 
 * @param {string} silenceKind - SILENCE_KINDS.*
 * @returns {boolean}
 */
export function isSilenceRecoverable(silenceKind) {
  // Check for explicit RECOVERABLE kind
  if (silenceKind === SILENCE_KINDS.RECOVERABLE) {
    return true;
  }

  // Check for explicitly UNRECOVERABLE kind
  if (silenceKind === SILENCE_KINDS.UNRECOVERABLE) {
    return false;
  }

  // Check specific recoverable kinds
  const recoverable = [
    SILENCE_KINDS.SLOW_ACKNOWLEDGMENT,
    SILENCE_KINDS.BLOCKED_BY_AUTH,
    SILENCE_KINDS.NETWORK_TIMEOUT,
  ];

  return recoverable.includes(silenceKind);
}

/**
 * Determine if silence is indicative of error
 * 
 * @param {string} silenceKind - SILENCE_KINDS.*
 * @returns {boolean}
 */
export function isSilenceIndicativeOfError(silenceKind) {
  const errorIndicators = [
    SILENCE_KINDS.TRUE_SILENCE,
    SILENCE_KINDS.UI_RENDER_FAILURE,
    SILENCE_KINDS.NETWORK_TIMEOUT,
  ];

  return errorIndicators.includes(silenceKind);
}

/**
 * Get human-readable explanation of silence
 * 
 * @param {string} silenceKind - SILENCE_KINDS.*
 * @returns {string}
 */
export function explainSilence(silenceKind) {
  const explanations = {
    [SILENCE_KINDS.TRUE_SILENCE]: 'No observable response. Check for JavaScript errors or server errors.',
    [SILENCE_KINDS.SLOW_ACKNOWLEDGMENT]: 'Response detected but too slow. May indicate performance issues.',
    [SILENCE_KINDS.BLOCKED_BY_AUTH]: 'Authentication required. User may need to log in.',
    [SILENCE_KINDS.SERVER_SIDE_ONLY]: 'Backend processed the request but did not send client feedback.',
    [SILENCE_KINDS.UI_RENDER_FAILURE]: 'Request succeeded but UI failed to update. Check React/component errors.',
    [SILENCE_KINDS.NETWORK_TIMEOUT]: 'Request took too long and timed out.',
    [SILENCE_KINDS.USER_NAVIGATION]: 'User navigated away before completion.',
  };

  return explanations[silenceKind] || 'Unknown silence type';
}
