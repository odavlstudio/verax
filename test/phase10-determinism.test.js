import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { enforceInvariants, VERAX_PRODUCTION_LOCK, validateFindingStructure } from '../src/verax/core/invariants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('VERAX_PRODUCTION_LOCK is enabled', () => {
  assert.equal(VERAX_PRODUCTION_LOCK, true, 'Production lock must be enabled');
});

test('enforceInvariants - drops finding with missing evidence', () => {
  const finding = {
    type: 'navigation_silent_failure',
    confidence: { level: 'HIGH', score: 80 },
    signals: {
      impact: 'HIGH',
      userRisk: 'BLOCKS',
      ownership: 'FRONTEND',
      grouping: { groupByRoute: '/', groupByFailureType: 'navigation_silent_failure', groupByFeature: 'root' }
    }
    // Missing evidence
  };
  const trace = {
    sensors: {
      network: { totalRequests: 0 }
    }
  };
  
  const validation = enforceInvariants(finding, trace, null);
  
  assert.equal(validation.shouldDrop, true, 'Finding without evidence should be dropped');
  assert.equal(validation.reason, 'missing_evidence', 'Should indicate missing evidence reason');
});

test('enforceInvariants - drops finding with missing confidence', () => {
  const finding = {
    type: 'navigation_silent_failure',
    evidence: {
      beforeUrl: 'http://localhost/',
      afterUrl: 'http://localhost/'
    },
    signals: {
      impact: 'HIGH',
      userRisk: 'BLOCKS',
      ownership: 'FRONTEND',
      grouping: { groupByRoute: '/', groupByFailureType: 'navigation_silent_failure', groupByFeature: 'root' }
    }
    // Missing confidence
  };
  const trace = {
    sensors: {
      network: { totalRequests: 0 }
    }
  };
  
  const validation = enforceInvariants(finding, trace, null);
  
  assert.equal(validation.shouldDrop, true, 'Finding without confidence should be dropped');
  assert.equal(validation.reason, 'missing_confidence', 'Should indicate missing confidence reason');
});

test('enforceInvariants - drops finding with missing signals', () => {
  const finding = {
    type: 'navigation_silent_failure',
    evidence: {
      beforeUrl: 'http://localhost/',
      afterUrl: 'http://localhost/'
    },
    confidence: { level: 'HIGH', score: 80 }
    // Missing signals
  };
  const trace = {
    sensors: {
      network: { totalRequests: 0 }
    }
  };
  
  const validation = enforceInvariants(finding, trace, null);
  
  assert.equal(validation.shouldDrop, true, 'Finding without signals should be dropped');
  assert.equal(validation.reason, 'missing_signals', 'Should indicate missing signals reason');
});

test('enforceInvariants - drops ungrounded finding (no proven expectation, no observable sensor)', () => {
  const finding = {
    type: 'navigation_silent_failure',
    evidence: {},
    confidence: { level: 'HIGH', score: 80 },
    signals: {
      impact: 'HIGH',
      userRisk: 'BLOCKS',
      ownership: 'FRONTEND',
      grouping: { groupByRoute: '/', groupByFailureType: 'navigation_silent_failure', groupByFeature: 'root' }
    }
  };
  const trace = {
    sensors: {}
    // No sensor activity
  };
  
  const validation = enforceInvariants(finding, trace, null);
  
  assert.equal(validation.shouldDrop, true, 'Ungrounded finding should be dropped');
  assert.equal(validation.reason, 'ungrounded_finding', 'Should indicate ungrounded finding reason');
});

test('enforceInvariants - allows finding with proven expectation', () => {
  const finding = {
    type: 'navigation_silent_failure',
    evidence: {
      beforeUrl: 'http://localhost/',
      afterUrl: 'http://localhost/'
    },
    confidence: { level: 'HIGH', score: 80 },
    signals: {
      impact: 'HIGH',
      userRisk: 'BLOCKS',
      ownership: 'FRONTEND',
      grouping: { groupByRoute: '/', groupByFailureType: 'navigation_silent_failure', groupByFeature: 'root' }
    }
  };
  const trace = {
    sensors: {
      network: { totalRequests: 0 }
    }
  };
  const matchedExpectation = {
    type: 'navigation',
    fromPath: '/',
    targetPath: '/about',
    sourceRef: 'home.vue:10' // Proven expectation
  };
  
  const validation = enforceInvariants(finding, trace, matchedExpectation);
  
  assert.equal(validation.shouldDrop, false, 'Finding with proven expectation should pass');
});

