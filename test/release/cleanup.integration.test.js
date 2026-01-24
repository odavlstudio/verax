/**
 * Cleanup Integration Tests (PHASE 5.8)
 *
 * Validates retention and hygiene engine behavior.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';
import {
  loadRuns,
  classifyRun,
  buildCleanupPlan,
  executeCleanup,
  summarizeCleanup,
} from '../../src/verax/cleanup-engine.js';

function createTestRun(runsDir, runId, status = 'COMPLETED', findingsCounts = { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 }) {
  const runDir = join(runsDir, runId);
  mkdirSync(runDir, { recursive: true });

  // Create run-meta.json
  const timestamp = runId.replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ':$1:$2.$3Z');
  writeFileSync(join(runDir, 'run-meta.json'), JSON.stringify({
    veraxVersion: '5.8.0',
    url: 'https://example.com',
    startedAt: timestamp,
  }));

  // Create summary.json
  writeFileSync(join(runDir, 'summary.json'), JSON.stringify({
    status,
    url: 'https://example.com',
    findingsCounts,
  }));

  return runDir;
}

test('[cleanup] loadRuns returns empty array for non-existent directory', () => {
  const result = loadRuns('/non/existent/path');
  assert.deepEqual(result, [], 'should return empty array');
});

test('[cleanup] loadRuns returns sorted runs (oldest first)', (t) => {
  const testDir = join(tmpdir(), `verax-test-loadruns-${getTimeProvider().now()}`);
  const runsDir = join(testDir, 'runs');

  mkdirSync(runsDir, { recursive: true });

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  // Create runs in non-chronological order
  createTestRun(runsDir, '2025-01-10T12-00-00-000Z');
  createTestRun(runsDir, '2025-01-10T10-00-00-000Z');
  createTestRun(runsDir, '2025-01-10T11-00-00-000Z');

  const runs = loadRuns(runsDir);

  assert.equal(runs.length, 3, 'should load 3 runs');
  assert.equal(runs[0].runId, '2025-01-10T10-00-00-000Z', 'first run should be oldest');
  assert.equal(runs[1].runId, '2025-01-10T11-00-00-000Z', 'second run should be middle');
  assert.equal(runs[2].runId, '2025-01-10T12-00-00-000Z', 'third run should be newest');
});

test('[cleanup] loadRuns extracts metadata correctly', (t) => {
  const testDir = join(tmpdir(), `verax-test-metadata-${getTimeProvider().now()}`);
  const runsDir = join(testDir, 'runs');

  mkdirSync(runsDir, { recursive: true });

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  createTestRun(runsDir, '2025-01-10T10-00-00-000Z', 'COMPLETED', { HIGH: 2, MEDIUM: 1, LOW: 0, UNKNOWN: 0 });

  const runs = loadRuns(runsDir);

  assert.equal(runs.length, 1);
  assert.equal(runs[0].status, 'COMPLETED');
  assert.equal(runs[0].hasConfirmedFindings, true, 'should detect confirmed findings');
  assert.deepEqual(runs[0].findingsCounts, { HIGH: 2, MEDIUM: 1, LOW: 0, UNKNOWN: 0 });
});

test('[cleanup] classifyRun protects INCOMPLETE runs', () => {
  const run = {
    runId: '2025-01-10T10-00-00-000Z',
    status: 'INCOMPLETE',
    hasConfirmedFindings: false,
  };

  const classification = classifyRun(run);

  assert.equal(classification.canDelete, false, 'INCOMPLETE run should not be deletable');
  assert.equal(classification.protected, true, 'INCOMPLETE run should be protected');
  assert.equal(classification.protectionReason, 'INCOMPLETE');
});

test('[cleanup] classifyRun protects CONFIRMED findings by default', () => {
  const run = {
    runId: '2025-01-10T10-00-00-000Z',
    status: 'COMPLETED',
    hasConfirmedFindings: true,
  };

  const classification = classifyRun(run);

  assert.equal(classification.canDelete, false, 'run with CONFIRMED findings should not be deletable');
  assert.equal(classification.protected, true, 'run with CONFIRMED findings should be protected');
  assert.equal(classification.protectionReason, 'CONFIRMED_FINDINGS');
});

test('[cleanup] classifyRun allows deletion of CONFIRMED findings with explicit flag', () => {
  const run = {
    runId: '2025-01-10T10-00-00-000Z',
    status: 'COMPLETED',
    hasConfirmedFindings: true,
  };

  const classification = classifyRun(run, { allowDeleteConfirmed: true });

  assert.equal(classification.canDelete, true, 'run with CONFIRMED findings should be deletable when flag is set');
  assert.equal(classification.protected, false, 'run should not be protected when flag is set');
});

test('[cleanup] buildCleanupPlan respects keepLast retention', (t) => {
  const testDir = join(tmpdir(), `verax-test-keeplast-${getTimeProvider().now()}`);
  const runsDir = join(testDir, 'runs');

  mkdirSync(runsDir, { recursive: true });

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  // Create 5 runs
  for (let i = 0; i < 5; i++) {
    createTestRun(runsDir, `2025-01-10T${String(10 + i).padStart(2, '0')}-00-00-000Z`, 'COMPLETED');
  }

  const runs = loadRuns(runsDir);
  const plan = buildCleanupPlan(runs, { keepLast: 2 });

  assert.equal(plan.toDelete.length, 3, 'should mark 3 oldest runs for deletion');
  assert.equal(plan.toKeep.length, 2, 'should keep 2 newest runs');
  assert.equal(plan.toDelete[0].runId, '2025-01-10T10-00-00-000Z', 'oldest run should be first to delete');
  assert.equal(plan.toDelete[1].runId, '2025-01-10T11-00-00-000Z', 'second oldest run should be second to delete');
});

test('[cleanup] buildCleanupPlan respects olderThanDays filter', (t) => {
  const testDir = join(tmpdir(), `verax-test-olderthan-${getTimeProvider().now()}`);
  const runsDir = join(testDir, 'runs');

  mkdirSync(runsDir, { recursive: true });

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  // Use VERAX_TEST_TIME for deterministic date if available, otherwise use real time
  const provider = getTimeProvider();
  const nowEpoch = provider.now();
  
  // Helper to convert epoch milliseconds to ISO 8601 string
  // TEST: Allowed to use Date() for test utility functions
  const epochToISO = (epochMs) => {
    // eslint-disable-next-line no-restricted-syntax
    const d = new Date(epochMs);
    const isoString = d.toISOString();
    return isoString;
  };
  
  const oldEpoch = nowEpoch - 10 * 24 * 60 * 60 * 1000; // 10 days ago
  const recentEpoch = nowEpoch - 2 * 24 * 60 * 60 * 1000; // 2 days ago
  
  const old = epochToISO(oldEpoch);
  const recent = epochToISO(recentEpoch);

  const oldRunId = old.replace(/:/g, '-').replace(/\.\d{3}Z$/, '-000Z');
  const recentRunId = recent.replace(/:/g, '-').replace(/\.\d{3}Z$/, '-000Z');

  createTestRun(runsDir, oldRunId, 'COMPLETED');
  createTestRun(runsDir, recentRunId, 'COMPLETED');

  const runs = loadRuns(runsDir);
  const plan = buildCleanupPlan(runs, { keepLast: 0, olderThanDays: 5 });

  assert.equal(plan.toDelete.length, 1, 'should mark 1 old run for deletion');
  assert.equal(plan.toKeep.length, 1, 'should keep 1 recent run');
  assert.equal(plan.toDelete[0].runId, oldRunId, 'old run should be marked for deletion');
});

test('[cleanup] buildCleanupPlan protects INCOMPLETE runs', (t) => {
  const testDir = join(tmpdir(), `verax-test-protect-incomplete-${getTimeProvider().now()}`);
  const runsDir = join(testDir, 'runs');

  mkdirSync(runsDir, { recursive: true });

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  createTestRun(runsDir, '2025-01-10T10-00-00-000Z', 'COMPLETED');
  createTestRun(runsDir, '2025-01-10T11-00-00-000Z', 'INCOMPLETE');
  createTestRun(runsDir, '2025-01-10T12-00-00-000Z', 'COMPLETED');

  const runs = loadRuns(runsDir);
  const plan = buildCleanupPlan(runs, { keepLast: 1 });

  assert.equal(plan.protected.length, 1, 'should protect 1 INCOMPLETE run');
  assert.equal(plan.protected[0].run.runId, '2025-01-10T11-00-00-000Z', 'INCOMPLETE run should be protected');
  assert.equal(plan.protected[0].reason, 'INCOMPLETE', 'protection reason should be INCOMPLETE');
});

test('[cleanup] buildCleanupPlan protects CONFIRMED findings by default', (t) => {
  const testDir = join(tmpdir(), `verax-test-protect-confirmed-${getTimeProvider().now()}`);
  const runsDir = join(testDir, 'runs');

  mkdirSync(runsDir, { recursive: true });

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  createTestRun(runsDir, '2025-01-10T10-00-00-000Z', 'COMPLETED', { HIGH: 1, MEDIUM: 0, LOW: 0, UNKNOWN: 0 });
  createTestRun(runsDir, '2025-01-10T11-00-00-000Z', 'COMPLETED', { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 });

  const runs = loadRuns(runsDir);
  const plan = buildCleanupPlan(runs, { keepLast: 1, allowDeleteConfirmed: false });

  assert.equal(plan.protected.length, 1, 'should protect 1 run with CONFIRMED findings');
  assert.equal(plan.protected[0].run.runId, '2025-01-10T10-00-00-000Z', 'run with findings should be protected');
  assert.equal(plan.protected[0].reason, 'CONFIRMED_FINDINGS');
});

test('[cleanup] buildCleanupPlan allows deletion of CONFIRMED findings with flag', (t) => {
  const testDir = join(tmpdir(), `verax-test-allow-confirmed-${getTimeProvider().now()}`);
  const runsDir = join(testDir, 'runs');

  mkdirSync(runsDir, { recursive: true });

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  createTestRun(runsDir, '2025-01-10T10-00-00-000Z', 'COMPLETED', { HIGH: 1, MEDIUM: 0, LOW: 0, UNKNOWN: 0 });
  createTestRun(runsDir, '2025-01-10T11-00-00-000Z', 'COMPLETED', { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 });

  const runs = loadRuns(runsDir);
  const plan = buildCleanupPlan(runs, { keepLast: 1, allowDeleteConfirmed: true });

  assert.equal(plan.protected.length, 0, 'should not protect runs with CONFIRMED findings when flag is set');
  assert.equal(plan.toDelete.length, 1, 'should mark oldest run for deletion');
});

test('[cleanup] executeCleanup in dry-run mode does not delete files', (t) => {
  const testDir = join(tmpdir(), `verax-test-dryrun-${getTimeProvider().now()}`);
  const runsDir = join(testDir, 'runs');

  mkdirSync(runsDir, { recursive: true });

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  const runDir1 = createTestRun(runsDir, '2025-01-10T10-00-00-000Z', 'COMPLETED');
  const runDir2 = createTestRun(runsDir, '2025-01-10T11-00-00-000Z', 'COMPLETED');

  const runs = loadRuns(runsDir);
  const plan = buildCleanupPlan(runs, { keepLast: 1 });

  const result = executeCleanup(plan, true); // dry-run = true

  assert.equal(result.dryRun, true, 'result should indicate dry-run');
  assert.equal(result.deleted.length, 1, 'should report 1 run would be deleted');
  assert.ok(existsSync(runDir1), 'run directory should still exist after dry-run');
  assert.ok(existsSync(runDir2), 'run directory should still exist after dry-run');
});

test('[cleanup] executeCleanup actually deletes files when dryRun=false', (t) => {
  const testDir = join(tmpdir(), `verax-test-execute-${getTimeProvider().now()}`);
  const runsDir = join(testDir, 'runs');

  mkdirSync(runsDir, { recursive: true });

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  const runDir1 = createTestRun(runsDir, '2025-01-10T10-00-00-000Z', 'COMPLETED');
  const runDir2 = createTestRun(runsDir, '2025-01-10T11-00-00-000Z', 'COMPLETED');

  const runs = loadRuns(runsDir);
  const plan = buildCleanupPlan(runs, { keepLast: 1 });

  const result = executeCleanup(plan, false); // dry-run = false

  assert.equal(result.dryRun, false, 'result should indicate actual execution');
  assert.equal(result.deleted.length, 1, 'should report 1 run deleted');
  assert.ok(!existsSync(runDir1), 'oldest run directory should be deleted');
  assert.ok(existsSync(runDir2), 'newest run directory should still exist');
});

test('[cleanup] summarizeCleanup produces deterministic output', (t) => {
  const testDir = join(tmpdir(), `verax-test-summary-${getTimeProvider().now()}`);
  const runsDir = join(testDir, 'runs');

  mkdirSync(runsDir, { recursive: true });

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  createTestRun(runsDir, '2025-01-10T10-00-00-000Z', 'COMPLETED');
  createTestRun(runsDir, '2025-01-10T11-00-00-000Z', 'INCOMPLETE');
  createTestRun(runsDir, '2025-01-10T12-00-00-000Z', 'COMPLETED', { HIGH: 1, MEDIUM: 0, LOW: 0, UNKNOWN: 0 });

  const runs = loadRuns(runsDir);
  const plan = buildCleanupPlan(runs, { keepLast: 1 });
  const result = executeCleanup(plan, true);
  const summary = summarizeCleanup(plan, result);

  assert.equal(summary.operation, 'DRY_RUN');
  assert.equal(summary.totalRuns, 3);
  assert.equal(summary.protected, 2, 'should protect INCOMPLETE and CONFIRMED runs');
  assert.ok(Array.isArray(summary.deletedRuns), 'deletedRuns should be an array');
  assert.ok(Array.isArray(summary.keptRuns), 'keptRuns should be an array');
  assert.ok(Array.isArray(summary.protectedRuns), 'protectedRuns should be an array');

  // Verify sorting
  const deletedSorted = [...summary.deletedRuns].sort();
  assert.deepEqual(summary.deletedRuns, deletedSorted, 'deletedRuns should be sorted');

  const keptSorted = [...summary.keptRuns].sort();
  assert.deepEqual(summary.keptRuns, keptSorted, 'keptRuns should be sorted');
});

test('[cleanup] determinism: multiple runs produce identical plans', (t) => {
  const testDir = join(tmpdir(), `verax-test-determinism-${getTimeProvider().now()}`);
  const runsDir = join(testDir, 'runs');

  mkdirSync(runsDir, { recursive: true });

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  // Create runs in random order
  createTestRun(runsDir, '2025-01-10T15-00-00-000Z', 'COMPLETED');
  createTestRun(runsDir, '2025-01-10T10-00-00-000Z', 'COMPLETED');
  createTestRun(runsDir, '2025-01-10T12-00-00-000Z', 'INCOMPLETE');
  createTestRun(runsDir, '2025-01-10T11-00-00-000Z', 'COMPLETED', { HIGH: 1, MEDIUM: 0, LOW: 0, UNKNOWN: 0 });

  const runs1 = loadRuns(runsDir);
  const plan1 = buildCleanupPlan(runs1, { keepLast: 2 });

  const runs2 = loadRuns(runsDir);
  const plan2 = buildCleanupPlan(runs2, { keepLast: 2 });

  assert.deepEqual(plan1.toDelete.map(r => r.runId), plan2.toDelete.map(r => r.runId), 'delete lists should be identical');
  assert.deepEqual(plan1.toKeep.map(r => r.runId), plan2.toKeep.map(r => r.runId), 'keep lists should be identical');
  assert.deepEqual(plan1.protected.map(p => p.run.runId), plan2.protected.map(p => p.run.runId), 'protected lists should be identical');
});
