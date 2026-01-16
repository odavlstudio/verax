/**
 * PHASE 16 — Evidence Hardening: Mandatory Evidence Packages
 * PHASE 21.1 — Evidence Law Hard Lock: Unbreakable invariant enforcement
 * 
 * Central evidence builder that creates standardized Evidence Packages
 * for all findings. Ensures completeness and enforces Evidence Law.
 * 
 * HARD LOCK RULES:
 * - buildEvidencePackage() MUST return complete evidencePackage or throw EvidenceBuildError
 * - No silent failures allowed
 * - CONFIRMED findings without complete evidencePackage is IMPOSSIBLE
 */

/**
 * PHASE 16: Evidence Package Schema
 * 
 * @typedef {Object} EvidencePackage
 * @property {Object} trigger - What triggered the finding (AST/DOM source + context)
 * @property {Object} before - Before state (screenshot, URL, DOM signature)
 * @property {Object} action - Action trace (interaction + timing)
 * @property {Object} after - After state (screenshot, URL, DOM signature)
 * @property {Object} signals - All sensor signals (network, console, ui feedback, route)
 * @property {Object} justification - Confidence reasons and verdict rationale
 * @property {Array<string>} missingEvidence - Fields that are missing (if any)
 * @property {boolean} isComplete - Whether all required fields are present
 */

/**
 * PHASE 16: Required fields for CONFIRMED findings
 * PHASE 21.1: Hard lock - these fields are MANDATORY for CONFIRMED
 */
const REQUIRED_FIELDS_CONFIRMED = [
  'trigger.source',
  'before.screenshot',
  'after.screenshot',
  'before.url',
  'after.url',
  'action.interaction',
  'signals.network',
  'signals.uiSignals',
];

/**
 * PHASE 21.1: Evidence Build Error
 * Thrown when evidence building fails - must NOT be silently caught
 */
export class EvidenceBuildError extends Error {
  constructor(message, missingFields = [], evidencePackage = null) {
    super(message);
    this.name = 'EvidenceBuildError';
    this.code = 'EVIDENCE_BUILD_FAILED';
    this.missingFields = missingFields;
    this.evidencePackage = evidencePackage;
  }
}

/**
 * PHASE 16: Build standardized Evidence Package
 * 
 * @param {Object} params - Evidence building parameters
 * @param {Object} params.expectation - Promise/expectation
 * @param {Object} params.trace - Interaction trace
 * @param {Object} params.evidence - Existing evidence (optional, will be merged)
 * @param {Object} params.confidence - Confidence result (optional)
 * @returns {Object} Evidence Package
 */
export function buildEvidencePackage({ expectation, trace, evidence = {}, confidence = null }) {
  const evidencePackage = {
    trigger: buildTrigger(expectation, trace),
    before: buildBeforeState(trace),
    action: buildActionTrace(trace),
    after: buildAfterState(trace),
    signals: buildSignals(trace),
    justification: buildJustification(expectation, trace, confidence),
    missingEvidence: [],
    isComplete: false,
  };
  
  // Check completeness
  const missing = checkMissingEvidence(evidencePackage);
  evidencePackage.missingEvidence = missing;
  evidencePackage.isComplete = missing.length === 0;
  
  // Merge with existing evidence if provided
  if (evidence && Object.keys(evidence).length > 0) {
    evidencePackage.trigger = { ...evidencePackage.trigger, ...(evidence.trigger || {}) };
    evidencePackage.before = { ...evidencePackage.before, ...(evidence.before || {}) };
    evidencePackage.after = { ...evidencePackage.after, ...(evidence.after || {}) };
    evidencePackage.signals = { ...evidencePackage.signals, ...(evidence.signals || {}) };
  }
  
  return evidencePackage;
}

/**
 * Build trigger section (AST/DOM source + context)
 */
