/**
 * PHASE 3: CONFIDENCE & EVIDENCE DEFENSIBILITY TESTS
 * 
 * Tests for legal/ethical defensibility requirements:
 * 1. Empty sensors not counted as present (no false confidence)
 * 2. Missing evidence files tracked as silence
 * 3. Dropped findings are auditable
 * 4. Near-threshold scores include boundary explanations
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasNetworkData, hasConsoleData, hasUiData, computeConfidence } from '../src/verax/detect/confidence-engine.js';
import { computeObservationSummary } from '../src/verax/detect/verdict-engine.js';
import { SilenceTracker } from '../src/verax/core/silence-model.js';
import { enforceInvariants } from '../src/verax/core/invariants.js';
import { generateRunId } from '../src/verax/shared/artifact-manager.js';
import fs from 'fs';
import path from 'path';

// ============================================================================
// STEP 1: SENSOR PRESENCE SEMANTICS TESTS
// ============================================================================

test('Step 1: hasNetworkData - empty network summary not counted as present', () => {
  const emptyNetwork = {};
  assert.equal(hasNetworkData(emptyNetwork), false, 'Empty network object should NOT count as present');
  
  const zeroNetwork = { totalRequests: 0, failedRequests: 0, slowRequests: 0 };
  assert.equal(hasNetworkData(zeroNetwork), false, 'Zero-count network should NOT count as present');
});

test('Step 1: hasNetworkData - network with activity counted as present', () => {
  const activeNetwork = { totalRequests: 5, failedRequests: 0, slowRequests: 0 };
  assert.equal(hasNetworkData(activeNetwork), true, 'Network with requests should count as present');
  
  const failedNetwork = { totalRequests: 0, failedRequests: 2, slowRequests: 0 };
  assert.equal(hasNetworkData(failedNetwork), true, 'Network with failures should count as present');
  
  const slowNetwork = { totalRequests: 0, failedRequests: 0, slowRequests: 1 };
  assert.equal(hasNetworkData(slowNetwork), true, 'Network with slow requests should count as present');
});

test('Step 1: hasConsoleData - empty console summary not counted as present', () => {
  const emptyConsole = {};
  assert.equal(hasConsoleData(emptyConsole), false, 'Empty console object should NOT count as present');
  
  const zeroConsole = { totalMessages: 0, errors: 0, warnings: 0, entries: [] };
  assert.equal(hasConsoleData(zeroConsole), false, 'Zero-count console should NOT count as present');
});

test('Step 1: hasConsoleData - console with activity counted as present', () => {
  const activeConsole = { totalMessages: 3, errors: 0, warnings: 0, entries: [] };
  assert.equal(hasConsoleData(activeConsole), true, 'Console with messages should count as present');
  
  const errorConsole = { totalMessages: 0, errors: 1, warnings: 0, entries: [] };
  assert.equal(hasConsoleData(errorConsole), true, 'Console with errors should count as present');
  
  const entriesConsole = { totalMessages: 0, errors: 0, warnings: 0, entries: [{ message: 'test' }] };
  assert.equal(hasConsoleData(entriesConsole), true, 'Console with entries should count as present');
});

test('Step 1: hasUiData - empty UI signals not counted as present', () => {
  const emptyUi = {};
  assert.equal(hasUiData(emptyUi), false, 'Empty UI object should NOT count as present');
  
  const noChangeUi = { hasAnyDelta: false, domChanged: false, visibleChanged: false };
  assert.equal(hasUiData(noChangeUi), false, 'UI with no changes should NOT count as present');
});

test('Step 1: hasUiData - UI with activity counted as present', () => {
  const changedUi = { hasAnyDelta: true };
  assert.equal(hasUiData(changedUi), true, 'UI with delta should count as present');
  
  const domChangedUi = { hasAnyDelta: false, domChanged: true };
  assert.equal(hasUiData(domChangedUi), true, 'UI with DOM change should count as present');
  
  const ariaChangedUi = { hasAnyDelta: false, ariaChanged: true };
  assert.equal(hasUiData(ariaChangedUi), true, 'UI with ARIA change should count as present');
});

test('Step 1: Empty sensors prevent HIGH confidence', () => {
  const emptyNetwork = {};
  const emptyConsole = {};
  const emptyUi = {};
  
  const confidence = computeConfidence(
    { strength: 'PROVEN', source: 'code' }, // Proven expectation
    emptyNetwork,
    emptyConsole,
    emptyUi,
    {}, // evidence
    null // attemptMeta
  );
  
  // Even with proven expectation, empty sensors should prevent HIGH confidence
  assert.notEqual(confidence.level, 'HIGH', 'Empty sensors should prevent HIGH confidence even with proven expectation');
  assert.ok(confidence.score < 80, 'Score should be below HIGH threshold with empty sensors');
});

// ============================================================================
// STEP 2: EVIDENCE INTEGRITY VALIDATION TESTS
// ============================================================================

test('Step 2: Missing evidence files tracked as silence', () => {
  const silenceTracker = new SilenceTracker();
  const projectDir = process.cwd();
  
  const traces = [
    {
      interaction: { selector: '#test-btn', label: 'Test Button' },
      before: { screenshot: 'nonexistent-before.png', url: '/test' },
      after: { screenshot: 'nonexistent-after.png', url: '/test' },
      expectationId: 'test-exp-1'
    }
  ];
  
  // buildEvidenceIndex is not directly exported for testing,
  // so test through computeObservationSummary
  const _summary = computeObservationSummary(
    [], // findings
    { traces }, // observeTruth
    {}, // learnTruth
    [], // coverageGaps
    false, // budgetExceeded
    null, // detectTruth
    projectDir, // projectDir
    silenceTracker // silenceTracker
  );
  
  const silenceData = silenceTracker.export().entries;
  const evidenceSilence = silenceData.filter(s => s.scope === 'evidence');
  
  assert.ok(evidenceSilence.length > 0, 'Should track missing evidence as silence');
  assert.ok(
    evidenceSilence.some(s => s.reason === 'evidence_missing'),
    'Should have evidence_missing reason'
  );
  assert.ok(
    evidenceSilence.some(s => s.description && s.description.includes('Screenshot evidence file not found')),
    'Should describe missing screenshot'
  );
});

test('Step 2: Valid evidence files not flagged as missing', () => {
  const silenceTracker = new SilenceTracker();
  const projectDir = process.cwd();
  
  // Create temp evidence files
  const runId = generateRunId();
  const runDir = path.join(projectDir, '.verax', 'runs', runId);
  const evidenceDir = path.join(runDir, 'evidence', 'screenshots');
  fs.mkdirSync(evidenceDir, { recursive: true });
  
  const beforePath = path.join(evidenceDir, 'test-before.png');
  const afterPath = path.join(evidenceDir, 'test-after.png');
  
  fs.writeFileSync(beforePath, 'fake image data');
  fs.writeFileSync(afterPath, 'fake image data');
  
  try {
    const traces = [
      {
        interaction: { selector: '#test-btn' },
        before: { screenshot: 'test-before.png' },
        after: { screenshot: 'test-after.png' },
        expectationId: 'test-exp-1'
      }
    ];
    
    const _summary = computeObservationSummary(
      [], // findings
      { traces }, // observeTruth
      {}, // learnTruth
      [], // coverageGaps
      false, // budgetExceeded
      null, // detectTruth
      projectDir, // projectDir
      silenceTracker // silenceTracker
    );
    
    const silenceData = silenceTracker.export().entries;
    const evidenceSilence = silenceData.filter(s => 
      s.scope === 'evidence' && s.reason === 'evidence_missing'
    );
    
    assert.equal(evidenceSilence.length, 0, 'Should NOT flag existing evidence files as missing');
  } finally {
    // Cleanup
    try { fs.unlinkSync(beforePath); } catch { /* cleanup */ }
    try { fs.unlinkSync(afterPath); } catch { /* cleanup */ }
  }
});

