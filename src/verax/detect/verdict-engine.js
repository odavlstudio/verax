/**
 * OBSERVATION ENGINE
 *
 * Produces an observation summary from scan results.
 * 
 * VERAX is an Outcome Observer - it does NOT judge, validate, or decide.
 * It observes what code promises, what users do, and what actually happens.
 * It reports observations, discrepancies, gaps, and unknowns - nothing more.
 * 
 * NO VERDICT. NO JUDGMENT. NO SAFETY CLAIM. NO GO/NO-GO DECISIONS.
 * 
 * PHASE 2: All observations include canonical outcome classifications.
 * PHASE 3: All observations include Promise awareness - what promise was being evaluated.
 * PHASE 4: All observations include Silence lifecycle - type, trigger, evaluation status, confidence impact.
 */

import { buildEvidenceIndex } from './evidence-index.js';
import { CANONICAL_OUTCOMES } from '../core/canonical-outcomes.js';
import { SILENCE_TYPES, EVALUATION_STATUS } from '../core/silence-model.js';
import { inferPromiseFromInteraction } from '../core/promise-model.js';
import { createImpactSummary } from '../core/silence-impact.js';

/**
 * Compute observation summary from scan findings and analysis.
 * 
 * SILENCE TRACKING: All gaps, timeouts, skips, sensor failures are explicit.
 * Nothing unobserved is allowed to disappear.
 * 
 * @param {Array} findings - Array of finding objects (observed discrepancies)
 * @param {Object} observeTruth - Coverage data (what was observed)
 * @param {Object} learnTruth - Learned route data
 * @param {Array} coverageGaps - Expectations/interactions not evaluated
 * @param {Boolean} budgetExceeded - Whether budget was exceeded during scan
 * @param {Object} detectTruth - Detection truth (includes silence data)
 * @returns {Object} ObservationSummary with findings, gaps, unknowns, coverage facts, silences
 */
