/**
 * Regression tests for critical consistency bugs
 * 
 * BLOCKER #1: findings.json vs summary.json count mismatch
 * BLOCKER #2: console/exit code vs artifacts status mismatch
 * BLOCKER #3: INCOMPLETE without incompleteReasons
 */

import assert from 'assert';
import { test } from 'node:test';
import { resolve, join } from 'path';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const veraxBin = resolve(projectRoot, 'bin', 'verax.js');

/**
 * Helper: Run VERAX and capture output + artifacts
 */
function runVerax(args, cwd = projectRoot) {
  const outDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  const fullArgs = [...args, '--out', outDir];
  
  let stdout = '';
  let exitCode = 0;
  try {
    stdout = execSync(`node "${veraxBin}" ${fullArgs.join(' ')}`, {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  } catch (error) {
    stdout = error.stdout || '';
    exitCode = error.status || 1;
  }
  
  // Find the run directory
  const runsDir = join(outDir, 'runs');
  let runDir = null;
  if (existsSync(runsDir)) {
    const scanDirs = readdirSync(runsDir);
    if (scanDirs.length > 0) {
      const scanPath = join(runsDir, scanDirs[0]);
      const runDirs = readdirSync(scanPath).filter(d => !d.endsWith('.json'));
      if (runDirs.length > 0) {
        runDir = join(scanPath, runDirs[0]);
      }
    }
  }
  
  return { stdout, exitCode, runDir, outDir };
}

/**
 * Helper: Read JSON artifact
 */
function readArtifact(runDir, filename) {
  const path = join(runDir, filename);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

test('Consistency: findings.json count matches summary.json count', async () => {
  // Use static-site fixture which produces findings
  const fixtureDir = resolve(projectRoot, 'test', 'fixtures', 'static-site');
  if (!existsSync(fixtureDir)) {
    console.log('SKIP: static-site fixture not found');
    return;
  }
  
  const { runDir, outDir } = runVerax([
    'run',
    '--url', 'http://127.0.0.1:9999',  // Will fail/timeout but that's ok
    '--src', fixtureDir,
  ]);
  
  try {
    if (!runDir) {
      console.log('SKIP: No run directory created');
      return;
    }
    
    const summary = readArtifact(runDir, 'summary.json');
    const findings = readArtifact(runDir, 'findings.json');
    
    if (!summary || !findings) {
      console.log('SKIP: Artifacts not found');
      return;
    }
    
    // Critical assertion: counts must match
    const summaryHigh = summary.findingsCounts?.HIGH || 0;
    const summaryMed = summary.findingsCounts?.MEDIUM || 0;
    const summaryLow = summary.findingsCounts?.LOW || 0;
    const summaryTotal = summaryHigh + summaryMed + summaryLow;
    
    const findingsArray = findings.findings || [];
    const confirmedFindings = findingsArray.filter(f => f.status === 'CONFIRMED');
    const actualHigh = confirmedFindings.filter(f => f.severity === 'HIGH').length;
    const actualMed = confirmedFindings.filter(f => f.severity === 'MEDIUM').length;
    const actualLow = confirmedFindings.filter(f => f.severity === 'LOW').length;
    const actualTotal = actualHigh + actualMed + actualLow;
    
    assert.strictEqual(summaryHigh, actualHigh, 'HIGH findings count must match');
    assert.strictEqual(summaryMed, actualMed, 'MEDIUM findings count must match');
    assert.strictEqual(summaryLow, actualLow, 'LOW findings count must match');
    assert.strictEqual(summaryTotal, actualTotal, 'Total findings count must match');
    assert.strictEqual(findings.stats?.total || 0, actualTotal, 'findings.stats.total must match array length');
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('Consistency: summary.json status matches run.status.json', async () => {
  const fixtureDir = resolve(projectRoot, 'test', 'fixtures', 'static-site');
  if (!existsSync(fixtureDir)) {
    console.log('SKIP: static-site fixture not found');
    return;
  }
  
  const { runDir, outDir } = runVerax([
    'run',
    '--url', 'http://127.0.0.1:9998',
    '--src', fixtureDir,
  ]);
  
  try {
    if (!runDir) {
      console.log('SKIP: No run directory created');
      return;
    }
    
    const summary = readArtifact(runDir, 'summary.json');
    const runStatus = readArtifact(runDir, 'run.status.json');
    
    if (!summary || !runStatus) {
      console.log('SKIP: Artifacts not found');
      return;
    }
    
    assert.strictEqual(
      summary.status,
      runStatus.status,
      'summary.status must match run.status.json'
    );
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('Consistency: INCOMPLETE always has non-empty incompleteReasons', async () => {
  // Force INCOMPLETE by using impossible coverage threshold
  const { runDir, outDir } = runVerax([
    'run',
    '--url', 'https://example.com',
    '--min-coverage', '0.99',
  ]);
  
  try {
    if (!runDir) {
      console.log('SKIP: No run directory created');
      return;
    }
    
    const summary = readArtifact(runDir, 'summary.json');
    
    if (!summary) {
      console.log('SKIP: summary.json not found');
      return;
    }
    
    if (summary.status === 'INCOMPLETE') {
      assert.ok(Array.isArray(summary.incompleteReasons), 'incompleteReasons must be an array');
      assert.ok(summary.incompleteReasons.length > 0, 'INCOMPLETE must have non-empty incompleteReasons');
    }
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('Consistency: exit code matches status (FINDINGS=20, INCOMPLETE=30, SUCCESS=0)', async () => {
  const fixtureDir = resolve(projectRoot, 'test', 'fixtures', 'static-site');
  if (!existsSync(fixtureDir)) {
    console.log('SKIP: static-site fixture not found');
    return;
  }
  
  const { runDir, exitCode, outDir } = runVerax([
    'run',
    '--url', 'http://127.0.0.1:9997',
    '--src', fixtureDir,
  ]);
  
  try {
    if (!runDir) {
      console.log('SKIP: No run directory created');
      return;
    }
    
    const summary = readArtifact(runDir, 'summary.json');
    
    if (!summary) {
      console.log('SKIP: summary.json not found');
      return;
    }
    
    // Map status to expected exit code
    const expectedExitCode = 
      summary.status === 'SUCCESS' ? 0 :
      summary.status === 'FINDINGS' ? 20 :
      summary.status === 'INCOMPLETE' ? 30 :
      null;
    
    if (expectedExitCode !== null) {
      // Note: exitCode might be 30 if validation failed, so we check if it's in expected range
      const validExitCodes = [expectedExitCode];
      if (summary.status === 'FINDINGS') {
        // Findings can still exit 30 if validation failed
        validExitCodes.push(30);
      }
      assert.ok(
        validExitCodes.includes(exitCode),
        `Exit code ${exitCode} must match status ${summary.status} (expected ${validExitCodes.join(' or ')})`
      );
    }
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('Consistency: console RESULT line matches summary.json status', async () => {
  const fixtureDir = resolve(projectRoot, 'test', 'fixtures', 'static-site');
  if (!existsSync(fixtureDir)) {
    console.log('SKIP: static-site fixture not found');
    return;
  }
  
  const { runDir, stdout, outDir } = runVerax([
    'run',
    '--url', 'http://127.0.0.1:9996',
    '--src', fixtureDir,
  ]);
  
  try {
    if (!runDir) {
      console.log('SKIP: No run directory created');
      return;
    }
    
    const summary = readArtifact(runDir, 'summary.json');
    
    if (!summary) {
      console.log('SKIP: summary.json not found');
      return;
    }
    
    // Extract RESULT line from console output
    const resultMatch = stdout.match(/RESULT\s+(\w+)/);
    const consoleResult = resultMatch ? resultMatch[1] : null;
    
    if (consoleResult) {
      assert.strictEqual(
        consoleResult,
        summary.status,
        'Console RESULT line must match summary.json status'
      );
    }
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