test('enforceInvariants - allows finding with observable sensor', () => {
  const finding = {
    type: 'navigation_silent_failure',
    evidence: {
      beforeUrl: 'http://localhost/',
      afterUrl: 'http://localhost/',
      beforeScreenshot: 'screenshot1.png'
    },
    confidence: { level: 'HIGH', score: 80 },
    signals: {
      impact: 'HIGH',
      userRisk: 'BLOCKS',
      ownership: 'FRONTEND',
      grouping: { groupByRoute: '/', groupByFailureType: 'navigation_silent_failure', groupByFeature: 'root' }
    }
  };
  const trace = {
    sensors: {
      network: { totalRequests: 1, failedRequests: 0 },
      uiSignals: { diff: { changed: false } }
    }
  };
  
  const validation = enforceInvariants(finding, trace, null);
  
  assert.equal(validation.shouldDrop, false, 'Finding with observable sensor should pass');
});

test('enforceInvariants - drops ambiguous finding (low confidence + conflicting signals)', () => {
  const finding = {
    type: 'navigation_silent_failure',
    evidence: {
      beforeUrl: 'http://localhost/'
      // No afterUrl, no screenshots, no network evidence
    },
    confidence: { level: 'LOW', score: 45 }, // Low confidence below threshold
    signals: {
      impact: 'HIGH', // High impact but low confidence
      userRisk: 'BLOCKS',
      ownership: 'FRONTEND',
      grouping: { groupByRoute: '/', groupByFailureType: 'navigation_silent_failure', groupByFeature: 'root' }
    }
  };
  const trace = {
    sensors: {
      network: { totalRequests: 0 } // No network activity
      // No other sensor activity
    }
  };
  
  const validation = enforceInvariants(finding, trace, null);
  
  // Should drop due to ambiguity or contradiction: HIGH impact + LOW confidence + weak evidence
  // Either ambiguous_finding (conflicting signals) or contradictory_signals is acceptable
  assert.equal(validation.shouldDrop, true, 'Ambiguous finding should be dropped');
  assert.ok(validation.reason === 'ambiguous_finding' || validation.reason === 'contradictory_signals', 
    `Should indicate ambiguous or contradictory signals (got: ${validation.reason})`);
});

test('enforceInvariants - drops contradictory signals (HIGH impact + LOW confidence + weak evidence)', () => {
  const finding = {
    type: 'network_silent_failure',
    evidence: {
      // Weak evidence - no URLs, no screenshots, no network requests count
    },
    confidence: { level: 'LOW', score: 40 }, // Low confidence below threshold
    signals: {
      impact: 'HIGH', // Contradiction: HIGH impact but LOW confidence and weak evidence
      userRisk: 'BLOCKS',
      ownership: 'BACKEND', // Also contradictory: BACKEND without network evidence
      grouping: { groupByRoute: '*', groupByFailureType: 'network_silent_failure', groupByFeature: 'unknown' }
    }
  };
  const trace = {
    sensors: {
      network: { totalRequests: 0 } // No network activity
    }
  };
  
  const validation = enforceInvariants(finding, trace, null);
  
  assert.equal(validation.shouldDrop, true, 'Finding with contradictory signals should be dropped');
  // Should be dropped for contradictory signals (HIGH impact + LOW confidence + weak evidence, or BACKEND without network)
  assert.ok(validation.reason === 'contradictory_signals' || validation.reason === 'ambiguous_finding' || validation.reason === 'ungrounded_finding', 
    `Should indicate contradictory, ambiguous, or ungrounded signals (got: ${validation.reason})`);
});

test('enforceInvariants - allows valid finding with observed expectation', () => {
  const finding = {
    type: 'navigation_silent_failure',
    evidence: {
      beforeUrl: 'http://localhost/',
      afterUrl: 'http://localhost/'
    },
    confidence: { level: 'MEDIUM', score: 65 },
    expectationId: 'obs-123',
    signals: {
      impact: 'MEDIUM',
      userRisk: 'BLOCKS',
      ownership: 'FRONTEND',
      grouping: { groupByRoute: '/', groupByFailureType: 'navigation_silent_failure', groupByFeature: 'root' }
    }
  };
  const trace = {
    sensors: {
      network: { totalRequests: 0 }
    },
    observedExpectation: {
      id: 'obs-123',
      type: 'navigation'
    }
  };
  
  const validation = enforceInvariants(finding, trace, null);
  
  assert.equal(validation.shouldDrop, false, 'Finding with observed expectation should pass');
});

