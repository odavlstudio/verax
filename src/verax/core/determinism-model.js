import { getTimeProvider } from '../../cli/util/support/time-provider.js';

/**
 * DETERMINISM MODEL — PHASE 6
 * 
 * Records all adaptive/variable decisions made during a VERAX run.
 * Makes implicit choices explicit and enables replay trust validation.
 * 
 * PRINCIPLES:
 * 1. Every decision that varies by environment/timing/budget is recorded
 * 2. Decisions are factual: what was chosen, what inputs were considered
 * 3. No heuristics, no guessing — only recording reality
 * 4. Replay can verify same decisions or explain deviations
 * 
 * DECISION CATEGORIES:
 * - BUDGET: Limits chosen (time, interactions, pages)
 * - TIMEOUT: Timing windows (navigation, settle, stabilization)
 * - RETRY: Retry attempts and backoff
 * - ADAPTIVE_STABILIZATION: Dynamic settle extensions
 * - TRUNCATION: Early termination due to budget
 * - ENVIRONMENT: Browser, OS, network-dependent behavior
 */

/**
 * @typedef {Object} AdaptiveDecision
 * @property {string} decision_id - Unique ID: <category>_<specific_id>
 * @property {string} category - BUDGET | TIMEOUT | RETRY | ADAPTIVE_STABILIZATION | TRUNCATION | ENVIRONMENT
 * @property {number} timestamp - When decision was made (ms since epoch)
 * @property {Object} inputs - What was considered (environment, state, triggers)
 * @property {*} chosen_value - What was chosen
 * @property {string} reason - Technical, factual explanation
 * @property {string} [context] - Additional context (page URL, interaction ID, etc.)
 */

/**
 * Decision IDs — Enumeration of all adaptive decision points
 */
export const DECISION_IDS = {
  // Budget decisions
  BUDGET_PROFILE_SELECTED: 'BUDGET_profile_selected',
  BUDGET_MAX_INTERACTIONS: 'BUDGET_max_interactions',
  BUDGET_MAX_PAGES: 'BUDGET_max_pages',
  BUDGET_SCAN_DURATION: 'BUDGET_scan_duration_ms',
  BUDGET_MAX_FLOWS: 'BUDGET_max_flows',
  
  // Timeout decisions
  TIMEOUT_NAVIGATION: 'TIMEOUT_navigation_ms',
  TIMEOUT_INTERACTION: 'TIMEOUT_interaction_ms',
  TIMEOUT_SETTLE: 'TIMEOUT_settle_ms',
  TIMEOUT_STABILIZATION: 'TIMEOUT_stabilization_window_ms',
  
  // Adaptive stabilization decisions
  ADAPTIVE_STABILIZATION_ENABLED: 'ADAPTIVE_STABILIZATION_enabled',
  ADAPTIVE_STABILIZATION_EXTENDED: 'ADAPTIVE_STABILIZATION_extended',
  
  // Retry decisions
  RETRY_NAVIGATION_ATTEMPTED: 'RETRY_navigation_attempted',
  RETRY_INTERACTION_ATTEMPTED: 'RETRY_interaction_attempted',
  RETRY_BACKOFF_DELAY: 'RETRY_backoff_delay_ms',
  
  // Truncation decisions
  TRUNCATION_BUDGET_EXCEEDED: 'TRUNCATION_budget_exceeded',
  TRUNCATION_INTERACTIONS_CAPPED: 'TRUNCATION_interactions_capped',
  TRUNCATION_PAGES_CAPPED: 'TRUNCATION_pages_capped',
  TRUNCATION_SCAN_TIME_EXCEEDED: 'TRUNCATION_scan_time_exceeded',
  
  // Environment decisions
  ENV_BROWSER_DETECTED: 'ENV_browser_detected',
  ENV_NETWORK_SPEED: 'ENV_network_speed_class',
  ENV_VIEWPORT_SIZE: 'ENV_viewport_size'
};

