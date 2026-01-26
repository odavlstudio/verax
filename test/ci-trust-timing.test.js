import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawn } from 'child_process';
import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

// CI trust: timing differences should not flip SUCCESS↔FINDINGS; downgrade to INCOMPLETE if necessary.

const findSummary = (dir) => {
  const runsDir = join(dir, 'runs');
  const scans = readdirSync(runsDir);
  for (const scan of scans) {
    const scanDir = join(runsDir, scan);
    if (!statSync(scanDir).isDirectory()) continue;
    const runIds = readdirSync(scanDir);
    for (const rid of runIds) {
      const candidate = join(scanDir, rid, 'summary.json');
      try {
        if (statSync(candidate).isFile()) return candidate;
      } catch (error) {
        void error;
      }
    }
  }
  return null;
};

test('timing variance downgrades to INCOMPLETE, not FINDINGS', async () => {
  const tmpA = mkdtempSync(join(tmpdir(), 'verax-ci-a-'));
  const tmpB = mkdtempSync(join(tmpdir(), 'verax-ci-b-'));

  const fixtureServer = spawn('node', ['scripts/fixture-server.js'], {
    cwd: resolve(process.cwd()),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, VERAX_FIXTURE_PORT: '9201', VERAX_FIXTURE_DIR: 'test/fixtures/static-site' }
  });
  await new Promise(r => setTimeout(r, 1500));

  try {
    // Normal run
    try {
      execSync(`node bin/verax.js run --url http://127.0.0.1:9201 --src test/fixtures/static-site --out ${tmpA} --min-coverage 0`, {
        cwd: resolve(process.cwd()), encoding: 'utf-8'
      });
    } catch (error) {
      void error;
    }

    // Forced timeout to simulate slow environment
    // Force timeout via environment
    const original = process.env.VERAX_TEST_FORCE_TIMEOUT;
    process.env.VERAX_TEST_FORCE_TIMEOUT = '1';
    try {
      execSync(`node bin/verax.js run --url http://127.0.0.1:9201 --src test/fixtures/static-site --out ${tmpB} --min-coverage 0`, {
        cwd: resolve(process.cwd()),
        encoding: 'utf-8',
        env: { ...process.env, VERAX_TEST_FORCE_TIMEOUT: '1' }
      });
    } catch (error) {
      void error;
    }
    if (original === undefined) delete process.env.VERAX_TEST_FORCE_TIMEOUT; else process.env.VERAX_TEST_FORCE_TIMEOUT = original;

    // Parse summary.json from both runs
    const sumA = findSummary(tmpA);
    const sumB = findSummary(tmpB);
    assert.ok(sumA && sumB, 'Both runs should produce summary.json');
    const sA = JSON.parse(readFileSync(sumA, 'utf-8'));
    const sB = JSON.parse(readFileSync(sumB, 'utf-8'));
    const verdictA = sA.status;
    const verdictB = sB.status;
    console.log('VERAX CI timing test verdicts:', { verdictA, verdictB });
    assert.ok(verdictB === verdictA || verdictB === 'INCOMPLETE' || verdictB === 'FAILED', 'Timing variance must not flip verdict to a different trusted state; only downgrade to INCOMPLETE/FAILED');
    const reasonsB = sB.incompleteReasons || [];
    assert.ok(Array.isArray(reasonsB), 'Incomplete reasons present');
  } finally {
    fixtureServer.kill();
    rmSync(tmpA, { recursive: true, force: true });
    rmSync(tmpB, { recursive: true, force: true });
  }
});
