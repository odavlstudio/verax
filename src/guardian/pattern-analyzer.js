/**
 * Pattern Analyzer
 * Detects recurring risk patterns across multiple runs.
 * 
 * Patterns detected:
 * - repeated_skipped_attempts: Same attempt consistently skipped
 * - recurring_friction_path: Specific attempt/page shows friction across runs
 * - confidence_degradation: Confidence score declining over time
 * - single_point_failure: One attempt always fails while others succeed
 */

const fs = require('fs');
const path = require('path');

/**
 * Load all recent run metadata for a site
 * @param {string} artifactsDir - e.g., ./artifacts
 * @param {string} siteSlug - e.g., example-com
 * @param {number} maxRuns - Maximum runs to analyze (default 10)
 * @returns {array} - [{runDirName, runId, timestamp, meta, snapshotPath}, ...]
 */
function loadRecentRunsForSite(artifactsDir, siteSlug, maxRuns = 10) {
  const runs = [];
  
  try {
    const entries = fs.readdirSync(artifactsDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const dirName = entry.name;
      // Format: YYYY-MM-DD_HH-MM-SS_<siteSlug>_<policy>_<result>
      if (!dirName.includes(siteSlug)) continue;
      
      const metaPath = path.join(artifactsDir, dirName, 'META.json');
      const snapshotPath = path.join(artifactsDir, dirName, 'snapshot.json');
      
      // Check if run has artifacts
      if (!fs.existsSync(metaPath)) continue;
      
      try {
        const metaRaw = fs.readFileSync(metaPath, 'utf8');
        const meta = JSON.parse(metaRaw);
        
        runs.push({
          runDirName: dirName,
          runId: dirName,
          timestamp: new Date(meta.timestamp || dirName.split('_')[0]),
          meta,
          snapshotPath: fs.existsSync(snapshotPath) ? snapshotPath : null,
          snapshot: null // lazy-loaded
        });
      } catch (_parseErr) {
        // Skip unparseable runs
        continue;
      }
    }
  } catch (_err) {
    return [];
  }
  
  // Sort by timestamp descending, take recent N
  runs.sort((a, b) => b.timestamp - a.timestamp);
  return runs.slice(0, maxRuns);
}

/**
 * Load snapshot data for a run if available
 */
function loadSnapshot(run) {
  if (run.snapshot) return run.snapshot;
  if (!run.snapshotPath || !fs.existsSync(run.snapshotPath)) return null;
  
  try {
    const raw = fs.readFileSync(run.snapshotPath, 'utf8');
    run.snapshot = JSON.parse(raw);
    return run.snapshot;
  } catch (_err) {
    return null;
  }
}

/**
 * Detect repeated skipped attempts
 * If an attempt is SKIPPED in multiple runs, it's a pattern
 */
function detectRepeatedSkippedAttempts(runs) {
  const patterns = [];
  const attemptSkipCounts = {}; // { attemptId: { count, runIds } }
  
  for (const run of runs) {
    const snapshot = loadSnapshot(run);
    if (!snapshot || !snapshot.attempts) continue;
    
    for (const attempt of snapshot.attempts) {
      if (attempt.outcome === 'SKIPPED') {
        if (!attemptSkipCounts[attempt.attemptId]) {
          attemptSkipCounts[attempt.attemptId] = { count: 0, runIds: [] };
        }
        attemptSkipCounts[attempt.attemptId].count++;
        attemptSkipCounts[attempt.attemptId].runIds.push(run.runId);
      }
    }
  }
  
  for (const [attemptId, data] of Object.entries(attemptSkipCounts)) {
    if (data.count >= 2) {
      patterns.push({
        patternId: `repeated_skipped_${attemptId}`,
        type: 'repeated_skipped_attempts',
        summary: `Attempt "${attemptId}" was not executed in ${data.count} of the last ${runs.length} runs.`,
        whyItMatters: `Skipped attempts leave critical user paths untested. Consider ensuring this attempt runs in every evaluation.`,
        recommendedFocus: 'Coverage gap detected; this path has not been exercised.',
        evidence: {
          attemptId,
          occurrences: data.count,
          runIds: data.runIds,
          basedOnRuns: runs.length
        },
        confidence: data.count >= 3 ? 'high' : 'medium',
        limits: `Based on last ${Math.min(runs.length, 10)} runs. If you intentionally skip this attempt, ignore this pattern.`
      });
    }
  }
  
  return patterns;
}

