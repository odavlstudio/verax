/**
 * Truth Contract: Market Reality Snapshot
 * 
 * Authoritative type definitions for the Market Reality Snapshot.
 * The snapshot is the single source of truth for a Guardian run and must be able to fully explain any decision/verdict.
 * 
 * @module truth/snapshot.contract
 */

/**
 * @typedef {import('./attempt.contract.js').AttemptResult} AttemptResult
 * @typedef {import('./attempt.contract.js').AttemptOutcome} AttemptOutcome
 */

/**
 * Snapshot schema version
 * @typedef {'v1'} SnapshotSchemaVersion
 */

/**
 * Snapshot metadata
 * @typedef {Object} SnapshotMeta
 * @property {string} schemaVersion - Always 'v1'
 * @property {string} createdAt - ISO timestamp when snapshot was created
 * @property {string} toolVersion - Guardian tool version (from package.json)
 * @property {string} url - Base URL tested
 * @property {string} runId - Unique run identifier
 * @property {string} [environment] - Optional deployment environment
 * @property {string} [policyHash] - Hash of policy used (if policy evaluation enabled)
 * @property {string} [preset] - Preset ID used for this run
 * @property {Object} [evidenceMetrics] - Evidence collection metrics
 * @property {Object} [coverage] - Coverage signal/statistics
 * @property {Object} [resolved] - Resolved configuration
 * @property {string} [result] - Final verdict result (for backward compatibility)
 * @property {AttemptsSummary} [attemptsSummary] - Summary of attempt execution statistics
 * @property {Object} [attestation] - Attestation data (hash, policyHash, snapshotHash, manifestHash, runId)
 */

/**
 * Attempt execution summary statistics
 * @typedef {Object} AttemptsSummary
 * @property {number} executed - Number of attempts executed
 * @property {number} successful - Number of successful attempts
 * @property {number} failed - Number of failed attempts
 * @property {number} skipped - Number of skipped attempts
 * @property {number} disabled - Number of disabled attempts
 * @property {number} nearSuccess - Number of near-success attempts
 * @property {Object[]} [nearSuccessDetails] - Details of near-success attempts
 */

/**
 * Crawl result data
 * @typedef {Object} CrawlResult
 * @property {string[]} discoveredUrls - All unique URLs found during crawl
 * @property {number} visitedCount - Pages successfully loaded
 * @property {number} failedCount - Pages that failed to load
 * @property {number} safetyBlockedCount - Pages blocked by safety rules
 * @property {Array<{url: string, error: string, timestamp?: string}>} [httpFailures] - Detailed HTTP failures
 * @property {string} [notes] - Human-readable summary
 */

/**
 * Attempt entry in snapshot (derived from AttemptResult)
 * @typedef {Object} SnapshotAttemptEntry
 * @property {string} attemptId - Unique attempt identifier
 * @property {string} attemptName - Human-readable name
 * @property {string} goal - What the user tried to achieve
 * @property {AttemptOutcome} outcome - Attempt outcome
 * @property {boolean} executed - Whether attempt was executed (false for SKIPPED/NOT_APPLICABLE)
 * @property {number} totalDurationMs - Elapsed time in milliseconds
 * @property {number} stepCount - Number of steps executed
 * @property {number} failedStepIndex - Index of first failed step, or -1 if all succeeded
 * @property {Object|null} friction - Friction signals object (from AttemptResult), or null
 * @property {string} [skipReason] - Reason if SKIPPED, NOT_APPLICABLE, or DISCOVERY_FAILED
 * @property {string} [skipReasonCode] - Skip reason code
 * @property {Object} [discoverySignals] - Element discovery signals and heuristics
 * @property {Object} [evidenceSummary] - Evidence summary (screenshots count, validators count, traces captured)
 */

