/**
 * PHASE 21.8 — Security Check CLI Command
 * 
 * Checks security baseline: secrets, vulnerabilities, supply-chain.
 * Exit codes: 0 = SECURITY-OK, 6 = SECURITY-BLOCKED, 70 = Internal corruption
 */

import { scanSecrets, writeSecretsReport } from '../../verax/core/security/secrets.scan.js';
import { scanVulnerabilities, writeVulnReport } from '../../verax/core/security/vuln.scan.js';
import { evaluateSupplyChainPolicy, writeSupplyChainReport } from '../../verax/core/security/supplychain.policy.js';
import { writeSecurityReport } from '../../verax/core/security/security-report.js';
import { resolve } from 'path';
import { mkdirSync as _mkdirSync, existsSync } from 'fs';

/**
 * Security check command
 * 
 * @param {Object} options - Options
 * @param {boolean} [options.json] - Output as JSON
 */
export async function securityCheckCommand(options = {}) {
  const { json = false } = options;
  const projectDir = resolve(process.cwd());
  
  const status = {
    secrets: { ok: false, hasSecrets: false, blockers: [], tool: 'VERAX_SECRETS_SCANNER' },
    vulnerabilities: { ok: false, blocking: false, blockers: [], warnings: [], tool: null, availability: 'UNKNOWN' },
    supplychain: { ok: false, violations: [], blockers: [], tool: 'VERAX_SUPPLYCHAIN_POLICY' }
  };
  
  // 1. Scan for secrets
  try {
    const secretsResult = await scanSecrets(projectDir);
    writeSecretsReport(projectDir, secretsResult);
    
    status.secrets.ok = secretsResult.ok;
    status.secrets.hasSecrets = secretsResult.hasSecrets;
    
    if (secretsResult.hasSecrets) {
      const critical = secretsResult.findings.filter(f => f.severity === 'CRITICAL');
      const high = secretsResult.findings.filter(f => f.severity === 'HIGH');
      
      if (critical.length > 0) {
        status.secrets.blockers.push(`${critical.length} CRITICAL secret(s) detected`);
      }
      if (high.length > 0) {
        status.secrets.blockers.push(`${high.length} HIGH severity secret(s) detected`);
      }
      
      // Add sample findings (first 3)
      const sampleFindings = secretsResult.findings.slice(0, 3).map(f => 
        `${f.type} in ${f.file}:${f.line}`
      );
      status.secrets.blockers.push(`Sample findings: ${sampleFindings.join(', ')}`);
    }
  } catch (error) {
    status.secrets.blockers.push(`Secrets scan failed: ${error.message}`);
  }
  
  // 2. Scan vulnerabilities
  let vulnResult = null;
  try {
    vulnResult = await scanVulnerabilities(projectDir);
    writeVulnReport(projectDir, vulnResult);
    
    status.vulnerabilities.ok = !vulnResult.blocking;
    status.vulnerabilities.blocking = vulnResult.blocking;
    status.vulnerabilities.tool = vulnResult.tool || null;
    status.vulnerabilities.availability = vulnResult.availability || 'UNKNOWN';
    status.vulnerabilities.osvAvailable = vulnResult.osvAvailable || false;
    
    if (vulnResult.availability === 'NOT_AVAILABLE') {
      status.vulnerabilities.warnings.push('OSV scanner not available, using npm audit fallback');
    }
    
    if (vulnResult.blocking) {
      if (vulnResult.summary.critical > 0) {
        status.vulnerabilities.blockers.push(`${vulnResult.summary.critical} CRITICAL vulnerability/vulnerabilities`);
      }
      if (vulnResult.summary.high > 0) {
        status.vulnerabilities.blockers.push(`${vulnResult.summary.high} HIGH severity vulnerability/vulnerabilities`);
      }
    }
    
    if (vulnResult.summary.medium > 0 && !vulnResult.blocking) {
      status.vulnerabilities.warnings.push(`${vulnResult.summary.medium} MEDIUM severity vulnerability/vulnerabilities (non-blocking)`);
    }
  } catch (error) {
    status.vulnerabilities.blockers.push(`Vulnerability scan failed: ${error.message}`);
  }
  
  // 3. Check supply-chain policy
  let supplyChainResult = null;
  try {
    supplyChainResult = await evaluateSupplyChainPolicy(projectDir);
    writeSupplyChainReport(projectDir, supplyChainResult);
    
    status.supplychain.ok = supplyChainResult.ok;
    status.supplychain.violations = supplyChainResult.violations;
    
    if (!supplyChainResult.ok) {
      for (const violation of supplyChainResult.violations) {
        status.supplychain.blockers.push(violation.message);
      }
    }
  } catch (error) {
    status.supplychain.blockers.push(`Supply-chain check failed: ${error.message}`);
  }
  
  // Determine overall status
  const allOk = status.secrets.ok && status.vulnerabilities.ok && status.supplychain.ok;
  
  // Write unified security report
  let secretsReport = null;
  try {
    const secretsPath = resolve(projectDir, 'release', 'security.secrets.report.json');
    if (existsSync(secretsPath)) {
      const { readFileSync } = await import('fs');
  // @ts-expect-error - readFileSync with encoding returns string
      secretsReport = JSON.parse(readFileSync(secretsPath, 'utf-8'));
    }
  } catch {
    // Ignore
  }
  
  let vulnReportData = vulnResult;
  let supplyChainReportData = supplyChainResult;
  
  const unifiedReport = {
    securityOk: allOk,
    status,
    summary: {
      secrets: status.secrets.ok ? 'OK' : 'BLOCKED',
      vulnerabilities: status.vulnerabilities.ok ? 'OK' : (status.vulnerabilities.blocking ? 'BLOCKED' : (status.vulnerabilities.availability === 'NOT_AVAILABLE' ? 'NOT_AVAILABLE' : 'WARN')),
      supplychain: status.supplychain.ok ? 'OK' : 'BLOCKED'
    },
    secretsReport,
    vulnReport: vulnReportData,
    supplyChainReport: supplyChainReportData
  };
  
  const unifiedReportPath = writeSecurityReport(projectDir, unifiedReport);
  const hasInternalCorruption = 
    status.secrets.blockers.some(b => b.includes('corruption') || b.includes('Internal')) ||
    status.vulnerabilities.blockers.some(b => b.includes('corruption')) ||
    status.supplychain.blockers.some(b => b.includes('corruption'));
  
  // Output
  if (json) {
    console.log(JSON.stringify({
      securityOk: allOk,
      status,
      summary: {
        secrets: status.secrets.ok ? 'OK' : 'BLOCKED',
        vulnerabilities: status.vulnerabilities.ok ? 'OK' : (status.vulnerabilities.blocking ? 'BLOCKED' : (status.vulnerabilities.availability === 'NOT_AVAILABLE' ? 'NOT_AVAILABLE' : 'WARN')),
        supplychain: status.supplychain.ok ? 'OK' : 'BLOCKED'
      },
      unifiedReportPath: unifiedReportPath
    }, null, 2));
  } else {
    console.log('\n' + '='.repeat(80));
    console.log('SECURITY BASELINE CHECK');
    console.log('='.repeat(80));
    
    console.log(`\nSecrets: ${status.secrets.ok ? '✅ OK' : '❌ BLOCKED'}`);
    if (status.secrets.blockers.length > 0) {
      for (const blocker of status.secrets.blockers) {
        console.log(`  - ${blocker}`);
      }
    }
    
    console.log(`\nVulnerabilities: ${status.vulnerabilities.ok ? '✅ OK' : (status.vulnerabilities.blocking ? '❌ BLOCKED' : '⚠️  WARN')}`);
    if (status.vulnerabilities.blockers.length > 0) {
      for (const blocker of status.vulnerabilities.blockers) {
        console.log(`  - ${blocker}`);
      }
    }
    if (status.vulnerabilities.warnings.length > 0) {
      for (const warning of status.vulnerabilities.warnings) {
        console.log(`  ⚠️  ${warning}`);
      }
    }
    
    console.log(`\nSupply-chain: ${status.supplychain.ok ? '✅ OK' : '❌ BLOCKED'}`);
    if (status.supplychain.blockers.length > 0) {
      for (const blocker of status.supplychain.blockers) {
        console.log(`  - ${blocker}`);
      }
    }
    
    console.log(`\nOverall: ${allOk ? '✅ SECURITY-OK' : '❌ SECURITY-BLOCKED'}`);
    console.log(`\nSee unified report: ${unifiedReportPath}`);
    console.log('='.repeat(80) + '\n');
  }
  
  // Exit codes: 0 = SECURITY-OK, 6 = SECURITY-BLOCKED, 70 = Internal corruption
  // NOT_AVAILABLE tools exit 0 only if policy allows (strict mode would exit 2)
  const hasNotAvailable = status.vulnerabilities.availability === 'NOT_AVAILABLE';
  const strictMode = process.env.VERAX_SECURITY_STRICT === '1';
  
  if (allOk) {
    process.exit(0);
  } else if (hasNotAvailable && !strictMode) {
    // NOT_AVAILABLE is not a blocker unless strict mode
    process.exit(0);
  } else if (hasInternalCorruption) {
    process.exit(70);
  } else {
    process.exit(6);
  }
}

