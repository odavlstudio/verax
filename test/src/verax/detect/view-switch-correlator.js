/**
 * VIEW SWITCH CORRELATOR
 * 
 * Correlates view switch promises with observed UI changes (no URL change).
 * Requires at least 2 independent signals for CONFIRMED.
 * 
 * TRUTH BOUNDARY:
 * - CONFIRMED: 2+ independent signals (DOM signature + landmark/focus/aria-live)
 * - SUSPECTED: 1 signal only
 * - INFORMATIONAL: Interaction blocked/disabled/prevented
 */

/**
 * Reason codes for correlation decisions
 */
export const VIEW_SWITCH_REASON_CODES = {
  CONFIRMED_TWO_SIGNALS: 'CONFIRMED_TWO_SIGNALS',
  CONFIRMED_THREE_SIGNALS: 'CONFIRMED_THREE_SIGNALS',
  SUSPECTED_ONE_SIGNAL: 'SUSPECTED_ONE_SIGNAL',
  INFORMATIONAL_BLOCKED: 'INFORMATIONAL_BLOCKED',
  INFORMATIONAL_DISABLED: 'INFORMATIONAL_DISABLED',
  INFORMATIONAL_PREVENTED: 'INFORMATIONAL_PREVENTED',
  NO_SIGNALS: 'NO_SIGNALS'
};

/**
 * Correlate view switch promise with observed UI changes.
 * 
 * @param {Object} expectation - View switch promise expectation
 * @param {Object} trace - Interaction trace with sensors
 * @param {string} beforeUrl - URL before interaction
 * @param {string} afterUrl - URL after interaction
 * @returns {Object} - { outcome, severity, reasonCode, signals }
 */
