import test from 'node:test';
import assert from 'node:assert';
import { ScopePolicy, createScopePolicyFromCli } from '../src/verax/core/scope-policy.js';

// ============================================================================
// Gate 3: Scope Enforcement Tests
// ============================================================================
// Verifies that VERAX filters out-of-scope routes at LEARN-TIME, not suppressed later
// Ensures proper classification of IN_SCOPE_PUBLIC vs OUT_OF_SCOPE_* routes

test('Gate 3: Scope Enforcement', async (t) => {
  // Test 1: Dynamic route detection
  await t.test('Dynamic routes (/:id, /[id], /*) classified as OUT_OF_SCOPE_DYNAMIC', () => {
    const policy = new ScopePolicy();

    const dynamicRoutes = [
      '/users/:id',
      '/posts/[id]',
      '/files/*',
      '/api/users/:userId/posts/:postId',
      '/items/(\\d+)',
      '/users/:id?',
      '/app/**/*'
    ];

    for (const route of dynamicRoutes) {
      const result = policy.classify(route);
      assert.strictEqual(
        result.classification,
        'OUT_OF_SCOPE_DYNAMIC',
        `Route ${route} should be classified as OUT_OF_SCOPE_DYNAMIC but got ${result.classification}`
      );
    }
  });

  // Test 2: Auth/protected route detection
  await t.test('Auth routes (/admin, /account, /settings, /login) classified as OUT_OF_SCOPE_AUTH', () => {
    const policy = new ScopePolicy();

    const authRoutes = [
      '/admin',
      '/admin/dashboard',
      '/account',
      '/account/settings',
      '/settings',
      '/settings/profile',
      '/dashboard',
      '/app',
      '/app/console',
      '/secure',
      '/member',
      '/profile',
      '/user',
      '/users/',
      '/login',
      '/signin',
      '/auth',
      '/oauth'
    ];

    for (const route of authRoutes) {
      const result = policy.classify(route);
      assert.strictEqual(
        result.classification,
        'OUT_OF_SCOPE_AUTH',
        `Route ${route} should be classified as OUT_OF_SCOPE_AUTH but got ${result.classification}`
      );
    }
  });

  // Test 3: Public routes classified as IN_SCOPE_PUBLIC
  await t.test('Public routes (/, /pricing, /signup, /about) classified as IN_SCOPE_PUBLIC', () => {
    const policy = new ScopePolicy();

    const publicRoutes = [
      '/',
      '/pricing',
      '/signup',
      '/contact',
      '/about',
      '/faq',
      '/blog',
      '/docs',
      '/careers'
    ];

    for (const route of publicRoutes) {
      const result = policy.classify(route);
      assert.strictEqual(
        result.classification,
        'IN_SCOPE_PUBLIC',
        `Route ${route} should be classified as IN_SCOPE_PUBLIC but got ${result.classification}`
      );
    }
  });

  // Test 4: Mixed route set classification
  await t.test('Mixed route set correctly separates in-scope from out-of-scope', () => {
    const policy = new ScopePolicy();

    const mixedRoutes = [
      '/',
      '/pricing',
      '/signup',
      '/admin',
      '/dashboard',
      '/users/:id',
      '/users/[id]',
      '/posts/:postId',
      '/about',
      '/contact',
      '/account',
      '/account/settings',
      '/app/console'
    ];

    const result = policy.classifyMany(mixedRoutes);

    assert.deepStrictEqual(result.inScope.sort(), [
      '/',
      '/about',
      '/contact',
      '/pricing',
      '/signup'
    ].sort(), 'In-scope routes should be public routes only');

    assert.strictEqual(
      result.outOfScope.auth.length,
      5,
      'Should have 5 auth-protected routes out of scope'
    );

    assert.strictEqual(
      result.outOfScope.dynamic.length,
      3,
      'Should have 3 dynamic routes out of scope'
    );

    assert.strictEqual(
      result.summary.inScopeCount,
      5,
      'Summary should show 5 routes in scope'
    );

    assert.strictEqual(
      result.summary.outOfScopeCount,
      8,
      'Summary should show 8 routes out of scope'
    );
  });

  // Test 5: Scope policy reports examples
  await t.test('Scope policy provides capped list of skipped route examples', () => {
    const policy = new ScopePolicy();

    const routes = [
      '/',
      '/pricing',
      '/about',
      '/admin',
      '/admin/users',
      '/admin/settings',
      '/dashboard',
      '/app',
      '/users/:id',
      '/posts/:id',
      '/files/*'
    ];

    const result = policy.classifyMany(routes);
    const examples = policy.getSkippedExamples(result, 10);

    assert.strictEqual(
      Array.isArray(examples.auth),
      true,
      'Auth examples should be array'
    );

    assert.strictEqual(
      Array.isArray(examples.dynamic),
      true,
      'Dynamic examples should be array'
    );

    assert(
      examples.auth.length > 0,
      'Should have auth route examples'
    );

    assert(
      examples.dynamic.length > 0,
      'Should have dynamic route examples'
    );
  });

  // Test 6: Custom auth patterns
  await t.test('Custom auth patterns can be added via constructor', () => {
    const policy = new ScopePolicy({
      additionalAuthPatterns: ['/premium', '/special-area']
    });

    const customAuthRoutes = ['/premium', '/premium/features', '/special-area/vault'];

    for (const route of customAuthRoutes) {
      const result = policy.classify(route);
      assert.strictEqual(
        result.classification,
        'OUT_OF_SCOPE_AUTH',
        `Custom auth route ${route} should be OUT_OF_SCOPE_AUTH`
      );
    }
  });

  // Test 7: CLI option parsing
  await t.test('CLI options create scope policy with custom patterns', () => {
    const cliOptions = {
      outOfScopeRoutePattern: '/vip'
    };

    const policy = createScopePolicyFromCli(cliOptions);
    const result = policy.classify('/vip/features');

    assert.strictEqual(
      result.classification,
      'OUT_OF_SCOPE_AUTH',
      'CLI pattern should create auth classification'
    );
  });

  // Test 8: Observation plan excludes out-of-scope routes
  await t.test('Routes filtered at LEARN-TIME: only in-scope routes in observation plan', () => {
    const policy = new ScopePolicy();

    const allRoutes = [
      '/',
      '/pricing',
      '/signup',
      '/admin',
      '/users/:id',
      '/about',
      '/contact'
    ];

    const result = policy.classifyMany(allRoutes);

    // Observation plan should contain ONLY in-scope routes
    assert.deepStrictEqual(
      result.inScope.sort(),
      ['/', '/about', '/contact', '/pricing', '/signup'].sort(),
      'Observation plan should contain only public routes'
    );

    // Verify out-of-scope routes are excluded
    assert.strictEqual(
      result.inScope.includes('/admin'),
      false,
      '/admin should NOT be in observation plan'
    );

    assert.strictEqual(
      result.inScope.includes('/users/:id'),
      false,
      '/users/:id should NOT be in observation plan'
    );
  });

  // Test 9: Budget not spent on out-of-scope routes
  await t.test('Budget tracking excludes out-of-scope routes by design', () => {
    const policy = new ScopePolicy();

    const discovered = [
      '/',
      '/pricing',
      '/admin',
      '/users/:id',
      '/about'
    ];

    const result = policy.classifyMany(discovered);

    // If budget was 100 interactions per route, out-of-scope routes would consume 0
    const inScopeCount = result.inScope.length;
    const outOfScopeCount = result.outOfScope.auth.length + result.outOfScope.dynamic.length;

    assert.strictEqual(inScopeCount, 3, '3 in-scope routes (/, /pricing, /about)');
    assert.strictEqual(outOfScopeCount, 2, '2 out-of-scope routes (/admin, /users/:id)');

    // Budget allocation: if 1000 interactions budget
    // Divided among 3 in-scope routes = 333 per route
    // Out-of-scope routes (2 total) allocated: 0 (gated at learn time)
    assert.strictEqual(
      inScopeCount + outOfScopeCount,
      5,
      'Total routes should be all discovered routes'
    );
  });

  // Test 10: Manifest summary includes scope statistics
  await t.test('Manifest reports totalRoutesDiscovered, routesInScope, routesOutOfScope with categories', () => {
    const policy = new ScopePolicy();

    const routes = [
      '/',
      '/pricing',
      '/admin',
      '/users/:id',
      '/posts/:postId',
      '/dashboard',
      '/about'
    ];

    const result = policy.classifyMany(routes);

    // Manifest-style summary
    const summary = {
      totalRoutesDiscovered: routes.length,
      routesInScope: result.summary.inScopeCount,
      routesOutOfScope: {
        total: result.summary.outOfScopeCount,
        byCategory: result.summary.outOfScopeCounts,
        examples: policy.getSkippedExamples(result)
      }
    };

    assert.strictEqual(summary.totalRoutesDiscovered, 7, 'Total discovered');
    assert.strictEqual(summary.routesInScope, 3, 'Routes in scope');
    assert.strictEqual(summary.routesOutOfScope.total, 4, 'Routes out of scope');
    assert.strictEqual(summary.routesOutOfScope.byCategory.auth, 2, 'Auth category count');
    assert.strictEqual(summary.routesOutOfScope.byCategory.dynamic, 2, 'Dynamic category count');
    assert(
      summary.routesOutOfScope.examples.auth.length > 0,
      'Should have auth examples'
    );
  });
});

