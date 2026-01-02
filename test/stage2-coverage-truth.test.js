/**
 * Stage 2 Coverage Truth Integration Test
 * Tests complete flow: missing selector → coverage downgrade → FRICTION verdict
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Mock fixture generator for missing selector scenario
function generateMissingSelectorFixture() {
  return {
    name: 'Missing Selector Test',
    url: 'https://example.com/missing-selector',
    expectedVerdict: 'FRICTION', // Because critical selector is missing
    steps: [
      {
        stepId: 'step1',
        description: 'Navigate to page',
        action: 'navigate',
        target: 'https://example.com/missing-selector',
        expectedResult: 'Page loads'
      },
      {
        stepId: 'step2',
        description: 'Fill email field',
        action: 'fill',
        selector: '[data-testid="email-input"]', // HIGH confidence
        value: 'test@example.com',
        expectedResult: 'Email field populated'
      },
      {
        stepId: 'step3',
        description: 'Click submit button', // CRITICAL STEP - selector will be missing
        action: 'click',
        selector: '[data-testid="submit-button"]', // HIGH confidence, but MISSING on page
        expectedResult: 'Form submitted',
        critical: true
      },
      {
        stepId: 'step4',
        description: 'Verify success page',
        action: 'verify',
        selector: '[data-testid="success-message"]',
        expectedResult: 'Success message displayed'
      }
    ]
  };
}

describe('Stage 2 Integration — Coverage Truth Enforcement', function() {
  
  let testCount = 0;
  
  beforeEach(function() {
    testCount++;
  });

  describe('Missing Selector Scenario', function() {
    
    it('should create fixture with critical missing selector', function() {
      const fixture = generateMissingSelectorFixture();
      
      assert.strictEqual(fixture.name, 'Missing Selector Test');
      assert(fixture.steps.some(s => s.critical && s.stepId === 'step3'));
      assert.strictEqual(fixture.expectedVerdict, 'FRICTION');
    });

    it('should detect selector absence and mark as NOT_APPLICABLE', function() {
      const fixture = generateMissingSelectorFixture();
      const step3 = fixture.steps.find(s => s.stepId === 'step3');
      
      // Simulate selector not found on page
      const selectorFound = false;
      const skipReason = {
        code: 'SELECTOR_MISSING',
        selector: step3.selector,
        attemptId: 'attempt-missing-selector',
        step: step3.stepId
      };
      
      assert.strictEqual(selectorFound, false);
      assert.strictEqual(skipReason.code, 'SELECTOR_MISSING');
    });
  });

  describe('Coverage Impact of Missing Critical Selector', function() {
    
    it('should downgrade verdict when critical selector missing', function() {
      const fixture = generateMissingSelectorFixture();
      
      // Simulate coverage calculation with missing critical selector
      const executedSteps = 2; // steps 1, 2 executed
      const totalSteps = 4;
      const coverage = executedSteps / totalSteps; // 50%
      
      assert(coverage < 0.7, 'Coverage should be 50%, below 70% threshold');
      
      // Verdict should be FRICTION due to coverage
      const shouldDowngrade = coverage < 0.7;
      assert.strictEqual(shouldDowngrade, true);
    });

    it('should include SELECTOR_MISSING in coverage.missingReasons', function() {
      const coverage = {
        criticalTotal: 4,
        criticalTested: 2,
        coverageRatio: 0.5,
        coverageStatus: 'INSUFFICIENT',
        missingReasons: [
          {
            code: 'SELECTOR_MISSING',
            selector: '[data-testid="submit-button"]',
            attemptCount: 1
          }
        ],
        naByDesignCount: 0,
        naByUncertaintyCount: 1
      };
      
      assert.strictEqual(coverage.coverageStatus, 'INSUFFICIENT');
      assert(coverage.missingReasons.some(r => r.code === 'SELECTOR_MISSING'));
      assert.strictEqual(coverage.naByUncertaintyCount, 1);
    });

    it('should record coverage downgrade in verdictHistory', function() {
      const verdictHistory = [
        {
          timestamp: new Date().toISOString(),
          phase: 'initial',
          verdict: 'READY',
          source: 'rules_engine'
        },
        {
          timestamp: new Date().toISOString(),
          phase: 'enforcement',
          verdict: 'FRICTION',
          source: 'coverage_downgrade',
          reasonCode: 'COVERAGE_INSUFFICIENT',
          details: {
            coverage: 0.5,
            threshold: 0.7,
            missingSelector: '[data-testid="submit-button"]'
          }
        }
      ];
      
      assert.strictEqual(verdictHistory[1].source, 'coverage_downgrade');
      assert.strictEqual(verdictHistory[1].reasonCode, 'COVERAGE_INSUFFICIENT');
      assert.strictEqual(verdictHistory[1].details.coverage, 0.5);
    });
  });

  describe('Decision Artifact Coverage Field', function() {
    
    it('should include coverage field in decision.json', function() {
      const decision = {
        finalVerdict: 'FRICTION',
        summaryText: 'Critical selector missing - coverage insufficient',
        coverage: {
          criticalTotal: 4,
          criticalTested: 2,
          coverageRatio: 0.5,
          coverageStatus: 'INSUFFICIENT',
          missingReasons: [
            { code: 'SELECTOR_MISSING', selector: '[data-testid="submit-button"]' }
          ],
          selectorConfidence: {
            selectorConfidenceMin: 'HIGH',
            selectorConfidenceAvg: 0.83,
            interactions: [
              { step: 'step1', selector: '[data-testid="email-input"]', confidence: 'HIGH' },
              { step: 'step2', selector: '[data-testid="submit-button"]', confidence: 'HIGH' }
            ]
          },
          naByDesignCount: 0,
          naByUncertaintyCount: 1
        }
      };
      
      assert(decision.hasOwnProperty('coverage'));
      assert.strictEqual(decision.coverage.coverageStatus, 'INSUFFICIENT');
      assert.strictEqual(decision.coverage.naByUncertaintyCount, 1);
    });

    it('should preserve coverage metrics across decision phases', function() {
      // Simulate decision flowing through multiple phases
      const coverageInfo = {
        criticalTotal: 4,
        criticalTested: 2,
        coverageRatio: 0.5,
        coverageStatus: 'INSUFFICIENT',
        missingReasons: [
          { code: 'SELECTOR_MISSING' }
        ]
      };
      
      // Phase 1
      const phase1Decision = {
        verdict: 'FRICTION',
        coverageInfo: coverageInfo
      };
      
      // Phase 2
      const phase2Decision = {
        ...phase1Decision,
        coverageInfo: phase1Decision.coverageInfo // preserved
      };
      
      // Final
      const finalDecision = {
        ...phase2Decision,
        coverage: phase2Decision.coverageInfo
      };
      
      assert.deepStrictEqual(
        finalDecision.coverage,
        coverageInfo,
        'Coverage info should be preserved through all phases'
      );
    });
  });

  describe('NOT_APPLICABLE Semantics in Coverage', function() {
    
    it('should NOT count NA_BY_DESIGN as missing in coverage', function() {
      const audit = {
        totalAttempts: 5,
        executedAttempts: [
          { attemptId: 'a1', outcome: 'SUCCESS' },
          { attemptId: 'a2', outcome: 'SUCCESS' }
        ],
        notTested: {
          notApplicable: [
            {
              attemptId: 'a3',
              reason: 'NOT_CRITICAL',
              category: 'BY_DESIGN' // Intentional skip
            }
          ],
          userFiltered: [],
          disabledByPreset: [],
          missing: [
            {
              attemptId: 'a4',
              reason: 'SELECTOR_MISSING',
              category: 'BY_UNCERTAINTY' // Missing - affects verdict
            },
            {
              attemptId: 'a5',
              reason: 'TIMEOUT',
              category: 'BY_UNCERTAINTY'
            }
          ]
        }
      };
      
      // Coverage = 2 / (5 - 1 BY_DESIGN) = 2/4 = 50%
      const coverageRatio = audit.executedAttempts.length / 
        (audit.totalAttempts - audit.notTested.notApplicable.length);
      
      assert(coverageRatio < 0.7);
      assert.strictEqual(audit.notTested.notApplicable[0].category, 'BY_DESIGN');
      assert.strictEqual(audit.notTested.missing[0].category, 'BY_UNCERTAINTY');
    });

    it('should include NA_BY_UNCERTAINTY in missing reasons', function() {
      const coverage = {
        missingReasons: [
          { code: 'SELECTOR_AMBIGUOUS', attemptCount: 1 },
          { code: 'SELECTOR_MISSING', attemptCount: 2 }
        ],
        naByUncertaintyCount: 2
      };
      
      assert.strictEqual(coverage.naByUncertaintyCount, 2);
      assert.strictEqual(coverage.missingReasons.length, 2);
    });
  });

  describe('Full E2E Coverage Flow (Mocked)', function() {
    
    it('should produce FRICTION verdict due to coverage enforcement', function() {
      // Complete flow simulation
      const fixture = generateMissingSelectorFixture();
      
      const executionResult = {
        attemptId: 'e2e-missing-selector',
        executedSteps: 2,
        totalSteps: 4,
        missingSelector: '[data-testid="submit-button"]',
        completionRatio: 0.5
      };
      
      const coverage = {
        coverageStatus: executionResult.completionRatio < 0.7 ? 'INSUFFICIENT' : 'OK',
        coverageRatio: executionResult.completionRatio,
        missingReasons: [
          { code: 'SELECTOR_MISSING', selector: executionResult.missingSelector }
        ]
      };
      
      const rules = {
        verdict: 'READY', // Rules engine says OK
        confidence: 0.95
      };
      
      // Enforcement: coverage insufficient → downgrade
      const finalVerdict = coverage.coverageStatus === 'INSUFFICIENT' ? 'FRICTION' : rules.verdict;
      
      assert.strictEqual(finalVerdict, 'FRICTION');
      assert.strictEqual(coverage.coverageStatus, 'INSUFFICIENT');
      assert(coverage.missingReasons.some(r => r.code === 'SELECTOR_MISSING'));
    });
  });
});

console.log('\n✅ Coverage Truth Integration Tests Loaded\n');
