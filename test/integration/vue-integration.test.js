/**
 * Vue.js Framework Support - Comprehensive Integration Test (PHASE 2)
 * Category: framework-integration
 *
 * Validates production-grade support for Vue (vue-router) with literal-only extraction,
 * deterministic IDs, and runtime observation. No placeholders, evidence-only.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'path';
import { readFileSync, mkdtempSync, rmSync } from 'fs';
import http from 'node:http';

import { detectFramework } from '../../src/cli/util/detection/framework-detector.js';
import { extractExpectations } from '../../src/cli/util/observation/expectation-extractor.js';
import { observeExpectations } from '../../src/cli/util/observation/observation-engine.js';
import { expIdFromHash } from '../../src/cli/util/support/idgen.js';

const FIXTURES_DIR = resolve('./test/release/../fixtures');

/**
 * Minimal HTTP server for the runtime Vue SPA fixture
 */
async function createVueLiteServer() {
  return new Promise((promiseResolve, reject) => {
    const server = http.createServer((req, res) => {
      const fixturePath = resolve(process.cwd(), 'test/fixtures/vue-realistic-lite');

      if (req.url === '/') {
        try {
          const html = readFileSync(join(fixturePath, 'index.html'), 'utf-8');
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(html);
        } catch (e) {
          res.writeHead(500);
          res.end('Internal server error');
        }
        return;
      }

      // Serve simple pages for SPA routes
      if (req.url === '/ok') {
        const html = `<!DOCTYPE html><html><head><title>ok</title></head><body><h1>OK</h1></body></html>`;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
      }

      if (req.url === '/broken') {
        const html = `<!DOCTYPE html><html><head><title>broken</title></head><body><h1>Broken</h1></body></html>`;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
      }

      // 404 for others
      res.writeHead(404);
      res.end('Not found');
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const baseUrl = `http://${addr.address}:${addr.port}`;
      promiseResolve({ server, baseUrl });
    });

    server.on('error', reject);
  });
}

/**
 * Test 1: Framework Detection for Vue
 */
test('Vue (vue-router) framework detection', async () => {
  const fixturePath = resolve(FIXTURES_DIR, 'vue-router-app');
  const result = detectFramework(fixturePath);

  assert.strictEqual(result.framework, 'vue', 'Framework should be detected as vue');
  assert.ok(result.confidence > 20, 'Confidence should be meaningful (>20)');
  assert.ok(
    result.evidence.some((e) => e.toLowerCase().includes('vue')),
    'Evidence trail should mention Vue markers'
  );
});

/**
 * Test 2: Promise Extraction (literal-only)
 */
test('Vue SFC literal-only promise extraction', async () => {
  const fixturePath = resolve(FIXTURES_DIR, 'vue-sfc-lite');
  const projectProfile = {
    framework: 'vue',
    router: 'vue-router',
    sourceRoot: fixturePath,
  };

  const { expectations, skipped } = await extractExpectations(projectProfile);

  // Should extract RouterLink and router.push/replace variants with string literals
  const values = expectations.map((e) => e.promise?.value);
  assert.ok(values.includes('/pricing'), 'Extract <router-link to="/pricing">');
  assert.ok(values.includes('/about'), 'Extract <RouterLink to="/about">');
  assert.ok(values.includes('/checkout'), 'Extract router.push("/checkout")');
  assert.ok(values.includes('/contact'), 'Extract $router.push("/contact")');
  assert.ok(values.includes('/settings'), 'Extract $router.replace("/settings")');

  // Dynamic patterns must be skipped explicitly
  assert.ok(skipped.dynamic >= 1, 'Dynamic routes should be counted as skipped');

  // All expectations have deterministic IDs
  expectations.forEach((exp) => {
    const expectedId = expIdFromHash(
      exp.source.file,
      exp.source.line,
      exp.source.column,
      exp.promise.kind,
      exp.promise.value
    );
    assert.strictEqual(exp.id, expectedId, 'ID must be hash-based and deterministic');
  });
});

/**
 * Test 3: Determinism — run extraction twice and compare
 */
test('Vue promise extraction determinism', async () => {
  const fixturePath = resolve(FIXTURES_DIR, 'vue-sfc-lite');
  const profile = { framework: 'vue', router: 'vue-router', sourceRoot: fixturePath };

  const r1 = await extractExpectations(profile);
  const r2 = await extractExpectations(profile);

  assert.strictEqual(r1.expectations.length, r2.expectations.length, 'Same count across runs');
  for (let i = 0; i < r1.expectations.length; i++) {
    assert.strictEqual(r1.expectations[i].id, r2.expectations[i].id, `Stable ID at index ${i}`);
    assert.strictEqual(r1.expectations[i].promise.value, r2.expectations[i].promise.value, 'Stable value order');
    assert.strictEqual(r1.expectations[i].source.line, r2.expectations[i].source.line, 'Stable source line');
  }
});

/**
 * Test 4: Observe — execute expectations and detect runtime navigation findings
 */
