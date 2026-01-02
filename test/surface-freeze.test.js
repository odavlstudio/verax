// Surface Freeze Tests (Stage 1: Surface Lock)
// Fails on ANY CLI output drift (ordering, wording, spacing, headers, etc.)

const fs = require('fs');
const path = require('path');
const { printUnifiedOutput } = require('../src/guardian/output-readability');

function normalizeOutput(str) {
  // Replace run ids, timestamps, and artifact paths with placeholders
  return str
    .replace(/Run ID: .*/g, 'Run ID: <normalized-run-id>')
    .replace(/Full report: .*/g, 'Full report: <normalized-artifacts-path>')
    .replace(/Exit code: \d+/g, match => match.replace(/\d+/, '<normalized-exit-code>'))
    .replace(/\r\n/g, '\n') // normalize line endings
    .trim();
}

function loadSnapshot(name) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', 'surface-freeze', name), 'utf-8').trim();
}

function captureOutput(fn) {
  let out = '';
  const orig = console.log;
  console.log = (...args) => { out += args.join(' ') + '\n'; };
  fn();
  console.log = orig;
  return out.trim();
}

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { console.log('✓', msg); pass++; }
  else { console.log('✗', msg); fail++; }
}

console.log('Running surface freeze tests...\n');

// READY + HIGH
const readyHigh = {
  meta: { url: 'https://shop.example.com', runId: 'run-2025-12-29-001' },
  coverage: { total: 8, executed: 8 },
  counts: { executedCount: 8 },
  verdict: { verdict: 'READY', explanation: 'All core user flows completed successfully. Safe to launch.' },
  attemptResults: [],
  flowResults: [],
  exitCode: 0,
  runDir: '/artifacts/ready-high'
};
const readyHighOut = normalizeOutput(captureOutput(() => printUnifiedOutput(readyHigh, {}, [])));
const readyHighSnap = loadSnapshot('READY-HIGH.snapshot.txt');
assert(readyHighOut === readyHighSnap, 'READY + HIGH output matches snapshot');

// FRICTION + MEDIUM
const frictionMedium = {
  meta: { url: 'https://shop.example.com', runId: 'run-2025-12-29-002' },
  coverage: { total: 10, executed: 7, skippedNotApplicable: ['mobile', 'admin'], skippedUserFiltered: ['beta'] },
  counts: { executedCount: 7 },
  verdict: { verdict: 'FRICTION', explanation: 'Some flows failed or were skipped. Review before launch.' },
  attemptResults: [
    { outcome: 'SUCCESS' }, { outcome: 'SUCCESS' }, { outcome: 'SUCCESS' },
    { outcome: 'FAILURE', classification: { category: 'infrastructure' }, error: 'timeout' },
    { outcome: 'SUCCESS' }, { outcome: 'SUCCESS' }, { outcome: 'SUCCESS' }
  ],
  flowResults: [],
  exitCode: 1,
  runDir: '/artifacts/friction-medium'
};
const frictionMediumOut = normalizeOutput(captureOutput(() => printUnifiedOutput(frictionMedium, {}, [])));
const frictionMediumSnap = loadSnapshot('FRICTION-MEDIUM.snapshot.txt');
assert(frictionMediumOut === frictionMediumSnap, 'FRICTION + MEDIUM output matches snapshot');

// DO_NOT_LAUNCH + LOW
const doNotLaunchLow = {
  meta: { url: 'https://shop.example.com', runId: 'run-2025-12-29-003' },
  coverage: { total: 10, executed: 5, skippedMissing: ['checkout', 'payment', 'cart'], skippedDisabledByPreset: ['abtest', 'legacy'] },
  counts: { executedCount: 5 },
  verdict: { verdict: 'DO_NOT_LAUNCH', explanation: 'Critical failures detected. Do not launch.' },
  attemptResults: [
    { outcome: 'SUCCESS' }, { outcome: 'SUCCESS' },
    { outcome: 'FAILURE', classification: { severity: 'critical' }, error: 'checkout failed' },
    { outcome: 'FAILURE', classification: { severity: 'critical' }, error: 'payment failed' },
    { outcome: 'SUCCESS' }
  ],
  flowResults: [],
  exitCode: 2,
  runDir: '/artifacts/do-not-launch-low'
};
const doNotLaunchLowOut = normalizeOutput(captureOutput(() => printUnifiedOutput(doNotLaunchLow, {}, [])));
const doNotLaunchLowSnap = loadSnapshot('DO_NOT_LAUNCH-LOW.snapshot.txt');
assert(doNotLaunchLowOut === doNotLaunchLowSnap, 'DO_NOT_LAUNCH + LOW output matches snapshot');

console.log(`\nPassed: ${pass}`);
console.log(`Failed: ${fail}`);
if (fail === 0) {
  console.log('All surface freeze tests passed!');
  process.exit(0);
} else {
  process.exit(1);
}
