const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { deriveActionHints, formatHintsForCLI, formatHintsForSummary } = require('../src/guardian/action-hints');

describe('Action Hints - deriveActionHints()', () => {
  it('should extract hint for navigation timeout failure', () => {
    const attemptResults = [
      {
        attemptId: 'login_submit',
        outcome: 'FAILURE',
        baseUrl: 'https://example.com',
        steps: [
          { id: 'navigate_login', type: 'navigate', target: 'https://example.com/login', status: 'success', durationMs: 500 },
          {
            id: 'navigate_dashboard',
            type: 'navigate',
            target: 'https://example.com/dashboard',
            status: 'failed',
            error: 'Navigation timeout of 30000ms exceeded',
            durationMs: 30100
          }
        ]
      }
    ];

    const hints = deriveActionHints(attemptResults);

    assert.strictEqual(hints.length, 1);
    assert.strictEqual(hints[0].attempt, 'login_submit');
    assert.strictEqual(hints[0].step, 1);
    assert.strictEqual(hints[0].url, 'https://example.com/dashboard');
    assert.ok(hints[0].issue.includes('Navigation timeout'));
    assert.ok(hints[0].hint.includes('Server response time'));
    assert.strictEqual(hints[0].severity, 'HIGH');
  });

  it('should extract hint for missing submit button', () => {
    const attemptResults = [
      {
        attemptId: 'signup_form',
        outcome: 'FAILURE',
        baseUrl: 'https://example.com/signup',
        steps: [
          { id: 'navigate_signup', type: 'navigate', target: 'https://example.com/signup', status: 'success', durationMs: 400 },
          {
            id: 'click_submit',
            type: 'click',
            selector: 'button[type="submit"]',
            target: 'https://example.com/signup',
            status: 'failed',
            error: 'Element not found: button[type="submit"]',
            durationMs: 50
          }
        ]
      }
    ];

    const hints = deriveActionHints(attemptResults);

    assert.strictEqual(hints.length, 1);
    assert.strictEqual(hints[0].attempt, 'signup_form');
    assert.strictEqual(hints[0].step, 1);
    assert.strictEqual(hints[0].url, 'https://example.com/signup');
    assert.ok(hints[0].issue.includes('Required element not found'));
    assert.ok(hints[0].hint.includes('selector'));
    assert.ok(hints[0].hint.includes('https://example.com/signup'));
    assert.strictEqual(hints[0].severity, 'HIGH');
  });

  it('should extract hint for form submit blocked', () => {
    const attemptResults = [
      {
        attemptId: 'payment_submit',
        outcome: 'FAILURE',
        baseUrl: 'https://example.com/checkout',
        steps: [
          { id: 'navigate_checkout', type: 'navigate', target: 'https://example.com/checkout', status: 'success', durationMs: 300 },
          { id: 'fill_card', type: 'fill', selector: 'input[name="card"]', target: 'https://example.com/checkout', status: 'success', durationMs: 50 },
          {
            id: 'submit_payment',
            type: 'click',
            selector: 'button#pay',
            target: 'https://example.com/checkout',
            status: 'failed',
            error: 'Form submit blocked by validation',
            durationMs: 20
          }
        ]
      }
    ];

    const hints = deriveActionHints(attemptResults);

    assert.strictEqual(hints.length, 1);
    assert.strictEqual(hints[0].attempt, 'payment_submit');
    assert.strictEqual(hints[0].step, 2);
    assert.strictEqual(hints[0].url, 'https://example.com/checkout');
    assert.ok(hints[0].issue.includes('Form submission failed'));
    assert.ok(hints[0].hint.includes('button disabled'));
    assert.strictEqual(hints[0].severity, 'HIGH');
  });

  it('should extract hint for navigation loop', () => {
    const attemptResults = [
      {
        attemptId: 'auth_redirect',
        outcome: 'FAILURE',
        baseUrl: 'https://example.com',
        steps: [
          { id: 'navigate_login', type: 'navigate', target: 'https://example.com/login', status: 'success', durationMs: 300 },
          {
            id: 'navigate_dashboard',
            type: 'navigate',
            target: 'https://example.com/dashboard',
            status: 'failed',
            error: 'Navigation loop detected: visited /dashboard 3 times',
            durationMs: 1500
          }
        ]
      }
    ];

    const hints = deriveActionHints(attemptResults);

    assert.strictEqual(hints.length, 1);
    assert.strictEqual(hints[0].attempt, 'auth_redirect');
    assert.strictEqual(hints[0].step, 1);
    assert.strictEqual(hints[0].url, 'https://example.com/dashboard');
    assert.ok(hints[0].issue.includes('Navigation loop'));
    assert.ok(hints[0].hint.includes('Circular redirects'));
    assert.strictEqual(hints[0].severity, 'HIGH');
  });

  it('should extract friction hint for slow steps', () => {
    const attemptResults = [
      {
        attemptId: 'slow_homepage',
        outcome: 'FRICTION',
        baseUrl: 'https://example.com/',
        steps: [
          {
            id: 'navigate_home',
            type: 'navigate',
            target: 'https://example.com/',
            status: 'success',
            durationMs: 12000
          }
        ],
        friction: {
          isFriction: true,
          signals: [],
          summary: null,
          reasons: [],
          metrics: {}
        }
      }
    ];

    const hints = deriveActionHints(attemptResults);

    assert.strictEqual(hints.length, 1);
    assert.strictEqual(hints[0].attempt, 'slow_homepage');
    assert.strictEqual(hints[0].step, 0);
    assert.strictEqual(hints[0].url, 'https://example.com/');
    assert.ok(hints[0].issue.includes('Slow step'));
    assert.ok(hints[0].hint.includes('Optimize page load'));
    assert.strictEqual(hints[0].severity, 'MEDIUM');
  });

  it('should extract hint for NOT_APPLICABLE missing URL', () => {
    const attemptResults = [
      {
        attemptId: 'missing_pricing',
        outcome: 'NOT_APPLICABLE',
        baseUrl: 'https://example.com',
        steps: [
          {
            id: 'navigate_pricing',
            type: 'navigate',
            target: 'https://example.com/not-found',
            status: 'failed',
            error: 'URL not found on site',
            durationMs: 100
          }
        ]
      }
    ];

    const hints = deriveActionHints(attemptResults);

    assert.strictEqual(hints.length, 1);
    assert.strictEqual(hints[0].attempt, 'missing_pricing');
    assert.strictEqual(hints[0].step, 0);
    assert.strictEqual(hints[0].url, 'https://example.com/not-found');
    assert.ok(hints[0].issue.includes('URL not found'));
    assert.ok(hints[0].hint.includes('Add page'));
    assert.strictEqual(hints[0].severity, 'MEDIUM');
  });

  it('should extract hint for DISCOVERY_FAILED', () => {
    const attemptResults = [
      {
        attemptId: 'discover_login',
        outcome: 'DISCOVERY_FAILED',
        baseUrl: 'https://example.com/',
        error: 'No login form discovered on homepage',
        steps: [
          {
            id: 'navigate_home',
            type: 'navigate',
            target: 'https://example.com/',
            status: 'success',
            durationMs: 300
          },
          {
            id: 'discovery',
            type: 'discovery',
            target: 'https://example.com/',
            status: 'failed',
            error: 'No login form discovered on homepage',
            durationMs: 50
          }
        ]
      }
    ];

    const hints = deriveActionHints(attemptResults);

    assert.strictEqual(hints.length, 1);
    assert.strictEqual(hints[0].attempt, 'discover_login');
    assert.strictEqual(hints[0].step, 1);
    assert.strictEqual(hints[0].url, 'https://example.com/');
    assert.ok(hints[0].issue.includes('Element discovery failed'));
    assert.ok(hints[0].hint.includes('Add stable element markers'));
    assert.strictEqual(hints[0].severity, 'MEDIUM');
  });

  it('should return empty array for SUCCESS outcome', () => {
    const attemptResults = [
      {
        attemptId: 'successful_login',
        outcome: 'SUCCESS',
        baseUrl: 'https://example.com',
        steps: [
          { id: 'navigate_login', type: 'navigate', target: 'https://example.com/login', status: 'success', durationMs: 300 },
          { id: 'click_submit', type: 'click', selector: 'button', target: 'https://example.com/login', status: 'success', durationMs: 50 }
        ]
      }
    ];

    const hints = deriveActionHints(attemptResults);

    assert.strictEqual(hints.length, 0);
  });

  it('should handle multiple failures and return multiple hints', () => {
    const attemptResults = [
      {
        attemptId: 'login_timeout',
        outcome: 'FAILURE',
        baseUrl: 'https://example.com',
        steps: [
          {
            id: 'navigate_login',
            type: 'navigate',
            target: 'https://example.com/login',
            status: 'failed',
            error: 'Navigation timeout of 30000ms exceeded',
            durationMs: 30100
          }
        ]
      },
      {
        attemptId: 'signup_missing_button',
        outcome: 'FAILURE',
        baseUrl: 'https://example.com',
        steps: [
          {
            id: 'click_signup',
            type: 'click',
            selector: 'button.signup',
            target: 'https://example.com/signup',
            status: 'failed',
            error: 'Element not found: button.signup',
            durationMs: 50
          }
        ]
      }
    ];

    const hints = deriveActionHints(attemptResults);

    assert.strictEqual(hints.length, 2);
    assert.strictEqual(hints[0].attempt, 'login_timeout');
    assert.strictEqual(hints[1].attempt, 'signup_missing_button');
  });
});

