// Guardian Freeze Gate Runner
// Runs all freeze suites in order, fails fast, prints summary

const { spawnSync } = require('child_process');

const gates = [
  {
    name: 'CLI Output Freeze',
    command: 'npx',
    args: ['mocha', 'test/freeze/surface-freeze.test.js', '--reporter', 'json'],
    suite: 'test/freeze/surface-freeze.test.js'
  },
  {
    name: 'Scenario Freeze',
    command: 'npx',
    args: ['mocha', 'test/freeze/scenario-freeze.test.js', '--reporter', 'json'],
    suite: 'test/freeze/scenario-freeze.test.js'
  },
  {
    name: 'Regression Guard',
    command: 'npx',
    args: ['mocha', 'test/freeze/regression-guard.test.js', '--reporter', 'json'],
    suite: 'test/freeze/regression-guard.test.js'
  }
];

// eslint-disable-next-line consistent-return
function runGate(gate) {
  const start = Date.now();
  process.stdout.write(`Running ${gate.name}... `);
  const result = spawnSync(gate.command, gate.args, { stdio: 'pipe', encoding: 'utf-8', shell: true });
  const duration = ((Date.now() - start) / 1000).toFixed(2);
  // Check if output contains passing tests (handles both mocha and json output)
  const isPassing = result.status === 0 && (result.stdout.includes('passing') || result.stdout.includes('\"failures\":0'));
  if (isPassing || result.status === 0) {
    console.log(`✅ PASS (${duration}s)`);
    return { name: gate.name, status: 'PASS', duration };
  }
  console.log(`❌ FAIL (${duration}s)`);
  // Extract test names from json reporter output if available
  try {
    const json = JSON.parse(result.stdout);
    if (json.failures && json.failures.length > 0) {
      console.log('Failed tests:');
      json.failures.forEach(f => console.log(`  - ${f.fullTitle}`));
    }
  } catch (e) {
    // Fallback to raw output if not json
    if (result.stdout) process.stdout.write(result.stdout);
  }
  if (result.stderr) process.stderr.write(result.stderr);
  console.log(`\nFreeze Gate FAILED at: ${gate.name}`);
  process.exit(1);
}

function main() {
  console.log('Guardian Freeze Gate\n===================');
  const results = [];
  for (const gate of gates) {
    results.push(runGate(gate));
  }
  console.log('\nAll freeze gates PASSED. Guardian is fully sealed.');
  results.forEach(r => {
    console.log(`- ${r.name}: ${r.status} (${r.duration}s)`);
  });
}

if (require.main === module) {
  main();
}
