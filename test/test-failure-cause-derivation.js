#!/usr/bin/env node

/**
 * Test: Failure Cause derivation (FCI)
 * 
 * Tests:
 * 1. No evidence -> no causes (Evidence Law enforcement)
 * 2. Determinism: same input -> same causes, same ordering, same wording
 * 3. Cause derivation for C2 (state mutation no UI)
 * 4. Cause derivation for C3 (dead click)
 * 5. Cause derivation for C7 (network silent)
 */

import {
  deriveCauses,
  deriveCausesForFindings,
  findingsWithCauses,
  attachCausesToFinding
} from '../src/verax/detect/failure-cause-derivation.js';

let testCount = 0;
let passCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    console.log(`✓ Test ${testCount}: ${name}`);
    passCount++;
  } catch (e) {
    console.error(`✗ Test ${testCount}: ${name}`);
    console.error(`  ${e.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Test 1: No evidence -> no causes
test('No evidence => no causes (Evidence Law)', () => {
  const finding = {
    id: 'test-1',
    type: 'silent_failure',
    evidence: {}
  };
  const causes = deriveCauses(finding);
  assert(Array.isArray(causes), 'Should return array');
  assert(causes.length === 0, `Expected 0 causes, got ${causes.length}`);
});

// Test 2: Null/undefined finding
test('Null finding => no causes', () => {
  const causes = deriveCauses(null);
  assert(causes.length === 0, 'Should return empty array for null');
});

// Test 3: Missing evidence field
test('Missing evidence field => no causes', () => {
  const finding = {
    id: 'test-2',
    type: 'silent_failure'
  };
  const causes = deriveCauses(finding);
  assert(causes.length === 0, 'Should return empty array');
});

// Test 4: Determinism - run twice, get identical output
test('Determinism: same finding => same causes', () => {
  const finding = {
    id: 'test-det-1',
    type: 'silent_failure',
    evidence: {
      stateMutation: true,
      domChanged: false,
      navigationOccurred: false,
      uiFeedback: false
    }
  };
  const run1 = deriveCauses(finding);
  const run2 = deriveCauses(finding);
  
  assert(JSON.stringify(run1) === JSON.stringify(run2), 'Runs should be identical');
  assert(run1.length > 0, 'Should detect C2 cause');
  assert(run1[0].id === 'C2_STATE_MUTATION_NO_UI', 'Should detect C2');
});

// Test 5: Determinism - ordering by catalog order
test('Determinism: causes ordered by catalog order then id', () => {
  const finding = {
    id: 'test-ord-1',
    type: 'silent_failure',
    evidence: {
      stateMutation: true,
      domChanged: false,
      navigationOccurred: false,
      uiFeedback: false,
      interactionPerformed: true,
      networkActivity: false,
      userFeedback: false,
      networkFailure: true
    }
  };
  const causes = deriveCauses(finding);
  // Should have C2, C3, and C7
  assert(causes.length >= 3, `Should detect at least 3 causes, got ${causes.length}`);
  
  // Check catalog ordering: C2 < C3 < C7
  const c2Index = causes.findIndex(c => c.id === 'C2_STATE_MUTATION_NO_UI');
  const c3Index = causes.findIndex(c => c.id === 'C3_DEAD_CLICK');
  const c7Index = causes.findIndex(c => c.id === 'C7_NETWORK_SILENT');
  
  assert(c2Index >= 0, 'Should find C2');
  assert(c3Index >= 0, 'Should find C3');
  assert(c7Index >= 0, 'Should find C7');
  assert(c2Index < c3Index, 'C2 should come before C3 (catalog order)');
  assert(c3Index < c7Index, 'C3 should come before C7 (catalog order)');
});

// Test 6: C2 derivation - state mutation no UI
test('C2: State mutation + no DOM change + no feedback', () => {
  const finding = {
    id: 'c2-test',
    type: 'state_action',
    evidence: {
      stateMutation: true,
      domChanged: false,
      navigationOccurred: false,
      uiFeedback: false
    }
  };
  const causes = deriveCauses(finding);
  assert(causes.length >= 1, 'Should find at least one cause');
  assert(causes.some(c => c.id === 'C2_STATE_MUTATION_NO_UI'), 'Should find C2');
  
  const c2 = causes.find(c => c.id === 'C2_STATE_MUTATION_NO_UI');
  assert(c2.statement.includes('Likely cause:'), 'Should start with "Likely cause:"');
  assert(c2.confidence === 'MEDIUM', 'Should be MEDIUM confidence');
  assert(Array.isArray(c2.evidence_refs), 'Should have evidence_refs array');
  assert(c2.evidence_refs.length > 0, 'Should have evidence references');
});

// Test 7: C3 derivation - dead click
test('C3: Interaction but no network/nav/DOM/feedback', () => {
  const finding = {
    id: 'c3-test',
    type: 'silent_failure',
    evidence: {
      interactionPerformed: true,
      networkActivity: false,
      navigationOccurred: false,
      domChanged: false,
      userFeedback: false
    }
  };
  const causes = deriveCauses(finding);
  assert(causes.some(c => c.id === 'C3_DEAD_CLICK'), 'Should find C3');
  
  const c3 = causes.find(c => c.id === 'C3_DEAD_CLICK');
  assert(c3.title.includes('no observable outcome') || c3.title.includes('no effect'), 'Title should describe no observable effect');
  assert(c3.confidence === 'MEDIUM', 'Should be MEDIUM confidence');
});

// Test 8: C7 derivation - network silent
test('C7: Network failure + no feedback', () => {
  const finding = {
    id: 'c7-test',
    type: 'network_silent_failure',
    evidence: {
      networkFailure: true,
      uiFeedback: false,
      domChanged: false
    }
  };
  const causes = deriveCauses(finding);
  assert(causes.some(c => c.id === 'C7_NETWORK_SILENT'), 'Should find C7');
  
  const c7 = causes.find(c => c.id === 'C7_NETWORK_SILENT');
  assert(c7.statement.includes('network'), 'Should mention network');
  assert(c7.confidence === 'MEDIUM', 'Should be MEDIUM confidence');
});

// Test 9: Batch derivation
test('Batch derivation on multiple findings', () => {
  const findings = [
    {
      id: 'batch-1',
      type: 'silent_failure',
      evidence: { }
    },
    {
      id: 'batch-2',
      type: 'state_action',
      evidence: {
        stateMutation: true,
        domChanged: false,
        navigationOccurred: false,
        uiFeedback: false
      }
    }
  ];
  const causesMap = deriveCausesForFindings(findings);
  assert('batch-1' in causesMap === false, 'batch-1 has no evidence, should not be in map');
  assert('batch-2' in causesMap, 'batch-2 should be in map');
  assert(causesMap['batch-2'].some(c => c.id === 'C2_STATE_MUTATION_NO_UI'), 'batch-2 should have C2');
});

// Test 10: findingsWithCauses filter
test('findingsWithCauses filters correctly', () => {
  const findings = [
    {
      id: 'with-evidence',
      type: 'state_action',
      evidence: {
        stateMutation: true,
        domChanged: false,
        navigationOccurred: false,
        uiFeedback: false
      }
    },
    {
      id: 'no-evidence',
      type: 'silent_failure',
      evidence: { }
    }
  ];
  const filtered = findingsWithCauses(findings);
  assert(filtered.length === 1, `Expected 1 finding with causes, got ${filtered.length}`);
  assert(filtered[0].id === 'with-evidence', 'Should only include finding with causes');
});

// Test 11: attachCausesToFinding is pure (no mutation)
test('attachCausesToFinding is pure: returns new object, no mutation', () => {
  const original = {
    id: 'pure-test',
    type: 'state_action',
    evidence: {
      stateMutation: true,
      domChanged: false,
      navigationOccurred: false,
      uiFeedback: false
    }
  };
  
  // Make a deep copy to verify no mutation
  const originalCopy = JSON.parse(JSON.stringify(original));
  
  // Call attachCausesToFinding
  const result = attachCausesToFinding(original);
  
  // Verify original is unchanged
  assert(JSON.stringify(original) === JSON.stringify(originalCopy), 'Original finding should not be mutated');
  assert(!('causes' in original), 'Original should not have causes added');
  
  // Verify result has causes
  assert('causes' in result, 'Result should have causes');
  assert(result.causes.length > 0, 'Result should have non-empty causes array');
  
  // Verify result is a new object
  assert(result !== original, 'Result should be a different object from input');
  
  // Verify other fields are shallow-copied
  assert(result.evidence === original.evidence, 'Evidence should be same reference (shallow copy)');
});

// Test 12: Cause statement format
test('Cause statements start with "Likely cause:"', () => {
  const finding = {
    id: 'format-test',
    type: 'state_action',
    evidence: {
      stateMutation: true,
      domChanged: false,
      navigationOccurred: false,
      uiFeedback: false
    }
  };
  const causes = deriveCauses(finding);
  causes.forEach(cause => {
    assert(
      cause.statement.startsWith('Likely cause:'),
      `Statement should start with "Likely cause:", got: ${cause.statement}`
    );
  });
});

// Test 13: Confidence never HIGH
test('Confidence is never HIGH', () => {
  const findings = [
    {
      id: 't1',
      type: 'state_action',
      evidence: {
        stateMutation: true,
        domChanged: false,
        navigationOccurred: false,
        uiFeedback: false
      }
    },
    {
      id: 't2',
      type: 'silent_failure',
      evidence: {
        interactionPerformed: true,
        networkActivity: false,
        navigationOccurred: false,
        domChanged: false,
        userFeedback: false
      }
    }
  ];
  
  findings.forEach(finding => {
    const causes = deriveCauses(finding);
    causes.forEach(cause => {
      assert(
        cause.confidence === 'LOW' || cause.confidence === 'MEDIUM',
        `Confidence should be LOW or MEDIUM, got ${cause.confidence}`
      );
    });
  });
});

// Results
console.log(`\n${passCount}/${testCount} tests passed`);
if (passCount === testCount) {
  console.log('✓ All tests passed');
  process.exit(0);
} else {
  console.log(`✗ ${testCount - passCount} test(s) failed`);
  process.exit(1);
}




