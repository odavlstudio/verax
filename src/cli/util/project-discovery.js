import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';

/**
 * Project Discovery Module
 * Detects framework, router, source root, and dev server configuration
 * 
 * @typedef {Object} ProjectProfile
 * @property {string} framework
 * @property {string|null} router
 * @property {string} sourceRoot
 * @property {string} packageManager
 * @property {{dev: string|null, build: string|null, start: string|null}} scripts
 * @property {string} detectedAt
 * @property {string|null} packageJsonPath
 * @property {number} [fileCount] - Optional file count for budget calculation
 */

/**
 * @param {string} srcPath
 * @returns {Promise<ProjectProfile>}
 */
export async function discoverProject(srcPath) {
  const projectRoot = resolve(srcPath);
  
  // Find the nearest package.json
  const packageJsonPath = findPackageJson(projectRoot);
  
  // If there's a package.json, use its directory
  // Otherwise, use the srcPath (even if it's a static HTML project)
  const projectDir = packageJsonPath ? dirname(packageJsonPath) : projectRoot;
  
  let packageJson = null;
  if (packageJsonPath && existsSync(packageJsonPath)) {
    try {
      packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    } catch (error) {
      packageJson = null;
    }
  }
  
  // Detect framework
  const framework = detectFramework(projectDir, packageJson);
  const router = detectRouter(framework, projectDir);
  
  // Determine package manager
  const packageManager = detectPackageManager(projectDir);
  
  // Extract scripts
  const scripts = {
    dev: packageJson?.scripts?.dev || null,
    build: packageJson?.scripts?.build || null,
    start: packageJson?.scripts?.start || null,
  };
  
  return {
    framework,
    router,
    sourceRoot: projectDir,
    packageManager,
    scripts,
    detectedAt: new Date().toISOString(),
    packageJsonPath,
  };
}

/**
 * Find the nearest package.json by walking up directories
 */
function findPackageJson(startPath) {
  let currentPath = resolve(startPath);
  
  // First check if package.json exists in startPath itself
  const immediatePackage = resolve(currentPath, 'package.json');
  if (existsSync(immediatePackage)) {
    return immediatePackage;
  }
  
  // For static HTML projects, don't walk up - use the startPath as project root
  // This prevents finding parent package.json files that aren't relevant
  if (hasStaticHtml(currentPath)) {
    return null;
  }
  
  // Then walk up (limit to 5 levels for monorepos, not 10)
  for (let i = 0; i < 5; i++) {
    const parentPath = dirname(currentPath);
    if (parentPath === currentPath) {
      // Reached filesystem root
      break;
    }
    
    currentPath = parentPath;
    const packageJsonPath = resolve(currentPath, 'package.json');
    if (existsSync(packageJsonPath)) {
      return packageJsonPath;
    }
  }
  
  return null;
}

/**
 * Detect the framework type
 */
function detectFramework(projectDir, packageJson) {
  // Check for Next.js
  if (hasNextJs(projectDir, packageJson)) {
    return 'nextjs';
  }
  
  // Check for Vite + React
  if (hasViteReact(projectDir, packageJson)) {
    return 'react-vite';
  }
  
  // Check for Create React App
  if (hasCreateReactApp(packageJson)) {
    return 'react-cra';
  }
  
  // Check for static HTML
  if (hasStaticHtml(projectDir)) {
    return 'static-html';
  }
  
  // Unknown framework
  return 'unknown';
}

/**
 * Detect Next.js
 */
function hasNextJs(projectDir, packageJson) {
  // Check for next.config.js or next.config.mjs
  const hasNextConfig = existsSync(resolve(projectDir, 'next.config.js')) ||
    existsSync(resolve(projectDir, 'next.config.mjs')) ||
    existsSync(resolve(projectDir, 'next.config.ts'));
  
  if (hasNextConfig) {
    return true;
  }
  
  // Check for 'next' dependency
  if (packageJson?.dependencies?.next || packageJson?.devDependencies?.next) {
    return true;
  }
  
  return false;
}

/**
 * Detect router type for Next.js
 */
function detectRouter(framework, projectDir) {
  if (framework !== 'nextjs') {
    return null;
  }
  
  // Check for /app directory (app router) - must contain actual files
  const appPath = resolve(projectDir, 'app');
  if (existsSync(appPath) && hasRouteFiles(appPath)) {
    return 'app';
  }
  
  // Check for /pages directory (pages router)
  if (existsSync(resolve(projectDir, 'pages'))) {
    return 'pages';
  }
  
  return null;
}

/**
 * Check if a directory contains route files (not just an empty scaffold)
 */
function hasRouteFiles(dirPath) {
  try {
    const entries = readdirSync(dirPath);
    return entries.some(entry => {
      // Look for .js, .ts, .jsx, .tsx files (not just directories)
      return /\.(js|ts|jsx|tsx)$/.test(entry);
    });
  } catch (error) {
    return false;
  }
}

/**
 * Detect Vite + React
 */
function hasViteReact(projectDir, packageJson) {
  const hasViteConfig = existsSync(resolve(projectDir, 'vite.config.js')) ||
    existsSync(resolve(projectDir, 'vite.config.ts')) ||
    existsSync(resolve(projectDir, 'vite.config.mjs'));
  
  if (!hasViteConfig) {
    return false;
  }
  
  // Check for react dependency
  if (packageJson?.dependencies?.react || packageJson?.devDependencies?.react) {
    return true;
  }
  
  return false;
}

/**
 * Detect Create React App
 */
function hasCreateReactApp(packageJson) {
  return !!(packageJson?.dependencies?.['react-scripts'] || 
    packageJson?.devDependencies?.['react-scripts']);
}

/**
 * Detect static HTML (no framework)
 */
function hasStaticHtml(projectDir) {
  return existsSync(resolve(projectDir, 'index.html'));
}

/**
 * Detect package manager
 */
function detectPackageManager(projectDir) {
  // Check for pnpm-lock.yaml
  if (existsSync(resolve(projectDir, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  
  // Check for yarn.lock
  if (existsSync(resolve(projectDir, 'yarn.lock'))) {
    return 'yarn';
  }
  
  // Check for package-lock.json (npm)
  if (existsSync(resolve(projectDir, 'package-lock.json'))) {
    return 'npm';
  }
  
  // Default to npm if none found but package.json exists
  if (existsSync(resolve(projectDir, 'package.json'))) {
    return 'npm';
  }
  
  return 'unknown';
}

/**
 * Get human-readable framework name
 */
export function getFrameworkDisplayName(framework, router) {
  if (framework === 'nextjs') {
    const routerType = router === 'app' ? 'app router' : router === 'pages' ? 'pages router' : 'unknown router';
    return `Next.js (${routerType})`;
  }
  
  if (framework === 'react-vite') {
    return 'Vite + React';
  }
  
  if (framework === 'react-cra') {
    return 'Create React App';
  }
  
  if (framework === 'static-html') {
    return 'Static HTML';
  }
  
  return 'Unknown';
}

/**
 * Extract probable port from dev script
 */
export function extractPortFromScript(script) {
  if (!script) return null;
  
  // Common patterns:
  // - --port 3000
  // - -p 3000
  // - PORT=3000
  
  const portMatch = script.match(/(?:--port|-p)\s+(\d+)/);
  if (portMatch) {
    return parseInt(portMatch[1], 10);
  }
  
  const portEnvMatch = script.match(/PORT=(\d+)/);
  if (portEnvMatch) {
    return parseInt(portEnvMatch[1], 10);
  }
  
  return null;
}
