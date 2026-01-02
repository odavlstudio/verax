/**
 * PHASE 10B — Site Intelligence Flow Applicability Tests
 * Ensures flows are marked NOT_APPLICABLE and never executed/failed when capabilities are false.
 */

const assert = require('assert');
const { chromium } = require('playwright');
const { startFixtureServer } = require('./fixture-server');
const { analyzeSite, isFlowApplicable, CAPABILITIES } = require('../src/guardian/site-intelligence');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 PHASE 10B — Flow Applicability Tests');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let fixture = null;
let browser = null;
let page = null;

async function setup() {
  fixture = await startFixtureServer();
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  page = await ctx.newPage();
}

async function teardown() {
  if (browser) await browser.close();
  if (fixture) await fixture.close();
}

(async () => {
  await setup();
  try {
    // Analyze a marketing-like page (no account/revenue features)
    const url = `${fixture.baseUrl}/contact?mode=ok`;
    await page.goto(url);
    const intel = await analyzeSite(page, url);

    // Flow applicability mapping
    assert.strictEqual(intel.flowApplicability.signup_flow.applicable, false, 'signup_flow should be NOT_APPLICABLE');
    assert.strictEqual(intel.flowApplicability.login_flow.applicable, false, 'login_flow should be NOT_APPLICABLE');
    assert.strictEqual(intel.flowApplicability.checkout_flow.applicable, false, 'checkout_flow should be NOT_APPLICABLE');

    // Utility should agree
    assert.strictEqual(isFlowApplicable(intel, 'signup_flow'), false);
    assert.strictEqual(isFlowApplicable(intel, 'login_flow'), false);
    assert.strictEqual(isFlowApplicable(intel, 'checkout_flow'), false);

    // Capability false guarantees not applicable
    assert.strictEqual(intel.capabilities[CAPABILITIES.SUPPORTS_LOGIN].supported, false);
    assert.strictEqual(intel.capabilities[CAPABILITIES.SUPPORTS_SIGNUP].supported, false);
    assert.strictEqual(intel.capabilities[CAPABILITIES.SUPPORTS_CHECKOUT].supported, false);

    console.log('✅ Flow Applicability Tests PASS');
  } catch (err) {
    console.error('❌ Flow Applicability Tests FAILED:', err);
    process.exitCode = 1;
  } finally {
    await teardown();
  }
})();
