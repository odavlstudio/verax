import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { scanRepoForSourceCandidates, selectBestDefaultSrc } from '../../src/cli/util/config/project-shape.js';
import { resolveDefaultSrc } from '../../src/cli/util/config/src-resolver.js';
import { DataError } from '../../src/cli/util/support/errors.js';

function makeTempDir(name) {
  const dir = mkdtempSync(resolve(tmpdir(), name));
  return dir;
}

function touchJson(path) {
  writeFileSync(resolve(path, 'package.json'), '{"name":"tmp","version":"1.0.0"}', 'utf8');
}

function setupMonorepoAmbiguous(root) {
  const apps = resolve(root, 'apps');
  mkdirSync(apps, { recursive: true });
  const app1 = resolve(apps, 'app1');
  const app2 = resolve(apps, 'app2');
  mkdirSync(app1); mkdirSync(app2);
  touchJson(app1);
  touchJson(app2);
}

function setupSingleFrontend(root) {
  const frontend = resolve(root, 'frontend');
  mkdirSync(frontend, { recursive: true });
  touchJson(frontend);
}

function setupRootSrc(root) {
  const src = resolve(root, 'src');
  mkdirSync(src, { recursive: true });
  writeFileSync(resolve(src, 'index.js'), 'console.log("ok")', 'utf8');
}

function cleanup(dir) {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore cleanup errors */ }
}

test('Project Shape: deterministic candidate listing order', () => {
  const root = makeTempDir('verax_shape_');
  try {
    setupMonorepoAmbiguous(root);
    const c1 = scanRepoForSourceCandidates(root);
    const c2 = scanRepoForSourceCandidates(root);
    assert.deepStrictEqual(c1, c2);
    assert.deepStrictEqual(c1, ['apps/app1', 'apps/app2']);
  } finally { cleanup(root); }
});

test('Project Shape: selects single clear candidate', () => {
  const root = makeTempDir('verax_shape_');
  try {
    setupSingleFrontend(root);
    const sel = selectBestDefaultSrc(root);
    assert.strictEqual(sel.ambiguous, false);
    assert.strictEqual(sel.selected, 'frontend');
  } finally { cleanup(root); }
});

test('Project Shape: root src preferred when single', () => {
  const root = makeTempDir('verax_shape_');
  try {
    setupRootSrc(root);
    const sel = selectBestDefaultSrc(root);
    assert.strictEqual(sel.ambiguous, false);
    assert.strictEqual(sel.selected, 'src');
  } finally { cleanup(root); }
});

test('Src Resolver: ambiguity throws DataError with exit 50', () => {
  const root = makeTempDir('verax_shape_');
  try {
    setupMonorepoAmbiguous(root);
    let threw = false;
    try {
      resolveDefaultSrc(root, null);
    } catch (e) {
      threw = true;
      assert.ok(e instanceof DataError);
      assert.strictEqual(e.exitCode, 50);
      assert.ok(String(e.message).includes('Ambiguous'));
      assert.ok(String(e.message).includes('apps/app1'));
      assert.ok(String(e.message).includes('apps/app2'));
    }
    assert.strictEqual(threw, true);
  } finally { cleanup(root); }
});




