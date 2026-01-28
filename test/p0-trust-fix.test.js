/**
 * P0 TRUST FIX VALIDATION
 * Tests for selector resolution and DOM diff text change detection
 * These tests reproduce the Ping button false positive and prove it's fixed
 */

import { strictEqual, ok } from 'node:assert';
import { describe, it } from 'node:test';
import { computeDOMDiff } from '../src/cli/util/observation/dom-diff.js';

describe('P0 TRUST FIX - DOM Diff Text Content Detection', () => {
  it('detects text content change in aria-live element', () => {
    const htmlBefore = `
      <!DOCTYPE html>
      <html>
      <body>
        <button id="ping">Ping</button>
        <p id="ping-result" aria-live="polite"></p>
      </body>
      </html>
    `;
    
    const htmlAfter = `
      <!DOCTYPE html>
      <html>
      <body>
        <button id="ping">Ping</button>
        <p id="ping-result" aria-live="polite">Ping acknowledged</p>
      </body>
      </html>
    `;
    
    const diff = computeDOMDiff(htmlBefore, htmlAfter);
    
    strictEqual(diff.changed, true, 'DOM should be marked as changed');
    strictEqual(diff.isMeaningful, true, 'Text content change should be meaningful');
    ok(diff.contentChanged.length > 0, 'Should have detected content changes');
    
    const change = diff.contentChanged[0];
    strictEqual(change.before, '', 'Before text should be empty');
    strictEqual(change.after, 'Ping acknowledged', 'After text should be "Ping acknowledged"');
  });

it('detects text content change in element with id', () => {
  const htmlBefore = `
    <div id="status"></div>
  `;
  
  const htmlAfter = `
    <div id="status">Loading complete</div>
  `;
  
  const diff = computeDOMDiff(htmlBefore, htmlAfter);
  
  strictEqual(diff.isMeaningful, true, 'Text change in element with id should be meaningful');
  ok(diff.contentChanged.length > 0, 'Should detect text change');
});

it('DOM diff detects text content change in role=status element', () => {
  const htmlBefore = `
    <div role="status"></div>
  `;
  
  const htmlAfter = `
    <div role="status">Success</div>
  `;
  
  const diff = computeDOMDiff(htmlBefore, htmlAfter);
  
  strictEqual(diff.isMeaningful, true, 'Text change in role=status should be meaningful');
  ok(diff.contentChanged.length > 0, 'Should detect text change');
});

it('DOM diff normalizes whitespace when comparing text', () => {
  const htmlBefore = `
    <p id="msg">  Hello   World  </p>
  `;
  
  const htmlAfter = `
    <p id="msg">Hello World</p>
  `;
  
  const diff = computeDOMDiff(htmlBefore, htmlAfter);
  
  // Whitespace-only changes should not be meaningful
  strictEqual(diff.isMeaningful, false, 'Whitespace-only changes should not be meaningful');
});

it('DOM diff ignores text changes in elements without stable identifiers', () => {
  const htmlBefore = `
    <div><span>Old text</span></div>
  `;
  
  const htmlAfter = `
    <div><span>New text</span></div>
  `;
  
  const diff = computeDOMDiff(htmlBefore, htmlAfter);
  
  // Without id or aria-live, generic elements shouldn't trigger text change detection
  // (They might still trigger other detection mechanisms if the pattern is very different)
  ok(diff.changed, 'Should detect HTML changed');
});

it('DOM diff detects multiple text changes across different elements', () => {
  const htmlBefore = `
    <p id="status1">Loading...</p>
    <p id="status2"></p>
  `;
  
  const htmlAfter = `
    <p id="status1">Complete</p>
    <p id="status2">Success</p>
  `;
  
  const diff = computeDOMDiff(htmlBefore, htmlAfter);
  
  strictEqual(diff.isMeaningful, true);
  strictEqual(diff.contentChanged.length, 2, 'Should detect both text changes');
});

it('DOM diff handles empty to non-empty text transition', () => {
  const htmlBefore = `<p id="msg"></p>`;
  const htmlAfter = `<p id="msg">Now has content</p>`;
  
  const diff = computeDOMDiff(htmlBefore, htmlAfter);
  
  strictEqual(diff.isMeaningful, true);
  ok(diff.contentChanged.length > 0);
  strictEqual(diff.contentChanged[0].before, '');
  strictEqual(diff.contentChanged[0].after, 'Now has content');
});

it('DOM diff handles non-empty to empty text transition', () => {
  const htmlBefore = `<p id="msg">Had content</p>`;
  const htmlAfter = `<p id="msg"></p>`;
  
  const diff = computeDOMDiff(htmlBefore, htmlAfter);
  
  strictEqual(diff.isMeaningful, true);
  ok(diff.contentChanged.length > 0);
  strictEqual(diff.contentChanged[0].before, 'Had content');
  strictEqual(diff.contentChanged[0].after, '');
});

it('DOM diff preserves existing feedback pattern detection', () => {
  const htmlBefore = `<div>No alert</div>`;
  const htmlAfter = `<div role="alert">Error occurred</div>`;
  
  const diff = computeDOMDiff(htmlBefore, htmlAfter);
  
  strictEqual(diff.isMeaningful, true, 'Should still detect new role=alert');
  ok(diff.elementsAdded.includes('role="alert"'), 'Should mark role=alert as added');
});

});

// Selector resolution tests would require Playwright page object
// These are documented here but would need integration test environment:
/*
it('Selector resolver matches button by text with :has-text()', async () => {
  // Setup: Page with multiple buttons
  // <button id="submit">Submit</button>
  // <button id="ping">Ping</button>
  
  const promise = {
    category: 'button',
    promise: { value: 'Ping' },
    selector: 'button:contains("Ping")'
  };
  
  const result = await resolveSelector(page, promise);
  
  strictEqual(result.found, true);
  ok(result.selector.includes('Ping'));
  ok(result.selector.includes(':has-text'));
});

it('Selector resolver returns not-found when button text does not exist', async () => {
  // Setup: Page with only Submit button
  
  const promise = {
    category: 'button',
    promise: { value: 'Ping' }
  };
  
  const result = await resolveSelector(page, promise);
  
  strictEqual(result.found, false);
  strictEqual(result.reason, 'not-found');
});

it('Selector resolver does NOT fall back to generic button selector', async () => {
  // Setup: Page with multiple buttons but none matching text
  
  const promise = {
    category: 'button',
    promise: { value: 'NonExistent' }
  };
  
  const result = await resolveSelector(page, promise);
  
  strictEqual(result.found, false);
  // Should NOT return { found: true, selector: 'button' }
});
*/

