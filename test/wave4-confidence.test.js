import test from 'node:test';
import assert from 'node:assert';
import { computeConfidence } from '../src/verax/detect/confidence-engine.js';

// === NETWORK SILENT FAILURE TESTS ===

test('network_silent_failure with 5xx error + no feedback => HIGH confidence', () => {
  const result = computeConfidence({
    findingType: 'network_silent_failure',
    expectation: { expectationType: 'form_submission', proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: {
        totalRequests: 1,
        failedRequests: 1,
        failedByStatus: { 500: 1 },
        topFailedUrls: [{ url: 'http://example.com/api/submit', status: 500 }]
      },
      console: { pageErrorCount: 1 },
      uiSignals: {
        before: { hasErrorSignal: false },
        after: { hasErrorSignal: false },
        changes: { changed: false }
      }
    },
    comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false }
  });
  
  // Base: 70, +15 (5xx), +10 (explicit failure), +10 (js error), +10 (no feedback) = 115, capped at 100
  assert.ok(result.score >= 80, `Expected HIGH confidence (>=80), got ${result.score}`);
  assert.strictEqual(result.level, 'HIGH');
  assert.ok(result.reasons.length > 0);
  assert.ok(result.reasons.some(r => r.includes('5xx') || r.includes('Server error')));
});

test('network_silent_failure with 4xx error + no feedback => MEDIUM confidence', () => {
  const result = computeConfidence({
    findingType: 'network_silent_failure',
    expectation: { expectationType: 'form_submission', proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: {
        totalRequests: 1,
        failedRequests: 1,
        failedByStatus: { 404: 1 },
        topFailedUrls: [{ url: 'http://example.com/api/submit', status: 404 }]
      },
      console: {},
      uiSignals: {
        before: { hasErrorSignal: false },
        after: { hasErrorSignal: false },
        changes: { changed: false }
      }
    },
    comparisons: { hasUrlChange: false, hasDomChange: false }
  });
  
  // Base: 70, +10 (network failure), +10 (explicit failure), +10 (no feedback) = 100
  assert.ok(result.score >= 60, `Expected MEDIUM or HIGH confidence (>=60), got ${result.score}`);
  assert.ok(['MEDIUM', 'HIGH'].includes(result.level));
});

test('network_silent_failure with feedback present => penalty reduces confidence', () => {
  const result = computeConfidence({
    findingType: 'network_silent_failure',
    expectation: { expectationType: 'form_submission', proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: {
        failedRequests: 1,
        failedByStatus: { 500: 1 }
      },
      console: {},
      uiSignals: {
        before: { hasErrorSignal: false },
        after: { hasErrorSignal: true },
        changes: { changed: true }
      }
    },
    comparisons: {}
  });
  
  // Should have penalty for feedback present
  assert.ok(result.score < 100);
  assert.ok(result.breakdown.minus.hasFeedback);
});

// === VALIDATION SILENT FAILURE TESTS ===

test('validation_silent_failure with invalid fields + console error + no feedback => HIGH/MEDIUM confidence', () => {
  const result = computeConfidence({
    findingType: 'validation_silent_failure',
    expectation: { expectationType: 'form_submission', proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: {},
      console: {
        consoleErrorCount: 2,
        lastErrors: ['Email is required', 'Invalid format']
      },
      uiSignals: {
        before: { hasErrorSignal: false },
        after: { hasErrorSignal: false },
        changes: { changed: false }
      }
    },
    comparisons: {},
    attemptMeta: { invalidFieldsCount: 2 }
  });
  
  // Base: 60, +15 (invalid fields), +10 (console error), +10 (no feedback) = 95
  assert.ok(result.score >= 60, `Expected MEDIUM or HIGH confidence (>=60), got ${result.score}`);
  assert.ok(['MEDIUM', 'HIGH'].includes(result.level));
  assert.ok(result.reasons.some(r => r.includes('invalid') || r.includes('field')));
});

test('validation_silent_failure with console errors only => MEDIUM confidence', () => {
  const result = computeConfidence({
    findingType: 'validation_silent_failure',
    expectation: { expectationType: 'form_submission', proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: {},
      console: {
        consoleErrorCount: 1,
        lastErrors: ['Validation failed']
      },
      uiSignals: {
        before: { hasErrorSignal: false },
        after: { hasErrorSignal: false },
        changes: { changed: false }
      }
    },
    comparisons: {}
  });
  
  // Base: 60, +10 (console error), +10 (no feedback) = 80
  assert.ok(result.score >= 60, `Expected MEDIUM+ confidence (>=60), got ${result.score}`);
});

