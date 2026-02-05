import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyRun } from '../../src/verax/core/artifacts/verifier.js';
import { ARTIFACT_REGISTRY } from '../../src/verax/core/artifacts/registry.js';
import { FINDING_STATUS } from '../../src/verax/core/contracts/types.js';

/**
 * Create a minimal valid run directory structure
 */
function createValidRunDir(baseDir) {
  const runDir = join(baseDir, 'test-run');
  mkdirSync(runDir, { recursive: true });
  
  // Create run.status.json
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.runStatus.filename), JSON.stringify({
    contractVersion: 1,
    artifactVersions: {
      runStatus: 1,
      runMeta: 1,
      summary: 1,
      findings: 1,
      learn: 1,
      observe: 1,
      project: 1,
      traces: 1,
      evidence: 1,
      scanSummary: 1,
      determinismReport: 1,
      evidenceIntent: 1,
      guardrailsReport: 1,
      confidenceReport: 1,
      determinismContract: 1
    },
    status: 'SUCCESS',
    lifecycle: 'FINAL',
    runId: 'test123',
    startedAt: '2024-01-01T00:00:00.000Z',
    completedAt: '2024-01-01T00:01:00.000Z'
  }, null, 2));
  
  // Create run.meta.json
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.runMeta.filename), JSON.stringify({
    contractVersion: 1,
    artifactVersions: {},
    veraxVersion: '1.0.0',
    nodeVersion: process.version,
    platform: process.platform
  }, null, 2));
  
  // Create summary.json
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.summary.filename), JSON.stringify({
    contractVersion: 1,
    artifactVersions: {},
    runId: 'test123',
    status: 'SUCCESS',
    startedAt: '2024-01-01T00:00:00.000Z',
    completedAt: '2024-01-01T00:01:00.000Z',
    url: 'http://example.com'
  }, null, 2));
  
  // Create findings.json with valid findings
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.findings.filename), JSON.stringify({
    version: 1,
    contractVersion: 1,
    artifactVersions: {},
    detectedAt: '2024-01-01T00:01:00.000Z',
    url: 'http://example.com',
    findings: [
      {
        type: 'network_silent_failure',
        status: FINDING_STATUS.CONFIRMED,
        interaction: { type: 'click', selector: 'button' },
        evidence: {
          hasNetworkActivity: true,
          networkRequests: [{ url: 'http://api.example.com', status: 500 }]
        },
        confidence: { level: 'HIGH', score: 90 },
        signals: { impact: 'HIGH', userRisk: 'BLOCKS', ownership: 'FRONTEND', grouping: {} },
        what_happened: 'Network request failed silently',
        what_was_expected: 'Request should succeed',
        what_was_observed: 'Request returned 500 with no user feedback'
      }
    ],
    enforcement: {
      droppedCount: 0,
      downgradedCount: 0,
      downgrades: []
    }
  }, null, 2));
  
  // Create learn.json
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.learn.filename), JSON.stringify({
    contractVersion: 1,
    artifactVersions: {}
  }, null, 2));
  
  // Create observe.json
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.observe.filename), JSON.stringify({
    contractVersion: 1,
    artifactVersions: {}
  }, null, 2));
  
  // Create project.json
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.project.filename), JSON.stringify({
    contractVersion: 1,
    artifactVersions: {}
  }, null, 2));
  
  // Create traces.jsonl
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.traces.filename), '{"type":"trace"}\n');
  
  // Create scan-summary.json
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.scanSummary.filename), JSON.stringify({
    contractVersion: 1,
    artifactVersions: {},
    scannedAt: '2024-01-01T00:01:00.000Z',
    url: 'http://example.com',
    projectType: 'static'
  }, null, 2));
  
  // Create evidence.intent.json
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.evidenceIntent.filename), JSON.stringify({
    version: 1,
    contractVersion: 1,
    artifactVersions: {},
    entries: []
  }, null, 2));
  
  // Create guardrails.report.json
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.guardrailsReport.filename), JSON.stringify({
    version: 1,
    contractVersion: 1,
    artifactVersions: {},
    summary: {
      totalFindings: 0,
      byFinalDecision: {}
    },
    perFinding: {}
  }, null, 2));
  
  // Create confidence.report.json
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.confidenceReport.filename), JSON.stringify({
    version: 1,
    contractVersion: 1,
    artifactVersions: {},
    summary: {
      totalFindings: 0,
      byConfidenceLevel: {},
      byTruthStatus: {}
    },
    perFinding: {}
  }, null, 2));
  
  // Create determinism.report.json
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.determinismReport.filename), JSON.stringify({
    contractVersion: 1,
    artifactVersions: {},
    reports: []
  }, null, 2));
  
  // Create determinism.contract.json
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.determinismContract.filename), JSON.stringify({
    contractVersion: 1,
    artifactVersions: {},
    contracts: []
  }, null, 2));

  // Create coverage.json
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.coverage.filename), JSON.stringify({
    contractVersion: 1,
    artifactVersions: {},
    coverage: []
  }, null, 2));

  // Create judgments.json
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.judgments.filename), JSON.stringify({
    contractVersion: 1,
    artifactVersions: {},
    judgments: []
  }, null, 2));

  // Create run completion sentinel (required)
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.runCompleteSentinel.filename), 'complete\n');

  // Create silence.report.json (required)
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.silenceReport.filename), JSON.stringify({
    schemaVersion: 1,
    contractVersion: 1,
    runId: 'test123',
    totalSilences: 0,
    byType: {
      NO_EXPECTATION: 0,
      POLICY_BLOCKED: 0,
      AUTH_REQUIRED: 0,
      NETWORK_BLOCKED: 0,
      TIMEOUT: 0,
      DOM_NOT_FOUND: 0,
      AMBIGUOUS_MATCH: 0,
      RUNTIME_ERROR: 0,
    },
    entries: [],
    source: { origin: 'unified-pipeline', explicit: true },
    generatedAt: '2024-01-01T00:01:00.000Z',
  }, null, 2));
  
  // Create evidence directory
  mkdirSync(join(runDir, ARTIFACT_REGISTRY.evidence.filename), { recursive: true });
  
  return runDir;
}

