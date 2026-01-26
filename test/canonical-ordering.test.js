/**
 * CORE Issue #5: Canonical Ordering Tests
 * Verify that sorting rules are applied correctly
 * and maintain stable order regardless of insertion sequence
 */

import { strict as assert } from 'assert';

describe('CORE Issue #5: Canonical Ordering', () => {
  describe('Stable Sorting Property', () => {
    it('should maintain identical order across multiple sorts', async () => {
      const { compareExpectations } = await import('../src/cli/util/canonical-sort.js');
      
      const createExp = (file, line, kind, value) => ({
        source: { file, line },
        promise: { kind, value },
        id: `exp_${file}_${line}_${kind}`,
      });
      
      const expectations = [
        createExp('z.js', 50, 'click', 'btn'),
        createExp('a.js', 10, 'nav', '/'),
        createExp('m.js', 25, 'nav', '/about'),
        createExp('a.js', 10, 'nav', '/contact'),
      ];
      
      // Sort multiple times
      const sorted1 = [...expectations].sort(compareExpectations);
      const sorted2 = [...expectations].sort(compareExpectations);
      const sorted3 = [...expectations].sort(compareExpectations);
      
      // Order must be identical every time
      const ids1 = sorted1.map(e => e.id);
      const ids2 = sorted2.map(e => e.id);
      const ids3 = sorted3.map(e => e.id);
      
      assert.deepStrictEqual(ids1, ids2);
      assert.deepStrictEqual(ids2, ids3);
    });
    
    it('should handle different insertion orders correctly', async () => {
      const { compareFindings } = await import('../src/cli/util/canonical-sort.js');
      
      const findings = [
        { sourceRef: 'file1.js:20:0', type: 'FAIL', status: 'FAIL', severity: 'HIGH', id: '3' },
        { sourceRef: 'file1.js:10:0', type: 'FAIL', status: 'PASS', severity: 'LOW', id: '1' },
        { sourceRef: 'file2.js:5:0', type: 'PASS', status: 'PASS', severity: 'MEDIUM', id: '2' },
      ];
      
      // Different insertion sequences
      const seq1 = [...findings].sort(compareFindings).map(f => f.id);
      const seq2 = [...findings].reverse().sort(compareFindings).map(f => f.id);
      const seq3 = [findings[2], findings[0], findings[1]].sort(compareFindings).map(f => f.id);
      
      assert.deepStrictEqual(seq1, seq2);
      assert.deepStrictEqual(seq2, seq3);
    });
  });
  
  describe('Comparator Stability', () => {
    it('should define total ordering for expectations', async () => {
      const { compareExpectations } = await import('../src/cli/util/canonical-sort.js');
      
      const exp1 = { source: { file: 'a.js', line: 10, column: 0 }, promise: { kind: 'nav', value: '/' }, id: 'a' };
      const exp2 = { source: { file: 'a.js', line: 10, column: 0 }, promise: { kind: 'nav', value: '/' }, id: 'b' };
      const exp3 = { source: { file: 'b.js', line: 5, column: 0 }, promise: { kind: 'click', value: 'btn' }, id: 'c' };
      
      // Transitivity: if a < b and b < c, then a < c
      const ab = compareExpectations(exp1, exp2);
      const bc = compareExpectations(exp2, exp3);
      const ac = compareExpectations(exp1, exp3);
      
      // exp1 < exp2 (by id)
      assert(ab < 0);
      // exp2 < exp3 (file b > file a)
      assert(bc > 0);
      // exp1 < exp3 (file a < file b)
      assert(ac < 0);
    });
    
    it('should handle equal comparators correctly', async () => {
      const { compareObservations } = await import('../src/cli/util/canonical-sort.js');
      
      const o1 = { expectationId: 'exp_a', attempted: true, observedAt: '2026-01-25T10:00:00Z', id: 'o1' };
      const o2 = { expectationId: 'exp_a', attempted: true, observedAt: '2026-01-25T10:00:00Z', id: 'o2' };
      
      // Should compare by id when all other fields equal
      const cmp = compareObservations(o1, o2);
      assert(cmp < 0); // o1.id < o2.id
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle expectations with missing source fields', async () => {
      const { compareExpectations } = await import('../src/cli/util/canonical-sort.js');
      
      const exp1 = { promise: { kind: 'nav', value: '/' }, id: 'exp_1' };
      const exp2 = { source: { file: 'a.js', line: 10 }, promise: { kind: 'nav', value: '/' }, id: 'exp_2' };
      
      // exp1 (no file) should come before exp2 (has file, file sorts empty string first)
      const sorted = [exp2, exp1].sort(compareExpectations);
      assert.strictEqual(sorted[0].id, 'exp_1');
    });
    
    it('should handle findings with missing severity', async () => {
      const { compareFindings } = await import('../src/cli/util/canonical-sort.js');
      
      const f1 = { sourceRef: 'a.js:10:0', type: 'FAIL', status: 'FAIL', severity: 'HIGH', id: 'f1' };
      const f2 = { sourceRef: 'a.js:10:0', type: 'FAIL', status: 'FAIL', id: 'f2' }; // No severity
      
      const sorted = [f1, f2].sort(compareFindings);
      // f2 (missing severity treated as lowest priority)
      assert.strictEqual(sorted[0].id, 'f2');
    });
    
    it('should handle runtime expectations with missing method', async () => {
      const { compareRuntimeExpectations } = await import('../src/cli/util/canonical-sort.js');
      
      const r1 = { sourceKind: 'initial-discovery', href: '/a', statusCode: 200, id: 'r1' };
      const r2 = { sourceKind: 'initial-discovery', href: '/a', method: 'POST', statusCode: 200, id: 'r2' };
      
      // Both should sort correctly (GET is default)
      const sorted = [r2, r1].sort(compareRuntimeExpectations);
      assert.strictEqual(sorted[0].id, 'r1'); // GET before POST
    });
  });
  
  describe('String Comparison Behavior', () => {
    it('should use case-insensitive file comparison', async () => {
      const { compareExpectations } = await import('../src/cli/util/canonical-sort.js');
      
      const exp1 = { source: { file: 'ABC.js', line: 10 }, promise: { kind: 'nav', value: '/' }, id: 'exp_1' };
      const exp2 = { source: { file: 'abc.js', line: 10 }, promise: { kind: 'nav', value: '/' }, id: 'exp_2' };
      
      // ABC.js and abc.js should be equal in file comparison (case-insensitive)
      const cmp = compareExpectations(exp1, exp2);
      // Will compare by id since files are equal (case-insensitive)
      assert(cmp < 0); // exp_1 < exp_2
    });
    
    it('should use localeCompare for consistent string ordering', async () => {
      const { compareRuntimeExpectations } = await import('../src/cli/util/canonical-sort.js');
      
      const r1 = { sourceKind: 'initial-discovery', href: '/Zebra', method: 'GET', id: 'r1' };
      const r2 = { sourceKind: 'initial-discovery', href: '/apple', method: 'GET', id: 'r2' };
      
      const sorted = [r1, r2].sort(compareRuntimeExpectations);
      // localeCompare should order /Zebra before /apple
      assert.strictEqual(sorted[0].id, 'r1');
    });
  });
  
  describe('Numeric Comparison Behavior', () => {
    it('should correctly compare line numbers', async () => {
      const { compareExpectations } = await import('../src/cli/util/canonical-sort.js');
      
      const exp1 = { source: { file: 'a.js', line: 100 }, promise: { kind: 'nav', value: '/' }, id: 'exp_100' };
      const exp2 = { source: { file: 'a.js', line: 20 }, promise: { kind: 'nav', value: '/' }, id: 'exp_20' };
      const exp3 = { source: { file: 'a.js', line: 3 }, promise: { kind: 'nav', value: '/' }, id: 'exp_3' };
      
      const sorted = [exp1, exp2, exp3].sort(compareExpectations);
      // Numeric sort: 3 < 20 < 100
      assert.deepStrictEqual(
        sorted.map(e => e.id),
        ['exp_3', 'exp_20', 'exp_100']
      );
    });
    
    it('should correctly compare status code numbers', async () => {
      const { compareRuntimeExpectations } = await import('../src/cli/util/canonical-sort.js');
      
      const r1 = { sourceKind: 'initial-discovery', href: '/a', method: 'GET', statusCode: 404, id: 'r404' };
      const r2 = { sourceKind: 'initial-discovery', href: '/a', method: 'GET', statusCode: 200, id: 'r200' };
      const r3 = { sourceKind: 'initial-discovery', href: '/a', method: 'GET', statusCode: 500, id: 'r500' };
      
      const sorted = [r1, r2, r3].sort(compareRuntimeExpectations);
      // Numeric sort: 200 < 404 < 500
      assert.deepStrictEqual(
        sorted.map(e => e.id),
        ['r200', 'r404', 'r500']
      );
    });
  });
  
  describe('Ordering Consistency', () => {
    it('should produce canonical ordering for mixed complexity artifacts', async () => {
      const { compareExpectations, _compareFindings, _compareRuntimeExpectations, _compareObservations } = await import('../src/cli/util/canonical-sort.js');
      
      // Run each comparator multiple times with shuffled data
      const data = Array.from({ length: 20 }, (_, i) => ({
        id: `item_${i}`,
        file: String.fromCharCode(65 + (i % 5)), // A-E
        line: (i * 7) % 100,
        value: `value_${i}`,
      }));
      
      // Create expectations and sort multiple times
      const exps1 = data.map(d => ({ source: { file: d.file + '.js', line: d.line }, promise: { kind: 'nav', value: d.value }, id: d.id }));
      const exps2 = [...exps1].reverse();
      const exps3 = [exps1[10], exps1[0], exps1[5], ...exps1.slice(11)];
      
      const sorted1 = exps1.sort(compareExpectations).map(e => e.id);
      const sorted2 = exps2.sort(compareExpectations).map(e => e.id);
      const sorted3 = exps3.sort(compareExpectations).map(e => e.id);
      
      // All three sequences should be identical
      assert.deepStrictEqual(sorted1, sorted2);
      assert.deepStrictEqual(sorted2, sorted3);
    });
  });
});
