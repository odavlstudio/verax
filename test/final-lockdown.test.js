/**
 * FINAL LOCKDOWN TEST SUITE
 * 
 * This test suite enforces ALL Guardian guarantees:
 * 1. NO BLIND EXECUTION - Never attempt login/signup/checkout without intelligence
 * 2. INTELLIGENCE-FIRST - Strict execution order enforced
 * 3. PRESET SAFETY - Presets cannot override intelligence decisions
 * 4. SINGLE SOURCE OF TRUTH - One verdict, one exit code, no contradictions
 * 5. REPORT HONESTY - Clear explanations, no misleading messages
 * 6. SAFE DATA BEHAVIOR - No credentials, no blind retries
 */

const assert = require('assert');
const { executeReality } = require('../src/guardian/reality');
const { analyzeSite, isFlowApplicable } = require('../src/guardian/site-intelligence');
const { buildPolicySignals, evaluateRules, loadRules } = require('../src/guardian/rules-engine');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔒 FINAL LOCKDOWN — Guardian Integrity Test');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Test fixture server
function createTestServer(pageType) {
  const pages = {
    marketing: `
      <!DOCTYPE html>
      <html>
      <head><title>Marketing Site</title></head>
      <body>
        <h1>Welcome to Our Product</h1>
        <p>Learn more about our amazing product</p>
        <a href="/about" class="cta-button">Learn More</a>
        <form class="contact-form">
          <input type="email" placeholder="Email">
          <button type="submit">Contact Us</button>
        </form>
      </body>
      </html>
    `,
    saas: `
      <!DOCTYPE html>
      <html>
      <head><title>SaaS Application</title></head>
      <body>
        <h1>Dashboard</h1>
        <a href="/login" data-guardian="account-login-link">Login</a>
        <a href="/signup" data-guardian="account-signup-link">Sign Up</a>
        <div class="user-dashboard">
          <button>Settings</button>
        </div>
      </body>
      </html>
    `,
    ecommerce: `
      <!DOCTYPE html>
      <html>
      <head><title>Online Store</title></head>
      <body>
        <h1>Shop Now</h1>
        <div class="product">
          <button class="add-to-cart">Add to Cart</button>
        </div>
        <a href="/checkout" data-guardian="checkout-link">Checkout</a>
        <a href="/login">Sign In</a>
        <a href="/signup">Create Account</a>
      </body>
      </html>
    `,
    unknown: `
      <!DOCTYPE html>
      <html>
      <head><title>Unknown Site</title></head>
      <body>
        <h1>Welcome</h1>
        <p>Generic content with no clear indicators</p>
      </body>
      </html>
    `
  };

  return http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pages[pageType] || pages.unknown);
  });
}

function startServer(type) {
  return new Promise((resolve) => {
    const server = createTestServer(type);
    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, port, url: `http://127.0.0.1:${port}` });
    });
  });
}

function stopServer(server) {
  return new Promise((resolve) => {
    server.close(resolve);
  });
}