/**
 * Detect recurring friction on specific paths/attempts
 * If same attempt shows FRICTION in 2+ runs, it's a pattern
 */
function detectRecurringFriction(runs) {
  const patterns = [];
  const frictionCounts = {}; // { attemptId: { count, runIds, totalDuration } }
  
  for (const run of runs) {
    const snapshot = loadSnapshot(run);
    if (!snapshot || !snapshot.attempts) continue;
    
    for (const attempt of snapshot.attempts) {
      if (attempt.outcome === 'FRICTION' || (attempt.friction && attempt.friction.isFriction)) {
        if (!frictionCounts[attempt.attemptId]) {
          frictionCounts[attempt.attemptId] = { count: 0, runIds: [], durations: [] };
        }
        frictionCounts[attempt.attemptId].count++;
        frictionCounts[attempt.attemptId].runIds.push(run.runId);
        frictionCounts[attempt.attemptId].durations.push(attempt.totalDurationMs || 0);
      }
    }
  }
  
  for (const [attemptId, data] of Object.entries(frictionCounts)) {
    if (data.count >= 2) {
      const avgDuration = data.durations.length > 0
        ? Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length)
        : 0;
      
      patterns.push({
        patternId: `recurring_friction_${attemptId}`,
        type: 'recurring_friction',
        summary: `Attempt "${attemptId}" showed friction in ${data.count} of the last ${runs.length} runs (avg ${avgDuration}ms).`,
        whyItMatters: `Recurring friction signals friction is not random—there's a systematic issue (slow endpoint, unreliable element, poor UX). This harms user satisfaction and should be investigated.`,
        recommendedFocus: 'User experience may be degrading on this path.',
        evidence: {
          attemptId,
          occurrences: data.count,
          runIds: data.runIds,
          avgDurationMs: avgDuration,
          basedOnRuns: runs.length
        },
        confidence: data.count >= 3 ? 'high' : 'medium',
        limits: `Based on last ${Math.min(runs.length, 10)} runs. High variability in network or load may cause friction; consider examining environment factors.`
      });
    }
  }
  
  return patterns;
}

/**
 * Detect confidence score degradation over time
 * If confidence declining across last 3+ runs, user should investigate
 */
function detectConfidenceDegradation(runs) {
  const patterns = [];
  const runsWithVerdicts = runs
    .map(run => {
      const snapshot = loadSnapshot(run);
      const verdict = snapshot && snapshot.verdict;
      return {
        runId: run.runId,
        timestamp: run.timestamp,
        score: verdict && verdict.confidence ? verdict.confidence.score : null
      };
    })
    .filter(r => r.score !== null)
    .reverse(); // oldest first
  
  if (runsWithVerdicts.length < 3) return patterns;
  
  // Check if trend is declining (slope analysis)
  const scores = runsWithVerdicts.map(r => r.score);
  let isDecreasing = true;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] >= scores[i - 1]) {
      isDecreasing = false;
      break;
    }
  }
  
  if (isDecreasing && runsWithVerdicts.length >= 3) {
    const firstScore = scores[0];
    const lastScore = scores[scores.length - 1];
    const drop = firstScore - lastScore;
    
    if (drop >= 0.2) { // significant drop (20+ percentage points)
      patterns.push({
        patternId: 'confidence_degradation',
        type: 'confidence_degradation',
        summary: `Confidence declined from ${(firstScore * 100).toFixed(0)}% to ${(lastScore * 100).toFixed(0)}% over ${runsWithVerdicts.length} runs.`,
        whyItMatters: `Declining confidence indicates growing test failures or friction. Site quality may be degrading, or test coverage may be revealing previously hidden issues.`,
        recommendedFocus: 'Overall quality signals are trending down across runs.',
        evidence: {
          runCount: runsWithVerdicts.length,
          runIds: runsWithVerdicts.map(r => r.runId),
          scores: runsWithVerdicts.map(r => r.score),
          trend: 'declining'
        },
        confidence: drop >= 0.3 ? 'high' : 'medium',
        limits: `Based on last ${runsWithVerdicts.length} runs with verdicts. Short-term fluctuations are normal; patterns become clearer with 5+ runs.`
      });
    }
  }
  
  return patterns;
}

