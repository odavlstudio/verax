/**
 * Unit Tests for Detection Engine
 * 
 * Tests the three detection classes:
 * 1. dead_interaction_silent_failure
 * 2. broken_navigation_promise
 * 3. silent_submission
 */

import { detectSilentFailures } from '../../src/cli/util/detection-engine.js';

// Test data
const mockLearnData = {
  expectations: [
    {
      id: 'exp_1',
      type: 'interaction',
      category: 'button',
      promise: { kind: 'click', value: 'Dead Button' },
      action: 'click',
      expectedOutcome: 'ui-change'
    },
    {
      id: 'exp_2',
      type: 'navigation',
      promise: { kind: 'navigate', value: '/about.html' },
      confidence: 1
    },
    {
      id: 'exp_3',
      type: 'interaction',
      category: 'form',
      promise: { kind: 'submit', value: 'Submit Form' },
      action: 'submit',
      expectedOutcome: 'ui-change'
    }
  ]
};

const mockObserveData = {
  observations: [
    // Dead interaction: click with no outcome
    {
      id: 'exp_1',
      type: 'interaction',
      action: 'click',
      attempted: true,
      observed: false,
      evidenceFiles: ['exp_1_before.png', 'exp_1_after.png', 'exp_1_dom_diff.json'],
      signals: {
        navigationChanged: false,
        domChanged: false,
        feedbackSeen: false,
        networkActivity: false,
        consoleErrors: false,
        meaningfulDomChange: false,
        correlatedNetworkActivity: false
      }
    },
    // Broken navigation: no nav occurred
    {
      id: 'exp_2',
      type: 'navigation',
      attempted: true,
      observed: false,
      evidenceFiles: ['exp_2_before.png', 'exp_2_after.png', 'exp_2_dom_diff.json'],
      signals: {
        navigationChanged: false,
        domChanged: false,
        feedbackSeen: false,
        networkActivity: false,
        consoleErrors: false,
        meaningfulDomChange: false,
        correlatedNetworkActivity: false
      }
    },
    // Silent submission: no acknowledgment
    {
      id: 'exp_3',
      type: 'interaction',
      action: 'submit',
      attempted: true,
      observed: false,
      evidenceFiles: ['exp_3_before.png', 'exp_3_after.png', 'exp_3_dom_diff.json'],
      signals: {
        navigationChanged: false,
        domChanged: false,
        feedbackSeen: false,
        networkActivity: false,
        consoleErrors: false,
        meaningfulDomChange: false,
        correlatedNetworkActivity: false
      }
    }
  ]
};

// Test 1: Detect dead interaction
export async function test_detectDeadInteraction() {
  const findings = await detectSilentFailures(
    { expectations: [mockLearnData.expectations[0]] },
    { observations: [mockObserveData.observations[0]] }
  );

  if (findings.length === 0) {
    throw new Error('Expected 1 dead_interaction finding, got 0');
  }

  const finding = findings[0];
  if (finding.type !== 'dead_interaction_silent_failure') {
    throw new Error(`Expected type dead_interaction_silent_failure, got ${finding.type}`);
  }

  if (!finding.evidence) {
    throw new Error('Finding missing evidence field');
  }

  console.log('✓ test_detectDeadInteraction passed');
}

// Test 2: Detect broken navigation
export async function test_detectBrokenNavigation() {
  const findings = await detectSilentFailures(
    { expectations: [mockLearnData.expectations[1]] },
    { observations: [mockObserveData.observations[1]] }
  );

  if (findings.length === 0) {
    throw new Error('Expected 1 broken_navigation finding, got 0');
  }

  const finding = findings[0];
  if (finding.type !== 'broken_navigation_promise') {
    throw new Error(`Expected type broken_navigation_promise, got ${finding.type}`);
  }

  if (finding.severity !== 'HIGH') {
    throw new Error(`Expected severity HIGH, got ${finding.severity}`);
  }

  console.log('✓ test_detectBrokenNavigation passed');
}

// Test 3: Detect silent submission
export async function test_detectSilentSubmission() {
  const findings = await detectSilentFailures(
    { expectations: [mockLearnData.expectations[2]] },
    { observations: [mockObserveData.observations[2]] }
  );

  if (findings.length === 0) {
    throw new Error('Expected 1 silent_submission finding, got 0');
  }

  const finding = findings[0];
  if (finding.type !== 'silent_submission') {
    throw new Error(`Expected type silent_submission, got ${finding.type}`);
  }

  if (finding.severity !== 'HIGH') {
    throw new Error(`Expected severity HIGH, got ${finding.severity}`);
  }

  console.log('✓ test_detectSilentSubmission passed');
}

// Test 4: Detect all three classes in batch
export async function test_detectBatchOfThreeClasses() {
  const findings = await detectSilentFailures(mockLearnData, mockObserveData);

  if (findings.length !== 3) {
    throw new Error(`Expected 3 findings, got ${findings.length}`);
  }

  const types = new Set(findings.map(f => f.type));
  if (!types.has('dead_interaction_silent_failure')) {
    throw new Error('Missing dead_interaction_silent_failure');
  }
  if (!types.has('broken_navigation_promise')) {
    throw new Error('Missing broken_navigation_promise');
  }
  if (!types.has('silent_submission')) {
    throw new Error('Missing silent_submission');
  }

  // All should pass constitution validator (no dropped)
  const allHaveId = findings.every(f => f.id);
  const allHaveStatus = findings.every(f => ['CONFIRMED', 'SUSPECTED', 'INFORMATIONAL'].includes(f.status));
  
  if (!allHaveId) {
    throw new Error('Some findings missing id');
  }
  if (!allHaveStatus) {
    throw new Error('Some findings have invalid status');
  }

  console.log('✓ test_detectBatchOfThreeClasses passed');
}

// Test 5: Verify confidence calculation
export async function test_confidenceCalculation() {
  const findings = await detectSilentFailures(mockLearnData, mockObserveData);

  // All should have valid confidence [0, 1]
  const allValidConfidence = findings.every(f => typeof f.confidence === 'number' && f.confidence >= 0 && f.confidence <= 1);
  
  if (!allValidConfidence) {
    throw new Error('Some findings have invalid confidence');
  }

  console.log('✓ test_confidenceCalculation passed');
}

// Run all tests
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Detection Engine Unit Tests');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  try {
    await test_detectDeadInteraction();
    await test_detectBrokenNavigation();
    await test_detectSilentSubmission();
    await test_detectBatchOfThreeClasses();
    await test_confidenceCalculation();

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('All detection engine tests passed (5/5)');
    console.log('═══════════════════════════════════════════════════════════════');
  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('Test failed:', error.message);
    console.error('═══════════════════════════════════════════════════════════════');
    process.exit(1);
  }
}

runAllTests();
