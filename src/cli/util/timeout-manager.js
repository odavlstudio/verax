/**
 * TimeoutManager
 * Unified timeout coordination across three priority levels
 * 
 * PURPOSE:
 * Clarify and document interaction between three timeout mechanisms:
 * 1. GLOBAL_WATCHDOG (highest priority) - terminates entire run
 * 2. PHASE_TIMEOUT (medium priority) - Learn/Observe/Detect phases
 * 3. INTERACTION_TIMEOUT (lowest priority) - per-interaction within phases
 * 
 * INVARIANT: Each level is autonomous. Higher level timeout preempts lower.
 * VALUES: Timeouts are never changed; only made explicit.
 * 
 * CONSTITUTION: Timeout precedence is sacred and immutable.
 */

import { getTimeProvider } from './support/time-provider.js';

export class TimeoutManager {
  constructor(totalBudgetMs) {
    this.totalBudgetMs = totalBudgetMs;
    this.timeProvider = getTimeProvider();
    this.startTime = this.timeProvider.now();
    this.globalWatchdog = null;
    this.phaseTimeouts = new Map();
    this.interactionBudgets = new Map();
    
    // Immutable precedence rules
    this.precedence = [
      {
        level: 'GLOBAL_WATCHDOG',
        priority: 1,
        description: 'Terminates entire run (never recoverable)',
        enforcement: 'process.exit(0)'
      },
      {
        level: 'PHASE_TIMEOUT',
        priority: 2,
        description: 'Learn/Observe/Detect phase boundaries',
        enforcement: 'throws timeout error'
      },
      {
        level: 'INTERACTION_TIMEOUT',
        priority: 3,
        description: 'Per-interaction timeout within phase',
        enforcement: 'returns error or short-circuits'
      }
    ];
  }

  /**
   * Set global watchdog (Level 1: Highest precedence)
   * Called once at start of run orchestration.
   * Preempts all phase and interaction timeouts.
   * 
   * CONTRACT:
   * - Called exactly once at run initialization
   * - Handler must call finalizeOnTimeout() before process.exit(0)
   * - No recovery possible; terminates entire run
   */
  setGlobalWatchdog(handler) {
    if (this.globalWatchdog) {
      clearTimeout(this.globalWatchdog);
    }
    
    // Clear on successful completion
    const wrappedHandler = () => {
      handler();
    };
    
    this.globalWatchdog = setTimeout(wrappedHandler, this.totalBudgetMs);
  }

  /**
   * Clear global watchdog on successful completion
   * Called when run completes successfully before timeout
   */
  clearGlobalWatchdog() {
    if (this.globalWatchdog) {
      clearTimeout(this.globalWatchdog);
      this.globalWatchdog = null;
    }
  }

  /**
   * Record phase timeout for clarity (Level 2: Medium precedence)
   * Used by withTimeout() wrapper in run.js
   * Global watchdog will fire first if total time exceeds budget.
   * 
   * CONTRACT:
   * - Records timeout for logging/debugging
   * - Actual enforcement via withTimeout() wrapper
   * - If phase timeout fires, run continues to next phase
   */
  recordPhaseTimeout(phaseName, timeoutMs) {
    if (!phaseName || timeoutMs <= 0) {
      throw new Error(`Invalid phase timeout: phase=${phaseName}, ms=${timeoutMs}`);
    }
    
    this.phaseTimeouts.set(phaseName, {
      ms: timeoutMs,
      recordedAt: this.timeProvider.now(),
      endsAt: this.timeProvider.now() + timeoutMs
    });
  }

  /**
   * Check if a phase is within budget
   * Used to validate phase can execute given remaining time
   */
  isPhaseWithinBudget(phaseName) {
    const phaseInfo = this.phaseTimeouts.get(phaseName);
    if (!phaseInfo) return false;
    
    const elapsed = this.timeProvider.now() - this.startTime;
    return elapsed < this.totalBudgetMs;
  }

  /**
   * Set interaction budget for per-promise timeout (Level 3: Lowest precedence)
   * Used by InteractionPlanner to bound individual promise execution
   * 
   * CONTRACT:
   * - Called by InteractionPlanner for each promise attempt
   * - InteractionPlanner checks isInteractionWithinBudget()
   * - If interaction timeout, attempt is recorded as 'interaction-timeout-exceeded'
   * - Global and phase timeouts override interaction timeout
   */
  recordInteractionBudget(promiseId, timeoutMs) {
    if (!promiseId || timeoutMs <= 0) {
      throw new Error(`Invalid interaction budget: id=${promiseId}, ms=${timeoutMs}`);
    }
    
    this.interactionBudgets.set(promiseId, {
      ms: timeoutMs,
      startedAt: this.timeProvider.now(),
      endsAt: this.timeProvider.now() + timeoutMs
    });
  }

  /**
   * Check if an interaction is within budget
   * Used by InteractionPlanner isWithinBudget()
   */
  isInteractionWithinBudget(promiseId) {
    const budget = this.interactionBudgets.get(promiseId);
    if (!budget) return true; // No explicit budget set
    
    const elapsed = this.timeProvider.now() - budget.startedAt;
    return elapsed < budget.ms;
  }

  /**
   * Get remaining time in current phase
   * Useful for logging and debugging
   */
  getRemainingPhaseTime(phaseName) {
    const phaseInfo = this.phaseTimeouts.get(phaseName);
    if (!phaseInfo) return null;
    
    const now = this.timeProvider.now();
    const remaining = phaseInfo.endsAt - now;
    return Math.max(0, remaining);
  }

  /**
   * Get elapsed time since run start
   */
  getElapsedTime() {
    return this.timeProvider.now() - this.startTime;
  }

  /**
   * Get remaining total budget
   */
  getRemainingBudget() {
    const elapsed = this.getElapsedTime();
    return Math.max(0, this.totalBudgetMs - elapsed);
  }

  /**
   * Get timeout precedence info for debugging/logging
   * Used in verbose mode and test diagnostics
   */
  getPrecedenceInfo() {
    return {
      precedence: this.precedence,
      globalWatchdog: this.globalWatchdog ? 'active' : 'inactive',
      phaseTimeouts: Array.from(this.phaseTimeouts.entries()).map(([name, info]) => ({
        phase: name,
        ms: info.ms,
        remaining: this.getRemainingPhaseTime(name)
      })),
      totalBudget: this.totalBudgetMs,
      elapsed: this.getElapsedTime(),
      remaining: this.getRemainingBudget()
    };
  }

  /**
   * Cleanup on completion or error
   */
  cleanup() {
    this.clearGlobalWatchdog();
    this.phaseTimeouts.clear();
    this.interactionBudgets.clear();
  }
}

export default TimeoutManager;
