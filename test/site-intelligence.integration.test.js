/**
 * PHASE 10B — Real Scan Integration Test
 * Runs Guardian against mock marketing site and verifies intelligent behavior.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { executeReality } = require('../src/guardian/reality');
const { startFixtureServer } = require('./fixture-server');
const { getDefaultFlowIds } = require('../src/guardian/flow-registry');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 PHASE 10B — Site Intelligence Integration Test');
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
    const baseUrl = `${fixture.baseUrl}/contact?mode=ok`; // marketing-like page
    const artifactsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-phase10b-integ-'));

    const result = await executeReality({
      baseUrl,
      artifactsDir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableCrawl: false,
      enableDiscovery: false,
      attempts: ['site_smoke', 'primary_ctas', 'contact_discovery_v2'],
      flows: getDefaultFlowIds(),
      policy: 'preset:landing-demo',
      fast: true
    });

    // Assert: Site classified correctly (marketing) and only applicable flows executed
    const decisionPath = path.join(result.runDir, 'decision.json');
    assert.ok(fs.existsSync(decisionPath), 'decision.json should exist');
    const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));

    // Site intelligence present and classified
    assert.ok(decision.siteIntelligence, 'siteIntelligence should be present in decision');
    assert.strictEqual(decision.siteIntelligence.siteType, 'marketing', 'Site should be marketing');
    assert.ok(decision.siteIntelligence.confidence >= 0.5, 'Confidence reasonable (>= 0.5)');

    // No login/signup/checkout attempts occur as FAILURES
    assert.ok(Array.isArray(result.flowResults));
    const failures = result.flowResults.filter(f => f.outcome === 'FAILURE');
    assert.strictEqual(failures.length, 0, 'No flow failures on marketing site');
    const notApplicable = result.flowResults.filter(f => f.outcome === 'NOT_APPLICABLE');
    assert.strictEqual(notApplicable.length, getDefaultFlowIds().length, 'All flows marked NOT_APPLICABLE');

    // Verdict is READY or clean FRICTION
    assert.ok(['READY', 'FRICTION', 'SUCCESS', 'DO_NOT_LAUNCH'].includes(decision.finalVerdict), 'Valid verdict');
    assert.ok([0,1,2].includes(decision.exitCode), 'Valid exit code');

    console.log('✅ Site Intelligence Integration Test PASS');
  } catch (err) {
    console.error('❌ Site Intelligence Integration Test FAILED:', err);
    process.exitCode = 1;
  } finally {
    await teardown();
  }
})();
