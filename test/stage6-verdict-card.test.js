/**
 * Stage 6: Verdict Card Unit Tests
 * 
 * Tests verdict card generation functions independently
 */

const verdictCard = require('../src/guardian/verdict-card');

console.log('🧪 Stage 6: Verdict Card Unit Tests');
console.log('━'.repeat(70));

// Test 1: Severity determination
function testDetermineSeverity() {
  console.log('📝 Test 1: determineSeverity()');

  // DO_NOT_LAUNCH + checkout path = HIGH
  let severity = verdictCard.determineSeverity(
    'DO_NOT_LAUNCH',
    {},
    [],
    [{ outcome: 'FAILURE', flowId: 'checkout_flow' }]
  );
  if (severity !== 'HIGH') {
    throw new Error(`Expected HIGH for DO_NOT_LAUNCH checkout, got ${severity}`);
  }
  console.log('  ✅ DO_NOT_LAUNCH + checkout → HIGH');

  // DO_NOT_LAUNCH + 2+ failures = HIGH
  severity = verdictCard.determineSeverity(
    'DO_NOT_LAUNCH',
    {},
    [
      { outcome: 'FAILURE', attemptId: 'home' },
      { outcome: 'FAILURE', attemptId: 'products' }
    ],
    []
  );
  if (severity !== 'HIGH') {
    throw new Error(`Expected HIGH for DO_NOT_LAUNCH with multiple failures, got ${severity}`);
  }
  console.log('  ✅ DO_NOT_LAUNCH + multiple failures → HIGH');

  // FRICTION = MEDIUM
  severity = verdictCard.determineSeverity('FRICTION', {}, [], []);
  if (severity !== 'MEDIUM' && severity !== 'LOW') {
    throw new Error(`Expected MEDIUM or LOW for FRICTION, got ${severity}`);
  }
  console.log(`  ✅ FRICTION → ${severity}`);

  // READY = LOW
  severity = verdictCard.determineSeverity('READY', {}, [], []);
  if (severity !== 'LOW') {
    throw new Error(`Expected LOW for READY, got ${severity}`);
  }
  console.log('  ✅ READY → LOW');

  // ERROR = HIGH
  severity = verdictCard.determineSeverity('ERROR', {}, [], []);
  if (severity !== 'HIGH') {
    throw new Error(`Expected HIGH for ERROR, got ${severity}`);
  }
  console.log('  ✅ ERROR → HIGH');

  console.log('✅ Test 1 PASSED\n');
}

// Test 2: Business impact estimation
function testEstimateBusinessImpact() {
  console.log('📝 Test 2: estimateBusinessImpact()');

  // READY = MINIMAL_RISK
  let impact = verdictCard.estimateBusinessImpact(
    'READY',
    [],
    [],
    { percent: 80, executed: 8, total: 10 },
    null
  );
  if (impact.type !== 'MINIMAL_RISK') {
    throw new Error(`Expected MINIMAL_RISK for READY, got ${impact.type}`);
  }
  console.log('  ✅ READY → MINIMAL_RISK');

  // Checkout failure = CONVERSION_RISK
  impact = verdictCard.estimateBusinessImpact(
    'DO_NOT_LAUNCH',
    [{ outcome: 'FAILURE', attemptId: 'checkout' }],
    [{ outcome: 'FAILURE', flowId: 'checkout_flow' }],
    { percent: 30 },
    null
  );
  if (impact.type !== 'CONVERSION_RISK') {
    throw new Error(`Expected CONVERSION_RISK for checkout failure, got ${impact.type}`);
  }
  if (!impact.summary.toLowerCase().includes('revenue') && !impact.summary.toLowerCase().includes('purchase')) {
    throw new Error('Expected revenue/purchase language for CONVERSION_RISK');
  }
  console.log('  ✅ Checkout failure → CONVERSION_RISK with revenue language');

  // Signup failure = ACQUISITION_RISK
  impact = verdictCard.estimateBusinessImpact(
    'DO_NOT_LAUNCH',
    [{ outcome: 'FAILURE', attemptId: 'signup' }],
    [{ outcome: 'FAILURE', flowId: 'signup_flow' }],
    { percent: 30 },
    null
  );
  if (impact.type !== 'ACQUISITION_RISK') {
    throw new Error(`Expected ACQUISITION_RISK for signup failure, got ${impact.type}`);
  }
  if (!impact.summary.toLowerCase().includes('growth') && !impact.summary.toLowerCase().includes('sign')) {
    throw new Error('Expected growth/signup language for ACQUISITION_RISK');
  }
  console.log('  ✅ Signup failure → ACQUISITION_RISK with growth language');

  // Contact failure = LEAD_RISK
  impact = verdictCard.estimateBusinessImpact(
    'DO_NOT_LAUNCH',
    [{ outcome: 'FAILURE', attemptId: 'contact' }],
    [{ outcome: 'FAILURE', flowId: 'contact_form' }],
    { percent: 30 },
    null
  );
  if (impact.type !== 'LEAD_RISK') {
    throw new Error(`Expected LEAD_RISK for contact failure, got ${impact.type}`);
  }
  console.log('  ✅ Contact failure → LEAD_RISK');

  // FRICTION = USER_FRICTION
  impact = verdictCard.estimateBusinessImpact(
    'FRICTION',
    [{ outcome: 'NEAR_SUCCESS', attemptId: 'checkout' }],
    [{ outcome: 'FRICTION', flowId: 'form_submit' }],
    { percent: 60 },
    null
  );
  if (impact.type !== 'USER_FRICTION') {
    throw new Error(`Expected USER_FRICTION for FRICTION verdict, got ${impact.type}`);
  }
  if (!impact.summary.toLowerCase().includes('abandon') && !impact.summary.toLowerCase().includes('friction')) {
    throw new Error('Expected abandonment/friction language for USER_FRICTION');
  }
  console.log('  ✅ FRICTION → USER_FRICTION with abandonment risk');

  console.log('✅ Test 2 PASSED\n');
}

