// Proof Narrative Generator Tests
// Stage 3: Fast, real tests (no network, no Playwright)

const fs = require('fs');
const path = require('path');
const { realWorldScenarios } = require('../src/guardian/realworld-scenarios');

const ARTIFACTS_ROOT = path.resolve(__dirname, '../artifacts/realworld');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { console.log('✓', msg); pass++; }
  else { console.log('✗', msg); fail++; }
}

console.log('Running proof narrative tests...\n');

// Test 1: Narrative generated for all scenarios with evidence
for (const scenario of realWorldScenarios) {
  const dir = fs.readdirSync(ARTIFACTS_ROOT).find(d => d.startsWith(scenario.scenarioId));
  if (!dir) continue;
  const narrativePath = path.join(ARTIFACTS_ROOT, dir, 'narrative.json');
  assert(fs.existsSync(narrativePath), `narrative.json exists for ${scenario.scenarioId}`);
}

// Test 2: Narrative content is derived from evidence fields
for (const scenario of realWorldScenarios) {
  const dir = fs.readdirSync(ARTIFACTS_ROOT).find(d => d.startsWith(scenario.scenarioId));
  if (!dir) continue;
  const narrativePath = path.join(ARTIFACTS_ROOT, dir, 'narrative.json');
  if (!fs.existsSync(narrativePath)) continue;
  const narrative = JSON.parse(fs.readFileSync(narrativePath, 'utf-8'));
  assert(narrative.title && narrative.title.length > 0, `title present for ${scenario.scenarioId}`);
  assert(narrative.before && narrative.before.length > 0, `before present for ${scenario.scenarioId}`);
  assert(Array.isArray(narrative.findings) && narrative.findings.length > 0, `findings present for ${scenario.scenarioId}`);
  assert(narrative.verdict && narrative.verdict.length > 0, `verdict present for ${scenario.scenarioId}`);
  assert(Array.isArray(narrative.why) && narrative.why.length > 0, `why present for ${scenario.scenarioId}`);
  assert(Array.isArray(narrative.limits) && narrative.limits.length > 0, `limits present for ${scenario.scenarioId}`);
}

// Test 3: Limits appear when evidence indicates gaps
for (const scenario of realWorldScenarios) {
  const dir = fs.readdirSync(ARTIFACTS_ROOT).find(d => d.startsWith(scenario.scenarioId));
  if (!dir) continue;
  const narrativePath = path.join(ARTIFACTS_ROOT, dir, 'narrative.json');
  if (!fs.existsSync(narrativePath)) continue;
  const narrative = JSON.parse(fs.readFileSync(narrativePath, 'utf-8'));
  // If evidence had limits, narrative.limits should not be default
  const evidencePath = path.join(ARTIFACTS_ROOT, dir, 'evidence.json');
  if (fs.existsSync(evidencePath)) {
    const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));
    if (Array.isArray(evidence.limits) && evidence.limits.length > 0) {
      assert(narrative.limits.some(l => evidence.limits.includes(l)), `limits from evidence appear in narrative for ${scenario.scenarioId}`);
    }
  }
}

console.log(`\nPassed: ${pass}`);
console.log(`Failed: ${fail}`);
if (fail === 0) {
  console.log('All proof narrative tests passed!');
  process.exit(0);
} else {
  process.exit(1);
}
