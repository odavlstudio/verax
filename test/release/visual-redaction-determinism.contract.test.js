/**
 * Visual Evidence Redaction Determinism Contract Tests
 * 
 * Verifies deterministic redaction of sensitive data in screenshots and DOM snapshots.
 * All tests use local fixtures with no external dependencies.
 */

import { strict as assert } from 'assert';
import test from 'node:test';

import { getRedactionConfig, SENSITIVE_PATTERNS, SENSITIVE_SELECTORS } from '../../src/cli/util/config/redaction-config.js';
import { redactTextPatterns, getRedactionPlaceholder, redactDOMSnapshot, redactPasswordFields } from '../../src/cli/util/evidence/dom-redactor.js';
import { mergeOverlappingBBoxes, padBoundingBoxes } from '../../src/cli/util/evidence/screenshot-redactor.js';

// === DOM REDACTION TESTS ===

test('DOM Redaction - Placeholder Determinism', async (t) => {
  await t.test('same input always produces same placeholder', () => {
    const email = 'test@example.com';
    const p1 = getRedactionPlaceholder(email);
    const p2 = getRedactionPlaceholder(email);
    const p3 = getRedactionPlaceholder(email);
    
    assert.equal(p1, p2, 'Multiple calls should produce identical placeholders');
    assert.equal(p2, p3, 'Placeholders must be deterministic');
    assert.match(p1, /^\[REDACTED:[a-f0-9]{8}\]$/, 'Placeholder format must be [REDACTED:hash8]');
  });
  
  await t.test('different inputs produce different placeholders', () => {
    const email1 = 'user1@example.com';
    const email2 = 'user2@example.com';
    const p1 = getRedactionPlaceholder(email1);
    const p2 = getRedactionPlaceholder(email2);
    
    assert.notEqual(p1, p2, 'Different inputs must produce different placeholders');
  });
});

test('DOM Redaction - Email Pattern Matching', async (t) => {
  await t.test('detects and redacts email addresses', () => {
    const text = 'Contact me at user@example.com for details';
    const result = redactTextPatterns(text);
    
    assert.ok(result.redacted.includes('[REDACTED:'), 'Email should be redacted');
    assert.ok(!result.redacted.includes('user@example.com'), 'Original email should not appear');
    assert.equal(result.count, 1, 'Should detect 1 email');
  });
  
  await t.test('handles multiple emails in one text', () => {
    const text = 'Email alice@test.com and bob@test.com for help';
    const result = redactTextPatterns(text);
    
    assert.equal(result.count, 2, 'Should detect 2 emails');
    assert.equal((result.redacted.match(/\[REDACTED:/g) || []).length, 2, 'Should have 2 placeholders');
  });
});

test('DOM Redaction - JWT Token Pattern', async (t) => {
  await t.test('detects JWT tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const text = `Auth token: ${jwt}`;
    const result = redactTextPatterns(text);
    
    assert.ok(result.count > 0, 'Should detect JWT token');
    assert.ok(!result.redacted.includes(jwt), 'Original JWT should not appear');
  });
});

test('DOM Redaction - API Key Pattern', async (t) => {
  await t.test('detects API keys', () => {
    const text = 'api_key=sk_test_REDACTED_1234567890abcdef_REDACTED in config';
    const result = redactTextPatterns(text);
    
    assert.ok(result.count > 0, 'Should detect API key');
    assert.ok(!result.redacted.includes('sk_test_'), 'API key should be redacted');
  });
});

test('DOM Redaction - Password Fields', async (t) => {
  await t.test('redacts password field values', () => {
    const html = '<input type="password" name="pwd" value="super-secret-123">';
    const result = redactPasswordFields(html);
    
    assert.ok(result.redacted.includes('[REDACTED]'), 'Password should be redacted');
    assert.ok(!result.redacted.includes('super-secret-123'), 'Original password should not appear');
    assert.equal(result.count, 1, 'Should redact 1 password field');
  });
  
  await t.test('handles case-insensitive password type', () => {
    const html = '<INPUT TYPE="PASSWORD" value="secret">';
    const result = redactPasswordFields(html);
    
    assert.ok(result.redacted.includes('[REDACTED]'), 'Should handle case variations');
  });
});

