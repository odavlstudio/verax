/**
 * Evidence Validation Module
 * 
 * PURPOSE:
 * Validate evidence completeness and consistency before artifact write,
 * ensuring findings are backed by substantive, non-contradictory evidence.
 * 
 * CONSTRAINTS:
 * - Does NOT modify findings
 * - Does NOT block findings with partial evidence (graceful)
 * - Does NOT change confidence or severity
 * - Validation only, fully non-invasive
 * 
 * OPERATIONS:
 * 1. Check evidence substantiveness (at least minimum evidence)
 * 2. Detect contradictions
 * 3. Flag silent partial evidence
 * 4. Validate signal-evidence consistency
 */

/**
 * Validate that a finding has substantive evidence
 * (at least some concrete proof, not just signals)
 * 
 * @param {Object} finding - Finding to validate
 * @returns {Object} Validation result
 */
export function validateEvidenceSubstantiveness(finding = {}) {
  const evidence = finding.evidence || {};
  const signals = finding.signals || {};

  const hasUrlComparison = evidence.beforeUrl && evidence.afterUrl;
  const hasScreenshots = evidence.beforeScreenshot && evidence.afterScreenshot;
  const hasDOMDiff = evidence.domDiff?.changed === true;
  const hasNetworkEvents = Array.isArray(evidence.networkRequests) && evidence.networkRequests.length > 0;
  const hasConsoleErrors = Array.isArray(evidence.consoleErrors) && evidence.consoleErrors.length > 0;

  const substantiveEvidence = [
    hasUrlComparison,
    hasScreenshots,
    hasDOMDiff,
    hasNetworkEvents,
    hasConsoleErrors,
  ].filter(e => e).length;

  const validation = {
    hasSubstantiveEvidence: substantiveEvidence > 0,
    substantiveEvidenceCount: substantiveEvidence,
    evidence: {
      hasUrlComparison,
      hasScreenshots,
      hasDOMDiff,
      hasNetworkEvents,
      hasConsoleErrors,
    },
    issues: [],
  };

  // Flag cases with signals but no substantive evidence
  const activeSignals = Object.values(signals).filter(v => v === true).length;
  if (activeSignals > 0 && substantiveEvidence === 0) {
    validation.issues.push(
      'PARTIAL_EVIDENCE: Has active signals but no substantive evidence pieces'
    );
  }

  // Flag cases with only one evidence type (risky)
  if (substantiveEvidence === 1) {
    validation.issues.push(
      'SINGLE_EVIDENCE_SOURCE: Finding backed by only one evidence type'
    );
  }

  return validation;
}

/**
 * Check for contradictions in evidence
 * 
 * Examples:
 * - URL changed signal but beforeUrl === afterUrl
 * - Network activity but no network requests recorded
 * - Console errors signal but empty consoleErrors array
 * 
 * @param {Object} finding - Finding to validate
 * @returns {Object} Contradiction checks
 */
export function detectEvidenceContradictions(finding = {}) {
  const evidence = finding.evidence || {};
  const signals = finding.signals || {};

  const contradictions = {
    count: 0,
    issues: [],
  };

  // Navigation contradiction
  if (signals.navigationChanged && evidence.beforeUrl === evidence.afterUrl) {
    contradictions.count++;
    contradictions.issues.push('navigationChanged=true but URLs are identical');
  }

  // Network activity contradiction
  if (
    signals.networkActivity &&
    (!Array.isArray(evidence.networkRequests) || evidence.networkRequests.length === 0)
  ) {
    contradictions.count++;
    contradictions.issues.push('networkActivity=true but no network requests recorded');
  }

  // Console errors contradiction
  if (
    signals.consoleErrors &&
    (!Array.isArray(evidence.consoleErrors) || evidence.consoleErrors.length === 0)
  ) {
    contradictions.count++;
    contradictions.issues.push('consoleErrors=true but no console errors recorded');
  }

  // DOM change contradiction
  if (
    signals.domChanged &&
    (!evidence.domDiff || evidence.domDiff.changed !== true)
  ) {
    contradictions.count++;
    contradictions.issues.push('domChanged=true but no DOM diff or diff.changed !== true');
  }

  // Correlated network but no network activity
  if (
    signals.correlatedNetworkActivity &&
    !signals.networkActivity
  ) {
    contradictions.count++;
    contradictions.issues.push(
      'correlatedNetworkActivity=true but networkActivity=false'
    );
  }

  // Loading signals but no timing
  if (
    (signals.loadingStarted || signals.loadingResolved || signals.loadingStalled) &&
    !evidence.timings
  ) {
    contradictions.count++;
    contradictions.issues.push(
      'Loading signals present but no timing data recorded'
    );
  }

  return {
    hasContradictions: contradictions.count > 0,
    contradictionCount: contradictions.count,
    details: contradictions.issues,
  };
}

