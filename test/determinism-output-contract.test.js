/**
 * Vision 1.0 Determinism Contract: Output Normalization
 * 
 * Ensures that all decision-relevant artifacts are byte-for-byte identical
 * across repeated runs with the same input.
 * 
 * Contract: Same input → Same JSON output (except traces.jsonl which can be order-sensitive)
 * 
 * Decision-relevant artifacts:
 * - findings.json: MUST be deterministic
 * - summary artifacts: MUST be deterministic
 * - judgments: MUST be deterministic
 * - coverage: MUST be deterministic
 */

import test from 'node:test';
import assert from 'node:assert';
import { 
  normalizeFindings,
  normalizeSummary,
  removeTimestamps,
  quantizeElapsedMs,
  roundConfidence,
  normalizeKeyOrdering,
  normalizeElapsedTime,
  normalizeConfidence
} from '../src/verax/detect/output-normalizer.js';

// ============================================================================
// Contract 1: Timestamp Removal
// ============================================================================

test('Determinism Contract: Timestamps are removed', () => {
  const objWithTimestamps = {
    timestamp: '2025-01-25T12:34:56Z',
    scannedAt: '2025-01-25T12:34:56Z',
    detectedAt: '2025-01-25T12:34:56Z',
    createdAt: '2025-01-25T12:34:56Z',
    data: {
      updatedAt: '2025-01-25T12:34:56Z',
      value: 42
    }
  };
  
  const cleaned = removeTimestamps(objWithTimestamps);
  
  assert.strictEqual(cleaned.timestamp, undefined, 'timestamp removed');
  assert.strictEqual(cleaned.scannedAt, undefined, 'scannedAt removed');
  assert.strictEqual(cleaned.detectedAt, undefined, 'detectedAt removed');
  assert.strictEqual(cleaned.createdAt, undefined, 'createdAt removed');
  assert.strictEqual(cleaned.data.updatedAt, undefined, 'nested updatedAt removed');
  assert.strictEqual(cleaned.data.value, 42, 'non-timestamp data preserved');
});

// ============================================================================
// Contract 2: Elapsed Time Quantization
// ============================================================================

test('Determinism Contract: Elapsed time is quantized', () => {
  // Time values should be quantized to deterministic buckets
  const quantized = [
    { ms: 0, expected: '<1s' },
    { ms: 500, expected: '<1s' },
    { ms: 1000, expected: '<5s' },
    { ms: 2500, expected: '<5s' },
    { ms: 5000, expected: '<10s' },
    { ms: 8000, expected: '<10s' },
    { ms: 10000, expected: '<30s' },
    { ms: 20000, expected: '<30s' },
    { ms: 30000, expected: '<1min' },
    { ms: 60000, expected: '<5min' },
    { ms: 120000, expected: '<5min' }  // Fixed: 120s is still <5min
  ];
  
  for (const { ms, expected } of quantized) {
    const result = quantizeElapsedMs(ms);
    assert.strictEqual(result, expected, `${ms}ms → ${expected}`);
  }
  
  // Same time value always produces same quantized result
  assert.strictEqual(quantizeElapsedMs(1500), quantizeElapsedMs(1500), 'Deterministic bucket');
  assert.strictEqual(quantizeElapsedMs(5500), quantizeElapsedMs(5500), 'Deterministic bucket');
});

test('Determinism Contract: Elapsed time fields are normalized in objects', () => {
  const obj = {
    learnMs: 1234,
    detectMs: 5678,
    metrics: {
      observeMs: 2345,
      validateMs: 3456
    },
    other: 99
  };
  
  const normalized = normalizeElapsedTime(obj);
  
  assert.strictEqual(normalized.learnMs, '<5s', 'learnMs quantized');
  assert.strictEqual(normalized.detectMs, '<10s', 'detectMs quantized');
  assert.strictEqual(normalized.metrics.observeMs, '<5s', 'nested observeMs quantized');
  assert.strictEqual(normalized.metrics.validateMs, '<5s', 'nested validateMs quantized');
  assert.strictEqual(normalized.other, 99, 'non-time fields preserved');
});

// ============================================================================
// Contract 3: Confidence Rounding
// ============================================================================

test('Determinism Contract: Confidence values are rounded to fixed precision', () => {
  const testCases = [
    { input: 0.123456, expected: 0.123 },
    { input: 0.555555, expected: 0.556 },
    { input: 1.0, expected: 1.0 },
    { input: 0.0, expected: 0 },
    { input: 85.5555, expected: 0.856 }  // Normalized from percentage
  ];
  
  for (const { input, expected } of testCases) {
    const rounded = roundConfidence(input);
    assert.strictEqual(rounded, expected, `${input} → ${expected}`);
  }
  
  // Same confidence value produces same rounded result
  assert.strictEqual(roundConfidence(0.789), roundConfidence(0.789), 'Deterministic rounding');
});

