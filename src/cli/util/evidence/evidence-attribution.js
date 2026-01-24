/**
 * Evidence Attribution Module
 * 
 * PURPOSE:
 * Attach which evidence signals contributed to which finding,
 * improving traceability without changing semantics.
 * 
 * CONSTRAINTS:
 * - Does NOT modify detection logic
 * - Does NOT change finding status or confidence
 * - Write-time only, fully additive
 * - Deterministic attribution
 * 
 * OPERATIONS:
 * 1. Map evidence signals to finding generation
 * 2. Trace which sensors contributed
 * 3. Identify confidence-supporting evidence
 * 4. Mark evidence attribution chains
 */

/**
 * Classify evidence by origin/sensor type
 * 
 * @param {Object} finding - Finding with evidence
 * @returns {Object} Evidence sources by sensor
 */
export function classifyEvidenceSources(finding = {}) {
  const evidence = finding.evidence || {};
  const signals = finding.signals || {};

  const sources = {
    navigation: [],
    dom: [],
    network: [],
    console: [],
    ui: [],
    timing: [],
    framework: [], // Phase 3.2 additions
  };

  // Navigation signals
  if (evidence.beforeUrl || evidence.afterUrl) {
    sources.navigation.push('url_comparison');
  }
  if (signals.navigationChanged) {
    sources.navigation.push('navigation_signal');
  }
  if (signals.clientSideRoutingDetected) {
    sources.navigation.push('client_side_routing');
  }

  // DOM signals
  if (evidence.beforeScreenshot || evidence.afterScreenshot) {
    sources.dom.push('screenshot_comparison');
  }
  if (evidence.domDiff?.changed) {
    sources.dom.push('dom_diff');
  }
  if (signals.domChanged) {
    sources.dom.push('dom_change_signal');
  }
  if (signals.meaningfulDomChange) {
    sources.dom.push('meaningful_dom_change');
  }

  // Network signals
  if (Array.isArray(evidence.networkRequests) && evidence.networkRequests.length > 0) {
    sources.network.push('network_events');
  }
  if (signals.networkActivity) {
    sources.network.push('network_activity_signal');
  }
  if (signals.correlatedNetworkActivity) {
    sources.network.push('correlated_network_activity');
  }

  // Console signals
  if (Array.isArray(evidence.consoleErrors) && evidence.consoleErrors.length > 0) {
    sources.console.push('console_errors');
  }
  if (signals.consoleErrors) {
    sources.console.push('console_error_signal');
  }

  // UI feedback signals
  if (signals.feedbackSeen) {
    sources.ui.push('feedback_element');
  }
  if (signals.ariaLiveUpdated) {
    sources.ui.push('aria_live_region');
  }
  if (signals.ariaRoleAlertsDetected) {
    sources.ui.push('aria_alert_role');
  }
  if (signals.ephemeralDOMDetected) {
    sources.ui.push('ephemeral_dom');
  }

  // Loading/timing signals
  if (signals.loadingStarted || signals.loadingResolved || signals.loadingStalled) {
    sources.timing.push('loading_indicators');
  }

  // Framework-specific signals
  if (signals.nextJsLayoutTransition || signals.nextJsPageSwap) {
    sources.framework.push('nextjs_observable');
  }
  if (signals.reactEffectNavigation || signals.reactStateReRender) {
    sources.framework.push('react_observable');
  }
  if (signals.vueRouterTransition || signals.vueDOMReplacement) {
    sources.framework.push('vue_observable');
  }

  return sources;
}

/**
 * Identify which evidence signals directly support the finding's confidence level
 * 
 * @param {Object} finding - Finding with evidence and confidence
 * @returns {Object} Supporting evidence for confidence
 */
