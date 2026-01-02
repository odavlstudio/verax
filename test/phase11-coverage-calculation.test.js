/**
 * Phase 11: Coverage Calculation Unit Test
 * 
 * Verifies that coverage calculation correctly excludes:
 * - NOT_APPLICABLE (non-observed capabilities)
 * - USER_FILTERED (user explicitly filtered)
 * - SKIPPED (auto-skipped by site intelligence)
 */

const assert = require('assert');
const { buildHonestyContract } = require('../src/guardian/honesty');

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  PHASE 11: COVERAGE CALCULATION UNIT TEST                      ║');
console.log('║  Verifies NOT_APPLICABLE/USER_FILTERED/SKIPPED excluded        ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Test scenario: Mixed attempt outcomes
const attemptResults = [
  // Executed successfully
  { attemptId: 'primary_ctas', outcome: 'SUCCESS', executed: true, disabledByPreset: false },
  { attemptId: 'site_smoke', outcome: 'SUCCESS', executed: true, disabledByPreset: false },
  
  // Not executed but relevant
  { attemptId: 'contact_form', outcome: 'NOT_EXECUTED', executed: false, disabledByPreset: false },
  
  // NOT_APPLICABLE (non-observed capabilities)
  { attemptId: 'newsletter_signup', outcome: 'NOT_APPLICABLE', executed: false, disabledByPreset: false, skipReasonCode: 'NOT_APPLICABLE' },
  
  // USER_FILTERED (user explicitly excluded)
  { attemptId: 'language_switch', outcome: 'SKIPPED', executed: false, disabledByPreset: false, skipReasonCode: 'USER_FILTERED' },
  
  // SKIPPED (auto-skipped by site intelligence)
  { attemptId: 'login', outcome: 'SKIPPED', executed: false, disabledByPreset: false, skipReasonCode: 'AUTO_SKIP' },
  { attemptId: 'signup', outcome: 'SKIPPED', executed: false, disabledByPreset: false, skipReasonCode: 'AUTO_SKIP' },
  { attemptId: 'checkout', outcome: 'SKIPPED', executed: false, disabledByPreset: false, skipReasonCode: 'AUTO_SKIP' },
  
  // Disabled by preset
  { attemptId: 'some_disabled', outcome: 'SKIPPED', executed: false, disabledByPreset: true }
];

console.log('📊 Input: Mixed attempt outcomes');
console.log('   - SUCCESS: 2 (primary_ctas, site_smoke)');
console.log('   - NOT_EXECUTED: 1 (contact_form)');
console.log('   - NOT_APPLICABLE: 1 (newsletter_signup)');
console.log('   - USER_FILTERED: 1 (language_switch)');
console.log('   - AUTO_SKIP: 3 (login, signup, checkout)');
console.log('   - DISABLED_BY_PRESET: 1 (some_disabled)');
console.log('   Total attempts: 9\n');

const execution = {
  attemptResults,
  flowResults: [],
  requestedAttempts: ['primary_ctas', 'site_smoke', 'contact_form', 'newsletter_signup', 'language_switch', 'login', 'signup', 'checkout', 'some_disabled'],
  enabledAttempts: ['primary_ctas', 'site_smoke', 'contact_form'],
  totalPossibleAttempts: 9,
  crawlData: {},
  coverageSignal: {},
  triggeredRuleIds: []
};

console.log('🔨 Building honesty contract...\n');
const honestyContract = buildHonestyContract(execution);

console.log('📈 Coverage Stats:');
console.log(`   Total relevant: ${honestyContract.coverageStats.total}`);
console.log(`   Executed: ${honestyContract.coverageStats.executed}`);
console.log(`   Coverage: ${honestyContract.coverageStats.percent}%`);
console.log(`   Skipped: ${honestyContract.coverageStats.skipped}`);
console.log(`   Disabled: ${honestyContract.coverageStats.disabled}\n`);

// CRITICAL ASSERTIONS

console.log('🧪 Running assertions...\n');

// Assertion 1: Total relevant should be 3 (primary_ctas, site_smoke, contact_form)
// Excludes: NOT_APPLICABLE (1) + USER_FILTERED (1) + AUTO_SKIP (3) + DISABLED (1) = 6 excluded
assert.strictEqual(
  honestyContract.coverageStats.total,
  3,
  `Total relevant MUST be 3 (SUCCESS + NOT_EXECUTED), got ${honestyContract.coverageStats.total}`
);
console.log('✅ Assertion 1: Total relevant = 3 (excludes NOT_APPLICABLE, USER_FILTERED, SKIPPED, DISABLED)');

// Assertion 2: Executed should be 2 (primary_ctas, site_smoke)
assert.strictEqual(
  honestyContract.coverageStats.executed,
  2,
  `Executed MUST be 2 (SUCCESS attempts), got ${honestyContract.coverageStats.executed}`
);
console.log('✅ Assertion 2: Executed = 2 (SUCCESS outcomes)');

// Assertion 3: Coverage should be 67% (2/3)
const expectedPercent = Math.round((2 / 3) * 100);
assert.strictEqual(
  honestyContract.coverageStats.percent,
  expectedPercent,
  `Coverage MUST be ${expectedPercent}% (2/3), got ${honestyContract.coverageStats.percent}%`
);
console.log(`✅ Assertion 3: Coverage = ${expectedPercent}% (2 executed / 3 total relevant)`);

// Assertion 4: Verify NOT_APPLICABLE is in untested scope
const untestedScope = honestyContract.untestedScope || [];
const hasNotApplicable = untestedScope.some(s => 
  s.includes('newsletter_signup') && s.includes('n/a')
);
assert.strictEqual(
  hasNotApplicable,
  true,
  'NOT_APPLICABLE attempts MUST be in untestedScope as "n/a:"'
);
console.log('✅ Assertion 4: NOT_APPLICABLE attempts in untestedScope (not counted in coverage)');

// Assertion 5: Verify SKIPPED attempts are in untested scope
const hasSkipped = untestedScope.some(s => 
  (s.includes('login') || s.includes('signup') || s.includes('checkout')) && 
  s.includes('skipped')
);
assert.strictEqual(
  hasSkipped,
  true,
  'SKIPPED attempts MUST be in untestedScope'
);
console.log('✅ Assertion 5: SKIPPED attempts in untestedScope (not counted in coverage)');

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  ✅ ALL ASSERTIONS PASSED                                       ║');
console.log('║  Coverage calculation correctly excludes irrelevant attempts   ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

process.exit(0);
