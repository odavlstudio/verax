import { strictEqual, _deepStrictEqual } from 'node:assert';
import { describe, it } from 'node:test';
import { redactTextSnippet, analyzeMutationSummary } from '../src/cli/util/observation/ui-mutation-tracker.js';

/**
 * UI Mutation Tracker Unit Tests
 * Tests redaction and mutation analysis logic
 */

describe('UI Mutation Tracker - Text Redaction', () => {
  it('should redact email addresses', () => {
    const text = 'Contact us at support@example.com for help';
    const redacted = redactTextSnippet(text);
    strictEqual(redacted.includes('support@example.com'), false);
    strictEqual(redacted.includes('[EMAIL]'), true);
  });

  it('should redact long tokens (32+ alphanumeric)', () => {
    const token = 'a'.repeat(32);
    const text = `Your token is ${token}`;
    const redacted = redactTextSnippet(text);
    strictEqual(redacted.includes(token), false);
    strictEqual(redacted.includes('[TOKEN]'), true);
  });

  it('should redact credit card patterns', () => {
    const text = 'Card: 4532-1234-5678-9010';
    const redacted = redactTextSnippet(text);
    strictEqual(redacted.includes('4532-1234-5678-9010'), false);
    strictEqual(redacted.includes('[CARD]'), true);
  });

  it('should not redact normal text', () => {
    const text = 'Hello world, this is normal text';
    const redacted = redactTextSnippet(text);
    strictEqual(redacted, text);
  });

  it('should redact multiple patterns', () => {
    const text = 'Email: test@example.com, Token: ' + 'x'.repeat(40);
    const redacted = redactTextSnippet(text);
    strictEqual(redacted.includes('[EMAIL]'), true);
    strictEqual(redacted.includes('[TOKEN]'), true);
  });
});

describe('UI Mutation Tracker - Mutation Analysis', () => {
  it('should detect substantial DOM change (>5 nodes)', () => {
    const summary = {
      nodesAdded: 6,
      nodesRemoved: 0,
      attributeChanges: {},
      textChanges: []
    };
    const analysis = analyzeMutationSummary(summary);
    strictEqual(analysis.meaningful, true);
    strictEqual(analysis.reason, 'substantial-dom-change');
  });

  it('should detect accessibility state change (>2 attrs)', () => {
    const summary = {
      nodesAdded: 0,
      nodesRemoved: 0,
      attributeChanges: {
        disabled: 2,
        'aria-invalid': 1
      },
      textChanges: []
    };
    const analysis = analyzeMutationSummary(summary);
    strictEqual(analysis.meaningful, true);
    strictEqual(analysis.reason, 'accessibility-state-change');
  });

  it('should detect text content change', () => {
    const summary = {
      nodesAdded: 0,
      nodesRemoved: 0,
      attributeChanges: {},
      textChanges: ['Success message appeared']
    };
    const analysis = analyzeMutationSummary(summary);
    strictEqual(analysis.meaningful, true);
    strictEqual(analysis.reason, 'text-content-change');
  });

  it('should not detect meaningful change for minor mutations', () => {
    const summary = {
      nodesAdded: 2,
      nodesRemoved: 1,
      attributeChanges: { class: 1 },
      textChanges: []
    };
    const analysis = analyzeMutationSummary(summary);
    strictEqual(analysis.meaningful, false);
  });

  it('should not detect meaningful change for empty summary', () => {
    const summary = {
      nodesAdded: 0,
      nodesRemoved: 0,
      attributeChanges: {},
      textChanges: []
    };
    const analysis = analyzeMutationSummary(summary);
    strictEqual(analysis.meaningful, false);
  });
});
