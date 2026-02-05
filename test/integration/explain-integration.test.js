/**
 *  Finding Debugger / Explainability - Integration Tests
 * Category: runtime-discovery
 * 
 * Tests for verax explain command and explain-engine.js
 * 
 * Contract:
 * - explain/<findingId>.json must exist after explain
 * - Triggers must include evaluated boolean conditions
 * - Evidence must reference at least one existing artifact path
 * - Output must be deterministic (same runId+findingId => same explanation)
 * - Error handling: exit 64 for missing runId or findingId
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const veraxBin = resolve(__dirname, '../../bin/verax.js');

describe(' Finding Explainability', () => {
  it('should generate explanation for a finding', async () => {
    // Create a test run with minimal artifacts
    const testDir = resolve(tmpdir(), `verax-explain-test-${getTimeProvider().now()}`);
    const runId = 'test-run-explain-001';
    const runDir = resolve(testDir, '.verax', 'runs', runId);
    mkdirSync(runDir, { recursive: true });
    
    // Create summary.json
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
        expectationsDiscovered: 5,
        expectationsAnalyzed: 3,
        expectationsSkipped: 2,
        skipReasons: {
          EXTERNAL_URL_SKIPPED: 2,
        },
        budgets: {
          maxExpectations: 100,
          exceeded: false,
        },
        timeouts: {
          observeMs: 5000,
          detectMs: 1000,
          totalMs: 7500,
          timedOut: false,
        },
      },
      results: {
        findingsCount: 1,
        hasFindings: true,
      },
    };
    writeFileSync(resolve(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
    
    // Create findings.json with a broken_navigation_promise finding
    const findings = [
      {
        id: 'finding-nav-001',
        type: 'broken_navigation_promise',
        status: 'SUSPECTED',
        severity: 'HIGH',
        confidence: 0.75,
        expectationId: 'exp_001',
        interaction: {
          type: 'click',
          selector: 'a[href="/about"]',
          label: 'About link',
        },
        evidence: {
          attempted: true,
          navigationChanged: false,
          routeChanged: false,
          outcomeAcknowledged: false,
          meaningfulUIChange: false,
          feedbackAppeared: false,
          beforeUrl: 'http://localhost:3000/',
          afterUrl: 'http://localhost:3000/',
          expectedTarget: '/about',
          beforeScreenshot: 'evidence/before-nav-001.png',
          afterScreenshot: 'evidence/after-nav-001.png',
          outcomeWatcher: {
            acknowledged: false,
            latencyBucket: '>1s',
            duration: 1500,
          },
        },
        enrichment: {
          selector: 'a[href="/about"]',
          confidenceExplanation: 'Navigation attempted but URL did not change; no feedback provided',
        },
      },
    ];
    writeFileSync(resolve(runDir, 'findings.json'), JSON.stringify(findings, null, 2));
    
    // Create traces.json
    const traces = [
      {
        interaction: {
          type: 'click',
          selector: 'a[href="/about"]',
          label: 'About link',
        },
        before: {
          url: 'http://localhost:3000/',
          title: 'Home',
        },
        after: {
          url: 'http://localhost:3000/',
          title: 'Home',
        },
        sensors: {
          navigation: {
            urlChanged: false,
            beforeUrl: 'http://localhost:3000/',
            afterUrl: 'http://localhost:3000/',
            historyLengthDelta: 0,
          },
          dom: {
            changed: false,
          },
          uiFeedback: {
            overallUiFeedbackScore: 0,
          },
          uiSignals: {
            diff: {
              changed: false,
            },
          },
          network: {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
          },
        },
      },
    ];
    writeFileSync(resolve(runDir, 'traces.json'), JSON.stringify(traces, null, 2));
    
    // Create evidence directory with screenshot placeholders
    const evidenceDir = resolve(runDir, 'evidence');
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(resolve(evidenceDir, 'before-nav-001.png'), 'fake-png-data');
    writeFileSync(resolve(evidenceDir, 'after-nav-001.png'), 'fake-png-data');
    
    // Run explain command
    const cmd = `node "${veraxBin}" explain ${runId} finding-nav-001`;
    const output = execSync(cmd, { cwd: testDir, encoding: 'utf-8' });
    
    // Assert explanation.json exists
    const explainPath = resolve(runDir, 'explain', 'finding-nav-001.json');
    assert.strictEqual(existsSync(explainPath), true, `explain.json should exist at ${explainPath}`);
    
    // Load and validate explanation JSON
    const explanation = JSON.parse(readFileSync(explainPath, 'utf-8'));
    
    // Validate structure
    assert.strictEqual(explanation.meta.findingId, 'finding-nav-001');
    assert.strictEqual(explanation.meta.runId, runId);
    assert(explanation.meta.generatedAt, 'generatedAt should be present');
    
    // Validate finding identity
    assert.strictEqual(explanation.finding.type, 'broken_navigation_promise');
    assert.strictEqual(explanation.finding.confidence, 0.75);
    assert.strictEqual(explanation.finding.selector, 'a[href="/about"]');
    
    // Validate trigger conditions exist and are evaluated
    assert(Array.isArray(explanation.triggers.conditions), 'triggers.conditions should be array');
    assert(explanation.triggers.conditions.length > 0, 'should have trigger conditions');
    
    // Check specific trigger conditions
    const triggerNames = explanation.triggers.conditions.map(c => c.name);
    assert(triggerNames.includes('navigationAttempted'), 'should have navigationAttempted trigger');
    assert(triggerNames.includes('urlChanged'), 'should have urlChanged trigger');
    
    // Validate each condition has name, value, source
    for (const cond of explanation.triggers.conditions) {
      assert(cond.name, 'condition should have name');
      assert(typeof cond.value === 'boolean', 'condition.value should be boolean');
      assert.strictEqual(cond.source, 'evidence', 'condition.source should be "evidence"');
    }
    
    // Validate evidence map
    assert(Array.isArray(explanation.evidence.used), 'evidence.used should be array');
    assert(explanation.evidence.used.length > 0, 'should have used evidence');
    
    // Check for evidence types
    const usedTypes = explanation.evidence.used.map(e => e.type);
    assert(usedTypes.includes('urlBefore') || usedTypes.includes('urlAfter'), 'should reference URLs');
    
    // Validate confidence breakdown
    assert(typeof explanation.confidence.final === 'number', 'confidence.final should be number');
    assert.strictEqual(explanation.confidence.final, 0.75);
    assert(explanation.confidence.level, 'confidence.level should exist');
    
    // Validate guidance
    assert(Array.isArray(explanation.guidance.nextChecks), 'guidance.nextChecks should be array');
    assert(explanation.guidance.nextChecks.length > 0, 'should have next checks');
    assert(explanation.guidance.reproduce.runId, 'reproduce.runId should exist');
    
    // Validate console output contains key sections
    assert(output.includes('FINDING EXPLANATION'), 'console should show finding explanation header');
    assert(output.includes('TRIGGER CONDITIONS'), 'console should show trigger conditions');
    assert(output.includes('EVIDENCE'), 'console should show evidence');
    assert(output.includes('CONFIDENCE BREAKDOWN'), 'console should show confidence breakdown');
    assert(output.includes('NEXT STEPS'), 'console should show next steps');
  });
  
  it('should produce deterministic output', async () => {
    // Create a test run
    const testDir = resolve(tmpdir(), `verax-explain-determ-${getTimeProvider().now()}`);
    const runId = 'test-run-determ-001';
    const runDir = resolve(testDir, '.verax', 'runs', runId);
    mkdirSync(runDir, { recursive: true });
    
    // Create minimal artifacts
    const summary = {
      meta: {
        tool: 'verax',
        version: '1.0.0',
        runId,
        url: 'http://localhost:3000',
      },
      analysis: { state: 'ANALYSIS_COMPLETE' },
    };
    writeFileSync(resolve(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
    
    const findings = [
      {
        id: 'finding-determ-001',
        type: 'silent_submission',
        status: 'SUSPECTED',
        confidence: 0.65,
        interaction: { type: 'click', selector: 'button[type="submit"]' },
        evidence: { attempted: true, feedbackAppeared: false },
      },
    ];
    writeFileSync(resolve(runDir, 'findings.json'), JSON.stringify(findings, null, 2));
    
    // Call explain twice
    const cmd = `node "${veraxBin}" explain ${runId} finding-determ-001 --json`;
    const output1 = execSync(cmd, { cwd: testDir, encoding: 'utf-8' });
    const output2 = execSync(cmd, { cwd: testDir, encoding: 'utf-8' });
    
    // Parse JSON and remove timestamps for comparison
    const explain1 = JSON.parse(output1);
    const explain2 = JSON.parse(output2);
    
    delete explain1.meta.generatedAt;
    delete explain2.meta.generatedAt;
    
    // Should be identical after removing timestamps
    assert.deepStrictEqual(explain1, explain2, 'determinism: two calls should produce identical output (except generatedAt)');
  });
  
  it('should error on unknown findingId', async () => {
    const testDir = resolve(tmpdir(), `verax-explain-err1-${getTimeProvider().now()}`);
    const runId = 'test-run-err1-001';
    const runDir = resolve(testDir, '.verax', 'runs', runId);
    mkdirSync(runDir, { recursive: true });
    
    // Create minimal artifacts without the finding
    const summary = {
      meta: {
        tool: 'verax',
        version: '1.0.0',
        runId,
        url: 'http://localhost:3000',
      },
    };
    writeFileSync(resolve(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
    
    const findings = [];
    writeFileSync(resolve(runDir, 'findings.json'), JSON.stringify(findings, null, 2));
    
    // Try to explain non-existent finding
    const cmd = `node "${veraxBin}" explain ${runId} nonexistent-finding-id`;
    
    let exitCode = 0;
    try {
      execSync(cmd, { cwd: testDir, encoding: 'utf-8' });
    } catch (e) {
      exitCode = e.status;
    }
    
    assert.strictEqual(exitCode, 65, 'should exit with code 65 for unknown findingId');
  });
  
  it('should error on missing runId folder', async () => {
    const testDir = resolve(tmpdir(), `verax-explain-err2-${getTimeProvider().now()}`);
    const runId = 'nonexistent-run-id';
    
    const cmd = `node "${veraxBin}" explain ${runId} any-finding-id`;
    
    let exitCode = 0;
    try {
      execSync(cmd, { cwd: testDir, encoding: 'utf-8' });
    } catch (e) {
      exitCode = e.status;
    }
    
    assert.strictEqual(exitCode, 65, 'should exit with code 65 for missing runId');
  });
  
  it('should output JSON-only with --json flag', async () => {
    const testDir = resolve(tmpdir(), `verax-explain-json-${getTimeProvider().now()}`);
    const runId = 'test-run-json-001';
    const runDir = resolve(testDir, '.verax', 'runs', runId);
    mkdirSync(runDir, { recursive: true });
    
    // Create artifacts
    const summary = {
      meta: {
        tool: 'verax',
        version: '1.0.0',
        runId,
        url: 'http://localhost:3000',
      },
    };
    writeFileSync(resolve(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
    
    const findings = [
      {
        id: 'finding-json-001',
        type: 'silent_failure',
        status: 'SUSPECTED',
        confidence: 0.5,
        interaction: { type: 'click' },
        evidence: {},
      },
    ];
    writeFileSync(resolve(runDir, 'findings.json'), JSON.stringify(findings, null, 2));
    
    // Run with --json
    const cmd = `node "${veraxBin}" explain ${runId} finding-json-001 --json`;
    const output = execSync(cmd, { cwd: testDir, encoding: 'utf-8' });
    
    // Parse as JSON (should not throw)
    const explanation = JSON.parse(output);
    assert(explanation.meta, 'JSON output should have meta');
    
    // Should NOT have console formatting
    assert(!output.includes('FINDING EXPLANATION'), '--json should not include console formatting');
    assert(!output.includes('═'), '--json should not include decorative chars');
  });
});
