import { resolve, dirname } from 'path';
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'fs';
import { createBrowser, navigateToUrl, closeBrowser } from './browser.js';
import { discoverAllInteractions } from './interaction-discovery.js';
import { captureScreenshot } from './evidence-capture.js';
import { runInteraction } from './interaction-runner.js';
import { writeTraces } from './traces-writer.js';
import { getBaseOrigin, isExternalUrl } from './domain-boundary.js';

// STAGE D1: Extracted modules for observe orchestration
import { setupNetworkFirewall } from './network-firewall.js';

// STAGE D2.1: Extracted modules for snapshot operations
import { initializeSnapshot, finalizeSnapshot } from './snapshot-ops.js';

// STAGE D2.2: Extracted modules for coverage gap accumulation and warnings
import { accumulateCoverageGaps, buildCoverageObject, generateCoverageWarnings } from './coverage-gaps.js';

// STAGE D2.4: Extracted modules for incremental skip handling
import { buildIncrementalPhantomTrace } from './incremental-skip.js';

import { DEFAULT_SCAN_BUDGET } from '../shared/scan-budget.js';
import { executeProvenExpectations } from './expectation-executor.js';
import { isProvenExpectation } from '../shared/expectation-prover.js';
import { PageFrontier } from './page-frontier.js';
import { deriveObservedExpectation, shouldAttemptRepeatObservedExpectation, evaluateObservedExpectation } from './observed-expectation.js';
import { computeRouteBudget } from '../core/budget-engine.js';
import { shouldSkipInteractionIncremental } from '../core/incremental-store.js';
import SilenceTracker from '../core/silence-model.js';
import { DecisionRecorder, recordBudgetProfile, recordTimeoutConfig, recordTruncation, recordEnvironment } from '../core/determinism-model.js';

/**
 * OBSERVE PHASE - Execute interactions and capture runtime behavior
 * 
 * SILENCE TRACKING: Every skip, timeout, cap, and drop is recorded.
 * Nothing unobserved is allowed to disappear.
 * 
 * - Incremental skips: Tracked as silence (reused previous data)
 * - Safety skips: Tracked as silence (destructive/unsafe actions)
 * - Budget caps: Tracked as silence (unevaluated interactions)
 * - Timeouts: Tracked as silence (unknown outcomes)
 * - Sensor failures: Tracked as silence (missing data)
 * 
 * All silence is explicit in output - no silent success.
 * 
 * PHASE 4: Safety mode enabled by default
 * - Blocks risky/write actions unconditionally
 * - Blocks POST/PUT/PATCH/DELETE (read-only mode enforced)
 * - Blocks cross-origin unless --allow-cross-origin
 * 
 * PHASE 5: Deterministic artifact paths
 * - All artifacts written to .verax/runs/<runId>/
 */
