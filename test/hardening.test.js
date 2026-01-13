/**
 * Site Hardening Tests: Canonical URL Control, Safe-Action Policy, Adaptive Stabilization
 */

import test from 'node:test';
import assert from 'node:assert';
import { normalizeUrl, canonicalizeUrl, dropTrackingParams, areUrlsEquivalent, countTrackingParams } from '../src/verax/shared/url-normalizer.js';
import { PageFrontier, isDestructiveLabel } from '../src/verax/observe/page-frontier.js';
import { DEFAULT_SCAN_BUDGET } from '../src/verax/shared/scan-budget.js';

// ============================================================================
// CANONICAL URL CONTROL TESTS
// ============================================================================

test('normalizeUrl: removes hash fragments', () => {
  const original = 'https://example.com/page#section';
  const normalized = normalizeUrl(original);
  assert.strictEqual(normalized, 'https://example.com/page');
});

test('normalizeUrl: sorts query parameters', () => {
  const original = 'https://example.com/page?z=3&a=1&m=2';
  const normalized = normalizeUrl(original);
  assert.strictEqual(normalized, 'https://example.com/page?a=1&m=2&z=3');
});

test('normalizeUrl: removes tracking parameters', () => {
  const original = 'https://example.com/page?utm_source=google&id=123&utm_medium=search';
  const normalized = normalizeUrl(original);
  assert.strictEqual(normalized, 'https://example.com/page?id=123');
  assert.strictEqual(countTrackingParams(original), 2);
});

test('normalizeUrl: removes gclid and fbclid', () => {
  const url1 = 'https://example.com/page?id=123&gclid=abc123';
  const url2 = 'https://example.com/page?id=123&fbclid=def456';
  assert.strictEqual(normalizeUrl(url1), 'https://example.com/page?id=123');
  assert.strictEqual(normalizeUrl(url2), 'https://example.com/page?id=123');
});

test('normalizeUrl: lowercases protocol and hostname', () => {
  const original = 'HTTPS://EXAMPLE.COM/page?ID=123';
  const normalized = normalizeUrl(original);
  assert.ok(normalized.startsWith('https://example.com'));
});

test('canonicalizeUrl: is alias for normalizeUrl', () => {
  const url = 'https://example.com/page?z=1&a=2#hash';
  assert.strictEqual(canonicalizeUrl(url), normalizeUrl(url));
});

test('areUrlsEquivalent: detects identical canonical forms', () => {
  const url1 = 'https://example.com/page?id=1&name=test';
  const url2 = 'https://example.com/page?name=test&id=1'; // Different param order
  assert.ok(areUrlsEquivalent(url1, url2));
});

test('areUrlsEquivalent: detects different URLs with same params', () => {
  const url1 = 'https://example.com/page1?id=1';
  const url2 = 'https://example.com/page2?id=1';
  assert.ok(!areUrlsEquivalent(url1, url2));
});

test('areUrlsEquivalent: ignores hash differences', () => {
  const url1 = 'https://example.com/page?id=1#section1';
  const url2 = 'https://example.com/page?id=1#section2';
  assert.ok(areUrlsEquivalent(url1, url2));
});

test('dropTrackingParams: preserves non-tracking params', () => {
  const url = 'https://example.com/page?utm_source=google&id=123&utm_medium=search&name=test';
  const cleaned = dropTrackingParams(url);
  assert.ok(cleaned.includes('id=123'));
  assert.ok(cleaned.includes('name=test'));
  assert.ok(!cleaned.includes('utm_source'));
  assert.ok(!cleaned.includes('utm_medium'));
});

test('countTrackingParams: counts all tracking params', () => {
  const url = 'https://example.com/page?utm_source=google&gclid=abc&utm_medium=search&fbclid=def';
  assert.strictEqual(countTrackingParams(url), 4);
});

// ============================================================================
// FRONTIER DEDUPLICATION TESTS
// ============================================================================

test('PageFrontier: prevents duplicate URLs with different tracking params', () => {
  const frontier = new PageFrontier('https://example.com/page', 'https://example.com', DEFAULT_SCAN_BUDGET, Date.now());
  
  const url1 = 'https://example.com/page?utm_source=google&id=1';
  const url2 = 'https://example.com/page?utm_source=direct&id=1';
  
  assert.ok(frontier.addUrl(url1));
  assert.ok(!frontier.addUrl(url2)); // Should reject because canonical form is identical
});

test('PageFrontier: respects maxUniqueUrls cap', () => {
  const budget = { ...DEFAULT_SCAN_BUDGET, maxUniqueUrls: 3 };
  const frontier = new PageFrontier('https://example.com/page1', 'https://example.com', budget, Date.now());
  
  // Add up to the limit (start page + 2 more = 3)
  assert.ok(frontier.addUrl('https://example.com/page2'));
  assert.ok(frontier.addUrl('https://example.com/page3'));
  
  // Exceeding the limit should set frontierCapped
  assert.ok(!frontier.addUrl('https://example.com/page4'));
  assert.ok(frontier.frontierCapped);
});

test('PageFrontier: normalizes URLs during deduplication', () => {
  const frontier = new PageFrontier('https://example.com/', 'https://example.com', DEFAULT_SCAN_BUDGET, Date.now());
  
  const url1 = 'https://example.com/page?z=1&a=2';
  const url2 = 'https://example.com/page?a=2&z=1'; // Different param order
  
  assert.ok(frontier.addUrl(url1));
  assert.ok(!frontier.addUrl(url2)); // Should be detected as duplicate
});

