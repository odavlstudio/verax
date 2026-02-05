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
import { getDefaultVeraxOutDir } from '../../src/cli/util/support/default-output-dir.js';

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

function hasOversizedString(value, { maxLen = 2000 } = {}) {
  if (typeof value === 'string') return value.length > maxLen;
  if (Array.isArray(value)) return value.some((v) => hasOversizedString(v, { maxLen }));
  if (value && typeof value === 'object') return Object.values(value).some((v) => hasOversizedString(v, { maxLen }));
  return false;
}

function assertSanitizedUrlString(urlString, label) {
  assert.equal(typeof urlString, 'string', `${label} must be a string`);
  assert.equal(urlString.includes('?'), false, `${label} must not include '?'`);
  assert.equal(urlString.includes('#'), false, `${label} must not include '#'`);
  const parsed = new URL(urlString);
  assert.equal(parsed.pathname, '/', `${label} pathname must be '/'`);
  assert.equal(parsed.search, '', `${label} search must be empty`);
  assert.equal(parsed.hash, '', `${label} hash must be empty`);
}

function assertAnonymizedUrlFields(obj) {
  assert.equal(obj?.target?.url, null, 'capability.target.url must be null when anonymized');
  assert.equal(obj?.signals?.http?.finalUrl, null, 'capability.signals.http.finalUrl must be null when anonymized');
  assert.match(String(obj?.target?.originHash || ''), /^[a-f0-9]{64}$/i, 'capability.target.originHash must be sha256 hex');
  assert.match(String(obj?.signals?.http?.originHash || ''), /^[a-f0-9]{64}$/i, 'capability.signals.http.originHash must be sha256 hex');
  assert.ok(['http', 'https', null].includes(obj?.target?.scheme ?? null), 'capability.target.scheme must be http/https/null');
  assert.ok(['http', 'https', null].includes(obj?.signals?.http?.scheme ?? null), 'capability.signals.http.scheme must be http/https/null');
}

