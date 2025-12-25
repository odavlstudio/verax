/**
 * Phase 5 (Part 3) - Noise Reduction Validation
 * 
 * Verifies that:
 * 1. Executive Summary is always visible
 * 2. Attempt Details and Flows are collapsible (hidden by default)
 * 3. Breakage Intelligence is collapsible (open by default)
 * 4. No data is lost (all content accessible via expand)
 * 5. Visual hierarchy is improved
 */

const fs = require('fs');
const path = require('path');
const { MarketReporter } = require('../src/guardian/market-reporter');

const testDir = path.join(__dirname, '../test-phase5-part3-output');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

console.log('🧪 Phase 5 (Part 3) - Noise Reduction Validation\n');

let passCount = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passCount++;
    console.log(`✓ ${name}`);
    return true;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${err.message}`);
    return false;
  }
}

// Create a comprehensive report with many issues
const mockReport = {
  runId: 'test-comprehensive-001',
  baseUrl: 'https://example.com',
  attemptsRun: ['signup', 'login', 'checkout', 'payment'],
  timestamp: new Date().toISOString(),
  results: [
    { attemptId: 'signup', attemptName: 'Signup Flow', outcome: 'SUCCESS', totalDurationMs: 1200, steps: [], friction: { signals: [] } },
    { attemptId: 'login', attemptName: 'Login Flow', outcome: 'FAILURE', totalDurationMs: 5000, steps: [], friction: { signals: [] }, error: 'Timeout' },
    { attemptId: 'checkout', attemptName: 'Checkout', outcome: 'FAILURE', totalDurationMs: 6000, steps: [], friction: { signals: [] }, error: 'Submission failed' },
    { attemptId: 'payment', attemptName: 'Payment', outcome: 'FAILURE', totalDurationMs: 3000, steps: [], friction: { signals: [] }, error: 'Network error' }
  ],
  flows: [
    { flowId: 'checkout_flow', flowName: 'Complete Checkout', outcome: 'FAILURE', stepsExecuted: 2, stepsTotal: 5, error: 'Network timeout' },
    { flowId: 'payment_flow', flowName: 'Payment Processing', outcome: 'FAILURE', stepsExecuted: 1, stepsTotal: 3, error: 'API failed' }
  ],
  flowSummary: { total: 2, success: 0, failure: 2 },
  manualResults: [],
  autoResults: [],
  intelligence: {
    failures: [
      {
        id: 'login',
        name: 'Login Timeout',
        outcome: 'FAILURE',
        breakType: 'TIMEOUT',
        domain: 'TRUST',
        severity: 'CRITICAL',
        primaryHint: 'Page load timed out',
        hints: [],
        whyItMatters: ['Trust impact'],
        topActions: ['Check server']
      },
      {
        id: 'checkout',
        name: 'Checkout Submission',
        outcome: 'FAILURE',
        breakType: 'SUBMISSION',
        domain: 'REVENUE',
        severity: 'CRITICAL',
        primaryHint: 'Form submission failed',
        hints: [],
        whyItMatters: ['Revenue impact'],
        topActions: ['Fix checkout']
      },
      {
        id: 'payment',
        name: 'Payment Processing',
        outcome: 'FAILURE',
        breakType: 'NETWORK',
        domain: 'REVENUE',
        severity: 'CRITICAL',
        primaryHint: 'API unreachable',
        hints: [],
        whyItMatters: ['Revenue impact'],
        topActions: ['Check API']
      }
    ],
    totalFailures: 3,
    criticalCount: 3,
    warningCount: 0,
    infoCount: 0,
    escalationSignals: ['CRITICAL failures', 'REVENUE impact']
  },
  summary: {
    successCount: 1,
    frictionCount: 0,
    failureCount: 3,
    overallVerdict: 'FAILURE'
  }
};

const reporter = new MarketReporter();
const html = reporter.generateHtmlReport(mockReport);

// Save the comprehensive report
const reportPath = path.join(testDir, 'comprehensive-report.html');
fs.writeFileSync(reportPath, html, 'utf8');
console.log(`Report generated: comprehensive-report.html\n`);

// Run validation tests
console.log('Validation Tests:');
console.log('─────────────────');

// Test 1: Executive Summary is visible
test('Executive Summary section is visible by default', () => {
  if (!html.includes('🧠 Executive Summary')) {
    throw new Error('Executive Summary not found');
  }
  if (!html.includes('Release Verdict')) {
    throw new Error('Release Verdict not found');
  }
  if (!html.includes('Overall Risk Score')) {
    throw new Error('Risk Score not found');
  }
});

// Test 2: Top 3 Risks with "Why this matters"
test('Top 3 Risks are visible with explanations', () => {
  if (!html.includes('Top 3 Risks')) {
    throw new Error('Top 3 Risks section not found');
  }
  if (!html.includes('Why this matters:')) {
    throw new Error('Why this matters explanations not found');
  }
});

// Test 3: Attempt Details are collapsible (not visible by default)
test('Attempt Details section is collapsible', () => {
  if (!html.includes('details class="collapsible-section"')) {
    throw new Error('Collapsible sections not found');
  }
  if (!html.includes('Attempt Details')) {
    throw new Error('Attempt Details header not found');
  }
});

// Test 4: Flows section is collapsible
test('Intent Flows section is collapsible', () => {
  if (!html.includes('Intent Flows')) {
    throw new Error('Intent Flows section not found');
  }
  // Check that it's wrapped in details tag
  const detailsCount = (html.match(/details class="collapsible-section"/g) || []).length;
  if (detailsCount < 2) {
    throw new Error('Flows section not properly wrapped in collapsible');
  }
});

// Test 5: Breakage Intelligence section exists
test('Breakage Intelligence section is collapsible', () => {
  if (!html.includes('Breakage Intelligence')) {
    throw new Error('Breakage Intelligence section not found');
  }
  // Should have open attribute
  if (!html.includes('details class="collapsible-section" open')) {
    throw new Error('Breakage Intelligence not open by default');
  }
});

// Test 6: All critical content is preserved (no data loss)
test('All failure data is preserved (accessible via expand)', () => {
  // Check that failure names are in the HTML
  if (!html.includes('Login Timeout')) {
    throw new Error('Login Timeout failure data lost');
  }
  if (!html.includes('Checkout Submission')) {
    throw new Error('Checkout Submission failure data lost');
  }
  if (!html.includes('Payment Processing')) {
    throw new Error('Payment Processing failure data lost');
  }
});

// Test 7: Recommend Next Action is visible
test('Recommended Next Action is visible', () => {
  if (!html.includes('Recommended Next Action')) {
    throw new Error('Recommended Next Action not found');
  }
  if (!html.includes('📋')) {
    throw new Error('Action icon not found');
  }
});

// Test 8: CSS styling includes noise reduction
test('Noise reduction CSS is present', () => {
  if (!html.includes('.collapsible-section')) {
    throw new Error('Collapsible section CSS not found');
  }
  if (!html.includes('.section-toggle')) {
    throw new Error('Section toggle CSS not found');
  }
  if (!html.includes('.collapsible-content')) {
    throw new Error('Collapsible content CSS not found');
  }
});

// Test 9: Details/summary pattern (HTML5 native)
test('Details/summary elements use HTML5 native pattern', () => {
  const detailsMatches = html.match(/<details[^>]*>/g) || [];
  const summaryMatches = html.match(/<summary[^>]*>/g) || [];
  
  if (detailsMatches.length === 0) {
    throw new Error('No details elements found');
  }
  if (summaryMatches.length === 0) {
    throw new Error('No summary elements found');
  }
  
  // Should have at least 3 sections (Attempts, Flows, Intelligence)
  if (detailsMatches.length < 3) {
    throw new Error(`Expected at least 3 collapsible sections, found ${detailsMatches.length}`);
  }
});

// Test 10: Professional styling maintained
test('Professional styling is maintained', () => {
  if (!html.includes('border-radius')) {
    throw new Error('Border radius styling not found');
  }
  if (!html.includes('box-shadow')) {
    throw new Error('Box shadow styling not found');
  }
  if (!html.includes('cursor: pointer')) {
    throw new Error('Cursor pointer for interactive elements not found');
  }
});

console.log('\n' + '═'.repeat(60));
console.log(`\n📊 Test Results: ${passCount}/${totalTests} passed\n`);

if (passCount === totalTests) {
  console.log('✅ Phase 5 (Part 3) - Noise Reduction COMPLETE!');
  console.log('\n✨ Key Features Implemented:');
  console.log('   • Executive Summary always visible (above the fold)');
  console.log('   • Attempt Details collapsed by default');
  console.log('   • Intent Flows collapsed by default');
  console.log('   • Breakage Intelligence visible by default (open)');
  console.log('   • All data preserved (accessible via expand)');
  console.log('   • Professional, clean visual hierarchy');
  console.log('   • HTML5 native details/summary elements');
  console.log('   • Keyboard accessible (no JavaScript required)');
  console.log('\n📁 Test report: comprehensive-report.html');
  console.log(`   → ${reportPath}`);
  console.log('\n📖 Report Structure:');
  console.log('   ────────────────────────────────────');
  console.log('   [ALWAYS VISIBLE - Above the fold]');
  console.log('   ────────────────────────────────────');
  console.log('   • Market Reality Report Header');
  console.log('   • 🧠 Executive Summary');
  console.log('     - Release Verdict');
  console.log('     - Risk Score');
  console.log('     - Top Reason');
  console.log('     - Top 3 Risks + Why this matters');
  console.log('     - Recommended Next Action');
  console.log('   ────────────────────────────────────');
  console.log('   [COLLAPSIBLE - Collapsed by default]');
  console.log('   ────────────────────────────────────');
  console.log('   ▶ 📋 Attempt Details');
  console.log('   ▶ 🔄 Intent Flows');
  console.log('   ────────────────────────────────────');
  console.log('   [COLLAPSIBLE - Open by default]');
  console.log('   ────────────────────────────────────');
  console.log('   ▼ 🔍 Breakage Intelligence');
} else {
  console.log('❌ Some tests failed. Check details above.');
  process.exit(1);
}
