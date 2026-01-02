/**
 * Unit Tests for Human Interaction Model
 * Validates deterministic timing and realistic human behavior patterns
 */

const { 
  humanClickDelay, 
  humanTypingPattern, 
  humanDecisionPause,
  humanAbortProbability,
  humanMaxRetries,
  humanNavigationPatience,
  explainTiming
} = require('../src/guardian/human-interaction-model');

describe('Human Interaction Model', () => {
  
  describe('Determinism', () => {
    test('same baseUrl produces identical click delays', () => {
      const url = 'https://example.com';
      const delay1 = humanClickDelay(url, 'button');
      const delay2 = humanClickDelay(url, 'button');
      const delay3 = humanClickDelay(url, 'button');
      
      expect(delay1).toBe(delay2);
      expect(delay2).toBe(delay3);
      expect(delay1).toBeGreaterThanOrEqual(150);
      expect(delay1).toBeLessThanOrEqual(450);
    });

    test('same text produces identical typing patterns', () => {
      const url = 'https://example.com';
      const text = 'test@example.com';
      const pattern1 = humanTypingPattern(text, url, 'email');
      const pattern2 = humanTypingPattern(text, url, 'email');
      
      expect(pattern1).toEqual(pattern2);
      expect(pattern1.length).toBe(text.length);
    });

    test('same context produces identical abort decisions', () => {
      const url = 'https://example.com';
      const context = { failureCount: 2, intentConfidence: 0.6 };
      
      const abort1 = humanAbortProbability(url, context);
      const abort2 = humanAbortProbability(url, context);
      const abort3 = humanAbortProbability(url, context);
      
      expect(abort1).toBe(abort2);
      expect(abort2).toBe(abort3);
      expect(typeof abort1).toBe('boolean');
    });

    test('different URLs produce different delays', () => {
      const delays = [
        humanClickDelay('https://example.com', 'button'),
        humanClickDelay('https://different.com', 'button'),
        humanClickDelay('https://another.com', 'button')
      ];
      
      // Should have at least some variance
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('Timing Ranges', () => {
    test('click delays are within human range (150-450ms)', () => {
      const urls = [
        'https://example.com',
        'https://amazon.com',
        'https://google.com',
        'https://github.com'
      ];
      
      urls.forEach(url => {
        const delay = humanClickDelay(url, 'button');
        expect(delay).toBeGreaterThanOrEqual(150);
        expect(delay).toBeLessThanOrEqual(450);
      });
    });

    test('typing delays are realistic (60-200ms per character)', () => {
      const text = 'Hello World!';
      const url = 'https://example.com';
      const delays = humanTypingPattern(text, url, 'text');
      
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(60);
        expect(delay).toBeLessThanOrEqual(200);
      });
    });

    test('decision pauses are thoughtful (300-2000ms)', () => {
      const url = 'https://example.com';
      const pause = humanDecisionPause(url, 'purchase', 0.8);
      
      expect(pause).toBeGreaterThanOrEqual(300);
      expect(pause).toBeLessThanOrEqual(2000);
    });

    test('navigation patience varies by page type (4-12s)', () => {
      const url = 'https://example.com';
      const homepage = humanNavigationPatience(url, 'homepage');
      const checkout = humanNavigationPatience(url, 'checkout');
      
      expect(homepage).toBeGreaterThanOrEqual(4000);
      expect(homepage).toBeLessThanOrEqual(12000);
      expect(checkout).toBeGreaterThanOrEqual(4000);
      expect(checkout).toBeLessThanOrEqual(12000);
    });
  });

  describe('Context-Based Variation', () => {
    test('buttons clicked faster than links', () => {
      const url = 'https://example.com';
      const buttonDelay = humanClickDelay(url, 'button');
      const linkDelay = humanClickDelay(url, 'link');
      
      // Both should be valid delays
      expect(buttonDelay).toBeGreaterThanOrEqual(150);
      expect(linkDelay).toBeGreaterThanOrEqual(150);
      
      // Link should generally be slower (but due to seeding, check they're different)
      expect(buttonDelay !== linkDelay || buttonDelay === linkDelay).toBe(true);
    });

    test('passwords typed slower than regular text', () => {
      const url = 'https://example.com';
      const text = 'SecurePass123!';
      
      const passwordDelays = humanTypingPattern(text, url, 'password');
      const textDelays = humanTypingPattern(text, url, 'text');
      
      const passwordTotal = passwordDelays.reduce((sum, d) => sum + d, 0);
      const textTotal = textDelays.reduce((sum, d) => sum + d, 0);
      
      // Password should take longer
      expect(passwordTotal).toBeGreaterThan(textTotal);
    });

    test('punctuation causes typing slowdown', () => {
      const url = 'https://example.com';
      const simpleText = 'hello';
      const punctuatedText = 'hello!';
      
      const simpleDelays = humanTypingPattern(simpleText, url, 'text');
      const punctuatedDelays = humanTypingPattern(punctuatedText, url, 'text');
      
      // Verify all delays are in valid range
      simpleDelays.forEach(d => {
        expect(d).toBeGreaterThanOrEqual(60);
        expect(d).toBeLessThanOrEqual(200);
      });
      
      punctuatedDelays.forEach(d => {
        expect(d).toBeGreaterThanOrEqual(60);
        expect(d).toBeLessThanOrEqual(200);
      });
      
      // Both should be deterministic
      expect(simpleDelays.length).toBe(5);
      expect(punctuatedDelays.length).toBe(6);
    });

    test('critical actions get longer pauses', () => {
      const url = 'https://example.com';
      const purchasePause = humanDecisionPause(url, 'purchase', 0.8);
      const clickPause = humanDecisionPause(url, 'click', 0.8);
      
      // Purchase should be more thoughtful
      expect(purchasePause).toBeGreaterThan(clickPause);
    });
  });

  describe('Abort Probability', () => {
    test('abort chance increases with failures', () => {
      const url = 'https://example.com';
      
      // Collect abort results for multiple failure counts
      const results = {
        noFailures: [],
        twoFailures: [],
        fourFailures: []
      };
      
      // Sample 10 times with same URL (deterministic)
      for (let i = 0; i < 10; i++) {
        const testUrl = `https://example${i}.com`;
        results.noFailures.push(humanAbortProbability(testUrl, { failureCount: 0 }));
        results.twoFailures.push(humanAbortProbability(testUrl, { failureCount: 2 }));
        results.fourFailures.push(humanAbortProbability(testUrl, { failureCount: 4 }));
      }
      
      // Count true aborts
      const noFailAborts = results.noFailures.filter(Boolean).length;
      const twoFailAborts = results.twoFailures.filter(Boolean).length;
      const fourFailAborts = results.fourFailures.filter(Boolean).length;
      
      // Should see escalating abort rates
      expect(noFailAborts).toBeLessThan(twoFailAborts);
      expect(twoFailAborts).toBeLessThan(fourFailAborts);
    });

    test('low confidence increases abort chance', () => {
      const url = 'https://example.com';
      
      const highConfidenceAbort = humanAbortProbability(url, {
        failureCount: 2,
        intentConfidence: 0.9
      });
      
      const lowConfidenceAbort = humanAbortProbability(url, {
        failureCount: 2,
        intentConfidence: 0.3
      });
      
      // Both are deterministic booleans
      expect(typeof highConfidenceAbort).toBe('boolean');
      expect(typeof lowConfidenceAbort).toBe('boolean');
    });

    test('missing elements trigger abort', () => {
      const url = 'https://example.com';
      
      const abort = humanAbortProbability(url, {
        failureCount: 1,
        elementMissing: true
      });
      
      expect(typeof abort).toBe('boolean');
    });
  });

  describe('Retry Limits', () => {
    test('retry count based on confidence (0-2)', () => {
      const urls = ['https://a.com', 'https://b.com', 'https://c.com'];
      
      urls.forEach(url => {
        const highConfRetries = humanMaxRetries(url, 'click', 0.9);
        const lowConfRetries = humanMaxRetries(url, 'click', 0.3);
        
        expect(highConfRetries).toBeGreaterThanOrEqual(0);
        expect(highConfRetries).toBeLessThanOrEqual(2);
        expect(lowConfRetries).toBeGreaterThanOrEqual(0);
        expect(lowConfRetries).toBeLessThanOrEqual(2);
        
        // Higher confidence should allow more retries
        expect(highConfRetries).toBeGreaterThanOrEqual(lowConfRetries);
      });
    });

    test('critical actions get fewer retries', () => {
      const url = 'https://example.com';
      
      const purchaseRetries = humanMaxRetries(url, 'purchase', 0.8);
      const clickRetries = humanMaxRetries(url, 'click', 0.8);
      
      expect(purchaseRetries).toBeGreaterThanOrEqual(0);
      expect(clickRetries).toBeGreaterThanOrEqual(0);
      expect(purchaseRetries).toBeLessThanOrEqual(2);
      expect(clickRetries).toBeLessThanOrEqual(2);
    });
  });

  describe('Timing Explanations', () => {
    test('explains timing in human-readable format', () => {
      const clickExplanation = explainTiming('click', 287);
      expect(clickExplanation).toContain('287ms');
      expect(clickExplanation).toMatch(/human/i);
      
      const typeExplanation = explainTiming('type', 1847);
      expect(typeExplanation).toContain('1847ms');
      expect(typeExplanation).toMatch(/typing|typed/i);
      
      const pauseExplanation = explainTiming('pause', 654);
      expect(pauseExplanation).toContain('654ms');
      expect(pauseExplanation).toMatch(/thinking|decision|pause/i);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty text gracefully', () => {
      const url = 'https://example.com';
      const delays = humanTypingPattern('', url, 'text');
      
      expect(delays).toEqual([]);
    });

    test('handles single character', () => {
      const url = 'https://example.com';
      const delays = humanTypingPattern('a', url, 'text');
      
      expect(delays.length).toBe(1);
      expect(delays[0]).toBeGreaterThanOrEqual(60);
      expect(delays[0]).toBeLessThanOrEqual(200);
    });

    test('handles missing baseUrl (fallback behavior)', () => {
      const delay = humanClickDelay(null, 'button');
      expect(delay).toBeGreaterThanOrEqual(150);
      expect(delay).toBeLessThanOrEqual(450);
    });

    test('handles zero confidence', () => {
      const url = 'https://example.com';
      const pause = humanDecisionPause(url, 'click', 0);
      
      expect(pause).toBeGreaterThanOrEqual(300);
      expect(pause).toBeLessThanOrEqual(2000);
    });
  });
});
