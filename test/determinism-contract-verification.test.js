/**
 * STAGE 2: DETERMINISTIC REALITY
 * Determinism Contract Tests for VERAX v0.4+
 *
 * Verifies that:
 * 1. Repeated runs produce identical outputs (after timestamp normalization)
 * 2. Evidence ordering is deterministic
 * 3. All arrays are sorted consistently
 * 4. Evidence integrity hashes are reproducible
 *
 * Contract: VERAX SHALL be deterministic
 * - Running the same scan twice with identical inputs MUST produce identical artifacts
 * - Non-determinism is a violation of the constitution
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { normalizeForComparison, deepEqual, getDiff } from '../src/cli/util/support/determinism-normalizer.js';
import { createEvidenceManifest, verifyFindingIntegrity } from '../src/cli/util/evidence/evidence-integrity.js';

const TEST_FIXTURES_DIR = path.join(process.cwd(), 'artifacts', 'test-fixtures');
const TEST_OUTPUT_DIR = path.join(process.cwd(), 'tmp', 'determinism-test');

/**
 * Run a scan and return the artifacts
 * @param {string} scanPath - path to scan
 * @returns {Object} parsed artifacts
 */
function runScan(scanPath) {
  // Ensure test output directory exists
  if (!fs.existsSync(TEST_OUTPUT_DIR)) {
    fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  }

  const outputFile = path.join(TEST_OUTPUT_DIR, 'artifacts-run.json');
  const result = spawnSync('node', [
    'bin/verax.js',
    scanPath,
    '--output',
    outputFile,
    '--json',
  ], {
    cwd: process.cwd(),
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    console.error('Scan failed:', result.stderr);
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
}

/**
 * Test: Repeated runs produce identical outputs
 */
export function testDeterministicRepeatedRuns() {
  console.log('\n[DETERMINISM] Testing repeated runs...');

  const testPath = path.join(TEST_FIXTURES_DIR, 'absolute-reality-static');
  if (!fs.existsSync(testPath)) {
    console.warn(`Test fixture not found: ${testPath}`);
    return;
  }

  const run1 = runScan(testPath);
  const run2 = runScan(testPath);

  // Normalize both outputs for comparison
  const normalized1 = normalizeForComparison(run1);
  const normalized2 = normalizeForComparison(run2);

  if (deepEqual(normalized1, normalized2)) {
    console.log('✓ PASS: Repeated runs are deterministic');
    return true;
  }

  // Report differences
  console.error('✗ FAIL: Repeated runs differ');
  const diffs = getDiff(normalized1, normalized2);
  diffs.slice(0, 10).forEach(d => console.error(`  ${d}`));
  if (diffs.length > 10) {
    console.error(`  ... and ${diffs.length - 10} more differences`);
  }

  return false;
}

/**
 * Test: Findings array is sorted deterministically
 */
export function testDeterministicFindingOrder() {
  console.log('\n[DETERMINISM] Testing finding order...');

  const testPath = path.join(TEST_FIXTURES_DIR, 'complex-website');
  if (!fs.existsSync(testPath)) {
    console.warn(`Test fixture not found: ${testPath}`);
    return;
  }

  const artifacts = runScan(testPath);

  if (!artifacts.findings || !Array.isArray(artifacts.findings)) {
    console.warn('No findings in artifacts');
    return true;
  }

  // Verify findings are in deterministic order
  // (Currently should be sorted by severity desc, then by ID asc)
  const findings = artifacts.findings;
  let isOrdered = true;

  for (let i = 1; i < findings.length; i++) {
    const prev = findings[i - 1];
    const curr = findings[i];

    // Check if ordered by severity (higher to lower)
    if (prev.severity && curr.severity) {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      const prevSev = severityOrder[prev.severity] ?? 999;
      const currSev = severityOrder[curr.severity] ?? 999;

      if (prevSev > currSev) {
        console.error(`Finding order violation: ${prev.id} (${prev.severity}) should not come before ${curr.id} (${curr.severity})`);
        isOrdered = false;
        break;
      }

      // If same severity, should be sorted by ID
      if (prevSev === currSev && prev.id > curr.id) {
        console.error(`Finding order violation: ${prev.id} should come after ${curr.id} when severity is equal`);
        isOrdered = false;
        break;
      }
    }
  }

  if (isOrdered) {
    console.log('✓ PASS: Findings are in deterministic order');
    return true;
  }

  console.error('✗ FAIL: Findings are not in deterministic order');
  return false;
}

/**
 * Test: Evidence arrays are sorted deterministically
 */
export function testDeterministicEvidenceOrder() {
  console.log('\n[DETERMINISM] Testing evidence order...');

  const testPath = path.join(TEST_FIXTURES_DIR, 'complex-website');
  if (!fs.existsSync(testPath)) {
    console.warn(`Test fixture not found: ${testPath}`);
    return;
  }

  const artifacts = runScan(testPath);

  if (!artifacts.findings || !Array.isArray(artifacts.findings)) {
    console.warn('No findings in artifacts');
    return true;
  }

  let allOrdered = true;

  for (const finding of artifacts.findings) {
    if (!finding.evidence || !Array.isArray(finding.evidence)) {
      continue;
    }

    const evidence = finding.evidence;
    for (let i = 1; i < evidence.length; i++) {
      const prev = evidence[i - 1];
      const curr = evidence[i];

      // Evidence should be sorted by source then by line number
      const prevKey = `${prev.source}:${prev.line || 0}`;
      const currKey = `${curr.source}:${curr.line || 0}`;

      if (prevKey > currKey) {
        console.error(`Evidence order violation in ${finding.id}: ${prevKey} should not come before ${currKey}`);
        allOrdered = false;
        break;
      }
    }

    if (!allOrdered) break;
  }

  if (allOrdered) {
    console.log('✓ PASS: Evidence is in deterministic order');
    return true;
  }

  console.error('✗ FAIL: Evidence is not in deterministic order');
  return false;
}

/**
 * Test: Evidence integrity hashes are reproducible
 */
export function testEvidenceIntegrityHashes() {
  console.log('\n[DETERMINISM] Testing evidence integrity hashes...');

  const testPath = path.join(TEST_FIXTURES_DIR, 'absolute-reality-static');
  if (!fs.existsSync(testPath)) {
    console.warn(`Test fixture not found: ${testPath}`);
    return;
  }

  const artifacts = runScan(testPath);

  if (!artifacts.findings || !Array.isArray(artifacts.findings)) {
    console.warn('No findings in artifacts');
    return true;
  }

  let allValid = true;

  for (const finding of artifacts.findings) {
    if (!finding.evidence || finding.evidence.length === 0) {
      continue;
    }

    // Create manifest and verify integrity
    const manifest = createEvidenceManifest(finding);
    const verification = verifyFindingIntegrity(finding, manifest);

    if (!verification.valid) {
      console.error(`Evidence integrity check failed for ${finding.id}: ${verification.reason}`);
      allValid = false;
      break;
    }
  }

  if (allValid) {
    console.log('✓ PASS: Evidence integrity hashes are valid');
    return true;
  }

  console.error('✗ FAIL: Evidence integrity check failed');
  return false;
}

/**
 * Run all determinism contract tests
 */
export function runAllDeterminismTests() {
  console.log('\n' + '='.repeat(60));
  console.log('STAGE 2: DETERMINISTIC REALITY - Determinism Contract Tests');
  console.log('='.repeat(60));

  const results = {
    repeatedRuns: testDeterministicRepeatedRuns(),
    findingOrder: testDeterministicFindingOrder(),
    evidenceOrder: testDeterministicEvidenceOrder(),
    integrityHashes: testEvidenceIntegrityHashes(),
  };

  const passed = Object.values(results).filter(r => r === true).length;
  const total = Object.keys(results).length;

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed}/${total} tests passed`);
  console.log('='.repeat(60));

  return passed === total;
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runAllDeterminismTests();
  process.exit(success ? 0 : 1);
}




