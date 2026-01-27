/**
 * SILENCE MODEL - Unified tracking for all unobserved/unevaluated/skipped states
 * 
 * CRITICAL PRINCIPLE: Nothing unobserved is allowed to disappear.
 * Every skip, cap, drop, timeout, and gap MUST be tracked and reported.
 * 
 * NEVER return "nothing to report" when data is absent.
 * ALWAYS report why data is absent.
 * 
 * PHASE 2: All silences now include explicit outcome classification.
 * PHASE 4: All silences include explicit lifecycle: type, promise association, trigger, status, impact.
 */

import { mapSilenceReasonToOutcome } from './canonical-outcomes.js';
import { applyFailureMode } from './failures/failure-mode-matrix.js';

/**
 * SilenceEntry - Unified structure for tracking all silence/gaps/unknowns
 * 
 * PHASE 4: Enhanced with lifecycle model
 * 
 * Note: Fields marked as optional are auto-inferred by record() if not provided
 * 
 * @typedef {Object} SilenceEntry
 * @property {string} [outcome] - Canonical outcome: SILENT_FAILURE | COVERAGE_GAP | UNPROVEN_INTERACTION | SAFETY_BLOCK | INFORMATIONAL (auto-inferred if missing)
 * @property {string} scope - What was not evaluated: page | interaction | expectation | sensor | navigation | settle
 * @property {string} reason - Why it wasn't evaluated: timeout | cap | budget_exceeded | incremental_reuse | safety_skip | no_expectation | discovery_failed | sensor_failed
 * @property {string} description - Human-readable description of what wasn't observed
 * @property {Object} context - Additional context: { page, interaction, expectation, etc }
 * @property {string} impact - Why this matters for observation: blocks_nav | affects_expectations | unknown_behavior | incomplete_check
 * @property {number} [count] - Number of items affected by this silence (optional)
 * @property {string} [evidenceUrl] - URL where this silence occurred (optional)
 * 
 * PHASE 4 Lifecycle Fields (all auto-inferred if missing):
 * @property {string} [silence_type] - Technical classification: interaction_not_executed | promise_not_evaluated | sensor_failure | timeout | budget_limit | safety_block | discovery_failure (auto-inferred)
 * @property {Object} [related_promise] - Promise that could not be evaluated (if applicable) or null with reason
 * @property {string} [trigger] - What triggered this silence: user_action_blocked | navigation_timeout | budget_exhausted | safety_policy | selector_not_found | etc (auto-inferred)
 * @property {string} [evaluation_status] - blocked | ambiguous | skipped | timed_out | incomplete (auto-inferred)
 * @property {Object} [confidence_impact] - Which confidence metrics are affected: { coverage: -X%, promise_verification: -Y%, overall: -Z% } (auto-inferred)
 */

/**
 * SilenceCategory - Grouping of related silence entries
 */
export const SILENCE_CATEGORIES = {
  BUDGET: 'budget',           // Scan terminated due to time/interaction limit
  TIMEOUT: 'timeout',         // Navigation/interaction/settle timeout
  SAFETY: 'safety',           // Intentionally skipped (logout, delete, etc)
  INCREMENTAL: 'incremental', // Reused previous run data
  DISCOVERY: 'discovery',     // Failed to discover items
  SENSOR: 'sensor',           // Sensor failed or returned empty
  EXPECTATION: 'expectation', // No expectation exists for interaction
  NAVIGATION: 'navigation',   // Navigation blocked/failed
};

export const SILENCE_REASONS = {
  // Budget-related
  SCAN_TIME_EXCEEDED: 'scan_time_exceeded',
  PAGE_LIMIT_EXCEEDED: 'page_limit_exceeded',
  INTERACTION_LIMIT_EXCEEDED: 'interaction_limit_exceeded',
  ROUTE_LIMIT_EXCEEDED: 'route_limit_exceeded',
  
  // Timeout-related
  NAVIGATION_TIMEOUT: 'navigation_timeout',
  INTERACTION_TIMEOUT: 'interaction_timeout',
  SETTLE_TIMEOUT: 'settle_timeout',
  LOAD_TIMEOUT: 'load_timeout',
  
  // Safety-related
  DESTRUCTIVE_TEXT: 'destructive_text',       // logout, delete, unsubscribe
  EXTERNAL_NAVIGATION: 'external_navigation', // leaves origin
  UNSAFE_PATTERN: 'unsafe_pattern',
  
  // Incremental
  INCREMENTAL_UNCHANGED: 'incremental_unchanged', // Previous run data reused
  
  // Discovery
  DISCOVERY_ERROR: 'discovery_error',
  NO_MATCHING_SELECTOR: 'no_matching_selector',
  
  // Expectation
  NO_EXPECTATION: 'no_expectation', // Interaction found, no expectation to verify
  EXPECTATION_NOT_REACHABLE: 'expectation_not_reachable',
  
  // Navigation
  EXTERNAL_BLOCKED: 'external_blocked',
  ORIGIN_MISMATCH: 'origin_mismatch',
  
  // Sensor
  SENSOR_UNAVAILABLE: 'sensor_unavailable',
  SENSOR_FAILED: 'sensor_failed',
};

