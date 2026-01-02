const fs = require('fs');
const path = require('path');
const { executeReality } = require('./reality');
const { BaselineCheckReporter } = require('./baseline-reporter');
const { getDefaultAttemptIds, getAttemptDefinition } = require('./attempt-registry');
const packageJson = require('../../package.json');

const SCHEMA_VERSION = 1;

function safeNumber(n) {
  return typeof n === 'number' && !Number.isNaN(n) ? n : null;
}

function toStepSummary(step) {
  return {
    stepId: step.id,
    type: step.type,
    durationMs: safeNumber(step.durationMs) || 0,
    retries: safeNumber(step.retries) || 0
  };
}

function toFrictionSignalSummary(signal) {
  return {
    id: signal.id,
    metric: signal.metric,
    threshold: safeNumber(signal.threshold),
    observedValue: safeNumber(signal.observedValue),
    affectedStepId: signal.affectedStepId || null,
    severity: signal.severity || 'medium'
  };
}

function buildBaselineSnapshot({ name, baseUrl, attempts, guardianVersion }, realityReport) {
  // Include all executed attempts (manual + auto-generated)
  const allAttemptIds = realityReport.results.map(r => r.attemptId);
  const resultsByAttempt = new Map(realityReport.results.map(r => [r.attemptId, r]));

  const perAttempt = allAttemptIds.map((attemptId) => {
    const r = resultsByAttempt.get(attemptId);
    const steps = (r.steps || []).map(toStepSummary);
    const retriesTotal = steps.reduce((sum, s) => sum + (s.retries || 0), 0);
    const frictionSignals = (r.friction && r.friction.signals ? r.friction.signals : []).map(toFrictionSignalSummary);
    return {
      attemptId,
      attemptName: r.attemptName || (getAttemptDefinition(attemptId)?.name || attemptId),
      outcome: r.outcome,
      totalDurationMs: safeNumber(r.totalDurationMs) || 0,
      totalRetries: retriesTotal,
      frictionSignals,
      steps
    };
  });

  const flows = (realityReport.flows || []).map((flow) => ({
    flowId: flow.flowId,
    flowName: flow.flowName,
    outcome: flow.outcome,
    riskCategory: flow.riskCategory,
    stepsExecuted: flow.stepsExecuted || 0,
    stepsTotal: flow.stepsTotal || 0,
    durationMs: safeNumber(flow.durationMs) || 0,
    error: flow.error || null
  }));
  const flowIds = flows.map(f => f.flowId);

  return {
    schemaVersion: SCHEMA_VERSION,
    guardianVersion: guardianVersion || packageJson.version,
    baselineName: name,
    createdAt: new Date().toISOString(),
    baseUrl,
    attempts: allAttemptIds,  // Include all executed attempts
    flows: flowIds,
    overallVerdict: realityReport.summary.overallVerdict,
    perAttempt,
    perFlow: flows
  };
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function saveBaseline(options) {
  const {
    baseUrl,
    attempts = getDefaultAttemptIds(),
    name = 'baseline',
    artifactsDir = './artifacts',
    baselineDir,
    headful = false,
    enableTrace = true,
    enableScreenshots = true,
    enableDiscovery = false,
    enableAutoAttempts = false,
    maxPages,
    autoAttemptOptions,
    guardianVersion,
    enableFlows = true,
    flowOptions = {}
  } = options;

  const reality = await executeReality({ 
    baseUrl, 
    attempts, 
    artifactsDir, 
    headful, 
    enableTrace, 
    enableScreenshots,
    enableDiscovery,
    enableAutoAttempts,
    maxPages,
    autoAttemptOptions,
    enableFlows,
    flowOptions
  });
  const snapshot = buildBaselineSnapshot({ name, baseUrl, attempts, guardianVersion }, reality.report);

  const targetBaselineDir = baselineDir ? baselineDir : path.join(artifactsDir, 'baselines');
  ensureDir(targetBaselineDir);
  const baselinePath = path.join(targetBaselineDir, `${name}.json`);
  fs.writeFileSync(baselinePath, JSON.stringify(snapshot, null, 2));

  console.log(`\n💾 Baseline saved: ${baselinePath}`);
  console.log(`Captured verdict: ${snapshot.overallVerdict}`);

  // Always exit 0 for save; return structured result
  return {
    exitCode: 0,
    baselinePath,
    runDir: reality.runDir,
    marketJsonPath: reality.marketJsonPath,
    marketHtmlPath: reality.marketHtmlPath,
    snapshot
  };
}

function loadBaselineOrThrow(baselinePath) {
  if (!fs.existsSync(baselinePath)) {
    const err = new Error(`Baseline not found at ${baselinePath}`);
    err.code = 'BASELINE_MISSING';
    throw err;
  }
  const raw = fs.readFileSync(baselinePath, 'utf8');
  const data = JSON.parse(raw);
  if (!data || data.schemaVersion !== SCHEMA_VERSION) {
    const err = new Error(`Baseline schema mismatch. Expected schemaVersion=${SCHEMA_VERSION}.`);
    err.code = 'SCHEMA_MISMATCH';
    throw err;
  }
  return data;
}

function percentChange(baseline, current) {
  if (baseline === null || current === null) return null;
  if (baseline === 0) return current > 0 ? Infinity : 0;
  return ((current - baseline) / baseline) * 100;
}

function indexSignals(signals) {
  const map = new Map();
  for (const s of signals || []) {
    if (s && s.id) map.set(s.id, s);
  }
  return map;
}

function compareAttempt(b, c) {
  // Handle missing attempts
  if (!b && !c) {
    return {
      regressionType: 'NO_REGRESSION',
      improvements: [],
      regressionReasons: [],
      frictionDelta: { added: [], removed: [], changed: [] },
      keyMetricsDelta: { durationMs: null, durationPct: null, retriesDelta: null }
    };
  }
  if (!b) {
    // New attempt not in baseline (auto-generated)
    return {
      regressionType: 'NO_REGRESSION',
      improvements: ['New attempt added'],
      regressionReasons: [],
      frictionDelta: { added: [], removed: [], changed: [] },
      keyMetricsDelta: { durationMs: null, durationPct: null, retriesDelta: null }
    };
  }
  if (!c) {
    // Attempt disappeared
    return {
      regressionType: 'REGRESSION_MISSING',
      improvements: [],
      regressionReasons: ['Attempt no longer exists in current run'],
      frictionDelta: { added: [], removed: [], changed: [] },
      keyMetricsDelta: { durationMs: null, durationPct: null, retriesDelta: null }
    };
  }

  const baselineOutcome = b.outcome;
  const currentOutcome = c.outcome;

  const improvements = [];
  const regressionReasons = [];
  const frictionDelta = { added: [], removed: [], changed: [] };
  const keyMetricsDelta = { durationMs: null, durationPct: null, retriesDelta: null };

  // duration and retries deltas
  keyMetricsDelta.durationMs = (safeNumber(c.totalDurationMs) || 0) - (safeNumber(b.totalDurationMs) || 0);
  keyMetricsDelta.durationPct = percentChange(safeNumber(b.totalDurationMs) || 0, safeNumber(c.totalDurationMs) || 0);
  keyMetricsDelta.retriesDelta = (safeNumber(c.totalRetries) || 0) - (safeNumber(b.totalRetries) || 0);

  // friction signals diff
  const bIdx = indexSignals(b.frictionSignals || []);
  const cIdx = indexSignals(c.frictionSignals || []);
  for (const [id, cs] of cIdx.entries()) {
    if (!bIdx.has(id)) {
      frictionDelta.added.push(id);
    } else {
      const bs = bIdx.get(id);
      if (typeof bs.observedValue === 'number' && typeof cs.observedValue === 'number') {
        const pct = percentChange(bs.observedValue, cs.observedValue);
        if (pct !== null && pct !== Infinity && pct >= 20) {
          frictionDelta.changed.push({ id, observedPctIncrease: pct });
        }
        if (pct < 0) {
          improvements.push(`Friction signal ${id} observed value decreased by ${Math.abs(Math.round(pct))}%`);
        }
      }
    }
  }
  for (const [id] of bIdx.entries()) {
    if (!cIdx.has(id)) {
      frictionDelta.removed.push(id);
      improvements.push(`Friction signal ${id} removed`);
    }
  }

  // classify regression
  let regressionType = 'NO_REGRESSION';

  if ((baselineOutcome === 'SUCCESS' || baselineOutcome === 'FRICTION') && currentOutcome === 'FAILURE') {
    regressionType = 'REGRESSION_FAILURE';
    regressionReasons.push('Baseline was non-failure; current attempt failed.');
  } else if (baselineOutcome === 'SUCCESS' && currentOutcome === 'FRICTION') {
    regressionType = 'REGRESSION_FRICTION_NEW';
    regressionReasons.push('Baseline had no friction; current attempt shows friction.');
  } else if (baselineOutcome === 'FRICTION' && currentOutcome === 'FRICTION') {
    let worse = false;
    if (frictionDelta.added.length > 0) {
      worse = true;
      regressionReasons.push(`New friction signals: ${frictionDelta.added.join(', ')}`);
    }
    if (frictionDelta.changed.length > 0) {
      worse = true;
      regressionReasons.push('Friction observed values increased by >=20%.');
    }
    if (keyMetricsDelta.durationPct !== null && keyMetricsDelta.durationPct >= 20) {
      worse = true;
      regressionReasons.push('Total duration increased by >=20%.');
    }
    if (keyMetricsDelta.retriesDelta !== null && keyMetricsDelta.retriesDelta > 0) {
      worse = true;
      regressionReasons.push('Total retries increased.');
    }
    if (worse) {
      regressionType = 'REGRESSION_FRICTION_WORSE';
    }
  }

  // improvements not changing status
  if (baselineOutcome === 'FAILURE' && (currentOutcome === 'SUCCESS' || currentOutcome === 'FRICTION')) {
    improvements.push('Outcome improved from FAILURE.');
  }
  if (baselineOutcome === 'FRICTION' && currentOutcome === 'SUCCESS') {
    improvements.push('Outcome improved from FRICTION to SUCCESS.');
  }

  return {
    baselineOutcome,
    currentOutcome,
    regressionType,
    regressionReasons,
    improvements,
    frictionDelta,
    keyMetricsDelta
  };
}

function aggregateVerdict(comparisons) {
  const hasFailure = comparisons.some(c => c.regressionType === 'REGRESSION_FAILURE' || c.regressionType === 'REGRESSION_MISSING');
  if (hasFailure) return 'REGRESSION_FAILURE';
  const hasFriction = comparisons.some(c => c.regressionType === 'REGRESSION_FRICTION_NEW' || c.regressionType === 'REGRESSION_FRICTION_WORSE');
  if (hasFriction) return 'REGRESSION_FRICTION';
  return 'NO_REGRESSION';
}

async function checkBaseline(options) {
  const {
    baseUrl,
    name,
    attempts = getDefaultAttemptIds(),
    artifactsDir = './artifacts',
    baselineDir,
    junit,
    headful = false,
    enableTrace = true,
    enableScreenshots = true,
    enableDiscovery = false,
    enableAutoAttempts = false,
    maxPages,
    autoAttemptOptions,
    enableFlows = true,
    flowOptions = {}
  } = options;

  const baselinePath = path.join(baselineDir ? baselineDir : path.join(artifactsDir, 'baselines'), `${name}.json`);
  let baseline;
  let baselineStatus = 'LOADED';
  try {
    baseline = loadBaselineOrThrow(baselinePath);
  } catch (err) {
    // Handle missing baseline gracefully
    if (err.code === 'BASELINE_MISSING') {
      console.log(`Baseline: not found (no comparison)`);
      baselineStatus = 'NO_BASELINE';
      baseline = null;
    } else if (err.code === 'SCHEMA_MISMATCH') {
      console.warn(`⚠️  Baseline schema mismatch - skipping comparison`);
      baselineStatus = 'BASELINE_UNUSABLE';
      baseline = null;
    } else {
      // Assume JSON parse error or other corruption
      console.warn(`⚠️  Baseline corrupt or unreadable - skipping comparison`);
      baselineStatus = 'BASELINE_UNUSABLE';
      baseline = null;
    }
  }

  const current = await executeReality({ 
    baseUrl, 
    attempts, 
    artifactsDir, 
    headful, 
    enableTrace, 
    enableScreenshots,
    enableDiscovery,
    enableAutoAttempts,
    maxPages,
    autoAttemptOptions,
    enableFlows,
    flowOptions
  });

  // If baseline is not available, skip comparison and return early
  if (!baseline || baselineStatus !== 'LOADED') {
    const currentExitCode = typeof current.exitCode === 'number' ? current.exitCode : 0;
    return {
      exitCode: currentExitCode,
      runDir: current.runDir,
      overallRegressionVerdict: baselineStatus === 'NO_BASELINE' ? 'NO_BASELINE' : 'BASELINE_UNUSABLE',
      comparisons: [],
      flowComparisons: [],
      baselineStatus
    };
  }

  // Use baseline attempts (includes auto-generated) for comparison
  const comparisonAttempts = baseline.attempts || attempts;

  // Map baseline and current per attempt
  const bMap = new Map((baseline.perAttempt || []).map(a => [a.attemptId, a]));
  const cMap = new Map((current.report.results || []).map(r => [r.attemptId, {
    attemptId: r.attemptId,
    outcome: r.outcome,
    totalDurationMs: safeNumber(r.totalDurationMs) || 0,
    totalRetries: (r.steps || []).reduce((sum, s) => sum + (s.retries || 0), 0),
    frictionSignals: (r.friction && r.friction.signals ? r.friction.signals : []).map(toFrictionSignalSummary),
    reportHtmlPath: r.reportHtmlPath,
    reportJsonPath: r.reportJsonPath
  }]));

  const bFlowMap = new Map((baseline.perFlow || []).map(f => [f.flowId, {
    ...f,
    totalDurationMs: safeNumber(f.durationMs) || 0,
    totalRetries: 0,
    frictionSignals: []
  }]));
  const cFlowMap = new Map(((current.flowResults || current.report.flows || [])).map(f => [f.flowId, {
    ...f,
    totalDurationMs: safeNumber(f.durationMs) || 0,
    totalRetries: 0,
    frictionSignals: []
  }]));

  const comparisons = comparisonAttempts.map((attemptId) => {
    const b = bMap.get(attemptId);
    const c = cMap.get(attemptId);
    const comp = compareAttempt(b, c);
    return {
      attemptId,
      ...comp,
      links: {
        reportHtml: (c && c.reportHtmlPath) || null,
        reportJson: (c && c.reportJsonPath) || null
      }
    };
  });

  const comparisonFlows = (baseline.flows || []).map((flowId) => {
    const b = bFlowMap.get(flowId);
    const c = cFlowMap.get(flowId);
    const comp = compareAttempt(b, c);
    return {
      flowId,
      ...comp
    };
  });

  const overallRegressionVerdict = aggregateVerdict([...comparisons, ...comparisonFlows]);

  const jsonReport = {
    meta: {
      runId: current.report.runId,
      timestamp: current.report.timestamp,
      baselineName: baseline.baselineName,
      baseUrl
    },
    baselineSummary: {
      overallVerdict: baseline.overallVerdict,
      createdAt: baseline.createdAt
    },
    currentSummary: {
      overallVerdict: current.report.summary.overallVerdict
    },
    comparisons,
    flowComparisons: comparisonFlows,
    overallRegressionVerdict
  };

  const reporter = new BaselineCheckReporter();
  const jsonPath = reporter.saveJsonReport(jsonReport, current.runDir);
  const html = reporter.generateHtmlReport(jsonReport);
  const htmlPath = reporter.saveHtmlReport(html, current.runDir);

  // Optional JUnit XML output
  if (junit) {
    try {
      const xml = generateJunitXml(jsonReport);
      const dir = path.dirname(junit);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(junit, xml, 'utf8');
    } catch (e) {
      console.error(`Failed to write JUnit XML: ${e.message}`);
    }
  }

  // Console UX
  console.log(`\n🧮 Baseline Check: ${overallRegressionVerdict}`);
  const regList = [
    ...comparisons.filter(c => c.regressionType !== 'NO_REGRESSION'),
    ...comparisonFlows.filter(c => c.regressionType !== 'NO_REGRESSION')
  ];
  if (regList.length > 0) {
    for (const r of regList) {
      const reasons = r.regressionReasons.slice(0, 2).join('; ');
      const label = r.attemptId || r.flowId;
      console.log(` - ${label}: ${r.regressionType} (${reasons})`);
    }
  }
  
  // Show improvements
  const improvementList = comparisons.filter(c => c.improvements && c.improvements.length > 0);
  if (improvementList.length > 0) {
    console.log('\n✅ Improvements detected:');
    for (const i of improvementList.slice(0, 5)) {
      const label = i.attemptId || 'unknown';
      const improvementText = i.improvements.slice(0, 2).join('; ');
      console.log(` + ${label}: ${improvementText}`);
    }
  }

  // Exit code reflects regression severity while preserving underlying run exit codes
  const currentExitCode = typeof current.exitCode === 'number' ? current.exitCode : 0;
  let exitCode = currentExitCode;
  if (overallRegressionVerdict === 'REGRESSION_FAILURE') {
    exitCode = Math.max(exitCode, 4);
  } else if (overallRegressionVerdict === 'REGRESSION_FRICTION') {
    exitCode = Math.max(exitCode, 3);
  }

  return {
    exitCode,
    runDir: current.runDir,
    reportJsonPath: jsonPath,
    reportHtmlPath: htmlPath,
    junitPath: junit || null,
    overallRegressionVerdict,
    comparisons,
    flowComparisons: comparisonFlows,
    baselineStatus: 'LOADED'
  };
}

module.exports = {
  saveBaseline,
  checkBaseline,
  buildBaselineSnapshot,
};

// Helpers: JUnit XML generation
function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generateJunitXml(report) {
  const flowCases = report.flowComparisons || [];
  const attemptCases = report.comparisons || [];
  const allCases = [...attemptCases, ...flowCases];
  const tests = allCases.length;
  const failures = allCases.filter(c => c.regressionType !== 'NO_REGRESSION').length;
  const props = `\n      <property name="overallRegressionVerdict" value="${xmlEscape(report.overallRegressionVerdict)}"/>\n      <property name="baselineVerdict" value="${xmlEscape(report.baselineSummary.overallVerdict)}"/>\n      <property name="currentVerdict" value="${xmlEscape(report.currentSummary.overallVerdict)}"/>`;
  const header = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="odavl-guardian-regression" tests="${tests}" failures="${failures}">\n  <properties>${props}\n  </properties>`;
  const cases = allCases.map(c => {
    const name = xmlEscape(c.attemptId || c.flowId);
    if (c.regressionType === 'NO_REGRESSION') {
      return `\n  <testcase name="${name}"/>`;
    }
    const msg = `${c.regressionType}: ${c.regressionReasons.join('; ')}`;
    return `\n  <testcase name="${name}">\n    <failure message="${xmlEscape(msg)}"/>\n  </testcase>`;
  }).join('');
  const footer = `\n</testsuite>\n`;
  return header + cases + footer;
}
