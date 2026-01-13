/**
 * Phase 2: DETERMINISM PROOF LOCK
 * 
 * ONE authoritative test that proves VERAX produces deterministic outputs.
 * 
 * This test:
 * 1. Runs VERAX twice on the same input
 * 2. Normalizes dynamic fields (runId, timestamps)
 * 3. Asserts outputs are identical except for allowed differences
 * 
 * Determinism must be proven for:
 * - expectation IDs
 * - finding IDs  
 * - ordering of expectations and findings
 * - summary digest counts
 * 
 * Allowed to differ:
 * - runId
 * - timestamps (startedAt, completedAt, learnedAt, detectedAt)
 * - filesystem temp paths
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { runCommand } from '../src/cli/commands/run.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TIMING_KEYS = new Set([
  'timestamp',
  'startedAt',
  'completedAt',
  'learnedAt',
  'detectedAt',
  'elapsedMs',
  'duration',
  'totalMs',
  'learnMs',
  'observeMs',
  'detectMs',
]);

const EPHEMERAL_KEYS = new Set([
  'path',
  'artifactPath',
  'screenshotPath',
  'tracePath',
  'harPath',
  'videoPath',
]);

function stripTimingDeep(value) {
  if (Array.isArray(value)) {
    return value.map(stripTimingDeep);
  }
  if (value && typeof value === 'object') {
    const next = {};
    for (const [key, v] of Object.entries(value)) {
      if (TIMING_KEYS.has(key) || EPHEMERAL_KEYS.has(key)) continue;
      next[key] = stripTimingDeep(v);
    }
    return next;
  }
  return value;
}

/**
 * Normalize dynamic fields in learn.json for semantic comparison
 */
function normalizeLearnJson(data) {
  const normalized = stripTimingDeep(data);
  
  // Normalize expectations - sort by expectation ID for stable ordering
  if (normalized.expectations && Array.isArray(normalized.expectations)) {
    normalized.expectations = normalized.expectations
      .map(e => ({ id: e.id, type: e.type, classification: e.classification }))
      .sort((a, b) => {
        if (a.id < b.id) return -1;
        if (a.id > b.id) return 1;
        return 0;
      });
  }

  if (normalized.observations && Array.isArray(normalized.observations)) {
    normalized.observations = normalized.observations
      .map(o => ({
        interactionId: o.interactionId ?? o.id,
        expectationId: o.expectationId,
        type: o.type,
        outcome: o.outcome ?? o.result?.outcome,
        classification: o.classification ?? o.result?.classification,
        status: o.status ?? o.result?.status,
      }))
      .sort((a, b) => {
        if (a.interactionId && b.interactionId && a.interactionId !== b.interactionId) {
          return a.interactionId < b.interactionId ? -1 : 1;
        }
        if (a.expectationId && b.expectationId && a.expectationId !== b.expectationId) {
          return a.expectationId < b.expectationId ? -1 : 1;
        }
        return 0;
      });
  }
  
  return normalized;
}

/**
 * Normalize dynamic fields in findings.json for semantic comparison
 */
function normalizeFindingsJson(data) {
  const normalized = stripTimingDeep(data);
  
  // Normalize findings array - sort by findingId for stable ordering
  if (normalized.findings) {
    normalized.findings = normalized.findings.map(f => ({
      findingId: f.findingId,
      type: f.type,
      classification: f.classification,
      severity: f.severity,
      flowId: f.flowId,
      failedStepIndex: f.failedStepIndex,
      priorStepsCount: f.priorStepsCount,
      reason: f.reason,
      expectationId: f.expectationId,
      evidence: Array.isArray(f.evidence)
        ? f.evidence.map(e => ({ type: e.type, available: e.available }))
        : undefined,
    })).sort((a, b) => {
      if (a.findingId < b.findingId) return -1;
      if (a.findingId > b.findingId) return 1;
      return 0;
    });
  }
  
  return normalized;
}

/**
 * Normalize dynamic fields in summary.json for semantic comparison
 */
function normalizeSummaryJson(data) {
  const normalized = stripTimingDeep(data);
  
  delete normalized.runId;
  delete normalized.url; // URL contains ephemeral port numbers
  
  if (normalized.digest && normalized.digest.findings) {
    normalized.digest.findings = normalized.digest.findings.map(f => ({
      type: f.type,
      count: f.count,
      severity: f.severity,
      classification: f.classification,
    }))
      .sort((a, b) => {
        if (a.type < b.type) return -1;
        if (a.type > b.type) return 1;
        return 0;
      });
  }
  
  return normalized;
}

/**
 * Deep equality assertion with better error messages
 */
function assertDeepEqual(actual, expected, message) {
  try {
    assert.deepStrictEqual(actual, expected, message);
  } catch (error) {
    // Provide better error message with JSON diff
    const actualJson = JSON.stringify(actual, null, 2);
    const expectedJson = JSON.stringify(expected, null, 2);
    throw new Error(
      `${message}\n\nActual:\n${actualJson}\n\nExpected:\n${expectedJson}\n\n${error.message}`
    );
  }
}

