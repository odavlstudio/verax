import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { tmpdir } from 'os';
import { learn } from '../src/verax/learn/index.js';
import { detect } from '../src/verax/detect/index.js';

function createTempDir() {
  const tempDir = resolve(tmpdir(), `verax-static-buttons-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('learn extracts button navigation expectations from data-href', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'index.html'), `
      <!DOCTYPE html>
      <html>
      <body>
        <button id="test-button" data-href="/about.html">Go to About</button>
      </body>
      </html>
    `);
    writeFileSync(join(tempDir, 'about.html'), '<html><body><h1>About</h1></body></html>');
    
    const manifest = await learn(tempDir);
    
    assert.ok(manifest.staticExpectations);
    const buttonExpectation = manifest.staticExpectations.find(e => 
      e.type === 'navigation' && 
      e.evidence.selectorHint === '#test-button' &&
      e.targetPath === '/about'
    );
    assert.ok(buttonExpectation, 'Should extract button navigation expectation');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('learn extracts form submission expectations', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'index.html'), `
      <!DOCTYPE html>
      <html>
      <body>
        <form id="contact-form" action="/submit.html">
          <button type="submit">Submit</button>
        </form>
      </body>
      </html>
    `);
    writeFileSync(join(tempDir, 'submit.html'), '<html><body><h1>Submit</h1></body></html>');
    
    const manifest = await learn(tempDir);
    
    assert.ok(manifest.staticExpectations);
    const formExpectation = manifest.staticExpectations.find(e => 
      e.type === 'form_submission' && 
      e.evidence.selectorHint === '#contact-form' &&
      e.targetPath === '/submit'
    );
    assert.ok(formExpectation, 'Should extract form submission expectation');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('learn does not extract expectations for generic buttons', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'index.html'), `
      <!DOCTYPE html>
      <html>
      <body>
        <button id="generic-button">Generic Button</button>
      </body>
      </html>
    `);
    
    const manifest = await learn(tempDir);
    
    const buttonExpectations = manifest.staticExpectations?.filter(e => 
      e.evidence.selectorHint === '#generic-button'
    ) || [];
    
    assert.strictEqual(buttonExpectations.length, 0, 'Should not extract expectation for generic button');
  } finally {
    cleanupTempDir(tempDir);
  }
});

