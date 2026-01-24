/**
 * Timeout Handler Module (Stage 7)
 * Writes INCOMPLETE status and metadata for timed-out runs.
 */

import { atomicWriteJson } from '../util/support/atomic-write.js';
import { writeSummaryJson } from '../util/evidence/summary-writer.js';
import { ARTIFACT_REGISTRY, getArtifactVersions } from '../../verax/core/artifacts/registry.js';
import { getTimeProvider } from '../util/support/time-provider.js';

/**
 * Create finalization handler for timeouts
 */
export function createTimeoutHandler(getVersion, state, events) {
  return async function finalizeOnTimeout(reason) {
    if (state.timedOut) return; // Prevent double finalization
    state.timedOut = true;
    
    events.stopHeartbeat();
    
    if (state.paths && state.runId && state.startedAt) {
      try {
        const incompleteAt = getTimeProvider().iso();
        
        atomicWriteJson(state.paths.runStatusJson, {
          contractVersion: 1,
          artifactVersions: getArtifactVersions(),
          status: 'INCOMPLETE',
          scanId: state.paths.scanId,
          runId: state.runId,
          startedAt: state.startedAt,
          incompleteAt,
          error: reason,
        });
        
        atomicWriteJson(state.paths.runMetaJson, {
          contractVersion: ARTIFACT_REGISTRY.runMeta.contractVersion,
          veraxVersion: getVersion(),
          nodeVersion: process.version,
          platform: process.platform,
          cwd: state.projectRoot,
          command: 'run',
          args: { url: state.url, src: state.src, out: state.out },
          url: state.url,
          src: state.srcPath,
          scanId: state.paths.scanId,
          runId: state.runId,
          startedAt: state.startedAt,
          completedAt: incompleteAt,
          error: reason,
        });
        
        try {
          writeSummaryJson(state.paths.summaryJson, {
            runId: state.runId,
            scanId: state.paths.scanId,
            status: 'INCOMPLETE',
            startedAt: state.startedAt,
            completedAt: incompleteAt,
            command: 'run',
            url: state.url,
            notes: `Run timed out: ${reason}`,
          }, {
            expectationsTotal: 0,
            attempted: 0,
            observed: 0,
            silentFailures: 0,
            coverageGaps: 0,
            unproven: 0,
            informational: 0,
          });
        } catch (summaryError) {
          // Ignore summary write errors during timeout handling
        }
      } catch (statusError) {
        // Ignore errors when writing failure status
      }
    }
    
    events.emit('error', {
      message: reason,
      type: 'timeout',
    });
  };
}
