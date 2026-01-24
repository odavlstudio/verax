/**
 * PHASE H6 - Framework Detection Module
 * 
 * Robustly identifies framework type with confidence scoring.
 * Returns deterministic output including evidence trail for auditing.
 * 
 * Supported frameworks (in priority order):
 * 1. Next.js
 * 2. Vue + Vite
 * 3. Vue CLI (legacy)
 * 4. Svelte + SvelteKit
 * 5. Angular
 * 6. Remix
 * 7. React + Vite
 * 8. Create React App
 * 9. Vite (generic)
 * 10. Generic/Static
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

/**
 * Detection result structure
 */
export function createDetectionResult() {
  return {
    framework: 'unknown',
    confidence: 0, // 0-100
    evidence: [],
    devCommand: null,
    defaultPortCandidates: [3000, 5173, 4200, 8080],
    appRootCandidates: [],
  };
}

/**
 * Load and parse package.json safely
 */
function loadPackageJson(projectRoot) {
  try {
    const pkgPath = resolve(projectRoot, 'package.json');
    if (!existsSync(pkgPath)) return null;
    const content = readFileSync(pkgPath, 'utf8');
  // @ts-expect-error - readFileSync with encoding returns string
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Check for file existence (deterministic ordering)
 */
function filesExist(projectRoot, patterns) {
  const found = [];
  for (const pattern of patterns) {
    const path = resolve(projectRoot, pattern);
    if (existsSync(path)) {
      found.push(pattern);
    }
  }
  return found;
}

/**
 * List directories at path (sorted deterministically)
 */
function listDirs(projectRoot) {
  try {
    const dirs = readdirSync(projectRoot).sort((a, b) => a.localeCompare(b, 'en'));
    return dirs
      .filter(name => {
        try {
          const stat = require('fs').statSync(resolve(projectRoot, name));
          return stat.isDirectory();
        } catch {
          return false;
        }
      })
      .sort((a, b) => a.localeCompare(b, 'en'));
  } catch {
    return [];
  }
}

/**
 * Detect Next.js
 */
function detectNextJs(projectRoot, pkg) {
  const result = createDetectionResult();
  let score = 0;

  // Check dependencies
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  if (deps.next) {
    score += 40;
    result.evidence.push('next dependency found in package.json');
  }
  if (deps['react'] && deps.next) {
    score += 10;
    result.evidence.push('react + next detected');
  }

  // Check next.config.js/mjs
  const configFiles = filesExist(projectRoot, ['next.config.js', 'next.config.mjs']);
  if (configFiles.length > 0) {
    score += 30;
    result.evidence.push(`next config file found: ${configFiles.join(', ')}`);
  }

  // Check .next directory (build artifact)
  if (existsSync(resolve(projectRoot, '.next'))) {
    score += 5;
    result.evidence.push('.next build directory found');
  }

  // Check src/pages or app directory (Next.js structure)
  if (existsSync(resolve(projectRoot, 'src', 'pages')) ||
      existsSync(resolve(projectRoot, 'pages')) ||
      existsSync(resolve(projectRoot, 'src', 'app')) ||
      existsSync(resolve(projectRoot, 'app'))) {
    score += 10;
    result.evidence.push('Next.js pages or app directory found');
  }

  // Check dev script
  if (pkg?.scripts?.dev?.includes('next')) {
    score += 5;
    result.evidence.push('next command in dev script');
  }

  if (score > 0) {
    result.framework = 'next';
    result.confidence = Math.min(score, 100);
    result.devCommand = pkg?.scripts?.dev || 'next dev';
    result.defaultPortCandidates = [3000];
  }

  return result;
}

/**
 * Detect Vue (Vite or CLI)
 */
function detectVue(projectRoot, pkg) {
  const result = createDetectionResult();
  let score = 0;
  let isVite = false;

  // Check dependencies
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  if (deps.vue) {
    score += 40;
    result.evidence.push('vue dependency found');
  }

  // Check for Vite
  if (deps.vite) {
    score += 20;
    result.evidence.push('vite found (Vue + Vite setup)');
    isVite = true;
  }

  // Check vite.config.js/ts
  const viteConfigs = filesExist(projectRoot, ['vite.config.js', 'vite.config.ts', 'vite.config.mjs']);
  if (viteConfigs.length > 0) {
    score += 15;
    result.evidence.push(`vite config found: ${viteConfigs.join(', ')}`);
    isVite = true;
  }

  // Check vue.config.js (Vue CLI)
  if (existsSync(resolve(projectRoot, 'vue.config.js'))) {
    score += 15;
    result.evidence.push('vue.config.js found (Vue CLI)');
  }

  // Check src/App.vue or src/components directory
  if (existsSync(resolve(projectRoot, 'src', 'App.vue')) ||
      existsSync(resolve(projectRoot, 'src', 'components'))) {
    score += 10;
    result.evidence.push('Vue component structure found');
  }

  // Check dev script
  if (pkg?.scripts?.dev?.includes('vue') || pkg?.scripts?.dev?.includes('vite')) {
    score += 5;
    result.evidence.push('vue or vite in dev script');
  }

  if (score > 0) {
    result.framework = 'vue';
    result.confidence = Math.min(score, 100);
    result.devCommand = pkg?.scripts?.dev || (isVite ? 'vite' : 'vue-cli-service serve');
    result.defaultPortCandidates = isVite ? [5173] : [8080];
  }

  return result;
}

/**
 * Detect Svelte (SvelteKit)
 */
function detectSvelte(projectRoot, pkg) {
  const result = createDetectionResult();
  let score = 0;

  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  
  // Check for SvelteKit
  if (deps['@sveltejs/kit']) {
    score += 50;
    result.evidence.push('@sveltejs/kit found (SvelteKit)');
  } else if (deps.svelte) {
    score += 30;
    result.evidence.push('svelte dependency found');
  }

  // Check svelte.config.js
  if (existsSync(resolve(projectRoot, 'svelte.config.js'))) {
    score += 20;
    result.evidence.push('svelte.config.js found');
  }

  // Check src directory structure
  if (existsSync(resolve(projectRoot, 'src', 'routes'))) {
    score += 15;
    result.evidence.push('SvelteKit routes structure found');
  }

  // Check dev script
  if (pkg?.scripts?.dev?.includes('svelte') || pkg?.scripts?.dev?.includes('vite')) {
    score += 5;
    result.evidence.push('svelte or vite in dev script');
  }

  if (score > 0) {
    result.framework = 'svelte';
    result.confidence = Math.min(score, 100);
    result.devCommand = pkg?.scripts?.dev || 'vite dev';
    result.defaultPortCandidates = [5173];
  }

  return result;
}

/**
 * Detect Angular
 */
function detectAngular(projectRoot, pkg) {
  const result = createDetectionResult();
  let score = 0;

  // Check angular.json (strongest signal)
  if (existsSync(resolve(projectRoot, 'angular.json'))) {
    score += 50;
    result.evidence.push('angular.json found');
  }

  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  if (deps['@angular/core']) {
    score += 40;
    result.evidence.push('@angular/core dependency found');
  }

  // Check CLI
  if (deps['@angular/cli']) {
    score += 10;
    result.evidence.push('@angular/cli found');
  }

  // Check src/main.ts (Angular entry point)
  if (existsSync(resolve(projectRoot, 'src', 'main.ts'))) {
    score += 10;
    result.evidence.push('Angular src/main.ts found');
  }

  if (pkg?.scripts?.serve?.includes('ng serve')) {
    score += 5;
    result.evidence.push('ng serve in scripts');
  }

  if (score > 0) {
    result.framework = 'angular';
    result.confidence = Math.min(score, 100);
    result.devCommand = pkg?.scripts?.serve || 'ng serve';
    result.defaultPortCandidates = [4200];
  }

  return result;
}

/**
 * Detect Remix (or remix-like Node.js framework)
 */
function detectRemix(projectRoot, pkg) {
  const result = createDetectionResult();
  let score = 0;

  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  if (deps['@remix-run/react'] || deps['remix']) {
    score += 50;
    result.evidence.push('@remix-run/react or remix dependency found');
  }

  // Check remix config
  if (existsSync(resolve(projectRoot, 'remix.config.js'))) {
    score += 30;
    result.evidence.push('remix.config.js found');
  }

  // Check app directory (Remix routing)
  if (existsSync(resolve(projectRoot, 'app'))) {
    score += 10;
    result.evidence.push('app directory found (Remix structure)');
  }

  // Check for Express or Node.js server.js (remix-like framework)
  if (existsSync(resolve(projectRoot, 'server.js')) && (deps['express'])) {
    score += 45;
    result.evidence.push('Express server.js found (remix-like Node.js framework)');
  }

  if (score > 0) {
    result.framework = 'remix';
    result.confidence = Math.min(score, 100);
    result.devCommand = pkg?.scripts?.dev || 'remix dev';
    result.defaultPortCandidates = [3000, 5173];
  }

  return result;
}

/**
 * Detect React (Vite or CRA)
 */
function detectReact(projectRoot, pkg) {
  const result = createDetectionResult();
  let score = 0;

  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  if (deps['react']) {
    score += 40;
    result.evidence.push('react dependency found');
  }

  if (deps['react-dom']) {
    score += 10;
    result.evidence.push('react-dom found');
  }

  // Check for CRA (react-scripts)
  if (deps['react-scripts']) {
    score += 30;
    result.evidence.push('react-scripts found (Create React App)');
    result.devCommand = pkg?.scripts?.start || 'react-scripts start';
    result.defaultPortCandidates = [3000];
  }

  // Check for Vite + React
  if (deps['vite'] && deps['@vitejs/plugin-react']) {
    score += 25;
    result.evidence.push('vite + @vitejs/plugin-react found');
    result.devCommand = pkg?.scripts?.dev || 'vite';
    result.defaultPortCandidates = [5173];
  }

  // Check vite.config.js with react plugin
  const viteConfigs = filesExist(projectRoot, ['vite.config.js', 'vite.config.ts']);
  if (viteConfigs.length > 0) {
    score += 10;
    result.evidence.push(`vite config found: ${viteConfigs.join(', ')}`);
  }

  // Check src/App.jsx or src/App.tsx
  if (existsSync(resolve(projectRoot, 'src', 'App.jsx')) ||
      existsSync(resolve(projectRoot, 'src', 'App.tsx'))) {
    score += 10;
    result.evidence.push('React App component found');
  }

  if (score > 0) {
    result.framework = 'react';
    result.confidence = Math.min(score, 100);
    result.devCommand = result.devCommand || pkg?.scripts?.dev || 'vite';
  }

  return result;
}

/**
 * Detect generic Vite
 */
function detectVite(projectRoot, pkg) {
  const result = createDetectionResult();
  let score = 0;

  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  if (deps['vite']) {
    score += 40;
    result.evidence.push('vite dependency found (generic Vite project)');
  }

  const viteConfigs = filesExist(projectRoot, ['vite.config.js', 'vite.config.ts', 'vite.config.mjs']);
  if (viteConfigs.length > 0) {
    score += 30;
    result.evidence.push(`vite config: ${viteConfigs.join(', ')}`);
  }

  if (pkg?.scripts?.dev?.includes('vite')) {
    score += 10;
    result.evidence.push('vite in dev script');
  }

  if (score > 0) {
    result.framework = 'vite';
    result.confidence = Math.min(score, 100);
    result.devCommand = pkg?.scripts?.dev || 'vite';
    result.defaultPortCandidates = [5173];
  }

  return result;
}

/**
 * Detect generic static/HTML project
 */
function detectStatic(projectRoot, pkg) {
  const result = createDetectionResult();
  let score = 0;

  // Check for index.html
  if (existsSync(resolve(projectRoot, 'index.html'))) {
    score += 30;
    result.evidence.push('index.html found (static site)');
  }

  // Check for dist (built static)
  if (existsSync(resolve(projectRoot, 'dist'))) {
    score += 10;
    result.evidence.push('dist directory found');
  }

  // No framework detected but has HTML
  if (score > 0 && (!pkg || Object.keys(pkg?.dependencies || {}).length === 0)) {
    result.framework = 'static';
    result.confidence = Math.min(score, 100);
    result.devCommand = pkg?.scripts?.serve || 'http-server .';
    result.defaultPortCandidates = [8000, 8080, 5000];
  }

  return result;
}

/**
 * Main framework detection function
 * 
 * Returns most confident match, ordered by detection priority
 */
export function detectFramework(projectRoot) {
  const pkg = loadPackageJson(projectRoot);

  // Priority-ordered detection (deterministic order)
  const detections = [
    detectNextJs(projectRoot, pkg),
    detectVue(projectRoot, pkg),
    detectSvelte(projectRoot, pkg),
    detectAngular(projectRoot, pkg),
    detectRemix(projectRoot, pkg),
    detectReact(projectRoot, pkg),
    detectVite(projectRoot, pkg),
    detectStatic(projectRoot, pkg),
  ];

  // Filter out results with 0 confidence
  const scored = detections.filter(d => d.confidence > 0);

  // Sort by confidence descending (deterministic tie-break by framework name)
  scored.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return a.framework.localeCompare(b.framework);
  });

  // Return highest confidence, or unknown
  if (scored.length > 0) {
    return scored[0];
  }

  const result = createDetectionResult();
  if (pkg) {
    result.evidence.push('package.json found but no framework detected');
    result.defaultPortCandidates = [3000, 5173, 8080];
  } else {
    result.evidence.push('No package.json found; assuming static site');
  }
  return result;
}

