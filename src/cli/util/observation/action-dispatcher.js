/**
 * ActionDispatcher
 * 
 * PURPOSE: Centralize action type dispatching logic
 * 
 * SCOPE:
 * - Determine action type from promise
 * - Dispatch to appropriate executor (click, submit, observe, etc.)
 * - Unified error handling for unsupported types
 * - Return consistent action result: { success, reason, cause }
 * 
 * INVARIANT: Always returns action result, never throws
 * VALUES: Dispatch logic immutable; only added as abstraction
 */

export class ActionDispatcher {
  constructor(planner) {
    this.planner = planner; // InteractionPlanner instance
  }

  /**
   * Dispatch action based on promise type
   * 
   * CONTRACT:
   * - Returns { success: boolean, reason?: string, cause?: string }
   * - Never throws; captures errors in result
   * - Sets attempt.action field
   * 
   * PROMISE TYPES:
   * - navigation.runtime: Runtime navigation via click
   * - button: Button click or navigation
   * - form: Form submission
   * - validation: Field validation
   * - state: State change observation
   * - network: Network request observation
   */
  async dispatch(promise, bundle, attempt) {
    try {
      // Dispatch based on promise kind/category/type
      if (promise.kind === 'navigation.runtime') {
        attempt.action = 'click';
        return await this.planner.executeRuntimeNavigation(promise, bundle);
      }
      
      if (promise.category === 'button' || promise.type === 'navigation') {
        attempt.action = 'click';
        return await this.planner.executeButtonClick(promise, bundle);
      }
      
      if (promise.category === 'form') {
        attempt.action = 'submit';
        return await this.planner.executeFormSubmission(promise, bundle);
      }
      
      if (promise.category === 'validation') {
        attempt.action = 'observe';
        return await this.planner.executeValidation(promise, bundle);
      }
      
      if (promise.type === 'state') {
        attempt.action = 'observe';
        return await this.planner.observeStateChange(promise, bundle);
      }
      
      if (promise.type === 'network') {
        attempt.action = 'observe';
        return await this.planner.observeNetworkRequest(promise, bundle);
      }
      
      // Unsupported promise type
      attempt.action = 'unsupported';
      attempt.reason = 'unsupported-promise-type';
      attempt.cause = 'blocked';
      return {
        success: false,
        reason: 'unsupported-promise-type',
        cause: 'blocked'
      };
    } catch (error) {
      // Error during dispatch
      attempt.action = 'error';
      attempt.cause = 'dispatch-error';
      return {
        success: false,
        reason: `dispatch-error:${error.message}`,
        cause: 'error'
      };
    }
  }

  /**
   * Get action type string from promise
   * Useful for logging/debugging
   */
  getActionType(promise) {
    if (promise.kind === 'navigation.runtime') return 'runtime-navigation';
    if (promise.category === 'button' || promise.type === 'navigation') return 'button-click';
    if (promise.category === 'form') return 'form-submit';
    if (promise.category === 'validation') return 'validation-observe';
    if (promise.type === 'state') return 'state-change';
    if (promise.type === 'network') return 'network-observe';
    return 'unknown';
  }

  /**
   * Check if action type is mutating
   * Read-only mode blocks all mutating actions
   */
  isMutatingAction(promise) {
    // Form submissions are mutating
    if (promise.category === 'form') return true;
    // Most navigation is read-only, except forms
    return false;
  }

  /**
   * Validate promise can be executed
   * 
   * Returns: { valid: boolean, error?: string }
   */
  validate(promise) {
    if (!promise) {
      return { valid: false, error: 'promise is null or undefined' };
    }
    if (!promise.id) {
      return { valid: false, error: 'promise missing id' };
    }
    // Most promises can be attempted; dispatcher will handle unsupported types
    return { valid: true };
  }
}

export default ActionDispatcher;
