/**
 * Guardian Policy Evaluation
 * 
 * Deterministic threshold-based gating for CI/CD pipelines.
 * - Evaluate snapshot against policy thresholds
 * - Determine exit code (success/warn/fail)
 * - Support baseline regression detection
 * - Domain-aware gates for Phase 4 (REVENUE/TRUST critical failures)
 * 
 * NO AI. Pure deterministic logic.
 */

const fs = require('fs');

/**
 * @typedef {Object} GuardianPolicy
 * @property {string} [failOnSeverity='CRITICAL'] - Severity level that triggers exit 1 (CRITICAL|WARNING|INFO)
 * @property {number} [maxWarnings=0] - Max WARNING count before fail
 * @property {number} [maxInfo=999] - Max INFO count before fail
 * @property {number} [maxTotalRisk=999] - Max total risks before fail
 * @property {boolean} [failOnNewRegression=true] - Fail if baseline regression detected
 * @property {boolean} [failOnSoftFailures=false] - Fail if any soft failures detected
 * @property {number} [softFailureThreshold=5] - Max soft failures before fail
 * @property {boolean} [requireBaseline=false] - Require baseline to exist
 * @property {Object} [domainGates] - Domain-aware gates (Phase 4). Ex: { REVENUE: { CRITICAL: 0, WARNING: 3 }, TRUST: { CRITICAL: 0 } }
 * @property {Object} [visualGates] - Phase 5: Visual regression gates. Ex: { CRITICAL: 0, WARNING: 999, maxDiffPercent: 25 }
 */

/**
 * Load policy from file or return defaults
 */
function loadPolicy(policyPath = null) {
  const defaultPolicy = {
    failOnSeverity: 'CRITICAL',
    maxWarnings: 0,
    maxInfo: 999,
    maxTotalRisk: 999,
    failOnNewRegression: true,
    failOnSoftFailures: false,
    softFailureThreshold: 5,
    requireBaseline: false,
    domainGates: {
      // Phase 4: Fail on any CRITICAL in REVENUE or TRUST domains
      REVENUE: { CRITICAL: 0, WARNING: 999 },
      TRUST: { CRITICAL: 0, WARNING: 999 }
    },
    // Phase 5: Visual regression gates
    visualGates: {
      CRITICAL: 0,  // Fail if any CRITICAL visual diffs
      WARNING: 999, // Warn if more than 999 WARNING visual diffs
      maxDiffPercent: 25 // Fail if visual change > 25% of page
    },
    // Coverage and evidence expectations
    coverage: {
      failOnGap: true,
      warnOnGap: false
    },
    evidence: {
      minCompleteness: 1.0,
      minIntegrity: 0.9,
      requireScreenshots: false,
      requireTraces: false
    }
  };

  if (!policyPath) {
    // Try to find guardian.policy.json in current directory, config/, or .odavl-guardian/
    const candidates = [
      'config/guardian.policy.json',
      'guardian.policy.json',
      '.odavl-guardian/policy.json',
      '.odavl-guardian/guardian.policy.json'
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        policyPath = candidate;
        break;
      }
    }
  }

  // If no policy file found, use defaults
  if (!policyPath || !fs.existsSync(policyPath)) {
    return defaultPolicy;
  }

  try {
    const json = fs.readFileSync(policyPath, 'utf8');
    const loaded = JSON.parse(json);
    return { ...defaultPolicy, ...loaded };
  } catch (e) {
    console.warn(`⚠️  Failed to load policy from ${policyPath}: ${e.message}`);
    console.warn('   Using default policy');
    return defaultPolicy;
  }
}

/**
 * Evaluate snapshot against policy
 * Returns { passed: boolean, exitCode: 0|1|2, reasons: string[], summary: string }
 */