function buildTrigger(expectation, trace) {
  const trigger = {
    source: null,
    context: null,
    astSource: null,
    domSelector: null,
  };
  
  if (expectation) {
    trigger.source = {
      file: expectation.source?.file || null,
      line: expectation.source?.line || null,
      column: expectation.source?.column || null,
    };
    trigger.context = expectation.source?.context || null;
    trigger.astSource = expectation.source?.astSource || 
                        expectation.metadata?.astSource || null;
  }
  
  if (trace.interaction) {
    trigger.domSelector = trace.interaction.selector || null;
  }
  
  return trigger;
}

/**
 * Build before state (screenshot, URL, DOM signature)
 */
function buildBeforeState(trace) {
  const before = {
    screenshot: null,
    url: null,
    domSignature: null,
  };
  
  if (trace.before) {
    before.screenshot = trace.before.screenshot || null;
    before.url = trace.before.url || null;
  }
  
  // Also check sensors for before state
  if (trace.sensors?.navigation?.beforeUrl) {
    before.url = trace.sensors.navigation.beforeUrl;
  }
  
  // DOM signature (hash)
  if (trace.dom?.beforeHash) {
    before.domSignature = trace.dom.beforeHash;
  }
  
  return before;
}

/**
 * Build action trace (interaction + timing)
 */
function buildActionTrace(trace) {
  const action = {
    interaction: null,
    timing: null,
  };
  
  if (trace.interaction) {
    action.interaction = {
      type: trace.interaction.type || null,
      selector: trace.interaction.selector || null,
      label: trace.interaction.label || null,
      href: trace.interaction.href || null,
    };
  }
  
  // Timing information
  if (trace.timing) {
    action.timing = trace.timing;
  } else if (trace.sensors?.timing) {
    action.timing = trace.sensors.timing;
  }
  
  return action;
}

/**
 * Build after state (screenshot, URL, DOM signature)
 */
function buildAfterState(trace) {
  const after = {
    screenshot: null,
    url: null,
    domSignature: null,
  };
  
  if (trace.after) {
    after.screenshot = trace.after.screenshot || null;
    after.url = trace.after.url || null;
  }
  
  // Also check sensors for after state
  if (trace.sensors?.navigation?.afterUrl) {
    after.url = trace.sensors.navigation.afterUrl;
  }
  
  // DOM signature (hash)
  if (trace.dom?.afterHash) {
    after.domSignature = trace.dom.afterHash;
  }
  
  return after;
}

/**
 * Build signals section (network, console, ui feedback, route)
 */
function buildSignals(trace) {
  const signals = {
    network: null,
    console: null,
    uiSignals: null,
    uiFeedback: null,
    navigation: null,
    route: null,
  };
  
  const sensors = trace.sensors || {};
  
  if (sensors.network) {
    signals.network = {
      totalRequests: sensors.network.totalRequests || 0,
      failedRequests: sensors.network.failedRequests || 0,
      successfulRequests: sensors.network.successfulRequests || 0,
      topFailedUrls: sensors.network.topFailedUrls || [],
      hasNetworkActivity: sensors.network.hasNetworkActivity || false,
    };
  }
  
  if (sensors.console) {
    signals.console = {
      errorCount: sensors.console.errorCount || 0,
      errors: sensors.console.errors || 0,
      warnings: sensors.console.warnings || 0,
      hasErrors: sensors.console.hasErrors || false,
    };
  }
  
  if (sensors.uiSignals) {
    signals.uiSignals = {
      changed: sensors.uiSignals.diff?.changed || false,
      hasLoadingIndicator: sensors.uiSignals.after?.hasLoadingIndicator || false,
      hasDialog: sensors.uiSignals.after?.hasDialog || false,
      hasErrorSignal: sensors.uiSignals.after?.hasErrorSignal || false,
    };
  }
  
  if (sensors.uiFeedback) {
    signals.uiFeedback = {
      overallUiFeedbackScore: sensors.uiFeedback.overallUiFeedbackScore || 0,
      signals: sensors.uiFeedback.signals || {},
    };
  }
  
  if (sensors.navigation) {
    signals.navigation = {
      urlChanged: sensors.navigation.urlChanged || false,
      routerStateChanged: sensors.navigation.routerStateChanged || false,
      beforeUrl: sensors.navigation.beforeUrl || null,
      afterUrl: sensors.navigation.afterUrl || null,
    };
  }
  
  return signals;
}

