import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import inquirer from 'inquirer';
import { DataError } from '../util/errors.js';
import { generateRunId } from '../util/run-id.js';
import { getRunPaths, ensureRunDirectories } from '../util/paths.js';
import { atomicWriteJson, atomicWriteText } from '../util/atomic-write.js';
import { RunEventEmitter } from '../util/events.js';
import { tryResolveUrlFromEnv } from '../util/env-url.js';
import { discoverProject, getFrameworkDisplayName, extractPortFromScript } from '../util/project-discovery.js';
import { writeProjectJson } from '../util/project-writer.js';
import { extractExpectations } from '../util/expectation-extractor.js';
import { writeLearnJson } from '../util/learn-writer.js';
import { observeExpectations } from '../util/observation-engine.js';
import { writeObserveJson } from '../util/observe-writer.js';
import { detectFindings } from '../util/detection-engine.js';
import { writeFindingsJson } from '../util/findings-writer.js';
import { writeSummaryJson } from '../util/summary-writer.js';
import { computeRuntimeBudget, withTimeout } from '../util/runtime-budget.js';
import { saveDigest } from '../util/digest-engine.js';
import { ARTIFACT_REGISTRY, getArtifactVersions } from '../../verax/core/artifacts/registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion() {
  try {
    const pkgPath = resolve(__dirname, '../../../package.json');
  // @ts-expect-error - readFileSync with encoding returns string
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return '0.2.0';
  }
}

/**
 * `verax` smart default command
 * Interactive mode with intelligent URL detection
 */
