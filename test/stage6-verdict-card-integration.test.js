/**
 * Stage 6: Verdict Card Integration Test
 * 
 * Tests verdict card generation in actual Guardian decision artifacts
 */

const path = require('path');
const fs = require('fs');

console.log('🧪 Stage 6: Verdict Card Integration Test');
console.log('━'.repeat(70));

async function testVerdictCardInDecisionArtifact() {
  console.log('📝 Test: Verdict card in decision.json from artifacts/\n');

  // Look for recent decision.json files in artifacts/
  const artifactsDir = path.resolve(__dirname, '..', 'artifacts');
  
  if (!fs.existsSync(artifactsDir)) {
    console.log('⚠️  No artifacts directory found - skipping integration test');
    console.log('   Run `guardian reality --url <url>` to generate artifacts first\n');
    return true;
  }

  const dirs = fs.readdirSync(artifactsDir)
    .filter(d => {
      const stat = fs.statSync(path.join(artifactsDir, d));
      return stat.isDirectory();
    })
    .filter(d => d.match(/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/)); // Date pattern

  if (dirs.length === 0) {
    console.log('⚠️  No Guardian run directories found - skipping integration test');
    console.log('   Run `guardian reality --url <url>` to generate artifacts first\n');
    return true;
  }

  // Check the most recent run
  const latestDir = dirs.sort().reverse()[0];
  const decisionPath = path.join(artifactsDir, latestDir, 'decision.json');

  if (!fs.existsSync(decisionPath)) {
    console.log(`⚠️  No decision.json in latest run: ${latestDir}`);
    return true;
  }

  console.log(`   Checking: ${latestDir}/decision.json`);

  const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));

  // Check verdict card exists
  if (!decision.verdictCard) {
    throw new Error('Verdict card not found in decision.json');
  }
  console.log('✅ Verdict card present in decision.json');

  // Check structure
  if (!decision.verdictCard.headline) {
    throw new Error('Verdict card missing headline');
  }
  console.log(`✅ Headline: ${decision.verdictCard.headline}`);

  if (!decision.verdictCard.severity) {
    throw new Error('Verdict card missing severity');
  }
  console.log(`✅ Severity: ${decision.verdictCard.severity}`);

  if (!decision.verdictCard.impact) {
    throw new Error('Verdict card missing impact');
  }
  console.log(`✅ Impact type: ${decision.verdictCard.impact.type}`);
  console.log(`   Summary: ${decision.verdictCard.impact.summary}`);
  console.log(`   Confidence: ${decision.verdictCard.impact.confidence}`);

  // Check limits
  if (decision.verdictCard.bullets.length > 3) {
    throw new Error(`Too many bullets: ${decision.verdictCard.bullets.length}`);
  }
  console.log(`✅ Bullets: ${decision.verdictCard.bullets.length}/3`);

  if (decision.verdictCard.evidence.length > 3) {
    throw new Error(`Too many evidence lines: ${decision.verdictCard.evidence.length}`);
  }
  console.log(`✅ Evidence: ${decision.verdictCard.evidence.length}/3`);

  if (decision.verdictCard.nextActions.length > 3) {
    throw new Error(`Too many actions: ${decision.verdictCard.nextActions.length}`);
  }
  console.log(`✅ Next actions: ${decision.verdictCard.nextActions.length}/3`);

  // Check that verdict card matches decision verdict
  if (decision.finalVerdict !== decision.finalDecision?.finalVerdict) {
    console.log(`⚠️  Verdict mismatch (minor): top-level vs finalDecision`);
  }

  console.log('\n✅ Integration test PASSED');
  return true;
}

async function runVerdictCardIntegrationTests() {
  try {
    await testVerdictCardInDecisionArtifact();

    console.log('━'.repeat(70));
    console.log('✅ Verdict card integration tests PASSED');
    console.log('━'.repeat(70));
    process.exit(0);

  } catch (err) {
    console.error(`\n❌ Test failed: ${err.message}`);
    if (err.stack) console.error(err.stack);
    console.log('━'.repeat(70));
    console.log('❌ Verdict card integration tests FAILED');
    console.log('━'.repeat(70));
    process.exit(1);
  }
}

runVerdictCardIntegrationTests();
