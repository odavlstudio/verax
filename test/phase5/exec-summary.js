/**
 * Phase 5 (Part 1) - Executive Summary Validation
 * 
 * This script tests the new Executive Summary feature by:
 * 1. Creating mock report data with varying severities
 * 2. Generating HTML reports
 * 3. Validating the executive summary section
 */

const fs = require('fs');
const path = require('path');
const { MarketReporter } = require('../src/guardian/market-reporter');

// Create test output directory
const testDir = path.join(__dirname, '../test-phase5-exec-summary-output');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

console.log('🧪 Phase 5 (Part 1) - Executive Summary Test\n');

/**
 * Test Case 1: SAFE TO RELEASE (no failures)
 */
function testSafeRelease() {
  console.log('Test 1: 🟢 SAFE TO RELEASE scenario');
  
  const reporter = new MarketReporter();
  const mockReport = {
    runId: 'test-safe-001',
    baseUrl: 'https://example.com',
    attemptsRun: ['signup', 'login', 'checkout'],
    timestamp: new Date().toISOString(),
    results: [
      { attemptId: 'signup', attemptName: 'Signup Flow', outcome: 'SUCCESS', totalDurationMs: 1200, steps: [], friction: { signals: [] } },
      { attemptId: 'login', attemptName: 'Login Flow', outcome: 'SUCCESS', totalDurationMs: 800, steps: [], friction: { signals: [] } },
      { attemptId: 'checkout', attemptName: 'Checkout Flow', outcome: 'SUCCESS', totalDurationMs: 1500, steps: [], friction: { signals: [] } }
    ],
    flows: [],
    flowSummary: { total: 0, success: 0, failure: 0 },
    manualResults: [],
    autoResults: [],
    intelligence: {
      failures: [],
      totalFailures: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      escalationSignals: []
    },
    summary: {
      successCount: 3,
      frictionCount: 0,
      failureCount: 0,
      overallVerdict: 'SUCCESS'
    }
  };
  
  const html = reporter.generateHtmlReport(mockReport);
  const outputPath = path.join(testDir, 'safe-release.html');
  fs.writeFileSync(outputPath, html, 'utf8');
  
  // Validate
  const hasExecSummary = html.includes('🧠 Executive Summary');
  const hasSafeVerdict = html.includes('🟢 SAFE TO RELEASE');
  const hasRiskScore = html.includes('/ 100');
  
  console.log(`  ✓ Executive Summary present: ${hasExecSummary}`);
  console.log(`  ✓ Safe verdict: ${hasSafeVerdict}`);
  console.log(`  ✓ Risk score: ${hasRiskScore}`);
  console.log(`  → Report saved: ${outputPath}\n`);
  
  return hasExecSummary && hasSafeVerdict && hasRiskScore;
}

/**
 * Test Case 2: RELEASE WITH CAUTION (warnings only)
 */
function testCautionRelease() {
  console.log('Test 2: 🟡 RELEASE WITH CAUTION scenario');
  
  const reporter = new MarketReporter();
  const mockReport = {
    runId: 'test-caution-001',
    baseUrl: 'https://example.com',
    attemptsRun: ['signup', 'checkout'],
    timestamp: new Date().toISOString(),
    results: [
      { attemptId: 'signup', attemptName: 'Signup Flow', outcome: 'SUCCESS', totalDurationMs: 1200, steps: [], friction: { signals: [] } },
      { attemptId: 'checkout', attemptName: 'Checkout Flow', outcome: 'FAILURE', totalDurationMs: 2500, steps: [], friction: { signals: [] }, error: 'Visual regression detected' }
    ],
    flows: [],
    flowSummary: { total: 0, success: 0, failure: 0 },
    manualResults: [],
    autoResults: [],
    intelligence: {
      failures: [
        {
          id: 'checkout',
          name: 'Checkout Flow',
          outcome: 'FAILURE',
          breakType: 'VISUAL',
          domain: 'REVENUE',
          severity: 'WARNING',
          primaryHint: 'Visual baseline drift detected',
          hints: ['CSS changes detected', 'Layout shift observed'],
          whyItMatters: ['🚨 Revenue impact: Checkout/payment flow is broken.', '🟡 WARNING: High priority.'],
          topActions: ['1. Review visual diff', '2. Update baseline', '3. Verify CSS changes']
        }
      ],
      totalFailures: 1,
      criticalCount: 0,
      warningCount: 1,
      infoCount: 0,
      escalationSignals: []
    },
    summary: {
      successCount: 1,
      frictionCount: 0,
      failureCount: 1,
      overallVerdict: 'FAILURE'
    }
  };
  
  const html = reporter.generateHtmlReport(mockReport);
  const outputPath = path.join(testDir, 'caution-release.html');
  fs.writeFileSync(outputPath, html, 'utf8');
  
  // Validate
  const hasExecSummary = html.includes('🧠 Executive Summary');
  const hasCautionVerdict = html.includes('🟡 RELEASE WITH CAUTION');
  const hasTopReason = html.includes('Checkout Flow');
  const hasNextAction = html.includes('Recommended Next Action');
  
  console.log(`  ✓ Executive Summary present: ${hasExecSummary}`);
  console.log(`  ✓ Caution verdict: ${hasCautionVerdict}`);
  console.log(`  ✓ Top reason shown: ${hasTopReason}`);
  console.log(`  ✓ Next action present: ${hasNextAction}`);
  console.log(`  → Report saved: ${outputPath}\n`);
  
  return hasExecSummary && hasCautionVerdict && hasTopReason && hasNextAction;
}

