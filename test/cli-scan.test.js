/**
 * End-to-end CLI test for verax scan command
 * 
 * Tests:
 * - CLI scan command executes successfully
 * - Exit codes are correct
 * - Artifacts are created in .verax/runs/<runId>/
 * - Findings JSON exists and is valid
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'child_process';
import { resolve as pathResolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = pathResolve(__dirname, 'fixtures');
const staticSiteDir = pathResolve(fixturesDir, 'static-site');

// Helper to run CLI command
function runCLI(args, cwd = process.cwd(), timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const cliPath = pathResolve(__dirname, '..', 'bin', 'verax.js');
    const proc = spawn('node', [cliPath, ...args], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: { ...process.env, VERAX_TEST_MODE: '1' }  // Enable test mode budgets
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`CLI timeout after ${timeoutMs}ms; stdout: ${stdout}; stderr: ${stderr}`));
    }, timeoutMs);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code !== null ? code : (stderr ? 1 : 0), stdout, stderr });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// Helper to start test server
function startTestServer(requestedPort, dir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const address = server.address();
      const activePort = typeof address === 'object' && address ? address.port : requestedPort;
      const url = new URL(req.url, `http://localhost:${activePort}`);
      let filePath = join(dir, url.pathname === '/' ? 'index.html' : url.pathname);
      
      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });

    server.listen(requestedPort, '127.0.0.1', (err) => {
      if (err) reject(err);
      else {
        const addr = server.address();
        const activePort = typeof addr === 'object' && addr ? addr.port : requestedPort;
        resolve({ server, port: activePort });
      }
    });
  });
}

describe('CLI run command', () => {
  let testServer;
  let testPort;
  let testUrl;

  test.before(async () => {
    const result = await startTestServer(0, staticSiteDir);
    testServer = result.server;
    testPort = result.port;
    testUrl = `http://localhost:${testPort}`;
  });

  test.after(async () => {
    if (testServer) {
      await new Promise((resolve) => {
        testServer.close(resolve);
      });
    }
  });

  test('run command executes successfully with valid URL', async () => {
    const result = await runCLI(['run', '--url', testUrl, '--src', staticSiteDir], staticSiteDir);

    // Should exit with code 0 (no HIGH findings expected for static site)
    assert.ok(result.code === 0 || result.code === 1, `Expected exit code 0 or 1, got ${result.code}. stderr: ${result.stderr}`);
    
    // Check that artifacts directory was created
    const veraxDir = pathResolve(staticSiteDir, '.verax');
    assert.ok(existsSync(veraxDir), '`.verax` directory should exist');

    const runsDir = pathResolve(veraxDir, 'runs');
    assert.ok(existsSync(runsDir), '`.verax/runs` directory should exist');

    // Find latest run
    const runs = readdirSync(runsDir)
      .map(name => ({ name, time: statSync(pathResolve(runsDir, name)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    assert.ok(runs.length > 0, 'At least one run directory should exist');

    const latestRun = runs[0];
    const runDir = pathResolve(runsDir, latestRun.name);

    // Check that required artifacts exist
    const summaryPath = pathResolve(runDir, 'summary.json');
    const findingsPath = pathResolve(runDir, 'findings.json');
    const tracesPath = pathResolve(runDir, 'traces.jsonl');

    assert.ok(existsSync(summaryPath), 'summary.json should exist');
    assert.ok(existsSync(findingsPath), 'findings.json should exist');
    assert.ok(existsSync(tracesPath) || existsSync(pathResolve(runDir, 'evidence', 'observation-traces.json')), 
      'traces.jsonl or observation-traces.json should exist');

    // Validate summary.json structure
    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
    assert.ok(summary.runId, 'summary should have runId');
    assert.ok(summary.url === testUrl, 'summary should have correct URL');
    assert.ok(typeof summary.metrics === 'object', 'summary should have metrics');
    assert.ok(typeof summary.findingsCounts === 'object', 'summary should have findingsCounts');

    // Validate findings.json structure
    const findings = JSON.parse(readFileSync(findingsPath, 'utf-8'));
    assert.ok(Array.isArray(findings.findings), 'findings should be an array');
    assert.ok(typeof findings.total === 'number', 'findings should have total count');
  });

  test('run command with --json outputs valid JSON', async () => {
    const result = await runCLI(['run', '--url', testUrl, '--src', staticSiteDir, '--json'], staticSiteDir);

    // Should have JSON output (JSONL format - one JSON per line)
    assert.ok(result.stdout.includes('{'), 'Should output JSON');
    
    try {
      // Parse the last JSON line (should be run:complete event)
      const lines = result.stdout.trim().split('\n').filter(l => l.trim());
      const lastLine = lines[lines.length - 1];
      const output = JSON.parse(lastLine);
      
      // Check for run:complete event
      assert.ok(output.type === 'run:complete' || output.runId, 'JSON output should have type or runId');
      assert.ok(output.runId, 'JSON output should have runId');
      assert.ok(output.url === testUrl, 'JSON output should have URL');
      assert.ok(typeof output.findingsCounts === 'object', 'JSON output should have findingsCounts');
    } catch (e) {
      assert.fail(`Failed to parse JSON output: ${e.message}. Output: ${result.stdout}`);
    }
  });

  test('run command fails with missing URL', async () => {
    const result = await runCLI(['run'], staticSiteDir);
    
    // Should exit with error code
    assert.ok(result.code !== 0, 'Should exit with non-zero code when URL is missing');
    assert.ok(result.stderr.includes('--url is required') || result.stderr.includes('Error'), 
      'Should show error message about missing URL');
  });
});

describe('Artifact path consistency', () => {
  test('artifacts always go to .verax/runs/<runId>/', async () => {
    const { tmpdir } = await import('os');
    const tempDir = pathResolve(tmpdir(), `verax-test-artifacts-${Date.now()}`);
    
    // This test verifies that the artifact manager always uses .verax/runs/<runId>/
    const { initArtifactPaths, generateRunId } = await import('../src/verax/shared/artifact-manager.js');
    
    const runId = generateRunId();
    const paths = initArtifactPaths(tempDir, runId);
    
    // On Windows, paths use backslashes, so check normalized
    const normalizedRunDir = paths.runDir.replace(/\\/g, '/');
    const normalizedSummary = paths.summary.replace(/\\/g, '/');
    const normalizedFindings = paths.findings.replace(/\\/g, '/');
    const normalizedTraces = paths.traces.replace(/\\/g, '/');
    const normalizedEvidence = paths.evidence.replace(/\\/g, '/');
    
    assert.ok(normalizedRunDir.includes('.verax/runs'), `runDir should be in .verax/runs, got: ${normalizedRunDir}`);
    assert.ok(normalizedRunDir.includes(runId), 'runDir should include runId');
    assert.ok(normalizedSummary.includes('.verax/runs'), 'summary path should be in .verax/runs');
    assert.ok(normalizedFindings.includes('.verax/runs'), 'findings path should be in .verax/runs');
    assert.ok(normalizedTraces.includes('.verax/runs'), 'traces path should be in .verax/runs');
    assert.ok(normalizedEvidence.includes('.verax/runs'), 'evidence path should be in .verax/runs');
    
    // Verify no .veraxverax paths
    assert.ok(!normalizedRunDir.includes('.veraxverax'), 'runDir should not use .veraxverax');
    assert.ok(!normalizedSummary.includes('.veraxverax'), 'summary should not use .veraxverax');
    assert.ok(!normalizedFindings.includes('.veraxverax'), 'findings should not use .veraxverax');
  });
});

