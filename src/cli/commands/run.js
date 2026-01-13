import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { UsageError, DataError } from '../util/errors.js';
import { generateRunId } from '../util/run-id.js';
import { getRunPaths, ensureRunDirectories } from '../util/paths.js';
import { atomicWriteJson, atomicWriteText } from '../util/atomic-write.js';
import { RunEventEmitter } from '../util/events.js';
import { discoverProject } from '../util/project-discovery.js';
import { writeProjectJson } from '../util/project-writer.js';
import { extractExpectations } from '../util/expectation-extractor.js';
import { writeLearnJson } from '../util/learn-writer.js';
import { observeExpectations } from '../util/observation-engine.js';
import { writeObserveJson } from '../util/observe-writer.js';
import { detectFindings } from '../util/detection-engine.js';
import { writeFindingsJson } from '../util/findings-writer.js';
import { writeSummaryJson } from '../util/summary-writer.js';
import { computeRuntimeBudget, withTimeout } from '../util/runtime-budget.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion() {
  try {
    const pkgPath = resolve(__dirname, '../../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return pkg.version;
  } catch {
    return '0.2.0';
  }
}

/**
 * `verax run` command
 * Strict, non-interactive CLI mode with explicit flags
 */
export async function runCommand(options) {
  const {
    url,
    src = '.',
    out = '.verax',
    json = false,
    verbose = false,
  } = options;
  
  // Validate required arguments
  if (!url) {
    throw new UsageError('Missing required argument: --url <url>');
  }
  
  const projectRoot = resolve(process.cwd());
  const srcPath = resolve(projectRoot, src);
  
  // Validate src directory exists
  if (!existsSync(srcPath)) {
    throw new DataError(`Source directory not found: ${srcPath}`);
  }
  
  // Create event emitter
  const events = new RunEventEmitter();
  
  // Setup event handlers
  if (json) {
    // In JSON mode, emit events as JSONL (one JSON object per line)
    events.on('*', (event) => {
      console.log(JSON.stringify(event));
    });
  } else {
    events.on('*', (event) => {
      if (verbose) {
        console.log(`[${event.type}] ${event.message || ''}`);
      }
    });
  }
  
  let runId = null;
  let paths = null;
  let startedAt = null;
  let watchdogTimer = null;
  let budget = null;
  let timedOut = false;
  
  // Graceful finalization function
  const finalizeOnTimeout = async (reason) => {
    if (timedOut) return; // Prevent double finalization
    timedOut = true;
    
    events.stopHeartbeat();
    
    if (paths && runId && startedAt) {
      try {
        const failedAt = new Date().toISOString();
        atomicWriteJson(paths.runStatusJson, {
          status: 'FAILED',
          runId,
          startedAt,
          failedAt,
          error: reason,
        });
        
        atomicWriteJson(paths.runMetaJson, {
          veraxVersion: getVersion(),
          nodeVersion: process.version,
          platform: process.platform,
          cwd: projectRoot,
          command: 'run',
          args: { url, src, out },
          url,
          src: srcPath,
          startedAt,
          completedAt: failedAt,
          error: reason,
        });
        
        try {
          writeSummaryJson(paths.summaryJson, {
            runId,
            status: 'FAILED',
            startedAt,
            completedAt: failedAt,
            command: 'run',
            url,
            notes: `Run timed out: ${reason}`,
          }, {
            expectationsTotal: 0,
            attempted: 0,
            observed: 0,
            silentFailures: 0,
            coverageGaps: 0,
            unproven: 0,
            informational: 0,
          });
        } catch (summaryError) {
          // Ignore summary write errors during timeout handling
        }
      } catch (statusError) {
        // Ignore errors when writing failure status
      }
    }
    
    events.emit('error', {
      message: reason,
      type: 'timeout',
    });
  };
  
  try {
    // Generate run ID
    runId = generateRunId();
    if (verbose && !json) console.log(`Run ID: ${runId}`);
    
    paths = getRunPaths(projectRoot, out, runId);
    ensureRunDirectories(paths);
    
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
        detectedAt: new Date().toISOString(),
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
    const now = new Date();
    startedAt = now.toISOString();
    
    atomicWriteJson(paths.runStatusJson, {
      status: 'RUNNING',
      runId,
      startedAt,
    });
    
    // Write metadata
    atomicWriteJson(paths.runMetaJson, {
      veraxVersion: getVersion(),
      nodeVersion: process.version,
      platform: process.platform,
      cwd: projectRoot,
      command: 'run',
      args: { url, src, out },
      url,
      src: srcPath,
      startedAt,
      completedAt: null,
      error: null,
    });
    
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
    budget = computeRuntimeBudget({
      expectationsCount: expectations.length,
      mode: 'run',
      framework: projectProfile.framework,
      fileCount: projectProfile.fileCount || expectations.length,
    });
    
    // Set up global watchdog timer
    watchdogTimer = setTimeout(async () => {
      await finalizeOnTimeout(`Global timeout exceeded: ${budget.totalMaxMs}ms`);
      // Exit with code 0 (tool executed, just timed out)
      process.exit(0);
    }, budget.totalMaxMs);
    
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
        process.exit(0);
      }
      throw error;
    }
    
    // For now, emit a placeholder trace event
    events.emit('phase:completed', {
      phase: 'Learn',
      message: 'Project analysis complete',
    });
    
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
              observedAt: new Date().toISOString(),
            };
          } else {
            events.emit('observe:error', {
              message: error.message,
            });
            observeData = {
              observations: [],
              stats: { attempted: 0, observed: 0, notObserved: 0 },
              observedAt: new Date().toISOString(),
            };
          }
        }
      } else {
        observeData = {
          observations: [],
          stats: { attempted: 0, observed: 0, notObserved: 0 },
          observedAt: new Date().toISOString(),
        };
      }
    } finally {
      events.stopHeartbeat();
    }
    
    events.emit('phase:completed', {
      phase: 'Observe',
      message: 'Browser observation complete',
    });
    
      // Detect phase with timeout
      events.emit('phase:started', {
        phase: 'Detect',
        message: 'Analyzing findings and detecting silent failures...',
      });
    
      events.startHeartbeat('Detect', json);
    
      let detectData = null;
      try {
        try {
          // Use already-extracted expectations
          const learnData = {
            expectations,
            skipped,
          };
        
          detectData = await withTimeout(
            budget.detectMaxMs,
            detectFindings(learnData, observeData, projectRoot, (progress) => {
              events.emit(progress.event, progress);
            }),
            'Detect'
          );
        } catch (error) {
          if (error.message.includes('timeout')) {
            events.emit('detect:error', {
              message: `Detect phase timeout: ${budget.detectMaxMs}ms`,
            });
            detectData = {
              findings: [],
              stats: { total: 0, silentFailures: 0, observed: 0, coverageGaps: 0, unproven: 0, informational: 0 },
              detectedAt: new Date().toISOString(),
            };
          } else {
            events.emit('detect:error', {
              message: error.message,
            });
            detectData = {
              findings: [],
              stats: { total: 0, silentFailures: 0, observed: 0, coverageGaps: 0, unproven: 0, informational: 0 },
              detectedAt: new Date().toISOString(),
            };
          }
        }
      } finally {
        events.stopHeartbeat();
      }
    
      events.emit('phase:completed', {
        phase: 'Detect',
        message: 'Silent failure detection complete',
      });
    
    // Clear watchdog timer on successful completion
    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
    
    // Emit finalize phase
    events.emit('phase:started', {
      phase: 'Finalize Artifacts',
      message: 'Writing run results...',
    });
    
    events.stopHeartbeat();
    
    const completedAt = new Date().toISOString();
    
    // Write completed status
    atomicWriteJson(paths.runStatusJson, {
      status: 'COMPLETE',
      runId,
      startedAt,
      completedAt,
    });
    
    // Update metadata with completion time
    atomicWriteJson(paths.runMetaJson, {
      veraxVersion: getVersion(),
      nodeVersion: process.version,
      platform: process.platform,
      cwd: projectRoot,
      command: 'run',
      args: { url, src, out },
      url,
      src: srcPath,
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
    const findingsCounts = detectData?.findingsCounts || {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      UNKNOWN: 0,
    };

    // Write summary with stable digest
    writeSummaryJson(paths.summaryJson, {
      runId,
      status: 'COMPLETE',
      startedAt,
      completedAt,
      command: 'run',
      url,
      notes: 'Run completed successfully',
      metrics,
      findingsCounts,
    }, {
      expectationsTotal: expectations.length,
      attempted: observeData.stats?.attempted || 0,
      observed: observeData.stats?.observed || 0,
      silentFailures: detectData.stats?.silentFailures || 0,
      coverageGaps: detectData.stats?.coverageGaps || 0,
      unproven: detectData.stats?.unproven || 0,
      informational: detectData.stats?.informational || 0,
      ...metrics,
      ...findingsCounts,
    });
    
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
    }
    
    // Print summary if not JSON mode
    if (!json) {
      console.log('\nRun complete.');
      console.log(`Run ID: ${runId}`);
      console.log(`Artifacts: ${paths.baseDir}`);
    }
    
    return { runId, paths, success: true };
  } catch (error) {
    // Clear watchdog timer on error
    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
    
    events.stopHeartbeat();
    
    // Mark run as FAILED if we have paths
    if (paths && runId && startedAt) {
      try {
        const failedAt = new Date().toISOString();
        atomicWriteJson(paths.runStatusJson, {
          status: 'FAILED',
          runId,
          startedAt,
          failedAt,
          error: error.message,
        });
        
        // Update metadata
        atomicWriteJson(paths.runMetaJson, {
          veraxVersion: getVersion(),
          nodeVersion: process.version,
          platform: process.platform,
          cwd: projectRoot,
          command: 'run',
          args: { url, src, out },
          url,
          src: srcPath,
          startedAt,
          completedAt: failedAt,
          error: error.message,
        });
        
        // Write summary with digest even on failure
        try {
          writeSummaryJson(paths.summaryJson, {
            runId,
            status: 'FAILED',
            startedAt,
            completedAt: failedAt,
            command: 'run',
            url,
            notes: `Run failed: ${error.message}`,
          }, {
            expectationsTotal: 0,
            attempted: 0,
            observed: 0,
            silentFailures: 0,
            coverageGaps: 0,
            unproven: 0,
            informational: 0,
          });
        } catch (summaryError) {
          // Ignore summary write errors during failure handling
        }
      } catch (statusError) {
        // Ignore errors when writing failure status
      }
    }
    
    events.emit('error', {
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
}
