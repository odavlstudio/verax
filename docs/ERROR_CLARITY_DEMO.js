/**
 * Error Clarity Demo
 * 
 * Shows examples of error and failure messaging from Guardian CLI
 * Stage 3 of DX BOOST
 */

const { formatErrorClarity } = require('../src/guardian/error-clarity');

// Mock TTY for demo
process.stdout.isTTY = true;

console.log(`
╔════════════════════════════════════════════════════════════════╗
║ ERROR CLARITY DEMO — Stage 3 of DX BOOST                      ║
╚════════════════════════════════════════════════════════════════╝

DX BOOST Stage 3 provides human-friendly error and failure messaging,
helping developers understand what went wrong and how to fix it.

`);

// Example 1: Timeout error
console.log('─'.repeat(70));
console.log('EXAMPLE 1: Timeout Error');
console.log('─'.repeat(70));
console.log('');

const timeoutFailures = [
  {
    attemptId: 'checkout-flow',
    attemptName: 'Complete Checkout Flow',
    outcome: 'FAILURE',
    failureReason: 'TIMEOUT',
    message: 'Timeout waiting for payment button'
  }
];

console.log(formatErrorClarity(timeoutFailures, {}, []));
console.log('');

// Example 2: Element not found error
console.log('');
console.log('─'.repeat(70));
console.log('EXAMPLE 2: Element Not Found');
console.log('─'.repeat(70));
console.log('');

const elementFailures = [
  {
    attemptId: 'signup',
    attemptName: 'User Signup',
    outcome: 'FAILURE',
    failureReason: 'ELEMENT_NOT_FOUND',
    message: 'Could not find submit button'
  }
];

console.log(formatErrorClarity(elementFailures, {}, []));
console.log('');

// Example 3: Navigation error
console.log('');
console.log('─'.repeat(70));
console.log('EXAMPLE 3: Navigation Failed');
console.log('─'.repeat(70));
console.log('');

const navigationFailures = [
  {
    attemptId: 'home-to-products',
    attemptName: 'Navigate to Products',
    outcome: 'FAILURE',
    failureReason: 'NAVIGATION_FAILED',
    message: 'net::ERR_CONNECTION_REFUSED'
  }
];

console.log(formatErrorClarity(navigationFailures, {}, []));
console.log('');

// Example 4: Auth blocked
console.log('');
console.log('─'.repeat(70));
console.log('EXAMPLE 4: Authentication Blocked');
console.log('─'.repeat(70));
console.log('');

const authFailures = [
  {
    attemptId: 'admin-panel',
    attemptName: 'Access Admin Panel',
    outcome: 'FAILURE',
    failureReason: 'AUTH_BLOCKED',
    message: 'HTTP 401 Unauthorized',
    code: 401
  }
];

console.log(formatErrorClarity(authFailures, {}, []));
console.log('');

// Example 5: Mixed errors and skips
console.log('');
console.log('─'.repeat(70));
console.log('EXAMPLE 5: Mixed Errors and Skipped Attempts');
console.log('─'.repeat(70));
console.log('');

const mixedFailures = [
  {
    attemptId: 'signup',
    attemptName: 'User Signup',
    outcome: 'FAILURE',
    failureReason: 'TIMEOUT',
    message: 'Timeout waiting for form submission'
  },
  {
    attemptId: 'payment',
    attemptName: 'Payment Processing',
    outcome: 'FAILURE',
    failureReason: 'ELEMENT_NOT_FOUND',
    message: 'Payment form not loaded'
  },
  {
    attemptId: 'admin-verify',
    attemptName: 'Admin Verification',
    outcome: 'SKIPPED',
    reason: 'NOT_APPLICABLE',
    message: 'Not applicable to this environment'
  },
  {
    attemptId: 'export-data',
    attemptName: 'Export Data',
    outcome: 'SKIPPED',
    reason: 'DISABLED_BY_PRESET',
    message: 'Disabled by test preset'
  }
];

console.log(formatErrorClarity(mixedFailures, {}, []));
console.log('');

// Example 6: Multiple errors of same type (deduplication)
console.log('');
console.log('─'.repeat(70));
console.log('EXAMPLE 6: Multiple Timeouts (Deduplication)');
console.log('─'.repeat(70));
console.log('');
console.log('(Showing max 3 examples, +1 more):');
console.log('');

const multiTimeoutFailures = [
  {
    attemptId: 'checkout-step1',
    attemptName: 'Checkout Step 1',
    outcome: 'FAILURE',
    failureReason: 'TIMEOUT'
  },
  {
    attemptId: 'checkout-step2',
    attemptName: 'Checkout Step 2',
    outcome: 'FAILURE',
    failureReason: 'TIMEOUT'
  },
  {
    attemptId: 'checkout-step3',
    attemptName: 'Checkout Step 3',
    outcome: 'FAILURE',
    failureReason: 'TIMEOUT'
  },
  {
    attemptId: 'checkout-step4',
    attemptName: 'Checkout Step 4',
    outcome: 'FAILURE',
    failureReason: 'TIMEOUT'
  }
];

console.log(formatErrorClarity(multiTimeoutFailures, {}, []));
console.log('');

// Example 7: Quiet mode suppression
console.log('');
console.log('─'.repeat(70));
console.log('EXAMPLE 7: Quiet Mode (Suppressed)');
console.log('─'.repeat(70));
console.log('');
console.log('With --quiet flag, error clarity is suppressed for non-interactive use:');
console.log('');

const quietOutput = formatErrorClarity(timeoutFailures, {}, ['--quiet']);
if (quietOutput === '') {
  console.log('(no output — suppressed by --quiet)');
} else {
  console.log(quietOutput);
}
console.log('');

// Example 8: CI mode suppression (non-TTY)
console.log('');
console.log('─'.repeat(70));
console.log('EXAMPLE 8: CI Mode (Non-TTY, Suppressed)');
console.log('─'.repeat(70));
console.log('');
console.log('In non-interactive environments (CI, logging), error clarity is suppressed:');
console.log('');

process.stdout.isTTY = false;
const ciOutput = formatErrorClarity(timeoutFailures, {}, []);
process.stdout.isTTY = true;

if (ciOutput === '') {
  console.log('(no output — suppressed in non-TTY environment)');
} else {
  console.log(ciOutput);
}
console.log('');

// Summary
console.log('');
console.log('═'.repeat(70));
console.log('SUMMARY');
console.log('═'.repeat(70));
console.log(`
Error Clarity Features:

✓ Human-friendly error classification (10 categories)
  - Timeouts, element not found, navigation, auth blocked
  - Infrastructure, missing dependencies, and more

✓ Clear skip reason labeling
  - Separates actual errors from skipped attempts
  - Explains why attempts were skipped

✓ Intelligent deduplication
  - Shows max 3 examples per error category
  - Indicates if there are more examples

✓ Context-aware suppression
  - Skips in quiet mode (--quiet, -q)
  - Skips in CI environments (non-TTY)
  - Preserves output for interactive terminals

✓ Production-ready design
  - Professional tone, no emojis
  - Clean formatting with visual separators
  - Focus on actionable information
`);
