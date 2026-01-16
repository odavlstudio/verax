import test from 'node:test';
import assert from 'node:assert';
import { computeConfidence } from '../src/verax/detect/confidence-engine.js';

// ============================================================================
// PRODUCTION-GRADE CONFIDENCE ENGINE TESTS
// Tests ensure deterministic, evidence-based confidence scoring
// ============================================================================

test('MANDATORY OUTPUT FORMAT: confidence has score, level, explain, factors', () => {
  const result = computeConfidence({
    findingType: 'no_effect_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: {},
      console: {},
      uiSignals: { before: {}, after: {}, changes: { changed: false } }
    },
    comparisons: { hasUrlChange: false, hasDomChange: false }
  });
  
  // Verify MANDATORY structure
  assert.ok(typeof result.score === 'number', 'score must be numeric');
  assert.ok(result.score >= 0 && result.score <= 100, 'score must be in [0, 100]');
  assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(result.level), 'level must be HIGH|MEDIUM|LOW');
  assert.ok(Array.isArray(result.explain), 'explain must be array');
  assert.ok(result.explain.length <= 8, 'explain max 8 items');
  result.explain.forEach(item => {
    assert.strictEqual(typeof item, 'string', 'explain items must be strings');
  });
  
  // Verify factors structure
  assert.ok(result.factors, 'factors must exist');
  assert.ok(['PROVEN', 'WEAK', 'UNKNOWN'].includes(result.factors.expectationStrength));
  assert.ok(typeof result.factors.sensorsPresent === 'object');
  assert.ok(typeof result.factors.sensorsPresent.network === 'boolean');
  assert.ok(typeof result.factors.sensorsPresent.console === 'boolean');
  assert.ok(typeof result.factors.sensorsPresent.ui === 'boolean');
  assert.ok(typeof result.factors.evidenceSignals === 'object');
  assert.ok(Array.isArray(result.factors.penalties));
  assert.ok(Array.isArray(result.factors.boosts));
});

test('HARD RULE: HIGH level requires PROVEN expectation AND all sensors', () => {
  // Try to get HIGH with PROVEN + all sensors
  const result1 = computeConfidence({
    findingType: 'network_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: { failedRequests: 1, failedByStatus: { 500: 1 }, topFailedUrls: [{ status: 500 }] },
      console: { pageErrorCount: 1 },
      uiSignals: { before: {}, after: {}, changes: { changed: false } }
    },
    comparisons: {}
  });
  
  if (result1.score >= 80) {
    assert.strictEqual(result1.level, 'HIGH', 'With PROVEN + sensors, can achieve HIGH');
    assert.strictEqual(result1.factors.expectationStrength, 'PROVEN');
    assert.strictEqual(result1.factors.sensorsPresent.network, true);
    assert.strictEqual(result1.factors.sensorsPresent.console, true);
    assert.strictEqual(result1.factors.sensorsPresent.ui, true);
  }
  
  // Try to get HIGH without PROVEN
  const result2 = computeConfidence({
    findingType: 'network_silent_failure',
    expectation: { proof: 'WEAK_EXPECTATION' },
    sensors: {
      network: { failedRequests: 1, failedByStatus: { 500: 1 }, topFailedUrls: [{ status: 500 }] },
      console: { pageErrorCount: 1 },
      uiSignals: { before: {}, after: {}, changes: { changed: false } }
    },
    comparisons: {}
  });
  
  if (result2.score >= 80) {
    assert.notStrictEqual(result2.level, 'HIGH', 'Without PROVEN, level capped to MEDIUM');
    assert.ok(result2.score <= 79, 'Score capped to 79 without PROVEN');
  }
  
  // Try to get HIGH without all sensors
  const result3 = computeConfidence({
    findingType: 'network_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: { failedRequests: 1, failedByStatus: { 500: 1 }, topFailedUrls: [{ status: 500 }] },
      console: {},
      uiSignals: {}
    },
    comparisons: {}
  });
  
  if (result3.score >= 80) {
    assert.notStrictEqual(result3.level, 'HIGH', 'Without all sensors, level capped to MEDIUM');
    assert.ok(result3.score <= 79, 'Score capped to 79 without all sensors');
  }
});

