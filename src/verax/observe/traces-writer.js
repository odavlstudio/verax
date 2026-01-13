import { writeFileSync, mkdirSync } from 'fs';
import { getArtifactPath, getRunArtifactDir } from '../core/run-id.js';

/**
 * @typedef {Object} WriteTracesResult
 * @property {number} version
 * @property {string} observedAt
 * @property {string} url
 * @property {Array} traces
 * @property {Array} [observedExpectations]
 * @property {Object} [coverage]
 * @property {Array} [warnings]
 * @property {Object} [silences] - Added by writeTraces if silenceTracker provided
 * @property {string} tracesPath
 * @property {Object} observeTruth
 * @property {Object} [expectationExecution] - Added by caller after writeTraces
 * @property {Array} [expectationCoverageGaps] - Added by caller after writeTraces
 * @property {Object} [incremental] - Added by caller after writeTraces
 */

/**
 * SILENCE TRACKING: Write observation traces with explicit silence tracking.
 * All gaps, skips, caps, and unknowns must be recorded and surfaced.
 * 
 * PHASE 5: Writes to deterministic artifact path .verax/runs/<runId>/traces.json
 * 
 * @param {string} projectDir - Project directory
 * @param {string} url - URL observed
 * @param {Array} traces - Execution traces
 * @param {Object} [coverage] - Coverage data (if capped, this is a silence)
 * @param {Array} [warnings] - Warnings (caps are silences)
 * @param {Array} [observedExpectations] - Observed expectations
 * @param {Object} [silenceTracker] - Silence tracker (optional)
 * @param {string} [runId] - Run identifier (Phase 5) - required but optional in signature for type compatibility
 * @returns {WriteTracesResult}
 */
export function writeTraces(projectDir, url, traces, coverage = null, warnings = [], observedExpectations = [], silenceTracker = null, runId = null) {
  if (!runId) {
    throw new Error('runId is required');
  }
  const observeDir = getRunArtifactDir(projectDir, runId);
  const tracesPath = getArtifactPath(projectDir, runId, 'traces.json');
  mkdirSync(observeDir, { recursive: true });
  
  const observation = {
    version: 1,
    observedAt: new Date().toISOString(),
    url: url,
    traces: traces
  };

  if (observedExpectations && observedExpectations.length > 0) {
    observation.observedExpectations = observedExpectations;
  }

  if (coverage) {
    observation.coverage = coverage;
  }
  if (warnings && warnings.length > 0) {
    observation.warnings = warnings;
  }
  
  writeFileSync(tracesPath, JSON.stringify(observation, null, 2) + '\n');
  
  let externalNavigationBlockedCount = 0;
  let timeoutsCount = 0;
  let settleChangedCount = 0;
  
  for (const trace of traces) {
    if (trace.policy) {
      if (trace.policy.externalNavigationBlocked) {
        externalNavigationBlockedCount++;
      }
      if (trace.policy.timeout) {
        timeoutsCount++;
      }
    }

    if (trace.dom && trace.dom.settle && trace.dom.settle.domChangedDuringSettle) {
      settleChangedCount++;
    }
  }
  
  const observeTruth = {
    interactionsObserved: traces.length,
    externalNavigationBlockedCount: externalNavigationBlockedCount,
    timeoutsCount: timeoutsCount,
    settleChangedCount: settleChangedCount
  };

  if (coverage) {
    observeTruth.coverage = coverage;
    // SILENCE TRACKING: Track budget exceeded as silence (cap = unevaluated interactions)
    if (coverage.capped) {
      observeTruth.budgetExceeded = true;
      if (!warnings || warnings.length === 0) {
        warnings = [{ code: 'INTERACTIONS_CAPPED', message: `Interaction discovery reached the cap (${coverage.cap}). Scan coverage is incomplete.` }];
      }
      
      // Record budget cap as silence
      if (silenceTracker) {
        const unevaluatedCount = (coverage.candidatesDiscovered || 0) - (coverage.candidatesSelected || 0);
        silenceTracker.record({
          scope: 'interaction',
          reason: 'interaction_limit_exceeded',
          description: `Budget cap reached: ${unevaluatedCount} interactions not evaluated`,
          context: {
            cap: coverage.cap,
            discovered: coverage.candidatesDiscovered,
            evaluated: coverage.candidatesSelected,
            unevaluated: unevaluatedCount
          },
          impact: 'affects_expectations',
          count: unevaluatedCount
        });
      }
    }
  }
  if (warnings && warnings.length > 0) {
    observeTruth.warnings = warnings;
  }
  
  // SILENCE TRACKING: Attach silence entries to observation for detect phase
  if (silenceTracker && silenceTracker.entries.length > 0) {
    observation.silences = silenceTracker.export();
  }
  
  return {
    ...observation,
    tracesPath: tracesPath,
    observeTruth: observeTruth
  };
}

