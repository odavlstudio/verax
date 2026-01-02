const assert = require('assert');
const { calculateCoverage } = require('../src/guardian/reality');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Coverage Math Tests');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

function makeStats({ enabledPlannedCount, executed }) {
  return {
    enabledPlannedCount,
    executed,
    skippedDetails: [],
    disabledDetails: [],
    disabledPlannedCount: 0
  };
}

// Not-applicable attempts should be excluded from denominator
(() => {
  const attemptStats = makeStats({ enabledPlannedCount: 6, executed: 2 });
  const skippedNotApplicable = [
    { attemptId: 'checkout', skipReason: 'human intent mismatch' },
    { attemptId: 'signup', skipReason: 'human intent mismatch' },
    { attemptId: 'login', skipReason: 'human intent mismatch' },
    { attemptId: 'newsletter_signup', skipReason: 'human intent mismatch' }
  ];

  const { coverage, denominator, numerator } = calculateCoverage({
    attemptStats,
    skippedNotApplicable,
    skippedMissing: [],
    skippedUserFiltered: [],
    skippedDisabledByPreset: []
  });

  assert.strictEqual(coverage.total, 2, 'Denominator should drop not-applicable attempts');
  assert.strictEqual(coverage.executed, 2, 'Executed attempts should remain numerator');
  assert.strictEqual(coverage.gaps, 0, 'No gaps when all relevant attempts executed');
  assert.strictEqual(coverage.counts.excludedNotApplicableFromTotal, 4, 'Track excluded not-applicable attempts');
  assert.strictEqual(denominator, 2, 'Denominator should match coverage total');
  assert.strictEqual(numerator, 2, 'Numerator should only count executed attempts');
  console.log('✅ Not-applicable attempts are excluded from coverage denominator');
})();

// User-filtered attempts should still reduce denominator alongside not-applicable ones
(() => {
  const attemptStats = makeStats({ enabledPlannedCount: 4, executed: 1 });
  const skippedNotApplicable = [{ attemptId: 'checkout', skipReason: 'human intent mismatch' }];
  const skippedUserFiltered = [{ attemptId: 'contact_form', skipReason: 'Filtered by --attempts' }];

  const { coverage, denominator, numerator } = calculateCoverage({
    attemptStats,
    skippedNotApplicable,
    skippedMissing: [],
    skippedUserFiltered,
    skippedDisabledByPreset: []
  });

  assert.strictEqual(coverage.total, 2, 'Denominator should exclude user-filtered and not-applicable attempts');
  assert.strictEqual(coverage.gaps, 1, 'One relevant attempt unexecuted should be a gap');
  assert.strictEqual(denominator, 2, 'Denominator should reflect filtered scope');
  assert.strictEqual(numerator, 1, 'Numerator should only count executed attempts');
  const completeness = denominator > 0 ? numerator / denominator : 0;
  assert.strictEqual(completeness, 0.5, 'Completeness aligns with adjusted denominator');
  console.log('✅ Coverage handles user-filtered and not-applicable correctly');
})();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ All coverage math tests passed!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

process.exit(0);