describe('Action Hints - formatHintsForCLI()', () => {
  it('should format hints for CLI output with limit', () => {
    const hints = [
      {
        attempt: 'login_fail',
        step: 1,
        url: 'https://example.com/login',
        issue: 'Element not found: button#submit',
        hint: 'Add selector button#submit on page https://example.com/login',
        severity: 'HIGH'
      },
      {
        attempt: 'slow_page',
        step: 0,
        url: 'https://example.com/',
        issue: 'Slow step detected (8000ms)',
        hint: 'Optimize page load time',
        severity: 'MEDIUM'
      }
    ];

    const output = formatHintsForCLI(hints, 1);

    assert.ok(output.includes('ACTION HINTS'));
    assert.ok(output.includes('login_fail'));
    assert.ok(output.includes('button#submit'));
    assert.ok(output.includes('⚠️')); // Severity indicator
    // Should only show 1 hint due to limit
    const hintBlocks = output.match(/Attempt:/g);
    assert.strictEqual(hintBlocks ? hintBlocks.length : 0, 1);
  });

  it('should return empty string for no hints', () => {
    const output = formatHintsForCLI([], 3);
    assert.strictEqual(output, '');
  });
});

describe('Action Hints - formatHintsForSummary()', () => {
  it('should format hints for summary markdown', () => {
    const hints = [
      {
        attempt: 'payment_submit',
        step: 2,
        url: 'https://example.com/checkout',
        issue: 'Form submit blocked by validation',
        hint: 'Check if button disabled, JS validation issues, or required fields',
        severity: 'HIGH'
      }
    ];

    const output = formatHintsForSummary(hints);

    assert.ok(output.includes('**Attempt:**'));
    assert.ok(output.includes('payment_submit'));
    assert.ok(output.includes('**Step:**'));
    assert.ok(output.includes('2'));
    assert.ok(output.includes('**URL:**'));
    assert.ok(output.includes('https://example.com/checkout'));
    assert.ok(output.includes('**Issue:**'));
    assert.ok(output.includes('Form submit blocked'));
    assert.ok(output.includes('**Fix Hint:**'));
    assert.ok(output.includes('Check if button disabled'));
    assert.ok(output.includes('**Severity:**'));
    assert.ok(output.includes('HIGH'));
  });

  it('should return empty string for no hints', () => {
    const output = formatHintsForSummary([]);
    assert.strictEqual(output, '');
  });
});
