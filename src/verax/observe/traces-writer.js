import { atomicWriteJsonSync, atomicMkdirSync } from '../../cli/util/atomic-write.js';
import { getArtifactPath, getRunArtifactDir } from '../core/run-id.js';
import { defaultSecurityPolicy } from '../core/evidence-security-policy.js';
import { filterTracesConsole } from '../core/console-log-filter.js';
import { getTimeProvider } from '../../cli/util/support/time-provider.js';

/**
 * GATE 4: Sanitize network traces before writing to canonical artifacts.
 * Removes sensitive headers, query params, and request/response bodies.
 */
function sanitizeNetworkTraces(traces) {
  if (!defaultSecurityPolicy.networkTraceSanitization.enabled) {
    return traces;
  }

  return traces.map(trace => {
    const sanitized = { ...trace };

    // Sanitize network requests if present
    if (sanitized.network && Array.isArray(sanitized.network)) {
      sanitized.network = sanitized.network.map(req => {
        const sanitizedReq = { ...req };

        // Remove request body (never store POST/PUT payloads)
        if (sanitizedReq.request) {
          sanitizedReq.request = { ...sanitizedReq.request };
          if (defaultSecurityPolicy.networkTraceSanitization.removeRequestBody) {
            delete sanitizedReq.request.body;
            delete sanitizedReq.request.postData;
          }

          // Mask sensitive headers
          if (defaultSecurityPolicy.networkTraceSanitization.maskHeaders && sanitizedReq.request.headers) {
            const headers = { ...sanitizedReq.request.headers };
            const sensitiveHeaders = [
              'authorization', 'cookie', 'x-auth-token', 'x-api-key',
              'x-csrf-token', 'x-token', 'x-api-secret', 'bearer'
            ];
            sensitiveHeaders.forEach(headerName => {
              const key = Object.keys(headers).find(k => k.toLowerCase() === headerName.toLowerCase());
              if (key) {
                headers[key] = '[REDACTED]';
              }
            });
            sanitizedReq.request.headers = headers;
          }

          // Mask query params in URL
          if (defaultSecurityPolicy.networkTraceSanitization.maskQueryParams && sanitizedReq.request.url) {
            sanitizedReq.request.url = defaultSecurityPolicy.maskSensitiveQueryParams(sanitizedReq.request.url);
          }
        }

        // Remove response body (never store response payloads)
        if (sanitizedReq.response) {
          sanitizedReq.response = { ...sanitizedReq.response };
          if (defaultSecurityPolicy.networkTraceSanitization.removeResponseBody) {
            delete sanitizedReq.response.body;
            delete sanitizedReq.response.content;
          }

          // Mask sensitive response headers (Set-Cookie, etc.)
          if (defaultSecurityPolicy.networkTraceSanitization.maskHeaders && sanitizedReq.response.headers) {
            const headers = { ...sanitizedReq.response.headers };
            const sensitiveHeaders = [
              'set-cookie', 'authorization', 'x-auth-token'
            ];
            sensitiveHeaders.forEach(headerName => {
              const key = Object.keys(headers).find(k => k.toLowerCase() === headerName.toLowerCase());
              if (key) {
                headers[key] = '[REDACTED]';
              }
            });
            sanitizedReq.response.headers = headers;
          }
        }

        return sanitizedReq;
      });
    }

    return sanitized;
  });
}

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
 * GATE 4: Network traces are sanitized (sensitive headers/params/bodies removed).
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

  // GATE 4: Sanitize network traces before writing to canonical artifact
  let sanitizedTraces = sanitizeNetworkTraces(traces);

  // GATE 4: Filter console logs from traces
  sanitizedTraces = filterTracesConsole(sanitizedTraces);

  const observeDir = getRunArtifactDir(projectDir, runId);
  const tracesPath = getArtifactPath(projectDir, runId, 'traces.json');
  // @ts-ignore - atomicMkdirSync supports recursive option
  atomicMkdirSync(observeDir, { recursive: true });
  
  const observation = {
    version: 1,
    // GATE 2: observedAt removed for determinism
    // Timestamp stored separately in diagnostics.json
    // See: src/verax/core/canonical-artifacts-contract.js
    url: url,
    traces: sanitizedTraces
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
  
  atomicWriteJsonSync(tracesPath, observation);
  
  let externalNavigationBlockedCount = 0;
  let timeoutsCount = 0;
  let settleChangedCount = 0;
  
  for (const trace of sanitizedTraces) {
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
    interactionsObserved: sanitizedTraces.length,
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
    version: 1,
    url: url,
    traces: sanitizedTraces,
    observedAt: getTimeProvider().iso(),
    tracesPath: tracesPath,
    observeTruth: observeTruth
  };
}




