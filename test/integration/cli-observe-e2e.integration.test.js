import { strict as assert } from 'assert';
import test from 'node:test';
import http from 'http';
import { resolve, join, extname } from 'path';
import { createReadStream, statSync, existsSync, readFileSync } from 'fs';
import { spawn } from 'child_process';

function serveFixtures(rootDir) {
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };

  const server = http.createServer((req, res) => {
    try {
      const urlPath = (req.url || '/').split('?')[0].split('#')[0];
      let filePath = resolve(rootDir, '.' + decodeURIComponent(urlPath));
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad request');
        return;
      }
      if (existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = join(filePath, 'index.html');
      }
      if (!existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      createReadStream(filePath).pipe(res);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  });
  return server;
}

function runCli(url, outDir) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [
      'bin/verax.js',
      'run',
      '--url', url,
      '--src', 'test/fixtures/static-buttons',
      '--out', outDir,
      '--json',
      '--debug'
    ], {
      cwd: resolve('.'),
      env: { ...process.env, VERAX_TEST_MODE: '0', VERAX_DEBUG: '1' },
      shell: false,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      resolveRun({ code, stdout, stderr });
    });
  });
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf-8').toString());
}

async function getLatestRunBaseDir(outDir) {
  // Find the latest.json under legacy runs path
  // out/runs/<scanId>/latest.json contains { runId, baseDir }
  // Scan first-level directories under out/runs
  const runsRoot = resolve(outDir, 'runs');
  const { readdirSync } = await import('fs');
  const scans = readdirSync(runsRoot, { withFileTypes: true }).filter(d => d.isDirectory());
  assert.ok(scans.length > 0, 'No scans directory found');
  // Pick the most recently modified scan dir by stat mtime
  const { statSync } = await import('fs');
  const sorted = scans.sort((a, b) => statSync(resolve(runsRoot, b.name)).mtimeMs - statSync(resolve(runsRoot, a.name)).mtimeMs);
  const latestPtrPath = resolve(runsRoot, sorted[0].name, 'latest.json');
  const ptr = readJson(latestPtrPath);
  assert.ok(ptr && ptr.baseDir, 'latest.json missing baseDir');
  return ptr.baseDir;
}

test('CLI Observe E2E: should not crash and perform real observations with deterministic artifacts', async () => {
    // Start fixture server on random port
    const root = resolve('test/fixtures/static-buttons');
    const server = serveFixtures(root);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const address = server.address();
    const port = address.port;
    const url = `http://127.0.0.1:${port}/index.html`;
    // Track server for wrapper cleanup
    if (global.__veraxTestServers) {
      global.__veraxTestServers.add(server);
    }

    try {
      const out1 = resolve('.verax-e2e-1');
      const out2 = resolve('.verax-e2e-2');

      const res1 = await runCli(url, out1);
      assert.notStrictEqual(res1.code, 40, 'CLI must not exit with INFRA_FAILURE');
      assert.notStrictEqual(res1.code, 64, 'CLI must not exit with USAGE_ERROR');

      const runDir1 = await getLatestRunBaseDir(out1);
      const observe1 = readJson(resolve(runDir1, 'observe.json'));
      assert.ok(observe1.stats.totalExpectations > 0, 'expectationsTotal must be > 0');
      assert.ok(observe1.stats.attempted > 0, 'attempted must be > 0');
      assert.ok(observe1.stats.observed > 0, 'observed must be > 0');

      const digest1 = readJson(resolve(runDir1, 'run.digest.json'));

      const res2 = await runCli(url, out2);
      assert.notStrictEqual(res2.code, 40, 'Second run must not exit with INFRA_FAILURE');
      assert.notStrictEqual(res2.code, 64, 'Second run must not exit with USAGE_ERROR');
      const runDir2 = await getLatestRunBaseDir(out2);
      const observe2 = readJson(resolve(runDir2, 'observe.json'));
      assert.ok(observe2.stats.attempted > 0, 'attempted(2) must be > 0');
      assert.ok(observe2.stats.observed > 0, 'observed(2) must be > 0');

      const digest2 = readJson(resolve(runDir2, 'run.digest.json'));
      assert.ok(typeof digest1.deterministicDigest === 'string' && digest1.deterministicDigest.length > 0, 'digest must have deterministicDigest');
      assert.ok(typeof digest2.deterministicDigest === 'string' && digest2.deterministicDigest.length > 0, 'digest(2) must have deterministicDigest');
      // Determinism via normalized digest (observations/expectations/metadata)
      assert.strictEqual(digest1.deterministicDigest, digest2.deterministicDigest, 'deterministic digests must match');
    } finally {
      try { server.close(); } catch (_err) { /* ignore */ }
      if (global.__veraxTestServers) {
        try { global.__veraxTestServers.delete(server); } catch (_err) { /* ignore */ }
      }
    }
});
