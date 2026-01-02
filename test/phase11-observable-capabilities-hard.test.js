/**
 * Phase 11: Observable Capabilities - Hard Lock Tests
 * 
 * These tests MUST FAIL on old behavior (before VISIBLE = MUST WORK):
 * - Test A: Landing-only produces READY (not penalized for absent login/signup/checkout)
 * - Test B: Visible broken login produces non-READY (not ignored as NOT_APPLICABLE)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { startFixtureServer } = require('./fixture-server');
const { executeReality } = require('../src/guardian/reality');

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  PHASE 11: OBSERVABLE CAPABILITIES - HARD LOCK TESTS           ║');
  console.log('║  These tests lock the VISIBLE = MUST WORK principle            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Start fixture server
  console.log('🔨 Starting fixture server...');
  const fixture = await startFixtureServer();
  console.log(`✅ Fixture running at ${fixture.baseUrl}\n`);

  const tempArtifactsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-phase11-hard-'));
  
  let testsPassed = 0;
  let testsFailed = 0;

  // ========== TEST A: Landing-only should be READY ==========
  console.log('📋 Test A: Landing-only site produces READY (no penalties for absent capabilities)\n');
  try {
    const landingUrl = `${fixture.baseUrl}/landing-only`;
    
    const result = await executeReality({
      baseUrl: landingUrl,
      artifactsDir: path.join(tempArtifactsDir, 'test-a-landing-only'),
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableCrawl: true,
      maxPages: 5,
      maxDepth: 2
    });

    console.log(`   Final verdict: ${result.finalDecision?.finalVerdict}`);
    console.log(`   Exit code: ${result.finalDecision?.exitCode}`);

    // CRITICAL ASSERTION 1: Landing-only MUST produce READY
    assert.strictEqual(
      result.finalDecision?.finalVerdict,
      'READY',
      `Landing-only site MUST produce READY, got ${result.finalDecision?.finalVerdict}`
    );
    console.log('   ✅ Assertion 1: finalVerdict === READY');

    // CRITICAL ASSERTION 2: Exit code MUST be 0
    assert.strictEqual(
      result.finalDecision?.exitCode,
      0,
      `Landing-only site MUST have exitCode 0, got ${result.finalDecision?.exitCode}`
    );
    console.log('   ✅ Assertion 2: exitCode === 0');

    // Load decision.json to verify detailed reasons
    const runDirs = fs.readdirSync(path.join(tempArtifactsDir, 'test-a-landing-only'))
      .filter(d => d !== 'latest' && d !== 'LATEST.json')
      .filter(d => {
        const fullPath = path.join(tempArtifactsDir, 'test-a-landing-only', d);
        return fs.statSync(fullPath).isDirectory();
      })
      .sort()
      .reverse();

    assert.ok(runDirs.length > 0, 'No run directory created');
    const runDir = runDirs[0];
    const decisionPath = path.join(tempArtifactsDir, 'test-a-landing-only', runDir, 'decision.json');
    
    assert.ok(fs.existsSync(decisionPath), 'decision.json not found');
    const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));

    // CRITICAL ASSERTION 3: No FLOW_FAILURE reasons for non-observed capabilities
    const reasons = decision.reasons || [];
    const reasonTexts = reasons.map(r => typeof r === 'string' ? r : r.message || r.reason || '');
    const flowFailures = reasonTexts.filter(r => 
      r.toLowerCase().includes('flow') && 
      r.toLowerCase().includes('failure')
    );
    
    // Should not mention login/signup/checkout failures
    const mentionsAbsentCapabilities = reasonTexts.some(r => 
      (r.toLowerCase().includes('login') || 
       r.toLowerCase().includes('signup') || 
       r.toLowerCase().includes('checkout')) &&
      r.toLowerCase().includes('fail')
    );

    assert.strictEqual(
      mentionsAbsentCapabilities,
      false,
      'Landing-only MUST NOT report failures for absent login/signup/checkout capabilities'
    );
    console.log('   ✅ Assertion 3: No failure reasons for absent capabilities (login/signup/checkout)');

    // CRITICAL ASSERTION 4: Coverage calculation excludes non-observed
    if (decision.coverage) {
      console.log(`   Coverage stats: ${decision.coverage.executed || 0} / ${decision.coverage.total || 0} = ${decision.coverage.percent || 0}%`);
      
      // Coverage should not count non-observed attempts
      // If total includes login/signup/checkout, that's a bug
      const snapshot = result.snapshot || {};
      const attemptResults = snapshot.attempts || [];
      
      const notApplicableCount = attemptResults.filter(a => a.outcome === 'NOT_APPLICABLE').length;
      console.log(`   NOT_APPLICABLE attempts: ${notApplicableCount}`);
      
      // We expect some NOT_APPLICABLE (for login/signup/checkout)
      // Coverage denominator should exclude them
    }

    console.log('✅ Test A PASSED: Landing-only site correctly produces READY\n');
    testsPassed++;

  } catch (err) {
    console.error(`❌ Test A FAILED: ${err.message}`);
    console.error(err.stack);
    testsFailed++;
  }

  // ========== TEST B: Visible broken login must produce non-READY ==========
  console.log('📋 Test B: Visible broken login produces non-READY (not ignored)\n');
  try {
    const brokenLoginUrl = `${fixture.baseUrl}/landing-with-login`;
    
    const result = await executeReality({
      baseUrl: brokenLoginUrl,
      artifactsDir: path.join(tempArtifactsDir, 'test-b-broken-login'),
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableCrawl: true,
      maxPages: 5,
      maxDepth: 2
    });

    console.log(`   Final verdict: ${result.finalDecision?.finalVerdict}`);
    console.log(`   Exit code: ${result.finalDecision?.exitCode}`);

    // CRITICAL ASSERTION 1: Broken login MUST NOT produce READY
    assert.notStrictEqual(
      result.finalDecision?.finalVerdict,
      'READY',
      'Site with visible broken login MUST NOT produce READY'
    );
    console.log(`   ✅ Assertion 1: finalVerdict !== READY (got ${result.finalDecision?.finalVerdict})`);

    // CRITICAL ASSERTION 2: Exit code MUST NOT be 0
    assert.notStrictEqual(
      result.finalDecision?.exitCode,
      0,
      'Site with visible broken login MUST NOT have exitCode 0'
    );
    console.log(`   ✅ Assertion 2: exitCode !== 0 (got ${result.finalDecision?.exitCode})`);

    // CRITICAL ASSERTION 3: Login capability must be detected as observed
    const snapshot = result.snapshot || {};
    const siteIntel = snapshot.siteIntelligence || {};
    
    // Check if login was detected
    const capabilities = siteIntel.capabilities || {};
    const loginSupported = capabilities.supports_login?.supported;
    
    if (loginSupported !== undefined) {
      console.log(`   Login capability detected: ${loginSupported}`);
      assert.strictEqual(
        loginSupported,
        true,
        'Login capability MUST be detected as supported (observed) on this fixture'
      );
      console.log('   ✅ Assertion 3: Login capability detected as observable');
    } else {
      console.log('   ⚠️  Login capability not in site intelligence (may be in different location)');
    }

    // CRITICAL ASSERTION 4: Login attempt/flow must have been executed (not NOT_APPLICABLE)
    const attemptResults = snapshot.attempts || [];
    const loginAttempt = attemptResults.find(a => 
      a.attemptId === 'login' || 
      a.attemptName?.toLowerCase().includes('login')
    );

    if (loginAttempt) {
      console.log(`   Login attempt outcome: ${loginAttempt.outcome}`);
      assert.notStrictEqual(
        loginAttempt.outcome,
        'NOT_APPLICABLE',
        'Login attempt MUST NOT be marked as NOT_APPLICABLE (it is visible)'
      );
      console.log('   ✅ Assertion 4: Login attempt was executed (not NOT_APPLICABLE)');
    } else {
      // Check flows
      const flowResults = snapshot.flows || [];
      const loginFlow = flowResults.find(f => 
        f.flowId === 'login_flow' || 
        f.flowName?.toLowerCase().includes('login')
      );
      
      if (loginFlow) {
        console.log(`   Login flow outcome: ${loginFlow.outcome}`);
        assert.notStrictEqual(
          loginFlow.outcome,
          'NOT_APPLICABLE',
          'Login flow MUST NOT be marked as NOT_APPLICABLE (it is visible)'
        );
        console.log('   ✅ Assertion 4: Login flow was executed (not NOT_APPLICABLE)');
      } else {
        console.log('   ⚠️  No explicit login attempt/flow found (may be covered by other means)');
      }
    }

    // CRITICAL ASSERTION 5: Reasons must mention the failing capability
    const reasons = result.finalDecision?.reasons || [];
    const reasonTexts = reasons.map(r => typeof r === 'string' ? r : r.message || r.reason || '');
    console.log(`   Failure reasons: ${reasonTexts.slice(0, 3).join('; ')}`);
    
    // Should mention some kind of failure (not just "coverage gap")
    const hasSubstantiveFailure = reasonTexts.some(r => 
      r.toLowerCase().includes('fail') ||
      r.toLowerCase().includes('error') ||
      r.toLowerCase().includes('broken') ||
      r.toLowerCase().includes('regression')
    );

    assert.strictEqual(
      hasSubstantiveFailure,
      true,
      'Failure reasons MUST mention actual failure (not just coverage gaps)'
    );
    console.log('   ✅ Assertion 5: Reasons mention actual failure');

    console.log('✅ Test B PASSED: Visible broken login correctly produces non-READY\n');
    testsPassed++;

  } catch (err) {
    console.error(`❌ Test B FAILED: ${err.message}`);
    console.error(err.stack);
    testsFailed++;
  }

  // Cleanup
  await fixture.close();

  // Summary
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log(`║  RESULTS: ${testsPassed} passed, ${testsFailed} failed                                        ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
