import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installNetworkWriteFirewall, summarizeNetworkFirewall } from '../../src/cli/util/observation/network-firewall.js';
import { writeObserveJson } from '../../src/cli/util/observation/observe-writer.js';

test('CONTRACT: network write firewall blocks mutating methods at route layer', async () => {
  /** @type {Function|null} */
  let handler = null;
  const calls = { abort: 0, cont: 0 };
  const blocked = [];

  const fakePage = {
    async route(_pattern, h) { handler = h; },
  };

  const res = await installNetworkWriteFirewall(fakePage, {
    shouldBlockRequest: (method) => String(method || '').toUpperCase() === 'POST',
    onBlocked: (entry) => blocked.push(entry),
  });

  assert.equal(res.enabled, true);
  assert.equal(typeof handler, 'function');

  const fakeRoutePost = {
    request() {
      return {
        method: () => 'POST',
        url: () => 'http://user:pass@localhost:1234/deep/path?x=1#frag',
      };
    },
    async abort(_code) { calls.abort += 1; },
    async continue() { calls.cont += 1; },
  };

  await handler(fakeRoutePost);

  assert.equal(calls.abort, 1);
  assert.equal(calls.cont, 0);
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0].method, 'POST');
  assert.equal(blocked[0].originUrl, 'http://localhost:1234/');
  assert.equal(blocked[0].code, 'write_blocked_read_only_mode');

  const fakeRouteGet = {
    request() {
      return {
        method: () => 'GET',
        url: () => 'http://localhost:1234/',
      };
    },
    async abort(_code) { calls.abort += 1; },
    async continue() { calls.cont += 1; },
  };

  await handler(fakeRouteGet);
  assert.equal(calls.cont, 1);
});

test('CONTRACT: observe.json includes deterministic networkFirewall summary (even with no blocks)', () => {
  const runDir = mkdtempSync(join(tmpdir(), 'verax-fw-'));
  const observeData = {
    observations: [],
    runtimeExpectations: [],
    runtime: null,
    blockedWrites: [],
    networkFirewall: { enabled: true },
    stats: {
      totalExpectations: 0,
      attempted: 0,
      observed: 0,
      completed: 0,
      notObserved: 0,
      skipped: 0,
      skippedReasons: {},
      blockedWrites: 0,
      coverageRatio: 1.0,
    },
    redaction: { headersRedacted: 0, tokensRedacted: 0 },
    diagnostics: [],
  };

  writeObserveJson(runDir, observeData);
  const raw = JSON.parse(readFileSync(join(runDir, 'observe.json'), 'utf8'));

  assert.ok(raw.networkFirewall, 'networkFirewall block must exist');
  assert.equal(raw.networkFirewall.enabled, true);
  assert.equal(raw.networkFirewall.blockedCount, 0);
  assert.deepEqual(raw.networkFirewall.blockedMethods, { POST: 0, PUT: 0, PATCH: 0, DELETE: 0 });
  assert.deepEqual(raw.networkFirewall.sampleBlocked, []);
});

test('CONTRACT: firewall summary counts methods and samples origin-only URLs', () => {
  const summary = summarizeNetworkFirewall({
    enabled: true,
    blockedWrites: [
      { method: 'POST', url: 'https://example.com/a/b?x=1#y', reason: 'write-blocked-read-only-mode' },
      { method: 'DELETE', url: 'https://example.com/delete', reason: 'write-blocked-read-only-mode' },
      { method: 'POST', url: 'https://example.com/', reason: 'write-blocked-read-only-mode' },
    ],
  });

  assert.equal(summary.enabled, true);
  assert.equal(summary.blockedCount, 3);
  assert.deepEqual(summary.blockedMethods, { POST: 2, PUT: 0, PATCH: 0, DELETE: 1 });
  assert.ok(summary.sampleBlocked.length > 0);
  for (const s of summary.sampleBlocked) {
    assert.ok(!s.url.includes('?') && !s.url.includes('#'), 'sample url must not include query/fragment');
    assert.ok(s.url.endsWith('/'), 'sample url must end with /');
  }
});

