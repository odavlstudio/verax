/**
 * STAGE 3.3: Anti-False-Green Lock
 * 
 * Prevent transient or superficial DOM changes from being counted as acknowledgment
 * 
 * Key rules:
 * 1. Spinner alone is NOT acknowledgment (must have real UI change)
 * 2. Micro-mutations (<100 bytes) don't count as meaningful
 * 3. Signal must persist through stability window
 * 4. DOM changes during loading are secondary to feedback
 */

/**
 * False-green signal types (spinner, progress, etc.)
 * These alone are insufficient for acknowledgment
 */
const FALSE_GREEN_SIGNALS = {
  LOADING_STARTED: 'loadingStarted',
  LOADING_SPINNER: 'loadingSpinner',
  PROGRESS_BAR: 'progressBar',
  SKELETON_LOADER: 'skeletonLoader',
  PLACEHOLDER: 'placeholder',
};

/**
 * Substantive signal types that indicate real work
 */
const SUBSTANTIVE_SIGNALS = {
  // Content appeared
  CONTENT_APPEARED: 'contentAppeared',
  MEANINGFUL_UI_CHANGE: 'meaningfulUIChange',

  // Feedback
  FEEDBACK_APPEARED: 'feedbackAppeared',
  TOAST_APPEARED: 'toastAppeared',
  MODAL_APPEARED: 'modalAppeared',
  SUCCESS_MESSAGE: 'successMessageAppeared',
  ERROR_MESSAGE: 'errorMessageAppeared',

  // Navigation
  ROUTE_CHANGED: 'routeChanged',
  URL_CHANGED: 'urlChanged',

  // Network
  NETWORK_RESPONSE_RECEIVED: 'networkResponseReceived',
  API_SUCCESS: 'apiSuccessDetected',
  API_ERROR: 'apiErrorDetected',
};

/**
 * Check if signal is substantive (not just a spinner)
 * 
 * @param {string} signalName - Signal name
 * @returns {boolean}
 */
function isSubstantiveSignal(signalName) {
  return Object.values(SUBSTANTIVE_SIGNALS).includes(signalName);
}

/**
 * Check if DOM change is meaningful
 * 
 * @param {Object} domChange - DOM change event
 * @returns {boolean}
 */
function isMeaningfulDOMChange(domChange) {
  if (!domChange) return false;

  // Ignore micro-mutations (< 100 bytes)
  if (domChange.addedBytes !== undefined && domChange.addedBytes < 100) {
    return false;
  }

  // Ignore transient changes (only style changes, no content)
  if (domChange.onlyStyleChanges) {
    return false;
  }

  // Ignore changes to invisible elements
  if (domChange.addedNodesVisible === 0 && domChange.removedNodesVisible === 0) {
    return false;
  }

  return true;
}

/**
 * Filter signals to remove false-greens
 * 
 * Rules:
 * 1. If only false-green signals, return empty (not substantive)
 * 2. If DOM change is micro-mutation, ignore it
 * 3. If loading spinner without feedback/content, insufficient
 * 
 * @param {Object} signals - Observed signals {signalName: boolean}
 * @param {Object} metadata - Additional metadata {domChange, isLoading, duration}
 * @returns {Object} Filtered signals object
 */
export function filterFalseGreenSignals(signals, metadata = {}) {
  if (!signals) return {};

  const filtered = { ...signals };
  const signalNames = Object.keys(filtered).filter(key => filtered[key] === true);

  // If only spinner/loading signals, filter them out
  const hasSubstantive = signalNames.some(isSubstantiveSignal);

  if (!hasSubstantive) {
    // Remove all false-green signals
    Object.values(FALSE_GREEN_SIGNALS).forEach(sig => {
      delete filtered[sig];
    });

    // Also remove DOM change if it's micro-mutation
    if (metadata.domChange && !isMeaningfulDOMChange(metadata.domChange)) {
      filtered.domChanged = false;
      filtered.meaningfulUIChange = false;
    }

    return filtered;
  }

  // If we have substantive signals, still filter micro-mutations
  if (metadata.domChange && !isMeaningfulDOMChange(metadata.domChange)) {
    filtered.domChanged = false;
    filtered.meaningfulUIChange = false;
  }

  return filtered;
}

