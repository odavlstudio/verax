import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { observe } from '../src/verax/observe/index.js';
import { createScanBudget } from '../src/verax/shared/scan-budget.js';
import { generateRunId } from '../src/verax/shared/artifact-manager.js';

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

test('observe blocks external navigation', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'index.html'), `
      <!DOCTYPE html>
      <html>
      <head><title>Test</title></head>
      <body>
        <a href="https://example.com" id="external-link">External</a>
        <a href="/about.html" id="internal-link">Internal</a>
      </body>
      </html>
    `);
    writeFileSync(join(tempDir, 'about.html'), '<html><body><h1>About</h1></body></html>');
    
    const http = await import('http');
    const { createServer } = http;
    const { promisify } = await import('util');
    
    const server = createServer((req, res) => {
      if (req.url === '/index.html' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFileSync(join(tempDir, 'index.html')));
      } else if (req.url === '/about.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFileSync(join(tempDir, 'about.html')));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    
    await promisify(server.listen.bind(server))(8004);
    
    try {
      const runId = generateRunId();
      const result = await observe('http://localhost:8004/index.html', null, null, {}, process.cwd(), runId);

      assert.ok(existsSync(result.tracesPath));
      const traces = JSON.parse(readFileSync(result.tracesPath, 'utf-8'));
      
      const externalTrace = traces.traces.find(t => 
        t.interaction.selector.includes('external-link') || 
        (t.policy && t.policy.externalNavigationBlocked)
      );
      
      assert.ok(externalTrace, 'External navigation should be blocked');
      assert.ok(externalTrace.policy);
      assert.strictEqual(externalTrace.policy.externalNavigationBlocked, true);
      assert.ok(externalTrace.policy.blockedUrl);
    } finally {
      await promisify(server.close.bind(server))();
    }
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('observe discovers buttons and forms', { timeout: 45000 }, async () => {
  const tempDir = createTempDir();
  let server = null;
  try {
    writeFileSync(join(tempDir, 'index.html'), `
      <!DOCTYPE html>
      <html>
      <head><title>Test</title></head>
      <body>
        <button id="test-button">Test Button</button>
        <form>
          <button type="submit" id="submit-btn">Submit</button>
        </form>
        <input type="button" id="input-btn" value="Input Button" />
      </body>
      </html>
    `);
    
    const http = await import('http');
    const { createServer } = http;
    const { promisify } = await import('util');
    
    server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(readFileSync(join(tempDir, 'index.html')));
    });
    
    await promisify(server.listen.bind(server))(8005);
    
    const fastBudget = createScanBudget({
      maxScanDurationMs: 10000,
      maxInteractionsPerPage: 3,
      interactionTimeoutMs: 2000,
      navigationTimeoutMs: 2000,
      stabilizationWindowMs: 600,
      stabilizationSampleMidMs: 150,
      stabilizationSampleEndMs: 300,
      navigationStableWaitMs: 200,
      networkWaitMs: 100,
      settleTimeoutMs: 5000,
      settleIdleMs: 500,
      settleDomStableMs: 500
    });

const runId = generateRunId();
      const result = await observe('http://localhost:8005/index.html', null, fastBudget, { allowWrites: true }, process.cwd(), runId);
    
    assert.ok(existsSync(result.tracesPath));
    const traces = JSON.parse(readFileSync(result.tracesPath, 'utf-8'));
    
    const buttonTrace = traces.traces.find(t => t.interaction.type === 'button');
    const formTrace = traces.traces.find(t => t.interaction.type === 'form');
    
    assert.ok(buttonTrace, 'Should discover button');
    assert.ok(formTrace, 'Should discover form');
  } finally {
    if (server) {
      await new Promise((resolve) => {
        server.close(() => resolve());
        setTimeout(resolve, 1000);
      });
    }
    cleanupTempDir(tempDir);
  }
});

test('observe generates quality selectors', { timeout: 60000 }, async () => {
  const tempDir = createTempDir();
  let server = null;
  try {
    writeFileSync(join(tempDir, 'index.html'), `
      <!DOCTYPE html>
      <html>
      <head><title>Test</title></head>
      <body>
        <button id="test-button">Test</button>
        <button data-testid="test-button-2">Test 2</button>
        <a href="/about.html" id="test-link">Link</a>
      </body>
      </html>
    `);
    
    const http = await import('http');
    const { createServer } = http;
    const { promisify } = await import('util');
    
    server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(readFileSync(join(tempDir, 'index.html')));
    });
    
    await promisify(server.listen.bind(server))(8006);
    
const runId = generateRunId();
      const result = await observe('http://localhost:8006/index.html', null, null, {}, process.cwd(), runId);
    
    assert.ok(existsSync(result.tracesPath));
    const traces = JSON.parse(readFileSync(result.tracesPath, 'utf-8'));
    
    const idButton = traces.traces.find(t => t.interaction.selector === '#test-button');
    const testIdButton = traces.traces.find(t => t.interaction.selector.includes('data-testid'));
    const idLink = traces.traces.find(t => t.interaction.selector === '#test-link');
    
    assert.ok(idButton, 'Should use #id selector for button with id');
    assert.ok(testIdButton, 'Should use data-testid selector when available');
    assert.ok(idLink, 'Should use #id selector for link with id');
    
    const genericSelectors = traces.traces.filter(t => 
      t.interaction.selector === 'a' || t.interaction.selector === 'button'
    );
    assert.strictEqual(genericSelectors.length, 0, 'Should avoid generic selectors when possible');
  } finally {
    if (server) {
      await new Promise((resolve) => {
        server.close(() => resolve());
        setTimeout(resolve, 1000);
      });
    }
    cleanupTempDir(tempDir);
  }
});

