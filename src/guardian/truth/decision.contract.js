/**
 * Truth Contract: Decision (Verdict Authority)
 * 
 * Authoritative type definitions for the Decision object (decision.json).
 * The decision is the canonical verdict output and must align with the snapshot.
 * 
 * @module truth/decision.contract
 */

/**
 * @typedef {import('./snapshot.contract.js').PolicyEvaluation} PolicyEvaluation
 * @typedef {import('./snapshot.contract.js').SiteIntelligence} SiteIntelligence
 * @typedef {import('./snapshot.contract.js').BaselineDiff} BaselineDiff
 * @typedef {import('./snapshot.contract.js').MarketImpactSummary} MarketImpactSummary
 * @typedef {import('./snapshot.contract.js').HonestyContract} HonestyContract
 * @typedef {import('./attempt.contract.js').AttemptResult} AttemptResult
 * @typedef {import('./snapshot.contract.js').FlowResult} FlowResult
 */

/**
 * Final verdict (canonical values)
 * @typedef {'READY'|'FRICTION'|'DO_NOT_LAUNCH'|'ERROR'} FinalVerdict
 */

/**
 * Verdict source (which component determined the verdict)
 * @typedef {'rules_engine'|'rules_engine_fallback'|'flows_failure'|'flows_friction'|'attempts_failure'|'attempts_friction'|'journey_downgrade'|'insufficient_data'|'observed_success'|'policy_hard_failure'|'baseline_regression'|'error_handler'} VerdictSource
 */

/**
 * Confidence level
 * @typedef {'low'|'medium'|'high'} ConfidenceLevel
 */

/**
 * Decision reason object
 * @typedef {Object} DecisionReason
 * @property {string} code - Reason code (e.g., 'ATTEMPT_FAILURE', 'POLICY_VIOLATION')
 * @property {string} message - Human-readable reason message
 * @property {string} [severity] - Optional severity level
 * @property {Object} [evidence] - Optional evidence object
 * @property {string} [scope] - Optional scope (e.g., 'attempt:contact-form')
 */

/**
 * Verdict history entry
 * @typedef {Object} VerdictHistoryEntry
 * @property {number|string} phase - Phase number or string
 * @property {VerdictSource|string} source - Verdict source
 * @property {FinalVerdict|string} [suggestedVerdict] - Suggested verdict at this phase
 * @property {string} reasonCode - Reason code
 * @property {string|number} timestamp - ISO timestamp or number
 * @property {string} [step] - Optional step identifier
 * @property {number} [count] - Optional count
 * @property {string[]} [triggeredRuleIds] - Optional triggered rule IDs
 * @property {FinalVerdict|string} [previousVerdict] - Previous verdict (for downgrades)
 * @property {Object} [details] - Optional details object
 * @property {number} [regressionCount] - Optional regression count
 */

/**
 * Decision counters (attempt execution statistics)
 * @typedef {Object} DecisionCounters
 * @property {number} attemptsExecuted - Number of attempts executed
 * @property {number} successful - Number of successful attempts
 * @property {number} failed - Number of failed attempts
 * @property {number} skipped - Number of skipped attempts
 * @property {number} nearSuccess - Number of near-success attempts
 */

/**
 * Flow input statistics
 * @typedef {Object} FlowInputStats
 * @property {number} total - Total number of flows
 * @property {number} failures - Number of failed flows
 * @property {number} frictions - Number of flows with friction
 */

/**
 * Decision inputs
 * @typedef {Object} DecisionInputs
 * @property {PolicyEvaluation} policy - Policy evaluation result
 * @property {BaselineDiff} baseline - Baseline diff result
 * @property {MarketImpactSummary} market - Market impact summary
 * @property {FlowInputStats} flows - Flow statistics
 */

/**
 * Decision outcomes
 * @typedef {Object} DecisionOutcomes
 * @property {FlowResult[]} flows - Flow results array
 * @property {AttemptResult[]} attempts - Attempt results array
 */

