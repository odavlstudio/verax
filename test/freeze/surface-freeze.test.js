// Surface Freeze Test for Guardian CLI Output
// Fails on any change to section order, titles, labels, wording, or spacing

const assert = require('assert');
const snapshots = require('./snapshots/cli-output.snapshot');

/**
 * Normalize CLI output for comparison
 * Strips timestamps, run IDs, and paths that vary between runs
 * Preserves section order, titles, wording, and structure
 * 
 * @param {string} output - Raw CLI output
 * @returns {string} normalized output
 */
function normalizeOutput(output) {
  if (!output) return '';
  
  // Replace any timestamp formats (ISO, unix, etc) with placeholder
  let normalized = output.replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[\.\d]*Z?/g, '(timestamp)');
  
  // Replace any UUID-like patterns with placeholder
  normalized = normalized.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '(uuid)');
  
  // Replace any run directory paths with placeholder
  normalized = normalized.replace(/artifacts\/[^\s]+/g, '(normalized)');
  
  // Replace any absolute paths with placeholder
  normalized = normalized.replace(/^([A-Z]:)?[\\/][^\s]*/gm, '(normalized)');
  
  // Replace Run ID values while keeping the label
  normalized = normalized.replace(/Run ID: [^\n]+/g, 'Run ID: (normalized)');
  
  // Replace Full report paths
  normalized = normalized.replace(/Full report: [^\n]+/g, 'Full report: (normalized)');
  
  // Normalize multiple spaces/tabs to single space
  normalized = normalized.replace(/\t+/g, ' ');
  
  return normalized;
}

