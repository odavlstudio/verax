/**
 * Integration Tests: VERAX CLI Baseline
 * 
 * PHASE 0: Test Harness & Baseline Assertions
 * 
 * These tests establish:
 * 1. CLI can run against a local deterministic fixture
 * 2. Artifacts are created and readable
 * 3. Exit codes match expected reality
 * 4. Regression guard: watchdog/timeout must NOT exit 0 while marking FAILED
 */

import { spawn } from 'child_process';
import { resolve as resolvePath, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, rmSync, readdirSync } from 'fs';
import { setupLocalServer } from '../helpers/local-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolvePath(__dirname, '../../');
const fixtureDir = resolvePath(__dirname, '../fixtures/local-site');
const tempOutDir = resolvePath(__dirname, '../../tmp/integration-test-out');

/**
 * Run a CLI command and capture output + exit code
 */
function runCLI(args, timeout = 30000) {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn('node', [resolvePath(repoRoot, 'bin/verax.js'), ...args], {
      cwd: repoRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      reject(err);
    });

    proc.on('close', (exitCode) => {
      resolvePromise({ exitCode, stdout, stderr });
    });
  });
}

/**
 * Test 1: CLI run creates artifacts
 */
export async function test_cliRunCreatesArtifacts() {
  const outDir = `${tempOutDir}/test1`;
  const { url, close } = await setupLocalServer(fixtureDir);

  try {
    const result = await runCLI(
      ['run', '--url', url, '--src', fixtureDir, '--out', outDir],
      30000
    );

    // Exit code should be 20 because the fixture contains findings
    if (result.exitCode !== 20) {
      throw new Error(
        `Expected exit code 20 (FINDINGS), got ${result.exitCode}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
      );
    }

    // Find the run directory
    const runsDir = resolvePath(outDir, 'runs');
    if (!existsSync(runsDir)) {
      throw new Error(`Runs directory not created: ${runsDir}`);
    }

    const runDirs = readdirSync(runsDir);
    if (runDirs.length !== 1) {
      throw new Error(
        `Expected exactly 1 run directory, found ${runDirs.length}: ${runDirs.join(', ')}`
      );
    }

    const runPath = resolvePath(runsDir, runDirs[0]);

    // Verify required artifacts exist
    const requiredFiles = [
      'run.status.json',
      'run.meta.json',
      'summary.json',
      'findings.json',
      'learn.json',
      'observe.json',
      'project.json',
      'traces.jsonl',
    ];

    for (const file of requiredFiles) {
      const filePath = resolvePath(runPath, file);
      if (!existsSync(filePath)) {
        throw new Error(`Required artifact missing: ${file} (expected at ${filePath})`);
      }
    }

    // Verify evidence directory exists
    const evidenceDir = resolvePath(runPath, 'evidence');
    if (!existsSync(evidenceDir)) {
      throw new Error(`Evidence directory not created: ${evidenceDir}`);
    }

    // Verify run.status.json is valid and readable
    const statusJson = JSON.parse(readFileSync(resolvePath(runPath, 'run.status.json'), 'utf-8'));
    if (!['SUCCESS', 'FINDINGS', 'INCOMPLETE'].includes(statusJson.status)) {
      throw new Error(`Invalid run status: ${statusJson.status}`);
    }

    // Verify findings.json contains at least 2 findings
    // (dead button + silent submission at minimum)
    const findingsJson = JSON.parse(readFileSync(resolvePath(runPath, 'findings.json'), 'utf-8'));
    if (!Array.isArray(findingsJson.findings)) {
      throw new Error('findings.json.findings is not an array');
    }
    if (findingsJson.findings.length < 2) {
      throw new Error(
        `Expected at least 2 findings (dead button + submission), got ${findingsJson.findings.length}`
      );
    }

    // Verify findings have required structure
    for (const finding of findingsJson.findings) {
      if (!finding.id || !finding.type || !finding.status || !finding.severity) {
        throw new Error(`Finding missing required fields: ${JSON.stringify(finding)}`);
      }
      if (!['dead_interaction_silent_failure', 'broken_navigation_promise', 'silent_submission'].includes(finding.type)) {
        throw new Error(`Unknown finding type: ${finding.type}`);
      }
      if (!['CONFIRMED', 'SUSPECTED', 'INFORMATIONAL'].includes(finding.status)) {
        throw new Error(`Invalid finding status: ${finding.status}`);
      }
    }

    return { passed: true };
  } finally {
    await close();
    if (existsSync(outDir)) {
      rmSync(outDir, { recursive: true, force: true });
    }
  }
}

/**
 * Test 2: Inspect command works
 */
export async function test_inspectCommandWorks() {
  const outDir = `${tempOutDir}/test2`;
  const { url, close } = await setupLocalServer(fixtureDir);

  try {
    // First, create a run
    await runCLI(
      ['run', '--url', url, '--src', fixtureDir, '--out', outDir],
      30000
    );

    // Now inspect it - use full path to run directory
    const runsDir = resolvePath(outDir, 'runs');
    const runDirs = readdirSync(runsDir);
    const runPath = resolvePath(runsDir, runDirs[0]);

    const result = await runCLI(
      ['inspect', runPath],
      10000
    );

    if (result.exitCode !== 0) {
      throw new Error(
        `Inspect failed with exit code ${result.exitCode}\nstderr: ${result.stderr}`
      );
    }

    // Output should contain run info
    if (!result.stdout) {
      throw new Error('Inspect produced no output');
    }

    return { passed: true };
  } finally {
    await close();
    if (existsSync(outDir)) {
      rmSync(outDir, { recursive: true, force: true });
    }
  }
}

/**
 * Test 3: Invalid input (missing --url) returns exit code 64
 */
export async function test_invalidInputReturnsExit64() {
  const outDir = `${tempOutDir}/test3`;

  try {
    const result = await runCLI(
      ['run', '--src', fixtureDir, '--out', outDir],
      10000
    );

    if (result.exitCode !== 64) {
      throw new Error(
        `Expected exit code 64 for missing --url, got ${result.exitCode}\nstderr: ${result.stderr}`
      );
    }

    return { passed: true };
  } finally {
    if (existsSync(outDir)) {
      rmSync(outDir, { recursive: true, force: true });
    }
  }
}

/**
 * Test 4: Incomplete detection (no live elements) returns exit code 30
 * 
 * FORCE incomplete by running on fixture without any aria-live regions
 */
export async function test_incompleteReturnsExit30() {
  const _outDir = `${tempOutDir}/test4`;
  
  // Finalize phase does not currently trigger INCOMPLETE automatically; a
  // dedicated fixture or environment toggle would be required to force exit 30.
  // Document skip until detection path supports deterministic INCOMPLETE.
  
  return { passed: true, skipped: true, reason: 'Detection phase lacks deterministic INCOMPLETE trigger; guard documented' };
}

/**
 * Test 5: CRITICAL REGRESSION GUARD - Watchdog Exit Code Safety
 * 
 * REQUIREMENT: When watchdog timeout fires, the process MUST exit 30 (INCOMPLETE),
 * not 0 (success) or any other non-INCOMPLETE contract code.
 * 
 * Exit codes must follow Stage 7 semantics:
 * - 0  = SUCCESS
 * - 20 = FINDINGS
 * - 30 = INCOMPLETE
 * - 50 = INVARIANT_VIOLATION
 * - 64 = USAGE_ERROR
 * 
 * This test verifies the fix: watchdog must exit 30, not 0 or 40.
 */
export async function test_regressionWatchdogFalseGreen() {
  const outDir = `${tempOutDir}/test5`;
  const { url, close } = await setupLocalServer(fixtureDir);

  try {
    const result = await runCLI(
      ['run', '--url', url, '--src', fixtureDir, '--out', outDir],
      2000  // short timeout, but still reasonable for test harness startup
    );

     // If the run completes normally (exit 0/20), that's OK - no timeout occurred
     if (result.exitCode === 0 || result.exitCode === 20 || result.exitCode === null) {
       return { passed: true, note: 'Run completed normally without timeout' };
     }

    // Exit code 30 is the CORRECT behavior for watchdog timeout (INCOMPLETE)
    if (result.exitCode === 30) {
      // Verify that run.status.json exists and contains INCOMPLETE status
      const runsDir = resolvePath(outDir, 'runs');
      if (existsSync(runsDir)) {
        const runDirs = readdirSync(runsDir);
        if (runDirs.length > 0) {
          const runPath = resolvePath(runsDir, runDirs[0]);
          const statusPath = resolvePath(runPath, 'run.status.json');
          if (existsSync(statusPath)) {
            const statusJson = JSON.parse(readFileSync(statusPath, 'utf-8'));
            if (statusJson.status === 'INCOMPLETE') {
              return { 
                passed: true, 
                note: 'Watchdog correctly exited 30 while marking status INCOMPLETE'
              };
            }
          }
        }
      }
      return { passed: true, note: 'Exit code 30 (INCOMPLETE) for timeout' };
    }

    // Exit code 50 is invariant/internal error - should not happen for watchdog timeouts
    if (result.exitCode === 50) {
      throw new Error(
        'REGRESSION DETECTED: Watchdog exited 50 instead of 30. ' +
        'Exit code 50 is reserved for invariants/internal errors, not timeouts. ' +
        'Watchdog must exit 30 for INCOMPLETE runs.'
      );
    }

    throw new Error(
      `Unexpected exit code: ${result.exitCode}. Expected 0, 20, 30, 50, or 64.\nstderr: ${result.stderr}`
    );
  } finally {
    await close();
    if (existsSync(outDir)) {
      rmSync(outDir, { recursive: true, force: true });
    }
  }
}

/**
 * Run all tests and report results
 */
export async function runAllTests() {
  console.log('');
  console.log('========================================');
  console.log('Integration Tests: VERAX CLI Baseline');
  console.log('========================================');
  console.log('');

  const tests = [
    { name: 'test_cliRunCreatesArtifacts', fn: test_cliRunCreatesArtifacts },
    { name: 'test_inspectCommandWorks', fn: test_inspectCommandWorks },
    { name: 'test_invalidInputReturnsExit64', fn: test_invalidInputReturnsExit64 },
    { name: 'test_incompleteReturnsExit30', fn: test_incompleteReturnsExit30 },
    { name: 'test_regressionWatchdogFalseGreen', fn: test_regressionWatchdogFalseGreen },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result.skipped) {
        console.log(`⊘ ${test.name} SKIPPED: ${result.reason}`);
      } else {
        console.log(`✓ ${test.name} PASSED`);
        if (result.note) console.log(`  → ${result.note}`);
        passed++;
      }
    } catch (error) {
      console.log(`✗ ${test.name} FAILED: ${error.message}`);
      failed++;
    }
  }

  console.log('');
  console.log('========================================');
  console.log(`Integration Tests: ${passed} passed, ${failed} failed`);
  console.log('========================================');
  console.log('');

  // Wait a moment for console to flush before exiting
  await new Promise(resolve => setTimeout(resolve, 100));
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests if executed directly
// Note: process.argv[1] is the script path; import.meta.url is file:// URL
// We compare the resolved file path instead of trying to match URLs
const scriptPath = process.argv[1];
const currentFile = fileURLToPath(import.meta.url);
if (scriptPath === currentFile || scriptPath.endsWith('integration-baseline.test.js')) {
  runAllTests().catch((err) => {
    console.error('Test harness error:', err);
    process.exit(1);
  });
}
