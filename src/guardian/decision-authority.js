/**
 * UNIFIED DECISION AUTHORITY
 * 
 * The SINGLE source of truth for final verdict determination.
 * All verdict signals (rules, flows, attempts, journey, policy, baseline) 
 * flow through this function only.
 * 
 * This module is PURE: no IO, no side effects, no hidden state.
 * All dependencies are passed in explicitly.
 * 
 * @typedef {import('./truth/decision.contract.js').FinalDecision} FinalDecision
 * @typedef {import('./truth/decision.contract.js').FinalVerdict} FinalVerdict
 * @typedef {import('./truth/decision.contract.js').VerdictSource} VerdictSource
 * @typedef {import('./truth/decision.contract.js').DecisionReason} DecisionReason
 * @typedef {import('./truth/decision.contract.js').VerdictHistoryEntry} VerdictHistoryEntry
 */

const {
  toCanonicalVerdict,
  mapExitCodeFromCanonical,
  normalizeCanonicalVerdict
} = require('./verdicts');

const {
  computeCoverageSummary,
  computeSelectorConfidence,
  SELECTOR_CONFIDENCE,
  COVERAGE_THRESHOLD
} = require('./coverage-model');

/**
 * RUNTIME GUARD: One-call-per-run enforcement
 * Prevents accidental double calls within the same process execution.
 * Per-run state is maintained via runId passed in options.
 */
const callTracker = new Map(); // runId -> { called: boolean, timestamp }

function validateSingleCall(runId) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Track by runId. If no runId provided, use a default key for tests.
  const trackKey = runId || '__default_run__';
  
  if (callTracker.has(trackKey)) {
    const entry = callTracker.get(trackKey);
    const message = `computeDecisionAuthority called twice in same run (${trackKey}). First call: ${entry.timestamp}`;
    
    if (!isProduction) {
      throw new Error(message);
    }
    // In production, log warning but allow (graceful degradation)
    console.warn(`⚠️  ${message}`);
  }
  
  callTracker.set(trackKey, { called: true, timestamp: new Date().toISOString() });
}

function resetCallTracker(runId) {
  const trackKey = runId || '__default_run__';
  callTracker.delete(trackKey);
}

/**
 * VERDICT SOURCE CONSTANTS
 */
const VERDICT_SOURCE = {
  RULES_ENGINE: 'rules_engine',
  RULES_ENGINE_FALLBACK: 'rules_engine_fallback',
  FLOWS_FAILURE: 'flows_failure',
  FLOWS_FRICTION: 'flows_friction',
  ATTEMPTS_FAILURE: 'attempts_failure',
  ATTEMPTS_FRICTION: 'attempts_friction',
  JOURNEY_DOWNGRADE: 'journey_downgrade',
  INSUFFICIENT_DATA: 'insufficient_data',
  OBSERVED: 'observed_success',
  POLICY_HARD_FAIL: 'policy_hard_failure',
  BASELINE_REGRESSION: 'baseline_regression',
  ERROR: 'error_handler'
};

/**
 * PRIMARY DECISION AUTHORITY FUNCTION
 * 
 * Accepts all signals and produces a single, deterministic final verdict.
 * 
 * @param {Object} signals - All verdict input signals
 * @param {Array} signals.flows - Flow execution results
 * @param {Array} signals.attempts - Attempt execution results
 * @param {Object} signals.rulesEngineOutput - Rules engine result (if successful)
 * @param {string} signals.journeyVerdict - Journey verdict (if human journey executed)
 * @param {Object} signals.policyEval - Policy evaluation result
 * @param {Object} signals.baseline - Baseline comparison result
 * @param {Object} signals.marketImpact - Market impact assessment
 * @param {Object} signals.coverage - Coverage statistics
 * @param {Object} signals.siteIntelligence - Site intelligence data
 * @param {Object} options - Configuration options
 * @param {boolean} options.ciMode - CI mode (affects logging)
 * 
 * @returns {Object} - Final decision object
 *   - finalVerdict: string (READY|FRICTION|DO_NOT_LAUNCH|INSUFFICIENT_DATA|ERROR)
 *   - verdictSource: string (which component determined verdict)
 *   - verdictHistory: Array of {phase, source, suggestedVerdict, reasonCode, timestamp}
 *   - exitCode: number (0|1|2, derived deterministically from finalVerdict)
 *   - reasons: Array of {code, message}
 *   - confidence: number (0-1, how confident is the verdict)
 */
