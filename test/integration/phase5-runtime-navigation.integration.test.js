// Runtime Navigation Discovery - Category: framework-integration

import test from 'node:test';
import assert from 'node:assert';
import { resolve } from 'path';
import { chromium } from 'playwright';
import { discoverRuntimeNavigation, normalizeHref, createRuntimeNavExpectation, stableTargetId } from '../../src/cli/util/observation/runtime-navigation-discovery.js';

test('Runtime Navigation Discovery - Basic Functionality', async (t) => {
  let browser;
  let page;
  
  try {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    
    const fixturePath = resolve(process.cwd(), 'test/release/fixtures/dynamic-links/index.html');
    const baseUrl = `file://${fixturePath}`;
    
    // Navigate and wait for DOM to be ready
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500); // Let JS execute to create dynamic links
    
    // Discover runtime navigation targets
    const targets = await discoverRuntimeNavigation(page, {
      baseUrl,
      allowCrossOrigin: false,
      maxTargets: 25
    });
    
    // Verify discovery basics
    assert.ok(targets.length > 0, 'Should discover at least some navigation targets');
    assert.ok(targets.length <= 25, 'Should respect maxTargets budget');
    
    // Extract discovered hrefs
    const hrefs = targets.map(t => t.normalizedHref);
    
    // Verify static links are discovered
    assert.ok(hrefs.some(h => h.includes('/static-page')), 'Should find /static-page link');
    assert.ok(hrefs.some(h => h.includes('/about')), 'Should find /about link');
    
    // Verify dynamic links are discovered (created by JavaScript)
    assert.ok(hrefs.some(h => h.includes('/user/123')), 'Should find dynamic /user/123 link');
    assert.ok(hrefs.some(h => h.includes('/settings')), 'Should find dynamic /settings link');
    assert.ok(hrefs.some(h => h.includes('/dashboard')), 'Should find dynamic /dashboard link');
    
    // Verify broken link is discovered (we discover it, but later tests will verify it fails)
    assert.ok(hrefs.some(h => h.includes('/broken-destination')), 'Should find broken link in discovery');
    
    // Verify exclusions (these should NOT be discovered)
    assert.ok(!hrefs.some(h => h === '#' || h.includes('#section')), 'Should exclude hash/anchor links');
    assert.ok(!hrefs.some(h => h.startsWith('javascript:')), 'Should exclude javascript: protocol');
    assert.ok(!hrefs.some(h => h.startsWith('mailto:')), 'Should exclude mailto: links');
    assert.ok(!hrefs.some(h => h.startsWith('tel:')), 'Should exclude tel: links');
    
    // Verify role="link" discovery
    assert.ok(hrefs.some(h => h.includes('/role-navigation')), 'Should find role="link" with href');
    assert.ok(hrefs.some(h => h.includes('/role-child-navigation')), 'Should find role="link" containing anchor');
    
    t.diagnostic(`✓ Discovered ${targets.length} runtime navigation targets`);
    
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
});

test('Runtime Navigation Discovery - Determinism', async (t) => {
  let browser;
  let page;
  
  try {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    
    const fixturePath = resolve(process.cwd(), 'test/release/fixtures/dynamic-links/index.html');
    const baseUrl = `file://${fixturePath}`;
    
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    
    // Discover twice
    const targets1 = await discoverRuntimeNavigation(page, { baseUrl, maxTargets: 25 });
    const targets2 = await discoverRuntimeNavigation(page, { baseUrl, maxTargets: 25 });
    
    // Verify same count
    assert.strictEqual(targets1.length, targets2.length, 'Should discover same number of targets');
    
    // Verify same order
    for (let i = 0; i < targets1.length; i++) {
      assert.strictEqual(
        targets1[i].normalizedHref,
        targets2[i].normalizedHref,
        `Target ${i} should have same href in same order`
      );
    }
    
    // Create expectations and verify IDs are deterministic
    const expectations1 = targets1.map(t => createRuntimeNavExpectation(t));
    const expectations2 = targets2.map(t => createRuntimeNavExpectation(t));
    
    for (let i = 0; i < expectations1.length; i++) {
      assert.strictEqual(
        expectations1[i].id,
        expectations2[i].id,
        `Expectation ${i} should have deterministic ID`
      );
      
      // Verify ID does not contain timestamp or random data
      assert.ok(expectations1[i].id.startsWith('runtime-nav-'), 'ID should have runtime-nav prefix');
      assert.ok(!/\d{13}/.test(expectations1[i].id), 'ID should not contain timestamp');
    }
    
    t.diagnostic(`✓ Determinism verified: ${expectations1.length} expectations with stable IDs`);
    
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
});

test('Runtime Navigation Discovery - normalizeHref', () => {
  const baseUrl = 'https://example.com/app/page';
  
  // Absolute URLs should remain unchanged
  assert.strictEqual(
    normalizeHref('https://other.com/path', baseUrl),
    'https://other.com/path'
  );
  
  // Relative paths should resolve against base
  assert.strictEqual(
    normalizeHref('/about', baseUrl),
    'https://example.com/about'
  );
  
  assert.strictEqual(
    normalizeHref('../parent', baseUrl),
    'https://example.com/parent'
  );
  
  assert.strictEqual(
    normalizeHref('child', baseUrl),
    'https://example.com/app/child'
  );
  
  // Invalid hrefs should return null
  assert.strictEqual(normalizeHref('', baseUrl), null);
  assert.strictEqual(normalizeHref(null, baseUrl), null);
  assert.strictEqual(normalizeHref(undefined, baseUrl), null);
  
  console.log('✓ normalizeHref works correctly');
});

test('Runtime Navigation Discovery - stableTargetId', () => {
  const target1 = {
    normalizedHref: 'https://example.com/user/123',
    tagName: 'a',
    selectorPath: 'div#app > a.user-link',
    attributes: { href: '/user/123', role: '' }
  };
  
  const target2 = {
    normalizedHref: 'https://example.com/user/123',
    tagName: 'a',
    selectorPath: 'div#app > a.user-link',
    attributes: { href: '/user/123', role: '' }
  };
  
  const target3 = {
    normalizedHref: 'https://example.com/user/456', // Different href
    tagName: 'a',
    selectorPath: 'div#app > a.user-link',
    attributes: { href: '/user/456', role: '' }
  };
  
  // Same targets should produce same ID
  const id1 = stableTargetId(target1);
  const id2 = stableTargetId(target2);
  assert.strictEqual(id1, id2, 'Same target should produce same ID');
  
  // Different targets should produce different IDs
  const id3 = stableTargetId(target3);
  assert.notStrictEqual(id1, id3, 'Different target should produce different ID');
  
  // ID should have correct format
  assert.ok(id1.startsWith('runtime-nav-'), 'ID should have runtime-nav prefix');
  assert.strictEqual(id1.length, 'runtime-nav-'.length + 16, 'ID should have 16-char hash');
  
  console.log('✓ stableTargetId generates deterministic IDs');
});
