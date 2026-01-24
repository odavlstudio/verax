/**
 * PHASE 21.8 — Supply-Chain Policy
 * 
 * Enforces supply-chain security policies:
 * - License allowlist/denylist
 * - Integrity hash requirements
 * - Postinstall script restrictions
 */

import { getTimeProvider } from '../../../cli/util/support/time-provider.js';

import { resolve } from 'path';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';

const DEFAULT_POLICY = JSON.parse(
  readFileSync(new URL('./supplychain.defaults.json', import.meta.url), 'utf-8')
);

/**
 * Load supply-chain policy
 * 
 * @param {string} projectDir - Project directory
 * @returns {Object} Policy object
 */
export function loadSupplyChainPolicy(projectDir) {
  const customPath = resolve(projectDir, 'supplychain.policy.json');
  
  if (existsSync(customPath)) {
    try {
  // @ts-expect-error - readFileSync with encoding returns string
      const custom = JSON.parse(readFileSync(customPath, 'utf-8'));
      // Merge with defaults (custom overrides)
      return {
        ...DEFAULT_POLICY,
        ...custom,
        licensePolicy: {
          ...DEFAULT_POLICY.licensePolicy,
          ...(custom.licensePolicy || {})
        },
        integrityPolicy: {
          ...DEFAULT_POLICY.integrityPolicy,
          ...(custom.integrityPolicy || {})
        },
        scriptPolicy: {
          ...DEFAULT_POLICY.scriptPolicy,
          ...(custom.scriptPolicy || {})
        },
        sourcePolicy: {
          ...DEFAULT_POLICY.sourcePolicy,
          ...(custom.sourcePolicy || {})
        }
      };
    } catch {
      // Invalid custom policy, use defaults
    }
  }
  
  return DEFAULT_POLICY;
}

/**
 * Get package.json dependencies
 * 
 * @param {string} projectDir - Project directory
 * @returns {Object} Dependencies
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
 * Get package license from node_modules
 * 
 * @param {string} projectDir - Project directory
 * @param {string} packageName - Package name
 * @returns {string|null} License or null
 */
function getPackageLicense(projectDir, packageName) {
  try {
    const pkgPath = resolve(projectDir, 'node_modules', packageName, 'package.json');
    if (!existsSync(pkgPath)) {
      return null;
    }
  // @ts-expect-error - readFileSync with encoding returns string
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    
    if (typeof pkg.license === 'string') {
      return pkg.license;
    } else if (pkg.license && pkg.license.type) {
      return pkg.license.type;
    } else if (Array.isArray(pkg.licenses) && pkg.licenses.length > 0) {
      return pkg.licenses[0].type || pkg.licenses[0];
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Check package-lock.json for integrity hashes
 * 
 * @param {string} projectDir - Project directory
 * @returns {Object} Integrity check results
 */
function checkIntegrityHashes(projectDir) {
  const lockPath = resolve(projectDir, 'package-lock.json');
  const missing = [];
  
  if (!existsSync(lockPath)) {
    return { missing: [], total: 0 };
  }
  
  try {
  // @ts-expect-error - readFileSync with encoding returns string
    const lock = JSON.parse(readFileSync(lockPath, 'utf-8'));
    const packages = lock.packages || {};
    let total = 0;
    
    for (const [path, pkg] of Object.entries(packages)) {
      if (path && pkg && pkg.version) {
        total++;
        if (!pkg.integrity && !pkg.resolved?.includes('file:')) {
          missing.push({
            package: pkg.name || path,
            path: path,
            version: pkg.version
          });
        }
      }
    }
    
    return { missing, total };
  } catch {
    return { missing: [], total: 0 };
  }
}

/**
 * Check for postinstall scripts
 * 
 * @param {string} projectDir - Project directory
 * @returns {Array} Packages with postinstall scripts
 */
function checkPostinstallScripts(projectDir) {
  const packages = [];
  const nodeModulesPath = resolve(projectDir, 'node_modules');
  
  if (!existsSync(nodeModulesPath)) {
    return packages;
  }
  
  try {
    const { readdirSync } = require('fs');
    const entries = readdirSync(nodeModulesPath, { withFileTypes: true })
      // @ts-ignore - Dirent has name property
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));
    
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const pkgPath = resolve(nodeModulesPath, entry.name, 'package.json');
        if (existsSync(pkgPath)) {
          try {
  // @ts-expect-error - readFileSync with encoding returns string
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
            if (pkg.scripts) {
              if (pkg.scripts.postinstall || pkg.scripts.preinstall || pkg.scripts.install) {
                packages.push({
                  name: pkg.name || entry.name,
                  version: pkg.version || 'unknown',
                  scripts: Object.keys(pkg.scripts).filter(s => 
                    ['postinstall', 'preinstall', 'install'].includes(s)
                  )
                });
              }
            }
          } catch {
            // Skip invalid packages
          }
        }
      }
    }
  } catch {
    // If scanning fails, return empty
  }
  
  return packages;
}