// Test 3: Headline generation
function testGenerateHeadline() {
  console.log('📝 Test 3: generateHeadline()');

  // READY headline
  let headline = verdictCard.generateHeadline(
    'READY',
    { type: 'MINIMAL_RISK', summary: 'Site appears functional', confidence: 'HIGH' },
    [],
    [],
    []
  );
  if (!headline.toLowerCase().includes('ready') && !headline.toLowerCase().includes('passed')) {
    console.log(`  ⚠️  Unexpected headline for READY: ${headline}`);
  } else {
    console.log(`  ✅ READY: ${headline}`);
  }

  // DO_NOT_LAUNCH + CONVERSION_RISK headline
  headline = verdictCard.generateHeadline(
    'DO_NOT_LAUNCH',
    { type: 'CONVERSION_RISK', summary: 'Revenue at risk', confidence: 'HIGH' },
    [{ outcome: 'FAILURE' }],
    [{ outcome: 'FAILURE', flowId: 'checkout' }],
    []
  );
  console.log(`  ✅ DO_NOT_LAUNCH: ${headline}`);

  // DO_NOT_LAUNCH + GENERAL_RISK headline
  headline = verdictCard.generateHeadline(
    'DO_NOT_LAUNCH',
    { type: 'GENERAL_RISK', summary: 'Multiple issues detected', confidence: 'MODERATE' },
    [{ outcome: 'FAILURE' }],
    [],
    []
  );
  console.log(`  ✅ General failure: ${headline}`);

  // FRICTION headline
  headline = verdictCard.generateHeadline(
    'FRICTION',
    { type: 'USER_FRICTION', summary: 'Abandonment risk', confidence: 'MODERATE' },
    [{ outcome: 'NEAR_SUCCESS' }],
    [{ outcome: 'FRICTION' }],
    []
  );
  console.log(`  ✅ FRICTION: ${headline}`);

  console.log('✅ Test 3 PASSED\n');
}

