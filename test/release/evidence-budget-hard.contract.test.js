/**
 *  Hard Evidence Budget Contract Tests
 * 
 * CRITICAL: These tests verify that hard budget enforcement prevents OOM
 * WITHOUT crashing, throwing, or exhibiting non-deterministic behavior.
 * 
 * @module test/evidence/evidence-budget-hard.contract
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { checkHardBudget } from '../../src/cli/util/evidence/evidence-budget.js';

describe(' Hard Evidence Budget: checkHardBudget()', () => {
  
  describe('Below hard limit (OK status)', () => {
    it('should return ok when usage is 0 bytes', () => {
      const evidenceStats = { totalBytes: 0 };
      const result = checkHardBudget(evidenceStats);
      
      assert.strictEqual(result.exceeded, false);
      assert.strictEqual(result.level, 'ok');
      assert.strictEqual(result.usedBytes, 0);
      assert.strictEqual(result.maxBytes, 50 * 1024 * 1024);
      assert.strictEqual(result.reason, undefined);
    });
    
    it('should return ok when usage is 50% of limit', () => {
      const evidenceStats = { totalBytes: 25 * 1024 * 1024 }; // 25MB
      const result = checkHardBudget(evidenceStats);
      
      assert.strictEqual(result.exceeded, false);
      assert.strictEqual(result.level, 'ok');
      assert.strictEqual(result.usedBytes, 25 * 1024 * 1024);
    });
    
    it('should return ok when usage is exactly at limit', () => {
      const evidenceStats = { totalBytes: 50 * 1024 * 1024 }; // 50MB exactly
      const result = checkHardBudget(evidenceStats);
      
      assert.strictEqual(result.exceeded, false);
      assert.strictEqual(result.level, 'ok');
      assert.strictEqual(result.usedBytes, 50 * 1024 * 1024);
    });
    
    it('should return ok when usage is 99.9% of limit', () => {
      const evidenceStats = { totalBytes: 50 * 1024 * 1024 - 1000 }; // Just under 50MB
      const result = checkHardBudget(evidenceStats);
      
      assert.strictEqual(result.exceeded, false);
      assert.strictEqual(result.level, 'ok');
    });
  });
  
  describe('Above hard limit (HARD-STOP status)', () => {
    it('should return hard-stop when usage exceeds limit by 1 byte', () => {
      const evidenceStats = { totalBytes: 50 * 1024 * 1024 + 1 }; // 50MB + 1 byte
      const result = checkHardBudget(evidenceStats);
      
      assert.strictEqual(result.exceeded, true);
      assert.strictEqual(result.level, 'hard-stop');
      assert.strictEqual(result.reason, 'evidence-budget-exceeded');
      assert.strictEqual(result.usedBytes, 50 * 1024 * 1024 + 1);
    });
    
    it('should return hard-stop when usage is 120% of limit', () => {
      const evidenceStats = { totalBytes: 60 * 1024 * 1024 }; // 60MB (120%)
      const result = checkHardBudget(evidenceStats);
      
      assert.strictEqual(result.exceeded, true);
      assert.strictEqual(result.level, 'hard-stop');
      assert.strictEqual(result.reason, 'evidence-budget-exceeded');
    });
    
    it('should return hard-stop when usage is 200% of limit', () => {
      const evidenceStats = { totalBytes: 100 * 1024 * 1024 }; // 100MB (200%)
      const result = checkHardBudget(evidenceStats);
      
      assert.strictEqual(result.exceeded, true);
      assert.strictEqual(result.level, 'hard-stop');
      assert.strictEqual(result.reason, 'evidence-budget-exceeded');
      assert.strictEqual(result.usedBytes, 100 * 1024 * 1024);
    });
  });
  
  describe('Custom hard limit configuration', () => {
    it('should use custom maxBytes for hard limit', () => {
      const evidenceStats = { totalBytes: 60 * 1024 * 1024 };
      const result = checkHardBudget(evidenceStats, { maxBytes: 100 * 1024 * 1024 });
      
      assert.strictEqual(result.exceeded, false);
      assert.strictEqual(result.level, 'ok');
      assert.strictEqual(result.maxBytes, 100 * 1024 * 1024);
    });
    
    it('should enforce custom maxBytes hard limit', () => {
      const evidenceStats = { totalBytes: 11 * 1024 * 1024 }; // 11MB
      const result = checkHardBudget(evidenceStats, { maxBytes: 10 * 1024 * 1024 });
      
      assert.strictEqual(result.exceeded, true);
      assert.strictEqual(result.level, 'hard-stop');
      assert.strictEqual(result.reason, 'evidence-budget-exceeded');
    });
  });
  
  describe('Edge cases and error handling', () => {
    it('should handle null evidenceStats gracefully', () => {
      const result = checkHardBudget(null);
      
      assert.strictEqual(result.exceeded, false);
      assert.strictEqual(result.level, 'ok');
      assert.strictEqual(result.usedBytes, 0);
    });
    
    it('should handle undefined evidenceStats gracefully', () => {
      const result = checkHardBudget(undefined);
      
      assert.strictEqual(result.exceeded, false);
      assert.strictEqual(result.level, 'ok');
    });
    
    it('should handle missing totalBytes gracefully', () => {
      const result = checkHardBudget({});
      
      assert.strictEqual(result.exceeded, false);
      assert.strictEqual(result.level, 'ok');
      assert.strictEqual(result.usedBytes, 0);
    });
    
    it('should never throw on any input', () => {
      const invalidInputs = [
        null,
        undefined,
        {},
        { totalBytes: null },
        { totalBytes: undefined },
        { totalBytes: 'string' },
        { totalBytes: -1000 },
        { totalBytes: Infinity },
        { totalBytes: NaN },
      ];
      
      invalidInputs.forEach(input => {
        assert.doesNotThrow(() => checkHardBudget(input), `Should not throw for input: ${JSON.stringify(input)}`);
      });
    });
  });
  
  describe('Return value structure', () => {
    it('should return all required fields when below limit', () => {
      const evidenceStats = { totalBytes: 10 * 1024 * 1024 };
      const result = checkHardBudget(evidenceStats);
      
      assert.ok(Object.prototype.hasOwnProperty.call(result, 'exceeded'));
      assert.ok(Object.prototype.hasOwnProperty.call(result, 'level'));
      assert.ok(Object.prototype.hasOwnProperty.call(result, 'maxBytes'));
      assert.ok(Object.prototype.hasOwnProperty.call(result, 'usedBytes'));
      assert.strictEqual(result.exceeded, false);
      assert.strictEqual(result.level, 'ok');
    });
    
    it('should return all required fields when above limit', () => {
      const evidenceStats = { totalBytes: 60 * 1024 * 1024 };
      const result = checkHardBudget(evidenceStats);
      
      assert.ok(Object.prototype.hasOwnProperty.call(result, 'exceeded'));
      assert.ok(Object.prototype.hasOwnProperty.call(result, 'level'));
      assert.ok(Object.prototype.hasOwnProperty.call(result, 'reason'));
      assert.ok(Object.prototype.hasOwnProperty.call(result, 'maxBytes'));
      assert.ok(Object.prototype.hasOwnProperty.call(result, 'usedBytes'));
      assert.strictEqual(result.exceeded, true);
      assert.strictEqual(result.level, 'hard-stop');
      assert.strictEqual(result.reason, 'evidence-budget-exceeded');
    });
  });
});

describe(' OOM Prevention Contract', () => {
  
  it('NEVER throws when hard limit exceeded', () => {
    const evidenceStats = { totalBytes: 100 * 1024 * 1024 }; // 100MB (200% of limit)
    assert.doesNotThrow(() => checkHardBudget(evidenceStats));
  });
  
  it('NEVER crashes on any input', () => {
    const extremeInputs = [
      { totalBytes: Number.MAX_SAFE_INTEGER },
      { totalBytes: Infinity },
      { totalBytes: -Infinity },
      { totalBytes: NaN },
      null,
      undefined,
    ];
    
    extremeInputs.forEach(input => {
      assert.doesNotThrow(() => checkHardBudget(input), `Should not crash for input: ${JSON.stringify(input)}`);
    });
  });
  
  it('Returns deterministic result for same input', () => {
    const evidenceStats = { totalBytes: 60 * 1024 * 1024 };
    
    const result1 = checkHardBudget(evidenceStats);
    const result2 = checkHardBudget(evidenceStats);
    const result3 = checkHardBudget(evidenceStats);
    
    assert.deepStrictEqual(result1, result2);
    assert.deepStrictEqual(result2, result3);
  });
  
  it('Does not modify input evidenceStats', () => {
    const evidenceStats = { totalBytes: 60 * 1024 * 1024, byType: { screenshots: 60000000 } };
    const originalStats = JSON.parse(JSON.stringify(evidenceStats));
    
    checkHardBudget(evidenceStats);
    
    assert.deepStrictEqual(evidenceStats, originalStats);
  });
});

describe(' Boundary Conditions', () => {
  
  it('Treats exactly at limit (50MB) as OK, not exceeded', () => {
    const evidenceStats = { totalBytes: 50 * 1024 * 1024 };
    const result = checkHardBudget(evidenceStats);
    
    assert.strictEqual(result.exceeded, false);
    assert.strictEqual(result.level, 'ok');
  });
  
  it('Treats limit + 1 byte as exceeded', () => {
    const evidenceStats = { totalBytes: 50 * 1024 * 1024 + 1 };
    const result = checkHardBudget(evidenceStats);
    
    assert.strictEqual(result.exceeded, true);
    assert.strictEqual(result.level, 'hard-stop');
  });
  
  it('Handles zero maxBytes without division error', () => {
    const evidenceStats = { totalBytes: 100 };
    const result = checkHardBudget(evidenceStats, { maxBytes: 0 });
    
    // With maxBytes=0, any positive usage exceeds
    assert.strictEqual(result.exceeded, true);
    assert.strictEqual(result.level, 'hard-stop');
  });
  
  it('Handles negative totalBytes gracefully', () => {
    const evidenceStats = { totalBytes: -1000 };
    const result = checkHardBudget(evidenceStats);
    
    // Negative bytes should not exceed limit
    assert.strictEqual(result.exceeded, false);
    assert.strictEqual(result.level, 'ok');
  });
});

describe(' Integration Scenarios', () => {
  
  it('Simulates gradual evidence accumulation staying under limit', () => {
    const stats = { totalBytes: 0 };
    
    // Add 10MB increments
    for (let i = 0; i < 5; i++) {
      stats.totalBytes += 10 * 1024 * 1024;
      const result = checkHardBudget(stats);
      
      if (i < 5) {
        // First 5 increments (50MB total) should be OK
        assert.strictEqual(result.exceeded, false, `Iteration ${i} should not exceed`);
      }
    }
    
    // Exactly at 50MB should still be OK
    assert.strictEqual(stats.totalBytes, 50 * 1024 * 1024);
    const finalCheck = checkHardBudget(stats);
    assert.strictEqual(finalCheck.exceeded, false);
  });
  
  it('Simulates gradual evidence accumulation crossing limit', () => {
    const stats = { totalBytes: 0 };
    let crossedLimit = false;
    
    // Add 10MB increments until we cross
    for (let i = 0; i < 6; i++) {
      stats.totalBytes += 10 * 1024 * 1024;
      const result = checkHardBudget(stats);
      
      if (result.exceeded && !crossedLimit) {
        crossedLimit = true;
        // Should cross at 60MB (6th increment)
        assert.strictEqual(i, 5, 'Should exceed on 6th increment');
        assert.strictEqual(result.level, 'hard-stop');
        assert.strictEqual(result.reason, 'evidence-budget-exceeded');
      }
    }
    
    assert.strictEqual(crossedLimit, true, 'Should have crossed limit');
  });
  
  it('Simulates detecting OOM risk early with large evidence', () => {
    const stats = { totalBytes: 100 * 1024 * 1024 }; // 100MB immediately
    const result = checkHardBudget(stats);
    
    // Should immediately detect excessive evidence
    assert.strictEqual(result.exceeded, true);
    assert.strictEqual(result.level, 'hard-stop');
    assert.strictEqual(result.reason, 'evidence-budget-exceeded');
  });
});

describe(' Determinism Guarantees', () => {
  
  it('Always returns same result for same evidence size', () => {
    const evidenceStats = { totalBytes: 45 * 1024 * 1024 };
    
    const results = [];
    for (let i = 0; i < 100; i++) {
      results.push(checkHardBudget(evidenceStats));
    }
    
    // All results should be identical
    const first = results[0];
    results.forEach((result, index) => {
      assert.deepStrictEqual(result, first, `Result ${index} should match first result`);
    });
  });
  
  it('Threshold check is consistent and reproducible', () => {
    const justUnder = { totalBytes: 50 * 1024 * 1024 };
    const justOver = { totalBytes: 50 * 1024 * 1024 + 1 };
    
    // Run multiple times to ensure determinism
    for (let i = 0; i < 10; i++) {
      const underResult = checkHardBudget(justUnder);
      const overResult = checkHardBudget(justOver);
      
      assert.strictEqual(underResult.exceeded, false);
      assert.strictEqual(overResult.exceeded, true);
    }
  });
});