/**
 * SILENCE_TYPES - Technical classification of silence events (Phase 4)
 * Maps to specific scenarios where interactions/promises cannot be evaluated
 */
export const SILENCE_TYPES = {
  // Promise not evaluated
  INTERACTION_NOT_EXECUTED: 'interaction_not_executed',    // User action blocked/skipped
  PROMISE_NOT_EVALUATED: 'promise_not_evaluated',          // Promise type cannot be inferred/assessed
  PROMISE_VERIFICATION_BLOCKED: 'promise_verification_blocked', // Promise blocked by safety/policy
  
  // Sensor/observation failures
  SENSOR_FAILURE: 'sensor_failure',              // Sensor unavailable or failed
  SELECTOR_NOT_FOUND: 'selector_not_found',      // Cannot find elements to interact with
  DISCOVERY_FAILURE: 'discovery_failure',        // Failed to discover page/routes/interactions
  
  // Timing/resource constraints
  INTERACTION_TIMEOUT: 'interaction_timeout',    // Interaction timed out
  NAVIGATION_TIMEOUT: 'navigation_timeout',      // Navigation timed out  
  SETTLE_TIMEOUT: 'settle_timeout',              // Settling/stabilization timed out
  
  // Resource/policy constraints
  BUDGET_LIMIT_EXCEEDED: 'budget_limit_exceeded', // Interaction/time budget exhausted
  SAFETY_POLICY_BLOCK: 'safety_policy_block',    // Blocked by safety rules (logout, delete, etc)
  INCREMENTAL_REUSE: 'incremental_reuse',        // Data from previous run reused
};

/**
 * EVALUATION_STATUS - Lifecycle state of a silence (Phase 4)
 * How the unobserved state should be interpreted
 */
export const EVALUATION_STATUS = {
  BLOCKED: 'blocked',           // Intentionally blocked (safety policy, external nav)
  AMBIGUOUS: 'ambiguous',       // Cannot determine what would happen (selector, promise type unclear)
  SKIPPED: 'skipped',           // Deferred by policy (budget, incremental reuse)
  TIMED_OUT: 'timed_out',       // Exceeded time budget
  INCOMPLETE: 'incomplete',     // Partially evaluated (some expectations checked, others not)
};

/**
 * SilenceTracker - Collects all silence entries across observe/detect phases
 */
export class SilenceTracker {
  constructor() {
    this.entries = [];
    this.byCategory = {};
    this.byReason = {};
    Object.keys(SILENCE_CATEGORIES).forEach(cat => {
      this.byCategory[SILENCE_CATEGORIES[cat]] = [];
    });
    Object.keys(SILENCE_REASONS).forEach(reason => {
      this.byReason[SILENCE_REASONS[reason]] = [];
    });
  }

  /**
   * Record a silence/gap/unknown
   * PHASE 4: Validates and infers lifecycle fields (silence_type, trigger, evaluation_status, promise)
   * @param {SilenceEntry} entry
   */
  record(entry) {
    if (!entry.scope || !entry.reason || !entry.description) {
      throw new Error(`Invalid silence entry: missing required fields. Got: ${JSON.stringify(entry)}`);
    }    if (!entry.outcome) {
      entry.outcome = mapSilenceReasonToOutcome(entry.reason);
    }

    // Apply unified failure-mode classification for transparency
    applyFailureMode(entry, entry.reason);    if (!entry.silence_type) {
      entry.silence_type = this._inferSilenceType(entry.reason);
    }
    if (!entry.trigger) {
      entry.trigger = this._inferTrigger(entry.reason);
    }
    if (!entry.evaluation_status) {
      entry.evaluation_status = this._inferEvaluationStatus(entry.reason);
    }
    if (!entry.confidence_impact) {
      entry.confidence_impact = this._inferConfidenceImpact(entry.reason, entry.scope);
    }
    // related_promise remains null with reason unless explicitly set
    if (!entry.related_promise && entry.related_promise !== null) {
      entry.related_promise = null; // Will be populated by verdict-engine if promise can be inferred
    }
    
