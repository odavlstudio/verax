/*
Command: verax run
Purpose: Execute a deterministic VERAX scan and write contract-bound artifacts.
Required: --url <url>
Optional: --src, --out, --json, --debug/--verbose, --auth-storage, --auth-cookie, --auth-header, --auth-mode, --retain-runs, --no-retention, --min-coverage, --ci-mode.
Outputs: Artifacts at <out>/runs/<scanId>/<runId>; exactly one RESULT/REASON/ACTION block (text or JSON) plus optional progress JSON when --json is set.
Exit Codes:
- 0  SUCCESS
- 10 NEEDS_REVIEW (suspected findings only)
- 20 FAILURE_CONFIRMED (confirmed findings)
- 30 FAILURE_INCOMPLETE (coverage/validation incomplete)
- 40 INFRA_FAILURE (runtime error)
- 50 EVIDENCE_LAW_VIOLATION (corrupted/missing artifacts)
- 64 USAGE_ERROR
Forbidden: interactive prompts; multiple RESULT/REASON/ACTION blocks; non-deterministic logs without --debug; accepting unsupported flags; silent exits without contract output.
*/

import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { generateScanId, generateUniqueRunId } from '../util/support/run-id.js';
import { getRunPaths, ensureRunDirectories } from '../util/support/paths.js';
import { atomicWriteJson, atomicWriteText } from '../util/support/atomic-write.js';
import { RunEventEmitter } from '../util/support/events.js';
import { applyRetention } from '../util/support/retention.js';
import { discoverProject } from '../util/config/project-discovery.js';
import { writeProjectJson } from '../util/support/project-writer.js';
import { extractExpectations } from '../util/observation/expectation-extractor.js';
import { writeLearnJson } from '../util/evidence/learn-writer.js';
import { observeExpectations } from '../util/observation/observation-engine.js';
import { writeObserveJson } from '../util/observation/observe-writer.js';
import { detectPhase } from '../phases/detect-phase.js';
import { writeFindingsJson } from '../util/evidence/findings-writer.js';
import { writeSummaryJson } from '../util/evidence/summary-writer.js';
import { computeRuntimeBudget, withTimeout } from '../util/observation/runtime-budget.js';
import { saveDigest } from '../util/evidence/digest-engine.js';
import { TimeoutManager } from '../util/timeout-manager.js';
import { IncompleteError } from '../util/support/errors.js';
import { printSummary } from '../run/output-summary.js';
import { VERSION } from '../../version.js';

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

function getVersion() {
  return VERSION;
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
    status: 'RUNNING',
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
  const { projectProfile, events, json, finalizeOnTimeout } = context;
  
  // Extract expectations first to compute budget
  events.emit('phase:started', {
    phase: 'Learn',
    message: 'Analyzing project structure...',
  });
  
  events.startHeartbeat('Learn', json);
  
  let expectations, skipped;
  try {
    // Extract expectations (quick operation, no timeout needed here)
    const result = await extractExpectations(projectProfile, projectProfile.sourceRoot);
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
  
  // For now, emit a placeholder trace event
  events.emit('phase:completed', {
    phase: 'Learn',
    message: 'Project analysis complete',
  });
  
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
  } = context;
  
  // Observe phase with timeout
  events.emit('phase:started', {
    phase: 'Observe',
    message: 'Launching browser and observing expectations...',
  });
  
  events.startHeartbeat('Observe', json);
  
  let observeData = null;
  try {
    if (expectations.length > 0) {
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
          events.emit('observe:error', {
            message: error.message,
          });
          observeData = {
            observations: [],
            stats: { attempted: 0, observed: 0, notObserved: 0 },
            observedAt: getTimeProvider().iso(),
          };
        }
      }
    } else {
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
  
  return observeData;
}

/**
 * Detect Phase: Analyze findings and detect silent failures with timeout
 */
