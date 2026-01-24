import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { isFirstRun } from '../src/cli/util/support/first-run-detection.js';
import { autoDiscoverSrc } from '../src/cli/util/support/src-auto-discovery.js';

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
    // Create a scan directory in the runs subdirectory (legacy structure)
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
    // Create a scan directory in the scans subdirectory (new structure)
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
    // Empty directory, no package.json, no code files
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
    // Initial state: empty repo
    const firstRunResult = isFirstRun(tmpDir);
    assert.strictEqual(firstRunResult, true, 'Empty repo should be first run');
    
    // Auto-discovery should return URL-only mode
    const discoveryResult = autoDiscoverSrc(tmpDir);
    assert.strictEqual(discoveryResult.urlOnlyMode, true);
    assert.strictEqual(discoveryResult.discovered, false);
    
    // After first scan, create .verax/runs/scan-* directory
    mkdirSync(join(tmpDir, '.verax', 'runs', 'scan-test'), { recursive: true });
    
    // Second run should not be first run
    const secondRunResult = isFirstRun(tmpDir);
    assert.strictEqual(secondRunResult, false, 'After scan, should not be first run');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('first-run + auto-discovery: complete workflow for repo with src/', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  try {
    // Initial state: repo with src/ directory
    mkdirSync(join(tmpDir, 'src'));
    writeFileSync(join(tmpDir, 'src', 'index.ts'), 'export const app = "test";');
    
    const firstRunResult = isFirstRun(tmpDir);
    assert.strictEqual(firstRunResult, true, 'Repo with src/ but no .verax/ should be first run');
    
    // Auto-discovery should find src/
    const discoveryResult = autoDiscoverSrc(tmpDir);
    assert.strictEqual(discoveryResult.discovered, true);
    assert.strictEqual(discoveryResult.srcPath, join(tmpDir, 'src'));
    assert.strictEqual(discoveryResult.urlOnlyMode, false);
    
    // After first scan, create .verax/scans/scan-* directory (new structure)
    mkdirSync(join(tmpDir, '.verax', 'scans', 'scan-test'), { recursive: true });
    
    const secondRunResult = isFirstRun(tmpDir);
    assert.strictEqual(secondRunResult, false, 'After scan, should not be first run');
    
    // Auto-discovery should still find src/
    const secondDiscoveryResult = autoDiscoverSrc(tmpDir);
    assert.strictEqual(secondDiscoveryResult.discovered, true);
    assert.strictEqual(secondDiscoveryResult.srcPath, join(tmpDir, 'src'));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CI mode: isFirstRun always returns false when CI=true', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  const originalCI = process.env.CI;
  
  try {
    // Set CI environment variable
    process.env.CI = 'true';
    
    // Even in empty directory, should NOT be first run in CI
    const result = isFirstRun(tmpDir);
    assert.strictEqual(result, false, 'CI environment should never be first run');
  } finally {
    // Restore original CI value
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
    
    // Verify directory is truly empty
    assert.strictEqual(existsSync(join(tmpDir, '.verax')), false);
    
    // Should NOT be first run in CI
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
    // Ensure CI is not set
    delete process.env.CI;
    
    // Empty directory should be first run locally
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