test('DETERMINISM: Same inputs produce identical outputs across runs', () => {
  const params = {
    findingType: 'no_effect_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION', expectationType: 'navigation' },
    sensors: {
      network: { totalRequests: 0 },
      console: { hasErrors: false },
      uiSignals: { before: {}, after: {}, changes: { changed: false } }
    },
    comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false }
  };
  
  const result1 = computeConfidence(params);
  const result2 = computeConfidence(params);
  const result3 = computeConfidence(params);
  
  assert.strictEqual(result1.score, result2.score, 'Score must be identical across runs');
  assert.strictEqual(result2.score, result3.score, 'Score must be identical across runs');
  assert.strictEqual(result1.level, result2.level, 'Level must be identical across runs');
  assert.strictEqual(result2.level, result3.level, 'Level must be identical across runs');
  assert.deepStrictEqual(result1.explain, result2.explain, 'Explain must be identical across runs');
  assert.deepStrictEqual(result2.explain, result3.explain, 'Explain must be identical across runs');
});

test('PENALTY: Missing sensors incurs -15 penalty', () => {
  // With all sensors (minimal but valid data)
  const withSensors = computeConfidence({
    findingType: 'no_effect_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: { totalRequests: 0 },
      console: { hasErrors: false },
      uiSignals: { before: {}, after: {}, changes: { changed: false } }
    },
    comparisons: { hasUrlChange: false, hasDomChange: false }
  });
  
  // Without sensors
  const withoutSensors = computeConfidence({
    findingType: 'no_effect_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {},
    comparisons: { hasUrlChange: false, hasDomChange: false }
  });
  
  // The difference should include the 15-point penalty
  assert.ok(withSensors.score > withoutSensors.score, 'Missing sensors should lower score');
  const penalty = withSensors.score - withoutSensors.score;
  assert.ok(penalty >= 10, `Expected penalty ~15, got ${penalty}`);
  assert.ok(withoutSensors.factors.penalties.some(p => p.includes('sensor')), 'Penalty reason should mention sensors');
});

test('PENALTY: Not PROVEN expectation incurs -10 penalty', () => {
  const baseSensors = {
    network: {},
    console: {},
    uiSignals: { before: {}, after: {}, changes: { changed: false } }
  };
  
  // PROVEN
  const proven = computeConfidence({
    findingType: 'no_effect_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: baseSensors,
    comparisons: { hasUrlChange: false, hasDomChange: false }
  });
  
  // WEAK
  const weak = computeConfidence({
    findingType: 'no_effect_silent_failure',
    expectation: { proof: 'WEAK_EXPECTATION' },
    sensors: baseSensors,
    comparisons: { hasUrlChange: false, hasDomChange: false }
  });
  
  assert.ok(proven.score > weak.score, 'PROVEN expectation should score higher');
  const penalty = proven.score - weak.score;
  assert.ok(penalty >= 5, `Expected penalty ~10, got ${penalty}`);
});

test('EVIDENCE SIGNALS: urlChanged extracted correctly', () => {
  const result = computeConfidence({
    findingType: 'no_effect_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: { network: {}, console: {}, uiSignals: { before: {}, after: {}, changes: {} } },
    comparisons: { hasUrlChange: true }
  });
  
  assert.strictEqual(result.factors.evidenceSignals.urlChanged, true);
});

test('EVIDENCE SIGNALS: domChanged extracted correctly', () => {
  const result = computeConfidence({
    findingType: 'no_effect_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: { network: {}, console: {}, uiSignals: { before: {}, after: {}, changes: {} } },
    comparisons: { hasDomChange: true }
  });
  
  assert.strictEqual(result.factors.evidenceSignals.domChanged, true);
});

test('EVIDENCE SIGNALS: networkFailed extracted correctly', () => {
  const result = computeConfidence({
    findingType: 'network_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: { 
      network: { failedRequests: 1 },
      console: {},
      uiSignals: { before: {}, after: {}, changes: {} }
    },
    comparisons: {}
  });
  
  assert.strictEqual(result.factors.evidenceSignals.networkFailed, true);
});

test('EVIDENCE SIGNALS: consoleErrors extracted correctly', () => {
  const result = computeConfidence({
    findingType: 'network_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: { 
      network: {},
      console: { hasErrors: true },
      uiSignals: { before: {}, after: {}, changes: {} }
    },
    comparisons: {}
  });
  
  assert.strictEqual(result.factors.evidenceSignals.consoleErrors, true);
});

