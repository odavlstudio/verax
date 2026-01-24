/**
 * Browser Cleanup Visibility Contract Tests
 * 
 * Verifies that cleanup errors are logged and visible, not silently swallowed.
 * Ensures the cleanup-logger is properly integrated into browser lifecycle.
 */

import test from 'node:test';
import { strict as assert } from 'assert';
import { logCleanupError, resetCleanupLogger } from '../src/cli/util/support/cleanup-logger.js';

test('Browser Cleanup Error Visibility', async (suite) => {
  await suite.test('cleanup logger logs errors to console.warn', async () => {
    resetCleanupLogger();
    
    // Capture console.warn output
    const warnCalls = [];
    const originalWarn = console.warn;
    console.warn = (...args) => {
      warnCalls.push(args.join(' '));
    };
    
    try {
      logCleanupError(new Error('context close failed'), 'context');
      
      assert.equal(warnCalls.length, 1, 'should log exactly once');
      assert.match(warnCalls[0], /\[cleanup\]/, 'should have cleanup prefix');
      assert.match(warnCalls[0], /context/, 'should mention scope');
      assert.match(warnCalls[0], /context close failed/, 'should include error message');
    } finally {
      console.warn = originalWarn;
    }
  });

  await suite.test('cleanup logger deduplicates repeated calls for same scope', async () => {
    resetCleanupLogger();
    
    const warnCalls = [];
    const originalWarn = console.warn;
    console.warn = (...args) => {
      warnCalls.push(args.join(' '));
    };
    
    try {
      logCleanupError(new Error('error 1'), 'browser');
      logCleanupError(new Error('error 2'), 'browser');
      logCleanupError(new Error('error 3'), 'browser');
      
      // Should only log once (deduplicated by scope)
      assert.equal(warnCalls.length, 1, 'should deduplicate by scope');
    } finally {
      console.warn = originalWarn;
    }
  });

  await suite.test('cleanup logger returns metadata for error tracking', () => {
    resetCleanupLogger();
    
    const result = logCleanupError(new Error('test error'), 'page');
    
    assert.ok(result, 'should return metadata object');
    assert.equal(result.scope, 'page', 'should include scope');
    assert.match(result.error, /test error/, 'should include error message');
    assert.ok(result.timestamp, 'should include timestamp');
    assert.ok(typeof result.isDuplicate === 'boolean', 'should track deduplication');
  });

  await suite.test('cleanup logger never throws on any input', () => {
    resetCleanupLogger();
    
    // Test with null error
    assert.doesNotThrow(() => {
      logCleanupError(null, 'test');
    });
    
    // Test with undefined scope
    assert.doesNotThrow(() => {
      logCleanupError(new Error('test'), undefined);
    });
    
    // Test with circular reference in metadata
    const circular = { a: 1 };
    circular.self = circular;
    assert.doesNotThrow(() => {
      logCleanupError(new Error('test'), 'test', circular);
    });
  });

  await suite.test('cleanup logger is non-fatal (continues execution)', async () => {
    resetCleanupLogger();
    
    // Simulate browser cleanup sequence
    let cleanupCompleted = false;
    
    try {
      logCleanupError(new Error('page close failed'), 'page');
      logCleanupError(new Error('context close failed'), 'context');
      logCleanupError(new Error('browser close failed'), 'browser');
      
      // Execution continues even after errors
      cleanupCompleted = true;
    } catch (e) {
      assert.fail('cleanup should never throw');
    }
    
    assert.ok(cleanupCompleted, 'cleanup should complete despite logged errors');
  });

  await suite.test('cleanup logger attaches metadata for forensics', () => {
    resetCleanupLogger();
    
    const metadata = { retryCount: 3, duration: 500 };
    const result = logCleanupError(
      new Error('timeout during cleanup'),
      'browser',
      metadata
    );
    
    assert.equal(result.retryCount, 3, 'should preserve custom metadata');
    assert.equal(result.duration, 500, 'should preserve numeric metadata');
  });

  await suite.test('cleanup logger idempotency: multiple calls safe', () => {
    resetCleanupLogger();
    
    const scopes = ['page', 'context', 'browser'];
    
    // Call cleanup multiple times for different scopes
    assert.doesNotThrow(() => {
      scopes.forEach(scope => {
        logCleanupError(new Error(`${scope} failed`), scope);
        logCleanupError(new Error(`${scope} failed again`), scope);
      });
    });
    
    // Should not throw even with redundant calls
  });

  await suite.test('cleanup logger reset works for testing', () => {
    // First cycle
    const warnCalls1 = [];
    const originalWarn = console.warn;
    console.warn = (...args) => {
      warnCalls1.push(args.join(' '));
    };
    
    logCleanupError(new Error('error'), 'test');
    assert.equal(warnCalls1.length, 1, 'first cycle should log');
    
    resetCleanupLogger();
    warnCalls1.length = 0;
    
    // Second cycle (after reset)
    logCleanupError(new Error('error'), 'test');
    assert.equal(warnCalls1.length, 1, 'after reset, should log again for same scope');
    
    console.warn = originalWarn;
  });

  await suite.test('cleanup errors do not affect exit code', async () => {
    resetCleanupLogger();
    
    // Record original exit code
    const originalExitCode = process.exitCode;
    
    try {
      logCleanupError(new Error('browser cleanup failed'), 'browser');
      
      // Exit code should not be modified by cleanup logger
      assert.equal(process.exitCode, originalExitCode, 'cleanup logger should not modify exit code');
    } finally {
      process.exitCode = originalExitCode;
    }
  });
});




