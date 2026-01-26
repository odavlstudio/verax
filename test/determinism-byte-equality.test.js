/**
 * Vision 1.0 Determinism Contract: Byte-for-Byte Equality
 * 
 * Comprehensive end-to-end test proving that:
 * - Same input → byte-for-byte identical JSON output
 * - Determinism guarantees hold across multiple runs
 * - No behavioral changes from normalization
 */

import test from 'node:test';
import assert from 'node:assert';
import {
  normalizeFindings,
  normalizeSummary,
  normalizeJudgments,
  normalizeKeyOrdering
} from '../src/verax/detect/output-normalizer.js';

// ============================================================================
// Test 1: Findings Artifact Determinism
// ============================================================================

test('Byte-for-Byte: Findings artifacts are identical across runs', () => {
  const findingsInput = {
    version: 1,
    contractVersion: 2,
    url: 'https://example.com/app',
    detectedAt: '2025-01-25T12:34:56.789Z',
    outcomeSummary: {
      SILENT_FAILURE: 3,
      WEAK_PASS: 1,
      PASS: 5
    },
    promiseSummary: {
      form_submit: 2,
      navigate: 4,
      network_action: 3
    },
    findings: [
      {
        id: 'f3',
        type: 'form_unresponsive',
        severity: 'critical',
        confidence: 0.956789,
        promise: { type: 'form_submit', value: 'login' },
        source: { file: 'src/index.js', line: 42, col: 10 },
        evidence: {
          signals: ['console.error', 'no-redirect'],
          observation: 'Form submitted but no success feedback'
        }
      },
      {
        id: 'f1',
        type: 'navigation_silent',
        severity: 'high',
        confidence: 0.876543,
        promise: { type: 'navigate', value: '/dashboard' },
        source: { file: 'src/app.js', line: 15, col: 5 },
        evidence: {
          signals: ['url-change-no-content'],
          observation: 'URL changed but page content not loaded'
        }
      },
      {
        id: 'f2',
        type: 'state_change_silent',
        severity: 'medium',
        confidence: 0.765432,
        promise: { type: 'state_mutation', value: 'isLoading' },
        source: { file: 'src/hooks.js', line: 88, col: 2 },
        evidence: {
          signals: ['state-changed-no-ui-update'],
          observation: 'State changed but UI did not update'
        }
      }
    ],
    coverage: {
      total: 8,
      verified: 5,
      gaps: 3
    }
  };

  // Run normalization multiple times
  const norm1 = normalizeFindings(findingsInput);
  const norm2 = normalizeFindings(findingsInput);
  const norm3 = normalizeFindings(findingsInput);

  // Convert to JSON
  const json1 = JSON.stringify(norm1, null, 2);
  const json2 = JSON.stringify(norm2, null, 2);
  const json3 = JSON.stringify(norm3, null, 2);

  // Verify byte-for-byte equality
  assert.strictEqual(json1, json2, 'First and second normalization are byte-identical');
  assert.strictEqual(json2, json3, 'Second and third normalization are byte-identical');

  // Verify no timestamps in output
  const parsed1 = JSON.parse(json1);
  assert.strictEqual(parsed1.detectedAt, undefined, 'detectedAt removed');
  
  // Verify findings are sorted
  assert.strictEqual(parsed1.findings[0].source.file, 'src/app.js', 'Findings sorted by source file');
  assert.strictEqual(parsed1.findings[1].source.file, 'src/hooks.js', 'Findings sorted by source file');
  assert.strictEqual(parsed1.findings[2].source.file, 'src/index.js', 'Findings sorted by source file');

  // Verify confidence rounded
  assert.strictEqual(parsed1.findings[0].confidence, 0.877, 'Confidence rounded to 3 decimals');
  assert.strictEqual(parsed1.findings[1].confidence, 0.765, 'Confidence rounded to 3 decimals');
  assert.strictEqual(parsed1.findings[2].confidence, 0.957, 'Confidence rounded to 3 decimals');
});

// ============================================================================
// Test 2: Summary Artifact Determinism
// ============================================================================

test('Byte-for-Byte: Summary artifacts are identical across runs', () => {
  const summaryInput = {
    version: 1,
    scannedAt: '2025-01-25T12:34:56.789Z',
    url: 'https://example.com/app',
    projectType: 'react',
    metrics: {
      learnMs: 1234,
      observeMs: 5678,
      detectMs: 2345,
      totalMs: 9257
    },
    stats: {
      total: 8,
      verified: 5,
      gaps: 3,
      confidence: 0.876543
    },
    expectations: {
      forms: 2,
      navigations: 4,
      state_mutations: 2
    }
  };

  const norm1 = normalizeSummary(summaryInput);
  const norm2 = normalizeSummary(summaryInput);

  const json1 = JSON.stringify(norm1, null, 2);
  const json2 = JSON.stringify(norm2, null, 2);

  assert.strictEqual(json1, json2, 'Summary normalizations are byte-identical');

  const parsed = JSON.parse(json1);
  assert.strictEqual(parsed.scannedAt, undefined, 'scannedAt removed');
  assert.strictEqual(parsed.metrics.learnMs, '<5s', 'learnMs quantized');
  assert.strictEqual(parsed.metrics.observeMs, '<10s', 'observeMs quantized');
  assert.strictEqual(parsed.stats.confidence, 0.877, 'confidence rounded');
});

// ============================================================================
// Test 3: Judgment Array Determinism
// ============================================================================

