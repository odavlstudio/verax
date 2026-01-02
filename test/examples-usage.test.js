// Usage & CI Example Tests (Stage 4)
// Fast, real checks (no network, no CI execution)

const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { console.log('✓', msg); pass++; }
  else { console.log('✗', msg); fail++; }
}

console.log('Running usage & CI example tests...\n');

// Test 1: CLI usage example file exists
const cliPath = path.resolve(__dirname, '../scripts/examples/cli-usage-examples.sh');
assert(fs.existsSync(cliPath), 'cli-usage-examples.sh exists');

// Test 2: CLI examples reference valid Guardian binary
const cliContent = fs.readFileSync(cliPath, 'utf-8');
assert(cliContent.includes('bin/guardian.js'), 'CLI examples reference bin/guardian.js');

// Test 3: CI example YAML exists
const ciPath = path.resolve(__dirname, '../.github/examples/guardian-ci-minimal.yml');
assert(fs.existsSync(ciPath), 'guardian-ci-minimal.yml exists');

// Test 4: CI YAML is valid syntax (basic check)
try {
  const yaml = fs.readFileSync(ciPath, 'utf-8');
  assert(yaml.includes('jobs:'), 'CI YAML contains jobs section');
  assert(yaml.includes('run:'), 'CI YAML contains run steps');
  assert(yaml.includes('bin/guardian.js'), 'CI YAML references bin/guardian.js');
} catch (e) {
  assert(false, 'CI YAML is readable');
}

console.log(`\nPassed: ${pass}`);
console.log(`Failed: ${fail}`);
if (fail === 0) {
  console.log('All usage & CI example tests passed!');
  process.exit(0);
} else {
  process.exit(1);
}