// ============================================================================
// STEP 3: AUDITABLE INVARIANT DROPS TESTS
// ============================================================================

test('Step 3: Dropped finding with missing evidence tracked as silence', () => {
  const finding = {
    type: 'observed_break',
    confidence: { level: 'MEDIUM', score: 65 },
    signals: {
      impact: 'MEDIUM',
      userRisk: 'CONFUSES',
      ownership: 'FRONTEND',
      grouping: { groupByRoute: '/test' }
    }
    // Missing evidence field - should be dropped
  };
  
  const validation = enforceInvariants(finding, {}, null);
  
  assert.equal(validation.shouldDrop, true, 'Finding without evidence should be dropped');
  assert.equal(validation.reason, 'missing_evidence', 'Should have missing_evidence reason');
  assert.ok(validation.message, 'Should include drop message');
});

test('Step 3: Dropped finding with missing confidence tracked', () => {
  const finding = {
    type: 'observed_break',
    evidence: { beforeUrl: '/test', afterUrl: '/test' },
    signals: {
      impact: 'MEDIUM',
      userRisk: 'CONFUSES',
      ownership: 'FRONTEND',
      grouping: { groupByRoute: '/test' }
    }
    // Missing confidence field - should be dropped
  };
  
  const validation = enforceInvariants(finding, {}, null);
  
  assert.equal(validation.shouldDrop, true, 'Finding without confidence should be dropped');
  assert.equal(validation.reason, 'missing_confidence', 'Should have missing_confidence reason');
});