/**
 * Detect single-point-of-failure: one attempt fails consistently while others succeed
 */
function detectSinglePointFailure(runs) {
  const patterns = [];
  const attemptOutcomes = {}; // { attemptId: { success, failure, friction } }
  
  for (const run of runs) {
    const snapshot = loadSnapshot(run);
    if (!snapshot || !snapshot.attempts) continue;
    
    for (const attempt of snapshot.attempts) {
      if (!attemptOutcomes[attempt.attemptId]) {
        attemptOutcomes[attempt.attemptId] = { success: 0, failure: 0, friction: 0, skipped: 0, runIds: [] };
      }
      const counts = attemptOutcomes[attempt.attemptId];
      if (attempt.outcome === 'SKIPPED') counts.skipped++;
      else if (attempt.outcome === 'FAILURE') counts.failure++;
      else if (attempt.outcome === 'FRICTION') counts.friction++;
      else counts.success++;
      counts.runIds.push(run.runId);
    }
  }
  
  // Find attempts that fail in most runs while others succeed
  const attemptResults = [];
  for (const [attemptId, counts] of Object.entries(attemptOutcomes)) {
    const executed = counts.success + counts.failure + counts.friction;
    if (executed >= 2) {
      const failureRate = executed > 0 ? counts.failure / executed : 0;
      attemptResults.push({
        attemptId,
        failureRate,
        failureCount: counts.failure,
        executedCount: executed,
        ...counts
      });
    }
  }
  
  // Filter to attempts with high failure rate while others succeed
  const avgFailureRate = attemptResults.length > 0
    ? attemptResults.reduce((sum, a) => sum + a.failureRate, 0) / attemptResults.length
    : 0;
  
  // Detect outliers: 2+ failures AND (rate >= 0.6 OR significantly higher than average)
  const outliers = attemptResults.filter(a => 
    a.failureCount >= 2 && (a.failureRate >= 0.6 || a.failureRate > avgFailureRate + 0.3)
  );
  
  for (const outlier of outliers) {
    patterns.push({
      patternId: `single_point_failure_${outlier.attemptId}`,
      type: 'single_point_failure',
      summary: `Attempt "${outlier.attemptId}" did not complete in ${outlier.failure} of ${outlier.executedCount} runs—much higher than other attempts.`,
      whyItMatters: `This attempt is a bottleneck. It's preventing users from reaching critical functionality. Prioritize fixing whatever blocks this path.`,
      recommendedFocus: 'This path is a bottleneck and blocks user progress.',
      evidence: {
        attemptId: outlier.attemptId,
        failureCount: outlier.failure,
        executedCount: outlier.executedCount,
        failureRate: (outlier.failureRate * 100).toFixed(0) + '%',
        runIds: outlier.runIds.slice(0, 5) // show first 5
      },
      confidence: outlier.executedCount >= 4 ? 'high' : 'medium',
      limits: `Based on ${outlier.executedCount} executions across last ${runs.length} runs. If this is intentionally experimental, consider removing or documenting it.`
    });
  }
  
  return patterns;
}

/**
 * Main: Analyze all patterns for a given site
 * @param {string} artifactsDir - Path to artifacts directory
 * @param {string} siteSlug - Site slug (e.g., example-com)
 * @param {number} maxRuns - Max runs to consider (default 10)
 * @returns {array} - Array of pattern objects
 */
function analyzePatterns(artifactsDir, siteSlug, maxRuns = 10) {
  const runs = loadRecentRunsForSite(artifactsDir, siteSlug, maxRuns);
  
  if (runs.length < 2) {
    // Need at least 2 runs to detect patterns
    return [];
  }
  
  const allPatterns = [
    ...detectRepeatedSkippedAttempts(runs),
    ...detectRecurringFriction(runs),
    ...detectConfidenceDegradation(runs),
    ...detectSinglePointFailure(runs)
  ];
  
  // Sort by confidence level and type
  const confidenceRank = { high: 3, medium: 2, low: 1 };
  allPatterns.sort((a, b) => confidenceRank[b.confidence] - confidenceRank[a.confidence]);
  
  return allPatterns;
}

module.exports = {
  analyzePatterns,
  loadRecentRunsForSite,
  loadSnapshot,
  detectRepeatedSkippedAttempts,
  detectRecurringFriction,
  detectConfidenceDegradation,
  detectSinglePointFailure
};
