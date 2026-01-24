#!/usr/bin/env node
/**
 * CONTRACT B — DETERMINISTIC IDs CONTRACT
 * 
 * Validates that:
 * 1. Run IDs are deterministic (same URL + config → same run ID)
 * 2. Expectation IDs are deterministic (same source location + content → same ID)
 * 3. Finding IDs are deterministic (derived from expectation IDs)
 */

import { describe, test } from 'node:test';
import assert from 'node:assert';
import { generateRunId } from '../../src/verax/core/run-id.js';
import { expectationIdFromLocation, findingIdFromExpectationId } from '../../src/cli/util/support/idgen.js';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';


describe('Deterministic IDs Contract', () => {
  test('Run ID is stable for identical inputs', () => {
    const params1 = {
      url: 'https://example.com',
      safetyFlags: { allowCrossOrigin: false, allowRiskyActions: false },
      baseOrigin: 'https://example.com',
      scanBudget: { maxExpectations: 100 },
      manifestPath: '/path/to/manifest.json',
      veraxVersion: '0.4.2'
    };
    
    const params2 = {
      url: 'https://example.com',
      safetyFlags: { allowCrossOrigin: false, allowRiskyActions: false },
      baseOrigin: 'https://example.com',
      scanBudget: { maxExpectations: 100 },
      manifestPath: '/path/to/manifest.json',
      veraxVersion: '0.4.2'
    };
    
    const id1 = generateRunId(params1);
    const id2 = generateRunId(params2);
    
    assert.strictEqual(id1, id2, 'Identical inputs must produce identical run IDs');
    assert.strictEqual(typeof id1, 'string', 'Run ID must be string');
    assert.strictEqual(id1.length, 16, 'Run ID must be 16 characters');
    assert.match(id1, /^[a-f0-9]{16}$/, 'Run ID must be 16 hex characters');
  });
  
  test('Run ID changes when URL changes', () => {
    const params1 = {
      url: 'https://example.com',
      safetyFlags: { allowCrossOrigin: false, allowRiskyActions: false },
      baseOrigin: 'https://example.com',
      scanBudget: { maxExpectations: 100 },
      manifestPath: '/path/to/manifest.json',
      veraxVersion: '0.4.2'
    };
    
    const params2 = {
      url: 'https://different.com',
      safetyFlags: { allowCrossOrigin: false, allowRiskyActions: false },
      baseOrigin: 'https://different.com',
      scanBudget: { maxExpectations: 100 },
      manifestPath: '/path/to/manifest.json',
      veraxVersion: '0.4.2'
    };
    
    const id1 = generateRunId(params1);
    const id2 = generateRunId(params2);
    
    assert.notStrictEqual(id1, id2, 'Different URLs must produce different run IDs');
  });
  
  test('Expectation ID is stable for identical location and content', () => {
    const location1 = {
      file: 'src/components/Button.jsx',
      line: 42,
      column: 10,
      kind: 'navigate',
      value: '/home'
    };
    
    const location2 = {
      file: 'src/components/Button.jsx',
      line: 42,
      column: 10,
      kind: 'navigate',
      value: '/home'
    };
    
    const id1 = expectationIdFromLocation(location1);
    const id2 = expectationIdFromLocation(location2);
    
    assert.strictEqual(id1, id2, 'Identical location+content must produce identical expectation IDs');
    assert.match(id1, /^exp_[a-f0-9]+$/, 'Expectation ID must match pattern exp_<hash>');
  });
  
  test('Expectation ID changes when location changes', () => {
    const location1 = {
      file: 'src/components/Button.jsx',
      line: 42,
      column: 10,
      kind: 'navigate',
      value: '/home'
    };
    
    const location2 = {
      file: 'src/components/Button.jsx',
      line: 43,
      column: 10,
      kind: 'navigate',
      value: '/home'
    };
    
    const id1 = expectationIdFromLocation(location1);
    const id2 = expectationIdFromLocation(location2);
    
    assert.notStrictEqual(id1, id2, 'Different locations must produce different expectation IDs');
  });
  
  test('Expectation ID changes when content changes', () => {
    const location1 = {
      file: 'src/components/Button.jsx',
      line: 42,
      column: 10,
      kind: 'navigate',
      value: '/home'
    };
    
    const location2 = {
      file: 'src/components/Button.jsx',
      line: 42,
      column: 10,
      kind: 'navigate',
      value: '/about'
    };
    
    const id1 = expectationIdFromLocation(location1);
    const id2 = expectationIdFromLocation(location2);
    
    assert.notStrictEqual(id1, id2, 'Different values must produce different expectation IDs');
  });
  
  test('Finding ID is deterministically derived from expectation ID', () => {
    const expId = 'exp_abc123';
    const findingId1 = findingIdFromExpectationId(expId);
    const findingId2 = findingIdFromExpectationId(expId);
    
    assert.strictEqual(findingId1, findingId2, 'Same expectation ID must produce same finding ID');
    assert.ok(findingId1.startsWith('finding_'), 'Finding ID must start with "finding_"');
    assert.ok(findingId1.includes('abc123'), 'Finding ID must include expectation hash');
  });
  
  test('Finding IDs are unique per expectation ID', () => {
    const expId1 = 'exp_abc123';
    const expId2 = 'exp_def456';
    
    const findingId1 = findingIdFromExpectationId(expId1);
    const findingId2 = findingIdFromExpectationId(expId2);
    
    assert.notStrictEqual(findingId1, findingId2, 'Different expectation IDs must produce different finding IDs');
  });
  
  test('Run ID does not contain timestamps', () => {
    const params = {
      url: 'https://example.com',
      safetyFlags: { allowCrossOrigin: false, allowRiskyActions: false },
      baseOrigin: 'https://example.com',
      scanBudget: { maxExpectations: 100 },
      manifestPath: '/path/to/manifest.json',
      veraxVersion: '0.4.2'
    };
    
    // Generate IDs at different times
    const id1 = generateRunId(params);
    
    // Wait a bit
    const start = getTimeProvider().now();
    while (getTimeProvider().now() - start < 100) {
      // Busy wait
    }
    
    const id2 = generateRunId(params);
    
    assert.strictEqual(id1, id2, 'Run ID must not include timestamp (must be stable across time)');
  });
});
