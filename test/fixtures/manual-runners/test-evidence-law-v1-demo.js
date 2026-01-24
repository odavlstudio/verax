/**
 * Evidence Law Contract v1 - Before/After Demo
 * 
 * Shows JSON structure before and after Evidence Law v1 enforcement
 */

import { enforceContractsOnFindings } from './src/verax/core/contracts/validators.js';
import { FINDING_STATUS, FINDING_TYPE } from './src/verax/core/contracts/index.js';

console.log('=== Evidence Law v1: Before/After Demo ===\n');

// Scenario: CONFIRMED finding with incomplete evidence
const findingBeforeEnforcement = {
  id: 'finding-123',
  type: FINDING_TYPE.SILENT_FAILURE,
  status: FINDING_STATUS.CONFIRMED,  // <-- Will be downgraded
  description: 'Submit button click produced no visible response',
  evidence: {
    // Missing: beforeUrl (context anchor)
    afterUrl: 'https://example.com/form',  // Still on same page
    domChanged: false,
    uiChanged: false
    // Has effect indicators but no context anchor
  },
  confidence: {
    score01: 0.88,
    score100: 88,
    level: 'HIGH',
    topReasons: [
      'No observable state change after interaction',
      'Expected navigation did not occur'
    ]
  },
  signals: {
    impact: 'MEDIUM',
    userRisk: 'CONFUSES',
    ownership: 'FRONTEND',
    grouping: { capability: 'form-submission' }
  },
  what_happened: 'Clicked submit button',
  what_was_expected: 'Form submission and navigation to success page',
  what_was_observed: 'No response, stayed on same page',
  interaction: { type: 'CLICK', target: '#submit-btn' }
};

console.log('BEFORE Enforcement:');
console.log(JSON.stringify(findingBeforeEnforcement, null, 2));
console.log('\n---\n');

// Apply Evidence Law v1
const result = enforceContractsOnFindings([findingBeforeEnforcement]);

console.log('\nAFTER Enforcement:');
if (result.downgrades.length > 0) {
  console.log('Downgrade occurred:');
  const downgrade = result.downgrades[0];
  console.log(`  Original status: ${downgrade.original.status}`);
  console.log(`  New status: ${downgrade.downgraded.status}`);
  console.log(`  Reason: ${downgrade.reason}`);
  console.log('\nFinding after enforcement:');
  console.log(JSON.stringify(downgrade.downgraded, null, 2));
} else {
  console.log('No downgrade (Evidence Law satisfied)');
  console.log(JSON.stringify(result.valid[0], null, 2));
}

console.log('\n=== Key Insight ===');
console.log('Even with HIGH confidence (0.88) and detailed signals,');
console.log('Evidence Law v1 downgrades CONFIRMED to SUSPECTED because:');
console.log('  - Missing context anchor (no beforeUrl/beforeScreenshot/before)');
console.log('  - Cannot prove the initial state before interaction occurred');
console.log('\nThis enforces: "No context = No confirmed claim"');


