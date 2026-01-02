/**
 * Coverage Model Unit Tests
 * Tests for coverage enforcement, selector confidence, and NOT_APPLICABLE semantics
 */

const assert = require('assert');
const {
  computeCoverageSummary,
  computeSelectorConfidence,
  categorizeNotApplicable,
  COVERAGE_THRESHOLD,
  NA_CATEGORY,
  MISSING_REASON,
  SELECTOR_CONFIDENCE
} = require('../src/guardian/coverage-model');

const {
  computeDecisionAuthority,
  resetCallTracker
} = require('../src/guardian/decision-authority');

describe('Coverage Model — Truth Inputs', function() {
  
  let testCount = 0;
  beforeEach(function() {
    testCount++;
    resetCallTracker(`test-coverage-${testCount}`);
  });

  describe('Coverage Summary Computation', function() {
    
    it('should mark coverage as OK when >= 70%', function() {
      const attempts = [
        { attemptId: 'a1', outcome: 'SUCCESS', executed: true },
        { attemptId: 'a2', outcome: 'SUCCESS', executed: true },
        { attemptId: 'a3', outcome: 'SUCCESS', executed: true }
      ];
      
      const audit = {
        totalAttempts: 5,
        executedAttempts: attempts,
        notTested: {
          notApplicable: [],
          userFiltered: [],
          disabledByPreset: [],
          missing: []
        }
      };
      
      const coverage = computeCoverageSummary(attempts, [], audit);
      
      assert.strictEqual(coverage.coverageStatus, 'OK');
      assert(coverage.coverageRatio >= COVERAGE_THRESHOLD);
    });

    it('should mark coverage as INSUFFICIENT when < 70%', function() {
      const attempts = [
        { attemptId: 'a1', outcome: 'SUCCESS', executed: true }
      ];
      
      const audit = {
        totalAttempts: 5,
        executedAttempts: attempts,
        notTested: {
          notApplicable: [],
          userFiltered: [{ attemptId: 'a2' }, { attemptId: 'a3' }, { attemptId: 'a4' }],
          disabledByPreset: [],
          missing: []
        }
      };
      
      const coverage = computeCoverageSummary(attempts, [], audit);
      
      assert.strictEqual(coverage.coverageStatus, 'INSUFFICIENT');
      assert(coverage.coverageRatio < COVERAGE_THRESHOLD);
    });

    it('should count NA_BY_UNCERTAINTY in coverage calculation', function() {
      const attempts = [
        { attemptId: 'a1', outcome: 'SUCCESS', executed: true },
        { attemptId: 'a2', outcome: 'SUCCESS', executed: true }
      ];
      
      const audit = {
        totalAttempts: 4,
        executedAttempts: attempts,
        notTested: {
          notApplicable: [{ attemptId: 'a3', reason: 'selector_missing' }],
          userFiltered: [],
          disabledByPreset: [],
          missing: []
        }
      };
      
      const coverage = computeCoverageSummary(attempts, [], audit);
      
      // Should include a3 in critical count because it's NA_BY_UNCERTAINTY
      assert(coverage.naByUncertaintyCount > 0);
      assert(coverage.missingReasons.some(r => r.code === MISSING_REASON.SELECTOR_MISSING));
    });

    it('should include missing reasons in output', function() {
      const attempts = [
        { attemptId: 'a1', outcome: 'SUCCESS', executed: true }
      ];
      
      const audit = {
        totalAttempts: 4,
        executedAttempts: attempts,
        notTested: {
          notApplicable: [
            { attemptId: 'a2', reason: 'selector_missing' },
            { attemptId: 'a3', reason: 'ambiguous_ui' }
          ],
          userFiltered: [{ attemptId: 'a4' }],
          disabledByPreset: [],
          missing: []
        }
      };
      
      const coverage = computeCoverageSummary(attempts, [], audit);
      
      assert(coverage.missingReasons.length > 0);
      assert(coverage.missingReasons.some(r => 
        r.code === MISSING_REASON.SELECTOR_MISSING || 
        r.code === MISSING_REASON.USER_FILTERED ||
        r.code === 'COVERAGE_INSUFFICIENT'
      ));
    });
  });

  describe('Selector Confidence Inference', function() {
    
    it('should infer HIGH confidence for data-testid', function() {
      const interaction = {
        step: 'click button',
        selector: '[data-testid="submit-btn"]'
      };
      
      const confidence = require('../src/guardian/coverage-model').inferSelectorConfidence(interaction);
      assert.strictEqual(confidence, SELECTOR_CONFIDENCE.HIGH);
    });

    it('should infer HIGH confidence for data-guardian', function() {
      const interaction = {
        step: 'fill form',
        selector: '[data-guardian="email-input"]'
      };
      
      const confidence = require('../src/guardian/coverage-model').inferSelectorConfidence(interaction);
      assert.strictEqual(confidence, SELECTOR_CONFIDENCE.HIGH);
    });

    it('should infer MEDIUM confidence for role-based selectors', function() {
      const interaction = {
        step: 'click button',
        selector: '[role="button"]'
      };
      
      const confidence = require('../src/guardian/coverage-model').inferSelectorConfidence(interaction);
      assert.strictEqual(confidence, SELECTOR_CONFIDENCE.MEDIUM);
    });

    it('should infer MEDIUM confidence for aria-label', function() {
      const interaction = {
        step: 'find element',
        selector: '[aria-label="Submit Form"]'
      };
      
      const confidence = require('../src/guardian/coverage-model').inferSelectorConfidence(interaction);
      assert.strictEqual(confidence, SELECTOR_CONFIDENCE.MEDIUM);
    });

    it('should infer LOW confidence for class selectors', function() {
      const interaction = {
        step: 'click button',
        selector: '.submit-btn'
      };
      
      const confidence = require('../src/guardian/coverage-model').inferSelectorConfidence(interaction);
      assert.strictEqual(confidence, SELECTOR_CONFIDENCE.LOW);
    });

    it('should infer LOW confidence for nth-child', function() {
      const interaction = {
        step: 'get element',
        selector: 'button:nth-child(3)'
      };
      
      const confidence = require('../src/guardian/coverage-model').inferSelectorConfidence(interaction);
      assert.strictEqual(confidence, SELECTOR_CONFIDENCE.LOW);
    });

    it('should compute minimum confidence across attempts', function() {
      const attempts = [
        {
          attemptId: 'a1',
          interactions: [
            { step: 's1', selector: '[data-testid="high"]' },
            { step: 's2', selector: '[role="button"]' },
            { step: 's3', selector: '.low-class' }
          ]
        }
      ];
      
      const summary = computeSelectorConfidence(attempts);
      
      assert.strictEqual(summary.selectorConfidenceMin, SELECTOR_CONFIDENCE.LOW);
      assert(summary.selectorConfidenceAvg < 1.0);
    });
  });

  describe('NOT_APPLICABLE Categorization', function() {
    
    it('should categorize as BY_DESIGN when marked intentional', function() {
      const skipReason = {
        skipReasonCode: 'NA_DESIGN',
        message: 'Not critical to core flow'
      };
      
      const category = categorizeNotApplicable(skipReason);
      assert.strictEqual(category, NA_CATEGORY.BY_DESIGN);
    });

    it('should categorize as BY_UNCERTAINTY when selector missing', function() {
      const skipReason = {
        skipReasonCode: 'SELECTOR_MISSING',
        message: 'Selector not found on page'
      };
      
      const category = categorizeNotApplicable(skipReason);
      assert.strictEqual(category, NA_CATEGORY.BY_UNCERTAINTY);
    });

    it('should categorize as BY_UNCERTAINTY by default', function() {
      const skipReason = {
        code: 'UNKNOWN',
        message: 'Some unknown reason'
      };
      
      const category = categorizeNotApplicable(skipReason);
      assert.strictEqual(category, NA_CATEGORY.BY_UNCERTAINTY);
    });
  });

  describe('Coverage Enforcement in Decision Authority', function() {
    
    it('should downgrade READY to FRICTION when coverage insufficient', function() {
      const signals = {
        flows: [{ outcome: 'SUCCESS' }],
        attempts: [{ outcome: 'SUCCESS', executed: true }],
        rulesEngineOutput: {
          finalVerdict: 'READY',
          exitCode: 0,
          triggeredRuleIds: ['test-rule'],
          reasons: [],
          confidence: 0.99
        },
        policyEval: {},
        baseline: {},
        coverage: {},
        audit: {
          totalAttempts: 10,
          executedAttempts: [{ attemptId: 'a1', outcome: 'SUCCESS' }],
          notTested: {
            notApplicable: [
              { attemptId: 'a2', reason: 'selector_missing' },
              { attemptId: 'a3', reason: 'selector_missing' },
              { attemptId: 'a4', reason: 'selector_missing' },
              { attemptId: 'a5', reason: 'selector_missing' },
              { attemptId: 'a6', reason: 'selector_missing' },
              { attemptId: 'a7', reason: 'selector_missing' },
              { attemptId: 'a8', reason: 'selector_missing' },
              { attemptId: 'a9', reason: 'selector_missing' },
              { attemptId: 'a10', reason: 'selector_missing' }
            ],
            userFiltered: [],
            disabledByPreset: [],
            missing: []
          }
        }
      };
      
      const decision = computeDecisionAuthority(signals, {
        ciMode: true,
        runId: `test-coverage-${testCount}`
      });
      
      // Coverage = 1/10 = 10% (below 70% threshold)
      // Should downgrade to FRICTION despite rules engine saying READY
      assert.strictEqual(decision.finalVerdict, 'FRICTION');
      assert(decision.verdictHistory.some(h => 
        h.reasonCode === 'COVERAGE_INSUFFICIENT' || 
        h.source === 'coverage_downgrade'
      ));
    });

    it('should downgrade READY to FRICTION when selector confidence is LOW', function() {
      const signals = {
        flows: [{ outcome: 'SUCCESS' }],
        attempts: [
          {
            attemptId: 'a1',
            outcome: 'SUCCESS',
            interactions: [
              { step: 's1', selector: '.low-class' },
              { step: 's2', selector: '.another-class' }
            ]
          }
        ],
        rulesEngineOutput: {
          finalVerdict: 'READY',
          exitCode: 0,
          triggeredRuleIds: ['rule1'],
          reasons: [],
          confidence: 0.99
        },
        policyEval: {},
        baseline: {},
        coverage: {},
        audit: {
          totalAttempts: 1,
          executedAttempts: [{ attemptId: 'a1' }],
          notTested: {
            notApplicable: [],
            userFiltered: [],
            disabledByPreset: [],
            missing: []
          }
        }
      };
      
      const decision = computeDecisionAuthority(signals, {
        ciMode: true,
        runId: `test-coverage-${testCount}`
      });
      
      // All selectors are LOW confidence
      // Should downgrade to FRICTION
      assert.strictEqual(decision.finalVerdict, 'FRICTION');
      assert(decision.verdictHistory.some(h => 
        h.reasonCode === 'LOW_SELECTOR_CONFIDENCE'
      ));
    });

    it('should keep READY when coverage is sufficient and confidence is high', function() {
      const signals = {
        flows: [{ outcome: 'SUCCESS' }],
        attempts: [
          {
            attemptId: 'a1',
            outcome: 'SUCCESS',
            interactions: [
              { step: 's1', selector: '[data-testid="submit"]' }
            ]
          },
          {
            attemptId: 'a2',
            outcome: 'SUCCESS',
            interactions: [
              { step: 's1', selector: '[data-guardian="form"]' }
            ]
          }
        ],
        rulesEngineOutput: {
          finalVerdict: 'READY',
          exitCode: 0,
          triggeredRuleIds: ['rule1'],
          reasons: [],
          confidence: 0.99
        },
        policyEval: {},
        baseline: {},
        coverage: {},
        audit: {
          totalAttempts: 2,
          executedAttempts: [
            { attemptId: 'a1', outcome: 'SUCCESS' },
            { attemptId: 'a2', outcome: 'SUCCESS' }
          ],
          notTested: {
            notApplicable: [],
            userFiltered: [],
            disabledByPreset: [],
            missing: []
          }
        }
      };
      
      const decision = computeDecisionAuthority(signals, {
        ciMode: true,
        runId: `test-coverage-${testCount}`
      });
      
      // 100% coverage with HIGH selector confidence
      // Should remain READY
      assert.strictEqual(decision.finalVerdict, 'READY');
    });
  });
});

console.log('\n✅ Coverage Model Unit Tests Loaded\n');