function computeDecisionAuthority(signals, options = {}) {
  const runId = options.runId; // Per-run identifier
  const timestamp = Date.now();
  
  // RUNTIME GUARD: Enforce single call per run
  validateSingleCall(runId);
  
  // Initialize tracking
  /** @type {VerdictHistoryEntry[]} */
  const verdictHistory = [];
  /** @type {DecisionReason[]} */
  const reasons = [];
  /** @type {FinalVerdict|null} */
  let currentVerdict = null;
  /** @type {VerdictSource|null} */
  let verdictSource = null;
  let finalConfidence = 1.0;

  // Extract signals with safe defaults
  const flows = signals.flows || [];
  const attempts = signals.attempts || [];
  const rulesEngineOutput = signals.rulesEngineOutput || null;
  const journeyVerdict = signals.journeyVerdict || null;
  const policyEval = signals.policyEval || null;
  const baseline = signals.baseline || {};
  const audit = signals.audit || {};
  const humanPath = signals.humanPath || null; // Stage 3
  const networkSafety = signals.networkSafety || {};
  const secretFindings = signals.secretFindings || [];

  // ========================================================================
  // COVERAGE & SELECTOR CONFIDENCE PRE-CHECK
  // ========================================================================
  
  const coverageSummary = computeCoverageSummary(attempts, flows, audit);
  const selectorConfidenceSummary = computeSelectorConfidence(attempts);
  
  // Store for artifact inclusion
  const coverageInfo = {
    ...coverageSummary,
    selectorConfidence: selectorConfidenceSummary
  };

  // ========================================================================
  // PHASE 1: RULES ENGINE AUTHORITY (Highest Priority)
  // ========================================================================
  
  if (rulesEngineOutput) {
    // Rules engine succeeded and produced a verdict
    const rulesVerdict = toCanonicalVerdict(rulesEngineOutput.finalVerdict);
    
    verdictHistory.push(/** @type {VerdictHistoryEntry} */ ({
      phase: 1,
      source: VERDICT_SOURCE.RULES_ENGINE,
      suggestedVerdict: rulesVerdict,
      reasonCode: 'RULES_ENGINE_TRIGGERED',
      triggeredRuleIds: rulesEngineOutput.triggeredRuleIds || [],
      timestamp
    }));

    // Add final normalization entry to ensure >= 2 history entries
    const timestamp2 = new Date().toISOString();
    verdictHistory.push(/** @type {VerdictHistoryEntry} */ ({
      phase: 'final',
      source: 'normalization',
      suggestedVerdict: rulesVerdict,
      reasonCode: 'VERDICT_NORMALIZED',
      timestamp: timestamp2
    }));

    currentVerdict = /** @type {FinalVerdict} */ (rulesVerdict);
    verdictSource = /** @type {VerdictSource} */ (VERDICT_SOURCE.RULES_ENGINE);
    
    // Add rules reasons to main reasons array
    if (rulesEngineOutput.reasons) {
      reasons.push(...rulesEngineOutput.reasons);
    }

    // ====================================================================
    // COVERAGE ENFORCEMENT: READY requires sufficient coverage
    // ====================================================================
    if (rulesVerdict === 'READY' && coverageSummary.coverageStatus === 'INSUFFICIENT') {
      // READY cannot proceed without sufficient coverage
      reasons.push({
        code: 'COVERAGE_INSUFFICIENT',
        message: `Coverage ${(coverageSummary.coverageRatio * 100).toFixed(1)}% below 70% threshold`,
        severity: 'blocker'
      });
      
      // Downgrade to FRICTION
      verdictHistory.push(/** @type {VerdictHistoryEntry} */ ({
        phase: 'enforcement',
        source: 'coverage_check',
        suggestedVerdict: 'FRICTION',
        reasonCode: 'COVERAGE_INSUFFICIENT',
        timestamp: new Date().toISOString()
      }));
      
      currentVerdict = /** @type {FinalVerdict} */ ('FRICTION');
      verdictSource = 'coverage_downgrade';
    }
    
    // SELECTOR CONFIDENCE ENFORCEMENT: LOW confidence on critical path downgrades verdict
    if (rulesVerdict === 'READY' && 
        selectorConfidenceSummary.selectorConfidenceMin === SELECTOR_CONFIDENCE.LOW) {
      reasons.push({
        code: 'LOW_SELECTOR_CONFIDENCE',
        message: 'Critical interaction steps used LOW-confidence selectors (classes, nth-child)',
        severity: 'warning'
      });
      
      verdictHistory.push(/** @type {VerdictHistoryEntry} */ ({
        phase: 'enforcement',
        source: 'selector_confidence_check',
        suggestedVerdict: 'FRICTION',
        reasonCode: 'LOW_SELECTOR_CONFIDENCE',
        timestamp: new Date().toISOString()
      }));
      
      currentVerdict = /** @type {FinalVerdict} */ ('FRICTION');
      verdictSource = /** @type {VerdictSource} */ ('selector_downgrade');
    }

    // Rules engine verdict takes absolute precedence - return immediately
    return buildFinalDecision({
      finalVerdict: /** @type {FinalVerdict} */ (currentVerdict || rulesVerdict),
      verdictSource: /** @type {VerdictSource} */ (verdictSource || VERDICT_SOURCE.RULES_ENGINE),
      verdictHistory: /** @type {VerdictHistoryEntry[]} */ (verdictHistory),
      reasons,
      confidence: rulesEngineOutput.confidence || 0.95,
      exitCode: mapExitCodeFromCanonical(currentVerdict || rulesVerdict),
      coverageInfo,
      humanPath,
      networkSafety,
      secretFindings
    });
  }

  // ========================================================================
  // PHASE 2: LEGACY VERDICT COMPUTATION (Flows → Attempts → Journey)
  // ========================================================================

  // Classify flows
  const failedFlows = flows.filter(f => 
    f.outcome === 'FAILURE' || f.success === false
  );
  const frictionFlows = flows.filter(f => 
    f.outcome === 'FRICTION'
  );
  const notApplicableFlows = flows.filter(f => f.outcome === 'NOT_APPLICABLE');

  // Classify attempts
  const executedAttempts = attempts.filter(a => a.executed);
  const failedAttempts = executedAttempts.filter(a => 
    a.outcome === 'FAILURE'
  );
  const frictionAttempts = executedAttempts.filter(a => 
    a.outcome === 'FRICTION'
  );
  const notApplicableAttempts = attempts.filter(a => a.outcome === 'NOT_APPLICABLE');
  const successfulAttempts = executedAttempts.filter(a => a.outcome === 'SUCCESS');

  // Count applicable signals
  const applicableAttempts = attempts.filter(a => a.outcome !== 'NOT_APPLICABLE');
  const applicableFlows = flows.filter(f => f.outcome !== 'NOT_APPLICABLE');

  // STEP 2a: Check for CRITICAL FAILURES (Flows)
  if (failedFlows.length > 0) {
    verdictHistory.push(/** @type {VerdictHistoryEntry} */ ({
      phase: 2,
      step: 'a',
      source: VERDICT_SOURCE.FLOWS_FAILURE,
      suggestedVerdict: 'DO_NOT_LAUNCH',
      reasonCode: 'FLOWS_HAVE_FAILURES',
      count: failedFlows.length,
      timestamp
    }));

    currentVerdict = /** @type {FinalVerdict} */ ('DO_NOT_LAUNCH');
    verdictSource = /** @type {VerdictSource} */ (VERDICT_SOURCE.FLOWS_FAILURE);
    reasons.push({
      code: 'FLOW_FAILURES',
      message: `Critical flow failures detected (${failedFlows.length}): ${failedFlows.map(f => f.flowId || f.flowName).join(', ')}`
    });
    
    // Don't check attempts if flows already failed
    return buildFinalDecision({
      finalVerdict: /** @type {FinalVerdict} */ (currentVerdict),
      verdictSource: /** @type {VerdictSource} */ (verdictSource),
      verdictHistory: /** @type {VerdictHistoryEntry[]} */ (verdictHistory),
      reasons: enrichReasons(reasons, {failedFlows, failedAttempts, notApplicableFlows, notApplicableAttempts}),
      confidence: 0.99,
      exitCode: mapExitCodeFromCanonical(currentVerdict),
      coverageInfo,
      humanPath,
      networkSafety,
      secretFindings
    });
  }

  // STEP 2b: Check for FLOW FRICTION
  if (frictionFlows.length > 0 && failedFlows.length === 0) {
    verdictHistory.push(/** @type {VerdictHistoryEntry} */ ({
      phase: 2,
      step: 'b',
      source: VERDICT_SOURCE.FLOWS_FRICTION,
      suggestedVerdict: 'FRICTION',
      reasonCode: 'FLOWS_HAVE_FRICTION',
      count: frictionFlows.length,
      timestamp
    }));

    currentVerdict = 'FRICTION';
    verdictSource = VERDICT_SOURCE.FLOWS_FRICTION;
    reasons.push({
      code: 'FLOW_FRICTION',
      message: `Flow friction detected (${frictionFlows.length}): ${frictionFlows.map(f => f.flowId || f.flowName).join(', ')}`
    });
  }

  // STEP 2c: Check for ATTEMPT FAILURES (only if current verdict is not already FRICTION)
  if (currentVerdict !== 'FRICTION' && failedAttempts.length > 0) {
    verdictHistory.push(/** @type {VerdictHistoryEntry} */ ({
      phase: 2,
      step: 'c',
      source: VERDICT_SOURCE.ATTEMPTS_FAILURE,
      suggestedVerdict: 'DO_NOT_LAUNCH',
      reasonCode: 'ATTEMPTS_HAVE_FAILURES',
      count: failedAttempts.length,
      timestamp
    }));

    currentVerdict = 'DO_NOT_LAUNCH';
    verdictSource = VERDICT_SOURCE.ATTEMPTS_FAILURE;
    reasons.push({
      code: 'ATTEMPT_FAILURES',
      message: `Critical attempt failures detected (${failedAttempts.length}): ${failedAttempts.map(a => a.attemptId).join(', ')}`
    });

    return buildFinalDecision({
      finalVerdict: /** @type {FinalVerdict} */ (currentVerdict),
      verdictSource: /** @type {VerdictSource} */ (verdictSource),
      verdictHistory: /** @type {VerdictHistoryEntry[]} */ (verdictHistory),
      reasons: enrichReasons(reasons, {failedAttempts, notApplicableAttempts}),
      confidence: 0.99,
      exitCode: mapExitCodeFromCanonical(currentVerdict),
      coverageInfo,
      humanPath,
      networkSafety,
      secretFindings
    });
  }

  // STEP 2d: Check for ATTEMPT FRICTION (only if not already FRICTION from flows)
  if (currentVerdict !== 'FRICTION' && frictionAttempts.length > 0 && failedAttempts.length === 0) {
    verdictHistory.push(/** @type {VerdictHistoryEntry} */ ({
      phase: 2,
      step: 'd',
      source: VERDICT_SOURCE.ATTEMPTS_FRICTION,
      suggestedVerdict: 'FRICTION',
      reasonCode: 'ATTEMPTS_HAVE_FRICTION',
      count: frictionAttempts.length,
      timestamp
    }));

    currentVerdict = 'FRICTION';
    verdictSource = VERDICT_SOURCE.ATTEMPTS_FRICTION;
    reasons.push({
      code: 'ATTEMPT_FRICTION',
      message: `Attempt friction detected (${frictionAttempts.length}): ${frictionAttempts.map(a => a.attemptId).join(', ')}`
    });
  }

  // STEP 2e: Check for POLICY HARD FAILURE
  if (policyEval && !policyEval.passed && policyEval.exitCode === 1) {
    verdictHistory.push(/** @type {VerdictHistoryEntry} */ ({
      phase: 2,
      step: 'e',
      source: VERDICT_SOURCE.POLICY_HARD_FAIL,
      suggestedVerdict: 'DO_NOT_LAUNCH',
      reasonCode: 'POLICY_HARD_FAILURE',
      timestamp
    }));

    currentVerdict = /** @type {FinalVerdict} */ ('DO_NOT_LAUNCH');
    verdictSource = /** @type {VerdictSource} */ (VERDICT_SOURCE.POLICY_HARD_FAIL);
    reasons.push({
      code: 'POLICY_HARD_FAILURE',
      message: policyEval.summary || 'Policy hard failure detected'
    });

    return buildFinalDecision({
      finalVerdict: /** @type {FinalVerdict} */ (currentVerdict),
      verdictSource: /** @type {VerdictSource} */ (verdictSource),
      verdictHistory: /** @type {VerdictHistoryEntry[]} */ (verdictHistory),
      reasons: enrichReasons(reasons, {policyEval}),
      confidence: 0.99,
      exitCode: mapExitCodeFromCanonical(currentVerdict),
      coverageInfo,
      humanPath,
      networkSafety,
      secretFindings
    });
  }

  // ========================================================================
  // PHASE 3: DETERMINE DEFAULT VERDICT (No failures/friction found)
  // ========================================================================

  // Check if we have any applicable signals
  if (applicableAttempts.length === 0 && applicableFlows.length === 0) {
    verdictHistory.push(/** @type {VerdictHistoryEntry} */ ({
      phase: 3,
      source: VERDICT_SOURCE.INSUFFICIENT_DATA,
      suggestedVerdict: 'INSUFFICIENT_DATA',
      reasonCode: 'NO_APPLICABLE_SIGNALS',
      timestamp
    }));

    currentVerdict = 'INSUFFICIENT_DATA';
    verdictSource = VERDICT_SOURCE.INSUFFICIENT_DATA;
    reasons.push({
      code: 'NO_APPLICABLE_SIGNALS',
      message: 'No applicable flows or attempts found to execute'
    });
    finalConfidence = 0.3;
  } else {
    // We have signals and no critical failures/friction
    verdictHistory.push(/** @type {VerdictHistoryEntry} */ ({
      phase: 3,
      source: VERDICT_SOURCE.OBSERVED,
      suggestedVerdict: 'OBSERVED',
      reasonCode: 'NO_CRITICAL_FAILURES',
      timestamp
    }));

    currentVerdict = /** @type {FinalVerdict} */ ('READY');
    verdictSource = VERDICT_SOURCE.OBSERVED;
    reasons.push({
      code: 'OBSERVED_SUCCESS',
      message: `Executed ${executedAttempts.length} attempt(s): ${successfulAttempts.length} successful, ${failedAttempts.length} failed, ${frictionAttempts.length} friction`
    });
    finalConfidence = 0.95;

    // *** COVERAGE ENFORCEMENT IN PHASE 3 ***
    // Even if no failures/friction, coverage must still be sufficient for READY
    if (coverageInfo.coverageStatus === 'INSUFFICIENT') {
      verdictHistory.push(/** @type {VerdictHistoryEntry} */ ({
        phase: 3,
        source: 'coverage_enforcement',
        suggestedVerdict: 'FRICTION',
        reasonCode: 'COVERAGE_INSUFFICIENT',
        details: {
          coverage: coverageInfo.coverageRatio,
          threshold: COVERAGE_THRESHOLD,
          message: `Coverage is ${(coverageInfo.coverageRatio * 100).toFixed(1)}%, below ${(COVERAGE_THRESHOLD * 100).toFixed(0)}% threshold`
        },
        timestamp
      }));

      currentVerdict = /** @type {FinalVerdict} */ ('FRICTION');
      verdictSource = 'coverage_downgrade';
      finalConfidence = 0.75;
    }

    // *** SELECTOR CONFIDENCE ENFORCEMENT IN PHASE 3 ***
    // Even if coverage OK, LOW selector confidence blocks READY
    if (currentVerdict !== 'FRICTION' && 
        coverageInfo.selectorConfidence && 
        coverageInfo.selectorConfidence.selectorConfidenceMin === SELECTOR_CONFIDENCE.LOW) {
      verdictHistory.push(/** @type {VerdictHistoryEntry} */ ({
        phase: 3,
        source: 'selector_confidence_enforcement',
        suggestedVerdict: 'FRICTION',
        reasonCode: 'LOW_SELECTOR_CONFIDENCE',
        details: {
          minConfidence: coverageInfo.selectorConfidence.selectorConfidenceMin,
          message: 'Critical interaction steps used LOW-confidence selectors (classes, nth-child, text)'
        },
        timestamp
      }));

      currentVerdict = /** @type {FinalVerdict} */ ('FRICTION');
      verdictSource = 'selector_downgrade';
      finalConfidence = 0.75;
    }
  }

  // ========================================================================
  // PHASE 4: JOURNEY VERDICT MERGE (Can downgrade but not upgrade)
  // ========================================================================

  if (journeyVerdict) {
    const canonicalJourney = toCanonicalVerdict(journeyVerdict);
    const canonicalCurrent = toCanonicalVerdict(currentVerdict);
    
    const rank = { READY: 0, FRICTION: 1, DO_NOT_LAUNCH: 2 };
    
    // Journey can only downgrade (move to higher rank number)
    if (rank[canonicalJourney] > rank[canonicalCurrent]) {
      verdictHistory.push(/** @type {VerdictHistoryEntry} */ ({
        phase: 4,
        source: VERDICT_SOURCE.JOURNEY_DOWNGRADE,
        previousVerdict: currentVerdict,
        suggestedVerdict: canonicalJourney,
        reasonCode: 'JOURNEY_DOWNGRADE',
        timestamp
      }));

      currentVerdict = /** @type {FinalVerdict} */ (canonicalJourney);
      verdictSource = VERDICT_SOURCE.JOURNEY_DOWNGRADE;
      reasons.push({
        code: 'JOURNEY_DOWNGRADE',
        message: `Journey verdict downgraded from ${canonicalCurrent} to ${canonicalJourney}`
      });
      finalConfidence = Math.min(finalConfidence, 0.85);
    }
  }

  // ========================================================================
  // PHASE 4a: SECURITY & NETWORK SAFETY ENFORCEMENT
  // ========================================================================

  const httpWarnings = Array.isArray(networkSafety?.httpWarnings) ? networkSafety.httpWarnings : [];
  const excessiveThirdParty = Boolean(networkSafety?.excessiveThirdParty);
  const thirdPartyCount = networkSafety?.thirdPartyCount || 0;
  const thirdPartyDomains = Array.isArray(networkSafety?.thirdPartyDomains) ? networkSafety.thirdPartyDomains : [];

  if (httpWarnings.length > 0) {
    reasons.push({
      code: 'INSECURE_TRANSPORT',
      message: `HTTP detected on ${httpWarnings.length} request(s): ${httpWarnings.slice(0, 3).join(', ')}`
    });
    verdictHistory.push(/** @type {VerdictHistoryEntry} */ ({
      phase: 4,
      source: 'network_safety',
      suggestedVerdict: currentVerdict === 'DO_NOT_LAUNCH' ? currentVerdict : 'FRICTION',
      reasonCode: 'HTTP_WARNING',
      timestamp
    }));
    if (currentVerdict === 'READY') {
      currentVerdict = 'FRICTION';
      verdictSource = 'network_safety';
      finalConfidence = Math.min(finalConfidence, 0.7);
    }
  }

  if (excessiveThirdParty) {
    reasons.push({
      code: 'EXCESSIVE_THIRD_PARTY',
      message: `Excessive third-party requests detected (${thirdPartyCount}). Domains: ${thirdPartyDomains.slice(0, 5).join(', ')}`
    });
    verdictHistory.push(/** @type {VerdictHistoryEntry} */ ({
      phase: 4,
      source: 'network_safety',
      suggestedVerdict: currentVerdict === 'DO_NOT_LAUNCH' ? currentVerdict : 'FRICTION',
      reasonCode: 'EXCESSIVE_THIRD_PARTY',
      timestamp
    }));
    if (currentVerdict === 'READY') {
      currentVerdict = 'FRICTION';
      verdictSource = 'network_safety';
      finalConfidence = Math.min(finalConfidence, 0.7);
    }
  } else if (thirdPartyCount > 0) {
    reasons.push({
      code: 'THIRD_PARTY_REQUESTS',
      message: `Observed ${thirdPartyCount} third-party request(s)`
    });
  }

  if (Array.isArray(secretFindings) && secretFindings.length > 0) {
    reasons.push({
      code: 'MISSING_SECRETS',
      message: `Required secrets missing: ${secretFindings.map(s => s.key).join(', ')}`
    });
    verdictHistory.push(/** @type {VerdictHistoryEntry} */ ({
      phase: 4,
      source: 'secret_hygiene',
      suggestedVerdict: currentVerdict === 'DO_NOT_LAUNCH' ? currentVerdict : 'FRICTION',
      reasonCode: 'MISSING_SECRETS',
      timestamp
    }));
    if (currentVerdict === 'READY') {
      currentVerdict = 'FRICTION';
      verdictSource = 'secret_hygiene';
      finalConfidence = Math.min(finalConfidence, 0.7);
    }
  }

  // ========================================================================
  // PHASE 5: BASELINE REGRESSION CHECK (Informational only, not verdict-changing)
  // ========================================================================

  const diff = baseline.diffResult || baseline.diff;
  if (diff && diff.regressions && Object.keys(diff.regressions).length > 0) {
    verdictHistory.push(/** @type {VerdictHistoryEntry} */ ({
      phase: 5,
      source: 'baseline',
      regressionCount: Object.keys(diff.regressions).length,
      reasonCode: 'BASELINE_REGRESSIONS_DETECTED',
      timestamp
    }));

    reasons.push({
      code: 'BASELINE_REGRESSIONS',
      message: `Baseline regressions detected: ${Object.keys(diff.regressions).join(', ')}`
    });
  }

  // ========================================================================
  // FINALIZE
  // ========================================================================

  // Add NOT_APPLICABLE as informational (not verdict-affecting)
  if (notApplicableFlows.length > 0) {
    reasons.push({
      code: 'NOT_APPLICABLE_FLOWS',
      message: `${notApplicableFlows.length} flow(s) not applicable to this site`
    });
  }

  if (notApplicableAttempts.length > 0) {
    reasons.push({
      code: 'NOT_APPLICABLE_ATTEMPTS',
      message: `${notApplicableAttempts.length} attempt(s) not applicable to this site`
    });
  }

  // Policy warnings (exitCode 2) are informational, not verdict-changing
  if (policyEval && !policyEval.passed && policyEval.exitCode === 2) {
    reasons.push({
      code: 'POLICY_WARNING',
      message: policyEval.summary || 'Policy warnings detected'
    });
  }

  return buildFinalDecision({
    finalVerdict: currentVerdict,
    verdictSource,
    verdictHistory,
    reasons,
    confidence: finalConfidence,
    exitCode: mapExitCodeFromCanonical(currentVerdict),
    coverageInfo,
    humanPath,
    networkSafety,
    secretFindings
  });
}

