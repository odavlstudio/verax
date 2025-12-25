/**
 * Phase 5 (Part 2) - "Why This Matters" Comprehensive Validation
 * 
 * Tests that different breakTypes and domains generate appropriate
 * human-readable business impact explanations.
 */

const fs = require('fs');
const path = require('path');
const { MarketReporter } = require('../src/guardian/market-reporter');

const testDir = path.join(__dirname, '../test-phase5-part2-output');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

console.log('🧪 Phase 5 (Part 2) - "Why This Matters" Validation\n');

const testScenarios = [
  {
    name: 'SUBMISSION breakType (Checkout)',
    failures: [
      {
        id: 'checkout',
        name: 'Checkout Form Submission',
        outcome: 'FAILURE',
        breakType: 'SUBMISSION',
        domain: 'REVENUE',
        severity: 'CRITICAL',
        primaryHint: 'Form submission failed',
        hints: [],
        whyItMatters: [],
        topActions: []
      }
    ],
    expectedExplanation: 'Users cannot complete forms or checkout'
  },
  {
    name: 'NAVIGATION breakType',
    failures: [
      {
        id: 'nav_fail',
        name: 'Page Navigation Failed',
        outcome: 'FAILURE',
        breakType: 'NAVIGATION',
        domain: 'UX',
        severity: 'WARNING',
        primaryHint: 'Navigation failed',
        hints: [],
        whyItMatters: [],
        topActions: []
      }
    ],
    expectedExplanation: 'Users may get stuck or lost'
  },
  {
    name: 'TIMEOUT breakType',
    failures: [
      {
        id: 'timeout',
        name: 'Page Load Timeout',
        outcome: 'FAILURE',
        breakType: 'TIMEOUT',
        domain: 'UX',
        severity: 'WARNING',
        primaryHint: 'Operation timed out',
        hints: [],
        whyItMatters: [],
        topActions: []
      }
    ],
    expectedExplanation: 'Slow or unresponsive pages'
  },
  {
    name: 'VISUAL breakType',
    failures: [
      {
        id: 'visual_reg',
        name: 'Visual Regression Detected',
        outcome: 'FAILURE',
        breakType: 'VISUAL',
        domain: 'UX',
        severity: 'WARNING',
        primaryHint: 'CSS changed',
        hints: [],
        whyItMatters: [],
        topActions: []
      }
    ],
    expectedExplanation: 'Broken UI elements reduce credibility'
  },
  {
    name: 'NETWORK breakType',
    failures: [
      {
        id: 'network',
        name: 'Network Request Failed',
        outcome: 'FAILURE',
        breakType: 'NETWORK',
        domain: 'REVENUE',
        severity: 'CRITICAL',
        primaryHint: 'Server unreachable',
        hints: [],
        whyItMatters: [],
        topActions: []
      }
    ],
    expectedExplanation: 'Environment issues may break the site'
  },
  {
    name: 'LEAD domain (no specific breakType)',
    failures: [
      {
        id: 'signup',
        name: 'Signup Form Failed',
        outcome: 'FAILURE',
        breakType: 'UNKNOWN',
        domain: 'LEAD',
        severity: 'HIGH',
        primaryHint: 'Form submission issue',
        hints: [],
        whyItMatters: [],
        topActions: []
      }
    ],
    expectedExplanation: 'Signup or contact form issues'
  },
  {
    name: 'TRUST domain (no specific breakType)',
    failures: [
      {
        id: 'login',
        name: 'Login Failed',
        outcome: 'FAILURE',
        breakType: 'UNKNOWN',
        domain: 'TRUST',
        severity: 'HIGH',
        primaryHint: 'Auth issue',
        hints: [],
        whyItMatters: [],
        topActions: []
      }
    ],
    expectedExplanation: 'Authentication or security issues'
  }
];

let passCount = 0;
let totalTests = testScenarios.length;

for (const scenario of testScenarios) {
  console.log(`Testing: ${scenario.name}`);
  
  const reporter = new MarketReporter();
  const mockReport = {
    runId: `test-${scenario.name.toLowerCase().replace(/\s+/g, '-')}`,
    baseUrl: 'https://example.com',
    attemptsRun: ['test'],
    timestamp: new Date().toISOString(),
    results: [],
    flows: [],
    flowSummary: { total: 0, success: 0, failure: 0 },
    manualResults: [],
    autoResults: [],
    intelligence: {
      failures: scenario.failures,
      totalFailures: scenario.failures.length,
      criticalCount: scenario.failures.filter(f => f.severity === 'CRITICAL').length,
      warningCount: scenario.failures.filter(f => f.severity === 'WARNING' || f.severity === 'HIGH').length,
      infoCount: 0,
      escalationSignals: []
    },
    summary: {
      successCount: 0,
      frictionCount: 0,
      failureCount: scenario.failures.length,
      overallVerdict: 'FAILURE'
    }
  };
  
  const html = reporter.generateHtmlReport(mockReport);
  
  // Check for expected explanation
  const hasExplanation = html.includes(scenario.expectedExplanation);
  const hasWhyMatters = html.includes('Why this matters:');
  
  if (hasExplanation && hasWhyMatters) {
    console.log(`  ✓ Expected explanation found: "${scenario.expectedExplanation}"`);
    passCount++;
  } else {
    console.log(`  ✗ FAILED - Expected: "${scenario.expectedExplanation}"`);
    console.log(`    - Has "Why this matters": ${hasWhyMatters}`);
    console.log(`    - Has expected text: ${hasExplanation}`);
  }
  
  // Save report for visual inspection
  const fileName = scenario.name.toLowerCase().replace(/\s+/g, '-') + '.html';
  const outputPath = path.join(testDir, fileName);
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`  → Report: ${fileName}\n`);
}

console.log('═══════════════════════════════════════════════════════════');
console.log(`\n📊 Test Results: ${passCount}/${totalTests} passed\n`);

if (passCount === totalTests) {
  console.log('✅ Phase 5 (Part 2) - "Why This Matters" COMPLETE!');
  console.log('\n✨ All impact explanations are contextually appropriate:');
  console.log('   • SUBMISSION → Users cannot complete checkout');
  console.log('   • NAVIGATION → Users may get stuck');
  console.log('   • TIMEOUT → Slow pages reduce trust');
  console.log('   • VISUAL → Broken UI reduces credibility');
  console.log('   • NETWORK → Environment issues break the site');
  console.log('   • LEAD domain → Signup impact');
  console.log('   • TRUST domain → Auth/security impact');
  console.log('\n📁 Test reports in: test-phase5-part2-output/');
} else {
  console.log('❌ Some tests failed. Check details above.');
  process.exit(1);
}
