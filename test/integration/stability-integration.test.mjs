#!/usr/bin/env node
/**
 * Stability Integration Tests (PHASE 5.3)
 */

import { strict as assert } from 'assert';
import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';
import { mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { generateRunStability, generateBatchStability } from '../../src/cli/util/stability/stability-engine.js';
import { DataError } from '../../src/cli/util/support/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testRoot = resolve(__dirname, '../../tmp/test-stability');

async function setupTestDir() {
  try {
    await fs.rm(testRoot, { recursive: true, force: true });
  } catch {}
  await mkdir(testRoot, { recursive: true });
}

async function createDeterministicRun(projectRoot, runId) {
  const runDir = resolve(projectRoot, '.verax', 'runs', runId);
  await mkdir(runDir, { recursive: true });
  
  const summary = {
    meta: { runId, generatedAt: new Date().toISOString() },
    analysis: {
      state: 'COMPLETE',
      timeouts: { observeMs: 100, detectMs: 50, learnMs: 100, totalMs: 250 },
      skipReasons: [],
      budgets: { learn: 200, observe: 120, detect: 100, scan: 500 }
    },
    results: { findingsCount: 3, byStatus: { CONFIRMED: 2, UNCERTAIN: 1 }, byConfidence: { HIGH: 2, MEDIUM: 1, LOW: 0 } }
  };
  
  const findings = [
    { id: 'finding-1', type: 'MISSING_LABEL', expectationId: 'exp-1', confidence: 'HIGH' },
    { id: 'finding-2', type: 'ROUTE_MISS', expectationId: 'exp-2', confidence: 'HIGH' },
    { id: 'finding-3', type: 'CONSOLE_ERROR', expectationId: 'exp-3', confidence: 'MEDIUM' }
  ];
  
  const traces = {
    version: '1.0',
    observedAt: new Date().toISOString(),
    url: 'https://example.com',
    traces: [
      { id: 'trace-1', observed: true, selector: '.button', evidence: { timing: { durationMs: 45 }, outcomeWatcher: { signalReceived: 45 }, signals: { routeChanged: 1, outcomeAcknowledged: 1, meaningfulUIChange: 0, delayedAcknowledgment: 0, consoleErrors: 0, networkActivity: 0 } } },
      { id: 'trace-2', observed: true, selector: '.menu', evidence: { timing: { durationMs: 55 }, outcomeWatcher: { signalReceived: 52 }, signals: { routeChanged: 0, outcomeAcknowledged: 1, meaningfulUIChange: 1, delayedAcknowledgment: 0, consoleErrors: 0, networkActivity: 0 } } },
      { id: 'trace-3', observed: true, selector: '.input', evidence: { timing: { durationMs: 50 }, outcomeWatcher: { signalReceived: 49 }, signals: { routeChanged: 0, outcomeAcknowledged: 0, meaningfulUIChange: 0, delayedAcknowledgment: 0, consoleErrors: 1, networkActivity: 0 } } }
    ]
  };
  
  const expectations = {
    expectations: [
      { id: 'exp-1', name: 'Label test' },
      { id: 'exp-2', name: 'Route test' },
      { id: 'exp-3', name: 'Console test' }
    ],
    skipped: { dynamic: 0, params: 0, computed: 0, external: 0, parseError: 0, other: 0 }
  };
  
  await fs.writeFile(resolve(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
  await fs.writeFile(resolve(runDir, 'findings.json'), JSON.stringify(findings, null, 2));
  await fs.writeFile(resolve(runDir, 'traces.json'), JSON.stringify(traces, null, 2));
  await fs.writeFile(resolve(runDir, 'expectations.json'), JSON.stringify(expectations, null, 2));
  return runId;
}

async function createNondeterministicRun(projectRoot, runId, variantNum = 0) {
  const runDir = resolve(projectRoot, '.verax', 'runs', runId);
  await mkdir(runDir, { recursive: true });
  
  const summary = {
    meta: { runId, generatedAt: new Date().toISOString() },
    analysis: {
      state: 'COMPLETE',
      timeouts: { observeMs: 100 + (variantNum * 20), detectMs: 50 + (variantNum * 10), learnMs: 100, totalMs: 250 + (variantNum * 30) },
      skipReasons: [],
      budgets: { learn: 200, observe: 120, detect: 100, scan: 500 }
    },
    results: { findingsCount: 3 + variantNum, byStatus: variantNum === 0 ? { CONFIRMED: 2, UNCERTAIN: 1 } : { CONFIRMED: 3, UNCERTAIN: 1 }, byConfidence: variantNum === 0 ? { HIGH: 2, MEDIUM: 1, LOW: 0 } : { HIGH: 3, MEDIUM: 1, LOW: 0 } }
  };
  
  const baseFindings = [
    { id: 'finding-1', type: 'MISSING_LABEL', expectationId: 'exp-1', confidence: 'HIGH' },
    { id: 'finding-2', type: 'ROUTE_MISS', expectationId: 'exp-2', confidence: 'HIGH' },
    { id: 'finding-3', type: 'CONSOLE_ERROR', expectationId: 'exp-3', confidence: 'MEDIUM' }
  ];
  if (variantNum > 0) {
    baseFindings.push({ id: `finding-${3 + variantNum}`, type: 'TIMING_ANOMALY', expectationId: `exp-${3 + variantNum}`, confidence: 'HIGH' });
  }
  
  const traces = {
    version: '1.0',
    observedAt: new Date().toISOString(),
    url: 'https://example.com',
    traces: [
      { id: 'trace-1', observed: true, selector: '.button', evidence: { timing: { durationMs: 45 + (variantNum * 15) }, outcomeWatcher: { signalReceived: 45 }, signals: { routeChanged: 1, outcomeAcknowledged: 1, meaningfulUIChange: 0, delayedAcknowledgment: 0, consoleErrors: 0, networkActivity: 0 } } },
      { id: 'trace-2', observed: true, selector: '.menu', evidence: { timing: { durationMs: 55 + (variantNum * 10) }, outcomeWatcher: { signalReceived: 52 }, signals: { routeChanged: 0, outcomeAcknowledged: 1, meaningfulUIChange: 1, delayedAcknowledgment: 0, consoleErrors: 0, networkActivity: 0 } } },
      { id: 'trace-3', observed: true, selector: '.input', evidence: { timing: { durationMs: 50 + (variantNum * 8) }, outcomeWatcher: { signalReceived: 49 }, signals: { routeChanged: 0, outcomeAcknowledged: 0, meaningfulUIChange: 0, delayedAcknowledgment: 0, consoleErrors: 1, networkActivity: 0 } } }
    ]
  };
  
  const expectations = {
    expectations: [
      { id: 'exp-1', name: 'Label test' },
      { id: 'exp-2', name: 'Route test' },
      { id: 'exp-3', name: 'Console test' },
      ...(variantNum > 0 ? [{ id: `exp-${3 + variantNum}`, name: `Timing test ${variantNum}` }] : [])
    ],
    skipped: { dynamic: 0, params: 0, computed: 0, external: 0, parseError: 0, other: 0 }
  };
  
  await fs.writeFile(resolve(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
  await fs.writeFile(resolve(runDir, 'findings.json'), JSON.stringify(baseFindings, null, 2));
  await fs.writeFile(resolve(runDir, 'traces.json'), JSON.stringify(traces, null, 2));
  await fs.writeFile(resolve(runDir, 'expectations.json'), JSON.stringify(expectations, null, 2));
  return runId;
}

async function testDeterminism() {
  const projectRoot = resolve(testRoot, 'test-determinism');
  await setupTestDir();
  
  const runId = '1000-test-deterministic';
  await createDeterministicRun(projectRoot, runId);
  
  const stability1 = generateRunStability(projectRoot, runId);
  const stability2 = generateRunStability(projectRoot, runId);
  
  const s1 = JSON.parse(JSON.stringify(stability1));
  const s2 = JSON.parse(JSON.stringify(stability2));
  delete s1.meta.generatedAt;
  delete s2.meta.generatedAt;
  
  assert.deepStrictEqual(s1, s2, 'Stability metrics should be identical on repeated calls');
  console.log('✓ Test 1: Determinism passed');
}

async function testStableClassification() {
  const projectRoot = resolve(testRoot, 'test-stable');
  await setupTestDir();
  
  const run1 = '1001-stable-1';
  const run2 = '1002-stable-2';
  const run3 = '1003-stable-3';
  
  await createDeterministicRun(projectRoot, run1);
  await createDeterministicRun(projectRoot, run2);
  await createDeterministicRun(projectRoot, run3);
  
  const stability1 = generateRunStability(projectRoot, run1);
  const stability2 = generateRunStability(projectRoot, run2);
  const stability3 = generateRunStability(projectRoot, run3);
  
  // Check tool health state
  assert.strictEqual(stability1.toolHealth.state, 'COMPLETE', 'Run 1 should be complete');
  assert.strictEqual(stability2.toolHealth.state, 'COMPLETE', 'Run 2 should be complete');
  assert.strictEqual(stability3.toolHealth.state, 'COMPLETE', 'Run 3 should be complete');
  
  // Findings should have same signature
  assert.strictEqual(stability1.findings.signatureHash, stability2.findings.signatureHash, 'Findings signatures should match');
  assert.strictEqual(stability2.findings.signatureHash, stability3.findings.signatureHash, 'All findings signatures should match');
  
  // Generate batch stability
  const batchStability = generateBatchStability(projectRoot, [run1, run2, run3]);
  
  // Should be classified as STABLE
  assert.strictEqual(batchStability.overall.classification, 'STABLE', 'Batch should be STABLE');
  assert.strictEqual(batchStability.findings.findingsDiffer, false, 'Findings should not differ');
  console.log('✓ Test 2: STABLE classification passed');
}

async function testUnstableClassification() {
  const projectRoot = resolve(testRoot, 'test-unstable');
  await setupTestDir();
  
  const run1 = '1004-unstable-1';
  const run2 = '1005-unstable-2';
  const run3 = '1006-unstable-3';
  
  await createNondeterministicRun(projectRoot, run1, 0);
  await createNondeterministicRun(projectRoot, run2, 1);
  await createNondeterministicRun(projectRoot, run3, 2);
  
  const stability1 = generateRunStability(projectRoot, run1);
  const stability2 = generateRunStability(projectRoot, run2);
  
  // Findings should differ
  assert.notStrictEqual(stability1.findings.signatureHash, stability2.findings.signatureHash, 'Findings should differ');
  
  // Generate batch stability
  const batchStability = generateBatchStability(projectRoot, [run1, run2, run3]);
  
  // Should be classified as UNSTABLE
  assert.strictEqual(batchStability.overall.classification, 'UNSTABLE', 'Batch should be UNSTABLE');
  assert.strictEqual(batchStability.findings.findingsDiffer, true, 'Findings should differ');
  console.log('✓ Test 3: UNSTABLE classification passed');
}

async function testErrorHandling() {
  const projectRoot = resolve(testRoot, 'test-errors');
  await setupTestDir();
  
  let error;
  try {
    generateRunStability(projectRoot, '9999-nonexistent');
  } catch (e) {
    error = e;
  }
  
  assert(error instanceof DataError, 'Should throw DataError for missing run');
  assert(error.message.includes('Run directory not found'), 'Error should mention missing directory');
  
  const incompleteRun = '1007-incomplete';
  const runDir = resolve(projectRoot, '.verax', 'runs', incompleteRun);
  await mkdir(runDir, { recursive: true });
  await fs.writeFile(resolve(runDir, 'findings.json'), JSON.stringify([]));
  
  let incompleteError;
  try {
    generateRunStability(projectRoot, incompleteRun);
  } catch (e) {
    incompleteError = e;
  }
  
  assert(incompleteError instanceof DataError, 'Should throw DataError for incomplete run');
  assert(incompleteError.message.includes('summary.json not found'), 'Error should mention summary.json');
  console.log('✓ Test 4: Error handling passed');
}

async function runAllTests() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  STABILITY INTEGRATION TESTS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  try {
    await testDeterminism();
    await testStableClassification();
    await testUnstableClassification();
    await testErrorHandling();
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  ✅ All stability tests passed');
    console.log('═══════════════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(2);
});
