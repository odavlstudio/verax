/**
 * Live Guardian Verification Demo
 * Demonstrates that live baseline comparison works correctly
 */

const { loadSnapshot } = require('./src/guardian/snapshot');
const {
  extractHumanOutcomes,
  compareHumanOutcomes,
  shouldAlert,
  formatComparisonForAlert
} = require('./src/guardian/live-baseline-compare');
const path = require('path');
const fs = require('fs');

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🔬 Live Guardian Verification Demo');
console.log('═══════════════════════════════════════════════════════════════\n');

// Find the two most recent run directories with snapshots
const odavlDir = '.odavlguardian';
const entries = fs.readdirSync(odavlDir)
  .filter(f => {
    const fullPath = path.join(odavlDir, f);
    try {
      return fs.statSync(fullPath).isDirectory() &&
             f.match(/^\d{4}-\d{2}-\d{2}/) &&
             fs.existsSync(path.join(fullPath, 'snapshot.json'));
    } catch (e) {
      return false;
    }
  })
  .sort()
  .reverse();

if (entries.length < 2) {
  console.log(`❌ Need at least 2 run directories with snapshots. Found ${entries.length}.`);
  console.log('Run: node guardian.js reality --url https://odavlguardian.vercel.app/ --fast --preset landing');
  console.log('Run it twice to get 2 complete runs.');
  process.exit(1);
}

const run1Dir = path.join(odavlDir, entries[1]); // First run (older)
const run2Dir = path.join(odavlDir, entries[0]); // Second run (newer)

console.log(`📁 Run 1 (Baseline): ${entries[1]}`);
console.log(`📁 Run 2 (Current):  ${entries[0]}\n`);

// Load snapshots
const snap1Path = path.join(run1Dir, 'snapshot.json');
const snap2Path = path.join(run2Dir, 'snapshot.json');

console.log(`📄 Loading from: ${snap1Path}`);
console.log(`📄 Loading from: ${snap2Path}\n`);

if (!fs.existsSync(snap1Path)) {
  console.log(`❌ Snapshot not found: ${snap1Path}`);
  process.exit(1);
}
if (!fs.existsSync(snap2Path)) {
  console.log(`❌ Snapshot not found: ${snap2Path}`);
  process.exit(1);
}

const snap1 = loadSnapshot(snap1Path);
const snap2 = loadSnapshot(snap2Path);

if (!snap1 || !snap2) {
  console.log('❌ Could not load snapshots');
  process.exit(1);
}

console.log('📊 Extracted Outcomes:');
console.log('─────────────────────────────────────────────────────────────\n');

const outcomes1 = extractHumanOutcomes(snap1);
const outcomes2 = extractHumanOutcomes(snap2);

console.log('Baseline Run:');
console.log(`  Journey Completed: ${outcomes1.journey.completed}`);
console.log(`  Journey Abandoned: ${outcomes1.journey.abandoned}`);
console.log(`  Verdict: ${outcomes1.verdict}`);
console.log(`  Attempts: ${outcomes1.attempts.map(a => `${a.id}:${a.outcome}`).join(', ')}\n`);

console.log('Current Run:');
console.log(`  Journey Completed: ${outcomes2.journey.completed}`);
console.log(`  Journey Abandoned: ${outcomes2.journey.abandoned}`);
console.log(`  Verdict: ${outcomes2.verdict}`);
console.log(`  Attempts: ${outcomes2.attempts.map(a => `${a.id}:${a.outcome}`).join(', ')}\n`);

// Compare
console.log('🔍 Baseline Comparison:');
console.log('─────────────────────────────────────────────────────────────\n');

const comparison = compareHumanOutcomes(outcomes1, outcomes2);

console.log(`Has Regressions: ${comparison.hasRegressions}`);
console.log(`Diffs Count: ${comparison.diffs.length}\n`);

if (comparison.diffs.length > 0) {
  console.log('Detected Differences:');
  for (const diff of comparison.diffs) {
    console.log(`  [${diff.severity}] ${diff.type}: ${diff.message}`);
  }
  console.log('');
}

// Alert decision
console.log('🚨 Alert Decision:');
console.log('─────────────────────────────────────────────────────────────\n');

const shouldRaiseAlert = shouldAlert(comparison);
console.log(`Should Alert: ${shouldRaiseAlert}`);

if (shouldRaiseAlert) {
  const alertInfo = formatComparisonForAlert(comparison);
  console.log(`\nAlert Severity: ${alertInfo.severity}`);
  console.log(`Alert Message:\n${alertInfo.message}\n`);
} else if (comparison.diffs.length > 0) {
  console.log('(Diffs found but not critical/high severity)');
} else {
  console.log('(No human-impacting regressions detected)');
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('✅ Live Guardian baseline comparison verified');
console.log('═══════════════════════════════════════════════════════════════\n');
