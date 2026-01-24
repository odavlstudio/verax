/**
 * RULES_TABLE: Declarative scoring for all 10 finding types
 * 
 * Each finding type defines:
 * - boosts: Rules that increase confidence (weight > 0)
 * - penalties: Rules that decrease confidence (weight > 0)
 * 
 * Rules are evaluated in order (CORE #3 - Determinism) by applyRules()
 * 
 * All scores flow through applyRules() → subject to gates in index.js:
 * - HIGH: requires score >= 80 + PROVEN expectation + all sensors
 * - MEDIUM: requires score >= 55
 * - OBSERVED: strength capped (non-repeated ≤ 49, repeated HIGH ≤ 79)
 * - Missing sensors: penalty 25 (CORE #2 - Evidence Law)
 * - Non-proven: penalty 10 (CORE #5 - No Guessing)
 * 
 * CORE #4 (Promise-Extraction): Every boost/penalty corresponds to specific evidence
 */
export const RULES_TABLE = {
  // ============ TYPE: network_silent_failure ============
  // Silent network failure: request failed without visible user feedback
  network_silent_failure: {
    boosts: [
      { when: 'networkFailed', weight: 10, reason: 'Network request failed' },
      { when: 'consoleErrors', weight: 8, reason: 'Console errors present' },
      { when: 'NETWORK_FAILED_AND_NO_UI_FEEDBACK', weight: 6, reason: 'Silent failure: no user feedback on network error' }
    ],
    penalties: [
      { when: 'uiFeedbackDetected', weight: 10, reason: 'UI feedback detected (suggests not silent)' }
    ]
  },

  // ============ TYPE: validation_silent_failure ============
  // Silent validation failure: validation error logged but no error display to user
  validation_silent_failure: {
    boosts: [
      { when: 'consoleErrors', weight: 10, reason: 'Validation errors in console' },
      { when: 'CONSOLE_ERRORS_AND_NO_UI_FEEDBACK', weight: 8, reason: 'Silent validation: errors logged but no visible feedback' }
    ],
    penalties: [
      { when: 'uiFeedbackDetected', weight: 10, reason: 'Error feedback visible (not silent)' }
    ]
  },

  // ============ TYPE: missing_feedback_failure ============
  // Missing feedback: async operation without loading/status indication
  missing_feedback_failure: {
    boosts: [
      { when: 'slowRequests', weight: 10, reason: 'Slow requests detected' },
      { when: 'NETWORK_FAILED_AND_NO_UI_FEEDBACK', weight: 8, reason: 'Network activity without user feedback' }
    ],
    penalties: [
      { when: 'uiFeedbackDetected', weight: 10, reason: 'Loading indicator detected' }
    ]
  },

  // ============ TYPE: no_effect_silent_failure ============
  // No effect: action taken but had no observable result (no URL/DOM/visual change)
  no_effect_silent_failure: {
    boosts: [
      { when: 'NO_URL_CHANGE', weight: 10, reason: 'Expected URL change did not occur' },
      { when: 'NO_DOM_CHANGE', weight: 6, reason: 'DOM state unchanged' },
      { when: 'NO_SCREENSHOT_CHANGE', weight: 5, reason: 'No visible changes' }
    ],
    penalties: [
      { when: 'networkFailed', weight: 10, reason: 'Network activity detected (potential effect)' },
      { when: 'uiFeedbackDetected', weight: 8, reason: 'UI feedback changed (potential effect)' }
    ]
  },

  // ============ TYPE: missing_network_action ============
  // Missing network action: code promises network call but none occurred (CORE #4 Promise-Extraction)
  missing_network_action: {
    boosts: [
      { when: 'EXPECTATION_PROVEN', weight: 10, reason: 'Code promise verified via AST analysis' },
      { when: 'ZERO_NETWORK_ACTIVITY_PROMISED', weight: 8, reason: 'Zero network activity despite code promise' },
      { when: 'consoleErrors', weight: 6, reason: 'Console errors may have prevented action' }
    ],
    penalties: [
      { when: 'networkFailed', weight: 15, reason: 'Other network requests occurred' }
    ]
  },

  // ============ TYPE: missing_state_action ============
  // Missing state action: code promises state mutation but none visible (CORE #4 Promise-Extraction)
  missing_state_action: {
    boosts: [
      { when: 'EXPECTATION_PROVEN', weight: 10, reason: 'State mutation proven via cross-file analysis' },
      { when: 'NO_DOM_CHANGE', weight: 8, reason: 'DOM unchanged (no state mutation visible)' }
    ],
    penalties: [
      { when: 'networkFailed', weight: 10, reason: 'Network activity (deferred state update possible)' },
      { when: 'uiFeedbackDetected', weight: 8, reason: 'UI feedback suggests state managed differently' }
    ]
  },

  // ============ TYPE: navigation_silent_failure ============
  // Navigation silent failure: navigation attempted but failed silently (no route change, no error shown)
  navigation_silent_failure: {
    boosts: [
      { when: 'NO_URL_CHANGE', weight: 10, reason: 'Expected URL change did not occur' },
      { when: 'NO_UI_FEEDBACK', weight: 8, reason: 'No user-visible feedback on navigation failure' },
      { when: 'consoleErrors', weight: 6, reason: 'Navigation errors in console' }
    ],
    penalties: [
      { when: 'uiFeedbackDetected', weight: 10, reason: 'UI feedback detected (suggests navigation feedback provided)' },
      { when: 'urlChanged', weight: 5, reason: 'URL changed (navigation may have succeeded)' }
    ]
  },

  // ============ TYPE: partial_navigation_failure ============
  // Partial navigation failure: route changed but target not reached (incomplete nav, no feedback)
  partial_navigation_failure: {
    boosts: [
      { when: 'URL_CHANGED_AND_NO_UI_FEEDBACK', weight: 10, reason: 'Navigation started but target not reached' },
      { when: 'NO_UI_FEEDBACK', weight: 8, reason: 'No user-visible feedback on partial navigation' }
    ],
    penalties: [
      { when: 'uiFeedbackDetected', weight: 10, reason: 'UI feedback detected (suggests navigation feedback provided)' }
    ]
  },

  // ============ TYPE: flow_silent_failure ============
  // Multi-step flow failure: complex sequence failed silently
  // No scoring rules — relies entirely on base score and gates
  flow_silent_failure: {
    boosts: [],
    penalties: []
  },

  // ============ TYPE: observed_break ============
  // Observed break: user directly observed the failure (OBSERVED strength only)
  // No scoring rules — relies entirely on base score and OBSERVED strength cap
  observed_break: {
    boosts: [],
    penalties: []
  }
};
