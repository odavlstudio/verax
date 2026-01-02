/**
 * Phase 5: Continuous Guard Mode Tests
 * 
 * Tests for CI/CD gating, JUnit reporting, and webhook notifications.
 * 
 * All tests must pass without breaking phases 1-4.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');

const { loadPolicy, evaluatePolicy, formatPolicyOutput, createDefaultPolicyFile } = require('../src/guardian/policy');
const { generateJunitXml, validateJunitXml, escapeXml } = require('../src/guardian/junit-reporter');
const { buildWebhookPayload, parseWebhookUrls, getWebhookUrl } = require('../src/guardian/webhook');

// Sample snapshot for testing
function createMockSnapshot(overrides = {}) {
  return {
    schemaVersion: 'v1',
    meta: {
      url: 'https://example.com',
      runId: 'test-run-20251223',
      createdAt: '2025-12-23T15:00:00Z',
      environment: 'test',
      toolVersion: packageJson.version
    },
    marketImpactSummary: {
      highestSeverity: 'INFO',
      totalRiskCount: 0,
      countsBySeverity: {
        CRITICAL: 0,
        WARNING: 0,
        INFO: 0
      },
      topRisks: []
    },
    attempts: [
      {
        attemptId: 'checkout',
        attemptName: 'Checkout Flow',
        goal: 'Complete purchase',
        outcome: 'SUCCESS',
        totalDurationMs: 1500,
        softFailureCount: 0
      }
    ],
    discovery: {
      pagesVisitedCount: 3,
      interactionsDiscovered: 15,
      interactionsExecuted: 10,
      results: []
    },
    baseline: {
      baselineFound: false,
      baselineCreatedThisRun: true,
      diff: null
    },
    evidence: {},
    ...overrides
  };
}

console.log('\n' + '━'.repeat(70));
console.log('🔐 Phase 5: Continuous Guard Mode Tests');
console.log('━'.repeat(70) + '\n');

// ============================================================================
// POLICY EVALUATION TESTS
// ============================================================================

console.log('🔒 Policy Evaluation Tests\n');

// Test 1: Default policy loads
console.log('Test 1: Default policy loads when no file exists');
const defaultPolicy = loadPolicy('/nonexistent/path.json');
assert(defaultPolicy.failOnSeverity === 'CRITICAL', 'Should default to CRITICAL severity');
assert(defaultPolicy.maxWarnings === 0, 'Should default maxWarnings to 0');
assert(defaultPolicy.failOnNewRegression === true, 'Should default failOnNewRegression to true');
console.log('✅ Test 1: Default policy loaded correctly\n');

// Test 2: Policy evaluation - all pass (no risks)
console.log('Test 2: Policy evaluation - PASS (no risks)');
const snapshot1 = createMockSnapshot({
  marketImpactSummary: {
    highestSeverity: 'INFO',
    totalRiskCount: 0,
    countsBySeverity: { CRITICAL: 0, WARNING: 0, INFO: 0 },
    topRisks: []
  }
});
const policy1 = loadPolicy('/nonexistent/path.json');
const eval1 = evaluatePolicy(snapshot1, policy1, {
  coverage: { gaps: 0, total: 1, executed: 1 },
  evidence: {
    metrics: { completeness: 1, integrity: 1 },
    missingScreenshots: false,
    missingTraces: false
  }
});
assert(eval1.passed === true, 'Should pass with no risks');
assert(eval1.exitCode === 0, 'Should have exit code 0');
console.log(`✅ Test 2: ${eval1.summary.substring(0, 30)}...\n`);

// Test 3: Policy evaluation - CRITICAL triggers fail
console.log('Test 3: Policy evaluation - FAIL (CRITICAL risk)');
const snapshot2 = createMockSnapshot({
  marketImpactSummary: {
    highestSeverity: 'CRITICAL',
    totalRiskCount: 1,
    countsBySeverity: { CRITICAL: 1, WARNING: 0, INFO: 0 },
    topRisks: [
      {
        category: 'REVENUE',
        severity: 'CRITICAL',
        impactScore: 95,
        humanReadableReason: 'Checkout failed'
      }
    ]
  }
});
const policy2 = loadPolicy('/nonexistent/path.json');
const eval2 = evaluatePolicy(snapshot2, policy2);
assert(eval2.passed === false, 'Should fail with CRITICAL');
assert(eval2.exitCode === 1, 'Should have exit code 1');
assert(eval2.reasons.length > 0, 'Should have failure reasons');
console.log(`✅ Test 3: ${eval2.summary}\n`);

// Test 4: Policy evaluation - maxWarnings
console.log('Test 4: Policy evaluation - maxWarnings exceeded');
const snapshot3 = createMockSnapshot({
  marketImpactSummary: {
    countsBySeverity: { CRITICAL: 0, WARNING: 5, INFO: 0 },
    totalRiskCount: 5
  }
});
const policy3 = { ...loadPolicy('/nonexistent/path.json'), maxWarnings: 2 };
const eval3 = evaluatePolicy(snapshot3, policy3);
assert(eval3.exitCode === 2, 'Should have exit code 2 for warning threshold');
assert(eval3.reasons[0].includes('WARNING'), 'Should mention WARNINGs');
console.log(`✅ Test 4: ${eval3.reasons[0]}\n`);

// Test 5: Policy evaluation - regression detection
console.log('Test 5: Policy evaluation - regression detection');
const snapshot4 = createMockSnapshot({
  baseline: {
    baselineFound: true,
    diff: {
      regressions: {
        checkout: { reason: 'Previously SUCCESS, now FAILURE' }
      }
    }
  }
});
const policy4 = loadPolicy('/nonexistent/path.json');
const eval4 = evaluatePolicy(snapshot4, policy4);
assert(eval4.exitCode === 1, 'Should fail on regression');
assert(eval4.reasons[0].includes('regression'), 'Should mention regression');
console.log(`✅ Test 5: ${eval4.reasons[0]}\n`);

// Test 6: Policy evaluation - soft failures
console.log('Test 6: Policy evaluation - soft failures threshold');
const snapshot5 = createMockSnapshot({
  attempts: [
    {
      attemptId: 'test1',
      softFailureCount: 5
    }
  ]
});
const policy5 = { ...loadPolicy('/nonexistent/path.json'), failOnSoftFailures: true };
const eval5 = evaluatePolicy(snapshot5, policy5);
assert(eval5.exitCode === 1, 'Should fail when soft failures enabled');
assert(eval5.reasons[0].includes('soft failure'), 'Should mention soft failures');
console.log(`✅ Test 6: ${eval5.reasons[0]}\n`);

// Test 7: Policy output formatting
console.log('Test 7: Policy output formatting');
const formatted = formatPolicyOutput(eval2);
assert(formatted.includes('Policy Evaluation'), 'Should include header');
assert(formatted.includes('CRITICAL'), 'Should show CRITICAL count');
assert(formatted.includes('Exit Code: 1'), 'Should show exit code');
console.log('✅ Test 7: Policy output formatted correctly\n');

// ============================================================================
// JUNIT XML TESTS
// ============================================================================

console.log('📋 JUnit XML Reporter Tests\n');

// Test 8: JUnit XML generation - basic structure
console.log('Test 8: JUnit XML generation - structure');
const snapshot6 = createMockSnapshot();
const junitXml = generateJunitXml(snapshot6, 'https://example.com');
assert(junitXml.includes('<?xml'), 'Should include XML declaration');
assert(junitXml.includes('<testsuites>'), 'Should include testsuites root');
assert(junitXml.includes('<testsuite'), 'Should include testsuite');
assert(junitXml.includes('</testsuites>'), 'Should close testsuites');
console.log('✅ Test 8: JUnit XML has correct structure\n');

// Test 9: JUnit testcase for attempts
console.log('Test 9: JUnit testcases from attempts');
const snapshot7 = createMockSnapshot({
  attempts: [
    {
      attemptId: 'checkout',
      attemptName: 'Checkout Flow',
      goal: 'Complete purchase',
      outcome: 'SUCCESS',
      totalDurationMs: 2000
    }
  ]
});
const junitXml7 = generateJunitXml(snapshot7);
assert(junitXml7.includes('testcase name="Checkout Flow"'), 'Should have attempt as testcase');
assert(junitXml7.includes('classname="attempt.checkout"'), 'Should have classname');
console.log('✅ Test 9: Attempt testcases generated\n');

// Test 10: JUnit failure for failed attempts
console.log('Test 10: JUnit failure elements');
const snapshot8 = createMockSnapshot({
  attempts: [
    {
      attemptId: 'payment',
      attemptName: 'Payment',
      goal: 'Process payment',
      outcome: 'FAILURE',
      error: 'Card declined',
      totalDurationMs: 1000
    }
  ]
});
const junitXml8 = generateJunitXml(snapshot8);
assert(junitXml8.includes('<failure'), 'Should include failure element');
assert(junitXml8.includes('Card declined'), 'Should include error message');
console.log('✅ Test 10: Failure elements generated\n');

// Test 11: JUnit soft failures
console.log('Test 11: JUnit soft failure reporting');
const snapshot9 = createMockSnapshot({
  attempts: [
    {
      attemptId: 'form',
      attemptName: 'Form Submission',
      outcome: 'SUCCESS',
      softFailureCount: 2,
      validators: [
        { id: 'v1', status: 'FAIL', message: 'Element not visible' },
        { id: 'v2', status: 'PASS', message: 'Form submitted' }
      ],
      totalDurationMs: 1500
    }
  ]
});
const junitXml9 = generateJunitXml(snapshot9);
assert(junitXml9.includes('SoftFailure'), 'Should tag soft failures');
assert(junitXml9.includes('Element not visible'), 'Should include validator message');
console.log('✅ Test 11: Soft failures reported in JUnit\n');

// Test 12: JUnit market criticality
console.log('Test 12: JUnit market criticality testcase');
const snapshot10 = createMockSnapshot({
  marketImpactSummary: {
    countsBySeverity: { CRITICAL: 1, WARNING: 2, INFO: 0 },
    topRisks: [
      {
        category: 'REVENUE',
        severity: 'CRITICAL',
        impactScore: 90,
        humanReadableReason: 'Checkout broken'
      }
    ]
  }
});
const junitXml10 = generateJunitXml(snapshot10);
assert(junitXml10.includes('Market Criticality'), 'Should have market testcase');
assert(junitXml10.includes('CriticalRisk'), 'Should tag critical risks');
console.log('✅ Test 12: Market criticality testcase generated\n');

// Test 13: JUnit discovery results
console.log('Test 13: JUnit discovery interaction results');
const snapshot11 = createMockSnapshot({
  discovery: {
    pagesVisitedCount: 2,
    interactionsDiscovered: 10,
    interactionsExecuted: 7,
    results: [
      { interactionId: 'nav-0', outcome: 'SUCCESS' },
      { interactionId: 'click-1', outcome: 'FAILURE', errorMessage: 'Element not found' }
    ]
  }
});
const junitXml11 = generateJunitXml(snapshot11);
assert(junitXml11.includes('Discovery'), 'Should have discovery testcase');
assert(junitXml11.includes('DiscoveryFailure'), 'Should tag discovery failures');
console.log('✅ Test 13: Discovery testcases generated\n');

// Test 14: JUnit XML validation
console.log('Test 14: JUnit XML validation');
const snapshot12 = createMockSnapshot();
const junitXml12 = generateJunitXml(snapshot12);
const validation = validateJunitXml(junitXml12);
assert(validation.valid === true, 'Generated XML should be valid');
assert(validation.errors.length === 0, 'Should have no errors');
console.log('✅ Test 14: Generated XML is valid\n');

// Test 15: XML escaping
console.log('Test 15: XML special character escaping');
const dangerous = '<>&"\' test';
const escaped = escapeXml(dangerous);
assert(!escaped.includes('<'), 'Should escape <');
assert(!escaped.includes('>'), 'Should escape >');
assert(!escaped.includes('&') || escaped.includes('&amp;'), 'Should escape &');
console.log(`✅ Test 15: "${dangerous}" → "${escaped}"\n`);

// Test 16: JUnit system output
console.log('Test 16: JUnit system-out summary');
const snapshot13 = createMockSnapshot({
  marketImpactSummary: {
    countsBySeverity: { CRITICAL: 1, WARNING: 2, INFO: 5 }
  }
});
const junitXml13 = generateJunitXml(snapshot13);
assert(junitXml13.includes('CRITICAL: 1'), 'Should show CRITICAL count');
assert(junitXml13.includes('WARNING: 2'), 'Should show WARNING count');
console.log('✅ Test 16: System output includes summary\n');

// ============================================================================
// WEBHOOK TESTS
// ============================================================================

console.log('🔔 Webhook Notification Tests\n');

// Test 17: Webhook payload building
console.log('Test 17: Webhook payload construction');
const snapshot14 = createMockSnapshot({
  marketImpactSummary: {
    countsBySeverity: { CRITICAL: 0, WARNING: 1, INFO: 2 },
    topRisks: [
      {
        category: 'LEAD',
        severity: 'WARNING',
        impactScore: 65,
        humanReadableReason: 'Form slow'
      }
    ]
  }
});
const policyEval14 = evaluatePolicy(snapshot14, loadPolicy('/nonexistent/path.json'));
const payload14 = buildWebhookPayload(snapshot14, policyEval14, {
  junitXml: 'artifacts/junit.xml'
});

assert(payload14.meta.url === 'https://example.com', 'Should have URL');
assert(payload14.summary.exitCode === 2, 'Should have exit code');
assert(payload14.summary.riskCounts.warning === 1, 'Should count WARNINGs');
assert(payload14.artifactPaths.junitXml === 'artifacts/junit.xml', 'Should have artifact path');
console.log('✅ Test 17: Webhook payload built correctly\n');

// Test 18: Webhook payload - top risks
console.log('Test 18: Webhook payload includes top risks');
assert(payload14.summary.topRisks.length > 0, 'Should have top risks');
assert(payload14.summary.topRisks[0].category === 'LEAD', 'Should include risk category');
assert(payload14.summary.topRisks[0].severity === 'WARNING', 'Should include severity');
console.log(`✅ Test 18: Top 3 risks included (${payload14.summary.topRisks.length} present)\n`);

// Test 19: Webhook payload - discovery stats
console.log('Test 19: Webhook payload includes discovery stats');
assert(payload14.summary.discoveryStats.pagesVisited === 3, 'Should have pages visited count');
assert(payload14.summary.discoveryStats.interactionsDiscovered === 15, 'Should have interactions count');
console.log('✅ Test 19: Discovery stats included\n');

// Test 20: Webhook payload - policy reasons
console.log('Test 20: Webhook payload includes policy reasons');
const payload20 = buildWebhookPayload(snapshot14, policyEval14);
assert(Array.isArray(payload20.summary.policyReasons), 'Should have policy reasons array');
console.log(`✅ Test 20: Policy reasons included (${payload20.summary.policyReasons.length} reason(s))\n`);

// Test 21: Parse webhook URLs - comma-separated
console.log('Test 21: Parse webhook URLs (comma-separated)');
const urls21 = parseWebhookUrls('https://webhook1.example.com, https://webhook2.example.com');
assert(urls21.length === 2, 'Should parse 2 URLs');
assert(urls21[0] === 'https://webhook1.example.com', 'Should trim whitespace');
console.log(`✅ Test 21: Parsed ${urls21.length} webhook URLs\n`);

// Test 22: Parse webhook URLs - JSON array
console.log('Test 22: Parse webhook URLs (JSON array)');
const urls22 = parseWebhookUrls('["https://webhook1.example.com", "https://webhook2.example.com"]');
assert(urls22.length === 2, 'Should parse JSON array');
console.log(`✅ Test 22: Parsed JSON array with ${urls22.length} URLs\n`);

// Test 23: Get webhook URL from environment
console.log('Test 23: Get webhook URL from option or environment');
const url23 = getWebhookUrl('GUARDIAN_WEBHOOK_URL', 'https://option.example.com');
assert(url23 === 'https://option.example.com', 'Should prefer option over environment');
console.log(`✅ Test 23: Webhook URL resolved\n`);

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

console.log('🔗 Integration Tests\n');

// Test 24: Full policy + junit flow
console.log('Test 24: Full policy + JUnit flow');
const snapshot24 = createMockSnapshot({
  marketImpactSummary: {
    countsBySeverity: { CRITICAL: 1, WARNING: 0, INFO: 0 },
    topRisks: [
      {
        category: 'REVENUE',
        severity: 'CRITICAL',
        impactScore: 95,
        humanReadableReason: 'Checkout failed'
      }
    ]
  }
});
const policy24 = loadPolicy('/nonexistent/path.json');
const eval24 = evaluatePolicy(snapshot24, policy24);
const junit24 = generateJunitXml(snapshot24);

assert(eval24.exitCode === 1, 'Policy should fail on CRITICAL');
assert(junit24.includes('CriticalRisk'), 'JUnit should report critical risk');
console.log('✅ Test 24: Policy + JUnit integration working\n');

// Test 25: Full flow with webhook
console.log('Test 25: Full policy + JUnit + Webhook flow');
const payload25 = buildWebhookPayload(snapshot24, eval24, {
  junitXml: 'artifacts/junit.xml',
  snapshotJson: 'artifacts/snapshot.json'
});

assert(payload25.summary.exitCode === 1, 'Webhook should reflect exit code');
assert(payload25.summary.riskCounts.critical === 1, 'Webhook should have risk counts');
assert(payload25.artifactPaths.junitXml !== null, 'Webhook should reference artifacts');
console.log('✅ Test 25: Full Phase 5 flow working\n');

// ============================================================================
// SUMMARY
// ============================================================================

console.log('━'.repeat(70));
console.log('✅ Phase 5 Tests Summary');
console.log('━'.repeat(70));
console.log('\n✅ 25/25 tests PASSED\n');
console.log('Test Coverage:');
console.log('  ✓ Policy Evaluation:      7 tests');
console.log('  ✓ JUnit XML Reporter:     9 tests');
console.log('  ✓ Webhook Notifications:  7 tests');
console.log('  ✓ Integration:            2 tests');
console.log('\nKey Validations:');
console.log('  ✓ Policy thresholds enforced');
console.log('  ✓ Exit codes set correctly');
console.log('  ✓ JUnit XML generation valid');
console.log('  ✓ Webhook payloads complete');
console.log('  ✓ All failures handled gracefully');
console.log('\n');

process.exit(0);
