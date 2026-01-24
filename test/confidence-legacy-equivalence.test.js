import test from 'node:test';
import assert from 'node:assert/strict';

import { computeConfidence as legacyCompute } from '../src/verax/detect/confidence-engine.legacy.js';
import { computeConfidence as decomposedCompute } from '../src/verax/detect/confidence/index.js';

function runBoth(params) {
  const legacy = legacyCompute(params);
  const decomposed = decomposedCompute(params);
  return { legacy, decomposed };
}

const baseExpectationProven = { proof: 'PROVEN_EXPECTATION', explicit: true, sourceRef: 'ref' };
const baseExpectationObserved = { expectationStrength: 'OBSERVED' };
const baseExpectationWeak = { proof: 'UNKNOWN' };

const networkData = {
  totalRequests: 3,
  failedRequests: 1,
  slowRequests: 1,
  slowRequestsCount: 1,
  topFailedUrls: ['http://x'],
  topSlowUrls: []
};

const consoleData = { hasErrors: true, totalMessages: 2, errors: 1, warnings: 0, entries: [{}] };
const uiFeedback = {
  before: { hasErrorSignal: false, hasLoadingIndicator: false },
  after: { hasErrorSignal: true, hasLoadingIndicator: false }
};
const uiNoFeedback = { before: {}, after: {} };
const uiDomChange = { diff: { domChanged: true, visibleChanged: true } };

const comparisonsUrlDom = { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false };
const comparisonsChanged = { hasUrlChange: true, hasDomChange: true, hasVisibleChange: true };

const matrix = [
  {
    name: 'network silent failure with proven expectation and sensor data',
    params: {
      findingType: 'network_silent_failure',
      expectation: baseExpectationProven,
      sensors: { network: networkData, console: consoleData, uiSignals: uiNoFeedback },
      comparisons: comparisonsUrlDom,
      attemptMeta: { repeated: true }
    }
  },
  {
    name: 'validation silent failure observed expectation',
    params: {
      findingType: 'validation_silent_failure',
      expectation: baseExpectationObserved,
      sensors: { network: networkData, console: consoleData, uiSignals: uiNoFeedback },
      comparisons: comparisonsUrlDom,
      attemptMeta: { repeated: false }
    }
  },
  {
    name: 'missing feedback failure with slow request and no feedback',
    params: {
      findingType: 'missing_feedback_failure',
      expectation: baseExpectationWeak,
      sensors: { network: networkData, console: {}, uiSignals: uiNoFeedback },
      comparisons: comparisonsUrlDom
    }
  },
  {
    name: 'no effect silent failure with no changes',
    params: {
      findingType: 'no_effect_silent_failure',
      expectation: baseExpectationProven,
      sensors: { network: {}, console: {}, uiSignals: uiNoFeedback },
      comparisons: comparisonsUrlDom
    }
  },
  {
    name: 'missing network action proven expectation zero requests',
    params: {
      findingType: 'missing_network_action',
      expectation: { ...baseExpectationProven, totalRequests: 0 },
      sensors: { network: { totalRequests: 0, failedRequests: 0 }, console: consoleData, uiSignals: uiNoFeedback },
      comparisons: comparisonsUrlDom
    }
  },
  {
    name: 'missing state action proven expectation no dom change',
    params: {
      findingType: 'missing_state_action',
      expectation: baseExpectationProven,
      sensors: { network: {}, console: {}, uiSignals: uiNoFeedback },
      comparisons: comparisonsUrlDom
    }
  },
  {
    name: 'navigation silent failure with no url change',
    params: {
      findingType: 'navigation_silent_failure',
      expectation: baseExpectationProven,
      sensors: { network: networkData, console: consoleData, uiSignals: uiNoFeedback },
      comparisons: comparisonsUrlDom
    }
  },
  {
    name: 'partial navigation failure with url change and ui feedback',
    params: {
      findingType: 'partial_navigation_failure',
      expectation: baseExpectationObserved,
      sensors: { network: networkData, console: {}, uiSignals: uiFeedback },
      comparisons: { hasUrlChange: true, hasDomChange: false, hasVisibleChange: false }
    }
  },
  {
    name: 'medium band boundary with sensors missing',
    params: {
      findingType: 'network_silent_failure',
      expectation: baseExpectationWeak,
      sensors: { network: undefined, console: undefined, uiSignals: undefined },
      comparisons: comparisonsChanged
    }
  },
  {
    name: 'observed expectation capped when not repeated',
    params: {
      findingType: 'missing_feedback_failure',
      expectation: baseExpectationObserved,
      sensors: { network: networkData, console: consoleData, uiSignals: uiDomChange },
      comparisons: comparisonsChanged,
      attemptMeta: { repeated: false }
    }
  }
];

test('legacy and decomposed confidence outputs are strictly equivalent', () => {
  for (const testCase of matrix) {
    const { legacy, decomposed } = runBoth(testCase.params);
    assert.deepStrictEqual(decomposed, legacy, `Mismatch in output for case: ${testCase.name}`);
    assert.strictEqual(JSON.stringify(decomposed), JSON.stringify(legacy), `Stringified mismatch for case: ${testCase.name}`);
  }
});

test('determinism: same input produces identical output objects', () => {
  for (const testCase of matrix) {
    const first = decomposedCompute(testCase.params);
    const second = decomposedCompute(testCase.params);
    assert.deepStrictEqual(second, first, `Non-deterministic output for case: ${testCase.name}`);
    assert.strictEqual(JSON.stringify(second), JSON.stringify(first), `Stringified non-determinism for case: ${testCase.name}`);
  }
});
