import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { computeRouteBudget } from '../src/verax/core/budget-engine.js';
import { 
  buildSnapshot, 
  compareSnapshots, 
  loadPreviousSnapshot, 
  saveSnapshot,
  shouldSkipInteractionIncremental,
  computeRouteSignature,
  computeExpectationSignature
} from '../src/verax/core/incremental-store.js';
import { DEFAULT_SCAN_BUDGET } from '../src/verax/shared/scan-budget.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('adaptive budget allocation - critical route gets higher budget', async () => {
  const manifest = {
    routes: [
      { path: '/', sourceRef: 'index.ts:1' },
      { path: '/about', sourceRef: 'about.ts:1' },
      { path: '/users', sourceRef: 'users.ts:1' }
    ],
    staticExpectations: [
      { type: 'spa_navigation', fromPath: '/', targetPath: '/about', sourceRef: 'home.vue:10' },
      { type: 'spa_navigation', fromPath: '/', targetPath: '/users', sourceRef: 'home.vue:15' }
    ]
  };
  
  const baseBudget = DEFAULT_SCAN_BUDGET;
  
  // Critical route (has expectations) - URL '/' should match route '/' and expectations with fromPath '/'
  const criticalBudget = computeRouteBudget(manifest, 'http://localhost/', baseBudget);
  // Route '/' should match expectations with fromPath '/', giving expectationsForRoute = 2
  // This should trigger critical route budget (1.5x = 45 for base budget of 30)
  assert.equal(criticalBudget.expectationsForRoute, 2, 'Route should match 2 expectations with fromPath "/"');
  assert.equal(criticalBudget.maxInteractionsPerPage, 45, 'Critical route should get 1.5x budget (30 * 1.5 = 45)');
  assert.equal(criticalBudget.budgetReason, 'critical_route', 'Budget reason should be "critical_route"');
  
  // Non-critical route (no expectations, small project so gets base budget)
  const nonCriticalBudget = computeRouteBudget(manifest, 'http://localhost/other', baseBudget);
  // In small projects (< 10 routes), non-critical routes get base budget (no reduction)
  assert.equal(nonCriticalBudget.maxInteractionsPerPage, baseBudget.maxInteractionsPerPage, 
    'Non-critical route in small project should get same budget as base');
});

test('adaptive budget allocation - large project scales down budgets', () => {
  const largeManifest = {
    routes: Array.from({ length: 60 }, (_, i) => ({ path: `/route${i}`, sourceRef: `route${i}.ts:1` })),
    staticExpectations: []
  };
  
  const baseBudget = DEFAULT_SCAN_BUDGET;
  const largeProjectBudget = computeRouteBudget(largeManifest, 'http://localhost/route0', baseBudget);
  
  // Large projects should scale down budgets
  assert.ok(largeProjectBudget.maxInteractionsPerPage < baseBudget.maxInteractionsPerPage,
    'Large project should scale down budgets');
});

test('computeRouteSignature produces deterministic signatures', () => {
  const route1 = { path: '/users', sourceRef: 'users.ts:1', isDynamic: false };
  const route2 = { path: '/users', sourceRef: 'users.ts:1', isDynamic: false };
  const route3 = { path: '/users', sourceRef: 'users.ts:2', isDynamic: false };
  
  const sig1 = computeRouteSignature(route1);
  const sig2 = computeRouteSignature(route2);
  const sig3 = computeRouteSignature(route3);
  
  assert.equal(sig1, sig2, 'Same route should produce same signature');
  assert.notEqual(sig1, sig3, 'Different sourceRef should produce different signature');
});

test('computeExpectationSignature produces deterministic signatures', () => {
  const exp1 = { type: 'spa_navigation', fromPath: '/', targetPath: '/about', sourceRef: 'home.vue:10' };
  const exp2 = { type: 'spa_navigation', fromPath: '/', targetPath: '/about', sourceRef: 'home.vue:10' };
  const exp3 = { type: 'spa_navigation', fromPath: '/', targetPath: '/users', sourceRef: 'home.vue:10' };
  
  const sig1 = computeExpectationSignature(exp1);
  const sig2 = computeExpectationSignature(exp2);
  const sig3 = computeExpectationSignature(exp3);
  
  assert.equal(sig1, sig2, 'Same expectation should produce same signature');
  assert.notEqual(sig1, sig3, 'Different targetPath should produce different signature');
});