/**
 * Validate signal-evidence consistency
 * For each active signal, check if evidence supports it
 * 
 * @param {Object} finding - Finding to validate
 * @returns {Object} Consistency report
 */
export function validateSignalEvidenceConsistency(finding = {}) {
  const evidence = finding.evidence || {};
  const signals = finding.signals || {};

  const consistency = {
    consistentSignals: 0,
    potentiallyUnsupportedSignals: [],
  };

  // Map each signal to required evidence types
  const signalRequirements = {
    navigationChanged: ['beforeUrl', 'afterUrl'],
    domChanged: ['domDiff'],
    feedbackSeen: ['feedbackElements'],
    networkActivity: ['networkRequests'],
    consoleErrors: ['consoleErrors'],
    loadingStarted: ['timings'],
    loadingResolved: ['timings'],
    loadingStalled: ['timings'],
    clientSideRoutingDetected: ['beforeUrl', 'afterUrl'],
    meaningfulDomChange: ['domDiff'],
    ariaLiveUpdated: [],
    ariaRoleAlertsDetected: [],
    ephemeralDOMDetected: ['domDiff'],
  };

  for (const [signal, required] of Object.entries(signalRequirements)) {
    if (signals[signal] !== true) continue;

    // Check if required evidence exists
    const hasRequiredEvidence = required.length === 0 || 
      required.some(key => {
        if (key === 'domDiff') {
          return evidence.domDiff?.changed === true;
        }
        if (key === 'networkRequests') {
          return Array.isArray(evidence.networkRequests) && evidence.networkRequests.length > 0;
        }
        if (key === 'consoleErrors') {
          return Array.isArray(evidence.consoleErrors) && evidence.consoleErrors.length > 0;
        }
        if (key === 'timings') {
          return evidence.timings !== undefined;
        }
        if (key === 'feedbackElements') {
          return Array.isArray(evidence.feedbackElements) && evidence.feedbackElements.length > 0;
        }
        return evidence[key] !== undefined && evidence[key] !== null;
      });

    if (hasRequiredEvidence) {
      consistency.consistentSignals++;
    } else if (required.length > 0) {
      consistency.potentiallyUnsupportedSignals.push(signal);
    }
  }

  return {
    consistent: consistency.potentiallyUnsupportedSignals.length === 0,
    consistentSignals: consistency.consistentSignals,
    potentiallyUnsupportedSignals: consistency.potentiallyUnsupportedSignals,
  };
}

/**
 * Validate a finding's complete evidence integrity
 * This is a holistic check combining substantiveness, contradiction, and consistency
 * 
 * @param {Object} finding - Finding to validate
 * @returns {Object} Complete validation report
 */
export function validateFindingEvidenceIntegrity(finding = {}) {
  const substantiveness = validateEvidenceSubstantiveness(finding);
  const contradictions = detectEvidenceContradictions(finding);
  const consistency = validateSignalEvidenceConsistency(finding);

  // Compute overall integrity score
  const integrityIssues = [
    ...substantiveness.issues,
    ...contradictions.details,
    ...consistency.potentiallyUnsupportedSignals.map(
      s => `Signal ${s} potentially unsupported by evidence`
    ),
  ];

  // Determine integrity level
  let integrityLevel = 'COMPLETE';
  if (integrityIssues.length > 2) {
    integrityLevel = 'INCOMPLETE';
  } else if (integrityIssues.length > 0) {
    integrityLevel = 'PARTIAL';
  }

  return {
    integrityLevel,
    isValidated: integrityLevel === 'COMPLETE',
    substantiveness,
    contradictions,
    consistency,
    issues: integrityIssues,
    issueCount: integrityIssues.length,
  };
}

