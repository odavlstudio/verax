/**
 * TEST: Unified Confidence API (Week 2 / Task 2)
 * 
 * Verifies:
 * 1. No detect/* files import legacy confidence-engine.js directly
 * 2. Canonical confidence API works and returns correct shape
 * 3. Determinism: same input -> same output
 * 4. Backward compatibility: all legacy fields present
 */

import test from 'ava';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { computeConfidence } from '../src/verax/core/confidence/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const projectRoot = resolve(__dirname, '..', '..');

// ============================================================
// TEST 1: No Direct Imports of Legacy Engine from detect/*
// ============================================================

test('detect/* files do NOT import legacy confidence-engine.js directly', (t) => {
  const detectDir = resolve(projectRoot, 'src', 'verax', 'detect');
  const filesToCheck = [
    'finding-detector.js',
    'flow-detector.js',
    'ui-feedback-findings.js',
    'interactive-findings.js',
    'dynamic-route-findings.js',
    'route-findings.js'
  ];

  const violations = [];

  for (const file of filesToCheck) {
    const filePath = resolve(detectDir, file);
    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Check for direct imports of local confidence-engine.js
      // Should NOT match: import { ... } from './confidence-engine.js'
      const localImportPattern = /import\s+[{].*[}]\s+from\s+['"]\.\/confidence-engine\.js['"];/;
      
      if (localImportPattern.test(content)) {
        violations.push(`${file} imports from ./confidence-engine.js (should use ../core/confidence/index.js)`);
      }

      // Should also check for core/confidence-engine.js imports (should use index.js instead)
      const coreEnginePattern = /import\s+[{].*[}]\s+from\s+['"]\.\.\/core\/confidence-engine\.js['"];/;
      if (coreEnginePattern.test(content)) {
        violations.push(`${file} imports from ../core/confidence-engine.js (should use ../core/confidence/index.js)`);
      }
    } catch (error) {
      violations.push(`Failed to check ${file}: ${error.message}`);
    }
  }

  t.is(violations.length, 0, violations.length === 0 ? 'All files correctly import from canonical API' : violations.join('\n'));
});

// ============================================================
// TEST 2: Canonical API Exists and Returns Correct Shape
// ============================================================

test('computeConfidence returns canonical shape with all required fields', (t) => {
  const params = {
    findingType: 'network_silent_failure',
    expectation: {
      proof: 'PROVEN_EXPECTATION',
      explicit: true
    },
    sensors: {
      network: { totalRequests: 5, failedRequests: 2 },
      console: { totalMessages: 3, errors: 1 },
      uiSignals: { diff: { changed: true } }
    },
    comparisons: {
      hasUrlChange: false,
      hasDomChange: false,
      hasVisibleChange: false
    },
    attemptMeta: {}
  };

  const result = computeConfidence(params);

  // Check all canonical fields exist
  t.truthy(result, 'Result should exist');
  t.true(typeof result.score === 'number', 'score should be a number');
  t.true(result.score >= 0 && result.score <= 100, 'score should be in [0, 100]');
  
  t.true(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'].includes(result.level), 'level should be one of HIGH|MEDIUM|LOW|UNKNOWN');
  
  t.true(Array.isArray(result.explain), 'explain should be an array');
  t.true(result.explain.length <= 8, 'explain should have max 8 items');
  t.true(result.explain.every(e => typeof e === 'string'), 'all explain items should be strings');
  
  t.true(typeof result.factors === 'object', 'factors should be an object');
  t.true(result.factors.expectationStrength !== undefined, 'factors should have expectationStrength');
  t.true(result.factors.sensorsPresent !== undefined, 'factors should have sensorsPresent');
  t.true(result.factors.evidenceSignals !== undefined, 'factors should have evidenceSignals');
  t.true(Array.isArray(result.factors.penalties), 'factors.penalties should be an array');
  t.true(Array.isArray(result.factors.boosts), 'factors.boosts should be an array');
  
  t.true(typeof result.confidenceExplanation === 'object', 'confidenceExplanation should be an object');
  t.true(Array.isArray(result.confidenceExplanation.whyThisConfidence), 'confidenceExplanation.whyThisConfidence should be an array');
  t.true(Array.isArray(result.confidenceExplanation.whatWouldIncreaseConfidence), 'confidenceExplanation.whatWouldIncreaseConfidence should be an array');
  t.true(Array.isArray(result.confidenceExplanation.whatWouldReduceConfidence), 'confidenceExplanation.whatWouldReduceConfidence should be an array');
  
  t.true(result.boundaryExplanation === null || typeof result.boundaryExplanation === 'string', 'boundaryExplanation should be null or string');
});

// ============================================================
// TEST 3: Determinism (Same Input -> Same Output)
// ============================================================

test('computeConfidence produces deterministic output (same input -> same output)', (t) => {
  const params = {
    findingType: 'validation_silent_failure',
    expectation: {
      proof: 'PROVEN_EXPECTATION',
      type: 'form_submission'
    },
    sensors: {
      network: { totalRequests: 2, failedRequests: 0, slowRequests: 1 },
      console: { totalMessages: 5, errors: 2, warnings: 1 },
      uiSignals: { diff: { changed: false } }
    },
    comparisons: {
      hasUrlChange: false,
      hasDomChange: true,
      hasVisibleChange: false
    },
    attemptMeta: { repeated: false }
  };

  // Compute twice with same input
  const result1 = computeConfidence(params);
  const result2 = computeConfidence(params);

  // Core fields should be identical
  t.is(result1.score, result2.score, 'score should be deterministic');
  t.is(result1.level, result2.level, 'level should be deterministic');
  t.deepEqual(result1.factors, result2.factors, 'factors should be deterministic');
  t.deepEqual(result1.explain, result2.explain, 'explain should be deterministic');
  t.deepEqual(result1.boundaryExplanation, result2.boundaryExplanation, 'boundaryExplanation should be deterministic');
});

// ============================================================
// TEST 4: Backward Compatibility (Legacy Fields)
// ============================================================

test('backward compatibility: legacy findings can use result fields directly', (t) => {
  const params = {
    findingType: 'missing_network_action',
    expectation: {
      proof: 'PROVEN_EXPECTATION',
      fromPath: '/page1',
      toPath: '/page2'
    },
    sensors: {
      network: { totalRequests: 10, failedRequests: 3, successfulRequests: 7 },
      console: { totalMessages: 2, errors: 0 },
      uiSignals: { diff: { changed: true, domChanged: true } }
    },
    comparisons: {
      hasUrlChange: true,
      hasDomChange: true,
      hasVisibleChange: true
    },
    attemptMeta: {}
  };

  const result = computeConfidence(params);
  const finding = {
    type: 'missing_network_action',
    confidence: result
  };

  // Legacy code should be able to access these fields
  t.truthy(finding.confidence.score, 'Finding can access confidence.score');
  t.truthy(finding.confidence.level, 'Finding can access confidence.level');
  t.truthy(finding.confidence.explain, 'Finding can access confidence.explain');
  t.truthy(finding.confidence.factors, 'Finding can access confidence.factors');
  t.truthy(finding.confidence.confidenceExplanation, 'Finding can access confidence.confidenceExplanation');

  // Simulate existing code patterns
  const highConfidenceFinding = result.level === 'HIGH';
  const hasProblemSensors = result.factors.penalties.length > 0;
  const expectedStrength = result.factors.expectationStrength;

  t.true(typeof highConfidenceFinding === 'boolean', 'Legacy pattern: level check works');
  t.true(typeof hasProblemSensors === 'boolean', 'Legacy pattern: penalty check works');
  t.true(typeof expectedStrength === 'string', 'Legacy pattern: expectation strength check works');
});

// ============================================================
// TEST 5: Multiple Finding Types Work
// ============================================================

test('computeConfidence works for all major finding types', (t) => {
  const findingTypes = [
    'network_silent_failure',
    'validation_silent_failure',
    'missing_feedback_failure',
    'no_effect_silent_failure',
    'missing_network_action',
    'missing_state_action',
    'navigation_silent_failure',
    'partial_navigation_failure'
  ];

  const baseParams = {
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: { totalRequests: 5 },
      console: { totalMessages: 2 },
      uiSignals: { diff: { changed: false } }
    },
    comparisons: {
      hasUrlChange: false,
      hasDomChange: false,
      hasVisibleChange: false
    },
    attemptMeta: {}
  };

  for (const findingType of findingTypes) {
    const params = { ...baseParams, findingType };
    const result = computeConfidence(params);
    
    t.true(typeof result.score === 'number', `${findingType}: score should be a number`);
    t.true(result.score >= 0 && result.score <= 100, `${findingType}: score should be in range`);
    t.true(['HIGH', 'MEDIUM', 'LOW'].includes(result.level), `${findingType}: level should be valid`);
  }
});

// ============================================================
// TEST 6: Score Clamping to [0, 100]
// ============================================================

test('confidence scores are clamped to [0, 100]', (t) => {
  // All valid findings should produce scores in the 0-100 range
  const testCases = [
    { findingType: 'network_silent_failure', expectation: { proof: 'PROVEN_EXPECTATION' }, sensors: { network: {}, console: {}, uiSignals: {} }, comparisons: {} },
    { findingType: 'no_effect_silent_failure', expectation: { proof: 'WEAK' }, sensors: { network: {}, console: {}, uiSignals: {} }, comparisons: {} },
    { findingType: 'missing_feedback_failure', expectation: {}, sensors: { network: {}, console: {}, uiSignals: {} }, comparisons: {} }
  ];

  for (const params of testCases) {
    const result = computeConfidence(params);
    t.true(result.score >= 0, `Score ${result.score} should be >= 0`);
    t.true(result.score <= 100, `Score ${result.score} should be <= 100`);
    t.true(Number.isInteger(result.score), `Score ${result.score} should be an integer`);
  }
});
