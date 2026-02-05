/**
 * CAPABILITY DISCOVERY CONTRACT (v0.4.9)
 *
 * Ensures pilot-only diagnostic commands are:
 * - exit code always 0
 * - do not produce verdicts (SUCCESS/FINDINGS/INCOMPLETE) or run artifacts
 * - do not include forbidden data (auth/cookies/headers/source/paths/selectors)
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../../');

function runVerax(args, cwd) {
  const result = spawnSync('node', [resolve(projectRoot, 'bin/verax.js'), ...args], {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60000,
    encoding: 'utf8',
    env: {
      ...process.env,
      VERAX_TEST_MODE: '1',
      VERAX_TEST_TIME: '2026-01-01T00:00:00.000Z',
    },
  });
  return {
    exitCode: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function hasForbiddenKey(obj, forbidden) {
  if (!obj || typeof obj !== 'object') return false;
  for (const key of Object.keys(obj)) {
    if (forbidden.has(key)) return true;
    if (hasForbiddenKey(obj[key], forbidden)) return true;
  }
  return false;
}

function hasSuspiciousValueStrings(value) {
  if (typeof value === 'string') {
    if (/[A-Za-z]:\\/.test(value)) return true; // windows absolute path
    if (value.includes('.verax/runs') || value.includes('.verax\\runs')) return true;
  }
  if (Array.isArray(value)) return value.some(hasSuspiciousValueStrings);
  if (value && typeof value === 'object') return Object.values(value).some(hasSuspiciousValueStrings);
  return false;
}

test('readiness: exit code always 0 and no verdict fields', async (t) => {
  const tmp = mkdtempSync(resolve(tmpdir(), 'verax-readiness-'));

  try {
    await t.test('missing --url still exits 0', () => {
      const r = runVerax(['readiness'], tmp);
      assert.strictEqual(r.exitCode, 0);
      assert.strictEqual(r.stderr.trim(), '');
      assert.match(r.stdout, /VERAX Readiness/i);
    });

    await t.test('human output contains readiness level and counts', async () => {
      const { createTestServer } = await import('../fixtures/http-post-blocking/server.js');
      const server = await createTestServer();
      try {
        const url = `http://127.0.0.1:${server.port}`;
        const r = runVerax(['readiness', '--url', url], tmp);
        assert.strictEqual(r.exitCode, 0);
        assert.strictEqual(r.stderr.trim(), '');
        assert.match(r.stdout, /Readiness:\s+(READY|PARTIAL|OUT_OF_SCOPE)/);
        assert.match(r.stdout, /Interaction surface/);
        assert.ok(!r.stdout.includes('RESULT'), 'readiness must not emit RESULT/REASON/ACTION block');
        assert.ok(!r.stdout.includes('SUCCESS') && !r.stdout.includes('FINDINGS') && !r.stdout.includes('INCOMPLETE'));
        assert.ok(!existsSync(resolve(tmp, '.verax', 'runs')), 'readiness must not create run artifacts');
      } finally {
        await new Promise((resolvePromise) => server.server.close(() => resolvePromise()));
      }
    });

    await t.test('--json emits a single JSON object with no forbidden keys', async () => {
      const { createTestServer } = await import('../fixtures/http-post-blocking/server.js');
      const server = await createTestServer();
      try {
        const url = `http://127.0.0.1:${server.port}`;
        const r = runVerax(['readiness', '--url', url, '--json'], tmp);
        assert.strictEqual(r.exitCode, 0);
        assert.strictEqual(r.stderr.trim(), '');
        const obj = JSON.parse(r.stdout.trim());
        assert.ok(obj && typeof obj === 'object');
        assert.ok(['READY', 'PARTIAL', 'OUT_OF_SCOPE'].includes(obj.readinessLevel));
        assert.ok([0, 20, 40, 60].includes(obj.estimatedValuePercent));
        assert.ok(Array.isArray(obj.reasons));

        const forbiddenKeys = new Set([
          'truthState',
          'truth',
          'verdict',
          'exitCode',
          'findings',
          'judgments',
          'cookies',
          'headers',
          'auth',
          'storageState',
          'selector',
          'selectors',
          'src',
          'repo',
          'path',
        ]);
        assert.strictEqual(hasForbiddenKey(obj, forbiddenKeys), false, 'readiness JSON must not include forbidden keys');
        assert.strictEqual(hasSuspiciousValueStrings(obj), false, 'readiness JSON must not include local paths or run dirs');
        assert.ok(!existsSync(resolve(tmp, '.verax', 'runs')), 'readiness must not create run artifacts');
      } finally {
        await new Promise((resolvePromise) => server.server.close(() => resolvePromise()));
      }
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('capability-bundle: writes only safe artifacts and exit code always 0', async (t) => {
  const tmp = mkdtempSync(resolve(tmpdir(), 'verax-capbundle-'));
  try {
    await t.test('missing --url still exits 0 and writes nothing', () => {
      const r = runVerax(['capability-bundle'], tmp);
      assert.strictEqual(r.exitCode, 0);
      assert.strictEqual(r.stderr.trim(), '');
      assert.match(r.stdout, /Capability Bundle/i);
      assert.strictEqual(existsSync(resolve(tmp, '.verax', 'capability-bundles')), false);
      assert.strictEqual(existsSync(resolve(tmp, '.verax', 'runs')), false);
    });

    await t.test('writes capability.json and capability-summary.txt only', async () => {
      const { createTestServer } = await import('../fixtures/http-post-blocking/server.js');
      const server = await createTestServer();
      try {
        const url = `http://127.0.0.1:${server.port}`;
        const r = runVerax(['capability-bundle', '--url', url], tmp);
        assert.strictEqual(r.exitCode, 0);
        assert.strictEqual(r.stderr.trim(), '');

        const bundlesRoot = resolve(tmp, '.verax', 'capability-bundles');
        assert.ok(existsSync(bundlesRoot), 'capability-bundle must create capability-bundles root');
        const stamps = readdirSync(bundlesRoot);
        assert.strictEqual(stamps.length, 1, 'must create exactly one bundle folder');
        const bundleDir = resolve(bundlesRoot, stamps[0]);

        assert.strictEqual(existsSync(resolve(tmp, '.verax', 'runs')), false, 'capability-bundle must not create runs');

        const files = readdirSync(bundleDir).sort();
        assert.deepStrictEqual(files, ['capability-summary.txt', 'capability.json', 'integrity.manifest.json']);

        const jsonText = readFileSync(resolve(bundleDir, 'capability.json'), 'utf8');
        const txt = readFileSync(resolve(bundleDir, 'capability-summary.txt'), 'utf8');
        assert.ok(jsonText.includes('This bundle is diagnostic-only.'), 'capability.json must contain header');
        assert.ok(txt.includes('This bundle is diagnostic-only.'), 'capability-summary.txt must contain header');

        const obj = JSON.parse(jsonText);
        const forbiddenKeys = new Set([
          'truthState',
          'truth',
          'verdict',
          'exitCode',
          'findings',
          'judgments',
          'cookies',
          'headers',
          'auth',
          'storageState',
          'selector',
          'selectors',
          'src',
          'repo',
          'path',
        ]);
        assert.strictEqual(hasForbiddenKey(obj, forbiddenKeys), false, 'bundle JSON must not include forbidden keys');
        assert.strictEqual(hasSuspiciousValueStrings(obj), false, 'bundle JSON must not include local paths or run dirs');
        assert.ok(!txt.includes('.verax/runs') && !txt.includes('.verax\\runs'));
      } finally {
        await new Promise((resolvePromise) => server.server.close(() => resolvePromise()));
      }
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
