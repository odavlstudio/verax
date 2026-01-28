/**
 * TRUST FIX 1: Aria-live false positive regression test
 * 
 * Ensures that when a button click triggers aria-live text feedback,
 * VERAX does NOT report a silent failure.
 * 
 * This test locks the contract: "If ANY in-scope user-visible acknowledgment exists,
 * VERAX MUST NOT report a Silent Failure for that interaction."
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { computeDOMDiff } from '../src/cli/util/observation/dom-diff.js';
import { EvidenceBundle } from '../src/cli/util/evidence/evidence-engine.js';

describe('TRUST FIX 1: Aria-live text feedback prevents silent failure', () => {
  it('click → aria-live text update ⇒ feedbackSeen = true', () => {
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
    
    const domDiff = computeDOMDiff(htmlBefore, htmlAfter);
    
    // Assert that text content change was detected
    assert.ok(domDiff.contentChanged.length > 0, 'Text content change should be detected');
    assert.ok(domDiff.isMeaningful, 'Change should be marked as meaningful');
    
    // Create evidence bundle and analyze
    const bundle = new EvidenceBundle('test-promise', 1, '/tmp/test');
    bundle.beforeHTML = htmlBefore;
    bundle.afterHTML = htmlAfter;
    bundle.analyzeChanges('http://test.com', 'http://test.com', null, null);
    
    // CRITICAL: feedbackSeen MUST be true
    assert.strictEqual(
      bundle.signals.feedbackSeen,
      true,
      'feedbackSeen must be true when aria-live text appears'
    );
    assert.strictEqual(
      bundle.signals.meaningfulDomChange,
      true,
      'meaningfulDomChange must be true'
    );
  });
  
  it('no text change in aria-live ⇒ feedbackSeen = false', () => {
    const htmlBefore = `
      <!DOCTYPE html>
      <html>
      <body>
        <button id="test">Test</button>
        <p id="result" aria-live="polite"></p>
      </body>
      </html>
    `;
    
    const htmlAfter = htmlBefore; // No change
    
    const bundle = new EvidenceBundle('test-promise', 2, '/tmp/test');
    bundle.beforeHTML = htmlBefore;
    bundle.afterHTML = htmlAfter;
    bundle.analyzeChanges('http://test.com', 'http://test.com', null, null);
    
    // No feedback should be detected when nothing changed
    assert.strictEqual(
      bundle.signals.feedbackSeen,
      false,
      'feedbackSeen must be false when no feedback occurs'
    );
  });
  
  it('aria-live region exists but empty → no false positive', () => {
    const htmlBefore = `
      <!DOCTYPE html>
      <html>
      <body>
        <button id="clear">Clear</button>
        <div aria-live="polite">Initial message</div>
      </body>
      </html>
    `;
    
    const htmlAfter = `
      <!DOCTYPE html>
      <html>
      <body>
        <button id="clear">Clear</button>
        <div aria-live="polite"></div>
      </body>
      </html>
    `;
    
    const bundle = new EvidenceBundle('test-promise', 3, '/tmp/test');
    bundle.beforeHTML = htmlBefore;
    bundle.afterHTML = htmlAfter;
    bundle.analyzeChanges('http://test.com', 'http://test.com', null, null);
    
    // Clearing text is still a change, so feedbackSeen should be true
    assert.strictEqual(
      bundle.signals.feedbackSeen,
      true,
      'feedbackSeen should detect text removal in aria-live regions'
    );
  });
});