test('Byte-for-Byte: Judgment arrays are deterministically sorted', () => {
  const judgments = [
    {
      id: 'j3',
      promiseId: 'p-nav-2',
      judgment: 'PASS',
      confidence: 0.95678,
      timestamp: '2025-01-25T12:34:56Z'
    },
    {
      id: 'j1',
      promiseId: 'p-form-1',
      judgment: 'FAILURE_SILENT',
      confidence: 0.87654,
      timestamp: '2025-01-25T12:34:56Z'
    },
    {
      id: 'j2',
      promiseId: 'p-nav-1',
      judgment: 'WEAK_PASS',
      confidence: 0.76543,
      timestamp: '2025-01-25T12:34:56Z'
    }
  ];

  const norm1 = normalizeJudgments(judgments);
  const norm2 = normalizeJudgments(judgments);

  const json1 = JSON.stringify(norm1, null, 2);
  const json2 = JSON.stringify(norm2, null, 2);

  assert.strictEqual(json1, json2, 'Judgment normalizations are byte-identical');

  const parsed = JSON.parse(json1);
  
  // Should be sorted by promiseId
  assert.strictEqual(parsed[0].promiseId, 'p-form-1', 'Sorted by promiseId');
  assert.strictEqual(parsed[1].promiseId, 'p-nav-1', 'Sorted by promiseId');
  assert.strictEqual(parsed[2].promiseId, 'p-nav-2', 'Sorted by promiseId');

  // Timestamps removed
  for (const judgment of parsed) {
    assert.strictEqual(judgment.timestamp, undefined, 'timestamps removed');
  }

  // Confidence rounded
  for (const judgment of parsed) {
    const confStr = String(judgment.confidence);
    const parts = confStr.split('.');
    if (parts.length > 1) {
      assert.ok(parts[1].length <= 3, `confidence has max 3 decimals: ${judgment.confidence}`);
    }
  }
});

// ============================================================================
// Test 4: Key Ordering Determinism
// ============================================================================

test('Byte-for-Byte: Key ordering is deterministic', () => {
  const messyObj = {
    zebra: 1,
    apple: 2,
    monkey: 3,
    data: {
      zebra: 10,
      apple: 20,
      monkey: 30,
      nested: {
        z: 100,
        a: 200,
        m: 300
      }
    }
  };

  const norm1 = normalizeKeyOrdering(messyObj);
  const norm2 = normalizeKeyOrdering(messyObj);
  const norm3 = normalizeKeyOrdering(messyObj);

  const json1 = JSON.stringify(norm1);
  const json2 = JSON.stringify(norm2);
  const json3 = JSON.stringify(norm3);

  assert.strictEqual(json1, json2, 'First and second key ordering are identical');
  assert.strictEqual(json2, json3, 'Second and third key ordering are identical');

  // Verify actual ordering
  const keys = Object.keys(norm1);
  assert.deepStrictEqual(keys, ['apple', 'data', 'monkey', 'zebra'], 'Top-level keys sorted');

  const dataKeys = Object.keys(norm1.data);
  assert.deepStrictEqual(
    dataKeys,
    ['apple', 'monkey', 'nested', 'zebra'],
    'Nested keys sorted'
  );

  const nestedKeys = Object.keys(norm1.data.nested);
  assert.deepStrictEqual(nestedKeys, ['a', 'm', 'z'], 'Deep nested keys sorted');
});

// ============================================================================
// Test 5: No Data Loss
// ============================================================================

test('Byte-for-Byte: Decision-relevant data is preserved during normalization', () => {
  const original = {
    version: 1,
    contractVersion: 2,
    detectedAt: '2025-01-25T12:34:56Z',
    scannedAt: '2025-01-25T12:34:56Z',
    url: 'https://example.com',
    findings: [
      {
        id: 'f1',
        type: 'form_error',
        severity: 'critical',
        confidence: 0.95,
        promise: { type: 'form_submit', value: 'login' },
        evidence: {
          screenshot: 'before.png',
          console: ['error1', 'error2']
        }
      }
    ],
    metrics: {
      learnMs: 1000,
      detectMs: 2000,
      accuracy: 0.95
    }
  };

  const normalized = normalizeFindings(original);
  
  // Verify all decision-relevant data is present
  assert.strictEqual(normalized.version, 1);
  assert.strictEqual(normalized.contractVersion, 2);
  assert.strictEqual(normalized.url, 'https://example.com');
  assert.strictEqual(normalized.findings.length, 1);
  assert.strictEqual(normalized.findings[0].id, 'f1');
  assert.strictEqual(normalized.findings[0].type, 'form_error');
  assert.strictEqual(normalized.findings[0].severity, 'critical');
  assert.deepStrictEqual(normalized.findings[0].promise, { type: 'form_submit', value: 'login' });
  assert.deepStrictEqual(normalized.findings[0].evidence, {
    screenshot: 'before.png',
    console: ['error1', 'error2']
  });

  // Only timestamps should be removed
  assert.strictEqual(normalized.detectedAt, undefined);
  assert.strictEqual(normalized.scannedAt, undefined);
});

// ============================================================================
// Test 6: Determinism Across Different Inputs
// ============================================================================

test('Byte-for-Byte: Same structure always produces same ordering', () => {
  // Create two different instances with same structure but arrived differently
  const findings1 = {
    findings: [],
    url: 'https://example.com',
    version: 1
  };

  const findings2 = {
    version: 1,
    url: 'https://example.com',
    findings: []
  };

  const norm1 = normalizeFindings(findings1);
  const norm2 = normalizeFindings(findings2);

  const json1 = JSON.stringify(norm1, null, 2);
  const json2 = JSON.stringify(norm2, null, 2);

  // Keys should be ordered the same way
  assert.strictEqual(json1, json2, 'Same structure produces identical output regardless of original key order');
});
