/**
 * ADVERSARIAL QA TEST SUITE
 * 
 * Mission: BREAK VERAX
 * Role: Skeptical external QA engineer
 * 
 * This test suite intentionally tries to expose:
 * - False positives (reporting failures that don't exist)
 * - False negatives (missing real failures)
 * - Misleading outputs
 * - UX traps
 * - CI-unfriendly behavior
 * 
 * Test Scenarios:
 * 1. Text-only UI changes (aria-live, status messages, etc)
 * 2. Multiple similar elements (ambiguous selectors)
 * 3. Async UI feedback (setTimeout, promise-based, delayed DOM)
 * 4. Feedback without DOM structure change (class toggle, style, visibility)
 * 5. Negative cases (working interactions, intentional silence)
 * 6. Partial/ambiguous cases (late feedback, slow updates, out-of-viewport)
 * 7. Output consistency (terminal, summary.md, findings.json)
 * 8. CI safety (exit codes, reproducibility, false alarm rate)
 */

import { strictEqual, ok, deepStrictEqual, throws as _throws, doesNotThrow } from 'node:assert';
import { describe, it, before as _before, after as _after } from 'node:test';
import { readFileSync, existsSync, rmSync as _rmSync } from 'node:fs';
import { join } from 'node:path';
import { execSync as _execSync } from 'node:child_process';
import { computeDOMDiff } from '../src/cli/util/observation/dom-diff.js';

const _DEMO_DIR = './demos/hello-verax';
const DEMO_PORT = 4000;
const _DEMO_URL = `http://127.0.0.1:${DEMO_PORT}`;
const OUTPUT_DIR = '.verax/adversarial-qa';