/**
 * DecisionRecorder — Captures all adaptive decisions during a run
 */
export class DecisionRecorder {
  constructor(runId = null) {
    this.runId = runId;
    this.decisions = [];
    this.decisionIndex = {}; // decision_id -> decision for quick lookup
  }

  /**
   * Record a single adaptive decision
   * @param {AdaptiveDecision} decision
   */
  record(decision) {
    if (!decision.decision_id || !decision.category) {
      throw new Error(`Invalid decision: missing decision_id or category. Got: ${JSON.stringify(decision)}`);
    }
    
    // Add timestamp if not provided
    if (!decision.timestamp) {
      decision.timestamp = getTimeProvider().now();
    }
    
    this.decisions.push(decision);
    
    // Index by decision_id for replay lookup
    this.decisionIndex[decision.decision_id] = decision;
  }

  /**
   * Record batch of decisions
   * @param {AdaptiveDecision[]} decisions
   */
  recordBatch(decisions) {
    decisions.forEach(d => this.record(d));
  }

  /**
   * Get all recorded decisions
   * @returns {AdaptiveDecision[]}
   */
  getAll() {
    return this.decisions;
  }

  /**
   * Get decisions by category
   * @param {string} category
   * @returns {AdaptiveDecision[]}
   */
  getByCategory(category) {
    return this.decisions.filter(d => d.category === category);
  }

  /**
   * Get decision by ID (most recent if multiple)
   * @param {string} decisionId
   * @returns {AdaptiveDecision|null}
   */
  getById(decisionId) {
    return this.decisionIndex[decisionId] || null;
  }

  /**
   * Get summary statistics
   * @returns {Object}
   */
  getSummary() {
    const byCategory = {};
    const categories = ['BUDGET', 'TIMEOUT', 'RETRY', 'ADAPTIVE_STABILIZATION', 'TRUNCATION', 'ENVIRONMENT'];
    
    categories.forEach(cat => {
      byCategory[cat] = this.getByCategory(cat).length;
    });
    
    return {
      total: this.decisions.length,
      byCategory,
      deterministic: this._isDeterministic()
    };
  }

  /**
   * Determine if run was fully deterministic
   * @returns {boolean}
   * @private
   */
  _isDeterministic() {
    // A run is deterministic if:
    // 1. No truncations occurred (budget not exceeded)
    // 2. No retries occurred (no transient failures)
    // 3. No adaptive stabilization extensions (timing was predictable)
    
    const truncations = this.getByCategory('TRUNCATION');
    const retries = this.getByCategory('RETRY');
    const adaptiveExtensions = this.decisions.filter(d => 
      d.decision_id === DECISION_IDS.ADAPTIVE_STABILIZATION_EXTENDED
    );
    
    return truncations.length === 0 && 
           retries.length === 0 && 
           adaptiveExtensions.length === 0;
  }

  /**
   * Export decisions for serialization
   * @returns {Object}
   */
  export() {
    return {
      runId: this.runId,
      recordedAt: getTimeProvider().iso(),
      total: this.decisions.length,
      decisions: this.decisions.map(d => ({
        ...d,
        timestamp: getTimeProvider().iso() // Convert to ISO string for readability
      })),
      summary: this.getSummary()
    };
  }

  /**
   * Load decisions from exported format (for replay)
   * @param {Object} exported
   * @returns {DecisionRecorder}
   */
  static fromExport(exported) {
    const recorder = new DecisionRecorder(exported.runId);
    
    if (exported.decisions) {
      exported.decisions.forEach(d => {
        recorder.record({
          ...d,
          timestamp: Date.parse(d.timestamp) // Convert ISO string back to ms deterministically
        });
      });
    }
    
    return recorder;
  }
}

/**
 * Create helper functions for common decision recording patterns
 */

/**
 * Record budget profile selection
 * @param {DecisionRecorder} recorder
 * @param {string} profileName
 * @param {Object} budget
 */