test('DOM Redaction - Full Snapshot', async (t) => {
  await t.test('redacts complete DOM snapshots deterministically', () => {
    const html = `
      <html>
        <body>
          <input type="password" value="pass123">
          <p>Email: user@test.com</p>
          <p>Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U</p>
        </body>
      </html>
    `;
    
    const result1 = redactDOMSnapshot(html);
    const result2 = redactDOMSnapshot(html);
    
    assert.equal(result1.redacted, result2.redacted, 'Redaction must be deterministic');
    assert.ok(!result1.redacted.includes('pass123'), 'Password should be redacted');
    assert.ok(!result1.redacted.includes('user@test.com'), 'Email should be redacted');
    assert.ok(result1.redacted.includes('[REDACTED:'), 'Should contain placeholders');
  });
  
  await t.test('tracks redaction statistics', () => {
    const html = `
      <input type="password" value="secret">
      <p>Contact: admin@company.com and support@company.com</p>
    `;
    
    const result = redactDOMSnapshot(html);
    
    assert.ok(result.stats.passwordFields > 0, 'Should count password fields');
    assert.ok(result.stats.textReplacements > 0, 'Should count text replacements');
  });
});

test('DOM Redaction - Non-Sensitive Content Preserved', async (t) => {
  await t.test('does not redact normal text', () => {
    const text = 'This is a normal paragraph with no sensitive data';
    const result = redactTextPatterns(text);
    
    assert.equal(result.count, 0, 'Normal text should not be redacted');
    assert.equal(result.redacted, text, 'Text should remain unchanged');
  });
  
  await t.test('preserves HTML structure', () => {
    const html = `
      <div class="container">
        <h1>Title</h1>
        <input type="password" value="secret">
      </div>
    `;
    
    const result = redactDOMSnapshot(html);
    
    // Check that HTML structure is preserved
    assert.ok(result.redacted.includes('<div class="container">'), 'HTML structure should be preserved');
    assert.ok(result.redacted.includes('<h1>Title</h1>'), 'Non-sensitive content should be preserved');
  });
});

// === SCREENSHOT BBOX TESTS ===

test('Screenshot Redaction - BBox Padding', async (t) => {
  await t.test('applies padding to bounding boxes', () => {
    const bboxes = [
      { bbox: { x: 100, y: 100, width: 50, height: 50 } },
    ];
    
    const padded = padBoundingBoxes(bboxes, 5, 1000, 1000);
    
    assert.equal(padded[0].bbox.x, 95, 'Should subtract padding from x');
    assert.equal(padded[0].bbox.y, 95, 'Should subtract padding from y');
    assert.equal(padded[0].bbox.width, 60, 'Should add 2*padding to width');
    assert.equal(padded[0].bbox.height, 60, 'Should add 2*padding to height');
  });
  
  await t.test('clamps padded bboxes to viewport bounds', () => {
    const bboxes = [
      { bbox: { x: 5, y: 5, width: 20, height: 20 } },
    ];
    
    const padded = padBoundingBoxes(bboxes, 10, 1000, 1000);
    
    assert.equal(padded[0].bbox.x, 0, 'Should clamp x to 0');
    assert.equal(padded[0].bbox.y, 0, 'Should clamp y to 0');
  });
});

test('Screenshot Redaction - BBox Merging', async (t) => {
  await t.test('merges overlapping bounding boxes', () => {
    const bboxes = [
      { bbox: { x: 100, y: 100, width: 50, height: 50 } },
      { bbox: { x: 120, y: 120, width: 50, height: 50 } },
    ];
    
    const merged = mergeOverlappingBBoxes(bboxes);
    
    assert.ok(merged.length < bboxes.length, 'Should merge overlapping boxes');
  });
  
  await t.test('preserves non-overlapping bounding boxes', () => {
    const bboxes = [
      { bbox: { x: 10, y: 10, width: 20, height: 20 } },
      { bbox: { x: 100, y: 100, width: 20, height: 20 } },
    ];
    
    const merged = mergeOverlappingBBoxes(bboxes);
    
    assert.equal(merged.length, 2, 'Non-overlapping boxes should be preserved');
  });
});