test('validateFindingStructure - validates finding structure', () => {
  const validFinding = {
    type: 'navigation_silent_failure',
    evidence: { beforeUrl: 'http://localhost/' },
    confidence: { level: 'HIGH', score: 80 },
    signals: {
      impact: 'HIGH',
      userRisk: 'BLOCKS',
      ownership: 'FRONTEND',
      grouping: {}
    }
  };
  
  const invalidFinding = {
    type: 'navigation_silent_failure'
    // Missing required fields
  };
  
  const validResult = validateFindingStructure(validFinding);
  const invalidResult = validateFindingStructure(invalidFinding);
  
  assert.equal(validResult.valid, true, 'Valid finding should pass structure validation');
  assert.equal(validResult.errors.length, 0, 'Valid finding should have no errors');
  
  assert.equal(invalidResult.valid, false, 'Invalid finding should fail structure validation');
  assert.ok(invalidResult.errors.length > 0, 'Invalid finding should have errors');
});

test('deterministic output - same input produces same findings (structure check)', () => {
  // This is a meta-test: verify that findings structure is deterministic
  // Actual determinism test would require full scan execution
  const finding1 = {
    type: 'navigation_silent_failure',
    evidence: { beforeUrl: 'http://localhost/' },
    confidence: { level: 'HIGH', score: 80 },
    signals: {
      impact: 'HIGH',
      userRisk: 'BLOCKS',
      ownership: 'FRONTEND',
      grouping: { groupByRoute: '/', groupByFailureType: 'navigation_silent_failure', groupByFeature: 'root' }
    }
  };
  
  const finding2 = {
    type: 'navigation_silent_failure',
    evidence: { beforeUrl: 'http://localhost/' },
    confidence: { level: 'HIGH', score: 80 },
    signals: {
      impact: 'HIGH',
      userRisk: 'BLOCKS',
      ownership: 'FRONTEND',
      grouping: { groupByRoute: '/', groupByFailureType: 'navigation_silent_failure', groupByFeature: 'root' }
    }
  };
  
  // Same finding structure should produce same validation result
  const validation1 = enforceInvariants(finding1, {}, null);
  const validation2 = enforceInvariants(finding2, {}, null);
  
  assert.deepEqual(validation1, validation2, 'Same finding should produce same validation result');
});

test('invariant enforcement - drops finding with invalid impact enum', () => {
  const finding = {
    type: 'navigation_silent_failure',
    evidence: { beforeUrl: 'http://localhost/' },
    confidence: { level: 'HIGH', score: 80 },
    signals: {
      impact: 'INVALID', // Invalid enum value
      userRisk: 'BLOCKS',
      ownership: 'FRONTEND',
      grouping: { groupByRoute: '/', groupByFailureType: 'navigation_silent_failure', groupByFeature: 'root' }
    }
  };
  const trace = {
    sensors: {
      network: { totalRequests: 1 }
    }
  };
  
  const validation = enforceInvariants(finding, trace, null);
  
  assert.equal(validation.shouldDrop, true, 'Finding with invalid impact should be dropped');
  assert.equal(validation.reason, 'invalid_impact', 'Should indicate invalid impact reason');
});

test('invariant enforcement - drops finding with invalid ownership enum', () => {
  const finding = {
    type: 'navigation_silent_failure',
    evidence: { beforeUrl: 'http://localhost/' },
    confidence: { level: 'HIGH', score: 80 },
    signals: {
      impact: 'HIGH',
      userRisk: 'BLOCKS',
      ownership: 'INVALID', // Invalid enum value
      grouping: { groupByRoute: '/', groupByFailureType: 'navigation_silent_failure', groupByFeature: 'root' }
    }
  };
  const trace = {
    sensors: {
      network: { totalRequests: 1 }
    }
  };
  
  const validation = enforceInvariants(finding, trace, null);
  
  assert.equal(validation.shouldDrop, true, 'Finding with invalid ownership should be dropped');
  assert.equal(validation.reason, 'invalid_ownership', 'Should indicate invalid ownership reason');
});

