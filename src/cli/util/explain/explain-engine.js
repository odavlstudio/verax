/**
 * VERAX Explain Engine (PHASE 5.2)
 * 
 * Post-hoc analysis engine that explains WHY a finding was generated.
 * Evidence-based only: derives explanation from existing run artifacts.
 * 
 * Non-negotiables:
 * - Evidence-only (no speculation)
 * - Derived solely from .verax/runs/<runId> artifacts
 * - No browser re-execution
 * - No new runtime logging
 * - Deterministic output (same runId+findingId => same explanation)
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { DataError } from '../support/errors.js';
import { getTimeProvider } from '../support/time-provider.js';

/**
 * Generate explanation for a finding from run artifacts
 * @param {string} projectRoot - Project root directory
 * @param {string} runId - Run identifier
 * @param {string} findingId - Finding identifier
 * @returns {Object} Explanation report
 */
export function generateExplanation(projectRoot, runId, findingId) {
  // Locate run directory
  const runDir = resolve(projectRoot, '.verax', 'runs', runId);
  
  if (!existsSync(runDir)) {
    throw new DataError(`Run directory not found: ${runDir}`);
  }
  
  // Load artifacts
  const summary = loadArtifact(runDir, 'summary.json');
  const findings = loadArtifact(runDir, 'findings.json');
  const traces = loadOptionalArtifact(runDir, 'traces.json');
  const _expectations = loadOptionalArtifact(runDir, 'expectations.json');
  const observe = loadOptionalArtifact(runDir, 'observe.json');
  
  if (!summary) {
    throw new DataError(`Incomplete run: summary.json not found in ${runDir}`);
  }
  
  if (!findings || !Array.isArray(findings)) {
    throw new DataError(`Incomplete run: findings.json not found or invalid in ${runDir}`);
  }
  
  // Find the specific finding by id
  const finding = findings.find(f => f.id === findingId);
  
  if (!finding) {
    throw new DataError(`Finding not found: ${findingId} in run ${runId}`);
  }
  
  // Extract version from summary
  const veraxVersion = summary.meta?.version || 'unknown';
  const timeProvider = getTimeProvider();
  
  // Build explanation report
  const explanation = {
    meta: {
      runId,
      findingId,
      veraxVersion,
      generatedAt: timeProvider.iso(),
      runCompletedAt: summary.meta?.timestamp || null,
    },
    finding: extractFindingIdentity(finding),
    triggers: extractTriggerConditions(finding, traces),
    evidence: extractEvidenceMap(finding, runDir, traces, observe),
    confidence: extractConfidenceBreakdown(finding),
    guidance: extractActionableGuidance(finding, summary, traces),
  };

  // Include policy metadata if present
  if (finding.policy) {
    explanation.policy = finding.policy;
    if (finding.suppressed) {
      explanation.status = 'SUPPRESSED';
      explanation.suppression_reason = finding.policy.rule?.reason || 'No reason provided';
    } else if (finding.downgraded) {
      explanation.status = 'DOWNGRADED';
      explanation.downgrade_reason = finding.policy.rule?.reason || 'No reason provided';
      explanation.original_status = finding.status; // Helps track what it was before
    }
  }
  
  return explanation;
}

/**
 * Load artifact JSON file
 * @param {string} runDir - Run directory
 * @param {string} filename - Artifact filename
 * @returns {Object|null} Parsed JSON or null if not found
 */
function loadArtifact(runDir, filename) {
  const path = resolve(runDir, filename);
  if (!existsSync(path)) {
    return null;
  }
  try {
    const content = String(readFileSync(path, 'utf-8'));
    return JSON.parse(content);
  } catch (error) {
    throw new DataError(`Failed to parse ${filename}: ${error.message}`);
  }
}

/**
 * Load optional artifact (returns null if missing, throws on parse error)
 * @param {string} runDir - Run directory
 * @param {string} filename - Artifact filename
 * @returns {Object|null} Parsed JSON or null
 */