export function computeObservationSummary(findings, observeTruth, learnTruth, coverageGaps, budgetExceeded, detectTruth = null, projectDir = null, silenceTracker = null) {
  const isBudgetExceeded = budgetExceeded !== undefined ? budgetExceeded : (observeTruth?.budgetExceeded === true);
  const traces = Array.isArray(observeTruth?.traces) ? observeTruth.traces : [];
  const evidenceBuild = buildEvidenceIndex(traces, projectDir, silenceTracker);
  
  // Extract coverage facts
  const coverage = observeTruth?.coverage || {};
  const pagesEvaluated = coverage.pagesVisited || 0;
  const pagesDiscovered = coverage.pagesDiscovered || 0;
  const interactionsEvaluated = coverage.interactionsExecuted || coverage.candidatesSelected || observeTruth?.interactionsObserved || 0;
  const interactionsDiscovered = coverage.interactionsDiscovered || coverage.candidatesDiscovered || 0;
  const expectationTotal = learnTruth?.expectationsDiscovered || 0;
  const coverageGapsCount = coverageGaps?.length || 0;
  const expectationsEvaluated = Math.max(0, expectationTotal - coverageGapsCount);

  // Count unproven results (interactions without PROVEN expectations)
  const unprovenTraces = traces.filter(t =>
    t.unprovenResult === true || t.resultType === 'UNPROVEN_RESULT'
  );
  const skippedCount = coverage.skippedInteractions || 0;

  // Count findings by confidence (for transparency, not judgment)
  const findingsByConfidence = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    UNKNOWN: 0
  };
  const findingsByType = {};
  const findingsByOutcome = {};  // PHASE 2: Added outcome tracking
  const findingsByPromise = {};  // PHASE 3: Added promise tracking
  
  for (const finding of (findings || [])) {
    const confidence = finding.confidence?.level || 'UNKNOWN';
    const type = finding.type || 'unknown';
    const outcome = finding.outcome || CANONICAL_OUTCOMES.SILENT_FAILURE;  // Default for legacy findings
    const promiseType = finding.promise?.type || 'UNKNOWN_PROMISE';  // PHASE 3
    
    if (Object.prototype.hasOwnProperty.call(findingsByConfidence, confidence)) {
      findingsByConfidence[confidence]++;
    }
    findingsByType[type] = (findingsByType[type] || 0) + 1;
    findingsByOutcome[outcome] = (findingsByOutcome[outcome] || 0) + 1;  // PHASE 2
    findingsByPromise[promiseType] = (findingsByPromise[promiseType] || 0) + 1;  // PHASE 3
  }

  // Calculate ratios (factual, not judgmental)
  const pageRatio = pagesDiscovered > 0 ? clampRatio(pagesEvaluated / pagesDiscovered) : (pagesDiscovered === 0 ? null : 0);
  const interactionRatio = interactionsDiscovered > 0 ? clampRatio(interactionsEvaluated / interactionsDiscovered) : (interactionsDiscovered === 0 ? null : 0);
  const expectationRatio = expectationTotal > 0 ? clampRatio(expectationsEvaluated / expectationTotal) : (expectationTotal === 0 ? null : 0);

  // Identify gaps explicitly
  const gaps = {
    pages: pagesDiscovered > pagesEvaluated ? pagesDiscovered - pagesEvaluated : 0,
    interactions: interactionsDiscovered > interactionsEvaluated ? interactionsDiscovered - interactionsEvaluated : 0,
    expectations: coverageGapsCount,
    skippedInteractions: skippedCount,
    unprovenResults: unprovenTraces.length
  };

  // Build gap details
  const gapDetails = [];
  if (isBudgetExceeded) {
    gapDetails.push({
      outcome: CANONICAL_OUTCOMES.COVERAGE_GAP,  // PHASE 2
      type: 'budget_exceeded',
      message: `Budget limit reached: ${pagesEvaluated} ${pagesEvaluated}/${pagesDiscovered} pages and ${interactionsEvaluated}/${interactionsDiscovered} interactions evaluated - observation incomplete`,
      pagesAffected: pagesDiscovered - pagesEvaluated,
      interactionsAffected: interactionsDiscovered - interactionsEvaluated
    });
  }
  if (gaps.pages > 0) {
    gapDetails.push({
      outcome: CANONICAL_OUTCOMES.COVERAGE_GAP,  // PHASE 2
      type: 'pages_not_evaluated',
      message: `${gaps.pages} page(s) discovered but not visited - observations for these pages are unavailable`,
      count: gaps.pages
    });
  }
  if (gaps.interactions > 0) {
    gapDetails.push({
      outcome: CANONICAL_OUTCOMES.COVERAGE_GAP,  // PHASE 2
      type: 'interactions_not_evaluated',
      message: `${gaps.interactions} interaction(s) discovered but not executed - behavior of these interactions is unknown`,
      count: gaps.interactions
    });
  }
  if (gaps.expectations > 0) {
    gapDetails.push({
      outcome: CANONICAL_OUTCOMES.COVERAGE_GAP,  // PHASE 2
      type: 'expectations_not_evaluated',
      message: `${gaps.expectations} expectation(s) defined but not evaluated - cannot determine if code matches reality for these`,
      count: gaps.expectations,
      details: coverageGaps.slice(0, 10) // Limit detail list
    });
  }
  if (gaps.skippedInteractions > 0) {
    gapDetails.push({
      outcome: CANONICAL_OUTCOMES.UNPROVEN_INTERACTION,  // PHASE 2: Executed but outcome not asserted
      type: 'interactions_skipped',
      message: `${gaps.skippedInteractions} interaction(s) executed but outcomes not evaluated (safety policy, ambiguous state, or technical limitations)`,
      count: gaps.skippedInteractions
    });
  }

  // Build observation summary
  const summary = {
    toolStatus: 'completed',
    observations: {
      discrepanciesObserved: findings?.length || 0,
      discrepanciesByType: findingsByType,
      discrepanciesByConfidence: findingsByConfidence,
      discrepanciesByOutcome: findingsByOutcome,  // PHASE 2: Canonical outcomes
      discrepanciesByPromise: findingsByPromise,  // PHASE 3: Promise types
      findings: findings || []
    },
    coverage: {
      pagesEvaluated,
      pagesDiscovered,
      pageRatio: pageRatio !== null ? pageRatio : undefined,
      interactionsEvaluated,
      interactionsDiscovered,
      interactionRatio: interactionRatio !== null ? interactionRatio : undefined,
      expectationsEvaluated,
      expectationsDiscovered: expectationTotal,
      expectationRatio: expectationRatio !== null ? expectationRatio : undefined
    },
    gaps: {
      total: Object.values(gaps).reduce((a, b) => a + b, 0),
      pages: gaps.pages,
      interactions: gaps.interactions + gaps.skippedInteractions,
      expectations: gaps.expectations,
      unprovenResults: gaps.unprovenResults,
      details: gapDetails
    },
    // SILENCE TRACKING: Attach all silence data for explicit reporting
    silences: detectTruth?.silences || null,
    // PHASE 4: Add silence impact accounting
    silenceImpactSummary: detectTruth?.silences?.entries ? 
      createImpactSummary(detectTruth.silences.entries) : 
      null,
    evidenceIndex: evidenceBuild.evidenceIndex,
    observedAt: new Date().toISOString()
  };

  return summary;
}