export function correlateViewSwitch(expectation, trace, beforeUrl, afterUrl) {
  if (!expectation || expectation.kind !== 'VIEW_SWITCH_PROMISE') {
    return { outcome: null, severity: null, reasonCode: null, signals: [] };
  }
  
  const sensors = trace.sensors || {};
  const navigation = sensors.navigation || {};
  const _uiSignals = sensors.uiSignals || {};
  const _stateUi = sensors.stateUi || {};
  const uiFeedback = sensors.uiFeedback || {};
  
  // Check if URL changed (if so, this is not a state-driven navigation)
  const urlChanged = navigation.urlChanged === true || (beforeUrl !== afterUrl);
  if (urlChanged) {
    return { outcome: null, severity: null, reasonCode: 'URL_CHANGED', signals: [] };
  }
  
  // Check if interaction was blocked/disabled/prevented
  const interaction = trace.interaction || {};
  const isDisabled = interaction.disabled === true;
  const isBlocked = interaction.blocked === true;
  const isPrevented = interaction.prevented === true;
  
  if (isDisabled) {
    return {
      outcome: 'INFORMATIONAL',
      severity: 'INFORMATIONAL',
      reasonCode: VIEW_SWITCH_REASON_CODES.INFORMATIONAL_DISABLED,
      signals: []
    };
  }
  
  if (isBlocked) {
    return {
      outcome: 'INFORMATIONAL',
      severity: 'INFORMATIONAL',
      reasonCode: VIEW_SWITCH_REASON_CODES.INFORMATIONAL_BLOCKED,
      signals: []
    };
  }
  
  if (isPrevented) {
    return {
      outcome: 'INFORMATIONAL',
      severity: 'INFORMATIONAL',
      reasonCode: VIEW_SWITCH_REASON_CODES.INFORMATIONAL_PREVENTED,
      signals: []
    };
  }
  
  // Collect independent signals
  const signals = [];
  
  // Signal 1: DOM signature change (stable hash)
  const beforeDom = trace.before?.domSignature || trace.before?.domHash;
  const afterDom = trace.after?.domSignature || trace.after?.domHash;
  if (beforeDom && afterDom && beforeDom !== afterDom) {
    signals.push({
      type: 'DOM_SIGNATURE_CHANGE',
      before: beforeDom,
      after: afterDom
    });
  }
  
  // Signal 2: Visible landmark change (heading/main role change)
  const beforeLandmarks = extractLandmarks(trace.before);
  const afterLandmarks = extractLandmarks(trace.after);
  if (beforeLandmarks.length > 0 && afterLandmarks.length > 0) {
    const landmarksChanged = JSON.stringify(beforeLandmarks) !== JSON.stringify(afterLandmarks);
    if (landmarksChanged) {
      signals.push({
        type: 'LANDMARK_CHANGE',
        before: beforeLandmarks,
        after: afterLandmarks
      });
    }
  }
  
  // Signal 3: Focus moved to new container
  const beforeFocus = trace.before?.focus || {};
  const afterFocus = trace.after?.focus || {};
  if (beforeFocus.selector && afterFocus.selector && beforeFocus.selector !== afterFocus.selector) {
    const beforeContainer = getContainerSelector(beforeFocus.selector);
    const afterContainer = getContainerSelector(afterFocus.selector);
    if (beforeContainer !== afterContainer) {
      signals.push({
        type: 'FOCUS_CONTAINER_CHANGE',
        before: beforeContainer,
        after: afterContainer
      });
    }
  }
  
  // Signal 4: aria-live message
  const ariaLiveBefore = extractAriaLive(trace.before);
  const ariaLiveAfter = extractAriaLive(trace.after);
  if (ariaLiveAfter.length > ariaLiveBefore.length) {
    signals.push({
      type: 'ARIA_LIVE_MESSAGE',
      messages: ariaLiveAfter.slice(ariaLiveBefore.length)
    });
  }
  
  // Signal 5: UI feedback signals (optional but counts)
  if (uiFeedback.signals) {
    const feedbackSignals = uiFeedback.signals;
    if (feedbackSignals.domChange?.happened === true) {
      signals.push({
        type: 'UI_FEEDBACK_DOM_CHANGE',
        details: feedbackSignals.domChange
      });
    }
    if (feedbackSignals.focusChange?.happened === true) {
      signals.push({
        type: 'UI_FEEDBACK_FOCUS_CHANGE',
        details: feedbackSignals.focusChange
      });
    }
  }
  
  // Determine outcome based on signal count
  if (signals.length >= 2) {
    return {
      outcome: 'CONFIRMED',
      severity: 'CONFIRMED',
      reasonCode: signals.length >= 3 
        ? VIEW_SWITCH_REASON_CODES.CONFIRMED_THREE_SIGNALS 
        : VIEW_SWITCH_REASON_CODES.CONFIRMED_TWO_SIGNALS,
      signals
    };
  } else if (signals.length === 1) {
    return {
      outcome: 'SUSPECTED',
      severity: 'SUSPECTED',
      reasonCode: VIEW_SWITCH_REASON_CODES.SUSPECTED_ONE_SIGNAL,
      signals
    };
  } else {
    return {
      outcome: 'NO_SIGNALS',
      severity: 'SUSPECTED',
      reasonCode: VIEW_SWITCH_REASON_CODES.NO_SIGNALS,
      signals: []
    };
  }
}

/**
 * Extract landmarks (headings, main role) from trace snapshot
 */
function extractLandmarks(snapshot) {
  if (!snapshot) return [];
  
  const landmarks = [];
  
  // Extract headings (h1-h6)
  if (snapshot.headings) {
    landmarks.push(...snapshot.headings.map(h => ({ type: 'heading', level: h.level, text: h.text?.slice(0, 50) })));
  }
  
  // Extract main role elements
  if (snapshot.mainElements) {
    landmarks.push(...snapshot.mainElements.map(m => ({ type: 'main', text: m.text?.slice(0, 50) })));
  }
  
  return landmarks;
}

/**
 * Get container selector from element selector
 */
function getContainerSelector(selector) {
  if (!selector) return null;
  
  // Extract parent container (simplified - assumes common patterns)
  const parts = selector.split(' > ');
  if (parts.length > 1) {
    return parts[parts.length - 2]; // Second to last part
  }
  
  // Try to extract container from selector
  const match = selector.match(/([^>]+) > [^>]+$/);
  if (match) {
    return match[1].trim();
  }
  
  return selector; // Fallback to full selector
}

/**
 * Extract aria-live messages from trace snapshot
 */
function extractAriaLive(snapshot) {
  if (!snapshot) return [];
  
  const messages = [];
  
  if (snapshot.ariaLiveRegions) {
    snapshot.ariaLiveRegions.forEach(region => {
      if (region.text) {
        messages.push(region.text.slice(0, 100));
      }
    });
  }
  
  return messages;
}

