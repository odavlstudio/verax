/**
 * Confidence Signals Demo
 * Stage 5 of DX BOOST
 * 
 * Demonstrates how Guardian communicates confidence levels
 * and openly states what it could not verify.
 */

const { printConfidenceSignals, calculateConfidence, formatConfidenceBlock } = require('../src/guardian/confidence-signals');

console.log('┌──────────────────────────────────────────────────────────────────────┐');
console.log('│ CONFIDENCE SIGNALS DEMO — Stage 5 of DX BOOST                        │');
console.log('└──────────────────────────────────────────────────────────────────────┘');
console.log('');
console.log('Guardian now transparently communicates:');
console.log('- How confident it is in the verdict');
console.log('- Why confidence is at that level');
console.log('- What Guardian could NOT verify');
console.log('');
console.log('This builds trust without promoting overconfidence.');
console.log('');

// ============================================================================
// EXAMPLE 1: HIGH Confidence with READY Verdict
// ============================================================================

console.log('═'.repeat(70));
console.log('EXAMPLE 1: HIGH Confidence (Full Coverage, No Issues)');
console.log('═'.repeat(70));
console.log('');

const example1 = {
  coverage: {
    total: 8,
    executed: 8,
    skippedMissing: [],
    skippedNotApplicable: [],
    skippedDisabledByPreset: [],
    skippedUserFiltered: []
  },
  counts: { executedCount: 8 },
  attemptResults: [
    { outcome: 'SUCCESS', name: 'homepage-load' },
    { outcome: 'SUCCESS', name: 'product-view' },
    { outcome: 'SUCCESS', name: 'cart-add' },
    { outcome: 'SUCCESS', name: 'checkout-start' },
    { outcome: 'SUCCESS', name: 'payment-form' },
    { outcome: 'SUCCESS', name: 'order-confirm' },
    { outcome: 'SUCCESS', name: 'search' },
    { outcome: 'SUCCESS', name: 'navigation' }
  ],
  flowResults: [],
  verdict: { verdict: 'READY' }
};

printConfidenceSignals(example1, {}, []);

// ============================================================================
// EXAMPLE 2: MEDIUM Confidence with READY Verdict
// ============================================================================

console.log('═'.repeat(70));
console.log('EXAMPLE 2: MEDIUM Confidence (Partial Coverage, Some Skips)');
console.log('═'.repeat(70));
console.log('');

const example2 = {
  coverage: {
    total: 12,
    executed: 8,
    skippedMissing: ['login', 'signup'],
    skippedNotApplicable: ['admin-panel'],
    skippedDisabledByPreset: [],
    skippedUserFiltered: []
  },
  counts: { executedCount: 8 },
  attemptResults: [
    { outcome: 'SUCCESS', name: 'homepage-load' },
    { outcome: 'SUCCESS', name: 'product-view' },
    { outcome: 'SUCCESS', name: 'cart-add' },
    { outcome: 'SUCCESS', name: 'checkout-guest' },
    { outcome: 'SUCCESS', name: 'payment-form' },
    { outcome: 'SUCCESS', name: 'order-confirm' },
    { outcome: 'SUCCESS', name: 'search' },
    { outcome: 'SUCCESS', name: 'navigation' }
  ],
  flowResults: [],
  verdict: { verdict: 'READY' }
};

printConfidenceSignals(example2, {}, []);

// ============================================================================
// EXAMPLE 3: LOW Confidence with READY Verdict
// ============================================================================

console.log('═'.repeat(70));
console.log('EXAMPLE 3: LOW Confidence (Major Coverage Gaps)');
console.log('═'.repeat(70));
console.log('');

const example3 = {
  coverage: {
    total: 15,
    executed: 5,
    skippedMissing: ['checkout', 'payment', 'cart', 'login', 'signup'],
    skippedNotApplicable: ['admin-panel', 'dashboard'],
    skippedDisabledByPreset: [],
    skippedUserFiltered: []
  },
  counts: { executedCount: 5 },
  attemptResults: [
    { outcome: 'SUCCESS', name: 'homepage-load' },
    { outcome: 'SUCCESS', name: 'product-view' },
    { outcome: 'SUCCESS', name: 'search' },
    { outcome: 'SUCCESS', name: 'navigation' },
    { outcome: 'SUCCESS', name: 'footer-links' }
  ],
  flowResults: [],
  verdict: { verdict: 'READY' }
};

printConfidenceSignals(example3, {}, []);

// ============================================================================
// EXAMPLE 4: MEDIUM Confidence with FRICTION Verdict
// ============================================================================

console.log('═'.repeat(70));
console.log('EXAMPLE 4: MEDIUM Confidence with FRICTION (Issues + Infra Errors)');
console.log('═'.repeat(70));
console.log('');

const example4 = {
  coverage: {
    total: 10,
    executed: 9,
    skippedMissing: [],
    skippedNotApplicable: [],
    skippedDisabledByPreset: [],
    skippedUserFiltered: []
  },
  counts: { executedCount: 9 },
  attemptResults: [
    { outcome: 'SUCCESS', name: 'homepage-load' },
    { outcome: 'SUCCESS', name: 'product-view' },
    { outcome: 'SUCCESS', name: 'cart-add' },
    { outcome: 'FAILURE', name: 'checkout-start', error: 'timeout after 30s', classification: { category: 'infrastructure' } },
    { outcome: 'SUCCESS', name: 'payment-form' },
    { outcome: 'FAILURE', name: 'order-confirm', error: 'Button not clickable' },
    { outcome: 'SUCCESS', name: 'search' },
    { outcome: 'SUCCESS', name: 'navigation' },
    { outcome: 'SUCCESS', name: 'footer-links' }
  ],
  flowResults: [],
  verdict: { verdict: 'FRICTION' }
};

