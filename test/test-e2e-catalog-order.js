#!/usr/bin/env node

/**
 * E2E Test: Verify causes are ordered by catalog order (C1..C7)
 */

import { buildFindingsReport } from '../src/verax/detect/findings-writer.js';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';


// Create finding that matches multiple causes in different orders
const finding = {
  id: 'finding_multi_cause',
  type: 'silent_failure',
  promise: { kind: 'click', value: 'Button' },
  source: { file: 'Test.jsx', line: 1 },
  what_happened: 'User action',
  what_was_expected: 'Observable change',
  what_was_observed: 'No change',
  why_it_matters: 'User received no feedback',
  confidence: 0.5,
  impact: 'MEDIUM',
  // Evidence that triggers C2, C3, and C7 simultaneously
  evidence: {
    stateMutation: true,        // C2
    domChanged: false,          // C2, C3
    navigationOccurred: false,  // C2, C3
    uiFeedback: false,          // C2, C3, C7
    interactionPerformed: true, // C3
    networkActivity: false,     // C3
    userFeedback: false,        // C3
    networkFailure: true,       // C7
    httpError: true             // C7
  }
};

const {report} = buildFindingsReport({
  url: 'https://example.com/test',
  findings: [finding],
  coverageGaps: [],
  detectedAt: getTimeProvider().iso()
});

const causeIds = report.findings[0].causes.map(c => c.id);
console.log('Causes detected:', causeIds);
console.log('Expected order: C2, C3, C7');
console.log('Actual order:  ', causeIds.join(', '));

// Verify catalog order
const catalogOrder = ['C1_SELECTOR_MISMATCH', 'C2_STATE_MUTATION_NO_UI', 'C3_DEAD_CLICK', 'C4_NAVIGATION_NO_RENDER', 'C5_FORM_NO_FEEDBACK', 'C6_VALIDATION_NOT_SHOWN', 'C7_NETWORK_SILENT'];
const indices = causeIds.map(id => catalogOrder.indexOf(id));

let isOrdered = true;
for (let i = 1; i < indices.length; i++) {
  if (indices[i] <= indices[i-1]) {
    isOrdered = false;
    break;
  }
}

console.log('\n✓ Causes in catalog order:', isOrdered ? 'YES' : 'NO');
if (isOrdered) {
  console.log('✓ CATALOG ORDER VERIFICATION PASSED');
} else {
  console.log('✗ CATALOG ORDER VERIFICATION FAILED');
  process.exit(1);
}

// Show the causes
console.log('\nDetailed causes:');
report.findings[0].causes.forEach((cause, i) => {
  console.log(`\n${i+1}. ${cause.id}`);
  console.log(`   Title: ${cause.title}`);
  console.log(`   Confidence: ${cause.confidence}`);
});