test('fully valid run → VALID', () => {
  const baseDir = mkdtempSync(join(tmpdir(), 'verax-verifier-'));
  const runDir = createValidRunDir(baseDir);
  
  const verdict = verifyRun(runDir);
  
  if (!verdict.ok) {
    console.error('VERDICT:', JSON.stringify(verdict, null, 2));
  }
  
  assert.strictEqual(verdict.ok, true, 'Verdict should be ok');
  assert.strictEqual(verdict.errors.length, 0, 'Should have no errors');
  assert.ok(verdict.enforcementSummary, 'Should have enforcement summary');
  assert.strictEqual(verdict.enforcementSummary.totalFindings, 1, 'Should have 1 finding');
  assert.strictEqual(verdict.enforcementSummary.confirmedFindings, 1, 'Should have 1 confirmed finding');
});

test('missing artifact → INVALID', () => {
  const baseDir = mkdtempSync(join(tmpdir(), 'verax-verifier-'));
  const runDir = createValidRunDir(baseDir);
  
  // Delete findings.json
  unlinkSync(join(runDir, ARTIFACT_REGISTRY.findings.filename));
  
  const verdict = verifyRun(runDir);
  
  assert.strictEqual(verdict.ok, false, 'Verdict should not be ok');
  assert.ok(verdict.errors.length > 0, 'Should have errors');
  assert.ok(verdict.missingArtifacts.length > 0, 'Should report missing artifacts');
  assert.ok(verdict.missingArtifacts.some(a => a.filename === ARTIFACT_REGISTRY.findings.filename), 
    'Should report findings.json as missing');
});

test('artifact without contractVersion → INVALID', () => {
  const baseDir = mkdtempSync(join(tmpdir(), 'verax-verifier-'));
  const runDir = createValidRunDir(baseDir);
  
  // Write findings.json without contractVersion
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.findings.filename), JSON.stringify({
    version: 1,
    findings: []
  }, null, 2));
  
  const verdict = verifyRun(runDir);
  
  assert.strictEqual(verdict.ok, false, 'Verdict should not be ok');
  assert.ok(verdict.errors.length > 0, 'Should have errors');
  assert.ok(verdict.contractVersionMismatches.length > 0, 'Should report contract version issues');
  assert.ok(verdict.errors.some(e => e.includes('contractVersion')), 
    'Should report missing contractVersion');
});

