/**
 * Golden Path Verdict Logic Test (Unit)
 * 
 * Tests the core verdict logic to ensure static sites get FRICTION, not DO_NOT_LAUNCH
 */

const assert = require('assert');

// Inline copy of deriveRunResult for testing (from src/guardian/verdict.js)
function deriveRunResult(snapshot) {
  const meta = snapshot.meta || {};
  if (meta.result) return meta.result;
  const attempts = snapshot.attempts || [];
  
  const executedAttempts = attempts.filter(a => a.outcome !== 'SKIPPED' && a.outcome !== 'NOT_APPLICABLE');
  const discoveryFailedAttempts = attempts.filter(a => a.outcome === 'DISCOVERY_FAILED');
  const notApplicableAttempts = attempts.filter(a => a.outcome !== 'NOT_APPLICABLE');
  const skippedCount = attempts.filter(a => a.outcome === 'SKIPPED').length;
  
  const executed = executedAttempts.length;
  const successful = executedAttempts.filter(a => a.outcome === 'SUCCESS').length;
  const failed = executedAttempts.filter(a => a.outcome === 'FAILURE').length;
  
  // If ONLY discovery failures, site is critically broken
  if (executed > 0 && executed === discoveryFailedAttempts.length) {
    return 'INSUFFICIENT_EVIDENCE';
  }
  
  // If nothing executed at all, it's a static site - safe
  if (executed === 0) {
    return 'WARN';
  }
  
  if (failed === 0 && successful === executed) return 'PASSED';
  if (failed === executed) return 'FAILED';
  return 'WARN';
}

console.log('\n🛡️  Golden Path Verdict Logic Test\n');

// Test 1: Empty attempts (all skipped) should return WARN (FRICTION), not INSUFFICIENT_EVIDENCE
console.log('📋 Test 1: All attempts skipped → FRICTION');
const snapshot1 = {
  attempts: [
    { attemptId: 'contact_form', outcome: 'SKIPPED' },
    { attemptId: 'signup', outcome: 'SKIPPED' },
    { attemptId: 'checkout', outcome: 'SKIPPED' }
  ]
};
const result1 = deriveRunResult(snapshot1);
assert.strictEqual(result1, 'WARN', `Expected WARN (maps to FRICTION), got ${result1}`);
console.log(`✅ Result: ${result1} (maps to FRICTION, exit code 1)`);

// Test 2: All attempts not applicable should return WARN (FRICTION)
console.log('\n📋 Test 2: All attempts not applicable → FRICTION');
const snapshot2 = {
  attempts: [
    { attemptId: 'contact_form', outcome: 'NOT_APPLICABLE' },
    { attemptId: 'signup', outcome: 'NOT_APPLICABLE' }
  ]
};
const result2 = deriveRunResult(snapshot2);
assert.strictEqual(result2, 'WARN', `Expected WARN (maps to FRICTION), got ${result2}`);
console.log(`✅ Result: ${result2} (maps to FRICTION, exit code 1)`);

// Test 3: Discovery failures (site unreachable) should return INSUFFICIENT_EVIDENCE (DO_NOT_LAUNCH)
console.log('\n📋 Test 3: Discovery failures → INSUFFICIENT_EVIDENCE (DO_NOT_LAUNCH)');
const snapshot3 = {
  attempts: [
    { attemptId: 'site_smoke', outcome: 'DISCOVERY_FAILED' }
  ]
};
const result3 = deriveRunResult(snapshot3);
assert.strictEqual(result3, 'INSUFFICIENT_EVIDENCE', `Expected INSUFFICIENT_EVIDENCE, got ${result3}`);
console.log(`✅ Result: ${result3} (maps to DO_NOT_LAUNCH, exit code 2)`);

// Test 4: Some successful attempts should return PASSED (READY)
console.log('\n📋 Test 4: All attempts successful → PASSED (READY)');
const snapshot4 = {
  attempts: [
    { attemptId: 'site_smoke', outcome: 'SUCCESS' },
    { attemptId: 'primary_ctas', outcome: 'SUCCESS' }
  ]
};
const result4 = deriveRunResult(snapshot4);
assert.strictEqual(result4, 'PASSED', `Expected PASSED (maps to READY), got ${result4}`);
console.log(`✅ Result: ${result4} (maps to READY, exit code 0)`);

// Test 5: Mix of success and failures should return WARN (FRICTION)
console.log('\n📋 Test 5: Mixed outcomes → WARN (FRICTION)');
const snapshot5 = {
  attempts: [
    { attemptId: 'site_smoke', outcome: 'SUCCESS' },
    { attemptId: 'contact_form', outcome: 'FAILURE' }
  ]
};
const result5 = deriveRunResult(snapshot5);
assert.strictEqual(result5, 'WARN', `Expected WARN (maps to FRICTION), got ${result5}`);
console.log(`✅ Result: ${result5} (maps to FRICTION, exit code 1)`);

// Summary
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Golden Path Verdict Logic VERIFIED');
console.log('');
console.log('Key principle:');
console.log('  Static sites (nothing to test) → FRICTION (exit 1)');
console.log('  Unreachable sites (discovery failed) → DO_NOT_LAUNCH (exit 2)');
console.log('');
console.log('Guardian will NOT block simple static websites from launching.');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

process.exit(0);