function loadOptionalArtifact(runDir, filename) {
  const path = resolve(runDir, filename);
  if (!existsSync(path)) {
    return null;
  }
  try {
    const content = String(readFileSync(path, 'utf-8'));
    return JSON.parse(content);
  } catch (error) {
    throw new DataError(`Failed to parse ${filename}: ${error.message}`);
  }
}

/**
 * Extract finding identity: id, type, status, confidence, etc.
 * @param {Object} finding - Finding object from findings.json
 * @returns {Object} Finding identity
 */
function extractFindingIdentity(finding) {
  return {
    id: finding.id || 'unknown',
    type: finding.type || 'unknown',
    status: finding.status || 'SUSPECTED',
    severity: finding.severity || 'MEDIUM',
    confidence: typeof finding.confidence === 'number' ? finding.confidence : 0.5,
    expectationId: finding.expectationId || finding.promise?.value || null,
    selector: finding.interaction?.selector || finding.enrichment?.selector || null,
    interactionType: finding.interaction?.type || null,
    interactionLabel: finding.interaction?.label || null,
  };
}

/**
 * Extract trigger conditions: boolean conditions that fired for this finding type
 * Maps finding type to trigger rules and evaluates them from evidence
 * @param {Object} finding - Finding object
 * @param {Array} traces - Traces array from artifacts
 * @returns {Object} Trigger conditions
 */
function extractTriggerConditions(finding, traces = []) {
  const findingType = finding.type || '';
  const evidence = finding.evidence || {};
  const interaction = finding.interaction || {};
  
  // Map finding type to trigger rules (deterministic)
  const triggerMap = getTriggerRulesForFindingType(findingType);
  
  // Evaluate conditions from evidence
  const conditions = [];
  
  // Extract trace data for this interaction if available
  const relatedTrace = traces.find(t => 
    t.interaction?.selector === interaction.selector || 
    t.interaction?.type === interaction.type
  ) || {};
  
  const sensors = relatedTrace.sensors || {};
  const beforeUrl = relatedTrace.before?.url || relatedTrace.beforeUrl || '';
  const afterUrl = relatedTrace.after?.url || relatedTrace.afterUrl || '';
  
  // Evaluate each trigger condition
  for (const triggerName of triggerMap) {
    const evaluated = evaluateTriggerCondition(triggerName, evidence, sensors, interaction, beforeUrl, afterUrl);
    conditions.push({
      name: triggerName,
      value: evaluated,
      source: 'evidence'
    });
  }
  
  return {
    conditions,
    firingType: findingType,
    note: 'Conditions that fired to produce this finding type'
  };
}

/**
 * Get trigger rule names for a finding type (deterministic mapping)
 * @param {string} findingType - Type of finding
 * @returns {Array<string>} List of trigger condition names
 */
function getTriggerRulesForFindingType(findingType) {
  const triggers = {
    'navigation_silent_failure': [
      'navigationAttempted',
      'navigationAcknowledged',
      'urlChanged',
      'feedbackAppeared',
    ],
    'broken_navigation_promise': [
      'navigationAttempted',
      'navigationAcknowledged',
      'urlChanged',
      'routeChanged',
      'feedbackAppeared',
    ],
    'silent_submission': [
      'formAttempted',
      'submissionAcknowledged',
      'networkRequest',
      'domChanged',
      'feedbackAppeared',
    ],
    'dead_interaction_silent_failure': [
      'interactionAttempted',
      'elementFound',
      'clickableAppeared',
      'meaningfulUIChange',
      'networkActivityDetected',
    ],
    'keyboard_silent_failure': [
      'keyboardInteractionAttempted',
      'domChanged',
      'urlChanged',
      'feedbackAppeared',
    ],
    'hover_silent_failure': [
      'hoverInteractionAttempted',
      'domChanged',
      'uiFeedbackAppeared',
    ],
    'invisible_state_failure': [
      'stateChangeAttempted',
      'stateChanged',
      'uiFeedbackReflectsChange',
      'networkCorrelated',
    ],
    'stuck_or_phantom_loading': [
      'loadingStateDetected',
      'loadingTimeout',
      'uiStuckInLoadingState',
    ],
  };
  
  // Return type-specific triggers or generic fallback
  return triggers[findingType] || [
    'attemptDetected',
    'effectObserved',
    'feedbackPresent',
  ];
}

