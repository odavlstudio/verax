/**
 * Test CLI Icon Rendering per Contract v1
 */

// Import classification icon function (simulated)
function classificationIcon(classification) {
  // Contract v1: CONFIRMED→✓, SUSPECTED→?, INFORMATIONAL→i, UNPROVEN→·
  switch (classification) {
    case 'observed':
      return '✓';
    case 'silent-failure':
      return '?';
    case 'coverage-gap':
      return '?';
    case 'unproven':
      return '·';
    case 'informational':
      return 'i';
    default:
      return '·';
  }
}

function formatFindingCLI(finding) {
  const icon = classificationIcon(finding.classification);
  const status = finding.classification.toUpperCase();
  const level = finding.confidenceLevel || 'UNKNOWN';
  return `${icon} ${status} (${level})`;
}

console.log('=== CLI ICON RENDERING (Contract v1) ===\n');

const findings = [
  { classification: 'observed', confidenceLevel: 'HIGH', description: 'Navigation worked as expected' },
  { classification: 'silent-failure', confidenceLevel: 'MEDIUM', description: 'Network request failed silently' },
  { classification: 'silent-failure', confidenceLevel: 'HIGH', description: 'Form submission failed without feedback' },
  { classification: 'coverage-gap', confidenceLevel: 'LOW', description: 'Interaction not observed' },
  { classification: 'unproven', confidenceLevel: 'LOW', description: 'Insufficient evidence' },
  { classification: 'informational', confidenceLevel: 'LOW', description: 'Diagnostic information' }
];

console.log('BEFORE (old icons):');
console.log('✓ OBSERVED (HIGH) - worked');
console.log('✗ SILENT-FAILURE (MEDIUM) - network failed');
console.log('✗ SILENT-FAILURE (HIGH) - form failed');
console.log('⚠ COVERAGE-GAP (LOW) - not observed');
console.log('⚠ UNPROVEN (LOW) - insufficient evidence');
console.log('• INFORMATIONAL (LOW) - diagnostic\n');

console.log('AFTER (Contract v1):');
findings.forEach(f => {
  console.log(`${formatFindingCLI(f)} - ${f.description}`);
});

console.log('\n=== KEY CHANGES ===');
console.log('1. SUSPECTED/UNPROVEN no longer show ✗ (failure icon)');
console.log('2. SUSPECTED shows ? (uncertain)');
console.log('3. UNPROVEN shows · (minimal evidence)');
console.log('4. INFORMATIONAL shows i (info)');
console.log('5. Only CONFIRMED findings are treated as verified failures (✓)');