    this.entries.push(entry);
    
    // Track by category (infer from reason)
    const category = this._getCategoryForReason(entry.reason);
    if (category) {
      this.byCategory[category].push(entry);
    }
    
    // Track by reason
    if (this.byReason[entry.reason]) {
      this.byReason[entry.reason].push(entry);
    }
  }

  /**
   * PHASE 4: Infer silence_type from reason
   */
  _inferSilenceType(reason) {
    if (reason === SILENCE_REASONS.NAVIGATION_TIMEOUT || reason === SILENCE_REASONS.INTERACTION_TIMEOUT || reason === SILENCE_REASONS.SETTLE_TIMEOUT) {
      return SILENCE_TYPES.INTERACTION_TIMEOUT;
    }
    if (reason === SILENCE_REASONS.LOAD_TIMEOUT) {
      return SILENCE_TYPES.NAVIGATION_TIMEOUT;
    }
    if (reason === SILENCE_REASONS.DESTRUCTIVE_TEXT || reason === SILENCE_REASONS.UNSAFE_PATTERN) {
      return SILENCE_TYPES.SAFETY_POLICY_BLOCK;
    }
    if (reason === SILENCE_REASONS.EXTERNAL_NAVIGATION || reason === SILENCE_REASONS.EXTERNAL_BLOCKED) {
      return SILENCE_TYPES.PROMISE_VERIFICATION_BLOCKED;
    }
    if (reason.includes('budget') || reason.includes('limit') || reason.includes('exceeded')) {
      return SILENCE_TYPES.BUDGET_LIMIT_EXCEEDED;
    }
    if (reason === SILENCE_REASONS.DISCOVERY_ERROR || reason === SILENCE_REASONS.NO_MATCHING_SELECTOR) {
      return SILENCE_TYPES.DISCOVERY_FAILURE;
    }
    if (reason === SILENCE_REASONS.SENSOR_FAILED || reason === SILENCE_REASONS.SENSOR_UNAVAILABLE) {
      return SILENCE_TYPES.SENSOR_FAILURE;
    }
    if (reason === SILENCE_REASONS.INCREMENTAL_UNCHANGED) {
      return SILENCE_TYPES.INCREMENTAL_REUSE;
    }
    if (reason === SILENCE_REASONS.NO_EXPECTATION) {
      return SILENCE_TYPES.PROMISE_NOT_EVALUATED;
    }
    return SILENCE_TYPES.PROMISE_NOT_EVALUATED; // Conservative default
  }

  /**
   * PHASE 4: Infer trigger from reason
   */
  _inferTrigger(reason) {
    const triggers = {
      [SILENCE_REASONS.NAVIGATION_TIMEOUT]: 'navigation_timeout',
      [SILENCE_REASONS.INTERACTION_TIMEOUT]: 'interaction_timeout',
      [SILENCE_REASONS.SETTLE_TIMEOUT]: 'settle_timeout',
      [SILENCE_REASONS.LOAD_TIMEOUT]: 'load_timeout',
      [SILENCE_REASONS.DESTRUCTIVE_TEXT]: 'destructive_text_block',
      [SILENCE_REASONS.EXTERNAL_NAVIGATION]: 'external_navigation',
      [SILENCE_REASONS.EXTERNAL_BLOCKED]: 'external_origin_blocked',
      [SILENCE_REASONS.UNSAFE_PATTERN]: 'unsafe_pattern_block',
      [SILENCE_REASONS.SCAN_TIME_EXCEEDED]: 'scan_time_limit_exceeded',
      [SILENCE_REASONS.PAGE_LIMIT_EXCEEDED]: 'page_limit_exceeded',
      [SILENCE_REASONS.INTERACTION_LIMIT_EXCEEDED]: 'interaction_limit_exceeded',
      [SILENCE_REASONS.ROUTE_LIMIT_EXCEEDED]: 'route_limit_exceeded',
      [SILENCE_REASONS.DISCOVERY_ERROR]: 'discovery_failed',
      [SILENCE_REASONS.NO_MATCHING_SELECTOR]: 'selector_not_found',
      [SILENCE_REASONS.SENSOR_FAILED]: 'sensor_failure',
      [SILENCE_REASONS.SENSOR_UNAVAILABLE]: 'sensor_unavailable',
      [SILENCE_REASONS.INCREMENTAL_UNCHANGED]: 'incremental_data_reuse',
      [SILENCE_REASONS.NO_EXPECTATION]: 'no_expectation_defined',
    };
    return triggers[reason] || reason;
  }

