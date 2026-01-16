/**
 * PHASE 15 — Confidence System Tests
 * 
 * Tests for unified confidence system including:
 * - Determinism
 * - Sensitivity
 * - Guardrails
 * - Coverage
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  computeUnifiedConfidence,
  computeConfidenceForFinding,
  CONFIDENCE_LEVEL,
  CONFIDENCE_REASON,
} from '../src/verax/core/confidence-engine.js';

test('Confidence System - determinism', () => {
  const params = {
    findingType: 'network_silent_failure',
    expectation: {
      proof: 'PROVEN_EXPECTATION',
      source: {
        astSource: "fetch('/api/submit')",
      },
    },
    sensors: {
      network: {
        failedRequests: 1,
        topFailedUrls: ['/api/submit'],
      },
      uiFeedback: {
        overallUiFeedbackScore: 0.1,
      },
    },
    evidence: {
      beforeAfter: {
        beforeScreenshot: 'screenshots/before.png',
        afterScreenshot: 'screenshots/after.png',
      },
    },
  };
  
  // Run twice with same inputs
  const result1 = computeUnifiedConfidence(params);
  const result2 = computeUnifiedConfidence(params);
  
  // Should produce identical results
  assert.equal(result1.score, result2.score, 'Scores should be identical');
  assert.equal(result1.level, result2.level, 'Levels should be identical');
  assert.deepEqual(result1.reasons, result2.reasons, 'Reasons should be identical');
});

test('Confidence System - sensitivity to promise strength', () => {
  const baseParams = {
    findingType: 'network_silent_failure',
    sensors: {
      network: {
        failedRequests: 1,
      },
    },
    evidence: {
      beforeAfter: {
        beforeScreenshot: 'screenshots/before.png',
        afterScreenshot: 'screenshots/after.png',
      },
    },
  };
  
  // PROVEN expectation
  const provenResult = computeUnifiedConfidence({
    ...baseParams,
    expectation: {
      proof: 'PROVEN_EXPECTATION',
      source: {
        astSource: "fetch('/api/submit')",
      },
    },
  });
  
  // WEAK expectation
  const weakResult = computeUnifiedConfidence({
    ...baseParams,
    expectation: {
      confidence: 0.3,
    },
  });
  
  // PROVEN should have higher score
  assert.ok(provenResult.score > weakResult.score, 'PROVEN expectation should have higher confidence');
  assert.ok(provenResult.reasons.includes(CONFIDENCE_REASON.PROMISE_PROVEN), 'Should include PROMISE_PROVEN reason');
});

test('Confidence System - sensitivity to observation strength', () => {
  const baseParams = {
    findingType: 'network_silent_failure',
    expectation: {
      proof: 'PROVEN_EXPECTATION',
    },
  };
  
  // Strong observations (URL change + DOM change + UI feedback)
  const strongResult = computeUnifiedConfidence({
    ...baseParams,
    sensors: {
      network: {
        failedRequests: 1,
      },
      navigation: {
        urlChanged: true,
      },
      uiSignals: {
        diff: {
          changed: true,
        },
      },
      uiFeedback: {
        overallUiFeedbackScore: 0.8,
      },
    },
    comparisons: {
      urlChanged: true,
      domChanged: true,
    },
  });
  
  // Weak observations (no signals)
  const weakResult = computeUnifiedConfidence({
    ...baseParams,
    sensors: {
      network: {
        failedRequests: 1,
      },
    },
  });
  
  // Strong observations should have higher score
  assert.ok(strongResult.score > weakResult.score, 'Strong observations should have higher confidence');
  assert.ok(strongResult.reasons.includes(CONFIDENCE_REASON.OBS_URL_CHANGED), 'Should include URL change reason');
});

test('Confidence System - guardrails and contradictions', () => {
  // Network success but no UI change (contradiction)
  const contradictionResult = computeUnifiedConfidence({
    findingType: 'network_silent_failure',
    expectation: {
      proof: 'PROVEN_EXPECTATION',
    },
    sensors: {
      network: {
        successfulRequests: 1,
        failedRequests: 0,
      },
      uiSignals: {
        diff: {
          changed: false,
        },
      },
      uiFeedback: {
        overallUiFeedbackScore: 0.0,
      },
    },
  });
  
  // Should detect contradiction
  assert.ok(contradictionResult.reasons.includes(CONFIDENCE_REASON.GUARD_NETWORK_SUCCESS_NO_UI), 'Should detect network success + no UI contradiction');
  
  // UI feedback present (contradicts silent failure)
  const uiFeedbackResult = computeUnifiedConfidence({
    findingType: 'network_silent_failure',
    expectation: {
      proof: 'PROVEN_EXPECTATION',
    },
    sensors: {
      network: {
        failedRequests: 1,
      },
      uiFeedback: {
        overallUiFeedbackScore: 0.9,
      },
    },
  });
  
  // Should detect UI feedback contradiction
  assert.ok(uiFeedbackResult.reasons.includes(CONFIDENCE_REASON.GUARD_UI_FEEDBACK_PRESENT), 'Should detect UI feedback contradiction');
  assert.ok(uiFeedbackResult.score < 0.6, 'Contradiction should lower confidence');
});

test('Confidence System - evidence completeness', () => {
  // Complete evidence
  const completeResult = computeUnifiedConfidence({
    findingType: 'network_silent_failure',
    expectation: {
      proof: 'PROVEN_EXPECTATION',
      source: {
        astSource: "fetch('/api/submit')",
      },
    },
    sensors: {
      network: {
        failedRequests: 1,
      },
    },
    evidence: {
      beforeAfter: {
        beforeScreenshot: 'screenshots/before.png',
        afterScreenshot: 'screenshots/after.png',
      },
      signals: {
        urlChanged: false,
        domChanged: false,
      },
      source: {
        astSource: "fetch('/api/submit')",
      },
    },
  });
  
  // Incomplete evidence
  const incompleteResult = computeUnifiedConfidence({
    findingType: 'network_silent_failure',
    expectation: {
      proof: 'PROVEN_EXPECTATION',
    },
    sensors: {
      network: {
        failedRequests: 1,
      },
    },
    evidence: {},
  });
  
  // Complete evidence should have higher score
  assert.ok(completeResult.score > incompleteResult.score, 'Complete evidence should have higher confidence');
  assert.ok(completeResult.reasons.includes(CONFIDENCE_REASON.EVIDENCE_SCREENSHOTS), 'Should include screenshots reason');
  assert.ok(completeResult.reasons.includes(CONFIDENCE_REASON.EVIDENCE_SNIPPETS), 'Should include snippets reason');
  assert.ok(incompleteResult.reasons.includes(CONFIDENCE_REASON.EVIDENCE_INCOMPLETE), 'Should include incomplete reason');
});

test('Confidence System - level determination', () => {
  // HIGH: score >= 0.8, proven promise, complete evidence
  const highResult = computeUnifiedConfidence({
    findingType: 'network_silent_failure',
    expectation: {
      proof: 'PROVEN_EXPECTATION',
      source: {
        astSource: "fetch('/api/submit')",
      },
    },
    sensors: {
      network: {
        failedRequests: 1,
        topFailedUrls: ['/api/submit'],
      },
      navigation: {
        urlChanged: true,
      },
      uiSignals: {
        diff: {
          changed: true,
        },
      },
    },
    evidence: {
      beforeAfter: {
        beforeScreenshot: 'screenshots/before.png',
        afterScreenshot: 'screenshots/after.png',
      },
      source: {
        astSource: "fetch('/api/submit')",
      },
    },
  });
  
  // Should be HIGH if score is high enough
  if (highResult.score >= 0.8) {
    assert.equal(highResult.level, CONFIDENCE_LEVEL.HIGH, 'High score with proven promise should be HIGH');
  }
  
  // LOW: score < 0.3
  const lowResult = computeUnifiedConfidence({
    findingType: 'network_silent_failure',
    expectation: {
      confidence: 0.2,
    },
    sensors: {},
    evidence: {},
  });
  
  assert.equal(lowResult.level, CONFIDENCE_LEVEL.UNPROVEN, 'Low score should be UNPROVEN');
});

test('Confidence System - computeConfidenceForFinding wrapper', () => {
  const params = {
    findingType: 'route_silent_failure',
    expectation: {
      proof: 'PROVEN_EXPECTATION',
      targetPath: '/about',
      source: {
        file: 'src/App.jsx',
        line: 10,
        astSource: "router.push('/about')",
      },
    },
    sensors: {
      navigation: {
        urlChanged: false,
      },
      uiSignals: {
        diff: {
          changed: false,
        },
      },
    },
    evidence: {
      beforeAfter: {
        beforeUrl: 'http://localhost:3000/',
        afterUrl: 'http://localhost:3000/',
        beforeScreenshot: 'screenshots/before.png',
        afterScreenshot: 'screenshots/after.png',
      },
    },
  };
  
  const result = computeConfidenceForFinding(params);
  
  assert.ok(typeof result.score === 'number', 'Should have score');
  assert.ok(result.score >= 0 && result.score <= 1, 'Score should be 0..1');
  assert.ok(Object.values(CONFIDENCE_LEVEL).includes(result.level), 'Should have valid level');
  assert.ok(Array.isArray(result.reasons), 'Should have reasons array');
  assert.ok(result.reasons.length > 0, 'Should have at least one reason');
});

test('Confidence System - reason code stability', () => {
  const params = {
    findingType: 'network_silent_failure',
    expectation: {
      proof: 'PROVEN_EXPECTATION',
      source: {
        astSource: "fetch('/api/submit')",
      },
    },
    sensors: {
      network: {
        failedRequests: 1,
      },
      navigation: {
        urlChanged: true,
      },
      uiFeedback: {
        overallUiFeedbackScore: 0.8,
      },
    },
    evidence: {
      beforeAfter: {
        beforeScreenshot: 'screenshots/before.png',
        afterScreenshot: 'screenshots/after.png',
      },
    },
  };
  
  const result = computeUnifiedConfidence(params);
  
  // All reasons should be stable codes
  for (const reason of result.reasons) {
    assert.ok(Object.values(CONFIDENCE_REASON).includes(reason), `Reason "${reason}" should be a stable code`);
  }
});