/**
 * Build the final decision object with all required fields
 * @param {Object} params - Decision parameters
 * @param {FinalVerdict} params.finalVerdict - Final canonical verdict
 * @param {VerdictSource} params.verdictSource - Verdict source
 * @param {VerdictHistoryEntry[]} params.verdictHistory - Verdict history
 * @param {DecisionReason[]} params.reasons - Decision reasons
 * @param {number} params.confidence - Confidence score (0-1)
 * @param {number} [params.exitCode] - Exit code (if not provided, derived from verdict)
 * @param {Object} [params.coverageInfo] - Coverage information
 * @param {Object|null} [params.humanPath] - Human navigation path
 * @param {Object} [params.networkSafety] - Network safety signals
 * @param {Object[]} [params.secretFindings] - Secret findings
 * @returns {FinalDecision}
 */
function buildFinalDecision({
  finalVerdict,
  verdictSource,
  verdictHistory,
  reasons,
  confidence,
  exitCode,
  coverageInfo,
  humanPath,
  networkSafety,
  secretFindings
}) {
  // Ensure deterministic reason ordering
  const sortedReasons = (reasons || [])
    .filter(r => r && r.code && r.message)
    .sort((a, b) => a.code.localeCompare(b.code) || a.message.localeCompare(b.message));

  // Normalize verdict first
  const normalizedVerdict = normalizeCanonicalVerdict(finalVerdict) || 'UNKNOWN';
  
  // Calculate exit code from normalized verdict if not provided
  const finalExitCode = exitCode !== undefined ? exitCode : mapExitCodeFromCanonical(normalizedVerdict);

  return {
    finalVerdict: normalizedVerdict,
    verdictSource,
    verdictHistory,
    reasons: sortedReasons,
    confidence: Math.max(0, Math.min(1, confidence || 0.5)),
    exitCode: finalExitCode,
    
    // For backwards compatibility
    finalExitCode: finalExitCode,
    
    // Coverage information for decision artifact
    coverageInfo: coverageInfo || {},
    
    // Human navigation path (Stage 3)
    humanPath: humanPath || null,

    // Security and hygiene signals
    networkSafety: networkSafety || {},
    secretFindings: secretFindings || []
  };
}

/**
 * Enrich reasons array with additional context
 */
function enrichReasons(reasons, context) {
  const { notApplicableFlows, notApplicableAttempts } = context;

  if (notApplicableFlows && notApplicableFlows.length > 0) {
    reasons.push({
      code: 'NOT_APPLICABLE_FLOWS',
      message: `${notApplicableFlows.length} flow(s) not applicable to this site`
    });
  }

  if (notApplicableAttempts && notApplicableAttempts.length > 0) {
    reasons.push({
      code: 'NOT_APPLICABLE_ATTEMPTS',
      message: `${notApplicableAttempts.length} attempt(s) not applicable to this site`
    });
  }

  return reasons;
}

module.exports = {
  computeDecisionAuthority,
  VERDICT_SOURCE,
  resetCallTracker  // For testing: reset the call tracker
};
