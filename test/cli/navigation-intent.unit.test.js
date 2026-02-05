import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferNavigationIntent, evaluateNavigationObservables, NAVIGATION_INTENTS } from '../../src/cli/util/observation/navigation-intent.js';

function snap(partial = {}) {
  return {
    tagName: 'BUTTON',
    role: null,
    type: 'button',
    disabled: false,
    ariaDisabled: false,
    visible: true,
    boundingBox: { width: 100, height: 40 },
    containerTagName: 'main',
    href: { present: false, kind: null },
    form: { associated: false, isSubmitControl: false, method: null, hasAction: false },
    hasOnClick: false,
    aria: { expanded: null, pressed: null, checked: null },
    control: { checked: null },
    ...partial,
  };
}

test('inferNavigationIntent: runtimeNav href => FULL_PAGE_NAV', () => {
  const out = inferNavigationIntent({
    elementSnapshot: null,
    runtimeNav: { href: '/about' },
    expectation: { type: 'navigation' },
  });
  assert.equal(out.intent, NAVIGATION_INTENTS.FULL_PAGE_NAV);
  assert.deepEqual(out.reasons, ['runtime_nav_href']);
});

test('inferNavigationIntent: anchor hash href => HASH_NAV', () => {
  const out = inferNavigationIntent({
    elementSnapshot: snap({ tagName: 'A', href: { present: true, kind: 'hash_only' } }),
    runtimeNav: null,
    expectation: { type: 'navigation' },
  });
  assert.equal(out.intent, NAVIGATION_INTENTS.HASH_NAV);
  assert.deepEqual(out.reasons, ['anchor_hash_href']);
});

test('inferNavigationIntent: navigation promise + click handler => SPA_ROUTE_NAV', () => {
  const out = inferNavigationIntent({
    elementSnapshot: snap({ hasOnClick: true }),
    runtimeNav: null,
    expectation: { type: 'navigation' },
  });
  assert.equal(out.intent, NAVIGATION_INTENTS.SPA_ROUTE_NAV);
  assert.deepEqual(out.reasons, ['navigation_promise_click_handler']);
});

test('inferNavigationIntent: insufficient semantics => UNKNOWN_NAV_INTENT', () => {
  const out = inferNavigationIntent({
    elementSnapshot: snap({ hasOnClick: false }),
    runtimeNav: null,
    expectation: { type: 'navigation' },
  });
  assert.equal(out.intent, NAVIGATION_INTENTS.UNKNOWN_NAV_INTENT);
  assert.deepEqual(out.reasons, ['insufficient_navigation_semantics']);
});

test('evaluateNavigationObservables: HASH_NAV requires comparable urls', () => {
  const out = evaluateNavigationObservables(
    NAVIGATION_INTENTS.HASH_NAV,
    { navigationChanged: false, routeChanged: false },
    { before: { url: 'http://example.test/#a' }, after: { url: 'http://example.test/#b' } }
  );
  assert.equal(out.observablesAvailable, true);
  assert.equal(out.effectObserved, true);
  assert.equal(out.details.hashChanged, true);
});

