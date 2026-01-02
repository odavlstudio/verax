#!/usr/bin/env node
// Windows UTF-8 encoding initialization
if (process.platform === 'win32') {
  process.stdout.setEncoding('utf-8');
  process.stderr.setEncoding('utf-8');
}

// Minimal DX: handle --version/-v immediately (before any other work)
const args = process.argv.slice(2);
if (args.length === 1 && (args[0] === '--version' || args[0] === '-v')) {
  try {
    const pkg = require('../package.json');
    console.log(pkg.version);
    process.exit(0);
  } catch (e) {
    console.error('Version unavailable');
    process.exit(1);
  }
}

// GLOBAL HELP (Level 1): provide a real, working guardian --help
function printGlobalHelp() {
  console.log(`
ODAVL Guardian — Market Reality Testing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUICK START (Recommended)

  guardian reality --url <url>

  Opens your site in a browser, runs realistic user flows,
  and generates a verdict (READY | FRICTION | DO_NOT_LAUNCH).

  Output:
    - .odavlguardian/<timestamp>/decision.json (machine-readable)
    - .odavlguardian/<timestamp>/summary.md (human-readable)

COMMON OPTIONS

  --url <url>               Site to test (required)
  --preset <name>          Test preset (startup, custom, etc)
                            Default: startup
  --artifacts <dir>        Output directory
                            Default: .odavlguardian
  --fast                    Quick run (fewer attempts)
  --headful                 Show browser window

VS CODE INTEGRATION

  Command Palette → "Guardian: Run Reality Check"

  Automatically tests your site from VS Code and shows results.

ADVANCED COMMANDS

  guardian smoke <url>                 Fast sanity check
  guardian scan <url>                  Full advanced scan
  guardian baseline save|check <url>   Manage baselines
  guardian list                        Show all reports
  guardian cleanup                     Remove old reports

OPTIONS

  --help, -h                Show this help message
  --version, -v             Show version

EXAMPLES

  # Test production site
  guardian reality --url https://example.com

  # Test with staging preset
  guardian reality --url https://staging.example.com --preset startup

  # Quick test with no screenshots
  guardian smoke --url https://example.com

  # Save baseline for regression detection
  guardian baseline save --url https://example.com

CONFIG

  Guardian automatically detects guardian.config.json in your project
  root. Create one to customize crawl depth, timeouts, etc. See docs
  for the schema.

DOCUMENTATION

  More info: https://github.com/odavlstudio/odavlguardian
`);
}

// Handle global --help (or no args) before heavy loads
if (args.length === 0 || (args.length === 1 && (args[0] === '--help' || args[0] === '-h'))) {
  printGlobalHelp();
  process.exit(0);
}

// PHASE 6: Early flag validation (before heavy module loads)
const { validateFlags, reportFlagError } = require('../src/guardian/flag-validator');
const validation = validateFlags(process.argv);
if (!validation.valid) {
  reportFlagError(validation);
  process.exit(2);
}

// PHASE 4: Config validation (fail fast on invalid config)
const { loadAndValidateConfig, reportConfigIssues, getDefaultConfig } = require('../src/guardian/config-validator');

// PHASE 6: First-run detection (lightweight)
const { isFirstRun, markAsRun, printWelcome, printFirstRunHint } = require('../src/guardian/first-run');

const { runAttemptCLI } = require('../src/guardian/attempt');
const { runRealityCLI } = require('../src/guardian/reality');
const { runSmokeCLI } = require('../src/guardian/smoke');
const { runGuardian } = require('../src/guardian');
const { runJourneyScanCLI } = require('../src/guardian/journey-scan-cli');
const { runLiveCLI } = require('../src/guardian/live-cli');
const { saveBaseline, checkBaseline } = require('../src/guardian/baseline');
const { getDefaultAttemptIds } = require('../src/guardian/attempt-registry');
const { initGuardian } = require('../src/guardian/init-command');
const { printPresets } = require('../src/guardian/preset-loader');
const { listRuns } = require('../src/guardian/run-list');
const { cleanup } = require('../src/guardian/run-cleanup');
const { generateTemplate, listTemplates } = require('../src/guardian/template-command');

// Phase 8: Plan enforcement
const { checkCanScan, performScan, checkFeatureAllowed, getPlanSummary, getUpgradeMessage } = require('../src/plans/plan-manager');

// Phase 10: Founder tracking and feedback
const { registerUser, getFounderMessage, isFoundingUser } = require('../src/founder/founder-tracker');
const { runFeedbackSession } = require('../src/founder/feedback-system');
const { recordFirstScan, recordFirstLive, recordFirstUpgrade } = require('../src/founder/usage-signals');

// Phase 11: Enterprise features
const { addSite, removeSite, getSite, getSites, getSitesByProject, listProjects } = require('../src/enterprise/site-manager');
const { addUser, removeUser, getUsers, getCurrentUser, requirePermission, listRoles } = require('../src/enterprise/rbac');
const { logAudit, readAuditLogs, getAuditSummary, AUDIT_ACTIONS } = require('../src/enterprise/audit-logger');
const { exportReportToPDF, listAvailableReports } = require('../src/enterprise/pdf-exporter');

// Phase 12.1: Recipes
const { getAllRecipes, getRecipe, getRecipesByPlatform, addRecipe, removeRecipe, importRecipes, exportRecipes, exportRecipeWithMetadata, importRecipeWithMetadata } = require('../src/recipes/recipe-store');
const { validateRecipe, formatRecipe } = require('../src/recipes/recipe-engine');
const { getRegistryEntry, computeRecipeChecksum } = require('../src/recipes/recipe-registry');
const { resolveScanPreset } = require('../src/guardian/scan-presets');

function parseArgs(argv) {
  const args = argv.slice(2);
  const subcommand = args[0];

  // Note: Early flag validation in main() catches unknown commands
  // so we don't need to re-validate here

  if (subcommand === 'init') {
    return { subcommand: 'init', config: parseInitArgs(args.slice(1)) };
  }

  if (subcommand === 'protect') {
    return { subcommand: 'protect', config: parseProtectArgs(args.slice(1)) };
  }

  if (subcommand === 'presets') {
    return { subcommand: 'presets', config: {} };
  }

  if (subcommand === 'template') {
    return { subcommand: 'template', config: parseTemplateArgs(args.slice(1)) };
  }

  if (subcommand === 'list') {
    return { subcommand: 'list', config: parseListArgs(args.slice(1)) };
  }

  if (subcommand === 'cleanup') {
    return { subcommand: 'cleanup', config: parseCleanupArgs(args.slice(1)) };
  }

  if (subcommand === 'attempt') {
    return { subcommand: 'attempt', config: parseAttemptArgs(args.slice(1)) };
  }

  if (subcommand === 'reality') {
    return { subcommand: 'reality', config: parseRealityArgs(args.slice(1)) };
  }

  if (subcommand === 'smoke') {
    return { subcommand: 'smoke', config: parseSmokeArgs(args.slice(1)) };
  }

  if (subcommand === 'check') {
    return { subcommand: 'smoke', config: parseSmokeArgs(args.slice(1)) };
  }

  if (subcommand === 'baseline') {
    const action = args[1];
    if (action === 'save') {
      return { subcommand: 'baseline-save', config: parseBaselineSaveArgs(args.slice(2)) };
    }
    if (action === 'check') {
      return { subcommand: 'baseline-check', config: parseBaselineCheckArgs(args.slice(2)) };
    }
    printHelpBaseline();
    process.exit(0);
  }

  // MVP: Human Journey Scan
  if (subcommand === 'journey-scan' || subcommand === 'journey') {
    return { subcommand: 'journey-scan', config: parseJourneyScanArgs(args.slice(1)) };
  }

  if (subcommand === 'live') {
    // Support scheduler subcommands: start|stop|status
    const action = args[1];
    if (action === 'start') {
      return { subcommand: 'live-start', config: parseLiveStartArgs(args.slice(2)) };
    }
    if (action === 'stop') {
      return { subcommand: 'live-stop', config: parseLiveStopArgs(args.slice(2)) };
    }
    if (action === 'status') {
      return { subcommand: 'live-status', config: {} };
    }
    return { subcommand: 'live', config: parseLiveArgs(args.slice(1)) };
  }

  if (subcommand === 'ci') {
    return { subcommand: 'ci', config: parseJourneyScanArgs(args.slice(1)) };
  }

  // Phase 6: Productized one-command scan
  if (subcommand === 'scan') {
    return { subcommand: 'scan', config: parseScanArgs(args.slice(1)) };
  }

  // Phase 8: Plan management
  if (subcommand === 'plan') {
    return { subcommand: 'plan', config: {} };
  }

  if (subcommand === 'upgrade') {
    const targetPlan = args[1];
    return { subcommand: 'upgrade', config: { plan: targetPlan } };
  }

  // Phase 10: Feedback command
  if (subcommand === 'feedback') {
    return { subcommand: 'feedback', config: {} };
  }

  // Phase 11: Enterprise commands
  if (subcommand === 'sites') {
    return { subcommand: 'sites', config: parseSitesArgs(args.slice(1)) };
  }

  if (subcommand === 'users') {
    return { subcommand: 'users', config: parseUsersArgs(args.slice(1)) };
  }

  if (subcommand === 'audit') {
    return { subcommand: 'audit', config: parseAuditArgs(args.slice(1)) };
  }

  if (subcommand === 'export') {
    return { subcommand: 'export', config: parseExportArgs(args.slice(1)) };
  }

  // Phase 12.1: Recipes
  if (subcommand === 'recipe') {
    return { subcommand: 'recipe', config: parseRecipeArgs(args.slice(1)) };
  }

  // LEVEL 1 GOLDEN PATH: guardian --url routes to Reality (not legacy crawl)
  // If first arg is --url, treat it as guardian reality --url
  if (args.length > 0 && args[0] === '--url') {
    return { subcommand: 'reality', config: parseRealityArgs(args) };
  }

  // Legacy crawl command (explicit only)
  if (subcommand === 'crawl') {
    return { subcommand: 'crawl', config: parseCrawlArgs(args.slice(1)) };
  }

  // Unknown command
  console.error(`Unknown command: ${subcommand}`);
  console.error('Run "guardian --help" for Level 1 usage.');
  process.exit(2);
}

