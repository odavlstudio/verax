/**
 * FINDING CONTRACT — Constitutional Definition
 *
 * This module defines the canonical Finding schema.
 * Every finding in VERAX must conform to this contract.
 * Non-conforming findings are dropped before reaching findings.json.
 *
 * PHASE 1: Constitution Lock
 * The contract enforces:
 * - Evidence Law (CONFIRMED requires evidence, no evidence → SUSPECTED or DROP)
 * - No Guessing (inferences without signals are dropped)
 * - Required Fields (missing fields cause drop)
 * - Confidence Bounds (must be 0–1)
 * - Status Semantics (CONFIRMED, SUSPECTED, INFORMATIONAL only)
 */

/**
 * Canonical Finding Shape
 * @typedef {Object} Finding
 * @property {string} id - Unique finding identifier
 * @property {string} type - Finding type (silent_failure, missing_state_action, etc.)
 * @property {'CONFIRMED' | 'SUSPECTED' | 'INFORMATIONAL'} status - Certainty level
 * @property {'HIGH' | 'MEDIUM' | 'LOW'} severity - User impact level
 * @property {number} confidence - 0 to 1 confidence score
 * @property {Object} promise - What was expected
 * @property {string} promise.kind - Promise category (navigation, state_change, etc.)
 * @property {string} promise.value - The specific promise (URL, selector, etc.)
 * @property {Object} observed - What actually happened
 * @property {string} observed.result - The actual outcome
 * @property {Object} evidence - References to captured artifacts/signals
 * @property {string} impact - Why this matters to the user
 * @property {Object} [interaction] - User action context (optional)
 * @property {Object} [enrichment] - Additional data (humanSummary, actionHint, etc.)
 */

import { computeFindingIdentity } from '../core/determinism/finding-identity.js';

// REQUIRED FIELDS - all findings must have these
export const REQUIRED_FINDING_FIELDS = [
  'id',
  'type',
  'status',
  'severity',
  'confidence',
  'promise',
  'observed',
  'evidence',
  'impact'
];

// ALLOWED STATUS VALUES
export const ALLOWED_STATUSES = ['CONFIRMED', 'SUSPECTED', 'INFORMATIONAL'];

// ALLOWED SEVERITY VALUES
export const ALLOWED_SEVERITIES = ['HIGH', 'MEDIUM', 'LOW'];

// ALLOWED FINDING TYPES
export const ALLOWED_FINDING_TYPES = [
  'silent_failure',
  'navigation_silent_failure',
  'flow_silent_failure',
  'observed_break',
  'validation_silent_failure',
  'missing_state_action',
  'dead_interaction_silent_failure',
  'broken_navigation_promise',
  'silent_submission',
  'invisible_state_failure',
  'stuck_or_phantom_loading',
  'silent_permission_wall',
  'render_failure'
];

const ALLOWED_IMPACTS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'UNKNOWN'];

/**
 * Define Finding from existing structures
 * This adapter creates a Finding that conforms to the contract
 * from the current finding formats in the codebase.
 *
 * @param {Object} rawFinding - Finding created by finding-detector
 * @returns {Finding} - Canonical Finding shape
 */