export function recordBudgetProfile(recorder, profileName, budget) {
  const now = getTimeProvider().now();
  recorder.recordBatch([
    {
      decision_id: DECISION_IDS.BUDGET_PROFILE_SELECTED,
      category: 'BUDGET',
      timestamp: now,
      inputs: { env_var: process.env.VERAX_BUDGET_PROFILE || 'STANDARD' },
      chosen_value: profileName,
      reason: `Budget profile selected: ${profileName}`
    },
    {
      decision_id: DECISION_IDS.BUDGET_MAX_INTERACTIONS,
      category: 'BUDGET',
      timestamp: now,
      inputs: { profile: profileName },
      chosen_value: budget.maxInteractionsPerPage,
      reason: `Max interactions per page from ${profileName} profile`
    },
    {
      decision_id: DECISION_IDS.BUDGET_MAX_PAGES,
      category: 'BUDGET',
      timestamp: now,
      inputs: { profile: profileName },
      chosen_value: budget.maxPages,
      reason: `Max pages from ${profileName} profile`
    },
    {
      decision_id: DECISION_IDS.BUDGET_SCAN_DURATION,
      category: 'BUDGET',
      timestamp: now,
      inputs: { profile: profileName },
      chosen_value: budget.maxScanDurationMs,
      reason: `Scan duration limit from ${profileName} profile`
    }
  ]);
}

/**
 * Record timeout configuration
 * @param {DecisionRecorder} recorder
 * @param {Object} budget
 */
export function recordTimeoutConfig(recorder, budget) {
  const now = getTimeProvider().now();
  recorder.recordBatch([
    {
      decision_id: DECISION_IDS.TIMEOUT_NAVIGATION,
      category: 'TIMEOUT',
      timestamp: now,
      inputs: { budget_config: true },
      chosen_value: budget.navigationTimeoutMs,
      reason: 'Navigation timeout from budget configuration'
    },
    {
      decision_id: DECISION_IDS.TIMEOUT_INTERACTION,
      category: 'TIMEOUT',
      timestamp: now,
      inputs: { budget_config: true },
      chosen_value: budget.interactionTimeoutMs,
      reason: 'Interaction timeout from budget configuration'
    },
    {
      decision_id: DECISION_IDS.TIMEOUT_SETTLE,
      category: 'TIMEOUT',
      timestamp: now,
      inputs: { budget_config: true },
      chosen_value: budget.settleTimeoutMs,
      reason: 'Settle timeout from budget configuration'
    },
    {
      decision_id: DECISION_IDS.TIMEOUT_STABILIZATION,
      category: 'TIMEOUT',
      timestamp: now,
      inputs: { budget_config: true },
      chosen_value: budget.stabilizationWindowMs,
      reason: 'Stabilization window from budget configuration'
    }
  ]);
}

/**
 * Record adaptive stabilization decision
 * @param {DecisionRecorder} recorder
 * @param {boolean} enabled
 * @param {boolean} wasExtended
 * @param {number} extensionMs
 * @param {string} reason
 */
export function recordAdaptiveStabilization(recorder, enabled, wasExtended = false, extensionMs = 0, reason = '') {
  const now = getTimeProvider().now();
  recorder.record({
    decision_id: DECISION_IDS.ADAPTIVE_STABILIZATION_ENABLED,
    category: 'ADAPTIVE_STABILIZATION',
    timestamp: now,
    inputs: { budget_config: true },
    chosen_value: enabled,
    reason: enabled ? 'Adaptive stabilization enabled by budget profile' : 'Adaptive stabilization disabled'
  });
  
  if (wasExtended) {
    recorder.record({
      decision_id: DECISION_IDS.ADAPTIVE_STABILIZATION_EXTENDED,
      category: 'ADAPTIVE_STABILIZATION',
      timestamp: now,
      inputs: { dom_changing: true, network_active: true },
      chosen_value: extensionMs,
      reason: reason || `Extended stabilization by ${extensionMs}ms due to ongoing changes`
    });
  }
}