/**
 * Flow result entry
 * @typedef {Object} FlowResult
 * @property {string} flowId - Unique flow identifier
 * @property {string} flowName - Human-readable flow name
 * @property {string} outcome - Flow outcome
 * @property {string} [riskCategory] - Risk category (e.g., 'TRUST/UX')
 * @property {number} stepsExecuted - Number of steps executed
 * @property {number} stepsTotal - Total number of steps
 * @property {number} durationMs - Flow duration in milliseconds
 * @property {Object|null} [failedStep] - Failed step details, or null
 * @property {string|null} [error] - Error message, or null
 * @property {Object|null} [successEval] - Success evaluation object, or null
 */

/**
 * Signal severity
 * @typedef {'low'|'medium'|'high'|'critical'} SignalSeverity
 */

/**
 * Signal type
 * @typedef {'friction'|'failure'|'regression'|'timeout'|'missing_element'|'soft_failure'} SignalType
 */

/**
 * Signal object
 * @typedef {Object} Signal
 * @property {string} id - Unique signal ID
 * @property {SignalSeverity} severity - Signal severity
 * @property {SignalType} type - Signal type
 * @property {string} description - Human-readable description
 * @property {string} [affectedAttemptId] - Attempt ID if specific to an attempt
 * @property {string|Object} [details] - Additional details (string for error message, object for regressions)
 */

/**
 * Verdict confidence level
 * @typedef {'low'|'medium'|'high'} ConfidenceLevel
 */

/**
 * Verdict object
 * @typedef {Object} SnapshotVerdict
 * @property {'READY'|'DO_NOT_LAUNCH'|'FRICTION'} verdict - Final verdict
 * @property {Object} confidence - Confidence information
 * @property {number} confidence.score - Confidence score (0-1)
 * @property {ConfidenceLevel} [confidence.level] - Confidence level
 * @property {string} [confidence.basis] - Basis for confidence
 * @property {string[]} [confidence.reasons] - Confidence reasons
 * @property {string} why - Human-readable explanation
 * @property {string[]} keyFindings - Key findings array
 * @property {Object} evidence - Evidence object
 * @property {string[]} [evidence.screenshots] - Screenshot paths
 * @property {string[]} [evidence.traces] - Trace paths
 * @property {string[]} [evidence.reportPaths] - Report paths
 * @property {string[]} [evidence.affectedPages] - Affected page URLs
 * @property {string[]} limits - Limitations of this run
 * @property {boolean} [honestyViolation] - Whether honesty contract validation failed
 * @property {Object} [honestyContract] - Honesty contract data (embedded in verdict)
 */

/**
 * Risk summary
 * @typedef {Object} RiskSummary
 * @property {number} totalSoftFailures - Total soft failures
 * @property {number} totalFriction - Total friction signals
 * @property {Object} failuresByCategory - Failures grouped by category
 * @property {Object[]} topRisks - Top risks array
 */

/**
 * Market risk entry
 * @typedef {Object} MarketRisk
 * @property {string} attemptId - Which attempt
 * @property {string} validatorId - Which validator or friction signal
 * @property {string} category - REVENUE|LEAD|TRUST|UX
 * @property {string} severity - CRITICAL|WARNING|INFO
 * @property {number} impactScore - 0-100 deterministic score
 * @property {string} humanReadableReason - Explanation
 */

/**
 * Market impact summary
 * @typedef {Object} MarketImpactSummary
 * @property {string} highestSeverity - CRITICAL|WARNING|INFO
 * @property {number} totalRiskCount - Total number of identified risks
 * @property {Object} countsBySeverity - { CRITICAL: N, WARNING: N, INFO: N }
 * @property {MarketRisk[]} topRisks - Top 10 risks, sorted by impact score
 */

/**
 * Interaction result
 * @typedef {Object} InteractionResult
 * @property {string} interactionId - Unique ID
 * @property {string} pageUrl - URL where found
 * @property {string} type - NAVIGATE|CLICK|FORM_FILL
 * @property {string} selector - CSS selector to find element
 * @property {string} outcome - SUCCESS|FAILURE|FRICTION
 * @property {string} [notes] - Details (target URL, error, etc)
 * @property {number} [durationMs] - Execution time
 * @property {string} [errorMessage] - If FAILURE
 * @property {string} [evidencePath] - Path to screenshot
 */