/**
 * Evaluate a single trigger condition from evidence
 * @param {string} triggerName - Trigger condition name
 * @param {Object} evidence - Finding evidence object
 * @param {Object} sensors - Sensor data from trace
 * @param {Object} interaction - Interaction object
 * @param {string} beforeUrl - URL before interaction
 * @param {string} afterUrl - URL after interaction
 * @returns {boolean} Evaluation result
 */
function evaluateTriggerCondition(triggerName, evidence = {}, sensors = {}, interaction = {}, beforeUrl = '', afterUrl = '') {
  // Navigation-related triggers
  if (triggerName === 'navigationAttempted') {
    return interaction.type === 'click' || evidence.attemptedNavigation === true || evidence.targetReached === false;
  }
  if (triggerName === 'navigationAcknowledged') {
    return evidence.urlChanged === true || sensors.navigation?.urlChanged === true;
  }
  if (triggerName === 'urlChanged') {
    return beforeUrl !== afterUrl && afterUrl !== '';
  }
  if (triggerName === 'routeChanged') {
    return evidence.routeChanged === true || sensors.navigation?.historyLengthDelta > 0;
  }
  
  // UI/DOM-related triggers
  if (triggerName === 'domChanged') {
    return evidence.domChanged === true || sensors.dom?.changed === true;
  }
  if (triggerName === 'meaningfulUIChange') {
    return evidence.uiChanged === true || sensors.uiSignals?.diff?.changed === true;
  }
  if (triggerName === 'uiFeedbackAppeared') {
    return evidence.feedbackAppeared === true || sensors.uiFeedback?.overallUiFeedbackScore > 0.5;
  }
  if (triggerName === 'feedbackAppeared') {
    return evidence.feedbackAppeared === true || sensors.uiFeedback?.overallUiFeedbackScore > 0.5;
  }
  
  // Form/submission triggers
  if (triggerName === 'formAttempted') {
    return interaction.type === 'click' || evidence.submitted === true;
  }
  if (triggerName === 'submissionAcknowledged') {
    return evidence.formSubmitted === true || sensors.network?.successfulRequests > 0;
  }
  if (triggerName === 'networkRequest') {
    const network = sensors.network || {};
    return (network.totalRequests || 0) > 0 || evidence.networkRequests > 0;
  }
  
  // Interaction triggers
  if (triggerName === 'interactionAttempted') {
    return interaction && Object.keys(interaction).length > 0;
  }
  if (triggerName === 'elementFound') {
    return evidence.elementFound !== false && interaction.selector;
  }
  if (triggerName === 'clickableAppeared') {
    return evidence.isClickable !== false;
  }
  if (triggerName === 'networkActivityDetected') {
    const network = sensors.network || {};
    return (network.totalRequests || 0) > 0;
  }
  
  // Keyboard/Hover triggers
  if (triggerName === 'keyboardInteractionAttempted') {
    return interaction.type === 'keyboard';
  }
  if (triggerName === 'hoverInteractionAttempted') {
    return interaction.type === 'hover';
  }
  
  // State triggers
  if (triggerName === 'stateChangeAttempted') {
    return evidence.stateChangeAttempted === true || sensors.state?.changed === true;
  }
  if (triggerName === 'stateChanged') {
    return evidence.stateChanged === true || sensors.state?.changed === true;
  }
  if (triggerName === 'uiFeedbackReflectsChange') {
    return sensors.uiFeedback?.overallUiFeedbackScore > 0.5;
  }
  if (triggerName === 'networkCorrelated') {
    return (sensors.network?.totalRequests || 0) > 0;
  }
  
  // Loading triggers
  if (triggerName === 'loadingStateDetected') {
    return evidence.loadingDetected === true || sensors.loading?.isLoading === true;
  }
  if (triggerName === 'loadingTimeout') {
    return evidence.timedOut === true || sensors.loading?.timedOut === true;
  }
  if (triggerName === 'uiStuckInLoadingState') {
    return sensors.loading?.stuck === true;
  }
  
  // Generic/fallback triggers
  if (triggerName === 'attemptDetected') {
    return interaction && Object.keys(interaction).length > 0;
  }
  if (triggerName === 'effectObserved') {
    return evidence.domChanged === true || evidence.urlChanged === true || evidence.feedbackAppeared === true;
  }
  if (triggerName === 'feedbackPresent') {
    return evidence.feedbackAppeared === true || sensors.uiFeedback?.overallUiFeedbackScore > 0.5;
  }
  
  return false;
}