/**
 * Test Case 3: DO NOT RELEASE (critical failures)
 */
function testDangerRelease() {
  console.log('Test 3: 🔴 DO NOT RELEASE scenario');
  
  const reporter = new MarketReporter();
  const mockReport = {
    runId: 'test-danger-001',
    baseUrl: 'https://example.com',
    attemptsRun: ['login', 'checkout'],
    timestamp: new Date().toISOString(),
    results: [
      { attemptId: 'login', attemptName: 'Login Flow', outcome: 'FAILURE', totalDurationMs: 5000, steps: [], friction: { signals: [] }, error: 'Navigation timeout' },
      { attemptId: 'checkout', attemptName: 'Checkout Flow', outcome: 'FAILURE', totalDurationMs: 6000, steps: [], friction: { signals: [] }, error: 'Submission failed' }
    ],
    flows: [
      { flowId: 'checkout_flow', flowName: 'Complete Checkout', outcome: 'FAILURE', stepsExecuted: 2, stepsTotal: 5, error: 'Network error' }
    ],
    flowSummary: { total: 1, success: 0, failure: 1 },
    manualResults: [],
    autoResults: [],
    intelligence: {
      failures: [
        {
          id: 'login',
          name: 'Login Flow',
          outcome: 'FAILURE',
          breakType: 'TIMEOUT',
          domain: 'TRUST',
          severity: 'CRITICAL',
          primaryHint: 'Page load timeout exceeded',
          hints: ['Server response too slow', 'Database query issues'],
          whyItMatters: ['⚠️ Trust impact: Auth/account flow is broken.', '🔴 CRITICAL: Escalate immediately.'],
          topActions: ['1. Check server response times', '2. Review database queries', '3. Check rate limiting']
        },
        {
          id: 'checkout',
          name: 'Checkout Flow',
          outcome: 'FAILURE',
          breakType: 'SUBMISSION',
          domain: 'REVENUE',
          severity: 'CRITICAL',
          primaryHint: 'Form submission failed',
          hints: ['API endpoint unreachable', 'CORS error'],
          whyItMatters: ['🚨 Revenue impact: Checkout/payment flow is broken.', '🔴 CRITICAL: Escalate immediately.'],
          topActions: ['1. Check form validation', '2. Verify API endpoint', '3. Check CORS settings']
        },
        {
          id: 'checkout_flow',
          name: 'Complete Checkout',
          outcome: 'FAILURE',
          breakType: 'NETWORK',
          domain: 'REVENUE',
          severity: 'CRITICAL',
          primaryHint: 'Network request failed',
          hints: ['Server down', 'DNS issues'],
          whyItMatters: ['🚨 Revenue impact: Checkout/payment flow is broken.', '🔴 CRITICAL: Escalate immediately.'],
          topActions: ['1. Check server status', '2. Verify DNS', '3. Check load balancer']
        }
      ],
      totalFailures: 3,
      criticalCount: 3,
      warningCount: 0,
      infoCount: 0,
      escalationSignals: ['CRITICAL failures detected - immediate action required', 'REVENUE domain affected - financial impact likely']
    },
    summary: {
      successCount: 0,
      frictionCount: 0,
      failureCount: 2,
      overallVerdict: 'FAILURE'
    }
  };
  
  const html = reporter.generateHtmlReport(mockReport);
  const outputPath = path.join(testDir, 'danger-release.html');
  fs.writeFileSync(outputPath, html, 'utf8');
  
  // Validate
  const hasExecSummary = html.includes('🧠 Executive Summary');
  const hasDangerVerdict = html.includes('🔴 DO NOT RELEASE');
  const hasHighRiskScore = html.includes('/ 100');
  const hasTop3Risks = html.includes('Top 3 Risks');
  const hasNextAction = html.includes('Fix checkout/submission flow') || html.includes('Recommended Next Action');
  
  console.log(`  ✓ Executive Summary present: ${hasExecSummary}`);
  console.log(`  ✓ Danger verdict: ${hasDangerVerdict}`);
  console.log(`  ✓ Risk score present: ${hasHighRiskScore}`);
  console.log(`  ✓ Top 3 risks shown: ${hasTop3Risks}`);
  console.log(`  ✓ Next action present: ${hasNextAction}`);
  console.log(`  → Report saved: ${outputPath}\n`);
  
  return hasExecSummary && hasDangerVerdict && hasHighRiskScore && hasTop3Risks && hasNextAction;
}

// Run all tests
let passCount = 0;
let totalTests = 3;

if (testSafeRelease()) passCount++;
if (testCautionRelease()) passCount++;
if (testDangerRelease()) passCount++;

console.log('═══════════════════════════════════════════════════════════');
console.log(`\n📊 Test Results: ${passCount}/${totalTests} passed\n`);

if (passCount === totalTests) {
  console.log('✅ Phase 5 (Part 1) - Executive Summary implementation COMPLETE!');
  console.log('\n📁 Generated reports:');
  console.log(`   - ${path.join(testDir, 'safe-release.html')}`);
  console.log(`   - ${path.join(testDir, 'caution-release.html')}`);
  console.log(`   - ${path.join(testDir, 'danger-release.html')}`);
  console.log('\n✨ Open any of these files in a browser to see the Executive Summary at the top!');
} else {
  console.log('❌ Some tests failed. Check the output above for details.');
  process.exit(1);
}
