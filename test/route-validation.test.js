import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { scan } from '../src/verax/index.js';
import { learn } from '../src/verax/learn/index.js';

function createTempDir() {
  const tempDir = resolve(tmpdir(), `verax-route-validation-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('route validation marks reachable routes correctly', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'index.html'), '<html><body><h1>Home</h1></body></html>');
    writeFileSync(join(tempDir, 'pricing.html'), '<html><body><h1>Pricing</h1></body></html>');
    
    const http = await import('http');
    const { createServer } = http;
    const { promisify } = await import('util');
    
    let server = null;
    let port = 0;
    
    try {
      server = createServer((req, res) => {
        if (req.url === '/' || req.url === '/index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(readFileSync(join(tempDir, 'index.html')));
        } else if (req.url === '/pricing.html' || req.url === '/pricing') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(readFileSync(join(tempDir, 'pricing.html')));
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      
      await promisify(server.listen.bind(server))(0);
      port = server.address().port;
      
      const result = await scan(tempDir, `http://localhost:${port}/index.html`);
      
      assert.ok(result.scanSummary);
      const summary = JSON.parse(readFileSync(result.scanSummary.summaryPath, 'utf-8'));
      
      assert.ok(summary.truth.learn.validation);
      assert.ok(summary.truth.learn.validation.routesValidated > 0);
      assert.ok(summary.truth.learn.validation.routesReachable > 0);
      
      const reachableDetails = summary.truth.learn.validation.details.filter(d => d.status === 'REACHABLE');
      assert.ok(reachableDetails.length > 0, 'Should have at least one reachable route');
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

test('route validation marks 404 routes as unreachable', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'index.html'), '<html><body><h1>Home</h1></body></html>');
    writeFileSync(join(tempDir, 'missing.html'), '<html><body><h1>Missing</h1></body></html>');
    
    const http = await import('http');
    const { createServer } = http;
    const { promisify } = await import('util');
    
    let server = null;
    let port = 0;
    
    try {
      server = createServer((req, res) => {
        if (req.url === '/' || req.url === '/index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(readFileSync(join(tempDir, 'index.html')));
        } else if (req.url === '/missing.html' || req.url === '/missing') {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('Not Found');
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      
      await promisify(server.listen.bind(server))(0);
      port = server.address().port;
      
      const result = await scan(tempDir, `http://localhost:${port}/index.html`);
      
      assert.ok(result.scanSummary);
      const summary = JSON.parse(readFileSync(result.scanSummary.summaryPath, 'utf-8'));
      
      assert.ok(summary.truth.learn.validation);
      
      const unreachableDetails = summary.truth.learn.validation.details.filter(d => 
        d.status === 'UNREACHABLE' && (d.reason === 'http_404' || d.httpStatus === 404)
      );
      assert.ok(unreachableDetails.length > 0, 'Should have at least one unreachable route with 404');
      
      assert.ok(summary.truth.learn.validation.routesUnreachable > 0);
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

test('route validation blocks external redirects', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'index.html'), '<html><body><h1>Home</h1></body></html>');
    
    const http = await import('http');
    const { createServer } = http;
    const { promisify } = await import('util');
    
    let server = null;
    let port = 0;
    
    try {
      server = createServer((req, res) => {
        if (req.url === '/' || req.url === '/index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(readFileSync(join(tempDir, 'index.html')));
        } else if (req.url === '/external') {
          res.writeHead(302, { 'Location': 'https://example.com' });
          res.end();
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      
      await promisify(server.listen.bind(server))(0);
      port = server.address().port;
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const manifest = await learn(tempDir);
      const manifestContent = JSON.parse(readFileSync(manifest.manifestPath, 'utf-8'));
      if (!manifestContent.publicRoutes) {
        manifestContent.publicRoutes = [];
      }
      if (!manifestContent.publicRoutes.includes('/external')) {
        manifestContent.publicRoutes.push('/external');
      }
      writeFileSync(manifest.manifestPath, JSON.stringify(manifestContent, null, 2));
      
      const result = await scan(tempDir, `http://localhost:${port}/index.html`, manifest.manifestPath);
      
      assert.ok(result.scanSummary);
      const summary = JSON.parse(readFileSync(result.scanSummary.summaryPath, 'utf-8'));
      
      assert.ok(summary.truth.learn.validation);
      
      const externalDetail = summary.truth.learn.validation.details.find(d => d.path === '/external');
      assert.ok(externalDetail, 'Should have validation detail for /external route');
      
      const externalBlocked = summary.truth.learn.validation.details.find(d => 
        d.path === '/external' && d.status === 'UNREACHABLE' && d.reason === 'external_redirect_blocked'
      );
      if (!externalBlocked) {
        console.log('External detail:', JSON.stringify(externalDetail, null, 2));
      }
      assert.ok(externalBlocked, 'Should mark external redirect as unreachable with external_redirect_blocked reason');
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

