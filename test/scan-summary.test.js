import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { scan } from '../src/verax/index.js';

function createTempDir() {
  const tempDir = resolve(tmpdir(), `verax-scan-summary-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('scan-summary.json is written for static project', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'index.html'), '<html><body><a href="/about.html">About</a></body></html>');
    writeFileSync(join(tempDir, 'about.html'), '<html><body><h1>About</h1></body></html>');
    
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
      
      const result = await scan(tempDir, `http://localhost:${port}/index.html`);
      
      assert.ok(result.scanSummary);
      assert.ok(existsSync(result.scanSummary.summaryPath));
      
      const summary = JSON.parse(readFileSync(result.scanSummary.summaryPath, 'utf-8'));
      assert.strictEqual(summary.version, 1);
      assert.strictEqual(summary.projectType, 'static');
      assert.ok(summary.truth);
      assert.ok(summary.truth.learn);
      assert.strictEqual(summary.truth.learn.routesSource, 'static_html');
      assert.strictEqual(summary.truth.learn.routesConfidence, 'HIGH');
      assert.ok(Array.isArray(summary.truth.learn.warnings));
      assert.ok(Array.isArray(summary.truth.learn.limitations));
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

test('scan-summary.json includes REACT_ROUTE_EXTRACTION_FRAGILE warning for react_spa', async () => {
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
    writeFileSync(join(tempDir, 'index.html'), '<html><body><div id="root"></div></body></html>');
    
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
      
      const result = await scan(tempDir, `http://localhost:${port}/index.html`);
      
      assert.ok(result.scanSummary);
      const summary = JSON.parse(readFileSync(result.scanSummary.summaryPath, 'utf-8'));
      
      assert.strictEqual(summary.projectType, 'react_spa');
      assert.strictEqual(summary.truth.learn.routesSource, 'react_router_regex');
      assert.strictEqual(summary.truth.learn.routesConfidence, 'MEDIUM');
      
      const fragileWarning = summary.truth.learn.warnings.find(w => w.code === 'REACT_ROUTE_EXTRACTION_FRAGILE');
      assert.ok(fragileWarning, 'Should include REACT_ROUTE_EXTRACTION_FRAGILE warning');
      assert.ok(fragileWarning.message.includes('regex'));
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

test('scan-summary.json tracks skipped interactions with no expectation', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'index.html'), '<html><body><button>Generic Button</button></body></html>');
    
    const http = await import('http');
    const { createServer } = http;
    const { promisify } = await import('util');
    
    const server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(readFileSync(join(tempDir, 'index.html')));
    });
    
    await promisify(server.listen.bind(server))(0);
    const port = server.address().port;
    
    try {
      const result = await scan(tempDir, `http://localhost:${port}/index.html`);
      
      assert.ok(result.scanSummary);
      const summary = JSON.parse(readFileSync(result.scanSummary.summaryPath, 'utf-8'));
      
      assert.ok(summary.truth.detect);
      assert.ok(typeof summary.truth.detect.interactionsSkippedNoExpectation === 'number');
      assert.ok(summary.truth.detect.interactionsSkippedNoExpectation >= 0);
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

