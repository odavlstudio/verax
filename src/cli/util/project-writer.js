import { atomicWriteJson } from './atomic-write.js';
import { resolve } from 'path';

/**
 * Write project profile artifact
 */
export function writeProjectJson(runPaths, projectProfile) {
  const projectJsonPath = resolve(runPaths.baseDir, 'project.json');
  
  const projectJson = {
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
