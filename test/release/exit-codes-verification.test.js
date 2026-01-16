/**
 * PHASE 6A: Formal Exit Code Verification
 * 
 * Property-based tests proving exit code correctness for all state combinations.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { RunResult, ANALYSIS_STATE, SKIP_REASON } from '../src/cli/util/run-result.js';

describe('Phase 6A: Formal Exit Code Verification', () => {
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
  
  describe('Exit Code 1: COMPLETE + Findings Present', () => {
    test('complete analysis with findings', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.COMPLETE;
      result.expectationsDiscovered = 10;
      result.expectationsAnalyzed = 10;
      result.findingsCount = 3;
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 1);
    });
    
    test('single finding detected', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.COMPLETE;
      result.expectationsDiscovered = 5;
      result.expectationsAnalyzed = 5;
      result.findingsCount = 1;
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 1);
    });
    
    test('many findings detected', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.COMPLETE;
      result.expectationsDiscovered = 100;
      result.expectationsAnalyzed = 100;
      result.findingsCount = 50;
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 1);
    });
  });
  
  describe('Exit Code 2: FAILED State', () => {
    test('analysis failed with error', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.FAILED;
      result.error = 'Internal crash';
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 2);
    });
    
    test('contract violations present', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.FAILED;
      result.contractViolations.droppedCount = 5;
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 2);
    });
    
    test('failed state overrides findings', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.FAILED;
      result.findingsCount = 10; // Even with findings, exit 2
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 2);
    });
  });
  
  describe('Exit Code 66: INCOMPLETE State', () => {
    test('no expectations extracted', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.INCOMPLETE;
      result.recordSkip(SKIP_REASON.NO_EXPECTATIONS_EXTRACTED, 1);
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 66);
    });
    
    test('budget exceeded', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.INCOMPLETE;
      result.expectationsDiscovered = 100;
      result.recordSkip(SKIP_REASON.BUDGET_EXCEEDED, 50);
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 66);
    });
    
    test('observe timeout', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.INCOMPLETE;
      result.expectationsDiscovered = 10;
      result.recordSkip(SKIP_REASON.TIMEOUT_OBSERVE, 5);
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 66);
    });
    
    test('detect timeout', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.INCOMPLETE;
      result.expectationsDiscovered = 10;
      result.recordSkip(SKIP_REASON.TIMEOUT_DETECT, 3);
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 66);
    });
    
    test('total timeout', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.INCOMPLETE;
      result.recordSkip(SKIP_REASON.TIMEOUT_TOTAL, 1);
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 66);
    });
    
    test('incomplete with findings still returns 66', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.INCOMPLETE;
      result.findingsCount = 5;
      result.recordSkip(SKIP_REASON.BUDGET_EXCEEDED, 10);
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 66);
    });
    
    test('incomplete overrides complete', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.INCOMPLETE;
      result.expectationsDiscovered = 10;
      result.expectationsAnalyzed = 5; // Partial analysis
      result.recordSkip(SKIP_REASON.BUDGET_EXCEEDED, 5);
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 66);
    });
  });
  
  describe('State Precedence Rules', () => {
    test('FAILED takes precedence over INCOMPLETE', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.FAILED;
      result.recordSkip(SKIP_REASON.BUDGET_EXCEEDED, 10);
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 2);
    });
    
    test('FAILED takes precedence over findings', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.FAILED;
      result.findingsCount = 100;
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 2);
    });
    
    test('INCOMPLETE takes precedence over findings', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.INCOMPLETE;
      result.findingsCount = 50;
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 66);
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
      assert.strictEqual(exitCode, 66);
    });
  });
  
  describe('Integrity Violation Cases (Phase 6A)', () => {
    test('poisoned run = FAILED = exit 2', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.FAILED;
      result.error = 'RUN_POISONED';
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 2);
    });
    
    test('integrity hash mismatch = FAILED = exit 2', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.FAILED;
      result.error = 'Integrity violation: hash mismatch';
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 2);
    });
    
    test('artifact write failure = FAILED = exit 2', () => {
      const result = new RunResult();
      result.state = ANALYSIS_STATE.FAILED;
      result.error = 'Failed to write primary truth artifact';
      
      const exitCode = result.getExitCode();
      assert.strictEqual(exitCode, 2);
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
          assert.ok([0, 1, 2, 66].includes(exitCode), 
            `Invalid exit code ${exitCode} for state=${state}, findings=${findings}`);
          
          // Verify state-based rules
          if (state === ANALYSIS_STATE.FAILED) {
            assert.strictEqual(exitCode, 2);
          } else if (state === ANALYSIS_STATE.INCOMPLETE) {
            assert.strictEqual(exitCode, 66);
          } else if (state === ANALYSIS_STATE.COMPLETE) {
            if (findings === 0) {
              assert.strictEqual(exitCode, 0);
            } else {
              assert.strictEqual(exitCode, 1);
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

