/**
 * GATE 2: DETERMINISTIC ARTIFACTS CONTRACT
 *
 * This module defines the contract for deterministic (canonical) vs non-deterministic (diagnostic) artifacts.
 *
 * VISION REQUIREMENT:
 * - Same inputs → same outputs (verdicts) deterministically
 * - Same inputs → same canonical artifacts (byte-for-byte identical)
 * - No hidden adaptive behavior changing outcomes
 * - If determinism cannot be guaranteed, report INCOMPLETE (not SUCCESS)
 *
 * IMPLEMENTATION STRATEGY:
 * 1. CANONICAL artifacts contain only deterministic data (no timestamps, no runtime durations)
 * 2. DIAGNOSTICS artifacts contain timing/performance/adaptive data (explicitly excluded from hashing)
 * 3. Truth/verdict/hashing ONLY use canonical artifacts
 * 4. Diagnostics are informational only, never affect verdict
 */

/**
 * CANONICAL ARTIFACTS (Deterministic, byte-for-byte identical across runs)
 *
 * These artifacts contain only deterministic data derived from inputs and observations.
 * They NEVER contain:
 * - Timestamps (Date.now(), getTimeProvider().iso())
 * - Runtime durations (elapsed milliseconds)
 * - Adaptive behavior state (settle window extensions, timeout backoffs)
 * - Machine/network dependent timing
 *
 * Files:
 * - traces-canonical.json (observation traces without timestamps)
 * - evidence-index-canonical.json (evidence references without timing)
 * - findings.json (findings without timestamps in metadata)
 * - summary-canonical.json (truth state, coverage, findings without timing)
 */

export const CANONICAL_ARTIFACTS = {
  TRACES: {
    file: 'traces-canonical.json',
    description: 'Observation traces with all timing data removed',
    canonical_fields: [
      'version',          // Static: schema version
      'url',              // Input: URL being observed
      'traces[]',         // Array of interaction traces
      'traces[].interaction',      // What was interacted with
      'traces[].promise',          // What promise was being tested
      'traces[].before',           // State before interaction
      'traces[].after',            // State after interaction
      'traces[].dom',              // DOM state (without timestamps)
      'traces[].network',          // Network data (without timestamps, durations)
      'traces[].console',          // Console messages (without timestamps)
      'traces[].outcome',          // Canonical outcome (SILENT_FAILURE, NAVIGATION, etc.)
      'observedExpectations[]',    // Which expectations were tested
      'coverage',                  // Coverage metrics (counts, not durations)
      'warnings[]'                 // Warnings (without timestamps)
    ],
    removed_fields: [
      'observedAt',              // REMOVED: timestamp
      'traces[].capturedAt',     // REMOVED: timestamp
      'traces[].durationMs',     // REMOVED: runtime duration
      'traces[].dom.settle.durationMs',  // REMOVED: settle duration
      'traces[].network.durationMs',     // REMOVED: network duration
      'traces[].timing.*'        // REMOVED: all timing data
    ]
  },

  EVIDENCE_INDEX: {
    file: 'evidence-index-canonical.json',
    description: 'Evidence references without timing or file paths',
    canonical_fields: [
      'version',           // Static: schema version
      'expectations[]',    // Tested expectations
      'findings[]',        // Canonical finding data
      'findings[].id',     // Deterministic ID
      'findings[].type',   // Finding type
      'findings[].outcome',// Canonical outcome
      'findings[].status', // CONFIRMED, SUSPECTED, UNKNOWN
      'findings[].promise',// Promise specification
      'findings[].evidence',       // Evidence summary (counts, not file paths)
      'findings[].confidence',     // Confidence metrics (not file paths)
      'silences[]',        // Silence records (deterministic data)
      'coverage',          // Coverage summary (counts)
      'determinism'        // Determinism analysis (no timing)
    ],
    removed_fields: [
      'findings[].evidenceDir',         // REMOVED: file path
      'findings[].screenshotPath',      // REMOVED: file path
      'findings[].timestamp',           // REMOVED: timestamp
      'evidence.generatedAt',           // REMOVED: timestamp
      'evidence.processingTimeMs'       // REMOVED: duration
    ]
  },

  FINDINGS: {
    file: 'findings.json',
    description: 'Silent failures detected (deterministic subset)',
    canonical_fields: [
      'version',                 // Static: schema version
      'findings[]',              // Array of findings
      'findings[].id',           // Deterministic ID (from content hash)
      'findings[].type',         // Type (e.g., navigation_failure)
      'findings[].outcome',      // Canonical outcome
      'findings[].status',       // CONFIRMED, SUSPECTED
      'findings[].promise',      // Promise specification
      'findings[].interaction',  // Interaction details
      'findings[].before',       // Before state
      'findings[].after',        // After state
      'findings[].evidence',     // Evidence summary (signal counts)
      'findings[].confidence',   // Confidence score (0-1)
      'enforcement'              // Enforcement metadata
    ],
    removed_fields: [
      'findings[].generatedAt',        // REMOVED: timestamp
      'findings[].evidence.files[]',   // REMOVED: file paths
      'evidence.generatedAt'           // REMOVED: timestamp
    ]
  },

  SUMMARY: {
    file: 'summary-canonical.json',
    description: 'Run summary with only deterministic data',
    canonical_fields: [
      'version',                  // Static: schema version
      'runId',                    // Input: deterministic run ID
      'url',                      // Input: URL observed
      'truth',                    // Truth classification
      'truth.truthState',         // SUCCESS, INCOMPLETE, FINDINGS
      'truth.confidence',         // Confidence level
      'truth.reason',             // Why classified this way
      'truth.whatThisMeans',      // User explanation
      'truth.recommendedAction',  // What to do next
      'truth.coverageSummary',    // Coverage metrics
      'observe',                  // Observation metrics
      'observe.expectationsTotal', // Count
      'observe.attempted',        // Count
      'observe.observed',         // Count
      'observe.unattemptedReasons', // Reason breakdown (counts)
      'detect',                   // Detection metrics
      'detect.findings',          // Finding counts
      'detect.silences',          // Silence counts
      'determinism'               // Determinism analysis
    ],
    removed_fields: [
      'generatedAt',              // REMOVED: timestamp
      'completedAt',              // REMOVED: timestamp
      'durationMs',               // REMOVED: duration
      'timing.*',                 // REMOVED: all timing
      'diagnostics'               // REMOVED: diagnostics (separate file)
    ]
  }
};