test('findings with invalid CONFIRMED entry → INVALID', () => {
  const baseDir = mkdtempSync(join(tmpdir(), 'verax-verifier-'));
  const runDir = createValidRunDir(baseDir);
  
  // Write findings.json with CONFIRMED finding but no evidence
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.findings.filename), JSON.stringify({
    version: 1,
    contractVersion: 1,
    artifactVersions: {},
    detectedAt: '2024-01-01T00:01:00.000Z',
    url: 'http://example.com',
    findings: [
      {
        type: 'network_silent_failure',
        status: FINDING_STATUS.CONFIRMED,
        interaction: { type: 'click', selector: 'button' },
        evidence: {}, // Empty evidence - violates Evidence Law
        confidence: { level: 'HIGH', score: 90 },
        signals: { impact: 'HIGH', userRisk: 'BLOCKS', ownership: 'FRONTEND', grouping: {} },
        what_happened: 'Network request failed silently',
        what_was_expected: 'Request should succeed',
        what_was_observed: 'Request returned 500 with no user feedback'
      }
    ],
    enforcement: {
      droppedCount: 0,
      downgradedCount: 0,
      downgrades: []
    }
  }, null, 2));
  
  const verdict = verifyRun(runDir);
  
  assert.strictEqual(verdict.ok, false, 'Verdict should not be ok');
  assert.ok(verdict.errors.length > 0, 'Should have errors');
  assert.ok(verdict.errors.some(e => e.includes('Evidence Law violation') || e.includes('insufficient evidence')), 
    'Should report Evidence Law violation');
  assert.strictEqual(verdict.enforcementSummary.findingsWithoutEvidence, 1, 
    'Should count finding without evidence');
});

test('registry mismatch → INVALID', () => {
  const baseDir = mkdtempSync(join(tmpdir(), 'verax-verifier-'));
  const runDir = createValidRunDir(baseDir);
  
  // Write findings.json with wrong contractVersion
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.findings.filename), JSON.stringify({
    version: 1,
    contractVersion: 999, // Wrong version
    artifactVersions: {},
    findings: []
  }, null, 2));
  
  const verdict = verifyRun(runDir);
  
  assert.strictEqual(verdict.ok, false, 'Verdict should not be ok');
  assert.ok(verdict.errors.length > 0, 'Should have errors');
  assert.ok(verdict.contractVersionMismatches.length > 0, 'Should report contract version mismatch');
  assert.ok(verdict.contractVersionMismatches.some(m => m.found === 999), 
    'Should report the wrong version found');
});

test('only minor mismatch → VALID_WITH_WARNINGS', () => {
  const baseDir = mkdtempSync(join(tmpdir(), 'verax-verifier-'));
  const runDir = createValidRunDir(baseDir);
  
  // Write run.status.json with minor artifactVersions mismatch (warning, not error)
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.runStatus.filename), JSON.stringify({
    contractVersion: 1,
    artifactVersions: {
      runStatus: 1,
      runMeta: 1,
      summary: 1,
      findings: 1,
      learn: 1,
      observe: 1,
      project: 1,
      traces: 1,
      evidence: 1,
      scanSummary: 999 // Minor mismatch - should be warning
    },
    status: 'SUCCESS',
    lifecycle: 'FINAL',
    runId: 'test123',
    startedAt: '2024-01-01T00:00:00.000Z',
    completedAt: '2024-01-01T00:01:00.000Z'
  }, null, 2));
  
  const verdict = verifyRun(runDir);
  
  assert.strictEqual(verdict.ok, true, 'Verdict should be ok (warnings are non-blocking)');
  assert.strictEqual(verdict.errors.length, 0, 'Should have no errors');
  assert.ok(verdict.warnings.length > 0, 'Should have warnings');
});

test('invalid JSON → INVALID', () => {
  const baseDir = mkdtempSync(join(tmpdir(), 'verax-verifier-'));
  const runDir = createValidRunDir(baseDir);
  
  // Write invalid JSON to findings.json
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.findings.filename), '{ invalid json }');
  
  const verdict = verifyRun(runDir);
  
  assert.strictEqual(verdict.ok, false, 'Verdict should not be ok');
  assert.ok(verdict.errors.length > 0, 'Should have errors');
  assert.ok(verdict.invalidArtifacts.length > 0, 'Should report invalid artifacts');
  assert.ok(verdict.errors.some(e => e.includes('invalid JSON') || e.includes('JSON')), 
    'Should report JSON parsing error');
});