// ============================================================================
// SAFE-ACTION POLICY TESTS
// ============================================================================

test('PageFrontier: skips interactions with data-danger attribute', () => {
  const frontier = new PageFrontier('https://example.com/page', 'https://example.com', DEFAULT_SCAN_BUDGET, Date.now());
  
  const interaction = {
    dataDanger: true,
    text: 'Delete'
  };
  
  const result = frontier.shouldSkipInteraction(interaction);
  assert.ok(result.skip);
  assert.strictEqual(result.reason, 'safety_policy');
});

test('PageFrontier: skips interactions with destructive text', () => {
  const frontier = new PageFrontier('https://example.com/page', 'https://example.com', DEFAULT_SCAN_BUDGET, Date.now());
  
  const destructiveTexts = [
    'Delete Account',
    'Remove User',
    'Wipe data',
    'Clear all data',
    'Reset account',
    'Deactivate account',
    'Unsubscribe',
    'Purchase Now',
    'Checkout'
  ];
  
  destructiveTexts.forEach(text => {
    const interaction = { text };
    const result = frontier.shouldSkipInteraction(interaction);
    assert.ok(result.skip, `Should skip "${text}"`);
    assert.strictEqual(result.reason, 'safety_policy');
  });
});

test('PageFrontier: allows safe interactions (including clear filters)', () => {
  const frontier = new PageFrontier('https://example.com/page', 'https://example.com', DEFAULT_SCAN_BUDGET, Date.now());
  
  const safeTexts = [
    'Click Me',
    'Submit Form',
    'Search',
    'Continue',
    'Next',
    'Clear filters',
    'Clear search',
    'Clear selection',
    'Clear input',
    'Clear form',
    'Clear query',
    'Clear results',
    'Logout'
  ];
  
  safeTexts.forEach(text => {
    const interaction = { text };
    const result = frontier.shouldSkipInteraction(interaction);
    assert.ok(!result.skip, `Should allow "${text}"`);
    assert.strictEqual(result.reason, null);
  });
});

test('PageFrontier: skips interactions with aria-label containing destructive keywords', () => {
  const frontier = new PageFrontier('https://example.com/page', 'https://example.com', DEFAULT_SCAN_BUDGET, Date.now());
  
  const interaction = {
    ariaLabel: 'Delete file'
  };
  
  const result = frontier.shouldSkipInteraction(interaction);
  assert.ok(result.skip);
  assert.strictEqual(result.reason, 'safety_policy');
});

test('PageFrontier: case-insensitive destructive text matching', () => {
  const frontier = new PageFrontier('https://example.com/page', 'https://example.com', DEFAULT_SCAN_BUDGET, Date.now());
  
  const interaction = {
    text: 'DELETE ACCOUNT'
  };
  
  const result = frontier.shouldSkipInteraction(interaction);
  assert.ok(result.skip);
});

test('PageFrontier: clear filters are NOT skipped but clear data is skipped', () => {
  const frontier = new PageFrontier('https://example.com/page', 'https://example.com', DEFAULT_SCAN_BUDGET, Date.now());
  
  const safe = frontier.shouldSkipInteraction({ text: 'Clear filters' });
  assert.ok(!safe.skip, 'Clear filters should be allowed');
  
  const destructive = frontier.shouldSkipInteraction({ text: 'Clear all data' });
  assert.ok(destructive.skip, 'Clear all data should be blocked');
});

test('isDestructiveLabel matcher handles boundaries and allowlist', () => {
  assert.deepStrictEqual(isDestructiveLabel('Clear search').skip, false, 'Clear search should be safe');
  assert.deepStrictEqual(isDestructiveLabel('clear all data').skip, true, 'Clear all data should be destructive');
  assert.deepStrictEqual(isDestructiveLabel('Remove item').skip, true, 'Remove item should be destructive');
  assert.deepStrictEqual(isDestructiveLabel('clearance sale').skip, false, 'Substring should not trigger');
});

// ============================================================================
// FRONTIER STATS TESTS
// ============================================================================

test('PageFrontier: tracks discovered and visited pages', () => {
  const frontier = new PageFrontier('https://example.com/page1', 'https://example.com', DEFAULT_SCAN_BUDGET, Date.now());
  
  assert.strictEqual(frontier.pagesDiscovered, 1);
  assert.strictEqual(frontier.pagesVisited, 0);
  
  frontier.addUrl('https://example.com/page2');
  assert.strictEqual(frontier.pagesDiscovered, 2);
  
  frontier.getNextUrl();
  frontier.markVisited();
  assert.strictEqual(frontier.pagesVisited, 1);
});

test('PageFrontier: getStats returns accurate counts', () => {
  const frontier = new PageFrontier('https://example.com/page1', 'https://example.com', DEFAULT_SCAN_BUDGET, Date.now());
  
  frontier.addUrl('https://example.com/page2');
  frontier.addUrl('https://example.com/page3');
  frontier.getNextUrl();
  frontier.markVisited();
  
  const stats = frontier.getStats();
  assert.strictEqual(stats.pagesDiscovered, 3);
  assert.strictEqual(stats.pagesVisited, 1);
  assert.strictEqual(stats.queueLength, 2);
});
