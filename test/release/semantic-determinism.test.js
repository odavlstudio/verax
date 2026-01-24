/**
 * Semantic Determinism Tests
 * 
 * Verifies semantic comparison with field normalization.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  compareRunsSemantically,
  loadAndCompareRuns,
  normalizeFindingsForComparison,
} from '../../src/verax/core/integrity/determinism.js';
import { generateTempDirName } from '../support/test-id-provider.js';

const testDir = join(tmpdir(), generateTempDirName('semantic-determinism-test'));

describe('Semantic Determinism', () => {
  test.beforeEach(() => {
    if (rmSync(testDir, { recursive: true, force: true })) {
      // Cleanup
    }
    mkdirSync(testDir, { recursive: true });
  });
  
  test.afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });
  
  test('should compare identical summaries', () => {
    const summary1 = {
      findings: [{ id: 1, message: 'test' }],
      stats: { total: 1 },
    };
    const summary2 = {
      findings: [{ id: 1, message: 'test' }],
      stats: { total: 1 },
    };
    
    const result = compareRunsSemantically(summary1, summary2);
    
    assert.strictEqual(result.identical, true);
    assert.strictEqual(result.differences.length, 0);
  });
  
  test('should ignore timestamps in comparison', () => {
    const summary1 = {
      findings: [],
      timestamp: '2026-01-14T10:00:00Z',
      startedAt: '2026-01-14T10:00:00Z',
      completedAt: '2026-01-14T10:01:00Z',
      stats: { total: 0 },
    };
    const summary2 = {
      findings: [],
      timestamp: '2026-01-14T11:00:00Z', // Different timestamp
      startedAt: '2026-01-14T11:00:00Z',
      completedAt: '2026-01-14T11:01:00Z',
      stats: { total: 0 },
    };
    
    const result = compareRunsSemantically(summary1, summary2);
    
    assert.strictEqual(result.identical, true);
  });
  
  test('should ignore runId in comparison', () => {
    const summary1 = {
      runId: 'run-001',
      findings: [],
      stats: { total: 0 },
    };
    const summary2 = {
      runId: 'run-002',
      findings: [],
      stats: { total: 0 },
    };
    
    const result = compareRunsSemantically(summary1, summary2);
    
    assert.strictEqual(result.identical, true);
  });
  
  test('should ignore duration fields in comparison', () => {
    const summary1 = {
      findings: [],
      totalMs: 5000,
      learnMs: 1000,
      observeMs: 2000,
      detectMs: 2000,
      stats: { total: 0 },
    };
    const summary2 = {
      findings: [],
      totalMs: 6000, // Different durations
      learnMs: 1200,
      observeMs: 2300,
      detectMs: 2500,
      stats: { total: 0 },
    };
    
    const result = compareRunsSemantically(summary1, summary2);
    
    assert.strictEqual(result.identical, true);
  });
  
  test('should normalize paths in comparison', () => {
    const summary1 = {
      findings: [],
      src: 'C:\\Users\\user\\project',
      cwd: 'C:\\Users\\user\\project',
    };
    const summary2 = {
      findings: [],
      src: 'C:\\Users\\user\\project', // Same base path
      cwd: 'C:\\Users\\user\\project',
    };
    
    const result = compareRunsSemantically(summary1, summary2, 'C:\\Users\\user\\project');
    
    assert.strictEqual(result.identical, true);
  });
  
  test('should detect semantic differences in findings', () => {
    const summary1 = {
      findings: [{ id: 1, message: 'test1', line: 10 }],
      stats: { total: 1 },
    };
    const summary2 = {
      findings: [{ id: 1, message: 'test2', line: 10 }], // Different message
      stats: { total: 1 },
    };
    
    const result = compareRunsSemantically(summary1, summary2);
    
    assert.strictEqual(result.identical, false);
    assert.ok(result.differences.length > 0);
  });
  
  test('should detect difference in findings count', () => {
    const summary1 = {
      findings: [{ id: 1 }],
      stats: { total: 1 },
    };
    const summary2 = {
      findings: [{ id: 1 }, { id: 2 }],
      stats: { total: 2 },
    };
    
    const result = compareRunsSemantically(summary1, summary2);
    
    assert.strictEqual(result.identical, false);
    assert.ok(result.differences.length > 0);
  });
  
  test('should normalize findings for comparison', () => {
    const findings = [
      { expectationId: 'exp-2', timestamp: '2026-01-14T10:00:00Z', result: 'fail' },
      { expectationId: 'exp-1', timestamp: '2026-01-14T10:00:01Z', result: 'pass' },
    ];
    
    const normalized = normalizeFindingsForComparison(findings);
    
    // Should be sorted by expectationId
    assert.strictEqual(normalized[0].expectationId, 'exp-1');
    assert.strictEqual(normalized[1].expectationId, 'exp-2');
    
    // Timestamps should be removed
    assert.strictEqual(normalized[0].timestamp, undefined);
  });
  
  test('should load and compare runs from disk', () => {
    const runDir1 = join(testDir, 'run1');
    const runDir2 = join(testDir, 'run2');
    
    mkdirSync(runDir1, { recursive: true });
    mkdirSync(runDir2, { recursive: true });
    
    const summary1 = {
      runId: 'run-001',
      timestamp: '2026-01-14T10:00:00Z',
      findings: [],
      stats: { total: 0 },
    };
    const summary2 = {
      runId: 'run-002',
      timestamp: '2026-01-14T11:00:00Z',
      findings: [],
      stats: { total: 0 },
    };
    
    writeFileSync(join(runDir1, 'summary.json'), JSON.stringify(summary1));
    writeFileSync(join(runDir2, 'summary.json'), JSON.stringify(summary2));
    
    const result = loadAndCompareRuns(runDir1, runDir2, testDir);
    
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.identical, true);
  });
  
  test('should handle comparison errors gracefully', () => {
    const runDir1 = join(testDir, 'run1');
    const runDir2 = join(testDir, 'run2-missing');
    
    mkdirSync(runDir1, { recursive: true });
    writeFileSync(join(runDir1, 'summary.json'), JSON.stringify({}));
    
    const result = loadAndCompareRuns(runDir1, runDir2, testDir);
    
    assert.strictEqual(result.ok, false);
    assert.strictEqual(typeof result.error, 'string');
  });
  
  test('should detect type mismatch', () => {
    const summary1 = { value: 'string' };
    const summary2 = { value: 123 };
    
    const result = compareRunsSemantically(summary1, summary2);
    
    assert.strictEqual(result.identical, false);
    assert.ok(result.differences.some(d => d.type === 'type-mismatch'));
  });
  
  test('should detect missing fields', () => {
    const summary1 = { field1: 'value', field2: 'value' };
    const summary2 = { field1: 'value' };
    
    const result = compareRunsSemantically(summary1, summary2);
    
    assert.strictEqual(result.identical, false);
    assert.ok(result.differences.some(d => d.type === 'missing-in-second'));
  });
  
  test('should handle nested object comparison', () => {
    const summary1 = {
      findings: [],
      meta: {
        stats: { total: 0 },
        config: { enabled: true },
      },
    };
    const summary2 = {
      findings: [],
      meta: {
        stats: { total: 0 },
        config: { enabled: false }, // Different
      },
    };
    
    const result = compareRunsSemantically(summary1, summary2);
    
    assert.strictEqual(result.identical, false);
    assert.ok(result.differences.length > 0);
  });
  
  test('should handle array comparison', () => {
    const summary1 = {
      findings: ['a', 'b', 'c'],
    };
    const summary2 = {
      findings: ['a', 'b', 'c'],
    };
    
    const result = compareRunsSemantically(summary1, summary2);
    
    assert.strictEqual(result.identical, true);
  });
  
  test('should detect array length mismatch', () => {
    const summary1 = {
      findings: ['a', 'b'],
    };
    const summary2 = {
      findings: ['a', 'b', 'c'],
    };
    
    const result = compareRunsSemantically(summary1, summary2);
    
    assert.strictEqual(result.identical, false);
    assert.ok(result.differences.some(d => d.type === 'length-mismatch'));
  });
});


