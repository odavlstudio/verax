import { strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';
import { 
  classifyInteractionIntent, 
  evaluateAcknowledgment,
  calculateInteractionConfidence,
  createBoundedSelectorPath,
  generateInteractionIntentId
} from '../src/cli/util/observation/interaction-intent-engine.js';

/**
 *  Interaction Intent Engine Unit Tests
 * Tests intent classification logic (visible, disabled, noop, accessibility)
 */

describe('Interaction Intent Engine - Classification', () => {
  it('should classify visible, enabled button as intentful', () => {
    const record = {
      visible: true,
      disabled: false,
      ariaDisabled: false,
      tagName: 'BUTTON',
      boundingBox: { width: 100, height: 40 },
    };
    const result = classifyInteractionIntent(record);
    strictEqual(result.intentful, true);
  });

  it('should reject disabled elements', () => {
    const record = {
      visible: true,
      disabled: true,
      ariaDisabled: false,
      tagName: 'BUTTON',
      boundingBox: { width: 100, height: 40 },
    };
    const result = classifyInteractionIntent(record);
    strictEqual(result.intentful, false);
    strictEqual(result.reason, 'disabled');
  });

  it('should reject aria-disabled elements', () => {
    const record = {
      visible: true,
      disabled: false,
      ariaDisabled: true,
      tagName: 'BUTTON',
      boundingBox: { width: 100, height: 40 },
    };
    const result = classifyInteractionIntent(record);
    strictEqual(result.intentful, false);
    strictEqual(result.reason, 'disabled');
  });

  it('should reject invisible elements', () => {
    const record = {
      visible: false,
      disabled: false,
      ariaDisabled: false,
      tagName: 'BUTTON',
      boundingBox: { width: 0, height: 40 },
    };
    const result = classifyInteractionIntent(record);
    strictEqual(result.intentful, false);
    strictEqual(result.reason, 'not-visible');
  });

  it('should reject anchor with href="#" (noop)', () => {
    const record = {
      visible: true,
      disabled: false,
      ariaDisabled: false,
      tagName: 'A',
      href: { present: true, kind: 'noop_hash' },
      boundingBox: { width: 50, height: 20 },
    };
    const result = classifyInteractionIntent(record);
    strictEqual(result.intentful, false);
    strictEqual(result.reason, 'noop-marker');
  });

  it('should reject element with role=presentation', () => {
    const record = {
      visible: true,
      disabled: false,
      ariaDisabled: false,
      tagName: 'DIV',
      role: 'presentation',
      boundingBox: { width: 100, height: 40 },
    };
    const result = classifyInteractionIntent(record);
    strictEqual(result.intentful, false);
    strictEqual(result.reason, 'noop-marker');
  });

  it('should reject element with role=none', () => {
    const record = {
      visible: true,
      disabled: false,
      ariaDisabled: false,
      tagName: 'SPAN',
      role: 'none',
      boundingBox: { width: 100, height: 40 },
    };
    const result = classifyInteractionIntent(record);
    strictEqual(result.intentful, false);
    strictEqual(result.reason, 'noop-marker');
  });

  it('should reject button with type=button and no onclick/form', () => {
    const record = {
      visible: true,
      disabled: false,
      ariaDisabled: false,
      tagName: 'BUTTON',
      type: 'button',
      hasOnClick: false,
      hasForm: false,
      boundingBox: { width: 100, height: 40 },
    };
    const result = classifyInteractionIntent(record);
    strictEqual(result.intentful, false);
    strictEqual(result.reason, 'noop-marker');
  });

  it('should accept button with onclick', () => {
    const record = {
      visible: true,
      disabled: false,
      ariaDisabled: false,
      tagName: 'BUTTON',
      type: 'button',
      hasOnClick: true,
      hasForm: false,
      boundingBox: { width: 100, height: 40 },
    };
    const result = classifyInteractionIntent(record);
    strictEqual(result.intentful, true);
  });

  it('should reject nav boilerplate (header/nav/footer) without role=menuitem', () => {
    const record = {
      visible: true,
      disabled: false,
      ariaDisabled: false,
      tagName: 'A',
      href: { present: true, kind: 'relative' },
      containerTagName: 'nav',
      role: null,
      boundingBox: { width: 100, height: 40 },
    };
    const result = classifyInteractionIntent(record);
    strictEqual(result.intentful, false);
    strictEqual(result.reason, 'nav-boilerplate');
  });

  it('should accept nav element with role=menuitem', () => {
    const record = {
      visible: true,
      disabled: false,
      ariaDisabled: false,
      tagName: 'A',
      href: { present: true, kind: 'relative' },
      containerTagName: 'nav',
      role: 'menuitem',
      boundingBox: { width: 100, height: 40 },
    };
    const result = classifyInteractionIntent(record);
    strictEqual(result.intentful, true);
  });

  it('should accept link in header with role=link', () => {
    const record = {
      visible: true,
      disabled: false,
      ariaDisabled: false,
      tagName: 'A',
      href: '/page',
      containerTagName: 'header',
      role: 'link',
      boundingBox: { width: 100, height: 40 },
    };
    const result = classifyInteractionIntent(record);
    strictEqual(result.intentful, true);
  });

  it('should reject invalid record', () => {
    const result = classifyInteractionIntent(null);
    strictEqual(result.intentful, false);
    strictEqual(result.reason, 'invalid-record');
  });
});

describe('Interaction Intent Engine - Acknowledgment Evaluation', () => {
  it('should detect acknowledgment with single signal', () => {
    const signals = {
      routeChanged: true,
      domChanged: false,
      feedbackAppeared: false,
    };
    const result = evaluateAcknowledgment(signals);
    strictEqual(result.acknowledged, true);
    strictEqual(result.signalCount, 1);
    strictEqual(result.signals.includes('routeChanged'), true);
  });

  it('should detect acknowledgment with multiple signals', () => {
    const signals = {
      routeChanged: true,
      domChanged: true,
      feedbackAppeared: true,
      correlatedNetworkActivity: true,
    };
    const result = evaluateAcknowledgment(signals);
    strictEqual(result.acknowledged, true);
    strictEqual(result.signalCount, 4);
  });

  it('should detect no acknowledgment with empty signals', () => {
    const signals = {
      routeChanged: false,
      domChanged: false,
      feedbackAppeared: false,
      correlatedNetworkActivity: false,
    };
    const result = evaluateAcknowledgment(signals);
    strictEqual(result.acknowledged, false);
    strictEqual(result.signalCount, 0);
  });

  it('should handle missing signals object', () => {
    const result = evaluateAcknowledgment(null);
    strictEqual(result.acknowledged, false);
    strictEqual(result.signalCount, 0);
  });

  it('should detect outcomeAcknowledged signal', () => {
    const signals = {
      outcomeAcknowledged: true,
      routeChanged: false,
    };
    const result = evaluateAcknowledgment(signals);
    strictEqual(result.acknowledged, true);
    strictEqual(result.signals.includes('outcomeAcknowledged'), true);
  });
});

describe('Interaction Intent Engine - Confidence Calculation', () => {
  it('should return base confidence 0.8 for standard element', () => {
    const record = {
      tagName: 'BUTTON',
      containerTagName: 'main',
    };
    const signals = {};
    const confidence = calculateInteractionConfidence(record, signals);
    strictEqual(confidence, 0.8);
  });

  it('should reduce confidence for nav element', () => {
    const record = {
      tagName: 'A',
      containerTagName: 'nav',
    };
    const signals = {};
    const confidence = calculateInteractionConfidence(record, signals);
    strictEqual(Math.abs(confidence - 0.7) < 0.0001, true);
  });

  it('should reduce confidence for nested button', () => {
    const record = {
      tagName: 'SPAN',
      containerTagName: 'main',
      nestedInButton: true,
    };
    const signals = {};
    const confidence = calculateInteractionConfidence(record, signals);
    strictEqual(Math.abs(confidence - 0.7) < 0.0001, true);
  });

  it('should floor confidence at 0.5', () => {
    const record = {
      tagName: 'SPAN',
      containerTagName: 'nav',
      nestedInButton: true,
    };
    const signals = {};
    const confidence = calculateInteractionConfidence(record, signals);
    strictEqual(confidence >= 0.5, true);
  });
});

describe('Interaction Intent Engine - Selector Path', () => {
  it('should create coarse location string (no selectors)', () => {
    const record = {
      containerTagName: 'main',
      tagName: 'BUTTON',
    };
    const path = createBoundedSelectorPath(record);
    strictEqual(path, 'main > button');
  });

  it('should handle missing container/tag', () => {
    const record = {
      // empty
    };
    const path = createBoundedSelectorPath(record);
    strictEqual(path, 'document > unknown');
  });
});

describe('Interaction Intent Engine - ID Generation', () => {
  it('should generate deterministic ID from record', () => {
    const record = {
      tagName: 'BUTTON',
      eventType: 'click',
      role: null,
      type: 'button',
      href: { present: false, kind: null },
      form: { associated: false, isSubmitControl: false },
      aria: { expanded: null, pressed: null, checked: null },
    };
    const id1 = generateInteractionIntentId(record);
    const id2 = generateInteractionIntentId(record);
    strictEqual(id1, id2);
  });

  it('should include tag name and event type in ID', () => {
    const record = {
      tagName: 'BUTTON',
      eventType: 'click',
      type: 'button',
      href: { present: false, kind: null },
      form: { associated: false, isSubmitControl: false },
      aria: { expanded: null, pressed: null, checked: null },
    };
    const id = generateInteractionIntentId(record);
    strictEqual(id.startsWith('interaction_'), true);
    strictEqual(typeof id, 'string');
  });

  it('should produce different IDs for different records', () => {
    const record1 = {
      tagName: 'BUTTON',
      eventType: 'click',
      type: 'button',
      href: { present: false, kind: null },
      form: { associated: false, isSubmitControl: false },
      aria: { expanded: null, pressed: null, checked: null },
    };
    const record2 = {
      tagName: 'A',
      eventType: 'click',
      role: 'link',
      href: { present: true, kind: 'relative' },
      form: { associated: false, isSubmitControl: false },
      aria: { expanded: null, pressed: null, checked: null },
    };
    const id1 = generateInteractionIntentId(record1);
    const id2 = generateInteractionIntentId(record2);
    strictEqual(id1 === id2, false);
  });
});