/**
 * Coverage details entry
 * @typedef {Object} CoverageDetailsEntry
 * @property {string} attempt - Attempt ID
 * @property {string} reason - Skip reason
 * @property {string} [code] - Skip reason code
 */

/**
 * Decision coverage
 * @typedef {Object} DecisionCoverage
 * @property {number} total - Total relevant attempts
 * @property {number} executed - Number of attempts executed
 * @property {number} gaps - Number of gaps (untested attempts)
 * @property {CoverageDetailsEntry[]} skipped - Skipped attempts details
 * @property {CoverageDetailsEntry[]} disabled - Disabled attempts details
 */

/**
 * Audit summary
 * @typedef {Object} AuditSummary
 * @property {string[]} tested - Array of tested attempt IDs
 * @property {Object} notTested - Not tested attempts
 * @property {string[]} notTested.disabledByPreset - Disabled by preset
 * @property {string[]} notTested.userFiltered - User filtered
 * @property {string[]} notTested.notApplicable - Not applicable
 * @property {string[]} notTested.missing - Missing attempts
 */

/**
 * Applicability statistics
 * @typedef {Object} ApplicabilityStats
 * @property {number} relevantTotal - Total relevant attempts
 * @property {number} executed - Number executed
 * @property {number} notObserved - Number not observed (not applicable)
 * @property {number} skippedNeutral - Number skipped (user filtered + disabled)
 * @property {number} coveragePercent - Coverage percentage
 */

/**
 * Action hint
 * @typedef {Object} ActionHint
 * @property {string} category - Hint category
 * @property {string} title - Hint title
 * @property {string} description - Hint description
 * @property {number} priority - Priority (1 = highest)
 * @property {string[]} actions - Array of action strings
 */

/**
 * Explanation section
 * @typedef {Object} ExplanationSection
 * @property {string} summary - Section summary
 * @property {string} explanation - Section explanation
 * @property {string[]} [details] - Section details array
 */

/**
 * Verdict explanation
 * @typedef {Object} VerdictExplanation
 * @property {string} summary - Verdict summary
 * @property {string} explanation - Verdict explanation
 * @property {string[]} [details] - Verdict details array
 */

/**
 * Decision object (written to decision.json)
 * 
 * This is the canonical decision structure written to decision.json.
 * It must align with snapshot.verdict and snapshot.meta.result.
 * 
 * @typedef {Object} Decision
 * @property {string} runId - Unique run identifier
 * @property {string} url - Base URL tested
 * @property {string} timestamp - ISO timestamp when decision was made
 * @property {string} preset - Preset ID used
 * @property {string} policyName - Policy name
 * @property {FinalVerdict} finalVerdict - Final canonical verdict
 * @property {number} exitCode - Exit code (0|1|2|3)
 * @property {DecisionReason[]} reasons - Array of decision reasons
 * @property {ActionHint[]} actionHints - Array of action hints
 * @property {Object} resolved - Resolved configuration
 * @property {Object} attestation - Attestation data
 * @property {DecisionCounters} counts - Attempt execution counters
 * @property {DecisionInputs} inputs - Decision inputs (policy, baseline, market, flows)
 * @property {DecisionOutcomes} outcomes - Decision outcomes (flows, attempts)
 * @property {DecisionCoverage} coverage - Coverage statistics
 * @property {AuditSummary} auditSummary - Audit summary (tested vs not tested)
 * @property {Object<string, ExplanationSection>} sections - Structured explanation sections
 * @property {VerdictExplanation} explanation - Verdict explanation
 * @property {SiteIntelligence} [siteIntelligence] - Site intelligence (if available)
 * @property {Object} [observedCapabilities] - Observable capabilities (if available)
 * @property {ApplicabilityStats} applicability - Applicability statistics
 * @property {Object} [policySignals] - Rules engine policy signals (if available)
 * @property {string[]} triggeredRules - Array of triggered rule IDs
 * @property {Object} honestyContract - Honesty contract data
 * @property {string[]} honestyContract.testedScope - What was tested
 * @property {string[]} honestyContract.untestedScope - What was not tested
 * @property {string[]} honestyContract.limits - Limitations
 * @property {Object} honestyContract.nonClaims - Explicit non-claims
 * @property {Object} honestyContract.coverageStats - Coverage statistics
 * @property {Object} honestyContract.confidenceBasis - Confidence basis
 * @property {string} honestyContract.disclaimer - Disclaimer text
 */

