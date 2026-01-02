/**
 * Honesty Enforcement Tests
 * Verify Guardian cannot make claims it hasn't tested
 */

const assert = require('assert');
const { buildHonestyContract, enforceHonestyInVerdict, validateHonestyContract } = require('../src/guardian/honesty');

function runHonestyTests() {
  console.log('\n🔒 Honesty Enforcement Tests');
  console.log('═'.repeat(70));
  
  let passed = 0;
  let failed = 0;

  // TEST 1: READY with partial coverage → must include untestedScope + reduced confidence
  try {
    console.log('\n📋 Test 1: READY with 50% coverage must show untested scope');
    
    const executionData = {
      attemptResults: [
        { executed: true, outcome: 'SUCCESS', attemptId: 'test1' },
        { executed: true, outcome: 'SUCCESS', attemptId: 'test2' },
        { executed: false, outcome: 'SKIPPED', attemptId: 'test3', skipReason: 'Not executed' },
        { executed: false, outcome: 'SKIPPED', attemptId: 'test4', skipReason: 'Not executed' }
      ],
      flowResults: [],
      requestedAttempts: ['test1', 'test2', 'test3', 'test4'],
      totalPossibleAttempts: 4,
      crawlData: { visitedCount: 0 },
      coverageSignal: {}
    };

    const honestyContract = buildHonestyContract(executionData);
    
    assert.ok(honestyContract, 'Honesty contract should exist');
    assert.strictEqual(honestyContract.coverageStats.percent, 50, 'Coverage should be 50%');
    assert.ok(honestyContract.untestedScope.length > 0, 'Should have untested scope');
    assert.ok(honestyContract.testedScope.length === 2, 'Should have 2 tested items');
    assert.ok(honestyContract.nonClaims.length > 0, 'Should have explicit non-claims');
    assert.ok(honestyContract.limits.length > 0, 'Should have limits');
    
    // Enforce honesty - READY should be downgraded with 50% coverage
    const honestVerdict = enforceHonestyInVerdict('READY', honestyContract);
    assert.strictEqual(honestVerdict.verdict, 'FRICTION', 'READY with 50% coverage should be downgraded to FRICTION');
    assert.ok(honestVerdict.honestyEnforced, 'Honesty enforcement flag should be set');
    
    passed++;
    console.log('✅ Test 1 PASSED: Partial coverage triggers honesty adjustment');
  } catch (e) {
    failed++;
    console.error('❌ Test 1 FAILED:', e.message);
  }

  // TEST 2: Missing honesty data → DO_NOT_LAUNCH
  try {
    console.log('\n📋 Test 2: Missing honesty data must force DO_NOT_LAUNCH');
    
    const honestVerdict = enforceHonestyInVerdict('READY', null);
    
    assert.strictEqual(honestVerdict.verdict, 'DO_NOT_LAUNCH', 'Missing honesty should force DO_NOT_LAUNCH');
    assert.strictEqual(honestVerdict.confidence, 0, 'Confidence should be 0');
    assert.ok(honestVerdict.honestyEnforced, 'Honesty enforcement flag should be set');
    assert.ok(honestVerdict.reason.includes('HONESTY VIOLATION'), 'Should explain honesty violation');
    
    passed++;
    console.log('✅ Test 2 PASSED: Missing honesty data forces fail-safe');
  } catch (e) {
    failed++;
    console.error('❌ Test 2 FAILED:', e.message);
  }

  // TEST 3: Zero execution → DO_NOT_LAUNCH
  try {
    console.log('\n📋 Test 3: Zero execution cannot claim READY');
    
    const executionData = {
      attemptResults: [
        { executed: false, outcome: 'SKIPPED', attemptId: 'test1', skipReason: 'Not executed' },
        { executed: false, outcome: 'SKIPPED', attemptId: 'test2', skipReason: 'Not executed' }
      ],
      flowResults: [],
      requestedAttempts: ['test1', 'test2'],
      totalPossibleAttempts: 2,
      crawlData: { visitedCount: 0 },
      coverageSignal: {}
    };

    const honestyContract = buildHonestyContract(executionData);
    const honestVerdict = enforceHonestyInVerdict('READY', honestyContract);
    
    assert.strictEqual(honestVerdict.verdict, 'DO_NOT_LAUNCH', 'Zero execution cannot claim READY');
    assert.ok(honestVerdict.reason.includes('zero execution'), 'Should explain zero execution issue');
    
    passed++;
    console.log('✅ Test 3 PASSED: Zero execution prevents READY verdict');
  } catch (e) {
    failed++;
    console.error('❌ Test 3 FAILED:', e.message);
  }

  // TEST 4: High coverage (80%) allows READY
  try {
    console.log('\n📋 Test 4: High coverage (80%+) allows READY verdict');
    
    const executionData = {
      attemptResults: [
        { executed: true, outcome: 'SUCCESS', attemptId: 'test1' },
        { executed: true, outcome: 'SUCCESS', attemptId: 'test2' },
        { executed: true, outcome: 'SUCCESS', attemptId: 'test3' },
        { executed: true, outcome: 'SUCCESS', attemptId: 'test4' },
        { executed: false, outcome: 'SKIPPED', attemptId: 'test5', skipReason: 'Not executed' }
      ],
      flowResults: [],
      requestedAttempts: ['test1', 'test2', 'test3', 'test4', 'test5'],
      totalPossibleAttempts: 5,
      crawlData: { visitedCount: 0 },
      coverageSignal: {}
    };

    const honestyContract = buildHonestyContract(executionData);
    const honestVerdict = enforceHonestyInVerdict('READY', honestyContract);
    
    assert.strictEqual(honestyContract.coverageStats.percent, 80, 'Coverage should be 80%');
    assert.strictEqual(honestVerdict.verdict, 'READY', 'READY allowed with 80% coverage');
    assert.strictEqual(honestVerdict.honestyEnforced, false, 'No honesty adjustment needed');
    assert.ok(honestyContract.untestedScope.length > 0, 'Should still show untested scope');
    assert.ok(honestyContract.limits.length > 0, 'Should still show limits');
    
    passed++;
    console.log('✅ Test 4 PASSED: High coverage allows READY with limits disclosed');
  } catch (e) {
    failed++;
    console.error('❌ Test 4 FAILED:', e.message);
  }

  // TEST 5: Honesty contract validation
  try {
    console.log('\n📋 Test 5: Honesty contract structure validation');
    
    const validContract = {
      testedScope: ['test1'],
      untestedScope: ['test2'],
      confidenceBasis: { score: 0.8, summary: 'test', details: [] },
      nonClaims: ['claim1'],
      limits: ['limit1'],
      coverageStats: { executed: 1, total: 2, percent: 50 }
    };
    
    const validation = validateHonestyContract(validContract);
    assert.ok(validation.valid, 'Valid contract should pass validation');
    
    const invalidContract = {
      testedScope: ['test1']
      // missing required fields
    };
    
    const validation2 = validateHonestyContract(invalidContract);
    assert.ok(!validation2.valid, 'Invalid contract should fail validation');
    assert.ok(validation2.reason, 'Should provide reason for failure');
    
    passed++;
    console.log('✅ Test 5 PASSED: Honesty contract validation works');
  } catch (e) {
    failed++;
    console.error('❌ Test 5 FAILED:', e.message);
  }

  // TEST 6: Non-claims are explicit and concrete
  try {
    console.log('\n📋 Test 6: Non-claims must be explicit and concrete');
    
    const executionData = {
      attemptResults: [
        { executed: true, outcome: 'SUCCESS', attemptId: 'test1' },
        { executed: false, outcome: 'SKIPPED', attemptId: 'test2', skipReason: 'Disabled' },
        { disabledByPreset: true, attemptId: 'test3' }
      ],
      flowResults: [],
      requestedAttempts: ['test1', 'test2'],
      totalPossibleAttempts: 3,
      crawlData: { visitedCount: 0 },
      coverageSignal: {}
    };

    const honestyContract = buildHonestyContract(executionData);
    
    assert.ok(honestyContract.nonClaims.length > 0, 'Should have non-claims');
    
    // Check for specific non-claims
    const hasUntestableWorkflowsClaim = honestyContract.nonClaims.some(c => 
      c.includes('test') || c.includes('workflow') || c.includes('NOT')
    );
    assert.ok(hasUntestableWorkflowsClaim, 'Should explicitly state what was NOT tested');
    
    const hasUniversalNonClaims = honestyContract.nonClaims.some(c => 
      c.includes('Real user') || c.includes('Future changes') || c.includes('Performance')
    );
    assert.ok(hasUniversalNonClaims, 'Should include universal non-claims');
    
    passed++;
    console.log('✅ Test 6 PASSED: Non-claims are explicit and concrete');
  } catch (e) {
    failed++;
    console.error('❌ Test 6 FAILED:', e.message);
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log(`✅ Tests passed: ${passed}`);
  console.log(`❌ Tests failed: ${failed}`);
  console.log('═'.repeat(70) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runHonestyTests();
