/**
 * VERAX Triage Engine (PHASE 5.4)
 *
 * Evidence-only incident triage from existing run artifacts.
 * Deterministic: identical inputs => identical outputs (except generatedAt).
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { DataError } from '../support/errors.js';
import { getTimeProvider } from '../support/time-provider.js';
import { normalizeTruthState, TRUTH_STATES } from '../../../verax/shared/truth-states.js';

/**
 * Generate triage report from run artifacts
 * @param {string} projectRoot
 * @param {string} runId
 * @returns {Object}
 */
export function generateTriage(projectRoot, runId) {
  const runDir = resolve(projectRoot, '.verax', 'runs', runId);

  if (!existsSync(runDir)) {
    throw new DataError(`Run directory not found: ${runDir}`);
  }

  const missingInputs = [];
  const summary = loadRequiredArtifact(runDir, 'summary.json');
  const findings = loadOptionalArtifact(runDir, 'findings.json', missingInputs);
  const traces = loadOptionalArtifact(runDir, 'traces.json', missingInputs);
  const _observe = loadOptionalArtifact(runDir, 'observe.json', missingInputs);
  const expectations = loadOptionalArtifact(runDir, 'expectations.json', missingInputs);
  const diagnostics = loadOptionalArtifact(runDir, 'diagnostics.json', missingInputs);
  const stability = loadOptionalArtifact(runDir, 'stability.json', missingInputs);

  const context = extractFailureContext({
    runId,
    summary,
    findings: Array.isArray(findings) ? findings : findings?.findings || [],
    traces: Array.isArray(traces) ? traces : [],
    expectations,
    diagnostics,
    stability,
    missingInputs
  });

  const actionPlan = buildActionPlan(context);
  const trust = classifyRunTrust(context);

  const timeProvider = getTimeProvider();

  return {
    meta: {
      runId,
      veraxVersion: summary.meta?.version || summary.meta?.veraxVersion || 'unknown',
      generatedAt: timeProvider.iso(),
      runCompletedAt: summary.meta?.timestamp || summary.completedAt || summary.startedAt || null,
    },
    status: context.status,
    phaseBreakdown: context.phaseBreakdown,
    scopeConstraints: context.scopeConstraints,
    coverage: context.coverage,
    stability: context.stability,
    evidenceGaps: context.evidenceGaps,
    missingInputs: context.missingInputs,
    actionPlan,
    trust
  };
}

function loadRequiredArtifact(runDir, filename) {
  const path = resolve(runDir, filename);
  if (!existsSync(path)) {
    throw new DataError(`Required artifact missing: ${path}`);
  }
  return parseJson(path, filename);
}

function loadOptionalArtifact(runDir, filename, missingInputs) {
  const path = resolve(runDir, filename);
  if (!existsSync(path)) {
    if (missingInputs) missingInputs.push(filename);
    return null;
  }
  return parseJson(path, filename);
}

function parseJson(path, label) {
  try {
    const content = String(readFileSync(path, 'utf-8'));
    return JSON.parse(content);
  } catch (error) {
    throw new DataError(`Failed to parse ${label}: ${error.message}`);
  }
}

function extractFailureContext({ runId, summary, findings, traces, expectations, diagnostics, stability, missingInputs }) {
  const evidenceGaps = [];

  if (missingInputs?.length) {
    for (const name of missingInputs) {
      evidenceGaps.push({ type: 'artifact', name, reason: 'missing optional artifact' });
    }
  }

  const truthState = normalizeTruthState(summary.status, TRUTH_STATES.INCOMPLETE);
  const analysisState = typeof summary.analysis?.state === 'string' ? summary.analysis.state : null;
  const analysisComplete = summary.analysis?.analysisComplete ?? (analysisState === 'ANALYSIS_COMPLETE');
  const notes = collectNotes(summary, diagnostics);

  const status = {
    truthState,
    analysisState,
    analysisComplete,
    exitCode: summary.meta?.exitCode ?? null,
    failures: extractFailures(summary, diagnostics),
    notes,
  };

  const phaseBreakdown = extractPhaseBreakdown(summary, traces, evidenceGaps);
  const scopeConstraints = extractScopeConstraints(summary);
  const coverage = extractCoverage({ summary, traces, findings, _expectations: expectations, evidenceGaps });
  const stabilityContext = extractStability(stability, evidenceGaps);

  return {
    meta: { runId },
    status,
    phaseBreakdown,
    scopeConstraints,
    coverage,
    stability: stabilityContext,
    evidenceGaps,
    missingInputs,
  };
}

