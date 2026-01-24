/**
 *  Soft Evidence Budget Contract Tests
 * 
 * CRITICAL: These tests verify that soft budget warnings are emitted correctly
 * WITHOUT any behavior changes, blocking, or enforcement.
 * 
 * @module test/evidence/evidence-budget-soft.contract
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { checkBudget, formatBytes, emitBudgetWarning } from '../../src/cli/util/evidence/evidence-budget.js';

//  Test utilities
const captureConsoleWarn = (fn) => {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    fn();
    return warnings;
  } finally {
    console.warn = originalWarn;
  }
};

describe(' Evidence Budget: checkBudget()', () => {
  
  describe('Below threshold (OK status)', () => {
    it('should return ok when usage is 0%', () => {
      const evidenceStats = { totalBytes: 0 };
      const result = checkBudget(evidenceStats);
      
      assert.strictEqual(result.level, 'ok');
      assert.strictEqual(result.percentUsed, 0);
      assert.strictEqual(result.usedBytes, 0);
      assert.strictEqual(result.maxBytes, 50 * 1024 * 1024);
    });
    
    it('should return ok when usage is 50%', () => {
      const evidenceStats = { totalBytes: 25 * 1024 * 1024 }; // 25MB
      const result = checkBudget(evidenceStats);
      
      assert.strictEqual(result.level, 'ok');
      assert.strictEqual(result.percentUsed, 0.5);
      assert.strictEqual(result.usedBytes, 25 * 1024 * 1024);
    });
    
    it('should return ok when usage is 79% (just below threshold)', () => {
      const evidenceStats = { totalBytes: 39.5 * 1024 * 1024 }; // 39.5MB
      const result = checkBudget(evidenceStats);
      
      assert.strictEqual(result.level, 'ok');
      assert.ok(result.percentUsed < 0.8);
    });
  });
  
  describe('Above threshold (WARNING status)', () => {
    it('should return warning when usage is exactly 80%', () => {
      const evidenceStats = { totalBytes: 40 * 1024 * 1024 }; // 40MB (80% of 50MB)
      const result = checkBudget(evidenceStats);
      
      assert.strictEqual(result.level, 'warning');
      assert.strictEqual(result.percentUsed, 0.8);
      assert.strictEqual(result.usedBytes, 40 * 1024 * 1024);
    });
    
    it('should return warning when usage is 90%', () => {
      const evidenceStats = { totalBytes: 45 * 1024 * 1024 }; // 45MB
      const result = checkBudget(evidenceStats);
      
      assert.strictEqual(result.level, 'warning');
      assert.strictEqual(result.percentUsed, 0.9);
    });
    
    it('should return warning when usage exceeds 100%', () => {
      const evidenceStats = { totalBytes: 60 * 1024 * 1024 }; // 60MB (120%)
      const result = checkBudget(evidenceStats);
      
      assert.strictEqual(result.level, 'warning');
      assert.strictEqual(result.percentUsed, 1.2);
      assert.strictEqual(result.usedBytes, 60 * 1024 * 1024);
    });
  });
  
  describe('Custom budget configuration', () => {
    it('should use custom maxBytes', () => {
      const evidenceStats = { totalBytes: 10 * 1024 * 1024 };
      const result = checkBudget(evidenceStats, { maxBytes: 100 * 1024 * 1024 });
      
      assert.strictEqual(result.maxBytes, 100 * 1024 * 1024);
      assert.strictEqual(result.percentUsed, 0.1);
      assert.strictEqual(result.level, 'ok');
    });
    
    it('should use custom warningThreshold', () => {
      const evidenceStats = { totalBytes: 30 * 1024 * 1024 }; // 60% of 50MB
      const result = checkBudget(evidenceStats, { warningThreshold: 0.5 });
      
      assert.strictEqual(result.level, 'warning');
      assert.strictEqual(result.percentUsed, 0.6);
    });
    
    it('should combine custom maxBytes and warningThreshold', () => {
      const evidenceStats = { totalBytes: 50 * 1024 * 1024 };
      const result = checkBudget(evidenceStats, { 
        maxBytes: 100 * 1024 * 1024, 
        warningThreshold: 0.6 
      });
      
      assert.strictEqual(result.level, 'ok'); // 50% < 60%
      assert.strictEqual(result.percentUsed, 0.5);
    });
  });
  
  describe('Edge cases and error handling', () => {
    it('should handle null evidenceStats gracefully', () => {
      const result = checkBudget(null);
      
      assert.strictEqual(result.level, 'ok');
      assert.strictEqual(result.percentUsed, 0);
      assert.strictEqual(result.usedBytes, 0);
    });
    
    it('should handle undefined evidenceStats gracefully', () => {
      const result = checkBudget(undefined);
      
      assert.strictEqual(result.level, 'ok');
      assert.strictEqual(result.percentUsed, 0);
    });
    
    it('should handle missing totalBytes gracefully', () => {
      const result = checkBudget({});
      
      assert.strictEqual(result.level, 'ok');
      assert.strictEqual(result.usedBytes, 0);
    });
    
    it('should handle zero maxBytes without division error', () => {
      const evidenceStats = { totalBytes: 100 };
      const result = checkBudget(evidenceStats, { maxBytes: 0 });
      
      assert.strictEqual(result.percentUsed, 0);
      assert.strictEqual(result.level, 'ok');
    });
    
    it('should never throw on invalid input', () => {
      assert.doesNotThrow(() => checkBudget(null));
      assert.doesNotThrow(() => checkBudget(undefined));
      assert.doesNotThrow(() => checkBudget({ totalBytes: 'invalid' }));
      assert.doesNotThrow(() => checkBudget({ totalBytes: -100 }));
    });
  });
  
  describe('Return value structure', () => {
    it('should return all required fields', () => {
      const evidenceStats = { totalBytes: 10 * 1024 * 1024 };
      const result = checkBudget(evidenceStats);
      
      assert.ok(Object.prototype.hasOwnProperty.call(result, 'level'));
      assert.ok(Object.prototype.hasOwnProperty.call(result, 'percentUsed'));
      assert.ok(Object.prototype.hasOwnProperty.call(result, 'maxBytes'));
      assert.ok(Object.prototype.hasOwnProperty.call(result, 'usedBytes'));
    });
    
    it('should return numeric percentUsed', () => {
      const evidenceStats = { totalBytes: 25 * 1024 * 1024 };
      const result = checkBudget(evidenceStats);
      
      assert.strictEqual(typeof result.percentUsed, 'number');
      assert.ok(!isNaN(result.percentUsed));
    });
  });
});

describe(' Evidence Budget: formatBytes()', () => {
  
  it('should format 0 bytes', () => {
    assert.strictEqual(formatBytes(0), '0B');
  });
  
  it('should format bytes (< 1KB)', () => {
    assert.strictEqual(formatBytes(512), '512B');
    assert.strictEqual(formatBytes(1023), '1023B');
  });
  
  it('should format kilobytes', () => {
    assert.strictEqual(formatBytes(1024), '1.0KB');
    assert.strictEqual(formatBytes(1536), '1.5KB');
    assert.strictEqual(formatBytes(1024 * 10), '10.0KB');
  });
  
  it('should format megabytes', () => {
    assert.strictEqual(formatBytes(1024 * 1024), '1.0MB');
    assert.strictEqual(formatBytes(1024 * 1024 * 5.5), '5.5MB');
    assert.strictEqual(formatBytes(50 * 1024 * 1024), '50.0MB');
  });
  
  it('should format gigabytes', () => {
    assert.strictEqual(formatBytes(1024 * 1024 * 1024), '1.0GB');
    assert.strictEqual(formatBytes(1024 * 1024 * 1024 * 2.3), '2.3GB');
  });
  
  it('should never throw on invalid input', () => {
    assert.doesNotThrow(() => formatBytes(null));
    assert.doesNotThrow(() => formatBytes(undefined));
    assert.doesNotThrow(() => formatBytes('invalid'));
    assert.doesNotThrow(() => formatBytes(-100));
  });
});

describe(' Evidence Budget: emitBudgetWarning()', () => {
  
  it('should NOT emit warning when level is ok', () => {
    const budgetResult = {
      level: 'ok',
      percentUsed: 0.5,
      usedBytes: 25 * 1024 * 1024,
      maxBytes: 50 * 1024 * 1024,
    };
    
    const warnings = captureConsoleWarn(() => {
      emitBudgetWarning(budgetResult);
    });
    
    assert.strictEqual(warnings.length, 0);
  });
  
  it('should emit warning when level is warning', () => {
    const budgetResult = {
      level: 'warning',
      percentUsed: 0.82,
      usedBytes: 41 * 1024 * 1024,
      maxBytes: 50 * 1024 * 1024,
    };
    
    const warnings = captureConsoleWarn(() => {
      emitBudgetWarning(budgetResult);
    });
    
    assert.strictEqual(warnings.length, 1);
    assert.ok(warnings[0].includes('WARNING: Evidence size reached'));
    assert.ok(warnings[0].includes('82%'));
    assert.ok(warnings[0].includes('41.0MB'));
    assert.ok(warnings[0].includes('50.0MB'));
  });
  
  it('should emit warning with correct percentage (rounded)', () => {
    const budgetResult = {
      level: 'warning',
      percentUsed: 0.877,
      usedBytes: 43.85 * 1024 * 1024,
      maxBytes: 50 * 1024 * 1024,
    };
    
    const warnings = captureConsoleWarn(() => {
      emitBudgetWarning(budgetResult);
    });
    
    assert.ok(warnings[0].includes('88%'));
  });
  
  it('should never throw on invalid input', () => {
    assert.doesNotThrow(() => emitBudgetWarning(null));
    assert.doesNotThrow(() => emitBudgetWarning(undefined));
    assert.doesNotThrow(() => emitBudgetWarning({}));
    assert.doesNotThrow(() => emitBudgetWarning({ level: 'invalid' }));
  });
});

describe(' Contract Guarantees', () => {
  
  it('NEVER throws on any input to checkBudget', () => {
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
      assert.doesNotThrow(() => checkBudget(input), `Should not throw for input: ${JSON.stringify(input)}`);
    });
  });
  
  it('NEVER throws on any input to formatBytes', () => {
    const invalidInputs = [null, undefined, 'string', -1000, Infinity, NaN, {}, []];
    
    invalidInputs.forEach(input => {
      assert.doesNotThrow(() => formatBytes(input), `Should not throw for input: ${JSON.stringify(input)}`);
    });
  });
  
  it('NEVER throws on any input to emitBudgetWarning', () => {
    const invalidInputs = [null, undefined, {}, { level: 'unknown' }];
    
    invalidInputs.forEach(input => {
      assert.doesNotThrow(() => emitBudgetWarning(input), `Should not throw for input: ${JSON.stringify(input)}`);
    });
  });
  
  it('checkBudget ALWAYS returns safe defaults on error', () => {
    const result = checkBudget(null);
    
    assert.strictEqual(result.level, 'ok');
    assert.strictEqual(typeof result.percentUsed, 'number');
    assert.strictEqual(typeof result.maxBytes, 'number');
    assert.strictEqual(typeof result.usedBytes, 'number');
  });
  
  it('Evidence budget is read-only instrumentation (no side effects)', () => {
    const evidenceStats = { totalBytes: 40 * 1024 * 1024 };
    const originalStats = { ...evidenceStats };
    
    checkBudget(evidenceStats);
    
    // Verify evidenceStats was not modified
    assert.deepStrictEqual(evidenceStats, originalStats);
  });
  
  it('Warning emission is non-fatal (never blocks execution)', () => {
    const budgetResult = {
      level: 'warning',
      percentUsed: 0.95,
      usedBytes: 47.5 * 1024 * 1024,
      maxBytes: 50 * 1024 * 1024,
    };
    
    // Should complete without throwing
    assert.doesNotThrow(() => {
      emitBudgetWarning(budgetResult);
    });
  });
});

describe(' Integration Scenarios', () => {
  
  it('should handle typical small run (10MB evidence)', () => {
    const evidenceStats = {
      totalBytes: 10 * 1024 * 1024,
      byType: { screenshots: 5000000, network: 3000000, console: 2000000, dom: 0, json: 0, other: 0 }
    };
    
    const result = checkBudget(evidenceStats);
    
    assert.strictEqual(result.level, 'ok');
    assert.strictEqual(result.percentUsed, 0.2);
    assert.strictEqual(result.usedBytes, 10 * 1024 * 1024);
  });
  
  it('should handle large run approaching budget (45MB evidence)', () => {
    const evidenceStats = {
      totalBytes: 45 * 1024 * 1024,
      byType: { screenshots: 30000000, network: 10000000, console: 5000000, dom: 0, json: 0, other: 0 }
    };
    
    const result = checkBudget(evidenceStats);
    const warnings = captureConsoleWarn(() => {
      emitBudgetWarning(result);
    });
    
    assert.strictEqual(result.level, 'warning');
    assert.strictEqual(result.percentUsed, 0.9);
    assert.strictEqual(warnings.length, 1);
    assert.ok(warnings[0].includes('90%'));
  });
  
  it('should handle extreme run exceeding budget (100MB evidence)', () => {
    const evidenceStats = {
      totalBytes: 100 * 1024 * 1024,
      byType: { screenshots: 80000000, network: 15000000, console: 5000000, dom: 0, json: 0, other: 0 }
    };
    
    const result = checkBudget(evidenceStats);
    const warnings = captureConsoleWarn(() => {
      emitBudgetWarning(result);
    });
    
    assert.strictEqual(result.level, 'warning');
    assert.strictEqual(result.percentUsed, 2.0);
    assert.strictEqual(warnings.length, 1);
    assert.ok(warnings[0].includes('200%'));
    // CRITICAL: Even at 200%, only warning is emitted, NO blocking
  });
});




