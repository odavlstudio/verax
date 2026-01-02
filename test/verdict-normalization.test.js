/**
 * Verdict Normalization Tests
 * Ensures UNKNOWN can never escape and all verdicts are canonical
 */

const assert = require('assert');
const { normalizeCanonicalVerdict, toCanonicalVerdict, mapExitCodeFromCanonical } = require('../src/guardian/verdicts');

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}: ${err.message}`);
    process.exit(1);
  }
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🧪 Verdict Normalization Tests');
console.log('═══════════════════════════════════════════════════════════════\n');

// Test 1: Normalize canonical verdicts (pass-through)
test('Canonical READY stays READY', () => {
  assert.strictEqual(normalizeCanonicalVerdict('READY'), 'READY');
  assert.strictEqual(normalizeCanonicalVerdict('ready'), 'READY');
});

test('Canonical FRICTION stays FRICTION', () => {
  assert.strictEqual(normalizeCanonicalVerdict('FRICTION'), 'FRICTION');
  assert.strictEqual(normalizeCanonicalVerdict('friction'), 'FRICTION');
});

test('Canonical DO_NOT_LAUNCH stays DO_NOT_LAUNCH', () => {
  assert.strictEqual(normalizeCanonicalVerdict('DO_NOT_LAUNCH'), 'DO_NOT_LAUNCH');
  assert.strictEqual(normalizeCanonicalVerdict('do_not_launch'), 'DO_NOT_LAUNCH');
});

// Test 2: Normalize internal verdicts
test('Internal OBSERVED → READY', () => {
  assert.strictEqual(normalizeCanonicalVerdict('OBSERVED'), 'READY');
});

test('Internal PARTIAL → FRICTION', () => {
  assert.strictEqual(normalizeCanonicalVerdict('PARTIAL'), 'FRICTION');
});

test('Internal INSUFFICIENT_DATA → DO_NOT_LAUNCH', () => {
  assert.strictEqual(normalizeCanonicalVerdict('INSUFFICIENT_DATA'), 'DO_NOT_LAUNCH');
});

// Test 3: Normalize synonyms
test('Synonym SUCCESS → READY', () => {
  assert.strictEqual(normalizeCanonicalVerdict('SUCCESS'), 'READY');
  assert.strictEqual(normalizeCanonicalVerdict('PASS'), 'READY');
});

test('Synonym WARNING → FRICTION', () => {
  assert.strictEqual(normalizeCanonicalVerdict('WARNING'), 'FRICTION');
  assert.strictEqual(normalizeCanonicalVerdict('WARN'), 'FRICTION');
});

test('Synonym FAILURE → DO_NOT_LAUNCH', () => {
  assert.strictEqual(normalizeCanonicalVerdict('FAILURE'), 'DO_NOT_LAUNCH');
  assert.strictEqual(normalizeCanonicalVerdict('FAIL'), 'DO_NOT_LAUNCH');
});

// Test 4: Normalize edge cases (critical - prevent UNKNOWN)
test('UNKNOWN input → DO_NOT_LAUNCH (fail-safe)', () => {
  assert.strictEqual(normalizeCanonicalVerdict('UNKNOWN'), 'DO_NOT_LAUNCH');
});

test('null input → DO_NOT_LAUNCH (fail-safe)', () => {
  assert.strictEqual(normalizeCanonicalVerdict(null), 'DO_NOT_LAUNCH');
});

test('undefined input → DO_NOT_LAUNCH (fail-safe)', () => {
  assert.strictEqual(normalizeCanonicalVerdict(undefined), 'DO_NOT_LAUNCH');
});

test('empty string → DO_NOT_LAUNCH (fail-safe)', () => {
  assert.strictEqual(normalizeCanonicalVerdict(''), 'DO_NOT_LAUNCH');
});

test('random string → DO_NOT_LAUNCH (fail-safe)', () => {
  assert.strictEqual(normalizeCanonicalVerdict('INVALID_VERDICT'), 'DO_NOT_LAUNCH');
  assert.strictEqual(normalizeCanonicalVerdict('xyz'), 'DO_NOT_LAUNCH');
});

test('number input → DO_NOT_LAUNCH (fail-safe)', () => {
  assert.strictEqual(normalizeCanonicalVerdict(123), 'DO_NOT_LAUNCH');
});

test('object input → DO_NOT_LAUNCH (fail-safe)', () => {
  assert.strictEqual(normalizeCanonicalVerdict({}), 'DO_NOT_LAUNCH');
});

// Test 5: Exit code mapping (all canonical verdicts map correctly)
test('READY → exit code 0', () => {
  assert.strictEqual(mapExitCodeFromCanonical('READY'), 0);
});

test('FRICTION → exit code 1', () => {
  assert.strictEqual(mapExitCodeFromCanonical('FRICTION'), 1);
});

test('DO_NOT_LAUNCH → exit code 2', () => {
  assert.strictEqual(mapExitCodeFromCanonical('DO_NOT_LAUNCH'), 2);
});

// Test 6: Chaining - normalize then map exit code
test('Normalize UNKNOWN then map exit code → 2', () => {
  const normalized = normalizeCanonicalVerdict('UNKNOWN');
  const exitCode = mapExitCodeFromCanonical(normalized);
  assert.strictEqual(normalized, 'DO_NOT_LAUNCH');
  assert.strictEqual(exitCode, 2);
});

test('Normalize null then map exit code → 2', () => {
  const normalized = normalizeCanonicalVerdict(null);
  const exitCode = mapExitCodeFromCanonical(normalized);
  assert.strictEqual(normalized, 'DO_NOT_LAUNCH');
  assert.strictEqual(exitCode, 2);
});

test('Normalize SUCCESS then map exit code → 0', () => {
  const normalized = normalizeCanonicalVerdict('SUCCESS');
  const exitCode = mapExitCodeFromCanonical(normalized);
  assert.strictEqual(normalized, 'READY');
  assert.strictEqual(exitCode, 0);
});

// Test 7: No function should ever return 'UNKNOWN'
test('toCanonicalVerdict never returns UNKNOWN', () => {
  const testInputs = ['UNKNOWN', 'xyz', null, undefined, '', 'INVALID', 0, {}, []];
  for (const input of testInputs) {
    const result = toCanonicalVerdict(input);
    assert(!result.includes('UNKNOWN'), `toCanonicalVerdict returned UNKNOWN for input: ${input}`);
    assert(['READY', 'FRICTION', 'DO_NOT_LAUNCH'].includes(result), `Invalid verdict: ${result}`);
  }
});

test('normalizeCanonicalVerdict never returns UNKNOWN', () => {
  const testInputs = ['UNKNOWN', 'xyz', null, undefined, '', 'INVALID', 0, {}, []];
  for (const input of testInputs) {
    const result = normalizeCanonicalVerdict(input);
    assert(!result.includes('UNKNOWN'), `normalizeCanonicalVerdict returned UNKNOWN for input: ${input}`);
    assert(['READY', 'FRICTION', 'DO_NOT_LAUNCH'].includes(result), `Invalid verdict: ${result}`);
  }
});

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('✅ All verdict normalization tests passed!');
console.log('═══════════════════════════════════════════════════════════════\n');