function parseCrawlArgs(args) {
  const os = require('os');
  const path = require('path');
  const config = {
    maxPages: 25,
    maxDepth: 3,
    timeout: 20000,
    artifactsDir: path.join(os.tmpdir(), 'odavl-guardian')
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      config.baseUrl = args[i + 1];
      i++;
    }
    if (args[i] === '--max-pages' && args[i + 1]) {
      config.maxPages = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === '--max-depth' && args[i + 1]) {
      config.maxDepth = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === '--timeout' && args[i + 1]) {
      config.timeout = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === '--artifacts' && args[i + 1]) {
      config.artifactsDir = args[i + 1];
      i++;
    }
    if (args[i] === '--help' || args[i] === '-h') {
      printHelpCrawl();
      process.exit(0);
    }
  }

  if (!config.baseUrl) {
    console.error('Error: --url is required');
    console.error('Usage: guardian --url <baseUrl> [options]');
    process.exit(2);
  }

  return config;
}

// Apply preset configuration deterministically across commands
function applyPresetConfig(config) {
  const presetName = config.preset || 'landing';
  let preset;
  try {
    preset = resolveScanPreset(presetName);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(2);
  }

  const applied = { ...config };
  applied.preset = preset.id;
  applied.attempts = preset.attempts;
  applied.disabledAttempts = preset.disabledAttempts || [];
  applied.flows = preset.flows;
  applied.policy = applied.policy || preset.policy;
  if (applied.failFast === undefined) {
    applied.failFast = preset.failFast;
  }
  applied.evidencePreset = preset.evidence || {};
  return applied;
}

// MVP: Journey Scan command parser
function parseJourneyScanArgs(args) {
  const os = require('os');
  const path = require('path');
  const config = {
    baseUrl: undefined,
    preset: 'saas',
    artifactsDir: path.join(os.tmpdir(), 'odavl-guardian'),
    headless: true,
    timeout: 20000,
    presetProvided: false
  };

  // First arg is URL if it doesn't start with --
  if (args.length > 0 && !args[0].startsWith('--')) {
    config.baseUrl = args[0];
    args = args.slice(1);
  }

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--url' && args[i + 1]) { config.baseUrl = args[i + 1]; i++; }
    else if (a === '--preset' && args[i + 1]) { config.preset = args[i + 1]; config.presetProvided = true; i++; }
    else if (a === '--out' && args[i + 1]) { config.artifactsDir = args[i + 1]; i++; }
    else if (a === '--artifacts' && args[i + 1]) { config.artifactsDir = args[i + 1]; i++; }
    else if (a === '--timeout' && args[i + 1]) { config.timeout = parseInt(args[i + 1], 10); i++; }
    else if (a === '--headful') { config.headless = false; }
    else if (a === '--help' || a === '-h') { printHelpJourneyScan(); process.exit(0); }
  }

  if (!config.baseUrl) {
    console.error('Error: --url is required');
    console.error('Usage: guardian journey-scan --url <url> [--preset saas|shop|landing] [--out dir]');
    process.exit(2);
  }

  return config;
}

function parseLiveArgs(args) {
  const os = require('os');
  const path = require('path');
  const config = {
    baseUrl: undefined,
    artifactsDir: path.join(os.tmpdir(), 'odavl-guardian'),
    headless: true,
    timeout: 20000,
    intervalMinutes: null,
    preset: 'saas',
    presetProvided: false,
    cooldownMinutes: 60
  };

  if (args.length > 0 && !args[0].startsWith('--')) {
    config.baseUrl = args[0];
    args = args.slice(1);
  }

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--url' && args[i + 1]) { config.baseUrl = args[i + 1]; i++; }
    else if (a === '--out' && args[i + 1]) { config.artifactsDir = args[i + 1]; i++; }
    else if (a === '--artifacts' && args[i + 1]) { config.artifactsDir = args[i + 1]; i++; }
    else if (a === '--interval' && args[i + 1]) { config.intervalMinutes = parseFloat(args[i + 1]); i++; }
    else if (a === '--cooldown' && args[i + 1]) { config.cooldownMinutes = parseFloat(args[i + 1]); i++; }
    else if (a === '--timeout' && args[i + 1]) { config.timeout = parseInt(args[i + 1], 10); i++; }
    else if (a === '--preset' && args[i + 1]) { config.preset = args[i + 1]; config.presetProvided = true; i++; }
    else if (a === '--headful') { config.headless = false; }
    else if (a === '--help' || a === '-h') { printHelpLive(); process.exit(0); }
  }

  if (!config.baseUrl) {
    console.error('Error: --url is required');
    console.error('Usage: guardian live --url <url> [--interval <minutes>] [--out dir]');
    process.exit(2);
  }

  return config;
}

// Scheduler start args
function parseLiveStartArgs(args) {
  const config = {
    baseUrl: undefined,
    preset: 'saas',
    intervalMinutes: undefined,
  };

  // First arg is URL if present
  if (args.length > 0 && !String(args[0]).startsWith('--')) {
    config.baseUrl = args[0];
    args = args.slice(1);
  }

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--url' && args[i + 1]) { config.baseUrl = args[i + 1]; i++; }
    else if (a === '--preset' && args[i + 1]) { config.preset = args[i + 1]; i++; }
    else if (a === '--interval' && args[i + 1]) { config.intervalMinutes = parseFloat(args[i + 1]); i++; }
    else if (a === '--help' || a === '-h') {
      console.log('\nUsage: guardian live start --url <url> --interval <minutes> [--preset saas|shop|landing]');
      process.exit(0);
    }
  }

  if (!config.baseUrl || !config.intervalMinutes || config.intervalMinutes <= 0) {
    console.error('Error: --url and --interval <minutes> are required');
    process.exit(2);
  }
  return config;
}

// Scheduler stop args
function parseLiveStopArgs(args) {
  const config = { id: undefined };
  if (args.length > 0) {
    config.id = args[0];
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === '--id' || a === '-i') && args[i + 1]) { config.id = args[i + 1]; i++; }
  }
  if (!config.id) {
    console.error('Error: schedule id is required');
    console.error('Usage: guardian live stop <id>');
    process.exit(2);
  }
  return config;
}

// Phase 6: Scan command (one-command value)
function parseScanArgs(args) {
  const os = require('os');
  const path = require('path');
  const config = {
    // core
    baseUrl: undefined,
    artifactsDir: path.join(os.tmpdir(), 'odavl-guardian'),
    // enable full pipeline
    enableCrawl: true,
    enableDiscovery: true,
    enableAutoAttempts: true,
    enableFlows: true,
    // attempts & flows (will be overridden by presets)
    attempts: getDefaultAttemptIds(),
    flows: undefined,
    // policy (optional)
    policy: null,
    // UX
    headful: false,
    enableTrace: true,
    enableScreenshots: true,
    // preset
    preset: 'landing',
    watch: false,
    // Phase 7.1: Performance modes
    timeoutProfile: 'default',
    failFast: false,
    fast: false,
    attemptsFilter: null,
    // Phase 7.2: Parallel execution
    parallel: 1
  };

  // First arg is URL if it doesn't start with --
  if (args.length > 0 && !args[0].startsWith('--')) {
    config.baseUrl = args[0];
    args = args.slice(1);
  }

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--url' && args[i + 1]) { config.baseUrl = args[i + 1]; i++; }
    else if (a.startsWith('--preset=')) { config.preset = a.split('=')[1]; }
    else if (a === '--preset' && args[i + 1]) { config.preset = args[i + 1]; i++; }
    else if (a === '--artifacts' && args[i + 1]) { config.artifactsDir = args[i + 1]; i++; }
    else if (a === '--policy' && args[i + 1]) { config.policy = args[i + 1]; i++; }
    else if (a === '--headful') { config.headful = true; }
    else if (a === '--no-trace') { config.enableTrace = false; }
    else if (a === '--no-screenshots') { config.enableScreenshots = false; }
    else if (a === '--watch' || a === '-w') { config.watch = true; }
    // Phase 7.1: Performance flags
    else if (a === '--fast') { config.fast = true; config.timeoutProfile = 'fast'; config.enableScreenshots = false; }
    else if (a === '--fail-fast') { config.failFast = true; }
    else if (a === '--timeout-profile' && args[i + 1]) { config.timeoutProfile = args[i + 1]; i++; }
    else if (a === '--attempts' && args[i + 1]) { config.attemptsFilter = args[i + 1]; i++; }
    // Phase 7.2: Parallel execution
    else if (a === '--parallel' && args[i + 1]) { config.parallel = args[i + 1]; i++; }
    else if (a === '--help' || a === '-h') { printHelpScan(); process.exit(0); }
  }

  if (!config.baseUrl) {
    console.error('Error: --url is required');
    console.error('Usage: guardian scan --url <url> [--preset <landing|landing-demo|saas|shop>]');
    process.exit(2);
  }

  return applyPresetConfig(config);
}

