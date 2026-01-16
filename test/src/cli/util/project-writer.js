import { atomicWriteJson } from './atomic-write.js';
import { resolve } from 'path';
import { ARTIFACT_REGISTRY } from '../../verax/core/artifacts/registry.js';

/**
 * Write project profile artifact
 */
export function writeProjectJson(runPaths, projectProfile) {
  const projectJsonPath = resolve(runPaths.baseDir, 'project.json');
  
  const projectJson = {
    contractVersion: ARTIFACT_REGISTRY.project.contractVersion,
    framework: projectProfile.framework,
    router: projectProfile.router,
    sourceRoot: projectProfile.sourceRoot,
    packageManager: projectProfile.packageManager,
    scripts: {
      dev: projectProfile.scripts.dev,
      build: projectProfile.scripts.build,
      start: projectProfile.scripts.start,
    },
    detectedAt: projectProfile.detectedAt,
  };
  
  atomicWriteJson(projectJsonPath, projectJson);
  
  return projectJsonPath;
}