/**
 * Build justification (confidence reasons and verdict rationale)
 */
function buildJustification(expectation, trace, confidence) {
  const justification = {
    confidenceReasons: null,
    verdictRationale: null,
    confidenceScore: null,
    confidenceLevel: null,
  };
  
  if (confidence) {
    justification.confidenceReasons = confidence.topReasons || confidence.reasons || [];
    justification.confidenceScore = confidence.score01 || confidence.score || null; // Contract v1: score01 canonical
    justification.confidenceLevel = confidence.level || null;
  }
  
  // Verdict rationale from finding reason
  if (trace.reason) {
    justification.verdictRationale = trace.reason;
  }
  
  return justification;
}

/**
 * Check for missing evidence fields
 */
function checkMissingEvidence(evidencePackage) {
  const missing = [];
  
  // Check required fields for CONFIRMED findings
  if (!evidencePackage.trigger.source || !evidencePackage.trigger.source.file) {
    missing.push('trigger.source');
  }
  
  if (!evidencePackage.before.screenshot) {
    missing.push('before.screenshot');
  }
  
  if (!evidencePackage.after.screenshot) {
    missing.push('after.screenshot');
  }
  
  if (!evidencePackage.before.url) {
    missing.push('before.url');
  }
  
  if (!evidencePackage.after.url) {
    missing.push('after.url');
  }
  
  if (!evidencePackage.action.interaction || !evidencePackage.action.interaction.type) {
    missing.push('action.interaction');
  }
  
  if (!evidencePackage.signals.network) {
    missing.push('signals.network');
  }
  
  if (!evidencePackage.signals.uiSignals) {
    missing.push('signals.uiSignals');
  }
  
  return missing;
}

/**
 * PHASE 16: Validate evidence package completeness for CONFIRMED findings
 * 
 * @param {Object} evidencePackage - Evidence package to validate
 * @param {string} severity - Finding severity (CONFIRMED or SUSPECTED)
 * @returns {Object} { isComplete, missingFields, shouldDowngrade }
 */
export function validateEvidencePackage(evidencePackage, severity) {
  const missing = checkMissingEvidence(evidencePackage);
  const isComplete = missing.length === 0;
  
  // CONFIRMED findings MUST have complete evidence
  const shouldDowngrade = severity === 'CONFIRMED' && !isComplete;
  
  return {
    isComplete,
    missingFields: missing,
    shouldDowngrade,
    downgradeReason: shouldDowngrade 
      ? `Evidence Law Violation: Missing required evidence fields: ${missing.join(', ')}`
      : null,
  };
}

/**
 * PHASE 21.1: Strict validation for CONFIRMED findings
 * 
 * HARD LOCK: If finding is CONFIRMED and evidencePackage is incomplete,
 * this function throws EvidenceBuildError (fail closed, not open).
 * 
 * @param {Object} evidencePackage - Evidence package to validate
 * @param {string} severity - Finding severity (must be CONFIRMED for strict validation)
 * @throws {EvidenceBuildError} If CONFIRMED finding has incomplete evidencePackage
 */
