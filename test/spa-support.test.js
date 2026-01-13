import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { learn } from '../src/verax/learn/index.js';
import { observe } from '../src/verax/observe/index.js';
import { detect } from '../src/verax/detect/index.js';
import { generateRunId } from '../src/verax/shared/artifact-manager.js';

function createTempDir() {
  const tempDir = resolve(tmpdir(), `verax-spa-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('learn detects React SPA project type', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      dependencies: {
        react: '^18.0.0'
      }
    }));
    
    const manifest = await learn(tempDir);
    
    assert.strictEqual(manifest.projectType, 'react_spa');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('learn extracts routes from react-router-dom', async () => {
  const tempDir = createTempDir();
  try {
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      dependencies: {
        react: '^18.0.0',
        'react-router-dom': '^6.0.0'
      }
    }));
    writeFileSync(join(tempDir, 'src', 'App.js'), `
      import { Routes, Route } from 'react-router-dom';
      function App() {
        return (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
          </Routes>
        );
      }
    `);
    
    const manifest = await learn(tempDir);
    
    assert.strictEqual(manifest.projectType, 'react_spa');
    assert.ok(manifest.routes.length >= 2);
    assert.ok(manifest.routes.some(r => r.path === '/'));
    assert.ok(manifest.routes.some(r => r.path === '/about'));
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('observe captures DOM signatures', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'index.html'), `
      <!DOCTYPE html>
      <html>
      <body>
        <div id="content">Initial Content</div>
        <button id="change-btn" onclick="document.getElementById('content').textContent='Changed Content'">Change</button>
      </body>
      </html>
    `);
    
    const http = await import('http');
    const { createServer } = http;
    const { promisify } = await import('util');
    
    let server = null;
    let port = 0;
    
    try {
      server = createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFileSync(join(tempDir, 'index.html')));
      });
      
      await promisify(server.listen.bind(server))(0);
      port = server.address().port;
      
      const result = await observe(`http://localhost:${port}/index.html`);
      
      assert.ok(existsSync(result.tracesPath));
      const traces = JSON.parse(readFileSync(result.tracesPath, 'utf-8'));
      
      const traceWithDom = traces.traces.find(t => t.dom && t.dom.beforeHash && t.dom.afterHash);
      assert.ok(traceWithDom, 'Should capture DOM signatures');
      assert.ok(traceWithDom.dom.beforeHash);
      assert.ok(traceWithDom.dom.afterHash);
    } finally {
      if (server) {
        await new Promise((resolve) => {
          server.close(() => resolve());
          setTimeout(resolve, 1000);
        });
      }
    }
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('detect uses DOM hash changes as effect signal', async () => {
  const tempDir = createTempDir();
  try {
    const runId = generateRunId();
    const runDir = join(tempDir, '.verax', 'runs', runId);
    const manifestPath = join(runDir, 'site-manifest.json');
    const tracesPath = join(runDir, 'observation-traces.json');
    
    mkdirSync(runDir, { recursive: true });
    
    const manifest = {
      version: 1,
      learnedAt: new Date().toISOString(),
      projectDir: tempDir,
      projectType: 'react_spa',
      routes: [
        { path: '/', source: 'App.js', public: true },
        { path: '/about', source: 'App.js', public: true }
      ],
      publicRoutes: ['/', '/about'],
      internalRoutes: [],
      notes: []
    };
    
    const observation = {
      version: 1,
      observedAt: new Date().toISOString(),
      url: 'http://localhost:8011/index.html',
      traces: [
        {
          interaction: {
            type: 'link',
            selector: '#about-link',
            label: 'About'
          },
          before: {
            url: 'http://localhost:8011/index.html',
            screenshot: 'screenshots/before-1.png'
          },
          after: {
            url: 'http://localhost:8011/index.html',
            screenshot: 'screenshots/after-1.png'
          },
          dom: {
            beforeHash: 'hash1',
            afterHash: 'hash2'
          }
        }
      ]
    };
    
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    writeFileSync(tracesPath, JSON.stringify(observation, null, 2));
    
    const findings = await detect(manifestPath, tracesPath);
    
    assert.ok(existsSync(findings.findingsPath));
    assert.strictEqual(findings.findings.length, 0, 'Should not report failure when DOM hash changes');
  } finally {
    cleanupTempDir(tempDir);
  }
});