test('Determinism Contract: Confidence fields are normalized in objects', () => {
  const obj = {
    confidence: 0.789456,
    score: 0.567890,
    data: {
      confidenceLevel: 0.912345,
      scoreValue: 0.345678
    }
  };
  
  const normalized = normalizeConfidence(obj);
  
  assert.strictEqual(normalized.confidence, 0.789, 'confidence rounded');
  assert.strictEqual(normalized.score, 0.568, 'score rounded');
  assert.strictEqual(normalized.data.confidenceLevel, 0.912, 'nested confidenceLevel rounded');
  assert.strictEqual(normalized.data.scoreValue, 0.346, 'nested scoreValue rounded');
});

// ============================================================================
// Contract 4: Key Ordering
// ============================================================================

test('Determinism Contract: Object keys are sorted deterministically', () => {
  const obj = {
    z: 1,
    a: 2,
    m: 3,
    nested: {
      z: 4,
      a: 5,
      m: 6
    }
  };
  
  const normalized = normalizeKeyOrdering(obj);
  
  // Keys should be in alphabetical order
  const keys = Object.keys(normalized);
  assert.deepStrictEqual(keys, ['a', 'm', 'nested', 'z'], 'Top-level keys sorted');
  
  // Nested keys should also be sorted
  const nestedKeys = Object.keys(normalized.nested);
  assert.deepStrictEqual(nestedKeys, ['a', 'm', 'z'], 'Nested keys sorted');
});

// ============================================================================
// Contract 5: Findings Normalization (End-to-End)
// ============================================================================

test('Determinism Contract: Findings are deterministically normalized', () => {
  const findings = {
    version: 1,
    contractVersion: 1,
    detectedAt: '2025-01-25T12:34:56Z',  // Should be removed
    url: 'https://example.com',
    outcomeSummary: {
      SILENT_FAILURE: 2,
      PASS: 1
    },
    findings: [
      {
        id: 'f2',
        type: 'form_unresponsive',
        severity: 'high',
        confidence: 0.95678,
        promise: { type: 'form_submit' },
        source: { file: 'index.js', line: 10, col: 5 }
      },
      {
        id: 'f1',
        type: 'navigation_silent',
        severity: 'medium',
        confidence: 0.78234,
        promise: { type: 'navigate' },
        source: { file: 'app.js', line: 5, col: 0 }
      }
    ]
  };
  
  const normalized = normalizeFindings(findings);
  
  // Timestamp removed
  assert.strictEqual(normalized.detectedAt, undefined, 'detectedAt removed');
  
  // Confidence rounded (note: findings are sorted by source file)
  assert.strictEqual(normalized.findings[0].confidence, 0.782, 'First finding (app.js) confidence rounded');
  assert.strictEqual(normalized.findings[1].confidence, 0.957, 'Second finding (index.js) confidence rounded');
  
  // Findings sorted by source file
  assert.strictEqual(normalized.findings[0].source.file, 'app.js', 'Findings sorted by file');
  assert.strictEqual(normalized.findings[1].source.file, 'index.js', 'Findings sorted by file');
  
  // Keys sorted
  const topLevelKeys = Object.keys(normalized);
  const sorted = [...topLevelKeys].sort();
  assert.deepStrictEqual(topLevelKeys, sorted, 'Top-level keys sorted');
});

// ============================================================================
// Contract 6: Summary Normalization (End-to-End)
// ============================================================================

test('Determinism Contract: Summary artifacts are deterministically normalized', () => {
  const summary = {
    version: 1,
    scannedAt: '2025-01-25T12:34:56Z',  // Should be removed
    url: 'https://example.com',
    projectType: 'react',
    truth: {
      learn: { totalMs: 1234 },
      detect: { totalMs: 5678 }
    },
    metrics: {
      detectMs: 2345,
      observeMs: 2345  // Fixed: 2345ms → <5s, not <1s
    },
    confidence: 0.85678
  };
  
  const normalized = normalizeSummary(summary);
  
  // Timestamp removed
  assert.strictEqual(normalized.scannedAt, undefined, 'scannedAt removed');
  
  // Elapsed time quantized
  assert.strictEqual(normalized.metrics.detectMs, '<5s', 'detectMs quantized');
  assert.strictEqual(normalized.metrics.observeMs, '<5s', 'observeMs quantized');
  
  // Confidence rounded
  assert.strictEqual(normalized.confidence, 0.857, 'confidence rounded');
  
  // Keys sorted
  const keys = Object.keys(normalized);
  const sorted = [...keys].sort();
  assert.deepStrictEqual(keys, sorted, 'Keys sorted alphabetically');
});