/**
 * Extract evidence map: list all evidence used and missing
 * @param {Object} finding - Finding object
 * @param {string} runDir - Run directory path
 * @returns {Object} Evidence map
 */
function extractEvidenceMap(finding, runDir, _traces = [], _observe = {}) {
  const evidence = finding.evidence || {};
  const used = [];
  const missing = [];
  
  // Evidence paths present in artifact
  if (evidence.before) used.push({ type: 'screenshot', phase: 'before', path: evidence.before });
  if (evidence.after) used.push({ type: 'screenshot', phase: 'after', path: evidence.after });
  
  // Check for screenshot files in evidence directory
  const evidenceDir = resolve(runDir, 'evidence');
  if (existsSync(evidenceDir)) {
    try {
      const files = readdirSync(evidenceDir).sort((a, b) => a.localeCompare(b, 'en'));
      files.forEach(file => {
        if (file.includes('screenshot') || file.includes('.png')) {
          used.push({ type: 'screenshot', path: `evidence/${file}` });
        }
      });
    } catch (err) {
      // Silently ignore if directory cannot be read
    }
  }
  
  // DOM/HTML diff evidence
  if (evidence.domDiff) used.push({ type: 'domDiff', path: evidence.domDiff });
  if (evidence.htmlDiff) used.push({ type: 'htmlDiff', path: evidence.htmlDiff });
  
  // Route data
  if (evidence.beforeUrl) used.push({ type: 'urlBefore', value: evidence.beforeUrl });
  if (evidence.afterUrl) used.push({ type: 'urlAfter', value: evidence.afterUrl });
  if (evidence.expectedTarget) used.push({ type: 'expectedTarget', value: evidence.expectedTarget });
  
  // Outcome watcher data
  if (evidence.outcomeWatcher) {
    used.push({ type: 'outcomeWatcher', data: evidence.outcomeWatcher });
  }
  
  // Mutation data
  if (evidence.mutations || evidence.mutationSummary) {
    used.push({ type: 'mutations', count: Array.isArray(evidence.mutations) ? evidence.mutations.length : 0 });
  }
  
  // Network data
  const network = finding.evidence?.network || {};
  if (Object.keys(network).length > 0) {
    used.push({ type: 'network', summary: { totalRequests: network.totalRequests, failed: network.failedRequests } });
  }
  
  // Console errors
  if (evidence.consoleErrors) {
    used.push({ type: 'consoleErrors', count: Array.isArray(evidence.consoleErrors) ? evidence.consoleErrors.length : 0 });
  }
  
  // Missing evidence (optional but would be helpful)
  const optionalEvidence = ['domDiff', 'htmlDiff', 'consoleErrors', 'networkDetails'];
  optionalEvidence.forEach(field => {
    if (!evidence[field]) {
      missing.push({ type: field, reason: 'Not captured during observation' });
    }
  });
  
  return {
    used: used.filter((e, i, arr) => arr.findIndex(x => x.type === e.type) === i), // Deduplicate
    missing,
    evidenceDir: existsSync(evidenceDir) ? 'evidence/' : null,
  };
}

/**
 * Extract confidence breakdown: how confidence was computed
 * @param {Object} finding - Finding object
 * @returns {Object} Confidence breakdown
 */