/**
 * Find app root candidates in a monorepo
 * Scans workspace for package.json + framework markers
 * Returns deterministically ordered list of candidates with evidence
 */
export function findAppRootCandidates(workspaceRoot, maxDepth = 3) {
  const candidates = [];

  function scanDir(currentPath, depth) {
    if (depth > maxDepth) return;

    const dirs = listDirs(currentPath);
    for (const dir of dirs) {
      // Skip common non-app directories
      if (['node_modules', '.git', '.next', 'dist', 'build', '.svelte-kit'].includes(dir)) {
        continue;
      }

      const appPath = resolve(currentPath, dir);
      const pkg = loadPackageJson(appPath);

      // If has package.json with scripts.dev or framework markers, it's a candidate
      if (pkg?.scripts?.dev || detectFramework(appPath).confidence > 20) {
        const detection = detectFramework(appPath);
        candidates.push({
          path: appPath,
          framework: detection.framework,
          confidence: detection.confidence,
          hasDevScript: Boolean(pkg?.scripts?.dev),
          depth,
        });
      }

      // Recurse
      scanDir(appPath, depth + 1);
    }
  }

  scanDir(workspaceRoot, 0);

  // Sort candidates deterministically:
  // 1. Highest framework confidence
  // 2. Has dev script (true > false)
  // 3. Shallowest depth
  // 4. Alphabetical path
  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (b.hasDevScript !== a.hasDevScript) return b.hasDevScript ? 1 : -1;
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.path.localeCompare(b.path);
  });

  return candidates;
}

/**
 * Export for testing
 */
export const _internal = {
  loadPackageJson,
  filesExist,
  listDirs,
  detectNextJs,
  detectVue,
  detectSvelte,
  detectAngular,
  detectRemix,
  detectReact,
  detectVite,
  detectStatic,
};