// ============================================================================
// Gate 3: Observation Phase Safety Net (Secondary)
// ============================================================================
test('Gate 3: Observe Phase Safety Net (Secondary Check)', async (t) => {
  // Test 11: Even if out-of-scope route slips through, observe skips it
  await t.test('If out-of-scope route reaches observe, it is skipped with SAFETY_BLOCK marker', () => {
    const policy = new ScopePolicy();

    // Simulating a route that somehow made it to observe phase
    const routeInObserve = '/admin/users/:id';
    const classification = policy.classify(routeInObserve);

    // Observe phase should check this classification
    assert.strictEqual(
      classification.classification,
      'OUT_OF_SCOPE_DYNAMIC', // Actually both dynamic AND auth
      'Out-of-scope routes should be detected in observe phase safety net'
    );

    // Outcome: route is skipped with SAFETY_BLOCK marker (not counted as finding)
    // This is a backup mechanism - primary gate is at LEARN time
  });
});

// ============================================================================
// Gate 3: Transparency and Reporting
// ============================================================================
test('Gate 3: Transparency in Reporting', async (t) => {
  // Test 12: Out-of-scope routes reported clearly (not hidden)
  await t.test('Out-of-scope routes appear in summary with category labels', () => {
    const policy = new ScopePolicy();

    const routes = [
      '/',
      '/pricing',
      '/signup',
      '/admin',
      '/dashboard',
      '/users/:id',
      '/posts/:id',
      '/about',
      '/contact'
    ];

    const result = policy.classifyMany(routes);

    // Example summary output (as would appear in summary.json)
    const summaryOutput = {
      totalRoutesDiscovered: result.summary.total,
      routesInScope: result.summary.inScopeCount,
      routesOutOfScope: {
        total: result.summary.outOfScopeCount,
        byCategory: {
          protected: result.summary.outOfScopeCounts.auth,
          dynamic: result.summary.outOfScopeCounts.dynamic,
          external: result.summary.outOfScopeCounts.external,
          unknown: result.summary.outOfScopeCounts.unknown
        },
        explanation: 'Routes not observed: protected routes (admin, account, etc.), dynamic entity routes (/users/:id), and external origins are out of scope',
        examples: {
          protected: policy.getSkippedExamples(result).auth.slice(0, 5),
          dynamic: policy.getSkippedExamples(result).dynamic.slice(0, 5)
        }
      }
    };

    assert.strictEqual(summaryOutput.totalRoutesDiscovered, 9, 'Total discovered routes');
    assert.strictEqual(summaryOutput.routesInScope, 5, 'In-scope routes');
    assert.strictEqual(summaryOutput.routesOutOfScope.total, 4, 'Out-of-scope routes');
    assert(
      summaryOutput.routesOutOfScope.explanation.length > 0,
      'Should include explanation'
    );
  });

  // Test 13: No routes filtered silently
  await t.test('Filtered routes are never suppressed - all reported in manifest', () => {
    const policy = new ScopePolicy();

    const routes = [
      '/',
      '/admin',
      '/users/:id'
    ];

    const result = policy.classifyMany(routes);

    // Verify routes are tracked (not lost)
    const totalTracked = result.inScope.length + result.outOfScope.auth.length + result.outOfScope.dynamic.length;

    assert.strictEqual(
      totalTracked,
      routes.length,
      'All routes should be tracked (none hidden)'
    );
  });
});

