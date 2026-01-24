/**
 * Scan Roots & Exclusions Module
 * 
 * VISION ALIGNMENT: "The project never adapts to VERAX. VERAX adapts to the project."
 * 
 * This module determines which directories to scan during the learning phase,
 * ensuring we scan only app source code and not the entire repository.
 * 
 * Default behavior: Detect framework-specific source roots (Next.js app/pages, React src/, etc.)
 * Never scan: node_modules, dist, build artifacts, hidden dirs, test fixtures
 */

import { existsSync } from 'fs';
import { resolve, join } from 'path';

const PROJECT_MARKERS = [
  'package.json',
  'next.config.js', 'next.config.ts', 'next.config.mjs', 'next.config.cjs',
  'vite.config.js', 'vite.config.ts', 'vite.config.mjs', 'vite.config.cjs',
  'angular.json', 'turbo.json', 'pnpm-workspace.yaml', 'nx.json'
];

/**
 * Hard-coded exclusions that should NEVER be scanned
 */
export const HARD_EXCLUSIONS = [
  'node_modules/**',
  'dist/**',
  'build/**',
  'out/**',
  '.next/**',
  'coverage/**',
  '.git/**',
  '.verax/**',
  'tmp/**',
  'artifacts/**',
  'vendor/**',
  '**/*.min.*',
  '**/.DS_Store',
  '**/thumbs.db',
  '.env',
  '.env.*',
  '**/*.test.*',
  '**/*.spec.*',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/test/**',
  '**/tests/**',
  '**/fixtures/**'
];

export function resolveProjectBase(projectDir, projectSubdir) {
  if (!projectSubdir) return resolve(projectDir);

  const projectRoot = resolve(projectDir);
  const resolvedSubdir = resolve(projectDir, projectSubdir);
  if (!resolvedSubdir.startsWith(projectRoot)) {
    throw new Error(`projectSubdir must be within project root: ${projectRoot}`);
  }

  const hasMarker = PROJECT_MARKERS.some(marker => existsSync(join(resolvedSubdir, marker)));
  if (!hasMarker) {
    throw new Error(
      `projectSubdir ${projectSubdir} does not contain a project marker (package.json, next.config.*, vite.config.*, angular.json, turbo.json, pnpm-workspace.yaml, nx.json).`
    );
  }

  return resolvedSubdir;
}

/**
 * Detect appropriate scan roots for a project based on framework type
 * 
 * @param {string} projectDir - Absolute path to project root
 * @param {string} projectType - Detected project type (nextjs, react, static, etc.)
 * @returns {{ roots: string[], excludes: string[] }}
 */
export function detectScanRoots(projectDir, projectType = 'unknown') {
  const roots = [];
  
  // Next.js: app/ and/or pages/ (app router or pages router)
  if (projectType === 'nextjs') {
    const appDir = join(projectDir, 'app');
    const pagesDir = join(projectDir, 'pages');
    const srcAppDir = join(projectDir, 'src', 'app');
    const srcPagesDir = join(projectDir, 'src', 'pages');
    
    // Check app router
    if (existsSync(srcAppDir)) {
      roots.push('src/app');
    } else if (existsSync(appDir)) {
      roots.push('app');
    }
    
    // Check pages router
    if (existsSync(srcPagesDir)) {
      roots.push('src/pages');
    } else if (existsSync(pagesDir)) {
      roots.push('pages');
    }
    
    // If Next.js uses src/, also scan src/components, src/lib, etc.
    if (existsSync(join(projectDir, 'src'))) {
      const srcComponents = join(projectDir, 'src', 'components');
      const srcLib = join(projectDir, 'src', 'lib');
      if (existsSync(srcComponents)) roots.push('src/components');
      if (existsSync(srcLib)) roots.push('src/lib');
    } else {
      // Without src/, scan components/ and lib/ at root if they exist
      const components = join(projectDir, 'components');
      const lib = join(projectDir, 'lib');
      if (existsSync(components)) roots.push('components');
      if (existsSync(lib)) roots.push('lib');
    }
  }
  
  // React/Vite/CRA: typically src/
  else if (projectType === 'react' || projectType === 'vite') {
    const srcDir = join(projectDir, 'src');
    if (existsSync(srcDir)) {
      roots.push('src');
    }
  }
  
  // Static sites: ONLY public/ directory (NO root fallback)
  else if (projectType === 'static') {
    const publicDir = join(projectDir, 'public');
    if (existsSync(publicDir)) {
      roots.push('public');
    }
    // If no public/ dir exists, this is an error, not a silent case
  }
  
  // Generic/unknown: Try to find src/ or common app folders
  else {
    const srcDir = join(projectDir, 'src');
    const appDir = join(projectDir, 'app');
    const serverDir = join(projectDir, 'server');
    
    if (existsSync(srcDir)) {
      roots.push('src');
    } else if (existsSync(appDir)) {
      roots.push('app');
    } else if (existsSync(serverDir)) {
      roots.push('server');
    }
  }
  
  // If no roots detected, fail explicitly (do NOT fallback to project root)
  if (roots.length === 0) {
    return { roots: [], excludes: HARD_EXCLUSIONS };
  }
  
  return {
    roots,
    excludes: HARD_EXCLUSIONS
  };
}

/**
 * Resolve scan configuration with optional user overrides
 * 
 * @param {string} projectDir - Absolute path to project root
 * @param {string} projectType - Detected project type
 * @param {Object} options - Override options
 * @param {string[]} [options.learnPaths] - User-specified paths to scan
 * @param {boolean} [options.allowEmptyLearn] - Allow learning to proceed with zero roots
 * @param {string} [options.projectSubdir] - Project subdirectory for monorepo support
 * @returns {{ roots: string[], excludes: string[], cwd: string }}
 * @throws {Error} If no scan roots can be determined and allowEmptyLearn is false
 */
export function resolveScanConfig(projectDir, projectType, options = {}) {
  const { learnPaths, allowEmptyLearn = false, projectSubdir } = options;
  const baseDir = resolveProjectBase(projectDir, projectSubdir);
  
  // If user provided explicit paths
  if (learnPaths && learnPaths.length > 0) {
    return {
      roots: learnPaths,
      excludes: HARD_EXCLUSIONS,
      cwd: baseDir
    };
  }
  
  // Default: auto-detect
  const detected = detectScanRoots(baseDir, projectType);
  
  // HARD RULE: NO SILENT EMPTY LEARN
  if (detected.roots.length === 0 && !allowEmptyLearn) {
    throw new Error(
      `VERAX could not determine any source directories to learn from in: ${baseDir}\n` +
      `Project type: ${projectType}\n` +
      `No src/, app/, server/, or public/ directories found.\n` +
      `Pass --learn-paths <paths> to explicitly define scan roots, or use --allow-empty-learn to skip learning.`
    );
  }
  
  return {
    ...detected,
    cwd: baseDir
  };
}

/**
 * Convert scan roots to glob patterns
 * 
 * @param {string[]} roots - Root directories to scan
 * @param {string} filePattern - File pattern (e.g., "*.{js,jsx,ts,tsx}")
 * @returns {string[]} - Array of glob patterns
 */
export function rootsToGlobPatterns(roots, filePattern) {
  if (roots.length === 0) {
    return [];
  }
  
  return roots.map(root => {
    // Normalize root path (remove trailing slash)
    const normalizedRoot = root.replace(/\/$/, '');
    return `${normalizedRoot}/**/${filePattern}`;
  });
}
