/**
 * Findings.json Serialization Contract Test
 * 
 * Verifies that findings.json includes promise.sourceType and promise.sourceRef
 * fields for every finding, with correct nullability (sourceRef is 'file:line' for
 * code promises, null for runtime promises).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { writeFindingsJson } from '../../src/cli/util/evidence/findings-writer.js';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';

test('Findings.json Serialization - Code promise includes sourceType="code" and sourceRef="file:line"', async () => {
  const tmpDir = resolve(tmpdir(), `verax-test-findings-${getTimeProvider().now()}`);
  mkdirSync(tmpDir, { recursive: true });

  const findingsData = {
    findings: [
      {
        id: 'finding-1',
        type: 'broken_navigation_promise',
        status: 'CONFIRMED',
        severity: 'HIGH',
        confidence: 0.95,
        promise: {
          kind: 'navigation',
          value: '/about',
          sourceType: 'code',
          sourceRef: 'src/routing.js:42'
        },
        observed: { result: 'Navigation failed' },
        evidence: {},
        impact: 'User flow broken'
      }
    ],
    stats: {
      total: 1,
      silentFailures: 0,
      observed: 0,
      coverageGaps: 0,
      unproven: 0,
      informational: 0
    }
  };

  writeFindingsJson(tmpDir, findingsData);

  const findingsPath = resolve(tmpDir, 'findings.json');
  const content = JSON.parse(readFileSync(findingsPath, 'utf-8'));

  assert.equal(content.findings.length, 1, 'Should have 1 finding');
  const finding = content.findings[0];
  assert.equal(finding.promise.sourceType, 'code', 'Code promise should have sourceType="code"');
  assert.equal(finding.promise.sourceRef, 'src/routing.js:42', 'Code promise should have sourceRef="file:line"');
});

test('Findings.json Serialization - Runtime promise includes sourceType="runtime" and sourceRef=null', async () => {
  const tmpDir = resolve(tmpdir(), `verax-test-findings-${getTimeProvider().now()}`);
  mkdirSync(tmpDir, { recursive: true });

  const findingsData = {
    findings: [
      {
        id: 'finding-2',
        type: 'broken_navigation_promise',
        status: 'SUSPECTED',
        severity: 'HIGH',
        confidence: 0.85,
        promise: {
          kind: 'navigation',
          value: '/hidden-admin',
          sourceType: 'runtime',
          sourceRef: null
        },
        observed: { result: 'Runtime navigation failed' },
        evidence: {},
        impact: 'Hidden route discovered by micro-crawl not accessible'
      }
    ],
    stats: {
      total: 1,
      silentFailures: 0,
      observed: 0,
      coverageGaps: 0,
      unproven: 0,
      informational: 0
    }
  };

  writeFindingsJson(tmpDir, findingsData);

  const findingsPath = resolve(tmpDir, 'findings.json');
  const content = JSON.parse(readFileSync(findingsPath, 'utf-8'));

  assert.equal(content.findings.length, 1, 'Should have 1 finding');
  const finding = content.findings[0];
  assert.equal(finding.promise.sourceType, 'runtime', 'Runtime promise should have sourceType="runtime"');
  assert.strictEqual(finding.promise.sourceRef, null, 'Runtime promise should have sourceRef=null');
});

test('Findings.json Serialization - Multiple findings preserve sourceType/sourceRef correctly', async () => {
  const tmpDir = resolve(tmpdir(), `verax-test-findings-${getTimeProvider().now()}`);
  mkdirSync(tmpDir, { recursive: true });

  const findingsData = {
    findings: [
      {
        id: 'finding-1',
        type: 'broken_navigation_promise',
        status: 'CONFIRMED',
        severity: 'HIGH',
        confidence: 0.95,
        promise: {
          kind: 'navigation',
          value: '/home',
          sourceType: 'code',
          sourceRef: 'src/routes/home.js:10'
        },
        observed: { result: 'Home navigation failed' },
        evidence: {},
        impact: 'User cannot navigate home'
      },
      {
        id: 'finding-2',
        type: 'broken_navigation_promise',
        status: 'SUSPECTED',
        severity: 'MEDIUM',
        confidence: 0.80,
        promise: {
          kind: 'navigation',
          value: '/settings',
          sourceType: 'runtime',
          sourceRef: null
        },
        observed: { result: 'Settings navigation failed' },
        evidence: {},
        impact: 'Runtime-discovered settings route not accessible'
      },
      {
        id: 'finding-3',
        type: 'silent_submission',
        status: 'CONFIRMED',
        severity: 'HIGH',
        confidence: 0.90,
        promise: {
          kind: 'submit',
          value: 'contact form submission',
          sourceType: 'code',
          sourceRef: 'src/forms/Contact.jsx:75'
        },
        observed: { result: 'Form submission had no effect' },
        evidence: {},
        impact: 'User cannot submit contact form'
      }
    ],
    stats: {
      total: 3,
      silentFailures: 1,
      observed: 2,
      coverageGaps: 0,
      unproven: 0,
      informational: 0
    }
  };

  writeFindingsJson(tmpDir, findingsData);

  const findingsPath = resolve(tmpDir, 'findings.json');
  const content = JSON.parse(readFileSync(findingsPath, 'utf-8'));

  assert.equal(content.findings.length, 3, 'Should have 3 findings');

  // Verify finding 1 (code)
  const finding1 = content.findings.find(f => f.promise.value === '/home');
  assert.ok(finding1, 'Finding for /home should exist');
  assert.equal(finding1.promise.sourceType, 'code', 'Home finding should be code-sourced');
  assert.equal(finding1.promise.sourceRef, 'src/routes/home.js:10', 'Home finding should have file:line reference');

  // Verify finding 2 (runtime)
  const finding2 = content.findings.find(f => f.promise.value === '/settings');
  assert.ok(finding2, 'Finding for /settings should exist');
  assert.equal(finding2.promise.sourceType, 'runtime', 'Settings finding should be runtime-sourced');
  assert.strictEqual(finding2.promise.sourceRef, null, 'Settings finding should have null sourceRef');

  // Verify finding 3 (code)
  const finding3 = content.findings.find(f => f.promise.value === 'contact form submission');
  assert.ok(finding3, 'Finding for contact form should exist');
  assert.equal(finding3.promise.sourceType, 'code', 'Form finding should be code-sourced');
  assert.equal(finding3.promise.sourceRef, 'src/forms/Contact.jsx:75', 'Form finding should have file:line reference');
});

test('Findings.json Serialization - sourceType/sourceRef are preserved in deterministic order', async () => {
  const tmpDir = resolve(tmpdir(), `verax-test-findings-${getTimeProvider().now()}`);
  mkdirSync(tmpDir, { recursive: true });

  const findingsData = {
    findings: [
      {
        id: 'finding-z',
        type: 'broken_navigation_promise',
        status: 'CONFIRMED',
        severity: 'HIGH',
        confidence: 0.95,
        promise: {
          kind: 'navigation',
          value: '/zebra',
          sourceType: 'code',
          sourceRef: 'src/z.js:99'
        },
        observed: { result: 'Failed' },
        evidence: {},
        impact: 'Impact'
      },
      {
        id: 'finding-a',
        type: 'broken_navigation_promise',
        status: 'SUSPECTED',
        severity: 'HIGH',
        confidence: 0.85,
        promise: {
          kind: 'navigation',
          value: '/alpha',
          sourceType: 'runtime',
          sourceRef: null
        },
        observed: { result: 'Failed' },
        evidence: {},
        impact: 'Impact'
      }
    ],
    stats: {
      total: 2,
      silentFailures: 0,
      observed: 0,
      coverageGaps: 0,
      unproven: 0,
      informational: 0
    }
  };

  writeFindingsJson(tmpDir, findingsData);

  const findingsPath = resolve(tmpDir, 'findings.json');
  const content = JSON.parse(readFileSync(findingsPath, 'utf-8'));

  // Verify that sourceType/sourceRef are preserved after deterministic sorting
  assert.equal(content.findings.length, 2, 'Should have 2 findings');
  
  for (const finding of content.findings) {
    assert.ok('sourceType' in finding.promise, `Finding ${finding.id} should have promise.sourceType`);
    assert.ok('sourceRef' in finding.promise, `Finding ${finding.id} should have promise.sourceRef`);
    
    if (finding.promise.sourceType === 'code') {
      assert.ok(
        typeof finding.promise.sourceRef === 'string' && finding.promise.sourceRef.includes(':'),
        `Code promise should have 'file:line' format sourceRef, got: ${finding.promise.sourceRef}`
      );
    } else if (finding.promise.sourceType === 'runtime') {
      assert.strictEqual(
        finding.promise.sourceRef,
        null,
        `Runtime promise should have sourceRef=null, got: ${finding.promise.sourceRef}`
      );
    }
  }
});

test('Findings.json Serialization - Schema enforces sourceType/sourceRef for all findings', async () => {
  const tmpDir = resolve(tmpdir(), `verax-test-findings-${getTimeProvider().now()}`);
  mkdirSync(tmpDir, { recursive: true });

  // Create 10 findings with mixed sourceType to verify consistency
  const findings = [];
  for (let i = 0; i < 10; i++) {
    const isCode = i % 2 === 0;
    findings.push({
      id: `finding-${i}`,
      type: 'broken_navigation_promise',
      status: isCode ? 'CONFIRMED' : 'SUSPECTED',
      severity: 'HIGH',
      confidence: 0.80 + i * 0.01,
      promise: {
        kind: 'navigation',
        value: `/route-${i}`,
        sourceType: isCode ? 'code' : 'runtime',
        sourceRef: isCode ? `src/route${i}.js:${10 + i}` : null
      },
      observed: { result: 'Failed' },
      evidence: {},
      impact: 'Impact'
    });
  }

  const findingsData = {
    findings,
    stats: {
      total: 10,
      silentFailures: 0,
      observed: 0,
      coverageGaps: 0,
      unproven: 0,
      informational: 0
    }
  };

  writeFindingsJson(tmpDir, findingsData);

  const findingsPath = resolve(tmpDir, 'findings.json');
  const content = JSON.parse(readFileSync(findingsPath, 'utf-8'));

  assert.equal(content.findings.length, 10, 'Should have 10 findings');

  let codeCount = 0;
  let runtimeCount = 0;

  for (const finding of content.findings) {
    // Every finding must have sourceType
    assert.ok(
      ['code', 'runtime'].includes(finding.promise.sourceType),
      `sourceType must be 'code' or 'runtime', got: ${finding.promise.sourceType}`
    );

    // Every finding must have sourceRef field
    assert.ok(
      'sourceRef' in finding.promise,
      `Finding ${finding.id} must have promise.sourceRef field`
    );

    if (finding.promise.sourceType === 'code') {
      codeCount++;
      assert.ok(
        typeof finding.promise.sourceRef === 'string' && finding.promise.sourceRef.includes(':'),
        `Code promise must have 'file:line' format sourceRef`
      );
    } else {
      runtimeCount++;
      assert.strictEqual(
        finding.promise.sourceRef,
        null,
        `Runtime promise must have sourceRef=null`
      );
    }
  }

  assert.equal(codeCount, 5, 'Should have 5 code-sourced findings');
  assert.equal(runtimeCount, 5, 'Should have 5 runtime-sourced findings');
});
