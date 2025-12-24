const fs = require('fs');
const path = require('path');
const { executeAttempt } = require('./attempt');
const { MarketReporter } = require('./market-reporter');
const { getDefaultAttemptIds, getAttemptDefinition, registerAttempt } = require('./attempt-registry');
const { GuardianFlowExecutor } = require('./flow-executor');
const { getDefaultFlowIds, getFlowDefinition } = require('./flow-registry');
const { GuardianBrowser } = require('./browser');
const { GuardianCrawler } = require('./crawler');
const { SnapshotBuilder, saveSnapshot, loadSnapshot } = require('./snapshot');
const { DiscoveryEngine } = require('./discovery-engine');
const { buildAutoAttempts } = require('./auto-attempt-builder');
const { baselineExists, loadBaseline, saveBaselineAtomic, createBaselineFromSnapshot, compareSnapshots } = require('./baseline-storage');
const { analyzeMarketImpact, determineExitCodeFromEscalation } = require('./market-criticality');
const { parsePolicyOption } = require('./preset-loader');
const { evaluatePolicy } = require('./policy');
const { aggregateIntelligence } = require('./breakage-intelligence');
const { writeEnhancedHtml } = require('./enhanced-html-reporter');
const { printCliSummary } = require('./cli-summary');
const { sendWebhooks, getWebhookUrl, buildWebhookPayload } = require('./webhook');
const { findContactOnPage, formatDetectionForReport } = require('./semantic-contact-finder');

function generateRunId(prefix = 'market-run') {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:\-]/g, '').substring(0, 15).replace('T', '-');
  return `${prefix}-${dateStr}`;
}

