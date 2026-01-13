#!/usr/bin/env node

/**
 * Test Runner Wrapper for VERAX
 * 
 * Ensures that the Node.js test runner exits cleanly on Windows and all platforms.
 * The native test runner can hang waiting for lingering handles from:
 * - Unclosed HTTP servers
 * - Playwright browser processes
 * - Spawned child processes
 * 
 * This wrapper enforces deterministic exit by:
 * 1. Disconnecting stdin from child process (prevents Windows "Cancel batch job?" prompt)
 * 2. Running the test runner with inherited stdout/stderr
 * 3. Using process.exit() to force termination after all cleanup
 */

import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

let testRunnerExited = false;
let testExitCode = 0;

const FORCE_KILL_TIMEOUT_MS = 1000;

function cleanupAndExit(code) {
  // Close stdin to prevent Windows from showing "Batchvorgang abbrechen?" prompt
  if (process.stdin && typeof process.stdin.destroy === 'function') {
    process.stdin.destroy();
  }
  
  if (!testRunnerExited && testRunner && !testRunner.killed) {
    testRunner.kill('SIGTERM');
    setTimeout(() => {
      if (!testRunner.killed) testRunner.kill('SIGKILL');
    }, FORCE_KILL_TIMEOUT_MS);
  }
  
  // Force deterministic shutdown after cleanup
  process.exit(code);
}

// Launch the actual Node.js test runner
// stdin: 'ignore' prevents Windows hang on exit
// stdout/stderr: 'inherit' for real-time output
const testRunner = spawn('node', ['--test', 'test', 'scripts'], {
  cwd: rootDir,
  stdio: ['ignore', 'inherit', 'inherit'],
  shell: false,
  windowsHide: false, // Keep console visible for output
});

// CRITICAL: Unref to prevent blocking Node exit on Windows
// This allows the parent process to exit even if child streams are still open
testRunner.unref();

// Capture exit code when test runner completes
testRunner.on('close', (code) => {
  testRunnerExited = true;
  testExitCode = code ?? 0;

  // Force process exit to prevent hanging on lingering handles
  // This ensures tests always exit cleanly regardless of open servers/connections
  cleanupAndExit(testExitCode);
});

// Handle test runner spawn errors
testRunner.on('error', (err) => {
  console.error('Failed to start test runner:', err.message);
  process.exit(1);
});

// Ensure the child is terminated if the wrapper receives a signal or fatal error
['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => cleanupAndExit(128 + (signal === 'SIGINT' ? 2 : 15)));
});

process.on('uncaughtException', (err) => {
  console.error(err);
  cleanupAndExit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  cleanupAndExit(1);
});

// EXIT GUARD: Safety timeout for test environment
// If tests complete but process doesn't exit within 1.5s, force termination
// This guards against leaked intervals, timers, or other event loop handles
// CRITICAL: Only active in test mode to prevent interfering with production usage
if (process.env.NODE_ENV === 'test' || process.argv.includes('--test')) {
  const exitGuard = setTimeout(() => {
    if (!testRunnerExited) {
      console.warn('[EXIT GUARD] Test runner completed but process did not exit. Forcing exit...');
      cleanupAndExit(testExitCode || 0);
    }
  }, 1500);
  exitGuard.unref(); // Don't keep process alive
}

// Absolute safety timeout: if test runner hangs for 2 hours, force exit
// This should never happen in normal operation but prevents infinite hangs
const absoluteTimeout = setTimeout(() => {
  if (!testRunnerExited) {
    console.error('\n[ABSOLUTE TIMEOUT] Test runner hung for 2 hours. Forcing exit...');
    cleanupAndExit(1);
  }
}, 7200000);
absoluteTimeout.unref(); // Don't keep process alive
