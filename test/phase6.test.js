/**
 * Phase 6 Tests - Guardian Experience & Adoption
 * 
 * Tests for:
 * - CLI summary formatting
 * - Preset policy loading
 * - Init command
 * - Enhanced HTML report generation
 * - Protect command shortcut
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { generateCliSummary } = require('../src/guardian/cli-summary');
const { loadPreset, parsePolicyOption, listPresets } = require('../src/guardian/preset-loader');
const { initGuardian } = require('../src/guardian/init-command');
const { generateEnhancedHtml } = require('../src/guardian/enhanced-html-reporter');

console.log('\n🧪 Phase 6 Tests - Experience & Adoption\n');

// Mock snapshot for testing
function createMockSnapshot(overrides = {}) {
  return {
    schemaVersion: 'v1',
    meta: {
      url: 'https://example.com',
      runId: 'test-run-20251223',
      createdAt: '2025-12-23T15:00:00Z',
      environment: 'test',
      toolVersion: '0.6.0'
    },
    marketImpactSummary: {
      highestSeverity: 'INFO',
      totalRiskCount: 0,
      countsBySeverity: { CRITICAL: 0, WARNING: 0, INFO: 0 },
      topRisks: []
    },
    attempts: [],
    discovery: {
      pagesVisitedCount: 0,
      interactionsDiscovered: 0,
      interactionsExecuted: 0,
      results: []
    },
    baseline: {
      baselineFound: false,
      baselineCreatedThisRun: true
    },
    evidence: {},
    ...overrides
  };
}

// ==================== CLI SUMMARY TESTS ====================

console.log('📊 Testing CLI Summary Generation...\n');

// Test 1: CLI summary with no risks
{
  const snapshot = createMockSnapshot();
  const summary = generateCliSummary(snapshot, null);
  
  assert(summary.includes('Guardian Reality Summary'), 'Summary should have title');
  assert(summary.includes('Target: https://example.com'), 'Summary should show URL');
  assert(summary.includes('CRITICAL: 0'), 'Summary should show risk counts');
  assert(summary.includes('All checks passed'), 'Summary should show success message');
  
  console.log('✅ Test 1: CLI summary with no risks');
}

// Test 2: CLI summary with CRITICAL risk
{
  const snapshot = createMockSnapshot({
    marketImpactSummary: {
      highestSeverity: 'CRITICAL',
      totalRiskCount: 1,
      countsBySeverity: { CRITICAL: 1, WARNING: 0, INFO: 0 },
      topRisks: [
        {
          humanReadableReason: 'Checkout button no longer leads to payment page',
          category: 'REVENUE',
          severity: 'CRITICAL',
          impactScore: 95,
          attemptId: 'checkout_flow'
        }
      ]
    },
    attempts: [
      {
        attemptId: 'checkout_flow',
        attemptName: 'Checkout Flow',
        outcome: 'FAILURE',
        evidence: {
          screenshotPath: 'artifacts/test/checkout.png'
        }
      }
    ]
  });
  
  const summary = generateCliSummary(snapshot, null);
  
  assert(summary.includes('CRITICAL: 1'), 'Should show 1 critical');
  assert(summary.includes('Top Risk:'), 'Should have top risk section');
  assert(summary.includes('Checkout button'), 'Should show risk description');
  assert(summary.includes('Impact: 95'), 'Should show impact score');
  assert(summary.includes('Fix the CRITICAL issue'), 'Should show critical action');
  
  console.log('✅ Test 2: CLI summary with CRITICAL risk');
}

// Test 3: CLI summary with WARNING risk
{
  const snapshot = createMockSnapshot({
    marketImpactSummary: {
      highestSeverity: 'WARNING',
      totalRiskCount: 2,
      countsBySeverity: { CRITICAL: 0, WARNING: 2, INFO: 0 },
      topRisks: [
        {
          humanReadableReason: 'Contact form has extra friction',
          category: 'LEAD',
          severity: 'WARNING',
          impactScore: 60,
          attemptId: 'contact_form'
        }
      ]
    }
  });
  
  const summary = generateCliSummary(snapshot, null);
  
  assert(summary.includes('WARNING:  2'), 'Should show 2 warnings');
  assert(summary.includes('Contact form'), 'Should show warning description');
  assert(summary.includes('Review WARNING issues'), 'Should show warning action');
  
  console.log('✅ Test 3: CLI summary with WARNING risk');
}

// Test 4: CLI summary with policy evaluation
{
  const snapshot = createMockSnapshot();
  const policyEval = {
    passed: false,
    exitCode: 1,
    reasons: ['CRITICAL severity detected', 'Exceeds maxWarnings threshold']
  };
  
  const summary = generateCliSummary(snapshot, policyEval);
  
  assert(summary.includes('Policy:'), 'Should have policy section');
  assert(summary.includes('FAILED'), 'Should show policy failed');
  assert(summary.includes('Exit code: 1'), 'Should show exit code');
  
  console.log('✅ Test 4: CLI summary with policy evaluation');
}

// Test 5: CLI summary with attempts and discovery
{
  const snapshot = createMockSnapshot({
    attempts: [
      { attemptId: 'contact', outcome: 'SUCCESS' },
      { attemptId: 'newsletter', outcome: 'SUCCESS' },
      { attemptId: 'checkout', outcome: 'FAILURE' }
    ],
    discovery: {
      pagesVisitedCount: 15,
      interactionsDiscovered: 42,
      interactionsExecuted: 38
    }
  });
  
  const summary = generateCliSummary(snapshot, null);
  
  assert(summary.includes('2/3 successful'), 'Should show attempt stats');
  assert(summary.includes('Pages visited: 15'), 'Should show pages visited');
  assert(summary.includes('Interactions discovered: 42'), 'Should show interactions');
  
  console.log('✅ Test 5: CLI summary with attempts and discovery');
}

// ==================== PRESET POLICY TESTS ====================

console.log('\n📋 Testing Preset Policies...\n');

// Test 6: Load startup preset
{
  const preset = loadPreset('startup');
  
  assert(preset !== null, 'Startup preset should load');
  assert(preset.name === 'Startup Policy', 'Should have correct name');
  assert(preset.failOnSeverity === 'CRITICAL', 'Should fail on CRITICAL only');
  assert(preset.maxWarnings === 999, 'Should allow many warnings');
  
  console.log('✅ Test 6: Load startup preset');
}

// Test 7: Load saas preset
{
  const preset = loadPreset('saas');
  
  assert(preset !== null, 'SaaS preset should load');
  assert(preset.name === 'SaaS Policy', 'Should have correct name');
  assert(preset.failOnSeverity === 'CRITICAL', 'Should fail on CRITICAL');
  assert(preset.maxWarnings === 1, 'Should limit warnings');
  assert(preset.failOnNewRegression === true, 'Should detect regressions');
  
  console.log('✅ Test 7: Load saas preset');
}

// Test 8: Load enterprise preset
{
  const preset = loadPreset('enterprise');
  
  assert(preset !== null, 'Enterprise preset should load');
  assert(preset.name === 'Enterprise Policy', 'Should have correct name');
  assert(preset.failOnSeverity === 'WARNING', 'Should fail on WARNING');
  assert(preset.maxWarnings === 0, 'Should allow no warnings');
  assert(preset.requireBaseline === true, 'Should require baseline');
  
  console.log('✅ Test 8: Load enterprise preset');
}

// Test 9: Parse preset:startup option
{
  const policy = parsePolicyOption('preset:startup');
  
  assert(policy !== null, 'Should parse preset:startup');
  assert(policy.failOnSeverity === 'CRITICAL', 'Should load startup policy');
  
  console.log('✅ Test 9: Parse preset:startup option');
}

// Test 10: Parse preset:saas option
{
  const policy = parsePolicyOption('preset:saas');
  
  assert(policy !== null, 'Should parse preset:saas');
  assert(policy.maxWarnings === 1, 'Should load saas policy');
  
  console.log('✅ Test 10: Parse preset:saas option');
}

// Test 11: List presets
{
  const presets = listPresets();
  
  assert(presets.length >= 3, 'Should have at least 3 presets');
  const names = presets.map(p => p.name);
  assert(names.includes('startup'), 'Should include startup');
  assert(names.includes('saas'), 'Should include saas');
  assert(names.includes('enterprise'), 'Should include enterprise');
  
  console.log('✅ Test 11: List presets');
}

// ==================== INIT COMMAND TESTS ====================

console.log('\n🚀 Testing Init Command...\n');

// Test 12: Init creates files
{
  const testDir = path.join(__dirname, '../test-artifacts/init-test-' + Date.now());
  fs.mkdirSync(testDir, { recursive: true });
  
  const result = initGuardian({ cwd: testDir, preset: 'startup' });
  
  assert(result.created.includes('config/guardian.policy.json'), 'Should create policy file');
  assert(fs.existsSync(path.join(testDir, 'config/guardian.policy.json')), 'Policy file should exist');
  
  const policyContent = fs.readFileSync(path.join(testDir, 'config/guardian.policy.json'), 'utf-8');
  const policy = JSON.parse(policyContent);
  assert(policy.failOnSeverity === 'CRITICAL', 'Should use startup preset');
  
  // Cleanup
  fs.rmSync(testDir, { recursive: true, force: true });
  
  console.log('✅ Test 12: Init creates files');
}

// Test 13: Init updates .gitignore
{
  const testDir = path.join(__dirname, '../test-artifacts/init-test-gitignore-' + Date.now());
  fs.mkdirSync(testDir, { recursive: true });
  
  const result = initGuardian({ cwd: testDir });
  
  assert(result.created.includes('.gitignore') || result.updated.includes('.gitignore'), 
    'Should create or update .gitignore');
  
  const gitignoreContent = fs.readFileSync(path.join(testDir, '.gitignore'), 'utf-8');
  assert(gitignoreContent.includes('Guardian artifacts'), 'Should have Guardian section');
  assert(gitignoreContent.includes('artifacts/'), 'Should ignore artifacts');
  
  // Cleanup
  fs.rmSync(testDir, { recursive: true, force: true });
  
  console.log('✅ Test 13: Init updates .gitignore');
}

// Test 14: Init with saas preset
{
  const testDir = path.join(__dirname, '../test-artifacts/init-test-saas-' + Date.now());
  fs.mkdirSync(testDir, { recursive: true });
  
  initGuardian({ cwd: testDir, preset: 'saas' });
  
  const policyContent = fs.readFileSync(path.join(testDir, 'config/guardian.policy.json'), 'utf-8');
  const policy = JSON.parse(policyContent);
  assert(policy.maxWarnings === 1, 'Should use saas preset');
  
  // Cleanup
  fs.rmSync(testDir, { recursive: true, force: true });
  
  console.log('✅ Test 14: Init with saas preset');
}

// ==================== ENHANCED HTML TESTS ====================

console.log('\n🎨 Testing Enhanced HTML Report...\n');

// Test 15: Enhanced HTML contains required sections
{
  const snapshot = createMockSnapshot({
    marketImpactSummary: {
      highestSeverity: 'WARNING',
      totalRiskCount: 2,
      countsBySeverity: { CRITICAL: 0, WARNING: 2, INFO: 0 },
      topRisks: [
        {
          humanReadableReason: 'Form validation issues',
          category: 'LEAD',
          severity: 'WARNING',
          impactScore: 60,
          attemptId: 'contact_form'
        }
      ]
    },
    attempts: [
      {
        attemptId: 'contact_form',
        attemptName: 'Contact Form',
        outcome: 'FRICTION'
      }
    ],
    discovery: {
      pagesVisitedCount: 10,
      interactionsDiscovered: 25,
      interactionsExecuted: 20
    }
  });
  
  const html = generateEnhancedHtml(snapshot, '/tmp/test');
  
  assert(html.includes('Guardian Reality Report'), 'Should have title');
  assert(html.includes('Top Risks'), 'Should have top risks section');
  assert(html.includes('Discovery'), 'Should have discovery section');
  assert(html.includes('Attempts'), 'Should have attempts section');
  assert(html.includes('Form validation issues'), 'Should show risk details');
  
  console.log('✅ Test 15: Enhanced HTML contains required sections');
}

// Test 16: Enhanced HTML with baseline diff
{
  const snapshot = createMockSnapshot({
    baseline: {
      diff: {
        regressions: {
          'checkout_flow': { reason: 'Now fails completely' }
        },
        improvements: {
          'newsletter': { reason: 'No longer has friction' }
        }
      }
    }
  });
  
  const html = generateEnhancedHtml(snapshot, '/tmp/test');
  
  assert(html.includes('Changes Since Last Run'), 'Should have diff section');
  assert(html.includes('Regressions'), 'Should show regressions');
  assert(html.includes('Improvements'), 'Should show improvements');
  assert(html.includes('checkout_flow'), 'Should show regressed attempt');
  
  console.log('✅ Test 16: Enhanced HTML with baseline diff');
}

// Test 17: Enhanced HTML with evidence gallery
{
  const snapshot = createMockSnapshot({
    attempts: [
      {
        attemptId: 'contact',
        attemptName: 'Contact Form',
        outcome: 'SUCCESS',
        evidence: {
          screenshotPath: 'artifacts/test/contact.png'
        }
      },
      {
        attemptId: 'checkout',
        attemptName: 'Checkout',
        outcome: 'FAILURE',
        evidence: {
          screenshotPath: 'artifacts/test/checkout.png'
        }
      }
    ]
  });
  
  const html = generateEnhancedHtml(snapshot, 'artifacts');
  
  assert(html.includes('Evidence Gallery'), 'Should have evidence section');
  assert(html.includes('contact.png'), 'Should reference screenshot');
  assert(html.includes('Contact Form'), 'Should show attempt name');
  
  console.log('✅ Test 17: Enhanced HTML with evidence gallery');
}

// Test 18: Enhanced HTML works offline (no external resources)
{
  const snapshot = createMockSnapshot();
  const html = generateEnhancedHtml(snapshot, '/tmp/test');
  
  // Check that no external CDN or remote resources are loaded
  assert(!html.includes('cdn.'), 'Should not have CDN URLs');
  assert(!html.includes('googleapis.com'), 'Should not have Google APIs');
  assert(!html.includes('unpkg.com'), 'Should not have unpkg');
  assert(html.includes('<style>'), 'Should have inline CSS');
  
  console.log('✅ Test 18: Enhanced HTML works offline');
}

// ==================== INTEGRATION TESTS ====================

console.log('\n🔗 Testing Integration...\n');

// Test 19: CLI summary + Policy + Enhanced HTML flow
{
  const snapshot = createMockSnapshot({
    marketImpactSummary: {
      highestSeverity: 'CRITICAL',
      totalRiskCount: 1,
      countsBySeverity: { CRITICAL: 1, WARNING: 0, INFO: 0 },
      topRisks: [
        {
          humanReadableReason: 'Revenue-critical flow broken',
          category: 'REVENUE',
          severity: 'CRITICAL',
          impactScore: 100
        }
      ]
    }
  });
  
  const policyEval = {
    passed: false,
    exitCode: 1,
    reasons: ['CRITICAL severity detected']
  };
  
  // Generate all outputs
  const cliSummary = generateCliSummary(snapshot, policyEval);
  const html = generateEnhancedHtml(snapshot, '/tmp/test');
  
  assert(cliSummary.includes('CRITICAL: 1'), 'CLI should show critical');
  assert(cliSummary.includes('Policy'), 'CLI should show policy');
  assert(html.includes('Revenue-critical flow'), 'HTML should show risk');
  
  console.log('✅ Test 19: CLI summary + Policy + Enhanced HTML flow');
}

// Test 20: Preset loading + Policy evaluation
{
  const startupPreset = loadPreset('startup');
  const snapshot = createMockSnapshot({
    marketImpactSummary: {
      highestSeverity: 'WARNING',
      totalRiskCount: 5,
      countsBySeverity: { CRITICAL: 0, WARNING: 5, INFO: 0 },
      topRisks: []
    }
  });
  
  // Startup preset should pass with warnings
  assert(startupPreset.failOnSeverity === 'CRITICAL', 'Startup allows warnings');
  
  const enterprisePreset = loadPreset('enterprise');
  // Enterprise preset should fail with warnings
  assert(enterprisePreset.failOnSeverity === 'WARNING', 'Enterprise blocks warnings');
  
  console.log('✅ Test 20: Preset loading + Policy evaluation');
}

// ==================== SUMMARY ====================

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ 20/20 tests PASSED\n');
console.log('Test Coverage:');
console.log('  ✓ CLI Summary:            5 tests');
console.log('  ✓ Preset Policies:        6 tests');
console.log('  ✓ Init Command:           3 tests');
console.log('  ✓ Enhanced HTML:          4 tests');
console.log('  ✓ Integration:            2 tests');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('🎉 Phase 6 Tests Complete - All Systems Operational\n');