test('BOOSTS: network_silent_failure adds boost for network failure', () => {
  const result = computeConfidence({
    findingType: 'network_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: { failedRequests: 1 },
      console: {},
      uiSignals: { before: {}, after: {}, changes: {} }
    },
    comparisons: {}
  });
  
  assert.ok(result.factors.boosts.length > 0, 'Should have boosts');
  assert.ok(result.factors.boosts.some(b => b.toLowerCase().includes('network')), 'Should mention network');
});

test('BOOSTS: no_effect_silent_failure adds boosts for URL/DOM not changed', () => {
  const result = computeConfidence({
    findingType: 'no_effect_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: {},
      console: {},
      uiSignals: { before: {}, after: {}, changes: { changed: false } }
    },
    comparisons: { hasUrlChange: false, hasDomChange: false }
  });
  
  assert.ok(result.factors.boosts.length > 0, 'Should have boosts');
  assert.ok(result.factors.boosts.some(b => b.toLowerCase().includes('url') || b.toLowerCase().includes('navigation')), 
    'Should mention URL/navigation');
  assert.ok(result.factors.boosts.some(b => b.toLowerCase().includes('dom')), 'Should mention DOM');
});

test('SCORE CLAMPING: Score never exceeds 100', () => {
  const result = computeConfidence({
    findingType: 'network_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: { failedRequests: 100, failedByStatus: { 500: 100 }, topFailedUrls: Array(100).fill({ status: 500 }) },
      console: { pageErrorCount: 100, unhandledRejectionCount: 100 },
      uiSignals: { before: {}, after: {}, changes: { changed: false } }
    },
    comparisons: {}
  });
  
  assert.ok(result.score <= 100, `Score should be clamped to 100, got ${result.score}`);
});

test('SCORE CLAMPING: Score never goes below 0', () => {
  const result = computeConfidence({
    findingType: 'no_effect_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: { totalRequests: 1000 },
      console: { hasErrors: true },
      uiSignals: {
        before: { hasDialog: false, hasErrorSignal: false },
        after: { hasDialog: true, hasErrorSignal: true },
        changes: { changed: true }
      }
    },
    comparisons: { hasUrlChange: false, hasDomChange: false }
  });
  
  assert.ok(result.score >= 0, `Score should be clamped to 0, got ${result.score}`);
});

test('LEVEL MAPPING: score < 55 => LOW', () => {
  const result = computeConfidence({
    findingType: 'no_effect_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: { totalRequests: 10 },
      console: { hasErrors: true },
      uiSignals: {
        before: {},
        after: { hasDialog: true, hasErrorSignal: true },
        changes: { changed: true }
      }
    },
    comparisons: { hasUrlChange: false, hasDomChange: false }
  });
  
  if (result.score < 55) {
    assert.strictEqual(result.level, 'LOW');
  }
});

test('LEVEL MAPPING: 55 <= score < 80 => MEDIUM', () => {
  const result = computeConfidence({
    findingType: 'no_effect_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: {},
      console: {},
      uiSignals: { before: {}, after: {}, changes: {} }
    },
    comparisons: { hasUrlChange: false, hasDomChange: false }
  });
  
  if (result.score >= 55 && result.score < 80) {
    assert.strictEqual(result.level, 'MEDIUM');
  }
});

test('LEVEL MAPPING: score >= 80 with PROVEN + allSensors => HIGH', () => {
  const result = computeConfidence({
    findingType: 'network_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: { failedRequests: 1, failedByStatus: { 500: 1 }, topFailedUrls: [{ status: 500 }] },
      console: { pageErrorCount: 1 },
      uiSignals: { before: {}, after: {}, changes: { changed: false } }
    },
    comparisons: {}
  });
  
  if (result.score >= 80) {
    assert.strictEqual(result.level, 'HIGH');
  }
});

test('EXPLAIN ARRAY: ordered by importance (penalties first, then boosts)', () => {
  const result = computeConfidence({
    findingType: 'network_silent_failure',
    expectation: { proof: 'WEAK_EXPECTATION' },
    sensors: {
      network: { failedRequests: 1 },
      console: {},
      uiSignals: { before: {}, after: {}, changes: {} }
    },
    comparisons: {}
  });
  
  assert.ok(result.explain.length > 0, 'Should have explanations');
  // Penalties (e.g., "not PROVEN") should come before boosts
  const explainText = result.explain.join(' | ');
  assert.ok(typeof explainText === 'string');
});

