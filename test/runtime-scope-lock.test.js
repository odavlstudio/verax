import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { PageFrontier } from '../src/verax/observe/page-reachability-tracker.js';
import { ScopePolicy } from '../src/verax/core/scope-policy.js';

/**
 * RUNTIME SCOPE LOCK TESTS
 * 
 * Verify that PageFrontier enforces scope-policy at runtime.
 * Ensure NO out-of-scope URLs are enqueued during navigation discovery.
 */

describe('Runtime Scope Lock - PageFrontier Integration', () => {
  const baseUrl = 'http://example.com';
  const baseOrigin = 'http://example.com';
  const scanBudget = {
    maxPages: 50,
    maxScanDurationMs: 120000,
    maxUniqueUrls: 100,
    maxExpectations: 100
  };
  const startTime = Date.now();

  // Test 1: Auth URLs not enqueued at runtime
  it('should skip auth URLs at runtime with scope-policy', () => {
    const scopePolicy = new ScopePolicy({ conservativeMode: true });
    const frontier = new PageFrontier(baseUrl, baseOrigin, scanBudget, startTime, scopePolicy);

    // Attempt to add protected routes
    const adminResult = frontier.addUrl('http://example.com/admin');
    const accountResult = frontier.addUrl('http://example.com/account');
    const dashboardResult = frontier.addUrl('http://example.com/dashboard');
    
    // All should be blocked
    assert.strictEqual(adminResult.added, false, 'Admin URL should not be added');
    assert.strictEqual(adminResult.reason, 'out_of_scope_runtime', 'Admin should have scope_policy reason');
    assert.strictEqual(adminResult.scopeClassification, 'OUT_OF_SCOPE_AUTH', 'Admin should be classified as auth');
    
    assert.strictEqual(accountResult.added, false, 'Account URL should not be added');
    assert.strictEqual(accountResult.scopeClassification, 'OUT_OF_SCOPE_AUTH', 'Account should be classified as auth');
    
    assert.strictEqual(dashboardResult.added, false, 'Dashboard URL should not be added');
    assert.strictEqual(dashboardResult.scopeClassification, 'OUT_OF_SCOPE_AUTH', 'Dashboard should be classified as auth');

    // Verify they're tracked in skippedUrls
    assert.strictEqual(frontier.skippedUrls.length, 3, 'Should have 3 skipped URLs');
    assert.strictEqual(frontier.skippedUrls[0].classification, 'OUT_OF_SCOPE_AUTH');
    assert.strictEqual(frontier.skippedUrls[1].classification, 'OUT_OF_SCOPE_AUTH');
    assert.strictEqual(frontier.skippedUrls[2].classification, 'OUT_OF_SCOPE_AUTH');

    // Queue should only have the initial URL (startUrl)
    assert.strictEqual(frontier.queue.length, 1, 'Queue should have only initial URL after skips');
  });

  // Test 2: Dynamic routes not enqueued at runtime
  it('should skip dynamic routes at runtime with scope-policy', () => {
    const scopePolicy = new ScopePolicy({ conservativeMode: true });
    const frontier = new PageFrontier(baseUrl, baseOrigin, scanBudget, startTime, scopePolicy);

    // Attempt to add dynamic routes
    const userIdResult = frontier.addUrl('http://example.com/users/:id');
    const postIdResult = frontier.addUrl('http://example.com/posts/[id]');
    const catchAllResult = frontier.addUrl('http://example.com/files/*');

    // All should be blocked
    assert.strictEqual(userIdResult.added, false, 'Dynamic user route should not be added');
    assert.strictEqual(userIdResult.scopeClassification, 'OUT_OF_SCOPE_DYNAMIC', 'Should be classified as dynamic');
    
    assert.strictEqual(postIdResult.added, false, 'Dynamic post route should not be added');
    assert.strictEqual(postIdResult.scopeClassification, 'OUT_OF_SCOPE_DYNAMIC', 'Should be classified as dynamic');
    
    assert.strictEqual(catchAllResult.added, false, 'Catch-all route should not be added');
    assert.strictEqual(catchAllResult.scopeClassification, 'OUT_OF_SCOPE_DYNAMIC', 'Should be classified as dynamic');

    // Verify they're tracked
    assert.strictEqual(frontier.skippedUrls.length, 3, 'Should have 3 skipped URLs');
  });

  // Test 3: Public URLs are enqueued at runtime
  it('should enqueue public URLs at runtime with scope-policy', () => {
    const scopePolicy = new ScopePolicy({ conservativeMode: true });
    const frontier = new PageFrontier(baseUrl, baseOrigin, scanBudget, startTime, scopePolicy);

    // Add public routes
    const homeResult = frontier.addUrl('http://example.com/');
    const aboutResult = frontier.addUrl('http://example.com/about');
    const pricingResult = frontier.addUrl('http://example.com/pricing');

    // All should be added
    assert.strictEqual(homeResult.added, true, 'Home URL should be added');
    assert.strictEqual(aboutResult.added, true, 'About URL should be added');
    assert.strictEqual(pricingResult.added, true, 'Pricing URL should be added');

    // Queue should have initial URL + 3 new URLs = 4 total
    assert.strictEqual(frontier.queue.length, 4, 'Should have 4 URLs in queue (initial + 3 new)');
    assert.strictEqual(frontier.skippedUrls.length, 0, 'Should have 0 skipped URLs');
  });

  // Test 4: Without scope-policy, all same-origin URLs are enqueued (backward compat)
  it('should enqueue all same-origin URLs when scope-policy is null', () => {
    // No scopePolicy passed
    const frontier = new PageFrontier(baseUrl, baseOrigin, scanBudget, startTime, null);

    // Add various URLs
    const adminResult = frontier.addUrl('http://example.com/admin');
    const userIdResult = frontier.addUrl('http://example.com/users/123');
    const aboutResult = frontier.addUrl('http://example.com/about');

    // All should be added (no scope checking without policy)
    assert.strictEqual(adminResult.added, true, 'Admin URL should be added without scope-policy');
    assert.strictEqual(userIdResult.added, true, 'Dynamic URL should be added without scope-policy');
    assert.strictEqual(aboutResult.added, true, 'Public URL should be added without scope-policy');

    // Queue should have initial URL + 3 new = 4 total
    assert.strictEqual(frontier.queue.length, 4, 'Should have 4 URLs in queue (initial + 3 new)');
    assert.strictEqual(frontier.skippedUrls.length, 0, 'Should have 0 skipped URLs without scope-policy');
  });

  // Test 5: Mixed scenario - public + protected URLs
  it('should handle mixed public and protected URLs correctly', () => {
    const scopePolicy = new ScopePolicy({ conservativeMode: true });
    const frontier = new PageFrontier(baseUrl, baseOrigin, scanBudget, startTime, scopePolicy);

    // Add a mix
    const publicUrls = ['/', '/about', '/pricing', '/contact'];
    const protectedUrls = ['/admin', '/dashboard', '/account/settings'];

    for (const url of publicUrls) {
      frontier.addUrl(`http://example.com${url}`);
    }
    for (const url of protectedUrls) {
      frontier.addUrl(`http://example.com${url}`);
    }

    // Public URLs should all be enqueued (including initial URL)
    assert.strictEqual(frontier.queue.length, 5, 'Should have 5 public URLs in queue (initial + 4 new)');
    
    // Protected URLs should all be skipped
    assert.strictEqual(frontier.skippedUrls.length, 3, 'Should have 3 protected URLs skipped');
  });

  // Test 6: Budget consumption not affected by out-of-scope URLs
  it('should not consume budget on out-of-scope URLs', () => {
    const scopePolicy = new ScopePolicy({ conservativeMode: true });
    const frontier = new PageFrontier(baseUrl, baseOrigin, { ...scanBudget, maxUniqueUrls: 3 }, startTime, scopePolicy);

    // Initial frontier has 1 page discovered (startUrl)
    assert.strictEqual(frontier.pagesDiscovered, 1, 'Should start with 1 page discovered (startUrl)');

    // Add protected URLs (should not consume budget)
    frontier.addUrl('http://example.com/admin');
    frontier.addUrl('http://example.com/dashboard');
    frontier.addUrl('http://example.com/account');

    // Pages discovered should still be 1
    assert.strictEqual(frontier.pagesDiscovered, 1, 'Protected URLs should not consume budget');

    // Now add public URLs
    frontier.addUrl('http://example.com/about');
    frontier.addUrl('http://example.com/pricing');

    // Now pages discovered should be 3 (initial + 2 public)
    assert.strictEqual(frontier.pagesDiscovered, 3, 'Public URLs should consume budget');

    // Try to add one more public URL (should cap)
    const result = frontier.addUrl('http://example.com/contact');
    assert.strictEqual(result.added, false, 'Should cap at maxUniqueUrls');
    assert.strictEqual(result.reason, 'frontier_capped', 'Should have frontier_capped reason');
  });

  // Test 7: Scope check happens before budget cap
  it('scope check should happen before budget cap check', () => {
    const scopePolicy = new ScopePolicy({ conservativeMode: true });
    const frontier = new PageFrontier(baseUrl, baseOrigin, { ...scanBudget, maxUniqueUrls: 1 }, startTime, scopePolicy);

    // Add one public URL (consumes budget)
    frontier.addUrl('http://example.com/');
    assert.strictEqual(frontier.pagesDiscovered, 1, 'Should have consumed budget');

    // Try to add a protected URL (should be skipped due to scope, not budget)
    const adminResult = frontier.addUrl('http://example.com/admin');
    assert.strictEqual(adminResult.added, false, 'Should skip protected URL');
    assert.strictEqual(adminResult.reason, 'out_of_scope_runtime', 'Should skip due to scope, not budget');
    assert.strictEqual(adminResult.scopeClassification, 'OUT_OF_SCOPE_AUTH', 'Should show scope classification');

    // Try to add a public URL (should fail due to budget, now that protected URL was skipped)
    const secondPublicResult = frontier.addUrl('http://example.com/about');
    assert.strictEqual(secondPublicResult.added, false, 'Should not add due to budget');
    assert.strictEqual(secondPublicResult.reason, 'frontier_capped', 'Should cap due to budget');
  });

  // Test 8: Verify return structure
  it('should return consistent structure from addUrl()', () => {
    const scopePolicy = new ScopePolicy({ conservativeMode: true });
    const frontier = new PageFrontier(baseUrl, baseOrigin, scanBudget, startTime, scopePolicy);

    // Successful add (returns { added: true })
    const successResult = frontier.addUrl('http://example.com/about');
    assert.strictEqual(typeof successResult.added, 'boolean', 'Should have added property');
    assert(Object.hasOwnProperty.call(successResult, 'added'), 'Should have added property');
    assert.strictEqual(successResult.added, true, 'Success should have added=true');

    // Out-of-scope skip (returns { added: false, reason: '...', scopeClassification: '...' })
    const skipResult = frontier.addUrl('http://example.com/admin');
    assert.strictEqual(skipResult.added, false, 'Should have added=false');
    assert.strictEqual(typeof skipResult.reason, 'string', 'Should have reason property for skips');
    assert.strictEqual(skipResult.reason, 'out_of_scope_runtime', 'Should have out_of_scope_runtime reason');
    assert.strictEqual(skipResult.scopeClassification, 'OUT_OF_SCOPE_AUTH', 'Should have scopeClassification for scope skips');
  });
});
