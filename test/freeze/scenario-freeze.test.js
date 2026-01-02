// Scenario Integrity Freeze Test for Guardian Real-World Scenarios
// Fails on any scenario drift (add/remove/rename/change/ordering/values)

const assert = require('assert');
const path = require('path');
const { realWorldScenarios } = require('../../src/guardian/realworld-scenarios');
const frozen = require('./realworld-scenarios.snapshot');

function stableStringify(obj) {
  // Deterministic JSON stringify with sorted object keys
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  } else if (obj && typeof obj === 'object') {
    return '{' + Object.keys(obj).sort().map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
  } else {
    return JSON.stringify(obj);
  }
}

describe('Guardian Scenario Integrity Freeze', () => {
  it('matches the canonical scenario snapshot (no drift allowed)', () => {
    // No normalization except object key order
    const actual = realWorldScenarios;
    const expected = frozen;
    assert.strictEqual(
      stableStringify(actual),
      stableStringify(expected),
      '\nSCENARIO DRIFT DETECTED!\nIf this is intentional, update test/freeze/realworld-scenarios.snapshot.js.\nOtherwise, revert scenario changes.'
    );
    // Additional hard checks
    assert.strictEqual(actual.length, 6, 'Number of scenarios must be exactly 6');
    assert.strictEqual(expected.length, 6, 'Snapshot must have exactly 6 scenarios');
  });
});
