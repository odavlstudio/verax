/**
 * TRUST FIX 2: LIMITED mode exit code regression test
 * 
 * Ensures that when verax runs in LIMITED mode (no source detected),
 * the exit code is 30 (INCOMPLETE), not 1 or any other value.
 * 
 * This test locks the contract stated in VISION.md:
 * "Exit code: 30 (INCOMPLETE)"
 */

import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve } from 'path';

const TEST_DIR = resolve(process.cwd(), 'tmp', 'trust-fix-02-test');
const PORT = 4001;

// Simple fixture HTML with no source code
const FIXTURE_HTML = `
<!DOCTYPE html>
<html>
<body>
  <h1>Test Page</h1>
  <button id="test">Test Button</button>
</body>
</html>
`;

describe('TRUST FIX 2: LIMITED mode exit code contract', () => {
  let fixtureServer;
  
  beforeEach(async () => {
    // Create test directory and fixture
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(resolve(TEST_DIR, 'index.html'), FIXTURE_HTML);
    
    // Start simple HTTP server for fixture
    fixtureServer = spawn('node', [
      '-e',
      `
        const http = require('http');
        const fs = require('fs');
        const path = require('path');
        http.createServer((req, res) => {
          const file = path.join('${TEST_DIR.replace(/\\/g, '\\\\')}', 'index.html');
          res.writeHead(200, {'Content-Type': 'text/html'});
          res.end(fs.readFileSync(file));
        }).listen(${PORT}, () => console.log('ready'));
      `
    ], { stdio: ['ignore', 'pipe', 'inherit'] });
    
    // Wait for server to be ready
    await new Promise((resolve) => {
      fixtureServer.stdout.on('data', (data) => {
        if (data.toString().includes('ready')) {
          resolve();
        }
      });
    });
  });
  
  after(() => {
    if (fixtureServer) {
      fixtureServer.kill();
    }
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  });
  
  it('LIMITED mode (no --src) exits with code 30', async () => {
    const veraxBin = resolve(process.cwd(), 'bin', 'verax.js');
    const outDir = resolve(TEST_DIR, '.verax-limited');
    
    const verax = spawn('node', [
      veraxBin,
      'run',
      '--url', `http://127.0.0.1:${PORT}`,
      '--out', outDir,
      '--min-coverage', '0.5',
    ], { stdio: 'pipe' });
    
    let output = '';
    verax.stdout.on('data', (data) => {
      output += data.toString();
    });
    verax.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    const exitCode = await new Promise((resolve) => {
      verax.on('close', (code) => {
        resolve(code);
      });
    });
    
    // CRITICAL: Exit code MUST be 30 for LIMITED mode
    assert.strictEqual(
      exitCode,
      30,
      `LIMITED mode must exit with code 30 (INCOMPLETE), got ${exitCode}.\nOutput:\n${output}`
    );
    
    // Verify output mentions LIMITED mode or source not detected
    assert.ok(
      output.includes('Source: not detected') ||
      output.includes('LIMITED') ||
      output.includes('INCOMPLETE'),
      `Output should mention LIMITED mode or INCOMPLETE status.\nGot:\n${output}`
    );
  });
});
