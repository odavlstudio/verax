const assert = require('assert');
const { spawnSync } = require('child_process');

function runCli(args) {
  return spawnSync(process.execPath, ['bin/guardian.js', ...args], {
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, CI: '1' }
  });
}

(function main() {
  console.log('\n🛡️  CLI Validation Tests');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Missing required flag
  const missingUrl = runCli(['reality', '--preset', 'startup']);
  assert.strictEqual(missingUrl.status, 3, 'Missing --url should exit 3');
  assert.ok(missingUrl.stderr.includes('CLI validation failed'), 'Should emit validation failure');
  assert.ok(missingUrl.stderr.includes('command=reality'), 'Should mention command');
  assert.ok(missingUrl.stderr.includes('flag=--url'), 'Should mention missing flag');

  // Flag provided without value
  const noValue = runCli(['reality', '--url']);
  assert.strictEqual(noValue.status, 3, 'Flag without value should exit 3');
  assert.ok(noValue.stderr.includes('requires a value'), 'Should explain missing value');

  // Invalid URL value
  const badUrl = runCli(['reality', '--url', 'not-a-url']);
  assert.strictEqual(badUrl.status, 3, 'Invalid URL should exit 3');
  assert.ok(badUrl.stderr.toLowerCase().includes('invalid url'), 'Should report invalid URL');

  console.log('✅ CLI validation failures are strict and predictable');
})();