function parseListArgs(args) {
  const os = require('os');
  const path = require('path');
  const config = {
    artifactsDir: path.join(os.tmpdir(), 'odavl-guardian'),
    filters: {}
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--artifacts' && args[i + 1]) {
      config.artifactsDir = args[i + 1];
      i++;
    }
    if (args[i] === '--failed') {
      config.filters.failed = true;
    }
    if (args[i] === '--site' && args[i + 1]) {
      config.filters.site = args[i + 1];
      i++;
    }
    if (args[i] === '--limit' && args[i + 1]) {
      config.filters.limit = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === '--help' || args[i] === '-h') {
      printHelpList();
      process.exit(0);
    }
  }

  return config;
}

function parseCleanupArgs(args) {
  const config = {
    artifactsDir: './artifacts',
    olderThan: null,
    keepLatest: null,
    failedOnly: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--artifacts' && args[i + 1]) {
      config.artifactsDir = args[i + 1];
      i++;
    }
    if (args[i] === '--older-than' && args[i + 1]) {
      config.olderThan = args[i + 1];
      i++;
    }
    if (args[i] === '--keep-latest' && args[i + 1]) {
      config.keepLatest = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === '--failed-only') {
      config.failedOnly = true;
    }
    if (args[i] === '--help' || args[i] === '-h') {
      printHelpCleanup();
      process.exit(0);
    }
  }

  return config;
}

function parseRealityArgs(args) {
  const config = {
    artifactsDir: undefined,
    attempts: getDefaultAttemptIds(),
    disabledAttempts: [],
    headful: false,
    enableTrace: true,
    enableScreenshots: true,
    enableDiscovery: false,
    includeUniversal: false,
    preset: 'landing',
    policy: null,
    webhook: null,
    watch: false,
    // Phase 7.1: Performance modes

    timeoutProfile: 'default',
    failFast: false,
    fast: false,
    attemptsFilter: null,
    // Phase 7.2: Parallel execution
    parallel: 1,
    _cliSource: {}
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      config.baseUrl = args[i + 1];
      i++;
    }
    if (args[i] === '--attempts' && args[i + 1]) {
      // This becomes attemptsFilter for Phase 7.1
      config.attemptsFilter = args[i + 1];
      i++;
    }
    if (args[i] === '--artifacts' && args[i + 1]) {
      config.artifactsDir = args[i + 1];
      config._cliSource.artifactsDir = true;
      i++;
    }
    if (args[i] === '--max-pages' && args[i + 1]) {
      config.maxPages = parseInt(args[i + 1], 10);
      config._cliSource.maxPages = true;
      i++;
    }
    if (args[i] === '--max-depth' && args[i + 1]) {
      config.maxDepth = parseInt(args[i + 1], 10);
      config._cliSource.maxDepth = true;
      i++;
    }
    if (args[i] === '--timeout' && args[i + 1]) {
      config.timeout = parseInt(args[i + 1], 10);
      config._cliSource.timeout = true;
      i++;
    }
    if (args[i] === '--preset' && args[i + 1]) {
      config.preset = args[i + 1];
      i++;
    }
    if (args[i] === '--policy' && args[i + 1]) {
      config.policy = args[i + 1];
      i++;
    }
    if (args[i] === '--discover') {
      config.enableDiscovery = true;
    }
    if (args[i] === '--universal') {
      config.includeUniversal = true;
    }
    if (args[i] === '--webhook' && args[i + 1]) {
      config.webhook = args[i + 1];
      i++;
    }
    if (args[i] === '--headful') {
      config.headful = true;
    }
    if (args[i] === '--watch' || args[i] === '-w') {
      config.watch = true;
    }
    if (args[i] === '--no-trace') {
      config.enableTrace = false;
    }
    if (args[i] === '--no-screenshots') {
      config.enableScreenshots = false;
    }
    // Phase 7.1: Performance flags
    if (args[i] === '--fast') {
      config.fast = true;
      config.timeoutProfile = 'fast';
      config.enableScreenshots = false;
    }
    if (args[i] === '--fail-fast') {
      config.failFast = true;
    }
    if (args[i] === '--timeout-profile' && args[i + 1]) {
      config.timeoutProfile = args[i + 1];
      i++;
    }
    // Phase 7.2: Parallel execution
    if (args[i] === '--parallel' && args[i + 1]) {
      config.parallel = args[i + 1];
      i++;
    }
    if (args[i] === '--help' || args[i] === '-h') {
      printHelpReality();
      process.exit(0);
    }
  }

  if (!config.baseUrl) {
    console.error('Error: --url is required');
    console.error('Usage: guardian reality --url <baseUrl> [options]');
    process.exit(2);
  }

  return applyPresetConfig(config);
}

function parseSmokeArgs(args) {
  const config = {
    baseUrl: undefined,
    headful: false,
    timeBudgetMs: null
  };

  // First arg may be URL
  if (args.length > 0 && !args[0].startsWith('--')) {
    config.baseUrl = args[0];
    args = args.slice(1);
  }

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--url' && args[i + 1]) { config.baseUrl = args[i + 1]; i++; }
    else if (a === '--headful') { config.headful = true; }
    else if (a === '--budget-ms' && args[i + 1]) { config.timeBudgetMs = parseInt(args[i + 1], 10); i++; }
    else if (a === '--help' || a === '-h') { printHelpSmoke(); process.exit(0); }
  }

  if (!config.baseUrl) {
    console.error('Error: --url is required');
    console.error('Usage: guardian smoke --url <url>');
    process.exit(2);
  }

  return config;
}

function parseInitArgs(args) {
  const config = {
    preset: 'startup'
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--preset' && args[i + 1]) {
      config.preset = args[i + 1];
      i++;
    }
    if (args[i] === '--help' || args[i] === '-h') {
      printHelpInit();
      process.exit(0);
    }
  }

  return config;
}

function parseTemplateArgs(args) {
  const config = {
    template: args[0] || null,
    output: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      config.output = args[i + 1];
      i++;
    }
    if (args[i] === '--help' || args[i] === '-h') {
      printHelpTemplate();
      process.exit(0);
    }
  }

  return config;
}

// Phase 11: Enterprise command parsers
function parseSitesArgs(args) {
  const config = {
    action: args[0] || 'list',
    name: null,
    url: null,
    project: 'default'
  };

  if (config.action === 'add') {
    config.name = args[1];
    config.url = args[2];
    for (let i = 3; i < args.length; i++) {
      if (args[i] === '--project' && args[i + 1]) {
        config.project = args[i + 1];
        i++;
      }
    }
  } else if (config.action === 'remove') {
    config.name = args[1];
  }

  return config;
}

function parseUsersArgs(args) {
  const config = {
    action: args[0] || 'list',
    username: args[1] || null,
    role: args[2] || 'VIEWER'
  };

  return config;
}

function parseAuditArgs(args) {
  const config = {
    action: args[0] || 'list',
    limit: 100,
    actionFilter: null,
    user: null
  };

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      config.limit = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === '--action' && args[i + 1]) {
      config.actionFilter = args[i + 1];
      i++;
    }
    if (args[i] === '--user' && args[i + 1]) {
      config.user = args[i + 1];
      i++;
    }
  }

  return config;
}

function parseExportArgs(args) {
  const config = {
    reportId: args[0] || null,
    format: 'pdf',
    output: null
  };

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
      config.format = args[i + 1];
      i++;
    }
    if (args[i] === '--output' && args[i + 1]) {
      config.output = args[i + 1];
      i++;
    }
  }

  return config;
}

// Phase 12.1: Recipe parser
function parseRecipeArgs(args) {
  const config = {
    action: args[0] || 'list',
    id: args[1] || null,
    url: null,
    file: null,
    out: null,
    force: false,
  };

  // Positional file support for import
  if (config.action === 'import' && config.id && !config.id.startsWith('--')) {
    config.file = config.id;
    config.id = null;
  }

  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      config.url = args[i + 1];
      i++;
    }
    if (args[i] === '--file' && args[i + 1]) {
      config.file = args[i + 1];
      i++;
    }
    if (args[i] === '--out' && args[i + 1]) {
      config.out = args[i + 1];
      i++;
    }
    if (args[i] === '--force') {
      config.force = true;
    }
  }

  return config;
}

