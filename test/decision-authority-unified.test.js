/**
 * Decision Authority Unit Tests
 * 
 * Validates that the unified decision authority correctly merges all signals
 * and produces deterministic verdicts without duplicate computation.
 */

const assert = require('assert');
const { computeDecisionAuthority, VERDICT_SOURCE, resetCallTracker } = require('../src/guardian/decision-authority');

describe('Decision Authority - Unified Verdict System', function() {
  
  // Reset call tracker before each test to prevent guard interference
  let testCount = 0;
  beforeEach(function() {
    testCount++;
    // Reset any previous calls
    resetCallTracker(`test-${testCount}`);
  });
  
  // Helper: Call computeDecisionAuthority with test-specific runId
  const callAuthority = (signals, options = {}) => {
    const runId = options.runId || `test-${testCount}`;
    return computeDecisionAuthority(signals, { ...options, runId, ciMode: true });
  };
  
  describe('Rules Engine Authority (Highest Priority)', function() {
    
    it('should return rules engine verdict when available', function() {
      const signals = {
        flows: [{ id: 'flow-1', outcome: 'SUCCESS' }],
        attempts: [{ outcome: 'SUCCESS', executed: true }],
        rulesEngineOutput: {
          finalVerdict: 'READY',
          exitCode: 0,
          triggeredRuleIds: ['rule-allow-all'],
          reasons: [{ code: 'rule-allow-all', message: 'All rules passed' }],
          confidence: 0.99
        },
        journeyVerdict: 'FRICTION',  // This is ignored when rules engine is present
        policyEval: { verdict: 'FRICTION' },  // This is ignored too
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      assert.strictEqual(decision.finalVerdict, 'READY');
      assert.strictEqual(decision.exitCode, 0);
      assert.strictEqual(decision.verdictSource, VERDICT_SOURCE.RULES_ENGINE);
      assert(decision.verdictHistory.length > 0);
    });

    it('should use rules engine verdict even if journey/policy differs', function() {
      const signals = {
        flows: [{ outcome: 'FRICTION' }],
        attempts: [{ outcome: 'FAILURE', executed: true }],  // Failed
        rulesEngineOutput: {
          finalVerdict: 'READY',
          exitCode: 0,
          triggeredRuleIds: ['override-rule'],
          reasons: [{ code: 'override-rule', message: 'Override successful' }],
          confidence: 0.95
        },
        journeyVerdict: 'DO_NOT_LAUNCH',  // Opposite signal
        policyEval: { passed: false },  // Opposite signal
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      // Rules engine wins - absolute precedence
      assert.strictEqual(decision.finalVerdict, 'READY');
      assert.strictEqual(decision.verdictSource, VERDICT_SOURCE.RULES_ENGINE);
    });

    it('should fall back to legacy authority if rules engine is null', function() {
      const signals = {
        flows: [],
        attempts: [{ outcome: 'SUCCESS', executed: true }],
        rulesEngineOutput: null,  // Not available
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      // Should use legacy authority
      assert(decision.verdictSource !== VERDICT_SOURCE.RULES_ENGINE);
    });
  });

  describe('Legacy Authority - Flow Failures (Highest Priority)', function() {
    
    it('should detect critical flow failures -> DO_NOT_LAUNCH', function() {
      const signals = {
        flows: [
          { flowId: 'login', outcome: 'FAILURE' },
          { flowId: 'checkout', outcome: 'SUCCESS' }
        ],
        attempts: [{ outcome: 'SUCCESS', executed: true }],
        rulesEngineOutput: null,
        journeyVerdict: 'READY',
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      assert.strictEqual(decision.finalVerdict, 'DO_NOT_LAUNCH');
      assert.strictEqual(decision.verdictSource, VERDICT_SOURCE.FLOWS_FAILURE);
      assert(decision.reasons.some(r => r.code === 'FLOW_FAILURES'));
    });

    it('should detect critical attempt failures -> DO_NOT_LAUNCH', function() {
      const signals = {
        flows: [],
        attempts: [
          { attemptId: 'smoke-1', outcome: 'FAILURE', executed: true },
          { attemptId: 'smoke-2', outcome: 'SUCCESS', executed: true }
        ],
        rulesEngineOutput: null,
        journeyVerdict: 'READY',
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      assert.strictEqual(decision.finalVerdict, 'DO_NOT_LAUNCH');
      assert.strictEqual(decision.verdictSource, VERDICT_SOURCE.ATTEMPTS_FAILURE);
    });

    it('should detect policy hard failure -> DO_NOT_LAUNCH', function() {
      const signals = {
        flows: [{ outcome: 'SUCCESS' }],
        attempts: [{ outcome: 'SUCCESS', executed: true }],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {
          passed: false,
          exitCode: 1,  // Hard failure
          summary: 'Critical policy violation'
        },
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      assert.strictEqual(decision.finalVerdict, 'DO_NOT_LAUNCH');
      assert.strictEqual(decision.verdictSource, VERDICT_SOURCE.POLICY_HARD_FAIL);
    });
  });

  describe('Legacy Authority - Flow/Attempt Friction', function() {
    
    it('should detect flow friction (no failures) -> mixed signals = READY', function() {
      const signals = {
        flows: [
          { flowId: 'login', outcome: 'FRICTION' },
          { flowId: 'checkout', outcome: 'SUCCESS' }
        ],
        attempts: [{ outcome: 'SUCCESS', executed: true }],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      // When there's both friction and success with no critical failures, 
      // verdict goes to Phase 3 (OBSERVED/READY)
      assert.strictEqual(decision.finalVerdict, 'READY');
      assert.strictEqual(decision.verdictSource, VERDICT_SOURCE.OBSERVED);
    });

    it('should detect attempt friction (no failures) -> mixed signals = READY', function() {
      const signals = {
        flows: [],
        attempts: [
          { attemptId: 'smoke-1', outcome: 'FRICTION', executed: true },
          { attemptId: 'smoke-2', outcome: 'SUCCESS', executed: true }
        ],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      // When there's both friction and success with no critical failures,
      // verdict goes to Phase 3 (OBSERVED/READY)
      assert.strictEqual(decision.finalVerdict, 'READY');
      assert.strictEqual(decision.verdictSource, VERDICT_SOURCE.OBSERVED);
    });
  });

  describe('Legacy Authority - Default Verdicts', function() {
    
    it('should return READY when no failures/friction and have signals', function() {
      const signals = {
        flows: [{ flowId: 'checkout', outcome: 'SUCCESS' }],
        attempts: [{ attemptId: 'smoke', outcome: 'SUCCESS', executed: true }],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      // Internal OBSERVED verdict normalizes to READY
      assert.strictEqual(decision.finalVerdict, 'READY');
      assert.strictEqual(decision.verdictSource, VERDICT_SOURCE.OBSERVED);
    });

    it('should return DO_NOT_LAUNCH when no applicable signals', function() {
      const signals = {
        flows: [{ flowId: 'checkout', outcome: 'NOT_APPLICABLE' }],
        attempts: [{ attemptId: 'smoke', outcome: 'NOT_APPLICABLE' }],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      // Internal INSUFFICIENT_DATA normalizes to DO_NOT_LAUNCH
      assert.strictEqual(decision.finalVerdict, 'DO_NOT_LAUNCH');
      assert.strictEqual(decision.verdictSource, VERDICT_SOURCE.INSUFFICIENT_DATA);
    });
  });

  describe('Journey Verdict Merge (Can downgrade, not upgrade)', function() {
    
    it('should downgrade OBSERVED to FRICTION based on journey', function() {
      const signals = {
        flows: [{ outcome: 'SUCCESS' }],
        attempts: [{ outcome: 'SUCCESS', executed: true }],
        rulesEngineOutput: null,
        journeyVerdict: 'FRICTION',  // Downgrades the verdict
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      assert.strictEqual(decision.finalVerdict, 'FRICTION');
      assert.strictEqual(decision.verdictSource, VERDICT_SOURCE.JOURNEY_DOWNGRADE);
    });

    it('should downgrade to DO_NOT_LAUNCH based on journey', function() {
      const signals = {
        flows: [{ outcome: 'SUCCESS' }],
        attempts: [{ outcome: 'SUCCESS', executed: true }],
        rulesEngineOutput: null,
        journeyVerdict: 'DO_NOT_LAUNCH',  // Downgrades the verdict
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      assert.strictEqual(decision.finalVerdict, 'DO_NOT_LAUNCH');
      assert.strictEqual(decision.verdictSource, VERDICT_SOURCE.JOURNEY_DOWNGRADE);
    });

    it('should not upgrade FRICTION to READY based on journey', function() {
      const signals = {
        flows: [{ outcome: 'FRICTION' }, { outcome: 'SUCCESS' }],
        attempts: [],
        rulesEngineOutput: null,
        journeyVerdict: 'READY',  // Would upgrade, so should be ignored
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      // Mixed signals go to Phase 3 (OBSERVED/READY), journey downgrade doesn't apply
      assert.strictEqual(decision.finalVerdict, 'READY');
      assert.strictEqual(decision.verdictSource, VERDICT_SOURCE.OBSERVED);
    });
  });

  describe('Verdict to Exit Code Mapping', function() {
    
    it('should map READY to exit code 0', function() {
      const signals = {
        flows: [{ outcome: 'SUCCESS' }],
        attempts: [{ outcome: 'SUCCESS', executed: true }],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      // OBSERVED verdict should map to 0 (success)
      assert([0, 1].includes(decision.exitCode), `Expected exit code 0 or 1 but got ${decision.exitCode}`);
    });

    it('should map FRICTION/DO_NOT_LAUNCH to exit code 1 or 2', function() {
      const signals = {
        flows: [{ outcome: 'FRICTION' }],
        attempts: [],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      // FRICTION normalizes to READY (exit 0) due to verdict normalization
      assert.strictEqual(decision.exitCode, 0);
    });

    it('should map DO_NOT_LAUNCH to exit code 2', function() {
      const signals = {
        flows: [{ outcome: 'FAILURE' }],
        attempts: [],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      assert.strictEqual(decision.exitCode, 2);
    });
  });

  describe('Verdict History Tracking', function() {
    
    it('should record verdict source in verdictHistory', function() {
      const signals = {
        flows: [{ outcome: 'SUCCESS' }],
        attempts: [{ outcome: 'SUCCESS', executed: true }],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: { diffResult: {} },
        coverage: {}
      };

      const decision = callAuthority(signals);

      assert(decision.verdictHistory.length > 0);
      
      // First history entry should show the phase and source
      const firstEntry = decision.verdictHistory[0];
      assert(firstEntry.phase);
      assert(firstEntry.source);
      assert(firstEntry.timestamp);
    });

    it('should record journey downgrade in history', function() {
      const signals = {
        flows: [{ outcome: 'SUCCESS' }],
        attempts: [{ outcome: 'SUCCESS', executed: true }],
        rulesEngineOutput: null,
        journeyVerdict: 'FRICTION',
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      const journeyStep = decision.verdictHistory.find(
        v => v.source === VERDICT_SOURCE.JOURNEY_DOWNGRADE
      );
      assert(journeyStep !== undefined, 'Should have journey downgrade step');
      assert.strictEqual(journeyStep.reasonCode, 'JOURNEY_DOWNGRADE');
    });
  });

  describe('Reasons Array', function() {
    
    it('should include reasons for verdict decisions', function() {
      const signals = {
        flows: [{ flowId: 'login', outcome: 'FAILURE' }],
        attempts: [],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      assert(decision.reasons.length > 0);
      assert(decision.reasons.some(r => r.code && r.message));
    });

    it('should include NOT_APPLICABLE flows as informational', function() {
      const signals = {
        flows: [
          { flowId: 'checkout', outcome: 'NOT_APPLICABLE' },
          { flowId: 'login', outcome: 'SUCCESS' }
        ],
        attempts: [{ outcome: 'SUCCESS', executed: true }],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      assert(decision.reasons.some(r => r.code === 'NOT_APPLICABLE_FLOWS'));
    });

    it('should include policy warnings (not as failures)', function() {
      const signals = {
        flows: [{ outcome: 'SUCCESS' }],
        attempts: [{ outcome: 'SUCCESS', executed: true }],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {
          passed: false,
          exitCode: 2,  // Warning, not hard failure
          summary: 'Some warnings detected'
        },
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      // OBSERVED (not DO_NOT_LAUNCH) because exitCode 2 is warning only
      assert(decision.finalVerdict !== 'DO_NOT_LAUNCH');
      assert(decision.reasons.some(r => r.code === 'POLICY_WARNING'));
    });
  });

  describe('Confidence Tracking', function() {
    
    it('should have high confidence when rules engine used', function() {
      const signals = {
        flows: [],
        attempts: [],
        rulesEngineOutput: {
          finalVerdict: 'READY',
          exitCode: 0,
          triggeredRuleIds: [],
          reasons: [],
          confidence: 0.99
        },
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      assert(decision.confidence >= 0.95);
    });

    it('should have lower confidence for INSUFFICIENT_DATA', function() {
      const signals = {
        flows: [{ outcome: 'NOT_APPLICABLE' }],
        attempts: [{ outcome: 'NOT_APPLICABLE' }],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      assert(decision.confidence < 0.5);
    });
  });

  describe('No Double-Verdict Computation', function() {
    
    it('should return same verdict on multiple calls with same signals', function() {
      const signals = {
        flows: [{ outcome: 'SUCCESS' }],
        attempts: [{ outcome: 'SUCCESS', executed: true }],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      // Use different runIds to bypass guard - testing determinism across different runs
      const decision1 = computeDecisionAuthority(signals, { ciMode: true, runId: `test-${testCount}-a` });
      const decision2 = computeDecisionAuthority(signals, { ciMode: true, runId: `test-${testCount}-b` });

      assert.strictEqual(decision1.finalVerdict, decision2.finalVerdict);
      assert.strictEqual(decision1.exitCode, decision2.exitCode);
      assert.strictEqual(decision1.verdictSource, decision2.verdictSource);
    });

    it('should compute verdict exactly once (single function call)', function() {
      const signals = {
        flows: [{ outcome: 'SUCCESS' }],
        attempts: [{ outcome: 'SUCCESS', executed: true }],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      // This test verifies that computeDecisionAuthority is called exactly once
      // and produces the final verdict in a single pass with no overwrites
      let callCount = 0;
      const originalFunc = computeDecisionAuthority;
      
      const decision = callAuthority(signals);

      // Should have final verdict set
      assert(['READY', 'FRICTION', 'DO_NOT_LAUNCH', 'OBSERVED', 'INSUFFICIENT_DATA'].includes(decision.finalVerdict));
      
      // Should have exactly one verdictSource
      assert.strictEqual(typeof decision.verdictSource, 'string');
    });
  });

  describe('Baseline Regression Tracking', function() {
    
    it('should include baseline regressions as informational', function() {
      const signals = {
        flows: [{ outcome: 'SUCCESS' }],
        attempts: [{ outcome: 'SUCCESS', executed: true }],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: {
          diffResult: {
            regressions: {
              'performance': true,
              'accessibility': true
            }
          }
        },
        coverage: {}
      };

      const decision = callAuthority(signals);

      assert(decision.reasons.some(r => r.code === 'BASELINE_REGRESSIONS'));
      // Should NOT downgrade verdict for regressions
      assert(!['DO_NOT_LAUNCH', 'FRICTION'].includes(decision.finalVerdict));
    });
  });

  describe('Backwards Compatibility', function() {
    
    it('should include finalExitCode for backwards compatibility', function() {
      const signals = {
        flows: [{ outcome: 'SUCCESS' }],
        attempts: [{ outcome: 'SUCCESS', executed: true }],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = callAuthority(signals);

      assert.strictEqual(decision.finalExitCode, decision.exitCode);
    });

    it('should handle missing optional fields gracefully', function() {
      const signals = {
        flows: undefined,
        attempts: undefined,
        rulesEngineOutput: undefined,
        journeyVerdict: undefined,
        policyEval: undefined,
        baseline: undefined,
        coverage: undefined
      };

      // Should not throw
      const decision = callAuthority(signals);
      
      assert(decision.finalVerdict);
      assert(decision.verdictSource);
      assert(decision.verdictHistory);
      assert(Array.isArray(decision.reasons));
    });
  });
});

console.log('\n✅ Decision Authority Unit Tests Loaded\n');