/**
 * Evaluate supply-chain policy
 * 
 * @param {string} projectDir - Project directory
 * @returns {Promise<Object>} Evaluation results
 */
export async function evaluateSupplyChainPolicy(projectDir) {
  const policy = loadSupplyChainPolicy(projectDir);
  const deps = getDependencies(projectDir);
  const violations = [];
  const warnings = [];
  
  // Check licenses
  const allDeps = { ...deps.dependencies, ...deps.devDependencies };
  for (const [packageName] of Object.entries(allDeps)) {
    const license = getPackageLicense(projectDir, packageName);
    
    if (license) {
      // Check denylist
      if (policy.licensePolicy.denylist.includes(license)) {
        violations.push({
          type: 'FORBIDDEN_LICENSE',
          package: packageName,
          license: license,
          severity: 'BLOCKING',
          message: `Package ${packageName} uses forbidden license: ${license}`
        });
      }
      
      // Check allowlist (if strict mode)
      if (policy.licensePolicy.strictMode && !policy.licensePolicy.allowlist.includes(license)) {
        violations.push({
          type: 'UNALLOWED_LICENSE',
          package: packageName,
          license: license,
          severity: 'BLOCKING',
          message: `Package ${packageName} uses unallowed license: ${license}`
        });
      }
    } else {
      warnings.push({
        type: 'MISSING_LICENSE',
        package: packageName,
        message: `Package ${packageName} has no license information`
      });
    }
  }
  
  // Check integrity hashes
  if (policy.integrityPolicy.requireIntegrityHash) {
    const integrityCheck = checkIntegrityHashes(projectDir);
    for (const missing of integrityCheck.missing) {
      if (!policy.integrityPolicy.allowedMissingIntegrity.includes(missing.package)) {
        violations.push({
          type: 'MISSING_INTEGRITY',
          package: missing.package,
          version: missing.version,
          severity: 'BLOCKING',
          message: `Package ${missing.package}@${missing.version} missing integrity hash`
        });
      }
    }
  }
  
  // Check postinstall scripts
  if (policy.scriptPolicy.forbidPostinstall || 
      policy.scriptPolicy.forbidPreinstall || 
      policy.scriptPolicy.forbidInstall) {
    const scripts = checkPostinstallScripts(projectDir);
    for (const pkg of scripts) {
      const forbiddenScripts = pkg.scripts.filter(s => {
        if (s === 'postinstall' && policy.scriptPolicy.forbidPostinstall) return true;
        if (s === 'preinstall' && policy.scriptPolicy.forbidPreinstall) return true;
        if (s === 'install' && policy.scriptPolicy.forbidInstall) return true;
        return false;
      });
      
      if (forbiddenScripts.length > 0 && !policy.scriptPolicy.allowlist.includes(pkg.name)) {
        violations.push({
          type: 'FORBIDDEN_SCRIPT',
          package: pkg.name,
          version: pkg.version,
          scripts: forbiddenScripts,
          severity: 'BLOCKING',
          message: `Package ${pkg.name} has forbidden scripts: ${forbiddenScripts.join(', ')}`
        });
      }
    }
  }
  
  const ok = violations.length === 0;
  
  return {
    ok,
    violations,
    warnings,
    summary: {
      totalViolations: violations.length,
      totalWarnings: warnings.length,
      byType: violations.reduce((acc, v) => {
        acc[v.type] = (acc[v.type] || 0) + 1;
        return acc;
      }, {}),
      evaluatedAt: getTimeProvider().iso()
    },
    policy: {
      version: policy.version,
      licensePolicy: {
        allowlist: policy.licensePolicy.allowlist,
        denylist: policy.licensePolicy.denylist,
        strictMode: policy.licensePolicy.strictMode
      }
    }
  };
}

/**
 * Write supply-chain report
 * 
 * @param {string} projectDir - Project directory
 * @param {Object} report - Evaluation results
 * @returns {string} Path to written file
 */
export function writeSupplyChainReport(projectDir, report) {
  const outputDir = resolve(projectDir, 'release');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = resolve(outputDir, 'security.supplychain.report.json');
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  
  return outputPath;
}




