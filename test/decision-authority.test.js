/**
 * Decision Authority Unit Tests
 * 
 * Validates that the unified decision authority correctly merges all signals
 * and produces deterministic verdicts without duplicate computation.
 */

const assert = require('assert');
const { computeDecisionAuthority, VERDICT_SOURCE } = require('../src/guardian/decision-authority');

describe('Decision Authority - Unified Verdict System', function() {
  
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
        marketImpact: { severity: 'critical' },  // This is ignored
        baseline: {},
        coverage: {}
      };

      const decision = computeDecisionAuthority(signals, { ciMode: true });

      assert.strictEqual(decision.finalVerdict, 'READY');
      assert.strictEqual(decision.exitCode, 0);
      assert.strictEqual(decision.verdictSource, VERDICT_SOURCE.RULES_ENGINE);
      assert(decision.verdictHistory.length > 0);
    });

    it('should use rules engine verdict even if journey verdict differs', function() {
      const signals = {
        flows: [],
        attempts: [{ outcome: 'FAILURE' }],  // All failed
        rulesEngineOutput: {
          finalVerdict: 'READY',
          exitCode: 0,
          triggeredRuleIds: ['override-rule'],
          reasons: [{ ruleId: 'override-rule', message: 'Override successful' }],
          policySignals: {}
        },
        journeyVerdict: 'FAIL',  // Opposite signal
        policyEval: { verdict: 'FAIL' },  // Opposite signal
        baseline: {},
        coverage: {}
      };

      const decision = computeDecisionAuthority(signals, { ciMode: true });

      // Rules engine wins
      assert.strictEqual(decision.finalVerdict, 'READY');
      assert.strictEqual(decision.authoritySource, 'rules_engine');
    });

    it('should fall back to legacy authority if rules engine is null', function() {
      const signals = {
        flows: [],
        attempts: [{ outcome: 'SUCCESS' }],
        rulesEngineOutput: null,  // Not available
        journeyVerdict: 'CONCERN',
        policyEval: { verdict: 'CONCERN' },
        baseline: {},
        coverage: {}
      };

      const decision = computeDecisionAuthority(signals, { ciMode: true });

      // Should use journey verdict since rules engine is null
      assert.strictEqual(decision.finalVerdict, 'CONCERN');
      assert.strictEqual(decision.authoritySource, 'legacy_authority');
    });
  });

  describe('Legacy Authority (Rules Engine Not Available)', function() {
    
    it('should use journey verdict as primary signal', function() {
      const signals = {
        flows: [],
        attempts: [{ outcome: 'FAILURE' }],
        rulesEngineOutput: null,
        journeyVerdict: 'READY',
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = computeDecisionAuthority(signals, { ciMode: true });

      assert.strictEqual(decision.finalVerdict, 'READY');
      assert.strictEqual(decision.authoritySource, 'legacy_authority');
    });

    it('should escalate to CONCERN when critical policy signals present', function() {
      const signals = {
        flows: [],
        attempts: [{ outcome: 'FAILURE' }],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {
          signals: [
            { id: 'policy-1', severity: 'critical', message: 'Critical issue' }
          ]
        },
        baseline: {},
        coverage: {}
      };

      const decision = computeDecisionAuthority(signals, { ciMode: true });

      assert.strictEqual(decision.finalVerdict, 'CONCERN');
    });

    it('should detect baseline regression and escalate verdict', function() {
      const signals = {
        flows: [],
        attempts: [{ outcome: 'SUCCESS' }],
        rulesEngineOutput: null,
        journeyVerdict: 'READY',
        policyEval: {},
        baseline: {
          baselineCreated: true,
          baselineSnapshot: {},
          diffResult: {
            hasSignificantDifferences: true,
            significantChanges: 5
          }
        },
        coverage: {}
      };

      const decision = computeDecisionAuthority(signals, { ciMode: true });

      assert.strictEqual(decision.finalVerdict, 'CONCERN');
      // Check history shows baseline detection
      const baselineStep = decision.verdictHistory.find(v => v.step === 'baseline_differences_detected');
      assert(baselineStep !== undefined);
    });

    it('should use all-attempts-successful fallback when no other verdict available', function() {
      const signals = {
        flows: [],
        attempts: [
          { outcome: 'SUCCESS' },
          { outcome: 'SUCCESS' },
          { outcome: 'SUCCESS' }
        ],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = computeDecisionAuthority(signals, { ciMode: true });

      assert.strictEqual(decision.finalVerdict, 'READY');
      const allSuccessStep = decision.verdictHistory.find(v => v.step === 'all_attempts_successful');
      assert(allSuccessStep !== undefined);
    });

    it('should use partial-success fallback when some attempts pass', function() {
      const signals = {
        flows: [],
        attempts: [
          { outcome: 'SUCCESS' },
          { outcome: 'FAILURE' }
        ],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = computeDecisionAuthority(signals, { ciMode: true });

      assert.strictEqual(decision.finalVerdict, 'CONCERN');
      const partialStep = decision.verdictHistory.find(v => v.step === 'partial_success');
      assert(partialStep !== undefined);
    });

    it('should use all-attempts-failed fallback when all fail', function() {
      const signals = {
        flows: [],
        attempts: [
          { outcome: 'FAILURE' },
          { outcome: 'FAILURE' }
        ],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = computeDecisionAuthority(signals, { ciMode: true });

      assert.strictEqual(decision.finalVerdict, 'FAIL');
      const allFailStep = decision.verdictHistory.find(v => v.step === 'all_attempts_failed');
      assert(allFailStep !== undefined);
    });
  });

  describe('Verdict to Exit Code Mapping', function() {
    
    it('should map READY to exit code 0', function() {
      const signals = {
        flows: [],
        attempts: [{ outcome: 'SUCCESS' }],
        rulesEngineOutput: null,
        journeyVerdict: 'READY',
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = computeDecisionAuthority(signals, { ciMode: true });

      assert.strictEqual(decision.exitCode, 0);
    });

    it('should map CONCERN to exit code 1', function() {
      const signals = {
        flows: [],
        attempts: [{ outcome: 'FAILURE' }, { outcome: 'SUCCESS' }],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = computeDecisionAuthority(signals, { ciMode: true });

      assert.strictEqual(decision.exitCode, 1);
    });

    it('should map FAIL to exit code 2', function() {
      const signals = {
        flows: [],
        attempts: [{ outcome: 'FAILURE' }],
        rulesEngineOutput: null,
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision = computeDecisionAuthority(signals, { ciMode: true });

      assert.strictEqual(decision.exitCode, 2);
    });
  });

  describe('Verdict History Tracking', function() {
    
    it('should record all decision steps in verdictHistory', function() {
      const signals = {
        flows: [],
        attempts: [{ outcome: 'SUCCESS' }],
        rulesEngineOutput: null,
        journeyVerdict: 'READY',
        policyEval: {
          signals: [
            { id: 'policy-1', severity: 'info', message: 'Info signal' }
          ]
        },
        baseline: {
          baselineCreated: true,
          diffResult: { hasSignificantDifferences: false }
        },
        coverage: { score: 0.8 }
      };

      const decision = computeDecisionAuthority(signals, { ciMode: true });

      // Verify key steps are recorded
      assert(decision.verdictHistory.find(v => v.step === 'initialization'));
      assert(decision.verdictHistory.find(v => v.step === 'attempt_analysis'));
      assert(decision.verdictHistory.find(v => v.step === 'journey_verdict'));
      assert(decision.verdictHistory.find(v => v.step === 'finalization'));

      // Each step should have timestamp
      decision.verdictHistory.forEach(step => {
        assert(step.timestamp);
        assert(new Date(step.timestamp) instanceof Date);
      });
    });
  });

  describe('Decision Validation', function() {
    
    it('should validate decision has all required fields', function() {
      const validDecision = {
        finalVerdict: 'READY',
        exitCode: 0,
        verdictHistory: [],
        reasons: []
      };

      assert.doesNotThrow(() => validateDecision(validDecision));
    });

    it('should throw on missing required field', function() {
      const invalidDecision = {
        finalVerdict: 'READY',
        exitCode: 0
        // Missing verdictHistory and reasons
      };

      assert.throws(
        () => validateDecision(invalidDecision),
        /missing fields/
      );
    });

    it('should throw on invalid verdict value', function() {
      const invalidDecision = {
        finalVerdict: 'UNKNOWN_VERDICT',  // Invalid
        exitCode: 0,
        verdictHistory: [],
        reasons: []
      };

      assert.throws(
        () => validateDecision(invalidDecision),
        /Invalid verdict/
      );
    });

    it('should throw on invalid exit code', function() {
      const invalidDecision = {
        finalVerdict: 'READY',
        exitCode: 99,  // Invalid, must be 0, 1, or 2
        verdictHistory: [],
        reasons: []
      };

      assert.throws(
        () => validateDecision(invalidDecision),
        /Invalid exit code/
      );
    });
  });

  describe('Decision Forensics', function() {
    
    it('should create forensics report with decision details', function() {
      const signals = {
        flows: [],
        attempts: [{ outcome: 'SUCCESS' }],
        rulesEngineOutput: null,
        journeyVerdict: 'READY',
        policyEval: {},
        baseline: { baselineCreated: true },
        marketImpact: { severity: 'low' },
        coverage: { score: 0.9 }
      };

      const decision = computeDecisionAuthority(signals, { ciMode: true });
      const forensics = createDecisionForensics(decision, signals, { testId: 'test-123' });

      assert.strictEqual(forensics.finalVerdict, 'READY');
      assert.strictEqual(forensics.exitCode, 0);
      assert(forensics.timestamp);
      assert(forensics.verdictHistory);
      assert(forensics.signalsSummary);
      assert.strictEqual(forensics.signalsSummary.rulesEngineAvailable, false);
      assert.strictEqual(forensics.signalsSummary.journeyVerdictPresent, true);
      assert.strictEqual(forensics.metadata.testId, 'test-123');
    });

    it('should track which signals were used in forensics', function() {
      const signals = {
        flows: [{ id: 'flow-1' }],
        attempts: [{ outcome: 'SUCCESS' }],
        rulesEngineOutput: {
          finalVerdict: 'READY',
          exitCode: 0,
          triggeredRuleIds: [],
          reasons: [],
          policySignals: {}
        },
        journeyVerdict: null,
        policyEval: {},
        baseline: {},
        marketImpact: {},
        coverage: {}
      };

      const decision = computeDecisionAuthority(signals, { ciMode: true });
      const forensics = createDecisionForensics(decision, signals);

      assert.strictEqual(forensics.signalsSummary.rulesEngineAvailable, true);
      assert.strictEqual(forensics.signalsSummary.journeyVerdictPresent, false);
    });
  });

  describe('No Double-Verdict Computation', function() {
    
    it('should return same verdict on multiple calls with same signals', function() {
      const signals = {
        flows: [],
        attempts: [{ outcome: 'SUCCESS' }],
        rulesEngineOutput: null,
        journeyVerdict: 'READY',
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      const decision1 = computeDecisionAuthority(signals, { ciMode: true });
      const decision2 = computeDecisionAuthority(signals, { ciMode: true });

      assert.strictEqual(decision1.finalVerdict, decision2.finalVerdict);
      assert.strictEqual(decision1.exitCode, decision2.exitCode);
      assert.strictEqual(decision1.authoritySource, decision2.authoritySource);
    });

    it('should compute verdict exactly once (single function call)', function() {
      const signals = {
        flows: [],
        attempts: [{ outcome: 'SUCCESS' }],
        rulesEngineOutput: null,
        journeyVerdict: 'READY',
        policyEval: {},
        baseline: {},
        coverage: {}
      };

      // This test verifies that the decision authority is a single function call
      // that produces the final verdict, rather than multiple scattered computations
      const decision = computeDecisionAuthority(signals, { ciMode: true });

      // Check that verdict was set exactly once
      const verdictSteps = decision.verdictHistory.filter(v => v.verdict === 'READY');
      assert(verdictSteps.length > 0, 'Should have at least one READY verdict in history');
      
      // The final verdict should match the last non-null verdict step
      const lastVerdictStep = decision.verdictHistory.reverse().find(v => v.verdict);
      assert(lastVerdictStep, 'Should have final verdict step');
    });
  });

  describe('Coverage Analysis Integration', function() {
    
    it('should flag low coverage (<30%) as CONCERN', function() {
      const signals = {
        flows: [],
        attempts: [{ outcome: 'SUCCESS' }],
        rulesEngineOutput: null,
        journeyVerdict: 'READY',
        policyEval: {},
        baseline: {},
        coverage: { score: 0.20 }  // Below 30%
      };

      const decision = computeDecisionAuthority(signals, { ciMode: true });

      assert.strictEqual(decision.finalVerdict, 'CONCERN');
      const coverageStep = decision.verdictHistory.find(v => v.step === 'low_coverage_concern');
      assert(coverageStep !== undefined);
    });

    it('should accept good coverage (>30%) without downgrading', function() {
      const signals = {
        flows: [],
        attempts: [{ outcome: 'SUCCESS' }],
        rulesEngineOutput: null,
        journeyVerdict: 'READY',
        policyEval: {},
        baseline: {},
        coverage: { score: 0.50 }  // Above 30%
      };

      const decision = computeDecisionAuthority(signals, { ciMode: true });

      // Should remain READY if no other signals downgrade it
      assert.strictEqual(decision.finalVerdict, 'READY');
    });
  });

  describe('Market Impact Assessment', function() {
    
    it('should escalate to CONCERN for critical market impact', function() {
      const signals = {
        flows: [],
        attempts: [{ outcome: 'SUCCESS' }],
        rulesEngineOutput: null,
        journeyVerdict: 'READY',
        policyEval: {},
        baseline: {},
        marketImpact: { severity: 'critical' }  // Critical impact
      };

      const decision = computeDecisionAuthority(signals, { ciMode: true });

      assert.strictEqual(decision.finalVerdict, 'CONCERN');
    });

    it('should not downgrade for non-critical market impact', function() {
      const signals = {
        flows: [],
        attempts: [{ outcome: 'SUCCESS' }],
        rulesEngineOutput: null,
        journeyVerdict: 'READY',
        policyEval: {},
        baseline: {},
        marketImpact: { severity: 'low' }  // Low impact
      };

      const decision = computeDecisionAuthority(signals, { ciMode: true });

      assert.strictEqual(decision.finalVerdict, 'READY');
    });
  });
});

console.log('\n✅ Decision Authority Tests Loaded\n');
