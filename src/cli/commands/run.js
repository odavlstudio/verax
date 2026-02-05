/*
Command: verax run
Purpose: Execute a deterministic VERAX scan and write contract-bound artifacts.
Required: --url <url>
Optional: --src, --out, --json, --debug/--verbose, --auth-storage, --auth-cookie, --auth-header, --auth-mode, --retain-runs, --no-retention, --min-coverage, --ci-mode.
Outputs: Artifacts at <out>/runs/<scanId>/<runId>; exactly one RESULT/REASON/ACTION block (text or JSON) plus optional progress JSON when --json is set.
Exit Codes:
- 0  SUCCESS
- 20 FINDINGS
- 30 INCOMPLETE
- 50 INVARIANT_VIOLATION
- 64 USAGE_ERROR
Forbidden: interactive prompts; multiple RESULT/REASON/ACTION blocks; non-deterministic logs without --debug; accepting unsupported flags; silent exits without contract output.
*/

import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { generateRunId, generateScanId, generateUniqueRunId } from '../util/support/run-id.js';
import { getRunPaths, ensureRunDirectories } from '../util/support/paths.js';
import { atomicWriteJson, atomicWriteText } from '../util/support/atomic-write.js';
import { RunEventEmitter } from '../util/support/events.js';
import { applyRetention } from '../util/support/retention.js';
import { discoverProject } from '../util/config/project-discovery.js';
import { writeProjectJson } from '../util/support/project-writer.js';
import { extractExpectations } from '../util/observation/expectation-extractor.js';
import { writeLearnJson } from '../util/evidence/learn-writer.js';
import { checkExpectationAlignment } from '../util/observation/alignment-guard.js';
import { observeExpectations } from '../util/observation/observation-engine.js';
import { ensureRuntimeReady, formatRuntimeReadinessMessage } from '../util/observation/runtime-readiness.js';
import { writeObserveJson } from '../util/observation/observe-writer.js';
import { detectPhase } from '../phases/detect-phase.js';
import { writeFindingsJson } from '../util/evidence/findings-writer.js';
import { writeSummaryJson } from '../util/evidence/summary-writer.js';
import { computeRuntimeBudget, withTimeout } from '../util/observation/runtime-budget.js';
import { saveDigest } from '../util/evidence/digest-engine.js';
import { TimeoutManager } from '../util/timeout-manager.js';
import { IncompleteError, UsageError } from '../util/support/errors.js';
import { printSummary } from '../run/output-summary.js';
import { evaluateFrameworkSupport } from '../../verax/core/framework-support.js';
import { mapFailureReasons } from '../../verax/core/failures/failure-mode-matrix.js';
import { classifyRunTruth, buildTruthBlock, formatTruthAsText, summarizeCriticalSilences } from '../../verax/core/truth-classifier.js';
import { TRUTH_STATES } from '../../verax/shared/truth-states.js';
import { VERSION } from '../../version.js';
import { logV1RuntimeSeal, printV1RuntimeSummary } from '../../internal/future-gates/v1-runtime-seal.js';
import { loadEnterprisePolicy, isRedactionDisabled } from '../config/enterprise-policy.js';
import { createRunManifest } from '../util/support/run-manifest.js';
import {
  DEFAULT_SCOPE_LINE,
  RESULTS_INTERPRETATION,
  INCOMPLETE_SAFETY_LINE,
  POST_AUTH_DISCLAIMER_LINE,
} from '../config/pilot-messages.js';

/**
 * TIMEOUT COORDINATION DOCUMENTATION
 * 
 * Timeout handling is managed by TimeoutManager (see ../util/timeout-manager.js)
 * Three priority levels coordinate around run budget:
 * 
 * 1. GLOBAL_WATCHDOG (highest priority)
 *    - Terminates entire run via process.exit(0)
 *    - Never recoverable
 *    - Set once at run start
 * 
 * 2. PHASE_TIMEOUT (medium priority)
 *    - Learn/Observe/Detect phases wrapped with withTimeout()
 *    - Returns error to calling code
 *    - Run continues to next phase or finalizes
 * 
 * 3. INTERACTION_TIMEOUT (lowest priority)
 *    - Per-interaction timeout within phases
 *    - Managed by InteractionPlanner.isWithinBudget()
 *    - Attempt is recorded as 'interaction-timeout-exceeded'
 * 
 * INVARIANT: Each level is autonomous. Higher level preempts lower.
 * VALUES: Timeouts are never changed; only made explicit and documented.
 */

import { ARTIFACT_REGISTRY, getArtifactVersions } from '../../verax/core/artifacts/registry.js';
import { getTimeProvider } from '../util/support/time-provider.js';
import { writeCompletionSentinel, writeRunStarted, writeRunFinalized } from '../util/run-completion-sentinel.js';
import { validateRunDirectory, determineRunStatus, validationExitCode } from '../util/run-artifact-validation.js';
// WEEK 8: Decomposed modules
import { validateUrl, resolveAndValidateSrcPath } from '../run/validation-simple.js';
import { createTimeoutHandler } from '../run/timeout-handler.js';
import { handleRunError } from '../run/error-writer.js';
import { EXIT_CODES, buildOutcome, emitOutcome as _emitOutcome, outcomeFromError } from '../config/cli-contract.js';
import { resolveVeraxOutDir } from '../util/support/default-output-dir.js';

function getVersion() {
  return VERSION;
}

/**
 * Print a human-readable first-run summary for improved DX.
 * This block explains the run outcome in plain language without technical jargon.
 */
function printRunSummary({
  status,
  attempted,
  observed,
  expectationsTotal,
  confirmedTotal,
  incompleteReasons,
  coverageOk,
  minCoverage,
  isFirstRun,
  findings = [],
  paths,
}) {
  const lines = [];
  const coverageRatio = expectationsTotal > 0 ? attempted / expectationsTotal : 1;
  const coveragePct = Math.round(coverageRatio * 1000) / 10;
  const thresholdPct = Math.round((minCoverage ?? 0.9) * 1000) / 10;

  lines.push('VERAX Run Summary');
  lines.push(`• ${DEFAULT_SCOPE_LINE}`);
  lines.push(`• Coverage: ${attempted}/${expectationsTotal} actions attempted (${coveragePct}%). Threshold: ${thresholdPct}%.`);
  lines.push(`• Evidence: ${observed}/${attempted} actions produced evidence`);
  const confirmedLabel = confirmedTotal > 0
    ? `${confirmedTotal} confirmed finding${confirmedTotal === 1 ? '' : 's'}`
    : 'No confirmed findings';
  lines.push(`• Findings: ${confirmedLabel}`);

  const verdictMeaning = RESULTS_INTERPRETATION[status] || RESULTS_INTERPRETATION.INCOMPLETE;

  lines.push(`• Result: ${status} — ${verdictMeaning}`);

  if (status === 'INCOMPLETE') {
    const reasons = (incompleteReasons && incompleteReasons.length > 0)
      ? incompleteReasons.slice(0, 3).join(', ')
      : (!coverageOk ? 'coverage below threshold' : 'observation stopped early');
    lines.push(`• Safety: ${INCOMPLETE_SAFETY_LINE}`);
    lines.push(`• Why incomplete: ${reasons}`);
    lines.push('• Next: expand coverage or reduce scope, then rerun with the same inputs.');
  } else if (status === 'FINDINGS') {
    const topFindings = (findings || []).slice(0, 3);
    const label = topFindings.length > 0
      ? topFindings.map((f, idx) => f?.id || f?.findingId || `finding-${idx + 1}`).join(', ')
      : 'listed in findings.json';
    lines.push(`• Next: review findings.json and evidence in ${paths?.baseDir || '.verax/runs/latest'}`);
    lines.push(`• Top findings: ${label}`);
  } else {
    lines.push('• Next: keep this in CI and expand coverage for critical public flows.');
  }

  if (isFirstRun) {
    lines.push('• First run safety: partial coverage is marked INCOMPLETE and should not be treated as safe.');
  }

  lines.push(`• Artifacts: ${paths ? paths.baseDir : '.verax/runs/latest'}`);

  console.log(lines.join('\n'));
}

