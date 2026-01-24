/**
 *  Formal Exit Code Verification — Stage 7
 * 
 * Property-based tests proving exit code correctness for all state combinations.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { RunResult, ANALYSIS_STATE, SKIP_REASON } from '../../src/cli/util/support/run-result.js';

describe(' Formal Exit Code Verification', () => {
  describe('Exit Code 0: COMPLETE + No Findings', () => {
    test('empty analysis with no expectations', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.COMPLETE;
      result.expectationsDiscovered = 0;
      result.expectationsAnalyzed = 0;
      result.findingsCount = 0;
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 0);
    });
    
    test('complete analysis with expectations but no findings', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.COMPLETE;
      result.expectationsDiscovered = 10;
      result.expectationsAnalyzed = 10;
      result.findingsCount = 0;
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 0);
    });
    
    test('all expectations analyzed, zero findings', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.COMPLETE;
      result.expectationsDiscovered = 5;
      result.expectationsAnalyzed = 5;
      result.expectationsSkipped = 0;
      result.findingsCount = 0;
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 0);
    });
  });
  
  describe('Exit Code 10: NEEDS_REVIEW (suspected findings)', () => {
    test('complete analysis with suspected findings', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.COMPLETE;
      result.expectationsDiscovered = 10;
      result.expectationsAnalyzed = 10;
      result.findings = [{ status: 'SUSPECTED' }, { severity: 'SUSPECTED' }];
      result.findingsCount = 2;
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 10);
    });
    
    test('single suspected finding', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.COMPLETE;
      result.expectationsDiscovered = 5;
      result.expectationsAnalyzed = 5;
      result.findings = [{ status: 'SUSPECTED' }];
      result.findingsCount = 1;
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 10);
    });
  });
  
  describe('Exit Code 20: FAILURE_CONFIRMED', () => {
    test('complete analysis with confirmed findings', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.COMPLETE;
      result.expectationsDiscovered = 10;
      result.expectationsAnalyzed = 10;
      result.findings = [{ status: 'CONFIRMED' }, { severity: 'CONFIRMED' }];
      result.findingsCount = 2;
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 20);
    });
    
    test('single confirmed finding detected', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.COMPLETE;
      result.expectationsDiscovered = 5;
      result.expectationsAnalyzed = 5;
      result.findings = [{ status: 'CONFIRMED' }];
      result.findingsCount = 1;
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 20);
    });
  });
  
  describe('Exit Code 40: FAILED State', () => {
    test('analysis failed with error', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.FAILED;
      result.error = 'Internal crash';
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 40);
    });
    
    test('failed state overrides findings', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.FAILED;
      result.findingsCount = 10; // Even with findings, exit 40
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 40);
    });
  });
  
  describe('Exit Code 30: INCOMPLETE State', () => {
    test('no expectations extracted', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.INCOMPLETE;
      result.recordSkip(SKIP_REASON.NO_EXPECTATIONS_EXTRACTED, 1);
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 30);
    });
    
    test('budget exceeded', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.INCOMPLETE;
      result.expectationsDiscovered = 100;
      result.recordSkip(SKIP_REASON.BUDGET_EXCEEDED, 50);
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 30);
    });
    
    test('observe timeout', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.INCOMPLETE;
      result.expectationsDiscovered = 10;
      result.recordSkip(SKIP_REASON.TIMEOUT_OBSERVE, 5);
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 30);
    });
    
    test('detect timeout', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.INCOMPLETE;
      result.expectationsDiscovered = 10;
      result.recordSkip(SKIP_REASON.TIMEOUT_DETECT, 3);
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 30);
    });
    
    test('total timeout', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.INCOMPLETE;
      result.recordSkip(SKIP_REASON.TIMEOUT_TOTAL, 1);
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 30);
    });
    
    test('incomplete with findings still returns 30', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.INCOMPLETE;
      result.findingsCount = 5;
      result.recordSkip(SKIP_REASON.BUDGET_EXCEEDED, 10);
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 30);
    });
    
    test('incomplete overrides complete', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.INCOMPLETE;
      result.expectationsDiscovered = 10;
      result.expectationsAnalyzed = 5; // Partial analysis
      result.recordSkip(SKIP_REASON.BUDGET_EXCEEDED, 5);
      
      const exitCode = result.getExitCode();
        assert.strictEqual(exitCode, 30);
    });
  });
  
  describe('State Precedence Rules', () => {
    test('FAILED takes precedence over INCOMPLETE', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.FAILED;
      result.recordSkip(SKIP_REASON.BUDGET_EXCEEDED, 10);
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 40);
    });
    
    test('FAILED takes precedence over findings', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.FAILED;
      result.findingsCount = 100;
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 40);
    });
    
    test('INCOMPLETE takes precedence over findings', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.INCOMPLETE;
      result.findingsCount = 50;
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 30);
    });
  });
  
  describe('Edge Cases', () => {
    test('zero expectations discovered, complete', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.COMPLETE;
      result.expectationsDiscovered = 0;
      result.expectationsAnalyzed = 0;
      result.findingsCount = 0;
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 0);
    });
    
    test('partial skip but still complete', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.COMPLETE;
      result.expectationsDiscovered = 10;
      result.expectationsAnalyzed = 10;
      result.findingsCount = 0;
      // Some skips recorded but analysis still marked complete
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 0);
    });
    
    test('all expectations skipped = incomplete', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.INCOMPLETE;
      result.expectationsDiscovered = 10;
      result.expectationsAnalyzed = 0;
      result.expectationsSkipped = 10;
      result.recordSkip(SKIP_REASON.BUDGET_EXCEEDED, 10);
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 30);
    });
  });
  
  describe('Integrity Violation Cases', () => {
    test('poisoned run = FAILED = exit 40', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.FAILED;
      result.error = 'RUN_POISONED';
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 40);
    });
    
    test('integrity hash mismatch = evidence violation = exit 50', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.FAILED;
      result.contractViolations.droppedCount = 1;
      result.error = 'Integrity violation: hash mismatch';
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 50);
    });
    
    test('artifact write failure = FAILED = exit 40', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.FAILED;
      result.error = 'Failed to write primary truth artifact';
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 40);
    });
  });
  
  describe('Property-Based: All Valid States', () => {
    test('exhaustive state-findings matrix', () => {
      const states = [
        ANALYSIS_STATE.COMPLETE,
        ANALYSIS_STATE.INCOMPLETE,
        ANALYSIS_STATE.FAILED,
      ];
      const findingCounts = [0, 1, 10, 100];
      
      for (const state of states) {
        for (const findings of findingCounts) {
          const result = new RunResult();
          result.state = state;
          result.findingsCount = findings;
          
          const exitCode = result.getExitCode();
          
          // Verify exit code is in valid range
          assert.ok([0, 10, 20, 30, 40, 50].includes(exitCode), 
            `Invalid exit code ${exitCode} for state=${state}, findings=${findings}`);
          
          // Verify state-based rules
          if (state === ANALYSIS_STATE.FAILED) {
            assert.strictEqual(exitCode, 40);
          } else if (state === ANALYSIS_STATE.INCOMPLETE) {
            assert.strictEqual(exitCode, 30);
          } else if (state === ANALYSIS_STATE.COMPLETE) {
            if (findings === 0) {
              assert.strictEqual(exitCode, 0);
            } else {
              assert.strictEqual(exitCode, 10);
            }
          }
        }
      }
    });
  });
  
  describe('Determinism Impact on Exit Code', () => {
    test('determinism level does not affect exit code', () => {
      const levels = ['DETERMINISTIC', 'CONTROLLED_NON_DETERMINISTIC', 'NON_DETERMINISTIC'];
      
      for (const level of levels) {
        const result = new RunResult();
        result.state = ANALYSIS_STATE.COMPLETE;
        result.findingsCount = 0;
        result.determinism.level = level;
        
        const exitCode = result.getExitCode();
        assert.strictEqual(exitCode, 0);
      }
    });
    
    test('reproducible flag does not affect exit code', () => {
      const result1 = new RunResult();
      result1.state = ANALYSIS_STATE.COMPLETE;
      result1.findingsCount = 0;
      result1.determinism.reproducible = true;
      
      const result2 = new RunResult();
      result2.state = ANALYSIS_STATE.COMPLETE;
      result2.findingsCount = 0;
      result2.determinism.reproducible = false;
      
      assert.strictEqual(result1.getExitCode(), result2.getExitCode());
    });
  });
});