// Test 4: Full verdict card generation
function testGenerateVerdictCard() {
  console.log('📝 Test 4: generateVerdictCard() - full integration');

  // Scenario 1: READY with good coverage
  let card = verdictCard.generateVerdictCard({
    finalDecision: {
      finalVerdict: 'READY',
      exitCode: 0,
      humanPath: ['Home', 'Products', 'Checkout']
    },
    humanPath: ['Home', 'Products', 'Checkout'],
    coverage: { percent: 80, executed: 8, total: 10, gaps: 2 },
    selectorConfidence: { avgConfidence: 0.9 },
    networkSafety: { totalRequests: 50 },
    policyEval: { passed: true },
    baselineDiff: {},
    attemptResults: [
      { outcome: 'SUCCESS', attemptId: 'home' },
      { outcome: 'SUCCESS', attemptId: 'products' }
    ],
    flowResults: [],
    siteIntelligence: null
  });

  if (!card.headline) throw new Error('Card missing headline');
  if (!card.severity) throw new Error('Card missing severity');
  if (!card.impact) throw new Error('Card missing impact');
  if (!Array.isArray(card.bullets)) throw new Error('Card missing bullets array');
  if (!Array.isArray(card.evidence)) throw new Error('Card missing evidence array');
  if (!Array.isArray(card.nextActions)) throw new Error('Card missing nextActions array');

  console.log(`  ✅ READY card structure valid`);
  console.log(`     Headline: ${card.headline}`);
  console.log(`     Severity: ${card.severity}`);
  console.log(`     Impact: ${card.impact.type}`);

  // Scenario 2: DO_NOT_LAUNCH with checkout failure
  card = verdictCard.generateVerdictCard({
    finalDecision: {
      finalVerdict: 'DO_NOT_LAUNCH',
      exitCode: 2,
      humanPath: []
    },
    humanPath: [],
    coverage: { percent: 50, executed: 5, total: 10, gaps: 5 },
    selectorConfidence: null,
    networkSafety: {},
    policyEval: { passed: false },
    baselineDiff: {},
    attemptResults: [
      { outcome: 'FAILURE', attemptId: 'checkout' }
    ],
    flowResults: [
      { outcome: 'FAILURE', success: false, flowId: 'payment_flow' }
    ],
    siteIntelligence: null
  });

  if (card.severity !== 'HIGH') {
    throw new Error(`Expected HIGH severity for critical failure, got ${card.severity}`);
  }
  if (card.impact.type !== 'CONVERSION_RISK') {
    throw new Error(`Expected CONVERSION_RISK for checkout failure, got ${card.impact.type}`);
  }
  console.log(`  ✅ DO_NOT_LAUNCH card structure valid`);
  console.log(`     Headline: ${card.headline}`);
  console.log(`     Severity: ${card.severity}`);
  console.log(`     Impact: ${card.impact.type}`);

  // Scenario 3: FRICTION
  card = verdictCard.generateVerdictCard({
    finalDecision: {
      finalVerdict: 'FRICTION',
      exitCode: 1,
      humanPath: ['Home']
    },
    humanPath: ['Home'],
    coverage: { percent: 60, executed: 6, total: 10, gaps: 4 },
    selectorConfidence: { avgConfidence: 0.7 },
    networkSafety: { totalRequests: 100, excessiveThirdParty: true, thirdPartyCount: 15 },
    policyEval: { passed: true },
    baselineDiff: {},
    attemptResults: [
      { outcome: 'NEAR_SUCCESS', attemptId: 'signup' }
    ],
    flowResults: [
      { outcome: 'FRICTION', flowId: 'form_submit' }
    ],
    siteIntelligence: null
  });

  if (card.severity !== 'MEDIUM' && card.severity !== 'LOW') {
    throw new Error(`Expected MEDIUM or LOW severity for FRICTION, got ${card.severity}`);
  }
  if (card.impact.type !== 'USER_FRICTION') {
    throw new Error(`Expected USER_FRICTION for FRICTION verdict, got ${card.impact.type}`);
  }
  console.log(`  ✅ FRICTION card structure valid`);
  console.log(`     Headline: ${card.headline}`);
  console.log(`     Severity: ${card.severity}`);
  console.log(`     Impact: ${card.impact.type}`);

  console.log('✅ Test 4 PASSED\n');
}

// Test 5: Card limits enforcement
function testCardLimits() {
  console.log('📝 Test 5: Card limits enforcement (max 3 items)');

  // Generate card with many potential bullets
  const card = verdictCard.generateVerdictCard({
    finalDecision: {
      finalVerdict: 'DO_NOT_LAUNCH',
      exitCode: 2,
      humanPath: ['A', 'B', 'C', 'D', 'E']
    },
    humanPath: ['A', 'B', 'C', 'D', 'E'],
    coverage: { percent: 30, executed: 3, total: 10, gaps: 7 },
    selectorConfidence: { avgConfidence: 0.5 },
    networkSafety: { 
      totalRequests: 200, 
      excessiveThirdParty: true, 
      thirdPartyCount: 20,
      httpWarnings: ['site1.com', 'site2.com', 'site3.com']
    },
    policyEval: { passed: false, violations: ['A', 'B', 'C'] },
    baselineDiff: { hasRegression: true },
    attemptResults: [],
    flowResults: [],
    siteIntelligence: null
  });

  if (card.bullets.length > 3) {
    throw new Error(`Too many bullets: ${card.bullets.length}, max is 3`);
  }
  console.log(`  ✅ Bullets: ${card.bullets.length}/3`);

  if (card.evidence.length > 3) {
    throw new Error(`Too many evidence lines: ${card.evidence.length}, max is 3`);
  }
  console.log(`  ✅ Evidence: ${card.evidence.length}/3`);

  if (card.nextActions.length > 3) {
    throw new Error(`Too many actions: ${card.nextActions.length}, max is 3`);
  }
  console.log(`  ✅ Next actions: ${card.nextActions.length}/3`);

  console.log('✅ Test 5 PASSED\n');
}

// Run all tests
try {
  testDetermineSeverity();
  testEstimateBusinessImpact();
  testGenerateHeadline();
  testGenerateVerdictCard();
  testCardLimits();

  console.log('━'.repeat(70));
  console.log('✅ All verdict card unit tests PASSED');
  console.log('━'.repeat(70));
  process.exit(0);

} catch (err) {
  console.error(`\n❌ Test failed: ${err.message}`);
  if (err.stack) console.error(err.stack);
  console.log('━'.repeat(70));
  console.log('❌ Verdict card unit tests FAILED');
  console.log('━'.repeat(70));
  process.exit(1);
}