test('validation_silent_failure with error feedback visible => penalty', () => {
  const result = computeConfidence({
    findingType: 'validation_silent_failure',
    expectation: { expectationType: 'form_submission', proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: {},
      console: { consoleErrorCount: 1 },
      uiSignals: {
        before: { hasErrorSignal: false },
        after: { hasErrorSignal: true },
        changes: { changed: true }
      }
    },
    comparisons: {}
  });
  
  // Should have penalty for visible error feedback
  assert.ok(result.breakdown.minus.hasErrorFeedback);
});

// === MISSING FEEDBACK FAILURE TESTS ===

test('missing_feedback_failure with slow request + no loading => MEDIUM/HIGH confidence', () => {
  const result = computeConfidence({
    findingType: 'missing_feedback_failure',
    expectation: { expectationType: 'form_submission', proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: {
        totalRequests: 1,
        slowRequestsCount: 1,
        slowRequests: [{ url: 'http://example.com/api/submit', duration: 3500 }],
        durationMs: 3500
      },
      console: {},
      uiSignals: {
        before: { hasLoadingIndicator: false },
        after: { hasLoadingIndicator: false },
        changes: { changed: false }
      }
    },
    comparisons: {}
  });
  
  // Base: 55, +15 (slow request), +10 (long action), +10 (no loading) = 90
  assert.ok(result.score >= 60, `Expected MEDIUM or HIGH confidence (>=60), got ${result.score}`);
  assert.ok(result.reasons.some(r => r.includes('Slow') || r.includes('slow')));
});

test('missing_feedback_failure with loading indicator => penalty', () => {
  const result = computeConfidence({
    findingType: 'missing_feedback_failure',
    expectation: { expectationType: 'form_submission', proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: {
        slowRequestsCount: 1,
        slowRequests: [{ duration: 3000 }]
      },
      console: {},
      uiSignals: {
        before: { hasLoadingIndicator: false },
        after: { hasLoadingIndicator: true },
        changes: { changed: true }
      }
    },
    comparisons: {}
  });
  
  // Should have penalty for loading indicator
  assert.ok(result.breakdown.minus.hasLoadingFeedback);
  assert.ok(result.score < 80);
});

// === NO EFFECT SILENT FAILURE TESTS ===

test('no_effect_silent_failure with PROVEN nav + no changes => MEDIUM/HIGH confidence', () => {
  const result = computeConfidence({
    findingType: 'no_effect_silent_failure',
    expectation: { 
      expectationType: 'navigation',
      proof: 'PROVEN_EXPECTATION',
      expectedTargetPath: '/about'
    },
    sensors: {
      network: { totalRequests: 0 },
      console: {},
      uiSignals: {
        before: {},
        after: {},
        changes: { changed: false }
      }
    },
    comparisons: {
      hasUrlChange: false,
      hasDomChange: false,
      hasVisibleChange: false
    }
  });
  
  // Base: 50, +15 (expected nav no url), +10 (no dom), +10 (no visible) = 85
  assert.ok(result.score >= 60, `Expected MEDIUM or HIGH confidence (>=60), got ${result.score}`);
  assert.ok(result.reasons.some(r => r.includes('navigation') || r.includes('Expected')));
});

test('no_effect_silent_failure with network activity => penalty', () => {
  const result = computeConfidence({
    findingType: 'no_effect_silent_failure',
    expectation: { expectationType: 'navigation', proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: { totalRequests: 2 },
      console: {},
      uiSignals: {
        changes: { changed: false }
      }
    },
    comparisons: {
      hasUrlChange: false,
      hasDomChange: false
    }
  });
  
  // Should have penalty for network activity (might be hidden effect)
  assert.ok(result.breakdown.minus.hasNetworkActivity);
});

test('no_effect_silent_failure with UI signal change => penalty', () => {
  const result = computeConfidence({
    findingType: 'no_effect_silent_failure',
    expectation: { expectationType: 'form_submission', proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: {},
      console: {},
      uiSignals: {
        before: { hasDialog: false },
        after: { hasDialog: true },
        changes: { changed: true }
      }
    },
    comparisons: {
      hasUrlChange: false,
      hasDomChange: false
    }
  });
  
  // Should have penalty for UI signal change
  assert.ok(result.breakdown.minus.uiSignalChanged);
});