export async function observe(url, manifestPath = null, scanBudgetOverride = null, safetyFlags = {}, projectDir = null, runId = null) {
  const scanBudget = scanBudgetOverride || DEFAULT_SCAN_BUDGET;
  const { browser, page } = await createBrowser();
  const startTime = Date.now();
  const baseOrigin = getBaseOrigin(url);
  const silenceTracker = new SilenceTracker();
  
  // PHASE 6: Record all adaptive decisions for determinism tracking
  const decisionRecorder = new DecisionRecorder(runId);
  
  // Record budget and timeout configuration decisions
  const profileName = scanBudgetOverride ? 'custom' : 'standard';
  recordBudgetProfile(decisionRecorder, profileName, scanBudget);
  recordTimeoutConfig(decisionRecorder, scanBudget);
  
  // Record environment decisions
  recordEnvironment(decisionRecorder, { browserType: 'chromium', viewport: { width: 1280, height: 720 } });
  
  // Phase 5: Detect projectDir if not provided (for backwards compatibility with tests)
  if (!projectDir) {
    projectDir = process.cwd();
  }
  
  // Phase 4: Extract safety flags
  const { allowRiskyActions = false, allowCrossOrigin = false } = safetyFlags;
  let blockedNetworkWrites = [];
  let blockedCrossOrigin = [];
  
  // Phase 4: Setup network interception firewall (STAGE D1: moved to module)
  const firewallResult = await setupNetworkFirewall(page, baseOrigin, allowCrossOrigin, silenceTracker);
  blockedNetworkWrites = firewallResult.blockedNetworkWrites;
  blockedCrossOrigin = firewallResult.blockedCrossOrigin;
  
  try {
    await navigateToUrl(page, url, scanBudget);

    const projectDir = manifestPath ? dirname(dirname(dirname(manifestPath))) : process.cwd();
    if (!runId) {
      throw new Error('runId is required');
    }
    const { getScreenshotDir } = await import('../core/run-id.js');
    const screenshotsDir = getScreenshotDir(projectDir, runId);
    mkdirSync(screenshotsDir, { recursive: true });
    
    const timestamp = Date.now();
    const initialScreenshot = resolve(screenshotsDir, `initial-${timestamp}.png`);
    await captureScreenshot(page, initialScreenshot);
    
    // 1) Execute PROVEN expectations first (if manifest exists)
    let manifest = null;
    let expectationResults = null;
    let expectationCoverageGaps = [];
    let incrementalMode = false;
    let snapshotDiff = null;
    let oldSnapshot = null;

    if (manifestPath && existsSync(manifestPath)) {
      try {
        const manifestContent = readFileSync(manifestPath, 'utf-8');
  // @ts-expect-error - readFileSync with encoding returns string
        manifest = JSON.parse(manifestContent);
        
        // STAGE D2.1: Snapshot initialization (moved to snapshot-ops module)
        const snapshotResult = await initializeSnapshot(projectDir, manifest);
        oldSnapshot = snapshotResult.oldSnapshot;
        snapshotDiff = snapshotResult.snapshotDiff;
        incrementalMode = snapshotResult.incrementalMode;
        
        const provenCount = (manifest.staticExpectations || []).filter(exp => isProvenExpectation(exp)).length;
        if (provenCount > 0) {
          expectationResults = await executeProvenExpectations(
            page,
            manifest,
            url,
            screenshotsDir,
            scanBudget,
            startTime,
            projectDir
          );
          expectationCoverageGaps = expectationResults.coverageGaps || [];
        }
      } catch (err) {
        // Record manifest load/expectation execution failure as silence
        silenceTracker.record({
          scope: 'discovery',
          reason: 'discovery_error',
          description: 'Manifest load or expectation execution failed',
          context: { error: err?.message },
          impact: 'incomplete_check'
        });
      }
    }

    // Reset to start URL before traversal
    await navigateToUrl(page, url, scanBudget);

    const frontier = new PageFrontier(url, baseOrigin, scanBudget, startTime);
    const traces = [];
    const observeWarnings = [];
    const skippedInteractions = [];
    const observedExpectations = []; // Store observed expectations for runtime report
    let totalInteractionsDiscovered = 0;
    let totalInteractionsExecuted = 0;
    let remainingInteractionsGaps = [];

    let nextPageUrl = frontier.getNextUrl();

    while (nextPageUrl && Date.now() - startTime < scanBudget.maxScanDurationMs) {
      if (frontier.isPageLimitExceeded()) {
        // PHASE 6: Record truncation decision
        recordTruncation(decisionRecorder, 'pages', {
          limit: scanBudget.maxPages,
          reached: frontier.pagesVisited
        });
        
        silenceTracker.record({
          scope: 'page',
          reason: 'page_limit_exceeded',
          description: `Reached maximum of ${scanBudget.maxPages} pages visited`,
          context: { pagesVisited: frontier.pagesVisited, maxPages: scanBudget.maxPages },
          impact: 'blocks_nav'
        });
        break;
      }

      // Check if we're already on the target page (from navigation via link click)
      const currentUrl = page.url();
      const normalizedNext = frontier.normalizeUrl(nextPageUrl);
      const normalizedCurrent = frontier.normalizeUrl(currentUrl);
      const alreadyOnPage = normalizedCurrent === normalizedNext;

      if (!alreadyOnPage) {
        // Navigate to next page
        try {
          await navigateToUrl(page, nextPageUrl, scanBudget);
        } catch (error) {
          // Record navigation failure as silence and skip
          silenceTracker.record({
            scope: 'navigation',
            reason: 'navigation_timeout',
            description: 'Navigation to page failed',
            context: { targetUrl: nextPageUrl },
            impact: 'blocks_nav'
          });
          const normalizedFailed = frontier.normalizeUrl(nextPageUrl);
          if (!frontier.visited.has(normalizedFailed)) {
            frontier.visited.add(normalizedFailed);
            frontier.markVisited();
          }
          nextPageUrl = frontier.getNextUrl();
          continue;
        }
      }

      // Mark as visited and increment counter
      // getNextUrl() marks as visited in the set but doesn't call markVisited() to increment counter
      // So we need to call markVisited() here when we process a page
      if (!alreadyOnPage) {
        // We navigated via getNextUrl() - it already marked in visited set, now increment counter
        // (getNextUrl() marks in visited set but doesn't increment pagesVisited)
        frontier.markVisited();
      } else {
        // We navigated via link click (alreadyOnPage=true) - mark as visited and increment
        if (!frontier.visited.has(normalizedNext)) {
          frontier.visited.add(normalizedNext);
          frontier.markVisited();
        } else {
          // Already marked as visited, but still increment counter since we're processing it
          frontier.markVisited();
        }
      }

      // Discover ALL links on this page and add to frontier BEFORE executing interactions
      try {
        const currentLinks = await page.locator('a[href]').all();
        for (const link of currentLinks) {
          try {
            const href = await link.getAttribute('href');
            if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
              const resolvedUrl = href.startsWith('http') ? href : new URL(href, page.url()).href;
              if (!isExternalUrl(resolvedUrl, baseOrigin)) {
                frontier.addUrl(resolvedUrl);
              }
            }
          } catch (error) {
            // Record invalid URL discovery as silence
            silenceTracker.record({
              scope: 'discovery',
              reason: 'discovery_error',
              description: 'Invalid or unreadable link during discovery',
              context: { pageUrl: page.url() },
              impact: 'incomplete_check'
            });
          }
        }
      } catch (error) {
        // Record link discovery failure as silence
        silenceTracker.record({
          scope: 'discovery',
          reason: 'discovery_error',
          description: 'Link discovery failed on page',
          context: { pageUrl: page.url() },
          impact: 'incomplete_check'
        });
      }

      // SCALE INTELLIGENCE: Compute adaptive budget for this route
      // Reuse currentUrl from above (already captured at line 95)
      const routeBudget = manifest ? computeRouteBudget(manifest, currentUrl, scanBudget) : scanBudget;
      
      // Discover ALL interactions on this page
      // Note: discoverAllInteractions already returns sorted interactions deterministically
      const { interactions } = await discoverAllInteractions(page, baseOrigin, routeBudget);
      totalInteractionsDiscovered += interactions.length;
      
      // SCALE INTELLIGENCE: Apply adaptive budget cap (interactions are already sorted deterministically)
      // Stable sorting ensures determinism: same interactions → same order
      const sortedInteractions = interactions.slice(0, routeBudget.maxInteractionsPerPage);

      // Track if we navigated during interaction execution
      let navigatedToNewPage = false;
      let navigatedPageUrl = null;
      let remainingInteractionsStartIndex = 0;

      // Execute discovered interactions on this page (sorted for determinism)
      for (let i = 0; i < sortedInteractions.length; i++) {
        if (Date.now() - startTime > scanBudget.maxScanDurationMs) {
          // PHASE 6: Record truncation decision
          recordTruncation(decisionRecorder, 'time', {
            limit: scanBudget.maxScanDurationMs,
            elapsed: Date.now() - startTime
          });
          
          // Mark remaining interactions as COVERAGE_GAP
          silenceTracker.record({
            scope: 'interaction',
            reason: 'scan_time_exceeded',
            description: `Scan time limit (${scanBudget.maxScanDurationMs}ms) exceeded`,
            context: { 
              elapsed: Date.now() - startTime,
              maxDuration: scanBudget.maxScanDurationMs,
              remainingInteractions: sortedInteractions.length - i
            },
            impact: 'blocks_nav',
            count: sortedInteractions.length - i
          });
          remainingInteractionsStartIndex = i;
          break;
        }

        if (totalInteractionsExecuted >= routeBudget.maxInteractionsPerPage) {
          // PHASE 6: Record truncation decision
          recordTruncation(decisionRecorder, 'interactions', {
            limit: routeBudget.maxInteractionsPerPage,
            reached: totalInteractionsExecuted,
            scope: 'per_page'
          });
          
          // Route-specific budget exceeded
          silenceTracker.record({
            scope: 'interaction',
            reason: 'route_interaction_limit_exceeded',
            description: `Reached max ${routeBudget.maxInteractionsPerPage} interactions per page`,
            context: {
              currentPage: page.url(),
              executed: totalInteractionsExecuted,
              maxPerPage: routeBudget.maxInteractionsPerPage,
              remainingInteractions: sortedInteractions.length - i
            },
            impact: 'affects_expectations',
            count: sortedInteractions.length - i
          });
          remainingInteractionsStartIndex = i;
          break;
        }

        if (totalInteractionsExecuted >= scanBudget.maxTotalInteractions) {
          // PHASE 6: Record truncation decision
          recordTruncation(decisionRecorder, 'interactions', {
            limit: scanBudget.maxTotalInteractions,
            reached: totalInteractionsExecuted,
            scope: 'total'
          });
          
          // Mark remaining interactions as COVERAGE_GAP with reason 'budget_exceeded'
          silenceTracker.record({
            scope: 'interaction',
            reason: 'interaction_limit_exceeded',
            description: `Reached max ${scanBudget.maxTotalInteractions} total interactions`,
            context: {
              executed: totalInteractionsExecuted,
              maxTotal: scanBudget.maxTotalInteractions,
              remainingInteractions: sortedInteractions.length - i
            },
            impact: 'blocks_nav',
            count: sortedInteractions.length - i
          });
          remainingInteractionsStartIndex = i;
          break;
        }

        const interaction = sortedInteractions[i];
        
        // SCALE INTELLIGENCE: Check if interaction should be skipped in incremental mode
        if (incrementalMode && manifest && oldSnapshot && snapshotDiff) {
          const shouldSkip = shouldSkipInteractionIncremental(interaction, currentUrl, oldSnapshot, snapshotDiff);
          if (shouldSkip) {
            // Create a trace for skipped interaction (marked as incremental - will not produce findings)
            const skippedTrace = buildIncrementalPhantomTrace({ interaction, currentUrl });
            traces.push(skippedTrace);
            
            // Track incremental skip as silence
            silenceTracker.record({
              scope: 'interaction',
              reason: 'incremental_unchanged',
              description: `Skipped re-observation (unchanged in incremental mode): ${interaction.label}`,
              context: {
                currentPage: currentUrl,
                selector: interaction.selector,
                interactionLabel: interaction.label,
                type: interaction.type
              },
              impact: 'affects_expectations'
            });
            
            skippedInteractions.push({
              interaction: {
                type: interaction.type,
                selector: interaction.selector,
                label: interaction.label,
                text: interaction.text
              },
              outcome: 'SKIPPED',
              reason: 'incremental_unchanged',
              url: currentUrl,
              evidence: {
                selector: interaction.selector,
                label: interaction.label,
                incremental: true
              }
            });
            continue;
          }
        }

        // Skip dangerous interactions (logout, delete, etc.) with explicit reason
        const skipCheck = frontier.shouldSkipInteraction(interaction);
        if (skipCheck.skip) {
          // Track safety skip as silence
          silenceTracker.record({
            scope: 'interaction',
            reason: skipCheck.reason === 'destructive' ? 'destructive_text' : 'unsafe_pattern',
            description: `Skipped potentially dangerous interaction: ${interaction.label}`,
            context: {
              currentPage: page.url(),
              selector: interaction.selector,
              interactionLabel: interaction.label,
              text: interaction.text,
              skipReason: skipCheck.reason,
              skipMessage: skipCheck.message
            },
            impact: 'unknown_behavior'
          });
          
          skippedInteractions.push({
            interaction: {
              type: interaction.type,
              selector: interaction.selector,
              label: interaction.label,
              text: interaction.text
            },
            outcome: 'SKIPPED',
            reason: skipCheck.reason || 'safety_policy',
            url: page.url(),
            evidence: {
              selector: interaction.selector,
              label: interaction.label,
              text: interaction.text,
              sourcePage: page.url()
            }
          });
          continue;
        }

        // Phase 4: Check action classification and safety mode
        const { shouldBlockAction } = await import('../core/action-classifier.js');
        const allowWrites = allowRiskyActions;
        const blockCheck = shouldBlockAction(interaction, { allowWrites, allowRiskyActions });
        
        if (blockCheck.shouldBlock) {
          // Track blocked action as silence
          silenceTracker.record({
            scope: 'safety',
            reason: 'blocked_action',
            description: `Action blocked by safety mode: ${interaction.label} (${blockCheck.classification})`,
            context: {
              currentPage: page.url(),
              selector: interaction.selector,
              interactionLabel: interaction.label,
              text: interaction.text,
              classification: blockCheck.classification,
              blockReason: blockCheck.reason
            },
            impact: 'action_blocked'
          });
          
          skippedInteractions.push({
            interaction: {
              type: interaction.type,
              selector: interaction.selector,
              label: interaction.label,
              text: interaction.text
            },
            outcome: 'BLOCKED',
            reason: 'safety_mode',
            classification: blockCheck.classification,
            url: page.url(),
            evidence: {
              selector: interaction.selector,
              label: interaction.label,
              text: interaction.text,
              classification: blockCheck.classification,
              sourcePage: page.url()
            }
          });
          
          // Create a minimal trace for blocked interactions so they appear in output
          const blockedTrace = {
            interaction: {
              type: interaction.type,
              selector: interaction.selector,
              label: interaction.label,
              text: interaction.text
            },
            before: {
              url: page.url(),
              screenshot: null
            },
            after: {
              url: page.url(),
              screenshot: null
            },
            policy: {
              actionBlocked: true,
              classification: blockCheck.classification,
              reason: blockCheck.reason
            },
            outcome: 'BLOCKED_BY_SAFETY_MODE',
            timestamp: Date.now()
          };
          traces.push(blockedTrace);
          
          continue;
        }

        const beforeUrl = page.url();
        const interactionIndex = totalInteractionsExecuted;
        const trace = await runInteraction(
          page,
          interaction,
          timestamp,
          interactionIndex,
          screenshotsDir,
          baseOrigin,
          startTime,
          routeBudget, // Use route-specific budget
          null,
          silenceTracker // Pass silence tracker
        );
        
        // Mark trace with incremental flag if applicable
        if (incrementalMode && trace) {
          trace.incremental = false; // This interaction was executed, not skipped
        }

        let repeatTrace = null;

        if (trace) {
          const matchingExpectation = expectationResults?.results?.find(r => r.trace?.interaction?.selector === trace.interaction.selector);
          if (matchingExpectation) {
            trace.expectationDriven = true;
            trace.expectationId = matchingExpectation.expectationId;
            trace.expectationOutcome = matchingExpectation.outcome;
          } else {
            const observedExpectation = deriveObservedExpectation(interaction, trace, baseOrigin);
            if (observedExpectation) {
              trace.observedExpectation = observedExpectation;
              trace.resultType = 'OBSERVED_EXPECTATION';
              observedExpectations.push(observedExpectation);

              const repeatEligible = shouldAttemptRepeatObservedExpectation(observedExpectation, trace);
              const budgetAllowsRepeat = repeatEligible &&
                (Date.now() - startTime) < scanBudget.maxScanDurationMs &&
                (totalInteractionsExecuted + 1) < scanBudget.maxTotalInteractions;

              if (budgetAllowsRepeat) {
                const repeatIndex = totalInteractionsExecuted + 1;
                const repeatResult = await repeatObservedInteraction(
                  page,
                  interaction,
                  observedExpectation,
                  timestamp,
                  repeatIndex,
                  screenshotsDir,
                  baseOrigin,
                  startTime,
                  scanBudget
                );

                if (repeatResult) {
                  const repeatEvaluation = repeatResult.repeatEvaluation;
                  trace.observedExpectation.repeatAttempted = true;
                  trace.observedExpectation.repeated = repeatEvaluation.outcome === 'VERIFIED';
                  trace.observedExpectation.repeatOutcome = repeatEvaluation.outcome;
                  trace.observedExpectation.repeatReason = repeatEvaluation.reason;

                  if (repeatEvaluation.outcome === 'OBSERVED_BREAK') {
                    trace.observedExpectation.outcome = 'OBSERVED_BREAK';
                    trace.observedExpectation.reason = 'inconsistent_on_repeat';
                    trace.observedExpectation.confidenceLevel = 'LOW';
                  } else if (trace.observedExpectation.repeated && trace.observedExpectation.outcome === 'VERIFIED') {
                    trace.observedExpectation.confidenceLevel = 'MEDIUM';
                  }

                  repeatTrace = repeatResult.repeatTrace;
                }
              }
            } else {
              trace.unprovenResult = true;
              trace.resultType = 'UNPROVEN_RESULT';
            }
          }

          traces.push(trace);
          totalInteractionsExecuted++;

          if (repeatTrace) {
            traces.push(repeatTrace);
            totalInteractionsExecuted++;
          }

          const afterUrl = trace.after?.url || page.url();
          const navigatedSameOrigin = afterUrl && afterUrl !== beforeUrl && !isExternalUrl(afterUrl, baseOrigin);
          if (navigatedSameOrigin && interaction.type === 'link') {
            // Link navigation - add new page to frontier (if not already visited)
            const normalizedAfter = frontier.normalizeUrl(afterUrl);
            const wasAlreadyVisited = frontier.visited.has(normalizedAfter);
            if (!wasAlreadyVisited) {
              const added = frontier.addUrl(afterUrl);
              // If frontier was capped, record coverage gap
              if (!added && frontier.frontierCapped) {
                remainingInteractionsGaps.push({
                  interaction: {
                    type: 'link',
                    selector: interaction.selector,
                    label: interaction.label
                  },
                  reason: 'frontier_capped',
                  url: afterUrl
                });
              }
            }
            
            // Stay on the new page and continue executing interactions there
            navigatedToNewPage = true;
            navigatedPageUrl = afterUrl;
            
            // Discover links on the new page immediately
            try {
              const newPageLinks = await page.locator('a[href]').all();
              for (const link of newPageLinks) {
                try {
                  const href = await link.getAttribute('href');
                  if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                    const resolvedUrl = href.startsWith('http') ? href : new URL(href, page.url()).href;
                    if (!isExternalUrl(resolvedUrl, baseOrigin)) {
                      frontier.addUrl(resolvedUrl);
                    }
                  }
                } catch (error) {
                  // Record invalid URL discovery as silence
                  silenceTracker.record({
                    scope: 'discovery',
                    reason: 'discovery_error',
                    description: 'Invalid or unreadable link during discovery',
                    context: { pageUrl: page.url() },
                    impact: 'incomplete_check'
                  });
                }
              }
            } catch (error) {
              // Record link discovery failure as silence
              silenceTracker.record({
                scope: 'discovery',
                reason: 'discovery_error',
                description: 'Link discovery failed on page',
                context: { pageUrl: page.url() },
                impact: 'incomplete_check'
              });
            }
            
            // Break to restart loop on new page
            break;
          }
        }
      }

      // Mark remaining interactions as COVERAGE_GAP if we stopped early
      if (remainingInteractionsStartIndex > 0 && remainingInteractionsStartIndex < sortedInteractions.length && !navigatedToNewPage) {
        for (let j = remainingInteractionsStartIndex; j < sortedInteractions.length; j++) {
          const reason = totalInteractionsExecuted >= scanBudget.maxTotalInteractions ? 'budget_exceeded' : 
                        (totalInteractionsExecuted >= routeBudget.maxInteractionsPerPage ? 'route_budget_exceeded' : 'budget_exceeded');
          remainingInteractionsGaps.push({
            interaction: {
              type: sortedInteractions[j].type,
              selector: sortedInteractions[j].selector,
              label: sortedInteractions[j].label
            },
            reason: reason,
            url: currentUrl
          });
        }
      }

      // If we navigated to a new page, stay on it and continue (next iteration will handle it)
      if (navigatedToNewPage && navigatedPageUrl) {
        // Don't mark as visited yet - we'll do it at the start of next iteration
        // This ensures the page counter is incremented when we process the page
        // Set nextPageUrl to the navigated page so we process it in the next iteration
        nextPageUrl = navigatedPageUrl;
        continue;
      }

      // After executing all interactions on current page, move to next page in frontier
      nextPageUrl = frontier.getNextUrl();
    }

    // Combine all coverage gaps
    expectationCoverageGaps.push(...accumulateCoverageGaps(remainingInteractionsGaps, frontier, page.url(), scanBudget));

    // Build coverage object matching writeTraces expected format
    const coverage = buildCoverageObject(
      totalInteractionsDiscovered,
      totalInteractionsExecuted,
      scanBudget,
      frontier,
      skippedInteractions,
      remainingInteractionsGaps
    );
    
    // Ensure we increment pagesVisited when we navigate via getNextUrl()
    // getNextUrl() marks as visited but doesn't increment counter - we do it here
    // BUT: when alreadyOnPage is true, we've already marked it, so don't double-count

    // Record warnings
    observeWarnings.push(...generateCoverageWarnings(coverage, skippedInteractions));

    // Append expectation traces for completeness
    if (expectationResults && expectationResults.results) {
      for (const result of expectationResults.results) {
        if (result.trace) {
          result.trace.expectationDriven = true;
          result.trace.expectationId = result.expectationId;
          result.trace.expectationOutcome = result.outcome;
          traces.push(result.trace);
        }
      }
    }

    const observation = writeTraces(projectDir, url, traces, coverage, observeWarnings, observedExpectations, silenceTracker, runId);

    // Add silence tracking to observation result
    observation.silences = silenceTracker.getDetailedSummary();

    if (expectationResults) {
      observation.expectationExecution = {
        totalProvenExpectations: expectationResults.totalProvenExpectations,
        executedCount: expectationResults.executedCount,
        coverageGapsCount: expectationCoverageGaps.length,
        results: expectationResults.results.map(r => ({
          expectationId: r.expectationId,
          type: r.type,
          fromPath: r.fromPath,
          outcome: r.outcome,
          reason: r.reason
        }))
      };
      observation.expectationCoverageGaps = expectationCoverageGaps;
    }
    
    // STAGE D2.1: Snapshot finalization (moved to snapshot-ops module)
    const incrementalMetadata = await finalizeSnapshot(
      manifest,
      traces,
      skippedInteractions,
      incrementalMode,
      snapshotDiff,
      projectDir,
      runId,
      url
    );
    if (incrementalMetadata) {
      observation.incremental = incrementalMetadata;
    }

    await closeBrowser(browser);
    
    // PHASE 6: Export determinism decisions to run directory
    if (runId && projectDir) {
      const runsDir = resolve(projectDir, '.verax', 'runs', runId);
      mkdirSync(runsDir, { recursive: true });
      const decisionsPath = resolve(runsDir, 'decisions.json');
      const decisionsData = JSON.stringify(decisionRecorder.export(), null, 2);
      writeFileSync(decisionsPath, decisionsData, 'utf-8');
    }
    
    // Phase 4: Add safety mode statistics
    const safetyBlocks = {
      actionsBlocked: skippedInteractions.filter(s => s.reason === 'safety_mode').length,
      networkWritesBlocked: blockedNetworkWrites.length,
      crossOriginBlocked: blockedCrossOrigin.length,
      blockedActions: skippedInteractions.filter(s => s.reason === 'safety_mode').map(s => ({
        label: s.interaction.label,
        classification: s.classification,
        url: s.url
      })),
      blockedNetworkWrites: blockedNetworkWrites.slice(0, 5), // Top 5
      blockedCrossOrigin: blockedCrossOrigin.slice(0, 5) // Top 5
    };
    
    return {
      ...observation,
      screenshotsDir: screenshotsDir,
      safetyBlocks
    };
  } catch (error) {
    await closeBrowser(browser);
    throw error;
  }
}

async function repeatObservedInteraction(
  page,
  interaction,
  observedExpectation,
  timestamp,
  interactionIndex,
  screenshotsDir,
  baseOrigin,
  startTime,
  scanBudget
) {
  const selector = observedExpectation.evidence?.selector || interaction.selector;
  if (!selector) return null;

  const locator = page.locator(selector).first();
  const count = await locator.count();
  if (count === 0) {
    return null;
  }

  const repeatInteraction = {
    ...interaction,
    element: locator
  };

  const repeatTrace = await runInteraction(
    page,
    repeatInteraction,
    timestamp,
    interactionIndex,
    screenshotsDir,
    baseOrigin,
    startTime,
    scanBudget,
    null,
    null // No silence tracker for repeat executions (not counted as new silence)
  );

  if (!repeatTrace) {
    return null;
  }

  repeatTrace.repeatExecution = true;
  repeatTrace.repeatOfObservedExpectationId = observedExpectation.id;
  repeatTrace.resultType = 'OBSERVED_EXPECTATION_REPEAT';

  const repeatEvaluation = evaluateObservedExpectation(observedExpectation, repeatTrace);

  return {
    repeatTrace,
    repeatEvaluation
  };
}