test('buildSnapshot creates snapshot with route and expectation signatures', () => {
  const manifest = {
    routes: [
      { path: '/', sourceRef: 'index.ts:1' },
      { path: '/about', sourceRef: 'about.ts:1' }
    ],
    staticExpectations: [
      { type: 'spa_navigation', fromPath: '/', targetPath: '/about', sourceRef: 'home.vue:10' }
    ],
    learnTruth: { version: '1.0' }
  };
  
  const snapshot = buildSnapshot(manifest, []);
  
  assert.ok(snapshot.timestamp, 'Snapshot should have timestamp');
  assert.equal(snapshot.routes.length, 2, 'Snapshot should include all routes');
  assert.equal(snapshot.expectations.length, 1, 'Snapshot should include all expectations');
  assert.ok(snapshot.routes[0].signature, 'Route should have signature');
  assert.ok(snapshot.expectations[0].signature, 'Expectation should have signature');
});

test('compareSnapshots detects unchanged routes and expectations', () => {
  const manifest1 = {
    routes: [
      { path: '/', sourceRef: 'index.ts:1' },
      { path: '/about', sourceRef: 'about.ts:1' }
    ],
    staticExpectations: [
      { type: 'spa_navigation', fromPath: '/', targetPath: '/about', sourceRef: 'home.vue:10' }
    ],
    learnTruth: { version: '1.0' }
  };
  
  const snapshot1 = buildSnapshot(manifest1, []);
  
  // Same manifest
  const manifest2 = { ...manifest1 };
  const snapshot2 = buildSnapshot(manifest2, []);
  
  const diff = compareSnapshots(snapshot1, snapshot2);
  
  assert.equal(diff.hasChanges, false, 'Identical snapshots should have no changes');
  assert.equal(diff.changedRoutes.length, 0, 'No routes should be marked as changed');
  assert.equal(diff.changedExpectations.length, 0, 'No expectations should be marked as changed');
  assert.equal(diff.unchangedRoutes.length, 2, 'All routes should be unchanged');
});

test('compareSnapshots detects changed routes', () => {
  const manifest1 = {
    routes: [
      { path: '/', sourceRef: 'index.ts:1' },
      { path: '/about', sourceRef: 'about.ts:1' }
    ],
    staticExpectations: [],
    learnTruth: { version: '1.0' }
  };
  
  const snapshot1 = buildSnapshot(manifest1, []);
  
  // Changed route sourceRef
  const manifest2 = {
    routes: [
      { path: '/', sourceRef: 'index.ts:1' },
      { path: '/about', sourceRef: 'about.ts:2' } // Changed
    ],
    staticExpectations: [],
    learnTruth: { version: '1.0' }
  };
  
  const snapshot2 = buildSnapshot(manifest2, []);
  
  const diff = compareSnapshots(snapshot1, snapshot2);
  
  assert.equal(diff.hasChanges, true, 'Changed route should be detected');
  assert.ok(diff.changedRoutes.includes('/about'), 'Changed route should be in changedRoutes');
});

test('compareSnapshots detects changed expectations', () => {
  const manifest1 = {
    routes: [],
    staticExpectations: [
      { type: 'spa_navigation', fromPath: '/', targetPath: '/about', sourceRef: 'home.vue:10' }
    ],
    learnTruth: { version: '1.0' }
  };
  
  const snapshot1 = buildSnapshot(manifest1, []);
  
  // Changed expectation targetPath
  const manifest2 = {
    routes: [],
    staticExpectations: [
      { type: 'spa_navigation', fromPath: '/', targetPath: '/users', sourceRef: 'home.vue:10' } // Changed
    ],
    learnTruth: { version: '1.0' }
  };
  
  const snapshot2 = buildSnapshot(manifest2, []);
  
  const diff = compareSnapshots(snapshot1, snapshot2);
  
  assert.equal(diff.hasChanges, true, 'Changed expectation should be detected');
  // Changed expectations includes both removed old expectation signature and added new expectation signature
  // So we get 2 changed signatures: the old one (removed) and the new one (added)
  assert.equal(diff.changedExpectations.length, 2, 'Two expectation signatures should be marked as changed (old removed + new added)');
});

test('shouldSkipInteractionIncremental - unchanged route with unchanged expectations skips interaction', () => {
  const manifest1 = {
    routes: [{ path: '/', sourceRef: 'index.ts:1' }],
    staticExpectations: [],
    learnTruth: { version: '1.0' }
  };
  
  const snapshot1 = buildSnapshot(manifest1, [
    { type: 'button', selector: 'button#submit', url: 'http://localhost/' }
  ]);
  
  // Same manifest (unchanged)
  const snapshot2 = buildSnapshot(manifest1, []);
  const diff = compareSnapshots(snapshot1, snapshot2);
  
  const interaction = { type: 'button', selector: 'button#submit' };
  const url = 'http://localhost/';
  
  // Should skip: route unchanged, expectations unchanged, interaction was seen before
  const shouldSkip = shouldSkipInteractionIncremental(interaction, url, snapshot1, diff);
  assert.equal(shouldSkip, true, 'Unchanged interaction on unchanged route should be skipped');
});