function printDryLearnSummary({ expectations, projectProfile, srcPath }) {
  const total = expectations.length;
  const { navigation, forms, validation, other } = categorizeExpectations(expectations);
  const lines = [];

  lines.push('VERAX Dry Learn (no browser actions executed)');
  lines.push(`• Source analyzed: ${projectProfile?.sourceRoot || srcPath}`);
  lines.push(`• Framework detected: ${projectProfile?.framework || 'unknown'}`);
  lines.push(`• Promises found: ${total} (navigation: ${navigation}, forms: ${forms}, validation: ${validation}, other: ${other})`);

  const examples = expectations.slice(0, 5).map((exp) => {
    const label = (exp?.promise?.kind || exp?.type || 'interaction').toString();
    const value = (exp?.promise?.value || exp?.selector || exp?.action || 'interaction').toString();
    const file = exp?.source?.file || 'unknown';
    const line = exp?.source?.line || 0;
    return `  - ${capitalize(label)} → ${value} (${file}:${line})`;
  });
  if (examples.length > 0) {
    lines.push('• Examples:');
    lines.push(...examples);
  }

  lines.push('• Next: run "verax run --url <url> --src <path>" to execute Observe/Detect.');

  console.log(lines.join('\n'));
}

function categorizeExpectations(expectations = []) {
  const counts = {
    navigation: 0,
    forms: 0,
    validation: 0,
    other: 0,
  };

  expectations.forEach((exp) => {
    const kind = (exp?.promise?.kind || '').toLowerCase();
    const type = (exp?.type || '').toLowerCase();
    const category = (exp?.category || '').toLowerCase();

    if (kind === 'navigate' || type === 'navigation') {
      counts.navigation += 1;
      return;
    }
    if (kind === 'submit' || category === 'form') {
      counts.forms += 1;
      return;
    }
    if (kind === 'validation' || kind === 'ui-feedback' || category === 'validation') {
      counts.validation += 1;
      return;
    }

    counts.other += 1;
  });

  return counts;
}

function printExpectationPreview({ expectations, sourceRoot, framework, explainExamples = false, isLimitedMode = false }) {
  const { navigation, forms, validation, other } = categorizeExpectations(expectations);
  const lines = [];

  lines.push('VERAX will analyze the following user-facing promises:');
  lines.push(`• Navigation: ${navigation}`);
  lines.push(`• Form submissions: ${forms}`);
  lines.push(`• Validation feedback: ${validation}`);
  lines.push(`• Other interactions: ${other}`);
  lines.push('');
  
  // BUGFIX: Don't claim "Source analyzed" when in LIMITED mode (no source detected)
  if (!isLimitedMode) {
    lines.push(`Source analyzed: ${sourceRoot}`);
  } else {
    lines.push(`Source: not available (LIMITED mode - runtime observation only)`);
  }
  lines.push(`Framework detected: ${framework || 'unknown'}`);

  console.log(lines.join('\n'));

  if (explainExamples && expectations.length > 0) {
    const previewLines = expectations.slice(0, 10).map((exp) => {
      const label = (exp?.promise?.kind || exp?.type || 'interaction').toString();
      const value = (exp?.promise?.value || exp?.selector || exp?.action || 'interaction').toString();
      const file = exp?.source?.file || 'unknown';
      const line = exp?.source?.line || 0;
      return `• ${capitalize(label)} → ${value} (${file}:${line})`;
    });
    console.log(['Example expectations:', ...previewLines].join('\n'));
  }
}