function parseProtectArgs(args) {
  const config = {
    artifactsDir: './artifacts',
    attempts: getDefaultAttemptIds(),
    disabledAttempts: [],
    headful: false,
    enableTrace: true,
    enableScreenshots: true,
    policy: null,
    preset: 'startup',
    webhook: null,
    watch: false,
    // Phase 7.1: Performance modes
    timeoutProfile: 'default',
    failFast: false,
    fast: false,
    attemptsFilter: null,
    // Phase 7.2: Parallel execution
    parallel: 1
  };

  // First arg is URL if it doesn't start with --
  if (args.length > 0 && !args[0].startsWith('--')) {
    config.baseUrl = args[0];
    args = args.slice(1);
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      config.baseUrl = args[i + 1];
      i++;
    }
    if (args[i] === '--preset' && args[i + 1]) {
      config.preset = args[i + 1];
      i++;
    }
    if (args[i] === '--policy' && args[i + 1]) {
      config.policy = args[i + 1];
      i++;
    }
    if (args[i] === '--webhook' && args[i + 1]) {
      config.webhook = args[i + 1];
      i++;
    }
    if (args[i] === '--watch' || args[i] === '-w') {
      config.watch = true;
    }
    // Phase 7.1: Performance flags
    if (args[i] === '--fast') {
      config.fast = true;
      config.timeoutProfile = 'fast';
      config.enableScreenshots = false;
    }
    if (args[i] === '--fail-fast') {
      config.failFast = true;
    }
    if (args[i] === '--timeout-profile' && args[i + 1]) {
      config.timeoutProfile = args[i + 1];
      i++;
    }
    if (args[i] === '--attempts' && args[i + 1]) {
      config.attemptsFilter = args[i + 1];
      i++;
    }
    // Phase 7.2: Parallel execution
    if (args[i] === '--parallel' && args[i + 1]) {
      config.parallel = args[i + 1];
      i++;
    }
    if (args[i] === '--help' || args[i] === '-h') {
      printHelpProtect();
      process.exit(0);
    }
  }

  if (!config.baseUrl) {
    console.error('Error: --url is required');
    console.error('Usage: guardian protect --url <url> [options]');
    process.exit(2);
  }

  return applyPresetConfig(config);
}

function parseAttemptArgs(args) {
  const config = {
    attemptId: 'contact_form',
    artifactsDir: './artifacts',
    enableTrace: true,
    enableScreenshots: true,
    headful: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      config.baseUrl = args[i + 1];
      i++;
    }
    if (args[i] === '--attempt' && args[i + 1]) {
      config.attemptId = args[i + 1];
      i++;
    }
    if (args[i] === '--artifacts' && args[i + 1]) {
      config.artifactsDir = args[i + 1];
      i++;
    }
    if (args[i] === '--headful') {
      config.headful = true;
    }
    if (args[i] === '--no-trace') {
      config.enableTrace = false;
    }
    if (args[i] === '--no-screenshots') {
      config.enableScreenshots = false;
    }
    if (args[i] === '--help' || args[i] === '-h') {
      printHelpAttempt();
      process.exit(0);
    }
  }

  if (!config.baseUrl) {
    console.error('Error: --url is required');
    console.error('Usage: guardian attempt --url <baseUrl> --attempt <id> [options]');
    process.exit(2);
  }

  return config;
}

function parseBaselineSaveArgs(args) {
  const config = {
    artifactsDir: './artifacts',
    attempts: getDefaultAttemptIds(),
    headful: false,
    enableTrace: true,
    enableScreenshots: true,
    name: 'baseline',
    baselineDir: undefined
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) { config.baseUrl = args[i + 1]; i++; }
    else if (args[i] === '--attempts' && args[i + 1]) { config.attempts = args[i + 1].split(',').map(s=>s.trim()).filter(Boolean); i++; }
    else if (args[i] === '--name' && args[i + 1]) { config.name = args[i + 1]; i++; }
    else if (args[i] === '--artifacts' && args[i + 1]) { config.artifactsDir = args[i + 1]; i++; }
    else if (args[i] === '--headful') { config.headful = true; }
    else if (args[i] === '--no-trace') { config.enableTrace = false; }
    else if (args[i] === '--no-screenshots') { config.enableScreenshots = false; }
    else if (args[i] === '--baseline-dir' && args[i + 1]) { config.baselineDir = args[i + 1]; i++; }
    else if (args[i] === '--help' || args[i] === '-h') { printHelpBaselineSave(); process.exit(0); }
  }

  if (!config.baseUrl) {
    console.error('Error: --url is required');
    console.error('Usage: guardian baseline save --url <baseUrl> [options]');
    process.exit(2);
  }
  return config;
}

function parseBaselineCheckArgs(args) {
  const config = {
    artifactsDir: './artifacts',
    attempts: getDefaultAttemptIds(),
    headful: false,
    enableTrace: true,
    enableScreenshots: true,
    baselineDir: undefined,
    junit: undefined
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) { config.baseUrl = args[i + 1]; i++; }
    else if (args[i] === '--name' && args[i + 1]) { config.name = args[i + 1]; i++; }
    else if (args[i] === '--attempts' && args[i + 1]) { config.attempts = args[i + 1].split(',').map(s=>s.trim()).filter(Boolean); i++; }
    else if (args[i] === '--artifacts' && args[i + 1]) { config.artifactsDir = args[i + 1]; i++; }
    else if (args[i] === '--headful') { config.headful = true; }
    else if (args[i] === '--no-trace') { config.enableTrace = false; }
    else if (args[i] === '--no-screenshots') { config.enableScreenshots = false; }
    else if (args[i] === '--baseline-dir' && args[i + 1]) { config.baselineDir = args[i + 1]; i++; }
    else if (args[i] === '--junit' && args[i + 1]) { config.junit = args[i + 1]; i++; }
    else if (args[i] === '--help' || args[i] === '-h') { printHelpBaselineCheck(); process.exit(0); }
  }

  if (!config.baseUrl || !config.name) {
    console.error('Error: --url and --name are required');
    console.error('Usage: guardian baseline check --url <baseUrl> --name <baselineName> [options]');
    process.exit(2);
  }
  return config;
}

function printHelpReality() {
  console.log(`
Usage: guardian reality --url <baseUrl> [options]

WHAT IT DOES:
  Executes a Market Reality Snapshot v1:
  1. Crawls your site to discover URLs
  2. Runs curated user attempts (e.g., contact form, language toggle)
  3. Auto-creates baseline on first run (no manual 'baseline save' needed)
  4. Compares subsequent runs against baseline for regressions
  5. Produces snapshot.json with evidence (screenshots, traces, reports)

OPTIONS:
  --url <url>              Target URL (required)
  --artifacts <dir>        Artifacts directory (default: ./artifacts)
  --discover               Run deterministic CLI discovery and include in snapshot
  --universal              Include Universal Reality Pack attempt
  --policy <path|preset>   Policy file path or preset:name (e.g., preset:startup)
  --webhook <url>          Webhook URL for notifications
  --headful                Run headed browser (default: headless)
  --no-trace               Disable trace recording
  --no-screenshots         Disable screenshots

PERFORMANCE (Phase 7.1):
  --fast                   Fast mode (timeout-profile=fast + no screenshots)
  --fail-fast              Stop on FAILURE (not FRICTION)
  --timeout-profile <name> fast | default | slow
  --attempts <id1,id2>     Comma-separated attempt IDs (default: contact_form, language_switch, newsletter_signup)

  --help                   Show this help message

EXIT CODES:
  0                        READY
  1                        FRICTION
  2                        DO_NOT_LAUNCH

EXAMPLES:
  First run (baseline auto-created):
    guardian reality --url https://example.com
  
  With policy preset:
    guardian reality --url https://example.com --policy preset:saas
  
  Fast mode (performance):
    guardian reality --url https://example.com --fast --fail-fast
`);
}

function printHelpInit() {
  console.log(`
Usage: guardian init [options]

WHAT IT DOES:
  Initialize Guardian in the current directory:
  - Creates config/guardian.policy.json (default: startup preset)
  - Updates .gitignore to exclude Guardian artifacts
  - Prints next steps

OPTIONS:
  --preset <name>          Policy preset to use (startup, saas, enterprise)
                           Default: startup
  --help                   Show this help message

EXAMPLE:
  guardian init
  guardian init --preset saas
`);
}

function printHelpTemplate() {
  console.log(`
Usage: guardian template [template] [options]

WHAT IT DOES:
  Generate a minimal config template for common site types.
  Templates include sample journeys and policy settings.

AVAILABLE TEMPLATES:
  saas                     SaaS startup flow (signup, login, dashboard)
  shop                     E-commerce shop flow (browse, cart, checkout)
  landing                  Landing page flow (load, CTA validation)

OPTIONS:
  --output <file>          Output file name (default: guardian-<template>.json)
  --help                   Show this help message

EXAMPLES:
  guardian template saas
  guardian template shop --output my-config.json
  guardian template landing
`);
}