export function canonicalizeFinding(rawFinding) {
  if (!rawFinding || typeof rawFinding !== 'object') {
    return null;
  }

  // Normalize status from outcome or existing status
  let status = rawFinding.status || 'SUSPECTED';
  if (rawFinding.outcome === 'SILENT_FAILURE' || rawFinding.outcome === 'silent_failure') {
    status = 'SUSPECTED'; // outcomes are silences; status is certainty
  }
  if (rawFinding.status === 'CONFIRMED') {
    status = 'CONFIRMED';
  }

  // Extract severity
  let severity = rawFinding.severity || 'MEDIUM';
  if (rawFinding.outcome) {
    const outcomeMap = {
      'SILENT_FAILURE': 'HIGH',
      'silent_failure': 'HIGH',
      'FLOW_FAILURE': 'HIGH',
      'DETERMINISM_BREAK': 'MEDIUM',
      'VALIDATION_FAILURE': 'MEDIUM'
    };
    severity = outcomeMap[rawFinding.outcome] || 'MEDIUM';
  }

  // Extract confidence and normalize into [0,1]
  let confidence = 0.5;
  if (typeof rawFinding.confidence === 'number') {
    confidence = rawFinding.confidence;
  } else if (rawFinding.confidence?.score !== undefined) {
    const score = rawFinding.confidence.score;
    confidence = typeof score === 'number' ? score : confidence;
  } else if (rawFinding.confidence?.level) {
    const levelMap = { high: 0.8, medium: 0.6, low: 0.4, unknown: 0.2 };
    confidence = levelMap[String(rawFinding.confidence.level).toLowerCase()] || 0.5;
  }

  // Scores can arrive as 0–100; convert to 0–1 for contract compliance
  if (confidence > 1) {
    confidence = confidence / 100;
  }

  // Clamp to safe bounds to avoid drift
  if (confidence < 0) confidence = 0;
  if (confidence > 1) confidence = 1;

  // Extract promise
  const promise = rawFinding.promise || {
    kind: 'unknown',
    value: rawFinding.what_was_expected || 'User-visible change',
    type: rawFinding.type || 'unknown'
  };

  // Extract observed only when supplied; missing observed should surface as a contract failure
  let observed = rawFinding.observed;
  if (!observed && rawFinding.what_was_observed !== undefined) {
    observed = { result: rawFinding.what_was_observed };
  }

  // Extract evidence (CRITICAL for constitution)
  const evidence = rawFinding.evidence || {};

  // Normalize type to allowed set
  const normalizedType = (() => {
    if (!rawFinding.type) return undefined;
    if (ALLOWED_FINDING_TYPES.includes(rawFinding.type)) return rawFinding.type;
    return 'silent_failure';
  })();

  let normalizedImpact = rawFinding.impact || rawFinding.signals?.impact || 'UNKNOWN';
  if (!ALLOWED_IMPACTS.includes(normalizedImpact)) {
    normalizedImpact = 'UNKNOWN';
  }

  // Create enrichment with only defined fields for determinism
  const enrichment = {};
  if (rawFinding.humanSummary !== undefined) enrichment.humanSummary = rawFinding.humanSummary;
  if (rawFinding.actionHint !== undefined) enrichment.actionHint = rawFinding.actionHint;
  if (rawFinding.confidenceExplanation !== undefined) enrichment.confidenceExplanation = rawFinding.confidenceExplanation;
  if (rawFinding.outcome !== undefined) enrichment.outcome = rawFinding.outcome;
  if (rawFinding.enrichment?.ambiguityReasons?.length) enrichment.ambiguityReasons = rawFinding.enrichment.ambiguityReasons;
  if (rawFinding.enrichment?.evidenceCategories?.length) enrichment.evidenceCategories = rawFinding.enrichment.evidenceCategories;
  if (rawFinding.enrichment?.integrityDowngradeReason !== undefined) enrichment.integrityDowngradeReason = rawFinding.enrichment.integrityDowngradeReason;
  // PHASE X: Include state context, selector, and source linkage (only if defined)
  if (rawFinding.enrichment?.stateContext !== undefined) enrichment.stateContext = rawFinding.enrichment.stateContext;
  if (rawFinding.enrichment?.selector !== undefined) enrichment.selector = rawFinding.enrichment.selector;
  if (rawFinding.enrichment?.promise_source !== undefined) enrichment.promise_source = rawFinding.enrichment.promise_source;
  if (rawFinding.enrichment?.file !== undefined) enrichment.file = rawFinding.enrichment.file;
  if (rawFinding.enrichment?.line !== undefined) enrichment.line = rawFinding.enrichment.line;
  // SCOPE AWARENESS v1.0: Include scope classification and explanation
  if (rawFinding.scopeClassification !== undefined) enrichment.scopeClassification = rawFinding.scopeClassification;
  if (rawFinding.outOfScopeExplanation !== undefined) enrichment.outOfScopeExplanation = rawFinding.outOfScopeExplanation;
  if (rawFinding.enrichment?.scopeClassification !== undefined) enrichment.scopeClassification = rawFinding.enrichment.scopeClassification;
  if (rawFinding.enrichment?.outOfScopeExplanation !== undefined) enrichment.outOfScopeExplanation = rawFinding.enrichment.outOfScopeExplanation;

  // Create canonical finding
  const canonical = {
    type: normalizedType,
    status,
    severity,
    confidence,
    promise,
    observed,
    evidence,
    impact: normalizedImpact,
    interaction: rawFinding.interaction,
    enrichment
  };

  // Stable identity avoids nondeterministic timestamps/randomness
  const stableId = computeFindingIdentity({ ...rawFinding, ...canonical });
  canonical.id = rawFinding.id || stableId;

  return /** @type {import('./finding-contract.js').Finding} */ (canonical);
}

/**
 * Create a Finding from minimal data
 * Used in tests and internal creation.
 *
 * @param {Object} data - Partial finding data
 * @returns {Finding}
 */
export function createFinding(data = {}) {
  return canonicalizeFinding({
    type: data.type || 'silent_failure',
    status: data.status || 'SUSPECTED',
    confidence: data.confidence !== undefined ? data.confidence : 0.5,
    what_was_expected: data.promise?.value || data.expectedValue || 'Change',
    what_was_observed: data.observed?.result || data.actualResult || 'No change',
    why_it_matters: data.impact || 'User action had no effect',
    evidence: data.evidence || {},
    interaction: data.interaction,
    ...data
  });
}
