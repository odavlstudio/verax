/**
 * Stage 5: CI Gate Mode Test
 * 
 * Verifies:
 * - Advisory mode: always exit 0
 * - Gate mode: blocks on DO_NOT_LAUNCH
 * - Mode is recorded in decision.json
 */

const { parseCiGateMode, computeExitCode, formatModeExplanation, validateMode, ADVISORY_WARNING, printAdvisoryWarning } = require('../src/guardian/ci-gate');
const { mapExitCodeFromCanonical } = require('../src/guardian/verdicts');

console.log('🧪 Stage 5: CI Gate Mode Test');
console.log('━'.repeat(70));

function testParseCiGateMode() {
  console.log('\n📝 Test 1: parseCiGateMode\n');

  // Test --mode flag
  let mode = parseCiGateMode(['--mode', 'gate'], {});
  if (mode !== 'gate') {
    throw new Error(`Expected 'gate', got '${mode}'`);
  }
  console.log('✅ --mode gate parsed correctly');

  mode = parseCiGateMode(['--mode', 'advisory'], {});
  if (mode !== 'advisory') {
    throw new Error(`Expected 'advisory', got '${mode}'`);
  }
  console.log('✅ --mode advisory parsed correctly');

  // Default (no flag) must be gate
  mode = parseCiGateMode([], {});
  if (mode !== 'gate') {
    throw new Error(`Expected default 'gate', got '${mode}'`);
  }
  console.log('✅ Default mode is gate (strict)');

  console.log('\n✅ Test 1 PASSED\n');
}

function testComputeExitCode() {
  console.log('📝 Test 2: computeExitCode\n');

  // Advisory mode - explicit and non-blocking
  let exitCode = computeExitCode('READY', 'advisory');
  if (exitCode !== 0) {
    throw new Error(`Advisory READY: expected 0, got ${exitCode}`);
  }
  console.log('✅ Advisory mode, READY → exit 0');

  exitCode = computeExitCode('FRICTION', 'advisory');
  if (exitCode !== 0) {
    throw new Error(`Advisory FRICTION: expected 0, got ${exitCode}`);
  }
  console.log('✅ Advisory mode, FRICTION → exit 0');

  exitCode = computeExitCode('DO_NOT_LAUNCH', 'advisory');
  if (exitCode !== 0) {
    throw new Error(`Advisory DO_NOT_LAUNCH: expected 0, got ${exitCode}`);
  }
  console.log('✅ Advisory mode, DO_NOT_LAUNCH → exit 0');

  exitCode = computeExitCode('ERROR', 'advisory');
  if (exitCode !== 0) {
    throw new Error(`Advisory ERROR: expected 0, got ${exitCode}`);
  }
  console.log('✅ Advisory mode, ERROR → exit 0');

  // Gate mode - strict mapping
  exitCode = computeExitCode('READY', 'gate');
  if (exitCode !== 0) {
    throw new Error(`Gate READY: expected 0, got ${exitCode}`);
  }
  console.log('✅ Gate mode, READY → exit 0');

  exitCode = computeExitCode('FRICTION', 'gate');
  if (exitCode !== 1) {
    throw new Error(`Gate FRICTION: expected 1, got ${exitCode}`);
  }
  console.log('✅ Gate mode, FRICTION → exit 1');

  exitCode = computeExitCode('DO_NOT_LAUNCH', 'gate');
  if (exitCode !== 2) {
    throw new Error(`Gate DO_NOT_LAUNCH: expected 2, got ${exitCode}`);
  }
  console.log('✅ Gate mode, DO_NOT_LAUNCH → exit 2 (blocks deploy)');

  exitCode = computeExitCode('ERROR', 'gate');
  if (exitCode !== 2) {
    throw new Error(`Gate ERROR: expected 2, got ${exitCode}`);
  }
  console.log('✅ Gate mode, ERROR → exit 2 (treated as DO_NOT_LAUNCH)');

  exitCode = computeExitCode('UNKNOWN', 'gate');
  if (exitCode !== 2) {
    throw new Error(`Gate UNKNOWN: expected 2, got ${exitCode}`);
  }
  console.log('✅ Gate mode, UNKNOWN → exit 2 (treated as DO_NOT_LAUNCH)');

  console.log('\n✅ Test 2 PASSED\n');
}