/**
 * Check if signals contain a false-green pattern
 * (loading without feedback or content change)
 * 
 * @param {Object} signals - Observed signals
 * @returns {boolean}
 */
export function isFalseGreenPattern(signals) {
  if (!signals) return false;

  const signalNames = Object.keys(signals).filter(key => signals[key] === true);
  const hasLoadingOnly = signalNames.some(sig => Object.values(FALSE_GREEN_SIGNALS).includes(sig));
  const hasSubstantive = signalNames.some(isSubstantiveSignal);

  return hasLoadingOnly && !hasSubstantive;
}

/**
 * Apply anti-false-green rules to acknowledgment level
 * 
 * @param {string} level - Current acknowledgment level
 * @param {Object} signals - Observed signals
 * @param {Object} metadata - DOM change, loading info
 * @returns {string} Adjusted acknowledgment level
 */
export function applyAntiFalseGreenRules(level, signals, metadata = {}) {
  if (!level || !signals) return level;

  // If false-green pattern detected, downgrade level
  if (isFalseGreenPattern(signals)) {
    // Spinner without feedback is at most WEAK
    if (level === 'strong' || level === 'partial') {
      return 'weak';
    }
  }

  // If DOM change is transient/micro, don't upgrade
  if (metadata.domChange && !isMeaningfulDOMChange(metadata.domChange)) {
    // Can't use DOM change as basis for acknowledgment
    return level;
  }

  return level;
}

/**
 * Get required substantive signals for promise kind
 * 
 * @param {string} promiseKind - Kind of promise
 * @returns {Array<string>} Required substantive signal names
 */
export function getRequiredSubstantiveSignals(promiseKind) {
  const requirements = {
    // Navigation needs route change
    navigate: [SUBSTANTIVE_SIGNALS.ROUTE_CHANGED, SUBSTANTIVE_SIGNALS.URL_CHANGED],

    // Network needs response
    'network.request': [SUBSTANTIVE_SIGNALS.NETWORK_RESPONSE_RECEIVED],
    'network.graphql': [SUBSTANTIVE_SIGNALS.NETWORK_RESPONSE_RECEIVED],
    'network.ws': [], // WebSocket connection is implicit

    // Feedback needs actual feedback
    'feedback.toast': [SUBSTANTIVE_SIGNALS.TOAST_APPEARED],
    'feedback.modal': [SUBSTANTIVE_SIGNALS.MODAL_APPEARED],
    'feedback.notification': [SUBSTANTIVE_SIGNALS.FEEDBACK_APPEARED],

    // State needs content or meaningful UI
    state: [
      SUBSTANTIVE_SIGNALS.CONTENT_APPEARED,
      SUBSTANTIVE_SIGNALS.MEANINGFUL_UI_CHANGE,
    ],
  };

  return requirements[promiseKind] || [];
}

/**
 * Validate acknowledgment against anti-false-green rules
 * 
 * @param {Object} acknowledgment - Acknowledgment result
 * @param {string} promiseKind - Kind of promise
 * @param {Object} metadata - DOM change, timing, etc.
 * @returns {Object} {valid: boolean, issues: string[]}
 */
export function validateAntiFalseGreen(acknowledgment, promiseKind, metadata = {}) {
  const issues = [];

  if (!acknowledgment) {
    return { valid: false, issues: ['no-acknowledgment'] };
  }

  // Check for substantive signals
  const requiredSubstantive = getRequiredSubstantiveSignals(promiseKind);
  const detectedSubstantive = acknowledgment.detectedSignals?.filter(isSubstantiveSignal) || [];

  if (requiredSubstantive.length > 0 && detectedSubstantive.length === 0) {
    issues.push('no-substantive-signals');
  }

  // Check for micro-mutation false-green
  if (metadata.domChange) {
    if (!isMeaningfulDOMChange(metadata.domChange) && detectedSubstantive.length === 0) {
      issues.push('only-micro-mutation');
    }
  }

  // Check for loading-only pattern
  if (isFalseGreenPattern(acknowledgment.detectedSignals)) {
    const hasRequired = requiredSubstantive.some(sig => acknowledgment.detectedSignals?.includes(sig));
    if (!hasRequired) {
      issues.push('loading-without-feedback');
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export {
  FALSE_GREEN_SIGNALS,
  SUBSTANTIVE_SIGNALS,
};
