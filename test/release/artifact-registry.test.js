import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { ARTIFACT_REGISTRY } from '../../src/verax/core/artifacts/registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = resolve(__dirname, '..', 'bin', 'verax.js');
const fixtureDir = resolve(__dirname, 'fixtures', 'static-site');

function startServer(rootDir) {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const filePath = join(rootDir, url.pathname === '/' ? 'index.html' : url.pathname);
      try {
        const data = readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      } catch (err) {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(0, '127.0.0.1', (err) => {
      if (err) {
        rejectPromise(err);
      } else {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        // Register server for cleanup tracking
        if (global.__veraxTestServers) {
          global.__veraxTestServers.add(server);
        }
        resolvePromise({ server, port });
      }
    });
  });
}

function runCLI(args, cwd) {
  return new Promise((resolvePromise, rejectPromise) => {
    const proc = spawn(process.execPath, [cliPath, ...args], {
      cwd,
      env: { ...process.env, VERAX_TEST_MODE: '1' }
    });

    // Close stdin immediately to prevent hanging
    if (proc.stdin) {
      proc.stdin.end();
    }

    let stdout = '';
    let stderr = '';

    // Timeout after 10 seconds to prevent hanging
    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      rejectPromise(new Error('CLI execution timed out after 10 seconds'));
    }, 10000);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      resolvePromise({ code: code ?? 0, stdout, stderr });
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      rejectPromise(err);
    });
  });
}

test('registry artifacts are written with contract metadata', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'verax-artifacts-'));
  const start = await startServer(fixtureDir);
  const { server, port } = start;

  try {
    const url = `http://localhost:${port}`;
    const result = await runCLI(['run', '--url', url, '--src', fixtureDir, '--out', outDir, '--min-coverage', '0'], process.cwd());

    assert.ok([0, 20, 30, 50, 64].includes(result.code), `Unexpected exit code ${result.code}. stderr: ${result.stderr}`);

    const runsDir = join(outDir, 'runs');
    const scans = readdirSync(runsDir)
      .filter(name => statSync(join(runsDir, name)).isDirectory())
      .map((name) => ({ name, mtime: statSync(join(runsDir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    assert.ok(scans.length > 0, 'Scan directory should exist');

    const scanDir = join(runsDir, scans[0].name);
    // Descend to runId
    const runs = readdirSync(scanDir)
      .filter(name => statSync(join(scanDir, name)).isDirectory())
      .map((name) => ({ name, mtime: statSync(join(scanDir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    assert.ok(runs.length > 0, 'Run directory should exist within scan');

    const runDir = join(scanDir, runs[0].name);
    const evidenceDir = join(runDir, ARTIFACT_REGISTRY.evidence.filename);
    assert.ok(existsSync(evidenceDir), 'evidence directory should exist');

    const expectedFiles = {
      runStatus: ARTIFACT_REGISTRY.runStatus.filename,
      runMeta: ARTIFACT_REGISTRY.runMeta.filename,
      summary: ARTIFACT_REGISTRY.summary.filename,
      findings: ARTIFACT_REGISTRY.findings.filename,
      learn: ARTIFACT_REGISTRY.learn.filename,
      observe: ARTIFACT_REGISTRY.observe.filename,
      project: ARTIFACT_REGISTRY.project.filename,
      traces: ARTIFACT_REGISTRY.traces.filename,
    };

    for (const [key, filename] of Object.entries(expectedFiles)) {
      const fullPath = join(runDir, filename);
      assert.ok(existsSync(fullPath), `${key} should exist at ${filename}`);
      if (filename.endsWith('.json')) {
        const data = JSON.parse(readFileSync(fullPath, 'utf8'));
        assert.strictEqual(data.contractVersion, 1, `${filename} should include contractVersion`);
      }
    }

    const statusPath = join(runDir, expectedFiles.runStatus);
    const findingsPath = join(runDir, expectedFiles.findings);
    const statusData = JSON.parse(readFileSync(statusPath, 'utf8'));
    const findingsData = JSON.parse(readFileSync(findingsPath, 'utf8'));

    assert.ok(statusData.artifactVersions, 'run.status.json should include artifactVersions');
    const registryKeys = Object.keys(ARTIFACT_REGISTRY);
    registryKeys.forEach((key) => {
      assert.ok(key in statusData.artifactVersions, `artifactVersions should include ${key}`);
    });

    assert.ok(findingsData.enforcement, 'findings should include enforcement metadata');
    assert.strictEqual(findingsData.contractVersion, 1, 'findings should carry contractVersion');

    const summaryData = JSON.parse(readFileSync(join(runDir, expectedFiles.summary), 'utf8'));
    assert.strictEqual(summaryData.contractVersion, 1, 'summary should carry contractVersion');
  } finally {
    // Unregister from global tracker
    if (global.__veraxTestServers) {
      global.__veraxTestServers.delete(server);
    }
    // Close server with timeout guarantee
    await new Promise((resolveClose) => {
      const timer = setTimeout(resolveClose, 500);
      server.close(() => {
        clearTimeout(timer);
        resolveClose();
      });
      // Force close all connections
      if (server.closeAllConnections) {
        server.closeAllConnections();
      }
    });
  }
});

