import { relative, resolve } from 'path';
import { atomicWriteJson } from './atomic-write.js';
import { findingIdFromExpectationId } from './idgen.js';

export const DECISION_OUTCOME = {
  CLEAN: 'CLEAN',
  FINDINGS: 'FINDINGS',
  INCOMPLETE: 'INCOMPLETE',
  INVALID_INPUT: 'INVALID_INPUT',
  TOOL_ERROR: 'TOOL_ERROR'
};

const STATUS_PRIORITY = {
  CONFIRMED: 3,
  SUSPECTED: 2,
  OBSERVED: 1
};

const SEVERITY_PRIORITY = {
  CRITICAL: 3,
  HIGH: 2,
  MEDIUM: 1,
  LOW: 0
};

function normalizeCounts(rawCounts = {}) {
  return {
    expectationsTotal: Number(rawCounts.expectationsTotal) || 0,
    attempted: Number(rawCounts.attempted) || 0,
    observed: Number(rawCounts.observed) || 0,
    silentFailures: Number(rawCounts.silentFailures) || 0,
    coverageGaps: Number(rawCounts.coverageGaps) || 0,
    unproven: Number(rawCounts.unproven) || 0,
    informational: Number(rawCounts.informational) || 0
  };
}

function outcomeFromExitCode(exitCode) {
  switch (exitCode) {
    case 0:
      return DECISION_OUTCOME.CLEAN;
    case 1:
      return DECISION_OUTCOME.FINDINGS;
    case 66:
      return DECISION_OUTCOME.INCOMPLETE;
    case 64:
    case 65:
      return DECISION_OUTCOME.INVALID_INPUT;
    case 2:
    default:
      return DECISION_OUTCOME.TOOL_ERROR;
  }
}

function selectActions(outcome) {
  if (outcome === DECISION_OUTCOME.CLEAN) {
    return [
      'Run completed with no silent failures recorded.',
      'Counts captured in decision.json for traceability.',
      'Re-run after code changes to confirm stability.'
    ];
  }
  if (outcome === DECISION_OUTCOME.FINDINGS) {
    return [
      'Review decision.json then findings.json for details.',
      'Address highest status and severity items first.',
      'Re-run after fixes to confirm resolution.'
    ];
  }
  if (outcome === DECISION_OUTCOME.INCOMPLETE) {
    return [
      'Run marked incomplete; results are not final.',
      'Check environment or doctor output for blockers.',
      'Re-run with the same inputs after resolving issues.'
    ];
  }
  if (outcome === DECISION_OUTCOME.INVALID_INPUT) {
    return [
      'Run stopped due to invalid input or CLI usage.',
      'Correct the arguments (url/src/out) and retry.',
      'Use verax doctor if setup issues persist.'
    ];
  }
  return [
    'Tool error occurred during run.',
    'Inspect run.status.json, logs, or stack trace.',
    'Re-run after resolving the underlying error.'
  ];
}

function normalizeRunPath(runDir, outDir, runId) {
  if (runDir && outDir) {
    const rel = relative(outDir, runDir).split('\\').join('/');
    return rel || null;
  }
  if (runId) {
    return `runs/${runId}`;
  }
  return null;
}

function statusScore(status) {
  if (!status) return 0;
  const normalized = String(status).toUpperCase();
  return STATUS_PRIORITY[normalized] ?? 0;
}

function severityScore(severity) {
  if (!severity) return -1;
  const normalized = String(severity).toUpperCase();
  return SEVERITY_PRIORITY[normalized] ?? -1;
}

function normalizeConfidence(confidence) {
  if (typeof confidence === 'number' && Number.isFinite(confidence)) {
    return confidence;
  }
  const parsed = Number(confidence);
  return Number.isFinite(parsed) ? parsed : -1;
}

function normalizeTopFindings(findings = []) {
  if (!Array.isArray(findings) || findings.length === 0) {
    return [];
  }

  const normalized = findings.map((finding, index) => {
    const derivedId = finding?.findingId || (finding?.id ? findingIdFromExpectationId(finding.id) : null) || `finding_${index}`;
    const status = finding?.status || finding?.classification || 'UNKNOWN';
    const severity = finding?.severity || finding?.impact || 'UNKNOWN';
    const confidence = normalizeConfidence(finding?.confidence);
    const type = finding?.type || finding?.promise?.kind || 'unknown';
    const shortTitle = finding?.shortTitle
      || finding?.title
      || finding?.description
      || finding?.reason
      || finding?.promise?.value
      || type
      || derivedId;
    const evidenceRefs = Array.isArray(finding?.evidence)
      ? finding.evidence
          .map((item) => (item && item.path ? item.path : null))
          .filter(Boolean)
      : [];

    return {
      findingId: derivedId,
      type,
      status,
      severity,
      confidence,
      shortTitle,
      evidenceRefs,
      _score: {
        status: statusScore(status),
        severity: severityScore(severity),
        confidence,
        stableId: derivedId
      }
    };
  });

  normalized.sort((a, b) => {
    if (a._score.status !== b._score.status) {
      return b._score.status - a._score.status;
    }
    if (a._score.severity !== b._score.severity) {
      return b._score.severity - a._score.severity;
    }
    if (a._score.confidence !== b._score.confidence) {
      return b._score.confidence - a._score.confidence;
    }
    return String(a._score.stableId).localeCompare(String(b._score.stableId));
  });

  return normalized.slice(0, 5).map((item) => ({
    findingId: item.findingId,
    type: item.type,
    status: item.status,
    severity: item.severity,
    confidence: item.confidence,
    shortTitle: item.shortTitle,
    evidenceRefs: item.evidenceRefs
  }));
}

export function createDecisionSnapshot(params) {
  const counts = normalizeCounts(params?.counts);
  const exitCode = typeof params?.exitCode === 'number' ? params.exitCode : null;
  const outcome = outcomeFromExitCode(exitCode);
  const runDir = params?.runDir || null;
  const outDir = params?.outDir || null;
  const runId = params?.runId || null;

  return {
    outcome,
    exitCode,
    runId,
    runPath: normalizeRunPath(runDir, outDir, runId),
    counts,
    topFindings: normalizeTopFindings(params?.findings || []),
    actions: selectActions(outcome)
  };
}

export function writeDecisionSnapshot(params) {
  const targetDir = params?.runDir || resolve(params?.outDir || '.verax', 'runs', params?.runId || 'unknown');
  const targetPath = resolve(targetDir, 'decision.json');
  const snapshot = createDecisionSnapshot({ ...params, runDir: targetDir });
  atomicWriteJson(targetPath, snapshot);
  return { path: targetPath, snapshot };
}