function assertAnonymizedReadinessFields(obj) {
  assert.equal(obj?.url, null, 'readiness.url must be null when anonymized');
  assert.equal(obj?.signals?.http?.finalUrl, null, 'readiness.signals.http.finalUrl must be null when anonymized');
  assert.match(String(obj?.signals?.http?.originHash || ''), /^[a-f0-9]{64}$/i, 'readiness.signals.http.originHash must be sha256 hex');
  assert.ok(['http', 'https', null].includes(obj?.signals?.http?.scheme ?? null), 'readiness.signals.http.scheme must be http/https/null');
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
        assert.ok([0, 20, 40, 60, 80, 100].includes(obj.estimatedValuePercent));
        assert.ok(Array.isArray(obj.reasons));
        assertSanitizedUrlString(obj?.url, 'readiness.url');
        assertSanitizedUrlString(obj?.signals?.http?.finalUrl, 'readiness.signals.http.finalUrl');

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

    await t.test('--anonymize-host removes raw host from readiness JSON', async () => {
      const { createTestServer } = await import('../fixtures/http-post-blocking/server.js');
      const server = await createTestServer();
      try {
        const url = `http://127.0.0.1:${server.port}/deep?token=secret#frag`;
        const r = runVerax(['readiness', '--url', url, '--json', '--anonymize-host'], tmp);
        assert.strictEqual(r.exitCode, 0);
        assert.strictEqual(r.stderr.trim(), '');
        const obj = JSON.parse(r.stdout.trim());
        assertAnonymizedReadinessFields(obj);
        assert.ok(!r.stdout.includes('127.0.0.1'), 'readiness JSON must not include raw hostname when anonymized');
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

        const bundlesRoot = resolve(getDefaultVeraxOutDir(tmp), 'capability-bundles');
        assert.ok(existsSync(bundlesRoot), 'capability-bundle must create capability-bundles root');
        const stamps = readdirSync(bundlesRoot);
        assert.strictEqual(stamps.length, 1, 'must create exactly one bundle folder');
        const bundleDir = resolve(bundlesRoot, stamps[0]);

        assert.strictEqual(existsSync(resolve(getDefaultVeraxOutDir(tmp), 'runs')), false, 'capability-bundle must not create runs');

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

        assertSanitizedUrlString(obj?.target?.url, 'capability.target.url');
        assertSanitizedUrlString(obj?.signals?.http?.finalUrl, 'capability.signals.http.finalUrl');
        assert.strictEqual(hasOversizedString(obj, { maxLen: 2000 }), false, 'capability.json must not contain blob strings');

        // End-to-end: validator must accept the bundle directory.
        const { validateCapabilityBundleDirOrThrow } = await import('../../src/cli/util/bundles/capability-bundle-validator.js');
        assert.doesNotThrow(() => validateCapabilityBundleDirOrThrow(bundleDir));
      } finally {
        await new Promise((resolvePromise) => server.server.close(() => resolvePromise()));
      }
    });

    await t.test('sanitizes deep paths, query, fragment, and URL credentials', async () => {
      const tmp2 = mkdtempSync(resolve(tmpdir(), 'verax-capbundle-tricky-'));
      const { createTestServer } = await import('../fixtures/http-post-blocking/server.js');
      const server = await createTestServer();
      try {
        const trickyUrl = `http://user:pass@127.0.0.1:${server.port}/deep/path?token=secret#frag`;
        const r = runVerax(['capability-bundle', '--url', trickyUrl], tmp2);
        assert.strictEqual(r.exitCode, 0);
        assert.strictEqual(r.stderr.trim(), '');

        const bundlesRoot = resolve(getDefaultVeraxOutDir(tmp2), 'capability-bundles');
        const stamps = readdirSync(bundlesRoot);
        assert.strictEqual(stamps.length, 1);
        const bundleDir = resolve(bundlesRoot, stamps[0]);
        const obj = JSON.parse(readFileSync(resolve(bundleDir, 'capability.json'), 'utf8'));
        assertSanitizedUrlString(obj?.target?.url, 'capability.target.url');
        assertSanitizedUrlString(obj?.signals?.http?.finalUrl, 'capability.signals.http.finalUrl');
      } finally {
        await new Promise((resolvePromise) => server.server.close(() => resolvePromise()));
        rmSync(tmp2, { recursive: true, force: true });
      }
    });

    await t.test('supports --anonymize-host (no raw hostname stored)', async () => {
      const tmp2 = mkdtempSync(resolve(tmpdir(), 'verax-capbundle-anon-'));
      const { createTestServer } = await import('../fixtures/http-post-blocking/server.js');
      const server = await createTestServer();
      try {
        const url = `http://127.0.0.1:${server.port}/?q=secret#frag`;
        const r = runVerax(['capability-bundle', '--url', url, '--anonymize-host'], tmp2);
        assert.strictEqual(r.exitCode, 0);
        assert.strictEqual(r.stderr.trim(), '');

        const bundlesRoot = resolve(getDefaultVeraxOutDir(tmp2), 'capability-bundles');
        const stamps = readdirSync(bundlesRoot);
        assert.strictEqual(stamps.length, 1);
        const bundleDir = resolve(bundlesRoot, stamps[0]);
        const jsonText = readFileSync(resolve(bundleDir, 'capability.json'), 'utf8');
        const txt = readFileSync(resolve(bundleDir, 'capability-summary.txt'), 'utf8');
        const obj = JSON.parse(jsonText);
        assertAnonymizedUrlFields(obj);
        assert.ok(!jsonText.includes('127.0.0.1'), 'capability.json must not include raw hostname when anonymized');
        assert.ok(!txt.includes('127.0.0.1'), 'capability-summary.txt must not include raw hostname when anonymized');
      } finally {
        await new Promise((resolvePromise) => server.server.close(() => resolvePromise()));
        rmSync(tmp2, { recursive: true, force: true });
      }
    });

    await t.test('normalizes missing scheme to https:// and still enforces origin-only output', () => {
      const tmp2 = mkdtempSync(resolve(tmpdir(), 'verax-capbundle-noscheme-'));
      try {
        // Use an http fixture port but omit scheme; normalization will use https:// and fetch will fail fast.
        const hostOnly = '127.0.0.1:1/deep?x=1#y';
        const r = runVerax(['capability-bundle', '--url', hostOnly, '--timeout-ms', '200'], tmp2);
        assert.strictEqual(r.exitCode, 0);
        assert.strictEqual(r.stderr.trim(), '');
        const bundlesRoot = resolve(getDefaultVeraxOutDir(tmp2), 'capability-bundles');
        const stamps = readdirSync(bundlesRoot);
        assert.strictEqual(stamps.length, 1);
        const bundleDir = resolve(bundlesRoot, stamps[0]);
        const obj = JSON.parse(readFileSync(resolve(bundleDir, 'capability.json'), 'utf8'));
        assertSanitizedUrlString(obj?.target?.url, 'capability.target.url');
        assertSanitizedUrlString(obj?.signals?.http?.finalUrl, 'capability.signals.http.finalUrl');
        assert.ok(String(obj?.target?.url).startsWith('https://'), 'normalized URL must use https://');
      } finally {
        rmSync(tmp2, { recursive: true, force: true });
      }
    });

    await t.test('sanitizes IPv6 origins (path=/, no query/fragment)', () => {
      const tmp2 = mkdtempSync(resolve(tmpdir(), 'verax-capbundle-ipv6-'));
      try {
        const ipv6Url = 'http://[::1]:9/deep/path?x=1#y';
        const r = runVerax(['capability-bundle', '--url', ipv6Url, '--timeout-ms', '200'], tmp2);
        assert.strictEqual(r.exitCode, 0);
        assert.strictEqual(r.stderr.trim(), '');
        const bundlesRoot = resolve(getDefaultVeraxOutDir(tmp2), 'capability-bundles');
        const stamps = readdirSync(bundlesRoot);
        assert.strictEqual(stamps.length, 1);
        const bundleDir = resolve(bundlesRoot, stamps[0]);
        const obj = JSON.parse(readFileSync(resolve(bundleDir, 'capability.json'), 'utf8'));
        assertSanitizedUrlString(obj?.target?.url, 'capability.target.url');
        assertSanitizedUrlString(obj?.signals?.http?.finalUrl, 'capability.signals.http.finalUrl');
      } finally {
        rmSync(tmp2, { recursive: true, force: true });
      }
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
