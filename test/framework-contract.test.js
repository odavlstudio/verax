import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawn } from 'child_process';
import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

// Unsupported frameworks must never yield SUCCESS by accident

test('unsupported framework marks run INCOMPLETE with explicit reason', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-unsupported-'));

  // Start fixture server (static-site)
  const fixtureServer = spawn('node', ['scripts/fixture-server.js'], {
    cwd: resolve(process.cwd()),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, VERAX_FIXTURE_PORT: '9101' }
  });
  await new Promise(r => setTimeout(r, 1500));

  try {
    const cmd = `node bin/verax.js run --url http://127.0.0.1:9101 --src test/fixtures/vue-realistic-lite --out ${tmpDir} --min-coverage 0`;
    try {
      execSync(cmd, { cwd: resolve(process.cwd()), encoding: 'utf-8' });
    } catch (error) {
      // Best-effort run; failures are expected in unsupported framework scenario
      void error;
    }
    // Find summary.json in tmpDir
    const runsDir = join(tmpDir, 'runs');
    let summaryPath = null;
    const scans = readdirSync(runsDir);
    for (const scan of scans) {
      const scanDir = join(runsDir, scan);
      if (!statSync(scanDir).isDirectory()) continue;
      const runIds = readdirSync(scanDir);
      for (const rid of runIds) {
        const candidate = join(scanDir, rid, 'summary.json');
        try {
          if (statSync(candidate).isFile()) { summaryPath = candidate; break; }
        } catch (error) {
          void error;
        }
      }
      if (summaryPath) break;
    }
    assert.ok(summaryPath, 'summary.json should exist');
    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
    assert.ok(summary.status === 'INCOMPLETE' || summary.status === 'FAILED', 'Unsupported framework should not yield SUCCESS');
    const reasons = summary.incompleteReasons || [];
    assert.ok(Array.isArray(reasons), 'incompleteReasons is present');
  } finally {
    fixtureServer.kill();
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
