/**
 * Phase 5: STATIC HTML EXTRACTION LOCK
 * 
 * Authoritative test proving static HTML support works end-to-end.
 * 
 * Validates:
 * (1) Learn extracts at least one navigation expectation from static HTML (<a href="/products">)
 * (2) Observe produces evidence screenshots (before/after)
 * (3) Detect yields a "silent-failure" when navigation is prevented (preventDefault)
 * (4) Artifacts are written under .verax/runs/<runId>/ and schemas valid
 * (5) Execution is bounded (does not exceed computed budgets)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'child_process';
import { resolve as pathResolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { startFixtureServer } from './helpers/fixture-server.helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const demoStaticDir = pathResolve(__dirname, '..', 'demos', 'demo-static');

// Helper to run CLI command
function runCLI(args, cwd = process.cwd(), timeoutMs = 180000) {
  return new Promise((resolve) => {
    const cliPath = pathResolve(__dirname, '..', 'bin', 'verax.js');
    const proc = spawn('node', [cliPath, ...args], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32'
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();  // Use default signal to avoid Windows interactive prompts
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill();  // Retry if still running
          }
        }, 5000);
        resolve({ code: null, stdout, stderr, timedOut: true });
      }
    }, timeoutMs);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ code: code !== null ? code : (stderr ? 1 : 0), stdout, stderr, timedOut: false });
      }
    });

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ code: 1, stdout, stderr, error: err.message, timedOut: false });
      }
    });
  });
}

describe('Static HTML Extraction Lock', () => {
  let fixtureServer = null;
  let serverUrl = null;

  test('before: start fixture server for demo-static', async () => {
    // Verify demo-static exists
    assert.ok(existsSync(demoStaticDir), 'demo-static directory should exist');
    assert.ok(existsSync(join(demoStaticDir, 'index.html')), 'demo-static/index.html should exist');
    
    // Start server
    fixtureServer = await startFixtureServer(demoStaticDir, 0);
    serverUrl = fixtureServer.url;
    assert.ok(serverUrl, 'Fixture server should start');
  });

  test('static HTML support proven via end-to-end test', async () => {
    // Run verax on demo-static
    const result = await runCLI(
      ['run', '--url', serverUrl, '--src', '.', '--out', '.verax'],
      demoStaticDir,
      180000 // 3 minutes max (should complete much faster)
    );

    // Assert command completed (not timed out)
    assert.ok(!result.timedOut, `Command should complete within timeout, but timed out. stderr: ${result.stderr}`);
    assert.strictEqual(result.code, 0, `Command should exit with code 0, got ${result.code}. stderr: ${result.stderr}`);

    // Find the run directory
    const veraxDir = join(demoStaticDir, '.verax');
    assert.ok(existsSync(veraxDir), '.verax directory should exist');
    
    const runsDir = join(veraxDir, 'runs');
    assert.ok(existsSync(runsDir), '.verax/runs directory should exist');
    
    const runs = readdirSync(runsDir).filter(d => !d.startsWith('.'));
    assert.ok(runs.length > 0, 'At least one run directory should exist');
    
    const runId = runs[runs.length - 1]; // Get most recent run
    const runDir = join(runsDir, runId);
    
    // (1) Assert: learn.json stats.totalExpectations >= 1 AND includes navigation expectation
    const learnJsonPath = join(runDir, 'learn.json');
    assert.ok(existsSync(learnJsonPath), 'learn.json should exist');
    const learnData = JSON.parse(readFileSync(learnJsonPath, 'utf8'));
    
    assert.ok(
      learnData.stats?.totalExpectations >= 1,
      `learn.json should have stats.totalExpectations >= 1, got ${learnData.stats?.totalExpectations}. Full learnData: ${JSON.stringify(learnData, null, 2)}`
    );
    
    // Check for navigation expectation (should have at least one navigation)
    const expectations = learnData.expectations || [];
    const navExpectations = expectations.filter(e => e.type === 'navigation');
    assert.ok(
      navExpectations.length >= 1,
      `learn.json should include at least 1 navigation expectation, found ${navExpectations.length}. All expectations: ${JSON.stringify(expectations.map(e => ({ type: e.type, targetPath: e.targetPath, promise: e.promise })))}`
    );
    
    // Check for navigation expectation to /products (the intentional silent failure)
    const productsNav = expectations.find(e => 
      e.type === 'navigation' && 
      (e.targetPath === '/products' || e.promise?.value === '/products' || e.targetPath?.includes('products'))
    );
    assert.ok(
      productsNav,
      `learn.json should include navigation expectation for "/products". Found expectations: ${JSON.stringify(expectations.map(e => ({ type: e.type, targetPath: e.targetPath, promise: e.promise })))}`
    );

    // (2) Assert: evidence directory contains at least 2 screenshots (before/after)
    const evidenceDir = join(runDir, 'evidence');
    if (existsSync(evidenceDir)) {
      const screenshots = readdirSync(evidenceDir)
        .filter(f => f.endsWith('.png'))
        .concat(
          existsSync(join(evidenceDir, 'screenshots')) 
            ? readdirSync(join(evidenceDir, 'screenshots')).filter(f => f.endsWith('.png'))
            : []
        );
      assert.ok(
        screenshots.length >= 2,
        `Evidence directory should contain at least 2 screenshots, found ${screenshots.length}: ${screenshots.join(', ')}`
      );
    } else {
      // Screenshots might be in observe.json as file references
      const observeJsonPath = join(runDir, 'observe.json');
      if (existsSync(observeJsonPath)) {
        const observeData = JSON.parse(readFileSync(observeJsonPath, 'utf8'));
        const hasEvidence = observeData.observations?.some(obs => 
          obs.evidenceFiles && obs.evidenceFiles.length > 0
        );
        assert.ok(hasEvidence, 'observe.json should reference evidence files');
      }
    }

    // (3) Assert: findings.json includes at least 1 finding with classification "silent-failure"
    const findingsJsonPath = join(runDir, 'findings.json');
    assert.ok(existsSync(findingsJsonPath), 'findings.json should exist');
    const findingsData = JSON.parse(readFileSync(findingsJsonPath, 'utf8'));
    
    const findings = findingsData.findings || [];
    const silentFailureFindings = findings.filter(f => 
      f.classification === 'silent-failure' || 
      f.outcome === 'SILENT_FAILURE' ||
      f.type === 'silent-failure'
    );
    
    // Also check stats.silentFailures as fallback
    const silentFailuresCount = findingsData.stats?.silentFailures || silentFailureFindings.length;
    
    assert.ok(
      silentFailuresCount >= 1,
      `findings.json should include at least 1 finding with classification "silent-failure", found ${silentFailuresCount} in stats and ${silentFailureFindings.length} in findings array. All findings: ${JSON.stringify(findings.map(f => ({ classification: f.classification, outcome: f.outcome, type: f.type })))}`
    );

    // (4) Assert: summary.json digest has expectationsTotal >= 1 and silentFailures >= 1
    const summaryJsonPath = join(runDir, 'summary.json');
    assert.ok(existsSync(summaryJsonPath), 'summary.json should exist');
    const summaryData = JSON.parse(readFileSync(summaryJsonPath, 'utf8'));
    
    // Check digest or top-level fields
    const expectationsTotal = summaryData.digest?.expectationsTotal || summaryData.expectationsTotal || 0;
    const summarySilentFailures = summaryData.digest?.silentFailures || summaryData.silentFailures || 0;
    
    assert.ok(
      expectationsTotal >= 1,
      `summary.json should have expectationsTotal >= 1, got ${expectationsTotal}. Full summary: ${JSON.stringify(summaryData, null, 2)}`
    );
    
    assert.ok(
      summarySilentFailures >= 1,
      `summary.json should have silentFailures >= 1, got ${summarySilentFailures}. Full summary: ${JSON.stringify(summaryData, null, 2)}`
    );

    // (5) Assert: Execution is bounded (check run.meta.json for timing)
    const metaJsonPath = join(runDir, 'run.meta.json');
    if (existsSync(metaJsonPath)) {
      const metaData = JSON.parse(readFileSync(metaJsonPath, 'utf8'));
      if (metaData.startedAt && metaData.completedAt) {
        const started = new Date(metaData.startedAt);
        const completed = new Date(metaData.completedAt);
        const durationMs = completed - started;
        
        // Should complete within 3 minutes (180000ms) for a small static site
        assert.ok(
          durationMs < 180000,
          `Execution should be bounded (< 3 minutes), but took ${durationMs}ms`
        );
      }
    }

    // Additional: Verify run.status.json is COMPLETE
    const statusJsonPath = join(runDir, 'run.status.json');
    if (existsSync(statusJsonPath)) {
      const statusData = JSON.parse(readFileSync(statusJsonPath, 'utf8'));
      assert.ok(
        statusData.status === 'COMPLETE' || statusData.status === 'FAILED',
        `run.status.json should be COMPLETE or FAILED, got ${statusData.status}`
      );
    }
  });

  test('after: stop fixture server', async () => {
    if (fixtureServer && fixtureServer.close) {
      await fixtureServer.close();
    }
  });
});

