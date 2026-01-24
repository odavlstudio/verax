/**
 * STAGE 5 — EVIDENCE LAW WRITE ENFORCEMENT CONTRACT TEST
 * 
 * Guarantees that Evidence Law is enforced at the artifact write boundary.
 * No CONFIRMED finding without evidence can ever be written to disk.
 */

import { tmpdir } from 'os';
import { mkdirSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { buildFindingsReport, persistFindingsReport } from '../../src/verax/detect/findings-writer.js';
import { writeFindings } from '../../src/verax/shared/artifact-manager.js';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';


// Test framework setup
const tests = [];
const results = { passed: 0, failed: 0 };

function test(name, fn) {
  tests.push({ name, fn });
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
}

function _assertNotEqual(actual, notExpected, message) {
  if (actual === notExpected) {
    throw new Error(`${message}\n  Should not be: ${notExpected}\n  Actual: ${actual}`);
  }
}

// Test 1: findings-writer.js buildFindingsReport downgrades CONFIRMED without evidence
test('buildFindingsReport downgrades CONFIRMED finding without evidence to SUSPECTED', () => {
  const findings = [
    {
      id: 'test-finding-1',
      type: 'SILENT_FAILURE',
      status: 'CONFIRMED',
      what_happened: 'Test failure',
      what_was_expected: 'Success',
      what_was_observed: 'Failure',
      why_it_matters: 'Breaks functionality',
      // NO evidence field
    }
  ];

  const report = buildFindingsReport({
    url: 'https://example.com',
    findings,
    coverageGaps: [],
    detectedAt: '2026-01-18T00:00:00.000Z'
  });

  assertEqual(report.findings.length, 1, 'Should have 1 finding');
  assertEqual(report.findings[0].status, 'SUSPECTED', 'CONFIRMED without evidence must be downgraded to SUSPECTED');
  assertEqual(
    report.findings[0].reason?.includes('Evidence Law enforced'),
    true,
    'Reason must indicate Evidence Law enforcement'
  );
});

// Test 2: findings-writer.js buildFindingsReport preserves CONFIRMED with evidence
test('buildFindingsReport preserves CONFIRMED finding with evidence', () => {
  const findings = [
    {
      id: 'test-finding-2',
      type: 'SILENT_FAILURE',
      status: 'CONFIRMED',
      what_happened: 'Test failure',
      what_was_expected: 'Success',
      what_was_observed: 'Failure',
      why_it_matters: 'Breaks functionality',
      evidence: {
        domSnapshot: { count: 5 },
        networkLogs: ['log1']
      }
    }
  ];

  const report = buildFindingsReport({
    url: 'https://example.com',
    findings,
    coverageGaps: [],
    detectedAt: '2026-01-18T00:00:00.000Z'
  });

  assertEqual(report.findings.length, 1, 'Should have 1 finding');
  assertEqual(report.findings[0].status, 'CONFIRMED', 'CONFIRMED with evidence must remain CONFIRMED');
  assertEqual(
    (report.findings[0].reason || '').includes('Evidence Law enforced'),
    false,
    'Reason must not indicate enforcement for valid finding'
  );
});

// Test 3: artifact-manager.js writeFindings downgrades CONFIRMED without evidence
test('artifact-manager writeFindings downgrades CONFIRMED without evidence', () => {
  const testDir = join(tmpdir(), `verax-test-evidence-law-${getTimeProvider().now()}`);
  mkdirSync(testDir, { recursive: true });
  
  const paths = {
    runId: 'test-run-123',
    findings: join(testDir, 'findings.json')
  };

  const findings = [
    {
      id: 'test-finding-3',
      type: 'SILENT_FAILURE',
      status: 'CONFIRMED',
      what_happened: 'Test failure',
      what_was_expected: 'Success',
      what_was_observed: 'Failure',
      why_it_matters: 'Breaks functionality'
      // NO evidence field
    }
  ];

  writeFindings(paths, findings);

  const written = JSON.parse(readFileSync(paths.findings, 'utf8'));
  
  assertEqual(written.findings.length, 1, 'Should have 1 finding');
  assertEqual(written.findings[0].status, 'SUSPECTED', 'CONFIRMED without evidence must be downgraded to SUSPECTED');
  assertEqual(
    written.findings[0].reason?.includes('Evidence Law enforced'),
    true,
    'Reason must indicate Evidence Law enforcement'
  );

  rmSync(testDir, { recursive: true, force: true });
});

// Test 4: artifact-manager.js writeFindings preserves CONFIRMED with evidence
test('artifact-manager writeFindings preserves CONFIRMED with evidence', () => {
  const testDir = join(tmpdir(), `verax-test-evidence-law-${getTimeProvider().now()}`);
  mkdirSync(testDir, { recursive: true });
  
  const paths = {
    runId: 'test-run-456',
    findings: join(testDir, 'findings.json')
  };

  const findings = [
    {
      id: 'test-finding-4',
      type: 'SILENT_FAILURE',
      status: 'CONFIRMED',
      what_happened: 'Test failure',
      what_was_expected: 'Success',
      what_was_observed: 'Failure',
      why_it_matters: 'Breaks functionality',
      evidence: {
        domSnapshot: { count: 5 },
        networkLogs: ['log1']
      }
    }
  ];

  writeFindings(paths, findings);

  const written = JSON.parse(readFileSync(paths.findings, 'utf8'));
  
  assertEqual(written.findings.length, 1, 'Should have 1 finding');
  assertEqual(written.findings[0].status, 'CONFIRMED', 'CONFIRMED with evidence must remain CONFIRMED');
  assertEqual(written.findings[0].evidence !== undefined, true, 'Evidence must be preserved');

  rmSync(testDir, { recursive: true, force: true });
});

// Test 5: persistFindingsReport enforces Evidence Law end-to-end
test('persistFindingsReport end-to-end enforcement', () => {
  const testDir = join(tmpdir(), `verax-test-evidence-law-${getTimeProvider().now()}`);
  mkdirSync(testDir, { recursive: true });

  const findings = [
    {
      id: 'test-finding-5',
      type: 'SILENT_FAILURE',
      status: 'CONFIRMED',
      what_happened: 'Test failure',
      what_was_expected: 'Success',
      what_was_observed: 'Failure',
      why_it_matters: 'Breaks functionality'
      // NO evidence
    }
  ];

  const report = buildFindingsReport({
    url: 'https://example.com',
    findings,
    coverageGaps: [],
    detectedAt: '2026-01-18T00:00:00.000Z'
  });

  persistFindingsReport(testDir, report);

  const written = JSON.parse(readFileSync(join(testDir, 'findings.json'), 'utf8'));
  
  assertEqual(written.findings.length, 1, 'Should have 1 finding');
  assertEqual(written.findings[0].status, 'SUSPECTED', 'CONFIRMED without evidence must be downgraded to SUSPECTED');

  rmSync(testDir, { recursive: true, force: true });
});

// Test 6: Empty evidence object also triggers downgrade
test('Empty evidence object triggers downgrade', () => {
  const findings = [
    {
      id: 'test-finding-6',
      type: 'SILENT_FAILURE',
      status: 'CONFIRMED',
      what_happened: 'Test failure',
      what_was_expected: 'Success',
      what_was_observed: 'Failure',
      why_it_matters: 'Breaks functionality',
      evidence: {} // Empty evidence
    }
  ];

  const report = buildFindingsReport({
    url: 'https://example.com',
    findings,
    coverageGaps: [],
    detectedAt: '2026-01-18T00:00:00.000Z'
  });

  assertEqual(report.findings.length, 1, 'Should have 1 finding');
  assertEqual(report.findings[0].status, 'SUSPECTED', 'CONFIRMED with empty evidence must be downgraded to SUSPECTED');
});

// Test 7: SUSPECTED findings are not affected
test('SUSPECTED findings pass through unchanged', () => {
  const findings = [
    {
      id: 'test-finding-7',
      type: 'SILENT_FAILURE',
      status: 'SUSPECTED',
      what_happened: 'Test failure',
      what_was_expected: 'Success',
      what_was_observed: 'Failure',
      why_it_matters: 'Breaks functionality'
      // NO evidence (but status is SUSPECTED already)
    }
  ];

  const report = buildFindingsReport({
    url: 'https://example.com',
    findings,
    coverageGaps: [],
    detectedAt: '2026-01-18T00:00:00.000Z'
  });

  assertEqual(report.findings.length, 1, 'Should have 1 finding');
  assertEqual(report.findings[0].status, 'SUSPECTED', 'SUSPECTED status must remain SUSPECTED');
  assertEqual(
    (report.findings[0].reason || '').includes('Evidence Law enforced'),
    false,
    'Reason must not indicate enforcement for already-SUSPECTED finding'
  );
});

// Run all tests
console.log('═══════════════════════════════════════════════════════════');
console.log('EVIDENCE LAW WRITE ENFORCEMENT CONTRACT');
console.log('═══════════════════════════════════════════════════════════\n');

for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
    results.passed++;
  } catch (err) {
    console.log(`✗ FAIL: ${name}`);
    console.log(`  Error: ${err.message}\n`);
    results.failed++;
  }
}

console.log('\n───────────────────────────────────────────────────────────');
console.log('Summary:');
console.log(`  Passed: ${results.passed}`);
console.log(`  Failed: ${results.failed}`);
console.log('');

if (results.failed === 0) {
  console.log('✓ Evidence Law enforcement is locked at write boundary\n');
  console.log('Enforcement Locations:');
  console.log('  1. src/verax/detect/findings-writer.js → buildFindingsReport()');
  console.log('  2. src/verax/shared/artifact-manager.js → writeFindings()');
  console.log('');
  console.log('Guarantee:');
  console.log('  CONFIRMED findings without evidence cannot be written to disk.');
  console.log('  They are automatically downgraded to SUSPECTED with reason annotation.');
  console.log('');
  process.exit(0);
} else {
  console.log('✗ Evidence Law enforcement is BROKEN\n');
  process.exit(1);
}





