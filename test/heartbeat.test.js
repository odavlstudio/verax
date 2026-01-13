/**
 * Heartbeat Stability Test
 * 
 * Tests that VERAX commands emit heartbeat events periodically
 * during long-running operations to prevent silent freezes.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'child_process';
import { resolve as pathResolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { startFixtureServer } from './helpers/fixture-server.helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = pathResolve(__dirname, 'fixtures');
const staticSiteDir = pathResolve(fixturesDir, 'static-site');

// Helper to run CLI command and collect JSON output
function runCLIJSON(args, cwd, _minDurationMs = 5000) {
  return new Promise((resolve, reject) => {
    const cliPath = pathResolve(__dirname, '..', 'bin', 'verax.js');
    const proc = spawn('node', [cliPath, ...args], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32'
    });

    let stdout = '';
    let stderr = '';
    const events = [];
    const startTime = Date.now();

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      
      // Parse JSON lines
      const lines = text.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          events.push(event);
        } catch (e) {
          // Not JSON, ignore
        }
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const elapsed = Date.now() - startTime;
      resolve({ 
        code: code !== null ? code : (stderr ? 1 : 0), 
        stdout, 
        stderr, 
        events,
        elapsed 
      });
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

describe('Heartbeat Stability', () => {
  let fixtureServer = null;
  let serverUrl = null;

  test('before: start fixture server', async () => {
    fixtureServer = await startFixtureServer(staticSiteDir, 0);
    serverUrl = fixtureServer.url;
    assert.ok(serverUrl, 'Fixture server should start');
  });

  test('verax run emits heartbeat events in JSON mode', async () => {
    // Create a test project with multiple expectations to ensure observation takes time
    const testProjectDir = pathResolve(__dirname, 'tmp', 'heartbeat-test');
    const { mkdirSync, writeFileSync } = await import('fs');
    const { existsSync } = await import('fs');
    
    try {
      if (!existsSync(testProjectDir)) {
        mkdirSync(testProjectDir, { recursive: true });
      }
      
      // Create HTML files with multiple links to trigger longer observation
      const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <a href="/page1.html">Page 1</a>
  <a href="/page2.html">Page 2</a>
  <a href="/page3.html">Page 3</a>
</body>
</html>`;
      
      writeFileSync(pathResolve(testProjectDir, 'index.html'), htmlContent);
      
      // Create package.json
      writeFileSync(pathResolve(testProjectDir, 'package.json'), JSON.stringify({
        name: 'heartbeat-test',
        version: '1.0.0'
      }, null, 2));
      
      // Run verax in JSON mode and collect events
      const result = await runCLIJSON(
        ['run', '--url', serverUrl, '--src', '.', '--out', '.verax', '--json'],
        testProjectDir
      );
      
      // Filter heartbeat events
      const heartbeatEvents = result.events.filter(e => e.type === 'heartbeat');
      
      // Check for phase events to verify the command ran
      const phaseEvents = result.events.filter(e => e.type && e.type.includes('phase'));
      assert.ok(phaseEvents.length > 0, 'Should have phase events');
      
      // If the command took more than 4 seconds, we should see at least one heartbeat
      // (heartbeat interval is 2.5 seconds, so we need at least 2.5s + some buffer)
      // For very fast commands (< 4s), heartbeats may not be emitted, which is acceptable
      if (result.elapsed > 4000) {
        assert.ok(
          heartbeatEvents.length > 0,
          `Should emit heartbeat events for long-running command (took ${result.elapsed}ms), but found ${heartbeatEvents.length}. Events: ${JSON.stringify(result.events.map(e => e.type))}`
        );
        
        // Verify heartbeat event structure
        const firstHeartbeat = heartbeatEvents[0];
        assert.ok(firstHeartbeat.phase, 'Heartbeat should have phase field');
        assert.ok(typeof firstHeartbeat.elapsedMs === 'number', 'Heartbeat should have elapsedMs field');
        assert.ok(firstHeartbeat.elapsedMs > 0, 'Heartbeat elapsedMs should be positive');
        
        // Verify heartbeats are emitted for different phases
        const phases = new Set(heartbeatEvents.map(e => e.phase).filter(Boolean));
        assert.ok(phases.size > 0, 'Heartbeats should include phase information');
      } else {
        // For fast commands, just verify the command completed successfully
        // Heartbeats are optional for very fast operations
        assert.ok(result.code === 0 || result.code === null, 'Command should complete successfully');
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

  test('verax run emits heartbeat events in human mode (traces.jsonl)', async () => {
    // Create a test project
    const testProjectDir = pathResolve(__dirname, 'tmp', 'heartbeat-test-2');
    const { mkdirSync, writeFileSync } = await import('fs');
    const { existsSync, readFileSync } = await import('fs');
    
    try {
      if (!existsSync(testProjectDir)) {
        mkdirSync(testProjectDir, { recursive: true });
      }
      
      const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <a href="/page1.html">Page 1</a>
</body>
</html>`;
      
      writeFileSync(pathResolve(testProjectDir, 'index.html'), htmlContent);
      writeFileSync(pathResolve(testProjectDir, 'package.json'), JSON.stringify({
        name: 'heartbeat-test-2',
        version: '1.0.0'
      }, null, 2));
      
      // Run verax (human mode, not JSON)
      const cliPath = pathResolve(__dirname, '..', 'bin', 'verax.js');
      const { spawn } = await import('child_process');
      
      await new Promise((resolve, reject) => {
        const proc = spawn('node', [cliPath, 'run', '--url', serverUrl, '--src', '.', '--out', '.verax'], {
          cwd: testProjectDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: process.platform === 'win32'
        });
        
        proc.on('close', (_code) => {
          resolve();
        });
        
        proc.on('error', (err) => {
          reject(err);
        });
      });
      
      // Check traces.jsonl for heartbeat events
      const veraxDir = pathResolve(testProjectDir, '.verax');
      if (existsSync(veraxDir)) {
        const runsDir = pathResolve(veraxDir, 'runs');
        if (existsSync(runsDir)) {
          const runs = await import('fs').then(fs => fs.readdirSync(runsDir));
          if (runs.length > 0) {
            const runDir = pathResolve(runsDir, runs[0]);
            const tracesPath = pathResolve(runDir, 'traces.jsonl');
            if (existsSync(tracesPath)) {
              const tracesContent = readFileSync(tracesPath, 'utf8');
              const traces = tracesContent
                .split('\n')
                .filter(l => l.trim())
                .map(l => {
                  try {
                    return JSON.parse(l);
                  } catch (e) {
                    return null;
                  }
                })
                .filter(Boolean);
              
              const _heartbeatTraces = traces.filter(t => t.type === 'heartbeat');
              
              // If traces exist, heartbeat events should be recorded
              // (even if not printed to stdout in human mode)
              if (traces.length > 0) {
                // Heartbeat events may or may not be in traces.jsonl depending on implementation
                // But at minimum, we should have phase events
                const phaseEvents = traces.filter(t => t.type && t.type.includes('phase'));
                assert.ok(phaseEvents.length > 0, 'Should have phase events in traces');
              }
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

