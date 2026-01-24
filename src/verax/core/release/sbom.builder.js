/**
 * PHASE 21.7 — SBOM Builder
 * 
 * Generates Software Bill of Materials (SBOM) in CycloneDX format.
 * Missing SBOM = BLOCKING.
 */

import { getTimeProvider } from '../../../cli/util/support/time-provider.js';

import { resolve } from 'path';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { VERSION } from '../../../version.js';

/**
 * Get package.json dependencies
 * 
 * @param {string} projectDir - Project directory
 * @returns {Object} Dependencies object
 */
function getDependencies(projectDir) {
  try {
    const pkgPath = resolve(projectDir, 'package.json');
    if (!existsSync(pkgPath)) {
      return { dependencies: {}, devDependencies: {} };
    }
  // @ts-expect-error - readFileSync with encoding returns string
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return {
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {}
    };
  } catch {
    return { dependencies: {}, devDependencies: {} };
  }
}

/**
 * Helper to traverse dependency tree recursively
 */
function traverseDepsHelper(deps, packages, parent = null) {
  if (!deps || typeof deps !== 'object') {
    return;
  }
  
  for (const [name, info] of Object.entries(deps)) {
    if (info && typeof info === 'object' && info.version) {
      packages.push({
        name,
        version: info.version,
        parent: parent || null
      });
      
      if (info.dependencies) {
        traverseDepsHelper(info.dependencies, packages, name);
      }
    }
  }
}

/**
 * Get transitive dependencies from node_modules
 * 
 * SAFETY: execSync with hardcoded command (no user input interpolation).
 * Timeout prevents hangs on large dependency trees.
 * 
 * @param {string} projectDir - Project directory
 * @returns {Array} Array of package info
 */
function getTransitiveDependencies(projectDir) {
  const packages = [];
  const nodeModulesPath = resolve(projectDir, 'node_modules');
  
  if (!existsSync(nodeModulesPath)) {
    return packages;
  }
  
  try {
    // Use npm ls to get dependency tree (with timeout to prevent hanging)
    const result = execSync('npm ls --all --json', {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000 // 5 second timeout
    });
    
    const tree = JSON.parse(result);
    
    if (tree.dependencies) {
      traverseDepsHelper(tree.dependencies, packages);
    }
  } catch {
    // Fallback: scan node_modules directory
    try {
      const entries = readdirSync(nodeModulesPath, { withFileTypes: true })
        // @ts-ignore - Dirent has name property
        .sort((a, b) => a.name.localeCompare(b.name));
      
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const pkgPath = resolve(nodeModulesPath, entry.name, 'package.json');
          if (existsSync(pkgPath)) {
            try {
  // @ts-expect-error - readFileSync with encoding returns string
              const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
              packages.push({
                name: pkg.name || entry.name,
                version: VERSION || 'unknown',
                parent: null
              });
            } catch {
              // Skip invalid packages
            }
          }
        }
      }
    } catch {
      // If scanning fails, return empty
    }
  }
  
  return packages;
}

/**
 * Get license from package.json
 * 
 * @param {string} packagePath - Path to package.json
 * @returns {string|null} License or null
 */
