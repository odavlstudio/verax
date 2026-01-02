// Real-World Proof Harness Tests
// Stage 2: Fast, real tests (no network, no Playwright)

const fs = require('fs');
const path = require('path');
const { realWorldScenarios } = require('../src/guardian/realworld-scenarios');

const ARTIFACTS_ROOT = path.resolve(__dirname, '../artifacts/realworld');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { console.log('✓', msg); pass++; }
  else { console.log('✗', msg); fail++; }
}

console.log('Running real-world harness tests...\n');

// Test 1: All scenarios executed (evidence.json exists)
for (const scenario of realWorldScenarios) {
  const found = fs.readdirSync(ARTIFACTS_ROOT).some(dir =>
    dir.startsWith(scenario.scenarioId)
  );
  assert(found, `Evidence dir exists for scenario: ${scenario.scenarioId}`);
}

// Test 2: Evidence file created per scenario
for (const scenario of realWorldScenarios) {
  const dir = fs.readdirSync(ARTIFACTS_ROOT).find(d => d.startsWith(scenario.scenarioId));
  assert(dir, `Dir found for scenario: ${scenario.scenarioId}`);
  if (dir) {
    const evidencePath = path.join(ARTIFACTS_ROOT, dir, 'evidence.json');
    assert(fs.existsSync(evidencePath), `evidence.json exists for ${scenario.scenarioId}`);
    // Test 3: Evidence file is valid JSON and has required fields
    try {
      const bundle = JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));
      assert(bundle.verdict, `verdict present for ${scenario.scenarioId}`);
      assert(bundle.confidence, `confidence present for ${scenario.scenarioId}`);
      assert(bundle.artifactPaths, `artifactPaths present for ${scenario.scenarioId}`);
    } catch (e) {
      assert(false, `evidence.json is valid JSON for ${scenario.scenarioId}`);
    }
  }
}

// Test 4: No shared state between runs (unique runDir per scenario)
const runDirs = realWorldScenarios.map(scenario => {
  const dir = fs.readdirSync(ARTIFACTS_ROOT).find(d => d.startsWith(scenario.scenarioId));
  return dir;
});
const uniqueDirs = new Set(runDirs);
assert(uniqueDirs.size === runDirs.length, 'Each scenario has a unique runDir');

// Test 5: Deterministic tagging (scenarioId in dir name)
for (const scenario of realWorldScenarios) {
  const dir = fs.readdirSync(ARTIFACTS_ROOT).find(d => d.startsWith(scenario.scenarioId));
  assert(dir && dir.startsWith(scenario.scenarioId), `Dir name starts with scenarioId: ${scenario.scenarioId}`);
}

console.log(`\nPassed: ${pass}`);
console.log(`Failed: ${fail}`);
if (fail === 0) {
  console.log('All real-world harness tests passed!');
  process.exit(0);
} else {
  process.exit(1);
}