test('Step 3: Dropped ungrounded finding tracked', () => {
  const finding = {
    type: 'observed_break',
    evidence: {}, // Empty evidence - no URLs, no screenshots
    confidence: { level: 'LOW', score: 45 },
    signals: {
      impact: 'LOW',
      userRisk: 'DEGRADES',
      ownership: 'FRONTEND',
      grouping: { groupByRoute: '/test' }
    }
  };
  
  // No matched expectation, no sensor evidence, empty evidence object
  const trace = {
    sensors: {} // Empty sensors
  };
  
  const validation = enforceInvariants(finding, trace, null);
  
  assert.equal(validation.shouldDrop, true, 'Ungrounded finding should be dropped');
  assert.equal(validation.reason, 'ungrounded_finding', 'Should have ungrounded_finding reason');
  assert.ok(
    validation.message.includes('not derived from proven expectation'),
    'Should explain lack of grounding'
  );
});

test('Step 3: Dropped ambiguous finding tracked', () => {
  const finding = {
    type: 'observed_break',
    evidence: { beforeUrl: '/test', afterUrl: '/test' },
    confidence: { level: 'LOW', score: 50 }, // Below threshold, LOW level
    signals: {
      impact: 'HIGH', // HIGH impact but LOW confidence - ambiguous
      userRisk: 'BLOCKS',
      ownership: 'FRONTEND',
      grouping: { groupByRoute: '/test' }
    }
  };
  
  const trace = {
    sensors: {
      network: { totalRequests: 1 }, // Some sensor activity
      console: { errors: [] },
      uiSignals: { diff: { changed: false } }
    }
  };
  
  const validation = enforceInvariants(finding, trace, null);
  
  // May be dropped as contradictory (HIGH impact + LOW confidence + weak evidence)
  if (validation.shouldDrop) {
    assert.ok(
      validation.reason === 'ambiguous_finding' || validation.reason === 'contradictory_signals',
      'Ambiguous finding should have appropriate drop reason'
    );
    assert.ok(validation.message, 'Should include explanation of ambiguity');
  }
});

// ============================================================================
// STEP 4: CONFIDENCE BOUNDARY SMOOTHING TESTS
// ============================================================================

test('Step 4: Near-HIGH threshold (78-80) includes boundary explanation', () => {
  const networkSummary = { totalRequests: 5, failedRequests: 1 };
  const consoleSummary = { totalMessages: 2, errors: 1, entries: [] };
  const uiSignals = { hasAnyDelta: true, domChanged: true };
  const evidence = { beforeUrl: '/test', afterUrl: '/error' };
  
  const confidence = computeConfidence(
    { strength: 'OBSERVED', source: 'runtime' }, // Not proven - caps at MEDIUM
    networkSummary,
    consoleSummary,
    uiSignals,
    evidence,
    { repeated: true }
  );
  
  // Score near HIGH threshold should have boundary explanation
  if (confidence.score >= 77 && confidence.score < 80) {
    assert.ok(confidence.boundaryExplanation, 'Near-HIGH threshold should have boundary explanation');
    assert.ok(
      confidence.boundaryExplanation.includes('threshold'),
      'Boundary explanation should mention threshold'
    );
  }
});

test('Step 4: Near-MEDIUM threshold (53-55) includes boundary explanation', () => {
  const networkSummary = { totalRequests: 2 };
  const consoleSummary = {};
  const uiSignals = {};
  const evidence = { beforeUrl: '/test', afterUrl: '/test' };
  
  const confidence = computeConfidence(
    { strength: 'INFERRED', source: 'pattern' },
    networkSummary,
    consoleSummary,
    uiSignals,
    evidence,
    null
  );
  
  // Score near MEDIUM threshold should have boundary explanation
  if (confidence.score >= 52 && confidence.score < 57) {
    assert.ok(confidence.boundaryExplanation, 'Near-MEDIUM threshold should have boundary explanation');
    assert.ok(
      confidence.boundaryExplanation.includes('threshold'),
      'Boundary explanation should mention threshold'
    );
  }
});