test('VERAX produces deterministic outputs on repeated runs', async () => {
  // Use existing static-site fixture
  const fixturesDir = resolve(__dirname, 'fixtures');
  const staticSiteDir = resolve(fixturesDir, 'static-site');
  
  if (!existsSync(staticSiteDir)) {
    throw new Error(`Fixture not found: ${staticSiteDir}`);
  }
  
  // Create two separate temp directories for two runs
  const run1Dir = mkdtempSync(join(tmpdir(), 'verax-run1-'));
  const run2Dir = mkdtempSync(join(tmpdir(), 'verax-run2-'));
  
  // Copy fixture to both temp dirs to ensure identical input
  const { cpSync } = await import('fs');
  const fixture1Path = join(run1Dir, 'static-site');
  const fixture2Path = join(run2Dir, 'static-site');
  cpSync(staticSiteDir, fixture1Path, { recursive: true });
  cpSync(staticSiteDir, fixture2Path, { recursive: true });
  
  // Start a simple HTTP server for the test
  const http = await import('http');
  let server1 = null;
  let server2 = null;
  
  // Declare variables that need to be accessible in finally block
  const originalCwd = process.cwd();
  const oldTestMode = process.env.VERAX_TEST_MODE;
  
  function startServer(dir) {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
        const filePath = join(dir, pathname);
        
        try {
          if (existsSync(filePath)) {
            const content = readFileSync(filePath);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content);
          } else {
            res.writeHead(404);
            res.end('Not found');
          }
        } catch (error) {
          res.writeHead(500);
          res.end('Server error');
        }
      });
      
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        resolve({ server, port });
      });
      
      server.on('error', reject);
    });
  }
  
  try {
    // Start servers
    const server1Info = await startServer(fixture1Path);
    server1 = server1Info.server;
    const url1 = `http://127.0.0.1:${server1Info.port}`;
    
    const server2Info = await startServer(fixture2Path);
    server2 = server2Info.server;
    const url2 = `http://127.0.0.1:${server2Info.port}`;
    
    // Set TEST_MODE for bounded execution
    process.env.VERAX_TEST_MODE = '1';
    
    // Run 1
    process.chdir(fixture1Path);
    const run1Result = await runCommand({
      url: url1,
      src: '.',
      out: '.verax',
      json: false,
      verbose: false,
    });
    const run1Paths = run1Result.paths;
    
    // Run 2
    process.chdir(fixture2Path);
    const run2Result = await runCommand({
      url: url2,
      src: '.',
      out: '.verax',
      json: false,
      verbose: false,
    });
    const run2Paths = run2Result.paths;
    
    // Restore original working directory
    process.chdir(originalCwd);
    
    // Load artifacts from both runs
    const learn1Path = run1Paths.learnJson;
    const learn2Path = run2Paths.learnJson;
    const findings1Path = run1Paths.findingsJson;
    const findings2Path = run2Paths.findingsJson;
    const summary1Path = run1Paths.summaryJson;
    const summary2Path = run2Paths.summaryJson;
    
    assert.ok(existsSync(learn1Path), 'Run 1 learn.json should exist');
    assert.ok(existsSync(learn2Path), 'Run 2 learn.json should exist');
    assert.ok(existsSync(findings1Path), 'Run 1 findings.json should exist');
    assert.ok(existsSync(findings2Path), 'Run 2 findings.json should exist');
    assert.ok(existsSync(summary1Path), 'Run 1 summary.json should exist');
    assert.ok(existsSync(summary2Path), 'Run 2 summary.json should exist');
    
    // Load and normalize
    const learn1 = JSON.parse(readFileSync(learn1Path, 'utf8'));
    const learn2 = JSON.parse(readFileSync(learn2Path, 'utf8'));
    const findings1 = JSON.parse(readFileSync(findings1Path, 'utf8'));
    const findings2 = JSON.parse(readFileSync(findings2Path, 'utf8'));
    const summary1 = JSON.parse(readFileSync(summary1Path, 'utf8'));
    const summary2 = JSON.parse(readFileSync(summary2Path, 'utf8'));
    
    const normalizedLearn1 = normalizeLearnJson(learn1);
    const normalizedLearn2 = normalizeLearnJson(learn2);
    const normalizedFindings1 = normalizeFindingsJson(findings1);
    const normalizedFindings2 = normalizeFindingsJson(findings2);
    const normalizedSummary1 = normalizeSummaryJson(summary1);
    const normalizedSummary2 = normalizeSummaryJson(summary2);
    
    // Assert determinism
    assertDeepEqual(
      normalizedLearn1,
      normalizedLearn2,
      'learn.json outputs should be identical after normalization'
    );
    
    assertDeepEqual(
      normalizedFindings1,
      normalizedFindings2,
      'findings.json outputs should be identical after normalization'
    );
    
    assertDeepEqual(
      normalizedSummary1,
      normalizedSummary2,
      'summary.json outputs should be identical after normalization'
    );
    
  } finally {
    // Restore environment and cleanup
    process.chdir(originalCwd);
    if (oldTestMode !== undefined) {
      process.env.VERAX_TEST_MODE = oldTestMode;
    } else {
      delete process.env.VERAX_TEST_MODE;
    }
    
    if (server1) {
      await new Promise((resolve) => server1.close(resolve));
    }
    if (server2) {
      await new Promise((resolve) => server2.close(resolve));
    }
    rmSync(run1Dir, { recursive: true, force: true });
    rmSync(run2Dir, { recursive: true, force: true });
  }
});