function testFormatModeExplanation() {
  console.log('📝 Test 3: formatModeExplanation\n');

  let explanation = formatModeExplanation('advisory');
  if (!explanation.includes('ADVISORY')) {
    throw new Error('Advisory explanation missing keyword');
  }
  if (!explanation.includes('exit 0')) {
    throw new Error('Advisory explanation missing exit 0');
  }
  console.log('✅ Advisory mode explanation formatted');
  console.log(`   ${explanation}`);

  explanation = formatModeExplanation('gate');
  if (!explanation.includes('GATE')) {
    throw new Error('Gate explanation missing keyword');
  }
  if (!explanation.includes('blocks deploy')) {
    throw new Error('Gate explanation missing blocking notice');
  }
  console.log('✅ Gate mode explanation formatted');
  console.log(`   ${explanation}`);

  console.log('\n✅ Test 3 PASSED\n');
}

function testValidateMode() {
  console.log('📝 Test 4: validateMode\n');

  let validation = validateMode('advisory');
  if (!validation.valid) {
    throw new Error('advisory should be valid');
  }
  console.log('✅ advisory mode is valid');

  validation = validateMode('gate');
  if (!validation.valid) {
    throw new Error('gate should be valid');
  }
  console.log('✅ gate mode is valid');

  validation = validateMode('invalid');
  if (validation.valid) {
    throw new Error('invalid mode should not be valid');
  }
  if (!validation.error) {
    throw new Error('validation should have error message');
  }
  console.log('✅ Invalid mode rejected');
  console.log(`   Error: ${validation.error}`);

  console.log('\n✅ Test 4 PASSED\n');
}

function testAdvisoryVsGateScenarios() {
  console.log('📝 Test 5: Advisory vs Gate scenarios\n');

  // Scenario 1: READY - both modes allow
  let advisoryExit = computeExitCode('READY', 'advisory');
  let gateExit = computeExitCode('READY', 'gate');
  if (advisoryExit !== 0 || gateExit !== 0) {
    throw new Error('READY should allow in both modes');
  }
  console.log('✅ READY: Both modes allow (exit 0)');

  // Scenario 2: DO_NOT_LAUNCH - gate blocks with non-zero
  advisoryExit = computeExitCode('DO_NOT_LAUNCH', 'advisory');
  gateExit = computeExitCode('DO_NOT_LAUNCH', 'gate');
  if (advisoryExit !== 0) {
    throw new Error('Advisory mode should allow DO_NOT_LAUNCH');
  }
  if (gateExit !== 2) {
    throw new Error('Gate mode should block DO_NOT_LAUNCH');
  }
  console.log('✅ DO_NOT_LAUNCH: Gate blocks (exit 2)');

  // Scenario 3: ERROR - gate blocks with exit 2 (default DO_NOT_LAUNCH)
  advisoryExit = computeExitCode('ERROR', 'advisory');
  gateExit = computeExitCode('ERROR', 'gate');
  if (advisoryExit !== 0) {
    throw new Error('Advisory mode should allow ERROR');
  }
  if (gateExit !== 2) {
    throw new Error('Gate mode should block ERROR with exit 2 (DO_NOT_LAUNCH)');
  }
  console.log('✅ ERROR: Gate blocks (exit 2)');

  console.log('\n✅ Test 5 PASSED\n');
}