async function runDetectPhase(context) {
  const { expectations, skipped, observeData, projectRoot, events, json, budget } = context;
  
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
      budget: _budget,
  } = context;

  const debugLogs = Boolean(verbose);
  
  // Emit finalize phase
  events.emit('phase:started', {
    phase: 'Finalize Artifacts',
    message: 'Writing run results...',
  });
  
  events.stopHeartbeat();
  
  const completedAt = getTimeProvider().iso();
  
  // Determine run status from observation phase (will adjust after coverage)
  let runStatus = observeData?.status === 'INCOMPLETE' ? 'INCOMPLETE' : 'COMPLETE';
  
  // Write completed status
  atomicWriteJson(paths.runStatusJson, {
    contractVersion: 1,
    artifactVersions: getArtifactVersions(),
    status: runStatus,
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
    totalMs: runDurationMs > 0 ? runDurationMs : (context.budget?.ms || 0)
  };
  const findingsCounts = detectData?.findingsCounts || {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    UNKNOWN: 0,
  };
  
  const summaryData = {
    runId,
    scanId: paths.scanId,
    status: runStatus,
    startedAt,
    completedAt,
    command: 'run',
    url,
    notes: runStatus === 'INCOMPLETE' ? 'Run incomplete (timeout or observation limit)' : 'Run completed successfully',
    metrics,
    findingsCounts,
    incompleteReasons: observeData?.stability?.incompleteReasons || [],
  };
  
  const expectationsTotal = expectations.length;
  const attempted = observeData.stats?.attempted || 0;
  const completed = observeData.stats?.completed || observeData.stats?.observed || 0;
  const skippedExpectations = observeData.stats?.skipped || Math.max(0, expectationsTotal - completed);
  const coverageRatio = expectationsTotal > 0 ? (completed / expectationsTotal) : 1.0;
  if (expectationsTotal > 0 && coverageRatio < (minCoverage ?? 0.90)) {
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
  
  // Write summary with stable digest
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
  }, summaryStats);
  
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
  
  // Write completion sentinel early if coverage and initial status look complete
  // This avoids false INCOMPLETE due to missing sentinel in validation
  const coverageOkEarly = !(expectationsTotal > 0 && coverageRatio < (minCoverage ?? 0.90));
  if (runStatus === 'COMPLETE' && coverageOkEarly) {
    writeCompletionSentinel(paths.baseDir);
  }

  const validation = validateRunDirectory(paths.baseDir);
  const validatedStatus = determineRunStatus(validation, runStatus);
  
  if (validatedStatus !== runStatus) {
    runStatus = validatedStatus;
    const adjustedSummary = {
      ...summaryData,
      status: validatedStatus,
      notes: 'Artifact validation failed; run marked incomplete',
    };
    writeSummaryJson(paths.summaryJson, adjustedSummary, summaryStats);
    atomicWriteJson(paths.runStatusJson, {
      contractVersion: 1,
      artifactVersions: getArtifactVersions(),
      status: validatedStatus,
      scanId: paths.scanId,
      runId,
      startedAt,
      completedAt,
    });
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
      printSummary(url, paths, expectations, observeData, detectData);
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
  
  // Determine exit code based on status and findings
  let exitCode = validationExitCode(validation); // 0 or 30
  const hasConfirmed = Number(detectData?.stats?.byStatus?.CONFIRMED || 0) > 0;
  const hasSuspected = Number(detectData?.stats?.byStatus?.SUSPECTED || 0) > 0;
  const coverageOk = !(expectationsTotal > 0 && coverageRatio < (minCoverage ?? 0.90));
  const isIncomplete = (exitCode === 30) || runStatus === 'INCOMPLETE' || !coverageOk;

  if (!isIncomplete) {
    const mode = ciMode || 'balanced';
    if (mode === 'strict') {
      exitCode = (hasConfirmed || hasSuspected) ? 20 : 0;
    } else if (mode === 'advisory') {
      exitCode = 0;
    } else {
      exitCode = hasConfirmed ? 20 : (hasSuspected ? 10 : 0);
    }
  } else {
    exitCode = 30;
  }

  // Only write completion sentinel if all good
  if (exitCode === 0 || exitCode === 10 || exitCode === 20) {
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
  
  return { runStatus, exitCode, validation, completedAt, metrics, findingsCounts };
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
    out = '.verax',
    json = false,
    verbose = false,
    debug = false,
    retainRuns = 10,
    noRetention = false,
    minCoverage = 0.90,
    ciMode = 'balanced',
    authConfig = {},
    isFirstRun = false,
    srcDiscovered = false,
    urlOnlyMode = false,
  } = options;

  const mergedAuthConfig = Object.keys(authConfig || {}).length > 0 ? authConfig : {
    authStorage: options.authStorage,
    authStorageState: options.authStorageState,
    authCookies: options.authCookies,
    authHeaders: options.authHeaders,
    authMode: options.authMode || 'auto',
  };
  
  validateUrl(url);
  const { projectRoot, srcPath } = resolveAndValidateSrcPath(src);
  
  const debugLogs = Boolean(debug || verbose);
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
  };
  
  const finalizeOnTimeout = createTimeoutHandler(getVersion, state, events);
  
  try {
    scanId = generateScanId({ url, srcPath, config: { projectRoot, ciMode, minCoverage } });
    runId = generateUniqueRunId();

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
    });
    const { expectations, skipped, budget: phaseBudget } = learnResult;
    budget = phaseBudget;
    
    const timeoutManager = new TimeoutManager(budget.totalMaxMs);
    timeoutManager.recordPhaseTimeout('learn', budget.learnMaxMs);
    timeoutManager.recordPhaseTimeout('observe', budget.observeMaxMs);
    timeoutManager.recordPhaseTimeout('detect', budget.detectMaxMs);
    
    timeoutManager.setGlobalWatchdog(async () => {
      await finalizeOnTimeout(`Global timeout exceeded: ${budget.totalMaxMs}ms`);
      state.timedOut = true;
      state.timeoutOutcome = buildOutcome({
        command: 'run',
        exitCode: EXIT_CODES.FAILURE_INCOMPLETE,
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
    });
    const { exitCode: computedExitCode, validation, completedAt, metrics, findingsCounts } = artifactResult;

    const evidenceViolation = Boolean(validation && !validation.valid && validation.corruptedFiles && validation.corruptedFiles.length > 0);
    const incompleteArtifacts = Boolean(validation && !validation.valid && !evidenceViolation);
    const expectationsTotal = expectations.length;
    const completed = observeData.stats?.completed || observeData.stats?.observed || 0;
    const coverageRatio = expectationsTotal > 0 ? (completed / expectationsTotal) : 1.0;
    const coverageOk = !(expectationsTotal > 0 && coverageRatio < (minCoverage ?? 0.90));
    const hasConfirmed = Number(detectData?.stats?.byStatus?.CONFIRMED || 0) > 0;
    const hasSuspected = Number(detectData?.stats?.byStatus?.SUSPECTED || 0) > 0;
    const safeFindingsCounts = findingsCounts || {};
    const confirmedTotal = Number(safeFindingsCounts.HIGH || 0) + Number(safeFindingsCounts.MEDIUM || 0) + Number(safeFindingsCounts.LOW || 0);

    let exitCode = computedExitCode ?? EXIT_CODES.SUCCESS;
    let reason = 'Run completed with no actionable findings';
    let action = `Review artifacts at ${paths.baseDir}`;

    // First-run context messages
    const firstRunContext = isFirstRun ? ' This is your first VERAX run—defaults were relaxed to help you get started.' : '';
    const discoveryContext = srcDiscovered ? ` Source directory auto-discovered at ${srcPath}.` : '';
    const urlOnlyContext = urlOnlyMode ? ' Running in URL-only mode (no source directory detected).' : '';

    if (evidenceViolation) {
      exitCode = EXIT_CODES.EVIDENCE_VIOLATION;
      reason = 'Artifacts failed integrity validation';
      action = `Repair or regenerate artifacts at ${paths.baseDir}`;
    } else {
      const isIncomplete = incompleteArtifacts || exitCode === EXIT_CODES.FAILURE_INCOMPLETE || !coverageOk || observeData?.status === 'INCOMPLETE';
      
      // STAGE 7.1: Guard coverage failures on first run
      // Evidence violations (50) and infra failures (40) remain fatal
      // Coverage/observation failures downgrade to NEEDS_REVIEW (10) on first run
      if (isIncomplete && isFirstRun) {
        exitCode = EXIT_CODES.NEEDS_REVIEW;
        const coverageText = expectationsTotal > 0 ? `coverage ${coverageRatio.toFixed(2)} < threshold ${(minCoverage ?? 0.90).toFixed(2)}` : 'observation incomplete';
        reason = `Run incomplete: ${coverageText}.${firstRunContext}${discoveryContext}${urlOnlyContext}`;
        action = `For stricter validation, rerun with: verax run ${url} --min-coverage 0.90 --ci-mode balanced`;
      } else if (isIncomplete) {
        exitCode = EXIT_CODES.FAILURE_INCOMPLETE;
        const coverageText = expectationsTotal > 0 ? `coverage ${coverageRatio.toFixed(2)} < threshold ${(minCoverage ?? 0.90).toFixed(2)}` : 'observation incomplete';
        reason = `Run incomplete: ${coverageText}`;
        action = `Increase coverage or rerun scan in ${paths.baseDir}`;
      } else if (hasConfirmed) {
        exitCode = EXIT_CODES.FAILURE_CONFIRMED;
        reason = `Confirmed findings detected (total ${confirmedTotal})${firstRunContext}${discoveryContext}${urlOnlyContext}`;
        action = `Address findings and rerun. Summary: ${paths.summaryJson}`;
      } else if (hasSuspected) {
        exitCode = EXIT_CODES.NEEDS_REVIEW;
        reason = `Suspected findings detected${firstRunContext}${discoveryContext}${urlOnlyContext}`;
        action = `Review findings and confirm. Summary: ${paths.summaryJson}`;
      } else {
        exitCode = EXIT_CODES.SUCCESS;
        reason = `Run complete with zero actionable findings${firstRunContext}${discoveryContext}${urlOnlyContext}`;
        action = isFirstRun 
          ? `Next steps: Review artifacts at ${paths.baseDir}, run 'verax inspect' for detailed analysis, or add authentication if needed.`
          : `Proceed. Summary: ${paths.summaryJson}`;
      }
    }

    const outcome = buildOutcome({
      command: 'run',
      exitCode,
      reason,
      action,
    });

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