/**
 * DIAGNOSTIC ARTIFACTS (Non-deterministic, intentionally excluded from hashing)
 *
 * These artifacts contain timing, performance, and diagnostic information.
 * They are INTENTIONALLY NON-DETERMINISTIC and EXPLICITLY EXCLUDED from:
 * - File integrity hashing
 * - Artifact comparison/verification
 * - Truth/verdict computation
 *
 * Files:
 * - diagnostics.json (timing, performance metrics, adaptive behavior log)
 */

export const DIAGNOSTIC_ARTIFACTS = {
  DIAGNOSTICS: {
    file: 'diagnostics.json',
    description: 'Timing, performance, and diagnostic information (excluded from determinism)',
    diagnostic_fields: [
      'generatedAt',              // When diagnostics were written (timestamp)
      'runtimeMetrics',           // Performance data
      'runtimeMetrics.observePhaseMs',     // How long observation took
      'runtimeMetrics.detectPhaseMs',      // How long detection took
      'runtimeMetrics.totalMs',            // Total time
      'timing',                   // Detailed timing
      'timing.phaseTimings[]',    // Per-phase timing data
      'adaptiveEvents[]',         // Log of adaptive behavior
      'adaptiveEvents[].time',    // When adaptive action occurred
      'adaptiveEvents[].reason',  // Why adaptive action was taken
      'adaptiveEvents[].delta',   // Change made (e.g., settle window extended by 500ms)
      'networkMetrics',           // Network performance
      'cpuMetrics',               // CPU/memory data
      'warnings[]',               // Non-critical warnings
      'debugInfo'                 // Debug information
    ],
    note: 'These fields are INTENTIONALLY NON-DETERMINISTIC and must NEVER be included in artifact integrity hashing or comparison'
  }
};

