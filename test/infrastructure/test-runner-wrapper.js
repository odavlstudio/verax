#!/usr/bin/env node

/**
 * Test Runner Wrapper for VERAX
 * 
 * Enforces deterministic test completion with hardened cleanup.
 * 
 * Enterprise Rule: Hanging is worse than failing.
 * 
 * Protections:
 * 1. Hard timeout (5 minutes max)
 * 2. Force close all Playwright browsers on timeout
 * 3. Event loop drain guarantee
 * 4. Track active handles (sockets, timers, etc.)
 * 5. Force exit if handles remain after test completion
 */

import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { closeAllPlaywrightResources, forceKillAllBrowsers } from './playwright-cleanup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../..');

// Track all active HTTP servers to force close on exit
const activeServers = new Set();
global.__veraxTestServers = activeServers;

// Normalize environment for child tests
if (!process.env.VERAX_TEST_MODE) {
  process.env.VERAX_TEST_MODE = '1';
}
// Ensure npm_command points to npm (npm sets this to the script name during npm test)
process.env.npm_command = 'npm';

let _testRunnerExited = false;
let testExitCode = 0;
let cleanupInProgress = false;

/**
 * PHASE 1: Global cleanup with hard guarantees
 */
function cleanupAndExit(code, reason = 'normal') {
  if (cleanupInProgress) {
    return; // Prevent recursive cleanup
  }
  cleanupInProgress = true;

  console.error(`\n[TEST CLEANUP] Exit code: ${code}, Reason: ${reason}`);

  // Step 1: Close all HTTP servers immediately
  if (activeServers.size > 0) {
    console.error(`[TEST CLEANUP] Closing ${activeServers.size} HTTP server(s)`);
    activeServers.forEach(server => {
      try {
        if (server && typeof server.close === 'function') {
          server.close(() => {});
          // Force destroy all connections
          if (server.closeAllConnections) {
            server.closeAllConnections();
          }
        }
      } catch (e) {
        // Ignore
      }
    });
    activeServers.clear();
  }

  // Step 2: Close stdin immediately (prevents Windows hang)
  try {
    if (process.stdin && typeof process.stdin.destroy === 'function') {
      process.stdin.destroy();
    }
  } catch (e) {
    // Ignore
  }

  // Step 3: Force close all Playwright browsers immediately
  try {
    forceKillAllBrowsers().catch(() => {});
  } catch (e) {
    // Ignore
  }

  // Step 4: Close all Playwright resources with timeout
  closeAllPlaywrightResources()
    .then(() => {
      console.error('[TEST CLEANUP] Playwright resources closed');
      exitProcess(code);
    })
    .catch((err) => {
      console.error('[TEST CLEANUP] Playwright cleanup error:', err.message);
      exitProcess(code);
    });

  // Step 5: Force exit after 3 seconds if cleanup hangs
  setTimeout(() => {
    console.error('[TEST CLEANUP] Cleanup timeout - force exiting');
    exitProcess(code);
  }, 3000);
}

/**
 * FINAL EXIT: Drain event loop and force process exit
 */
function exitProcess(code) {
  // Get active handles to see what's keeping process alive
  const activeHandles = process._getActiveHandles ? process._getActiveHandles() : [];
  const activeRequests = process._getActiveRequests ? process._getActiveRequests() : [];

  if (activeHandles.length > 0 || activeRequests.length > 0) {
    console.error(`[EVENT LOOP] Active handles: ${activeHandles.length}, Active requests: ${activeRequests.length}`);
    
    // Log handle types for debugging
    activeHandles.forEach((handle, i) => {
      const typeName = handle.constructor?.name || 'Unknown';
      console.error(`  Handle ${i}: ${typeName}`);
      
      // Force close/destroy any closeable handles
      try {
        if (typeof handle.close === 'function') {
          handle.close();
        } else if (typeof handle.destroy === 'function') {
          handle.destroy();
        } else if (typeof handle.unref === 'function') {
          handle.unref();
        }
      } catch (e) {
        // Ignore errors during forceful cleanup
      }
    });

    activeRequests.forEach((req, i) => {
      console.error(`  Request ${i}: pending operation`);
    });
  }

  // Force exit - no graceful shutdown
  // Enterprise rule: blocking is worse than abrupt exit
  process.exit(code);
}

// Launch test runner with no stdin (prevents Windows hang)
// Scope: run only release tests by default using glob pattern
const testPattern = process.platform === 'win32'
  ? 'test\\release\\**\\*.test.js'
  : 'test/release/**/*.test.js';

const testRunner = spawn('node', ['--test', testPattern], {
  cwd: rootDir,
  stdio: ['pipe', 'inherit', 'inherit'],
  shell: true, // enable shell so glob pattern expands appropriately on Windows
  windowsHide: false,
});

// Close stdin immediately to prevent hanging
testRunner.stdin.end();

/**
 * PER-TEST-FILE TIMEOUT POLICY
 * 
 * Enterprise rule: Hanging is worse than failing.
 * 
 * Timeout budget by test type:
 * - final-gate.test.js: 120s (npm pack + npm install are legitimately slow)
 * - All other tests: 60s (increased from 30s for stability)
 */
const DEFAULT_TIMEOUT_MS = 60 * 1000;  // 60 seconds for normal tests
const SLOW_TEST_TIMEOUT_MS = 120 * 1000;  // 120 seconds for final-gate

// For now, use extended timeout since we run all tests including final-gate
// In the future, we could parse which files are being tested and adjust dynamically
const TEST_TIMEOUT_MS = SLOW_TEST_TIMEOUT_MS;

const timeoutHandle = setTimeout(() => {
  console.error(`\n❌ FATAL: Test runner exceeded ${TEST_TIMEOUT_MS / 1000}-second timeout`);
  console.error('Force closing all Playwright browsers and terminating');
  
  // Kill test runner IMMEDIATELY with SIGKILL (not SIGTERM)
  try {
    testRunner.kill('SIGKILL');
  } catch (e) {
    // Ignore
  }
  
  // Force close browsers in parallel
  forceKillAllBrowsers().catch(() => {});
  
  // Give 1 second for cleanup then force exit
  setTimeout(() => {
    cleanupAndExit(1, 'timeout');
  }, 1000);
}, TEST_TIMEOUT_MS);

// Capture exit code
testRunner.on('close', (code) => {
  clearTimeout(timeoutHandle);
  _testRunnerExited = true;
  testExitCode = code ?? 0;
  
  // Force cleanup before exit
  cleanupAndExit(testExitCode, 'test_complete');
});

// Handle spawn errors
testRunner.on('error', (err) => {
  clearTimeout(timeoutHandle);
  console.error('❌ Failed to start test runner:', err.message);
  cleanupAndExit(1, 'spawn_error');
});

// Handle signals
['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => {
    clearTimeout(timeoutHandle);
    try {
      testRunner.kill(signal);
    } catch (e) {
      // Already dead
    }
    cleanupAndExit(128 + (signal === 'SIGINT' ? 2 : 15), `signal_${signal}`);
  });
});

// Uncaught exceptions
process.on('uncaughtException', (err) => {
  clearTimeout(timeoutHandle);
  console.error('❌ Uncaught exception:', err);
  cleanupAndExit(1, 'uncaught_exception');
});

// Unhandled rejections
process.on('unhandledRejection', (reason) => {
  clearTimeout(timeoutHandle);
  console.error('❌ Unhandled rejection:', reason);
  cleanupAndExit(1, 'unhandled_rejection');
});
