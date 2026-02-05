#!/usr/bin/env node

/**
 * Test Runner Wrapper for VERAX
 * 
 * Enforces deterministic test completion with hardened cleanup.
 * 
 * Enterprise Rule: Hanging is worse than failing.
 * 
 * Protections:
 * 1. Hard timeout (3 minutes max)
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

// Speed up outcome watcher during tests without changing product defaults
if (!process.env.VERAX_TEST_FAST_OUTCOME) {
  process.env.VERAX_TEST_FAST_OUTCOME = '1';
}

// WEEK 1 / TASK 2: Enforce deterministic time in tests
// Set VERAX_TEST_TIME if not already set (for CI and local consistency)
if (!process.env.VERAX_TEST_TIME) {
  process.env.VERAX_TEST_TIME = '2026-01-01T00:00:00.000Z';
  console.log('[TEST ENV] VERAX_TEST_TIME set to:', process.env.VERAX_TEST_TIME);
}

// Ensure npm_command points to npm (npm sets this to the script name during npm test)
process.env.npm_command = 'npm';

let _testRunnerExited = false;
let testExitCode = 0;
let cleanupInProgress = false;
let timedOut = false;

function buildChildTestEnv() {
  // Running `node --test` from within an existing Node test-runner process can trigger
  // Node's recursive test-run guard. Clear NODE_TEST* env vars for the child process.
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (k.startsWith('NODE_TEST')) delete env[k];
  }
  return env;
}

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
// Scope: Tier 1 (release) by default, Tier 2 (integration) via env flag
const testPattern = process.env.VERAX_TEST_PATTERN || (
  process.env.VERAX_TEST_INTEGRATION === '1'
    ? (process.platform === 'win32' ? 'test\\integration\\**\\*.test.js' : 'test/integration/**/*.test.js')
    : (process.platform === 'win32' ? 'test\\release\\**\\*.test.js' : 'test/release/**/*.test.js')
);

const testRunner = spawn('node', ['--test', testPattern], {
  cwd: rootDir,
  stdio: ['pipe', 'inherit', 'inherit'],
  shell: true, // enable shell so glob pattern expands appropriately on Windows
  windowsHide: false,
  env: buildChildTestEnv(),
});

// Close stdin immediately to prevent hanging
testRunner.stdin.end();

/**
 * TIMEOUT POLICY: TIER-BASED
 * 
 * Enterprise rule: Hanging is worse than failing.
 * 
 * Tier 1 (Default/Release): 60s max
 * - Unit, contract, determinism tests
 * - NO Playwright browser launches
 * 
 * Tier 2 (Integration): 300s max
 * - Playwright-based E2E tests
 * - Framework integration (Vue, Next.js, etc.)
 * - Runtime discovery phases
 */
const TIER1_TIMEOUT_MS = 120 * 1000;  // 120 seconds for fast default tests (cross-platform safe)
const TIER2_TIMEOUT_MS = 300 * 1000; // 300 seconds for Playwright integration

const DEFAULT_TIMEOUT_MS = process.env.VERAX_TEST_INTEGRATION === '1'
  ? TIER2_TIMEOUT_MS
  : TIER1_TIMEOUT_MS;

const overrideTimeoutMsRaw = process.env.VERAX_TEST_TIMEOUT_MS;
const overrideTimeoutMs = overrideTimeoutMsRaw ? Number(overrideTimeoutMsRaw) : null;
const TEST_TIMEOUT_MS = Number.isFinite(overrideTimeoutMs) && overrideTimeoutMs > 0
  ? Math.max(50, overrideTimeoutMs)
  : DEFAULT_TIMEOUT_MS;

const timeoutHandle = setTimeout(() => {
  timedOut = true;
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
testRunner.on('close', (code, signal) => {
  clearTimeout(timeoutHandle);
  _testRunnerExited = true;

  // Node will pass `code=null` when the child exited due to a signal.
  // Treat signals and timeouts as failures.
  const normalizedExitCode = timedOut
    ? 1
    : (typeof code === 'number' ? code : 1);
  testExitCode = signal ? 1 : normalizedExitCode;
  
  // Force cleanup before exit
  cleanupAndExit(testExitCode, timedOut ? 'timeout' : (signal ? `signal_${signal}` : 'test_complete'));
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

