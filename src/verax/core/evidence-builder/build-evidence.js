/**
 * Internal: Evidence building utilities and builder
 */

/**
 * Build standardized Evidence Package
 * 
 * @param {Object} params - Evidence building parameters
 * @param {Object} params.expectation - Promise/expectation
 * @param {Object} params.trace - Interaction trace
 * @param {Object} params.evidence - Existing evidence (optional)
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
export function checkMissingEvidence(evidencePackage) {
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