test('invariant enforcement - allows valid finding with all required fields', () => {
  const finding = {
    type: 'navigation_silent_failure',
    evidence: {
      beforeUrl: 'http://localhost/',
      afterUrl: 'http://localhost/',
      beforeScreenshot: 'screenshot1.png',
      afterScreenshot: 'screenshot2.png'
    },
    confidence: { level: 'HIGH', score: 85 },
    signals: {
      impact: 'HIGH',
      userRisk: 'BLOCKS',
      ownership: 'FRONTEND',
      grouping: {
        groupByRoute: '/',
        groupByFailureType: 'navigation_silent_failure',
        groupByFeature: 'root'
      }
    }
  };
  const trace = {
    sensors: {
      network: { totalRequests: 1, failedRequests: 0 },
      uiSignals: { diff: { changed: false } }
    }
  };
  const matchedExpectation = {
    type: 'navigation',
    fromPath: '/',
    targetPath: '/about',
    sourceRef: 'home.vue:10'
  };
  
  const validation = enforceInvariants(finding, trace, matchedExpectation);
  
  assert.equal(validation.shouldDrop, false, 'Valid finding with all fields should pass');
  assert.equal(validation.reason, null, 'Valid finding should have no drop reason');
});

test('invariant enforcement - allows partial_success finding (explicit exception)', () => {
  // partial_success findings may have network success but no UI change - this is valid
  const finding = {
    type: 'partial_success_silent_failure',
    evidence: {
      beforeUrl: 'http://localhost/',
      networkRequests: 1,
      networkSuccessful: true,
      domChanged: false,
      uiChanged: false,
      urlChanged: false
    },
    confidence: { level: 'MEDIUM', score: 65 },
    signals: {
      impact: 'MEDIUM',
      userRisk: 'CONFUSES',
      ownership: 'BACKEND',
      grouping: { groupByRoute: '/', groupByFailureType: 'partial_success_silent_failure', groupByFeature: 'root' }
    }
  };
  const trace = {
    sensors: {
      network: { totalRequests: 1, successfulRequests: 1 },
      uiSignals: { diff: { changed: false } }
    }
  };
  
  const validation = enforceInvariants(finding, trace, null);
  
  // partial_success findings are explicitly allowed even if signals seem conflicting
  assert.equal(validation.shouldDrop, false, 'partial_success finding should pass (explicit exception)');
});

test('deterministic output - same finding structure produces same validation result', () => {
  const finding = {
    type: 'navigation_silent_failure',
    evidence: {
      beforeUrl: 'http://localhost/',
      afterUrl: 'http://localhost/'
    },
    confidence: { level: 'HIGH', score: 80 },
    signals: {
      impact: 'HIGH',
      userRisk: 'BLOCKS',
      ownership: 'FRONTEND',
      grouping: { groupByRoute: '/', groupByFailureType: 'navigation_silent_failure', groupByFeature: 'root' }
    }
  };
  const trace = {
    sensors: {
      network: { totalRequests: 1 }
    }
  };
  
  // Same finding, same trace - should produce identical validation results
  const validation1 = enforceInvariants(finding, trace, null);
  const validation2 = enforceInvariants(finding, trace, null);
  
  assert.deepEqual(validation1, validation2, 'Same finding should produce identical validation result');
  assert.equal(validation1.shouldDrop, validation2.shouldDrop, 'shouldDrop should be identical');
  assert.equal(validation1.reason, validation2.reason, 'reason should be identical');
});

test('invariant enforcement - production lock must be enabled', () => {
  assert.equal(VERAX_PRODUCTION_LOCK, true, 'VERAX_PRODUCTION_LOCK must be true for production safety');
  
  // Verify that invariants are enforced when lock is enabled
  const invalidFinding = {
    type: 'test_finding'
    // Missing all required fields
  };
  
  const validation = enforceInvariants(invalidFinding, {}, null);
  assert.equal(validation.shouldDrop, true, 'Invalid finding should be dropped when production lock is enabled');
});

test('invariant enforcement - ambiguous findings are conservatively dropped', () => {
  // Finding with LOW confidence but HIGH impact and weak evidence should be dropped
  const ambiguousFinding = {
    type: 'network_silent_failure',
    evidence: {
      // Empty evidence
    },
    confidence: { level: 'LOW', score: 35 }, // Very low confidence
    signals: {
      impact: 'HIGH', // High impact claim
      userRisk: 'BLOCKS',
      ownership: 'BACKEND', // Also contradictory: BACKEND without network
      grouping: { groupByRoute: '*', groupByFailureType: 'network_silent_failure', groupByFeature: 'unknown' }
    }
  };
  const trace = {
    sensors: {
      network: { totalRequests: 0 }
    }
  };
  
  const validation = enforceInvariants(ambiguousFinding, trace, null);
  
  // Should be dropped: ungrounded (no evidence, no sensors), ambiguous, or contradictory
  assert.equal(validation.shouldDrop, true, 'Ambiguous finding must be dropped conservatively');
});