async function executeReality(config) {
  const {
    baseUrl,
    attempts = getDefaultAttemptIds(),
    artifactsDir = './artifacts',
    headful = false,
    enableTrace = true,
    enableScreenshots = true,
    enableCrawl = true,
    enableDiscovery = false,
    enableAutoAttempts = false,
    maxPages = 25,
    maxDepth = 3,
    timeout = 20000,
    storageDir = '.odavl-guardian',
    toolVersion = '0.2.0-phase2',
    policy = null,
    webhook = null,
    includeUniversal = false,
    autoAttemptOptions = {},
    enableFlows = true,
    flows = getDefaultFlowIds(),
    flowOptions = {}
  } = config;

  // Validate baseUrl
  try {
    new URL(baseUrl);
  } catch (e) {
    throw new Error(`Invalid URL: ${baseUrl}`);
  }

  const runId = generateRunId();
  const runDir = path.join(artifactsDir, runId);
  fs.mkdirSync(runDir, { recursive: true });

  console.log(`\n🧪 Market Reality Snapshot v1`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📍 Base URL: ${baseUrl}`);
  console.log(`🎯 Attempts: ${attempts.join(', ')}`);
  console.log(`📁 Run Dir: ${runDir}`);

  // Initialize snapshot builder
  const snapshotBuilder = new SnapshotBuilder(baseUrl, runId, toolVersion);
  snapshotBuilder.setArtifactDir(runDir);

  let crawlResult = null;
  let discoveryResult = null;
  let pageLanguage = 'unknown';
  let contactDetectionResult = null;

  // Optional: Crawl to discover URLs (lightweight, first N pages)
  if (enableCrawl) {
    console.log(`\n🔍 Crawling for discovered URLs...`);
    const browser = new GuardianBrowser();
    try {
      await browser.launch(timeout);
      await browser.page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: timeout });

      // Wave 1.1: Detect page language and contact
      try {
        contactDetectionResult = await findContactOnPage(browser.page, baseUrl);
        pageLanguage = contactDetectionResult.language;
        console.log(`\n${formatDetectionForReport(contactDetectionResult)}\n`);
      } catch (detectionErr) {
        // Language detection non-critical
        console.warn(`⚠️  Language/contact detection failed: ${detectionErr.message}`);
      }

      const crawler = new GuardianCrawler(baseUrl, maxPages, maxDepth);
      crawlResult = await crawler.crawl(browser);
      console.log(`✅ Crawl complete: discovered ${crawlResult.totalDiscovered}, visited ${crawlResult.totalVisited}`);
      snapshotBuilder.addCrawlResults(crawlResult);
      await browser.close();
    } catch (crawlErr) {
      console.log(`⚠️  Crawl failed (non-critical): ${crawlErr.message}`);
      // Continue anyway - crawl is optional
    }
  }

  // Optional: Discovery Engine (Phase 4) — deterministic safe exploration
  if (enableDiscovery) {
    console.log(`\n🔎 Running discovery engine...`);
    const browser = new GuardianBrowser();
    try {
      await browser.launch(timeout);
      const engine = new DiscoveryEngine({
        baseUrl,
        maxPages,
        timeout,
        executeInteractions: false,
        browser,
      });
      discoveryResult = await engine.discover(browser.page);
      snapshotBuilder.setDiscoveryResults(discoveryResult);
      console.log(`✅ Discovery complete: visited ${discoveryResult.pagesVisitedCount}, interactions ${discoveryResult.interactionsDiscovered}`);
      await browser.close();
    } catch (discErr) {
      console.log(`⚠️  Discovery failed (non-critical): ${discErr.message}`);
    }
  }

  // Phase 2: Generate auto-attempts from discovered interactions
  let autoAttempts = [];
  if (enableAutoAttempts && discoveryResult && discoveryResult.interactionsDiscovered > 0) {
    console.log(`\n🤖 Generating auto-attempts from discoveries...`);
    try {
      // Get discovered interactions (stored in engine instance)
      const discoveredInteractions = discoveryResult.interactions || [];
      
      // Build auto-attempts with safety filters
      const autoAttemptOptions = {
        minConfidence: config.autoAttemptOptions?.minConfidence || 60,
        maxAttempts: config.autoAttemptOptions?.maxAttempts || 10,
        excludeRisky: true,
        includeClasses: config.autoAttemptOptions?.includeClasses || ['NAVIGATION', 'ACTION', 'SUBMISSION', 'TOGGLE']
      };

      autoAttempts = buildAutoAttempts(discoveredInteractions, autoAttemptOptions);
      
      // Register auto-attempts dynamically
      for (const autoAttempt of autoAttempts) {
        registerAttempt(autoAttempt);
      }

      console.log(`✅ Generated ${autoAttempts.length} auto-attempts`);
    } catch (autoErr) {
      console.log(`⚠️  Auto-attempt generation failed (non-critical): ${autoErr.message}`);
    }
  }

  const attemptResults = [];
  const flowResults = [];

  // Determine attempts to run (manual + auto-generated)
  let attemptsToRun = Array.isArray(attempts) ? attempts.slice() : getDefaultAttemptIds();
  
  // Phase 2: Add auto-generated attempts
  if (enableAutoAttempts && autoAttempts.length > 0) {
    const autoAttemptIds = autoAttempts.map(a => a.attemptId);
    attemptsToRun.push(...autoAttemptIds);
    console.log(`➕ Added ${autoAttemptIds.length} auto-generated attempts`);
  }

  if (includeUniversal && !attemptsToRun.includes('universal_reality')) {
    attemptsToRun.push('universal_reality');
  }
  // If discovery enabled and site is simple (few interactions), add universal pack
  if (enableDiscovery && discoveryResult && !attemptsToRun.includes('universal_reality')) {
    const simpleSite = (discoveryResult.interactionsDiscovered || 0) === 0 || (discoveryResult.pagesVisitedCount || 0) <= 1;
    if (simpleSite) {
      attemptsToRun.push('universal_reality');
      console.log(`➕ Added Universal Reality Pack (simple site detected)`);
    }
  }

  // Execute all registered attempts
  console.log(`\n🎬 Executing attempts...`);
  for (const attemptId of attemptsToRun) {
    const attemptDef = getAttemptDefinition(attemptId);
    if (!attemptDef) {
      throw new Error(`Attempt ${attemptId} not found in registry`);
    }

    console.log(`  • ${attemptDef.name}...`);
    const attemptArtifactsDir = path.join(runDir, attemptId);
    const result = await executeAttempt({
      baseUrl,
      attemptId,
      artifactsDir: attemptArtifactsDir,
      headful,
      enableTrace,
      enableScreenshots
    });

    attemptResults.push({
      attemptId,
      attemptName: attemptDef.name,
      goal: attemptDef.goal,
      riskCategory: attemptDef.riskCategory || 'UNKNOWN',
      source: attemptDef.source || 'manual',
      ...result
    });

  }

  // Phase 3: Execute intent flows (deterministic, curated)
  if (enableFlows) {
    console.log(`\n🎯 Executing intent flows...`);
    const flowExecutor = new GuardianFlowExecutor({
      timeout,
      screenshotOnStep: enableScreenshots,
      ...flowOptions
    });
    const browser = new GuardianBrowser();

    try {
      await browser.launch(timeout);
      for (const flowId of (Array.isArray(flows) && flows.length ? flows : getDefaultFlowIds())) {
        const flowDef = getFlowDefinition(flowId);
        if (!flowDef) {
          console.warn(`⚠️  Flow ${flowId} not found, skipping`);
          continue;
        }

        console.log(`  • ${flowDef.name}...`);
        const flowArtifactsDir = path.join(runDir, 'flows', flowId);
        fs.mkdirSync(flowArtifactsDir, { recursive: true });

        const flowResult = await flowExecutor.executeFlow(browser.page, flowDef, flowArtifactsDir, baseUrl);
        flowResults.push({
          flowId,
          flowName: flowDef.name,
          riskCategory: flowDef.riskCategory || 'TRUST/UX',
          description: flowDef.description,
          outcome: flowResult.success ? 'SUCCESS' : 'FAILURE',
          stepsExecuted: flowResult.stepsExecuted,
          stepsTotal: flowResult.stepsTotal,
          durationMs: flowResult.durationMs,
          failedStep: flowResult.failedStep,
          error: flowResult.error,
          screenshots: flowResult.screenshots,
          source: 'flow'
        });
      }
    } catch (flowErr) {
      console.warn(`⚠️  Flow execution failed (non-critical): ${flowErr.message}`);
    } finally {
      await browser.close().catch(() => {});
    }
  }

  // Generate market report (existing flow)
  const reporter = new MarketReporter();
  const report = reporter.createReport({
    runId,
    baseUrl,
    attemptsRun: attemptsToRun,
    results: attemptResults.map(r => ({
      attemptId: r.attemptId,
      attemptName: r.attemptName,
      goal: r.goal,
      outcome: r.outcome,
      exitCode: r.exitCode,
      totalDurationMs: r.attemptResult ? r.attemptResult.totalDurationMs : null,
      friction: r.friction,
      steps: r.steps,
      reportJsonPath: r.reportJsonPath,
      reportHtmlPath: r.reportHtmlPath
    })),
    flows: flowResults
  });

  const jsonPath = reporter.saveJsonReport(report, runDir);
  const html = reporter.generateHtmlReport(report);
  const htmlPath = reporter.saveHtmlReport(html, runDir);

  // Add market report paths to snapshot
  snapshotBuilder.addMarketResults(
    {
      attemptResults,
      marketJsonPath: jsonPath,
      marketHtmlPath: htmlPath,
      flowResults
    },
    runDir
  );

  // Phase 2: Compute market risk summary
  const riskSummary = computeMarketRiskSummary(attemptResults);
  snapshotBuilder.snapshot.riskSummary = riskSummary;

  // Handle baseline: load existing or auto-create
  console.log(`\n📊 Baseline check...`);
  let baselineCreated = false;
  let baselineSnapshot = null;
  let diffResult = null;

  if (baselineExists(baseUrl, storageDir)) {
    console.log(`✅ Baseline found`);
    baselineSnapshot = loadBaseline(baseUrl, storageDir);
    snapshotBuilder.setBaseline({
      baselineFound: true,
      baselineCreatedThisRun: false,
      baselinePath: path.join(storageDir, 'baselines', require('./baseline-storage').urlToSlug(baseUrl), 'baseline.json')
    });

    // Compare current against baseline
    diffResult = compareSnapshots(baselineSnapshot, snapshotBuilder.getSnapshot());
    snapshotBuilder.addDiff(diffResult);

    if (diffResult.regressions && Object.keys(diffResult.regressions).length > 0) {
      console.log(`⚠️  Regressions detected: ${Object.keys(diffResult.regressions).join(', ')}`);
    }
    if (diffResult.improvements && Object.keys(diffResult.improvements).length > 0) {
      console.log(`✨ Improvements: ${Object.keys(diffResult.improvements).join(', ')}`);
    }
  } else {
    // Auto-create baseline on first run
    console.log(`💾 Baseline not found - creating auto-baseline...`);
    const newBaseline = createBaselineFromSnapshot(snapshotBuilder.getSnapshot());
    await saveBaselineAtomic(baseUrl, newBaseline, storageDir);
    baselineCreated = true;
    baselineSnapshot = newBaseline;

    snapshotBuilder.setBaseline({
      baselineFound: false,
      baselineCreatedThisRun: true,
      baselineCreatedAt: new Date().toISOString(),
      baselinePath: path.join(storageDir, 'baselines', require('./baseline-storage').urlToSlug(baseUrl), 'baseline.json')
    });

    console.log(`✅ Baseline created`);
  }

  // Analyze market impact (Phase 3)
  console.log(`\n📊 Analyzing market criticality...`);
  const currentSnapshot = snapshotBuilder.getSnapshot();
  const marketImpact = analyzeMarketImpact(
    [
      ...currentSnapshot.attempts,
      ...(flowResults.map(f => ({
        attemptId: f.flowId,
        outcome: f.outcome,
        riskCategory: f.riskCategory,
        validators: [],
        friction: { signals: [] },
        pageUrl: baseUrl
      })) || [])
    ],
    baseUrl
  );
  snapshotBuilder.setMarketImpactSummary(marketImpact);
  console.log(`✅ Market impact analyzed: ${marketImpact.highestSeverity} severity`);

  // Phase 4: Add breakage intelligence (deterministic failure analysis)
  const intelligence = aggregateIntelligence(attemptResults, flowResults);
  snapshotBuilder.addIntelligence(intelligence);
  if (intelligence.escalationSignals.length > 0) {
    console.log(`🚨 Escalation signals: ${intelligence.escalationSignals.slice(0, 3).join('; ')}`);
  }

  // Save snapshot itself
  console.log(`\n💾 Saving snapshot...`);
  const snapshotPath = path.join(runDir, 'snapshot.json');
  await saveSnapshot(snapshotBuilder.getSnapshot(), snapshotPath);
  console.log(`✅ Snapshot saved: snapshot.json`);

  // Phase 6: Generate enhanced HTML report
  try {
    const enhancedHtmlPath = writeEnhancedHtml(snapshotBuilder.getSnapshot(), runDir);
    console.log(`✅ Enhanced HTML report: ${path.basename(enhancedHtmlPath)}`);
  } catch (htmlErr) {
    console.warn(`⚠️  Enhanced HTML report failed (non-critical): ${htmlErr.message}`);
  }

  // Phase 5/6: Evaluate policy
  let policyEval = null;
  if (policy) {
    try {
      const policyObj = parsePolicyOption(policy);
      if (policyObj) {
        console.log(`\n🛡️  Evaluating policy...`);
        policyEval = evaluatePolicy(snapshotBuilder.getSnapshot(), policyObj);
        console.log(`Policy: ${policyEval.passed ? '✅ PASSED' : '❌ FAILED'}`);
        if (!policyEval.passed && policyEval.reasons) {
          policyEval.reasons.slice(0, 3).forEach(r => console.log(`  • ${r}`));
        }
      }
    } catch (policyErr) {
      console.warn(`⚠️  Policy evaluation failed (non-critical): ${policyErr.message}`);
    }
  }

  // Phase 5/6: Send webhook notifications
  if (webhook) {
    try {
      const webhookUrl = getWebhookUrl('GUARDIAN_WEBHOOK_URL', webhook);
      if (webhookUrl) {
        console.log(`\n📡 Sending webhook notifications...`);
        const payload = buildWebhookPayload(
          snapshotBuilder.getSnapshot(),
          policyEval,
          { snapshotPath, marketJsonPath: jsonPath, marketHtmlPath: htmlPath }
        );
        const urls = webhookUrl.split(',').map(u => u.trim());
        await sendWebhooks(urls, payload);
        console.log(`✅ Webhook notifications sent`);
      }
    } catch (webhookErr) {
      console.warn(`⚠️  Webhook notification failed (non-critical): ${webhookErr.message}`);
    }
  }

  // Determine exit code (including market criticality escalation + policy)
  let exitCode = 0;
  const finalSnapshot = snapshotBuilder.getSnapshot();

  if (baselineCreated) {
    // First run: check market criticality
    exitCode = 0;
    if (marketImpact.highestSeverity === 'CRITICAL') {
      console.log(`🚨 First run with CRITICAL market risks`);
      exitCode = 1;
    } else if (marketImpact.highestSeverity === 'WARNING') {
      console.log(`⚠️  First run with WARNING market risks`);
      exitCode = 2;
    }
    console.log(`✅ Baseline created`);
  } else if (baselineSnapshot) {
    // Subsequent runs: check for regressions + severity escalation
    const baselineSeverity = baselineSnapshot.marketImpactSummary?.highestSeverity || 'INFO';
    const currentSeverity = marketImpact.highestSeverity;
    const escalation = determineExitCodeFromEscalation(baselineSeverity, currentSeverity);

    if (escalation.escalated) {
      // Severity escalation is a FAILURE
      exitCode = 1;
      console.log(`🚨 Severity escalated: ${baselineSeverity} → ${currentSeverity}`);
    } else if (diffResult && Object.keys(diffResult.regressions).length > 0) {
      exitCode = 1;
      console.log(`❌ Regressions detected`);
    } else if (currentSeverity !== 'INFO') {
      // Still have market risks but didn't escalate
      exitCode = 2;
      console.log(`⚠️  ${currentSeverity} market risks present`);
    } else {
      exitCode = 0;
      console.log(`✅ No critical changes`);
    }
  }

  // Override exit code if policy failed
  if (policyEval && !policyEval.passed) {
    exitCode = policyEval.exitCode || 1;
    console.log(`🛡️  Policy override: exit code ${exitCode}`);
  }

  return {
    exitCode,
    report,
    runDir,
    snapshotPath,
    marketJsonPath: jsonPath,
    marketHtmlPath: htmlPath,
    attemptResults,
    flowResults,
    baselineCreated,
    diffResult,
    snapshot: finalSnapshot,
    policyEval
  };
}

async function runRealityCLI(config) {
  try {
    const result = await executeReality(config);

    // Phase 6: Print enhanced CLI summary
    printCliSummary(result.snapshot, result.policyEval);

    process.exit(result.exitCode);
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

/**
 * Phase 2: Compute market risk summary from attempt results
 * Deterministic scoring based on attempt outcomes and risk categories
 */
function computeMarketRiskSummary(attemptResults) {
  const summary = {
    totalSoftFailures: 0,
    totalFriction: 0,
    totalFailures: 0,
    failuresByCategory: {},
    softFailuresByAttempt: {},
    topRisks: []
  };

  // Categorize failures
  for (const attempt of attemptResults) {
    const category = attempt.riskCategory || 'UNKNOWN';
    if (!summary.failuresByCategory[category]) {
      summary.failuresByCategory[category] = { failures: 0, friction: 0, softFailures: 0 };
    }

    // Count outcomes
    if (attempt.outcome === 'FAILURE') {
      summary.totalFailures++;
      summary.failuresByCategory[category].failures++;
    } else if (attempt.outcome === 'FRICTION') {
      summary.totalFriction++;
      summary.failuresByCategory[category].friction++;
    }

    // Count soft failures (Phase 2)
    if (attempt.softFailureCount > 0) {
      summary.totalSoftFailures += attempt.softFailureCount;
      summary.failuresByCategory[category].softFailures += attempt.softFailureCount;
      summary.softFailuresByAttempt[attempt.attemptId] = attempt.softFailureCount;
    }
  }

  // Build top risks (sorted by severity)
  const riskList = [];
  for (const [category, counts] of Object.entries(summary.failuresByCategory)) {
    if (counts.failures > 0 || counts.friction > 0 || counts.softFailures > 0) {
      riskList.push({
        category,
        severity: counts.failures > 0 ? 'CRITICAL' : 'MEDIUM',
        failures: counts.failures,
        frictionCount: counts.friction,
        softFailures: counts.softFailures
      });
    }
  }

  summary.topRisks = riskList.sort((a, b) => {
    // CRITICAL before MEDIUM
    if (a.severity !== b.severity) {
      return a.severity === 'CRITICAL' ? -1 : 1;
    }
    // Then by failure count
    return (b.failures + b.softFailures) - (a.failures + a.softFailures);
  });

  return summary;
}

module.exports = { executeReality, runRealityCLI };