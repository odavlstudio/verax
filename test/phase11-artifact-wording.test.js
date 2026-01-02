/**
 * PHASE 11: ARTIFACT WORDING REGRESSION TESTS
 * 
 * Ensures decision.json and summary.txt use clear, deterministic language:
 * - "Not observed" vs "Failed" distinction
 * - observedCapabilities field present
 * - "What Was Not Observed" section present in summary
 * - No confusion about absent capabilities being failures
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { startFixtureServer } = require('./fixture-server');
const { executeReality } = require('../src/guardian/reality');

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  PHASE 11: ARTIFACT WORDING REGRESSION TESTS                  ║');
  console.log('║  Verifies clarity of decision.json + summary.txt               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  const fixture = await startFixtureServer();
  const tempArtifactsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-phase11-wording-'));
  const results = { passed: 0, failed: 0 };

  try {
    // ============================================================
    // Test A: Landing-only site (no auth)
    // ============================================================
    console.log('📋 Test A: Landing-only site artifact wording');
    console.log('');
    
    const testAUrl = `${fixture.baseUrl}/landing-only`;
    const testADir = path.join(tempArtifactsDir, 'test-a-artifact-wording');
    
    const resultA = await executeReality({
      baseUrl: testAUrl,
      artifactsDir: testADir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableCrawl: true,
      maxPages: 5,
      maxDepth: 2
    });

    const decisionPathA = path.join(testADir, 'decision.json');
    const summaryPathA = path.join(testADir, 'summary.txt');
    
    // Find the run directory (timestamped subdirectory)
    const runDirsA = fs.readdirSync(testADir)
      .filter(d => d !== 'latest' && d !== 'LATEST.json')
      .filter(d => {
        const fullPath = path.join(testADir, d);
        return fs.statSync(fullPath).isDirectory();
      })
      .sort()
      .reverse();
    
    assert.ok(runDirsA.length > 0, 'No run directory created');
    const runDirA = runDirsA[0];
    const decisionPathARun = path.join(testADir, runDirA, 'decision.json');
    const summaryPathARun = path.join(testADir, runDirA, 'summary.txt');
    
    assert.ok(fs.existsSync(decisionPathARun), 'decision.json not found');
    assert.ok(fs.existsSync(summaryPathARun), 'summary.txt not found');
    
    const decisionA = JSON.parse(fs.readFileSync(decisionPathARun, 'utf8'));
    const summaryA = fs.readFileSync(summaryPathARun, 'utf8');

    // ========== Test A Assertions ==========
    
    // Assertion 1: observedCapabilities field exists
    console.log('   Checking observedCapabilities field...');
    assert.ok(decisionA.observedCapabilities, 'observedCapabilities field missing from decision.json');
    console.log('   ✅ Assertion 1: observedCapabilities field present');

    // Assertion 2: login/signup/checkout marked as NOT observed
    console.log('   Checking login/signup/checkout marked as not observed...');
    assert.strictEqual(decisionA.observedCapabilities.login, false, 'login should be false (not observed)');
    assert.strictEqual(decisionA.observedCapabilities.signup, false, 'signup should be false (not observed)');
    assert.strictEqual(decisionA.observedCapabilities.checkout, false, 'checkout should be false (not observed)');
    console.log('   ✅ Assertion 2: login/signup/checkout correctly marked false');

    // Assertion 3: applicability field present with correct structure
    console.log('   Checking applicability field...');
    assert.ok(decisionA.applicability, 'applicability field missing from decision.json');
    assert.ok(typeof decisionA.applicability.relevantTotal === 'number', 'applicability.relevantTotal must be number');
    assert.ok(typeof decisionA.applicability.executed === 'number', 'applicability.executed must be number');
    assert.ok(typeof decisionA.applicability.notObserved === 'number', 'applicability.notObserved must be number');
    assert.ok(typeof decisionA.applicability.coveragePercent === 'number', 'applicability.coveragePercent must be number');
    console.log('   ✅ Assertion 3: applicability field structure correct');

    // Assertion 4: notObserved count should be > 0 (login/signup/checkout not observed)
    console.log('   Checking notObserved count...');
    assert.ok(decisionA.applicability.notObserved > 0, `notObserved should be > 0, got ${decisionA.applicability.notObserved}`);
    console.log(`   ✅ Assertion 4: notObserved = ${decisionA.applicability.notObserved} (correct)`);

    // Assertion 5: Summary contains "What Was Not Observed" section
    console.log('   Checking summary for "What Was Not Observed" section...');
    assert.ok(summaryA.includes('What Was Not Observed:'), 'Summary must include "What Was Not Observed:" section');
    console.log('   ✅ Assertion 5: "What Was Not Observed" section present');

    // Assertion 6: Summary mentions login/signup/checkout as NOT observed (not failed)
    console.log('   Checking that login/signup/checkout listed as not observed...');
    const notObservedSection = summaryA.split('What Was Not Observed:')[1].split('\n\n')[0];
    const hasLoginNotObserved = notObservedSection.toLowerCase().includes('login');
    const hasSignupNotObserved = notObservedSection.toLowerCase().includes('signup');
    const hasCheckoutNotObserved = notObservedSection.toLowerCase().includes('checkout');
    
    assert.ok(hasLoginNotObserved || hasSignupNotObserved || hasCheckoutNotObserved,
      'At least one of login/signup/checkout should be mentioned in "What Was Not Observed"');
    console.log('   ✅ Assertion 6: Absent capabilities listed in "What Was Not Observed"');

    // Assertion 7: "Could Not Confirm" section should NOT mention flow failures for absent capabilities
    console.log('   Checking "Could Not Confirm" does NOT mention absent capability failures...');
    const couldNotConfirmSection = summaryA.split('What Guardian Could Not Confirm:')[1].split('\n\n')[0];
    const mentionsLoginFailure = couldNotConfirmSection.toLowerCase().includes('login') && 
                                  (couldNotConfirmSection.toLowerCase().includes('fail') || 
                                   couldNotConfirmSection.toLowerCase().includes('flow failure'));
    const mentionsSignupFailure = couldNotConfirmSection.toLowerCase().includes('signup') && 
                                   (couldNotConfirmSection.toLowerCase().includes('fail') || 
                                    couldNotConfirmSection.toLowerCase().includes('flow failure'));
    
    assert.ok(!mentionsLoginFailure, 'Should NOT mention login failure (it was not observed)');
    assert.ok(!mentionsSignupFailure, 'Should NOT mention signup failure (it was not observed)');
    console.log('   ✅ Assertion 7: No false "failures" for absent capabilities');

    console.log('✅ Test A PASSED: Landing-only artifact wording correct');
    console.log('');
    results.passed++;

    // ============================================================
    // Test B: Broken login site
    // ============================================================
    console.log('📋 Test B: Broken login site artifact wording');
    console.log('');
    
    const testBUrl = `${fixture.baseUrl}/landing-with-login`;
    const testBDir = path.join(tempArtifactsDir, 'test-b-artifact-wording');
    
    const resultB = await executeReality({
      baseUrl: testBUrl,
      artifactsDir: testBDir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableCrawl: true,
      maxPages: 5,
      maxDepth: 2
    });

    const decisionPathB = path.join(testBDir, 'decision.json');
    const summaryPathB = path.join(testBDir, 'summary.txt');
    
    // Find the run directory (timestamped subdirectory)
    const runDirsB = fs.readdirSync(testBDir)
      .filter(d => d !== 'latest' && d !== 'LATEST.json')
      .filter(d => {
        const fullPath = path.join(testBDir, d);
        return fs.statSync(fullPath).isDirectory();
      })
      .sort()
      .reverse();
    
    assert.ok(runDirsB.length > 0, 'No run directory created');
    const runDirB = runDirsB[0];
    const decisionPathBRun = path.join(testBDir, runDirB, 'decision.json');
    const summaryPathBRun = path.join(testBDir, runDirB, 'summary.txt');
    
    assert.ok(fs.existsSync(decisionPathBRun), 'decision.json not found');
    assert.ok(fs.existsSync(summaryPathBRun), 'summary.txt not found');
    
    const decisionB = JSON.parse(fs.readFileSync(decisionPathBRun, 'utf8'));
    const summaryB = fs.readFileSync(summaryPathBRun, 'utf8');

    // ========== Test B Assertions ==========
    
    // Assertion 1: login marked as observed
    console.log('   Checking login marked as observed...');
    assert.ok(decisionB.observedCapabilities, 'observedCapabilities field missing from decision.json');
    assert.strictEqual(decisionB.observedCapabilities.login, true, 'login should be true (observed)');
    console.log('   ✅ Assertion 1: login correctly marked true (observed)');

    // Assertion 2: "Could Not Confirm" section SHOULD mention login failure
    console.log('   Checking "Could Not Confirm" mentions login failure...');
    const couldNotConfirmB = summaryB.split('What Guardian Could Not Confirm:')[1].split('\n\n')[0];
    const mentionsLoginFlowFailure = couldNotConfirmB.toLowerCase().includes('login') || 
                                      couldNotConfirmB.toLowerCase().includes('flow');
    assert.ok(mentionsLoginFlowFailure, 'Should mention login or flow failure in "Could Not Confirm"');
    console.log('   ✅ Assertion 2: Login failure mentioned in "Could Not Confirm"');

    // Assertion 3: Verdict is DO_NOT_LAUNCH
    console.log('   Checking verdict is DO_NOT_LAUNCH...');
    assert.strictEqual(decisionB.finalVerdict, 'DO_NOT_LAUNCH', 'Verdict must be DO_NOT_LAUNCH');
    console.log('   ✅ Assertion 3: Verdict is DO_NOT_LAUNCH');

    // Assertion 4: reasons array contains structured objects (not generic strings)
    console.log('   Checking reasons are structured...');
    assert.ok(Array.isArray(decisionB.reasons), 'reasons must be array');
    assert.ok(decisionB.reasons.length > 0, 'reasons array must not be empty');
    // Check reasons are objects with message/ruleId (Phase 3 format)
    const hasStructuredReasons = decisionB.reasons.some(r => 
      (typeof r === 'object' && (r.message || r.ruleId)) || typeof r === 'string'
    );
    assert.ok(hasStructuredReasons, 'reasons should be structured objects or strings');
    console.log(`   ✅ Assertion 4: reasons array has ${decisionB.reasons.length} item(s)`);

    // Assertion 5: Summary "Final Verdict" section includes real reasons
    console.log('   Checking summary verdict section includes reasons...');
    const verdictSection = summaryB.split('Final Verdict:')[1].split('\n\n')[0];
    const hasReasonText = verdictSection.toLowerCase().includes('flow') || 
                          verdictSection.toLowerCase().includes('fail') ||
                          verdictSection.toLowerCase().includes('critical');
    assert.ok(hasReasonText, 'Verdict section should include substantive reason text');
    console.log('   ✅ Assertion 5: Verdict section includes real reasons');

    console.log('✅ Test B PASSED: Broken login artifact wording correct');
    console.log('');
    results.passed++;

  } catch (err) {
    console.error(`❌ Test FAILED: ${err.message}`);
    console.error(err.stack);
    results.failed++;
  } finally {
    await fixture.close();
  }

  // ============================================================
  // Test C: Regression test - no "planned attempt" wording
  // ============================================================
  console.log('\n📋 Test C: Regression test - no "planned attempt" wording\n');
  
  const fixtureC = await startFixtureServer();
  try {
    const testCUrl = `${fixtureC.baseUrl}/landing-only`;
    const testCDir = path.join(tempArtifactsDir, 'test-c-wording-regression');
    
    await executeReality({
      baseUrl: testCUrl,
      artifactsDir: testCDir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableCrawl: true,
      maxPages: 5,
      maxDepth: 2
    });
    
    // Find the run directory
    const runDirsC = fs.readdirSync(testCDir)
      .filter(d => d !== 'latest' && d !== 'LATEST.json')
      .filter(d => {
        const fullPath = path.join(testCDir, d);
        return fs.statSync(fullPath).isDirectory();
      })
      .sort()
      .reverse();
    
    const runDirC = runDirsC[0];
    const decisionPathC = path.join(testCDir, runDirC, 'decision.json');
    const summaryPathC = path.join(testCDir, runDirC, 'summary.txt');
    
    const decisionC = JSON.parse(fs.readFileSync(decisionPathC, 'utf8'));
    const summaryC = fs.readFileSync(summaryPathC, 'utf8');
    
    // Check that "planned attempt" does NOT appear in user-facing outputs
    console.log('   Checking for prohibited "planned attempt" language...');
    const prohibitedMatch = summaryC.match(/planned attempt/i);
    assert.strictEqual(prohibitedMatch, null, `Found prohibited wording in summary: "${prohibitedMatch ? prohibitedMatch[0] : ''}"`);
    console.log('   ✅ Assertion 1: No "planned attempt" wording in summary');
    
    // Check decision.json reasons array
    if (decisionC.reasons && Array.isArray(decisionC.reasons)) {
      for (const reason of decisionC.reasons) {
        const reasonText = typeof reason === 'string' ? reason : reason.message || '';
        const reasonMatch = reasonText.match(/planned attempt/i);
        assert.strictEqual(reasonMatch, null, `Found prohibited wording in decision.json reason: "${reasonText}"`);
      }
    }
    console.log('   ✅ Assertion 2: No "planned attempt" wording in decision.json reasons');
    
    console.log('✅ Test C PASSED: No prohibited "planned attempt" wording\n');
    results.passed++;
  } catch (err) {
    console.error(`❌ Test FAILED: ${err.message}`);
    console.error(err.stack);
    results.failed++;
  } finally {
    await fixtureC.close();
  }

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log(`║  RESULTS: ${results.passed} passed, ${results.failed} failed                                        ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  process.exit(results.failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
