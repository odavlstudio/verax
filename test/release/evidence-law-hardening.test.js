import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { detectFindings } from '../../src/cli/util/detection/detection-engine.js';

function runVerax(args, env = {}) {
  const result = spawnSync('node', ['bin/verax.js', ...args], {
    cwd: resolve('.'),
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60000,
    encoding: 'utf8',
    env: { ...process.env, VERAX_TEST_MODE: '1', ...env },
  });
  return {
    exitCode: result.status ?? 2,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function latestRunDir(outDir) {
  const runsDir = join(outDir, 'runs');
  const scanEntries = readdirSync(runsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  if (scanEntries.length === 0) throw new Error('No runs found');
  const latestScan = scanEntries.sort((a, b) => b.name.localeCompare(a.name))[0];
  const scanDir = join(runsDir, latestScan.name);
  // Prefer latest.json pointer if present
  try {
    const latest = JSON.parse(readFileSync(join(scanDir, 'latest.json'), 'utf8'));
    if (latest && latest.baseDir) return latest.baseDir;
  } catch {
    // Ignore missing latest pointer; fall back to directory scan
  }
  const runEntries = readdirSync(scanDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  if (runEntries.length === 0) throw new Error('No runIds found in scan directory');
  const latestRun = runEntries.sort((a, b) => b.name.localeCompare(a.name))[0];
  return join(scanDir, latestRun.name);
}

test('Detection: screenshots alone do not yield CONFIRMED silent failure', async () => {
  const expectation = {
    id: 'exp_demo',
    type: 'navigation',
    promise: { kind: 'navigate', value: '/demo' },
    source: { file: 'index.html', line: 1, column: 1 },
  };

  const observeData = {
    observations: [
      {
        id: 'exp_demo',
        attempted: true,
        observed: false,
        reason: 'no-change',
        evidenceFiles: ['exp_1_before.png', 'exp_1_after.png'],
        signals: {
          navigationChanged: false,
          domChanged: false,
          meaningfulDomChange: false,
          feedbackSeen: false,
          networkActivity: false,
          correlatedNetworkActivity: false,
        },
      },
    ],
    stats: { attempted: 1, observed: 0, notObserved: 1 },
  };

  const learnData = { expectations: [expectation], skipped: {} };
  const result = await detectFindings(learnData, observeData, process.cwd());
  assert.equal(result.findings.length, 1, 'Should return one finding');
  assert.equal(result.findings[0].classification, 'unproven');
  assert.equal(result.stats.silentFailures, 0, 'Silent failures must be zero without substantive evidence');
});

test('Run exits 30 when observation is forced incomplete', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'verax-timeout-'));
  const outDir = mkdtempSync(join(tmpdir(), 'verax-timeout-out-'));
  const html = '<html><body><button id="noop">Noop</button></body></html>';
  const htmlPath = join(tmp, 'index.html');
  writeFileSync(htmlPath, html, 'utf8');

  const url = 'file://' + htmlPath.replace(/\\/g, '/');
  const result = runVerax(['run', '--url', url, '--src', tmp, '--out', outDir], {
    VERAX_TEST_FORCE_TIMEOUT: '1',
  });

  assert.equal(result.exitCode, 30, `Forced timeout must exit 30, got ${result.exitCode}`);

  const runDir = latestRunDir(outDir);
  const summary = JSON.parse(readFileSync(join(runDir, 'summary.json'), 'utf8'));
  assert.equal(summary.status, 'INCOMPLETE');
  assert.ok((summary.incompleteReasons || []).length > 0, 'Incomplete reasons must be recorded');
});

test('CLI integration: no substantive signals downgrades silent failure', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'verax-evidence-law-'));
  const outDir = mkdtempSync(join(tmpdir(), 'verax-evidence-law-out-'));
  const html = '<html><body><button id="noop">Noop</button></body></html>';
  const htmlPath = join(tmp, 'index.html');
  writeFileSync(htmlPath, html, 'utf8');

  const url = 'file://' + htmlPath.replace(/\\/g, '/');
  const result = runVerax(['run', '--url', url, '--src', tmp, '--out', outDir, '--min-coverage', '0']);

  assert.ok([0,30].includes(result.exitCode), `Run without substantive signals should not exit with findings: got ${result.exitCode}`);

  const runDir = latestRunDir(outDir);
  const findings = JSON.parse(readFileSync(join(runDir, 'findings.json'), 'utf8'));
  const classifications = (findings.findings || []).map((f) => f.classification);
  classifications.forEach((c) => {
    assert.notEqual(c.split(':')[0], 'silent-failure', 'Silent failure must be downgraded without substantive evidence');
  });
});




