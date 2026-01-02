const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { evaluatePrelaunchGate, writeReleaseDecisionArtifact } = require('../src/guardian/prelaunch-gate');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚦 Pre-Launch Gate Tests');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

function makeHonesty(coveragePercent = 80, executed = 2, total = 2) {
  return {
    coverageStats: {
      percent: coveragePercent,
      executed,
      total
    },
    limits: [],
    nonClaims: []
  };
}

function runGate({ verdict, allowFrictionOverride = false, baselinePresent = true, coveragePercent = 80, executed = 2 }) {
  return evaluatePrelaunchGate({
    prelaunch: true,
    verdict,
    exitCode: verdict === 'DO_NOT_LAUNCH' ? 2 : verdict === 'FRICTION' ? 1 : 0,
    allowFrictionOverride,
    honestyContract: makeHonesty(coveragePercent, executed, 2),
    baselinePresent,
    integrity: 1,
    evidence: { executedAttempts: executed, totalPlanned: 2 }
  });
}

// DO_NOT_LAUNCH should always block
(() => {
  const gate = runGate({ verdict: 'DO_NOT_LAUNCH' });
  assert.strictEqual(gate.blocking, true, 'DO_NOT_LAUNCH must block');
  assert.strictEqual(gate.exitCode, 2, 'DO_NOT_LAUNCH must exit with non-zero code');
  console.log('✅ DO_NOT_LAUNCH blocks as expected');
})();

// FRICTION without override should block
(() => {
  const gate = runGate({ verdict: 'FRICTION' });
  assert.strictEqual(gate.blocking, true, 'FRICTION must block without override');
  assert.ok(gate.exitCode !== 0, 'FRICTION blocking keeps non-zero exit');
  console.log('✅ FRICTION blocks without override');
})();

// FRICTION with override should allow
(() => {
  const gate = runGate({ verdict: 'FRICTION', allowFrictionOverride: true });
  assert.strictEqual(gate.blocking, false, 'FRICTION should allow when explicitly overridden');
  assert.strictEqual(gate.exitCode, 0, 'FRICTION override should zero exit code');
  console.log('✅ FRICTION override allows release');
})();

// READY should allow when evidence present
(() => {
  const gate = runGate({ verdict: 'READY' });
  assert.strictEqual(gate.blocking, false, 'READY should not block');
  assert.strictEqual(gate.exitCode, 0, 'READY should exit cleanly');
  console.log('✅ READY passes prelaunch gate');
})();

// Artifact correctness
(() => {
  const gate = runGate({ verdict: 'READY' });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-prelaunch-artifact-'));
  const decisionPath = writeReleaseDecisionArtifact(tmpDir, gate.releaseDecision);
  const saved = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));
  assert.strictEqual(saved.blocking, false, 'Release decision blocking flag should persist');
  assert.strictEqual(saved.verdict, 'READY', 'Release decision stores verdict');
  assert.ok(saved.honesty, 'Honesty summary should be present');
  console.log('✅ release-decision.json written and validated');
})();
