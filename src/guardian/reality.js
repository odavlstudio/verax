/**
 * Reality.js — Guardian's Main Orchestrator
 * 
 * RESPONSIBILITY:
 * - Orchestrate the full Guardian decision pipeline (Observe → Decide → Act → Verify)
 * - Execute user-specified attempts and flows against a target website
 * - Synthesize observations into a final verdict (READY, FRICTION, DO_NOT_LAUNCH, OBSERVED, PARTIAL, INSUFFICIENT_DATA)
 * - Persist artifacts (snapshot.json, decision.json, summary.txt, market-report.html, manifest.json)
 * - Enforce honesty contract (only claim what was tested)
 * - Merge policy evaluation + rules engine verdict + journey outcomes
 *
 * MAIN ENTRY POINTS:
 * - runRealityCLI(config): High-level CLI wrapper with environment guard and error handling
 * - executeReality(config): Core orchestration (Observe/Decide/Act/Verify phases, async)
 *
 * PURE FUNCTIONS:
 * - computeFinalVerdict(): Merge rules + policy + journey into canonical verdict
 * - buildRealityExplanation(): Build human-readable verdict explanation
 * - calculateCoverage(): Compute attempt coverage metrics
 * - computeMarketRiskSummary(): Score risk by risk category
 * - computeFlowExitCode(): Map flow results to exit code
 * - applySafeDefaults(): Apply config fallback defaults
 * - writeDecisionArtifact(): Serialize decision.json
 * - writeRunSummary(): Serialize summary.txt + summary.md
 * - hashFile(), writeIntegrityManifest(): Build SHA256 manifest
 *
 * INVARIANTS (MUST PRESERVE):
 * - Exit codes: 0=success, 1=friction, 2=do-not-launch
 * - decision.json schema (runId, url, timestamp, finalVerdict, exitCode, reasons, audit, honestyContract)
 * - Artifact file names and locations (snapshot.json, decision.json, summary.txt, market-report.html)
 * - Attempt/flow execution order (sequential, preserved from config)
 * - Journey context state propagation across attempts
 * - Honesty contract enforcement (only claim tested scope)
 * - Policy signal structure (required by policy engine + rules engine)
 */

// ============================================================================
// DEPENDENCIES: Core utilities
// ============================================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================================
// DEPENDENCIES: Guardian modules — Execution
// ============================================================================
const { executeAttempt } = require('./attempt');
const { GuardianBrowser } = require('./browser');
const { GuardianCrawler } = require('./crawler');
const { DiscoveryEngine } = require('./discovery-engine');
const { buildAutoAttempts } = require('./auto-attempt-builder');
const { GuardianFlowExecutor, validateFlowDefinition } = require('./flow-executor');
const { HumanJourneyContext } = require('./human-journey-context');
const { BrowserPool } = require('./browser-pool');
const { checkPrerequisites } = require('./prerequisite-checker');

// ============================================================================
// DEPENDENCIES: Guardian modules — Observation & Analysis
// ============================================================================
const { SnapshotBuilder, saveSnapshot } = require('./snapshot');
const { GuardianBrowser: _GuardianBrowser } = require('./browser'); // For analyzeSite
const { analyzeSite, isFlowApplicable, SITE_TYPES } = require('./site-intelligence');
const { extractObservedCapabilities, filterAttemptsByObservedCapabilities, filterFlowsByObservedCapabilities, createNotApplicableAttemptResult, createNotApplicableFlowResult } = require('./observed-capabilities');
const { inspectSite, detectProfile } = require('./site-introspection');
const { filterAttempts: filterAttemptsByRelevance, summarizeIntrospection } = require('./attempt-relevance');
const { resolveHumanIntent, shouldExecuteAttempt } = require('./human-intent-resolver');
const { findContactOnPage, formatDetectionForReport } = require('./semantic-contact-finder');
const { analyzeMarketImpact } = require('./market-criticality');
const { aggregateIntelligence } = require('./breakage-intelligence');

// ============================================================================
// DEPENDENCIES: Guardian modules — Configuration & Filtering
// ============================================================================
const { getDefaultAttemptIds, getAttemptDefinition, registerAttempt } = require('./attempt-registry');
const { getDefaultFlowIds, getFlowDefinition } = require('./flow-registry');
const { validateAttemptFilter, filterAttempts, filterFlows } = require('./attempts-filter');
const { getTimeoutProfile } = require('./timeout-profiles');
const { validateParallel } = require('./parallel-executor');
const { parsePolicyOption } = require('./preset-loader');
const { applyLocalConfig } = require('./config-loader');
const { mergeCoveragePack } = require('./coverage-packs');

// ============================================================================
// DEPENDENCIES: Guardian modules — Baseline & Artifacts
// ============================================================================
const { baselineExists, loadBaseline, saveBaselineAtomic, createBaselineFromSnapshot, compareSnapshots } = require('./baseline-storage');
const { makeRunDirName, makeSiteSlug, writeMetaJson, readMetaJson } = require('./run-artifacts');
const { updateLatestGlobal, updateLatestBySite } = require('./run-latest');
const { MarketReporter } = require('./market-reporter');
const { sanitizeArtifact } = require('./artifact-sanitizer');
const { writeEnhancedHtml } = require('./enhanced-html-reporter');

// ============================================================================
// DEPENDENCIES: Guardian modules — Decision & Verdict
// ============================================================================
const { evaluatePolicy, loadPolicy } = require('./policy');
const { loadRules, evaluateRules, buildPolicySignals } = require('./rules-engine');
const { computeFinalOutcome } = require('./final-outcome');
const { normalizeCanonicalVerdict, toCanonicalVerdict, mapExitCodeFromCanonical, toInternalVerdict } = require('./verdicts');
const { buildHonestyContract, enforceHonestyInVerdict, validateHonestyContract } = require('./honesty');
const { evaluatePrelaunchGate, writeReleaseDecisionArtifact } = require('./prelaunch-gate');

// ============================================================================
// DEPENDENCIES: Guardian modules — Reporting & Output
// ============================================================================
const { createCanonicalOutput } = require('./output-contract');
const { printVerdictClarity, extractTopReasons, buildObservationClarity, getVerdictExplanation } = require('./verdict-clarity');
const { printUnifiedOutput } = require('./output-readability');
const { deriveActionHints, formatHintsForCLI, formatHintsForSummary } = require('./action-hints');
const { sendWebhooks, getWebhookUrl, buildWebhookPayload } = require('./webhook');
const { isCiMode } = require('./ci-mode');
const { formatCiSummary } = require('./ci-output');

// ============================================================================
// DEPENDENCIES: Environment & Lifecycle
// ============================================================================
const packageJson = require('../../package.json');
const { isFirstRun, markFirstRunComplete, applyFirstRunProfile } = require('./first-run-profile');
const { printFirstRunIntroIfNeeded } = require('./first-run');

// ============================================================================
// CONSTANTS & HELPER PREDICATES
// ============================================================================

/** Set of outcomes that indicate an attempt was executed (not skipped) */
const EXECUTED_OUTCOMES = new Set(['SUCCESS', 'FAILURE', 'FRICTION', 'DISCOVERY_FAILED']);

/** Predicate: true if attempt result has one of EXECUTED_OUTCOMES */
const isExecutedAttempt = (attemptResult) => attemptResult && EXECUTED_OUTCOMES.has(attemptResult.outcome);

/** Skip reason codes — used for auditability and coverage classification */
const SKIP_CODES = {
  DISABLED_BY_PRESET: 'DISABLED_BY_PRESET',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  ENGINE_MISSING: 'ENGINE_MISSING',
  USER_FILTERED: 'USER_FILTERED',
  PREREQ: 'PREREQUISITE_FAILED',
  HUMAN_INTENT_MISMATCH: 'HUMAN_INTENT_MISMATCH'
};

// ============================================================================
// PURE FUNCTIONS: Config Processing
// ============================================================================

/**
 * Apply safe defaults to config.
 * - If no attempts array provided, use defaults
 * - If flows property is undefined/null, use defaults; if explicitly [], respect that choice
 * @param {object} config - Configuration object
 * @param {function} warn - Optional warning logger
 * @returns {object} Updated config with defaults applied
 */
function applySafeDefaults(config, warn) {
  const updated = { ...config };
  if (!Array.isArray(updated.attempts) || updated.attempts.length === 0) {
    if (warn) warn('No attempts provided; using curated defaults.');
    updated.attempts = getDefaultAttemptIds();
  }
  // PHASE 9: Only apply flow defaults if flows property is completely missing (undefined/null)
  // If flows is explicitly set to [] (empty array), respect that choice
  if (updated.flows === undefined || updated.flows === null) {
    if (warn) warn('No flows provided; using curated defaults.');
    updated.flows = getDefaultFlowIds();
  } else if (!Array.isArray(updated.flows)) {
    // If flows exists but is not an array, normalize to empty array
    updated.flows = [];
  }
  return updated;
}

// ============================================================================
// PURE FUNCTIONS: Coverage Calculation
// ============================================================================

/**
 * Calculate attempt coverage metrics.
 * Takes into account enabled/disabled/skipped/executed attempts
 * and returns coverage percentage, gap count, and skip details.
 * @returns {object} { coverage: {...}, denominator, numerator }
 */
function calculateCoverage({ attemptStats, skippedNotApplicable = [], skippedMissing = [], skippedUserFiltered = [], skippedDisabledByPreset = [] }) {
  const enabledPlannedCount = attemptStats.enabledPlannedCount || 0;
  const executedCount = attemptStats.executed || 0;
  const userFilteredCount = skippedUserFiltered.length;
  const notApplicableCount = skippedNotApplicable.length;
  const coverageDenominator = Math.max(enabledPlannedCount - userFilteredCount - notApplicableCount, 0);
  const coverageNumerator = executedCount;
  const coverageGaps = Math.max(coverageDenominator - coverageNumerator, 0);

  const coverage = {
    gaps: coverageGaps,
    executed: coverageNumerator,
    total: coverageDenominator,
    details: attemptStats.skippedDetails,
    disabled: attemptStats.disabledDetails,
    skippedDisabledByPreset: skippedDisabledByPreset.map(a => ({ attempt: a.attemptId, reason: a.skipReason || 'Disabled by preset', code: SKIP_CODES.DISABLED_BY_PRESET })),
    skippedNotApplicable: skippedNotApplicable.map(a => ({ attempt: a.attemptId, reason: a.skipReason })),
    skippedMissing: skippedMissing.map(a => ({ attempt: a.attemptId, reason: a.skipReason })),
    skippedUserFiltered: skippedUserFiltered.map(a => ({ attempt: a.attemptId, reason: a.skipReason })),
    counts: {
      executedCount: coverageNumerator,
      enabledPlannedCount,
      disabledPlannedCount: attemptStats.disabledPlannedCount || 0,
      skippedDisabledByPreset: skippedDisabledByPreset.length,
      skippedUserFiltered: userFilteredCount,
      skippedNotApplicable: notApplicableCount,
      skippedMissing: skippedMissing.length,
      excludedNotApplicableFromTotal: notApplicableCount
    }
  };

  return { coverage, denominator: coverageDenominator, numerator: coverageNumerator };
}

// ============================================================================
// ORCHESTRATION: Main Guardian Decision Pipeline
// ============================================================================

/**
 * CORE ORCHESTRATOR: Full Guardian decision pipeline
 * 
 * PHASES:
 * 1. Config & Init — Apply defaults, validate baseUrl, create run directory
 * 2. Site Crawl & Introspection — Discover URLs, detect capabilities, classify site type
 * 3. Optional Discovery — Find interactions for auto-attempt generation
 * 4. Attempt Selection — Filter by preset, user, relevance, human intent
 * 5. Attempt Execution — Sequential execution with journey context adaptation
 * 6. Flow Execution — Execute curated intent flows
 * 7. Baseline & Diff — Compare against baseline, detect regressions
 * 8. Market Impact & Intelligence — Risk scoring and pattern analysis
 * 9. Policy & Verdict — Evaluate policy, merge with rules engine, compute honesty contract
 * 10. Manifest & Attestation — Build SHA256 hashes and cryptographic attestation
 * 11. Pre-Launch Gate — Optional blocking on safety signals
 * 12. Webhook & Reporting — Send notifications, update latest pointers, mark first-run complete
 * 
 * @async
 * @param {object} config - Guardian configuration object
 * @returns {object} Canonical output with verdict, exitCode, artifacts, and legacy fields
 * @throws {Error} On critical failures (invalid URL, policy load error, env check failed)
 */
