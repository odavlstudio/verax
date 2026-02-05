import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { observeExpectations } from '../../src/cli/util/observation/observation-engine.js';

function startFirewallTestServer({ includePostEndpoint, enablePostAttempt }) {
  let postReceipts = 0;
  const server = http.createServer((req, res) => {
    if (req.url === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
<!doctype html>
<html>
  <body>
    <button id="doPost">Do POST</button>
    <div id="status"></div>
    <script>
      document.getElementById('doPost').addEventListener('click', async () => {
        ${enablePostAttempt ? `
        try {
          await fetch('/mutate', { method: 'POST', body: 'x=1' });
          document.getElementById('status').textContent = 'posted';
        } catch (e) {
          document.getElementById('status').textContent = 'blocked';
        }` : `
        document.getElementById('status').textContent = 'clicked';
        `}
      });
    </script>
  </body>
</html>`);
      return;
    }

    if (req.url === '/mutate' && req.method === 'POST') {
      if (includePostEndpoint) {
        postReceipts += 1;
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found');
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      if (global.__veraxTestServers) global.__veraxTestServers.add(server);
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`,
        getPostReceipts: () => postReceipts,
        close: () =>
          new Promise((r) => {
            if (global.__veraxTestServers) global.__veraxTestServers.delete(server);
            server.close(() => r());
            server.closeAllConnections?.();
          }),
      });
    });
  });
}

test('E2E: runtime firewall blocks fetch(POST) and records it in observeData.networkFirewall', async () => {
  const prev = process.env.VERAX_TEST_MODE;
  process.env.VERAX_TEST_MODE = '0';

  const { close, baseUrl, getPostReceipts } = await startFirewallTestServer({ includePostEndpoint: true, enablePostAttempt: true });
  const evidenceDir = mkdtempSync(join(tmpdir(), 'verax-fw-e2e-'));
  try {
    const expectations = [
      {
        id: 'exp_post',
        type: 'interaction',
        category: 'button',
        promise: { kind: 'click', value: 'Do POST', selector: '#doPost' },
        source: { kind: 'test', selector: '#doPost' },
        expectedOutcome: 'ui-change',
      },
    ];

    const observeData = await observeExpectations(expectations, `${baseUrl}/`, evidenceDir, null, {});
    assert.equal(observeData?.networkFirewall?.enabled, true);
    assert.ok(observeData?.networkFirewall?.blockedMethods?.POST >= 1);
    assert.equal(getPostReceipts(), 0, 'server must not receive POST when firewall is active');
  } finally {
    process.env.VERAX_TEST_MODE = prev;
    try { rmSync(evidenceDir, { recursive: true, force: true }); } catch { /* ignore */ }
    await close();
  }
});

test('E2E: firewall summary exists when no writes attempted (blockedCount=0, enabled=true)', async () => {
  const prev = process.env.VERAX_TEST_MODE;
  process.env.VERAX_TEST_MODE = '0';

  const { close, baseUrl } = await startFirewallTestServer({ includePostEndpoint: false, enablePostAttempt: false });
  const evidenceDir = mkdtempSync(join(tmpdir(), 'verax-fw-e2e-'));
  try {
    const expectations = [
      {
        id: 'exp_click',
        type: 'interaction',
        category: 'button',
        promise: { kind: 'click', value: 'Do POST', selector: '#doPost' },
        source: { kind: 'test', selector: '#doPost' },
        expectedOutcome: 'ui-change',
      },
    ];

    const observeData = await observeExpectations(expectations, `${baseUrl}/`, evidenceDir, null, {});
    assert.equal(observeData?.networkFirewall?.enabled, true);
    assert.equal(observeData?.networkFirewall?.blockedCount, 0);
  } finally {
    process.env.VERAX_TEST_MODE = prev;
    try { rmSync(evidenceDir, { recursive: true, force: true }); } catch { /* ignore */ }
    await close();
  }
});