  /**
   * PHASE 4: Infer evaluation_status from reason
   */
  _inferEvaluationStatus(reason) {
    if (reason.includes('timeout')) {
      return EVALUATION_STATUS.TIMED_OUT;
    }
    if (reason === SILENCE_REASONS.DESTRUCTIVE_TEXT || reason === SILENCE_REASONS.UNSAFE_PATTERN || reason === SILENCE_REASONS.EXTERNAL_NAVIGATION) {
      return EVALUATION_STATUS.BLOCKED;
    }
    if (reason === SILENCE_REASONS.NO_EXPECTATION || reason === SILENCE_REASONS.NO_MATCHING_SELECTOR) {
      return EVALUATION_STATUS.AMBIGUOUS;
    }
    if (reason === SILENCE_REASONS.INCREMENTAL_UNCHANGED || reason.includes('budget') || reason.includes('limit')) {
      return EVALUATION_STATUS.SKIPPED;
    }
    return EVALUATION_STATUS.INCOMPLETE;
  }

  /**
   * PHASE 4: Infer confidence impact from reason and scope
   */
  _inferConfidenceImpact(reason, _scope) {
    // Map reason to which confidence metric(s) are affected
    const impact = {
      coverage: 0,
      promise_verification: 0,
      overall: 0
    };

    if (reason.includes('budget') || reason.includes('limit') || reason.includes('timeout')) {
      impact.coverage = -5;
      impact.promise_verification = -10;
      impact.overall = -7;
    }
    if (reason === SILENCE_REASONS.DESTRUCTIVE_TEXT || reason === SILENCE_REASONS.UNSAFE_PATTERN) {
      impact.promise_verification = -15; // Safety blocks reduce promise confidence most
      impact.overall = -8;
    }
    if (reason === SILENCE_REASONS.DISCOVERY_ERROR || reason === SILENCE_REASONS.NO_MATCHING_SELECTOR) {
      impact.coverage = -10;
      impact.promise_verification = -5;
      impact.overall = -8;
    }
    if (reason === SILENCE_REASONS.SENSOR_FAILED || reason === SILENCE_REASONS.SENSOR_UNAVAILABLE) {
      impact.coverage = -15; // Sensor failures affect coverage most
      impact.promise_verification = -10;
      impact.overall = -12;
    }
    if (reason === SILENCE_REASONS.NO_EXPECTATION) {
      impact.promise_verification = -3; // Minor impact - just ambiguous assertion
      impact.overall = -1;
    }

    return impact;
  }

  /**
   * Record multiple entries at once
   */
  recordBatch(entries) {
    entries.forEach(e => this.record(e));
  }

  /**
   * Get all entries in a category
   */
  getCategory(category) {
    return this.byCategory[category] || [];
  }

  /**
   * Get all entries for a reason
   */
  getReason(reason) {
    return this.byReason[reason] || [];
  }

  /**
   * PHASE 4: Query silences by type
   */
  getSilencesByType(silenceType) {
    return this.entries.filter(e => e.silence_type === silenceType);
  }

  /**
   * PHASE 4: Query silences by promise (only those with related_promise set)
   */
  getSilencesByPromise(promise) {
    return this.entries.filter(e => e.related_promise && e.related_promise.type === promise.type);
  }

  /**
   * PHASE 4: Query silences by evaluation status
   */
  getSilencesByEvalStatus(status) {
    return this.entries.filter(e => e.evaluation_status === status);
  }

  /**
   * PHASE 4: Aggregate confidence impact across all silences
   */
  getAggregatedConfidenceImpact() {
    const total = {
      coverage: 0,
      promise_verification: 0,
      overall: 0
    };
    
    this.entries.forEach(entry => {
      if (entry.confidence_impact) {
        total.coverage += entry.confidence_impact.coverage;
        total.promise_verification += entry.confidence_impact.promise_verification;
        total.overall += entry.confidence_impact.overall;
      }
    });
    
    // Clamp to -100 to 0 range
    return {
      coverage: Math.max(-100, total.coverage),
      promise_verification: Math.max(-100, total.promise_verification),
      overall: Math.max(-100, total.overall)
    };
  }