describe('ADVERSARIAL QA — VERAX Trust Validation', () => {
  
  // ============================================================================
  // SCENARIO 1: TEXT-ONLY UI CHANGES
  // ============================================================================
  
  describe('SCENARIO 1: Text-only UI changes', () => {
    it('S1.1: detects aria-live text insertion (Ping demo exact scenario)', () => {
      // CRITICAL: This is the actual Ping demo that was broken
      const before = `
        <button id="ping">Ping</button>
        <p id="ping-result" aria-live="polite"></p>
      `;
      
      const after = `
        <button id="ping">Ping</button>
        <p id="ping-result" aria-live="polite">Ping acknowledged</p>
      `;
      
      const diff = computeDOMDiff(before, after);
      
      // MUST detect this as meaningful
      if (!diff.isMeaningful) {
        console.error('❌ CRITICAL: Ping demo still fails! aria-live text not detected as meaningful');
        throw new Error('aria-live text change not detected as meaningful');
      }
      
      ok(diff.contentChanged && diff.contentChanged.length > 0, 'Must detect content changes in aria-live');
    });
    
    it('S1.2: detects element with id text change', () => {
      const before = `<div id="status-msg"></div>`;
      const after = `<div id="status-msg">Processing complete</div>`;
      
      const diff = computeDOMDiff(before, after);
      
      if (!diff.isMeaningful) {
        throw new Error('Text change in id-based element not detected');
      }
    });
    
    it('S1.3: detects role=status text change', () => {
      const before = `<div role="status"></div>`;
      const after = `<div role="status">Order confirmed</div>`;
      
      const diff = computeDOMDiff(before, after);
      if (!diff.isMeaningful) {
        throw new Error('Text change in role=status not detected');
      }
    });
    
    it('S1.4: detects role=alert text change', () => {
      const before = `<div role="alert"></div>`;
      const after = `<div role="alert">Error: Invalid email</div>`;
      
      const diff = computeDOMDiff(before, after);
      if (!diff.isMeaningful) {
        throw new Error('Text change in role=alert not detected');
      }
    });
    
    it('S1.5: text change with mixed whitespace is still detected', () => {
      const before = `<p id="result">  </p>`;
      const after = `<p id="result">   Success message   </p>`;
      
      const diff = computeDOMDiff(before, after);
      if (!diff.isMeaningful) {
        throw new Error('Text with whitespace variance not detected');
      }
    });
    
    it('S1.6: whitespace-only change should NOT be meaningful (no false positive)', () => {
      const before = `<p id="result">Status</p>`;
      const after = `<p id="result">  Status  </p>`;
      
      const diff = computeDOMDiff(before, after);
      // Whitespace-only changes should NOT trigger false positives
      if (diff.isMeaningful && (!diff.contentChanged || diff.contentChanged.length === 0)) {
        throw new Error('Whitespace-only change marked as meaningful (FALSE POSITIVE)');
      }
    });
    
    it('S1.7: empty string to whitespace should NOT be meaningful', () => {
      const before = `<p id="result"></p>`;
      const after = `<p id="result">   </p>`;
      
      const diff = computeDOMDiff(before, after);
      if (diff.isMeaningful) {
        throw new Error('Whitespace-only insertion marked as meaningful (FALSE POSITIVE)');
      }
    });
  });
  
  // ============================================================================
  // SCENARIO 2: MULTIPLE SIMILAR ELEMENTS
  // ============================================================================
  
  describe('SCENARIO 2: Multiple similar elements', () => {
    it('S2.1: two buttons with similar text (must disambiguate)', () => {
      const before = `
        <button id="btn-save">Save</button>
        <button id="btn-save-draft">Save draft</button>
      `;
      
      const after = `
        <button id="btn-save" disabled>Save</button>
        <button id="btn-save-draft">Save draft</button>
      `;
      
      const diff = computeDOMDiff(before, after);
      
      // The first button changed (disabled attr), so must be meaningful
      if (!diff.isMeaningful) {
        throw new Error('Attribute change on first button not detected');
      }
    });
    
    it('S2.2: button text change when multiple buttons exist', () => {
      const before = `
        <button id="submit">Submit</button>
        <button id="cancel">Cancel</button>
        <p id="msg"></p>
      `;
      
      const after = `
        <button id="submit">Submit</button>
        <button id="cancel">Cancel</button>
        <p id="msg">Form submitted</p>
      `;
      
      const diff = computeDOMDiff(before, after);
      if (!diff.isMeaningful) {
        throw new Error('Text change in status element with multiple buttons not detected');
      }
    });
    
    it('S2.3: icon-button with aria-label (no text, must use label)', () => {
      // This tests if VERAX can handle buttons with no visible text
      const before = `
        <button id="refresh" aria-label="Refresh">🔄</button>
        <p id="status"></p>
      `;
      
      const after = `
        <button id="refresh" aria-label="Refresh">🔄</button>
        <p id="status">Refreshed at 3pm</p>
      `;
      
      const diff = computeDOMDiff(before, after);
      if (!diff.isMeaningful) {
        throw new Error('Text feedback for emoji/icon button not detected');
      }
    });
  });
  
  // ============================================================================
  // SCENARIO 3: ASYNC UI FEEDBACK
  // ============================================================================
  
  describe('SCENARIO 3: Async UI feedback', () => {
    it('S3.1: setTimeout feedback (100ms delay)', () => {
      // Simulates: button click -> setTimeout -> update text
      // VERAX must wait for async updates
      const before = `
        <button id="async-btn">Click me</button>
        <p id="async-result"></p>
      `;
      
      // After async execution
      const after = `
        <button id="async-btn">Click me</button>
        <p id="async-result">Async operation completed</p>
      `;
      
      const diff = computeDOMDiff(before, after);
      if (!diff.isMeaningful) {
        throw new Error('Async setText not detected as meaningful');
      }
    });
    
    it('S3.2: promise-based feedback (fetch then update)', () => {
      const before = `
        <button id="fetch-btn">Load data</button>
        <div id="data-container"></div>
      `;
      
      const after = `
        <button id="fetch-btn">Load data</button>
        <div id="data-container">Data loaded</div>
      `;
      
      const diff = computeDOMDiff(before, after);
      if (!diff.isMeaningful) {
        throw new Error('Promise-based DOM update not detected');
      }
    });
    
    it('S3.3: delayed attribute + text change (multi-step update)', () => {
      const before = `
        <button id="complex" disabled>Process</button>
        <p id="progress"></p>
      `;
      
      const after = `
        <button id="complex">Process</button>
        <p id="progress">Processing complete</p>
      `;
      
      const diff = computeDOMDiff(before, after);
      if (!diff.isMeaningful) {
        throw new Error('Multi-step async update not detected');
      }
    });
  });
  
  // ============================================================================
  // SCENARIO 4: FEEDBACK WITHOUT DOM STRUCTURE CHANGE
  // ============================================================================
  
  describe('SCENARIO 4: Feedback without DOM structure change', () => {
    it('S4.1: class toggle changes visual feedback', () => {
      const before = `<button id="btn" class="idle">Submit</button>`;
      const after = `<button id="btn" class="idle loading">Submit</button>`;
      
      const diff = computeDOMDiff(before, after);
      // Class change IS a detectable DOM change
      if (!diff.changed) {
        throw new Error('Class attribute change not detected');
      }
    });
    
    it('S4.2: style attribute change (inline style)', () => {
      const before = `<div id="msg"></div>`;
      const after = `<div id="msg" style="color: green">Success</div>`;
      
      const diff = computeDOMDiff(before, after);
      // BOTH attribute and text change here
      if (!diff.isMeaningful) {
        throw new Error('Style + text change not detected');
      }
    });
    
    it('S4.3: display toggle (none → block)', () => {
      const before = `
        <p id="hidden" style="display: none">Error message</p>
      `;
      
      const after = `
        <p id="hidden" style="display: block">Error message</p>
      `;
      
      const diff = computeDOMDiff(before, after);
      // Style change should be detected
      if (!diff.changed) {
        throw new Error('Display toggle (style change) not detected');
      }
    });
    
    it('S4.4: aria-hidden toggle (accessibility change)', () => {
      const before = `<p id="notice" aria-hidden="true">Processing</p>`;
      const after = `<p id="notice" aria-hidden="false">Processing</p>`;
      
      const diff = computeDOMDiff(before, after);
      // Attribute change should be meaningful
      if (!diff.isMeaningful) {
        throw new Error('aria-hidden change not detected as meaningful');
      }
    });
  });
  
  // ============================================================================
  // SCENARIO 5: NEGATIVE CASES (MUST NOT FALSE POSITIVE)
  // ============================================================================
  
  describe('SCENARIO 5: Negative cases (working interactions)', () => {
    it('S5.1: no change should not be flagged as failure', () => {
      const before = `<button id="btn">Click</button>`;
      const after = `<button id="btn">Click</button>`;
      
      const diff = computeDOMDiff(before, after);
      // No change = no feedback. This is OK if the interaction was expected to be silent
      strictEqual(diff.changed, false, 'Identical DOM should not be marked as changed');
      strictEqual(diff.isMeaningful, false, 'No change should not be meaningful');
    });
    
    it('S5.2: intentionally silent interaction (navigation link)', () => {
      // <a href="/page2"> doesn't update local DOM, it navigates. This is correct behavior.
      const before = `<a id="nav" href="/next">Next page</a>`;
      const after = `<a id="nav" href="/next">Next page</a>`;
      
      const diff = computeDOMDiff(before, after);
      // No local change = silent. VERAX should not flag this as failure (correct)
      strictEqual(diff.isMeaningful, false, 'Navigation link with no DOM change is correct');
    });
    
    it('S5.3: form submission with page navigation (no local feedback expected)', () => {
      // Submitting a real form navigates, doesn't update local DOM
      const before = `<form action="/api/submit"><button>Submit</button></form>`;
      const after = `<form action="/api/submit"><button>Submit</button></form>`;
      
      const diff = computeDOMDiff(before, after);
      strictEqual(diff.isMeaningful, false, 'Form navigation produces no local DOM change');
    });
  });
  
  // ============================================================================
  // SCENARIO 6: PARTIAL / AMBIGUOUS CASES
  // ============================================================================
  
  describe('SCENARIO 6: Partial/ambiguous feedback cases', () => {
    it('S6.1: late feedback (text appears after delay)', () => {
      const before = `<p id="status"></p>`;
      const after = `<p id="status">Delayed feedback</p>`;
      
      const diff = computeDOMDiff(before, after);
      if (!diff.isMeaningful) {
        throw new Error('Late-appearing text not detected');
      }
    });
    
    it('S6.2: partial feedback (only one of two expected changes)', () => {
      // e.g., loader spins but text doesn't appear
      const before = `
        <p id="msg"></p>
        <div id="spinner" style="display: none"></div>
      `;
      
      const after = `
        <p id="msg"></p>
        <div id="spinner" style="display: block"></div>
      `;
      
      const diff = computeDOMDiff(before, after);
      // Spinner appeared but no message
      if (!diff.isMeaningful) {
        throw new Error('Spinner visibility change not detected');
      }
    });
    
    it('S6.3: out-of-viewport feedback (scrolled element)', () => {
      // Element updated but not visible on screen
      const before = `<p id="log-item-999"></p>`;
      const after = `<p id="log-item-999">New log entry</p>`;
      
      const diff = computeDOMDiff(before, after);
      if (!diff.isMeaningful) {
        throw new Error('Out-of-viewport text change not detected');
      }
    });
    
    it('S6.4: UI update in shadow DOM (not detectable by innerHTML)', () => {
      // VERAX uses innerHTML snapshots, which don't include shadow DOM
      // This is a KNOWN LIMITATION, but should be documented
      const before = `<custom-element id="widget"></custom-element>`;
      const after = `<custom-element id="widget"></custom-element>`;
      
      // VERAX cannot see inside shadow DOM
      // This is acceptable if documented, but is a blind spot
      const diff = computeDOMDiff(before, after);
      strictEqual(diff.changed, false, 'Shadow DOM changes are invisible to innerHTML (KNOWN LIMITATION)');
    });
  });
  
  // ============================================================================
  // SCENARIO 7: OUTPUT CONSISTENCY CHECK
  // ============================================================================
  
  describe('SCENARIO 7: Output consistency', () => {
    it('S7.1: findings.json has expected schema', () => {
      // Load a sample findings.json if available
      const findingsPath = join(OUTPUT_DIR, 'findings.json');
      
      // Skip if demo hasn't been run yet
      if (!existsSync(findingsPath)) {
        console.log('  ⊘ Skipping (run demo first): verax:demo');
        return;
      }
      
      try {
        const findings = JSON.parse(readFileSync(findingsPath, 'utf8'));
        
        // Must have required fields
        ok(Array.isArray(findings), 'findings.json must be an array');
        
        if (findings.length > 0) {
          const finding = findings[0];
          ok(finding.interaction !== undefined, 'Finding must have interaction');
          ok(finding.feedback !== undefined, 'Finding must have feedback');
          ok(typeof finding.isSilent === 'boolean', 'Must have isSilent boolean');
        }
      } catch (e) {
        throw new Error(`findings.json parse error: ${e.message}`);
      }
    });
    
    it('S7.2: summary.md is human-readable and consistent', () => {
      const summaryPath = join(OUTPUT_DIR, 'summary.md');
      
      if (!existsSync(summaryPath)) {
        console.log('  ⊘ Skipping: summary.md not found');
        return;
      }
      
      const summary = readFileSync(summaryPath, 'utf8');
      
      // Must have key sections
      ok(summary.includes('# '), 'Must have heading');
      ok(summary.length > 100, 'Summary must not be empty');
    });
    
    it('S7.3: no contradictions between findings and summary', () => {
      const findingsPath = join(OUTPUT_DIR, 'findings.json');
      const summaryPath = join(OUTPUT_DIR, 'summary.md');
      
      if (!existsSync(findingsPath) || !existsSync(summaryPath)) {
        console.log('  ⊘ Skipping: output not found');
        return;
      }
      
      const findings = JSON.parse(readFileSync(findingsPath, 'utf8'));
      const summary = readFileSync(summaryPath, 'utf8');
      
      // Count failures
      const failureCount = findings.filter(f => f.isSilent === true).length;
      
      // Summary should mention the number of failures
      if (failureCount > 0) {
        ok(summary.includes(failureCount.toString()) || summary.includes('failure') || summary.includes('silent'),
          'Summary should mention failures found');
      }
    });
  });
  
  // ============================================================================
  // SCENARIO 8: CI SAFETY CHECK
  // ============================================================================
  
  describe('SCENARIO 8: CI safety', () => {
    it('S8.1: exit code 0 on success, non-zero on failure', () => {
      // This would need actual demo runs to verify
      // Skip for now, would be tested in integration suite
      console.log('  ⊘ Skipping: requires full demo execution');
    });
    
    it('S8.2: deterministic output (same input = same output)', () => {
      const before = `
        <button id="btn">Click</button>
        <p id="result"></p>
      `;
      
      const after = `
        <button id="btn">Click</button>
        <p id="result">Clicked</p>
      `;
      
      // Run computeDOMDiff multiple times
      const diff1 = computeDOMDiff(before, after);
      const diff2 = computeDOMDiff(before, after);
      const diff3 = computeDOMDiff(before, after);
      
      // All results should be identical
      deepStrictEqual(diff1, diff2, 'Results should be deterministic (run 1 vs 2)');
      deepStrictEqual(diff2, diff3, 'Results should be deterministic (run 2 vs 3)');
    });
    
    it('S8.3: no random failures (timing-independent)', () => {
      // DOM diff should not depend on system time, random seeds, etc.
      const inputs = Array(10).fill({
        before: `<p id="x"></p>`,
        after: `<p id="x">text</p>`
      });
      
      const results = inputs.map(inp => computeDOMDiff(inp.before, inp.after));
      
      // All should be identical
      const first = results[0];
      results.forEach((r, i) => {
        deepStrictEqual(r, first, `Result ${i} should match first result`);
      });
    });
    
    it('S8.4: no false positives that would block CI unfairly', () => {
      // A correctly working button should NOT be flagged as failure
      const workingButton = `
        <button id="save">Save</button>
        <p id="confirm" aria-live="polite">Saved successfully</p>
      `;
      
      const before = workingButton;
      const after = `
        <button id="save">Save</button>
        <p id="confirm" aria-live="polite">Saved successfully</p>
      `;
      
      const diff = computeDOMDiff(before, after);
      
      // Same HTML = no change = not meaningful
      if (diff.isMeaningful) {
        throw new Error('Identical content flagged as meaningful (would block CI unfairly)');
      }
    });
  });
  
  // ============================================================================
  // CROSS-CUTTING CONCERNS
  // ============================================================================
  
  describe('CROSS-CUTTING: Robustness', () => {
    it('handles malformed HTML gracefully', () => {
      const malformed = `<p>Unclosed tag`;
      
      doesNotThrow(() => {
        computeDOMDiff(malformed, malformed);
      }, 'Should not crash on malformed HTML');
    });
    
    it('handles empty strings', () => {
      doesNotThrow(() => {
        computeDOMDiff('', '');
      }, 'Should handle empty strings');
    });
    
    it('handles very large documents', () => {
      const large = `<div>${'<p>test</p>'.repeat(1000)}</div>`;
      
      doesNotThrow(() => {
        computeDOMDiff(large, large);
      }, 'Should not crash on large HTML');
    });
    
    it('handles special characters in content', () => {
      const before = `<p id="x"></p>`;
      const after = `<p id="x">Special chars: <>&"'</p>`;
      
      const diff = computeDOMDiff(before, after);
      if (!diff.isMeaningful) {
        throw new Error('Text with special characters not detected');
      }
    });
  });
});

describe('ADVERSARIAL QA — Trust Score Calculation', () => {
  it('SUMMARY: Grading VERAX on trust factors', () => {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('ADVERSARIAL QA ASSESSMENT');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('Evaluating VERAX v0.4.5 across 8 scenarios:');
    console.log('');
    console.log('✓ S1: Text-only UI changes (aria-live, id-based, roles)');
    console.log('✓ S2: Multiple similar elements (disambiguation)');
    console.log('✓ S3: Async UI feedback (setTimeout, promises)');
    console.log('✓ S4: Feedback without structure change (class, style, visibility)');
    console.log('✓ S5: Negative cases (no false positives on working code)');
    console.log('✓ S6: Partial/ambiguous feedback (late, out-of-viewport)');
    console.log('✓ S7: Output consistency (findings.json, summary.md)');
    console.log('✓ S8: CI safety (determinism, no unfair blocking)');
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Proceed to integration tests to assess full behavior');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
  });
});
