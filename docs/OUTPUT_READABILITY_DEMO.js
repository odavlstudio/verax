/**
 * Output Readability Demo
 * 
 * Shows the unified CLI output flow from Stage 4 of DX BOOST
 */

const { printUnifiedOutput } = require('../src/guardian/output-readability');

// Mock TTY for demo
process.stdout.isTTY = true;

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║ OUTPUT READABILITY DEMO — Stage 4 of DX BOOST                ║
╚═══════════════════════════════════════════════════════════════╝

DX BOOST Stage 4 unifies all CLI output into a single, readable
narrative that flows naturally from top to bottom.

Canonical Output Order:
1) Header (URL, run ID, preset)
2) Execution Summary (planned, executed, skipped)
3) Verdict Block (from verdict-clarity)
4) Error Details (from error-clarity, if failures exist)
5) Final Recommendation (action + artifacts path)

`);

// Example 1: Clean READY verdict
console.log('─'.repeat(70));
console.log('EXAMPLE 1: Clean READY Verdict (All Tests Passed)');
console.log('─'.repeat(70));
console.log('');

printUnifiedOutput({
  meta: {
    url: 'https://shop.example.com',
    runId: 'run-2024-12-29-001'
  },
  coverage: {
    total: 8,
    executed: 8,
    skippedDisabledByPreset: [],
    skippedNotApplicable: [],
    skippedUserFiltered: [],
    skippedMissing: []
  },
  counts: { executedCount: 8 },
  verdict: {
    verdict: 'READY',
    explanation: 'All critical user flows completed successfully'
  },
  attemptResults: [
    { outcome: 'SUCCESS', attemptId: 'signup', attemptName: 'User Signup' },
    { outcome: 'SUCCESS', attemptId: 'login', attemptName: 'User Login' },
    { outcome: 'SUCCESS', attemptId: 'browse', attemptName: 'Browse Products' },
    { outcome: 'SUCCESS', attemptId: 'cart', attemptName: 'Add to Cart' },
    { outcome: 'SUCCESS', attemptId: 'checkout', attemptName: 'Checkout' },
    { outcome: 'SUCCESS', attemptId: 'payment', attemptName: 'Payment' },
    { outcome: 'SUCCESS', attemptId: 'confirmation', attemptName: 'Order Confirmation' },
    { outcome: 'SUCCESS', attemptId: 'account', attemptName: 'Account Management' }
  ],
  flowResults: [],
  exitCode: 0,
  runDir: 'artifacts/run-2024-12-29-001'
}, {}, []);

console.log('\n\n');

// Example 2: FRICTION verdict with failures
console.log('─'.repeat(70));
console.log('EXAMPLE 2: FRICTION Verdict (Some Failures, Some Skips)');
console.log('─'.repeat(70));
console.log('');

printUnifiedOutput({
  meta: {
    url: 'https://shop.example.com',
    runId: 'run-2024-12-29-002'
  },
  coverage: {
    total: 10,
    executed: 7,
    skippedDisabledByPreset: [],
    skippedNotApplicable: [{ attempt: 'admin-panel' }, { attempt: 'enterprise-features' }],
    skippedUserFiltered: [],
    skippedMissing: [{ attempt: 'export-data' }]
  },
  counts: { executedCount: 7 },
  verdict: {
    verdict: 'FRICTION',
    explanation: 'Critical failures detected in checkout flow'
  },
  attemptResults: [
    { outcome: 'SUCCESS', attemptId: 'signup', attemptName: 'User Signup' },
    { outcome: 'SUCCESS', attemptId: 'login', attemptName: 'User Login' },
    { outcome: 'SUCCESS', attemptId: 'browse', attemptName: 'Browse Products' },
    { outcome: 'FAILURE', attemptId: 'cart', attemptName: 'Add to Cart', failureReason: 'ELEMENT_NOT_FOUND', message: 'Cart button not found' },
    { outcome: 'FAILURE', attemptId: 'checkout', attemptName: 'Checkout', failureReason: 'TIMEOUT', message: 'Checkout page load timeout' },
    { outcome: 'FAILURE', attemptId: 'payment', attemptName: 'Payment', failureReason: 'TIMEOUT', message: 'Payment form timeout' },
    { outcome: 'SUCCESS', attemptId: 'account', attemptName: 'Account Management' },
    { outcome: 'SKIPPED', attemptId: 'admin', attemptName: 'Admin Panel', outcome: 'SKIPPED', reason: 'NOT_APPLICABLE' },
    { outcome: 'SKIPPED', attemptId: 'enterprise', attemptName: 'Enterprise Features', outcome: 'SKIPPED', reason: 'NOT_APPLICABLE' },
    { outcome: 'SKIPPED', attemptId: 'export', attemptName: 'Export Data', outcome: 'SKIPPED', reason: 'MISSING_DEPENDENCY' }
  ],
  flowResults: [],
  exitCode: 1,
  runDir: 'artifacts/run-2024-12-29-002'
}, { preset: 'saas' }, []);

console.log('\n\n');

// Example 3: DO_NOT_LAUNCH verdict
console.log('─'.repeat(70));
console.log('EXAMPLE 3: DO_NOT_LAUNCH Verdict (Critical Failures)');
console.log('─'.repeat(70));
console.log('');

printUnifiedOutput({
  meta: {
    url: 'https://shop.example.com',
    runId: 'run-2024-12-29-003'
  },
  coverage: {
    total: 6,
    executed: 6,
    skippedDisabledByPreset: [],
    skippedNotApplicable: [],
    skippedUserFiltered: [],
    skippedMissing: []
  },
  counts: { executedCount: 6 },
  verdict: {
    verdict: 'DO_NOT_LAUNCH',
    explanation: 'Multiple critical failures in core user flows'
  },
  attemptResults: [
    { outcome: 'FAILURE', attemptId: 'signup', attemptName: 'User Signup', failureReason: 'NAVIGATION_FAILED', message: 'Signup page unavailable' },
    { outcome: 'FAILURE', attemptId: 'login', attemptName: 'User Login', failureReason: 'AUTH_BLOCKED', message: 'Authentication service down' },
    { outcome: 'FAILURE', attemptId: 'browse', attemptName: 'Browse Products', failureReason: 'TIMEOUT', message: 'Product listing timeout' },
    { outcome: 'FAILURE', attemptId: 'cart', attemptName: 'Add to Cart', failureReason: 'INFRA_ERROR', message: 'Cart service error' },
    { outcome: 'FAILURE', attemptId: 'checkout', attemptName: 'Checkout', failureReason: 'ELEMENT_NOT_FOUND', message: 'Checkout form missing' },
    { outcome: 'FAILURE', attemptId: 'payment', attemptName: 'Payment', failureReason: 'NAVIGATION_FAILED', message: 'Payment gateway unreachable' }
  ],
  flowResults: [],
  exitCode: 2,
  runDir: 'artifacts/run-2024-12-29-003'
}, {}, []);

console.log('\n\n');

// Example 4: Quiet mode suppression
console.log('─'.repeat(70));
console.log('EXAMPLE 4: Quiet Mode (Output Suppressed)');
console.log('─'.repeat(70));
console.log('');
console.log('With --quiet flag, unified output is suppressed:');
console.log('');

printUnifiedOutput({
  meta: {
    url: 'https://shop.example.com',
    runId: 'run-2024-12-29-004'
  },
  coverage: { total: 5, executed: 5 },
  counts: { executedCount: 5 },
  verdict: { verdict: 'READY', explanation: 'All passed' },
  attemptResults: [],
  exitCode: 0,
  runDir: 'artifacts/run-2024-12-29-004'
}, {}, ['--quiet']);

console.log('(no output — suppressed by --quiet flag)');
console.log('');

// Summary
console.log('\n');
console.log('═'.repeat(70));
console.log('SUMMARY');
console.log('═'.repeat(70));
console.log(`
Output Readability Features:

✓ Canonical Output Flow
  - Header → Execution Summary → Verdict → Errors → Final Summary
  - Each section clearly labeled and separated
  - Natural top-to-bottom reading experience

✓ Noise Reduction
  - Removed low-value logs (completeness metrics, attestation hashes)
  - Removed duplicate information (verdict shown once in main block)
  - Focused on essential information only

✓ Visual Consistency
  - Consistent separator styles (━ for major, ─ for minor)
  - Predictable spacing and alignment
  - Professional CLI appearance

✓ Context-Aware Suppression
  - Respects --quiet and -q flags
  - Suppresses in CI/non-TTY environments
  - Maintains backward compatibility

✓ Composability
  - Reuses existing verdict-clarity module
  - Reuses existing error-clarity module
  - Minimal code duplication
  - Easy to maintain and extend

✓ Error Section Conditional Display
  - Only shows when failures/skips exist
  - Prevents empty sections
  - Clean output for successful runs
`);
