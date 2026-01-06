import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { tmpdir } from 'os';
import { learn } from '../src/verax/learn/index.js';

function createTempDir() {
  const tempDir = resolve(tmpdir(), `verax-static-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('learn detects static project type', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'index.html'), '<html><body><h1>Home</h1></body></html>');
    writeFileSync(join(tempDir, 'about.html'), '<html><body><h1>About</h1></body></html>');
    
    const manifest = await learn(tempDir);
    
    assert.strictEqual(manifest.projectType, 'static');
    assert.ok(manifest.routes.length >= 2);
    assert.ok(manifest.routes.some(r => r.path === '/'));
    assert.ok(manifest.routes.some(r => r.path === '/about'));
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('learn extracts static expectations from HTML links', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'index.html'), '<html><body><a href="/about.html">About</a></body></html>');
    writeFileSync(join(tempDir, 'about.html'), '<html><body><h1>About</h1></body></html>');
    
    const manifest = await learn(tempDir);
    
    assert.ok(manifest.staticExpectations);
    assert.ok(Array.isArray(manifest.staticExpectations));
    assert.ok(manifest.staticExpectations.length > 0);
    
    const navExpectation = manifest.staticExpectations.find(e => 
      e.type === 'navigation' && e.fromPath === '/' && e.targetPath === '/about'
    );
    assert.ok(navExpectation);
    assert.ok(navExpectation.evidence);
    assert.strictEqual(navExpectation.evidence.source, 'index.html');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('learn handles nested HTML files', async () => {
  const tempDir = createTempDir();
  try {
    mkdirSync(join(tempDir, 'pricing'), { recursive: true });
    writeFileSync(join(tempDir, 'index.html'), '<html><body><h1>Home</h1></body></html>');
    writeFileSync(join(tempDir, 'pricing', 'index.html'), '<html><body><h1>Pricing</h1></body></html>');
    
    const manifest = await learn(tempDir);
    
    assert.ok(manifest.routes.some(r => r.path === '/'));
    assert.ok(manifest.routes.some(r => r.path === '/pricing'));
  } finally {
    cleanupTempDir(tempDir);
  }
});

