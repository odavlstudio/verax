/**
 *  Tool Diagnostics Engine - Integration Tests
 * Category: runtime-discovery
 * 
 * Tests for verax diagnose command and diagnostics-engine.js
 * 
 * Contract:
 * - diagnostics.json must exist after diagnose
 * - Timing sections must be populated from summary
 * - Skip counters must match learn phase skipped counts
 * - Coverage numbers must match run artifacts
 * - Output must be deterministic (same runId => same diagnostics)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const veraxBin = resolve(__dirname, '../../bin/verax.js');

describe(' Diagnostics Engine Integration', () => {
  it('should generate diagnostics.json for a run', async () => {
    // Create a test run with minimal artifacts
    const testDir = resolve(tmpdir(), `verax-diagnose-test-${getTimeProvider().now()}`);
    const runId = 'test-run-001';
    const runDir = resolve(testDir, '.verax', 'runs', runId);
    mkdirSync(runDir, { recursive: true });
    
    // Create summary.json with timing and skip data
    const summary = {
      meta: {
        tool: 'verax',
        version: '1.0.0',
        node: 'v20.0.0',
        os: 'linux',
        timestamp: '2026-01-22T10:00:00.000Z',
        runId,
        url: 'http://localhost:3000',
        src: '.',
      },
      analysis: {
        state: 'ANALYSIS_COMPLETE',
        analysisComplete: true,
        expectationsDiscovered: 10,
        expectationsAnalyzed: 5,
        expectationsSkipped: 5,
        completenessRatio: 0.5,
        skipReasons: {
          EXTERNAL_URL_SKIPPED: 2,
          OBSERVATION_TIMEOUT: 1,
          UNSAFE_INTERACTION: 2,
        },
        skipExamples: {
          EXTERNAL_URL_SKIPPED: ['exp_001', 'exp_002'],
          OBSERVATION_TIMEOUT: ['exp_003'],
        },
        budgets: {
          maxExpectations: 100,
          exceeded: false,
          skippedCount: 0,
        },
        timeouts: {
          observeMs: 5000,
          detectMs: 1000,
          totalMs: 7500,
          timedOut: false,
          phase: null,
        },
      },
      results: {
        findingsCount: 2,
        hasFindings: true,
        HIGH: 1,
        MEDIUM: 1,
        LOW: 0,
      },
      findings: [],
    };
    writeFileSync(resolve(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
    
    // Create findings.json
    const findings = [
      {
        id: 'finding-001',
        type: 'navigation',
        expectationId: 'exp_004',
        confidence: 0.9,
      },
      {
        id: 'finding-002',
        type: 'submit',
        expectationId: 'exp_005',
        confidence: 0.6,
      },
    ];
    writeFileSync(resolve(runDir, 'findings.json'), JSON.stringify(findings, null, 2));
    
    // Create traces.json
    const traces = {
      version: 1,
      observedAt: '2026-01-22T10:00:05.000Z',
      url: 'http://localhost:3000',
      traces: [
        {
          id: 'exp_004',
          observed: true,
          selector: 'a[href="/about"]',
          evidence: {
            timing: {
              startedAt: '2026-01-22T10:00:05.100Z',
              endedAt: '2026-01-22T10:00:06.200Z',
            },
            outcomeWatcher: {
              acknowledged: false,
              latencyBucket: '>1s',
              duration: 1100,
            },
            signals: {
              delayedAcknowledgment: true,
            },
          },
        },
        {
          id: 'exp_005',
          observed: true,
          selector: 'form[action="/submit"]',
          evidence: {
            timing: {
              startedAt: '2026-01-22T10:00:06.300Z',
              endedAt: '2026-01-22T10:00:06.800Z',
            },
          },
        },
      ],
    };
    writeFileSync(resolve(runDir, 'traces.json'), JSON.stringify(traces, null, 2));
    
    // Create expectations.json with skip counters
    const expectations = {
      expectations: [],
      skipped: {
        dynamic: 3,
        params: 2,
        computed: 1,
        external: 0,
        parseError: 0,
        other: 0,
      },
    };
    writeFileSync(resolve(runDir, 'expectations.json'), JSON.stringify(expectations, null, 2));
    
    // Run diagnose command
    const cmd = `node "${veraxBin}" diagnose ${runId} --json`;
    const output = execSync(cmd, { cwd: testDir, encoding: 'utf-8' });
    const diagnostics = JSON.parse(output);
    
    // Assert diagnostics.json exists
    const diagnosticsPath = resolve(runDir, 'diagnostics.json');
    assert.ok(existsSync(diagnosticsPath), 'diagnostics.json should exist');
    
    // Assert structure
    assert.ok(diagnostics.meta, 'diagnostics.meta should exist');
    assert.ok(diagnostics.timing, 'diagnostics.timing should exist');
    assert.ok(diagnostics.skips, 'diagnostics.skips should exist');
    assert.ok(diagnostics.coverage, 'diagnostics.coverage should exist');
    assert.ok(diagnostics.signals, 'diagnostics.signals should exist');
    assert.ok(diagnostics.environment, 'diagnostics.environment should exist');
    
    // Assert meta
    assert.strictEqual(diagnostics.meta.runId, runId, 'runId should match');
    assert.strictEqual(diagnostics.meta.veraxVersion, '1.0.0', 'veraxVersion should match');
    
    // Assert timing
    assert.strictEqual(diagnostics.timing.total.durationMs, 7500, 'total duration should be 7500ms');
    assert.strictEqual(diagnostics.timing.observe.durationMs, 5000, 'observe duration should be 5000ms');
    assert.strictEqual(diagnostics.timing.detect.durationMs, 1000, 'detect duration should be 1000ms');
    assert.strictEqual(diagnostics.timing.learn.durationMs, 1500, 'learn duration should be 1500ms (total - observe - detect)');
    assert.strictEqual(diagnostics.timing.interactions.count, 2, 'interaction count should be 2');
    assert.strictEqual(diagnostics.timing.interactions.minMs, 500, 'min interaction duration should be 500ms');
    assert.strictEqual(diagnostics.timing.interactions.maxMs, 1100, 'max interaction duration should be 1100ms');
    
    // Assert skips (learn phase)
    assert.strictEqual(diagnostics.skips.learn.dynamic, 3, 'dynamic skips should be 3');
    assert.strictEqual(diagnostics.skips.learn.params, 2, 'params skips should be 2');
    assert.strictEqual(diagnostics.skips.learn.computed, 1, 'computed skips should be 1');
    
    // Assert skips (observe phase)
    assert.strictEqual(diagnostics.skips.observe.externalNavigation, 2, 'external navigation skips should be 2');
    assert.strictEqual(diagnostics.skips.observe.timeout, 1, 'timeout skips should be 1');
    assert.strictEqual(diagnostics.skips.observe.unsafeInteractions, 2, 'unsafe interaction skips should be 2');
    
    // Assert coverage
    assert.strictEqual(diagnostics.coverage.expectations.discovered, 10, 'discovered expectations should be 10');
    assert.strictEqual(diagnostics.coverage.expectations.analyzed, 5, 'analyzed expectations should be 5');
    assert.strictEqual(diagnostics.coverage.expectations.skipped, 5, 'skipped expectations should be 5');
    assert.strictEqual(diagnostics.coverage.expectations.producingObservations, 2, 'observations should be 2');
    assert.strictEqual(diagnostics.coverage.expectations.producingFindings, 2, 'findings expectations should be 2');
    assert.strictEqual(diagnostics.coverage.findings.total, 2, 'total findings should be 2');
    assert.strictEqual(diagnostics.coverage.findings.byConfidence.high, 1, 'high confidence findings should be 1');
    assert.strictEqual(diagnostics.coverage.findings.byConfidence.medium, 1, 'medium confidence findings should be 1');
    
    // Assert flakiness signals
    assert.strictEqual(diagnostics.signals.lateAcknowledgments.count, 1, 'late acknowledgments should be 1');
    assert.strictEqual(diagnostics.signals.lateAcknowledgments.examples.length, 1, 'late acknowledgment examples should be 1');
    assert.strictEqual(diagnostics.signals.lateAcknowledgments.examples[0].expectationId, 'exp_004', 'late acknowledgment expectation should be exp_004');
    
    // Assert environment
    assert.strictEqual(diagnostics.environment.url, 'http://localhost:3000', 'URL should match');
    assert.strictEqual(diagnostics.environment.nodeVersion, 'v20.0.0', 'Node version should match');
    assert.strictEqual(diagnostics.environment.os, 'linux', 'OS should match');
  });
  
  it('should produce deterministic diagnostics for same runId', async () => {
    // Create a test run
    const testDir = resolve(tmpdir(), `verax-diagnose-determinism-${getTimeProvider().now()}`);
    const runId = 'test-run-002';
    const runDir = resolve(testDir, '.verax', 'runs', runId);
    mkdirSync(runDir, { recursive: true });
    
    // Create minimal summary
    const summary = {
      meta: {
        tool: 'verax',
        version: '1.0.0',
        node: 'v20.0.0',
        os: 'linux',
        timestamp: '2026-01-22T10:00:00.000Z',
        runId,
        url: 'http://localhost:3000',
      },
      analysis: {
        state: 'ANALYSIS_COMPLETE',
        expectationsDiscovered: 5,
        expectationsAnalyzed: 3,
        expectationsSkipped: 2,
        skipReasons: {},
        budgets: {},
        timeouts: {
          observeMs: 1000,
          detectMs: 500,
          totalMs: 2000,
        },
      },
      results: {
        findingsCount: 0,
      },
    };
    writeFileSync(resolve(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
    
    // Run diagnose twice
    const cmd = `node "${veraxBin}" diagnose ${runId} --json`;
    const output1 = execSync(cmd, { cwd: testDir, encoding: 'utf-8' });
    const diagnostics1 = JSON.parse(output1);
    
    // Wait a bit to ensure timestamp would differ if not deterministic
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const output2 = execSync(cmd, { cwd: testDir, encoding: 'utf-8' });
    const diagnostics2 = JSON.parse(output2);
    
    // Normalize timestamps (generatedAt will differ)
    delete diagnostics1.meta.generatedAt;
    delete diagnostics2.meta.generatedAt;
    
    // Assert deterministic output
    assert.deepStrictEqual(diagnostics1, diagnostics2, 'diagnostics should be identical across runs');
  });
  
  it('should fail gracefully when runId does not exist', async () => {
    const testDir = resolve(tmpdir(), `verax-diagnose-missing-${getTimeProvider().now()}`);
    mkdirSync(resolve(testDir, '.verax', 'runs'), { recursive: true });
    
    const cmd = `node "${veraxBin}" diagnose nonexistent-run-id`;
    try {
      execSync(cmd, { cwd: testDir, encoding: 'utf-8', stdio: 'pipe' });
      assert.fail('should have thrown an error');
    } catch (error) {
      // Assert error contains "not found"
      assert.ok(error.stderr.includes('not found') || error.stderr.includes('DataError'), 'error should mention run not found');
      assert.strictEqual(error.status, 65, 'exit code should be 65 (DataError)');
    }
  });
  
  it('should fail gracefully when artifacts are incomplete', async () => {
    const testDir = resolve(tmpdir(), `verax-diagnose-incomplete-${getTimeProvider().now()}`);
    const runId = 'incomplete-run';
    const runDir = resolve(testDir, '.verax', 'runs', runId);
    mkdirSync(runDir, { recursive: true });
    
    // Create empty run directory (no summary.json)
    
    const cmd = `node "${veraxBin}" diagnose ${runId}`;
    try {
      execSync(cmd, { cwd: testDir, encoding: 'utf-8', stdio: 'pipe' });
      assert.fail('should have thrown an error');
    } catch (error) {
      // Assert error contains "incomplete" or "summary.json not found"
      assert.ok(
        error.stderr.includes('Incomplete') || 
        error.stderr.includes('summary.json') ||
        error.stderr.includes('DataError'),
        'error should mention incomplete run or missing summary.json'
      );
      assert.strictEqual(error.status, 65, 'exit code should be 65 (DataError)');
    }
  });
});