/**
 * Final decision object (from buildFinalDecision)
 * 
 * This is the internal decision object returned by buildFinalDecision().
 * Some fields are not written to decision.json but are used internally.
 * 
 * @typedef {Object} FinalDecision
 * @property {FinalVerdict} finalVerdict - Final canonical verdict
 * @property {VerdictSource} verdictSource - Which component determined verdict
 * @property {VerdictHistoryEntry[]} verdictHistory - Decision evolution history
 * @property {DecisionReason[]} reasons - Array of decision reasons
 * @property {number} confidence - Confidence score (0-1)
 * @property {number} exitCode - Exit code (0|1|2)
 * @property {number} finalExitCode - Duplicate of exitCode (backward compatibility)
 * @property {Object} coverageInfo - Coverage information
 * @property {Object|null} humanPath - Human navigation path (if available)
 * @property {Object} networkSafety - Network safety signals
 * @property {Object[]} secretFindings - Secret findings array
 * @property {Object} [policySignals] - Rules engine policy signals (if available)
 * @property {string[]} [triggeredRuleIds] - Triggered rule IDs (if available)
 */

/**
 * Error decision object (from writeErrorDecision)
 * 
 * Special decision structure for error cases.
 * 
 * @typedef {Object} ErrorDecision
 * @property {string} runId - Unique run identifier
 * @property {string} url - Base URL tested
 * @property {string} timestamp - ISO timestamp
 * @property {string} preset - Preset ID
 * @property {string} policyName - Policy name
 * @property {'ERROR'} finalVerdict - Always 'ERROR'
 * @property {3} exitCode - Always 3
 * @property {'error_handler'} verdictSource - Always 'error_handler'
 * @property {string[]} verdictHistory - Always ['ERROR']
 * @property {Object} meta - Error metadata
 * @property {string} meta.status - Always 'ERROR'
 * @property {string} meta.errorMessage - Error message
 * @property {string|null} meta.errorStack - Error stack trace
 * @property {string|null} determinismHash - Determinism hash (if available)
 * @property {string} mode - Mode ('advisory' or other)
 * @property {DecisionReason[]} reasons - Error reasons
 * @property {ActionHint[]} actionHints - Error action hints
 * @property {Object} resolved - Empty resolved config
 * @property {Object} attestation - Empty attestation
 * @property {DecisionCounters} counts - All zeros
 * @property {DecisionInputs} inputs - Empty inputs
 * @property {DecisionOutcomes} outcomes - Empty outcomes
 * @property {DecisionCoverage} coverage - Empty coverage
 * @property {AuditSummary} auditSummary - Empty audit summary
 * @property {Object<string, ExplanationSection>} sections - Error explanation sections
 * @property {VerdictExplanation} explanation - Error explanation
 * @property {Object} honestyContract - Error honesty contract
 */

/**
 * Exit code mapping
 * 
 * Canonical mapping from verdict to exit code:
 * - READY → 0 (success)
 * - FRICTION → 1 (friction detected)
 * - DO_NOT_LAUNCH → 2 (blocking issues)
 * - ERROR → 3 (internal error)
 * 
 * @typedef {Object} ExitCodeMapping
 * @property {0} READY - Success
 * @property {1} FRICTION - Friction detected
 * @property {2} DO_NOT_LAUNCH - Blocking issues
 * @property {3} ERROR - Internal error
 */

// Export empty object to make this a module (types are exported via JSDoc)
module.exports = {};

