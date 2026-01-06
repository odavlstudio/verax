import { resolve } from 'path';
import { existsSync } from 'fs';
import { detectProjectType } from './project-detector.js';
import { extractRoutes } from './route-extractor.js';
import { writeManifest } from './manifest-writer.js';

export async function learn(projectDir) {
  const absoluteProjectDir = resolve(projectDir);
  
  if (!existsSync(absoluteProjectDir)) {
    throw new Error(`Project directory does not exist: ${absoluteProjectDir}`);
  }
  
  const projectType = await detectProjectType(absoluteProjectDir);
  const routes = await extractRoutes(absoluteProjectDir, projectType);
  
  return await writeManifest(absoluteProjectDir, projectType, routes);
}
