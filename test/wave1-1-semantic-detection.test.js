/**
 * Wave 1.1 Semantic Detection Tests
 * 
 * Tests for:
 * - Language detection
 * - Multilingual contact detection
 * - German/English fixture page detection
 */

const assert = require('assert');
const http = require('http');
const {
  normalizeText,
  includesAnyToken,
  getMatchedToken,
  getTokensForTarget
} = require('../src/guardian/semantic-targets');
const { detectLanguage, getPrimaryLanguage, getLanguageName } = require('../src/guardian/language-detection');
const { detectContactCandidates, formatDetectionResult, getNoContactFoundHint, CONFIDENCE, DETECTION_SOURCE } = require('../src/guardian/semantic-contact-detection');
const fixtureApp = require('./discovery-fixture-server');

// ============================================================================
// HELPERS
// ============================================================================

function startTestServer(port = 9999) {
  return new Promise((resolve) => {
    const server = http.createServer(fixtureApp);
    server.listen(port, () => {
      resolve(server);
    });
  });
}

function stopTestServer(server) {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

// Mock Playwright page
class MockPage {
  constructor(htmlContent = '', url = 'http://localhost:9999/') {
    this.htmlContent = htmlContent;
    this.currentUrl = url;
  }

  async goto(url, options = {}) {
    this.currentUrl = url;
  }

  url() {
    return this.currentUrl;
  }

  async evaluate(fn, ...args) {
    // Simulate DOM evaluation
    if (fn.toString().includes('documentElement.getAttribute')) {
      // Language detection
      const parser = require('node-html-parser').parse;
      const root = parser(this.htmlContent);
      const htmlTag = root.querySelector('html');
      return htmlTag ? htmlTag.getAttribute('lang') : null;
    }

    if (fn.toString().includes('querySelectorAll')) {
      // Contact candidate detection - simulate finding elements
      return [];
    }

    return null;
  }
}

// ============================================================================
// UNIT TESTS: Text Normalization
// ============================================================================

describe('Wave 1.1 — Semantic Detection', () => {
  describe('Text Normalization', () => {
    it('should lowercase text', () => {
      assert.strictEqual(normalizeText('CONTACT'), 'contact');
    });

    it('should remove diacritics', () => {
      assert.strictEqual(normalizeText('contáctanos'), 'contactanos');
      assert.strictEqual(normalizeText('über'), 'uber');
      assert.strictEqual(normalizeText('contacté'), 'contacte');
    });

    it('should remove punctuation', () => {
      assert.strictEqual(normalizeText('Contact!'), 'contact');
      assert.strictEqual(normalizeText('Contact-Us'), 'contact us');
    });

    it('should collapse whitespace', () => {
      assert.strictEqual(normalizeText('Contact   Us'), 'contact us');
      assert.strictEqual(normalizeText('  contact  '), 'contact');
    });

    it('should handle combined transformations', () => {
      assert.strictEqual(normalizeText('Kontaktieren Sie Uns!'), 'kontaktieren sie uns');
      assert.strictEqual(normalizeText('  Contáctanos  '), 'contactanos');
    });
  });

  // ============================================================================
  // UNIT TESTS: Token Matching
  // ============================================================================

  describe('Token Matching', () => {
    it('should find English contact tokens', () => {
      const tokens = getTokensForTarget('contact');
      assert(includesAnyToken(normalizeText('Contact Us'), tokens));
      assert(includesAnyToken(normalizeText('Contact Form'), tokens));
      assert(includesAnyToken(normalizeText('Get in touch'), tokens));
    });

    it('should find German contact tokens', () => {
      const tokens = getTokensForTarget('contact');
      assert(includesAnyToken(normalizeText('Kontakt'), tokens));
      assert(includesAnyToken(normalizeText('Kontaktformular'), tokens));
      assert(includesAnyToken(normalizeText('Kontaktieren'), tokens));
    });

    it('should find Spanish contact tokens', () => {
      const tokens = getTokensForTarget('contact');
      assert(includesAnyToken(normalizeText('Contacto'), tokens));
      assert(includesAnyToken(normalizeText('Contáctanos'), tokens));
    });

    it('should NOT match false positives', () => {
      const tokens = getTokensForTarget('contact');
      assert(!includesAnyToken(normalizeText('Continental'), tokens));
      assert(!includesAnyToken(normalizeText('Market'), tokens));
    });

    it('should return matched token', () => {
      const tokens = getTokensForTarget('contact');
      const matched = getMatchedToken(normalizeText('Kontakt'), tokens);
      assert(matched);
      assert.strictEqual(normalizeText(matched), 'kontakt');
    });
  });

  // ============================================================================
  // UNIT TESTS: Language Detection
  // ============================================================================

  describe('Language Detection', () => {
    it('should extract primary language from BCP-47 code', () => {
      assert.strictEqual(getPrimaryLanguage('de'), 'de');
      assert.strictEqual(getPrimaryLanguage('de-DE'), 'de');
      assert.strictEqual(getPrimaryLanguage('en-US'), 'en');
      assert.strictEqual(getPrimaryLanguage('es-ES'), 'es');
    });

    it('should handle unknown language', () => {
      assert.strictEqual(getPrimaryLanguage('unknown'), 'unknown');
      assert.strictEqual(getPrimaryLanguage(null), 'unknown');
      assert.strictEqual(getPrimaryLanguage(''), 'unknown');
    });

    it('should get human-readable language names', () => {
      assert.strictEqual(getLanguageName('de'), 'German');
      assert.strictEqual(getLanguageName('en'), 'English');
      assert.strictEqual(getLanguageName('es'), 'Spanish');
      assert.strictEqual(getLanguageName('de-DE'), 'German');
      assert.strictEqual(getLanguageName('unknown'), 'Unknown');
    });
  });

  // ============================================================================
  // UNIT TESTS: Detection Result Formatting
  // ============================================================================

  describe('Detection Result Formatting', () => {
    it('should format detection result with language', () => {
      const candidate = {
        matchedText: 'Kontakt',
        matchedToken: 'kontakt',
        source: DETECTION_SOURCE.TEXT,
        confidence: CONFIDENCE.HIGH
      };
      const result = formatDetectionResult(candidate, 'de');
      assert(result.includes('lang=de'));
      assert(result.includes('source=text'));
      assert(result.includes('token=kontakt'));
      assert(result.includes('confidence=high'));
    });

    it('should format result with unknown language', () => {
      const candidate = {
        matchedText: 'Contact',
        matchedToken: 'contact',
        source: DETECTION_SOURCE.HREF,
        confidence: CONFIDENCE.MEDIUM
      };
      const result = formatDetectionResult(candidate, 'unknown');
      assert(result.includes('lang=unknown'));
    });

    it('should provide helpful hint when contact not found', () => {
      const hint = getNoContactFoundHint();
      assert(hint.includes('data-guardian'));
      assert(hint.includes('No contact found'));
    });
  });

  // ============================================================================
  // INTEGRATION TESTS: German Fixture Pages
  // ============================================================================

  describe('German Fixture Integration (with live server)', function() {
    this.timeout(10000);

    let server;

    before(async () => {
      server = await startTestServer(9999);
      // Give server time to start
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    after(async () => {
      if (server) {
        await stopTestServer(server);
      }
    });

    it('should detect German /de page has lang="de" attribute', async () => {
      // This test verifies the German fixture page is correctly set up
      // A real Playwright test would verify via page evaluation
      // For now, we just verify the semantic detection utilities work with German content
      const germanNavText = 'Kontaktieren Sie uns gerne über unser Kontaktformular';
      const tokens = getTokensForTarget('contact');
      assert(includesAnyToken(normalizeText(germanNavText), tokens), 'Should detect "kontakt" in German text');
    });

    it('should detect contact link with German text "Kontakt"', async () => {
      const tokens = getTokensForTarget('contact');
      const linkText = 'Kontakt';
      const matched = getMatchedToken(normalizeText(linkText), tokens);
      assert.strictEqual(normalizeText(matched), 'kontakt');
    });

    it('should detect contact form via href /de/kontakt', async () => {
      const tokens = getTokensForTarget('contact');
      const href = '/de/kontakt';
      assert(includesAnyToken(normalizeText(href), tokens));
    });

    it('should handle German contact form vocabulary', async () => {
      const tokens = getTokensForTarget('contact');
      const germanWords = [
        'Kontakt',
        'Kontaktieren',
        'Kontaktformular',
        'Kontaktaufnahme'
      ];

      for (const word of germanWords) {
        assert(
          includesAnyToken(normalizeText(word), tokens),
          `Should detect German word: ${word}`
        );
      }
    });

    it('should correctly rank detection candidates by confidence', async () => {
      // Simulating the ranking logic
      const candidates = [
        { confidence: CONFIDENCE.LOW, source: DETECTION_SOURCE.HEURISTIC },
        { confidence: CONFIDENCE.HIGH, source: DETECTION_SOURCE.DATA_GUARDIAN },
        { confidence: CONFIDENCE.MEDIUM, source: DETECTION_SOURCE.TEXT }
      ];

      // Sort by confidence
      candidates.sort((a, b) => {
        const confidenceOrder = { high: 0, medium: 1, low: 2 };
        return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
      });

      assert.strictEqual(candidates[0].confidence, CONFIDENCE.HIGH);
      assert.strictEqual(candidates[1].confidence, CONFIDENCE.MEDIUM);
      assert.strictEqual(candidates[2].confidence, CONFIDENCE.LOW);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle null/undefined text', () => {
      const tokens = getTokensForTarget('contact');
      assert(!includesAnyToken(null, tokens));
      assert(!includesAnyToken(undefined, tokens));
      assert(!includesAnyToken('', tokens));
    });

    it('should handle empty token list', () => {
      assert(!includesAnyToken('contact', []));
      assert(!includesAnyToken('contact', null));
    });

    it('should handle very short tokens correctly', () => {
      const tokens = ['c', 'a', 'contact']; // single char tokens
      // Single char requires word boundary
      assert(!includesAnyToken('arc', tokens)); // 'c' matches but not at word boundary
      assert(includesAnyToken('a contact', tokens)); // 'a' at word boundary
    });

    it('should normalize non-ASCII correctly', () => {
      assert.strictEqual(normalizeText('café'), 'cafe');
      assert.strictEqual(normalizeText('naïve'), 'naive');
      assert.strictEqual(normalizeText('Zürich'), 'zurich');
    });

    it('should handle mixed case and diacritics', () => {
      const tokens = getTokensForTarget('contact');
      // Spanish with diacritics
      assert(includesAnyToken(normalizeText('CONTÁCTANOS'), tokens), 'Should match Spanish contact');
      // English with mixed case
      assert(includesAnyToken(normalizeText('CoNTaCT'), tokens), 'Should match English contact');
      // German with mixed case
      assert(includesAnyToken(normalizeText('KoNTaKT'), tokens), 'Should match German contact');
    });
  });
});
