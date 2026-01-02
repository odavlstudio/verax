const assert = require('assert');
const { mergeCoveragePack, COVERAGE_PACKS } = require('../src/guardian/coverage-packs');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Coverage Pack Tests');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// SaaS profile should add SaaS-aligned attempts and respect disabled presets
(() => {
  const disabledByPreset = new Set(['signup']);
  const { attempts, added } = mergeCoveragePack([], 'saas', { disabledByPreset });

  const expected = COVERAGE_PACKS.saas.filter(a => !disabledByPreset.has(a));
  expected.forEach(id => {
    assert(attempts.includes(id), `Attempt ${id} should be enabled for saas coverage pack`);
  });
  assert.strictEqual(added.length, expected.length, 'Added attempts should match enabled pack size');
  assert(!attempts.includes('signup'), 'Disabled attempt should not be re-enabled by pack');
  console.log('✅ SaaS coverage pack applied with disabled attempts respected');
})();

// Unknown profile should not change attempt list
(() => {
  const initial = ['site_smoke'];
  const { attempts, added } = mergeCoveragePack(initial, 'unknown');
  assert.deepStrictEqual(attempts, initial, 'Unknown profile should not mutate attempts');
  assert.strictEqual(added.length, 0, 'Unknown profile should not add attempts');
  console.log('✅ Unknown profile leaves attempts unchanged');
})();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ All coverage pack tests passed!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

process.exit(0);