// === CONFIGURATION TESTS ===

test('Redaction Config - Environment Variables', async (t) => {
  await t.test('reads redaction enable flags from env', () => {
    const config = getRedactionConfig();
    
    // By default, redaction should be enabled
    assert.equal(typeof config.visual, 'boolean', 'visual flag should be boolean');
    assert.equal(typeof config.dom, 'boolean', 'dom flag should be boolean');
    assert.equal(config.visual, true, 'visual redaction should be enabled by default');
    assert.equal(config.dom, true, 'dom redaction should be enabled by default');
  });
  
  await t.test('respects VERAX_REDACT_VISUAL=0', () => {
    const originalEnv = process.env.VERAX_REDACT_VISUAL;
    process.env.VERAX_REDACT_VISUAL = '0';
    
    const config = getRedactionConfig();
    assert.equal(config.visual, false, 'Should disable visual redaction when env=0');
    
    process.env.VERAX_REDACT_VISUAL = originalEnv;
  });
  
  await t.test('includes rules version in config', () => {
    const config = getRedactionConfig();
    
    assert.equal(typeof config.rulesVersion, 'string', 'rulesVersion should be string');
    assert.ok(config.rulesVersion, 'Should have a rules version');
  });
});

// === SENSITIVE SELECTOR TESTS ===

test('Sensitive Selectors - Coverage', async (t) => {
  await t.test('includes password input selector', () => {
    assert.ok(SENSITIVE_SELECTORS.includes('input[type="password"]'), 'Should include password selector');
  });
  
  await t.test('includes email input selectors', () => {
    const hasEmailSelector = SENSITIVE_SELECTORS.some(s => s.includes('email'));
    assert.ok(hasEmailSelector, 'Should include email input selectors');
  });
  
  await t.test('includes token/key selectors', () => {
    const hasTokenSelector = SENSITIVE_SELECTORS.some(s => s.includes('token'));
    const hasKeySelector = SENSITIVE_SELECTORS.some(s => s.includes('key'));
    assert.ok(hasTokenSelector, 'Should include token selectors');
    assert.ok(hasKeySelector, 'Should include key selectors');
  });
  
  await t.test('includes autocomplete selectors', () => {
    const hasAutocompleteSelector = SENSITIVE_SELECTORS.some(s => s.includes('autocomplete'));
    assert.ok(hasAutocompleteSelector, 'Should include autocomplete selectors');
  });
  
  await t.test('includes explicit redaction selector', () => {
    const hasExplicitSelector = SENSITIVE_SELECTORS.some(s => s.includes('data-verax-redact'));
    assert.ok(hasExplicitSelector, 'Should include explicit opt-in selector');
  });
});

// === PATTERN MATCHING TESTS ===

test('Sensitive Patterns - Regex Coverage', async (t) => {
  await t.test('email pattern matches valid emails', () => {
    const pattern = SENSITIVE_PATTERNS.email;
    assert.ok('test@example.com'.match(pattern), 'Should match standard email');
    assert.ok('user.name+tag@domain.co.uk'.match(pattern), 'Should match complex email');
  });
  
  await t.test('jwt pattern matches JWT tokens', () => {
    const pattern = SENSITIVE_PATTERNS.jwt;
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    assert.ok(jwt.match(pattern), 'Should match JWT format');
  });
  
  await t.test('phone pattern matches US phone numbers', () => {
    const pattern = SENSITIVE_PATTERNS.phone;
    assert.ok('(555) 123-4567'.match(pattern), 'Should match parenthetical format');
    assert.ok('555-123-4567'.match(pattern), 'Should match hyphenated format');
    assert.ok('555.123.4567'.match(pattern), 'Should match dotted format');
  });
  
  await t.test('ssn pattern matches SSN format', () => {
    const pattern = SENSITIVE_PATTERNS.ssn;
    assert.ok('123-45-6789'.match(pattern), 'Should match SSN format');
  });
});

console.log('✓ Visual redaction determinism contract tests loaded');




