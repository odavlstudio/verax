/**
 * CORE Issue #5: Determinism Tests
 * Verify that byte-for-byte identical artifacts are produced
 * for identical inputs, regardless of internal ordering
 */

import { strict as assert } from 'assert';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { _resolve } from 'path';

/**
 * Hash a file for determinism verification
 * @param {string} filePath - Path to file
 * @returns {string} SHA256 hash hex string
 */
function _hashFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    return createHash('sha256').update(content).digest('hex');
  } catch (e) {
    return null;
  }
}

/**
 * Compare two artifacts for byte-for-byte equality
 * @param {any} artifact1 - First artifact
 * @param {any} artifact2 - Second artifact
 * @param {string} [name] - Artifact name for error messages
 */
function _assertArtifactsEqual(artifact1, artifact2, name = 'artifact') {
  const json1 = JSON.stringify(artifact1, null, 2);
  const json2 = JSON.stringify(artifact2, null, 2);
  
  assert.strictEqual(
    json1,
    json2,
    `${name} artifacts must be byte-for-byte identical`
  );
}

describe('CORE Issue #5: Determinism & Canonical Output', () => {
  describe('Expectation Sorting', () => {
    it('should sort expectations by file:line:column:kind:value', async () => {
      const { compareExpectations } = await import('../src/cli/util/canonical-sort.js');
      
      const exp1 = { source: { file: 'a.js', line: 10, column: 0 }, promise: { kind: 'nav', value: '/' }, id: 'exp_abc' };
      const exp2 = { source: { file: 'a.js', line: 5, column: 0 }, promise: { kind: 'nav', value: '/' }, id: 'exp_xyz' };
      const exp3 = { source: { file: 'b.js', line: 10, column: 0 }, promise: { kind: 'nav', value: '/' }, id: 'exp_def' };
      
      const sorted = [exp1, exp2, exp3].sort(compareExpectations);
      
      // exp2 first (a.js line 5), then exp1 (a.js line 10), then exp3 (b.js line 10)
      assert.strictEqual(sorted[0].id, 'exp_xyz');
      assert.strictEqual(sorted[1].id, 'exp_abc');
      assert.strictEqual(sorted[2].id, 'exp_def');
    });
    
    it('should produce identical order regardless of input order', async () => {
      const { compareExpectations } = await import('../src/cli/util/canonical-sort.js');
      
      const expectations = [
        { source: { file: 'c.js', line: 20 }, promise: { kind: 'click', value: 'btn' }, id: 'exp_c' },
        { source: { file: 'a.js', line: 10 }, promise: { kind: 'nav', value: '/' }, id: 'exp_a' },
        { source: { file: 'b.js', line: 15 }, promise: { kind: 'nav', value: '/about' }, id: 'exp_b' },
      ];
      
      // Sort multiple times
      const sorted1 = [...expectations].sort(compareExpectations).map(e => e.id);
      const sorted2 = [...expectations].sort(compareExpectations).map(e => e.id);
      
      // Should always be identical
      assert.deepStrictEqual(sorted1, sorted2);
      assert.deepStrictEqual(sorted1, ['exp_a', 'exp_b', 'exp_c']);
    });
  });
  
  describe('Finding Sorting', () => {
    it('should sort findings by sourceRef:type:status:severity:expectationId', async () => {
      const { compareFindings } = await import('../src/cli/util/canonical-sort.js');
      
      const f1 = { sourceRef: 'a.js:20:0', type: 'FAIL', status: 'FAIL', severity: 'HIGH', expectationId: 'exp_1', id: 'f1' };
      const f2 = { sourceRef: 'a.js:10:0', type: 'FAIL', status: 'PASS', severity: 'LOW', expectationId: 'exp_2', id: 'f2' };
      const f3 = { sourceRef: 'b.js:5:0', type: 'PASS', status: 'PASS', severity: 'MEDIUM', expectationId: 'exp_3', id: 'f3' };
      
      const sorted = [f1, f2, f3].sort(compareFindings);
      
      // f2 first (a.js:10), then f1 (a.js:20), then f3 (b.js:5)
      assert.strictEqual(sorted[0].id, 'f2');
      assert.strictEqual(sorted[1].id, 'f1');
      assert.strictEqual(sorted[2].id, 'f3');
    });
    
    it('should handle missing sourceRef gracefully', async () => {
      const { compareFindings } = await import('../src/cli/util/canonical-sort.js');
      
      const f1 = { type: 'FAIL', status: 'FAIL', severity: 'HIGH', id: 'f1' };
      const f2 = { sourceRef: 'a.js:10:0', type: 'PASS', status: 'PASS', severity: 'LOW', id: 'f2' };
      
      // f1 (no sourceRef sorts first) then f2
      const sorted = [f2, f1].sort(compareFindings);
      assert.strictEqual(sorted[0].id, 'f1');
      assert.strictEqual(sorted[1].id, 'f2');
    });
  });
  
  describe('Runtime Expectation Sorting', () => {
    it('should sort by sourceKind:href:method:statusCode', async () => {
      const { compareRuntimeExpectations } = await import('../src/cli/util/canonical-sort.js');
      
      const r1 = { sourceKind: 'micro-crawl', href: '/products', method: 'GET', statusCode: 200, id: 'r1' };
      const r2 = { sourceKind: 'initial-discovery', href: '/about', method: 'GET', statusCode: 200, id: 'r2' };
      const r3 = { sourceKind: 'initial-discovery', href: '/contact', method: 'POST', statusCode: 201, id: 'r3' };
      
      const sorted = [r1, r2, r3].sort(compareRuntimeExpectations);
      
      // r2 first (initial-discovery /about), then r3 (initial-discovery /contact POST), then r1 (micro-crawl)
      assert.strictEqual(sorted[0].id, 'r2');
      assert.strictEqual(sorted[1].id, 'r3');
      assert.strictEqual(sorted[2].id, 'r1');
    });
  });
  
  describe('Observation Sorting', () => {
    it('should sort by expectationId:attempted:observedAt', async () => {
      const { compareObservations } = await import('../src/cli/util/canonical-sort.js');
      
      const o1 = { expectationId: 'exp_b', attempted: true, observedAt: '2026-01-25T10:00:00Z', id: 'o1' };
      const o2 = { expectationId: 'exp_a', attempted: false, observedAt: '2026-01-25T09:00:00Z', id: 'o2' };
      const o3 = { expectationId: 'exp_a', attempted: true, observedAt: '2026-01-25T08:00:00Z', id: 'o3' };
      
      const sorted = [o1, o2, o3].sort(compareObservations);
      
      // o3 first (exp_a attempted), then o2 (exp_a not attempted), then o1 (exp_b)
      assert.strictEqual(sorted[0].id, 'o3');
      assert.strictEqual(sorted[1].id, 'o2');
      assert.strictEqual(sorted[2].id, 'o1');
    });
  });
  
  describe('Stable Stringification', () => {
    it('should produce identical JSON for same object with different key orders', async () => {
      const { stableStringify } = await import('../src/cli/util/canonical-sort.js');
      
      const obj1 = { z: 1, a: 2, m: 3 };
      const obj2 = { a: 2, m: 3, z: 1 };
      
      const str1 = stableStringify(obj1);
      const str2 = stableStringify(obj2);
      
      assert.strictEqual(str1, str2);
      assert.strictEqual(str1, JSON.stringify({ a: 2, m: 3, z: 1 }, null, 2));
    });
    
    it('should handle nested objects with canonical key order', async () => {
      const { stableStringify } = await import('../src/cli/util/canonical-sort.js');
      
      const obj = {
        z: { inner_z: 1, inner_a: 2 },
        a: { inner_y: 3, inner_b: 4 },
      };
      
      const json = stableStringify(obj);
      
      // Keys should be sorted: a before z, and inner fields sorted
      assert(json.indexOf('"a"') < json.indexOf('"z"'));
      assert(json.indexOf('"inner_a"') < json.indexOf('"inner_z"'));
    });
    
    it('should preserve array order while canonicalizing nested objects', async () => {
      const { stableStringify } = await import('../src/cli/util/canonical-sort.js');
      
      const arr = [
        { z: 1, a: 2 },
        { z: 3, a: 4 },
      ];
      
      const json = stableStringify({ items: arr });
      
      // Array should preserve order, objects should be canonicalized
      const parsed = JSON.parse(json);
      assert.strictEqual(parsed.items[0].a, 2);
      assert.strictEqual(parsed.items[1].a, 4);
    });
  });
  
  describe('Artifact Sorting', () => {
    it('should sort all array fields in artifacts', async () => {
      const { sortArtifact } = await import('../src/cli/util/canonical-sort.js');
      
      const artifact = {
        expectations: [
          { source: { file: 'b.js', line: 10 }, id: 'exp_b' },
          { source: { file: 'a.js', line: 5 }, id: 'exp_a' },
        ],
        findings: [
          { sourceRef: 'b.js:20', id: 'f_b' },
          { sourceRef: 'a.js:10', id: 'f_a' },
        ],
        observations: [
          { expectationId: 'exp_c', id: 'o_c' },
          { expectationId: 'exp_a', id: 'o_a' },
        ],
      };
      
      const sorted = sortArtifact(artifact);
      
      // All arrays should be sorted
      assert.strictEqual(sorted.expectations[0].id, 'exp_a');
      assert.strictEqual(sorted.findings[0].id, 'f_a');
      assert.strictEqual(sorted.observations[0].id, 'o_a');
    });
  });
  
  describe('Determinism Invariant', () => {
    it('should produce identical JSON for identical input', async () => {
      const { compareExpectations, stableStringify } = await import('../src/cli/util/canonical-sort.js');
      
      const expectations = [
        { source: { file: 'c.js', line: 30 }, promise: { kind: 'click', value: 'btn' }, id: 'exp_c' },
        { source: { file: 'a.js', line: 10 }, promise: { kind: 'nav', value: '/' }, id: 'exp_a' },
        { source: { file: 'b.js', line: 20 }, promise: { kind: 'nav', value: '/about' }, id: 'exp_b' },
      ];
      
      const artifact1 = {
        contractVersion: '1.0.0',
        expectations: [...expectations].sort(compareExpectations),
      };
      
      const artifact2 = {
        contractVersion: '1.0.0',
        expectations: [...expectations].reverse().sort(compareExpectations),
      };
      
      const json1 = stableStringify(artifact1);
      const json2 = stableStringify(artifact2);
      
      // Byte-for-byte identical regardless of input order
      assert.strictEqual(json1, json2);
    });
  });
});