function collectNotes(summary, diagnostics) {
  const notes = [];
  if (typeof summary.notes === 'string' && summary.notes.trim()) {
    notes.push(summary.notes.trim());
  }
  if (Array.isArray(summary.analysis?.notes)) {
    notes.push(...summary.analysis.notes.filter(Boolean));
  }
  if (Array.isArray(summary.integrity?.notes)) {
    notes.push(...summary.integrity.notes.filter(Boolean));
  }
  if (diagnostics?.notes && Array.isArray(diagnostics.notes)) {
    notes.push(...diagnostics.notes.filter(Boolean));
  }
  return Array.from(new Set(notes));
}

function extractFailures(summary, diagnostics) {
  const failures = [];
  if (summary.status === 'INCOMPLETE') {
    failures.push('run_incomplete');
  }
  if (diagnostics?.toolHealth?.status === 'FAILED') {
    failures.push('tool_health_failed');
  }
  if (diagnostics?.skips?.runtime?.reasons) {
    const reasons = Object.keys(diagnostics.skips.runtime.reasons);
    failures.push(...reasons.map((r) => `runtime_skip:${r}`));
  }
  return Array.from(new Set(failures));
}

function extractPhaseBreakdown(summary, traces, evidenceGaps) {
  const timeouts = summary.analysis?.timeouts || summary.analysis?.timings || summary.metrics || {};
  const learnMs = toNumber(timeouts.learnMs) ?? deriveLearn(timeouts);
  const observeMs = toNumber(timeouts.observeMs) ?? toNumber(timeouts.observe) ?? null;
  const detectMs = toNumber(timeouts.detectMs) ?? toNumber(timeouts.detect) ?? null;
  const totalMs = toNumber(timeouts.totalMs) ?? toNumber(timeouts.total) ?? null;

  const slowestInteractions = computeSlowestInteractions(traces, evidenceGaps);

  return {
    learnMs,
    observeMs,
    detectMs,
    totalMs,
    slowestInteractions
  };
}

function deriveLearn(timeouts) {
  const total = toNumber(timeouts.totalMs);
  const observe = toNumber(timeouts.observeMs);
  const detect = toNumber(timeouts.detectMs);
  if (total !== null && observe !== null && detect !== null) {
    return Math.max(0, total - observe - detect);
  }
  return null;
}

function computeSlowestInteractions(traces, evidenceGaps) {
  if (!Array.isArray(traces) || traces.length === 0) {
    return [];
  }

  const withDurations = traces
    .map((trace) => {
      const timing = trace.evidence?.timing || trace.timing || {};
      const start = timing.startedAt ? Date.parse(timing.startedAt) : null;
      const end = timing.endedAt ? Date.parse(timing.endedAt) : null;
      if (start === null || end === null || Number.isNaN(start) || Number.isNaN(end)) {
        return null;
      }
      const duration = end - start;
      if (!Number.isFinite(duration) || duration < 0) return null;
      return {
        expectationId: trace.expectationId || trace.id || trace.key || 'unknown',
        durationMs: duration,
        startedAt: timing.startedAt,
        endedAt: timing.endedAt,
      };
    })
    .filter(Boolean);

  if (withDurations.length === 0) {
    evidenceGaps.push({ type: 'timing', name: 'traces', reason: 'no valid interaction timings available' });
    return [];
  }

  return withDurations
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 3);
}

function extractScopeConstraints(summary) {
  const skipReasons = summary.analysis?.skipReasons || {};
  const crossOriginBlocked = hasPositive(skipReasons.EXTERNAL_URL_SKIPPED) || hasPositive(skipReasons.CROSS_ORIGIN_BLOCKED) || null;
  const authMode = summary.meta?.authMode || summary.authMode || null;
  const router = summary.meta?.router || null;
  const framework = summary.meta?.framework || null;

  return {
    readOnly: true,
    crossOriginBlocked,
    authMode,
    router,
    framework,
  };
}

function extractCoverage({ summary, traces, findings, _expectations, evidenceGaps }) {
  const analysis = summary.analysis || {};
  const discovered = toNumber(analysis.expectationsDiscovered) ?? toNumber(summary.digest?.expectationsTotal);
  const analyzed = toNumber(analysis.expectationsAnalyzed) ?? toNumber(summary.digest?.attempted);
  const skipped = toNumber(analysis.expectationsSkipped) ?? toNumber(summary.digest?.coverageGaps);

  const observationsRecorded = countObserved(traces, summary.digest?.observed);
  const findingsCount = Array.isArray(findings) ? findings.length : 0;

  if (discovered === null) {
    evidenceGaps.push({ type: 'coverage', name: 'expectationsDiscovered', reason: 'missing in summary.json' });
  }

  return {
    expectations: {
      discovered,
      analyzed,
      skipped,
    },
    observations: {
      recorded: observationsRecorded,
    },
    findings: {
      total: findingsCount,
    }
  };
}

