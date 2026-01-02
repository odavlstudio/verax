/**
 * Truth Contract: Attempt Execution
 * 
 * Authoritative type definitions for Attempt execution and results.
 * This contract ensures consistency across attempt execution, reporting, and snapshot generation.
 * 
 * @module truth/attempt.contract
 */

/**
 * Attempt outcome status
 * @typedef {'SUCCESS'|'FAILURE'|'FRICTION'|'NOT_APPLICABLE'|'DISCOVERY_FAILED'|'SKIPPED'} AttemptOutcome
 */

/**
 * Step execution status
 * @typedef {'pending'|'success'|'failed'|'optional_failed'} StepStatus
 */

/**
 * Friction signal severity
 * @typedef {'low'|'medium'|'high'} FrictionSeverity
 */

/**
 * Friction signal object
 * @typedef {Object} FrictionSignal
 * @property {string} id - Unique signal identifier
 * @property {string} description - Human-readable description
 * @property {string} metric - Metric name (e.g., 'stepDurationMs', 'totalDurationMs', 'retryCount')
 * @property {number} threshold - Threshold value that was exceeded
 * @property {number} observedValue - Actual observed value
 * @property {string|null} affectedStepId - Step ID that triggered this signal, or null for attempt-level
 * @property {FrictionSeverity} severity - Signal severity level
 */

/**
 * Friction thresholds configuration
 * @typedef {Object} FrictionThresholds
 * @property {number} totalDurationMs - Maximum total attempt duration before friction
 * @property {number} stepDurationMs - Maximum single step duration before friction
 * @property {number} retryCount - Maximum retries before friction
 */

/**
 * Friction metrics
 * @typedef {Object} FrictionMetrics
 * @property {number} totalDurationMs - Total attempt duration
 * @property {number} stepCount - Number of steps executed
 * @property {number} totalRetries - Total number of retries across all steps
 * @property {number} maxStepDurationMs - Maximum single step duration
 */

/**
 * Friction analysis result
 * @typedef {Object} FrictionAnalysis
 * @property {boolean} isFriction - Whether friction was detected
 * @property {FrictionSignal[]} signals - Array of friction signals detected
 * @property {string|null} summary - Human-readable friction summary, or null if no friction
 * @property {string[]} reasons - Array of friction reason strings (for backward compatibility)
 * @property {FrictionThresholds} thresholds - Thresholds used for analysis
 * @property {FrictionMetrics} metrics - Metrics collected during execution
 */

/**
 * Validator result
 * @typedef {Object} ValidatorResult
 * @property {string} id - Validator identifier
 * @property {string} type - Validator type
 * @property {string} status - 'PASS', 'FAIL', or 'WARN'
 * @property {string} message - Human-readable result message
 * @property {Object=} evidence - Supporting evidence data
 */

/**
 * Soft failure analysis
 * @typedef {Object} SoftFailureAnalysis
 * @property {boolean} hasSoftFailure - Whether any soft failures were detected
 * @property {number} failureCount - Number of failed validators
 * @property {number} warnCount - Number of warning validators
 */

/**
 * Discovery signals
 * @typedef {Object} DiscoverySignals
 * @property {number} consoleErrorCount - Number of console errors captured
 * @property {number} pageErrorCount - Number of page errors captured
 */

/**
 * Attempt execution step
 * @typedef {Object} AttemptStep
 * @property {string} id - Step identifier
 * @property {string} type - Step type ('navigate', 'click', 'waitFor', etc.)
 * @property {string} target - Step target (selector, URL, etc.)
 * @property {string} description - Human-readable step description
 * @property {string} startedAt - ISO timestamp when step started
 * @property {string=} endedAt - ISO timestamp when step ended (undefined if step failed before completion)
 * @property {number=} durationMs - Step duration in milliseconds (undefined if step failed before completion)
 * @property {StepStatus} status - Step execution status
 * @property {number} retries - Number of retries attempted for this step
 * @property {string[]} screenshots - Array of screenshot file paths
 * @property {string=} domPath - Path to DOM snapshot file (if captured)
 * @property {string=} error - Error message if step failed
 */

/**
 * Attempt artifacts (paths to generated files)
 * @typedef {Object} AttemptArtifacts
 * @property {string=} tracePath - Path to trace.zip file (if network trace enabled)
 * @property {string=} screenshotsDir - Directory containing screenshots
 * @property {string=} attemptReportJsonPath - Path to attempt-report.json
 * @property {string=} attemptReportHtmlPath - Path to attempt-report.html
 * @property {string=} attemptJsonPath - Path to attempt.json snapshot
 */

/**
 * Attempt execution result
 * 
 * This is the canonical shape returned by AttemptEngine.executeAttempt() and consumed
 * by reporters, snapshots, and reality execution.
 * 
 * @typedef {Object} AttemptResult
 * @property {AttemptOutcome} outcome - Attempt outcome status
 * @property {AttemptStep[]} steps - Array of execution steps
 * @property {string} startedAt - ISO timestamp when attempt started
 * @property {string} endedAt - ISO timestamp when attempt ended
 * @property {number} totalDurationMs - Total attempt duration in milliseconds
 * @property {FrictionAnalysis} friction - Friction analysis result
 * @property {string|null} error - Error message if attempt failed, null otherwise
 * @property {string|null} successReason - Success reason if attempt succeeded, null otherwise
 * @property {ValidatorResult[]} validators - Array of validator results
 * @property {SoftFailureAnalysis} softFailures - Soft failure analysis
 * @property {DiscoverySignals} discoverySignals - Discovery signals (console/page errors)
 * @property {string=} attemptId - Attempt identifier (may be added by consumers)
 * @property {string=} attemptName - Human-readable attempt name (may be added by consumers)
 * @property {string=} goal - Attempt goal description (may be added by consumers)
 * @property {string=} skipReason - Reason for skipping (for SKIPPED/NOT_APPLICABLE/DISCOVERY_FAILED outcomes)
 * @property {AttemptArtifacts=} artifacts - Artifact paths (may be added by consumers)
 */

/**
 * Attempt definition (input to execution)
 * @typedef {Object} AttemptDefinition
 * @property {string} id - Attempt identifier
 * @property {string} name - Human-readable name
 * @property {string} goal - Goal description
 * @property {string} riskCategory - Risk category ('LEAD', 'REVENUE', 'TRUST/UX')
 * @property {string} source - Source ('universal', 'curated', etc.)
 * @property {Object[]} baseSteps - Array of step definitions
 * @property {Object[]} successConditions - Array of success condition definitions
 * @property {Object[]=} validators - Array of validator definitions
 */

module.exports = {
  // Types are exported via JSDoc for use with @typedef imports
};