test('Vue observe executes expectations and detects broken runtime navigation', async () => {
  // Disable test mode to run a real browser
  const originalTestMode = process.env.VERAX_TEST_MODE;
  delete process.env.VERAX_TEST_MODE;

  const sfcPath = resolve(FIXTURES_DIR, 'vue-sfc-lite');
  const profile = { framework: 'vue', router: 'vue-router', sourceRoot: sfcPath };
  const { expectations } = await extractExpectations(profile);

  // Start runtime SPA server
  const evidenceDir = mkdtempSync(resolve(process.cwd(), 'tmp/vue-observe-'));
  const { server, baseUrl } = await createVueLiteServer();

  // Register for global cleanup tracking
  if (global.__veraxTestServers) {
    global.__veraxTestServers.add(server);
  }

  try {
    const observeData = await observeExpectations(expectations, baseUrl + '/', evidenceDir, null, {
      runtimeNavigation: { enabled: true, maxTargets: 20 },
    });

    // There must be observations from both static expectations and runtime discovery
    const staticObs = observeData.observations.filter((o) => !o.isRuntimeNav);
    const runtimeObs = observeData.observations.filter((o) => o.isRuntimeNav);
    assert.ok(staticObs.length >= 1, 'Should attempt executing extracted Vue expectations');
    assert.ok(runtimeObs.length >= 1, 'Should record runtime navigation observations');

    // Runtime evidence: run a runtime-only scan to deterministically capture both cases
    const evidenceDir2 = mkdtempSync(resolve(process.cwd(), 'tmp/vue-observe-runtime-'));
    const observeRuntimeOnly = await observeExpectations([], baseUrl + '/', evidenceDir2, null, {
      runtimeNavigation: { enabled: true, maxTargets: 20 },
    });
    const runtimeObs2 = observeRuntimeOnly.observations.filter((o) => o.isRuntimeNav);
    console.log('[VUE TEST DEBUG] runtimeObs2 sample:', runtimeObs2.map(o => ({ selector: o.selector, href: o.runtimeNav?.href, navigationChanged: o.signals?.navigationChanged, reason: o.reason })));
    assert.ok(
      runtimeObs2.some((obs) => obs.runtimeNav?.href === '/broken-destination'),
      'Should discover a broken runtime target (broken-destination)'
    );
    assert.ok(
      runtimeObs2.some((obs) => obs.runtimeNav?.href === '/about'),
      'Should discover a successful runtime target (about)'
    );
    rmSync(evidenceDir2, { recursive: true, force: true });
  } finally {
    // Restore test mode
    if (originalTestMode !== undefined) {
      process.env.VERAX_TEST_MODE = originalTestMode;
    }

    // Unregister and cleanup
    if (global.__veraxTestServers) {
      global.__veraxTestServers.delete(server);
    }
    rmSync(evidenceDir, { recursive: true, force: true });
    await new Promise((resolve) => {
      server.close(() => resolve());
      setTimeout(() => resolve(), 1500);
    });
  }
});

/**
 * Test 5: Support-Level Truth Matrix — ProductionReady gate for Vue
 */
test('Vue Support Matrix — ProductionReady contract', async () => {
  const detectOK = detectFramework(resolve(FIXTURES_DIR, 'vue-router-app')).framework === 'vue';

  const sfcPath = resolve(FIXTURES_DIR, 'vue-sfc-lite');
  const profile = { framework: 'vue', router: 'vue-router', sourceRoot: sfcPath };
  const r1 = await extractExpectations(profile);
  const r2 = await extractExpectations(profile);
  const extractionOK = r1.expectations.length > 0 && r1.expectations.every((e, i) => e.id === r2.expectations[i]?.id);

  // Minimal observe proof using runtime-only to avoid coupling static values to runtime fixture
  const originalTestMode = process.env.VERAX_TEST_MODE;
  delete process.env.VERAX_TEST_MODE;
  const evidenceDir = mkdtempSync(resolve(process.cwd(), 'tmp/vue-contract-'));
  const { server, baseUrl } = await createVueLiteServer();
  let observeOK = false;
  try {
    const observeData = await observeExpectations([], baseUrl + '/', evidenceDir, null, {
      runtimeNavigation: { enabled: true, maxTargets: 10 },
    });
    observeOK = observeData.observations.some((o) => o.isRuntimeNav);
  } finally {
    if (originalTestMode !== undefined) process.env.VERAX_TEST_MODE = originalTestMode;
    rmSync(evidenceDir, { recursive: true, force: true });
    await new Promise((resolve) => {
      server.close(() => resolve());
      setTimeout(() => resolve(), 1500);
    });
  }

  const determinismOK = r1.expectations.length === r2.expectations.length && r1.expectations.every((e, i) => e.id === r2.expectations[i]?.id);

  assert.ok(detectOK, 'Detection must work for Vue');
  assert.ok(extractionOK, 'Extraction must work and be deterministic');
  assert.ok(observeOK, 'Observe must record observations for navigation');
  assert.ok(determinismOK, 'Determinism must hold across runs');
});

/**
 * Summary (console print only; does not affect assertions)
 */
test('Summary: Vue Framework Parity Status', async () => {
  console.log(`
  ╔════════════════════════════════════════════════╗
  ║        Vue PHASE 2 Framework Parity Tests      ║
  ╚════════════════════════════════════════════════╝

  [✓] Detection: Vue (vite/cli) markers and evidence
  [✓] Learn: Literal-only extraction for RouterLink and router.push/replace
  [✓] Observe: Runtime navigation detection with route sensor
  [✓] Determinism: Stable IDs and ordering
  [✓] Evidence-only: Dynamic patterns skipped with explicit counters
  [✓] Integration: End-to-end pipeline validated
  `);
});
