import { atomicWriteJson } from '../util/support/atomic-write.js';
import { writeSummaryJson } from '../util/evidence/summary-writer.js';
import { ARTIFACT_REGISTRY, getArtifactVersions } from '../../verax/core/artifacts/registry.js';
import { getTimeProvider } from '../util/support/time-provider.js';
import { VERSION } from '../../version.js';

function getVersion() {
  return VERSION;
}

/**
 * Extracted from runCommand Phase 8 (Error Handling) for readability. No behavior change.
 * Writes error artifacts when run fails.
 */
export function writeErrorArtifacts(paths, runId, startedAt, projectRoot, url, src, srcPath, error) {
  const isIncomplete = error?.exitCode === 66;
  const status = isIncomplete ? 'INCOMPLETE' : 'FAILED';
  const incompleteReasons = isIncomplete ? [error.message || 'incomplete'] : [];
  if (paths && runId && startedAt) {
    try {
      const timeProvider = getTimeProvider();
      const failedAt = timeProvider.iso();
      atomicWriteJson(paths.runStatusJson, {
        contractVersion: 1,
        artifactVersions: getArtifactVersions(),
        status,
        runId,
        startedAt,
        failedAt,
        error: error.message,
        incompleteReasons,
      });
      
      atomicWriteJson(paths.runMetaJson, {
        contractVersion: ARTIFACT_REGISTRY.runMeta.contractVersion,
        veraxVersion: getVersion(),
        nodeVersion: process.version,
        platform: process.platform,
        cwd: projectRoot,
        command: 'run',
        args: { url, src, out: '.verax' },
        url,
        src: srcPath,
        startedAt,
        completedAt: failedAt,
        error: error.message,
      });
      
      try {
        writeSummaryJson(paths.summaryJson, {
          runId,
          status,
          startedAt,
          completedAt: failedAt,
          command: 'run',
          url,
          notes: status === 'INCOMPLETE' ? `Run incomplete: ${error.message}` : `Run failed: ${error.message}`,
          incompleteReasons,
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
        // Ignore summary write errors during failure handling
      }
    } catch (statusError) {
      // Ignore errors when writing failure status
    }
  }
}