function countObserved(traces, digestObserved) {
  if (typeof digestObserved === 'number') return digestObserved;
  if (!Array.isArray(traces)) return null;
  let observed = 0;
  for (const trace of traces) {
    if (trace.observed === true || trace.signals?.observed === true || trace.evidence?.observed === true) {
      observed += 1;
    }
  }
  return observed;
}

function extractStability(stability, evidenceGaps) {
  if (!stability) {
    return {
      classification: 'UNKNOWN',
      confidence: null,
      findingsSignature: null,
      diffs: null,
      reason: 'stability.json missing'
    };
  }

  const classification = stability.classification || stability.meta?.classification || 'UNKNOWN';
  const confidence = toNumber(stability.confidence) ?? toNumber(stability.meta?.confidence) ?? null;
  const findingsSignature = stability.findings?.signatureHash || null;
  const diffs = stability.findings?.differences || null;

  if (!findingsSignature) {
    evidenceGaps.push({ type: 'stability', name: 'findingsSignature', reason: 'missing signature hash' });
  }

  return {
    classification,
    confidence,
    findingsSignature,
    diffs,
  };
}

function buildActionPlan(context) {
  const steps = [];
  const { status, stability, coverage, evidenceGaps } = context;

  if (!status.analysisComplete || (status.state && status.state !== 'ANALYSIS_COMPLETE')) {
    steps.push({
      title: 'Restore analysis completeness',
      rationale: `Run state is ${status.state}; investigate summary notes and diagnostics`,
      evidence: ['summary.json', 'diagnostics.json']
    });
  }

  if (status.failures.length > 0) {
    steps.push({
      title: 'Review tool failures',
      rationale: `Tool reported failures: ${status.failures.join(', ')}`,
      evidence: ['summary.json', 'diagnostics.json']
    });
  }

  if (stability.classification === 'UNSTABLE') {
    steps.push({
      title: 'Stabilize run signals',
      rationale: 'Stability classification is UNSTABLE across evidence',
      evidence: ['stability.json']
    });
  }

  if (coverage.findings.total > 0) {
    steps.push({
      title: 'Explain top finding',
      rationale: 'Findings detected; prioritize explanation to unblock mitigation',
      evidence: ['findings.json', 'explain/<findingId>.json']
    });
  }

  if (evidenceGaps.length > 0) {
    steps.push({
      title: 'Close evidence gaps',
      rationale: evidenceGaps.map((g) => `${g.name}: ${g.reason}`).join('; '),
      evidence: evidenceGaps.map((g) => g.name)
    });
  }

  if (steps.length === 0) {
    steps.push({
      title: 'Document verified stability',
      rationale: 'No failures or gaps detected in artifacts',
      evidence: ['summary.json']
    });
  }

  return steps;
}

function classifyRunTrust(context) {
  const reasons = [];
  let level = 'TRUSTED';
  let confidence = 0.9;

  if (!context.status.analysisComplete || (context.status.state && context.status.state !== 'ANALYSIS_COMPLETE')) {
    level = 'UNTRUSTED';
    confidence = 0.35;
    reasons.push('analysis incomplete');
  }

  if (context.status.failures.length > 0) {
    level = 'UNTRUSTED';
    confidence = 0.35;
    reasons.push(...context.status.failures);
  }

  if (context.stability.classification === 'UNSTABLE') {
    level = 'UNTRUSTED';
    confidence = Math.min(confidence, context.stability.confidence ?? 0.5);
    reasons.push('stability unstable');
  } else if (context.stability.classification === 'MOSTLY_STABLE') {
    level = level === 'TRUSTED' ? 'QUESTIONABLE' : level;
    confidence = Math.min(confidence, context.stability.confidence ?? 0.6);
    reasons.push('stability mostly stable');
  } else if (context.stability.classification === 'UNKNOWN') {
    level = level === 'TRUSTED' ? 'QUESTIONABLE' : level;
    confidence = Math.min(confidence, 0.55);
    reasons.push('stability unknown');
  }

  return {
    level,
    confidence,
    reasons: Array.from(new Set(reasons)),
  };
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function hasPositive(value) {
  if (typeof value === 'number') return value > 0;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}
