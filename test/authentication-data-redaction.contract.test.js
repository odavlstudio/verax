import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAuthArtifact, loadAuthCookiesSource } from '../src/cli/util/auth/auth-utils.js';
import { writeSummaryJson } from '../src/cli/util/evidence/summary-writer.js';
import { writeObserveJson } from '../src/cli/util/observation/observe-writer.js';
import { redactHeaders, redactUrl, redactAuthCookie, redactAuthHeaderValue } from '../src/cli/util/evidence/redact.js';

const RAW = 'RAW_SECRET_TOKEN';

test('auth-cookie rejects non-JSON inline values', () => {
  const result = loadAuthCookiesSource('session=abc123');
  assert.ok(result.error);
  assert.match(result.error, /JSON/);
});

test('redaction removes raw tokens from headers and urls', () => {
  const headers = redactHeaders({ Authorization: `Bearer ${RAW}`, 'X-Auth-Token': RAW, 'Content-Type': 'application/json' });
  assert.equal(headers.Authorization, '***REDACTED***');
  assert.equal(headers['X-Auth-Token'], '***REDACTED***');
  assert.equal(headers['Content-Type'], 'application/json');

  const redactedUrl = redactUrl(`https://example.com/path?access_token=${RAW}&id_token=${RAW}`);
  assert.ok(!redactedUrl.includes(RAW));
});

test('auth artifact redaction removes raw secrets', () => {
  const rc = redactAuthCookie({ name: 'session', value: RAW, path: '/' });
  assert.ok(rc.value !== RAW);
  assert.ok(!JSON.stringify(rc).includes(RAW));

  const rh = redactAuthHeaderValue('Authorization', `Bearer ${RAW}`);
  assert.ok(rh.value !== RAW);
  assert.ok(!JSON.stringify(rh).includes(RAW));
});

test('auth artifacts and summary never contain raw secrets', () => {
  const counters = { headersRedacted: 0, tokensRedacted: 0 };
  const authArtifact = buildAuthArtifact({
    applied: true,
    methods: ['cookies', 'headers'],
    redacted: {
      storageState: false,
      cookies: [{ name: 'session', value: RAW, domain: 'example.com', path: '/' }],
      headers: [{ name: 'Authorization', value: `Bearer ${RAW}` }],
    }
  }, 'strict', {
    effective: 'no',
    confidence: 0.9,
    signals: {
      httpStatus: 401,
      currentUrl: `https://example.com/login?token=${RAW}`,
      finalUrl: `https://example.com/?id_token=${RAW}`,
    }
  }, counters);

  const dir = mkdtempSync(join(tmpdir(), 'verax-redaction-'));
  const summaryPath = join(dir, 'summary.json');
  writeSummaryJson(summaryPath, {
    runId: 'run1',
    status: 'SUCCESS',
    startedAt: 'now',
    completedAt: 'now',
    command: 'run',
    url: 'https://example.com',
    notes: '',
    auth: authArtifact,
  }, {
    expectationsTotal: 0,
    attempted: 0,
    observed: 0,
    silentFailures: 0,
    coverageGaps: 0,
    unproven: 0,
    informational: 0,
  });

  const summaryRaw = readFileSync(summaryPath, 'utf-8');
  assert.ok(!summaryRaw.includes(RAW));
  const summary = JSON.parse(summaryRaw);
  assert.equal(summary.auth.verification.effective, 'no');
  assert.ok(!String(summary.auth.verification.signals.finalUrl || '').includes(RAW));

  rmSync(dir, { recursive: true, force: true });
});

test('network artifacts and traces never contain raw secrets', () => {
  const counters = { headersRedacted: 0, tokensRedacted: 0 };
  const netEvent = {
    url: redactUrl(`https://example.com/path?access_token=${RAW}&id_token=${RAW}`, counters),
    method: 'GET',
    headers: redactHeaders({ Authorization: `Bearer ${RAW}`, Cookie: `session=${RAW}` }, counters),
    body: null,
    timestamp: 'now',
    relativeMs: 1,
  };

  const dir = mkdtempSync(join(tmpdir(), 'verax-observe-'));

  writeObserveJson(dir, {
    observations: [{
      id: 'exp_1',
      type: 'navigation',
      category: 'navigation',
      promise: {},
      source: null,
      isRuntimeNav: false,
      runtimeNav: null,
      attempted: true,
      observed: false,
      action: null,
      reason: 'outcome-not-met',
      observedAt: 'now',
      evidenceFiles: [],
      evidence: { networkEvents: [netEvent] },
      signals: null,
    }],
    runtimeExpectations: [],
    runtime: null,
    stats: { attempted: 1, observed: 0, notObserved: 1, skippedReasons: {} },
    redaction: counters,
  });

  const observeRaw = readFileSync(join(dir, 'observe.json'), 'utf-8');
  assert.ok(!observeRaw.includes(RAW));

  const tracesContent = [JSON.stringify({ event: 'observe:network', payload: netEvent })].join('\n') + '\n';
  const tracesPath = join(dir, 'traces.jsonl');
  writeSummaryJson(join(dir, 'summary.json'), {
    runId: 'run1',
    status: 'SUCCESS',
    startedAt: 'now',
    completedAt: 'now',
    command: 'run',
    url: 'https://example.com',
    notes: '',
  }, {
    expectationsTotal: 0,
    attempted: 0,
    observed: 0,
    silentFailures: 0,
    coverageGaps: 0,
    unproven: 0,
    informational: 0,
  });

  // Write traces content
  require('node:fs').writeFileSync(tracesPath, tracesContent);
  const tracesRaw = readFileSync(tracesPath, 'utf-8');
  assert.ok(!tracesRaw.includes(RAW));

  rmSync(dir, { recursive: true, force: true });
});