/**
 * Discovery summary
 * @typedef {Object} DiscoverySummary
 * @property {string[]} pagesVisited - URLs crawled
 * @property {number} pagesVisitedCount - Total pages
 * @property {number} interactionsDiscovered - Total candidates found
 * @property {number} interactionsExecuted - Candidates executed
 * @property {Object} interactionsByType - { NAVIGATE: N, CLICK: N, FORM_FILL: N }
 * @property {Object} interactionsByRisk - { safe: N, risky: N }
 * @property {InteractionResult[]} results - Execution results (failures + top successes)
 * @property {string} [summary] - Human-readable summary
 */

/**
 * Attempt artifacts
 * @typedef {Object} AttemptArtifacts
 * @property {string} reportJson - Path to attempt-report.json (relative to artifactDir)
 * @property {string} reportHtml - Path to attempt-report.html (relative to artifactDir)
 * @property {string} screenshotDir - Path to screenshot directory (relative to artifactDir)
 * @property {string} [attemptJson] - Path to attempt.json (relative to artifactDir)
 */

/**
 * Flow artifacts
 * @typedef {Object} FlowArtifacts
 * @property {string[]} screenshots - Screenshot paths
 * @property {string} artifactDir - Artifact directory path (relative to root)
 */

/**
 * Evidence object
 * @typedef {Object} SnapshotEvidence
 * @property {string} artifactDir - Root directory where all artifacts were saved
 * @property {string} [marketReportJson] - Path to market-report.json (relative to artifactDir)
 * @property {string} [marketReportHtml] - Path to market-report.html (relative to artifactDir)
 * @property {string} [traceZip] - Path to trace.zip if enabled (relative to artifactDir)
 * @property {Object<string, AttemptArtifacts>} [attemptArtifacts] - { attemptId => AttemptArtifacts }
 * @property {Object<string, FlowArtifacts>} [flowArtifacts] - { flowId => FlowArtifacts }
 */

/**
 * Baseline diff regressions/improvements
 * @typedef {Object} BaselineDiffEntry
 * @property {string} before - Previous outcome
 * @property {string} after - Current outcome
 * @property {string} reason - Reason for change
 */

/**
 * Baseline diff
 * @typedef {Object} BaselineDiff
 * @property {Object<string, BaselineDiffEntry>} [regressions] - Regressions by attemptId
 * @property {Object<string, BaselineDiffEntry>} [improvements] - Improvements by attemptId
 * @property {number} [attemptsDriftCount] - How many attempts changed outcome
 * @property {Array} [validatorsChanged] - Validator regression details
 */

/**
 * Baseline information
 * @typedef {Object} BaselineInfo
 * @property {boolean} baselineFound - Whether a baseline was loaded
 * @property {boolean} baselineCreatedThisRun - True if baseline was auto-created in this run
 * @property {string} [baselineCreatedAt] - ISO timestamp when baseline was first created
 * @property {string} [baselinePath] - File system path to baseline
 * @property {BaselineDiff|null} [diff] - Comparison result if baseline exists
 */

/**
 * Intelligence data
 * @typedef {Object} IntelligenceData
 * @property {number} totalFailures - Total failures detected
 * @property {Object[]} failures - Failure details (top 50)
 * @property {Object} byDomain - Failures grouped by domain
 * @property {Object} bySeverity - Failures grouped by severity
 * @property {Object[]} escalationSignals - Escalation signals
 * @property {string} [summary] - Human-readable summary
 */

/**
 * Human intent resolution
 * @typedef {Object} HumanIntentResolution
 * @property {boolean} enabled - Whether human intent filtering was enabled
 * @property {number} blockedCount - Number of attempts blocked
 * @property {number} allowedCount - Number of attempts allowed
 * @property {string[]} blockedAttempts - List of blocked attempt IDs
 */

