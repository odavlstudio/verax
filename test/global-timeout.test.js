/**
 * Global Timeout Stability Test
 * 
 * Tests that VERAX commands cannot hang silently and will terminate
 * within the global watchdog timeout, even if operations would normally hang.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'child_process';
import { resolve as pathResolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { startFixtureServer } from './helpers/fixture-server.helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = pathResolve(__dirname, 'fixtures');
const staticSiteDir = pathResolve(fixturesDir, 'static-site');

// Helper to run CLI command with timeout
function runCLIWithTimeout(args, cwd, timeoutMs = 120000) {
  return new Promise((resolve) => {
    const cliPath = pathResolve(__dirname, '..', 'bin', 'verax.js');
    const proc = spawn('node', [cliPath, ...args], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32'
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();  // Use default signal to avoid Windows interactive prompts
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill();  // Retry if still running
          }
        }, 5000);
        resolve({ code: null, stdout, stderr, timedOut: true });
      }
    }, timeoutMs);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ code: code !== null ? code : (stderr ? 1 : 0), stdout, stderr, timedOut: false });
      }
    });

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ code: 1, stdout, stderr, error: err.message, timedOut: false });
      }
    });
  });
}

describe('Global Timeout Stability', () => {
  let fixtureServer = null;
  let serverUrl = null;

  test('before: start fixture server', async () => {
    fixtureServer = await startFixtureServer(staticSiteDir, 0);
    serverUrl = fixtureServer.url;
    assert.ok(serverUrl, 'Fixture server should start');
  });

  test('verax run terminates within global timeout', async () => {
    // Create a minimal test project that will trigger observation phase
    const testProjectDir = pathResolve(__dirname, 'tmp', 'timeout-test');
    const { mkdirSync, writeFileSync } = await import('fs');
    const { existsSync } = await import('fs');
    
    try {
      if (!existsSync(testProjectDir)) {
        mkdirSync(testProjectDir, { recursive: true });
      }
      
      // Create a simple HTML file with a link
      const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <a href="/page2.html">Go to page 2</a>
</body>
</html>`;
      
      writeFileSync(pathResolve(testProjectDir, 'index.html'), htmlContent);
      
      // Create package.json
      writeFileSync(pathResolve(testProjectDir, 'package.json'), JSON.stringify({
        name: 'timeout-test',
        version: '1.0.0'
      }, null, 2));
      
      // Run verax with a URL that will cause observation
      // The global timeout should be around 40 minutes for default mode
      // But we'll test with a smaller project that should complete faster
      // If it hangs, it should still timeout within the global limit
      const startTime = Date.now();
      const _result = await runCLIWithTimeout(
        ['run', '--url', serverUrl, '--src', '.', '--out', '.verax'],
        testProjectDir,
        180000 // 3 minutes - should be less than global timeout for small project
      );
      const elapsed = Date.now() - startTime;
      
      // Command should complete (either success or timeout) within reasonable time
      // For a small project, it should complete in under 2 minutes
      // If it took longer than 2.5 minutes, it might have hung
      assert.ok(
        elapsed < 150000, // 2.5 minutes
        `Command should complete within 2.5 minutes, but took ${elapsed}ms`
      );
      
      // Check that run.status.json exists (even if failed)
      const veraxDir = pathResolve(testProjectDir, '.verax');
      if (existsSync(veraxDir)) {
        const runsDir = pathResolve(veraxDir, 'runs');
        if (existsSync(runsDir)) {
          const runs = await import('fs').then(fs => fs.readdirSync(runsDir));
          if (runs.length > 0) {
            const runDir = pathResolve(runsDir, runs[0]);
            const statusPath = pathResolve(runDir, 'run.status.json');
            if (existsSync(statusPath)) {
              const status = JSON.parse(readFileSync(statusPath, 'utf8'));
              // Status should be either COMPLETE or FAILED, never RUNNING
              assert.ok(
                status.status === 'COMPLETE' || status.status === 'FAILED',
                `Run status should be COMPLETE or FAILED, got ${status.status}`
              );
            }
          }
        }
      }
    } finally {
      // Cleanup
      try {
        const { rmSync } = await import('fs');
        if (existsSync(testProjectDir)) {
          rmSync(testProjectDir, { recursive: true, force: true });
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  test('after: stop fixture server', async () => {
    if (fixtureServer && fixtureServer.close) {
      await fixtureServer.close();
    }
  });
});