export function identifyConfidenceSupportingEvidence(finding = {}) {
  const evidence = finding.evidence || {};
  const signals = finding.signals || {};
  const confidence = finding.confidence || {};
  const confidenceLevel = confidence.level || 'UNKNOWN';

  const supporting = {
    level: confidenceLevel,
    requiresMultipleSignals: confidenceLevel === 'HIGH',
    evidenceChain: [],
    signalCount: 0,
    isSufficient: false,
  };

  // Count unique signal types
  const activeSignals = [
    signals.navigationChanged,
    signals.domChanged,
    signals.feedbackSeen,
    signals.networkActivity,
    signals.consoleErrors,
    signals.clientSideRoutingDetected,
    signals.ariaLiveUpdated,
    signals.ariaRoleAlertsDetected,
    signals.ephemeralDOMDetected,
    signals.loadingStarted || signals.loadingResolved || signals.loadingStalled,
    signals.nextJsLayoutTransition || signals.nextJsPageSwap,
    signals.reactEffectNavigation || signals.reactStateReRender,
    signals.vueRouterTransition || signals.vueDOMReplacement,
  ].filter(s => s === true).length;

  supporting.signalCount = activeSignals;

  // Build evidence chain for HIGH confidence
  if (confidenceLevel === 'HIGH') {
    // HIGH requires multiple signals
    if (signals.navigationChanged) supporting.evidenceChain.push('navigation');
    if (signals.domChanged) supporting.evidenceChain.push('dom_change');
    if (signals.feedbackSeen) supporting.evidenceChain.push('feedback');
    if (signals.networkActivity) supporting.evidenceChain.push('network');
    if (signals.consoleErrors) supporting.evidenceChain.push('console');

    // Framework signals add credibility
    if (signals.nextJsLayoutTransition || signals.nextJsPageSwap) {
      supporting.evidenceChain.push('framework_nextjs');
    }
    if (signals.reactEffectNavigation || signals.reactStateReRender) {
      supporting.evidenceChain.push('framework_react');
    }
    if (signals.vueRouterTransition || signals.vueDOMReplacement) {
      supporting.evidenceChain.push('framework_vue');
    }

    supporting.isSufficient = supporting.evidenceChain.length >= 2;
  } else if (confidenceLevel === 'MEDIUM') {
    // MEDIUM requires at least one signal
    if (activeSignals >= 1) {
      if (signals.navigationChanged) supporting.evidenceChain.push('navigation');
      if (signals.domChanged) supporting.evidenceChain.push('dom_change');
      if (signals.feedbackSeen) supporting.evidenceChain.push('feedback');
      if (signals.networkActivity) supporting.evidenceChain.push('network');
      supporting.isSufficient = true;
    }
  } else if (confidenceLevel === 'LOW') {
    // LOW is tentative
    supporting.isSufficient = activeSignals >= 1 || (evidence.beforeUrl && evidence.afterUrl);
  }

  return supporting;
}

/**
 * Trace evidence attribution: which sensors provided which signals
 * 
 * @param {Object} finding - Finding with complete evidence
 * @returns {Object} Attribution map
 */