async function executeReality(config) {
  const baseWarn = (...args) => console.warn(...args);
  const firstRunMode = isFirstRun();
  
  // Display first-run welcome message if applicable
  // Uses existing first-run module which handles CI/quiet/TTY detection
  printFirstRunIntroIfNeeded(config, process.argv.slice(2));
  
  // Apply first-run profile if needed (conservative defaults)
  const profiledConfig = firstRunMode ? applyFirstRunProfile(config) : config;
  const safeConfig = applySafeDefaults(profiledConfig, baseWarn);
  const runSignals = [];

  const {
    baseUrl,
    attempts = getDefaultAttemptIds(),
    artifactsDir = './.odavlguardian',
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
    toolVersion = packageJson.version,
    policy = null,
    webhook = null,
    includeUniversal = false,
    autoAttemptOptions = {},
    enableFlows = true,
    flows = getDefaultFlowIds(),
    flowOptions = {},
    // Phase 7.1: Performance modes
    timeoutProfile = 'default',
    failFast = false,
    fast = false,
    attemptsFilter = null,
    // Phase 7.2: Parallel execution
    parallel = 1
    ,
    // Pre-launch gate
    prelaunch = false,
    prelaunchAllowFriction = false
  } = safeConfig;

  // Phase 7.1: Validate and apply attempts filter
  let validation = null;
  if (attemptsFilter) {
    validation = validateAttemptFilter(attemptsFilter);
    if (!validation.valid) {
      const error = new Error(validation.error);
      if (validation.hint) error.hint = validation.hint;
      throw error;
    }
  }

  // Phase 7.2: Validate parallel value
  const parallelValidation = validateParallel(parallel);
  if (!parallelValidation.valid) {
    const error = new Error(parallelValidation.error);
    if (parallelValidation.hint) error.hint = parallelValidation.hint;
    throw error;
  }
  const validatedParallel = parallelValidation.parallel || 1;

  // Phase 7.1: Filter attempts and flows
  let filteredAttempts = attempts;
  let filteredFlows = flows;
  const userFilteredAttempts = [];
  if (attemptsFilter && validation && validation.valid && validation.ids.length > 0) {
    const beforeFilter = Array.isArray(filteredAttempts) ? filteredAttempts.slice() : [];
    filteredAttempts = filterAttempts(attempts, validation.ids);
    filteredFlows = filterFlows(flows, validation.ids);
    const removed = beforeFilter.filter(id => !filteredAttempts.includes(id));
    userFilteredAttempts.push(...removed.map(id => ({ attemptId: id, reason: 'Filtered by --attempts' })));
    if (filteredAttempts.length === 0 && filteredFlows.length === 0) {
      const error = new Error('No matching attempts or flows found after filtering');
      error.hint = `Check your --attempts filter: ${attemptsFilter}`;
      throw error;
    }
  }

  let requestedAttempts = Array.isArray(filteredAttempts) ? filteredAttempts.slice() : [];
  const disabledByPreset = new Set((config.disabledAttempts || []).map(id => String(id)));
  let enabledRequestedAttempts = requestedAttempts.filter(id => !disabledByPreset.has(String(id)));
  const presetDisabledAttempts = requestedAttempts.filter(id => disabledByPreset.has(String(id)));
  const missingAttempts = [];

  // Phase 7.1: Resolve timeout profile
  const timeoutProfileConfig = getTimeoutProfile(timeoutProfile);
  const resolvedTimeout = timeout || timeoutProfileConfig.default;

  // Validate baseUrl
  try {
    new URL(baseUrl);
  } catch (_e) {
    throw new Error(`Invalid URL: ${baseUrl}`);
  }

  // Wave 1: Generate human-readable run directory name
  const startTime = new Date();
  const siteSlug = makeSiteSlug(baseUrl);
  // Use 'default' if no policy specified, otherwise extract preset name
  let policyName = (() => {
    if (!policy) return 'default';
    if (typeof policy === 'string') {
      return policy.startsWith('preset:') ? policy.replace('preset:', '') : policy;
    }
    if (typeof policy === 'object' && policy.id) return policy.id;
    return 'custom';
  })();
  // Result will be determined at the end; use placeholder for now
  let runDirName = makeRunDirName({
    timestamp: startTime,
    url: baseUrl,
    policy: policyName,
    result: 'PENDING'
  });
  // Normalize artifacts directory to avoid undefined/null paths from CLI/config
  const safeArtifactsDir = (typeof artifactsDir === 'string' && artifactsDir.trim().length > 0)
    ? artifactsDir
    : './.odavlguardian';

  let runDir = path.join(safeArtifactsDir, runDirName);
  fs.mkdirSync(runDir, { recursive: true });
  const runId = runDirName;
  const ciMode = isCiMode();

  // Print positioning message based on policy
  const isPolicyProtect = policy && ((typeof policy === 'string' && (policy === 'preset:startup' || policy.includes('startup'))) || (typeof policy === 'object' && policy.id === 'startup'));
  if (!ciMode) {
    if (isPolicyProtect) {
      console.log('\nPROTECT MODE: Full market reality test (slower, deeper)');
    } else {
      console.log('\nREALITY MODE: Full market reality snapshot');
    }
  } else {
    if (isPolicyProtect) {
      console.log('PROTECT MODE: Full market reality test');
    } else {
      console.log('REALITY MODE: Full market reality snapshot');
    }
  }

  // Phase 7.1: Print mode info
  if (!ciMode) {
    const modeLines = [];
    if (fast) modeLines.push('MODE: fast');
    if (failFast) modeLines.push('FAIL-FAST: enabled');
    if (timeoutProfile !== 'default') modeLines.push(`TIMEOUT: ${timeoutProfile}`);
    if (attemptsFilter) modeLines.push(`ATTEMPTS: ${attemptsFilter}`);
    if (modeLines.length > 0) {
      console.log(`\n⚡ ${modeLines.join(' | ')}`);
    }
  }

  if (ciMode) {
    console.log(`\nCI RUN: Market Reality Snapshot`);
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Attempts: ${filteredAttempts.join(', ')}`);
    console.log(`Run Dir: ${runDir}`);
  } else if (firstRunMode) {
    // Simplified output for first run
    console.log(`\n🚀 Guardian First Run`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🧪 Scanning: ${baseUrl}`);
  } else {
    console.log(`\n🧪 Market Reality Snapshot v1`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📍 Base URL: ${baseUrl}`);
    console.log(`🎯 Attempts: ${filteredAttempts.join(', ')}`);
    console.log(`📁 Run Dir: ${runDir}`);
  }

  // Initialize snapshot builder
  const snapshotBuilder = new SnapshotBuilder(baseUrl, runId, toolVersion);
  snapshotBuilder.setArtifactDir(runDir);

  let crawlResult = null;
  let discoveryResult = null;
  let contactDetectionResult = null;
  let siteIntrospection = null;
  let siteProfile = 'unknown';

  // Optional: Crawl to discover URLs (lightweight, first N pages)
  if (enableCrawl) {
    console.log(`\n🔍 Crawling for discovered URLs...`);
    const browser = new GuardianBrowser();
    try {
      await browser.launch(resolvedTimeout);
      await browser.page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: resolvedTimeout });

      // Wave 3: Site introspection for smart attempt selection
      try {
        console.log(`\n🔬 Inspecting site capabilities...`);
        siteIntrospection = await inspectSite(browser.page);
        siteProfile = detectProfile(siteIntrospection);
        const summary = summarizeIntrospection(siteIntrospection);
        console.log(`✅ Site profile: ${siteProfile}`);
        console.log(`   ${summary}`);
      } catch (introspectionErr) {
        console.warn(`⚠️  Site introspection failed (non-critical): ${introspectionErr.message}`);
        // Default to empty introspection if it fails
        siteIntrospection = {
          hasLogin: false,
          hasSignup: false,
          hasCheckout: false,
          hasNewsletter: false,
          hasContactForm: false,
          hasLanguageSwitch: false
        };
        siteProfile = 'unknown';
      }
      // Wave 1.1: Detect page language and contact
      try {
        contactDetectionResult = await findContactOnPage(browser.page, baseUrl);
        console.log(`\n${formatDetectionForReport(contactDetectionResult)}\n`);
      } catch (detectionErr) {
        // Language/contact detection non-critical
        console.warn(`⚠️  Language/contact detection failed: ${detectionErr.message}`);
      }

      const crawler = new GuardianCrawler(baseUrl, maxPages, maxDepth);
      crawlResult = await crawler.crawl(browser);
      console.log(`✅ Crawl complete: discovered ${crawlResult.totalDiscovered}, visited ${crawlResult.totalVisited}`);
      snapshotBuilder.addCrawlResults(crawlResult);
      await browser.close();
    } catch (crawlErr) {
      console.log(`⚠️  Crawl failed (non-critical): ${crawlErr.message}`);
      runSignals.push({ id: 'crawl_failed', severity: 'high', type: 'coverage', description: `Crawl failed: ${crawlErr.message}` });
      // Continue anyway - crawl is optional
    }
  }

  // Wave 3: If crawl was disabled but introspection wasn't done, do it now
  if (!enableCrawl && !siteIntrospection) {
    console.log(`\n🔬 Inspecting site capabilities...`);
    const browser = new GuardianBrowser();
    try {
      await browser.launch(resolvedTimeout);
      await browser.page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: resolvedTimeout });
      
      siteIntrospection = await inspectSite(browser.page);
      siteProfile = detectProfile(siteIntrospection);
      const summary = summarizeIntrospection(siteIntrospection);
      console.log(`✅ Site profile: ${siteProfile}`);
      console.log(`   ${summary}`);
      
      await browser.close();
    } catch (introspectionErr) {
      console.warn(`⚠️  Site introspection failed (non-critical): ${introspectionErr.message}`);
      siteIntrospection = {
        hasLogin: false,
        hasSignup: false,
        hasCheckout: false,
        hasNewsletter: false,
        hasContactForm: false,
        hasLanguageSwitch: false
      };
      siteProfile = 'unknown';
    }
  }

  // Apply intent-aligned coverage packs based on detected site profile
  const coveragePackProfile = siteProfile === 'unknown' && siteIntrospection?.hasContactForm
    ? 'landing'
    : siteProfile;
  if (coveragePackProfile && coveragePackProfile !== 'unknown') {
    const { attempts: updatedRequested, added } = mergeCoveragePack(requestedAttempts, coveragePackProfile, { disabledByPreset });
    requestedAttempts = updatedRequested;
    if (added.length > 0) {
      enabledRequestedAttempts = mergeCoveragePack(enabledRequestedAttempts, coveragePackProfile, { disabledByPreset }).attempts;
      if (!ciMode) {
        console.log(`\n➕ Added ${added.length} attempt(s) from ${coveragePackProfile} coverage pack`);
      }
    }
  }

  // Optional: Discovery Engine (Phase 4) — deterministic safe exploration
  if (enableDiscovery) {
    console.log(`\n🔎 Running discovery engine...`);
    const browser = new GuardianBrowser();
    try {
      await browser.launch(resolvedTimeout);
      const engine = new DiscoveryEngine({
        baseUrl,
        maxPages,
        timeout: resolvedTimeout,
        executeInteractions: false,
        browser,
      });
      discoveryResult = await engine.discover(browser.page);
      snapshotBuilder.setDiscoveryResults(discoveryResult);
      console.log(`✅ Discovery complete: visited ${discoveryResult.pagesVisitedCount}, interactions ${discoveryResult.interactionsDiscovered}`);
      await browser.close();
    } catch (discErr) {
      console.log(`⚠️  Discovery failed (non-critical): ${discErr.message}`);
      runSignals.push({ id: 'discovery_failed', severity: 'high', type: 'discovery', description: `Discovery failed: ${discErr.message}` });
    }
  }

  // Phase 2: Generate auto-attempts from discovered interactions
  let autoAttempts = [];
  if (enableAutoAttempts && discoveryResult && discoveryResult.interactionsDiscovered > 0) {
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
  let attemptsToRun = enabledRequestedAttempts.slice();
  
  // Phase 2: Add auto-generated attempts
  if (enableAutoAttempts && autoAttempts.length > 0) {
    const autoAttemptIds = autoAttempts.map(a => a.attemptId);
    attemptsToRun.push(...autoAttemptIds);
    console.log(`➕ Added ${autoAttemptIds.length} auto-generated attempts`);
  }

  if (includeUniversal && !attemptsToRun.includes('universal_reality') && !disabledByPreset.has('universal_reality')) {
    attemptsToRun.push('universal_reality');
  }
  // If discovery enabled and site is simple (few interactions), add universal pack
  if (enableDiscovery && discoveryResult && !attemptsToRun.includes('universal_reality') && !disabledByPreset.has('universal_reality')) {
    const simpleSite = (discoveryResult.interactionsDiscovered || 0) === 0 || (discoveryResult.pagesVisitedCount || 0) <= 1;
    if (simpleSite) {
      attemptsToRun.push('universal_reality');
      console.log(`➕ Added Universal Reality Pack (simple site detected)`);
    }
  }

  // Phase 7.1: Apply attempts filter
  if (attemptsFilter && validation && validation.valid && validation.ids.length > 0) {
    attemptsToRun = filterAttempts(attemptsToRun, validation.ids);
  }

  // Wave 3: Apply smart attempt selection based on introspection
  let attemptsSkipped = [];
  if (siteIntrospection) {
    const attemptObjects = attemptsToRun.map(id => ({ id }));
    const relevanceResult = filterAttemptsByRelevance(attemptObjects, siteIntrospection);
    attemptsToRun = relevanceResult.toRun.map(a => a.id);
    attemptsSkipped = relevanceResult.toSkip;
    
    // IMPORTANT: Also update enabledRequestedAttempts to match
    const skippedAttemptIds = attemptsSkipped.map(s => s.attempt);
    enabledRequestedAttempts = enabledRequestedAttempts.filter(id => !skippedAttemptIds.includes(id));
    
    if (attemptsSkipped.length > 0 && !ciMode) {
      console.log(`\n⊘ Skipping ${attemptsSkipped.length} irrelevant attempt(s):`);
      for (const skip of attemptsSkipped) {
        console.log(`    • ${skip.attempt}: ${skip.reason}`);
      }
    }
  }

  // Human Intent Resolution: Determine what a real human would actually try on this site
  let humanIntentResolution = null;
  const attemptsBlockedByIntent = [];
  if (siteIntrospection) {
    humanIntentResolution = resolveHumanIntent({
      siteProfile,
      introspection: siteIntrospection,
      entryUrl: baseUrl
    });
    
    if (!ciMode) {
      console.log(`\n🧠 Human Intent Analysis:`);
      console.log(`   Primary goal: ${humanIntentResolution.primaryGoal} (confidence: ${Math.round(humanIntentResolution.confidence * 100)}%)`);
      if (humanIntentResolution.secondaryGoals.length > 0) {
        console.log(`   Secondary goals: ${humanIntentResolution.secondaryGoals.join(', ')}`);
      }
      console.log(`   Reasoning: ${humanIntentResolution.reasoning}`);
    }
    
    // Filter attempts based on human intent
    const attemptsAfterIntent = [];
    const attemptsBlockedByIntent = [];
    for (const attemptId of attemptsToRun) {
      const decision = shouldExecuteAttempt(attemptId, humanIntentResolution);
      if (decision.shouldExecute) {
        attemptsAfterIntent.push(attemptId);
      } else {
        attemptsBlockedByIntent.push({
          attempt: attemptId,
          reason: decision.reason,
          humanReason: decision.humanReason
        });
      }
    }
    
    attemptsToRun = attemptsAfterIntent;
    
    if (attemptsBlockedByIntent.length > 0 && !ciMode) {
      console.log(`\n🚫 Blocked by Human Intent (${attemptsBlockedByIntent.length} attempts):`);
      for (const blocked of attemptsBlockedByIntent) {
        console.log(`    • ${blocked.attempt}`);
        console.log(`      → ${blocked.humanReason}`);
      }
    }
    
    // Store human intent in snapshot
    snapshotBuilder.setHumanIntent(humanIntentResolution);
  }

  // Phase 7.2: Journey mode runs sequentially to keep shared state
  if (!ciMode && validatedParallel > 1) {
    console.log(`\n⚠️  Human Journey mode: forcing sequential execution (parallel request=${validatedParallel})`);
  }

  // Phase 7.3: Initialize browser pool (single browser per run)
  const browserPool = new BrowserPool();
  const browserOptions = {
    headless: !headful,
    args: !headful ? [] : [],
    timeout: resolvedTimeout
  };
  
  try {
    await browserPool.launch(browserOptions);
    if (!ciMode) {
      console.log(`🌐 Browser pool ready (reuse enabled)`);
    }
  } catch (err) {
    throw new Error(`Failed to launch browser pool: ${err.message}`);
  }

  // Human Journey Context (stateful across attempts)
  const journeyContext = new HumanJourneyContext({
    baseUrl,
    primaryGoal: humanIntentResolution?.primaryGoal || 'EXPLORE',
    secondaryGoals: humanIntentResolution?.secondaryGoals || [],
    intentConfidence: humanIntentResolution?.confidence || 0.3
  });

  // Execute attempts sequentially with adaptation
  console.log(`\n🎬 Executing attempts...`);
  const attemptQueue = [...attemptsToRun];
  const attemptedSet = new Set();

  while (attemptQueue.length > 0 && !journeyContext.shouldAbandonJourney()) {
    const attemptId = attemptQueue.shift();
    if (!attemptId || attemptedSet.has(attemptId)) {
      continue;
    }
    attemptedSet.add(attemptId);

    const attemptDef = getAttemptDefinition(attemptId);
    if (!attemptDef) {
      missingAttempts.push(attemptId);
      attemptResults.push({
        attemptId,
        attemptName: attemptId,
        goal: 'Unknown',
        riskCategory: 'UNKNOWN',
        source: 'manual',
        outcome: 'SKIPPED',
        skipReason: 'Attempt not registered',
        skipReasonCode: SKIP_CODES.ENGINE_MISSING,
        exitCode: 0,
        steps: [],
        friction: null,
        error: null
      });
      continue;
    }

    if (!ciMode) {
      console.log(`  • ${attemptDef.name}...`);
    }

    const attemptArtifactsDir = path.join(runDir, attemptId);
    const { context, page } = await browserPool.createContext({ timeout: resolvedTimeout });
    journeyContext.beforeAttempt(attemptId);

    let result;
    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: resolvedTimeout });

      // Phase 7.4: Check prerequisites before executing attempt
      const prereqCheck = await checkPrerequisites(page, attemptId, 2000);
      if (!prereqCheck.canProceed) {
        if (!ciMode) {
          console.log(`    ⊘ Skipped: ${prereqCheck.reason}`);
        }
        result = {
          outcome: 'SKIPPED',
          skipReason: prereqCheck.reason,
          skipReasonCode: SKIP_CODES.PREREQ,
          exitCode: 0,
          steps: [],
          friction: null,
          error: null
        };
      } else {
        const { AttemptEngine } = require('./attempt-engine');
        const engine = new AttemptEngine({ attemptId, timeout: resolvedTimeout });
        const applicabilityCheck = await engine.checkAttemptApplicability(page, attemptId);

        if (!applicabilityCheck.applicable && applicabilityCheck.confidence < 0.3) {
          if (!ciMode) {
            console.log(`    ⊘ Not applicable: ${applicabilityCheck.reason}`);
          }
          result = {
            outcome: 'NOT_APPLICABLE',
            skipReason: applicabilityCheck.reason,
            skipReasonCode: SKIP_CODES.NOT_APPLICABLE,
            discoverySignals: applicabilityCheck.discoverySignals,
            exitCode: 0,
            steps: [],
            friction: null,
            error: null
          };
        } else if (!applicabilityCheck.applicable && applicabilityCheck.confidence >= 0.3 && applicabilityCheck.confidence < 0.6) {
          result = await executeAttempt({
            baseUrl,
            attemptId,
            artifactsDir: attemptArtifactsDir,
            headful,
            enableTrace,
            enableScreenshots,
            quiet: ciMode,
            timeout: resolvedTimeout,
            browserContext: context,
            browserPage: page
          });

          if (result.outcome === 'FAILURE' && result.error && /element|selector|locator/i.test(result.error)) {
            result.outcome = 'DISCOVERY_FAILED';
            result.skipReason = `Element discovery failed: ${result.error}`;
            result.discoverySignals = applicabilityCheck.discoverySignals;
          }
        } else {
          result = await executeAttempt({
            baseUrl,
            attemptId,
            artifactsDir: attemptArtifactsDir,
            headful,
            enableTrace,
            enableScreenshots,
            quiet: ciMode,
            timeout: resolvedTimeout,
            browserContext: context,
            browserPage: page
          });
        }
      }
    } finally {
      await browserPool.closeContext(context);
    }

    const attemptResult = {
      attemptId,
      attemptName: attemptDef.name,
      goal: attemptDef.goal,
      riskCategory: attemptDef.riskCategory || 'UNKNOWN',
      source: attemptDef.source || 'manual',
      ...result
    };

    attemptResults.push(attemptResult);
    journeyContext.afterAttempt(attemptResult, attemptDef);

    if (journeyContext.reachedGoal()) {
      if (!ciMode) {
        console.log(`   ✅ Journey goal reached via ${attemptId}`);
      }
      break;
    }

    if (journeyContext.shouldAbandonJourney()) {
      if (!ciMode) {
        console.log(`   🛑 Journey abandoned (frustration ${journeyContext.frustration}/${journeyContext.frustrationThreshold})`);
      }
      break;
    }

    const nextAttempts = journeyContext.suggestNextAttempts({ attemptId, attemptResult });
    for (const next of nextAttempts) {
      if (!attemptedSet.has(next) && !attemptQueue.includes(next) && !attemptsSkipped.find(s => s.attempt === next)) {
        attemptQueue.push(next);
        if (!ciMode) {
          console.log(`   🔀 Adapting journey → scheduling ${next}`);
        }
      }
    }
  }

  const journeySummary = journeyContext.summarize();
  if (!ciMode) {
    console.log(`\n🧭 Journey summary: stage=${journeySummary.stage}, frustration=${journeySummary.frustration}/${journeySummary.frustrationThreshold}, confidence=${journeySummary.confidence}`);
    if (journeySummary.attemptPath.length > 0) {
      console.log('   Path:');
      journeySummary.attemptPath.forEach((p, idx) => {
        console.log(`    ${idx + 1}. ${p.attemptId} → ${p.outcome}${p.reason ? ` (${p.reason})` : ''}`);
      });
    }
  }

  // Add explicit SKIPPED entries for attempts filtered out before execution
  for (const skip of attemptsSkipped) {
    const def = getAttemptDefinition(skip.attempt) || {};
    attemptResults.push({
      attemptId: skip.attempt,
      attemptName: def.name || skip.attempt,
      goal: def.goal,
      riskCategory: def.riskCategory || 'UNKNOWN',
      source: def.source || 'manual',
      outcome: 'SKIPPED',
      skipReason: skip.reason || 'Skipped before execution',
      skipReasonCode: skip.reasonCode || SKIP_CODES.USER_FILTERED,
      exitCode: 0,
      steps: [],
      friction: null,
      error: null
    });
  }

  // Add explicit SKIPPED entries for attempts disabled by preset (kept for auditability)
  for (const disabledId of presetDisabledAttempts) {
    const def = getAttemptDefinition(disabledId) || {};
    attemptResults.push({
      attemptId: disabledId,
      attemptName: def.name || disabledId,
      goal: def.goal,
      riskCategory: def.riskCategory || 'UNKNOWN',
      source: def.source || 'manual',
      outcome: 'SKIPPED',
      skipReason: 'Disabled by preset',
      skipReasonCode: SKIP_CODES.DISABLED_BY_PRESET,
      exitCode: 0,
      steps: [],
      friction: null,
      error: null,
      disabledByPreset: true
    });
  }

  // Add NOT_APPLICABLE entries for attempts blocked by human intent
  for (const blocked of attemptsBlockedByIntent) {
    const def = getAttemptDefinition(blocked.attempt) || {};
    attemptResults.push({
      attemptId: blocked.attempt,
      attemptName: def.name || blocked.attempt,
      goal: def.goal,
      riskCategory: def.riskCategory || 'UNKNOWN',
      source: def.source || 'manual',
      outcome: 'NOT_APPLICABLE',
      skipReason: blocked.humanReason,
      skipReasonCode: 'HUMAN_INTENT_MISMATCH',
      exitCode: 0,
      steps: [],
      friction: null,
      error: null,
      humanIntent: {
        blocked: true,
        reason: blocked.reason,
        humanReason: blocked.humanReason
      }
    });
  }

  // Add explicit SKIPPED for user-filtered attempts that were removed before scheduling
  for (const uf of userFilteredAttempts) {
    const def = getAttemptDefinition(uf.attemptId) || {};
    attemptResults.push({
      attemptId: uf.attemptId,
      attemptName: def.name || uf.attemptId,
      goal: def.goal,
      riskCategory: def.riskCategory || 'UNKNOWN',
      source: def.source || 'manual',
      outcome: 'SKIPPED',
      skipReason: uf.reason,
      skipReasonCode: SKIP_CODES.USER_FILTERED,
      exitCode: 0,
      steps: [],
      friction: null,
      error: null,
      userFiltered: true
    });
  }

  // Sanitize malformed attempt results (defensive to avoid undefined paths)
  for (let i = attemptResults.length - 1; i >= 0; i--) {
    const item = attemptResults[i];
    if (!item || !item.attemptId) {
      console.warn('⚠️  Attempt result missing attemptId; removing from artifacts');
      attemptResults.splice(i, 1);
    }
  }

  // Preserve requested ordering for downstream artifacts
  const attemptOrder = new Map(requestedAttempts.map((id, idx) => [id, idx]));
  attemptResults.sort((a, b) => (attemptOrder.get(a.attemptId) ?? 999) - (attemptOrder.get(b.attemptId) ?? 999));

  // Normalize execution metadata
  for (const result of attemptResults) {
    result.executed = isExecutedAttempt(result);
  }

    // PHASE 10: SITE INTELLIGENCE ENGINE
    // Analyze site BEFORE attempting any flows — always run
    let siteIntelligence = null;
    console.log(`\n🧠 Analyzing site intelligence...`);
    const intelligenceBrowser = new GuardianBrowser();
    try {
      await intelligenceBrowser.launch(resolvedTimeout);
      siteIntelligence = await analyzeSite(intelligenceBrowser.page, baseUrl);

      if (!ciMode) {
        console.log(`   Site type: ${siteIntelligence.siteType} (confidence: ${Math.round(siteIntelligence.confidence * 100)}%)`);
        console.log(`   Detected signals: ${siteIntelligence.detectedSignals.length}`);

        // Show capability summary
        const supportedCapabilities = Object.entries(siteIntelligence.capabilities)
          .filter(([_, cap]) => cap.supported)
          .map(([name, _]) => name.replace('supports_', ''));
        if (supportedCapabilities.length > 0) {
          console.log(`   Capabilities: ${supportedCapabilities.join(', ')}`);
        }
      }
    } catch (intelligenceErr) {
      console.warn(`⚠️  Site intelligence analysis failed: ${intelligenceErr.message}`);
      siteIntelligence = {
        siteType: SITE_TYPES.UNKNOWN,
        confidence: 0,
        detectedSignals: [],
        capabilities: {},
        flowApplicability: {}
      };
    } finally {
      await intelligenceBrowser.close().catch(() => {});
    }

    // PHASE 11: OBSERVED CAPABILITIES (VISIBLE = MUST WORK)
    // Extract what's actually observable and filter attempts/flows accordingly
    const observedCapabilities = extractObservedCapabilities(siteIntelligence);
    
    if (!ciMode) {
      console.log(`\n🔍 Observable Capabilities:`);
      const observed = Object.entries(observedCapabilities.capabilities)
        .filter(([_, v]) => v === true)
        .map(([k, _]) => k);
      if (observed.length > 0) {
        console.log(`   Present: ${observed.join(', ')}`);
      }
      const notObserved = Object.entries(observedCapabilities.capabilities)
        .filter(([_, v]) => v === false)
        .map(([k, _]) => k);
      if (notObserved.length > 0) {
        console.log(`   Not observed: ${notObserved.join(', ')}`);
      }
    }

    // Filter attempts based on what's observable
    const { applicable: applicableAttempts, notApplicable: notApplicableAttempts } =
      filterAttemptsByObservedCapabilities(attemptsToRun, observedCapabilities);

    if (notApplicableAttempts.length > 0) {
      if (!ciMode) {
        console.log(`\n⊘ ${notApplicableAttempts.length} attempt(s) NOT_APPLICABLE (capability not observed):`);
        for (const { attemptId, reason } of notApplicableAttempts) {
          console.log(`    • ${attemptId}: ${reason}`);
          // Create NOT_APPLICABLE result immediately
          const capName = notApplicableAttempts.find(a => a.attemptId === attemptId)?.capabilityRequired;
          attemptResults.push(createNotApplicableAttemptResult(attemptId, capName || 'unknown'));
        }
      } else {
        // Still add to results even in CI mode
        for (const { attemptId, capabilityRequired } of notApplicableAttempts) {
          attemptResults.push(createNotApplicableAttemptResult(attemptId, capabilityRequired || 'unknown'));
        }
      }
    }

    // Update attemptsToRun to only include applicable attempts
    attemptsToRun = applicableAttempts;
    
    // CRITICAL: Update enabledRequestedAttempts to match observable capabilities
    // This ensures coverage calculation is fair (only counts observable attempts)
    enabledRequestedAttempts = enabledRequestedAttempts.filter(id => applicableAttempts.includes(id));


  // Phase 3: Execute intent flows (deterministic, curated)
  if (enableFlows) {
    console.log(`\n🎯 Executing intent flows...`);
    const flowExecutor = new GuardianFlowExecutor({
      timeout: resolvedTimeout,
      screenshotOnStep: enableScreenshots,
      baseUrl,
      quiet: ciMode,
      ...flowOptions
    });
    const browser = new GuardianBrowser();

    try {
      await browser.launch(resolvedTimeout);
      // Phase 7.1: Apply flows filter (honor explicit --attempts filters)
      const flowsFilteredExplicitly = Boolean(attemptsFilter && validation && validation.valid);
      let flowsToRun;
      if (flowsFilteredExplicitly) {
        flowsToRun = Array.isArray(filteredFlows) ? filteredFlows : [];
      } else {
        // PHASE 9: filteredFlows will be [] if preset explicitly sets flows=[]
        flowsToRun = Array.isArray(filteredFlows) ? filteredFlows : [];
      }

      // PHASE 11: Filter flows by observed capabilities
      const { applicable: applicableFlows, notApplicable: notApplicableFlows } =
        filterFlowsByObservedCapabilities(flowsToRun, observedCapabilities);

      // Add NOT_APPLICABLE flow results
      if (notApplicableFlows.length > 0) {
        if (!ciMode) {
          console.log(`   ⊘ ${notApplicableFlows.length} flow(s) NOT_APPLICABLE (capability not observed):`);
          for (const { flowId, reason } of notApplicableFlows) {
            console.log(`      • ${flowId}: ${reason}`);
            flowResults.push(createNotApplicableFlowResult(flowId, notApplicableFlows.find(f => f.flowId === flowId)?.capabilityRequired || 'unknown'));
          }
        } else {
          for (const { flowId, capabilityRequired } of notApplicableFlows) {
            flowResults.push(createNotApplicableFlowResult(flowId, capabilityRequired || 'unknown'));
          }
        }
      }

      // Use only applicable flows
      flowsToRun = applicableFlows;
      
      for (const flowId of flowsToRun) {
        const flowDef = getFlowDefinition(flowId);
        if (!flowDef) {
          console.warn(`⚠️  Flow ${flowId} not found, skipping`);
          continue;
        }

          // PHASE 10: Check flow applicability using site intelligence
          if (siteIntelligence && !isFlowApplicable(siteIntelligence, flowId)) {
            const applicability = siteIntelligence.flowApplicability[flowId];
            const reason = applicability?.reason || 'Flow not applicable to this site type';
          
            if (!ciMode) {
              console.log(`   ℹ️  ${flowDef.name}: NOT_APPLICABLE (${reason})`);
            }
          
            const flowResult = {
              flowId,
              flowName: flowDef.name,
              riskCategory: flowDef.riskCategory || 'TRUST/UX',
              description: flowDef.description,
              outcome: 'NOT_APPLICABLE',
              stepsExecuted: 0,
              stepsTotal: Array.isArray(flowDef.steps) ? flowDef.steps.length : 0,
              failedStep: null,
              error: null,
              screenshots: [],
              failureReasons: [],
              notApplicableReason: reason,
              source: 'flow'
            };
            flowResults.push(flowResult);
            continue;
          }

        const validation = validateFlowDefinition(flowDef);
        if (!validation.ok) {
          const reason = validation.reason || 'Flow misconfigured';
          const flowResult = {
            flowId,
            flowName: flowDef.name,
            riskCategory: flowDef.riskCategory || 'TRUST/UX',
            description: flowDef.description,
            outcome: 'FAILURE',
            stepsExecuted: 0,
            stepsTotal: Array.isArray(flowDef.steps) ? flowDef.steps.length : 0,
            failedStep: 0,
            error: reason,
            screenshots: [],
            failureReasons: [reason],
            source: 'flow'
          };
          flowResults.push(flowResult);
          
          // Phase 7.1: Fail-fast on flow failure
          if (failFast && flowResult.outcome === 'FAILURE') {
            console.log(`\n⚡ FAIL-FAST: stopping after first failure: ${flowDef.name}`);
            break;
          }
          continue;
        }

        console.log(`  • ${flowDef.name}...`);
        const flowArtifactsDir = path.join(runDir, 'flows', flowId);
        fs.mkdirSync(flowArtifactsDir, { recursive: true });

        let flowResult;
        try {
          flowResult = await flowExecutor.executeFlow(browser.page, flowDef, flowArtifactsDir, baseUrl);
        } catch (flowErr) {
          console.warn(`⚠️  Flow ${flowDef.name} crashed: ${flowErr.message}`);
          flowResult = {
            flowId,
            flowName: flowDef.name,
            riskCategory: flowDef.riskCategory || 'TRUST/UX',
            description: flowDef.description,
            outcome: 'FAILURE',
            stepsExecuted: 0,
            stepsTotal: flowDef.steps.length,
            durationMs: 0,
            failedStep: null,
            error: flowErr.message,
            screenshots: [],
            failureReasons: [`flow crashed: ${flowErr.message}`]
          };
        }

        const resultWithMetadata = {
          flowId,
          flowName: flowDef.name,
          riskCategory: flowDef.riskCategory || 'TRUST/UX',
          description: flowDef.description,
          outcome: flowResult.outcome || (flowResult.success ? 'SUCCESS' : 'FAILURE'),
          stepsExecuted: flowResult.stepsExecuted,
          stepsTotal: flowResult.stepsTotal,
          durationMs: flowResult.durationMs,
          failedStep: flowResult.failedStep,
          error: flowResult.error,
          screenshots: flowResult.screenshots,
          failureReasons: flowResult.failureReasons || [],
          source: 'flow',
          successEval: flowResult.successEval ? {
            status: flowResult.successEval.status,
            confidence: flowResult.successEval.confidence,
            reasons: (flowResult.successEval.reasons || []).slice(0, 3),
            evidence: flowResult.successEval.evidence || {}
          } : null
        };
        
        flowResults.push(resultWithMetadata);

        // Phase 7.1: Fail-fast logic for flows (stop on FAILURE, not FRICTION)
        if (failFast && resultWithMetadata.outcome === 'FAILURE') {
          console.log(`\n⚡ FAIL-FAST: stopping after first failure: ${flowDef.name}`);
          break;
        }
      }
    } catch (flowErr) {
      console.warn(`⚠️  Flow execution failed (non-critical): ${flowErr.message}`);
    } finally {
      await browser.close().catch(() => {});
    }
  }

  // Flow summary logging
  if (flowResults.length > 0 && !ciMode) {
    const successCount = flowResults.filter(f => (f.outcome || f.success === true ? f.outcome === 'SUCCESS' || f.success === true : false)).length;
    const frictionCount = flowResults.filter(f => f.outcome === 'FRICTION').length;
    const failureCount = flowResults.filter(f => f.outcome === 'FAILURE' || f.success === false).length;
    const notApplicableCount = flowResults.filter(f => f.outcome === 'NOT_APPLICABLE').length;
    console.log(`\nRun completed: ${flowResults.length} flows (${successCount} successes, ${frictionCount} frictions, ${failureCount} failures, ${notApplicableCount} not applicable)`);
    const troubled = flowResults.filter(f => f.outcome === 'FRICTION' || f.outcome === 'FAILURE');
    troubled.forEach(f => {
      const reason = (f.failureReasons && f.failureReasons[0]) || (f.error) || (f.successEval && f.successEval.reasons && f.successEval.reasons[0]) || 'no reason captured';
      console.log(` - ${f.flowName}: ${reason}`);
    });
    const notApplicable = flowResults.filter(f => f.outcome === 'NOT_APPLICABLE');
    if (notApplicable.length > 0) {
      notApplicable.forEach(f => {
        console.log(` ℹ️  ${f.flowName}: not applicable to this site`);
      });
    }
  }

  // Ensure artifacts exist for skipped attempts so totals remain canonical and inspectable
  for (const result of attemptResults) {
    if (!result || !result.attemptId) {
      console.warn('⚠️  Attempt result missing attemptId; skipping artifact write');
      continue;
    }

    if (!isExecutedAttempt(result)) {
      const attemptDir = path.join(runDir, result.attemptId);
      const attemptRunDir = path.join(attemptDir, 'attempt-skipped');
      fs.mkdirSync(path.join(attemptRunDir, 'attempt-screenshots'), { recursive: true });

      const skipSummary = {
        attemptId: result.attemptId,
        outcome: 'SKIPPED',
        reason: result.skipReason || 'Not executed'
      };

      const jsonPath = path.join(attemptRunDir, 'attempt-report.json');
      const htmlPath = path.join(attemptRunDir, 'attempt-report.html');
      fs.writeFileSync(jsonPath, JSON.stringify(skipSummary, null, 2));
      fs.writeFileSync(htmlPath, `<html><body><h1>${result.attemptName || result.attemptId}</h1><p>Skipped: ${skipSummary.reason}</p></body></html>`);

      result.reportJsonPath = result.reportJsonPath || jsonPath;
      result.reportHtmlPath = result.reportHtmlPath || htmlPath;
    }
  }

  // Generate market report (existing flow)
  const reporter = new MarketReporter();
  const report = reporter.createReport({
    runId,
    baseUrl,
    attemptsRun: requestedAttempts,
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
  snapshotBuilder.setJourney(journeySummary);
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

  // Phase 7.3: Cleanup browser pool
  await browserPool.close();

  // Wave 4: Honest results & near-success
  // Calculate attempt statistics and coverage
  const disabledAttemptResults = attemptResults.filter(a => a.disabledByPreset);
  const eligibleAttempts = attemptResults.filter(a => !a.disabledByPreset);
  const executedAttempts = eligibleAttempts.filter(isExecutedAttempt);
  const skippedAttempts = eligibleAttempts.filter(a => !isExecutedAttempt(a));
  const skippedNotApplicable = eligibleAttempts.filter(a => a.skipReasonCode === SKIP_CODES.NOT_APPLICABLE);
  const skippedMissing = eligibleAttempts.filter(a => a.skipReasonCode === SKIP_CODES.ENGINE_MISSING);
  const skippedUserFiltered = eligibleAttempts.filter(a => a.skipReasonCode === SKIP_CODES.USER_FILTERED || a.userFiltered);
  const skippedDisabledByPreset = disabledAttemptResults;
  const attemptStats = {
    total: eligibleAttempts.length,
    executed: executedAttempts.length,
    executedCount: executedAttempts.length,
    enabledPlannedCount: enabledRequestedAttempts.length,
    disabledPlannedCount: disabledAttemptResults.length,
    successful: executedAttempts.filter(a => a.outcome === 'SUCCESS').length,
    failed: executedAttempts.filter(a => a.outcome === 'FAILURE').length,
    skipped: skippedAttempts.length,
    skippedDetails: skippedAttempts.map(a => ({ attempt: a.attemptId, reason: a.skipReason || 'Not executed', code: a.skipReasonCode })),
    disabled: disabledAttemptResults.length,
    disabledDetails: disabledAttemptResults.map(a => ({ attempt: a.attemptId, reason: a.skipReason || 'Disabled by preset', code: SKIP_CODES.DISABLED_BY_PRESET })),
    userFiltered: skippedUserFiltered.length,
    skippedDisabledByPreset: skippedDisabledByPreset.length,
    skippedNotApplicable: skippedNotApplicable.length,
    skippedMissing: skippedMissing.length,
    skippedUserFiltered: skippedUserFiltered.length
  };

  const nearSuccessDetails = [];
  for (const a of attemptResults) {
    if (a.outcome === 'FAILURE') {
      const errMsg = typeof a.error === 'string' ? a.error : '';
      const noFailedSteps = Array.isArray(a.steps) ? a.steps.every(s => s.status !== 'failed') : true;
      if (noFailedSteps && errMsg.includes('Success conditions not met')) {
        nearSuccessDetails.push({ attempt: a.attemptId, reason: 'Submit succeeded but no confirmation text detected' });
      }
    }
  }
  attemptStats.nearSuccess = nearSuccessDetails.length;
  attemptStats.nearSuccessDetails = nearSuccessDetails;

  // Coverage and evidence signals
  const { coverage: coverageSignal, denominator: coverageDenominator, numerator: coverageNumerator } = calculateCoverage({
    attemptStats,
    skippedNotApplicable,
    skippedMissing,
    skippedUserFiltered,
    skippedDisabledByPreset
  });

  const evidenceMetrics = {
    completeness: coverageDenominator > 0 ? coverageNumerator / coverageDenominator : 0,
    integrity: 0,
    hashedFiles: 0,
    totalFiles: 0,
    screenshotsEnabled: enableScreenshots,
    tracesEnabled: enableTrace
  };

  // Build signals used by policy (single source of verdict truth)
  const policySignals = {
    coverage: coverageSignal,
    marketImpact,
    flows: flowResults,
    baseline: { baselineCreated, baselineSnapshot, diffResult },
    attempts: attemptResults,
    crawlIssues: runSignals.filter(s => s.type === 'coverage'),
    discoveryIssues: runSignals.filter(s => s.type === 'discovery'),
    evidence: {
      metrics: evidenceMetrics,
      missingScreenshots: !enableScreenshots,
      missingTraces: !enableTrace
    },
    runtimeSignals: runSignals
  };

  // Resolve policy (strict failure on invalid)
  let policyEval = null;
  let policyObj = null;
  const presetId = policyName; // Preserve preset ID for naming (e.g., 'startup')
  let policyHash = null;
  let policySource = 'default';
  try {
    if (policy && typeof policy === 'string' && fs.existsSync(policy)) {
      policySource = path.resolve(policy);
    } else if (policy) {
      policySource = typeof policy === 'string' ? `inline:${policy}` : `preset:${config.preset || policyName}`;
    } else {
      policySource = 'default';
    }
    policyObj = policy
      ? (typeof policy === 'object' ? policy : parsePolicyOption(policy))
      : loadPolicy();
    policyName = policyObj?.name || policyObj?.id || policyName || (policy ? policy : 'default');
    policyHash = crypto.createHash('sha256').update(JSON.stringify(policyObj)).digest('hex');
  } catch (policyLoadErr) {
    console.error(`Error: ${policyLoadErr.message}`);
    process.exit(2);
  }

  // First pass policy evaluation (before manifest integrity)
  policyEval = evaluatePolicy(snapshotBuilder.getSnapshot(), policyObj, policySignals);
  console.log(`\n🛡️  Evaluating policy... (${policyName})`);
  console.log(`Policy evaluation: passed=${policyEval.passed}`);
  if (policyEval.reasons && policyEval.reasons.length > 0) {
    policyEval.reasons.slice(0, 3).forEach(r => console.log(`  • ${r}`));
  }

  const resolvedConfig = {
    presetId: config.preset || presetId,
    policySource,
    policyId: policyObj?.id || policyObj?.name || policyName,
    policyHash,
    mediaRequirements: {
      requireScreenshots: !!(policyObj?.evidence?.requireScreenshots),
      requireTraces: !!(policyObj?.evidence?.requireTraces),
      minCompleteness: policyObj?.evidence?.minCompleteness,
      minIntegrity: policyObj?.evidence?.minIntegrity
    },
    attemptPlan: {
      enabled: enabledRequestedAttempts,
      disabled: Array.from(disabledByPreset),
      userFiltered: userFilteredAttempts.map(u => u.attemptId),
      missing: missingAttempts
    },
    coverage: {
      total: coverageSignal.total,
      executed: coverageSignal.executed,
      executedCount: attemptStats.executed,
      enabledPlannedCount: attemptStats.enabledPlannedCount,
      disabledPlannedCount: attemptStats.disabledPlannedCount,
      skippedNotApplicable: coverageSignal.skippedNotApplicable?.length || 0,
      skippedMissing: coverageSignal.skippedMissing?.length || 0,
      skippedUserFiltered: coverageSignal.skippedUserFiltered?.length || 0,
      skippedDisabledByPreset: coverageSignal.skippedDisabledByPreset?.length || 0,
      disabled: coverageSignal.disabled?.length || 0
    },
    evidenceMetrics
  };

  // Calculate actual duration from start time
  const endTime = new Date();
  const actualDurationMs = endTime.getTime() - startTime.getTime();

  // Rename run directory to status placeholder for auditability
  // Note: exitCode will be determined later by final outcome authority
  let exitCode = 0; // Placeholder, will be set by final decision
  const releaseDecisionPath = null;
  const runResultPreManifest = 'PENDING';
  const priorRunDir = runDir;
  const finalRunDirName = makeRunDirName({ timestamp: startTime, url: baseUrl, policy: presetId, result: runResultPreManifest });
  const finalRunDir = path.join(safeArtifactsDir, finalRunDirName);
  if (finalRunDir !== runDir) {
    fs.renameSync(runDir, finalRunDir);
    runDir = finalRunDir;
    runDirName = finalRunDirName;
  }
  // Rebase attempt artifact paths after rename
  for (const attempt of attemptResults) {
    if (attempt.attemptJsonPath) {
      attempt.attemptJsonPath = attempt.attemptJsonPath.replace(priorRunDir, runDir);
    }
    if (attempt.stepsLogPath) {
      attempt.stepsLogPath = attempt.stepsLogPath.replace(priorRunDir, runDir);
    }
    if (attempt.reportJsonPath) {
      attempt.reportJsonPath = attempt.reportJsonPath.replace(priorRunDir, runDir);
    }
    if (attempt.reportHtmlPath) {
      attempt.reportHtmlPath = attempt.reportHtmlPath.replace(priorRunDir, runDir);
    }
  }
  const snapshotPathFinal = path.join(runDir, 'snapshot.json');
  const marketJsonPathFinal = path.join(runDir, path.basename(jsonPath));
  const marketHtmlPathFinal = path.join(runDir, path.basename(htmlPath));

  // Build decision artifact and summary (first pass)
  const initialDecision = computeFinalVerdict({
    marketImpact,
    policyEval,
    baseline: { baselineCreated, baselineSnapshot, diffResult },
    flows: flowResults,
    attempts: attemptResults,
    journeySummary
  });
  const initialExplanation = buildRealityExplanation({
    finalDecision: initialDecision,
    attemptStats,
    marketImpact,
    policyEval,
    baseline: { baselineCreated, baselineSnapshot, diffResult },
    flows: flowResults,
    attempts: attemptResults,
    coverage: coverageSignal,
    observedCapabilities
  });

  const decisionPath = writeDecisionArtifact({
    runDir,
    runId,
    baseUrl,
    policyName,
    preset: config.preset || policyName,
    finalDecision: initialDecision,
    attemptStats,
    marketImpact,
    policyEval,
    baseline: { baselineCreated, baselineSnapshot, diffResult },
    flows: flowResults,
    resolved: resolvedConfig,
    attempts: attemptResults,
    coverage: coverageSignal,
    explanation: initialExplanation,
    observedCapabilities
  });

  const summaryPath = writeRunSummary(runDir, initialDecision, attemptStats, marketImpact, policyEval, initialExplanation, siteIntelligence);

  // Build integrity manifest over all artifacts and update evidence metrics
  try {
    const manifestInfo = writeIntegrityManifest(runDir);
    evidenceMetrics.hashedFiles = manifestInfo.hashedFiles;
    evidenceMetrics.totalFiles = manifestInfo.totalFiles;
    evidenceMetrics.integrity = manifestInfo.totalFiles > 0 ? manifestInfo.hashedFiles / manifestInfo.totalFiles : 0;
  } catch (manifestErr) {
    console.warn(`⚠️  Failed to write integrity manifest: ${manifestErr.message}`);
    evidenceMetrics.integrity = 0;
    runSignals.push({ id: 'manifest_failed', severity: 'medium', type: 'evidence', description: `Manifest generation failed: ${manifestErr.message}` });
  }

  // Re-run policy evaluation with final evidence metrics
  policyEval = evaluatePolicy(snapshotBuilder.getSnapshot(), policyObj, policySignals);

  // PHASE 3: RULES ENGINE INTEGRATION
  // Load rules and evaluate for deterministic verdict
  let ruleEngineOutput = null;
  try {
    const rules = loadRules(); // Load from file or use defaults
    const scanResult = {
      ...snapshotBuilder.getSnapshot(),
      url: baseUrl,
      baseUrl: baseUrl,
      preset: config.preset || policyName,
      policy: policyName,
      goalReached: attemptResults.some(a => a.outcome === 'SUCCESS'),
      baseline: { diffResult },
      evidence: {
        screenshots: [],
        traces: []
      }
    };
    const scanSignals = buildPolicySignals(scanResult);
    ruleEngineOutput = evaluateRules(rules, scanSignals);
    
    if (!ciMode) {
      console.log(`\n⚖️  Rules engine evaluation:`);
      console.log(`   Triggered rules: ${ruleEngineOutput.triggeredRuleIds.join(', ') || 'none'}`);
      console.log(`   Rules verdict: ${ruleEngineOutput.finalVerdict}`);
      ruleEngineOutput.reasons.slice(0, 3).forEach(r => {
        console.log(`   • [${r.ruleId}] ${r.message}`);
      });
    }
  } catch (ruleErr) {
    console.warn(`⚠️  Rules engine failed (non-critical): ${ruleErr.message}`);
    // Continue with legacy verdict logic if rules engine fails
    ruleEngineOutput = null;
  }

  // FINAL OUTCOME AUTHORITY: Merge rules verdict + policy evaluation
  // This is the single source of truth for finalVerdict and finalExitCode
  let finalDecision;
  if (ruleEngineOutput) {
    // Use new merge logic
    const mergedOutcome = computeFinalOutcome({
      rulesVerdict: ruleEngineOutput.finalVerdict,
      rulesExitCode: ruleEngineOutput.exitCode,
      rulesReasons: ruleEngineOutput.reasons,
      rulesTriggeredIds: ruleEngineOutput.triggeredRuleIds,
      policySignals: ruleEngineOutput.policySignals,
      policyEval,
      coverage: coverageSignal,
      policy: policyObj  // Pass policy object so we can respect failOnGap setting
    });

    if (!ciMode) {
      console.log(`\n🎯 Final outcome authority:`);
      console.log(`   Merged verdict: ${mergedOutcome.finalVerdict} (exit ${mergedOutcome.finalExitCode})`);
      console.log(`   Source: ${mergedOutcome.source}`);
      if (mergedOutcome.mergeInfo) {
        console.log(`   Decision: ${mergedOutcome.mergeInfo.decision}`);
      }
    }

    finalDecision = {
      finalVerdict: mergedOutcome.finalVerdict,
      exitCode: mergedOutcome.finalExitCode,
      reasons: mergedOutcome.reasons,
      triggeredRuleIds: mergedOutcome.triggeredRuleIds,
      policySignals: mergedOutcome.policySignals || ruleEngineOutput.policySignals,
      mergeInfo: mergedOutcome.mergeInfo
    };
  } else {
    // Fallback to legacy logic if rules engine failed
    finalDecision = computeFinalVerdict({
      marketImpact,
      policyEval,
      baseline: { baselineCreated, baselineSnapshot, diffResult },
      flows: flowResults,
      attempts: attemptResults,
      journeySummary,
      ruleEngineOutput: null
    });
  }

  // Extract actionable hints for non-READY outcomes
  const actionHints = finalDecision.finalVerdict !== 'READY' 
    ? deriveActionHints(attemptResults)
    : [];

  const finalExplanation = buildRealityExplanation({
    finalDecision,
    attemptStats,
    marketImpact,
    policyEval,
    baseline: { baselineCreated, baselineSnapshot, diffResult },
    flows: flowResults,
    attempts: attemptResults,
    coverage: coverageSignal,
    observedCapabilities
  });
  exitCode = finalDecision.exitCode;

  // Rewrite decision + summary with final verdict
  const decisionPathFinal = writeDecisionArtifact({
    runDir,
    runId,
    baseUrl,
    policyName,
    preset: config.preset || policyName,
    finalDecision,
    attemptStats,
    marketImpact,
    policyEval,
    baseline: { baselineCreated, baselineSnapshot, diffResult },
    flows: flowResults,
    resolved: resolvedConfig,
    attempts: attemptResults,
    coverage: coverageSignal,
    explanation: finalExplanation,
    ruleEngineOutput,
    siteIntelligence,
    actionHints,
    observedCapabilities
  });
  const summaryPathFinal = writeRunSummary(runDir, finalDecision, attemptStats, marketImpact, policyEval, finalExplanation, siteIntelligence, actionHints);

  const runResult = finalDecision.finalVerdict;

  // Persist policy evaluation and meta into snapshot
  try {
    const snap = snapshotBuilder.getSnapshot();
    snap.policyEvaluation = policyEval;
    snap.policyName = policyName;
      // PHASE 10: Add site intelligence to snapshot
      if (siteIntelligence) {
        snap.siteIntelligence = {
          siteType: siteIntelligence.siteType,
          confidence: siteIntelligence.confidence,
          timestamp: siteIntelligence.timestamp,
          capabilities: Object.keys(siteIntelligence.capabilities || {}).reduce((acc, key) => {
            const cap = siteIntelligence.capabilities[key];
            acc[key] = {
              supported: cap.supported,
              confidence: cap.confidence
            };
            return acc;
          }, {}),
          flowApplicability: siteIntelligence.flowApplicability,
          signalCount: siteIntelligence.detectedSignals?.length || 0
        };
      }
    snap.meta.policyHash = policyHash;
    snap.meta.preset = config.preset || presetId;
    snap.meta.evidenceMetrics = evidenceMetrics;
    snap.meta.coverage = coverageSignal;
    snap.meta.resolved = resolvedConfig;
    snap.resolved = resolvedConfig;
    snap.meta.result = finalDecision.finalVerdict;
    snap.meta.attemptsSummary = {
      executed: attemptStats.executed,
      successful: attemptStats.successful,
      failed: attemptStats.failed,
      skipped: attemptStats.skipped,
      disabled: attemptStats.disabled,
      nearSuccess: attemptStats.nearSuccess,
      nearSuccessDetails: attemptStats.nearSuccessDetails
    };
    snap.evidenceMetrics = { ...evidenceMetrics, coverage: coverageSignal };
    snap.coverage = coverageSignal;
    
    // HONESTY CONTRACT: Build evidence-based honesty data
    const honestyContract = buildHonestyContract({
      attemptResults: attemptResults,
      flowResults: flowResults,
      requestedAttempts: enabledRequestedAttempts,
      enabledAttempts: enabledRequestedAttempts,
      totalPossibleAttempts: attemptStats.total,
      crawlData: snap.crawl || {},
      coverageSignal: coverageSignal,
      triggeredRuleIds: finalDecision.triggeredRuleIds || [] // Pass rules engine signals (e.g., all_goals_reached)
    });
    
    // Validate honesty contract
    const honestyValidation = validateHonestyContract(honestyContract);
    if (!honestyValidation.valid) {
      console.error(`\n⚠️  HONESTY VIOLATION: ${honestyValidation.reason}`);
      // FAIL-SAFE: Force DO_NOT_LAUNCH if honesty data is invalid
      snap.verdict = {
        verdict: 'DO_NOT_LAUNCH',
        confidence: { score: 0, basis: 'honesty_violation' },
        why: `Cannot make safe claims - ${honestyValidation.reason}`,
        keyFindings: ['Honesty data validation failed'],
        evidence: {},
        limits: ['CRITICAL: Honesty contract invalid'],
        honestyViolation: true
      };
    } else {
      // Enforce honesty in verdict
      const rawVerdict = normalizeCanonicalVerdict(finalDecision.finalVerdict);
      const honestVerdict = enforceHonestyInVerdict(rawVerdict, honestyContract);
      
      if (honestVerdict.honestyEnforced) {
        console.log(`\n🔒 HONESTY ENFORCEMENT: ${honestVerdict.reason}`);
        console.log(`   Original: ${honestVerdict.originalVerdict} → Adjusted: ${honestVerdict.verdict}`);
        
        // CRITICAL: Update exitCode to match the adjusted verdict
        // If honesty downgraded READY → FRICTION, exitCode must also change from 0 → 1
        const { mapExitCodeFromCanonical } = require('./verdicts');
        const adjustedExitCode = mapExitCodeFromCanonical(honestVerdict.verdict);
        exitCode = adjustedExitCode;
        finalDecision.exitCode = adjustedExitCode;
      }
      
      // Build verdict object with honesty contract
      snap.verdict = {
        verdict: honestVerdict.verdict,
        confidence: {
          score: honestVerdict.confidence,
          basis: honestyContract.confidenceBasis.summary
        },
        why: honestyContract.confidenceBasis.details.join('; '),
        keyFindings: [
          ...honestyContract.confidenceBasis.details.slice(0, 3),
          `Coverage: ${honestyContract.coverageStats.percent}%`
        ],
        evidence: {
          executedAttempts: honestyContract.coverageStats.executed,
          totalAttempts: honestyContract.coverageStats.total,
          coveragePercent: honestyContract.coverageStats.percent,
          testedScope: honestyContract.testedScope.slice(0, 10),
          untestedScope: honestyContract.untestedScope.slice(0, 10)
        },
        limits: honestyContract.limits,
        honestyContract: honestyContract,
        honestyEnforced: honestVerdict.honestyEnforced
      };
    }
    await saveSnapshot(snap, snapshotPathFinal);
    // Minimal attestation: sha256(policyHash + snapshotHash + manifestHash + runId)
    const snapshotHash = hashFile(snapshotPathFinal);
    let manifestHash = null;
    try { 
      manifestHash = hashFile(path.join(runDir, 'manifest.json')); 
    } catch {
      // Manifest file may not exist yet - use 'none' as fallback
    }
    const attestationHash = crypto.createHash('sha256').update(`${policyHash}|${snapshotHash}|${manifestHash || 'none'}|${runId}`).digest('hex');
    snap.meta.attestation = { hash: attestationHash, policyHash, snapshotHash, manifestHash, runId };
    await saveSnapshot(snap, snapshotPathFinal);

    // Pre-Launch Gate and release decision artifact
    const baselinePresent = baselineExists(baseUrl, storageDir);
    let releaseDecision = null;
    lereleaseDecisionPath = null;

    const gate = evaluatePrelaunchGate({
      prelaunch,
      verdict: snap.verdict?.verdict || finalDecision.finalVerdict,
      exitCode,
      allowFrictionOverride: prelaunchAllowFriction,
      honestyContract,
      coverage: coverageSignal,
      baselinePresent,
      integrity: evidenceMetrics.integrity || 0,
      evidence: {
        executedAttempts: attemptStats.executed || 0,
        totalPlanned: attemptStats.total || attemptStats.enabledPlannedCount || 0
      }
    });

    releaseDecision = gate.releaseDecision;
    exitCode = gate.exitCode;
    finalDecision.exitCode = exitCode;
    releaseDecisionPath = writeReleaseDecisionArtifact(runDir, releaseDecision);

    // Rewrite decision + summary to reflect gated exit code
    writeDecisionArtifact({
      runDir,
      runId,
      baseUrl,
      policyName,
      preset: config.preset || policyName,
      finalDecision,
      attemptStats,
      marketImpact,
      policyEval,
      baseline: { baselineCreated, baselineSnapshot, diffResult },
      flows: flowResults,
      resolved: resolvedConfig,
      attestation: snap.meta?.attestation,
      attempts: attemptResults,
      coverage: coverageSignal,
      explanation: finalExplanation,
      ruleEngineOutput,
      siteIntelligence,
      actionHints,
      honestyContract,
      observedCapabilities
    });
    writeRunSummary(runDir, finalDecision, attemptStats, marketImpact, policyEval, finalExplanation, siteIntelligence, actionHints);

    if (prelaunch) {
      const blockStatus = releaseDecision.blocking ? 'BLOCKING' : 'ALLOW';
      console.log(`\n🚦 Pre-Launch Gate: ${blockStatus}`);
      releaseDecision.reasons.forEach(r => console.log(`   • ${r.code}: ${r.message}`));
      console.log(`   Artifact: ${releaseDecisionPath}`);
    }

    // Rewrite decision to include attestation and auditor-grade summary
    writeDecisionArtifact({
      runDir,
      runId,
      baseUrl,
      policyName,
      preset: config.preset || policyName,
      finalDecision,
      attemptStats,
      marketImpact,
      policyEval,
      baseline: { baselineCreated, baselineSnapshot, diffResult },
      flows: flowResults,
      resolved: resolvedConfig,
      attestation: snap.meta.attestation,
      audit: {
        executedAttempts: (snapshotBuilder.getSnapshot()?.attempts || []).filter(a => a.executed).map(a => a.attemptId),
        notTested: {
          disabledByPreset: (attemptStats.disabledDetails || []).map(d => d.attempt),
          userFiltered: (snap.coverage?.skippedUserFiltered || []).map(s => s.attempt),
          notApplicable: (snap.coverage?.skippedNotApplicable || []).map(s => s.attempt),
          missing: (snap.coverage?.skippedMissing || []).map(s => s.attempt)
        }
      },
      attempts: attemptResults,
      coverage: coverageSignal,
      explanation: finalExplanation,
      siteIntelligence,
      honestyContract: snap.verdict?.honestyContract,
      observedCapabilities
    });
  } catch (_) {}

  // Persist META.json
  let metaData;
  try {
    metaData = {
      runDir,
      url: baseUrl,
      siteSlug,
      policy: policyName,
      policyHash,
      preset: config.preset || presetId,
      result: runResult,
      durationMs: actualDurationMs,
      profile: siteProfile,
      attempts: attemptStats,
      evidence: evidenceMetrics,
      decisionPath: decisionPathFinal || decisionPath,
      summaryPath: summaryPathFinal || summaryPath
    };
    writeMetaJson(metaData);
    if (process.env.GUARDIAN_DEBUG) {
      console.log(`\n💾 META.json written successfully`);
    }
  } catch (metaErr) {
    console.warn(`⚠️  Failed to write META.json: ${metaErr.message}`);
    exitCode = 1;
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

  // Wave 2: Update latest pointers with finalized metadata
  try {
    const metaContent = readMetaJson(runDir);
    updateLatestGlobal(runDir, runDirName, metaContent, safeArtifactsDir);
    updateLatestBySite(runDir, runDirName, metaContent, safeArtifactsDir);
    if (process.env.GUARDIAN_DEBUG) {
      console.log(`✅ Latest pointers updated`);
    }
  } catch (latestErr) {
    console.warn(`⚠️  Failed to update latest pointers: ${latestErr.message}`);
  }

  // Mark first run complete if this was the first run
  if (firstRunMode) {
    try {
      markFirstRunComplete();
    } catch (err) {
      console.warn(`⚠️  Failed to mark first run complete: ${err.message}`);
    }
  }

  // Create canonical output shape
  const snap = snapshotBuilder.getSnapshot();
  const canonicalOutput = createCanonicalOutput({
    version: require('../../package.json').version,
    command: 'reality',
    verdict: finalDecision.finalVerdict,
    exitCode,
    summary: {
      headline: snap.verdict?.verdict ? `${snap.verdict.verdict} — ${snap.verdict.why || ''}`.slice(0, 100) : undefined,
      reasons: finalDecision.reasons?.slice(0, 5).map(r => r.message || r.code) || [],
      coverage: coverageSignal ? {
        percent: coverageSignal.percent || 0,
        executed: coverageSignal.executed || 0,
        total: coverageSignal.total || 0
      } : null
    },
    artifacts: {
      runDir,
      snapshotPath: snapshotPathFinal,
      reportPath: marketHtmlPathFinal
    },
    policyStatus: policyEval ? {
      passed: policyEval.passed === true,
      name: policyEval.policyName || 'unknown',
      details: policyEval.reasons || null
    } : null,
    meta: {
      runId: snap.meta?.runId || 'unknown',
      timestamp: snap.meta?.timestamp || new Date().toISOString(),
      baseUrl: snap.meta?.baseUrl || baseUrl || 'unknown',
      durationMs: snap.meta?.durationMs || 0
    }
  });

  // Return both canonical and raw for backward compatibility
  return {
    ...canonicalOutput,
    // Legacy fields for backward compatibility
    report,
    runDir,
    snapshotPath: snapshotPathFinal,
    marketJsonPath: marketJsonPathFinal,
    marketHtmlPath: marketHtmlPathFinal,
    attemptResults,
    flowResults,
    baselineCreated,
    diffResult,
    snapshot: snapshotBuilder.getSnapshot(),
    policyEval,
    resolved: resolvedConfig,
    finalDecision,
    explanation: finalExplanation,
    coverage: coverageSignal,
    actionHints,
    releaseDecisionPath
  };
}

async function runRealityCLI(config) {
  try {
    // Stage II: Environment guard (before any other work)
    const { checkEnvironment, failWithEnvironmentError } = require('./env-guard');
    const envCheck = checkEnvironment();
    if (!envCheck.allOk) {
      failWithEnvironmentError(envCheck.issues);
      return; // Exit path, but just in case
    }

    const { config: effectiveConfig, report: configReport } = applyLocalConfig(config);

    console.log('\nConfig:');
    console.log(`- source: ${configReport.source}`);
    if (configReport.path) {
      console.log(`- path: ${configReport.path}`);
    }
    console.log('- effective:');
    console.log(`  - crawl.maxPages: ${configReport.effective.crawl.maxPages}`);
    console.log(`  - crawl.maxDepth: ${configReport.effective.crawl.maxDepth}`);
    console.log(`  - timeouts.navigationMs: ${configReport.effective.timeouts.navigationMs}`);
    console.log(`  - output.dir: ${configReport.effective.output.dir}`);

    const cfg = effectiveConfig;

    if (cfg.watch) {
      const { startWatchMode } = require('./watch-runner');
      const watchResult = await startWatchMode(cfg);
      if (watchResult && watchResult.watchStarted === false && typeof watchResult.exitCode === 'number') {
        process.exit(watchResult.exitCode);
      }
      // When watch is active, do not exit; watcher owns lifecycle
      return;
    }

    const result = await executeReality(cfg);

    // Mark first run as complete
    if (isFirstRun()) {
      markFirstRunComplete();
    }

    // Phase 6: Print enhanced CLI summary
    const ciMode = isCiMode();
    if (!ciMode) {
      const resolved = result.resolved || {};
      console.log(`\nResolved configuration:`);
      console.log(`  Preset: ${resolved.presetId || 'unknown'}`);
      console.log(`  Policy: ${resolved.policyId || 'unknown'} (source: ${resolved.policySource || 'n/a'}, hash: ${resolved.policyHash || 'n/a'})`);
      if (resolved.mediaRequirements) {
        console.log(`  Media requirements: screenshots=${resolved.mediaRequirements.requireScreenshots}, traces=${resolved.mediaRequirements.requireTraces}`);
      }
      if (resolved.attemptPlan) {
        console.log(`  Attempt plan: enabled=${(resolved.attemptPlan.enabled || []).length}, disabled=${(resolved.attemptPlan.disabled || []).length}, userFiltered=${(resolved.attemptPlan.userFiltered || []).length}, missing=${(resolved.attemptPlan.missing || []).length}`);
      }
      if (resolved.coverage) {
        console.log(`  Attempt outcomes: executed=${resolved.coverage.executedCount ?? resolved.coverage.executed}, disabled=${resolved.coverage.disabledPlannedCount ?? 0}, skippedDisabledByPreset=${resolved.coverage.skippedDisabledByPreset ?? 0}, skippedUserFiltered=${resolved.coverage.skippedUserFiltered ?? 0}, skippedNotApplicable=${resolved.coverage.skippedNotApplicable ?? 0}, skippedMissing=${resolved.coverage.skippedMissing ?? 0}`);
      }
    }
    if (ciMode) {
      const ciSummary = formatCiSummary({
        flowResults: result.flowResults || [],
        diffResult: result.diffResult || null,
        baselineCreated: result.baselineCreated || false,
        exitCode: result.exitCode,
        verdict: result.verdict,
        summary: result.summary,
        maxReasons: 5
      });
      console.log(ciSummary);
    } else {
      // Strict CLI summary: traceable, factual only
      const snap = result.snapshot || {};
      const meta = snap.meta || {};
      const coverage = snap.coverage || result.coverage || {};
      const counts = coverage.counts || {};
      // eslint-disable-next-line no-unused-vars
      const evidence = snap.evidenceMetrics || {};
      // eslint-disable-next-line no-unused-vars
      const resolved = snap.resolved || {};
      const finalDecision = result.finalDecision || {};
      const explanation = result.explanation || buildRealityExplanation({
        finalDecision,
        attemptStats: snap.meta?.attemptsSummary || {},
        marketImpact: snap.marketImpact || {},
        policyEval: result.policyEval,
        baseline: { diffResult: result.diffResult },
        flows: result.flowResults,
        attempts: result.attemptResults,
        coverage
      });
      const sections = explanation.sections || {};
      const verdictSection = sections['Final Verdict'] || {};
      const verdictValue = normalizeCanonicalVerdict(meta.result || finalDecision.finalVerdict);
      
      // DX BOOST Stage 4: Unified Output Readability
      printUnifiedOutput({
        meta,
        coverage,
        counts,
        verdict: snap.verdict || verdictSection, // Use snap.verdict first (has honestyContract)
        attemptResults: result.attemptResults || snap.attempts || [],
        flowResults: result.flowResults || snap.flows || [],
        exitCode: result.exitCode,
        runDir: result.runDir || (configReport?.effective?.output?.dir ? path.join(configReport.effective.output.dir, meta.runId || '') : `artifacts/${meta.runId || ''}`)
      }, config, process.argv.slice(2));
      
       // DX BOOST Stage 2: Verdict Clarity
       // Print human-readable verdict summary with top reasons and observation clarity
       const topReasons = extractTopReasons(finalDecision, result.attemptResults || [], result.flowResults || []);
       const observationClarity = buildObservationClarity(coverage, result.attemptResults || []);
       printVerdictClarity(verdictValue, {
         reasons: topReasons,
         explanation: getVerdictExplanation(verdictValue),
         observed: observationClarity.observed,
         notObserved: observationClarity.notObserved,
         config,
         args: process.argv.slice(2)
       });
       
       // Display Action Hints for non-READY verdicts
       if (finalDecision.finalVerdict !== 'READY' && result.actionHints && result.actionHints.length > 0) {
         console.log('\n' + formatHintsForCLI(result.actionHints, 3));
       }
     
      // eslint-disable-next-line no-unused-vars
      const reportBase = result.runDir || (configReport?.effective?.output?.dir ? path.join(configReport.effective.output.dir, meta.runId || '') : `artifacts/${meta.runId || ''}`);
      console.log('━'.repeat(70));
    }

    process.exit(result.exitCode);
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    if (process.env.GUARDIAN_DEBUG) {
      if (err.stack) console.error(err.stack);
    } else if (err.stack) {
      const stackLine = (err.stack.split('\n')[1] || '').trim();
      if (stackLine) console.error(`   at ${stackLine}`);
      console.error('   (Set GUARDIAN_DEBUG=1 for full stack)');
    }
    
    // Write emergency decision.json for test determinism
    try {
      const os = require('os');
      const now = new Date().toISOString().replace(/[:\-]/g, '').substring(0, 15).replace('T', '-');
      const artifactsDir = config.artifactsDir || path.join(os.tmpdir(), 'odavl-guardian');
      const runId = `error-${now}`;
      const runDir = path.join(artifactsDir, runId);
      
      if (!fs.existsSync(runDir)) {
        fs.mkdirSync(runDir, { recursive: true });
      }
      
      const emergencyDecision = {
        runId,
        url: config.baseUrl || config.url || 'unknown',
        timestamp: new Date().toISOString(),
        preset: config.preset || 'unknown',
        policyName: 'Emergency Exit',
        finalVerdict: 'DO_NOT_LAUNCH',
        exitCode: 1,
        reasons: [
          { code: 'RUNTIME_ERROR', message: err.message }
        ],
        error: {
          message: err.message,
          type: 'RUNTIME_ERROR'
        }
      };
      
      const sanitizedEmergencyDecision = sanitizeArtifact(emergencyDecision);
      fs.writeFileSync(path.join(runDir, 'decision.json'), JSON.stringify(sanitizedEmergencyDecision, null, 2));
    } catch {
      // Ignore write errors in error handler
    }
    
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

function computeFlowExitCode(flowResults) {
  if (!Array.isArray(flowResults) || flowResults.length === 0) return 0;
  const hasFailure = flowResults.some(f => f.outcome === 'FAILURE' || f.success === false);
  if (hasFailure) return 2;
  const hasFriction = flowResults.some(f => f.outcome === 'FRICTION');
  if (hasFriction) return 1;
  return 0;
}

function computeFinalVerdict({ marketImpact, policyEval, baseline, flows, attempts, journeySummary = null, ruleEngineOutput = null }) {
  // PHASE 3: Use rules engine for deterministic verdict computation
  // If rules engine already produced a decision, use it as the authoritative verdict
  if (ruleEngineOutput && typeof ruleEngineOutput === 'object') {
    return {
      finalVerdict: ruleEngineOutput.finalVerdict,
      exitCode: ruleEngineOutput.exitCode,
      reasons: ruleEngineOutput.reasons || [],
      triggeredRuleIds: ruleEngineOutput.triggeredRuleIds || [],
      policySignals: ruleEngineOutput.policySignals
    };
  }

  // FALLBACK: Legacy verdict logic (if rules engine is not available or returns null)
  // This maintains backward compatibility with existing flow
  const reasons = [];

  const journeyVerdict = journeySummary
    ? (journeySummary.completedGoal ? 'READY' : journeySummary.abandoned ? 'DO_NOT_LAUNCH' : 'FRICTION')
    : null;

  if (journeySummary) {
    reasons.push({
      code: 'JOURNEY',
      message: journeySummary.completedGoal
        ? 'Journey completed intended human goal.'
        : journeySummary.abandoned
          ? 'Journey abandoned due to frustration/time.'
          : 'Journey incomplete; human encountered blockers.'
    });
    if (Array.isArray(journeySummary.attemptPath) && journeySummary.attemptPath.length > 0) {
      const path = journeySummary.attemptPath.map(p => `${p.attemptId}:${p.outcome}`).join(' → ');
      reasons.push({ code: 'JOURNEY_PATH', message: `Path: ${path}` });
    }
  }

  const executedAttempts = Array.isArray(attempts)
    ? attempts.filter(a => a.executed)
    : [];
  
  // PHASE 11: Exclude NOT_APPLICABLE from failure/friction counts
  const successfulAttempts = executedAttempts.filter(a => a.outcome === 'SUCCESS');
  const failedAttempts = executedAttempts.filter(a => a.outcome === 'FAILURE');
  const frictionAttempts = executedAttempts.filter(a => a.outcome === 'FRICTION');
  const notApplicableAttempts = Array.isArray(attempts) ? attempts.filter(a => a.outcome === 'NOT_APPLICABLE') : [];

  const flowList = Array.isArray(flows) ? flows : [];
  // PHASE 9: Don't count NOT_APPLICABLE flows as failures
  const failedFlows = flowList.filter(f => f.outcome === 'FAILURE' || f.success === false);
  const frictionFlows = flowList.filter(f => f.outcome === 'FRICTION');
  const notApplicableFlows = flowList.filter(f => f.outcome === 'NOT_APPLICABLE');
  const observedFlows = successfulAttempts.map(a => a.attemptId || a.id || 'unknown');

  // Observation summary always first
  if (executedAttempts.length > 0) {
    reasons.push({ code: 'OBSERVED', message: `Observed ${executedAttempts.length} attempted flow(s); successful=${successfulAttempts.length}, failed=${failedAttempts.length}, friction=${frictionAttempts.length}.` });
  }

  // PHASE 11: Report not-applicable attempts separately (not as failures)
  if (notApplicableAttempts.length > 0) {
    reasons.push({ code: 'ATTEMPTS_NOT_APPLICABLE', message: `${notApplicableAttempts.length} attempt(s) not applicable to this site (capability not observed): ${notApplicableAttempts.map(a => a.attemptId || a.id || 'unknown').join(', ')}.` });
  }

  // PHASE 9: Report not-applicable flows separately (not as failures)
  if (notApplicableFlows.length > 0) {
    reasons.push({ code: 'FLOWS_NOT_APPLICABLE', message: `${notApplicableFlows.length} flow(s) not applicable to this site: ${notApplicableFlows.map(f => f.flowId || f.flowName || 'unknown').join(', ')}.` });
  }

  // Baseline regressions
  const diff = baseline?.diffResult || baseline?.diff;
  if (diff && diff.regressions && Object.keys(diff.regressions).length > 0) {
    const regressionAttempts = Object.keys(diff.regressions);
    reasons.push({ code: 'BASELINE_REGRESSION', message: `Baseline regressions detected for: ${regressionAttempts.join(', ')}.` });
  }

  // PHASE 9: Policy evaluation - incorporate into final verdict logic
  // Don't treat policy warning (exit 2) as a separate verdict/exit code
  if (policyEval) {
    if (!policyEval.passed && policyEval.exitCode === 1) {
      // Policy hard failure (exit 1)
      reasons.push({ code: 'POLICY_FAILURE', message: policyEval.summary || 'Policy conditions not satisfied; critical issues found.' });
    } else if (!policyEval.passed && policyEval.exitCode === 2) {
      // Policy warning (exit 2) - treat as informational, not verdict-changing
      reasons.push({ code: 'POLICY_WARNING', message: policyEval.summary || 'Policy evaluation produced warnings.' });
    } else if (!policyEval.passed) {
      reasons.push({ code: 'POLICY', message: 'Policy conditions not satisfied; evidence insufficient.' });
    }
  }

  // Market impact evidence
  if (marketImpact && marketImpact.highestSeverity) {
    reasons.push({ code: 'MARKET_IMPACT', message: `Market impact severity observed: ${marketImpact.highestSeverity}.` });
  }

  // Flow/attempt failures
  if (failedAttempts.length > 0) {
    reasons.push({ code: 'CRITICAL_FLOW_FAILURE', message: `Critical flows failed: ${failedAttempts.map(a => a.attemptId || a.id || 'unknown').join(', ')}.` });
  }
  if (failedFlows.length > 0) {
    reasons.push({ code: 'FLOW_FAILURE', message: `Flow executions failed: ${failedFlows.map(f => f.flowId || f.flowName || 'unknown').join(', ')}.` });
  }
  if (frictionAttempts.length > 0 || frictionFlows.length > 0) {
    const frictionIds = [
      ...frictionAttempts.map(a => a.attemptId || a.id || 'unknown'),
      ...frictionFlows.map(f => f.flowId || f.flowName || 'unknown')
    ];
    reasons.push({ code: 'FLOW_FRICTION', message: `Flows with friction: ${frictionIds.join(', ')}.` });
  }

  // Determine verdict
  let internalVerdict;

  // PHASE 9: Base exit code on actual failures, not policy warnings
  const hasCriticalFailures = failedAttempts.length > 0 || failedFlows.length > 0;
  const hasPolicyHardFailure = policyEval && !policyEval.passed && policyEval.exitCode === 1;

  // PHASE 11: Count only applicable attempts and flows for verdict
  const applicableAttempts = Array.isArray(attempts) 
    ? attempts.filter(a => a.outcome !== 'NOT_APPLICABLE')
    : [];
  const applicableFlows = Array.isArray(flows)
    ? flows.filter(f => f.outcome !== 'NOT_APPLICABLE')
    : [];

  if (applicableAttempts.length === 0 && applicableFlows.length === 0) {
    internalVerdict = 'INSUFFICIENT_DATA';
    reasons.unshift({ code: 'NO_OBSERVATIONS', message: 'No applicable flows found to execute; only static or configuration checks available.' });
  } else if (!hasCriticalFailures && !hasPolicyHardFailure && frictionAttempts.length === 0 && frictionFlows.length === 0 && (!policyEval || policyEval.passed || policyEval.exitCode === 2)) {
    // PHASE 9: Policy warnings (exit 2) don't block OBSERVED verdict
    internalVerdict = 'OBSERVED';
    if (observedFlows.length > 0) {
      reasons.push({ code: 'OBSERVED_FLOWS', message: `Observed end-to-end flows: ${observedFlows.join(', ')}.` });
    }
    reasons.push({ code: 'SCOPE', message: 'Verdict based solely on executed flows; no claim about business readiness beyond observed actions.' });
  } else {
    internalVerdict = 'PARTIAL';
    if (observedFlows.length > 0) {
      reasons.push({ code: 'PARTIAL_SCOPE', message: `Some flows observed (${observedFlows.join(', ')}), but at least one flow failed or could not be confirmed.` });
    } else {
      reasons.push({ code: 'PARTIAL_SCOPE', message: 'Flows were attempted but outcomes include failures or friction; observations are incomplete.' });
    }
  }

  if (journeyVerdict) {
    const canonicalFromJourney = journeyVerdict;
    const canonicalFromInternal = toCanonicalVerdict(internalVerdict);
    const rank = { READY: 0, FRICTION: 1, DO_NOT_LAUNCH: 2 };
    const chosenCanonical = rank[canonicalFromJourney] > rank[canonicalFromInternal]
      ? canonicalFromJourney
      : canonicalFromInternal;
    internalVerdict = toInternalVerdict(chosenCanonical);
  }

  // Ensure deterministic ordering: sort by code then message
  const orderedReasons = reasons
    .filter(r => r && r.code && r.message)
    .sort((a, b) => a.code.localeCompare(b.code) || a.message.localeCompare(b.message));

  const finalVerdict = toCanonicalVerdict(internalVerdict);
  const exitCode = mapExitCodeFromCanonical(finalVerdict);
  
  return { finalVerdict, exitCode, reasons: orderedReasons };
}

function hashFile(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function writeIntegrityManifest(runDir) {
  const manifest = {
    generatedAt: new Date().toISOString(),
    files: []
  };

  const allFiles = [];

  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        allFiles.push(full);
      }
    }
  };

  walk(runDir);

  for (const target of allFiles) {
    if (fs.existsSync(target)) {
      manifest.files.push({
        path: path.relative(runDir, target),
        sha256: hashFile(target)
      });
    }
  }

  const manifestPath = path.join(runDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return {
    manifestPath,
    hashedFiles: manifest.files.length,
    totalFiles: allFiles.length
  };
}

function buildRealityExplanation({ finalDecision = {}, attemptStats = {}, marketImpact = {}, policyEval = {}, baseline = {}, flows = [], attempts = [], coverage = {}, observedCapabilities = null }) {
  const verdict = finalDecision.finalVerdict || 'UNKNOWN';
  const exitCode = typeof finalDecision.exitCode === 'number' ? finalDecision.exitCode : 1;

  const executedAttempts = (attempts || []).filter(isExecutedAttempt);
  const successes = executedAttempts.filter(a => a.outcome === 'SUCCESS');
  const failures = executedAttempts.filter(a => a.outcome === 'FAILURE');
  const frictions = executedAttempts.filter(a => a.outcome === 'FRICTION');

  const flowList = Array.isArray(flows) ? flows : [];
  const flowFailures = flowList.filter(f => f.outcome === 'FAILURE' || f.success === false);
  const flowFrictions = flowList.filter(f => f.outcome === 'FRICTION');
  const flowSuccesses = flowList.filter(f => f.outcome === 'SUCCESS' || f.success === true);

  const observedDetails = [];
  if (executedAttempts.length > 0) {
    const attemptSummary = executedAttempts
      .map(a => `${a.attemptId || a.id || 'unknown'} (${a.outcome || 'unknown'})`)
      .sort();
    observedDetails.push(`Executed ${executedAttempts.length} attempt(s): ${attemptSummary.join(', ')}.`);
  } else {
    observedDetails.push('No user journeys executed; evidence limited to crawl/policy signals.');
  }
  if (flowSuccesses.length > 0) {
    const successFlows = flowSuccesses
      .map(f => f.flowId || f.flowName || 'unknown')
      .sort();
    observedDetails.push(`Successful flows: ${successFlows.join(', ')}.`);
  }

  const couldNotConfirm = [];
  if (failures.length > 0) {
    const failureAttempts = failures
      .map(a => `${a.attemptId || a.id || 'unknown'} (${a.error ? String(a.error).split('\n')[0] : a.outcome})`)
      .sort();
    couldNotConfirm.push(`Failures detected in: ${failureAttempts.join(', ')}.`);
  }
  if (frictions.length > 0) {
    const frictionAttempts = frictions.map(a => a.attemptId || a.id || 'unknown').sort();
    couldNotConfirm.push(`Friction observed in: ${frictionAttempts.join(', ')}.`);
  }
  if (flowFailures.length > 0) {
    const ff = flowFailures.map(f => f.flowId || f.flowName || 'unknown').sort();
    couldNotConfirm.push(`Flow failures: ${ff.join(', ')}.`);
  }
  if (flowFrictions.length > 0) {
    const ff = flowFrictions.map(f => f.flowId || f.flowName || 'unknown').sort();
    couldNotConfirm.push(`Flow friction: ${ff.join(', ')}.`);
  }
  if (policyEval && policyEval.passed === false) {
    const reason = policyEval.summary || 'Policy conditions not satisfied.';
    couldNotConfirm.push(`Policy check failed: ${reason}`);
  }
  const diff = baseline?.diffResult || baseline?.diff;
  if (diff && diff.regressions && Object.keys(diff.regressions).length > 0) {
    const regressionAttempts = Object.keys(diff.regressions).sort();
    couldNotConfirm.push(`Baseline regressions: ${regressionAttempts.join(', ')}.`);
  }
  // PHASE 11: Only count coverage gaps for APPLICABLE attempts
  const applicableGaps = coverage && typeof coverage.gaps === 'number' && coverage.gaps > 0
    && (attemptStats.total !== attemptStats.skippedNotApplicable);
  if (applicableGaps) {
    couldNotConfirm.push(`Coverage gaps: ${coverage.gaps} applicable attempt(s) not executed.`);
  }
  if (couldNotConfirm.length === 0) {
    couldNotConfirm.push('No outstanding gaps; all observed and applicable items confirmed.');
  }

  // PHASE 11: "What Was Not Observed" section - clarity for non-observed capabilities
  const notObserved = [];
  if (observedCapabilities && observedCapabilities.capabilities) {
    const notObservedCaps = Object.entries(observedCapabilities.capabilities)
      .filter(([cap, observed]) => observed === false && cap !== 'internal_admin')
      .map(([cap, _]) => cap)
      .sort();
    if (notObservedCaps.length > 0) {
      notObserved.push(`Not observed in UI: ${notObservedCaps.join(', ')}.`);
      notObserved.push('These capabilities were not visible in the user interface and were NOT tested.');
      notObserved.push('Guardian does NOT penalize sites for features that are not present.');
    }
    
    // Separate section for internal/admin surfaces (if detected)
    const internalAdminDetected = observedCapabilities.capabilities.internal_admin === true;
    if (internalAdminDetected) {
      notObserved.push('');
      notObserved.push('Internal Surface Detected:');
      notObserved.push('Admin/staff areas found (e.g., /admin, /dashboard) with internal labels.');
      notObserved.push('These internal surfaces are NOT tested and do NOT affect public readiness.');
    }
  }
  if (attemptStats.skippedNotApplicable && attemptStats.skippedNotApplicable > 0) {
    notObserved.push(`${attemptStats.skippedNotApplicable} attempt(s) marked NOT_APPLICABLE (capability not observed).`);
  }
  if (notObserved.length === 0) {
    notObserved.push('All expected capabilities were observed in the UI.');
  }

  const evidenceSummary = [];
  const executedCount = attemptStats.executed ?? executedAttempts.length;
  const totalPlanned = attemptStats.total ?? attemptStats.enabledPlannedCount ?? executedAttempts.length;
  evidenceSummary.push(`Attempt outcomes: executed=${executedCount}, success=${attemptStats.successful ?? successes.length}, failed=${attemptStats.failed ?? failures.length}, skipped=${attemptStats.skipped ?? 0}.`);
  evidenceSummary.push(`Flow outcomes: success=${flowSuccesses.length}, failures=${flowFailures.length}, friction=${flowFrictions.length}.`);
  if (marketImpact && marketImpact.highestSeverity) {
    evidenceSummary.push(`Market severity observed: ${marketImpact.highestSeverity}.`);
  } else {
    evidenceSummary.push('Market severity not reported.');
  }
  if (policyEval && typeof policyEval.passed === 'boolean') {
    evidenceSummary.push(`Policy evaluation: ${policyEval.passed ? 'passed' : 'failed'} (exit ${policyEval.exitCode ?? 'unknown'}).`);
  } else {
    evidenceSummary.push('Policy evaluation: not run.');
  }
  if (diff && diff.regressions) {
    const regressions = Object.keys(diff.regressions);
    evidenceSummary.push(`Baseline regressions: ${regressions.length > 0 ? regressions.join(', ') : 'none'}.`);
  } else {
    evidenceSummary.push('Baseline comparison: none or no regressions detected.');
  }

  const limits = [];
  const gaps = coverage && typeof coverage.gaps === 'number' ? coverage.gaps : Math.max((totalPlanned || 0) - (executedCount || 0), 0);
  limits.push(`Coverage: ${executedCount}/${totalPlanned || 0} attempts executed; gaps=${gaps}.`);
  if (attemptStats.disabled) {
    limits.push(`Disabled by preset: ${attemptStats.disabled} attempt(s).`);
  }
  if (attemptStats.skippedUserFiltered) {
    limits.push(`User-filtered skips: ${attemptStats.skippedUserFiltered}.`);
  }
  if (attemptStats.skippedNotApplicable) {
    limits.push(`Not-applicable skips: ${attemptStats.skippedNotApplicable}.`);
  }
  if (attemptStats.skippedMissing) {
    limits.push(`Missing engine skips: ${attemptStats.skippedMissing}.`);
  }
  if (limits.length === 0) {
    limits.push('No additional limits detected beyond observed attempts.');
  }

  let whyThisVerdict;
  const whyNotList = [];
  if (verdict === 'OBSERVED') {
    whyThisVerdict = 'All executed attempts succeeded; no failures, friction, or policy blockers detected.';
    whyNotList.push('Not PARTIAL because no failures, friction, or policy shortfalls remain.');
    whyNotList.push(`Not INSUFFICIENT_DATA because ${executedCount} attempt(s) executed with complete evidence.`);
  } else if (verdict === 'PARTIAL') {
    const partialDrivers = [];
    if (failures.length > 0) partialDrivers.push(`${failures.length} failed attempt(s)`);
    if (frictions.length > 0) partialDrivers.push(`${frictions.length} friction attempt(s)`);
    if (flowFailures.length > 0) partialDrivers.push(`${flowFailures.length} failed flow(s)`);
    if (policyEval && policyEval.passed === false && policyEval.exitCode === 1) partialDrivers.push('policy hard failure');
    if (policyEval && policyEval.passed === false && policyEval.exitCode === 2) partialDrivers.push('policy warnings');
    whyThisVerdict = partialDrivers.length > 0
      ? `Evidence is mixed: ${partialDrivers.join('; ')}.`
      : 'Evidence incomplete or mixed; not all planned signals confirmed.';
    whyNotList.push('Not OBSERVED because at least one failure, friction, or policy issue remains.');
    whyNotList.push(`Not INSUFFICIENT_DATA because ${executedCount} attempt(s) executed and produced evidence.`);
  } else if (verdict === 'INSUFFICIENT_DATA') {
    whyThisVerdict = 'No meaningful user flows were executed; evidence is insufficient to claim readiness.';
    whyNotList.push('Not OBSERVED because no successful flows were confirmed.');
    whyNotList.push('Not PARTIAL because there was no executable evidence to partially support readiness.');
  } else if (verdict === 'READY' || verdict === 'FRICTION' || verdict === 'DO_NOT_LAUNCH') {
    // PHASE 11: Use actual reasons from decision when available
    const reasonsList = finalDecision.reasons || [];
    if (reasonsList.length > 0) {
      // Extract top reasons (limit to 3 for summary clarity)
      const topReasons = reasonsList.slice(0, 3).map(r => {
        if (typeof r === 'string') return r;
        if (r.message) return r.message;
        if (r.reason) return r.reason;
        return String(r);
      });
      whyThisVerdict = topReasons.join('; ');
    } else {
      // Fallback: build from evidence
      const evidenceDrivers = [];
      if (verdict === 'DO_NOT_LAUNCH') {
        if (flowFailures.length > 0) evidenceDrivers.push(`${flowFailures.length} flow failure(s)`);
        if (failures.length > 0) evidenceDrivers.push(`${failures.length} attempt failure(s)`);
      } else if (verdict === 'FRICTION') {
        if (frictions.length > 0) evidenceDrivers.push(`${frictions.length} friction point(s)`);
        if (flowFrictions.length > 0) evidenceDrivers.push(`${flowFrictions.length} flow friction(s)`);
      }
      whyThisVerdict = evidenceDrivers.length > 0
        ? evidenceDrivers.join('; ')
        : `Guardian assessed the evidence and reached verdict: ${verdict}.`;
    }
    whyNotList.push(`Other verdicts not applicable based on observed evidence and policy evaluation.`);
  } else {
    // PHASE 9: Should never reach here if verdict exists
    whyThisVerdict = `Guardian reached verdict: ${verdict || 'UNKNOWN'} based on observed evidence.`;
    whyNotList.push('Alternative verdicts not evaluated due to incomplete state.');
  }

  const finalVerdictSection = {
    verdict,
    exitCode,
    explanation: whyThisVerdict,
    whyNot: whyNotList,
    reasons: (finalDecision.reasons || []).map(r => {
      if (typeof r === 'string') return r;
      if (r.ruleId && r.message) return `${r.ruleId}: ${r.message}`;
      if (r.code && r.message) return `${r.code}: ${r.message}`;
      return r.message || r.reason || String(r);
    })
  };

  const sections = {
    'Final Verdict': finalVerdictSection,
    'What Guardian Observed': {
      summary: observedDetails[0],
      details: observedDetails
    },
    'What Guardian Could Not Confirm': {
      summary: couldNotConfirm[0],
      details: couldNotConfirm
    },
    'What Was Not Observed': {
      summary: notObserved[0],
      details: notObserved
    },
    'Evidence Summary': {
      summary: evidenceSummary[0],
      details: evidenceSummary
    },
    'Limits of This Run': {
      summary: limits[0],
      details: limits
    }
  };

  return { verdict: finalVerdictSection, sections };
}

function writeDecisionArtifact({ runDir, runId, baseUrl, policyName, preset, finalDecision, attemptStats, marketImpact, policyEval, baseline, flows, resolved, attestation, audit, attempts = [], coverage = {}, explanation, ruleEngineOutput = null, siteIntelligence = null, actionHints = [], honestyContract = null, observedCapabilities = null }) {
  const structuredExplanation = explanation || buildRealityExplanation({ finalDecision, attemptStats, marketImpact, policyEval, baseline, flows, attempts, coverage, observedCapabilities });
  const safePolicyEval = policyEval || { passed: true, exitCode: 0, summary: 'Policy evaluation not run.' };
  const diff = baseline?.diffResult || baseline?.diff || {};
  const auditSummary = audit ? {
    tested: Array.isArray(audit.executedAttempts) ? audit.executedAttempts : [],
    notTested: {
      disabledByPreset: audit.notTested?.disabledByPreset || [],
      userFiltered: audit.notTested?.userFiltered || [],
      notApplicable: audit.notTested?.notApplicable || [],
      missing: audit.notTested?.missing || []
    }
  } : {
    tested: [],
    notTested: { disabledByPreset: [], userFiltered: [], notApplicable: [], missing: [] }
  };

  const decision = {
    runId,
    url: baseUrl,
    timestamp: new Date().toISOString(),
    preset: preset || 'default',
    policyName: policyName || 'unknown',
    finalVerdict: finalDecision.finalVerdict,
    exitCode: finalDecision.exitCode,
    reasons: finalDecision.reasons,
    actionHints: actionHints || [],
    resolved: resolved || {},
    attestation: attestation || {},
    counts: {
      attemptsExecuted: attemptStats.executed || 0,
      successful: attemptStats.successful || 0,
      failed: attemptStats.failed || 0,
      skipped: attemptStats.skipped || 0,
      nearSuccess: attemptStats.nearSuccess || 0
    },
    inputs: {
      policy: safePolicyEval,
      baseline: diff,
      market: marketImpact || {},
      flows: {
        total: Array.isArray(flows) ? flows.length : 0,
        failures: Array.isArray(flows) ? flows.filter(f => f.outcome === 'FAILURE' || f.success === false).length : 0,
        frictions: Array.isArray(flows) ? flows.filter(f => f.outcome === 'FRICTION').length : 0
      }
    },
    outcomes: {
      flows: Array.isArray(flows) ? flows : [],
      attempts: Array.isArray(attempts) ? attempts : []
    },
    coverage: {
      total: coverage.total || attemptStats.enabledPlannedCount || attemptStats.total || 0,
      executed: coverage.executed || attemptStats.executed || 0,
      gaps: coverage.gaps ?? Math.max((attemptStats.total || 0) - (attemptStats.executed || 0), 0),
      skipped: coverage.details || attemptStats.skippedDetails || [],
      disabled: coverage.disabled || attemptStats.disabledDetails || []
    },
    auditSummary,
    sections: structuredExplanation.sections,
    explanation: structuredExplanation.verdict,
    ...(siteIntelligence && { siteIntelligence }),
    // PHASE 11: Observable capabilities tracking
    observedCapabilities: observedCapabilities ? observedCapabilities.capabilities : null,
    applicability: {
      relevantTotal: coverage.total || attemptStats.enabledPlannedCount || 0,
      executed: coverage.executed || attemptStats.executed || 0,
      notObserved: attemptStats.skippedNotApplicable || 0,
      skippedNeutral: (attemptStats.skippedUserFiltered || 0) + (attemptStats.disabled || 0),
      coveragePercent: coverage.percent || 0
    },
    // PHASE 3: Include rules engine evaluation
    policySignals: ruleEngineOutput?.policySignals || finalDecision?.policySignals || null,
    triggeredRules: ruleEngineOutput?.triggeredRuleIds || finalDecision?.triggeredRuleIds || [],
    // HONESTY CONTRACT: Include tested/untested scope and explicit limits
    honestyContract: honestyContract ? {
      testedScope: honestyContract.testedScope || [],
      untestedScope: honestyContract.untestedScope || [],
      limits: honestyContract.limits || [],
      nonClaims: honestyContract.nonClaims || [],
      coverageStats: honestyContract.coverageStats || {},
      confidenceBasis: honestyContract.confidenceBasis || {},
      disclaimer: 'Guardian can only report on what it tested. Untested areas may contain issues.'
    } : {
      testedScope: [],
      untestedScope: [],
      limits: ['Honesty data not available'],
      coveragePercent: 0,
      disclaimer: 'HONESTY VIOLATION: Missing honesty contract - claims cannot be verified'
    }
  };

  const decisionPath = path.join(runDir, 'decision.json');
  const sanitizedDecision = sanitizeArtifact(decision);
  fs.writeFileSync(decisionPath, JSON.stringify(sanitizedDecision, null, 2));
  return decisionPath;
}

function writeRunSummary(runDir, finalDecision, attemptStats, marketImpact, policyEval, explanation, siteIntelligence = null, actionHints = []) {
  const structuredExplanation = explanation || buildRealityExplanation({ finalDecision, attemptStats, marketImpact, policyEval });
  const sections = structuredExplanation.sections;

  const lines = [];
  lines.push(`Final Verdict: ${finalDecision.finalVerdict} (exit ${finalDecision.exitCode})`);
  lines.push(`Why this verdict: ${sections['Final Verdict'].explanation}`);
  if (sections['Final Verdict'].whyNot && sections['Final Verdict'].whyNot.length > 0) {
    lines.push(`Why not alternatives: ${sections['Final Verdict'].whyNot.join(' ')}`);
  }
  if (siteIntelligence) {
    const pct = Math.round((siteIntelligence.confidence || 0) * 100);
    lines.push(`Site Type: ${siteIntelligence.siteType} (${pct}% confidence)`);
    const caps = Object.entries(siteIntelligence.capabilities || {})
      .filter(([_, v]) => v && v.supported)
      .map(([k]) => k.replace('supports_', ''));
    if (caps.length > 0) {
      lines.push(`Detected Capabilities: ${caps.join(', ')}`);
    }
  }
  lines.push('');
  lines.push('What Guardian Observed:');
  sections['What Guardian Observed'].details.forEach(d => lines.push(`- ${d}`));
  lines.push('');
  lines.push('What Guardian Could Not Confirm:');
  sections['What Guardian Could Not Confirm'].details.forEach(d => lines.push(`- ${d}`));
  lines.push('');
  if (sections['What Was Not Observed'] && sections['What Was Not Observed'].details.length > 0) {
    lines.push('What Was Not Observed:');
    sections['What Was Not Observed'].details.forEach(d => lines.push(`- ${d}`));
    lines.push('');
  }
  lines.push('Evidence Summary:');
  sections['Evidence Summary'].details.forEach(d => lines.push(`- ${d}`));
  lines.push('');
  lines.push('Limits of This Run:');
  sections['Limits of This Run'].details.forEach(d => lines.push(`- ${d}`));
  
  if (actionHints && actionHints.length > 0) {
    lines.push('');
    lines.push('Action Hints:');
    lines.push(formatHintsForSummary(actionHints));
  }

  const summaryPath = path.join(runDir, 'summary.txt');
  fs.writeFileSync(summaryPath, lines.join('\n'));
  // Also emit a markdown version for consistency with report discovery
  try {
    const mdLines = [];
    mdLines.push(`# Guardian Reality Summary`);
    mdLines.push('');

    mdLines.push(`## Final Verdict`);
    mdLines.push(`- Verdict: ${finalDecision.finalVerdict} (exit ${finalDecision.exitCode})`);
    mdLines.push(`- Why this verdict: ${sections['Final Verdict'].explanation}`);
    if (sections['Final Verdict'].whyNot && sections['Final Verdict'].whyNot.length > 0) {
      sections['Final Verdict'].whyNot.forEach(reason => mdLines.push(`- ${reason}`));
    }
    if (sections['Final Verdict'].reasons && sections['Final Verdict'].reasons.length > 0) {
      mdLines.push(`- Evidence reasons: ${sections['Final Verdict'].reasons.join(' ')}`);
    }
    if (siteIntelligence) {
      const pct = Math.round((siteIntelligence.confidence || 0) * 100);
      mdLines.push(`- Site type: ${siteIntelligence.siteType} (${pct}% confidence)`);
      const capsMd = Object.entries(siteIntelligence.capabilities || {})
        .filter(([_, v]) => v && v.supported)
        .map(([k]) => k.replace('supports_', ''));
      if (capsMd.length > 0) {
        mdLines.push(`- Detected capabilities: ${capsMd.join(', ')}`);
      }
    }

    mdLines.push('');
    mdLines.push(`## What Guardian Observed`);
    sections['What Guardian Observed'].details.forEach(d => mdLines.push(`- ${d}`));

    mdLines.push('');
    mdLines.push(`## What Guardian Could Not Confirm`);
    sections['What Guardian Could Not Confirm'].details.forEach(d => mdLines.push(`- ${d}`));

    if (sections['What Was Not Observed'] && sections['What Was Not Observed'].details.length > 0) {
      mdLines.push('');
      mdLines.push(`## What Was Not Observed`);
      sections['What Was Not Observed'].details.forEach(d => mdLines.push(`- ${d}`));
    }

    mdLines.push('');
    mdLines.push(`## Evidence Summary`);
    sections['Evidence Summary'].details.forEach(d => mdLines.push(`- ${d}`));

    mdLines.push('');
    mdLines.push(`## Limits of This Run`);
    sections['Limits of This Run'].details.forEach(d => mdLines.push(`- ${d}`));

    if (actionHints && actionHints.length > 0) {
      mdLines.push('');
      mdLines.push(`## Action Hints`);
      mdLines.push('');
      mdLines.push(formatHintsForSummary(actionHints));
    }

    const summaryMdPath = path.join(runDir, 'summary.md');
    fs.writeFileSync(summaryMdPath, mdLines.join('\n'));
  } catch (_) {}
  return summaryPath;
}

module.exports = { executeReality, runRealityCLI, computeFlowExitCode, applySafeDefaults, writeDecisionArtifact, computeFinalVerdict, calculateCoverage };