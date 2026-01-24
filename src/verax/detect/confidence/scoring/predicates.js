// Predicate functions for declarative rule evaluation
// These guard against specific conditions that would indicate success or different behavior

export const PREDICATES = {
  /**
   * EXPECTATION_PROVEN
   * Checks: expectationStrength === 'PROVEN'
   * Significance: Expectation was derived from code analysis (CORE #4)
   * Risk guarded: False positives from unproven expectations
   */
  EXPECTATION_PROVEN: ({ expectationStrength }) => expectationStrength === 'PROVEN',

  /**
   * NETWORK_FAILED_AND_NO_UI_FEEDBACK
   * Checks: Network request failed AND no UI feedback present
   * Significance: Indicates silent network failure (user saw nothing)
   * Risk guarded: Masking failures through UI/error messaging
   */
  NETWORK_FAILED_AND_NO_UI_FEEDBACK: ({ evidenceSignals }) => evidenceSignals?.networkFailed === true && evidenceSignals?.uiFeedbackDetected !== true,

  /**
   * CONSOLE_ERRORS_AND_NO_UI_FEEDBACK
   * Checks: Console errors logged AND no UI feedback present
   * Significance: Indicates silent validation failure (error occurred silently)
   * Risk guarded: Validation errors swallowed by app without user notification
   */
  CONSOLE_ERRORS_AND_NO_UI_FEEDBACK: ({ evidenceSignals }) => evidenceSignals?.consoleErrors === true && evidenceSignals?.uiFeedbackDetected !== true,

  /**
   * NO_URL_CHANGE
   * Checks: URL did not change
   * Significance: Navigation action had no effect (promise unfulfilled)
   * Risk guarded: Navigation failures that silently fail to change route
   */
  NO_URL_CHANGE: ({ evidenceSignals }) => evidenceSignals?.urlChanged !== true,

  /**
   * NO_DOM_CHANGE
   * Checks: DOM tree unchanged
   * Significance: State mutation had no observable effect
   * Risk guarded: State updates that don't render changes
   */
  NO_DOM_CHANGE: ({ evidenceSignals }) => evidenceSignals?.domChanged !== true,

  /**
   * NO_SCREENSHOT_CHANGE
   * Checks: Visual appearance unchanged
   * Significance: No visible feedback or change occurred
   * Risk guarded: Silent failures with no visual indication
   */
  NO_SCREENSHOT_CHANGE: ({ evidenceSignals }) => evidenceSignals?.screenshotChanged !== true,

  /**
   * ZERO_NETWORK_ACTIVITY_PROMISED
   * Checks: Network did not fail AND expected 0 requests
   * Significance: Code promised network action but network was never used
   * Risk guarded: Missing network requests (code promises unfulfilled)
   */
  ZERO_NETWORK_ACTIVITY_PROMISED: ({ evidenceSignals, expectation }) => evidenceSignals?.networkFailed !== true && (expectation?.totalRequests || 0) === 0,

  /**
   * URL_CHANGED_AND_NO_UI_FEEDBACK
   * Checks: URL changed but no UI feedback on navigation
   * Significance: Navigation initiated (route changed) but incomplete (feedback missing)
   * Risk guarded: Partial navigations with no error notification
   */
  URL_CHANGED_AND_NO_UI_FEEDBACK: ({ evidenceSignals }) => evidenceSignals?.urlChanged === true && evidenceSignals?.uiFeedbackDetected !== true,

  /**
   * NO_UI_FEEDBACK
   * Checks: No UI feedback signals detected
   * Significance: User received no indication of error or status change
   * Risk guarded: Navigation/action failures with zero user visibility
   */
  NO_UI_FEEDBACK: ({ evidenceSignals }) => evidenceSignals?.uiFeedbackDetected !== true
};