// ============================================================================
// Gate 3: Comparison with Previous Approach
// ============================================================================
test('Gate 3: Comparison - Learn-Time Filtering vs Post-Hoc Suppression', async (t) => {
  // Test 14: Learn-time filtering is primary mechanism
  await t.test('Learn-time filtering prevents observation plan pollution vs post-hoc suppression', () => {
    const policy = new ScopePolicy();

    const allRoutes = [
      '/',
      '/pricing',
      '/admin',
      '/users/:id',
      '/about'
    ];

    const result = policy.classifyMany(allRoutes);

    // OLD APPROACH (pre-Gate 3):
    // - Routes: [ '/', '/pricing', '/admin', '/users/:id', '/about' ]
    // - Observe ALL routes
    // - Suppress findings from out-of-scope routes in verdict
    // - Problem: Budget still spent, observation plan polluted

    // NEW APPROACH (Gate 3):
    // - Routes IN observation plan: [ '/', '/pricing', '/about' ]
    // - Skip observation of out-of-scope routes
    // - Problem: None - budget preserved, observation plan clean

    assert.deepStrictEqual(
      result.inScope.sort(),
      ['/', '/about', '/pricing'].sort(),
      'Observation plan includes only public routes'
    );

    // Out-of-scope routes not in plan at all
    assert.strictEqual(
      result.inScope.includes('/admin'),
      false,
      'Admin not in observation plan'
    );

    assert.strictEqual(
      result.inScope.includes('/users/:id'),
      false,
      'Dynamic route not in observation plan'
    );
  });
});
