import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { tmpdir } from 'os';
import { detect } from '../src/verax/detect/index.js';

function createTempDir() {
  const tempDir = resolve(tmpdir(), `verax-detect-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('detect finds silent failure when expected navigation does not occur', async () => {
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
      projectType: 'nextjs_app_router',
      routes: [
        { path: '/', source: 'app/page.tsx', public: true },
        { path: '/about', source: 'app/about/page.tsx', public: true }
      ],
      publicRoutes: ['/', '/about'],
      internalRoutes: [],
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
            type: 'button',
            selector: '#about-button',
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
    assert.strictEqual(findings.findings[0].interaction.type, 'button');
    assert.strictEqual(findings.findings[0].interaction.label, 'About');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('detect does not report failure when navigation occurs', async () => {
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
      projectType: 'nextjs_app_router',
      routes: [
        { path: '/', source: 'app/page.tsx', public: true },
        { path: '/about', source: 'app/about/page.tsx', public: true }
      ],
      publicRoutes: ['/', '/about'],
      internalRoutes: [],
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
            selector: 'a.about-link',
            label: 'About'
          },
          before: {
            url: 'file:///test.html',
            screenshot: 'screenshots/before-456.png'
          },
          after: {
            url: 'file:///test.html/about',
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

test('detect does not report failure when visible change occurs', async () => {
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
      projectType: 'nextjs_app_router',
      routes: [
        { path: '/', source: 'app/page.tsx', public: true }
      ],
      publicRoutes: ['/'],
      internalRoutes: [],
      notes: []
    };
    
    const screenshot1 = join(screenshotsDir, 'before-789.png');
    const screenshot2 = join(screenshotsDir, 'after-789.png');
    writeFileSync(screenshot1, 'fake-image-data-1');
    writeFileSync(screenshot2, 'fake-image-data-2');
    
    const observation = {
      version: 1,
      observedAt: new Date().toISOString(),
      url: 'file:///test.html',
      traces: [
        {
          interaction: {
            type: 'button',
            selector: '#submit-button',
            label: 'Submit'
          },
          before: {
            url: 'file:///test.html',
            screenshot: 'screenshots/before-789.png'
          },
          after: {
            url: 'file:///test.html',
            screenshot: 'screenshots/after-789.png'
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

test('detect generates findings.json with correct schema', async () => {
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
      projectType: 'nextjs_app_router',
      routes: [
        { path: '/', source: 'app/page.tsx', public: true }
      ],
      publicRoutes: ['/'],
      internalRoutes: [],
      notes: []
    };
    
    const screenshot1 = join(screenshotsDir, 'before-999.png');
    const screenshot2 = join(screenshotsDir, 'after-999.png');
    writeFileSync(screenshot1, 'fake-image-data-1');
    writeFileSync(screenshot2, 'fake-image-data-1');
    
    const observation = {
      version: 1,
      observedAt: new Date().toISOString(),
      url: 'file:///test.html',
      traces: [
        {
          interaction: {
            type: 'button',
            selector: '#test-button',
            label: 'Go'
          },
          before: {
            url: 'file:///test.html',
            screenshot: 'screenshots/before-999.png'
          },
          after: {
            url: 'file:///test.html',
            screenshot: 'screenshots/after-999.png'
          }
        }
      ]
    };
    
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    writeFileSync(tracesPath, JSON.stringify(observation, null, 2));
    
    const findings = await detect(manifestPath, tracesPath);
    
    const findingsContent = JSON.parse(readFileSync(findings.findingsPath, 'utf-8'));
    assert.strictEqual(findingsContent.version, 1);
    assert.ok(findingsContent.detectedAt);
    assert.strictEqual(typeof findingsContent.url, 'string');
    assert.ok(Array.isArray(findingsContent.findings));
    assert.ok(Array.isArray(findingsContent.notes));
    
    if (findingsContent.findings.length > 0) {
      const finding = findingsContent.findings[0];
      assert.strictEqual(finding.type, 'silent_failure');
      assert.ok(finding.interaction);
      assert.strictEqual(typeof finding.interaction.type, 'string');
      assert.strictEqual(typeof finding.interaction.selector, 'string');
      assert.strictEqual(typeof finding.reason, 'string');
      assert.ok(finding.evidence);
      assert.strictEqual(typeof finding.evidence.before, 'string');
      assert.strictEqual(typeof finding.evidence.after, 'string');
      assert.strictEqual(typeof finding.evidence.beforeUrl, 'string');
      assert.strictEqual(typeof finding.evidence.afterUrl, 'string');
    }
  } finally {
    cleanupTempDir(tempDir);
  }
});

