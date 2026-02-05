/**
 * Out-of-Scope Command Termination Test
 *
 * Stage 1 Freeze & Prune: out-of-scope commands must fail fast (exit 64)
 * with a single-line stderr message and no contract output.
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

describe('Out-of-scope command termination', () => {
  test('doctor --json fails fast with pilot-scope message', async () => {
    const result = await runCliWithTimeout(
      process.execPath,
      [veraxBin, 'doctor', '--json'],
      5000,
      { VERAX_DOCTOR_SMOKE_TIMEOUT_MS: '3000' }
    );
    
    assert.strictEqual(result.code, 64, `doctor exited with code ${result.code}`);
    assert.ok(!result.signal, `doctor killed by signal ${result.signal}`);
    
    assert.strictEqual(result.stdout.trim(), '', 'out-of-scope command must not emit stdout');
    assert.strictEqual(
      result.stderr.trim(),
      "Command 'doctor' is out of scope for VERAX 0.4.9 pilot surface. Supported: run, bundle, readiness, capability-bundle, version, help.",
      'out-of-scope command must emit pilot-scope message to stderr'
    );
  });
  
  test('doctor (human mode) fails fast with pilot-scope message', async () => {
    const result = await runCliWithTimeout(
      process.execPath,
      [veraxBin, 'doctor'],
      5000,
      { VERAX_DOCTOR_SMOKE_TIMEOUT_MS: '3000' }
    );
    
    assert.strictEqual(result.code, 64, `doctor exited with code ${result.code}`);
    assert.ok(!result.signal, `doctor killed by signal ${result.signal}`);
    
    assert.strictEqual(result.stdout.trim(), '', 'out-of-scope command must not emit stdout');
    assert.strictEqual(
      result.stderr.trim(),
      "Command 'doctor' is out of scope for VERAX 0.4.9 pilot surface. Supported: run, bundle, readiness, capability-bundle, version, help.",
      'out-of-scope command must emit pilot-scope message to stderr'
    );
  });
});

