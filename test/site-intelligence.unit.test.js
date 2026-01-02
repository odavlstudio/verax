/**
 * PHASE 10B — Site Intelligence Unit Tests
 * Validates classification, capability detection, and applicability mapping.
 */

const assert = require('assert');
const { chromium } = require('playwright');
const http = require('http');
const { startFixtureServer } = require('./fixture-server');
const { analyzeSite, SITE_TYPES, CAPABILITIES } = require('../src/guardian/site-intelligence');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧠 PHASE 10B — Site Intelligence Unit Tests');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let fixture = null;
let browser = null;
let page = null;
let tempServer = null;
let tempBaseUrl = null;

async function setup() {
  fixture = await startFixtureServer();
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  page = await ctx.newPage();
}

async function teardown() {
  if (browser) await browser.close();
  if (fixture) await fixture.close();
  if (tempServer) await new Promise(r => tempServer.close(r));
}

async function classify(urlPath) {
  const url = `${fixture.baseUrl}${urlPath}`;
  await page.goto(url);
  return analyzeSite(page, url);
}

(async () => {
  await setup();

  try {
    // 1) SITE TYPE CLASSIFICATION TESTS
    console.log('TEST: Classification — Marketing (contact page)');
    {
      const intel = await classify('/contact?mode=ok');
      assert.ok(intel, 'Intelligence should exist');
      assert.strictEqual(intel.siteType, SITE_TYPES.MARKETING, 'Should classify as marketing');
      assert.ok(intel.confidence >= 0.5, 'Confidence should be reasonable (> 0.5)');
      assert.ok(intel.detectedSignals.length > 0, 'Should detect signals');
    }

    console.log('TEST: Classification — SaaS (login page)');
    {
      const intel = await classify('/account/login?mode=ok');
      assert.strictEqual(intel.siteType, SITE_TYPES.SAAS, 'Should classify as saas_application');
      assert.ok(intel.confidence >= 0.5, 'Confidence should be reasonable (> 0.5)');
      assert.ok(intel.detectedSignals.some(s => s.type === 'login_indicator'), 'Login signals should be present');
    }

    console.log('TEST: Classification — E-commerce (synthetic shop page)');
    {
      // Spin up minimal server with strong commerce signals
      await new Promise((resolve) => {
        tempServer = http.createServer((req, res) => {
          res.setHeader('Content-Type', 'text/html');
          res.end(`<!DOCTYPE html><html><body>
            <a href="/cart">Cart</a>
            <a href="/checkout">Checkout</a>
            <button>Buy</button>
            <button>Purchase</button>
          </body></html>`);
        }).listen(0, '127.0.0.1', () => {
          const port = tempServer.address().port;
          tempBaseUrl = `http://127.0.0.1:${port}`;
          resolve();
        });
      });
      await page.goto(tempBaseUrl);
      const intel = await analyzeSite(page, tempBaseUrl);
      console.log('Synthetic commerce signals:', intel.detectedSignals.map(s => s.type));
      assert.strictEqual(intel.siteType, SITE_TYPES.ECOMMERCE, 'Should classify as ecommerce');
      assert.ok(intel.confidence >= 0.5, 'Confidence should be reasonable (> 0.5)');
      console.log('Synthetic capability map:', intel.capabilities);
      assert.ok(intel.capabilities[CAPABILITIES.SUPPORTS_CHECKOUT].supported === true, 'supports_checkout should be true');
    }

    console.log('TEST: Classification — Documentation (docs page)');
    {
      const intel = await classify('/docs');
      assert.strictEqual(intel.siteType, SITE_TYPES.DOCUMENTATION, 'Should classify as documentation');
      assert.ok(intel.confidence >= 0.6, 'Confidence should be high (> 0.6)');
      assert.ok(intel.detectedSignals.some(s => s.type === 'docs_indicator' || (s.type === 'url_pattern' && s.indicator === 'documentation')), 'Docs signals should be present');
    }

    console.log('TEST: Classification — Ambiguous (about page)');
    {
      const intel = await classify('/about?mode=ok');
      // Engine defaults to marketing for ambiguous with low confidence
      assert.strictEqual(intel.siteType, SITE_TYPES.MARKETING, 'Ambiguous defaults to marketing');
      assert.ok(intel.confidence <= 0.4, 'Confidence should be low (<= 0.4)');
    }

    // 2) CAPABILITY DETECTION TESTS
    console.log('TEST: Capabilities — login/signup/checkout/forms/cta true only with evidence');
    {
      const loginIntel = await classify('/account/login?mode=ok');
      assert.strictEqual(loginIntel.capabilities[CAPABILITIES.SUPPORTS_LOGIN].supported, true, 'supports_login should be true');
      assert.ok(loginIntel.capabilities[CAPABILITIES.SUPPORTS_LOGIN].evidence.length > 0, 'Login evidence recorded');

      const signupIntel = await classify('/account/signup?mode=ok');
      assert.strictEqual(signupIntel.capabilities[CAPABILITIES.SUPPORTS_SIGNUP].supported, true, 'supports_signup should be true');
      assert.ok(signupIntel.capabilities[CAPABILITIES.SUPPORTS_SIGNUP].evidence.length > 0, 'Signup evidence recorded');

      // Use synthetic ecommerce page for deterministic checkout signals
      const checkoutIntel = await analyzeSite(page, tempBaseUrl);
      assert.strictEqual(checkoutIntel.capabilities[CAPABILITIES.SUPPORTS_CHECKOUT].supported, true, 'supports_checkout should be true');
      assert.ok(checkoutIntel.capabilities[CAPABILITIES.SUPPORTS_CHECKOUT].evidence.length > 0, 'Checkout evidence recorded');

      const formsIntel = await classify('/contact?mode=ok');
      assert.strictEqual(formsIntel.capabilities[CAPABILITIES.SUPPORTS_FORMS].supported, true, 'supports_forms should be true');
      assert.ok(formsIntel.capabilities[CAPABILITIES.SUPPORTS_FORMS].evidence.length > 0, 'Forms evidence recorded');

      const ctaIntel = await classify('/universal/cta');
      assert.strictEqual(ctaIntel.capabilities[CAPABILITIES.SUPPORTS_PRIMARY_CTA].supported, true, 'supports_primary_cta should be true');
      assert.ok(ctaIntel.capabilities[CAPABILITIES.SUPPORTS_PRIMARY_CTA].evidence.length > 0, 'CTA evidence recorded');
    }

    console.log('TEST: Capabilities — false does NOT trigger attempts');
    {
      const intel = await classify('/faq?mode=ok');
      // Debug: print signals for visibility when failures occur
      // console.log('Signals:', intel.detectedSignals.map(s => s.type));
      assert.strictEqual(intel.capabilities[CAPABILITIES.SUPPORTS_LOGIN].supported, false);
      assert.strictEqual(intel.capabilities[CAPABILITIES.SUPPORTS_SIGNUP].supported, false);
      assert.strictEqual(intel.capabilities[CAPABILITIES.SUPPORTS_CHECKOUT].supported, false);
    }

    console.log('✅ Site Intelligence Unit Tests PASS');
  } catch (err) {
    console.error('❌ Unit Tests FAILED:', err);
    process.exitCode = 1;
  } finally {
    await teardown();
  }
})();
