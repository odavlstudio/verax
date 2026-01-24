/**
 * PHASE 21.8 — Vulnerability Scanner
 * 
 * Scans dependencies for vulnerabilities using npm audit.
 * HIGH/CRITICAL = BLOCKING, MEDIUM = WARNING (configurable).
 */

import { getTimeProvider } from '../../../cli/util/support/time-provider.js';

import { resolve } from 'path';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

/**
 * Check if OSV scanner is available
 * 
 * SAFETY: execSync with hardcoded command (no user input interpolation).
 * Explicit timeout prevents hangs. stdio pipes prevent output spill.
 * 
 * @returns {boolean} Whether osv-scanner is available
 */
function checkOSVAvailable() {
  try {
    execSync('osv-scanner --version', {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5000
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run npm audit
 * 
 * SAFETY: execSync with hardcoded command (no user input interpolation).
 * Timeout prevents hangs on large dependency trees.
 * 
 * @param {string} projectDir - Project directory
 * @returns {Object|null} Audit results or null
 */
function runNpmAudit(projectDir) {
  try {
    const result = execSync('npm audit --json', {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    return JSON.parse(result);
  } catch (error) {
    // npm audit exits with non-zero on vulnerabilities
    try {
      const stderr = error.stderr?.toString() || '';
      const stdout = error.stdout?.toString() || '';
      const output = stdout || stderr;
      
      if (output) {
        return JSON.parse(output);
      }
    } catch {
      // Failed to parse
    }
    
    return null;
  }
}

/**
 * Parse vulnerabilities from audit results
 * 
 * @param {Object} auditResults - npm audit JSON output
 * @returns {Array} Array of vulnerabilities
 */
function parseVulnerabilities(auditResults) {
  const vulnerabilities = [];
  
  if (!auditResults || !auditResults.vulnerabilities) {
    return vulnerabilities;
  }
  
  for (const [packageName, vulnData] of Object.entries(auditResults.vulnerabilities)) {
    if (Array.isArray(vulnData)) {
      for (const vuln of vulnData) {
        vulnerabilities.push({
          package: packageName,
          severity: vuln.severity?.toUpperCase() || 'UNKNOWN',
          title: vuln.title || vuln.name || 'Unknown vulnerability',
          url: vuln.url || null,
          dependencyOf: vuln.dependencyOf || null,
          via: vuln.via || null
        });
      }
    } else if (vulnData.vulnerabilities) {
      for (const vuln of vulnData.vulnerabilities) {
        vulnerabilities.push({
          package: packageName,
          severity: vuln.severity?.toUpperCase() || 'UNKNOWN',
          title: vuln.title || vuln.name || 'Unknown vulnerability',
          url: vuln.url || null,
          dependencyOf: vulnData.dependencyOf || null,
          via: vuln.via || null
        });
      }
    }
  }
  
  return vulnerabilities;
}

/**
 * Scan for vulnerabilities
 * 
 * @param {string} projectDir - Project directory
 * @param {Object} options - Options
 * @param {boolean} options.blockMedium - Block MEDIUM severity (default: false)
 * @param {boolean} options.requireOSV - Require OSV scanner (default: false)
 * @returns {Promise<Object>} Scan results
 */
export async function scanVulnerabilities(projectDir, options = { blockMedium: false, requireOSV: false }) {
  const { blockMedium = false, requireOSV = false } = options;
  
  // Check OSV availability
  const osvAvailable = checkOSVAvailable();
  let osvResults = null;
  
  if (osvAvailable) {
    try {
      // Run OSV scanner
      const osvOutput = execSync('osv-scanner --format=json .', {
        cwd: projectDir,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60000
      });
      try {
        osvResults = JSON.parse(osvOutput);
      } catch {
        // OSV scanner may output non-JSON on errors
      }
    } catch {
      // OSV scanner failed, fall back to npm audit
    }
  }
  
  // Always try npm audit as fallback
  const auditResults = runNpmAudit(projectDir);
  
  if (!auditResults && !osvResults) {
    if (requireOSV && !osvAvailable) {
      return {
        ok: false,
        error: 'OSV scanner not available',
        availability: 'NOT_AVAILABLE',
        tool: null,
        vulnerabilities: [],
        summary: {
          total: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          scannedAt: getTimeProvider().iso()
        }
      };
    }
    
    return {
      ok: false,
      error: 'Failed to run npm audit',
      availability: 'FAILED',
      tool: 'NPM_AUDIT',
      vulnerabilities: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        scannedAt: getTimeProvider().iso()
      }
    };
  }
  
  // Parse vulnerabilities from npm audit (primary source)
  let vulnerabilities = [];
  if (auditResults) {
    vulnerabilities = parseVulnerabilities(auditResults);
  }
  
  // Merge OSV results if available
  if (osvResults && osvResults.results) {
    for (const result of osvResults.results) {
      if (result.packages && Array.isArray(result.packages)) {
        for (const pkg of result.packages) {
          if (result.vulnerabilities && Array.isArray(result.vulnerabilities)) {
            for (const vuln of result.vulnerabilities) {
              // Avoid duplicates (merge by package + ID)
              const existing = vulnerabilities.find(v => 
                v.package === pkg.package?.name && 
                v.osvId === vuln.id
              );
              if (!existing) {
                vulnerabilities.push({
                  package: pkg.package?.name || 'unknown',
                  severity: vuln.severity?.toUpperCase() || 'UNKNOWN',
                  title: vuln.summary || vuln.id || 'Unknown vulnerability',
                  url: vuln.database_specific?.url || vuln.id ? `https://osv.dev/vulnerability/${vuln.id}` : null,
                  osvId: vuln.id,
                  source: 'OSV'
                });
              }
            }
          }
        }
      }
    }
  }
  
  const critical = vulnerabilities.filter(v => v.severity === 'CRITICAL');
  const high = vulnerabilities.filter(v => v.severity === 'HIGH');
  const medium = vulnerabilities.filter(v => v.severity === 'MEDIUM');
  const low = vulnerabilities.filter(v => v.severity === 'LOW');
  
  // BLOCKING: CRITICAL or HIGH
  // WARNING: MEDIUM (blocking if blockMedium=true)
  const blocking = critical.length > 0 || high.length > 0 || (blockMedium && medium.length > 0);
  
  return {
    ok: !blocking,
    blocking,
    availability: osvAvailable ? 'AVAILABLE' : 'NOT_AVAILABLE',
    tool: osvAvailable ? 'OSV_SCANNER' : (auditResults ? 'NPM_AUDIT' : null),
    osvAvailable,
    vulnerabilities,
    summary: {
      total: vulnerabilities.length,
      critical: critical.length,
      high: high.length,
      medium: medium.length,
      low: low.length,
      blocking,
      warnings: blockMedium ? 0 : medium.length,
      scannedAt: getTimeProvider().iso()
    },
    metadata: {
      auditVersion: auditResults?.auditReportVersion || null,
      npmVersion: auditResults?.npmVersion || null,
      osvVersion: osvAvailable ? 'detected' : null
    }
  };
}

/**
 * Write vulnerability report
 * 
 * @param {string} projectDir - Project directory
 * @param {Object} report - Scan results
 * @returns {string} Path to written file
 */
export function writeVulnReport(projectDir, report) {
  const outputDir = resolve(projectDir, 'release');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = resolve(outputDir, 'security.vuln.report.json');
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  
  return outputPath;
}




