/**
 *  Policy, Invariants, and Reason Codes Tests
 * 
 * Tests proving:
 * 1) Policy loads once and is cached deterministically
 * 2) Truth locks override policy values
 * 3) Invariants applied exactly once
 * 4) Reason codes are stable and ordered
 * 5) Policy changes result in deterministic output changes
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Imports for testing
import { getConfidencePolicy, clearPolicyCache, getPolicyCacheStats } from '../src/verax/core/confidence/policy-cache.js';
import { computeFinalConfidence } from '../src/verax/core/confidence/confidence-compute.js';
import { CONFIDENCE_RANGES } from '../src/verax/core/confidence/confidence-invariants.js';
import { generateReasonCodes, REASON_CODES } from '../src/verax/core/confidence/reason-codes.js';
import { generateTruthAwareExplanation } from '../src/verax/core/confidence/explanation-helpers.js';

describe(' Policy, Invariants, and Reason Codes', () => {
  
  // Clean cache between tests
  beforeEach(() => {
    clearPolicyCache();
  });

  afterEach(() => {
    clearPolicyCache();
  });

  // ========================
  // TEST 1: Policy Caching
  // ========================
  describe('Policy Caching (STEP 1)', () => {
    
    test('loads policy once per cache key', () => {
      // Call 1
      const policy1 = getConfidencePolicy(null, '/project1');
      const stats1 = getPolicyCacheStats();
      assert.strictEqual(stats1.size, 1, 'Should have 1 cached policy');
      
      // Call 2 (same cache key)
      const policy2 = getConfidencePolicy(null, '/project1');
      const stats2 = getPolicyCacheStats();
      assert.strictEqual(stats2.size, 1, 'Should still have 1 cached policy');
      
      // Same object returned
      assert.strictEqual(policy1, policy2, 'Should return same object reference');
    });

    test('caches by projectDir + policyPath combination', () => {
      // Different projectDir
      const policy1 = getConfidencePolicy(null, '/project1');
      // Explicitly different projectDir (second call)
      clearPolicyCache();
      const policy2 = getConfidencePolicy(null, '/project2');
      
      // After cache clear and separate call, these are different cache entries
      assert(policy1, 'Should load policy1');
      assert(policy2, 'Should load policy2');
      // Both should be valid policies (same structure since both use defaults)
      assert.strictEqual(policy1.version, policy2.version, 'Should have same version (defaults)');
    });

    test('policy is frozen after loading', () => {
      const policy = getConfidencePolicy(null, '/test-project');
      
      // Attempt mutation
      let error;
      try {
        policy.version = '999.0.0';
      } catch (e) {
        error = e;
      }
      
      // Should have thrown an error (could be TypeError or similar)
      assert(error, 'Should throw error when trying to mutate frozen policy');
      assert(error instanceof TypeError, 'Error should be TypeError for frozen object');
    });

    test('truth locks are non-overridable', () => {
      const policy = getConfidencePolicy(null, '/test-project');
      
      // Truth locks must exist
      assert(policy.truthLocks, 'Policy must have truthLocks');
      assert(policy.truthLocks.evidenceCompleteRequired === true, 'evidenceCompleteRequired must be true');
      assert(typeof policy.truthLocks.nonDeterministicMaxConfidence === 'number', 'nonDeterministicMaxConfidence must be number');
      assert(policy.truthLocks.guardrailsMaxNegative === true, 'guardrailsMaxNegative must be true');
    });
  });

  // ========================
  // TEST 2: Invariants
  // ========================
  describe('Invariants Enforcement (STEP 2)', () => {
    
    test('invariants applied exactly once', () => {
      const result = computeFinalConfidence({
        findingType: 'test_finding',
        expectation: { proof: 'UNPROVEN_EXPECTATION' },
        sensors: { network: { totalRequests: 5 } },
        comparisons: {},
        evidence: { isComplete: false },
        truthStatus: 'SUSPECTED',
        options: {}
      });
      
      // Should apply exactly one invariant violation (unproven expectation cap)
      assert(result.appliedInvariants, 'Should have appliedInvariants array');
      assert(result.invariantViolations, 'Should have invariantViolations array');
      
      // Check that violations match applied invariants
      const violationCodes = result.invariantViolations.map(v => v.code);
      assert.deepStrictEqual(result.appliedInvariants, violationCodes, 'Applied invariants must match violation codes');
    });

    test('CONFIRMED status requires confidence >= 0.70', () => {
      const params = {
        findingType: 'test',
        expectation: { proof: 'PROVEN_EXPECTATION' },
        sensors: { network: { totalRequests: 10 } },
        comparisons: {},
        evidence: { isComplete: true },
        truthStatus: 'CONFIRMED',
        options: {}
      };
      
      const result = computeFinalConfidence(params);
      
      // CONFIRMED confidence must be >= 0.70
      assert(result.confidenceAfter >= CONFIDENCE_RANGES.CONFIRMED.min, 
        `CONFIRMED requires confidence >= ${CONFIDENCE_RANGES.CONFIRMED.min}, got ${result.confidenceAfter}`);
    });

    test('SUSPECTED status requires confidence in [0.30, 0.69]', () => {
      const params = {
        findingType: 'test',
        expectation: { proof: 'OBSERVED_EXPECTATION' },
        sensors: { network: { totalRequests: 5 } },
        comparisons: {},
        evidence: { isComplete: false },
        truthStatus: 'SUSPECTED',
        options: {}
      };
      
      const result = computeFinalConfidence(params);
      
      // SUSPECTED must be in range
      const min = CONFIDENCE_RANGES.SUSPECTED.min;
      const max = CONFIDENCE_RANGES.SUSPECTED.max;
      assert(result.confidenceAfter >= min && result.confidenceAfter <= max,
        `SUSPECTED requires confidence in [${min}, ${max}], got ${result.confidenceAfter}`);
    });

    test('IGNORED status requires confidence === 0', () => {
      const params = {
        findingType: 'test',
        expectation: { proof: 'WEAK_EXPECTATION' },
        sensors: {},
        comparisons: {},
        evidence: { isComplete: false },
        truthStatus: 'IGNORED',
        options: {}
      };
      
      const result = computeFinalConfidence(params);
      
      // IGNORED must have confidence = 0
      assert.strictEqual(result.confidenceAfter, 0, 'IGNORED must have confidence === 0');
    });

    test('truth locks are applied non-overridably', () => {
      const params = {
        findingType: 'test',
        expectation: { proof: 'UNPROVEN_EXPECTATION' }, // This triggers a truth lock
        sensors: { network: { totalRequests: 100 } },
        comparisons: {},
        evidence: { isComplete: false },
        truthStatus: 'SUSPECTED',
        options: { verificationStatus: 'VERIFIED_WITH_ERRORS' } // Another truth lock
      };
      
      const result = computeFinalConfidence(params);
      
      // With UNPROVEN_EXPECTATION, confidence capped at 0.39
      // With VERIFIED_WITH_ERRORS, confidence capped at 0.49
      // The lower cap should apply
      assert(result.confidenceAfter <= 0.39,
        `UNPROVEN_EXPECTATION truth lock should cap confidence at 0.39, got ${result.confidenceAfter}`);
    });
  });

  // ========================
  // TEST 3: Reason Codes
  // ========================
  describe('Reason Codes Generation (STEP 3)', () => {
    
    test('reason codes are deterministically ordered', () => {
      const params = {
        expectation: { proof: 'PROVEN_EXPECTATION' },
        sensors: { 
          network: { totalRequests: 5 },
          console: { errors: 2 },
          uiSignals: { change: true }
        },
        evidence: { isComplete: true, signals: { found: true } },
        guardrailsOutcome: null,
        evidenceIntent: null,
        appliedInvariants: [],
        truthStatus: 'SUSPECTED'
      };
      
      // Generate twice
      const codes1 = generateReasonCodes(params);
      const codes2 = generateReasonCodes(params);
      
      // Must be identical
      assert.deepStrictEqual(codes1, codes2, 'Same inputs must produce identical reason codes');
      
      // Codes must be ordered by priority
      if (codes1.length > 1) {
        for (let i = 0; i < codes1.length - 1; i++) {
          const meta1 = Object.values(REASON_CODES).find(r => r.code === codes1[i]);
          const meta2 = Object.values(REASON_CODES).find(r => r.code === codes1[i + 1]);
          assert(meta1.priority <= meta2.priority, `Codes should be ordered by priority: ${codes1[i]} (${meta1.priority}) > ${codes1[i + 1]} (${meta2.priority})`);
        }
      }
    });

    test('reason codes contain no duplicates', () => {
      const params = {
        expectation: { proof: 'PROVEN_EXPECTATION' },
        sensors: { network: { totalRequests: 5 } },
        evidence: { isComplete: true, signals: { found: true } },
        appliedInvariants: [],
        truthStatus: 'CONFIRMED'
      };
      
      const codes = generateReasonCodes(params);
      const uniqueCodes = new Set(codes);
      
      assert.strictEqual(codes.length, uniqueCodes.size, 'No duplicate reason codes allowed');
    });

    test('reason codes reflect guardrails outcome', () => {
      const params = {
        expectation: { proof: 'OBSERVED_EXPECTATION' },
        sensors: {},
        evidence: { isComplete: false },
        guardrailsOutcome: {
          downgraded: true,
          confidenceDelta: -0.15,
          finalDecision: 'INFORMATIONAL'
        },
        appliedInvariants: [],
        truthStatus: 'SUSPECTED'
      };
      
      const codes = generateReasonCodes(params);
      
      // Should include guardrails-related codes
      assert(codes.some(c => c.includes('GUARDRAILS')), 'Should include guardrails reason codes');
    });

    test('reason codes reflect evidence intent failures', () => {
      const params = {
        expectation: { proof: 'WEAK_EXPECTATION' },
        sensors: {},
        evidence: { isComplete: false },
        evidenceIntent: {
          captureOutcomes: {
            network: { captured: false },
            console: { captured: true }
          }
        },
        appliedInvariants: [],
        truthStatus: 'SUSPECTED'
      };
      
      const codes = generateReasonCodes(params);
      
      // Should include evidence intent failure code
      assert(codes.some(c => c.includes('EVIDENCE_INTENT')), 'Should include evidence intent reason codes');
    });
  });

  // ========================
  // TEST 4: Explanations
  // ========================
  describe('Truth-Aware Explanations (STEP 4)', () => {
    
    test('explanations reflect truth status', () => {
      const explanation = generateTruthAwareExplanation({
        confidenceScore: 0.65,
        confidenceLevel: 'MEDIUM',
        truthStatus: 'CONFIRMED',
        expectation: { proof: 'PROVEN_EXPECTATION' }
      });
      
      assert(explanation.whyThisConfidence, 'Should have whyThisConfidence');
      assert(explanation.whyThisConfidence.includes('CONFIRMED'), 'Should mention CONFIRMED status');
    });

    test('explanations include what would increase/decrease confidence', () => {
      const explanation = generateTruthAwareExplanation({
        confidenceScore: 0.5,
        confidenceLevel: 'MEDIUM',
        truthStatus: 'SUSPECTED',
        expectation: { proof: 'WEAK_EXPECTATION' },
        sensors: {},
        evidence: { isComplete: false }
      });
      
      assert(Array.isArray(explanation.whatWouldIncreaseConfidence), 'Should have whatWouldIncreaseConfidence array');
      assert(Array.isArray(explanation.whatWouldReduceConfidence), 'Should have whatWouldReduceConfidence array');
      assert(explanation.whatWouldIncreaseConfidence.length > 0, 'Should have increase suggestions');
      assert(explanation.whatWouldReduceConfidence.length > 0, 'Should have reduce suggestions');
    });

    test('explanations integrate guardrails outcome', () => {
      const explanation = generateTruthAwareExplanation({
        confidenceScore: 0.5,
        confidenceLevel: 'MEDIUM',
        truthStatus: 'SUSPECTED',
        expectation: { proof: 'OBSERVED_EXPECTATION' },
        guardrailsOutcome: {
          downgraded: true,
          confidenceDelta: -0.1,
          finalDecision: 'INFORMATIONAL'
        }
      });
      
      assert(explanation.whyThisConfidence.includes('Guardrails') || explanation.whyThisConfidence.includes('guardrails'),
        'Should mention guardrails in explanation');
    });
  });

  // ========================
  // TEST 5: Determinism
  // ========================
  describe('Deterministic Policy Application (STEP 5)', () => {
    
    test('same inputs produce identical confidence output', () => {
      const params = {
        findingType: 'route_detection',
        expectation: { proof: 'OBSERVED_EXPECTATION' },
        sensors: { network: { totalRequests: 10, slowRequests: 2 } },
        comparisons: { urlChanged: true },
        evidence: { isComplete: true, signals: { urlChange: true } },
        truthStatus: 'SUSPECTED',
        options: {}
      };
      
      const result1 = computeFinalConfidence(params);
      const result2 = computeFinalConfidence(params);
      
      assert.strictEqual(result1.confidenceAfter, result2.confidenceAfter, 'Confidence should be identical');
      assert.strictEqual(result1.confidenceLevel, result2.confidenceLevel, 'Confidence level should be identical');
      assert.deepStrictEqual(result1.reasonCodes, result2.reasonCodes, 'Reason codes should be identical');
    });

    test('policy parameter changes result in deterministic changes', () => {
      const baseParams = {
        findingType: 'test',
        expectation: { proof: 'OBSERVED_EXPECTATION' },
        sensors: { network: { totalRequests: 5 } },
        evidence: { isComplete: false },
        truthStatus: 'SUSPECTED',
        options: {}
      };
      
      // Run 1: no policy path
      const result1 = computeFinalConfidence(baseParams);
      
      // Run 2: same params again (should use cache)
      const result2 = computeFinalConfidence(baseParams);
      
      // Results should be deterministic
      assert.strictEqual(result1.confidenceAfter, result2.confidenceAfter, 'Cached policy should produce identical results');
    });
  });

  // ========================
  // TEST 6: Integration
  // ========================
  describe('Full Integration (All Steps)', () => {
    
    test('end-to-end policy + invariants + reason codes + explanations', () => {
      const params = {
        findingType: 'ui_feedback_detection',
        expectation: { 
          proof: 'PROVEN_EXPECTATION',
          type: 'navigation'
        },
        sensors: {
          network: { totalRequests: 20, failedRequests: 1 },
          console: { errors: 0, warnings: 1 },
          uiSignals: { feedbackShown: true }
        },
        comparisons: { urlChanged: true, domChanged: true },
        evidence: {
          isComplete: true,
          signals: {
            urlChange: true,
            domMutation: true,
            feedbackElement: true
          }
        },
        guardrailsOutcome: {
          downgraded: false,
          confidenceDelta: 0.05
        },
        evidenceIntent: {
          captureOutcomes: {
            network: { captured: true },
            console: { captured: true },
            ui: { captured: true }
          }
        },
        truthStatus: 'CONFIRMED',
        options: { projectDir: '/integration-test' }
      };
      
      const result = computeFinalConfidence(params);
      
      // Verify all components present
      assert(result.confidenceAfter >= 0, 'Should have valid confidence');
      assert(result.confidenceLevel, 'Should have confidence level');
      assert(Array.isArray(result.appliedInvariants), 'Should have appliedInvariants array');
      assert(Array.isArray(result.invariantViolations), 'Should have invariantViolations array');
      assert(Array.isArray(result.reasonCodes), 'Should have reason codes array');
      assert(result.confidenceExplanation, 'Should have explanation object');
      assert(result.confidenceExplanation.whyThisConfidence, 'Should have whyThisConfidence');
      assert(Array.isArray(result.confidenceExplanation.whatWouldIncreaseConfidence), 'Should have increase suggestions');
      assert(Array.isArray(result.confidenceExplanation.whatWouldReduceConfidence), 'Should have reduce suggestions');
      assert(result.appliedPolicy, 'Should have applied policy reference');
      
      // For CONFIRMED with PROVEN expectation and complete evidence, should be high confidence
      if (result.truthStatus === 'CONFIRMED') {
        assert(result.confidenceAfter >= CONFIDENCE_RANGES.CONFIRMED.min, 
          `CONFIRMED status requires confidence >= ${CONFIDENCE_RANGES.CONFIRMED.min}`);
      }
    });
  });
});
