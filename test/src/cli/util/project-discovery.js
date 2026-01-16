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
  // @ts-expect-error - readFileSync with encoding returns string
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
 * Synchronous project profile resolver used by zero-config helpers
 */
export function getProjectProfile(projectPath) {
  const projectRoot = resolve(projectPath);
  const packageJsonPath = findPackageJson(projectRoot);
  const projectDir = packageJsonPath ? dirname(packageJsonPath) : projectRoot;

  let packageJson = null;
  if (packageJsonPath && existsSync(packageJsonPath)) {
    try {
  // @ts-expect-error - readFileSync with encoding returns string
      packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    } catch {
      packageJson = null;
    }
  }

  const framework = detectFramework(projectDir, packageJson);
  const router = detectRouter(framework, projectDir);
  const packageManager = detectPackageManager(projectDir);
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

/**
 * Detect if running in CI environment (H5: Zero-Config)
 */
export function isCI() {
  return !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.TRAVIS ||
    process.env.BUILDKITE
  );
}

/**
 * Check if a port is accessible via HTTP (H5: Zero-Config)
 */
export async function isPortAccessible(port, host = 'localhost', timeout = 3000) {
  return new Promise(resolve => {
    const _startTime = Date.now();
    const timeoutId = setTimeout(() => {
      resolve(false);
    }, timeout);

    try {
      const http = require('http');
      const req = http.get(
        {
          hostname: host,
          port,
          path: '/',
          timeout: 1000,
        },
        () => {
          clearTimeout(timeoutId);
          resolve(true);
        }
      );

      req.on('error', () => {
        clearTimeout(timeoutId);
        resolve(false);
      });

      req.on('timeout', () => {
        clearTimeout(timeoutId);
        req.destroy();
        resolve(false);
      });
    } catch (e) {
      clearTimeout(timeoutId);
      resolve(false);
    }
  });
}

/**
 * Infer URL from existing framework detection (H5: Zero-Config)
 */
export async function inferURL(projectPath, profile, preferredPort = null) {
  const result = {
    url: null,
    port: preferredPort || 3000,
    discovered: false,
  };

  // Extract port from scripts if available
  const profile2 = profile || getProjectProfile(projectPath);
  if (profile2?.scripts?.dev && !preferredPort) {
    const portFromScript = extractPortFromScript(profile2.scripts.dev);
    if (portFromScript) {
      result.port = portFromScript;
    }
  }

  // Try preferred port
  if (await isPortAccessible(result.port, 'localhost', 1000)) {
    result.url = `http://localhost:${result.port}`;
    result.discovered = true;
    return result;
  }

  // Try common ports
  const commonPorts = [3000, 5173, 4200, 8080, 8000];
  for (const port of commonPorts) {
    if (await isPortAccessible(port, 'localhost', 1000)) {
      result.url = `http://localhost:${port}`;
      result.port = port;
      result.discovered = true;
      return result;
    }
  }

  // No port found
  return result;
}

/**
 * Full zero-config setup (H5: Zero-Config)
 * Returns: { url, discovery }
 */
export async function setupZeroConfig(projectPath, providedURL = null) {
  const discovery = {
    method: null,
    framework: null,
    serverAutoStarted: false,
    details: {},
  };

  // If URL provided, use it immediately
  if (providedURL) {
    discovery.method = 'provided';
    return {
      url: providedURL,
      discovery,
    };
  }

  // Detect framework
  const profile = getProjectProfile(projectPath);
  discovery.framework = profile?.framework || 'unknown';

  // Try to infer URL from existing ports
  const inference = await inferURL(projectPath, profile);

  if (inference.discovered) {
    discovery.method = 'inferred';
    discovery.details = {
      port: inference.port,
      framework: profile?.framework,
    };
    return {
      url: inference.url,
      discovery,
    };
  }

  // Server not running and auto-start is disabled in CI
  if (isCI()) {
    throw new Error(
      `No running server detected on port ${inference.port}. ` +
        'In CI environment, use --url to specify server URL.'
    );
  }

  // H5: Auto-start dev server (max 30s startup)
  try {
    const started = await autoStartDevServer(projectPath, profile, inference.port);
    if (started.success) {
      discovery.method = 'auto-started';
      discovery.serverAutoStarted = true;
      discovery.details = {
        port: started.port,
        framework: profile?.framework,
        startupTime: started.startupTime,
      };
      return {
        url: `http://localhost:${started.port}`,
        discovery,
      };
    }
  } catch (e) {
    // Fall through to error
  }

  // Could not start server
  throw new Error(
    `No running server detected on port ${inference.port}. ` +
      'Start your dev server or use --url to specify the server URL.'
  );
}

/**
 * H5: Auto-start development server
 * Supports: Next.js, Vite, CRA, Vue, Svelte, Angular
 * Max 30 second startup with automatic port detection
 */
export async function autoStartDevServer(projectPath, profile = null, preferredPort = 3000) {
  const prof = profile || getProjectProfile(projectPath);
  
  if (!prof?.scripts?.dev) {
    return { success: false, reason: 'no-dev-script' };
  }

  // Extract port from dev script
  const port = extractPortFromScript(prof.scripts.dev) || preferredPort;

  // Check if port is already accessible (server already running)
  if (await isPortAccessible(port, 'localhost', 1000)) {
    return { success: true, port, startupTime: 0 };
  }

  // Import required modules for spawning process
  const { spawn } = await import('child_process');
  const startTime = Date.now();
  const MAX_STARTUP_TIME = 30 * 1000; // 30 seconds

  return new Promise((resolve) => {
    let resolved = false;

    const process = spawn('npm', ['run', 'dev'], {
      cwd: projectPath,
      stdio: 'ignore',
      detached: true,
    });

    // Detach the process so it doesn't keep this process alive
    process.unref();

    // Poll for port accessibility
    const pollInterval = setInterval(async () => {
      const elapsed = Date.now() - startTime;

      if (elapsed > MAX_STARTUP_TIME) {
        clearInterval(pollInterval);
        if (!resolved) {
          resolved = true;
          resolve({ success: false, reason: 'startup-timeout', elapsed });
        }
        return;
      }

      if (await isPortAccessible(port, 'localhost', 1000)) {
        clearInterval(pollInterval);
        if (!resolved) {
          resolved = true;
          const startupTime = Date.now() - startTime;
          resolve({ success: true, port, startupTime });
        }
      }
    }, 500); // Check every 500ms

    // Timeout safety
    setTimeout(() => {
      clearInterval(pollInterval);
      if (!resolved) {
        resolved = true;
        resolve({ success: false, reason: 'startup-timeout', elapsed: MAX_STARTUP_TIME });
      }
    }, MAX_STARTUP_TIME + 1000);
  });
}

