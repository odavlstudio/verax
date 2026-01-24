/**
 * Output Formatter for Batch Stability Reports
 * 
 * Responsibility: Format and print human-readable batch stability summaries.
 * - Renders classification, findings, observations, timing, health
 * - Provides interpretation and recommendations
 * - Outputs paths to reports
 */

/**
 * Print human-readable batch stability summary
 * @param {Object} batchStability - Batch stability metrics
 * @param {string} reportPath - Path to written report
 * @param {string} batchDir - Batch directory
 */
export function printBatchStabilitySummary(batchStability, reportPath, batchDir) {
  const overall = batchStability.overall || {};
  const findings = batchStability.findings || {};
  const observations = batchStability.observations || {};
  const timing = batchStability.timing || {};
  const toolHealth = batchStability.toolHealth || {};
  
  // Header
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  BATCH STABILITY REPORT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  // Overall Classification
  const classColor = overall.classification === 'STABLE' ? '✅'
                   : overall.classification === 'MOSTLY_STABLE' ? '⚠️'
                   : '❌';
  console.log(`${classColor} OVERALL CLASSIFICATION: ${overall.classification}`);
  console.log(`   Confidence: ${(overall.confidence * 100).toFixed(1)}%`);
  console.log(`   Runs: ${overall.runCount}`);
  console.log('');
  
  // Findings Analysis
  console.log('📊 FINDINGS ANALYSIS');
  if (findings.findingsDiffer) {
    console.log(`   ⚠️ Findings differ across runs`);
    console.log(`      • Added:   ${findings.addedCount} IDs`);
    console.log(`      • Removed: ${findings.removedCount} IDs`);
    console.log(`      • Common:  ${findings.commonCount} IDs`);
  } else {
    console.log(`   ✅ Findings identical across all ${overall.runCount} runs`);
  }
  console.log('');
  
  // Observation Analysis
  console.log('👁️ OBSERVATION ANALYSIS');
  const obsStats = observations.statsAcrossRuns || {};
  if (obsStats.expectationDelta !== undefined) {
    console.log(`   Expectations Executed: ${obsStats.minExpectations}-${obsStats.maxExpectations} (delta: ${obsStats.expectationDelta})`);
  }
  if (obsStats.observationRatioDelta !== undefined) {
    console.log(`   Observation Ratio:     ${(obsStats.minRatio * 100).toFixed(1)}%-${(obsStats.maxRatio * 100).toFixed(1)}% (delta: ${(obsStats.observationRatioDelta * 100).toFixed(1)}%)`);
  }
  if (observations.signalConsistency !== undefined) {
    console.log(`   Signal Consistency:    ${(observations.signalConsistency * 100).toFixed(1)}%`);
  }
  console.log('');
  
  // Timing Analysis
  console.log('⏱️ TIMING ANALYSIS');
  const timingStats = timing.statsAcrossRuns || {};
  if (timingStats.totalDriftCv !== undefined) {
    console.log(`   Total Duration Drift:  ${(timingStats.totalDriftCv * 100).toFixed(1)}% (CV)`);
    console.log(`   Min-Max Range:         ${formatDuration(timingStats.minTotalMs)}-${formatDuration(timingStats.maxTotalMs)}`);
  }
  if (timingStats.interactionDriftCv !== undefined) {
    console.log(`   Per-Interaction Drift: ${(timingStats.interactionDriftCv * 100).toFixed(1)}% (avg CV)`);
  }
  console.log('');
  
  // Tool Health Analysis
  console.log('🔧 TOOL HEALTH');
  console.log(`   Complete Runs: ${toolHealth.completeRunCount || 0}/${overall.runCount}`);
  console.log(`   Timeouts:      ${toolHealth.timeoutCount || 0}`);
  console.log(`   State Errors:  ${toolHealth.stateErrorCount || 0}`);
  console.log('');
  
  // Recommendations
  console.log('💡 INTERPRETATION');
  if (overall.classification === 'STABLE') {
    console.log('   ✅ This feature is stable across runs.');
    console.log('   ✅ Safe for automation and gating.');
  } else if (overall.classification === 'MOSTLY_STABLE') {
    console.log('   ⚠️ This feature shows moderate variability.');
    console.log('   ⚠️ Investigate timing and observation deltas.');
    console.log('   ⚠️ Consider controlled retry strategies.');
  } else {
    console.log('   ❌ This feature is unstable across runs.');
    console.log('   ❌ Findings differ or tool health is degraded.');
    console.log('   ❌ Requires investigation before gating.');
  }
  console.log('');
  
  // Footer
  console.log(`✅ Batch report written to:`);
  console.log(`   ${reportPath}`);
  console.log(`   ${batchDir}/runs.json`);
  console.log('');
}

/**
 * Format duration in milliseconds as human string
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  if (typeof ms !== 'number') return '0ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
