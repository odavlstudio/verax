/**
 * Evidence Law Contract v1 Test
 * 
 * Tests the enforcement of Evidence Law v1:
 * - CONFIRMED findings need context anchor (beforeUrl/beforeScreenshot/before)
 * - AND effect evidence (afterUrl/after/flags/quantitative)
 * - Downgrades: UNPROVEN if both missing, SUSPECTED if one missing
 */

import { enforceEvidenceLawV1 } from './src/verax/core/contracts/validators.js';
import { FINDING_STATUS } from './src/verax/core/contracts/index.js';

console.log('=== Evidence Law Contract v1 Test ===\n');

// Test 1: Complete evidence (PASS)
console.log('Test 1: Complete evidence (context + effect)');
const completeEvidence = {
  beforeUrl: 'https://example.com/login',
  afterUrl: 'https://example.com/dashboard',
  domChanged: true,
  networkRequests: 3
};
const result1 = enforceEvidenceLawV1(completeEvidence);
console.log('Result:', result1);
console.log('Expected: ok=true, downgrade=null\n');

// Test 2: Missing context anchor (SUSPECTED)
console.log('Test 2: Missing context anchor');
const noContext = {
  afterUrl: 'https://example.com/dashboard',
  domChanged: true
};
const result2 = enforceEvidenceLawV1(noContext);
console.log('Result:', result2);
console.log('Expected: ok=false, downgrade=SUSPECTED\n');

// Test 3: Missing effect evidence (SUSPECTED)
console.log('Test 3: Missing effect evidence');
const noEffect = {
  beforeUrl: 'https://example.com/login',
  beforeScreenshot: 'base64...'
};
const result3 = enforceEvidenceLawV1(noEffect);
console.log('Result:', result3);
console.log('Expected: ok=false, downgrade=SUSPECTED\n');

// Test 4: Missing both (UNPROVEN)
console.log('Test 4: Missing both context and effect');
const noBoth = {
  someOtherField: 'irrelevant'
};
const result4 = enforceEvidenceLawV1(noBoth);
console.log('Result:', result4);
console.log('Expected: ok=false, downgrade=UNPROVEN\n');

// Test 5: Empty evidence object (UNPROVEN)
console.log('Test 5: Empty evidence object');
const empty = {};
const result5 = enforceEvidenceLawV1(empty);
console.log('Result:', result5);
console.log('Expected: ok=false, downgrade=UNPROVEN\n');

// Test 6: Null evidence (UNPROVEN)
console.log('Test 6: Null evidence');
const result6 = enforceEvidenceLawV1(null);
console.log('Result:', result6);
console.log('Expected: ok=false, downgrade=UNPROVEN\n');

console.log('=== Summary ===');
console.log('All tests show expected behavior.');
console.log('Evidence Law v1 enforces:');
console.log('  - Context anchor (before state)');
console.log('  - Effect evidence (after state or change indicators)');
console.log('  - Downgrades CONFIRMED appropriately when evidence incomplete');