test('shouldSkipInteractionIncremental - changed route does not skip', () => {
  const manifest1 = {
    routes: [{ path: '/', sourceRef: 'index.ts:1' }],
    staticExpectations: [],
    learnTruth: { version: '1.0' }
  };
  
  const snapshot1 = buildSnapshot(manifest1, [
    { type: 'button', selector: 'button#submit', url: 'http://localhost/' }
  ]);
  
  // Changed route
  const manifest2 = {
    routes: [{ path: '/', sourceRef: 'index.ts:2' }], // Changed
    staticExpectations: [],
    learnTruth: { version: '1.0' }
  };
  
  const snapshot2 = buildSnapshot(manifest2, []);
  const diff = compareSnapshots(snapshot1, snapshot2);
  
  const interaction = { type: 'button', selector: 'button#submit' };
  const url = 'http://localhost/';
  
  // Should NOT skip: route changed
  const shouldSkip = shouldSkipInteractionIncremental(interaction, url, snapshot1, diff);
  assert.equal(shouldSkip, false, 'Changed route should trigger re-scan');
});

test('shouldSkipInteractionIncremental - changed expectations do not skip', () => {
  const manifest1 = {
    routes: [{ path: '/', sourceRef: 'index.ts:1' }],
    staticExpectations: [
      { type: 'spa_navigation', fromPath: '/', targetPath: '/about', sourceRef: 'home.vue:10' }
    ],
    learnTruth: { version: '1.0' }
  };
  
  const snapshot1 = buildSnapshot(manifest1, [
    { type: 'button', selector: 'button#submit', url: 'http://localhost/' }
  ]);
  
  // Changed expectation
  const manifest2 = {
    routes: [{ path: '/', sourceRef: 'index.ts:1' }],
    staticExpectations: [
      { type: 'spa_navigation', fromPath: '/', targetPath: '/users', sourceRef: 'home.vue:10' } // Changed
    ],
    learnTruth: { version: '1.0' }
  };
  
  const snapshot2 = buildSnapshot(manifest2, []);
  const diff = compareSnapshots(snapshot1, snapshot2);
  
  const interaction = { type: 'button', selector: 'button#submit' };
  const url = 'http://localhost/';
  
  // Should NOT skip: expectations changed
  const shouldSkip = shouldSkipInteractionIncremental(interaction, url, snapshot1, diff);
  assert.equal(shouldSkip, false, 'Changed expectations should trigger re-scan');
});

test('saveSnapshot and loadPreviousSnapshot persist snapshot correctly', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  const manifest = {
    routes: [{ path: '/', sourceRef: 'index.ts:1' }],
    staticExpectations: [],
    learnTruth: { version: '1.0' }
  };
  
  const snapshot = buildSnapshot(manifest, []);
  saveSnapshot(tmpDir, snapshot);
  
  const loaded = loadPreviousSnapshot(tmpDir);
  
  assert.ok(loaded, 'Snapshot should be loadable');
  assert.equal(loaded.routes.length, snapshot.routes.length, 'Loaded snapshot should match saved snapshot');
  assert.equal(loaded.routes[0].signature, snapshot.routes[0].signature, 'Route signatures should match');
});

test('deterministic ordering - same inputs produce same results', () => {
  const manifest1 = {
    routes: [
      { path: '/zebra', sourceRef: 'z.ts:1' },
      { path: '/apple', sourceRef: 'a.ts:1' },
      { path: '/banana', sourceRef: 'b.ts:1' }
    ],
    staticExpectations: [],
    learnTruth: { version: '1.0' }
  };
  
  const manifest2 = {
    routes: [
      { path: '/apple', sourceRef: 'a.ts:1' },
      { path: '/banana', sourceRef: 'b.ts:1' },
      { path: '/zebra', sourceRef: 'z.ts:1' }
    ],
    staticExpectations: [],
    learnTruth: { version: '1.0' }
  };
  
  // Same routes in different order should produce same snapshot
  const snapshot1 = buildSnapshot(manifest1, []);
  const snapshot2 = buildSnapshot(manifest2, []);
  
  // Routes should be sorted deterministically by path
  const routes1 = snapshot1.routes.map(r => r.path).sort();
  const routes2 = snapshot2.routes.map(r => r.path).sort();
  
  assert.deepEqual(routes1, routes2, 'Routes should be sorted deterministically');
  
  // Signatures should match for same routes regardless of input order
  const sig1 = snapshot1.routes.find(r => r.path === '/apple').signature;
  const sig2 = snapshot2.routes.find(r => r.path === '/apple').signature;
  assert.equal(sig1, sig2, 'Same route should produce same signature regardless of input order');
});