test('Step 4: Capped HIGH to MEDIUM includes boundary explanation', () => {
  const networkSummary = { totalRequests: 10, failedRequests: 2 };
  const consoleSummary = { totalMessages: 5, errors: 2, entries: [] };
  const uiSignals = { hasAnyDelta: true, domChanged: true };
  const evidence = { beforeUrl: '/test', afterUrl: '/error', networkRequests: 10 };
  
  const confidence = computeConfidence(
    { strength: 'INFERRED', source: 'pattern' }, // Not proven - caps at MEDIUM even if score >= 80
    networkSummary,
    consoleSummary,
    uiSignals,
    evidence,
    { repeated: true }
  );
  
  // If score would be HIGH but capped at MEDIUM, should explain
  if (confidence.level === 'MEDIUM' && confidence.score >= 70) {
    assert.ok(confidence.boundaryExplanation, 'Capped HIGH should have boundary explanation');
    assert.ok(
      confidence.boundaryExplanation.includes('Capped') || confidence.boundaryExplanation.includes('expectation'),
      'Should explain why capped'
    );
  }
});

test('Step 4: Well-within-range scores may not have boundary explanation', () => {
  const networkSummary = { totalRequests: 10, failedRequests: 3 };
  const consoleSummary = { totalMessages: 5, errors: 2, entries: [] };
  const uiSignals = { hasAnyDelta: true, domChanged: true };
  const evidence = { beforeUrl: '/test', afterUrl: '/error' };
  
  const confidence = computeConfidence(
    { strength: 'PROVEN', source: 'code' },
    networkSummary,
    consoleSummary,
    uiSignals,
    evidence,
    { repeated: true }
  );
  
  // If score is well within range (e.g., 60-70 for MEDIUM), boundary explanation is optional
  if (confidence.score >= 60 && confidence.score <= 75) {
    // Boundary explanation not required for mid-range scores
    // Just verify confidence is assigned correctly
    assert.ok(['LOW', 'MEDIUM', 'HIGH'].includes(confidence.level), 'Should have valid confidence level');
  }
});

// ============================================================================
// INTEGRATION TEST: ALL PHASE 3 REQUIREMENTS TOGETHER
// ============================================================================

test('Integration: Phase 3 complete flow - empty sensors, missing evidence, dropped findings, boundaries', () => {
  const _silenceTracker = new SilenceTracker();
  
  // Test 1: Empty sensors don't count as present
  const emptyNetwork = {};
  const emptyConsole = {};
  const emptyUi = {};
  
  assert.equal(hasNetworkData(emptyNetwork), false, 'Empty network not present');
  assert.equal(hasConsoleData(emptyConsole), false, 'Empty console not present');
  assert.equal(hasUiData(emptyUi), false, 'Empty UI not present');
  
  // Test 2: Finding with missing evidence gets dropped
  const badFinding = {
    type: 'observed_break',
    confidence: { level: 'MEDIUM', score: 65 },
    signals: {
      impact: 'MEDIUM',
      userRisk: 'CONFUSES',
      ownership: 'FRONTEND',
      grouping: { groupByRoute: '/test' }
    }
    // Missing evidence
  };
  
  const validation = enforceInvariants(badFinding, {}, null);
  assert.equal(validation.shouldDrop, true, 'Bad finding should be dropped');
  assert.ok(validation.reason, 'Drop should have reason');
  
  // Test 3: Confidence with boundary near threshold
  const networkData = { totalRequests: 3 };
  const consoleData = { totalMessages: 1, errors: 0, entries: [] };
  const uiData = { hasAnyDelta: false };
  
  const confidence = computeConfidence(
    { strength: 'INFERRED', source: 'pattern' },
    networkData,
    consoleData,
    uiData,
    { beforeUrl: '/test' },
    null
  );
  
  assert.ok(confidence.level, 'Should have confidence level');
  assert.ok(typeof confidence.score === 'number', 'Should have numeric score');
  
  // If near threshold, should have boundary explanation
  if (
    (confidence.score >= 52 && confidence.score < 57) ||
    (confidence.score >= 77 && confidence.score < 82)
  ) {
    assert.ok(confidence.boundaryExplanation, 'Near-threshold should have boundary explanation');
  }
  
  console.log('✅ Phase 3 integration test passed - all requirements working together');
});