export async function defaultCommand(options = {}) {
  // Interactive mode disabled by constitution: require explicit verax run --url
  throw new DataError('Interactive mode is disabled. Use: verax run --url <url>');

  /* eslint-disable no-unreachable */
  const {
    src = '.',
    out = '.verax',
    url = null,
    json = false,
    verbose = false,
  } = options;
  
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
    events.on('*', (event) => {
      console.log(JSON.stringify(event));
    });
  }
  
  // Show progress if not JSON
  if (!json && !verbose) {
    events.on('phase:started', (event) => {
      if (!json) {
        console.log(`${event.phase}...`);
      }
    });
  }
  
  let runId = null;
    /** @type {ReturnType<typeof getRunPaths> | null} */
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
    
    // TypeScript narrowing: paths is guaranteed to be non-null here due to control flow
    if (paths && runId && startedAt) {
      try {
        const failedAt = new Date().toISOString();
        atomicWriteJson(paths.runStatusJson, {
          contractVersion: 1,
          artifactVersions: getArtifactVersions(),
          status: 'FAILED',
          runId,
          startedAt,
          failedAt,
          error: reason,
        });
        
        atomicWriteJson(paths.runMetaJson, {
          contractVersion: ARTIFACT_REGISTRY.runMeta.contractVersion,
          veraxVersion: getVersion(),
          nodeVersion: process.version,
          platform: process.platform,
          cwd: projectRoot,
          command: 'default',
          args: { url: url || null, src },
          url: url || null,
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
            command: 'default',
            url: url || null,
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
    events.emit('phase:started', {
      phase: 'Detect Project',
      message: 'Detecting project type...',
    });
    
    // Discover project configuration
    let projectProfile;
    try {
      projectProfile = await discoverProject(srcPath);
    } catch (error) {
      // If discovery fails, create a minimal profile
      projectProfile = {
        framework: 'unknown',
        router: null,
        sourceRoot: srcPath,
        packageManager: 'unknown',
        scripts: { dev: null, build: null, start: null },
        detectedAt: new Date().toISOString(),
      };
    }
    
    const frameworkName = getFrameworkDisplayName(projectProfile.framework, projectProfile.router);
    
    if (!json) {
      console.log(`Detected framework: ${frameworkName}`);
      console.log(`Resolved source root: ${projectProfile.sourceRoot}`);
    }
    
    events.emit('project:detected', {
      framework: projectProfile.framework,
      router: projectProfile.router,
      frameworkName,
      sourceRoot: projectProfile.sourceRoot,
    });
    
    events.emit('phase:completed', {
      phase: 'Detect Project',
      message: `Detected framework: ${frameworkName}`,
    });
    
    // Phase: Resolve URL
    let resolvedUrl = url;
    
    if (!resolvedUrl) {
      events.emit('phase:started', {
        phase: 'Resolve URL',
        message: 'Attempting to resolve URL from environment...',
      });
      
      resolvedUrl = tryResolveUrlFromEnv();
      
      // Try to extract URL from dev script if available
      if (!resolvedUrl && projectProfile.scripts.dev) {
        const port = extractPortFromScript(projectProfile.scripts.dev);
        if (port) {
          resolvedUrl = `http://localhost:${port}`;
          if (!json) {
            console.log(`Detected dev script: ${projectProfile.scripts.dev}`);
          }
          events.emit('dev:script:detected', {
            script: projectProfile.scripts.dev,
            port,
          });
        }
      }
      
      if (resolvedUrl && !json) {
        console.log(`Detected URL: ${resolvedUrl}`);
      }
    }
    
    // If still no URL, prompt interactively
    if (!resolvedUrl) {
      events.emit('phase:started', {
        phase: 'Resolve URL',
        message: 'Prompting for URL...',
      });
      
      if (!json) {
        console.log(''); // blank line
      }
      
      const answer = await inquirer.prompt([
        {
          type: 'input',
          name: 'url',
          message: 'Enter the URL to scan',
          validate: (input) => {
            if (!input.trim()) {
              return 'URL is required';
            }
            if (!input.startsWith('http://') && !input.startsWith('https://')) {
              return 'URL must start with http:// or https://';
            }
            return true;
          },
        },
      ]);
      
      resolvedUrl = answer.url;
    }
    
    if (!json) {
      console.log(`Using URL: ${resolvedUrl}`);
    }
    
    events.emit('phase:completed', {
      phase: 'Resolve URL',
      message: `URL resolved: ${resolvedUrl}`,
    });
    
    // Generate run ID
    let runId = generateRunId(resolvedUrl);
    if (verbose && !json) console.log(`Run ID: ${runId}`);
    
    let paths = getRunPaths(projectRoot, out, runId);
    ensureRunDirectories(paths);
    
    // Initialize Run
    events.emit('phase:started', {
      phase: 'Initialize Run',
      message: 'Initializing run artifacts...',
    });
    
    const now = new Date();
    let startedAt = now.toISOString();
    
    atomicWriteJson(paths.runStatusJson, {
      contractVersion: 1,
      artifactVersions: getArtifactVersions(),
      status: 'RUNNING',
      runId,
      startedAt,
    });
    
    atomicWriteJson(paths.runMetaJson, {
      contractVersion: ARTIFACT_REGISTRY.runMeta.contractVersion,
      veraxVersion: getVersion(),
      nodeVersion: process.version,
      platform: process.platform,
      cwd: projectRoot,
      command: 'default',
      args: { url: resolvedUrl, src },
      url: resolvedUrl,
      src: srcPath,
      startedAt,
      completedAt: null,
      error: null,
    });
    
    events.emit('phase:completed', {
      phase: 'Initialize Run',
      message: 'Run initialized',
    });
    
    // Learning phase (placeholder)
    events.emit('phase:started', {
      phase: 'Learn',
      message: 'Analyzing project structure...',
    });
    
    events.startHeartbeat('Learn', json);
    
    let expectations, skipped;
    try {
      // Extract expectations
      const result = await extractExpectations(projectProfile, projectProfile.sourceRoot);
      expectations = result.expectations;
      skipped = result.skipped;
    } finally {
      events.stopHeartbeat();
    }
    
    if (!json) {
      console.log(`Found ${expectations.length} expectations`);
      if (Object.values(skipped).reduce((a, b) => a + b, 0) > 0) {
        console.log(`Skipped: ${Object.values(skipped).reduce((a, b) => a + b, 0)} (dynamic/computed)`);
      }
    }
    
    // Emit expectations found events
    expectations.slice(0, 5).forEach(exp => {
      events.emit('expectation:found', {
        type: exp.type,
        promise: exp.promise,
        file: exp.source.file,
      });
    });
    
    if (expectations.length > 5) {
      events.emit('expectation:found', {
        message: `... and ${expectations.length - 5} more expectations`,
      });
    }
    
    // Compute runtime budget based on expectations count
    budget = computeRuntimeBudget({
      expectationsCount: expectations.length,
      mode: 'default',
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
              resolvedUrl,
              paths.evidenceDir,
              (progress) => {
                events.emit(progress.event, progress);
                if (!json && progress.event === 'observe:result') {
                  const status = progress.observed ? '✓' : '✗';
                  console.log(`  ${status} ${progress.index}/${expectations.length}`);
                }
              },
              {}
            ),
            'Observe'
          );
          
          if (!json) {
            console.log(`Observed: ${observeData.stats.observed}/${expectations.length}`);
          }
        } catch (error) {
          if (error.message.includes('timeout')) {
            if (!json) {
              console.error(`Observe error: timeout after ${budget.observeMaxMs}ms`);
            }
            events.emit('observe:error', {
              message: `Observe phase timeout: ${budget.observeMaxMs}ms`,
            });
            observeData = {
              observations: [],
              stats: { attempted: 0, observed: 0, notObserved: 0 },
              observedAt: new Date().toISOString(),
            };
          } else {
            if (!json) {
              console.error(`Observe error: ${error.message}`);
            }
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
    
      // Load learn and observe data for detection
      let learnData = { expectations: [] };
      let detectData = null;
    
      try {
        try {
          learnData = {
            expectations,
            skipped,
          };
        
          detectData = await withTimeout(
            budget.detectMaxMs,
            detectFindings(learnData, observeData, projectRoot, (progress) => {
              events.emit(progress.event, progress);
              if (!json && progress.event === 'detect:classified') {
                const symbol = progress.classification === 'silent-failure' ? '✗' :
                              progress.classification === 'observed' ? '✓' :
                              progress.classification === 'coverage-gap' ? '⊘' : '⚠';
                console.log(`  ${symbol} ${progress.index}/${learnData.expectations.length}`);
              }
            }),
            'Detect'
          );
          
          if (!json && detectData.stats.silentFailures > 0) {
            console.log(`Silent failures detected: ${detectData.stats.silentFailures}`);
          }
        } catch (error) {
          if (error.message.includes('timeout')) {
            if (!json) {
              console.error(`Detect error: timeout after ${budget.detectMaxMs}ms`);
            }
            events.emit('detect:error', {
              message: `Detect phase timeout: ${budget.detectMaxMs}ms`,
            });
            detectData = {
              findings: [],
              stats: { total: 0, silentFailures: 0, observed: 0, coverageGaps: 0, unproven: 0, informational: 0 },
              detectedAt: new Date().toISOString(),
            };
          } else {
            if (!json) {
              console.error(`Detect error: ${error.message}`);
            }
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
    
    // Finalize Artifacts
    events.emit('phase:started', {
      phase: 'Finalize Artifacts',
      message: 'Writing run results...',
    });
    
    events.stopHeartbeat();
    
    const completedAt = new Date().toISOString();
    
    atomicWriteJson(paths.runStatusJson, {
      status: 'COMPLETE',
      runId,
      startedAt,
      completedAt,
      contractVersion: 1,
      artifactVersions: getArtifactVersions(),
    });
    
    atomicWriteJson(paths.runMetaJson, {
      contractVersion: ARTIFACT_REGISTRY.runMeta.contractVersion,
      veraxVersion: getVersion(),
      nodeVersion: process.version,
      platform: process.platform,
      cwd: projectRoot,
      command: 'default',
      args: { url: resolvedUrl, src },
      url: resolvedUrl,
      src: srcPath,
      startedAt,
      completedAt,
      error: null,
    });
    
    // Write summary with stable digest
    writeSummaryJson(paths.summaryJson, {
      runId,
      status: 'COMPLETE',
      startedAt,
      completedAt,
      command: 'default',
      url: resolvedUrl,
      notes: 'Run completed successfully',
    }, {
      expectationsTotal: expectations.length,
      attempted: observeData.stats?.attempted || 0,
      observed: observeData.stats?.observed || 0,
      silentFailures: detectData.stats?.silentFailures || 0,
      coverageGaps: detectData.stats?.coverageGaps || 0,
      unproven: detectData.stats?.unproven || 0,
      informational: detectData.stats?.informational || 0,
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
    
    // H5: Write deterministic digest for reproducibility proof
    if (observeData && observeData.digest) {
      saveDigest(resolve(paths.baseDir, 'run.digest.json'), observeData.digest);
    }
    
    events.emit('phase:completed', {
      phase: 'Finalize Artifacts',
      message: 'Run artifacts written',
    });
    
    // Print summary if not JSON mode
    if (!json) {
      const relativePath = paths.baseDir.replace(/\\/g, '/').split('/').slice(-1)[0];
      console.log('');
      console.log('VERAX — Silent Failure Detection');
      console.log('');
      console.log(`✔ Project detected: ${projectProfile.framework}`);
      console.log(`✔ URL resolved: ${resolvedUrl}`);
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
    
    return { runId, paths, url: resolvedUrl, success: true };
  } catch (error) {
    // Clear watchdog timer on error
    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
    
    events.stopHeartbeat();
    
    // Mark run as FAILED if we have paths
    if (paths && runId && startedAt && typeof paths === 'object') {
      try {
        const failedAt = new Date().toISOString();
        atomicWriteJson(paths.runStatusJson, {
          status: 'FAILED',
          runId,
          startedAt,
          failedAt,
          error: error.message,
          contractVersion: 1,
          artifactVersions: getArtifactVersions(),
        });
        
        // Update metadata
        atomicWriteJson(paths.runMetaJson, {
          contractVersion: ARTIFACT_REGISTRY.runMeta.contractVersion,
          veraxVersion: getVersion(),
          nodeVersion: process.version,
          platform: process.platform,
          cwd: projectRoot,
          command: 'default',
          args: { url: url || null, src },
          url: url || null,
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
            command: 'default',
            url: url || null,
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
  /* eslint-enable no-unreachable */
}
