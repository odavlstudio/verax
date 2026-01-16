/**
 * Doctor Command Termination Test
 * 
 * Regression test to ensure `verax doctor --json` terminates cleanly
 * and does not hang due to leaked browser processes or intervals.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const veraxBin = resolve(projectRoot, 'bin', 'verax.js');

/**
 * Run CLI command with timeout enforcement
 */
function runCliWithTimeout(command, args, timeoutMs = 5000, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      env: { ...process.env, ...env },
    });
    
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 1000);
    }, timeoutMs);
    
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      
      if (timedOut) {
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      } else {
        resolve({ stdout, stderr, code, signal });
      }
    });
    
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

describe('Doctor Command Termination', () => {
  test('doctor --json exits within 5 seconds with fast smoke test', async () => {
    const result = await runCliWithTimeout(
      process.execPath,
      [veraxBin, 'doctor', '--json'],
      5000,
      { VERAX_DOCTOR_SMOKE_TIMEOUT_MS: '3000' }
    );
    
    assert.strictEqual(result.code, 0, `doctor exited with code ${result.code}`);
    assert.ok(!result.signal, `doctor killed by signal ${result.signal}`);
    
    // Verify valid JSON output
    const output = result.stdout.trim();
    assert.ok(output, 'doctor produced output');
    
    let parsed;
    try {
      parsed = JSON.parse(output);
    } catch (e) {
      throw new Error(`doctor output is not valid JSON: ${e.message}\nOutput: ${output.slice(0, 500)}`);
    }
    
    assert.ok(parsed.checks, 'doctor JSON contains checks array');
    assert.ok(Array.isArray(parsed.checks), 'checks is an array');
    assert.ok(parsed.checks.length >= 4, `Expected at least 4 checks, got ${parsed.checks.length}`);
  });
  
  test('doctor (human mode) exits within 5 seconds with fast smoke test', async () => {
    const result = await runCliWithTimeout(
      process.execPath,
      [veraxBin, 'doctor'],
      5000,
      { VERAX_DOCTOR_SMOKE_TIMEOUT_MS: '3000' }
    );
    
    assert.strictEqual(result.code, 0, `doctor exited with code ${result.code}`);
    assert.ok(!result.signal, `doctor killed by signal ${result.signal}`);
    
    const output = result.stdout;
    assert.ok(output.includes('VERAX Doctor'), 'doctor output contains header');
    assert.ok(output.includes('Node.js version'), 'doctor output contains checks');
  });
});