function extractConfidenceBreakdown(finding) {
  const confidence = finding.confidence || 0.5;
  const confidenceExplain = finding.enrichment?.confidenceExplanation || 
                            finding.confidenceExplanation || 
                            'Engine does not emit per-step breakdown';
  
  // Minimal reconstruction if breakdown not available
  const breakdown = [];
  if (confidence >= 0.85) {
    breakdown.push({ reason: 'Strong evidence of failure', adjustment: 0, note: 'HIGH confidence' });
  } else if (confidence >= 0.60) {
    breakdown.push({ reason: 'Multiple signals of failure', adjustment: 0, note: 'MEDIUM confidence' });
  } else {
    breakdown.push({ reason: 'Weak or ambiguous evidence', adjustment: 0, note: 'UNPROVEN confidence' });
  }
  
  return {
    final: confidence,
    level: confidence >= 0.85 ? 'HIGH' : confidence >= 0.60 ? 'MEDIUM' : 'UNPROVEN',
    breakdown,
    explanation: confidenceExplain,
    note: 'Derived from evidence-based computation; per-step breakdown available in enrichment.confidenceExplanation'
  };
}

/**
 * Extract actionable developer guidance
 * @param {Object} finding - Finding object
 * @param {Object} summary - Summary artifact
 * @returns {Object} Actionable guidance
 */
function extractActionableGuidance(finding, summary = {}, _traces = []) {
  const type = finding.type || '';
  const interaction = finding.interaction || {};
  const evidence = finding.evidence || {};
  
  const nextChecks = [];
  const reproduce = {};
  
  // Generic guidance per finding type
  if (type.includes('navigation') || type.includes('route')) {
    if (!evidence.urlChanged) {
      nextChecks.push('Check event handler binding for the clicked element; verify click listener is attached');
      nextChecks.push('Inspect browser console for JavaScript errors preventing navigation');
      nextChecks.push('Verify target URL is correct and route is defined in application');
    }
  }
  
  if (type.includes('submission') || type.includes('form')) {
    if (!evidence.formSubmitted) {
      nextChecks.push('Verify form submission handler is bound to the button/form element');
      nextChecks.push('Check for form validation errors preventing submission');
    }
    nextChecks.push('Inspect Network tab for POST/PUT requests; check if request succeeded or failed');
  }
  
  if (type.includes('keyboard')) {
    nextChecks.push('Verify keyboard event listeners (keydown, keyup) are attached to focusable elements');
    nextChecks.push('Check focus management; ensure element can receive keyboard focus');
  }
  
  if (type.includes('hover')) {
    nextChecks.push('Verify :hover CSS styles or onmouseover/onmouseenter handlers are present');
    nextChecks.push('Check z-index and visibility; ensure element is not hidden or covered');
  }
  
  if (type.includes('loading') || type.includes('stuck')) {
    nextChecks.push('Check if loading state logic is correct; verify timeout values');
    nextChecks.push('Inspect Network tab to see if requests are actually completing');
  }
  
  // Generic fallback
  if (nextChecks.length === 0) {
    nextChecks.push(`Verify the action (${interaction.type || 'interaction'}) is connected to expected outcome`);
    nextChecks.push('Check for JavaScript errors in the console');
    nextChecks.push('Verify CSS visibility and DOM structure');
  }
  
  // Build reproduction instructions
  reproduce.runId = summary.meta?.runId || 'unknown';
  reproduce.command = `verax explain ${reproduce.runId} ${finding.id}`;
  reproduce.selector = interaction.selector || 'N/A';
  reproduce.expectation = evidence.expectedTarget || evidence.what_was_expected || 'Unknown';
  reproduce.artifactPaths = {
    findingId: finding.id,
    evidenceDir: '.verax/runs/' + reproduce.runId + '/evidence/',
  };
  
  return {
    nextChecks: nextChecks.slice(0, 5),
    reproduce,
    debugging: {
      tip: 'Use browser DevTools to inspect element and check event listeners',
      artifact: `See evidence/ directory for captured screenshots and DOM diffs`
    }
  };
}
