import { test } from 'node:test';
import assert from 'node:assert';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { detect } from '../src/verax/detect/index.js';
import { generateRunId } from '../src/verax/shared/artifact-manager.js';

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
    const runId = generateRunId();
    const runDir = join(tempDir, '.verax', 'runs', runId);
    const manifestPath = join(runDir, 'site-manifest.json');
    const tracesPath = join(runDir, 'observation-traces.json');
    const screenshotsDir = join(runDir, 'evidence', 'screenshots');
    
    mkdirSync(runDir, { recursive: true });
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
          id: 'nav-to-about',
          fromPath: '/',
          type: 'navigation',
          targetPath: '/about',
          evidence: {
            source: 'index.html',
            selectorHint: 'a[href="/about.html"]'
          },
          proof: 'PROVEN_EXPECTATION'
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
          expectationDriven: true,
          expectationId: 'nav-to-about',
          expectationOutcome: 'SILENT_FAILURE',
          interaction: {
            type: 'link',
            selector: 'a[href="/about.html"]',
            label: 'About'
          },
          before: {
            url: 'file:///test.html',
            screenshot: 'before-123.png'
          },
          after: {
            url: 'file:///test.html',
            screenshot: 'after-123.png'
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
    const runId = generateRunId();
    const runDir = join(tempDir, '.verax', 'runs', runId);
    const manifestPath = join(runDir, 'site-manifest.json');
    const tracesPath = join(runDir, 'observation-traces.json');
    const screenshotsDir = join(runDir, 'evidence', 'screenshots');
    
    mkdirSync(runDir, { recursive: true });
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
            screenshot: 'before-456.png'
          },
          after: {
            url: 'file:///test.html/about.html',
            screenshot: 'after-456.png'
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