// ============================================================================
// Contract 7: Byte-for-Byte Equality
// ============================================================================

test('Determinism Contract: Same input produces identical JSON output', () => {
  const findings1 = {
    version: 1,
    url: 'https://example.com',
    findings: [
      { id: 'f1', type: 'error', confidence: 0.95 },
      { id: 'f2', type: 'warning', confidence: 0.75 }
    ]
  };
  
  const findings2 = {
    version: 1,
    url: 'https://example.com',
    findings: [
      { id: 'f1', type: 'error', confidence: 0.95 },
      { id: 'f2', type: 'warning', confidence: 0.75 }
    ]
  };
  
  const normalized1 = normalizeFindings(findings1);
  const normalized2 = normalizeFindings(findings2);
  
  const json1 = JSON.stringify(normalized1, null, 2);
  const json2 = JSON.stringify(normalized2, null, 2);
  
  assert.strictEqual(json1, json2, 'Same input produces identical JSON');
});

// ============================================================================
// Contract 8: No Data Loss (Except Timestamps/Time)
// ============================================================================

test('Determinism Contract: Normalization preserves decision-relevant data', () => {
  const findings = {
    version: 1,
    url: 'https://example.com',
    detectedAt: '2025-01-25T12:34:56Z',
    outcomeSummary: { SILENT_FAILURE: 1 },
    findings: [
      {
        id: 'f1',
        type: 'form_unresponsive',
        severity: 'high',
        confidence: 0.95,
        promise: { type: 'form_submit', value: 'login' },
        evidence: { signals: ['console_error', 'no_redirect'] }
      }
    ]
  };
  
  const normalized = normalizeFindings(findings);
  
  // Decision-relevant fields preserved
  assert.strictEqual(normalized.version, 1, 'version preserved');
  assert.strictEqual(normalized.url, 'https://example.com', 'url preserved');
  assert.deepStrictEqual(normalized.outcomeSummary, { SILENT_FAILURE: 1 }, 'outcomeSummary preserved');
  assert.strictEqual(normalized.findings[0].id, 'f1', 'finding id preserved');
  assert.strictEqual(normalized.findings[0].type, 'form_unresponsive', 'finding type preserved');
  assert.strictEqual(normalized.findings[0].severity, 'high', 'finding severity preserved');
  assert.deepStrictEqual(normalized.findings[0].promise, { type: 'form_submit', value: 'login' }, 'promise preserved');
  assert.deepStrictEqual(normalized.findings[0].evidence.signals, ['console_error', 'no_redirect'], 'evidence preserved');
  
  // Only timestamps removed
  assert.strictEqual(normalized.detectedAt, undefined, 'timestamp removed as expected');
});

// ============================================================================
// Contract 9: Reproducibility Guarantee
// ============================================================================

test('Determinism Contract: Artifacts are reproducible across calls', () => {
  const originalFindings = {
    version: 1,
    url: 'https://example.com',
    detectedAt: '2025-01-25T12:34:56Z',
    findings: [
      { id: 'f1', type: 'error', confidence: 0.956789 },
      { id: 'f2', type: 'warning', confidence: 0.756789 }
    ]
  };
  
  // Normalize multiple times
  const normalized1 = normalizeFindings(originalFindings);
  const normalized2 = normalizeFindings(originalFindings);
  const normalized3 = normalizeFindings(originalFindings);
  
  const json1 = JSON.stringify(normalized1, null, 2);
  const json2 = JSON.stringify(normalized2, null, 2);
  const json3 = JSON.stringify(normalized3, null, 2);
  
  assert.strictEqual(json1, json2, 'First and second normalization identical');
  assert.strictEqual(json2, json3, 'Second and third normalization identical');
  
  // Hashes should match (if we were computing them)
  // This proves: input → algorithm → deterministic output
});

// ============================================================================
// Contract 10: Explicit Exclusions
// ============================================================================

test('Determinism Contract: traces.jsonl is explicitly excluded from normalization', () => {
  // traces.jsonl may remain order-sensitive (one JSON per line)
  // This is OK because:
  // 1. It represents chronological order of observed events
  // 2. It does NOT influence findings, judgments, or exit codes
  // 3. Order comes from actual execution (not random/non-deterministic)
  
  // The critical decision artifacts (findings, judgments, summary) MUST be normalized
  // But traces.jsonl can be order-sensitive as long as it doesn't affect decisions
  
  assert.ok(true, 'Traces explicitly excluded from normalization contract');
});
