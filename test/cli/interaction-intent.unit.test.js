import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferInteractionIntent, INTERACTION_INTENTS } from '../../src/cli/util/observation/interaction-intent.js';

function snap(partial = {}) {
  return {
    tagName: 'BUTTON',
    role: null,
    type: null,
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

test('inferInteractionIntent: <a href="/x"> => NAVIGATION_INTENT', () => {
  const out = inferInteractionIntent({
    elementSnapshot: snap({ tagName: 'A', href: { present: true, kind: 'relative' } }),
    actionType: 'click',
  });
  assert.equal(out.intent, INTERACTION_INTENTS.NAVIGATION_INTENT);
  assert.ok(out.reasons.includes('anchor_like_with_href'));
});

test('inferInteractionIntent: <button type="submit"> in form => SUBMISSION_INTENT', () => {
  const out = inferInteractionIntent({
    elementSnapshot: snap({
      tagName: 'BUTTON',
      type: 'submit',
      form: { associated: true, isSubmitControl: true, method: 'POST', hasAction: true },
    }),
    actionType: 'click',
  });
  assert.equal(out.intent, INTERACTION_INTENTS.SUBMISSION_INTENT);
  assert.deepEqual(out.reasons, ['submit_control_in_form']);
});

test('inferInteractionIntent: <button aria-expanded="false"> => TOGGLE_INTENT', () => {
  const out = inferInteractionIntent({
    elementSnapshot: snap({ aria: { expanded: 'false', pressed: null, checked: null } }),
    actionType: 'click',
  });
  assert.equal(out.intent, INTERACTION_INTENTS.TOGGLE_INTENT);
  assert.deepEqual(out.reasons, ['toggle_semantics_present']);
});

test('inferInteractionIntent: <button> with no semantics => UNKNOWN_INTENT', () => {
  const out = inferInteractionIntent({
    elementSnapshot: snap({ hasOnClick: false }),
    actionType: 'click',
  });
  assert.equal(out.intent, INTERACTION_INTENTS.UNKNOWN_INTENT);
  assert.deepEqual(out.reasons, ['insufficient_semantics']);
});