  /**
   * PHASE 4: Get silences that affect promise verification
   */
  getPromiseVerificationBlockers() {
    return this.entries.filter(e => 
      e.evaluation_status === EVALUATION_STATUS.BLOCKED || 
      e.evaluation_status === EVALUATION_STATUS.TIMED_OUT ||
      (e.silence_type === SILENCE_TYPES.PROMISE_VERIFICATION_BLOCKED)
    );
  }

  /**
   * PHASE 4: Get silences that affect coverage
   */
  getCoverageGaps() {
    return this.entries.filter(e => 
      e.outcome === 'COVERAGE_GAP' ||
      e.evaluation_status === EVALUATION_STATUS.SKIPPED ||
      (e.silence_type === SILENCE_TYPES.BUDGET_LIMIT_EXCEEDED)
    );
  }

  /**
   * Get summary statistics
   * PHASE 4: Added lifecycle metrics (type, status, promise association)
   */
  getSummary() {
    const summary = {
      totalSilences: this.entries.length,
      byOutcome: {},
      byCategory: {},
      byReason: {},
      scopes: {},      byType: {},
      byEvaluationStatus: {},
      withPromiseAssociation: 0,
      confidenceImpact: this.getAggregatedConfidenceImpact()
    };

    // Count by outcome (PHASE 2)
    this.entries.forEach(entry => {
      if (entry.outcome) {
        summary.byOutcome[entry.outcome] = (summary.byOutcome[entry.outcome] || 0) + 1;
      }
    });

    // Count by category
    Object.entries(this.byCategory).forEach(([cat, entries]) => {
      if (entries.length > 0) {
        summary.byCategory[cat] = entries.length;
      }
    });

    // Count by reason
    Object.entries(this.byReason).forEach(([reason, entries]) => {
      if (entries.length > 0) {
        summary.byReason[reason] = entries.length;
      }
    });

    // Count by scope
    this.entries.forEach(entry => {
      summary.scopes[entry.scope] = (summary.scopes[entry.scope] || 0) + 1;
    });    this.entries.forEach(entry => {
      if (entry.silence_type) {
        summary.byType[entry.silence_type] = (summary.byType[entry.silence_type] || 0) + 1;
      }
      if (entry.evaluation_status) {
        summary.byEvaluationStatus[entry.evaluation_status] = (summary.byEvaluationStatus[entry.evaluation_status] || 0) + 1;
      }
      if (entry.related_promise) {
        summary.withPromiseAssociation++;
      }
    });

    return summary;
  }

  /**
   * Get detailed summary for output
   */
  getDetailedSummary() {
    return {
      total: this.entries.length,
      entries: this.entries,
      summary: this.getSummary()
    };
  }

  /**
   * Export all silence data for serialization (used by writeTraces)
   * PHASE 5: Entries sorted deterministically for replay consistency
   */
  export() {    const sortedEntries = [...this.entries].sort((a, b) => {
      if (a.scope !== b.scope) return a.scope.localeCompare(b.scope);
      if (a.reason !== b.reason) return a.reason.localeCompare(b.reason);
      return (a.description || '').localeCompare(b.description || '');
    });
    
    return {
      total: sortedEntries.length,
      entries: sortedEntries,
      byCategory: this.byCategory,
      byReason: this.byReason,
      summary: this.getSummary()
    };
  }

  _getCategoryForReason(reason) {
    if (reason.includes('budget') || reason.includes('limit') || reason.includes('exceeded')) {
      return SILENCE_CATEGORIES.BUDGET;
    }
    if (reason.includes('timeout')) {
      return SILENCE_CATEGORIES.TIMEOUT;
    }
    if (reason.includes('destructive') || reason.includes('external') || reason.includes('unsafe')) {
      return SILENCE_CATEGORIES.SAFETY;
    }
    if (reason.includes('incremental')) {
      return SILENCE_CATEGORIES.INCREMENTAL;
    }
    if (reason.includes('discovery')) {
      return SILENCE_CATEGORIES.DISCOVERY;
    }
    if (reason.includes('sensor')) {
      return SILENCE_CATEGORIES.SENSOR;
    }
    if (reason.includes('expectation') || reason.includes('no_expectation')) {
      return SILENCE_CATEGORIES.EXPECTATION;
    }
    if (reason.includes('navigation') || reason.includes('origin')) {
      return SILENCE_CATEGORIES.NAVIGATION;
    }
    return null;
  }
}

export default SilenceTracker;