function printHelpList() {
  console.log(`
Usage: guardian list [options]

WHAT IT DOES:
  List all completed Guardian runs with metadata.
  Scans the artifacts directory for runs with META.json files and displays
  them in a table sorted by most recent first.

OPTIONS:
  --artifacts <dir>        Path to artifacts directory
                           Default: ./.odavlguardian
  --help                   Show this help message

OUTPUT COLUMNS:
  Time                     Run execution timestamp (YYYY-MM-DD HH:MM:SS)
  Site                     Target site slug (extracted from URL)
  Policy                   Policy/profile used for the run
  Result                   Run result: PASSED, FAILED, or WARN
  Duration                 Wall-clock execution time
  Path                     Run directory name

EXAMPLE:
  guardian list
  guardian list --artifacts ./.odavlguardian
  guardian list --failed
  guardian list --site github-com --limit 5
`);
}

function printHelpCleanup() {
  console.log(`
Usage: guardian cleanup [options]

WHAT IT DOES:
  Manage and delete old or failed Guardian runs.
  Safely removes run directories while optionally preserving recent runs.

OPTIONS:
  --artifacts <dir>        Path to artifacts directory
                           Default: ./.odavlguardian
  --older-than <duration>  Delete runs older than duration
                           Format: <num>[d|h|m] (e.g., 7d, 24h, 30m)
  --keep-latest <num>      Keep the N most recent runs per site
                           Applied per site, deletes older runs
  --failed-only            Only delete failed runs (result === FAILED)
  --help                   Show this help message

BEHAVIOR:
  - Filters are applied independently and compose
  - --failed-only filters to only FAILED status before other filters
  - --keep-latest keeps N newest per site, regardless of status
  - Combine flags: guardian cleanup --older-than 7d --failed-only
  - Deletes using real fs.rmSync() with recursive flag

EXAMPLE:
  guardian cleanup --older-than 7d
  guardian cleanup --keep-latest 3
  guardian cleanup --older-than 30d --failed-only
  guardian cleanup --artifacts ./.odavlguardian --keep-latest 5
`);
}

function printHelpProtect() {
  console.log(`
Usage: guardian protect <url> [options]

WHAT IT DOES:
  Full market reality test with startup policy.
  Deeper than smoke; runs full discovery, attempts, and baseline comparison.

OPTIONS:
  <url>                    Target URL (required)
  --policy <path|preset>   Override policy (default: preset:startup)
  --webhook <url>          Webhook URL for notifications

PERFORMANCE (Phase 7.1):
  --fast                   Fast mode (timeout-profile=fast + no screenshots)
  --fail-fast              Stop on FAILURE (not FRICTION)
  --timeout-profile <name> fast | default | slow
  --attempts <id1,id2>     Comma-separated attempt IDs (filter)

  --help                   Show this help message

EXAMPLES:
  guardian protect https://example.com
  guardian protect https://example.com --policy preset:enterprise
  guardian protect https://example.com --fast --fail-fast
`);
}

function printHelpSmoke() {
  console.log(`
Usage: guardian smoke <url>

WHAT IT DOES:
  Fast market sanity check (<30s).
  Runs only critical paths: homepage reachability, navigation probe,
  auth (login or signup), and contact/support if present.

FORCED SETTINGS:
  timeout-profile=fast, fail-fast=on, parallel=2, browser reuse on,
  retries=minimal, no baseline compare.

EXIT CODES:
  0  Smoke PASS
  1  Smoke FRICTION
  2  Smoke FAIL (including time budget exceeded)

Options:
  <url>             Target URL (required)
  --headful         Run headed browser (default: headless)
  --budget-ms <n>   Override time budget in ms (primarily for CI/tests)
  --help, -h        Show this help message
`);
}

function printHelpCrawl() {
  console.log(`
Usage: guardian --url <baseUrl> [options]

Options:
  --url <url>              Target URL (required)
  --max-pages <n>          Maximum pages to visit (default: 25)
  --max-depth <n>          Maximum crawl depth (default: 3)
  --timeout <ms>           Navigation timeout in ms (default: 20000)
  --artifacts <dir>        Artifacts directory (default: ./artifacts)
  --help                   Show this help message
`);
}

function printHelpAttempt() {
  console.log(`
Usage: guardian attempt --url <baseUrl> --attempt <id> [options]

Options:
  --url <url>              Target URL (required)
  --attempt <id>           Attempt ID (default: contact_form)
  --artifacts <dir>        Artifacts directory (default: ./.odavlguardian)
  --headful                Run with visible browser (default: headless)
  --no-trace               Disable trace recording
  --no-screenshots         Disable screenshot capture
  --help                   Show this help message

Exit Codes:
  0                        Attempt succeeded
  1                        Attempt failed
  2                        Attempt succeeded with friction
`);
}

function printHelpJourneyScan() {
  console.log(`
Usage: guardian journey-scan <url> [options]

WHAT IT DOES:
  Human journey scan — Tests a single critical user flow end-to-end.
  Opens a real browser, follows a predetermined journey, captures evidence,
  and outputs a human-readable report with a single decision:
  
  ✅ SAFE (all steps succeeded)
  ⚠️  RISK (partial success with failures)
  🚫 DO_NOT_LAUNCH (complete failure)

OPTIONS:
  <url>                    Target URL (required)
  --preset <name>          saas | shop | landing (default: saas)
  --out <dir>              Output directory (default: ./.odavlguardian)
  --timeout <ms>           Step timeout in milliseconds (default: 20000)
  --headful                Run headed browser (show UI)
  --help                   Show help

EXAMPLES:
  guardian journey-scan https://example.com
  guardian journey-scan https://example.com --preset shop --out ./results
  guardian journey-scan https://example.com --preset landing --headful

OUTPUT:
  SUMMARY.txt              Human-readable summary
  summary.md               Markdown summary  
  report.json              Full journey results
  screenshots/             Evidence screenshots per step
  metadata.json            Scan metadata

EXIT CODES:
  0                        READY (all steps succeeded)
  1                        FRICTION (partial failures)
  2                        DO_NOT_LAUNCH (complete failure)
`);
}

function printHelpLive() {
  console.log('Usage: guardian live <url> [options]');
  console.log('Options:');
  console.log('  --interval <minutes>   Run periodically; omit to run once');
  console.log('  --out <dir>            Output directory');
  console.log('  --preset <name>        Override journey preset');
  console.log('  --headful              Run with visible browser');
  console.log('  --timeout <ms>         Step timeout');
}

function printHelpScan() {
  console.log(`
Usage: guardian scan <url> [options]

WHAT IT DOES:
  One-command product scan. Runs:
  1) Discovery (light crawl)
  2) Auto-attempts (from discoveries)
  3) Intent flows (curated)
  4) Baseline compare (auto on first run)
  5) Intelligence + visual checks + report

OPTIONS:
  <url>                    Target URL (required)
  --preset <name>          landing | landing-demo | saas | shop (opinionated defaults)
  --policy <path|preset>   Override policy file or preset:name
  --artifacts <dir>        Artifacts directory (default: ./artifacts)
  --headful                Run headed browser
  --no-trace               Disable trace
  --no-screenshots         Disable screenshots

PERFORMANCE (Phase 7.1):
  --fast                   Fast mode (timeout-profile=fast + no screenshots)
  --fail-fast              Stop on FAILURE (not FRICTION)
  --timeout-profile <name> fast | default | slow
  --attempts <list>        Comma-separated attempt IDs (filter)

  --help                   Show help

EXAMPLES:
  guardian scan https://example.com --preset landing
  guardian scan https://example.com --preset landing-demo
  guardian scan https://example.com --preset saas
  guardian scan https://example.com --fast --fail-fast
`);
}

function printHelpBaseline() {
  console.log(`
Usage: guardian baseline <save|check> [options]

Subcommands:
  baseline save   Capture a baseline snapshot from a reality run
  baseline check  Compare current reality run against a saved baseline

Run 'guardian baseline <sub> --help' for details.
`);
}

function printHelpBaselineSave() {
  console.log(`
Usage: guardian baseline save --url <baseUrl> [options]

Options:
  --url <url>              Target URL (required)
  --attempts <id1,id2>     Comma-separated attempt IDs (default: curated 3)
  --name <baselineName>    Baseline name (default: baseline)
  --artifacts <dir>        Artifacts directory (default: ./.odavlguardian)
  --headful                Run headed browser (default: headless)
  --no-trace               Disable trace recording
  --no-screenshots         Disable screenshots
  --baseline-dir <path>    Directory to store baseline JSON (default: artifacts/baselines)

Exit Codes:
  0                        Baseline saved successfully
`);
}

function printHelpBaselineCheck() {
  console.log(`
Usage: guardian baseline check --url <baseUrl> --name <baselineName> [options]

Options:
  --url <url>              Target URL (required)
  --name <baselineName>    Baseline name to compare against (required)
  --attempts <id1,id2>     Comma-separated attempt IDs (default: curated 3)
  --artifacts <dir>        Artifacts directory (default: ./.odavlguardian)
  --headful                Run headed browser (default: headless)
  --no-trace               Disable trace recording
  --no-screenshots         Disable screenshots
  --baseline-dir <path>    Directory to load baseline JSON from (default: artifacts/baselines)
  --junit <path>           Write JUnit XML summary to the given path

Exit Codes:
  0                        No regression
  3                        Regression in friction metrics
  4                        Regression failure
  1                        Internal error (baseline missing, parse error)
`);
}