/**
 * ARTIFACT WRITING GUIDELINES
 *
 * When writing artifacts, follow these rules:
 *
 * 1. CANONICAL ARTIFACTS:
 *    - NEVER include timestamps (use null or omit)
 *    - NEVER include runtime durations
 *    - ALWAYS use stable JSON serialization (sorted keys, sorted arrays)
 *    - These are included in integrity manifests
 *
 * 2. DIAGNOSTIC ARTIFACTS:
 *    - Can include timestamps freely
 *    - Can include runtime durations
 *    - Do NOT need stable serialization (timestamps will differ)
 *    - Must be EXPLICITLY EXCLUDED from integrity manifests
 *    - Must be labeled with "DO NOT USE FOR TRUTH/HASHING" warning
 *
 * 3. TRUTH/VERDICT COMPUTATION:
 *    - ONLY use canonical artifacts
 *    - NEVER depend on timing data
 *    - If promise cannot be verified deterministically, classify as INCOMPLETE or UNPROVEN
 *    - Document any machine/network dependent decisions
 */

/**
 * STABILITY GUARANTEES
 *
 * These fields are GUARANTEED to be identical across runs with same inputs:
 * - All fields in CANONICAL_ARTIFACTS
 * - Finding IDs (derived from deterministic hash of content)
 * - Interaction descriptions
 * - Promise specifications
 * - Coverage counts
 * - Truth classification (SUCCESS/INCOMPLETE/FINDINGS)
 * - Confidence scores (deterministically computed)
 *
 * These fields are ALLOWED to vary across runs:
 * - All fields in DIAGNOSTIC_ARTIFACTS
 * - Adaptive behavior logs
 * - Network timing (varies per machine, network)
 * - CPU/memory metrics
 * - File modification times
 *
 * These fields MUST NEVER VARY across runs:
 * - Verdict/exit code (same inputs → same truth state → same exit code)
 * - Canonical artifact bytes (must be byte-for-byte identical)
 * - Finding count and ordering (deterministically ordered)
 * - Coverage metrics (counts, not times)
 */

/**
 * JSON SERIALIZATION CONTRACT
 *
 * All canonical artifacts must use deterministic JSON serialization:
 *
 * 1. KEYS: Alphabetically sorted
 *    ✓ { "a": 1, "b": 2 }
 *    ✗ { "b": 2, "a": 1 }
 *
 * 2. ARRAYS: Deterministically ordered (typically by ID or content)
 *    ✓ findings sorted by ID: [{ id: "A" }, { id: "B" }]
 *    ✗ findings in insertion order: [{ id: "B" }, { id: "A" }]
 *
 * 3. NULL VALUES: Use explicit null (not undefined)
 *    ✓ { "data": null }
 *    ✗ { "data": undefined } (serializes differently)
 *
 * 4. NUMBERS: No locale-specific formatting
 *    ✓ 0.20 (ratio)
 *    ✗ 0,20 (locale-specific)
 *
 * 5. BOOLEANS: Always true/false (not 1/0)
 *    ✓ "observed": true
 *    ✗ "observed": 1
 */

/**
 * EXAMPLE: Canonical vs Diagnostic Split
 *
 * CANONICAL (traces-canonical.json):
 * {
 *   "version": 1,
 *   "url": "https://example.com",
 *   "traces": [
 *     {
 *       "interaction": { "selector": "button.submit" },
 *       "outcome": "NAVIGATION",
 *       "before": { "url": "https://example.com/form" },
 *       "after": { "url": "https://example.com/success" }
 *     }
 *   ]
 * }
 *
 * DIAGNOSTIC (diagnostics.json):
 * {
 *   "generatedAt": "2026-01-26T12:34:56.789Z",
 *   "runtimeMetrics": {
 *     "observePhaseMs": 1234,
 *     "detectPhaseMs": 456,
 *     "totalMs": 1690
 *   },
 *   "adaptiveEvents": [
 *     {
 *       "time": "2026-01-26T12:34:56.100Z",
 *       "reason": "dom_continued_changing",
 *       "delta": "+500ms settle window"
 *     }
 *   ]
 * }
 *
 * Result:
 * - Same inputs run twice → identical traces-canonical.json (byte-for-byte)
 * - Same inputs run twice → different diagnostics.json (timestamps differ)
 * - Truth computed from canonical only → DETERMINISTIC
 * - Diagnostics provide insights into performance → INFORMATIONAL ONLY
 */
