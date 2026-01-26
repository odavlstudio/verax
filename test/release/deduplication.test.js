/**
 * Enterprise Hardening — Deduplication Tests
 */

import test from 'node:test';
import assert from 'assert';
import {
  getDeduplicationKey,
  deduplicateFindings,
} from '../../src/verax/detect/deduplication.js';

test('Deduplication: getDeduplicationKey generates stable keys', () => {
  const finding = {
    type: 'navigation_silent_failure',
    evidence: { sourceRef: 'index.html:10:5' },
    promise: { kind: 'navigation', value: '/products' },
  };
  
  const key = getDeduplicationKey(finding);
  assert.strictEqual(key, 'navigation_silent_failure|index.html:10:5|navigation|/products');
});

test('Deduplication: identical keys for identical findings', () => {
  const finding1 = {
    type: 'submit_silent_failure',
    evidence: { sourceRef: 'form.html:20:10' },
    promise: { kind: 'submit', value: '/api/save' },
  };
  
  const finding2 = {
    type: 'submit_silent_failure',
    evidence: { sourceRef: 'form.html:20:10' },
    promise: { kind: 'submit', value: '/api/save' },
  };
  
  const key1 = getDeduplicationKey(finding1);
  const key2 = getDeduplicationKey(finding2);
  assert.strictEqual(key1, key2);
});

test('Deduplication: different keys for different types', () => {
  const finding1 = {
    type: 'navigation_silent_failure',
    evidence: { sourceRef: 'index.html:10:5' },
    promise: { kind: 'navigation', value: '/products' },
  };
  
  const finding2 = {
    type: 'submit_silent_failure',
    evidence: { sourceRef: 'index.html:10:5' },
    promise: { kind: 'navigation', value: '/products' },
  };
  
  const key1 = getDeduplicationKey(finding1);
  const key2 = getDeduplicationKey(finding2);
  assert.notStrictEqual(key1, key2);
});

test('Deduplication: no deduplication for single finding', () => {
  const findings = [
    {
      id: 'finding-1',
      type: 'navigation_silent_failure',
      evidence: { sourceRef: 'index.html:10:5' },
      promise: { kind: 'navigation', value: '/products' },
    },
  ];
  
  const result = deduplicateFindings(findings);
  assert.strictEqual(result.findings.length, 1);
  assert.strictEqual(result.deduplicatedCount, 0);
});

test('Deduplication: merges duplicate findings', () => {
  const findings = [
    {
      id: 'finding-1',
      type: 'navigation_silent_failure',
      evidence: { sourceRef: 'index.html:10:5', consoleErrors: ['Error 1'] },
      promise: { kind: 'navigation', value: '/products' },
      severity: 'HIGH',
      confidence: { score: 0.9 },
    },
    {
      id: 'finding-2',
      type: 'navigation_silent_failure',
      evidence: { sourceRef: 'index.html:10:5', consoleErrors: ['Error 2'] },
      promise: { kind: 'navigation', value: '/products' },
      severity: 'MEDIUM',
      confidence: { score: 0.7 },
    },
  ];
  
  const result = deduplicateFindings(findings);
  assert.strictEqual(result.findings.length, 1);
  assert.strictEqual(result.deduplicatedCount, 1);
  
  // Should keep highest severity
  assert.strictEqual(result.findings[0].severity, 'HIGH');
  
  // Should merge evidence
  assert.ok(Array.isArray(result.findings[0].evidence.consoleErrors));
  assert.strictEqual(result.findings[0].evidence.consoleErrors.length, 2);
});

test('Deduplication: keeps highest confidence when severity equal', () => {
  const findings = [
    {
      id: 'finding-1',
      type: 'submit_silent_failure',
      evidence: { sourceRef: 'form.html:20:10' },
      promise: { kind: 'submit', value: '/api/save' },
      severity: 'HIGH',
      confidence: { score: 0.7 },
    },
    {
      id: 'finding-2',
      type: 'submit_silent_failure',
      evidence: { sourceRef: 'form.html:20:10' },
      promise: { kind: 'submit', value: '/api/save' },
      severity: 'HIGH',
      confidence: { score: 0.9 },
    },
  ];
  
  const result = deduplicateFindings(findings);
  assert.strictEqual(result.findings.length, 1);
  assert.strictEqual(result.findings[0].confidence.score, 0.9);
});

test('Deduplication: preserves distinct findings', () => {
  const findings = [
    {
      id: 'finding-1',
      type: 'navigation_silent_failure',
      evidence: { sourceRef: 'index.html:10:5' },
      promise: { kind: 'navigation', value: '/products' },
    },
    {
      id: 'finding-2',
      type: 'navigation_silent_failure',
      evidence: { sourceRef: 'index.html:20:10' },  // Different sourceRef
      promise: { kind: 'navigation', value: '/products' },
    },
  ];
  
  const result = deduplicateFindings(findings);
  assert.strictEqual(result.findings.length, 2);
  assert.strictEqual(result.deduplicatedCount, 0);
});

test('Deduplication: handles empty array', () => {
  const result = deduplicateFindings([]);
  assert.strictEqual(result.findings.length, 0);
  assert.strictEqual(result.deduplicatedCount, 0);
});

test('Deduplication: handles null input', () => {
  const result = deduplicateFindings(null);
  assert.strictEqual(result.findings.length, 0);
  assert.strictEqual(result.deduplicatedCount, 0);
});

test('Deduplication: merges multiple findings (3+)', () => {
  const findings = [
    {
      id: 'finding-1',
      type: 'submit_silent_failure',
      evidence: { sourceRef: 'form.html:20:10' },
      promise: { kind: 'submit', value: '/api/save' },
      severity: 'MEDIUM',
    },
    {
      id: 'finding-2',
      type: 'submit_silent_failure',
      evidence: { sourceRef: 'form.html:20:10' },
      promise: { kind: 'submit', value: '/api/save' },
      severity: 'HIGH',
    },
    {
      id: 'finding-3',
      type: 'submit_silent_failure',
      evidence: { sourceRef: 'form.html:20:10' },
      promise: { kind: 'submit', value: '/api/save' },
      severity: 'LOW',
    },
  ];
  
  const result = deduplicateFindings(findings);
  assert.strictEqual(result.findings.length, 1);
  assert.strictEqual(result.deduplicatedCount, 2);
  assert.strictEqual(result.findings[0].severity, 'HIGH');
});

test('Deduplication: deterministic evidence merge', () => {
  const findings = [
    {
      id: 'finding-1',
      type: 'navigation_silent_failure',
      evidence: { 
        sourceRef: 'index.html:10:5',
        networkRequests: ['req1', 'req2'],
      },
      promise: { kind: 'navigation', value: '/products' },
    },
    {
      id: 'finding-2',
      type: 'navigation_silent_failure',
      evidence: { 
        sourceRef: 'index.html:10:5',
        networkRequests: ['req3', 'req1'],  // req1 duplicate
      },
      promise: { kind: 'navigation', value: '/products' },
    },
  ];
  
  const result = deduplicateFindings(findings);
  assert.strictEqual(result.findings.length, 1);
  
  // Should have 3 unique requests, sorted
  const requests = result.findings[0].evidence.networkRequests;
  assert.strictEqual(requests.length, 3);
  assert.ok(requests.includes('req1'));
  assert.ok(requests.includes('req2'));
  assert.ok(requests.includes('req3'));
  
  // Should be sorted
  const sorted = [...requests].sort();
  assert.deepStrictEqual(requests, sorted);
});
