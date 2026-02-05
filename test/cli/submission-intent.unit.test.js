import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferSubmissionIntent, SUBMISSION_INTENTS } from '../../src/cli/util/observation/submission-intent.js';

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

test('inferSubmissionIntent: submit control in form => FORM_SUBMISSION_INTENT', () => {
  const out = inferSubmissionIntent({
    elementSnapshot: snap({
      tagName: 'BUTTON',
      type: 'submit',
      form: { associated: true, isSubmitControl: true, method: 'POST', hasAction: true },
    }),
    actionType: 'submit',
  });
  assert.equal(out.intent, SUBMISSION_INTENTS.FORM_SUBMISSION_INTENT);
  assert.deepEqual(out.reasons, ['submit_control_in_form']);
});

test('inferSubmissionIntent: missing semantics => UNKNOWN_SUBMISSION_INTENT', () => {
  const out = inferSubmissionIntent({
    elementSnapshot: snap({ form: { associated: false, isSubmitControl: false, method: null, hasAction: false } }),
    actionType: 'submit',
  });
  assert.equal(out.intent, SUBMISSION_INTENTS.UNKNOWN_SUBMISSION_INTENT);
  assert.deepEqual(out.reasons, ['insufficient_submission_semantics']);
});