// === CONFIDENCE LEVEL MAPPING TESTS ===

test('confidence score >= 80 maps to HIGH level', () => {
  const result = computeConfidence({
    findingType: 'network_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: {
        failedRequests: 1,
        failedByStatus: { 500: 1 },
        topFailedUrls: [{ status: 500 }]
      },
      console: { pageErrorCount: 1 },
      uiSignals: {
        before: {},
        after: {},
        changes: { changed: false }
      }
    },
    comparisons: {}
  });
  
  if (result.score >= 80) {
    assert.strictEqual(result.level, 'HIGH');
  }
});

test('confidence score 60-79 maps to MEDIUM level', () => {
  const result = computeConfidence({
    findingType: 'validation_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: {},
      console: { consoleErrorCount: 1 },
      uiSignals: {
        before: {},
        after: {},
        changes: { changed: false }
      }
    },
    comparisons: {}
  });
  
  if (result.score >= 60 && result.score < 80) {
    assert.strictEqual(result.level, 'MEDIUM');
  }
});

test('confidence score < 60 maps to LOW level', () => {
  const result = computeConfidence({
    findingType: 'no_effect_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: { totalRequests: 5 },
      console: {},
      uiSignals: {
        before: {},
        after: { hasDialog: true },
        changes: { changed: true }
      }
    },
    comparisons: {}
  });
  
  if (result.score < 60) {
    assert.strictEqual(result.level, 'LOW');
  }
});

// === BREAKDOWN AND REASONS TESTS ===

test('confidence result includes breakdown with base, plus, minus', () => {
  const result = computeConfidence({
    findingType: 'network_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: { failedRequests: 1, failedByStatus: { 500: 1 } },
      console: {},
      uiSignals: { changes: { changed: false } }
    },
    comparisons: {}
  });
  
  assert.ok(result.breakdown);
  assert.ok(typeof result.breakdown.base === 'number');
  assert.ok(typeof result.breakdown.plus === 'object');
  assert.ok(typeof result.breakdown.minus === 'object');
});

test('confidence reasons limited to 6 items', () => {
  const result = computeConfidence({
    findingType: 'network_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: {
        failedRequests: 1,
        failedByStatus: { 500: 1 },
        topFailedUrls: [{ status: 500 }]
      },
      console: { pageErrorCount: 1, unhandledRejectionCount: 1 },
      uiSignals: { changes: { changed: false } }
    },
    comparisons: {}
  });
  
  assert.ok(result.reasons.length <= 6, `Expected max 6 reasons, got ${result.reasons.length}`);
  assert.ok(Array.isArray(result.reasons));
});

test('confidence reasons are deterministic strings', () => {
  const result = computeConfidence({
    findingType: 'network_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: { failedRequests: 1, failedByStatus: { 404: 1 } },
      console: {},
      uiSignals: { changes: { changed: false } }
    },
    comparisons: {}
  });
  
  result.reasons.forEach(reason => {
    assert.strictEqual(typeof reason, 'string');
    assert.ok(reason.length > 0);
  });
});

// === EDGE CASES ===

test('confidence handles missing sensor data gracefully', () => {
  const result = computeConfidence({
    findingType: 'network_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {},
    comparisons: {}
  });
  
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(result.level));
});

test('confidence score never exceeds 100', () => {
  const result = computeConfidence({
    findingType: 'network_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: {
        failedRequests: 10,
        failedByStatus: { 500: 5, 503: 5 },
        topFailedUrls: [{ status: 500 }]
      },
      console: { pageErrorCount: 5, unhandledRejectionCount: 3 },
      uiSignals: { changes: { changed: false } }
    },
    comparisons: {}
  });
  
  assert.ok(result.score <= 100, `Score should be capped at 100, got ${result.score}`);
});

test('confidence score never goes below 0', () => {
  const result = computeConfidence({
    findingType: 'no_effect_silent_failure',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: { totalRequests: 100 },
      console: {},
      uiSignals: {
        before: {},
        after: { hasDialog: true, hasStatusSignal: true, hasLiveRegion: true },
        changes: { changed: true }
      }
    },
    comparisons: {}
  });
  
  assert.ok(result.score >= 0, `Score should never be negative, got ${result.score}`);
});