/**
 * Journey summary
 * @typedef {Object} JourneySummary
 * @property {string} stage - Journey stage
 * @property {string[]} path - Journey path
 * @property {boolean} goalReached - Whether goal was reached
 * @property {number} frustrationScore - Frustration score
 * @property {number} confidence - Confidence score
 */

/**
 * Site intelligence
 * @typedef {Object} SiteIntelligence
 * @property {string} siteType - Detected site type
 * @property {number} confidence - Confidence score
 * @property {string} timestamp - ISO timestamp
 * @property {Object} capabilities - Capabilities object (key => { supported, confidence })
 * @property {Object} flowApplicability - Flow applicability data
 * @property {number} signalCount - Number of detected signals
 */

/**
 * Honesty contract confidence basis
 * @typedef {Object} HonestyConfidenceBasis
 * @property {number} score - Confidence score
 * @property {string} summary - Summary text
 * @property {string[]} details - Detailed reasons
 */

/**
 * Honesty contract coverage stats
 * @typedef {Object} HonestyCoverageStats
 * @property {number} executed - Number of attempts executed
 * @property {number} total - Total relevant attempts
 * @property {number} percent - Coverage percentage
 * @property {number} skipped - Number of skipped attempts
 * @property {number} disabled - Number of disabled attempts
 */

/**
 * Honesty contract
 * @typedef {Object} HonestyContract
 * @property {string[]} testedScope - What was actually tested
 * @property {string[]} untestedScope - What was not tested
 * @property {HonestyConfidenceBasis} confidenceBasis - Confidence basis
 * @property {Object} nonClaims - Explicit non-claims
 * @property {string[]} limits - Limitations of this run
 * @property {HonestyCoverageStats} coverageStats - Coverage statistics
 * @property {string[]} [triggeredRuleIds] - Rules engine signals
 */

/**
 * Policy evaluation result
 * @typedef {Object} PolicyEvaluation
 * @property {boolean} passed - Whether policy passed
 * @property {string} policyName - Policy name
 * @property {Object[]} [reasons] - Policy evaluation reasons
 */

/**
 * Market Reality Snapshot
 * 
 * The single source of truth for a Guardian run. Must be self-contained and able to fully explain any decision/verdict.
 * 
 * @typedef {Object} MarketRealitySnapshot
 * @property {SnapshotSchemaVersion} schemaVersion - Always 'v1'
 * @property {SnapshotMeta} meta - Snapshot metadata
 * @property {SnapshotVerdict|null} [verdict] - Unified run-level verdict
 * @property {CrawlResult} [crawl] - Crawl results
 * @property {SnapshotAttemptEntry[]} attempts - Attempt results
 * @property {FlowResult[]} flows - Flow results
 * @property {Signal[]} signals - Detected signals
 * @property {RiskSummary} [riskSummary] - Market risk analysis
 * @property {MarketImpactSummary} [marketImpactSummary] - Market criticality summary
 * @property {DiscoverySummary} [discovery] - Auto-discovered interactions
 * @property {SnapshotEvidence} evidence - Evidence artifacts
 * @property {BaselineInfo} baseline - Baseline information
 * @property {IntelligenceData} [intelligence] - Breakage intelligence
 * @property {HumanIntentResolution} [humanIntent] - Human intent resolution
 * @property {JourneySummary} [journey] - Journey summary
 * @property {SiteIntelligence} [siteIntelligence] - Site intelligence
 * @property {PolicyEvaluation} [policyEvaluation] - Policy evaluation result
 * @property {string} [policyName] - Policy name (if policy evaluation enabled)
 * @property {Object} [resolved] - Resolved configuration (duplicate of meta.resolved for backward compatibility)
 * @property {Object} [evidenceMetrics] - Evidence metrics (duplicate of meta.evidenceMetrics for backward compatibility)
 * @property {Object} [coverage] - Coverage signal (duplicate of meta.coverage for backward compatibility)
 * @property {HonestyContract} [honestyContract] - Honesty contract (may also be embedded in verdict)
 */

// Export empty object to make this a module (types are exported via JSDoc)
module.exports = {};

