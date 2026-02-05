import { atomicWriteJson } from '../util/support/atomic-write.js';
import { ARTIFACT_REGISTRY, getArtifactVersions } from '../../verax/core/artifacts/registry.js';
import { getTimeProvider } from '../util/support/time-provider.js';
import { VERSION } from '../../version.js';

function getVersion() {
  return VERSION;
}

/**
 * Extracted from runCommand Phase 2 (Initialization) for readability. No behavior change.
 * Writes initial run status and metadata artifacts.
 */
export function writeInitialArtifacts(paths, runId, projectRoot, url, src, srcPath) {
  const timeProvider = getTimeProvider();
  const startedAt = timeProvider.iso();
  
  atomicWriteJson(paths.runStatusJson, {
    contractVersion: 1,
    artifactVersions: getArtifactVersions(),
    status: 'INCOMPLETE',
    lifecycle: 'RUNNING',
    runId,
    startedAt,
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
    completedAt: null,
    error: null,
  });
  
  return startedAt;
}








