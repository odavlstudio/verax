/**
 *  Determinism Mode Tests
 * 
 * Tests for determinism checking and comparison
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  runDeterminismCheck,
  DETERMINISM_VERDICT,
} from '../../src/verax/core/determinism/engine.js';
import {
  normalizeArtifact,
} from '../../src/verax/core/determinism/normalize.js';
import {
  computeFindingIdentity,
} from '../../src/verax/core/determinism/finding-identity.js';
import {
  diffArtifacts,
  DIFF_REASON,
  DIFF_CATEGORY,
} from '../../src/verax/core/determinism/diff.js';

test('Determinism - deterministic fixture run results should be DETERMINISTIC', async () => {
  // Mock run function that returns identical artifacts
  const runFn = async () => {
    const findings = {
      findings: [
        {
          type: 'network_silent_failure',
          severity: 'CONFIRMED',
          confidence: 0.9,
          interaction: {
            type: 'button',
            selector: '#submit-btn',
          },
          evidencePackage: {
            isComplete: true,
            before: {
              screenshot: 'screenshots/before.png',
              url: 'http://localhost:3000/',
            },
            after: {
              screenshot: 'screenshots/after.png',
              url: 'http://localhost:3000/',
            },
          },
        },
      ],
    };
    
    const runStatus = {
      status: 'SUCCESS',
      runId: 'test-run-1',
    };
    
    return {
      runId: 'test-run-1',
      artifacts: {
        findings,
        runStatus,
      },
    };
  };
  
  const result = await runDeterminismCheck(runFn, { runs: 2 });
  
  assert.equal(result.verdict, DETERMINISM_VERDICT.DETERMINISTIC, 'Should be DETERMINISTIC');
  assert.equal(result.summary.totalDiffs, 0, 'Should have no diffs');
  assert.equal(result.summary.stabilityScore, 1.0, 'Should have perfect stability score');
});

test('Determinism - simulate nondeterminism: reorder findings', async () => {
  const findings1 = {
    findings: [
      { type: 'network_silent_failure', severity: 'CONFIRMED', confidence: 0.9 },
      { type: 'route_silent_failure', severity: 'SUSPECTED', confidence: 0.7 },
    ],
  };
  
  const findings2 = {
    findings: [
      { type: 'route_silent_failure', severity: 'SUSPECTED', confidence: 0.7 },
      { type: 'network_silent_failure', severity: 'CONFIRMED', confidence: 0.9 },
    ],
  };
  
  // Normalize should handle reordering
  const normalized1 = normalizeArtifact('findings', findings1);
  const normalized2 = normalizeArtifact('findings', findings2);
  
  // After normalization, they should be identical (sorted)
  assert.equal(normalized1.findings.length, normalized2.findings.length, 'Should have same count');
  assert.equal(normalized1.findings[0].type, normalized2.findings[0].type, 'Should be sorted identically');
});

test('Determinism - simulate nondeterminism: random timestamp fields', async () => {
  const artifact1 = {
    detectedAt: '2024-01-01T00:00:00.000Z',
    timestamp: '2024-01-01T00:00:00.000Z',
    findings: [{ type: 'test' }],
  };
  
  const artifact2 = {
    detectedAt: '2024-01-02T12:34:56.789Z',
    timestamp: '2024-01-02T12:34:56.789Z',
    findings: [{ type: 'test' }],
  };
  
  const normalized1 = normalizeArtifact('findings', artifact1);
  const normalized2 = normalizeArtifact('findings', artifact2);
  
  // Timestamps should be removed
  assert.ok(!normalized1.detectedAt, 'Should remove detectedAt');
  assert.ok(!normalized1.timestamp, 'Should remove timestamp');
  assert.ok(!normalized2.detectedAt, 'Should remove detectedAt');
  assert.ok(!normalized2.timestamp, 'Should remove timestamp');
  
  // After normalization, they should be identical
  assert.deepEqual(normalized1, normalized2, 'Should be identical after normalization');
});

test('Determinism - ensure normalization removes volatile diffs', () => {
  const artifact1 = {
    runId: 'run-123',
    detectedAt: '2024-01-01T00:00:00Z',
    findings: [
      {
        type: 'test',
        confidence: 0.9123456789,
        evidence: {
          before: 'C:\\Users\\test\\screenshots\\before.png',
          after: 'C:\\Users\\test\\screenshots\\after.png',
        },
      },
    ],
  };
  
  const artifact2 = {
    runId: 'run-456',
    detectedAt: '2024-01-02T12:34:56Z',
    findings: [
      {
        type: 'test',
        confidence: 0.9123456788,
        evidence: {
          before: 'D:\\other\\screenshots\\before.png',
          after: 'D:\\other\\screenshots\\after.png',
        },
      },
    ],
  };
  
  const normalized1 = normalizeArtifact('findings', artifact1);
  const normalized2 = normalizeArtifact('findings', artifact2);
  
  // Should remove runId and timestamps
  assert.ok(!normalized1.runId, 'Should remove runId');
  assert.ok(!normalized1.detectedAt, 'Should remove detectedAt');
  assert.ok(!normalized2.runId, 'Should remove runId');
  assert.ok(!normalized2.detectedAt, 'Should remove detectedAt');
  
  // Should normalize paths
  assert.ok(normalized1.findings[0].evidence.before, 'Should preserve evidence presence');
  assert.ok(normalized2.findings[0].evidence.before, 'Should preserve evidence presence');
  
  // Should normalize confidence (round to 3 decimals)
  assert.equal(normalized1.findings[0].confidence, 0.912, 'Should round confidence');
  assert.equal(normalized2.findings[0].confidence, 0.912, 'Should round confidence');
});

test('Determinism - ensure stable finding identity works', () => {
  const finding1 = {
    type: 'network_silent_failure',
    interaction: {
      type: 'button',
      selector: '#submit-btn',
      label: 'Submit',
    },
    expectation: {
      type: 'network_action',
      targetPath: '/api/submit',
      source: {
        file: 'src/App.jsx',
        line: 10,
        astSource: "fetch('/api/submit')",
      },
    },
  };
  
  const finding2 = {
    type: 'network_silent_failure',
    interaction: {
      type: 'button',
      selector: '#submit-btn',
      label: 'Submit',
    },
    expectation: {
      type: 'network_action',
      targetPath: '/api/submit',
      source: {
        file: 'src/App.jsx',
        line: 10,
        astSource: "fetch('/api/submit')",
      },
    },
    // Add volatile fields
    runId: 'run-123',
    timestamp: '2024-01-01T00:00:00Z',
  };
  
  const identity1 = computeFindingIdentity(finding1);
  const identity2 = computeFindingIdentity(finding2);
  
  // Should produce same identity despite volatile fields
  assert.equal(identity1, identity2, 'Should produce same identity');
});

test('Determinism - ensure diff report includes stable reason codes', () => {
  const artifactA = {
    findings: [
      {
        type: 'network_silent_failure',
        severity: 'CONFIRMED',
        confidence: 0.9,
        confidenceReasons: ['PROMISE_PROVEN', 'OBS_NETWORK_FAILURE'],
      },
    ],
  };
  
  const artifactB = {
    findings: [
      {
        type: 'network_silent_failure',
        severity: 'SUSPECTED',
        confidence: 0.7,
        confidenceReasons: ['PROMISE_OBSERVED'],
      },
    ],
  };
  
  const diffs = diffArtifacts(artifactA, artifactB, 'findings');
  
  assert.ok(diffs.length > 0, 'Should have diffs');
  
  // Check for stable reason codes
  for (const diff of diffs) {
    assert.ok(diff.reasonCode, 'Should have reason code');
    assert.ok(Object.values(DIFF_REASON).includes(diff.reasonCode), `Reason code "${diff.reasonCode}" should be stable`);
    assert.ok(Object.values(DIFF_CATEGORY).includes(diff.category), `Category "${diff.category}" should be valid`);
  }
});

test('Determinism - deterministic output for the determinism checker itself', async () => {
  const runFn = async () => {
    return {
      runId: 'test-run',
      artifacts: {
        findings: {
          findings: [{ type: 'test', severity: 'CONFIRMED' }],
        },
      },
    };
  };
  
  // Run twice with same inputs
  const result1 = await runDeterminismCheck(runFn, { runs: 2 });
  const result2 = await runDeterminismCheck(runFn, { runs: 2 });
  
  // Should produce identical results
  assert.equal(result1.verdict, result2.verdict, 'Verdict should be identical');
  assert.equal(result1.summary.totalDiffs, result2.summary.totalDiffs, 'Total diffs should be identical');
  assert.equal(result1.summary.stabilityScore, result2.summary.stabilityScore, 'Stability score should be identical');
});

test('Determinism - forced nondeterminism injection: NON_DETERMINISTIC with correct diff categories', async () => {
  let runCount = 0;
  
  const runFn = async () => {
    runCount++;
    const findings = {
      findings: [
        {
          type: 'network_silent_failure',
          severity: runCount === 1 ? 'CONFIRMED' : 'SUSPECTED', // Different severity
          confidence: runCount === 1 ? 0.9 : 0.7, // Different confidence
          interaction: {
            type: 'button',
            selector: '#submit-btn',
          },
        },
      ],
    };
    
    return {
      runId: `test-run-${runCount}`,
      artifacts: {
        findings,
      },
    };
  };
  
  const result = await runDeterminismCheck(runFn, { runs: 2 });
  
  assert.equal(result.verdict, DETERMINISM_VERDICT.NON_DETERMINISTIC, 'Should be NON_DETERMINISTIC');
  assert.ok(result.summary.totalDiffs > 0, 'Should have diffs');
  assert.ok(result.diffs.length > 0, 'Should have diff objects');
  
  // Check diff categories
  const categories = new Set(result.diffs.map(d => d.category));
  assert.ok(categories.has('FINDINGS'), 'Should have FINDINGS category');
});

test('Determinism - missing evidence dir should be normalized or flagged appropriately', () => {
  const artifact1 = {
    findings: [
      {
        type: 'test',
        evidencePackage: {
          isComplete: true,
          before: { screenshot: 'screenshots/before.png' },
          after: { screenshot: 'screenshots/after.png' },
        },
      },
    ],
  };
  
  const artifact2 = {
    findings: [
      {
        type: 'test',
        evidencePackage: {
          isComplete: false,
          missingEvidence: ['before.screenshot'],
        },
      },
    ],
  };
  
  const normalized1 = normalizeArtifact('findings', artifact1);
  const normalized2 = normalizeArtifact('findings', artifact2);
  
  // Evidence completeness should be preserved
  assert.equal(normalized1.findings[0].evidencePackage.isComplete, true, 'Should preserve completeness');
  assert.equal(normalized2.findings[0].evidencePackage.isComplete, false, 'Should preserve incompleteness');
  
  // Diff should detect the difference
  const diffs = diffArtifacts(normalized1, normalized2, 'findings');
  assert.ok(diffs.length > 0, 'Should detect evidence difference');
  assert.ok(diffs.some(d => d.reasonCode === DIFF_REASON.EVIDENCE_COMPLETENESS_CHANGED || 
                           d.reasonCode === DIFF_REASON.EVIDENCE_MISSING), 
            'Should flag evidence difference');
});


