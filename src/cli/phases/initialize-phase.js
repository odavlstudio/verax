import { getTimeProvider } from '../util/support/time-provider.js';
import { generateRunId } from '../util/support/run-id.js';
import { getRunPaths, ensureRunDirectories } from '../util/support/paths.js';
import { atomicWriteJson } from '../util/support/atomic-write.js';
import { discoverProject } from '../util/config/project-discovery.js';
import { ARTIFACT_REGISTRY, getArtifactVersions } from '../../verax/core/artifacts/registry.js';
import { VERSION } from '../../version.js';

function getVersion() {
  return VERSION;
}

/**
 * Initialize Phase
 * 
 * @param {Object} params - { url, src, out, projectRoot, srcPath, projectSubdir, events }
 * @returns {Promise<Object>} { runId, paths, projectProfile, startedAt }
 */
export async function initializePhase(params) {
  const { url, src, out, projectRoot, srcPath, projectSubdir, events } = params;

  const runId = generateRunId(url);
  const paths = getRunPaths(projectRoot, out, runId);
  ensureRunDirectories(paths);
  
  let projectProfile;
  try {
    // Enforce boundary when detecting project metadata for monorepos
    // @ts-expect-error - discoverProject accepts boundary parameter but not in typedef
    projectProfile = await discoverProject(srcPath, { boundary: srcPath });
  } catch (error) {
    projectProfile = {
      framework: 'unknown',
      router: null,
      sourceRoot: srcPath,
      packageManager: 'unknown',
      scripts: { dev: null, build: null, start: null },
      detectedAt: getTimeProvider().iso(),
    };
  }
  
  events.emit('project:detected', {
    framework: projectProfile.framework,
    router: projectProfile.router,
    sourceRoot: projectProfile.sourceRoot,
    packageManager: projectProfile.packageManager,
  });
  
  const startedAt = getTimeProvider().iso();
  
  atomicWriteJson(paths.runStatusJson, {
    contractVersion: 1,
    artifactVersions: getArtifactVersions(),
    status: 'RUNNING',
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
    args: { url, src, out, projectSubdir },
    url,
    src: srcPath,
    startedAt,
    completedAt: null,
    error: null,
  });
  
  return { runId, paths, projectProfile, startedAt };
}
