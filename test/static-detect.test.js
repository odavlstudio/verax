import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { tmpdir } from 'os';
import { detect } from '../src/verax/detect/index.js';

function createTempDir() {
  const tempDir = resolve(tmpdir(), `verax-static-detect-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('detect reports finding for broken static navigation', async () => {
  const tempDir = createTempDir();
  try {
    const manifestPath = join(tempDir, '.veraxverax', 'learn', 'site-manifest.json');
    const tracesPath = join(tempDir, '.veraxverax', 'observe', 'observation-traces.json');
    const screenshotsDir = join(tempDir, '.veraxverax', 'observe', 'screenshots');
    
    mkdirSync(dirname(manifestPath), { recursive: true });
    mkdirSync(dirname(tracesPath), { recursive: true });
    mkdirSync(screenshotsDir, { recursive: true });
    
    const manifest = {
      version: 1,
      learnedAt: new Date().toISOString(),
      projectDir: tempDir,
      projectType: 'static',
      routes: [
        { path: '/', source: 'index.html', public: true },
        { path: '/about', source: 'about.html', public: true }
      ],
      publicRoutes: ['/', '/about'],
      internalRoutes: [],
      staticExpectations: [
        {
          fromPath: '/',
          type: 'navigation',
          targetPath: '/about',
          evidence: {
            source: 'index.html',
            selectorHint: 'a[href="/about.html"]'
          }
        }
      ],
      notes: []
    };
    
    const screenshot1 = join(screenshotsDir, 'before-123.png');
    const screenshot2 = join(screenshotsDir, 'after-123.png');
    writeFileSync(screenshot1, 'fake-image-data-1');
    writeFileSync(screenshot2, 'fake-image-data-1');
    
    const observation = {
      version: 1,
      observedAt: new Date().toISOString(),
      url: 'file:///test.html',
      traces: [
        {
          interaction: {
            type: 'link',
            selector: 'a',
            label: 'About'
          },
          before: {
            url: 'file:///test.html',
            screenshot: 'screenshots/before-123.png'
          },
          after: {
            url: 'file:///test.html',
            screenshot: 'screenshots/after-123.png'
          }
        }
      ]
    };
    
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    writeFileSync(tracesPath, JSON.stringify(observation, null, 2));
    
    const findings = await detect(manifestPath, tracesPath);
    
    assert.ok(existsSync(findings.findingsPath));
    assert.strictEqual(findings.findings.length, 1);
    assert.strictEqual(findings.findings[0].type, 'silent_failure');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('detect reports no finding for working static navigation', async () => {
  const tempDir = createTempDir();
  try {
    const manifestPath = join(tempDir, '.veraxverax', 'learn', 'site-manifest.json');
    const tracesPath = join(tempDir, '.veraxverax', 'observe', 'observation-traces.json');
    const screenshotsDir = join(tempDir, '.veraxverax', 'observe', 'screenshots');
    
    mkdirSync(dirname(manifestPath), { recursive: true });
    mkdirSync(dirname(tracesPath), { recursive: true });
    mkdirSync(screenshotsDir, { recursive: true });
    
    const manifest = {
      version: 1,
      learnedAt: new Date().toISOString(),
      projectDir: tempDir,
      projectType: 'static',
      routes: [
        { path: '/', source: 'index.html', public: true },
        { path: '/about', source: 'about.html', public: true }
      ],
      publicRoutes: ['/', '/about'],
      internalRoutes: [],
      staticExpectations: [
        {
          fromPath: '/',
          type: 'navigation',
          targetPath: '/about',
          evidence: {
            source: 'index.html',
            selectorHint: 'a[href="/about.html"]'
          }
        }
      ],
      notes: []
    };
    
    const screenshot1 = join(screenshotsDir, 'before-456.png');
    const screenshot2 = join(screenshotsDir, 'after-456.png');
    writeFileSync(screenshot1, 'fake-image-data-1');
    writeFileSync(screenshot2, 'fake-image-data-2');
    
    const observation = {
      version: 1,
      observedAt: new Date().toISOString(),
      url: 'file:///test.html',
      traces: [
        {
          interaction: {
            type: 'link',
            selector: 'a',
            label: 'About'
          },
          before: {
            url: 'file:///test.html',
            screenshot: 'screenshots/before-456.png'
          },
          after: {
            url: 'file:///test.html/about.html',
            screenshot: 'screenshots/after-456.png'
          }
        }
      ]
    };
    
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    writeFileSync(tracesPath, JSON.stringify(observation, null, 2));
    
    const findings = await detect(manifestPath, tracesPath);
    
    assert.ok(existsSync(findings.findingsPath));
    assert.strictEqual(findings.findings.length, 0);
  } finally {
    cleanupTempDir(tempDir);
  }
});