function evaluatePolicy(snapshot, policy, signals = {}) {
  const effectivePolicy = policy || loadPolicy();
  const reasons = [];
  let exitCode = 0;

  // Check for INSUFFICIENT_EVIDENCE verdict - always exit 2 (WARN)
  const verdict = snapshot.verdict || {};
  if (verdict.verdict === 'INSUFFICIENT_EVIDENCE') {
    reasons.push('No meaningful attempts executed; element discovery failed on uninstrumented site or all journeys not applicable');
    exitCode = 2; // WARN - cannot make a confident decision
    return {
      passed: false,
      exitCode,
      reasons,
      summary: '⚠️  Policy evaluation INSUFFICIENT_EVIDENCE (exit code 2)',
      counts: {
        critical: 0,
        warning: 0,
        info: 0,
        softFailures: 0,
        totalRisk: 0
      }
    };
  }

  // Extract market impact summary (Phase 3)
  const marketImpact = snapshot.marketImpactSummary || {};
  const criticalCount = marketImpact.countsBySeverity?.CRITICAL || 0;
  const warningCount = marketImpact.countsBySeverity?.WARNING || 0;
  const infoCount = marketImpact.countsBySeverity?.INFO || 0;
  const totalRisk = marketImpact.totalRiskCount || 0;

  // Coverage and evidence signals
  const coverage = signals.coverage || { gaps: 0, total: 0, executed: 0 };
  const evidenceMetrics = signals.evidence?.metrics || { completeness: 0, integrity: 0 };
  const missingScreenshots = signals.evidence?.missingScreenshots || false;
  const missingTraces = signals.evidence?.missingTraces || false;
  const runtimeSignals = Array.isArray(signals.runtimeSignals) ? signals.runtimeSignals : [];

  // Extract soft failures (Phase 2)
  const softFailureCount = snapshot.attempts?.reduce((sum, attempt) => {
    return sum + (attempt.softFailureCount || 0);
  }, 0) || 0;

  // Phase 4: Check domain gates if intelligence available
  if (!exitCode && effectivePolicy.domainGates && snapshot.intelligence) {
    const intelligence = snapshot.intelligence;
    const domainFailures = intelligence.byDomain || {};

    for (const [domain, gates] of Object.entries(effectivePolicy.domainGates)) {
      const domainFailure = domainFailures[domain] || { failures: [] };

      // Check CRITICAL gate
      if (gates.CRITICAL !== undefined) {
        const criticalInDomain = domainFailure.failures?.filter(f => f.severity === 'CRITICAL').length || 0;
        if (criticalInDomain > gates.CRITICAL) {
          reasons.push(`Domain ${domain}: ${criticalInDomain} CRITICAL failure(s) exceed gate limit of ${gates.CRITICAL}`);
          exitCode = 1;
        }
      }

      // Check WARNING gate
      if (!exitCode && gates.WARNING !== undefined) {
        const warningInDomain = domainFailure.failures?.filter(f => f.severity === 'WARNING').length || 0;
        if (warningInDomain > gates.WARNING) {
          reasons.push(`Domain ${domain}: ${warningInDomain} WARNING failure(s) exceed gate limit of ${gates.WARNING}`);
          exitCode = 2;
        }
      }
    }
  }

  // Phase 5: Check visual regression gates if configured
  if (!exitCode && effectivePolicy.visualGates && snapshot.intelligence) {
    const intelligence = snapshot.intelligence;
    const visualFailures = intelligence.failures?.filter(f => f.breakType === 'VISUAL') || [];
    const visualCritical = visualFailures.filter(f => f.severity === 'CRITICAL').length || 0;
    const visualWarning = visualFailures.filter(f => f.severity === 'WARNING').length || 0;
    const maxDiffPercent = Math.max(...visualFailures.map(f => f.visualDiff?.percentChange || 0));

    // Check CRITICAL visual diffs
    if (effectivePolicy.visualGates.CRITICAL !== undefined) {
      if (visualCritical > effectivePolicy.visualGates.CRITICAL) {
        reasons.push(`Visual regression: ${visualCritical} CRITICAL diff(s) exceed gate limit of ${effectivePolicy.visualGates.CRITICAL}`);
        exitCode = 1;
      }
    }

    // Check WARNING visual diffs
    if (!exitCode && effectivePolicy.visualGates.WARNING !== undefined) {
      if (visualWarning > effectivePolicy.visualGates.WARNING) {
        reasons.push(`Visual regression: ${visualWarning} WARNING diff(s) exceed gate limit of ${effectivePolicy.visualGates.WARNING}`);
        exitCode = 2;
      }
    }

    // Check max diff percent
    if (!exitCode && effectivePolicy.visualGates.maxDiffPercent !== undefined) {
      if (maxDiffPercent > effectivePolicy.visualGates.maxDiffPercent) {
        reasons.push(`Visual regression: ${maxDiffPercent.toFixed(1)}% diff exceeds max threshold of ${effectivePolicy.visualGates.maxDiffPercent}%`);
        exitCode = 1;
      }
    }
  }

  // Evaluate CRITICAL severity (always exit 1 if present)
  if (effectivePolicy.failOnSeverity === 'CRITICAL' && criticalCount > 0) {
    reasons.push(`${criticalCount} CRITICAL risk(s) detected (policy: failOnSeverity=CRITICAL)`);
    exitCode = 1;
  }

  // Evaluate WARNING severity
  if (effectivePolicy.failOnSeverity === 'WARNING' && warningCount > 0) {
    reasons.push(`${warningCount} WARNING risk(s) detected (policy: failOnSeverity=WARNING)`);
    exitCode = 1;
  }

  // Evaluate max warnings
  if (!exitCode && warningCount > effectivePolicy.maxWarnings) {
    reasons.push(`${warningCount} WARNING(s) exceed limit of ${effectivePolicy.maxWarnings}`);
    exitCode = 2;
  }

  // Evaluate max info
  if (!exitCode && infoCount > effectivePolicy.maxInfo) {
    reasons.push(`${infoCount} INFO(s) exceed limit of ${effectivePolicy.maxInfo}`);
    exitCode = 2;
  }

  // Evaluate total risk
  if (!exitCode && totalRisk > effectivePolicy.maxTotalRisk) {
    reasons.push(`${totalRisk} total risk(s) exceed limit of ${effectivePolicy.maxTotalRisk}`);
    exitCode = 1;
  }

  // Evaluate baseline regression
  if (!exitCode && effectivePolicy.failOnNewRegression) {
    const baseline = snapshot.baseline || {};
    const diff = baseline.diff || {};

    if (diff.regressions && Object.keys(diff.regressions).length > 0) {
      const regCount = Object.keys(diff.regressions).length;
      reasons.push(`${regCount} baseline regression(s) detected (policy: failOnNewRegression=true)`);
      exitCode = 1;
    }
  }

  // Evaluate soft failures
  if (!exitCode && effectivePolicy.failOnSoftFailures && softFailureCount > 0) {
    reasons.push(`${softFailureCount} soft failure(s) detected (policy: failOnSoftFailures=true)`);
    exitCode = 1;
  }

  // Evaluate soft failure threshold
  if (!exitCode && softFailureCount > effectivePolicy.softFailureThreshold) {
    reasons.push(`${softFailureCount} soft failure(s) exceed threshold of ${effectivePolicy.softFailureThreshold}`);
    exitCode = 2;
  }

  // Coverage gaps (attempts skipped/not applicable)
  if (!exitCode && effectivePolicy.coverage) {
    if (effectivePolicy.coverage.failOnGap && coverage.gaps > 0) {
      reasons.push(`Coverage gaps detected: ${coverage.gaps} of ${coverage.total || 'n/a'} attempts not executed`);
      exitCode = 1;
    } else if (effectivePolicy.coverage.warnOnGap && coverage.gaps > 0) {
      reasons.push(`Coverage gaps detected: ${coverage.gaps} of ${coverage.total || 'n/a'} attempts not executed`);
      exitCode = 2;
    }
  }

  // Evidence completeness/integrity
  if (!exitCode && effectivePolicy.evidence) {
    if (evidenceMetrics.completeness < (effectivePolicy.evidence.minCompleteness ?? 1)) {
      reasons.push(`Evidence completeness ${evidenceMetrics.completeness.toFixed(2)} below policy minimum ${(effectivePolicy.evidence.minCompleteness ?? 1)}`);
      exitCode = exitCode || (effectivePolicy.evidence.minCompleteness >= 1 ? 1 : 2);
    }
    if (evidenceMetrics.integrity < (effectivePolicy.evidence.minIntegrity ?? 0)) {
      reasons.push(`Evidence integrity ${evidenceMetrics.integrity.toFixed(2)} below policy minimum ${(effectivePolicy.evidence.minIntegrity ?? 0)}`);
      exitCode = exitCode || 2;
    }
    if (effectivePolicy.evidence.requireScreenshots && missingScreenshots) {
      reasons.push('Screenshots disabled but required by policy');
      exitCode = 1;
    }
    if (effectivePolicy.evidence.requireTraces && missingTraces) {
      reasons.push('Network traces disabled but required by policy');
      exitCode = 1;
    }
  }

  // Runtime signals (crawl/discovery/system)
  if (!exitCode && runtimeSignals.length > 0) {
    const desc = runtimeSignals.map(s => s.description).slice(0, 3).join('; ');
    reasons.push(`Runtime issues detected: ${desc}`);
    exitCode = 2;
  }

  // Evaluate baseline requirement
  if (!exitCode && effectivePolicy.requireBaseline) {
    const baseline = snapshot.baseline || {};
    if (!baseline.baselineFound && !baseline.baselineCreatedThisRun) {
      reasons.push('Baseline required but not found (policy: requireBaseline=true)');
      exitCode = 1;
    }
  }

  // Build summary
  const summary =
    exitCode === 0
      ? '✅ Policy evaluation PASSED'
      : exitCode === 1
      ? '❌ Policy evaluation FAILED (exit code 1)'
      : '⚠️  Policy evaluation WARNING (exit code 2)';

  return {
    passed: exitCode === 0,
    exitCode,
    reasons,
    summary,
    counts: {
      critical: criticalCount,
      warning: warningCount,
      info: infoCount,
      softFailures: softFailureCount,
      totalRisk
    }
  };
}

