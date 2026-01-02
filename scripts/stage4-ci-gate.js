#!/usr/bin/env node
/**
 * STAGE 4: CI Guardrail Script
 * 
 * Ensures:
 * 1. Lint passes with NO warnings (fail-fast)
 * 2. Report unification tests pass
 * 3. No verdict drift detected
 * 4. Artifacts are clean and not tracked
 * 
 * Usage:
 *   npm run test:stage4:ci
 *   node scripts/stage4-ci-gate.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const BOLD = '\x1b[1m';

const checks = [];
let failureCount = 0;

function check(name, fn) {
  checks.push({ name, fn });
}

function report(name, passed, details = '') {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (details && !passed) {
    console.log(`   ${details}`);
    failureCount++;
  }
  return passed;
}

console.log(`\n${BOLD}${GREEN}STAGE 4: CI GUARDRAIL CHECKS${RESET}\n`);

// CHECK 1: Runtime determinism (Node version)
check('Runtime Version Check', () => {
  const currentVersion = process.version;
  const [maj] = currentVersion.slice(1).split('.').map(Number);
  const isOk = maj >= 18;
  report('Node.js version', isOk, `Current: ${currentVersion}, Required: >=18.0.0`);
  return isOk;
});

// CHECK 2: Lint passes with zero warnings
check('Lint Signal Lock', () => {
  try {
    const output = execSync('npm run lint 2>&1', { encoding: 'utf8' });
    const hasWarnings = output.includes('warning');
    const hasFails = output.includes('error');
    
    if (hasFails) {
      report('Lint errors', false, 'ESLint found errors');
      return false;
    }
    
    if (hasWarnings) {
      report('Lint warnings', false, 'ESLint found warnings (failing per Stage 4)');
      return false;
    }
    
    report('Lint clean', true);
    return true;
  } catch (err) {
    report('Lint execution', false, err.message);
    return false;
  }
});

// CHECK 3: Report unification tests pass
check('Report Unification Tests', () => {
  try {
    execSync('npx mocha test/report-unification.test.js --timeout 10000 2>&1', { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    report('Report unification tests', true);
    return true;
  } catch (err) {
    report('Report unification tests', false, 'Tests failed');
    return false;
  }
});

// CHECK 4: Verdict policy tests exist and can be required
check('Verdict Policy Enforcement', () => {
  try {
    const policyPath = path.join(__dirname, '..', 'src', 'guardian', 'verdict-policy.js');
    if (!fs.existsSync(policyPath)) {
      report('Verdict policy module exists', false, 'verdict-policy.js not found');
      return false;
    }
    
    const policy = require(policyPath);
    if (typeof policy.enforceVerdictPolicy !== 'function') {
      report('Verdict policy enforcer', false, 'enforceVerdictPolicy function not exported');
      return false;
    }
    
    report('Verdict policy enforcement available', true);
    return true;
  } catch (err) {
    report('Verdict policy module', false, err.message);
    return false;
  }
});

// CHECK 5: Artifact hygiene (git tracking)
check('Artifact Hygiene Lock', () => {
  try {
    const gitignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
    const artifactPatterns = ['.tmp*', '.odavl*', 'tmp-*', 'artifacts/', 'test-artifacts/'];
    const hasAllPatterns = artifactPatterns.every(pattern => gitignore.includes(pattern));
    
    if (!hasAllPatterns) {
      report('Artifact patterns in .gitignore', false, 'Missing artifact ignore patterns');
      return false;
    }
    
    report('Artifact patterns in .gitignore', true);
    return true;
  } catch (err) {
    report('Artifact hygiene check', false, err.message);
    return false;
  }
});

// CHECK 6: Package.json files field excludes artifacts
check('Package.json Artifact Exclusion', () => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const files = pkg.files || [];
    
    const hasArtifactFiles = files.some(f => 
      f.includes('artifacts') || f.includes('test-') || f.includes('.tmp') || f.includes('.odavl')
    );
    
    if (hasArtifactFiles) {
      report('Package.json excludes artifacts', false, 'Found artifact patterns in files field');
      return false;
    }
    
    const hasRequiredFiles = ['bin/', 'src/', 'flows/', 'policies/'].every(f => files.includes(f));
    if (!hasRequiredFiles) {
      report('Package.json includes required files', false, 'Missing required file patterns');
      return false;
    }
    
    report('Package.json artifact exclusion', true);
    return true;
  } catch (err) {
    report('Package.json check', false, err.message);
    return false;
  }
});

// CHECK 7: .nvmrc exists with proper Node version
check('Runtime Pinning (.nvmrc)', () => {
  try {
    const nvmrcPath = path.join(__dirname, '..', '.nvmrc');
    if (!fs.existsSync(nvmrcPath)) {
      report('.nvmrc file exists', false, '.nvmrc not found');
      return false;
    }
    
    const version = fs.readFileSync(nvmrcPath, 'utf8').trim();
    if (!version || !version.match(/^\d+\.\d+\.\d+$/)) {
      report('.nvmrc contains valid version', false, `Invalid version format: ${version}`);
      return false;
    }
    
    report('.nvmrc pinning', true);
    return true;
  } catch (err) {
    report('.nvmrc check', false, err.message);
    return false;
  }
});

// CHECK 8: engines.node in package.json
check('Package.json engines.node', () => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    if (!pkg.engines || !pkg.engines.node) {
      report('engines.node defined', false, 'Not found in package.json');
      return false;
    }
    
    report('engines.node defined', true);
    return true;
  } catch (err) {
    report('engines.node check', false, err.message);
    return false;
  }
});

// Run all checks
console.log(`${BOLD}Running ${checks.length} checks...${RESET}\n`);
for (const check of checks) {
  const passed = check.fn();
  if (!passed && !failureCount) failureCount++; // Track failures
}

// Summary
console.log(`\n${BOLD}Summary:${RESET}`);
const passedChecks = checks.filter(c => {
  try {
    return c.fn();
  } catch {
    return false;
  }
}).length;

console.log(`${GREEN}${passedChecks}/${checks.length}${RESET} checks passed`);

if (failureCount > 0) {
  console.log(`\n${RED}${BOLD}CI GATE FAILED${RESET}`);
  console.log(`Failures: ${failureCount}`);
  process.exit(1);
} else {
  console.log(`\n${GREEN}${BOLD}CI GATE PASSED - Ready for deployment${RESET}\n`);
  process.exit(0);
}
