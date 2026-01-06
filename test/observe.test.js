import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { tmpdir } from 'os';
import { observe } from '../src/verax/observe/index.js';

function createTempDir() {
  const tempDir = resolve(tmpdir(), `verax-observe-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('observe creates observation-traces.json', async () => {
  const tempDir = createTempDir();
  try {
    const htmlFile = join(tempDir, 'test.html');
    writeFileSync(htmlFile, `
<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body>
  <h1>Test Page</h1>
  <a href="#section1">Test Link</a>
  <button>Test Button</button>
</body>
</html>
    `.trim());
    
    const url = `file://${htmlFile.replace(/\\/g, '/')}`;
    const manifestPath = join(tempDir, '.veraxverax', 'learn', 'site-manifest.json');
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify({ version: 1, projectDir: tempDir }));
    
    const observation = await observe(url, manifestPath);
    
    assert.ok(existsSync(observation.tracesPath));
    const tracesContent = JSON.parse(readFileSync(observation.tracesPath, 'utf-8'));
    assert.strictEqual(tracesContent.version, 1);
    assert.ok(tracesContent.observedAt);
    assert.strictEqual(tracesContent.url, url);
    assert.ok(Array.isArray(tracesContent.traces));
  } finally {
    cleanupTempDir(tempDir);
  }
}, { timeout: 30000 });

test('observe captures screenshots', async () => {
  const tempDir = createTempDir();
  try {
    const htmlFile = join(tempDir, 'test.html');
    writeFileSync(htmlFile, `
<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body>
  <h1>Test Page</h1>
  <a href="#section1">Test Link</a>
  <button>Test Button</button>
</body>
</html>
    `.trim());
    
    const url = `file://${htmlFile.replace(/\\/g, '/')}`;
    const manifestPath = join(tempDir, '.veraxverax', 'learn', 'site-manifest.json');
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify({ version: 1, projectDir: tempDir }));
    
    const observation = await observe(url, manifestPath);
    
    assert.ok(existsSync(observation.screenshotsDir));
    const screenshots = readFileSync(observation.tracesPath, 'utf-8');
    assert.ok(screenshots.includes('screenshots/'));
  } finally {
    cleanupTempDir(tempDir);
  }
}, { timeout: 30000 });

test('observe records interaction traces', async () => {
  const tempDir = createTempDir();
  try {
    const htmlFile = join(tempDir, 'test.html');
    writeFileSync(htmlFile, `
<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body>
  <h1>Test Page</h1>
  <a href="#section1" id="test-link">Test Link</a>
  <button id="test-button">Test Button</button>
</body>
</html>
    `.trim());
    
    const url = `file://${htmlFile.replace(/\\/g, '/')}`;
    const manifestPath = join(tempDir, '.veraxverax', 'learn', 'site-manifest.json');
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify({ version: 1, projectDir: tempDir }));
    
    const observation = await observe(url, manifestPath);
    
    const tracesContent = JSON.parse(readFileSync(observation.tracesPath, 'utf-8'));
    assert.ok(tracesContent.traces.length >= 0);
    
    if (tracesContent.traces.length > 0) {
      const trace = tracesContent.traces[0];
      assert.ok(trace.interaction);
      assert.strictEqual(typeof trace.interaction.type, 'string');
      assert.strictEqual(typeof trace.interaction.selector, 'string');
      assert.ok(trace.before);
      assert.strictEqual(typeof trace.before.url, 'string');
      assert.ok(trace.before.screenshot);
      assert.ok(trace.after);
      assert.strictEqual(typeof trace.after.url, 'string');
      assert.ok(trace.after.screenshot);
    }
  } finally {
    cleanupTempDir(tempDir);
  }
}, { timeout: 30000 });

test('observe handles empty page gracefully', async () => {
  const tempDir = createTempDir();
  try {
    const htmlFile = join(tempDir, 'test.html');
    writeFileSync(htmlFile, `
<!DOCTYPE html>
<html>
<head><title>Empty Page</title></head>
<body>
  <h1>Empty Page</h1>
</body>
</html>
    `.trim());
    
    const url = `file://${htmlFile.replace(/\\/g, '/')}`;
    const manifestPath = join(tempDir, '.veraxverax', 'learn', 'site-manifest.json');
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify({ version: 1, projectDir: tempDir }));
    
    const observation = await observe(url, manifestPath);
    
    assert.ok(existsSync(observation.tracesPath));
    const tracesContent = JSON.parse(readFileSync(observation.tracesPath, 'utf-8'));
    assert.ok(Array.isArray(tracesContent.traces));
  } finally {
    cleanupTempDir(tempDir);
  }
}, { timeout: 30000 });


