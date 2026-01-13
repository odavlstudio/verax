/**
 * Leak Detection Test
 * 
 * Runs after all other tests to detect event loop handles
 * that would prevent the process from exiting cleanly.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert';
import { dumpOpenHandles, checkForLeaks } from './helpers/leak-detector.js';

describe('Event Loop Leak Detection', () => {
  test('leak detector loads successfully', () => {
    assert.ok(typeof dumpOpenHandles === 'function', 'dumpOpenHandles should be a function');
    assert.ok(typeof checkForLeaks === 'function', 'checkForLeaks should be a function');
  });

  // This test runs last to check for leaks
  test('no leaked handles after tests', async () => {
    // Give a grace period for cleanup from previous tests
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Dump and check for leaks
    console.log('\n🔍 Running leak detection...\n');
    const hasLeaks = checkForLeaks('after-all-tests', 0);
    
    // This will fail the test if leaks are found, but won't crash the process
    assert.ok(!hasLeaks, 'No event loop handles should be leaked');
  });
});
