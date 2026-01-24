/**
 * Week 8: Error Handler Module
 * Extracted from run.js
 * 
 * ZERO behavior changes from original run.js
 */

import { atomicWriteJson } from '../util/support/atomic-write.js';
import { writeSummaryJson } from '../util/evidence/summary-writer.js';
import { ARTIFACT_REGISTRY, getArtifactVersions } from '../../verax/core/artifacts/registry.js';
import { getTimeProvider } from '../util/support/time-provider.js';

/**
 * Handle run errors and write failure status
 */
export async function handleRunError(error, state, events, getVersion) {
  const { paths, runId, startedAt, projectRoot, url, src, out, srcPath } = state;
  
  if (paths && runId && startedAt) {
    try {
      const failedAt = getTimeProvider().iso();
      
      atomicWriteJson(paths.runStatusJson, {
        contractVersion: 1,
        artifactVersions: getArtifactVersions(),
        status: 'FAILED',
        scanId: paths.scanId,
        runId,
        startedAt,
        failedAt,
        error: error.message,
      });
      
      atomicWriteJson(paths.runMetaJson, {
        contractVersion: ARTIFACT_REGISTRY.runMeta.contractVersion,
        veraxVersion: getVersion(),
        nodeVersion: process.version,
        platform: process.platform,
        cwd: projectRoot,
        command: 'run',
        args: { url, src, out },
        url,
        src: srcPath,
        scanId: paths.scanId,
        runId,
        startedAt,
        completedAt: failedAt,
        error: error.message,
      });
      
      try {
        writeSummaryJson(paths.summaryJson, {
          runId,
          scanId: paths.scanId,
          status: 'FAILED',
          startedAt,
          completedAt: failedAt,
          command: 'run',
          url,
          notes: `Run failed: ${error.message}`,
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
  
  events.emit('error', {
    message: error.message,
    stack: error.stack,
  });
}