export function validateEvidencePackageStrict(evidencePackage, severity) {
  if (!evidencePackage || typeof evidencePackage !== 'object') {
    throw new EvidenceBuildError(
      'Evidence Law Violation: evidencePackage is missing or invalid',
      REQUIRED_FIELDS_CONFIRMED,
      null
    );
  }
  
  if (severity === 'CONFIRMED' || severity === 'CONFIRMED') {
    const missing = checkMissingEvidence(evidencePackage);
    const isComplete = missing.length === 0;
    
    if (!isComplete) {
      throw new EvidenceBuildError(
        `Evidence Law Violation: CONFIRMED finding requires complete evidencePackage. Missing fields: ${missing.join(', ')}`,
        missing,
        evidencePackage
      );
    }
    
    // Additional strict check: evidencePackage.isComplete must be true
    if (evidencePackage.isComplete !== true) {
      throw new EvidenceBuildError(
        `Evidence Law Violation: CONFIRMED finding has evidencePackage.isComplete !== true`,
        missing.length > 0 ? missing : REQUIRED_FIELDS_CONFIRMED,
        evidencePackage
      );
    }
  }
  
  return {
    isComplete: evidencePackage.isComplete === true,
    missingFields: checkMissingEvidence(evidencePackage),
    valid: true
  };
}

/**
 * PHASE 16: Build evidence package and enforce completeness
 * PHASE 21.1: Hard lock - throws EvidenceBuildError on failure (no silent failures)
 * PHASE 22: Evidence System Hardening - records evidence intent and capture failures
 * 
 * @param {Object} finding - Finding object
 * @param {Object} params - Evidence building parameters
 * @param {Array<Object>} captureFailures - Array of EvidenceCaptureFailure objects (optional)
 * @returns {Object} Finding with evidencePackage and potentially downgraded severity
 * @throws {EvidenceBuildError} If evidence building fails or CONFIRMED finding has incomplete evidence
 */
export function buildAndEnforceEvidencePackage(finding, params, captureFailures = []) {
  // PHASE 21.1: Build evidence package - throws if it fails
  let evidencePackage;
  try {
    evidencePackage = buildEvidencePackage(params);
  } catch (error) {
    // Re-throw as EvidenceBuildError if not already
    if (error instanceof EvidenceBuildError) {
      throw error;
    }
    throw new EvidenceBuildError(
      `Evidence building failed: ${error.message}`,
      REQUIRED_FIELDS_CONFIRMED,
      null
    );
  }
  
  // PHASE 22: Record capture failures in evidence package metadata
  if (captureFailures && captureFailures.length > 0) {
    evidencePackage.captureFailures = captureFailures.map(f => f.toJSON ? f.toJSON() : f);
  }
  
  // PHASE 21.1: Strict validation for CONFIRMED findings
  const severity = finding.severity || finding.status || 'SUSPECTED';
  if (severity === 'CONFIRMED') {
    // Hard lock: CONFIRMED findings MUST have complete evidencePackage
    validateEvidencePackageStrict(evidencePackage, severity);
    // If we get here, evidencePackage is complete
  }
  
  // For SUSPECTED findings, allow partial evidence
  const validation = validateEvidencePackage(evidencePackage, severity);
  
  // PHASE 22: Downgrade CONFIRMED if evidence incomplete (with evidence intent tracking)
  let finalSeverity = severity;
  let downgradeReason = null;
  
  if (validation.shouldDowngrade) {
    finalSeverity = 'SUSPECTED';
    downgradeReason = validation.downgradeReason;
    
    // PHASE 22: Record evidence intent in downgrade reason
    if (captureFailures && captureFailures.length > 0) {
      const failureCodes = captureFailures.map(f => f.reasonCode || 'UNKNOWN').join(', ');
      downgradeReason += ` [Evidence Intent: Capture failures: ${failureCodes}]`;
    }
    
    // PHASE 22: Record missing fields in downgrade reason
    if (validation.missingFields && validation.missingFields.length > 0) {
      downgradeReason += ` [Missing fields: ${validation.missingFields.join(', ')}]`;
    }
  }
  
  // Attach evidence package to finding
  return {
    ...finding,
    severity: finalSeverity,
    evidencePackage,
    evidenceCompleteness: {
      isComplete: validation.isComplete,
      missingFields: validation.missingFields,
      downgraded: validation.shouldDowngrade,
      downgradeReason,
      captureFailures: captureFailures.length > 0 ? captureFailures.map(f => f.toJSON ? f.toJSON() : f) : []
    },
  };
}