/**
 * Check for evidence completeness before write
 * Returns true if evidence is sufficient for publication
 * 
 * Does NOT block incomplete evidence (graceful), just flags it
 * 
 * @param {Object} finding - Finding to check
 * @returns {Object} Completeness check
 */
export function checkEvidenceCompleteness(finding = {}) {
  const evidence = finding.evidence || {};
  const signals = finding.signals || {};

  // Minimum requirements for publication:
  // - At least one substantive evidence piece
  // - At least one active signal
  // - No contradictions

  const hasSubstantiveEvidence = [
    evidence.beforeUrl && evidence.afterUrl,
    evidence.beforeScreenshot && evidence.afterScreenshot,
    evidence.domDiff?.changed,
    Array.isArray(evidence.networkRequests) && evidence.networkRequests.length > 0,
    Array.isArray(evidence.consoleErrors) && evidence.consoleErrors.length > 0,
  ].some(e => e);

  const hasActiveSignals = Object.values(signals).some(v => v === true);

  const contradictions = detectEvidenceContradictions(finding);

  const isComplete = hasSubstantiveEvidence && hasActiveSignals && !contradictions.hasContradictions;

  return {
    isComplete,
    readyForPublication: isComplete,
    hasSubstantiveEvidence,
    hasActiveSignals,
    hasContradictions: contradictions.hasContradictions,
    recommendedAction: isComplete ? 'PUBLISH' : 'PUBLISH_WITH_CAVEATS',
  };
}

/**
 * Validate all findings before write
 * 
 * @param {Array} findings - Array of findings to validate
 * @returns {Object} Batch validation report
 */
export function validateFindingsBatch(findings = []) {
  const reports = findings.map(f => ({
    findingId: f.findingId || f.id || 'unknown',
    integrity: validateFindingEvidenceIntegrity(f),
    completeness: checkEvidenceCompleteness(f),
  }));

  const completeCount = reports.filter(r => r.completeness.isComplete).length;
  const incompleteCount = reports.filter(r => !r.completeness.isComplete).length;
  const totalIssues = reports.reduce((sum, r) => sum + r.integrity.issueCount, 0);

  return {
    totalFindings: findings.length,
    completeCount,
    incompleteCount,
    totalIssues,
    allValid: incompleteCount === 0,
    reports,
    summary: {
      completeness: `${completeCount}/${findings.length} findings have complete evidence`,
      issues: `${totalIssues} total evidence integrity issues`,
      recommendation: incompleteCount === 0 ? 'SAFE_TO_PUBLISH' : 'PUBLISH_WITH_CAVEATS',
    },
  };
}

/**
 * Flag finding for manual review if evidence has gaps
 * 
 * @param {Object} finding - Finding to check
 * @returns {Object} Review flag
 */
export function shouldFlagForReview(finding = {}) {
  const integrity = validateFindingEvidenceIntegrity(finding);
  const completeness = checkEvidenceCompleteness(finding);

  const reasons = [];

  if (integrity.integrityLevel === 'INCOMPLETE') {
    reasons.push('INTEGRITY_INCOMPLETE');
  }

  if (!completeness.isComplete) {
    reasons.push('EVIDENCE_INCOMPLETE');
  }

  if (completeness.hasContradictions) {
    reasons.push('EVIDENCE_CONTRADICTIONS');
  }

  return {
    shouldReview: reasons.length > 0,
    reasons,
    reviewLevel: reasons.length > 2 ? 'HIGH' : (reasons.length > 0 ? 'MEDIUM' : 'NONE'),
  };
}








