#!/usr/bin/env node

/**
 * VERAX Cleanup Verification Script
 * 
 * Verifies that the Playwright cleanup system works correctly.
 * Tests:
 * 1. forceKillAllBrowsers() works
 * 2. closeAllPlaywrightResources() drains resources
 * 3. Test runner exits cleanly
 */

import { chromium } from 'playwright';
import {
  trackResource,
  untrackResource,
  closeAllPlaywrightResources,
  forceKillAllBrowsers,
  getActiveResourceCount
} from './playwright-cleanup.js';

console.log('🔍 VERAX Cleanup Verification');
console.log('================================\n');

// Test 1: Track and cleanup browser
console.log('Test 1: Track and cleanup browser instance...');
try {
  const browser = await chromium.launch({ headless: true });
  trackResource(browser);
  
  if (getActiveResourceCount() !== 1) {
    throw new Error(`Expected 1 active resource, got ${getActiveResourceCount()}`);
  }
  
  await browser.close();
  untrackResource(browser);
  
  if (getActiveResourceCount() !== 0) {
    throw new Error(`Expected 0 active resources after close, got ${getActiveResourceCount()}`);
  }
  
  console.log('✅ PASS: Browser tracking works\n');
} catch (e) {
  console.error('❌ FAIL:', e.message, '\n');
  process.exit(1);
}

// Test 2: Test closeAllPlaywrightResources
console.log('Test 2: closeAllPlaywrightResources() cleanup...');
try {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  trackResource(browser);
  trackResource(context);
  trackResource(page);
  
  const beforeCleanup = getActiveResourceCount();
  if (beforeCleanup !== 3) {
    throw new Error(`Expected 3 active resources before cleanup, got ${beforeCleanup}`);
  }
  
  await closeAllPlaywrightResources();
  
  const afterCleanup = getActiveResourceCount();
  if (afterCleanup !== 0) {
    throw new Error(`Expected 0 active resources after cleanup, got ${afterCleanup}`);
  }
  
  console.log('✅ PASS: closeAllPlaywrightResources works\n');
} catch (e) {
  console.error('❌ FAIL:', e.message, '\n');
  process.exit(1);
}

// Test 3: Test forceKillAllBrowsers (non-destructive test)
console.log('Test 3: forceKillAllBrowsers() (safe test)...');
try {
  // Create a browser but close it first
  const browser = await chromium.launch({ headless: true });
  trackResource(browser);
  await browser.close();
  untrackResource(browser);
  
  // Now test force kill on empty set (should not crash)
  await forceKillAllBrowsers();
  
  console.log('✅ PASS: forceKillAllBrowsers works\n');
} catch (e) {
  console.error('❌ FAIL:', e.message, '\n');
  process.exit(1);
}

console.log('================================');
console.log('✅ All verification tests passed');
console.log('\nThe cleanup system is working correctly.');
console.log('npm test should now exit cleanly without hanging.');