/**
 * Record retry attempt
 * @param {DecisionRecorder} recorder
 * @param {string} operationType - 'navigation' | 'interaction'
 * @param {number} attemptNumber
 * @param {number} delayMs
 * @param {string} errorType
 */
export function recordRetryAttempt(recorder, operationType, attemptNumber, delayMs, errorType) {
  const decisionId = operationType === 'navigation' ? 
    DECISION_IDS.RETRY_NAVIGATION_ATTEMPTED : 
    DECISION_IDS.RETRY_INTERACTION_ATTEMPTED;
  
  const now = getTimeProvider().now();
  recorder.recordBatch([
    {
      decision_id: decisionId,
      category: 'RETRY',
      timestamp: now,
      inputs: { attempt: attemptNumber, error_type: errorType },
      chosen_value: true,
      reason: `Retry attempt ${attemptNumber} for ${operationType} due to ${errorType}`
    },
    {
      decision_id: DECISION_IDS.RETRY_BACKOFF_DELAY,
      category: 'RETRY',
      timestamp: now,
      inputs: { attempt: attemptNumber },
      chosen_value: delayMs,
      reason: `Exponential backoff delay: ${delayMs}ms`
    }
  ]);
}

/**
 * Record budget truncation
 * @param {DecisionRecorder} recorder
 * @param {string} truncationType - 'interactions' | 'pages' | 'scan_time'
 * @param {Object|number} limitOrOptions - Either a number (limit) or object with {limit, reached/elapsed, scope?}
 * @param {number} [actual] - Actual value (only used if limitOrOptions is a number)
 */
export function recordTruncation(recorder, truncationType, limitOrOptions, actual = null) {
  const decisionIdMap = {
    interactions: DECISION_IDS.TRUNCATION_INTERACTIONS_CAPPED,
    pages: DECISION_IDS.TRUNCATION_PAGES_CAPPED,
    scan_time: DECISION_IDS.TRUNCATION_SCAN_TIME_EXCEEDED
  };
  
  let limit, actualValue;
  if (typeof limitOrOptions === 'object' && limitOrOptions !== null) {
    limit = limitOrOptions.limit;
    actualValue = limitOrOptions.reached || limitOrOptions.elapsed || limitOrOptions.actual || 0;
  } else {
    limit = limitOrOptions;
    actualValue = actual || 0;
  }
  
  recorder.record({
    decision_id: decisionIdMap[truncationType] || DECISION_IDS.TRUNCATION_BUDGET_EXCEEDED,
    category: 'TRUNCATION',
    timestamp: getTimeProvider().now(),
    inputs: { limit, actual: actualValue },
    chosen_value: actualValue,
    reason: `Budget exceeded: ${truncationType} capped at ${limit} (attempted ${actualValue})`
  });
}

/**
 * Record environment detection
 * @param {DecisionRecorder} recorder
 * @param {Object} environment - Environment config with browserType and viewport
 */
export function recordEnvironment(recorder, environment) {
  const { browserType = 'unknown', viewport = { width: 1280, height: 720 } } = environment;
  const now = getTimeProvider().now();
  
  recorder.recordBatch([
    {
      decision_id: DECISION_IDS.ENV_BROWSER_DETECTED,
      category: 'ENVIRONMENT',
      timestamp: now,
      inputs: { detected: true },
      chosen_value: browserType,
      reason: `Browser type: ${browserType}`
    },
    {
      decision_id: DECISION_IDS.ENV_VIEWPORT_SIZE,
      category: 'ENVIRONMENT',
      timestamp: now,
      inputs: { default_viewport: true },
      chosen_value: viewport,
      reason: `Viewport size: ${viewport.width}x${viewport.height}`
    }
  ]);
}

export default DecisionRecorder;



