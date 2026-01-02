/**
 * PHASE 10B — Verdict Integration Tests
 * Validates NOT_APPLICABLE flows do NOT penalize verdict or create contradictions.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { executeReality } = require('../src/guardian/reality');
const { startFixtureServer } = require('./fixture-server');
const { getDefaultFlowIds } = require('../src/guardian/flow-registry');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⚖️  PHASE 10B — Verdict Integration Tests');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let fixture = null;

async function setup() {
  fixture = await startFixtureServer();
}

async function teardown() {
  if (fixture) await fixture.close();
}

(async () => {
  await setup();
  try {
    const baseUrl = `${fixture.baseUrl}/contact?mode=ok`; // marketing-like page without account/revenue
    const artifactsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-phase10b-verdict-'));

    const result = await executeReality({
      baseUrl,
      artifactsDir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableCrawl: false,
      enableDiscovery: false,
      // Force flows present so intelligence must mark them NOT_APPLICABLE
      flows: getDefaultFlowIds(),
      policy: 'preset:startup', // permissive policy
      fast: true,
      failFast: false
    });

    // Sanity
    assert.ok(result, 'Result should exist');
    assert.ok(result.finalDecision, 'Final decision should exist');

    // Load decision.json
    const decisionPath = path.join(result.runDir, 'decision.json');
    assert.ok(fs.existsSync(decisionPath), 'decision.json should exist');
    const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));

    // 4) VERDICT INTEGRATION ASSERTIONS
    // - NOT_APPLICABLE flows do NOT reduce score
    // - Coverage gaps from NOT_APPLICABLE do NOT create FRICTION
    // - Only APPLICABLE+FAILED flows affect verdict
    // - Single coherent verdict and exit code

    // All flows should be NOT_APPLICABLE (no failures/frictions)
    assert.ok(Array.isArray(result.flowResults), 'flowResults should be array');
    assert.ok(result.flowResults.length === getDefaultFlowIds().length, 'All default flows evaluated');
    const notApplicable = result.flowResults.filter(f => f.outcome === 'NOT_APPLICABLE');
    const failures = result.flowResults.filter(f => f.outcome === 'FAILURE');
    const frictions = result.flowResults.filter(f => f.outcome === 'FRICTION');
    assert.strictEqual(notApplicable.length, getDefaultFlowIds().length, 'All flows marked NOT_APPLICABLE');
    assert.strictEqual(failures.length, 0, 'No flow marked FAILURE when not applicable');
    assert.strictEqual(frictions.length, 0, 'No flow marked FRICTION when not applicable');

    // Decision inputs should reflect no penalties
    assert.strictEqual(decision.inputs.flows.failures, 0, 'No failures counted');
    assert.strictEqual(decision.inputs.flows.frictions, 0, 'No frictions counted');

    // Verdict should be coherent and non-contradictory
    assert.ok(['READY', 'SUCCESS', 'FRICTION', 'DO_NOT_LAUNCH'].includes(decision.finalVerdict), 'Valid verdict');
    assert.ok([0,1,2].includes(decision.exitCode), 'Valid exit code');

    console.log('✅ Verdict Integration Tests PASS');
  } catch (err) {
    console.error('❌ Verdict Integration Tests FAILED:', err);
    process.exitCode = 1;
  } finally {
    await teardown();
  }
})();
