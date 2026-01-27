import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { spawn } from 'child_process';
import { isFirstRun } from '../src/cli/util/support/first-run-detection.js';
import { autoDiscoverSrc } from '../src/cli/util/support/src-auto-discovery.js';

// First-run detection and auto-discovery remain documented here to protect DX invariants

test('first-run detection: empty directory returns true', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  try {
    const result = isFirstRun(tmpDir);
    assert.strictEqual(result, true, 'Empty directory should be detected as first run');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('first-run detection: directory with .verax/ returns false', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  try {
    mkdirSync(join(tmpDir, '.verax', 'runs', 'scan-abc123'), { recursive: true });
    const result = isFirstRun(tmpDir);
    assert.strictEqual(result, false, 'Directory with scan in runs/ should not be first run');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('first-run detection: directory with scan-* subdirectories returns false', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  try {
    mkdirSync(join(tmpDir, '.verax', 'scans', 'scan-abc123'), { recursive: true });
    const result = isFirstRun(tmpDir);
    assert.strictEqual(result, false, 'Directory with scan in scans/ should not be first run');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('first-run detection: .verax/ without scans returns true', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  try {
    mkdirSync(join(tmpDir, '.verax'));
    const result = isFirstRun(tmpDir);
    assert.strictEqual(result, true, '.verax/ without scan-* should still be first run');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('auto-discovery: finds src/ directory with package.json', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  try {
    mkdirSync(join(tmpDir, 'src'));
    writeFileSync(join(tmpDir, 'src', 'package.json'), JSON.stringify({ name: 'test' }));
    const result = autoDiscoverSrc(tmpDir);
    assert.strictEqual(result.discovered, true);
    assert.strictEqual(result.srcPath, join(tmpDir, 'src'));
    assert.strictEqual(result.urlOnlyMode, false);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('auto-discovery: finds app/ directory with code files', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  try {
    mkdirSync(join(tmpDir, 'app'));
    writeFileSync(join(tmpDir, 'app', 'index.js'), 'console.log("hello");');
    const result = autoDiscoverSrc(tmpDir);
    assert.strictEqual(result.discovered, true);
    assert.strictEqual(result.srcPath, join(tmpDir, 'app'));
    assert.strictEqual(result.urlOnlyMode, false);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('auto-discovery: finds frontend/ directory with TypeScript', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  try {
    mkdirSync(join(tmpDir, 'frontend'));
    writeFileSync(join(tmpDir, 'frontend', 'app.tsx'), 'export const App = () => <div>test</div>;');
    const result = autoDiscoverSrc(tmpDir);
    assert.strictEqual(result.discovered, true);
    assert.strictEqual(result.srcPath, join(tmpDir, 'frontend'));
    assert.strictEqual(result.urlOnlyMode, false);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('auto-discovery: returns cwd when package.json exists at root', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  try {
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
    const result = autoDiscoverSrc(tmpDir);
    assert.strictEqual(result.discovered, true);
    assert.strictEqual(result.srcPath, tmpDir);
    assert.strictEqual(result.urlOnlyMode, false);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('auto-discovery: returns URL-only mode when no source detected', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  try {
    const result = autoDiscoverSrc(tmpDir);
    assert.strictEqual(result.discovered, false);
    assert.strictEqual(result.srcPath, tmpDir);
    assert.strictEqual(result.urlOnlyMode, true);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('auto-discovery: prefers src/ over app/ over frontend/', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  try {
    mkdirSync(join(tmpDir, 'src'));
    mkdirSync(join(tmpDir, 'app'));
    mkdirSync(join(tmpDir, 'frontend'));
    writeFileSync(join(tmpDir, 'src', 'index.js'), 'console.log("src");');
    writeFileSync(join(tmpDir, 'app', 'index.js'), 'console.log("app");');
    writeFileSync(join(tmpDir, 'frontend', 'index.js'), 'console.log("frontend");');
    const result = autoDiscoverSrc(tmpDir);
    assert.strictEqual(result.discovered, true);
    assert.strictEqual(result.srcPath, join(tmpDir, 'src'));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('auto-discovery: skips directories without valid code indicators', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  try {
    mkdirSync(join(tmpDir, 'src'));
    writeFileSync(join(tmpDir, 'src', 'readme.txt'), 'This is not code');
    const result = autoDiscoverSrc(tmpDir);
    assert.strictEqual(result.discovered, false);
    assert.strictEqual(result.urlOnlyMode, true);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('auto-discovery: recognizes .jsx and .tsx extensions', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  try {
    mkdirSync(join(tmpDir, 'src'));
    writeFileSync(join(tmpDir, 'src', 'component.jsx'), 'export const Comp = () => <div />;');
    const result = autoDiscoverSrc(tmpDir);
    assert.strictEqual(result.discovered, true);
    assert.strictEqual(result.srcPath, join(tmpDir, 'src'));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('first-run + auto-discovery: complete workflow for empty repo', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  try {
    const firstRunResult = isFirstRun(tmpDir);
    assert.strictEqual(firstRunResult, true, 'Empty repo should be first run');
    const discoveryResult = autoDiscoverSrc(tmpDir);
    assert.strictEqual(discoveryResult.urlOnlyMode, true);
    assert.strictEqual(discoveryResult.discovered, false);
    mkdirSync(join(tmpDir, '.verax', 'runs', 'scan-test'), { recursive: true });
    const secondRunResult = isFirstRun(tmpDir);
    assert.strictEqual(secondRunResult, false, 'After scan, should not be first run');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('first-run + auto-discovery: complete workflow for repo with src/', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  try {
    mkdirSync(join(tmpDir, 'src'));
    writeFileSync(join(tmpDir, 'src', 'index.ts'), 'export const app = "test";');
    const firstRunResult = isFirstRun(tmpDir);
    assert.strictEqual(firstRunResult, true, 'Repo with src/ but no .verax/ should be first run');
    const discoveryResult = autoDiscoverSrc(tmpDir);
    assert.strictEqual(discoveryResult.discovered, true);
    assert.strictEqual(discoveryResult.srcPath, join(tmpDir, 'src'));
    assert.strictEqual(discoveryResult.urlOnlyMode, false);
    mkdirSync(join(tmpDir, '.verax', 'scans', 'scan-test'), { recursive: true });
    const secondRunResult = isFirstRun(tmpDir);
    assert.strictEqual(secondRunResult, false, 'After scan, should not be first run');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CI mode: isFirstRun always returns false when CI=true', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  const originalCI = process.env.CI;
  try {
    process.env.CI = 'true';
    const result = isFirstRun(tmpDir);
    assert.strictEqual(result, false, 'CI environment should never be first run');
  } finally {
    if (originalCI === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = originalCI;
    }
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CI mode: isFirstRun returns false even without .verax directory', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  const originalCI = process.env.CI;
  try {
    process.env.CI = 'true';
    assert.strictEqual(existsSync(join(tmpDir, '.verax')), false);
    const result = isFirstRun(tmpDir);
    assert.strictEqual(result, false, 'CI should disable first-run even in empty repo');
  } finally {
    if (originalCI === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = originalCI;
    }
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CI mode: local behavior unchanged when CI not set', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  const originalCI = process.env.CI;
  try {
    delete process.env.CI;
    const result = isFirstRun(tmpDir);
    assert.strictEqual(result, true, 'Local empty repo should be first run');
  } finally {
    if (originalCI === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = originalCI;
    }
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ============================================================
// RUN SUMMARY (DX) TESTS
// ============================================================

test('run summary: includes coverage ratio, verdict, and next actions', async () => {
  const { execSync } = await import('child_process');
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-summary-'));
  const fixtureServer = spawn('node', ['scripts/fixture-server.js'], {
    cwd: resolve(process.cwd()),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    const result = execSync(
      `node bin/verax.js run --url http://127.0.0.1:9001 --src test/fixtures/static-site --out ${tmpDir} --min-coverage 0`,
      { cwd: resolve(process.cwd()), encoding: 'utf-8' }
    );
    const output = result.toString();
    assert.ok(output.includes('VERAX Run Summary'), 'Summary heading is present');
    assert.ok(/Coverage: \d+\/\d+/.test(output), 'Coverage ratio is shown');
    assert.ok(/Verdict: /.test(output), 'Verdict line is shown');
    assert.ok(output.includes('Top findings') || output.includes('Next:'), 'Next action guidance is present');
  } catch (err) {
    const output = (err.stdout || '').toString();
    if (!output) throw err;
    assert.ok(output.includes('VERAX Run Summary'), 'Summary heading is present on failure');
    assert.ok(/Coverage: \d+\/\d+/.test(output), 'Coverage ratio is shown on failure');
    assert.ok(/Verdict: /.test(output), 'Verdict line is shown on failure');
    assert.ok(output.includes('Top findings') || output.includes('Next:'), 'Next action guidance is present on failure');
  } finally {
    fixtureServer.kill();
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('run summary: INCOMPLETE banner is unavoidable', async () => {
  const { execSync } = await import('child_process');
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-incomplete-'));

  try {
    execSync(
      `node bin/verax.js run --url http://example.com --out ${tmpDir}`,
      { cwd: resolve(process.cwd()), encoding: 'utf-8', stdio: 'pipe' }
    );
    throw new Error('Should have failed with INCOMPLETE');
  } catch (err) {
    const output = err.stdout ? err.stdout.toString() : '';
    const errOutput = err.stderr ? err.stderr.toString() : '';
    const combined = output + errOutput;
    assert.ok(combined.includes('INCOMPLETE IS NOT SAFE') || combined.includes('INCOMPLETE'), 
      'Incomplete warning is visible');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('run summary: omits summary in JSON mode', async () => {
  const { execSync } = await import('child_process');
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-json-'));

  try {
    const result = execSync(
      `node bin/verax.js run --url http://example.com --out ${tmpDir} --json`,
      { cwd: resolve(process.cwd()), encoding: 'utf-8' }
    );
    const output = result.toString();
    assert.ok(!output.includes('VERAX Run Summary'), 'Summary suppressed in JSON mode');
  } catch (err) {
    const output = (err.stdout || '').toString();
    if (!output) throw err;
    assert.ok(!output.includes('VERAX Run Summary'), 'Summary suppressed in JSON mode (error path)');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('dry-learn mode prints extracted promises without observation', async () => {
  const { execSync } = await import('child_process');
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-dry-'));
  const fixtureServer = spawn('node', ['scripts/fixture-server.js'], {
    cwd: resolve(process.cwd()),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, VERAX_FIXTURE_PORT: '9001' }
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    const result = execSync(
      `node bin/verax.js run --url http://127.0.0.1:9001 --src test/fixtures/static-site --out ${tmpDir} --dry-learn`,
      { cwd: resolve(process.cwd()), encoding: 'utf-8', stdio: 'pipe' }
    );
    const output = result.toString();
    assert.ok(output.includes('VERAX Dry Learn') || output.includes('Learn'), 'Dry learn heading is present');
    assert.ok(output.includes('Promises found') || output.includes('promises'), 'Shows promise counts');
  } catch (err) {
    // dry-learn may exit non-zero but still print the output
    const output = (err.stdout || '').toString();
    assert.ok(output.includes('VERAX Dry Learn') || output.includes('Learn'), 'Dry learn heading is present (error path)');
    assert.ok(output.includes('Promises found') || output.includes('promises'), 'Shows promise counts (error path)');
  } finally {
    fixtureServer.kill();
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('README includes quickstart and demo commands', () => {
  const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf-8');
  assert.ok(readme.includes('3-Minute Quickstart'), 'Quickstart heading present');
  assert.ok(readme.includes('npm run demo'), 'Demo script documented');
  assert.ok(readme.includes('npm run verax:demo'), 'verax:demo script documented');
  assert.ok(readme.includes('verax run --url'), 'Real URL invocation documented');
});
