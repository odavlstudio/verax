/**
 * TRUST SURFACE LOCK: Finding ID Uniqueness Test
 * 
 * Ensures that all finding IDs in findings.json are unique
 * No duplicates allowed
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { detectSilentFailures } from '../src/cli/util/detection-engine.js';
import { createFinding } from '../src/verax/detect/finding-contract.js';

describe('TRUST SURFACE LOCK: Finding ID Uniqueness', () => {
  
  it('detectSilentFailures returns unique finding IDs', async () => {
    // Mock learn data with 3 expectations
    const learnData = {
      expectations: [
        {
          id: 'exp-1',
          type: 'button',
          selector: 'button#submit',
          promise: { type: 'click', value: 'Submit form' },
        },
        {
          id: 'exp-2',
          type: 'button',
          selector: 'button#cancel',
          promise: { type: 'click', value: 'Cancel' },
        },
        {
          id: 'exp-3',
          type: 'link',
          selector: 'a#home',
          promise: { type: 'navigation', value: '/home' },
        },
      ],
    };
    
    // Mock observe data with 3 observations (all silent failures)
    const observeData = {
      observations: [
        {
          id: 1,
          type: 'interaction',
          action: 'click',
          selector: 'button#submit',
          attempted: true,
          signals: {
            navigationChanged: false,
            meaningfulDomChange: false,
            feedbackSeen: false,
          },
          evidenceFiles: [],
        },
        {
          id: 2,
          type: 'interaction',
          action: 'click',
          selector: 'button#cancel',
          attempted: true,
          signals: {
            navigationChanged: false,
            meaningfulDomChange: false,
            feedbackSeen: false,
          },
          evidenceFiles: [],
        },
        {
          id: 3,
          type: 'interaction',
          action: 'click',
          selector: 'a#home',
          attempted: true,
          signals: {
            navigationChanged: false,
            meaningfulDomChange: false,
            feedbackSeen: false,
          },
          evidenceFiles: [],
        },
      ],
    };
    
    const findings = await detectSilentFailures(learnData, observeData);
    
    // Extract all IDs
    const ids = findings.map(f => f.id);
    
    // CRITICAL: All IDs must be unique
    const uniqueIds = new Set(ids);
    assert.strictEqual(
      uniqueIds.size,
      ids.length,
      `Finding IDs must be unique. Found ${ids.length} findings but only ${uniqueIds.size} unique IDs. Duplicates: ${findDuplicates(ids).join(', ')}`
    );
  });
  
  it('createFinding generates stable IDs for identical inputs', () => {
    const input = {
      type: 'dead_interaction_silent_failure',
      status: 'SUSPECTED',
      confidence: 0.7,
      promise: { type: 'click', value: 'Submit' },
      observed: { result: 'No change' },
      evidence: { action_attempted: true },
      interaction: { type: 'button', selector: 'button#test' },
    };
    
    const finding1 = createFinding(input);
    const finding2 = createFinding(input);
    
    // Same input should produce same ID
    assert.strictEqual(finding1.id, finding2.id);
  });
  
  it('createFinding generates different IDs for different inputs', () => {
    const input1 = {
      type: 'dead_interaction_silent_failure',
      promise: { type: 'click', value: 'Submit' },
      interaction: { type: 'click', selector: 'button#submit' },
    };
    
    const input2 = {
      type: 'dead_interaction_silent_failure',
      promise: { type: 'click', value: 'Cancel' },
      interaction: { type: 'click', selector: 'button#cancel' },
    };
    
    const finding1 = createFinding(input1);
    const finding2 = createFinding(input2);
    
    // Different inputs should produce different IDs
    assert.notStrictEqual(finding1.id, finding2.id);
  });
  
  it('no duplicate IDs even with similar findings', () => {
    // Create 10 findings with slightly different selectors
    const findings = [];
    for (let i = 0; i < 10; i++) {
      const finding = createFinding({
        type: 'dead_interaction_silent_failure',
        promise: { type: 'click', value: 'Button' },
        interaction: { type: 'click', selector: `button#btn-${i}` },
      });
      findings.push(finding);
    }
    
    const ids = findings.map(f => f.id);
    const uniqueIds = new Set(ids);
    
    assert.strictEqual(
      uniqueIds.size,
      10,
      `Expected 10 unique IDs, got ${uniqueIds.size}. Duplicates: ${findDuplicates(ids).join(', ')}`
    );
  });
});

/**
 * Helper: Find duplicate values in array
 */
function findDuplicates(arr) {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of arr) {
    if (seen.has(item)) {
      duplicates.add(item);
    }
    seen.add(item);
  }
  return Array.from(duplicates);
}
