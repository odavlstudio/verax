/**
 * Gate Integration Tests
 * 
 * Validates enterprise CI release gate behavior.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';
import {
  analyzeRun,
  computeGateDecision,
  generateGateReport,
  writeGateReport,
} from '../../src/verax/gate-engine.js';

function createTestRun(projectRoot, runId, options = {}) {
  const {
    status = 'SUCCESS',
    _exitCode = 0,
    findingsCounts = { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
    stabilityClassification = null,
    triageTrust = null,
    diagnosticsTiming = null,
  } = options;

  const runDir = join(projectRoot, '.verax', 'runs', runId);
  mkdirSync(runDir, { recursive: true });

  // Create run-meta.json
  const timestamp = runId.replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ':$1:$2.$3Z');
  writeFileSync(join(runDir, 'run.meta.json'), JSON.stringify({
    veraxVersion: '5.9.0',
    url: 'https://example.com',
    startedAt: timestamp,
    completedAt: timestamp,
    profile: 'standard',
  }));

  // Create summary.json
  writeFileSync(join(runDir, 'summary.json'), JSON.stringify({
    status,
    url: 'https://example.com',
    findingsCounts,
  }));

  // Create stability.json if requested
  if (stabilityClassification) {
    writeFileSync(join(runDir, 'stability.json'), JSON.stringify({
      classification: stabilityClassification,
      confidence: 0.95,
    }));
  }

  // Create triage.json if requested
  if (triageTrust) {
    writeFileSync(join(runDir, 'triage.json'), JSON.stringify({
      trustLevel: triageTrust,
      recommendations: [],
    }));
  }

  // Create diagnostics.json if requested
  if (diagnosticsTiming) {
    writeFileSync(join(runDir, 'diagnostics.json'), JSON.stringify({
      timing: diagnosticsTiming,
    }));
  }

  return runDir;
}

test('[gate] SUCCESS path: no findings, stable, trusted', async (t) => {
  const testDir = join(tmpdir(), `verax-test-gate-pass-${getTimeProvider().now()}`);
  const runId = '2025-01-22T10-00-00-000Z';

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  createTestRun(testDir, runId, {
    status: 'SUCCESS',
    exitCode: 0,
    findingsCounts: { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
    stabilityClassification: 'STABLE',
    triageTrust: 'HIGH',
  });

  const analysis = await analyzeRun(testDir, runId, { runExitCode: 0 });
  const decision = computeGateDecision(analysis);
  const report = generateGateReport(analysis, decision);

  assert.equal(decision.outcome, 'SUCCESS');
  assert.equal(decision.exitCode, 0);
  assert.equal(report.gate.decision, 'SUCCESS');
  assert.equal(report.findings.hasActionable, false);
});

test('[gate] FAIL_FINDINGS path: actionable findings detected', async (t) => {
  const testDir = join(tmpdir(), `verax-test-gate-findings-${getTimeProvider().now()}`);
  const runId = '2025-01-22T10-00-00-000Z';

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  createTestRun(testDir, runId, {
    status: 'FINDINGS',
    exitCode: 20,
    findingsCounts: { HIGH: 2, MEDIUM: 1, LOW: 0, UNKNOWN: 0 },
    stabilityClassification: 'STABLE',
  });

  const analysis = await analyzeRun(testDir, runId, { runExitCode: 20 });
  const decision = computeGateDecision(analysis);
  const report = generateGateReport(analysis, decision);

  assert.equal(decision.outcome, 'FINDINGS');
  assert.equal(decision.exitCode, 20);
  assert.equal(report.gate.decision, 'FINDINGS');
  assert.equal(report.findings.hasActionable, true);
  assert.equal(report.findings.nonSuppressed.HIGH, 2);
  assert.equal(report.findings.nonSuppressed.MEDIUM, 1);
});

test('[gate] FAIL_INCOMPLETE path: fail-on-incomplete=true', async (t) => {
  const testDir = join(tmpdir(), `verax-test-gate-incomplete-fail-${getTimeProvider().now()}`);
  const runId = '2025-01-22T10-00-00-000Z';

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  createTestRun(testDir, runId, {
    status: 'INCOMPLETE',
    exitCode: 30, // EXIT_CODES.INCOMPLETE
    findingsCounts: { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
  });

  const analysis = await analyzeRun(testDir, runId, { runExitCode: 30, failOnIncomplete: true });
  const decision = computeGateDecision(analysis);

  assert.equal(decision.outcome, 'INCOMPLETE');
  assert.equal(decision.exitCode, 30); // EXIT_CODES.INCOMPLETE
});

test('[gate] INCOMPLETE path when fail-on-incomplete=false', async (t) => {
  const testDir = join(tmpdir(), `verax-test-gate-incomplete-pass-${getTimeProvider().now()}`);
  const runId = '2025-01-22T10-00-00-000Z';

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  createTestRun(testDir, runId, {
    status: 'INCOMPLETE',
    exitCode: 30,
    findingsCounts: { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
  });

  const analysis = await analyzeRun(testDir, runId, { runExitCode: 30, failOnIncomplete: false });
  const decision = computeGateDecision(analysis);

  assert.equal(decision.outcome, 'INCOMPLETE');
  assert.equal(decision.exitCode, 30);
});

test('[gate] UNSTABLE without findings remains SUCCESS (stability is advisory)', { skip: true }, async (t) => {
  const testDir = join(tmpdir(), `verax-test-gate-unstable-${getTimeProvider().now()}`);
  const runId = '2025-01-22T10-00-00-000Z';

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  createTestRun(testDir, runId, {
    status: 'SUCCESS',
    exitCode: 0,
    findingsCounts: { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
    stabilityClassification: 'UNSTABLE',
  });

  const analysis = await analyzeRun(testDir, runId, { runExitCode: 0 });
  const decision = computeGateDecision(analysis);

  assert.equal(decision.outcome, 'SUCCESS');
  assert.equal(decision.exitCode, 0);
});

test('[gate] INVARIANT_VIOLATION path: tool crashed (exit 50)', async (t) => {
  const testDir = join(tmpdir(), `verax-test-gate-crash-${getTimeProvider().now()}`);
  const runId = '2025-01-22T10-00-00-000Z';

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  createTestRun(testDir, runId, {
    status: 'INCOMPLETE',
    exitCode: 50, // EXIT_CODES.INVARIANT_VIOLATION (Vision 1.0)
  });

  const analysis = await analyzeRun(testDir, runId, { runExitCode: 50 });
  const decision = computeGateDecision(analysis);

  assert.equal(decision.outcome, 'INVARIANT_VIOLATION');
  assert.equal(decision.exitCode, 50);
});

test('[gate] FAIL_USAGE path: propagate usage error (exit 64)', async (t) => {
  const testDir = join(tmpdir(), `verax-test-gate-usage-${getTimeProvider().now()}`);
  const runId = '2025-01-22T10-00-00-000Z';

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  createTestRun(testDir, runId, {
    status: 'INCOMPLETE',
    exitCode: 64,
  });

  const analysis = await analyzeRun(testDir, runId, { runExitCode: 64 });
  const decision = computeGateDecision(analysis);

  assert.equal(decision.outcome, 'USAGE_ERROR');
  assert.equal(decision.exitCode, 64);
});

test('[gate] INVARIANT_VIOLATION path: propagate data error (exit 50)', async (t) => {
  const testDir = join(tmpdir(), `verax-test-gate-data-${getTimeProvider().now()}`);
  const runId = '2025-01-22T10-00-00-000Z';

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  createTestRun(testDir, runId, {
    status: 'INCOMPLETE',
    exitCode: 50, // EXIT_CODES.INVARIANT_VIOLATION (Vision 1.0)
  });

  const analysis = await analyzeRun(testDir, runId, { runExitCode: 50 });
  const decision = computeGateDecision(analysis);

  assert.equal(decision.outcome, 'INVARIANT_VIOLATION');
  assert.equal(decision.exitCode, 50);
});

test('[gate] writeGateReport creates gate.json in run directory', async (t) => {
  const testDir = join(tmpdir(), `verax-test-gate-write-${getTimeProvider().now()}`);
  const runId = '2025-01-22T10-00-00-000Z';

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  const runDir = createTestRun(testDir, runId, {
    status: 'SUCCESS',
    findingsCounts: { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
  });

  const analysis = await analyzeRun(testDir, runId, { runExitCode: 0 });
  const decision = computeGateDecision(analysis);
  const report = generateGateReport(analysis, decision);

  writeGateReport(runDir, report);

  const gatePath = join(runDir, 'gate.json');
  assert.ok(existsSync(gatePath), 'gate.json should exist');

  const gateContent = JSON.parse(readFileSync(gatePath, 'utf-8'));
  assert.equal(gateContent.gateVersion, 1);
  assert.equal(gateContent.runId, runId);
  assert.equal(gateContent.gate.decision, 'SUCCESS');
});

test('[gate] determinism: same fixtures produce identical gate.json (except generatedAt)', async (t) => {
  const testDir = join(tmpdir(), `verax-test-gate-determinism-${getTimeProvider().now()}`);
  const runId = '2025-01-22T10-00-00-000Z';

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  createTestRun(testDir, runId, {
    status: 'FINDINGS',
    findingsCounts: { HIGH: 1, MEDIUM: 2, LOW: 0, UNKNOWN: 0 },
    stabilityClassification: 'STABLE',
    triageTrust: 'HIGH',
  });

  const analysis1 = await analyzeRun(testDir, runId, { runExitCode: 20 });
  const decision1 = computeGateDecision(analysis1);
  const report1 = generateGateReport(analysis1, decision1);

  const analysis2 = await analyzeRun(testDir, runId, { runExitCode: 20 });
  const decision2 = computeGateDecision(analysis2);
  const report2 = generateGateReport(analysis2, decision2);

  // Normalize generatedAt
  const normalized1 = { ...report1, generatedAt: 'NORMALIZED' };
  const normalized2 = { ...report2, generatedAt: 'NORMALIZED' };

  assert.deepEqual(normalized1, normalized2, 'gate reports should be identical except for generatedAt');
});

test('[gate] decision priority: INVARIANT_VIOLATION > USAGE_ERROR > INCOMPLETE > FINDINGS > SUCCESS', async (t) => {
  const testDir = join(tmpdir(), `verax-test-gate-priority-${getTimeProvider().now()}`);

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  // Test 1: INVARIANT_VIOLATION has highest priority (even with findings)
  const runId1 = '2025-01-22T10-00-00-000Z';
  createTestRun(testDir, runId1, {
    exitCode: 50, // EXIT_CODES.INVARIANT_VIOLATION (Vision 1.0)
    findingsCounts: { HIGH: 5, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
  });
  const analysis1 = await analyzeRun(testDir, runId1, { runExitCode: 50 });
  const decision1 = computeGateDecision(analysis1);
  assert.equal(decision1.outcome, 'INVARIANT_VIOLATION', 'INVARIANT_VIOLATION should take precedence over findings');

  // Test 2: FINDINGS takes precedence (stability is advisory)
  const runId2 = '2025-01-22T10-01-00-000Z';
  createTestRun(testDir, runId2, {
    exitCode: 20,
    findingsCounts: { HIGH: 1, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
    stabilityClassification: 'UNSTABLE',
  });
  const analysis2 = await analyzeRun(testDir, runId2, { runExitCode: 20 });
  const decision2 = computeGateDecision(analysis2);
  assert.equal(decision2.outcome, 'FINDINGS', 'FINDINGS should be returned for findings');
});

test('[gate] generateGateReport includes all artifact metadata', async (t) => {
  const testDir = join(tmpdir(), `verax-test-gate-metadata-${getTimeProvider().now()}`);
  const runId = '2025-01-22T10-00-00-000Z';

  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  createTestRun(testDir, runId, {
    status: 'FINDINGS',
    findingsCounts: { HIGH: 0, MEDIUM: 1, LOW: 2, UNKNOWN: 0 },
    stabilityClassification: 'STABLE',
    triageTrust: 'MEDIUM',
    diagnosticsTiming: { total: 5000, browser: 3000, analysis: 2000 },
  });

  const analysis = await analyzeRun(testDir, runId, { runExitCode: 20, failOnIncomplete: true });
  const decision = computeGateDecision(analysis);
  const report = generateGateReport(analysis, decision);

  assert.equal(report.gateVersion, 1);
  assert.equal(report.runId, runId);
  assert.equal(report.meta.veraxVersion, '5.9.0');
  assert.equal(report.meta.url, 'https://example.com');
  assert.equal(report.meta.profile, 'standard');
  assert.equal(report.run.status, 'FINDINGS');
  assert.equal(report.run.exitCode, 20);
  assert.deepEqual(report.findings.nonSuppressed, { HIGH: 0, MEDIUM: 1, LOW: 2, UNKNOWN: 0 });
  assert.equal(report.findings.hasActionable, true);
  assert.equal(report.stability.classification, 'STABLE');
  assert.equal(report.stability.available, true);
  assert.equal(report.triage.trustLevel, 'MEDIUM');
  assert.equal(report.triage.available, true);
  assert.deepEqual(report.diagnostics.timing, { total: 5000, browser: 3000, analysis: 2000 });
  assert.equal(report.diagnostics.available, true);
  assert.equal(report.gate.failOnIncomplete, true);
  assert.equal(report.gate.decision, 'FINDINGS');
});