async function main() {
  const args = process.argv.slice(2);

  // PHASE 4: Validate guardian.config.json early (fail fast if invalid)
  const cwd = process.cwd();
  const configValidation = loadAndValidateConfig(cwd);
  if (!configValidation.valid) {
    reportConfigIssues(configValidation);
    process.exit(2);
  }

  // Phase 8: Helper to check plan before scan
  function checkPlanBeforeScan(config, options = {}) {
    const { recordUsage = true } = options;
    try {
      const url = config.url || config.baseUrl || '';
      if (!url) return; // No URL to check
      
      // Phase 10: Register user on first scan
      registerUser();
      
      const check = checkCanScan(url);
      if (!check.allowed) {
        // LEVEL 1 TRANSPARENT GATING: emit clear message + artifacts
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const artifactsDir = config.artifactsDir || path.join(os.tmpdir(), 'odavl-guardian');
        try { if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true }); } catch (_) {}

        const now = new Date().toISOString().replace(/[:\-]/g, '').substring(0, 15).replace('T', '-');
        const runId = `gated-${now}`;
        const runDir = path.join(artifactsDir, runId);
        try { fs.mkdirSync(runDir, { recursive: true }); } catch (_) {}

        const upgradeMsg = getUpgradeMessage();

        // Write decision.json with canonical verdict and next steps
        const decision = {
          runId,
          url,
          timestamp: new Date().toISOString(),
          preset: config.preset || 'default',
          policyName: 'Plan Gate',
          finalVerdict: 'FRICTION',
          exitCode: 1,
          reasons: [
            { code: 'PLAN_GATE', message: check.message },
            { code: 'NEXT_STEPS', message: upgradeMsg }
          ],
          gating: {
            reason: check.message,
            nextSteps: upgradeMsg
          }
        };
        try { fs.writeFileSync(path.join(runDir, 'decision.json'), JSON.stringify(decision, null, 2), 'utf8'); } catch (_) {}

        // Write summary.md with friendly next steps
        const lines = [];
        lines.push('# Guardian Reality Summary');
        lines.push('');
        lines.push('## Final Verdict');
        lines.push('- Verdict: FRICTION (exit 1)');
        lines.push('- Why this verdict: Reality run was gated by plan limits.');
        lines.push('');
        lines.push('## What Happened');
        lines.push(`- ${check.message}`);
        lines.push('');
        lines.push('## What To Do Next');
        lines.push(`- ${upgradeMsg}`);
        try { fs.writeFileSync(path.join(runDir, 'summary.md'), lines.join('\n'), 'utf8'); } catch (_) {}

        // Crystal-clear CLI message
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Guardian Reality was gated by plan limits');
        console.log('');
        console.log(`Why: ${check.message}`);
        console.log(`Next steps: ${upgradeMsg}`);
        console.log('');
        console.log(`Artifacts: ${runDir}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        process.exit(1);
      }
      
      // Show usage info
      if (check.usage && check.usage.scansRemaining !== 'Unlimited') {
        console.log(`ℹ️  Scans remaining this month: ${check.usage.scansRemaining}\n`);
      }
      
      // Record the scan
      if (recordUsage) {
        performScan(url);
        
        // Phase 10: Track first scan signal
        recordFirstScan();
      }
    } catch (error) {
      console.error(`\n❌ ${error.message}`);
      console.log(getUpgradeMessage());
      process.exit(1);
    }
  }

  // Minimal release flag: print version and exit
  // PHASE 6: First-run welcome (only once)
  if (args.length > 0 && !['--help', '-h', 'init', 'presets', 'template'].includes(args[0])) {
    if (isFirstRun('.odavl-guardian')) {
      printWelcome('ODAVL Guardian');
      printFirstRunHint();
      markAsRun('.odavl-guardian');
    }
  }

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
🛡️  ODAVL Guardian — Market Reality Testing Engine

Usage: guardian <subcommand> [options]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEVEL 1 — GOLDEN PATH (Reality Only)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  reality --url <URL>      Full Market Reality Check
                           → Canonical Verdicts: READY / FRICTION / DO_NOT_LAUNCH
                           → Outputs: summary.md, decision.json, market-report.html
                           → Artifacts: ./.odavlguardian/

  --url <URL>              Alias for: guardian reality --url <URL>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUICK START
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  # Run Reality Check (Level 1 Golden Path)
  guardian reality --url https://example.com

  # Same, using alias
  guardian --url https://example.com

  # List completed runs
  guardian list

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADVANCED COMMANDS (Level 2+)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  scan <url>               One-command product scan
  journey-scan <url>       Human journey scan
  attempt                  Execute a single user attempt
  smoke <url>              Fast market sanity check (<30s)
  baseline save/check      Baseline management
  list                     List completed runs
  cleanup                  Manage and delete old runs
  init                     Initialize Guardian
  template <type>          Generate config template
  plan / upgrade           Show plan or upgrade
  sites / users / audit    Enterprise management
  export                   Export reports (PDF)
  presets                  List available policy presets

Run 'guardian <subcommand> --help' for detailed command help.
`);
    process.exit(0);
  }

  // Parse arguments (which handles subcommand routing)
  const parsed = parseArgs(process.argv);
  const config = parsed.config;

  // Determine which mode to run
  if (parsed.subcommand === 'init') {
    initGuardian(config);
    process.exit(0);
  } else if (parsed.subcommand === 'presets') {
    printPresets();
    process.exit(0);
  } else if (parsed.subcommand === 'template') {
    const template = config.template;
    if (!template) {
      console.log('\n📋 Guardian Templates\n');
      const templates = listTemplates();
      templates.forEach(t => {
        console.log(`  ${t.name}: ${t.description} (${t.journeys} journeys)`);
      });
      console.log('\nUsage: guardian template <saas|shop|landing> [--output file.json]\n');
      process.exit(0);
    }
    try {
      const result = generateTemplate(template, { output: config.output });
      console.log(`\n✅ ${result.message}`);
      console.log(`   Generated config ready to use with: guardian reality --config ${result.outputPath}\n`);
      process.exit(0);
    } catch (err) {
      console.error(`\n❌ ${err.message}\n`);
      process.exit(1);
    }
  } else if (parsed.subcommand === 'plan') {
    // Phase 8: Show current plan and usage
    const summary = getPlanSummary();
    console.log(`\n🛡️  ODAVL Guardian Plan\n`);
    
    // Phase 10: Show founder status
    const founderMsg = getFounderMessage();
    if (founderMsg) {
      console.log(founderMsg);
      console.log();
    }
    
    console.log(`Current Plan: ${summary.plan.name.toUpperCase()}`);
    if (summary.plan.price > 0) {
      console.log(`Price: $${summary.plan.price}/month`);
    }
    console.log();
    console.log(`Usage This Month:`);
    console.log(`  Scans: ${summary.limits.scans.used}/${summary.limits.scans.max === -1 ? 'Unlimited' : summary.limits.scans.max} (${summary.limits.scans.remaining} remaining)`);
    console.log(`  Sites: ${summary.limits.sites.used}/${summary.limits.sites.max === -1 ? 'Unlimited' : summary.limits.sites.max}`);
    console.log();
    console.log(`Features:`);
    console.log(`  Live Guardian: ${summary.features.liveGuardian ? '✅' : '❌'}`);
    console.log(`  CI/CD Mode: ${summary.features.ciMode ? '✅' : '❌'}`);
    console.log(`  Alerts: ${summary.features.alerts ? '✅' : '❌'}`);
    console.log();
    if (summary.plan.id === 'free') {
      console.log(`Upgrade to Pro for unlimited scans and advanced features.`);
      console.log(`Run: guardian upgrade pro\n`);
    }
    process.exit(0);
  } else if (parsed.subcommand === 'upgrade') {
    // Phase 8: Upgrade to a plan
    const targetPlan = config.plan;
    if (!targetPlan || !['pro', 'business'].includes(targetPlan.toLowerCase())) {
      console.error('\n❌ Please specify a valid plan: pro or business');
      console.log('\nUsage: guardian upgrade <pro|business>\n');
      process.exit(1);
    }
    const { getCheckoutUrl } = require('../src/payments/stripe-checkout');
    const checkoutUrl = getCheckoutUrl(targetPlan);
    console.log(`\n🚀 Upgrade to ${targetPlan.toUpperCase()}\n`);
    console.log(`Open this URL to complete your upgrade:\n`);
    console.log(`  ${checkoutUrl}\n`);
    console.log(`After payment, your plan will be automatically activated.\n`);
    
    // Phase 10: Record upgrade signal
    recordFirstUpgrade(targetPlan.toLowerCase());
    
    process.exit(0);
  } else if (parsed.subcommand === 'feedback') {
    // Phase 10: Feedback session
    try {
      await runFeedbackSession();
      process.exit(0);
    } catch (err) {
      console.error(`\n❌ Feedback error: ${err.message}\n`);
      process.exit(1);
    }
  } else if (parsed.subcommand === 'sites') {
    // Phase 11: Multi-site management
    try {
      requirePermission('site:view', 'manage sites');
      
      if (config.action === 'add') {
        requirePermission('site:add', 'add sites');
        if (!config.name || !config.url) {
          console.error('Usage: guardian sites add <name> <url> [--project <name>]');
          process.exit(2);
        }
        const site = addSite(config.name, config.url, config.project);
        console.log(`✓ Site added: ${site.name} (${site.project})`);
        logAudit(AUDIT_ACTIONS.SITE_ADD, { name: site.name, url: site.url, project: site.project });
      } else if (config.action === 'remove') {
        requirePermission('site:remove', 'remove sites');
        if (!config.name) {
          console.error('Usage: guardian sites remove <name>');
          process.exit(2);
        }
        const site = removeSite(config.name);
        console.log(`✓ Site removed: ${site.name}`);
        logAudit(AUDIT_ACTIONS.SITE_REMOVE, { name: site.name });
      } else {
        // List sites
        const data = getSites();
        if (data.sites.length === 0) {
          console.log('No sites registered yet.');
        } else {
          console.log(`\nTotal sites: ${data.sites.length}\n`);
          const projects = listProjects();
          for (const proj of projects) {
            console.log(`📁 ${proj.name} (${proj.siteCount} site(s))`);
            const sites = getSitesByProject(proj.name);
            for (const site of sites) {
              console.log(`  - ${site.name}: ${site.url}`);
              if (site.lastScannedAt) {
                console.log(`    Last scan: ${site.lastScannedAt} (${site.scanCount} total)`);
              }
            }
          }
        }
      }
      process.exit(0);
    } catch (err) {
      console.error(`\n❌ Sites error: ${err.message}\n`);
      process.exit(1);
    }
  } else if (parsed.subcommand === 'users') {
    // Phase 11: User/role management
    try {
      requirePermission('user:view', 'manage users');
      
      if (config.action === 'add') {
        requirePermission('user:add', 'add users');
        if (!config.username) {
          console.error('Usage: guardian users add <username> [role]');
          process.exit(2);
        }
        const user = addUser(config.username, config.role);
        console.log(`✓ User added: ${user.username} (${user.role})`);
        logAudit(AUDIT_ACTIONS.USER_ADD, { username: user.username, role: user.role });
      } else if (config.action === 'remove') {
        requirePermission('user:remove', 'remove users');
        if (!config.username) {
          console.error('Usage: guardian users remove <username>');
          process.exit(2);
        }
        const user = removeUser(config.username);
        console.log(`✓ User removed: ${user.username}`);
        logAudit(AUDIT_ACTIONS.USER_REMOVE, { username: user.username });
      } else if (config.action === 'roles') {
        // List roles
        const roles = listRoles();
        console.log('\nAvailable roles:\n');
        for (const role of roles) {
          console.log(`${role.name}:`);
          console.log(`  Permissions: ${role.permissions.join(', ')}`);
        }
      } else {
        // List users
        const data = getUsers();
        console.log(`\nTotal users: ${data.users.length}\n`);
        for (const user of data.users) {
          const current = user.username === getCurrentUser().username ? ' (current)' : '';
          console.log(`- ${user.username}: ${user.role}${current}`);
        }
      }
      process.exit(0);
    } catch (err) {
      console.error(`\n❌ Users error: ${err.message}\n`);
      process.exit(1);
    }
  } else if (parsed.subcommand === 'audit') {
    // Phase 11: Audit log viewing
    try {
      requirePermission('audit:view', 'view audit logs');
      
      if (config.action === 'summary') {
        const summary = getAuditSummary();
        console.log('\nAudit Summary:\n');
        console.log(`Total logs: ${summary.totalLogs}`);
        console.log(`First log:  ${summary.firstLog || 'N/A'}`);
        console.log(`Last log:   ${summary.lastLog || 'N/A'}`);
        console.log('\nActions:');
        for (const [action, count] of Object.entries(summary.actionCounts)) {
          console.log(`  ${action}: ${count}`);
        }
        console.log('\nUsers:');
        for (const [user, count] of Object.entries(summary.userCounts)) {
          console.log(`  ${user}: ${count}`);
        }
      } else {
        // List logs
        const logs = readAuditLogs({
          limit: config.limit,
          action: config.actionFilter,
          user: config.user
        });
        
        if (logs.length === 0) {
          console.log('No audit logs found.');
        } else {
          console.log(`\nShowing ${logs.length} log(s):\n`);
          for (const log of logs) {
            console.log(`[${log.timestamp}] ${log.user} → ${log.action}`);
            if (Object.keys(log.details).length > 0) {
              console.log(`  Details: ${JSON.stringify(log.details)}`);
            }
          }
        }
      }
      process.exit(0);
    } catch (err) {
      console.error(`\n❌ Audit error: ${err.message}\n`);
      process.exit(1);
    }
  } else if (parsed.subcommand === 'export') {
    // Phase 11: PDF export
    try {
      requirePermission('export:pdf', 'export reports');
      
      if (!config.reportId) {
        // List available reports
        const reports = listAvailableReports();
        if (reports.length === 0) {
          console.log('No reports available for export.');
        } else {
          console.log(`\nAvailable reports:\n`);
          for (const report of reports.slice(0, 10)) {
            console.log(`- ${report.id}`);
            console.log(`  Modified: ${report.modifiedAt}`);
          }
          console.log('\nUsage: guardian export <report-id> [--output <path>]');
        }
      } else {
        const result = exportReportToPDF(config.reportId, config.output);
        console.log(`✓ Report exported to: ${result.outputPath}`);
        console.log(`  Size: ${result.size} bytes`);
        logAudit(AUDIT_ACTIONS.EXPORT_PDF, { reportId: config.reportId, output: result.outputPath });
      }
      process.exit(0);
    } catch (err) {
      console.error(`\n❌ Export error: ${err.message}\n`);
      process.exit(1);
    }
  } else if (parsed.subcommand === 'recipe') {
    // Phase 12.1: Recipes
    try {
      const action = config.action;
      // Ensure registry includes built-ins before any trust checks
      getAllRecipes();
      
      if (action === 'list') {
        const recipes = getAllRecipes();
        console.log(`\n📚 Available Recipes (${recipes.length} total)\n`);
        
        // Group by platform
        const byPlatform = {};
        for (const recipe of recipes) {
          if (!byPlatform[recipe.platform]) {
            byPlatform[recipe.platform] = [];
          }
          byPlatform[recipe.platform].push(recipe);
        }
        
        for (const platform of Object.keys(byPlatform).sort()) {
          console.log(`🏪 ${platform.toUpperCase()}`);
          for (const recipe of byPlatform[platform]) {
            const reg = getRegistryEntry(recipe.id);
            const checksum = computeRecipeChecksum(recipe);
            const mismatch = reg && reg.checksum && reg.checksum !== checksum;
            const sourceLabel = reg ? reg.source : 'unknown';
            const trustNote = mismatch ? ' [checksum mismatch]' : '';
            console.log(`   • ${recipe.id} - ${recipe.name} [${sourceLabel}]${trustNote}`);
          }
          console.log();
        }
      } else if (action === 'show') {
        if (!config.id) {
          console.error('Usage: guardian recipe show <id>');
          process.exit(2);
        }
        
        const recipe = getRecipe(config.id);
        if (!recipe) {
          console.error(`Recipe not found: ${config.id}`);
          process.exit(1);
        }
        
        console.log();
        console.log(formatRecipe(recipe));
        const reg = getRegistryEntry(recipe.id);
        const checksum = computeRecipeChecksum(recipe);
        const mismatch = reg && reg.checksum && reg.checksum !== checksum;
        if (reg) {
          console.log(`Source: ${reg.source}`);
          console.log(`Version: ${reg.version}`);
          console.log(`Checksum: ${reg.checksum}`);
          if (mismatch) {
            console.log('⚠️  Warning: checksum mismatch — recipe may have been modified');
          }
        }
      } else if (action === 'run') {
        if (!config.id || !config.url) {
          console.error('Usage: guardian recipe run <id> --url <url>');
          process.exit(2);
        }
        
        const recipe = getRecipe(config.id);
        if (!recipe) {
          console.error(`Recipe not found: ${config.id}`);
          process.exit(1);
        }
        
        // Enforce plan limits without counting recipe execution as a scan
        checkPlanBeforeScan({ url: config.url }, { recordUsage: false });
        
        // Log recipe execution
        logAudit('recipe:run', { recipeId: recipe.id, url: config.url });
        
        // Phase B: Execute recipe as enforced runtime
        (async () => {
          const { executeRecipeRuntime } = require('../src/recipes/recipe-runtime');
          const { recipeFailureToAttempt, assessRecipeImpact } = require('../src/recipes/recipe-failure-analysis');
          
          console.log(`\n▶️  Executing recipe: ${recipe.name}`);
          console.log(`   URL: ${config.url}`);
          console.log(`   Steps: ${recipe.steps.length}\n`);
          
          try {
            const result = await executeRecipeRuntime(config.id, config.url, { timeout: 20000 });
            
            if (result.success) {
              console.log(`✅ RECIPE PASSED: ${recipe.name}`);
              console.log(`   Goal reached: ${recipe.expectedGoal}`);
              console.log(`   Duration: ${result.duration}s`);
              process.exit(0);
            } else {
              console.log(`❌ RECIPE FAILED: ${recipe.name}`);
              console.log(`   Reason: ${result.failureReason}`);
              if (result.failedStep) {
                const stepNum = parseInt(result.failedStep.split('-').pop(), 10) + 1;
                console.log(`   Failed at step ${stepNum} of ${result.steps.length}`);
              }
              console.log(`   Duration: ${result.duration}s\n`);
              
              // Integrate failure into decision engine
              const attemptForm = recipeFailureToAttempt(result);
              const impact = assessRecipeImpact(result);
              
              console.log(`   Risk Assessment: ${impact.severity} (score: ${impact.riskScore}/100)`);
              console.log(`   Impact: ${impact.message}\n`);
              
              process.exit(1);
            }
          } catch (err) {
            console.error(`\n❌ Recipe execution error: ${err.message}\n`);
            process.exit(2);
          }
        })();
      } else if (action === 'export') {
        if (!config.id || !config.out) {
          console.error('Usage: guardian recipe export <id> --out <file>');
          process.exit(2);
        }
        requirePermission('recipe:manage', 'export recipes');
        const result = exportRecipeWithMetadata(config.id, config.out);
        logAudit(AUDIT_ACTIONS.RECIPE_EXPORT, { recipeId: config.id, output: config.out, checksum: result.checksum });
        console.log(`\n✓ Recipe exported`);
        console.log(`  File: ${config.out}`);
        console.log(`  Checksum: ${result.checksum}`);
      } else if (action === 'import') {
        if (!config.file) {
          console.error('Usage: guardian recipe import <file>');
          process.exit(2);
        }
        requirePermission('recipe:manage', 'import recipes');
        const result = importRecipeWithMetadata(config.file, { force: config.force });
        logAudit(AUDIT_ACTIONS.RECIPE_IMPORT, { recipeId: result.recipe.id, file: config.file, checksum: result.checksum, force: config.force });
        console.log(`\n✓ Import complete`);
        console.log(`  Recipe: ${result.recipe.id}`);
        console.log(`  Checksum: ${result.checksum}`);
      } else {
        console.error('Unknown recipe action. Use: list, show <id>, run <id> --url <url>, export <id> --out <file>, import <file> [--force]');
        process.exit(2);
      }
      
      process.exit(0);
    } catch (err) {
      console.error(`\n❌ Recipe error: ${err.message}\n`);
      process.exit(1);
    }
  } else if (parsed.subcommand === 'list') {
    const exitCode = listRuns(config.artifactsDir, config.filters);
    process.exit(exitCode);
  } else if (parsed.subcommand === 'cleanup') {
    const result = await cleanup(
      config.artifactsDir,
      {
        olderThan: config.olderThan,
        keepLatest: config.keepLatest,
        failedOnly: config.failedOnly
      }
    );
    
    console.log(`\n✓ Cleanup completed`);
    console.log(`  Deleted: ${result.deleted} run(s)`);
    console.log(`  Kept:    ${result.kept} run(s)`);
    
    if (result.errors && result.errors.length > 0) {
      console.log(`  Errors:  ${result.errors.length}`);
      result.errors.forEach(err => {
        console.log(`    - ${err}`);
      });
      process.exit(1);
    }
    process.exit(0);
  } else if (parsed.subcommand === 'protect') {
    // Phase 8: Check plan limits before scan
    checkPlanBeforeScan(config);
    await runRealityCLI(config);
  } else if (parsed.subcommand === 'smoke') {
    // Phase 8: Check plan limits before scan
    checkPlanBeforeScan(config);
    const result = await runSmokeCLI(config);
    process.exit(result.exitCode);
  } else if (parsed.subcommand === 'attempt') {
    // Phase 8: Check plan limits before scan
    checkPlanBeforeScan(config);
    const result = await runAttemptCLI(config);
    process.exit(result.exitCode);
  } else if (parsed.subcommand === 'journey-scan') {
    // Phase 8: Check plan limits before scan
    checkPlanBeforeScan(config);
    const result = await runJourneyScanCLI(config);
    process.exit(result.exitCode);
  } else if (parsed.subcommand === 'live') {
    // Phase 8: Check feature allowed for live guardian
    const liveCheck = checkFeatureAllowed('liveGuardian');
    if (!liveCheck.allowed) {
      console.error(`\n❌ ${liveCheck.message}`);
      console.log(getUpgradeMessage());
      process.exit(1);
    }
    
    // Phase 10: Track first live session
    recordFirstLive();
    
    const result = await runLiveCLI(config);
    process.exit(result.exitCode);
  } else if (parsed.subcommand === 'live-start') {
    // Feature check
    const liveCheck = checkFeatureAllowed('liveGuardian');
    if (!liveCheck.allowed) {
      console.error(`\n❌ ${liveCheck.message}`);
      console.log(getUpgradeMessage());
      process.exit(1);
    }
    // RBAC permission
    try { requirePermission('live:run', 'start live schedule'); } catch (e) { console.error(`\n❌ ${e.message}`); process.exit(1); }
    const { createSchedule, startBackgroundRunner } = require('../src/guardian/live-scheduler');
    const entry = createSchedule({ url: config.baseUrl, preset: config.preset, intervalMinutes: config.intervalMinutes });
    const runner = startBackgroundRunner();
    console.log('\n🟢 Live schedule started');
    console.log(`   id: ${entry.id}`);
    console.log(`   url: ${entry.url}`);
    console.log(`   preset: ${entry.preset}`);
    console.log(`   every: ${entry.intervalMinutes} min`);
    console.log(`   nextRunAt: ${entry.nextRunAt}`);
    console.log(`   runnerPid: ${runner.pid}`);
    process.exit(0);
  } else if (parsed.subcommand === 'live-stop') {
    // RBAC permission
    try { requirePermission('live:run', 'stop live schedule'); } catch (e) { console.error(`\n❌ ${e.message}`); process.exit(1); }
    const { stopSchedule } = require('../src/guardian/live-scheduler');
    try {
      const s = stopSchedule(config.id);
      console.log(`\n🛑 Schedule stopped: ${s.id}`);
      process.exit(0);
    } catch (err) {
      console.error(`\n❌ ${err.message}`);
      process.exit(1);
    }
  } else if (parsed.subcommand === 'live-status') {
    const { listSchedules, loadState } = require('../src/guardian/live-scheduler');
    const state = loadState();
    const schedules = listSchedules();
    console.log('\n📋 Live schedules:');
    for (const s of schedules) {
      console.log(` - ${s.id} | ${s.status} | every ${s.intervalMinutes} min`);
      console.log(`   url: ${s.url} | preset: ${s.preset}`);
      console.log(`   lastRunAt: ${s.lastRunAt || 'n/a'} | nextRunAt: ${s.nextRunAt || 'n/a'}`);
    }
    const pid = state.runner?.pid;
    console.log(`\nRunner: ${pid ? `pid ${pid}` : 'not running'}`);
    process.exit(0);
  } else if (parsed.subcommand === 'ci') {
    // Phase 8: Check feature allowed for CI mode
    const ciCheck = checkFeatureAllowed('ciMode');
    if (!ciCheck.allowed) {
      console.error(`\n❌ ${ciCheck.message}`);
      console.log(getUpgradeMessage());
      process.exit(1);
    }
    // Phase 4: CI gate mode
    const { runCIGate } = require('../src/guardian/ci-cli');
    const exitCode = await runCIGate(config);
    process.exit(exitCode);
  } else if (parsed.subcommand === 'reality') {
    // Phase 8: Check plan limits before scan
    checkPlanBeforeScan(config);
    await runRealityCLI(config);
  } else if (parsed.subcommand === 'scan') {
    // Phase 8: Check plan limits before scan
    checkPlanBeforeScan(config);
    // Phase 6: First-run concise guidance
    try {
      const { baselineExists } = require('../src/guardian/baseline-storage');
      if (!baselineExists(config.baseUrl, '.odavl-guardian')) {
        console.log('\nℹ️  First run: Guardian will discover pages, run attempts & flows,');
        console.log('    auto-create a baseline, check visuals & intelligence, and');
        console.log('    save reports under artifacts/<market-run-*>/.');
        console.log('    FAIL = policy/regression; WARN = risks without fail.\n');
      }
    } catch {}
    await runRealityCLI(config);
  } else if (parsed.subcommand === 'baseline-save') {
    try {
      const res = await saveBaseline(config);
      process.exit(res.exitCode);
    } catch (err) {
      console.error(`\n❌ Error: ${err.message}`);
      process.exit(1);
    }
  } else if (parsed.subcommand === 'baseline-check') {
    try {
      const res = await checkBaseline(config);
      process.exit(res.exitCode);
    } catch (err) {
      console.error(`\n❌ Error: ${err.message}`);
      process.exit(1);
    }
  } else {
    try {
      const result = await runGuardian(config);
      process.exit(result.exitCode);
    } catch (err) {
      console.error(`\n❌ Error: ${err.message}`);
      process.exit(2);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});