function getPackageLicense(packagePath) {
  try {
    if (!existsSync(packagePath)) {
      return null;
    }
  // @ts-expect-error - readFileSync with encoding returns string
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
    if (typeof pkg.license === 'string') {
      return pkg.license;
    } else if (pkg.license && pkg.license.type) {
      return pkg.license.type;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Compute integrity hash for a package
 * 
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 * @returns {string|null} SHA256 hash or null
 */
function getPackageIntegrity(projectDir, packageName) {
  try {
    const packagePath = resolve(projectDir, 'node_modules', packageName);
    if (!existsSync(packagePath)) {
      return null;
    }
    
    // Hash the package.json as a proxy for package integrity
    const pkgPath = resolve(packagePath, 'package.json');
    if (existsSync(pkgPath)) {
      const content = readFileSync(pkgPath);
      // @ts-expect-error - digest returns string
      return createHash('sha256').update(content).digest('hex');
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Build SBOM in CycloneDX format
 * 
 * @param {string} projectDir - Project directory
 * @returns {Promise<Object>} SBOM object
 */
export async function buildSBOM(projectDir) {
  const pkgPath = resolve(projectDir, 'package.json');
  if (!existsSync(pkgPath)) {
    throw new Error('Cannot build SBOM: package.json not found');
  }
  
  // @ts-expect-error - readFileSync with encoding returns string
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const deps = getDependencies(projectDir);
  const transitive = getTransitiveDependencies(projectDir);
  
  // Build components list
  const components = [];
  
  // Add main package
  components.push({
    type: 'application',
    name: pkg.name || 'unknown',
    version: VERSION || 'unknown',
    purl: `pkg:npm/${pkg.name}@${VERSION}`,
    licenses: pkg.license ? [{ license: { id: pkg.license } }] : []
  });
  
  // Add direct dependencies
  for (const [name, version] of Object.entries(deps.dependencies)) {
    const integrity = getPackageIntegrity(projectDir, name);
    const license = getPackageLicense(resolve(projectDir, 'node_modules', name, 'package.json'));
    
    components.push({
      type: 'library',
      name,
      version: version.replace(/^[\^~]/, ''),
      purl: `pkg:npm/${name}@${version.replace(/^[\^~]/, '')}`,
      hashes: integrity ? [{ alg: 'SHA-256', content: integrity }] : [],
      licenses: license ? [{ license: { id: license } }] : []
    });
  }
  
  // Add dev dependencies (marked as development)
  for (const [name, version] of Object.entries(deps.devDependencies)) {
    const integrity = getPackageIntegrity(projectDir, name);
    const license = getPackageLicense(resolve(projectDir, 'node_modules', name, 'package.json'));
    
    components.push({
      type: 'library',
      name,
      version: version.replace(/^[\^~]/, ''),
      purl: `pkg:npm/${name}@${version.replace(/^[\^~]/, '')}`,
      hashes: integrity ? [{ alg: 'SHA-256', content: integrity }] : [],
      licenses: license ? [{ license: { id: license } }] : [],
      scope: 'development'
    });
  }
  
  // Add transitive dependencies (simplified - in production, use proper dependency resolution)
  const transitiveMap = new Map();
  for (const trans of transitive) {
    const key = `${trans.name}@${trans.version}`;
    if (!transitiveMap.has(key)) {
      transitiveMap.set(key, trans);
      
      const integrity = getPackageIntegrity(projectDir, trans.name);
      const license = getPackageLicense(resolve(projectDir, 'node_modules', trans.name, 'package.json'));
      
      components.push({
        type: 'library',
        name: trans.name,
        version: trans.version,
        purl: `pkg:npm/${trans.name}@${trans.version}`,
        hashes: integrity ? [{ alg: 'SHA-256', content: integrity }] : [],
        licenses: license ? [{ license: { id: license } }] : []
      });
    }
  }
  
  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.4',
    version: 1,
    metadata: {
      timestamp: getTimeProvider().iso(),
      tools: [{
        vendor: 'VERAX',
        name: 'SBOM Builder',
        version: '1.0.0'
      }],
      component: {
        type: 'application',
        name: pkg.name || 'unknown',
        version: VERSION || 'unknown'
      }
    },
    components: components
  };
  
  return sbom;
}

/**
 * Write SBOM to file
 * 
 * @param {string} projectDir - Project directory
 * @param {Object} sbom - SBOM object
 * @returns {string} Path to written file
 */
export function writeSBOM(projectDir, sbom) {
  const outputDir = resolve(projectDir, 'release');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = resolve(outputDir, 'sbom.json');
  writeFileSync(outputPath, JSON.stringify(sbom, null, 2), 'utf-8');
  
  return outputPath;
}




