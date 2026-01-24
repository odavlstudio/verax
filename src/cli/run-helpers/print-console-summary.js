/**
 * Extracted from runCommand Phase 7 (Exit) for readability. No behavior change.
 * Prints console summary of run results.
 */
export function printConsoleSummary(paths, url, expectations, observeData, detectData) {
  const relativePath = paths.baseDir.replace(/\\/g, '/').split('/').slice(-1)[0];
  console.log('');
  console.log('VERAX — Silent Failure Detection');
  console.log('');
  console.log(`✔ URL: ${url}`);
  console.log('');
  console.log('Learn phase:');
  console.log(`  → Extracted ${expectations.length} promises`);
  console.log('');
  console.log('Observe phase:');
  console.log(`  → Executed ${observeData.stats?.attempted || 0} interactions`);
  console.log(`  → Observed: ${observeData.stats?.observed || 0}/${observeData.stats?.attempted || 0}`);
  console.log('');
  console.log('Detect phase:');
  console.log(`  → Silent failures: ${detectData.stats?.silentFailures || 0}`);
  console.log(`  → Unproven: ${detectData.stats?.unproven || 0}`);
  console.log(`  → Coverage gaps: ${detectData.stats?.coverageGaps || 0}`);
  console.log('');
  console.log('Artifacts written to:');
  console.log(`  .verax/runs/${relativePath}/`);
  console.log('');
}








