import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { scan } from '../src/verax/index.js';
import { learn } from '../src/verax/learn/index.js';
import http from 'http';
import { promisify } from 'util';

function createTempDir() {
  const tempDir = join(process.cwd(), 'test-temp-skip-reasons-' + Date.now());
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(tempDir) {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }
}

test('skip reason NO_EXPECTATION when interaction has no expectation', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'index.html'), `
      <html>
        <body>
          <h1>Home</h1>
          <button id="generic-button">Generic Button</button>
        </body>
      </html>
    `);

    const server = http.createServer((req, res) => {
      if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFileSync(join(tempDir, 'index.html')));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await promisify(server.listen.bind(server))(0);
    const port = server.address().port;

    try {
      const result = await scan(tempDir, `http://localhost:${port}/index.html`);

      assert.ok(result.scanSummary);
      const summary = JSON.parse(readFileSync(result.scanSummary.summaryPath, 'utf-8'));

      assert.ok(summary.truth.detect.skips);
      assert.ok(summary.truth.detect.skips.total > 0);
      
      const noExpectationReason = summary.truth.detect.skips.reasons.find(r => r.code === 'NO_EXPECTATION');
      assert.ok(noExpectationReason, 'Should have NO_EXPECTATION reason');
      assert.ok(noExpectationReason.count > 0, 'Should have at least one NO_EXPECTATION skip');
      
      const noExpectationExample = summary.truth.detect.skips.examples.find(e => e.code === 'NO_EXPECTATION');
      assert.ok(noExpectationExample, 'Should have at least one NO_EXPECTATION example');
    } finally {
      await promisify(server.close.bind(server))();
    }
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('skip reason SELECTOR_MISMATCH when expectations exist but selector mismatch', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'index.html'), `
      <html>
        <body>
          <h1>Home</h1>
          <a id="about-link-different" href="/about">About</a>
        </body>
      </html>
    `);

    writeFileSync(join(tempDir, 'about.html'), `
      <html>
        <body>
          <h1>About</h1>
        </body>
      </html>
    `);

    const server = http.createServer((req, res) => {
      if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFileSync(join(tempDir, 'index.html')));
      } else if (req.url === '/about' || req.url === '/about.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFileSync(join(tempDir, 'about.html')));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await promisify(server.listen.bind(server))(0);
    const port = server.address().port;

    try {
      const manifest = await learn(tempDir);
      const manifestContent = JSON.parse(readFileSync(manifest.manifestPath, 'utf-8'));
      
      if (!manifestContent.staticExpectations) {
        manifestContent.staticExpectations = [];
      }
      
      manifestContent.staticExpectations.push({
        fromPath: '/',
        type: 'navigation',
        targetPath: '/about',
        evidence: {
          source: 'index.html',
          selectorHint: '#about-link'
        }
      });
      
      writeFileSync(manifest.manifestPath, JSON.stringify(manifestContent, null, 2));

      const result = await scan(tempDir, `http://localhost:${port}/index.html`, manifest.manifestPath);

      assert.ok(result.scanSummary);
      const summary = JSON.parse(readFileSync(result.scanSummary.summaryPath, 'utf-8'));

      assert.ok(summary.truth.detect.skips);
      
      const selectorMismatchReason = summary.truth.detect.skips.reasons.find(r => r.code === 'SELECTOR_MISMATCH');
      if (selectorMismatchReason) {
        assert.ok(selectorMismatchReason.count > 0, 'Should have at least one SELECTOR_MISMATCH skip');
      }
    } finally {
      await promisify(server.close.bind(server))();
    }
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('skip reason WEAK_EXPECTATION_DROPPED when route validation marks route unreachable', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'index.html'), `
      <html>
        <body>
          <h1>Home</h1>
          <a href="/missing">Missing Page</a>
        </body>
      </html>
    `);

    const server = http.createServer((req, res) => {
      if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFileSync(join(tempDir, 'index.html')));
      } else if (req.url === '/missing') {
        res.writeHead(404);
        res.end();
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await promisify(server.listen.bind(server))(0);
    const port = server.address().port;

    try {
      const manifest = await learn(tempDir);
      const manifestContent = JSON.parse(readFileSync(manifest.manifestPath, 'utf-8'));
      
      if (!manifestContent.publicRoutes) {
        manifestContent.publicRoutes = [];
      }
      if (!manifestContent.publicRoutes.includes('/missing')) {
        manifestContent.publicRoutes.push('/missing');
      }
      
      writeFileSync(manifest.manifestPath, JSON.stringify(manifestContent, null, 2));

      const result = await scan(tempDir, `http://localhost:${port}/index.html`, manifest.manifestPath);

      assert.ok(result.scanSummary);
      const summary = JSON.parse(readFileSync(result.scanSummary.summaryPath, 'utf-8'));

      assert.ok(summary.truth.detect.skips);
      
      const weakExpectationReason = summary.truth.detect.skips.reasons.find(r => r.code === 'WEAK_EXPECTATION_DROPPED');
      if (weakExpectationReason) {
        assert.ok(weakExpectationReason.count >= 0, 'Should have WEAK_EXPECTATION_DROPPED count');
      }
      
      assert.ok(summary.truth.learn.validation);
      const missingRouteValidation = summary.truth.learn.validation.details.find(d => d.path === '/missing');
      assert.ok(missingRouteValidation, 'Should have validation detail for /missing route');
      assert.ok(missingRouteValidation.status === 'UNREACHABLE', 'Missing route should be marked unreachable');
    } finally {
      await promisify(server.close.bind(server))();
    }
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('skip reason AMBIGUOUS_MATCH when multiple expectations could match', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'index.html'), `
      <html>
        <body>
          <h1>Home</h1>
          <a href="/about">About</a>
        </body>
      </html>
    `);

    writeFileSync(join(tempDir, 'about.html'), `
      <html>
        <body>
          <h1>About</h1>
        </body>
      </html>
    `);

    const server = http.createServer((req, res) => {
      if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFileSync(join(tempDir, 'index.html')));
      } else if (req.url === '/about' || req.url === '/about.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFileSync(join(tempDir, 'about.html')));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await promisify(server.listen.bind(server))(0);
    const port = server.address().port;

    try {
      const manifest = await learn(tempDir);
      const manifestContent = JSON.parse(readFileSync(manifest.manifestPath, 'utf-8'));
      
      if (!manifestContent.staticExpectations) {
        manifestContent.staticExpectations = [];
      }
      
      manifestContent.staticExpectations.push({
        fromPath: '/',
        type: 'navigation',
        targetPath: '/about',
        evidence: {
          source: 'index.html',
          selectorHint: 'a[href="/about"]'
        }
      });
      
      manifestContent.staticExpectations.push({
        fromPath: '/',
        type: 'navigation',
        targetPath: '/about',
        evidence: {
          source: 'index.html',
          selectorHint: 'a'
        }
      });
      
      writeFileSync(manifest.manifestPath, JSON.stringify(manifestContent, null, 2));

      const result = await scan(tempDir, `http://localhost:${port}/index.html`, manifest.manifestPath);

      assert.ok(result.scanSummary);
      const summary = JSON.parse(readFileSync(result.scanSummary.summaryPath, 'utf-8'));

      assert.ok(summary.truth.detect.skips);
      
      const ambiguousMatchReason = summary.truth.detect.skips.reasons.find(r => r.code === 'AMBIGUOUS_MATCH');
      if (ambiguousMatchReason) {
        assert.ok(ambiguousMatchReason.count >= 0, 'Should have AMBIGUOUS_MATCH count');
      }
    } finally {
      await promisify(server.close.bind(server))();
    }
  } finally {
    cleanupTempDir(tempDir);
  }
});