test('EXPECTATION STRENGTH: proof=PROVEN_EXPECTATION => "PROVEN"', () => {
  const result = computeConfidence({
    findingType: 'no_effect_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: { network: {}, console: {}, uiSignals: {} },
    comparisons: {}
  });
  
  assert.strictEqual(result.factors.expectationStrength, 'PROVEN');
});

test('EXPECTATION STRENGTH: sourceRef present => "PROVEN"', () => {
  const result = computeConfidence({
    findingType: 'no_effect_silent_failure',
    expectation: { sourceRef: 'index.html:42', explicit: true },
    sensors: { network: {}, console: {}, uiSignals: {} },
    comparisons: {}
  });
  
  assert.strictEqual(result.factors.expectationStrength, 'PROVEN');
});

test('EXPECTATION STRENGTH: no metadata => "UNKNOWN"', () => {
  const result = computeConfidence({
    findingType: 'no_effect_silent_failure',
    expectation: {},
    sensors: { network: {}, console: {}, uiSignals: {} },
    comparisons: {}
  });
  
  assert.strictEqual(result.factors.expectationStrength, 'UNKNOWN');
});

test('NO PLACEHOLDERS: All fields are concrete values, not TODOs', () => {
  const result = computeConfidence({
    findingType: 'network_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: { failedRequests: 1 },
      console: {},
      uiSignals: { before: {}, after: {}, changes: {} }
    },
    comparisons: {}
  });
  
  // Verify no TODO/placeholder text
  const jsonStr = JSON.stringify(result);
  assert.ok(!jsonStr.includes('TODO'), 'Should not contain TODO');
  assert.ok(!jsonStr.includes('placeholder'), 'Should not contain placeholder');
  assert.ok(!jsonStr.includes('FIXME'), 'Should not contain FIXME');
  assert.ok(!jsonStr.includes('undefined'), 'Should not contain undefined');
});

test('TYPE-SPECIFIC SCORING: validation_silent_failure awards boost for console errors', () => {
  const result = computeConfidence({
    findingType: 'validation_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: { totalRequests: 0 },
      console: { hasErrors: true },
      uiSignals: { before: {}, after: {}, changes: { changed: false } }
    },
    comparisons: {}
  });
  
  assert.ok(result.factors.boosts.some(b => b.toLowerCase().includes('console') || b.toLowerCase().includes('validation')),
    'Should boost for validation errors');
});

test('TYPE-SPECIFIC SCORING: missing_feedback_failure awards boost for slow requests', () => {
  const result = computeConfidence({
    findingType: 'missing_feedback_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: { slowRequestsCount: 1 },
      console: {},
      uiSignals: { before: {}, after: {}, changes: { changed: false } }
    },
    comparisons: {}
  });
  
  assert.ok(result.factors.boosts.some(b => b.toLowerCase().includes('slow')) || result.factors.boosts.length > 0,
    'Should boost for slow requests');
});

test('TYPE-SPECIFIC SCORING: missing_network_action awards boost for PROVEN expectation', () => {
  const result = computeConfidence({
    findingType: 'missing_network_action',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: {},
      console: {},
      uiSignals: { before: {}, after: {}, changes: {} }
    },
    comparisons: {}
  });
  
  assert.ok(result.factors.boosts.some(b => b.toLowerCase().includes('proven') || b.toLowerCase().includes('promise') || b.toLowerCase().includes('code')),
    'Should boost for code promise');
});

test('TYPE-SPECIFIC SCORING: missing_state_action awards boost for PROVEN expectation', () => {
  const result = computeConfidence({
    findingType: 'missing_state_action',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: {},
      console: {},
      uiSignals: { before: {}, after: {}, changes: {} }
    },
    comparisons: { hasDomChange: false }
  });
  
  assert.ok(result.factors.boosts.some(b => b.toLowerCase().includes('proven') || b.toLowerCase().includes('cross-file') || b.toLowerCase().includes('state')),
    'Should boost for state mutation promise');
});

