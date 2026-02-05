/**
 * RUN PREFLIGHT CONTRACT (v0.4.9)
 *
 * Ensures `verax run` fails fast on environment/prerequisite issues:
 * - exits with USAGE_ERROR (64)
 * - emits a single RESULT/REASON/ACTION block (or final JSON if --json)
 * - creates no run artifacts directory
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../../');

function runVeraxRun(args, cwd, extraEnv = {}) {
  const result = spawnSync('node', [resolve(projectRoot, 'bin/verax.js'), 'run', ...args], {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60000,
    encoding: 'utf8',
    env: {
      ...process.env,
      VERAX_TEST_MODE: '1',
      ...extraEnv,
    },
  });
  return {
    exitCode: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

test('preflight: Playwright import failure exits 64 and writes no run artifacts', () => {
  const tmp = mkdtempSync(resolve(tmpdir(), 'verax-preflight-pw-'));
  try {
    const outDir = resolve(tmp, '.verax');
    const srcDir = resolve(projectRoot, 'test', 'fixtures', 'truly-empty-fixture');
    const r = runVeraxRun(
      ['--url', 'https://example.com', '--src', srcDir, '--out', outDir],
      tmp,
      { VERAX_TEST_PREFLIGHT_PLAYWRIGHT_IMPORT_FAIL: '1' }
    );

    assert.strictEqual(r.exitCode, 64);
    assert.strictEqual(r.stderr.trim(), '');
    assert.match(r.stdout, /RESULT\s+USAGE_ERROR/);
    assert.match(r.stdout, /Playwright/i);
    assert.ok(!existsSync(resolve(outDir, 'runs')), 'no run directories may be created on preflight failure');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('preflight: Chromium launch failure exits 64 and writes no run artifacts', () => {
  const tmp = mkdtempSync(resolve(tmpdir(), 'verax-preflight-chromium-'));
  try {
    const outDir = resolve(tmp, '.verax');
    const srcDir = resolve(projectRoot, 'test', 'fixtures', 'truly-empty-fixture');
    const r = runVeraxRun(
      ['--url', 'https://example.com', '--src', srcDir, '--out', outDir],
      tmp,
      { VERAX_TEST_PREFLIGHT_CHROMIUM_LAUNCH_FAIL: '1' }
    );

    assert.strictEqual(r.exitCode, 64);
    assert.strictEqual(r.stderr.trim(), '');
    assert.match(r.stdout, /RESULT\s+USAGE_ERROR/);
    assert.match(r.stdout, /(Chromium|browser)/i);
    assert.ok(!existsSync(resolve(outDir, 'runs')), 'no run directories may be created on preflight failure');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('preflight: invalid --out path (file) exits 64 and writes no run artifacts', () => {
  const tmp = mkdtempSync(resolve(tmpdir(), 'verax-preflight-out-'));
  try {
    const outFile = resolve(tmp, 'out-is-file');
    writeFileSync(outFile, 'x\n', { encoding: 'utf8' });
    const srcDir = resolve(projectRoot, 'test', 'fixtures', 'truly-empty-fixture');
    const r = runVeraxRun(['--url', 'https://example.com', '--src', srcDir, '--out', outFile], tmp);

    assert.strictEqual(r.exitCode, 64);
    assert.strictEqual(r.stderr.trim(), '');
    assert.match(r.stdout, /RESULT\s+USAGE_ERROR/);
    assert.match(r.stdout, /--out must be a directory/i);
    assert.ok(!existsSync(resolve(tmp, '.verax', 'runs')));
    assert.ok(!existsSync(resolve(tmp, 'runs')), 'run must not create runs/ in cwd');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('preflight: --json emits final JSON and exits 64 on prereq failure', () => {
  const tmp = mkdtempSync(resolve(tmpdir(), 'verax-preflight-json-'));
  try {
    const outDir = resolve(tmp, '.verax');
    const srcDir = resolve(projectRoot, 'test', 'fixtures', 'truly-empty-fixture');
    const r = runVeraxRun(
      ['--url', 'https://example.com', '--src', srcDir, '--out', outDir, '--json'],
      tmp,
      { VERAX_TEST_PREFLIGHT_PLAYWRIGHT_IMPORT_FAIL: '1' }
    );

    assert.strictEqual(r.exitCode, 64);
    assert.strictEqual(r.stderr.trim(), '');
    const line = r.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
    const obj = JSON.parse(line);
    assert.strictEqual(obj.exitCode, 64);
    assert.strictEqual(obj.result, 'USAGE_ERROR');
    assert.ok(String(obj.reason || '').length > 0);
    assert.ok(String(obj.action || '').length > 0);
    assert.ok(!existsSync(resolve(outDir, 'runs')));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