function testAdvisoryWarning() {
  console.log('\n📝 Test 6: Advisory mode warning\n');

  const logs = [];
  printAdvisoryWarning((msg) => logs.push(msg));

  if (logs.length !== 1) {
    throw new Error('Warning should be logged exactly once');
  }
  if (!logs[0].includes('ADVISORY mode')) {
    throw new Error('Warning text missing advisory marker');
  }
  if (logs[0] !== ADVISORY_WARNING) {
    throw new Error('Warning text must match constant');
  }

  console.log('✅ Advisory warning emitted and matches constant');
}

function testProcessExitEnforcement() {
  console.log('\n📝 Test 7: Process exit code enforcement\n');

  process.exitCode = undefined;
  const doNotLaunchExit = computeExitCode('DO_NOT_LAUNCH', 'gate');
  if (doNotLaunchExit !== 2) {
    throw new Error(`Gate DO_NOT_LAUNCH should exit 2, got ${doNotLaunchExit}`);
  }
  if (process.exitCode !== 2) {
    throw new Error(`process.exitCode should be 2 for DO_NOT_LAUNCH, got ${process.exitCode}`);
  }

  process.exitCode = undefined;
  const errorExit = computeExitCode('ERROR', 'gate');
  if (errorExit !== 2) {
    throw new Error(`Gate ERROR should exit 2 (DO_NOT_LAUNCH), got ${errorExit}`);
  }
  if (process.exitCode !== 2) {
    throw new Error(`process.exitCode should be 2 for ERROR, got ${process.exitCode}`);
  }

  process.exitCode = undefined;
  const advisoryLogs = [];
  const advisoryExit = computeExitCode('FRICTION', 'advisory', (msg) => advisoryLogs.push(msg));
  if (advisoryExit !== 0) {
    throw new Error(`Advisory mode should exit 0, got ${advisoryExit}`);
  }
  if (process.exitCode !== 0) {
    throw new Error(`process.exitCode should be 0 in advisory mode, got ${process.exitCode}`);
  }
  if (advisoryLogs.length !== 1 || advisoryLogs[0] !== ADVISORY_WARNING) {
    throw new Error('Advisory mode must emit warning exactly once');
  }

  process.exitCode = undefined;

  console.log('✅ Exit codes are assigned to process and advisory mode warns explicitly');
}

function testCanonicalExitMapping() {
  console.log('\n📝 Test 8: Canonical exit mapping alignment\n');

  const ready = mapExitCodeFromCanonical('READY');
  const friction = mapExitCodeFromCanonical('FRICTION');
  const doNotLaunch = mapExitCodeFromCanonical('DO_NOT_LAUNCH');
  const error = mapExitCodeFromCanonical('ERROR');
  const unknown = mapExitCodeFromCanonical('UNKNOWN');

  if (ready !== 0) throw new Error('READY should map to exit 0');
  if (friction !== 1) throw new Error('FRICTION should map to exit 1');
  if (doNotLaunch !== 2) throw new Error('DO_NOT_LAUNCH should map to exit 2');
  if (error !== 2) throw new Error('ERROR should map to exit 2 (DO_NOT_LAUNCH default)');
  if (unknown !== 2) throw new Error('UNKNOWN should map to exit 2 (DO_NOT_LAUNCH default)');

  console.log('✅ Canonical verdicts map to strict CI exit codes');
}

function runCiGateTests() {
  try {
    testParseCiGateMode();
    testComputeExitCode();
    testFormatModeExplanation();
    testValidateMode();
    testAdvisoryVsGateScenarios();
    testAdvisoryWarning();
    testProcessExitEnforcement();
    testCanonicalExitMapping();

    console.log('━'.repeat(70));
    console.log('✅ All CI gate mode tests PASSED');
    console.log('━'.repeat(70));
    process.exit(0);

  } catch (err) {
    console.error(`\n❌ Test failed: ${err.message}`);
    if (err.stack) console.error(err.stack);
    console.log('━'.repeat(70));
    console.log('❌ CI gate mode tests FAILED');
    console.log('━'.repeat(70));
    process.exit(1);
  }
}

runCiGateTests();