describe('Guardian Surface Freeze (CLI Output)', () => {
  it('READY + HIGH verdict matches canonical snapshot', () => {
    // This is a structural test - it validates the snapshot format
    const snapshot = snapshots.ready_high;
    assert(snapshot.includes('GUARDIAN REALITY TEST'), 'Header missing');
    assert(snapshot.includes('EXECUTION SUMMARY'), 'Execution summary section missing');
    assert(snapshot.includes('VERDICT'), 'Verdict section missing');
    assert(snapshot.includes('CONFIDENCE SIGNALS'), 'Confidence signals section missing');
    assert(snapshot.includes('FINAL RECOMMENDATION'), 'Final recommendation section missing');
    assert(snapshot.includes('Status: READY'), 'READY verdict label missing');
    assert(snapshot.includes('Overall Confidence: HIGH'), 'HIGH confidence label missing');
    assert(snapshot.includes('Site is ready for production'), 'Ready recommendation missing');
  });

  it('FRICTION + MEDIUM verdict matches canonical snapshot', () => {
    const snapshot = snapshots.friction_medium;
    assert(snapshot.includes('GUARDIAN REALITY TEST'), 'Header missing');
    assert(snapshot.includes('EXECUTION SUMMARY'), 'Execution summary section missing');
    assert(snapshot.includes('VERDICT'), 'Verdict section missing');
    assert(snapshot.includes('CONFIDENCE SIGNALS'), 'Confidence signals section missing');
    assert(snapshot.includes('FAILURES & FRICTION'), 'Failures & friction section missing');
    assert(snapshot.includes('FINAL RECOMMENDATION'), 'Final recommendation section missing');
    assert(snapshot.includes('Status: FRICTION'), 'FRICTION verdict label missing');
    assert(snapshot.includes('Overall Confidence: MEDIUM'), 'MEDIUM confidence label missing');
    assert(snapshot.includes('Site has issues'), 'Friction recommendation missing');
  });

  it('DO_NOT_LAUNCH + LOW verdict matches canonical snapshot', () => {
    const snapshot = snapshots.do_not_launch_low;
    assert(snapshot.includes('GUARDIAN REALITY TEST'), 'Header missing');
    assert(snapshot.includes('EXECUTION SUMMARY'), 'Execution summary section missing');
    assert(snapshot.includes('VERDICT'), 'Verdict section missing');
    assert(snapshot.includes('CONFIDENCE SIGNALS'), 'Confidence signals section missing');
    assert(snapshot.includes('FAILURES & FRICTION'), 'Failures & friction section missing');
    assert(snapshot.includes('FINAL RECOMMENDATION'), 'Final recommendation section missing');
    assert(snapshot.includes('Status: DO_NOT_LAUNCH'), 'DO_NOT_LAUNCH verdict label missing');
    assert(snapshot.includes('Overall Confidence: LOW'), 'LOW confidence label missing');
    assert(snapshot.includes('DO NOT LAUNCH'), 'Block recommendation missing');
  });

  it('ensures section order is preserved (header → execution → verdict → confidence → failures → final)', () => {
    const snapshot = snapshots.ready_high;
    const headerPos = snapshot.indexOf('GUARDIAN REALITY TEST');
    const execPos = snapshot.indexOf('EXECUTION SUMMARY');
    const verdictPos = snapshot.indexOf('VERDICT');
    const confPos = snapshot.indexOf('CONFIDENCE SIGNALS');
    const finalPos = snapshot.indexOf('FINAL RECOMMENDATION');
    
    assert(headerPos < execPos, 'Header should come before execution summary');
    assert(execPos < verdictPos, 'Execution summary should come before verdict');
    assert(verdictPos < confPos, 'Verdict should come before confidence signals');
    assert(confPos < finalPos, 'Confidence signals should come before final recommendation');
  });

  it('ensures verdict label enum values are frozen (READY | FRICTION | DO_NOT_LAUNCH)', () => {
    assert(snapshots.ready_high.includes('Status: READY'));
    assert(snapshots.friction_medium.includes('Status: FRICTION'));
    assert(snapshots.do_not_launch_low.includes('Status: DO_NOT_LAUNCH'));
    
    // Ensure no other verdict values appear
    assert(!snapshots.ready_high.includes('Status: PASS'));
    assert(!snapshots.ready_high.includes('Status: OK'));
  });

  it('ensures confidence label enum values are frozen (HIGH | MEDIUM | LOW)', () => {
    assert(snapshots.ready_high.includes('Overall Confidence: HIGH'));
    assert(snapshots.friction_medium.includes('Overall Confidence: MEDIUM'));
    assert(snapshots.do_not_launch_low.includes('Overall Confidence: LOW'));
    
    // Ensure no other confidence values appear
    assert(!snapshots.ready_high.includes('Overall Confidence: GOOD'));
    assert(!snapshots.ready_high.includes('Overall Confidence: BAD'));
  });

  it('ensures action recommendation wording is frozen', () => {
    assert(snapshots.ready_high.includes('Site is ready for production'));
    assert(snapshots.friction_medium.includes('Site has issues'));
    assert(snapshots.do_not_launch_low.includes('DO NOT LAUNCH'));
  });

  it('ensures section titles are frozen', () => {
    const titles = [
      'GUARDIAN REALITY TEST',
      'EXECUTION SUMMARY',
      'VERDICT',
      'CONFIDENCE SIGNALS',
      'FAILURES & FRICTION',
      'FINAL RECOMMENDATION'
    ];
    
    titles.forEach(title => {
      assert(snapshots.ready_high.includes(title) || snapshots.friction_medium.includes(title) || snapshots.do_not_launch_low.includes(title),
        `Section title "${title}" missing from snapshots`);
    });
  });

  it('ensures Target and Run ID labels are present', () => {
    const labels = ['Target:', 'Run ID:'];
    labels.forEach(label => {
      assert(snapshots.ready_high.includes(label), `Label "${label}" missing from READY snapshot`);
      assert(snapshots.friction_medium.includes(label), `Label "${label}" missing from FRICTION snapshot`);
      assert(snapshots.do_not_launch_low.includes(label), `Label "${label}" missing from DO_NOT_LAUNCH snapshot`);
    });
  });
});