export function traceEvidenceAttribution(finding = {}) {
  const evidence = finding.evidence || {};
  const signals = finding.signals || {};

  const attribution = {
    evidenceCount: 0,
    signalCount: 0,
    attributionMap: {},
  };

  // Count evidence pieces
  if (evidence.beforeUrl) attribution.evidenceCount++;
  if (evidence.afterUrl) attribution.evidenceCount++;
  if (evidence.beforeScreenshot) attribution.evidenceCount++;
  if (evidence.afterScreenshot) attribution.evidenceCount++;
  if (evidence.networkRequests?.length > 0) attribution.evidenceCount++;
  if (evidence.consoleErrors?.length > 0) attribution.evidenceCount++;
  if (evidence.domDiff?.changed) attribution.evidenceCount++;

  // Count signals
  for (const [key, value] of Object.entries(signals)) {
    if (value === true) {
      attribution.signalCount++;
      if (!attribution.attributionMap[key]) {
        attribution.attributionMap[key] = [];
      }
    }
  }

  // Build attribution map: signal -> evidence source
  if (signals.navigationChanged) {
    attribution.attributionMap.navigationChanged = [
      ...(evidence.beforeUrl ? ['beforeUrl'] : []),
      ...(evidence.afterUrl ? ['afterUrl'] : []),
      ...(evidence.beforeScreenshot ? ['beforeScreenshot'] : []),
    ];
  }

  if (signals.domChanged) {
    attribution.attributionMap.domChanged = [
      ...(evidence.domDiff?.changed ? ['domDiff'] : []),
      ...(evidence.beforeScreenshot ? ['beforeScreenshot'] : []),
      ...(evidence.afterScreenshot ? ['afterScreenshot'] : []),
    ];
  }

  if (signals.networkActivity) {
    attribution.attributionMap.networkActivity = [
      'networkRequests',
      ...(evidence.networkRequests?.some(r => r.status >= 400) ? ['failedRequests'] : []),
    ];
  }

  if (signals.consoleErrors) {
    attribution.attributionMap.consoleErrors = ['consoleErrors'];
  }

  if (signals.feedbackSeen) {
    attribution.attributionMap.feedbackSeen = ['feedbackElements'];
  }

  // Framework attributions
  if (signals.nextJsLayoutTransition || signals.nextJsPageSwap) {
    attribution.attributionMap.nextJsObservable = ['nextjs_data_attributes'];
  }

  if (signals.reactEffectNavigation || signals.reactStateReRender) {
    attribution.attributionMap.reactObservable = ['react_data_attributes'];
  }

  if (signals.vueRouterTransition || signals.vueDOMReplacement) {
    attribution.attributionMap.vueObservable = ['vue_data_attributes'];
  }

  return attribution;
}

/**
 * Generate evidence attribution report for finding
 * 
 * @param {Object} finding - Finding with complete evidence
 * @returns {Object} Attribution report
 */
export function generateAttributionReport(finding = {}) {
  const sources = classifyEvidenceSources(finding);
  const confidence = identifyConfidenceSupportingEvidence(finding);
  const attribution = traceEvidenceAttribution(finding);

  // Count total sources
  const totalSources = Object.values(sources)
    .reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);

  return {
    findingId: finding.findingId || finding.id || 'unknown',
    evidenceSources: sources,
    confidenceSupport: confidence,
    attribution,
    summary: {
      totalEvidencePieces: attribution.evidenceCount,
      totalSignals: attribution.signalCount,
      totalSources: totalSources,
      attributionComplete: attribution.evidenceCount > 0 && attribution.signalCount > 0,
    },
  };
}

/**
 * Validate evidence attribution completeness
 * 
 * A finding's evidence is properly attributed if:
 * - Has evidence pieces (before, after, diffs, etc.)
 * - Has active signals
 * - Signals map back to evidence sources
 * 
 * @param {Object} finding - Finding to validate
 * @returns {Object} Validation result
 */
export function validateEvidenceAttribution(finding = {}) {
  const attribution = traceEvidenceAttribution(finding);
  const hasEvidence = attribution.evidenceCount > 0;
  const hasSignals = attribution.signalCount > 0;
  const attributionComplete = Object.keys(attribution.attributionMap).length > 0;

  return {
    valid: hasEvidence && hasSignals && attributionComplete,
    hasEvidence,
    hasSignals,
    attributionComplete,
    issues: [
      ...(!hasEvidence ? ['No evidence pieces found'] : []),
      ...(!hasSignals ? ['No signals activated'] : []),
      ...(!attributionComplete ? ['No evidence attribution mapping'] : []),
    ],
  };
}

/**
 * Apply evidence attribution to all findings
 * 
 * @param {Array} findings - Array of findings
 * @returns {Array} Findings with attribution data attached
 */
export function attachEvidenceAttributionToFindings(findings = []) {
  return findings.map(finding => ({
    ...finding,
    evidenceAttribution: generateAttributionReport(finding),
  }));
}








