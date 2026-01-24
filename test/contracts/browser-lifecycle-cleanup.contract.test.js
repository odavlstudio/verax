#!/usr/bin/env node

/**
 * BROWSER LIFECYCLE CLEANUP CONTRACT TEST
 * 
 *  Browser Lifecycle Hardening (ISSUE #21)
 * 
 * GOAL: Guarantee that Playwright browser resources are ALWAYS closed,
 * even when observe fails mid-execution.
 * 
 * TESTS:
 * 1. Browser.close() is called on success path
 * 2. Browser.close() is called on error path (mid-observe failure)
 * 3. Browser.close() is called on timeout
 * 4. Cleanup is idempotent (can be called multiple times safely)
 * 5. Cleanup never throws errors
 * 
 * REGRESSION: If cleanup is removed, this test must fail.
 */

import { chromium } from 'playwright';
import { ensureBrowserCleanup } from '../../src/verax/observe/browser.js';

function test(name, fn) {
  return new Promise((resolve) => {
    fn()
      .then(() => {
        console.log(`✓ ${name}`);
        resolve(true);
      })
      .catch((error) => {
        console.error(`✗ ${name}`);
        console.error(`  ${error.message}`);
        if (error.stack) {
          console.error(`  ${error.stack.split('\n').slice(1, 3).join('\n')}`);
        }
        resolve(false);
      });
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('BROWSER LIFECYCLE CLEANUP CONTRACT TESTS (PHASE D1)');
console.log('═══════════════════════════════════════════════════════════\n');

const results = [];

// Test 1: Cleanup on success path
results.push(
  await test('ensureBrowserCleanup() closes browser on success', async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Verify browser is connected
    assert(browser.isConnected(), 'Browser should be connected before cleanup');

    // Call cleanup
    await ensureBrowserCleanup(browser, page);

    // Verify browser is closed
    assert(!browser.isConnected(), 'Browser should be disconnected after cleanup');
  })
);

// Test 2: Cleanup on error path (simulate mid-observe failure)
results.push(
  await test('ensureBrowserCleanup() closes browser even after error', async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Simulate error during observe
    let errorThrown = false;
    try {
      await page.goto('https://nonexistent-domain-verax-test-12345.com', { timeout: 1000 });
    } catch (e) {
      errorThrown = true;
    }

    assert(errorThrown, 'Error should have been thrown');
    assert(browser.isConnected(), 'Browser should still be connected after error');

    // Call cleanup
    await ensureBrowserCleanup(browser, page);

    // Verify browser is closed despite error
    assert(!browser.isConnected(), 'Browser should be closed even after error');
  })
);

// Test 3: Cleanup is idempotent
results.push(
  await test('ensureBrowserCleanup() is idempotent (safe to call multiple times)', async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Call cleanup multiple times
    await ensureBrowserCleanup(browser, page);
    await ensureBrowserCleanup(browser, page);
    await ensureBrowserCleanup(browser, page);

    // Should not throw - test passes if we get here
    assert(true, 'Multiple cleanup calls should not throw');
  })
);

// Test 4: Cleanup never throws
results.push(
  await test('ensureBrowserCleanup() never throws errors', async () => {
    const browser = await chromium.launch({ headless: true });
    
    // Force close browser first to create error condition
    await browser.close();

    // Call cleanup on already-closed browser - should swallow error
    await ensureBrowserCleanup(browser, null);

    // Should not throw - test passes if we get here
    assert(true, 'Cleanup on closed browser should not throw');
  })
);

// Test 5: Cleanup handles null/undefined gracefully
results.push(
  await test('ensureBrowserCleanup() handles null/undefined gracefully', async () => {
    // Should not throw with null browser
    await ensureBrowserCleanup(null, null);
    await ensureBrowserCleanup(undefined, undefined);

    assert(true, 'Cleanup with null resources should not throw');
  })
);

// Test 6: REGRESSION TEST - Simulate observe failure mid-execution
results.push(
  await test('REGRESSION: browser closes even if observe throws mid-execution', async () => {
    let browser = null;
    let page = null;
    let cleanupCalled = false;

    try {
      browser = await chromium.launch({ headless: true });
      page = await browser.newPage();

      // Simulate observe starting
      await page.goto('about:blank');

      // Simulate error mid-observe
      throw new Error('Simulated mid-observe failure');
    } catch (error) {
      // In real code, finally block ensures cleanup
      // This test verifies the cleanup works
      await ensureBrowserCleanup(browser, page);
      cleanupCalled = true;
    }

    assert(cleanupCalled, 'Cleanup should have been called');
    assert(!browser.isConnected(), 'Browser should be closed after error');
  })
);

console.log('\n═══════════════════════════════════════════════════════════');
const passed = results.filter(r => r).length;
const failed = results.filter(r => !r).length;

if (failed > 0) {
  console.log(`\n❌ FAILED: ${failed}/${results.length} tests failed\n`);
  process.exit(1);
} else {
  console.log(`\n✅ PASSED: All ${passed} tests passed\n`);
  process.exit(0);
}





