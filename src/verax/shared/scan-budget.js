/**
 * ScanBudget - Single source of truth for all execution limits
 * 
 * All execution-related limits are controlled through this object.
 * No hardcoded limits should exist in execution code paths.
 */

/**
 * @typedef {Object} ScanBudget
 * @property {number} maxTotalInteractions - Maximum total interactions across all pages
 * @property {number} maxInteractionsPerPage - Maximum interactions to discover/execute per page
 * @property {number} maxPages - Maximum pages to visit (currently not used, but reserved for future)
 * @property {number} maxFlows - Maximum flows to execute per run
 * @property {number} maxFlowSteps - Maximum steps per flow
 * @property {number} maxScanDurationMs - Maximum total scan duration in milliseconds
 * @property {number} interactionTimeoutMs - Timeout for individual interaction execution
 * @property {number} navigationTimeoutMs - Timeout for navigation waits
 * @property {number} stabilizationWindowMs - Total stabilization window (mid + end + network wait)
 * @property {number} stabilizationSampleMidMs - First stabilization sample delay
 * @property {number} stabilizationSampleEndMs - Second stabilization sample delay
 * @property {number} networkWaitMs - Additional wait for slow network requests
 * @property {number} navigationStableWaitMs - Wait after navigation before interaction
 * @property {number} initialNavigationTimeoutMs - Timeout for initial page.goto() navigation
 * @property {number} settleTimeoutMs - Timeout for settle operations
 * @property {number} settleIdleMs - Network idle threshold for settle
 * @property {number} settleDomStableMs - DOM stability window for settle
 * @property {number} maxUniqueUrls - Maximum unique normalized URLs (frontier cap)
 * @property {boolean} adaptiveStabilization - Enable adaptive settle extension in THOROUGH/EXHAUSTIVE
 */

/**
 * OBSERVATION WINDOW - Formal definition of the single interaction window
 * 
 * The observation window is the maximum time VERAX observes a single interaction
 * from initiation through all post-execution evidence collection phases.
 * This includes execution timeouts, navigation waits, and DOM settle logic.
 * 
 * COMPOSITION (default values):
 * - Interaction execution timeout: 10000ms (interactionTimeoutMs)
 * - Navigation timeout: 15000ms (navigationTimeoutMs, longer to account for slow networks)
 * - Post-interaction settle window: 30000ms (settleTimeoutMs, includes network + DOM stability)
 *
 * The maximum observation window uses the settle timeout because settle logic is
 * the FINAL phase of observation - it waits for the page to stabilize completely
 * and collect all evidence (network events, DOM changes, sensors) before marking
 * the interaction as complete.
 *
 * Typical window: interactionTimeoutMs + navigationTimeoutMs = 25000ms
 * (for interaction execution and immediate navigation consequences)
 *
 * Maximum window: The settleTimeoutMs of 30000ms is used when we need the full
 * observation window including all stabilization checks, network idle detection,
 * and DOM mutation monitoring.
 *
 * Why adaptive behavior exists within the window:
 * - Network is unpredictable; settle logic extends idle checks if network restarts
 * - DOM mutations can be asynchronous; multiple samples check for mutations
 * - User feedback may appear after initial rendering; extended window catches it
 * - This is CONSTITUTIONALLY VALID because the window is finite (settleTimeoutMs)
 *   and bounded - we never wait indefinitely, only extend within fixed limits
 *
 * Determinism guarantee:
 * - Adaptive extensions are DISABLED for deterministic evaluation (see wait-for-settle.js)
 * - Fixed timeouts are used so machine speed doesn't affect verdicts
 * - Silent failures are determined within the bounded window regardless of machine
 */
export const OBSERVATION_WINDOW_MS = 30000; // settleTimeoutMs - maximum single interaction window

/**
 * Default scan budget that reproduces current behavior exactly.
 * 
 * Current values:
 * - maxInteractionsPerPage: 30 (from interaction-discovery.js)
 * - maxScanDurationMs: 60000 (60 seconds, from observe/index.js)
 * - maxFlowSteps: 5 (from observe/index.js)
 * - maxFlows: 3 (from observe/index.js)
 * - interactionTimeoutMs: 10000 (10 seconds, from interaction-runner.js)
 * - navigationTimeoutMs: 15000 (15 seconds, from interaction-runner.js)
 * - stabilizationSampleMidMs: 500 (from interaction-runner.js)
 * - stabilizationSampleEndMs: 1500 (from interaction-runner.js)
 * - networkWaitMs: 1000 (from interaction-runner.js line 49)
 * - navigationStableWaitMs: 2000 (from browser.js STABLE_WAIT_MS)
 * - initialNavigationTimeoutMs: 30000 (from browser.js page.goto timeout)
 * - settleTimeoutMs: 30000 (from settle.js default)
 * - settleIdleMs: 1500 (from settle.js default)
 * - settleDomStableMs: 2000 (from settle.js default)
 * - stabilizationWindowMs: 3000 (500 + 1000 + 1000 + 500 = total stabilization time)
 * - maxTotalInteractions: unlimited (controlled by maxScanDurationMs)
 * - maxPages: 1 (current implementation only scans starting page)
 */
export const DEFAULT_SCAN_BUDGET = {
  maxTotalInteractions: Infinity, // Controlled by maxScanDurationMs in practice
  maxInteractionsPerPage: 30,
    maxPages: 50, // Allow multi-page traversal by default
  maxFlows: 3,
  maxFlowSteps: 5,
  maxScanDurationMs: 60000,
  interactionTimeoutMs: 10000, // Used in interaction execution, triggers silence tracking
  navigationTimeoutMs: 15000, // Used in waitForNavigation, longer than interactionTimeoutMs
  stabilizationWindowMs: 3000, // Total: 500 + 1000 + 1000 + 500
  stabilizationSampleMidMs: 500,
  stabilizationSampleEndMs: 1500,
  networkWaitMs: 1000,
  navigationStableWaitMs: 2000,
  initialNavigationTimeoutMs: 30000,
  settleTimeoutMs: 30000, // Maximum OBSERVATION_WINDOW_MS - final phase includes network + DOM stability
  settleIdleMs: 1500,
  settleDomStableMs: 2000,
  maxUniqueUrls: 500, // Prevent infinite frontier growth on large sites
  adaptiveStabilization: false // Disabled by default, enabled in THOROUGH/EXHAUSTIVE
};

/**
 * Create a scan budget with custom values, falling back to defaults.
 * @param {Partial<ScanBudget>} overrides - Partial budget to override defaults
 * @returns {ScanBudget} Complete scan budget
 */
export function createScanBudget(overrides = {}) {
  return {
    ...DEFAULT_SCAN_BUDGET,
    ...overrides
  };
}




