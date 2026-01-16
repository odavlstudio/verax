import { resolve } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { detectProjectType } from './project-detector.js';
import { extractRoutes } from './route-extractor.js';
import { writeManifest } from './manifest-writer.js';

/**
 * @typedef {Object} LearnResult
 * @property {number} version
 * @property {string} learnedAt
 * @property {string} projectDir
 * @property {string} projectType
 * @property {Array} routes
 * @property {Array<string>} publicRoutes
 * @property {Array<string>} internalRoutes
 * @property {Array} [staticExpectations]
 * @property {Array} [flows]
 * @property {string} [expectationsStatus]
 * @property {Array} [coverageGaps]
 * @property {Array} notes
 * @property {Object} [learnTruth]
 * @property {string} [manifestPath] - Optional manifest path (added when loaded from file)
 */

/**
 * @param {string} projectDir
 * @returns {Promise<LearnResult>}
 */
export async function learn(projectDir) {
  const absoluteProjectDir = resolve(projectDir);
  
  if (!existsSync(absoluteProjectDir)) {
    throw new Error(`Project directory does not exist: ${absoluteProjectDir}`);
  }
  
  const projectType = await detectProjectType(absoluteProjectDir);
  const routes = await extractRoutes(absoluteProjectDir, projectType);
  
    const manifest = await writeManifest(absoluteProjectDir, projectType, routes);
  
    // Write manifest to disk and return path
    const veraxDir = resolve(absoluteProjectDir, '.verax');
    mkdirSync(veraxDir, { recursive: true });
  
    const manifestPath = resolve(veraxDir, 'project.json');
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  
    return {
      ...manifest,
      manifestPath
    };
}
