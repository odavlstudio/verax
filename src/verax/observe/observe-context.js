/**
 * PHASE 21.3 — Observe Context Contract
 * 
 * HARD CONTRACT: Defines the interface between observe-runner and observers
 * 
 * RULES:
 * - Observers MUST only access fields defined in this contract
 * - Observers MUST NOT import from outside observe/*
 * - Observers MUST NOT read files
 * - Observers MUST NOT write artifacts directly
 * - Observers MUST NOT mutate global state
 * - Observers MUST propagate all errors (no silent catches)
 * 
 * Runtime invariant checks enforce these rules.
 */

/**
 * ObserveContext — The context passed to all observers
 * 
 * @typedef {Object} ObserveContext
 * @property {import('playwright').Page} page - Playwright page instance
 * @property {string} baseOrigin - Base origin for same-origin checks
 * @property {Object} scanBudget - Scan budget configuration
 * @property {number} startTime - Start time of the scan (timestamp)
 * @property {Object} frontier - PageFrontier instance
 * @property {Object|null} manifest - Manifest object (if available)
 * @property {Object|null} expectationResults - Expectation execution results
 * @property {boolean} incrementalMode - Whether incremental mode is enabled
 * @property {Object|null} oldSnapshot - Previous snapshot (if available)
 * @property {Object|null} snapshotDiff - Snapshot diff (if available)
 * @property {string} currentUrl - Current page URL
 * @property {string} screenshotsDir - Directory for screenshots
 * @property {number} timestamp - Timestamp for this observation
 * @property {Object} decisionRecorder - DecisionRecorder instance
 * @property {Object} silenceTracker - SilenceTracker instance
 * @property {Object} safetyFlags - Safety flags { allowWrites, allowRiskyActions, allowCrossOrigin }
 * @property {Object} routeBudget - Route-specific budget (computed)
 */

/**
 * RunState — Mutable state passed between observers
 * 
 * @typedef {Object} RunState
 * @property {Array} traces - Array of interaction traces
 * @property {Array} skippedInteractions - Array of skipped interactions
 * @property {Array} observedExpectations - Array of observed expectations
 * @property {number} totalInteractionsDiscovered - Total interactions discovered
 * @property {number} totalInteractionsExecuted - Total interactions executed
 * @property {Array} remainingInteractionsGaps - Remaining interaction gaps
 * @property {boolean} navigatedToNewPage - Whether navigation occurred
 * @property {string|null} navigatedPageUrl - URL of navigated page (if any)
 */

/**
 * Observation — Result returned by an observer
 * 
 * @typedef {Object} Observation
 * @property {string} type - Type of observation (e.g., 'network_idle', 'console_error', 'ui_feedback')
 * @property {string} scope - Scope of observation (e.g., 'page', 'interaction', 'navigation')
 * @property {Object} data - Observation data
 * @property {number} timestamp - Timestamp of observation
 * @property {string} [url] - URL where observation occurred
 */

/**
 * Forbidden imports that observers MUST NOT use
 */
const _FORBIDDEN_IMPORTS = [
  'fs',
  'path',
  '../core/determinism/report-writer',
  '../core/scan-summary-writer',
  './traces-writer',
  './expectation-executor'
];

/**
 * Forbidden context fields that observers MUST NOT access
 */
const FORBIDDEN_CONTEXT_FIELDS = [
  'projectDir',
  'runId',
  'writeFileSync',
  'readFileSync',
  'mkdirSync'
];

/**
 * Validate that an observer result is a valid Observation
 * 
 * @param {Object} observation - Observation to validate
 * @param {string} observerName - Name of observer for error messages
 * @throws {Error} If observation is invalid
 */
export function validateObservation(observation, observerName) {
  if (!observation) {
    throw new Error(`${observerName}: Observer returned null/undefined observation`);
  }
  
  if (typeof observation !== 'object') {
    throw new Error(`${observerName}: Observer returned non-object observation: ${typeof observation}`);
  }
  
  if (!observation.type || typeof observation.type !== 'string') {
    throw new Error(`${observerName}: Observation missing or invalid 'type' field`);
  }
  
  if (!observation.scope || typeof observation.scope !== 'string') {
    throw new Error(`${observerName}: Observation missing or invalid 'scope' field`);
  }
  
  if (!observation.data || typeof observation.data !== 'object') {
    throw new Error(`${observerName}: Observation missing or invalid 'data' field`);
  }
  
  if (typeof observation.timestamp !== 'number') {
    throw new Error(`${observerName}: Observation missing or invalid 'timestamp' field`);
  }
}

/**
 * Validate that context contains only allowed fields
 * 
 * @param {Object} context - Context to validate
 * @throws {Error} If context contains forbidden fields
 */
export function validateContext(context) {
  for (const field of FORBIDDEN_CONTEXT_FIELDS) {
    if (field in context) {
      throw new Error(`ObserveContext contains forbidden field: ${field}. Observers must not access file I/O or project directories.`);
    }
  }
}

/**
 * Create a safe context for observers (removes forbidden fields)
 * 
 * @param {Object} rawContext - Raw context from observe-runner
 * @returns {ObserveContext} Safe context for observers
 */
export function createObserveContext(rawContext) {
  const {
    page,
    baseOrigin,
    scanBudget,
    startTime,
    frontier,
    manifest,
    expectationResults,
    incrementalMode,
    oldSnapshot,
    snapshotDiff,
    currentUrl,
    screenshotsDir,
    timestamp,
    decisionRecorder,
    silenceTracker,
    safetyFlags,
    routeBudget
  } = rawContext;
  
  return {
    page,
    baseOrigin,
    scanBudget,
    startTime,
    frontier,
    manifest,
    expectationResults,
    incrementalMode,
    oldSnapshot,
    snapshotDiff,
    currentUrl,
    screenshotsDir,
    timestamp,
    decisionRecorder,
    silenceTracker,
    safetyFlags: safetyFlags || { allowWrites: false, allowRiskyActions: false, allowCrossOrigin: false },
    routeBudget
  };
}

/**
 * Observer execution order (FIXED - must not change)
 * 
 * This order is critical for determinism and correctness.
 */
export const OBSERVER_ORDER = [
  'navigation-observer',  // 1. Navigation decisions first
  'budget-observer',      // 2. Budget checks before interactions
  'interaction-observer', // 3. Interaction discovery and execution
  'network-observer',     // 4. Network state observation
  'ui-feedback-observer', // 5. UI state observation
  'console-observer',     // 6. Console error observation
  'coverage-observer'     // 7. Coverage gap tracking
];

/**
 * Get observer execution order
 * 
 * @returns {Array<string>} Ordered list of observer names
 */
export function getObserverOrder() {
  return [...OBSERVER_ORDER];
}