/**
 * Format observation summary for console output.
 * 
 * PHASE 2: Includes canonical outcome classifications
 * 
 * SILENCE PHILOSOPHY: 
 * - Gaps/unknowns ALWAYS shown, even if zero (no silent success)
 * - Timeouts, caps, skips, sensor failures explicitly reported
 * - Zero counts are explicit: "(No gaps)" not hidden
 * - Nothing unobserved is allowed to disappear
 * 
 * Observational, not judgmental. Reports facts: what was observed, gaps, unknowns.
 * 
 * @param {Object} observationSummary - Observation summary object
 * @returns {string} Formatted observation report
 */
export function formatObservationSummary(observationSummary) {
  const lines = [];
  
  lines.push('\n═══════════════════════════════════════');
  lines.push('OBSERVATION REPORT');
  lines.push('═══════════════════════════════════════');
  
  // Tool status (factual only)
  lines.push('');
  lines.push(`Tool Status: ${observationSummary.toolStatus || 'completed'}`);
  lines.push(`(Indicates tool execution status, not site quality or safety)`);
  
  // What was observed
  lines.push('');
  lines.push('DISCREPANCIES OBSERVED:');
  const obs = observationSummary.observations || {};
  lines.push(`  Count: ${obs.discrepanciesObserved || 0}`);
  
  if (obs.discrepanciesObserved > 0) {
    lines.push('  Types observed:');
    for (const [type, count] of Object.entries(obs.discrepanciesByType || {})) {
      lines.push(`    - ${type}: ${count}`);
    }
    
    // PHASE 2: Show outcomes
    if (obs.discrepanciesByOutcome && Object.keys(obs.discrepanciesByOutcome).length > 0) {
      lines.push('  By outcome classification:');
      for (const [outcome, count] of Object.entries(obs.discrepanciesByOutcome)) {
        if (count > 0) {
          lines.push(`    - ${outcome}: ${count}`);
        }
      }
    }
    
    // PHASE 3: Show promises
    if (obs.discrepanciesByPromise && Object.keys(obs.discrepanciesByPromise).length > 0) {
      lines.push('  By promise type:');
      for (const [promise, count] of Object.entries(obs.discrepanciesByPromise)) {
        if (count > 0) {
          const promiseLabel = promise.replace(/_PROMISE$/, '').replace(/_/g, ' ');
          lines.push(`    - ${promiseLabel}: ${count}`);
        }
      }
    }
    
    lines.push('  By confidence level:');
    const conf = obs.discrepanciesByConfidence || {};
    if (conf.HIGH > 0) lines.push(`    - HIGH: ${conf.HIGH}`);
    if (conf.MEDIUM > 0) lines.push(`    - MEDIUM: ${conf.MEDIUM}`);
    if (conf.LOW > 0) lines.push(`    - LOW: ${conf.LOW}`);
    if (conf.UNKNOWN > 0) lines.push(`    - UNKNOWN: ${conf.UNKNOWN}`);
  } else {
    lines.push('  No discrepancies observed between code promises and runtime behavior');
  }
  
  // Coverage facts
  lines.push('');
  lines.push('WHAT WAS EVALUATED:');
  const cov = observationSummary.coverage || {};
  lines.push(`  Pages: ${cov.pagesEvaluated || 0} of ${cov.pagesDiscovered || 0} discovered${cov.pageRatio !== undefined ? ` (${(cov.pageRatio * 100).toFixed(1)}% evaluated)` : ''}`);
  lines.push(`  Interactions: ${cov.interactionsEvaluated || 0} of ${cov.interactionsDiscovered || 0} discovered${cov.interactionRatio !== undefined ? ` (${(cov.interactionRatio * 100).toFixed(1)}% evaluated)` : ''}`);
  lines.push(`  Expectations: ${cov.expectationsEvaluated || 0} of ${cov.expectationsDiscovered || 0} discovered${cov.expectationRatio !== undefined ? ` (${(cov.expectationRatio * 100).toFixed(1)}% evaluated)` : ''}`);
  
  // Gaps explicitly reported (always shown, even if zero)
  const gaps = observationSummary.gaps || {};
  lines.push('');
  lines.push('EVALUATION GAPS (NOT evaluated - observations incomplete for these items):');
  lines.push(`  Pages: ${gaps.pages || 0} not evaluated`);
  lines.push(`  Interactions: ${gaps.interactions || 0} not evaluated`);
  lines.push(`  Expectations: ${gaps.expectations || 0} not evaluated`);
  if (gaps.unprovenResults > 0) {
    lines.push(`  Interactions without PROVEN expectations: ${gaps.unprovenResults}`);
  }
  
  if (gaps.details && gaps.details.length > 0) {
    lines.push('  Gap reasons:');
    for (const gap of gaps.details.slice(0, 5)) {
      lines.push(`    - ${gap.message}`);
    }
  } else if (gaps.total === 0) {
    lines.push('  (No gaps reported - all discovered items were evaluated)');
  }
  
  // SILENCE TRACKING: Explicitly show all silences (timeouts, skips, sensor failures, caps)
  // PHASE 4: Include lifecycle information (type, status, promise association, confidence impact)
  const silences = observationSummary.silences;
  if (silences && silences.totalSilences > 0) {
    lines.push('');
    lines.push('UNKNOWNS (Silences - things attempted but outcome unknown):');
    lines.push(`  Total silence events: ${silences.totalSilences}`);
    
    // PHASE 2: Show outcomes in silence
    if (silences.summary && silences.summary.byOutcome && Object.keys(silences.summary.byOutcome).length > 0) {
      lines.push('  By outcome classification:');
      for (const [outcome, count] of Object.entries(silences.summary.byOutcome)) {
        if (count > 0) {
          lines.push(`    - ${outcome}: ${count}`);
        }
      }
    }
    
    // PHASE 4: Show silence lifecycle metrics
    if (silences.summary && silences.summary.byType && Object.keys(silences.summary.byType).length > 0) {
      lines.push('  By silence type:');
      const types = Object.entries(silences.summary.byType)
        .filter(([_, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      for (const [type, count] of types) {
        const typeLabel = type.replace(/_/g, ' ').toLowerCase();
        lines.push(`    - ${typeLabel}: ${count}`);
      }
    }
    
    // PHASE 4: Show evaluation status distribution
    if (silences.summary && silences.summary.byEvaluationStatus && Object.keys(silences.summary.byEvaluationStatus).length > 0) {
      lines.push('  By evaluation status:');
      for (const [status, count] of Object.entries(silences.summary.byEvaluationStatus)) {
        if (count > 0) {
          lines.push(`    - ${status}: ${count}`);
        }
      }
    }
    
    // PHASE 4: Show promise association count
    if (silences.summary && silences.summary.withPromiseAssociation) {
      lines.push(`  Silences with promise association: ${silences.summary.withPromiseAssociation}`);
    }
    
    // PHASE 4: Show confidence impact
    if (silences.summary && silences.summary.confidenceImpact) {
      const impact = silences.summary.confidenceImpact;
      if (impact.coverage !== 0 || impact.promise_verification !== 0 || impact.overall !== 0) {
        lines.push('  Confidence impact:');
        if (impact.coverage !== 0) lines.push(`    - Coverage confidence: ${impact.coverage > 0 ? '+' : ''}${impact.coverage}%`);
        if (impact.promise_verification !== 0) lines.push(`    - Promise verification confidence: ${impact.promise_verification > 0 ? '+' : ''}${impact.promise_verification}%`);
        if (impact.overall !== 0) lines.push(`    - Overall confidence: ${impact.overall > 0 ? '+' : ''}${impact.overall}%`);
      }
    }

    
    if (silences.byCategory) {
      lines.push('  By category:');
      for (const [category, count] of Object.entries(silences.byCategory)) {
        if (count > 0) {
          lines.push(`    - ${category}: ${count}`);
        }
      }
    }
    
    if (silences.byReason) {
      lines.push('  By reason:');
      const sortedReasons = Object.entries(silences.byReason)
        .filter(([_, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      for (const [reason, count] of sortedReasons) {
        lines.push(`    - ${reason.replace(/_/g, ' ')}: ${count}`);
      }
    }
  } else {
    lines.push('');
    lines.push('UNKNOWNS (Silences):');
    lines.push('  No silence events recorded (all attempted actions completed)');
  }
  
  // PHASE 4: Show silence impact summary
  const impactSummary = observationSummary.silenceImpactSummary;
  if (impactSummary && impactSummary.total_silences > 0) {
    lines.push('');
    lines.push('SILENCE IMPACT ON CONFIDENCE:');
    const impact = impactSummary.aggregated_impact;
    if (impact) {
      lines.push(`  Aggregated impact: ${impactSummary.confidence_interpretation}`);
      lines.push(`  Coverage confidence: ${impact.coverage > 0 ? '+' : ''}${impact.coverage}%`);
      lines.push(`  Promise verification confidence: ${impact.promise_verification > 0 ? '+' : ''}${impact.promise_verification}%`);
      lines.push(`  Overall observation confidence: ${impact.overall > 0 ? '+' : ''}${impact.overall}%`);
    }
    
    if (impactSummary.by_severity && Object.values(impactSummary.by_severity).some(v => v > 0)) {
      lines.push('  Silences by severity:');
      const sev = impactSummary.by_severity;
      if (sev.critical > 0) lines.push(`    - CRITICAL: ${sev.critical} events`);
      if (sev.high > 0) lines.push(`    - HIGH: ${sev.high} events`);
      if (sev.medium > 0) lines.push(`    - MEDIUM: ${sev.medium} events`);
      if (sev.low > 0) lines.push(`    - LOW: ${sev.low} events`);
    }
    
    if (impactSummary.most_impactful_types && impactSummary.most_impactful_types.length > 0) {
      lines.push('  Most impactful silence types:');
      for (const impactType of impactSummary.most_impactful_types.slice(0, 3)) {
        lines.push(`    - ${impactType.type.replace(/_/g, ' ')}: ${impactType.count} events, avg impact ${impactType.average_impact}%`);
      }
    }
  }
  
  if (obs.discrepanciesObserved > 0 && obs.findings && obs.findings.length > 0) {
    lines.push('');
    lines.push('DISCREPANCIES OBSERVED (sample):');
    for (const finding of obs.findings.slice(0, 3)) {
      const outcome = finding.outcome ? ` [${finding.outcome}]` : '';
      const promiseInfo = finding.promise ? ` (${finding.promise.type.replace(/_PROMISE$/, '')})` : '';
      const _confStr = finding.confidence?.level ? ` (${finding.confidence.level} confidence)` : '';
      const userStmt = finding.what_happened ? `User: ${finding.what_happened}` : '';
      lines.push(`  • ${finding.type}${outcome}${promiseInfo}`);
      if (userStmt) lines.push(`    ${userStmt}`);
      if (finding.what_was_expected) lines.push(`    Expected: ${finding.what_was_expected}`);
      if (finding.what_was_observed) lines.push(`    Observed: ${finding.what_was_observed}`);
      if (finding.promise?.expected_signal) lines.push(`    Promise signal: ${finding.promise.expected_signal}`);
    }
  }
  
  lines.push('');
  lines.push('═══════════════════════════════════════');
  lines.push('');
  
  return lines.join('\n');
}


/**
 * Build evidence index from traces array.
 * Maps expectations and interactions to evidence (screenshots, trace files).
 */
/**
 * Build evidence index from traces array.
 * 
 * PHASE 3: EVIDENCE INTEGRITY
 * - Validates that evidence files actually exist
 * - Missing evidence files are tracked as silence
 * - Only includes verifiable evidence in index
 * 
 * Maps expectations and interactions to evidence (screenshots, trace files).
 */
// buildEvidenceIndex moved to evidence-index.js - imported above

/**
 * PHASE 4: Associate silences with promises where applicable
 * 
 * RULE: A silence can only be associated with a promise if we can infer what promise
 * the user was attempting to verify when the silence occurred.
 * 
 * Conservative approach:
 * - Navigation timeouts → NAVIGATION_PROMISE
 * - Interaction timeouts → infer from interaction type
 * - Safety blocks → related promise
 * - Budget/discovery failures → no promise (unevaluated)
 * 
 * @param {Object} silence - SilenceEntry with silence_type, scope, context
 * @returns {Object|null} Promise object with type/expected_signal, or null if cannot infer
 */
export function inferPromiseForSilence(silence) {
  if (!silence) return null;
  
  const { silence_type, scope: _scope, reason, context } = silence;
  
  // Navigation-related silences
  if (silence_type === SILENCE_TYPES.NAVIGATION_TIMEOUT || 
      silence_type === SILENCE_TYPES.PROMISE_VERIFICATION_BLOCKED ||
      (reason && reason.includes('navigation'))) {
    return {
      type: 'NAVIGATION_PROMISE',
      expected_signal: 'URL change or navigation settled',
      reason_no_association: null
    };
  }
  
  // Interaction-related silences
  if (silence_type === SILENCE_TYPES.INTERACTION_TIMEOUT) {
    // Try to infer from context if available
    if (context && context.interaction) {
      return inferPromiseFromInteraction(context.interaction);
    }
    return {
      type: 'FEEDBACK_PROMISE',
      expected_signal: 'User feedback or interaction acknowledgment',
      reason_no_association: 'Interaction type unknown in context'
    };
  }
  
  // Safety blocks - the promise being blocked
  if (silence_type === SILENCE_TYPES.SAFETY_POLICY_BLOCK) {
    if (context && context.interaction) {
      const inferred = inferPromiseFromInteraction(context.interaction);
      return {
        ...inferred,
        blocked_by_safety: true
      };
    }
    return null; // Cannot infer without interaction context
  }
  
  // Discovery/sensor failures - no promise can be evaluated
  if (silence_type === SILENCE_TYPES.DISCOVERY_FAILURE || 
      silence_type === SILENCE_TYPES.SENSOR_FAILURE) {
    return {
      type: null,
      reason_no_association: 'Observation infrastructure failure - no promise evaluatable'
    };
  }
  
  // Budget/incremental/ambiguous - no promise
  if (silence_type === SILENCE_TYPES.BUDGET_LIMIT_EXCEEDED || 
      silence_type === SILENCE_TYPES.INCREMENTAL_REUSE ||
      silence_type === SILENCE_TYPES.PROMISE_NOT_EVALUATED) {
    return {
      type: null,
      reason_no_association: 'Promise not yet evaluated'
    };
  }
  
  // Conservative default: no association
  return null;
}

/**
 * Validate that a silence event makes forensic sense
 * RULE: Silence can NEVER appear as success. It is always a gap in observation.
 * 
 * @param {Object} silence - SilenceEntry
 * @returns {Object} Validation result: { valid: boolean, reason: string }
 */
export function validateSilenceIntegrity(silence) {
  if (!silence) {
    return { valid: false, reason: 'Silence entry is null/undefined' };
  }
  
  // Silence can NEVER have outcome === INFORMATIONAL or any "success" outcome
  const prohibitedOutcomes = ['SUCCESS', 'PASS', 'VERIFIED', 'CONFIRMED'];
  if (prohibitedOutcomes.includes(silence.outcome?.toUpperCase())) {
    return { 
      valid: false, 
      reason: `Silence cannot have outcome "${silence.outcome}" - silence is always a gap`
    };
  }
  
  // Silence must have a valid scope
  const validScopes = ['page', 'interaction', 'expectation', 'sensor', 'navigation', 'settle'];
  if (!silence.scope || !validScopes.includes(silence.scope)) {
    return { valid: false, reason: `Invalid scope: "${silence.scope}"` };
  }
  
  // Must have evaluation_status (Phase 4)
  const validStatuses = Object.values(EVALUATION_STATUS);
  if (!silence.evaluation_status || !validStatuses.includes(silence.evaluation_status)) {
    return { 
      valid: false, 
      reason: `Invalid evaluation_status: "${silence.evaluation_status}". Must be one of: ${validStatuses.join(', ')}`
    };
  }
  
  return { valid: true, reason: null };
}

function clampRatio(ratio) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return Math.round(clamped * 10000) / 10000; // 4 decimal places
}

// writeEvidenceIndex moved to evidence-index.js - re-exported below
export { buildEvidenceIndex, writeEvidenceIndex } from './evidence-index.js';
