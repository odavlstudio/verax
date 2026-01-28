/**
 * CONSTITUTIONAL SCOPE LOCK TESTS
 * 
 * These tests enforce the constitutional guarantee:
 * - Zero false negatives within declared scope
 * - Out-of-scope feedback never classified as "silent failure"
 * - Clear, honest reporting of scope boundaries
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { computeDOMDiff } from '../src/cli/util/observation/dom-diff.js';
import { getScopeDocumentation } from '../src/cli/util/observation/feedback-scope.js';

describe('CONSTITUTIONAL SCOPE LOCK', () => {
  
  //
  // SECTION 1: IN-SCOPE FEEDBACK GUARANTEES
  // These MUST be detected (zero false negatives)
  //
  
  describe('IN-SCOPE: Text Content Changes', () => {
    
    it('MUST detect text in aria-live regions', () => {
      const before = '<div aria-live="polite"></div>';
      const after = '<div aria-live="polite">Loading complete</div>';
      
      const diff = computeDOMDiff(before, after);
      
      assert.strictEqual(diff.changed, true, 'Should detect change');
      assert.strictEqual(diff.isMeaningful, true, 'MUST be meaningful');
      assert.strictEqual(diff.scopeClassification, 'in-scope', 'MUST be in-scope');
      assert.ok(diff.contentChanged.length > 0, 'MUST have content change record');
    });
    
    it('MUST detect text in elements with id', () => {
      const before = '<p id="status"></p>';
      const after = '<p id="status">Success</p>';
      
      const diff = computeDOMDiff(before, after);
      
      assert.strictEqual(diff.isMeaningful, true, 'MUST be meaningful');
      assert.strictEqual(diff.scopeClassification, 'in-scope', 'MUST be in-scope');
    });
    
    it('MUST detect text in role="alert"', () => {
      const before = '<div role="alert"></div>';
      const after = '<div role="alert">Error: Invalid input</div>';
      
      const diff = computeDOMDiff(before, after);
      
      assert.strictEqual(diff.isMeaningful, true, 'MUST be meaningful');
      assert.strictEqual(diff.scopeClassification, 'in-scope', 'MUST be in-scope');
    });
    
    it('MUST detect text in role="status"', () => {
      const before = '<div role="status"></div>';
      const after = '<div role="status">Processing...</div>';
      
      const diff = computeDOMDiff(before, after);
      
      assert.strictEqual(diff.isMeaningful, true, 'MUST be meaningful');
      assert.strictEqual(diff.scopeClassification, 'in-scope', 'MUST be in-scope');
    });
    
  });
  
  describe('IN-SCOPE: Whitelisted Attribute Changes', () => {
    
    it('MUST detect disabled attribute changes', () => {
      const before = '<button id="submit">Submit</button>';
      const after = '<button id="submit" disabled>Submit</button>';
      
      const diff = computeDOMDiff(before, after);
      
      assert.strictEqual(diff.isMeaningful, true, 'MUST be meaningful');
      assert.strictEqual(diff.scopeClassification, 'in-scope', 'MUST be in-scope');
      assert.ok(diff.attributesChanged.length > 0, 'MUST record attribute change');
    });
    
    it('MUST detect aria-invalid changes', () => {
      const before = '<input id="email" aria-invalid="false" />';
      const after = '<input id="email" aria-invalid="true" />';
      
      const diff = computeDOMDiff(before, after);
      
      assert.strictEqual(diff.isMeaningful, true, 'MUST be meaningful');
      assert.strictEqual(diff.scopeClassification, 'in-scope', 'MUST be in-scope');
    });
    
    it('MUST detect data-loading attribute', () => {
      const before = '<button id="load">Load</button>';
      const after = '<button id="load" data-loading="true">Load</button>';
      
      const diff = computeDOMDiff(before, after);
      
      assert.strictEqual(diff.isMeaningful, true, 'MUST be meaningful');
      assert.strictEqual(diff.scopeClassification, 'in-scope', 'MUST be in-scope');
    });
    
  });
  
  describe('IN-SCOPE: Feedback Element Addition', () => {
    
    it('MUST detect new role="alert" elements', () => {
      const before = '<div id="container"></div>';
      const after = '<div id="container"><div role="alert">Warning</div></div>';
      
      const diff = computeDOMDiff(before, after);
      
      assert.strictEqual(diff.isMeaningful, true, 'MUST be meaningful');
      assert.strictEqual(diff.scopeClassification, 'in-scope', 'MUST be in-scope');
      assert.ok(diff.elementsAdded.length > 0, 'MUST record element addition');
    });
    
    it('MUST detect new toast/error/success classes', () => {
      const before = '<div id="root"></div>';
      const after = '<div id="root"><div class="toast">Saved!</div></div>';
      
      const diff = computeDOMDiff(before, after);
      
      assert.strictEqual(diff.isMeaningful, true, 'MUST be meaningful');
      assert.strictEqual(diff.scopeClassification, 'in-scope', 'MUST be in-scope');
    });
    
  });
  
  //
  // SECTION 2: OUT-OF-SCOPE FEEDBACK CLASSIFICATION
  // These MUST NOT be classified as "silent failure"
  //
  
  describe('OUT-OF-SCOPE: Visual/Style Changes', () => {
    
    it('MUST classify display changes as out-of-scope (NOT silent failure)', () => {
      const before = '<div id="spinner" style="display: none">Loading...</div>';
      const after = '<div id="spinner" style="display: block">Loading...</div>';
      
      const diff = computeDOMDiff(before, after);
      
      // Critical assertion: This is NOT a silent failure
      assert.strictEqual(diff.changed, true, 'Should detect HTML change');
      assert.strictEqual(diff.scopeClassification, 'out-of-scope', 'MUST be out-of-scope');
      assert.strictEqual(diff.isMeaningful, false, 'Not meaningful in our scope');
      assert.ok(diff.outOfScopeExplanation, 'MUST provide explanation');
      assert.ok(
        diff.outOfScopeExplanation.summary.includes('visual feedback'),
        'MUST explain it\'s visual feedback'
      );
    });
    
    it('MUST classify visibility changes as out-of-scope', () => {
      const before = '<div id="modal" style="visibility: hidden">Modal</div>';
      const after = '<div id="modal" style="visibility: visible">Modal</div>';
      
      const diff = computeDOMDiff(before, after);
      
      assert.strictEqual(diff.scopeClassification, 'out-of-scope', 'MUST be out-of-scope');
      assert.ok(diff.outOfScopeExplanation, 'MUST provide explanation');
    });
    
    it('MUST classify opacity changes as out-of-scope', () => {
      const before = '<div style="opacity: 0">Fade</div>';
      const after = '<div style="opacity: 1">Fade</div>';
      
      const diff = computeDOMDiff(before, after);
      
      assert.strictEqual(diff.scopeClassification, 'out-of-scope', 'MUST be out-of-scope');
      assert.ok(diff.outOfScopeExplanation, 'MUST provide explanation');
    });
    
    it('MUST classify class changes (non-feedback) as out-of-scope', () => {
      const before = '<div class="hidden">Content</div>';
      const after = '<div class="visible">Content</div>';
      
      const diff = computeDOMDiff(before, after);
      
      assert.strictEqual(diff.scopeClassification, 'out-of-scope', 'MUST be out-of-scope');
      assert.ok(diff.outOfScopeExplanation, 'MUST provide explanation');
    });
    
  });
  
  describe('OUT-OF-SCOPE: Accessibility Attributes', () => {
    
    it('MUST classify aria-hidden changes as out-of-scope', () => {
      const before = '<nav aria-hidden="true">Menu</nav>';
      const after = '<nav aria-hidden="false">Menu</nav>';
      
      const diff = computeDOMDiff(before, after);
      
      // This was the critical false negative from adversarial QA
      assert.strictEqual(diff.scopeClassification, 'out-of-scope', 'MUST be out-of-scope');
      assert.ok(diff.outOfScopeExplanation, 'MUST provide explanation');
      assert.ok(
        diff.outOfScopeExplanation.summary.includes('accessibility'),
        'MUST explain it\'s a11y feedback'
      );
    });
    
    it('MUST classify aria-expanded changes as out-of-scope', () => {
      const before = '<button aria-expanded="false">Expand</button>';
      const after = '<button aria-expanded="true">Expand</button>';
      
      const diff = computeDOMDiff(before, after);
      
      assert.strictEqual(diff.scopeClassification, 'out-of-scope', 'MUST be out-of-scope');
      assert.ok(diff.outOfScopeExplanation, 'MUST provide explanation');
    });
    
    it('MUST classify aria-selected changes as out-of-scope', () => {
      const before = '<div role="tab" aria-selected="false">Tab 1</div>';
      const after = '<div role="tab" aria-selected="true">Tab 1</div>';
      
      const diff = computeDOMDiff(before, after);
      
      assert.strictEqual(diff.scopeClassification, 'out-of-scope', 'MUST be out-of-scope');
      assert.ok(diff.outOfScopeExplanation, 'MUST provide explanation');
    });
    
  });
  
  //
  // SECTION 3: EDGE CASES & AMBIGUITY RESOLUTION
  //
  
  describe('EDGE CASES: No Change vs Noise vs Out-of-Scope', () => {
    
    it('MUST classify identical HTML as no-change', () => {
      const html = '<div>Same</div>';
      
      const diff = computeDOMDiff(html, html);
      
      assert.strictEqual(diff.changed, false, 'Should not detect change');
      assert.strictEqual(diff.scopeClassification, 'no-change', 'MUST be no-change');
      assert.strictEqual(diff.isMeaningful, false, 'Not meaningful');
    });
    
    it('MUST classify timestamp changes as noise-only', () => {
      const before = '<div data-timestamp="2024-01-01T10:00:00Z">Content</div>';
      const after = '<div data-timestamp="2024-01-01T10:00:01Z">Content</div>';
      
      const diff = computeDOMDiff(before, after);
      
      assert.strictEqual(diff.changed, true, 'Should detect HTML change');
      assert.strictEqual(diff.scopeClassification, 'noise-only', 'MUST be noise-only');
      assert.strictEqual(diff.isMeaningful, false, 'Not meaningful');
    });
    
    it('MUST handle mixed in-scope + out-of-scope changes (in-scope wins)', () => {
      // Text change (in-scope) + style change (out-of-scope)
      const before = '<div id="status" style="display: none"></div>';
      const after = '<div id="status" style="display: block">Success</div>';
      
      const diff = computeDOMDiff(before, after);
      
      // Because there's an in-scope change, classify as in-scope
      assert.strictEqual(diff.isMeaningful, true, 'MUST be meaningful (text change)');
      assert.strictEqual(diff.scopeClassification, 'in-scope', 'In-scope has priority');
    });
    
  });
  
  //
  // SECTION 4: REPORTING HONESTY
  //
  
  describe('REPORTING: Clear Explanations', () => {
    
    it('MUST provide actionable explanation for out-of-scope feedback', () => {
      const before = '<div style="display: none">Spinner</div>';
      const after = '<div style="display: block">Spinner</div>';
      
      const diff = computeDOMDiff(before, after);
      
      assert.ok(diff.outOfScopeExplanation, 'MUST have explanation');
      assert.ok(diff.outOfScopeExplanation.summary, 'MUST have summary');
      assert.ok(diff.outOfScopeExplanation.category, 'MUST have category');
      assert.ok(diff.outOfScopeExplanation.whatToDoNext, 'MUST have action guidance');
      
      // Explanation should be clear about NOT being a failure
      assert.ok(
        diff.outOfScopeExplanation.summary.includes('NOT a silent failure'),
        'MUST clarify it\'s not a failure'
      );
    });
    
    it('MUST NOT provide out-of-scope explanation for in-scope changes', () => {
      const before = '<div id="msg"></div>';
      const after = '<div id="msg">Hello</div>';
      
      const diff = computeDOMDiff(before, after);
      
      assert.strictEqual(diff.scopeClassification, 'in-scope', 'Should be in-scope');
      assert.strictEqual(diff.outOfScopeExplanation, null, 'MUST NOT have out-of-scope explanation');
    });
    
  });
  
  //
  // SECTION 5: SCOPE DOCUMENTATION
  //
  
  describe('DOCUMENTATION: Scope Contract', () => {
    
    it('MUST provide complete scope documentation', () => {
      const docs = getScopeDocumentation();
      
      assert.ok(docs.title, 'MUST have title');
      assert.ok(docs.version, 'MUST have version');
      assert.ok(docs.philosophy, 'MUST explain philosophy');
      assert.ok(docs.inScope, 'MUST document in-scope patterns');
      assert.ok(docs.outOfScope, 'MUST document out-of-scope patterns');
    });
    
    it('MUST document rationale for out-of-scope patterns', () => {
      const docs = getScopeDocumentation();
      
      assert.ok(docs.outOfScope.rationale, 'MUST explain why out-of-scope');
      assert.ok(
        docs.outOfScope.rationale.includes('false negatives') ||
        docs.outOfScope.rationale.includes('CSS parsing') ||
        docs.outOfScope.rationale.includes('visual diff'),
        'MUST explain technical limitations'
      );
    });
    
  });
  
  //
  // SECTION 6: REAL-WORLD SCENARIOS (From Adversarial QA)
  //
  
  describe('REAL-WORLD: Adversarial QA Scenarios', () => {
    
    it('Ping demo (text feedback) MUST be detected', () => {
      // This was the original P0 fix scenario
      const before = '<button id="ping">Ping</button><div id="pong"></div>';
      const after = '<button id="ping">Ping</button><div id="pong">Ping acknowledged</div>';
      
      const diff = computeDOMDiff(before, after);
      
      assert.strictEqual(diff.isMeaningful, true, 'MUST detect Ping feedback');
      assert.strictEqual(diff.scopeClassification, 'in-scope', 'MUST be in-scope');
    });
    
    it('Spinner demo (style feedback) MUST be classified as out-of-scope', () => {
      // This was the false negative from adversarial QA
      const before = '<button id="load">Load</button><div id="spinner" style="display: none">...</div>';
      const after = '<button id="load">Load</button><div id="spinner" style="display: block">...</div>';
      
      const diff = computeDOMDiff(before, after);
      
      // NEW BEHAVIOR: Not a silent failure, but out-of-scope
      assert.strictEqual(diff.scopeClassification, 'out-of-scope', 'MUST be out-of-scope');
      assert.ok(diff.outOfScopeExplanation, 'MUST explain it\'s visual feedback');
      
      // OLD BEHAVIOR (before constitutional lock): would have been isMeaningful=false with no explanation
      // This would have appeared as "silent failure" which was the false negative
    });
    
    it('Menu toggle (aria-hidden) MUST be classified as out-of-scope', () => {
      // This was another false negative from adversarial QA
      const before = '<button id="menu">Menu</button><nav aria-hidden="true">Links</nav>';
      const after = '<button id="menu">Menu</button><nav aria-hidden="false">Links</nav>';
      
      const diff = computeDOMDiff(before, after);
      
      assert.strictEqual(diff.scopeClassification, 'out-of-scope', 'MUST be out-of-scope');
      assert.ok(diff.outOfScopeExplanation, 'MUST explain it\'s a11y feedback');
    });
    
  });
  
});

//
// SUMMARY TEST: Constitutional Guarantees
//
describe('CONSTITUTIONAL GUARANTEES', () => {
  
  it('ZERO FALSE NEGATIVES: All in-scope feedback detected', () => {
    const inScopeScenarios = [
      {
        name: 'aria-live text',
        before: '<div aria-live="polite"></div>',
        after: '<div aria-live="polite">Done</div>'
      },
      {
        name: 'id element text',
        before: '<p id="msg"></p>',
        after: '<p id="msg">Success</p>'
      },
      {
        name: 'disabled attribute',
        before: '<button id="btn">Click</button>',
        after: '<button id="btn" disabled>Click</button>'
      },
      {
        name: 'aria-invalid',
        before: '<input aria-invalid="false" />',
        after: '<input aria-invalid="true" />'
      },
      {
        name: 'new alert element',
        before: '<div id="root"></div>',
        after: '<div id="root"><div role="alert">Error</div></div>'
      }
    ];
    
    for (const scenario of inScopeScenarios) {
      const diff = computeDOMDiff(scenario.before, scenario.after);
      
      assert.strictEqual(
        diff.isMeaningful,
        true,
        `FAILED: ${scenario.name} not detected (FALSE NEGATIVE)`
      );
      assert.strictEqual(
        diff.scopeClassification,
        'in-scope',
        `FAILED: ${scenario.name} not classified as in-scope`
      );
    }
  });
  
  it('NO FALSE SILENT FAILURES: Out-of-scope feedback never reported as silent failure', () => {
    const outOfScopeScenarios = [
      {
        name: 'display change',
        before: '<div style="display: none">X</div>',
        after: '<div style="display: block">X</div>'
      },
      {
        name: 'aria-hidden',
        before: '<nav aria-hidden="true">Menu</nav>',
        after: '<nav aria-hidden="false">Menu</nav>'
      },
      {
        name: 'class change',
        before: '<div class="hidden">X</div>',
        after: '<div class="visible">X</div>'
      },
      {
        name: 'aria-expanded',
        before: '<button aria-expanded="false">X</button>',
        after: '<button aria-expanded="true">X</button>'
      }
    ];
    
    for (const scenario of outOfScopeScenarios) {
      const diff = computeDOMDiff(scenario.before, scenario.after);
      
      assert.strictEqual(
        diff.scopeClassification,
        'out-of-scope',
        `FAILED: ${scenario.name} not classified as out-of-scope (would appear as silent failure)`
      );
      assert.ok(
        diff.outOfScopeExplanation,
        `FAILED: ${scenario.name} missing explanation (user would be confused)`
      );
    }
  });
  
});