/**
 * Format policy evaluation results for CLI output
 */
function formatPolicyOutput(evaluation) {
  let output = '\n' + '━'.repeat(60) + '\n';
  output += '🛡️  Policy Evaluation\n';
  output += '━'.repeat(60) + '\n\n';

  output += `${evaluation.summary}\n`;

  if (evaluation.reasons.length > 0) {
    output += '\nFailure reasons:\n';
    evaluation.reasons.forEach(r => {
      output += `  ❌ ${r}\n`;
    });
  }

  output += `\nRisk counts:\n`;
  output += `  🔴 CRITICAL: ${evaluation.counts.critical}\n`;
  output += `  🟡 WARNING:  ${evaluation.counts.warning}\n`;
  output += `  🔵 INFO:     ${evaluation.counts.info}\n`;
  output += `  🐛 Soft Failures: ${evaluation.counts.softFailures}\n`;
  output += `  📊 Total Risks:   ${evaluation.counts.totalRisk}\n`;

  output += `\nExit Code: ${evaluation.exitCode}\n`;
  output += '━'.repeat(60) + '\n';

  return output;
}

/**
 * Create a default policy file
 */
function createDefaultPolicyFile(outputPath = 'config/guardian.policy.json') {
  const defaultPolicy = {
    failOnSeverity: 'CRITICAL',
    maxWarnings: 0,
    maxInfo: 999,
    maxTotalRisk: 999,
    failOnNewRegression: true,
    failOnSoftFailures: false,
    softFailureThreshold: 5,
    requireBaseline: false
  };

  fs.writeFileSync(
    outputPath,
    JSON.stringify(defaultPolicy, null, 2),
    'utf8'
  );

  return outputPath;
}

/**
 * Validate policy object structure
 */
function validatePolicy(policy) {
  const errors = [];

  if (!policy || typeof policy !== 'object') {
    return {
      valid: false,
      errors: ['Policy must be an object']
    };
  }

  const severityValues = ['CRITICAL', 'WARNING', 'INFO'];
  if (policy.failOnSeverity && !severityValues.includes(policy.failOnSeverity)) {
    errors.push(`failOnSeverity must be one of: ${severityValues.join(', ')}`);
  }

  if (typeof policy.maxWarnings !== 'number' || policy.maxWarnings < 0) {
    errors.push('maxWarnings must be a non-negative number');
  }

  if (typeof policy.maxInfo !== 'number' || policy.maxInfo < 0) {
    errors.push('maxInfo must be a non-negative number');
  }

  if (typeof policy.maxTotalRisk !== 'number' || policy.maxTotalRisk < 0) {
    errors.push('maxTotalRisk must be a non-negative number');
  }

  if (typeof policy.failOnNewRegression !== 'boolean') {
    errors.push('failOnNewRegression must be a boolean');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  loadPolicy,
  evaluatePolicy,
  formatPolicyOutput,
  createDefaultPolicyFile,
  validatePolicy
};