printConfidenceSignals(example4, {}, []);

// ============================================================================
// EXAMPLE 5: LOW Confidence with DO_NOT_LAUNCH Verdict
// ============================================================================

console.log('═'.repeat(70));
console.log('EXAMPLE 5: LOW Confidence with DO_NOT_LAUNCH (Critical Failures)');
console.log('═'.repeat(70));
console.log('');

const example5 = {
  coverage: {
    total: 10,
    executed: 8,
    skippedMissing: ['admin-panel'],
    skippedNotApplicable: [],
    skippedDisabledByPreset: [],
    skippedUserFiltered: []
  },
  counts: { executedCount: 8 },
  attemptResults: [
    { outcome: 'SUCCESS', name: 'homepage-load' },
    { outcome: 'SUCCESS', name: 'product-view' },
    { outcome: 'SUCCESS', name: 'cart-add' },
    { 
      outcome: 'FAILURE', 
      name: 'checkout-start', 
      error: 'Payment gateway unreachable',
      classification: { severity: 'critical', category: 'functional' }
    },
    { 
      outcome: 'FAILURE', 
      name: 'payment-form', 
      error: 'Form validation broken',
      classification: { severity: 'critical', category: 'functional' }
    },
    { outcome: 'SUCCESS', name: 'search' },
    { outcome: 'SUCCESS', name: 'navigation' },
    { outcome: 'SUCCESS', name: 'footer-links' }
  ],
  flowResults: [],
  verdict: { verdict: 'DO_NOT_LAUNCH' }
};

printConfidenceSignals(example5, {}, []);

// ============================================================================
// EXAMPLE 6: HIGH Confidence with FRICTION Verdict
// ============================================================================

console.log('═'.repeat(70));
console.log('EXAMPLE 6: HIGH Confidence with FRICTION (Issues Clearly Identified)');
console.log('═'.repeat(70));
console.log('');

const example6 = {
  coverage: {
    total: 10,
    executed: 10,
    skippedMissing: [],
    skippedNotApplicable: [],
    skippedDisabledByPreset: [],
    skippedUserFiltered: []
  },
  counts: { executedCount: 10 },
  attemptResults: [
    { outcome: 'SUCCESS', name: 'homepage-load' },
    { outcome: 'SUCCESS', name: 'product-view' },
    { outcome: 'SUCCESS', name: 'cart-add' },
    { outcome: 'SUCCESS', name: 'checkout-start' },
    { outcome: 'SUCCESS', name: 'payment-form' },
    { outcome: 'FAILURE', name: 'order-confirm', error: 'Submit button disabled' },
    { outcome: 'SUCCESS', name: 'search' },
    { outcome: 'SUCCESS', name: 'navigation' },
    { outcome: 'SUCCESS', name: 'footer-links' },
    { outcome: 'SUCCESS', name: 'contact-form' }
  ],
  flowResults: [],
  verdict: { verdict: 'FRICTION' }
};

printConfidenceSignals(example6, {}, []);

// ============================================================================
// EXAMPLE 7: Quiet Mode Suppression
// ============================================================================

console.log('═'.repeat(70));
console.log('EXAMPLE 7: Quiet Mode (Confidence Signals Suppressed)');
console.log('═'.repeat(70));
console.log('');
console.log('When --quiet is enabled, confidence signals are NOT shown:');
console.log('');

const example7 = {
  coverage: { total: 10, executed: 10 },
  counts: { executedCount: 10 },
  attemptResults: Array(10).fill({ outcome: 'SUCCESS' }),
  verdict: { verdict: 'READY' }
};

console.log('Calling printConfidenceSignals() with --quiet flag...');
printConfidenceSignals(example7, {}, ['--quiet']);
console.log('(No output above because quiet mode suppresses confidence signals)');
console.log('');

// ============================================================================
// SUMMARY
// ============================================================================

console.log('═'.repeat(70));
console.log('CONFIDENCE SIGNALS — KEY FEATURES');
console.log('═'.repeat(70));
console.log('');
console.log('✓ THREE CONFIDENCE LEVELS:');
console.log('  • HIGH:   Comprehensive coverage, stable execution');
console.log('  • MEDIUM: Partial coverage or minor stability issues');
console.log('  • LOW:    Major gaps, critical failures, or instability');
console.log('');
console.log('✓ VERDICT-AWARE TONE:');
console.log('  • READY + HIGH:          Confident but measured');
console.log('  • READY + MEDIUM/LOW:    Cautious optimism');
console.log('  • FRICTION/DO_NOT_LAUNCH: Firm and protective');
console.log('');
console.log('✓ TRANSPARENT LIMITS:');
console.log('  • Openly states what Guardian could NOT verify');
console.log('  • Distinguishes between missing tests and not-applicable flows');
console.log('  • Lists skip reasons (disabled, filtered, missing elements)');
console.log('');
console.log('✓ DERIVED FROM EXISTING DATA:');
console.log('  • Coverage ratio (executed vs planned)');
console.log('  • Critical flow gaps (missing vs not applicable)');
console.log('  • Infrastructure stability (timeouts, network errors)');
console.log('  • Failure severity (critical vs minor)');
console.log('');
console.log('✓ SKIP CONDITIONS:');
console.log('  • Suppressed in --quiet mode');
console.log('  • Suppressed in CI/non-TTY environments');
console.log('  • Respects machine-readable output modes');
console.log('');
console.log('═'.repeat(70));
console.log('');
console.log('Stage 5 complete. Guardian now builds trust through transparency.');
console.log('');
