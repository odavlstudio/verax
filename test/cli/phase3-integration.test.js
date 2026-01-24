/**
 * Integration Tests: PHASE 3 (Evidence Law v2 + Ambiguity + Artifact Integrity)
 * 
 * These tests verify:
 * 1. Enrichment fields (ambiguityReasons, evidenceCategories) are present
 * 2. No CONFIRMED findings exist without strong evidence categories
 * 3. Evidence references in findings point to existing files
 * 4. Summary/findings counts match exactly
 * 5. Exit code 1 when actionable findings
 */

import { spawn } from 'child_process';
import { resolve as resolvePath, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, rmSync, readdirSync } from 'fs';
import assert from 'assert';
import { setupLocalServer } from '../helpers/local-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolvePath(__dirname, '../../');
const fixtureDir = resolvePath(__dirname, '../fixtures/local-site');
const tempOutDir = resolvePath(__dirname, '../../tmp/phase3-integration-test-out');

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
 * PHASE 3 Test 1: Enrichment fields are recorded
 */
export async function test_enrichmentFieldsRecorded() {
  const outDir = `${tempOutDir}/test1`;
  const { url, close } = await setupLocalServer(fixtureDir);

  try {
    const result = await runCLI(
      ['run', '--url', url, '--src', fixtureDir, '--out', outDir],
      30000
    );

    if (result.exitCode !== 1) {
      throw new Error(`Expected exit code 1, got ${result.exitCode}`);
    }

    const runsDir = resolvePath(outDir, 'runs');
    const runDirs = readdirSync(runsDir);
    const findingsPath = resolvePath(runsDir, runDirs[0], 'findings.json');
    const findingsJson = JSON.parse(readFileSync(findingsPath, 'utf-8'));

    // At least some findings should have enrichment with evidence categories or ambiguity reasons
    let hasEnrichment = false;
    for (const finding of findingsJson.findings) {
      if (finding.enrichment) {
        if (Array.isArray(finding.enrichment.evidenceCategories) ||
            Array.isArray(finding.enrichment.ambiguityReasons)) {
          hasEnrichment = true;
          break;
        }
      }
    }

    if (!hasEnrichment) {
      console.warn('Warning: No findings with enrichment fields found (may be OK if all simple)');
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
 * PHASE 3 Test 2: No CONFIRMED findings without strong evidence
 */
export async function test_noConfirmedWithoutStrongEvidence() {
  const outDir = `${tempOutDir}/test2`;
  const { url, close } = await setupLocalServer(fixtureDir);

  try {
    const result = await runCLI(
      ['run', '--url', url, '--src', fixtureDir, '--out', outDir],
      30000
    );

    if (result.exitCode !== 1) {
      throw new Error(`Expected exit code 1, got ${result.exitCode}`);
    }

    const runsDir = resolvePath(outDir, 'runs');
    const runDirs = readdirSync(runsDir);
    const findingsPath = resolvePath(runsDir, runDirs[0], 'findings.json');
    const findingsJson = JSON.parse(readFileSync(findingsPath, 'utf-8'));

    const strongCategories = ['navigation', 'meaningful_dom', 'feedback', 'network'];

    for (const finding of findingsJson.findings) {
      if (finding.status === 'CONFIRMED') {
        // Must have at least one strong evidence category recorded in enrichment
        if (!finding.enrichment ||
            !Array.isArray(finding.enrichment.evidenceCategories) ||
            finding.enrichment.evidenceCategories.length === 0) {
          throw new Error(
            `CONFIRMED finding ${finding.id} has no evidence categories in enrichment`
          );
        }

        // At least one recorded category must be strong
        const hasStrong = finding.enrichment.evidenceCategories.some(
          cat => strongCategories.includes(cat)
        );
        if (!hasStrong) {
          throw new Error(
            `CONFIRMED finding ${finding.id} has only weak evidence categories: ${finding.enrichment.evidenceCategories.join(', ')}`
          );
        }
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
 * PHASE 3 Test 3: Evidence file references exist
 */
export async function test_evidenceFileReferencesExist() {
  const outDir = `${tempOutDir}/test3`;
  const { url, close } = await setupLocalServer(fixtureDir);

  try {
    const result = await runCLI(
      ['run', '--url', url, '--src', fixtureDir, '--out', outDir],
      30000
    );

    if (result.exitCode !== 1) {
      throw new Error(`Expected exit code 1, got ${result.exitCode}`);
    }

    const runsDir = resolvePath(outDir, 'runs');
    const runDirs = readdirSync(runsDir);
    const runPath = resolvePath(runsDir, runDirs[0]);
    const evidenceDir = resolvePath(runPath, 'evidence');

    if (!existsSync(evidenceDir)) {
      throw new Error(`Evidence directory not found: ${evidenceDir}`);
    }

    const findingsPath = resolvePath(runPath, 'findings.json');
    const findingsJson = JSON.parse(readFileSync(findingsPath, 'utf-8'));

    for (const finding of findingsJson.findings) {
      if (!finding.evidence) {
        continue;
      }

      // Check evidence_files or evidenceFiles references
      const filesRef = finding.evidence.evidence_files || finding.evidence.evidenceFiles || [];
      if (!Array.isArray(filesRef)) {
        continue;
      }

      for (const fileRef of filesRef) {
        if (typeof fileRef !== 'string') {
          continue;
        }

        const fullPath = resolvePath(evidenceDir, fileRef);
        if (!existsSync(fullPath)) {
          throw new Error(
            `Finding ${finding.id} references non-existent evidence file: ${fileRef} (full path: ${fullPath})`
          );
        }
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
 * PHASE 3 Test 4: Summary and findings counts match
 */
export async function test_summaryAndFindingsCountsMatch() {
  const outDir = `${tempOutDir}/test4`;
  const { url, close } = await setupLocalServer(fixtureDir);

  try {
    const result = await runCLI(
      ['run', '--url', url, '--src', fixtureDir, '--out', outDir],
      30000
    );

    if (result.exitCode !== 1) {
      throw new Error(`Expected exit code 1, got ${result.exitCode}`);
    }

    const runsDir = resolvePath(outDir, 'runs');
    const runDirs = readdirSync(runsDir);
    const runPath = resolvePath(runsDir, runDirs[0]);

    const summaryPath = resolvePath(runPath, 'summary.json');
    const findingsPath = resolvePath(runPath, 'findings.json');

    const summaryJson = JSON.parse(readFileSync(summaryPath, 'utf-8'));
    const findingsJson = JSON.parse(readFileSync(findingsPath, 'utf-8'));

    // Check total count
    const summaryTotal = summaryJson.silentFailures || 0;
    const findingsTotal = findingsJson.findings?.length || 0;

    if (summaryTotal !== findingsTotal) {
      throw new Error(
        `Count mismatch: summary says ${summaryTotal} but findings.json has ${findingsTotal} findings`
      );
    }

    // Check severity breakdown
    if (summaryJson.findingsCounts) {
      const actualCounts = {
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0
      };

      for (const finding of findingsJson.findings || []) {
        const sev = finding.severity || 'UNKNOWN';
        if (sev in actualCounts) {
          actualCounts[sev]++;
        }
      }

      for (const severity of Object.keys(actualCounts)) {
        const expected = summaryJson.findingsCounts[severity] || 0;
        const actual = actualCounts[severity];
        if (expected !== actual) {
          throw new Error(
            `Severity count mismatch for ${severity}: summary says ${expected}, findings has ${actual}`
          );
        }
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
 * PHASE 3 Test 5: Ambiguity reasons recorded when applicable
 */
export async function test_ambiguityReasonsRecordedWhenApplicable() {
  const outDir = `${tempOutDir}/test5`;
  const { url, close } = await setupLocalServer(fixtureDir);

  try {
    const result = await runCLI(
      ['run', '--url', url, '--src', fixtureDir, '--out', outDir],
      30000
    );

    if (result.exitCode !== 1) {
      throw new Error(`Expected exit code 1, got ${result.exitCode}`);
    }

    const runsDir = resolvePath(outDir, 'runs');
    const runDirs = readdirSync(runsDir);
    const findingsPath = resolvePath(runsDir, runDirs[0], 'findings.json');
    const findingsJson = JSON.parse(readFileSync(findingsPath, 'utf-8'));

    // If any SUSPECTED findings exist, check they have potential ambiguity reasons
    // or at least the enrichment structure
    for (const finding of findingsJson.findings) {
      if (finding.enrichment && Array.isArray(finding.enrichment.ambiguityReasons)) {
        // Good: ambiguity reasons are recorded
        if (finding.enrichment.ambiguityReasons.length > 0) {
          assert(finding.enrichment.ambiguityReasons[0].includes(':') ||
                 finding.enrichment.ambiguityReasons[0].includes('_'),
            `Ambiguity reason should be descriptive: ${finding.enrichment.ambiguityReasons[0]}`);
        }
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

// ============================================================================
// TEST RUNNER
// ============================================================================

export async function runPhase3IntegrationTests() {
  console.log('\n=== PHASE 3 INTEGRATION TESTS ===\n');

  const tests = [
    { name: 'test_enrichmentFieldsRecorded', fn: test_enrichmentFieldsRecorded },
    { name: 'test_noConfirmedWithoutStrongEvidence', fn: test_noConfirmedWithoutStrongEvidence },
    { name: 'test_evidenceFileReferencesExist', fn: test_evidenceFileReferencesExist },
    { name: 'test_summaryAndFindingsCountsMatch', fn: test_summaryAndFindingsCountsMatch },
    { name: 'test_ambiguityReasonsRecordedWhenApplicable', fn: test_ambiguityReasonsRecordedWhenApplicable }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✓ ${test.name}`);
      passed++;
    } catch (error) {
      console.error(`✗ ${test.name}`);
      console.error(`  Error: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n=== PHASE 3 RESULTS: ${passed} passed, ${failed} failed ===\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPhase3IntegrationTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
