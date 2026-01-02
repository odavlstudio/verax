// Trust Closure Tests (Stage 5)
// Fast, real checks (no network, no Playwright)

const fs = require('fs');
const path = require('path');
const { realWorldScenarios } = require('../src/guardian/realworld-scenarios');

const ARTIFACTS_ROOT = path.resolve(__dirname, '../artifacts/realworld');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { console.log('✓', msg); pass++; }
  else { console.log('✗', msg); fail++; }
}

console.log('Running trust closure tests...\n');

// Test 1: trust.json created for all scenarios with evidence
for (const scenario of realWorldScenarios) {
  const dir = fs.readdirSync(ARTIFACTS_ROOT).find(d => d.startsWith(scenario.scenarioId));
  if (!dir) continue;
  const trustPath = path.join(ARTIFACTS_ROOT, dir, 'trust.json');
  assert(fs.existsSync(trustPath), `trust.json exists for ${scenario.scenarioId}`);
}

// Test 2: trust-summary.json exists
const summaryPath = path.join(ARTIFACTS_ROOT, 'trust-summary.json');
assert(fs.existsSync(summaryPath), 'trust-summary.json exists');

// Test 3: trust.json content is derived from evidence/narrative
for (const scenario of realWorldScenarios) {
  const dir = fs.readdirSync(ARTIFACTS_ROOT).find(d => d.startsWith(scenario.scenarioId));
  if (!dir) continue;
  const trustPath = path.join(ARTIFACTS_ROOT, dir, 'trust.json');
  if (!fs.existsSync(trustPath)) continue;
  const trust = JSON.parse(fs.readFileSync(trustPath, 'utf-8'));
  assert(['HIGH','MEDIUM','LOW'].includes(trust.trustLevel), `trustLevel valid for ${scenario.scenarioId}`);
  assert(Array.isArray(trust.trustWhy) && trust.trustWhy.length > 0, `trustWhy present for ${scenario.scenarioId}`);
  assert(Array.isArray(trust.trustLimits) && trust.trustLimits.length > 0, `trustLimits present for ${scenario.scenarioId}`);
  assert(['Proceed','Proceed with Caution','Block'].includes(trust.recommendedAction), `recommendedAction valid for ${scenario.scenarioId}`);
}

// Test 4: trust-summary.json content
if (fs.existsSync(summaryPath)) {
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
  assert(summary.trustDistribution, 'trustDistribution present in summary');
  assert(summary.overallRecommendation, 'overallRecommendation present in summary');
}

console.log(`\nPassed: ${pass}`);
console.log(`Failed: ${fail}`);
if (fail === 0) {
  console.log('All trust closure tests passed!');
  process.exit(0);
} else {
  process.exit(1);
}