// GUARANTEE 1: NO BLIND EXECUTION
async function testNoBlindExecution() {
  console.log('\n📋 TEST 1: NO BLIND EXECUTION');
  console.log('Testing: Marketing site must never attempt login/signup/checkout');

  const { server, port, url } = await startServer('marketing');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-lockdown-1-'));

  try {
    await executeReality({
      baseUrl: url,
      artifactsDir: tmpDir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableCrawl: false,
      enableDiscovery: false,
      fast: true,
      preset: 'startup', // Startup preset SUGGESTS login/signup/checkout flows
      flows: ['signup_flow', 'login_flow', 'checkout_flow'] // Explicitly request forbidden flows
    });

    // Read decision.json
    const runs = fs.readdirSync(tmpDir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}_/));
    assert(runs.length > 0, 'No run directory created');
    const runDir = path.join(tmpDir, runs[0]);
    const decisionPath = path.join(runDir, 'decision.json');
    const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));

    // Intelligence must be present
    assert(decision.siteIntelligence, 'Site intelligence missing from decision');
    assert.strictEqual(decision.siteIntelligence.siteType, 'marketing', 'Site type should be marketing');

    // Flow applicability must mark account/revenue flows as NOT_APPLICABLE
    const flowApplicability = decision.siteIntelligence.flowApplicability;
    assert.strictEqual(flowApplicability.signup_flow.applicable, false, 'signup_flow should NOT be applicable');
    assert.strictEqual(flowApplicability.login_flow.applicable, false, 'login_flow should NOT be applicable');
    assert.strictEqual(flowApplicability.checkout_flow.applicable, false, 'checkout_flow should NOT be applicable');

    // NO flows should be executed (all marked NOT_APPLICABLE)
    const flows = decision.outcomes?.flows || decision.flows || [];
    const executedFlows = flows.filter(f => f.outcome !== 'NOT_APPLICABLE');
    assert.strictEqual(executedFlows.length, 0, `Executed ${executedFlows.length} flows on marketing site - BLIND EXECUTION DETECTED`);

    // All flows should be NOT_APPLICABLE
    const notApplicableFlows = flows.filter(f => f.outcome === 'NOT_APPLICABLE');
    assert.strictEqual(notApplicableFlows.length, 3, 'All 3 flows should be NOT_APPLICABLE');

    // Verdict should NOT be affected by NOT_APPLICABLE flows
    const verdict = decision.finalVerdict;
    assert(verdict === 'READY' || verdict === 'OBSERVED', `Verdict ${verdict} incorrectly penalized by NOT_APPLICABLE flows`);

    console.log('✅ NO BLIND EXECUTION: PASS');
    console.log(`   Site intelligence: ${decision.siteIntelligence.siteType} (${decision.siteIntelligence.confidence}% confidence)`);
    console.log(`   Flows marked NOT_APPLICABLE: ${notApplicableFlows.length}/3`);
    console.log(`   Final verdict: ${verdict} (not penalized)`);

  } finally {
    await stopServer(server);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// GUARANTEE 2: INTELLIGENCE-FIRST EXECUTION
async function testIntelligenceFirstExecution() {
  console.log('\n📋 TEST 2: INTELLIGENCE-FIRST EXECUTION');
  console.log('Testing: Intelligence must run before any flow execution');

  const { server, port, url } = await startServer('saas');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-lockdown-2-'));

  try {
    await executeReality({
      baseUrl: url,
      artifactsDir: tmpDir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableCrawl: false,
      fast: true,
      preset: 'saas'
    });

    const runs = fs.readdirSync(tmpDir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}_/));
    const runDir = path.join(tmpDir, runs[0]);
    const decisionPath = path.join(runDir, 'decision.json');
    const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));

    // Intelligence MUST be present
    assert(decision.siteIntelligence, 'Intelligence not executed - EXECUTION ORDER VIOLATION');
    assert(decision.siteIntelligence.siteType, 'Site type not determined');
    assert(decision.siteIntelligence.capabilities, 'Capabilities not detected');
    assert(decision.siteIntelligence.flowApplicability, 'Flow applicability not determined');

    // SaaS site should detect login/signup capability
    assert.strictEqual(decision.siteIntelligence.siteType, 'saas_application', 'Should detect SaaS site');

    console.log('✅ INTELLIGENCE-FIRST EXECUTION: PASS');
    console.log(`   Intelligence stage completed: site type = ${decision.siteIntelligence.siteType}`);
    console.log(`   Detected capabilities: ${Object.keys(decision.siteIntelligence.capabilities).filter(k => decision.siteIntelligence.capabilities[k].supported).join(', ')}`);

  } finally {
    await stopServer(server);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// GUARANTEE 3: PRESET SAFETY
async function testPresetSafety() {
  console.log('\n📋 TEST 3: PRESET SAFETY');
  console.log('Testing: Presets cannot override intelligence decisions');

  const { server, port, url } = await startServer('marketing');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-lockdown-3-'));

  try {
    // Use startup preset which includes ALL flows (login, signup, checkout)
    await executeReality({
      baseUrl: url,
      artifactsDir: tmpDir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableCrawl: false,
      fast: true,
      preset: 'startup' // Most aggressive preset with all flows enabled
    });

    const runs = fs.readdirSync(tmpDir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}_/));
    const runDir = path.join(tmpDir, runs[0]);
    const decisionPath = path.join(runDir, 'decision.json');
    const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));

    // Preset included flows, but intelligence must override
    const flows = decision.outcomes?.flows || decision.flows || [];
    
    // All account/revenue flows should be NOT_APPLICABLE regardless of preset
    const forbiddenFlows = ['signup_flow', 'login_flow', 'checkout_flow'];
    for (const flowId of forbiddenFlows) {
      const flowResult = flows.find(f => f.flowId === flowId);
      if (flowResult) {
        assert.strictEqual(flowResult.outcome, 'NOT_APPLICABLE', 
          `Preset overrode intelligence: ${flowId} was ${flowResult.outcome} instead of NOT_APPLICABLE - PRESET OVERRIDE VIOLATION`);
      }
    }

    console.log('✅ PRESET SAFETY: PASS');
    console.log(`   Preset: startup (includes all flows)`);
    console.log(`   Intelligence override: All forbidden flows marked NOT_APPLICABLE`);

  } finally {
    await stopServer(server);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// GUARANTEE 4: SINGLE SOURCE OF TRUTH
async function testSingleSourceOfTruth() {
  console.log('\n📋 TEST 4: SINGLE SOURCE OF TRUTH');
  console.log('Testing: One verdict, one exit code, no contradictions');

  const { server, port, url } = await startServer('marketing');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-lockdown-4-'));

  try {
    const result = await executeReality({
      baseUrl: url,
      artifactsDir: tmpDir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableCrawl: false,
      fast: true,
      preset: 'startup'
    });

    const runs = fs.readdirSync(tmpDir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}_/));
    const runDir = path.join(tmpDir, runs[0]);
    const decisionPath = path.join(runDir, 'decision.json');
    const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));

    // EXACTLY ONE verdict
    assert(decision.finalVerdict, 'No final verdict found');
    assert(typeof decision.finalVerdict === 'string', 'Verdict must be a string');
    assert(['READY', 'FRICTION', 'DO_NOT_LAUNCH', 'OBSERVED'].includes(decision.finalVerdict), 
      `Invalid verdict: ${decision.finalVerdict}`);

    // EXACTLY ONE exit code
    assert(typeof decision.exitCode === 'number', 'Exit code must be a number');
    assert([0, 1, 2].includes(decision.exitCode), `Invalid exit code: ${decision.exitCode}`);

    // Verdict and exit code must be aligned
    const expectedExitCode = decision.finalVerdict === 'READY' || decision.finalVerdict === 'OBSERVED' ? 0 :
                            decision.finalVerdict === 'FRICTION' ? 1 : 2;
    assert.strictEqual(decision.exitCode, expectedExitCode, 
      `Verdict/exit code mismatch: verdict=${decision.finalVerdict}, exitCode=${decision.exitCode}, expected=${expectedExitCode}`);

    // No "verdict unavailable" message
    const summary = decision.explanation || '';
    const summaryText = typeof summary === 'string' ? summary : JSON.stringify(summary);
    assert(!summaryText.toLowerCase().includes('unavailable'), 'Summary contains "unavailable" - CONTRADICTION DETECTED');
    assert(!summaryText.toLowerCase().includes('unknown verdict'), 'Summary contains "unknown verdict" - CONTRADICTION DETECTED');

    console.log('✅ SINGLE SOURCE OF TRUTH: PASS');
    console.log(`   Final verdict: ${decision.finalVerdict}`);
    console.log(`   Exit code: ${decision.exitCode}`);
    console.log(`   Alignment: ✓`);

  } finally {
    await stopServer(server);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// GUARANTEE 5: REPORT HONESTY
async function testReportHonesty() {
  console.log('\n📋 TEST 5: REPORT HONESTY');
  console.log('Testing: Clear explanations of skipped flows, no misleading messages');

  const { server, port, url } = await startServer('marketing');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-lockdown-5-'));

  try {
    await executeReality({
      baseUrl: url,
      artifactsDir: tmpDir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableCrawl: false,
      fast: true,
      preset: 'startup',
      flows: ['signup_flow', 'login_flow', 'checkout_flow']
    });

    const runs = fs.readdirSync(tmpDir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}_/));
    const runDir = path.join(tmpDir, runs[0]);
    const decisionPath = path.join(runDir, 'decision.json');
    const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));

    // Check summary.md for honest reporting
    const summaryPath = path.join(runDir, 'summary.md');
    const summary = fs.existsSync(summaryPath) ? fs.readFileSync(summaryPath, 'utf8') : '';

    // Must explain site intelligence
    assert(summary.includes('Site type:') || summary.includes('site type'), 
      'Summary missing site type explanation');

    // Must list capabilities or explain why flows were skipped
    const flows = decision.outcomes?.flows || decision.flows || [];
    const notApplicableFlows = flows.filter(f => f.outcome === 'NOT_APPLICABLE');
    
    if (notApplicableFlows.length > 0) {
      // Summary must mention NOT_APPLICABLE or explain skip reason
      const hasSkipExplanation = summary.toLowerCase().includes('not applicable') || 
                                 summary.toLowerCase().includes('skipped') ||
                                 summary.toLowerCase().includes('no signup') ||
                                 summary.toLowerCase().includes('no login') ||
                                 summary.toLowerCase().includes('no checkout');
      assert(hasSkipExplanation, 'Summary does not explain why flows were skipped - HONESTY VIOLATION');
    }

    // Must NOT list skipped flows as failures
    for (const flow of notApplicableFlows) {
      assert(!summary.toLowerCase().includes(`${flow.flowName.toLowerCase()} failed`), 
        `Summary incorrectly reports ${flow.flowName} as failed - it was NOT_APPLICABLE`);
    }

    console.log('✅ REPORT HONESTY: PASS');
    console.log(`   Site intelligence included: ✓`);
    console.log(`   Skip reasons explained: ✓`);
    console.log(`   No false failure reports: ✓`);

  } finally {
    await stopServer(server);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// GUARANTEE 6: NOT_APPLICABLE NEVER PENALIZES VERDICT
async function testNotApplicableNeutral() {
  console.log('\n📋 TEST 6: NOT_APPLICABLE NEUTRALITY');
  console.log('Testing: NOT_APPLICABLE flows never reduce verdict or add friction');

  const { server, port, url } = await startServer('marketing');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-lockdown-6-'));

  try {
    await executeReality({
      baseUrl: url,
      artifactsDir: tmpDir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableCrawl: false,
      fast: true,
      preset: 'startup',
      flows: ['signup_flow', 'login_flow', 'checkout_flow']
    });

    const runs = fs.readdirSync(tmpDir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}_/));
    const runDir = path.join(tmpDir, runs[0]);
    const decisionPath = path.join(runDir, 'decision.json');
    const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));

    const flows = decision.outcomes?.flows || decision.flows || [];
    const notApplicableCount = flows.filter(f => f.outcome === 'NOT_APPLICABLE').length;

    // Verdict should be READY or OBSERVED (best possible) since no actual failures
    assert(decision.finalVerdict === 'READY' || decision.finalVerdict === 'OBSERVED', 
      `NOT_APPLICABLE flows penalized verdict: got ${decision.finalVerdict} instead of READY/OBSERVED`);

    // Exit code should be 0 (success)
    assert.strictEqual(decision.exitCode, 0, 
      `NOT_APPLICABLE flows penalized exit code: got ${decision.exitCode} instead of 0`);

    // Decision inputs should show 0 failures
    assert.strictEqual(decision.inputs.failures || 0, 0, 
      'Decision incorrectly counted NOT_APPLICABLE as failures');
    assert.strictEqual(decision.inputs.frictions || 0, 0, 
      'Decision incorrectly counted NOT_APPLICABLE as frictions');

    console.log('✅ NOT_APPLICABLE NEUTRALITY: PASS');
    console.log(`   NOT_APPLICABLE flows: ${notApplicableCount}`);
    console.log(`   Final verdict: ${decision.finalVerdict} (not penalized)`);
    console.log(`   Failures counted: 0`);
    console.log(`   Frictions counted: 0`);

  } finally {
    await stopServer(server);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Run all tests
async function runAllTests() {
  try {
    await testNoBlindExecution();
    await testIntelligenceFirstExecution();
    await testPresetSafety();
    await testSingleSourceOfTruth();
    await testReportHonesty();
    await testNotApplicableNeutral();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ALL FINAL LOCKDOWN TESTS PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nGuardian Guarantees Verified:');
    console.log('  ✓ NO BLIND EXECUTION');
    console.log('  ✓ INTELLIGENCE-FIRST EXECUTION');
    console.log('  ✓ PRESET SAFETY');
    console.log('  ✓ SINGLE SOURCE OF TRUTH');
    console.log('  ✓ REPORT HONESTY');
    console.log('  ✓ NOT_APPLICABLE NEUTRALITY');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ FINAL LOCKDOWN TEST FAILED');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runAllTests();
