import { resolve } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { detectProjectType } from './project-detector.js';
import { extractRoutes } from './route-extractor.js';
import { writeManifest } from './manifest-writer.js';
import { resolveProjectBase } from './scan-roots.js';
import { evaluateFrameworkSupport } from '../core/framework-support.js';

/**
 * @typedef {Object} LearnResult
 * @property {number} version
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
 * @param {Object} [scanOptions] - Optional scan configuration overrides
 * @param {string[]} [scanOptions.learnPaths] - User-specified paths to scan
 * @param {boolean} [scanOptions.allowEmptyLearn] - Allow learning with zero scan roots
 * @param {boolean} [scanOptions.verbose] - Enable verbose logging
 * @param {string} [scanOptions.projectSubdir] - Project subdirectory for monorepo support
 * @returns {Promise<LearnResult>}
 */
export async function learn(projectDir, scanOptions = {}) {
  const absoluteProjectDir = resolve(projectDir);
  const baseDir = resolveProjectBase(absoluteProjectDir, scanOptions.projectSubdir);
  
  if (!existsSync(baseDir)) {
    throw new Error(`Project directory does not exist: ${baseDir}`);
  }
  
  const projectType = await detectProjectType(baseDir);
  const frameworkSupport = evaluateFrameworkSupport(projectType);
  const routes = await extractRoutes(baseDir, projectType, scanOptions);
  const normalizedRoutes = frameworkSupport.status === 'supported'
    ? routes
    : routes.map((route) => ({ ...route, status: 'OUT_OF_SCOPE', reason: frameworkSupport.warning || 'unsupported_framework' }));
  
  const manifest = await writeManifest(baseDir, projectType, normalizedRoutes, scanOptions);
  manifest.learnTruth = {
    ...(manifest.learnTruth || {}),
    frameworkSupport
  };
  if (frameworkSupport.warning) {
    manifest.notes.push({ type: 'framework', warning: frameworkSupport.warning });
  }
  
  // Write manifest to disk and return path
  const veraxDir = resolve(baseDir, '.verax');
  mkdirSync(veraxDir, { recursive: true });
  
  const manifestPath = resolve(veraxDir, 'project.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  
  return {
    ...manifest,
    manifestPath
  };
}