function capitalize(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ============================================================
// PHASE HELPER FUNCTIONS (Step B - Issue #19)
// ============================================================

/**
 * Discovery Phase: Detect project structure and emit initialization events
 */
async function runDiscoveryPhase(context) {
  const { srcPath, paths, events, url, runId, projectRoot, out } = context;
  
  // Discover project configuration
  let projectProfile;
  try {
    projectProfile = await discoverProject(srcPath);
  } catch (error) {
    projectProfile = {
      framework: 'unknown',
      router: null,
      sourceRoot: srcPath,
      packageManager: 'unknown',
      scripts: { dev: null, build: null, start: null },
      detectedAt: getTimeProvider().iso(),
    };
  }

  // Zero-config: LIMITED mode detection and warning
  if (context.isLimitedMode) {
    events.emit('run:warning', {
      event: 'run:warning',
      message: '⚠️ Running in LIMITED mode: No source code detected. Analysis limited to runtime observation only. Result will be INCOMPLETE.',
    });
  }

  // TECH: Framework surface contract — early warning + reason
  const frameworkSupport = evaluateFrameworkSupport(projectProfile.framework);
  if (frameworkSupport.status !== 'supported') {
    events.emit('run:warning', { event: 'run:warning', message: frameworkSupport.warning });
    context._unsupportedFramework = true;
    context._unsupportedFrameworkDetails = frameworkSupport;
  }
  
  // Emit project detection events
  events.emit('project:detected', {
    framework: projectProfile.framework,
    router: projectProfile.router,
    sourceRoot: projectProfile.sourceRoot,
    packageManager: projectProfile.packageManager,
  });
  
  // Emit phase events
  events.emit('phase:started', {
    phase: 'Detect Project',
    message: 'Detecting project structure...',
  });
  
  events.emit('phase:started', {
    phase: 'Resolve URL',
    message: `Using URL: ${url}`,
  });
  
  events.emit('phase:started', {
    phase: 'Initialize Run',
    message: 'Initializing run artifacts...',
  });
  
  // Write initial status
  const startedAt = getTimeProvider().iso();
  
  atomicWriteJson(paths.runStatusJson, {
    contractVersion: 1,
    artifactVersions: getArtifactVersions(),
    status: 'INCOMPLETE',
    lifecycle: 'RUNNING',
    scanId: paths.scanId,
    runId,
    startedAt,
  });
  
  // Write metadata
  atomicWriteJson(paths.runMetaJson, {
    contractVersion: ARTIFACT_REGISTRY.runMeta.contractVersion,
    veraxVersion: getVersion(),
    nodeVersion: process.version,
    platform: process.platform,
    cwd: projectRoot,
    command: 'run',
    args: { url, src: context.src, out },
    url,
    src: srcPath,
    scanId: paths.scanId,
    runId,
    startedAt,
    completedAt: null,
    error: null,
  });
  
  return { projectProfile, startedAt };
}

/**
 * Learn Phase: Extract expectations and compute runtime budget
 */
async function runLearnPhase(context) {
  const { projectProfile, events, json, finalizeOnTimeout, srcPath } = context;
  
  // Extract expectations first to compute budget
  events.emit('phase:started', {
    phase: 'Learn',
    message: 'Analyzing project structure...',
  });
  
  events.startHeartbeat('Learn', json);
  
  let expectations, skipped;
  try {
    // Extract expectations (quick operation, no timeout needed here)
    const result = await extractExpectations(projectProfile, srcPath || projectProfile.sourceRoot);
    expectations = result.expectations;
    skipped = result.skipped;
  } finally {
    events.stopHeartbeat();
  }
  
  // Compute runtime budget based on expectations count
  const budget = computeRuntimeBudget({
    expectationsCount: expectations.length,
    mode: 'run',
    framework: projectProfile.framework,
    fileCount: projectProfile.fileCount || expectations.length,
  });
  
  // Wrap Learn phase with timeout
  try {
    await withTimeout(
      budget.learnMaxMs,
      Promise.resolve(), // Learn phase already completed
      'Learn'
    );
  } catch (error) {
    if (error.message.includes('timeout')) {
      await finalizeOnTimeout(`Learn phase timeout: ${budget.learnMaxMs}ms`);
      throw new IncompleteError(`Learn phase timeout: ${budget.learnMaxMs}ms`, 'Increase learn budget or reduce scope');
    }
    throw error;
  }
  
  // Emit Learn phase completion event
  events.emit('phase:completed', {
    phase: 'Learn',
    message: 'Project analysis complete',
  });
  
  // V1 runtime seal (debug only)
  logV1RuntimeSeal('learn');
  
  return { expectations, skipped, budget };
}

/**
 * Observe Phase: Execute browser observation with timeout
 */
async function runObservePhase(context) {
  const {
    expectations,
    url,
    paths,
    events,
    json,
    budget,
    authConfig = {},
    bootstrapBrowser = false,
    runtimeNavDiscovery = false,
  } = context;
  
  // Observe phase with timeout
  events.emit('phase:started', {
    phase: 'Observe',
    message: 'Launching browser and observing expectations...',
  });
  
  events.startHeartbeat('Observe', json);
  
  let observeData = null;
  try {
    if (process.env.VERAX_DEBUG === '1') {
      // Lightweight entry breadcrumb for debugging only
      const authKeys = Object.keys(authConfig || {});
      events.emit('debug:observe:enter', {
        phase: 'Observe',
        message: 'Entering observation phase',
        url,
        expectationsCount: expectations?.length || 0,
        authKeys,
      });
    }
    
    // Phase 6.1: Runtime Readiness Detection + optional bootstrap
    if (expectations.length > 0) {
      const readinessResult = await ensureRuntimeReady({ bootstrapBrowser });
      if (!readinessResult.ready) {
        const reason = readinessResult.reason || 'browser_not_available';
        const message = readinessResult.message || formatRuntimeReadinessMessage(reason);
        events.emit('observe:error', {
          message: `Runtime readiness check failed: ${message}`,
        });
        // Return incomplete observation with explicit reason
        observeData = {
          observations: [],
          stats: { attempted: 0, observed: 0, notObserved: 0 },
          observedAt: getTimeProvider().iso(),
          stability: {
            retries: { attempted: 0, succeeded: 0, exhausted: 0 },
            incompleteReasons: [reason],
            incompleteInteractions: 0,
            flakeSignals: { sensorMissing: 0 },
          },
        };
        // Print actionable message to console for user
        if (!json) {
          console.log(`\n⚠️  ${formatRuntimeReadinessMessage(reason)}\n`);
          if (readinessResult.attemptedBootstrap && readinessResult.message) {
            console.log(`Bootstrap attempt message: ${readinessResult.message}`);
          }
        }
      } else {
        try {
          observeData = await withTimeout(
            budget.observeMaxMs,
            observeExpectations(
              expectations,
              url,
              paths.evidenceDir,
              (progress) => {
                events.emit(progress.event, progress);
              },
              {
                authConfig,
                runtimeNavigation: { enabled: runtimeNavDiscovery === true },
              }
            ),
            'Observe'
          );
        } catch (error) {
          if (error.message.includes('timeout')) {
            events.emit('observe:error', {
              message: `Observe phase timeout: ${budget.observeMaxMs}ms`,
            });
            observeData = {
              observations: [],
              stats: { attempted: 0, observed: 0, notObserved: 0 },
              observedAt: getTimeProvider().iso(),
            };
          } else {
            // Enrich error reporting in debug mode with full stack
            const payload = { message: error.message };
            if (process.env.VERAX_DEBUG === '1' && error && error.stack) {
              payload.stack = error.stack;
              try { console.error('[VERAX DEBUG] Observe crash stack:', error.stack); } catch (_err) { /* ignore */ }
            }
            events.emit('observe:error', payload);
            observeData = {
              observations: [],
              stats: { attempted: 0, observed: 0, notObserved: 0 },
              observedAt: getTimeProvider().iso(),
            };
          }
        }
      }
    } else {
      // No expectations to observe means source code was empty/static
      // This is expected behavior when there are no interactions to test
      observeData = {
        observations: [],
        stats: { attempted: 0, observed: 0, notObserved: 0 },
        observedAt: getTimeProvider().iso(),
      };
    }
  } finally {
    events.stopHeartbeat();
  }
  
  events.emit('phase:completed', {
    phase: 'Observe',
    message: 'Browser observation complete',
  });
  
  // V1 runtime seal (debug only)
  logV1RuntimeSeal('observe');
  
  return observeData;
}

/**
 * Detect Phase: Analyze findings and detect silent failures with timeout
 */
async function runDetectPhase(context) {
  const { expectations, skipped, observeData, projectRoot, events, json, budget, paths } = context;
  
  // Detect phase with timeout
  events.emit('phase:started', {
    phase: 'Detect',
    message: 'Analyzing findings and detecting silent failures...',
  });
  
  events.startHeartbeat('Detect', json);
  
  let detectData = null;
  try {
    const learnData = { expectations, skipped };
    detectData = await withTimeout(
      budget.detectMaxMs,
      detectPhase({
        learnData,
        observeData,
        projectRoot,
        events,
        evidenceDir: paths?.evidenceDir,
      }),
      'Detect'
    );
  } catch (error) {
    const timeout = error.message.includes('timeout');
    events.emit('detect:error', {
      message: timeout ? `Detect phase timeout: ${budget.detectMaxMs}ms` : error.message,
    });
    detectData = {
      findings: [],
      stats: { total: 0, silentFailures: 0, observed: 0, coverageGaps: 0, unproven: 0, informational: 0 },
      enforcement: timeout ? { timeoutMs: budget.detectMaxMs } : { error: error.message },
      detectedAt: getTimeProvider().iso(),
    };
  } finally {
    events.stopHeartbeat();
  }
  
  events.emit('phase:completed', {
    phase: 'Detect',
    message: 'Silent failure detection complete',
  });
    // V1 runtime seal (debug only)
  logV1RuntimeSeal('detect');
    return detectData;
}

/**
 * Artifact Write Phase: Write all artifacts and validate run directory
 */
async function runArtifactWritePhase(context) {
  const {
    paths,
    runId,
    startedAt,
    url,
    srcPath,
    projectRoot,
    out,
    src,
    observeData,
    detectData,
    expectations,
    skipped,
    projectProfile,
    events,
    json,
    verbose,
    retainRuns,
    noRetention,
    minCoverage,
    ciMode,
    enterprisePolicy,
    isFirstRun,
    budget,
    isLimitedMode, // Zero-config: LIMITED mode tracking
    sourceMode, // Zero-config: source detection mode
    hasAuthFlags, // SCOPE ENFORCEMENT: post-auth mode tracking
    runtimeNavDiscovery = false,
    alignmentPreflight = false,
  } = context;

  const debugLogs = Boolean(verbose);
  
  // Emit finalize phase
  events.emit('phase:started', {
    phase: 'Finalize Artifacts',
    message: 'Writing run results...',
  });
  
  events.stopHeartbeat();
  
  const completedAt = getTimeProvider().iso();
  
  // Determine initial run truth status from observation phase (may be downgraded later).
  // Truth vocabulary lock: SUCCESS | FINDINGS | INCOMPLETE only.
  let runStatus = observeData?.status === 'INCOMPLETE' ? 'INCOMPLETE' : 'SUCCESS';
  
  // Write completed status
  atomicWriteJson(paths.runStatusJson, {
    contractVersion: 1,
    artifactVersions: getArtifactVersions(),
    status: runStatus,
    lifecycle: 'FINALIZING',
    runId,
    scanId: paths.scanId,
    startedAt,
    completedAt,
  });
  
  // Update metadata with completion time
  atomicWriteJson(paths.runMetaJson, {
    contractVersion: ARTIFACT_REGISTRY.runMeta.contractVersion,
    veraxVersion: getVersion(),
    nodeVersion: process.version,
    platform: process.platform,
    cwd: projectRoot,
    command: 'run',
    args: { url, src, out },
    url,
    src: srcPath,
    scanId: paths.scanId,
    runId,
    startedAt,
    completedAt,
    error: null,
  });
  
  const runDurationMs = completedAt && startedAt ? (Date.parse(completedAt) - Date.parse(startedAt)) : 0;
  const metrics = {
    learnMs: observeData?.timings?.learnMs || 0,
    observeMs: observeData?.timings?.observeMs || observeData?.timings?.totalMs || 0,
    detectMs: detectData?.timings?.detectMs || detectData?.timings?.totalMs || 0,
    totalMs: runDurationMs > 0 ? runDurationMs : (budget?.ms || 0)
  };
  // CRITICAL FIX: Compute findingsCounts from actual findings array (single source of truth)
  const actualFindings = detectData?.findings || [];
  /** @type {{ HIGH: number; MEDIUM: number; LOW: number; UNKNOWN: number }} */
  const findingsCounts = {
    HIGH: actualFindings.filter(f => f.severity === 'HIGH').length,
    MEDIUM: actualFindings.filter(f => f.severity === 'MEDIUM').length,
    LOW: actualFindings.filter(f => f.severity === 'LOW').length,
    UNKNOWN: actualFindings.filter(f => f.severity === 'UNKNOWN').length,
  };
  
  const summaryData = {
    runId,
    scanId: paths.scanId,
    status: runStatus,
    startedAt,
    completedAt,
    command: 'run',
    url,
    veraxVersion: getVersion(),
    nodeVersion: process.version,
    platform: process.platform,
    cwd: projectRoot,
    notes:
      'Read-only by design (mutating HTTP methods are blocked). ' +
      'Advisory for covered public flows; may still trigger normal page activity (GET requests, client-side state changes). ' +
      'Structural determinism only: normalized artifacts are stable, but results may differ across environments or changing site state. ' +
      `Pilot defaults: runtime navigation discovery=${runtimeNavDiscovery ? 'on' : 'off'}, alignment preflight=${alignmentPreflight ? 'on' : 'off'}.`,
    runtimeNavigation: {
      enabled: runtimeNavDiscovery === true,
      discoveredCount: observeData?.runtime?.discoveredCount ?? 0,
      executedCount: observeData?.runtime?.executedCount ?? 0,
      maxTargets: observeData?.runtime?.maxTargets ?? (runtimeNavDiscovery ? 25 : 0),
      allowCrossOrigin: observeData?.runtime?.allowCrossOrigin ?? false,
    },
    metrics,
    findingsCounts,
    incompleteReasons: observeData?.stability?.incompleteReasons || [],
  };

  summaryData.reasons = mapFailureReasons(summaryData.incompleteReasons);
  if ((summaryData.incompleteReasons || []).length > 0) {
    runStatus = 'INCOMPLETE';
  }

  // TECH: propagate unsupported framework as explicit INCOMPLETE reason
  if (context._unsupportedFramework) {
    const set = new Set(summaryData.incompleteReasons || []);
    set.add('unsupported_framework');
    summaryData.incompleteReasons = Array.from(set);
    runStatus = 'INCOMPLETE';
  }
  
  const expectationsTotal = expectations.length;
  const attempted = observeData.stats?.attempted || 0;
  const completed = observeData.stats?.completed || observeData.stats?.observed || 0;
  const skippedExpectations = observeData.stats?.skipped || Math.max(0, expectationsTotal - completed);
  const coverageRatio = expectationsTotal > 0 ? (completed / expectationsTotal) : 1.0;
  if (expectationsTotal > 0 && coverageRatio < (minCoverage ?? 0.90)) {
    runStatus = 'INCOMPLETE';
  }

  const criticalSilenceSummary = summarizeCriticalSilences(observeData?.observations);
  if (criticalSilenceSummary.criticalSilenceCount > 0) {
    runStatus = 'INCOMPLETE';
  }
  const summaryStats = {
    expectationsTotal,
    attempted,
    observed: completed,
    silentFailures: detectData.stats?.silentFailures || 0,
    coverageGaps: detectData.stats?.coverageGaps || 0,
    unproven: detectData.stats?.unproven || 0,
    informational: detectData.stats?.informational || 0,
    ...metrics,
    ...findingsCounts,
  };

  // Deterministic digest built at a stable point for reuse in final CLI outcome
  const finalDigest = {
    expectationsTotal: Number(expectationsTotal || 0),
    attempted: Number(attempted || 0),
    observed: Number(completed || 0),
    silentFailures: Number(detectData?.stats?.silentFailures || 0),
    coverageGaps: Number(detectData?.stats?.coverageGaps || 0),
    unproven: Number(detectData?.stats?.unproven || 0),
    informational: Number(detectData?.stats?.informational || 0),
  };
  
  // Classify run truth for summary output
  const truthResult = classifyRunTruth(
    {
      expectationsTotal,
      attempted,
      observed: completed,
      silentFailures: summaryStats.silentFailures,
      coverageRatio,
      ...criticalSilenceSummary,
      hasInfraFailure: false,
      isIncomplete: runStatus === 'INCOMPLETE',
      incompleteReasons: summaryData.incompleteReasons || [],
    },
    { minCoverage: minCoverage ?? 0.90 }
  );

  // Ensure incompleteReasons are explicit and non-empty when INCOMPLETE
  if (truthResult.truthState === 'INCOMPLETE') {
    const reasons = new Set(summaryData.incompleteReasons);
    const coverageTooLow = expectationsTotal > 0 && coverageRatio < (minCoverage ?? 0.90);
    if (coverageTooLow) reasons.add('coverage_below_threshold');
    if (attempted < expectationsTotal) reasons.add('partial_attempts');
    if (observeData?.status === 'INCOMPLETE') reasons.add('observation_incomplete');
    if (criticalSilenceSummary.criticalSilenceCount > 0) reasons.add('critical_silence_detected');
    summaryData.incompleteReasons = Array.from(reasons);
    if (summaryData.incompleteReasons.length === 0) {
      summaryData.incompleteReasons = ['unknown_incompleteness'];
    }
    summaryData.incompleteReasons.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    summaryData.reasons = mapFailureReasons(summaryData.incompleteReasons);
  }

  // Build enriched truth block with coverageSummary for CLI and artifacts
  // Single source of truth for status
  summaryData.status = truthResult.truthState;
  
  // Write summary with stable digest and truth classification
  writeSummaryJson(paths.summaryJson, {
    ...summaryData,
      auth: observeData?.auth || null,
    coverage: {
      learn: { totalExpectations: expectationsTotal },
      observe: { 
        attempted, 
        completed, 
        skipped: skippedExpectations, 
        skippedReasons: (observeData?.stats?.skippedReasons || {}) 
      },
      coverageRatio,
      minCoverage: (minCoverage ?? 0.90),
    },
    sourceDetection: {
      mode: sourceMode, // 'provided' | 'auto-detected' | 'not-detected'
      path: srcPath,
      isLimited: isLimitedMode,
    },
    redactionStatus: {
      enabled: !isRedactionDisabled(enterprisePolicy),
      disabledExplicitly: isRedactionDisabled(enterprisePolicy),
    },
  }, summaryStats, truthResult);
  
  // Write detect results (or empty if detection failed)
  writeFindingsJson(paths.baseDir, detectData);
  
  // Write traces (include all events including heartbeats)
  const allEvents = events.getEvents();
  const tracesContent = allEvents
    .map(e => JSON.stringify(e))
    .join('\n') + '\n';
  atomicWriteText(paths.tracesJsonl, tracesContent);
  
  // Write project profile
  writeProjectJson(paths, projectProfile);
  
  // Write learn results
  writeLearnJson(paths, expectations, skipped);
  
  // Write observe results
  writeObserveJson(paths.baseDir, observeData);

  // Stage 6: Output Contract 2.0 — judgments.json and coverage.json
  try {
    const { writeJudgmentsJson } = await import('../util/evidence/judgments-writer.js');
    const { writeCoverageJson } = await import('../util/evidence/coverage-writer.js');
    writeJudgmentsJson(paths.baseDir, observeData);
    writeCoverageJson(paths.baseDir, observeData, (minCoverage ?? 0.90));
  } catch (e) {
    // Non-fatal: validated later
  }
  
  // H5: Write deterministic digest for reproducibility proof
  if (observeData && observeData.digest) {
    saveDigest(resolve(paths.baseDir, 'run.digest.json'), observeData.digest);
  }
  
  // Finalization attempted sentinel
  writeRunFinalized(paths.baseDir);
  
  // Run completion sentinel (authoritative "finalization completed" marker).
  // This must be written for ALL final truth states (SUCCESS/FINDINGS/INCOMPLETE) once all required
  // artifacts are present. Validation relies on it.
  writeCompletionSentinel(paths.baseDir);

  const validation = validateRunDirectory(paths.baseDir);
  const validatedStatus = determineRunStatus(validation, runStatus);
  
  if (validatedStatus !== runStatus) {
    runStatus = validatedStatus;
  }
  
  // CRITICAL FIX: Recompute truthResult after validation using actual findings count
  const totalConfirmedFindings = actualFindings.filter((f) => f?.status === 'CONFIRMED').length;
  const finalTruthResult = classifyRunTruth(
    {
      expectationsTotal,
      attempted,
      observed: completed,
      silentFailures: totalConfirmedFindings,
      coverageRatio,
      ...criticalSilenceSummary,
      hasInfraFailure: Boolean(validation && Array.isArray(validation.corruptedFiles) && validation.corruptedFiles.length > 0),
      isIncomplete: runStatus === 'INCOMPLETE' || validatedStatus === 'INCOMPLETE',
      incompleteReasons: summaryData.incompleteReasons || [],
    },
    { minCoverage: minCoverage ?? 0.90 }
  );
  
  // Ensure incompleteReasons are explicit when INCOMPLETE
  let finalIncompleteReasons = [];
  if (finalTruthResult.truthState === 'INCOMPLETE') {
    const reasons = new Set(summaryData.incompleteReasons);
    const coverageTooLow = expectationsTotal > 0 && coverageRatio < (minCoverage ?? 0.90);
    if (coverageTooLow) reasons.add('coverage_below_threshold');
    if (attempted < expectationsTotal) reasons.add('partial_attempts');
    if (observeData?.status === 'INCOMPLETE') reasons.add('observation_incomplete');
    if (criticalSilenceSummary.criticalSilenceCount > 0) reasons.add('critical_silence_detected');
    if (!validation.valid) reasons.add('artifact_validation_failed');
    finalIncompleteReasons = Array.from(reasons);
    if (finalIncompleteReasons.length === 0) {
      finalIncompleteReasons = ['unknown_incompleteness'];
    }
    finalIncompleteReasons.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  
  // CRITICAL: LIMITED mode ALWAYS results in INCOMPLETE (zero-config safety)
  if (isLimitedMode) {
    const limitedReasons = new Set(finalIncompleteReasons);
    limitedReasons.add('source_not_detected');
    limitedReasons.add('limited_runtime_only_mode');
    finalIncompleteReasons = Array.from(limitedReasons);
    
    // Override truth state
    finalTruthResult.truthState = 'INCOMPLETE';
    finalTruthResult.confidence = 'LOW';
    finalTruthResult.reason = 'Source code not detected';
    finalTruthResult.whatThisMeans =
      'VERAX could not detect matching source code, so the run is INCOMPLETE. ' +
      INCOMPLETE_SAFETY_LINE;
    finalTruthResult.recommendedAction =
      'Provide --src <path> pointing at your frontend source, then rerun.';
  }
  
  // SCOPE ENFORCEMENT: Post-auth mode ALWAYS results in INCOMPLETE (Vision.md contract)
  if (hasAuthFlags) {
    const postAuthReasons = new Set(finalIncompleteReasons);
    postAuthReasons.add('post_auth_experimental');
    postAuthReasons.add('out_of_scope_per_vision');
    finalIncompleteReasons = Array.from(postAuthReasons);
    
    // Override truth state
    finalTruthResult.truthState = 'INCOMPLETE';
    finalTruthResult.confidence = 'LOW';
    finalTruthResult.reason = 'Post-login flows are out of scope for this pilot';
    finalTruthResult.whatThisMeans =
      `${POST_AUTH_DISCLAIMER_LINE} ${INCOMPLETE_SAFETY_LINE}`;
    finalTruthResult.recommendedAction =
      'Remove auth flags and test public flows only.';
  }

  const finalReasons = mapFailureReasons(finalIncompleteReasons);
  if (finalReasons.length > 0) {
    summaryData.reasons = finalReasons;
  }
  
  // Build final truth block with updated incompleteReasons
  const finalTruthBlock = buildTruthBlock(finalTruthResult, {
    expectationsTotal,
    attempted,
    observed: completed,
    coverageRatio,
    threshold: Number(minCoverage ?? 0.90),
    unattemptedCount: Math.max(0, expectationsTotal - attempted),
    unattemptedBreakdown: (observeData?.stats?.skippedReasons || {}),
    incompleteReasons: finalIncompleteReasons,
  });
  
  // Write final consistent state to all artifacts
  // IMPORTANT: Always update run.status.json to reflect final truth state for artifact consistency
  if (!validation.valid || finalTruthResult.truthState !== truthResult.truthState) {
    const adjustedSummary = {
      ...summaryData,
      status: finalTruthResult.truthState,
      findingsCounts,
      incompleteReasons: finalIncompleteReasons,
      reasons: finalReasons,
      notes: finalTruthResult.truthState === 'INCOMPLETE'
        ? `Artifact validation failed; run marked incomplete. ${summaryData.notes}`
        : summaryData.notes,
      redactionStatus: {
        enabled: !isRedactionDisabled(enterprisePolicy),
        disabledExplicitly: isRedactionDisabled(enterprisePolicy),
      },
    };
    writeSummaryJson(paths.summaryJson, adjustedSummary, summaryStats, finalTruthResult);
  }
  
  // Ensure run.status.json always matches the final truth state from summary
  atomicWriteJson(paths.runStatusJson, {
    contractVersion: 1,
    artifactVersions: getArtifactVersions(),
    status: finalTruthResult.truthState,
    lifecycle: 'FINAL',
    scanId: paths.scanId,
    runId,
    startedAt,
    completedAt,
  });
  
  // Write run manifest for audit trail (GATE ENTERPRISE)
  try {
    const manifest = createRunManifest({
      runId,
      scanId: paths.scanId,
      config: {
        url,
        src,
        out,
        minCoverage: enterprisePolicy.coverage.minCoverage,
        ciMode,
      },
      policy: {
        retention: enterprisePolicy.retention,
        redaction: enterprisePolicy.redaction,
        coverage: enterprisePolicy.coverage,
        frameworks: enterprisePolicy.frameworks,
      },
      redactionDisabled: isRedactionDisabled(enterprisePolicy),
    });
    atomicWriteJson(paths.runManifestJson, manifest);
  } catch (err) {
    if (debugLogs) {
      console.log(`[WARN] Failed to write run manifest: ${err.message}`);
    }
  }
  
  events.emit('phase:completed', {
    phase: 'Finalize Artifacts',
    message: 'Run artifacts written',
  });
  
  // Emit final summary event
  if (json) {
    events.emit('run:complete', {
      runId,
      url,
      command: 'run',
      findingsCounts,
      metrics,
      digest: {
        expectationsTotal: expectations.length,
        attempted: observeData.stats?.attempted || 0,
        observed: observeData.stats?.observed || 0,
        silentFailures: detectData.stats?.silentFailures || 0,
        coverageGaps: detectData.stats?.coverageGaps || 0,
        unproven: detectData.stats?.unproven || 0,
        informational: detectData.stats?.informational || 0,
      }
    });
  } else {
    if (debugLogs) {
      // Only print human-readable summaries when debugging to preserve single RESULT/REASON/ACTION output.
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, finalTruthResult.truthState);
    }
    try {
      const { writeHumanSummaryMarkdown } = await import('../util/evidence/human-summary-writer.js');
      const summaryContent = JSON.parse(readFileSync(paths.summaryJson, 'utf-8').toString());
      const coverageContent = existsSync(paths.coverageJson) ? JSON.parse(readFileSync(paths.coverageJson, 'utf-8').toString()) : null;
      const judgmentsContent = existsSync(paths.judgmentsJson) ? JSON.parse(readFileSync(paths.judgmentsJson, 'utf-8').toString()) : null;
      writeHumanSummaryMarkdown(paths.baseDir, {
        summaryData: summaryContent,
        coverage: coverageContent,
        judgments: judgmentsContent,
        productionSeal: summaryContent?.productionSeal || null,
      });
    } catch {
      // ignore
    }
  }
  
  // Determine exit code strictly from final truth (single source)
  /** @type {number} */ let exitCode = validationExitCode(validation); // official contract codes only
  if (exitCode === 0) {
    if (finalTruthResult.truthState === 'SUCCESS') {
      exitCode = EXIT_CODES.SUCCESS;
    } else if (finalTruthResult.truthState === 'FINDINGS') {
      exitCode = EXIT_CODES.FINDINGS;
    } else {
      exitCode = EXIT_CODES.INCOMPLETE;
    }
  }

  // Only write completion sentinel if run is complete or findings
  if (exitCode === 0 || exitCode === 20) {
    writeCompletionSentinel(paths.baseDir);
  }
  
  // Apply retention policy to runs directory (safety: always pass activeRunId)
  if (!noRetention) {
    const runsDir = resolve(projectRoot, out, 'runs', paths.scanId);
    applyRetention({
      runsDir,
      retainCount: retainRuns,
      disableRetention: false,
      activeRunId: runId,
      verbose: verbose && !json,
    });
  }
  
  return { runStatus, exitCode, validation, completedAt, metrics, findingsCounts, digest: finalDigest, truth: finalTruthBlock };
}

// ============================================================
// MAIN COMMAND FUNCTION
// ============================================================

/**
 * `verax run` command
 * Strict, non-interactive CLI mode with explicit flags
 * WEEK 8: Decomposed into focused modules
 * Step B (Issue #19): Phases extracted into explicit functions
 */
export async function runCommand(options) {
  const {
    url,
    src = '.',
    out: outArg,
    json = false,
    verbose = false,
    debug = false,
    runtimeNavDiscovery = false,
    alignmentPreflight = false,
    retainRuns = 10,
    noRetention = false,
    minCoverage = 0.90,
    ciMode = 'balanced',
    bootstrapBrowser = false,
    authConfig = {},
    isFirstRun = false,
    explainExpectations = false,
    dryLearn = false,
    sourceMode = 'provided', // 'provided' | 'auto-detected' | 'not-detected'
    forcePostAuth: _forcePostAuth = false, // SCOPE ENFORCEMENT: post-auth acknowledgement
    hasAuthFlags = false, // SCOPE ENFORCEMENT: auth flags provided
  } = options;

  const debugLogs = Boolean(debug || verbose);

  const mergedAuthConfig = Object.keys(authConfig || {}).length > 0 ? authConfig : {
    authStorage: options.authStorage,
    authStorageState: options.authStorageState,
    authCookies: options.authCookies,
    authHeaders: options.authHeaders,
    authMode: options.authMode || 'auto',
  };
  
  validateUrl(url);
  // If source was explicitly provided via --src flag, it MUST exist (no allowMissing)
  // If source was auto-detected or not-detected, allow missing (limited mode)
  const allowMissing = sourceMode !== 'provided';
  const { projectRoot, srcPath, missing } = resolveAndValidateSrcPath(src, allowMissing);
  const out = resolveVeraxOutDir(projectRoot, outArg);
  const isLimitedMode = sourceMode === 'not-detected' || missing;
  
  // Load enterprise policy (GATE ENTERPRISE)
  let enterprisePolicy;
  try {
    enterprisePolicy = loadEnterprisePolicy({
      retainRuns: options.retainRuns,
      disableRetention: options.noRetention,
      minCoverage: options.minCoverage,
      disableRedaction: options.noRedaction,
      policyFile: options.policyFile,
    });
  } catch (err) {
    throw new UsageError(`Enterprise policy validation failed: ${err.message}`);
  }
  
  // Validate framework restrictions from policy
  if (enterprisePolicy.frameworks) {
    const frameworkList = enterprisePolicy.frameworks.allowlist || [];
    const denylist = enterprisePolicy.frameworks.denylist || [];
    // Framework validation will happen during detection phase
    if (debugLogs) {
      if (frameworkList && frameworkList.length > 0) {
        console.log(`[POLICY] Framework allowlist: ${frameworkList.join(', ')}`);
      }
      if (denylist && denylist.length > 0) {
        console.log(`[POLICY] Framework denylist: ${denylist.join(', ')}`);
      }
    }
  }
  
  // Warn if redaction is explicitly disabled
  if (isRedactionDisabled(enterprisePolicy)) {
    if (debugLogs && !json) {
      const warningMsg =
        'WARNING: Redaction is explicitly disabled. Evidence artifacts may contain sensitive data.\n' +
        'Review artifacts before sharing. Keep redaction enabled by default.';
      console.error(warningMsg);
    }
  }
  
  const events = new RunEventEmitter();
  
  if (json) {
    events.on('*', (event) => {
      console.log(JSON.stringify(event));
    });
  } else if (debugLogs) {
    events.on('*', (event) => {
      console.log(`[${event.type}] ${event.message || ''}`);
    });
  }
  
  let runId = null;
  let scanId = null;
  let paths = null;
  let startedAt = null;
  let watchdogTimer = null;
  let budget = null;
  
  const state = {
    runId: null,
    paths: null,
    startedAt: null,
    projectRoot,
    srcPath,
    url,
    src,
    out,
    timedOut: false,
    timeoutOutcome: null,
    bootstrapBrowser,
    isLimitedMode, // Zero-config: track LIMITED mode
    sourceMode, // Zero-config: track source detection mode
  };
  
  const finalizeOnTimeout = createTimeoutHandler(getVersion, state, events);
  
  try {
    scanId = generateScanId({ url, srcPath, config: { projectRoot, ciMode, minCoverage } });
    runId = process.env.VERAX_DETERMINISTIC_MODE === '1'
      ? generateRunId(url)
      : generateUniqueRunId();

    paths = getRunPaths(projectRoot, out, scanId, runId);
    ensureRunDirectories(paths);
    atomicWriteJson(paths.latestPointerJson, { runId, timestamp: getTimeProvider().iso(), baseDir: paths.baseDir });
    writeRunStarted(paths.baseDir);
    
    state.runId = runId;
    state.paths = paths;
    
    const discoveryResult = await runDiscoveryPhase({
      srcPath,
      paths,
      events,
      verbose: debugLogs,
      json,
      url,
      runId,
      projectRoot,
      out,
      src,
    });
    const { projectProfile, startedAt: phaseStartedAt } = discoveryResult;
    startedAt = phaseStartedAt;
    state.startedAt = startedAt;
    
    const learnResult = await runLearnPhase({
      projectProfile,
      events,
      json,
      finalizeOnTimeout,
      srcPath,
    });
    const { expectations, skipped, budget: phaseBudget } = learnResult;
    budget = phaseBudget;

    if (!json) {
      printExpectationPreview({
        expectations,
        sourceRoot: projectProfile.sourceRoot || srcPath,
        framework: projectProfile.framework,
        explainExamples: explainExpectations,
        isLimitedMode, // BUGFIX: pass LIMITED mode flag to prevent misleading "Source analyzed" message
      });
    }

    if (expectations.length === 0) {
      throw new UsageError('No observable user-facing promises were found in the provided source.\nVERAX requires frontend code with navigation, forms, or interactive UI.');
    }
    // PILOT-SAFE DEFAULT: Alignment preflight is opt-in because it launches an
    // additional browser and may navigate outside local network constraints.
    if (alignmentPreflight && !json && !process.env.VERAX_TEST_MODE) {
      try {
        const alignmentResult = await checkExpectationAlignment(expectations, url);
        if (!alignmentResult.aligned) {
          throw new UsageError(
            'The provided source code does not match the target URL.\n' +
            'None of the extracted user-facing promises appear on the page.\n' +
            'Verify that --src corresponds to the deployed site at --url.'
          );
        }
      } catch (alignmentError) {
        // Re-throw UsageError or wrap other errors
        if (alignmentError instanceof UsageError) {
          throw alignmentError;
        }
        throw new UsageError(`Alignment check failed: ${alignmentError.message}`);
      }
    }
    
    if (dryLearn) {
      printDryLearnSummary({ expectations, projectProfile, srcPath });
      const outcome = buildOutcome({
        command: 'run',
        exitCode: EXIT_CODES.SUCCESS,
        reason: 'Learn phase completed; observe/detect skipped (--dry-learn)',
        action: 'Run verax run without --dry-learn to exercise browser observation',
      });
      return { runId, paths, success: true, exitCode: EXIT_CODES.SUCCESS, outcome };
    }

    const timeoutManager = new TimeoutManager(budget.totalMaxMs);
    timeoutManager.recordPhaseTimeout('learn', budget.learnMaxMs);
    timeoutManager.recordPhaseTimeout('observe', budget.observeMaxMs);
    timeoutManager.recordPhaseTimeout('detect', budget.detectMaxMs);
    
    timeoutManager.setGlobalWatchdog(async () => {
      await finalizeOnTimeout(`Global timeout exceeded: ${budget.totalMaxMs}ms`);
      state.timedOut = true;
      state.timeoutOutcome = buildOutcome({
        command: 'run',
        exitCode: EXIT_CODES.INCOMPLETE,
        reason: `Global timeout exceeded: ${budget.totalMaxMs}ms`,
        action: 'Increase budget or reduce scope',
      });
    });
    watchdogTimer = timeoutManager.globalWatchdog;
    
    const observeData = await runObservePhase({
      expectations,
      url,
      paths,
      events,
      json,
      budget,
      authConfig: mergedAuthConfig,
      bootstrapBrowser: state.bootstrapBrowser,
      runtimeNavDiscovery,
    });
    
    const detectData = await runDetectPhase({
      expectations,
      skipped,
      observeData,
      projectRoot,
      events,
      json,
      budget,
    });
    
    timeoutManager.clearGlobalWatchdog();

    if (state.timedOut && state.timeoutOutcome) {
      return { runId, paths, success: false, exitCode: state.timeoutOutcome.exitCode, outcome: state.timeoutOutcome };
    }
    
    const artifactResult = await runArtifactWritePhase({
      paths,
      runId,
      startedAt,
      url,
      srcPath,
      projectRoot,
      out,
      src,
      observeData,
      detectData,
      expectations,
      skipped,
      projectProfile,
      events,
      json,
      verbose: debugLogs,
      retainRuns,
      noRetention,
      budget,
      minCoverage,
      ciMode,
      enterprisePolicy,
      isFirstRun,
      isLimitedMode, // Zero-config: pass LIMITED mode flag
      sourceMode, // Zero-config: pass source detection mode
      hasAuthFlags, // SCOPE ENFORCEMENT: pass post-auth flag
      runtimeNavDiscovery,
      alignmentPreflight,
    });
    const { exitCode: computedExitCode, validation, completedAt, metrics, findingsCounts, digest, truth } = artifactResult;

    const evidenceViolation = Boolean(validation && !validation.valid && validation.corruptedFiles && validation.corruptedFiles.length > 0);
    const incompleteArtifacts = Boolean(validation && !validation.valid && !evidenceViolation);
    const expectationsTotal = expectations.length;
    const completed = observeData.stats?.completed || observeData.stats?.observed || 0;
    const coverageRatio = expectationsTotal > 0 ? (completed / expectationsTotal) : 1.0;
    const coverageOk = !(expectationsTotal > 0 && coverageRatio < (minCoverage ?? 0.90));
    const hasConfirmed = Number(detectData?.stats?.byStatus?.CONFIRMED || 0) > 0;
    const hasSuspected = Number(detectData?.stats?.byStatus?.SUSPECTED || 0) > 0;
    const confirmedTotal = Number(detectData?.stats?.byStatus?.CONFIRMED || 0);

    /** @type {number} */ let exitCode = computedExitCode ?? EXIT_CODES.SUCCESS;
    let reason = 'Run completed with no actionable findings';
    let action = `Review artifacts at ${paths.baseDir}`;

    // First-run context messages
    const firstRunContext = isFirstRun ? ' This is your first VERAX run—defaults were relaxed to help you get started.' : '';

    if (evidenceViolation) {
      exitCode = EXIT_CODES.INVARIANT_VIOLATION;
      reason = 'Artifacts failed integrity validation';
      action = `Repair or regenerate artifacts at ${paths.baseDir}`;
    } else {
      const isIncomplete = incompleteArtifacts || exitCode === EXIT_CODES.INCOMPLETE || !coverageOk || observeData?.status === 'INCOMPLETE';
      
      // CRITICAL FIX: Check for confirmed findings FIRST (FINDINGS takes precedence over INCOMPLETE)
      // This ensures we report actual bugs even if coverage is low
      // ciMode contract implementation:
      //   balanced: findings exit 20, incomplete exits 30 (default)
      //   strict: both findings and incomplete exit 20
      // REMOVED: advisory mode (violated Vision.md contract - SUCCESS must never include findings)
      if (hasConfirmed) {
        exitCode = EXIT_CODES.FINDINGS;
        reason = `Confirmed silent user-facing failures detected (total ${confirmedTotal})${firstRunContext}`;
        action = `Address findings and rerun. Summary: ${paths.summaryJson}`;
      } else if (isIncomplete && isFirstRun) {
        // STAGE 7.1: Guard coverage failures on first run
        // Invariant violations (50) remain fatal; first runs report INCOMPLETE for coverage/observation gaps
        exitCode = EXIT_CODES.INCOMPLETE;
        reason = truth?.reason || `Run incomplete: observation incomplete`;
        action = `For stricter validation, rerun with: verax run ${url} --min-coverage 0.90 --ci-mode balanced`;
      } else if (isIncomplete) {
        if (ciMode === 'strict') {
          exitCode = EXIT_CODES.FINDINGS;
          reason = truth?.reason || `Run incomplete: observation incomplete (strict mode treats as failure)`;
          action = `Increase coverage or fix issues. Summary: ${paths.summaryJson}`;
        } else {
          exitCode = EXIT_CODES.INCOMPLETE;
          reason = truth?.reason || `Run incomplete: observation incomplete`;
          action = `Increase coverage or rerun scan in ${paths.baseDir}`;
        }
      } else if (hasSuspected) {
        exitCode = EXIT_CODES.INCOMPLETE;
        reason = `Suspected silent user-facing failures detected${firstRunContext}`;
        action = `Review findings and confirm. Summary: ${paths.summaryJson}`;
      } else {
        exitCode = EXIT_CODES.SUCCESS;
        reason = `Run complete: no silent user-facing failures detected in covered public flows${firstRunContext}`;
        action = isFirstRun 
          ? `Next steps: Review artifacts at ${paths.baseDir}. Expand coverage for critical flows and rerun when site state or environment changes.`
          : `Proceed. Summary: ${paths.summaryJson}`;
      }
    }

    const outcome = buildOutcome({
      command: 'run',
      exitCode,
      reason,
      action,
      truth: truth || null,
      digest,
      runId,
      url,
      isFirstRun,
    });

    // V1 runtime seal summary (debug only)
    printV1RuntimeSummary();

    // Print run summary block (human-readable DX improvement)
    if (!json) {
      printRunSummary({
        status: truth?.truthState || TRUTH_STATES.INCOMPLETE,
        attempted: observeData.stats?.attempted || 0,
        observed: observeData.stats?.observed || 0,
        expectationsTotal,
        confirmedTotal,
        incompleteReasons: truth?.incompleteReasons || [],
        coverageOk,
        minCoverage,
        isFirstRun,
        findings: detectData?.findings || [],
        paths,
      });
      
      // Contract requirement: Print transparency message for INCOMPLETE runs
      // Must include exact phrase "should NOT be treated as safe"
      if (truth && truth.truthState === 'INCOMPLETE') {
        console.log('\n' + formatTruthAsText(truth));
      }
    }

    return { runId, paths, success: exitCode === EXIT_CODES.SUCCESS, exitCode, outcome, validation, completedAt, metrics, findingsCounts };
  } catch (error) {
    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
    
    events.stopHeartbeat();
    await handleRunError(error, state, events, getVersion);
    const outcome = outcomeFromError(error, { command: 'run' });
    return { runId: state.runId, paths: state.paths, success: false, exitCode: outcome.exitCode, outcome };
  }
}
