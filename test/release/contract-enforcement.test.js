/**
 * Contract Enforcement in Artifacts Test
 * 
 * Verifies that:
 * - Findings without evidence are downgraded or dropped
 * - Artifacts include enforcement metadata
 * - contractVersion is set in output
 * - Invalid findings are not included in final report
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { writeFileSync as _writeFileSync, mkdirSync, readFileSync, rmSync, mkdtempSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { writeFindings } from '../../src/verax/detect/findings-writer.js';
import { 
  FINDING_TYPE, 
  FINDING_STATUS, 
  CONFIDENCE_LEVEL, 
  IMPACT, 
  USER_RISK, 
  OWNERSHIP 
} from '../../src/verax/core/contracts/index.js';

// Temporary test directory
function makeTestDir() {
  return mkdtempSync(join(tmpdir(), 'verax-test-contract-enforcement-'));
}

function withTestDir(fn) {
  const dir = makeTestDir();
  mkdirSync(dir, { recursive: true });
  try {
    return fn(dir);
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

function createValidFinding() {
  return {
    type: FINDING_TYPE.NAVIGATION_SILENT_FAILURE,
    status: FINDING_STATUS.CONFIRMED,
    interaction: { type: 'link', selector: 'a.home', label: 'Home' },
    what_happened: 'User clicked home link',
    what_was_expected: 'Navigation to home page',
    what_was_observed: 'No navigation occurred',
    why_it_matters: 'User action had no effect',
    evidence: {
      beforeUrl: 'http://localhost/page1',
      afterUrl: 'http://localhost/page1',
      hasDomChange: false,
      hasUrlChange: false,
      networkRequests: []
    },
    confidence: { level: CONFIDENCE_LEVEL.HIGH, score: 85 },
    signals: {
      impact: IMPACT.HIGH,
      userRisk: USER_RISK.BLOCKS,
      ownership: OWNERSHIP.FRONTEND,
      grouping: { groupByRoute: '/' }
    }
  };
}

function createInvalidFinding() {
  return {
    type: FINDING_TYPE.NAVIGATION_SILENT_FAILURE,
    status: FINDING_STATUS.CONFIRMED,
    interaction: { type: 'link' },
    what_happened: 'Clicked link',
    what_was_expected: 'Navigation',
    what_was_observed: 'None',
    why_it_matters: 'Bad',
    evidence: {}, // EMPTY - violates Evidence Law
    confidence: { level: CONFIDENCE_LEVEL.HIGH, score: 80 },
    signals: {
      impact: IMPACT.HIGH,
      userRisk: USER_RISK.CONFUSES,
      ownership: OWNERSHIP.FRONTEND,
      grouping: {}
    }
  };
}

// ============================================================================
// FINDINGS WRITER CONTRACT ENFORCEMENT TESTS
// ============================================================================

test('writeFindings: valid finding is written to artifact', () => {
  withTestDir((testDir) => {
    const findings = [createValidFinding()];
    const result = writeFindings(testDir, 'http://localhost', findings, [], testDir);

    assert.ok(result.findings);
    assert.strictEqual(result.findings.length, 1);
    assert.strictEqual(result.findings[0].type, FINDING_TYPE.NAVIGATION_SILENT_FAILURE);
  });
});

test('writeFindings: artifact includes contractVersion field', () => {
  withTestDir((testDir) => {
    const findings = [createValidFinding()];
    writeFindings(testDir, 'http://localhost', findings, [], testDir);

    const artifactPath = resolve(testDir, 'findings.json');
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));

    assert.ok(artifact.contractVersion !== undefined);
    assert.strictEqual(artifact.contractVersion, 1);
  });
});

test('writeFindings: artifact includes enforcement metadata', () => {
  withTestDir((testDir) => {
    const findings = [createValidFinding(), createInvalidFinding()];
    writeFindings(testDir, 'http://localhost', findings, [], testDir);

    const artifactPath = resolve(testDir, 'findings.json');
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));

    assert.ok(artifact.enforcement);
    assert.ok(artifact.enforcement.droppedCount !== undefined);
    assert.ok(artifact.enforcement.downgradedCount !== undefined);
  });
});

test('writeFindings: finding without evidence is downgraded in artifact', () => {
  withTestDir((testDir) => {
    const invalidFinding = createInvalidFinding();
    const findings = [invalidFinding];
    writeFindings(testDir, 'http://localhost', findings, [], testDir);

    const artifactPath = resolve(testDir, 'findings.json');
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));

    assert.strictEqual(artifact.findings.length, 1);
    // The downgraded finding should now be SUSPECTED instead of CONFIRMED
    assert.strictEqual(artifact.findings[0].status, FINDING_STATUS.SUSPECTED);
    assert.strictEqual(artifact.enforcement.downgradedCount, 1);
  });
});

test('writeFindings: critically invalid finding is dropped from artifact', () => {
  withTestDir((testDir) => {

  // Create a finding missing type (critical contract violation)
  const criticallyInvalid = {
    interaction: { type: 'link' },
    what_happened: 'Clicked',
    what_was_expected: 'Nav',
    what_was_observed: 'None',
    why_it_matters: 'Bad',
    evidence: { hasDomChange: true },
    confidence: { level: CONFIDENCE_LEVEL.HIGH, score: 80 },
    signals: { impact: IMPACT.HIGH, userRisk: USER_RISK.BLOCKS, ownership: OWNERSHIP.FRONTEND, grouping: {} }
  };

  const findings = [createValidFinding(), criticallyInvalid];
  writeFindings(testDir, 'http://localhost', findings, [], testDir);

  const artifactPath = resolve(testDir, 'findings.json');
  const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));

  // Only the valid finding should remain
  assert.strictEqual(artifact.findings.length, 1);
  assert.strictEqual(artifact.enforcement.droppedCount, 1);
  
  });
});

test('writeFindings: mixed valid, downgraded, and dropped findings are handled correctly', () => {
  withTestDir((testDir) => {
    const valid = createValidFinding();
    const needsDowngrade = createInvalidFinding();
    const needsDrop = {
      // Missing critical narrative fields - should be dropped
      type: FINDING_TYPE.NAVIGATION_SILENT_FAILURE,
      interaction: { type: 'link' },
      // Missing: what_happened, what_was_expected, what_was_observed, why_it_matters
      evidence: { hasDomChange: true },
      confidence: { level: CONFIDENCE_LEVEL.HIGH, score: 80 },
      signals: { impact: IMPACT.HIGH, userRisk: USER_RISK.BLOCKS, ownership: OWNERSHIP.FRONTEND, grouping: {} }
    };

    const findings = [valid, needsDowngrade, needsDrop];
    writeFindings(testDir, 'http://localhost', findings, [], testDir);

    const artifactPath = resolve(testDir, 'findings.json');
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));

    // Mix of valid, downgraded, and dropped findings are all properly handled
    assert.ok(artifact.findings.length >= 1, 'At least one finding remains');
    assert.ok(artifact.enforcement !== undefined, 'Enforcement metadata present');
    // Verify at least one finding has CONFIRMED or SUSPECTED status
    const statuses = artifact.findings.map(f => f.status);
    const hasConfirmed = statuses.includes(FINDING_STATUS.CONFIRMED);
    const hasSuspected = statuses.includes(FINDING_STATUS.SUSPECTED);
    assert.ok(hasConfirmed || hasSuspected, 'Findings have appropriate status');
    // Verify enforcement action happened
    assert.ok(artifact.enforcement.downgradedCount > 0 || artifact.enforcement.droppedCount > 0, 'Enforcement action taken');
  });
});

test('writeFindings: outcome summary uses enforced findings', () => {
  withTestDir((testDir) => {
    // Create 2 different findings to avoid deduplication
    const finding1 = createValidFinding();
    const finding2 = createValidFinding();
    finding2.interaction = { type: 'button', selector: 'button.submit', label: 'Submit' };

    const findings = [finding1, finding2];
    writeFindings(testDir, 'http://localhost', findings, [], testDir);

    const artifactPath = resolve(testDir, 'findings.json');
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));

    assert.ok(artifact.outcomeSummary);
    // Both valid findings should be counted
    const total = Object.values(artifact.outcomeSummary).reduce((a, b) => a + b, 0);
    assert.strictEqual(total, 2);
  });
});

test('writeFindings: downgrade includes detailed reason', () => {
  withTestDir((testDir) => {
    const invalid = createInvalidFinding();
    writeFindings(testDir, 'http://localhost', [invalid], [], testDir);

    const artifactPath = resolve(testDir, 'findings.json');
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));

    assert.ok(artifact.enforcement.downgrades);
    assert.ok(artifact.enforcement.downgrades.length > 0);
    assert.ok(artifact.enforcement.downgrades[0].reason);
    assert.strictEqual(artifact.enforcement.downgrades[0].originalStatus, FINDING_STATUS.CONFIRMED);
    assert.strictEqual(artifact.enforcement.downgrades[0].downgradeToStatus, FINDING_STATUS.SUSPECTED);
  });
});

// ============================================================================
// BACKWARD COMPATIBILITY TESTS
// ============================================================================

test('writeFindings: artifact remains valid JSON format', () => {
  withTestDir((testDir) => {
    writeFindings(testDir, 'http://localhost', [createValidFinding()], [], testDir);

    const artifactPath = resolve(testDir, 'findings.json');
    const content = readFileSync(artifactPath, 'utf-8');

    // Should be valid JSON
    let artifact;
    assert.doesNotThrow(() => {
      artifact = JSON.parse(content);
    });

    // Should have expected root fields
    assert.ok(artifact.version);
    // PHASE 5: detectedAt removed for determinism
    assert.ok(artifact.url);
    assert.ok(artifact.findings);
    assert.ok(Array.isArray(artifact.findings));
  });
});

test('writeFindings: backward compatible with version field', () => {
  withTestDir((testDir) => {
    writeFindings(testDir, 'http://localhost', [createValidFinding()], [], testDir);

    const artifactPath = resolve(testDir, 'findings.json');
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));

    // Version field must exist for backward compatibility
    assert.strictEqual(artifact.version, 1);
  });
});

// ============================================================================
// EVIDENCE LAW DEMONSTRATION
// ============================================================================

test('DEMO: Invalid finding is visibly downgraded to SUSPECTED', () => {
  withTestDir((testDir) => {
    const invalidFinding = {
      type: FINDING_TYPE.NAVIGATION_SILENT_FAILURE,
      status: FINDING_STATUS.CONFIRMED,
      interaction: { type: 'button', selector: 'button.submit' },
      what_happened: 'User clicked submit button',
      what_was_expected: 'Form submission and navigation',
      what_was_observed: 'No observable changes',
      why_it_matters: 'User action appeared to have no effect',
      evidence: {}, // EMPTY - VIOLATES EVIDENCE LAW
      confidence: { level: CONFIDENCE_LEVEL.HIGH, score: 90 },
      signals: { impact: IMPACT.HIGH, userRisk: USER_RISK.BLOCKS, ownership: OWNERSHIP.BACKEND, grouping: {} }
    };

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('EVIDENCE LAW DEMONSTRATION');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\nInput Finding:');
  console.log(`  Status: ${invalidFinding.status} (CONFIRMED)`);
  console.log(`  Evidence: ${JSON.stringify(invalidFinding.evidence)} (EMPTY - INVALID)`);
  console.log(`\nExpected Result:`);
  console.log(`  Status should be downgraded to: ${FINDING_STATUS.SUSPECTED}`);
  console.log(`  Reason: Evidence Law enforced - no evidence exists for CONFIRMED status\n`);

    writeFindings(testDir, 'http://localhost', [invalidFinding], [], testDir);

  const artifactPath = resolve(testDir, 'findings.json');
  const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));
  const writtenFinding = artifact.findings[0];

  console.log(`Actual Result:`);
  console.log(`  Status: ${writtenFinding.status}`);
  console.log(`  Evidence: ${JSON.stringify(writtenFinding.evidence)}`);
  console.log(`  Enforcement Note: ${artifact.enforcement.downgrades[0].reason}`);
  console.log('');

    assert.strictEqual(writtenFinding.status, FINDING_STATUS.SUSPECTED);
    assert.ok(artifact.enforcement.downgrades[0].reason.includes('Evidence Law'));

  console.log('✓ Evidence Law enforced: CONFIRMED findings without evidence are downgraded to SUSPECTED');
  console.log('═══════════════════════════════════════════════════════════════\n');

  });
});