test('missing required fields in findings → INVALID', () => {
  const baseDir = mkdtempSync(join(tmpdir(), 'verax-verifier-'));
  const runDir = createValidRunDir(baseDir);
  
  // Write findings.json with missing required fields
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.findings.filename), JSON.stringify({
    version: 1,
    contractVersion: 1,
    artifactVersions: {},
    findings: [
      {
        type: 'network_silent_failure',
        // Missing: what_happened, what_was_expected, what_was_observed
        status: FINDING_STATUS.CONFIRMED,
        evidence: { hasNetworkActivity: true }
      }
    ]
  }, null, 2));
  
  const verdict = verifyRun(runDir);
  
  assert.strictEqual(verdict.ok, false, 'Verdict should not be ok');
  assert.ok(verdict.errors.length > 0, 'Should have errors');
  assert.ok(verdict.errors.some(e => e.includes('what_happened') || 
    e.includes('what_was_expected') || e.includes('what_was_observed')), 
    'Should report missing required fields');
});

test('evidence directory missing → INVALID (required)', () => {
  const baseDir = mkdtempSync(join(tmpdir(), 'verax-verifier-'));
  const runDir = createValidRunDir(baseDir);
  
  // Remove evidence directory
  rmdirSync(join(runDir, ARTIFACT_REGISTRY.evidence.filename));
  
  const verdict = verifyRun(runDir);
  
  assert.strictEqual(verdict.ok, false, 'Verdict should not be ok (evidence directory is required)');
  assert.ok(verdict.errors.length > 0, 'Should have errors about missing required artifacts');
  assert.ok(verdict.missingArtifacts.some(a => a.filename === ARTIFACT_REGISTRY.evidence.filename), 'Should report evidence directory missing');
});

test('enforcement summary is computed correctly', () => {
  const baseDir = mkdtempSync(join(tmpdir(), 'verax-verifier-'));
  const runDir = createValidRunDir(baseDir);
  
  // Write findings.json with mix of CONFIRMED and SUSPECTED
  writeFileSync(join(runDir, ARTIFACT_REGISTRY.findings.filename), JSON.stringify({
    version: 1,
    contractVersion: 1,
    artifactVersions: {},
    detectedAt: '2024-01-01T00:01:00.000Z',
    url: 'http://example.com',
    findings: [
      {
        type: 'network_silent_failure',
        status: FINDING_STATUS.CONFIRMED,
        interaction: { type: 'click', selector: 'button1' },
        evidence: { hasNetworkActivity: true },
        confidence: { level: 'HIGH', score: 90 },
        signals: { impact: 'HIGH', userRisk: 'BLOCKS', ownership: 'FRONTEND', grouping: {} },
        what_happened: 'Request failed',
        what_was_expected: 'Request should succeed',
        what_was_observed: 'Request returned 500'
      },
      {
        type: 'network_silent_failure',
        status: FINDING_STATUS.SUSPECTED,
        interaction: { type: 'click', selector: 'button2' },
        evidence: {},
        confidence: { level: 'MEDIUM', score: 60 },
        signals: { impact: 'MEDIUM', userRisk: 'CONFUSES', ownership: 'FRONTEND', grouping: {} },
        what_happened: 'Request may have failed',
        what_was_expected: 'Request should succeed',
        what_was_observed: 'No response observed'
      }
    ],
    enforcement: {
      droppedCount: 1,
      downgradedCount: 1,
      downgrades: []
    }
  }, null, 2));
  
  const verdict = verifyRun(runDir);
  
  assert.strictEqual(verdict.ok, true, 'Verdict should be ok');
  assert.strictEqual(verdict.enforcementSummary.totalFindings, 2, 'Should have 2 findings');
  assert.strictEqual(verdict.enforcementSummary.confirmedFindings, 1, 'Should have 1 confirmed');
  assert.strictEqual(verdict.enforcementSummary.suspectedFindings, 1, 'Should have 1 suspected');
  assert.strictEqual(verdict.enforcementSummary.enforcementApplied, true, 'Enforcement should be applied');
});


