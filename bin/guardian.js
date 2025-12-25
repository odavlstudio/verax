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

// PHASE 6: Early flag validation (before heavy module loads)
const { validateFlags, reportFlagError } = require('../src/guardian/flag-validator');
const validation = validateFlags(process.argv);
if (!validation.valid) {
  reportFlagError(validation);
  process.exit(2);
}

// PHASE 6: First-run detection (lightweight)
const { isFirstRun, markAsRun, printWelcome, printFirstRunHint } = require('../src/guardian/first-run');

const { runAttemptCLI } = require('../src/guardian/attempt');
const { runRealityCLI } = require('../src/guardian/reality');
const { runSmokeCLI } = require('../src/guardian/smoke');
const { runGuardian } = require('../src/guardian');
const { saveBaseline, checkBaseline } = require('../src/guardian/baseline');
const { getDefaultAttemptIds } = require('../src/guardian/attempt-registry');
const { initGuardian } = require('../src/guardian/init-command');
const { printPresets } = require('../src/guardian/preset-loader');

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

  // Phase 6: Productized one-command scan
  if (subcommand === 'scan') {
    return { subcommand: 'scan', config: parseScanArgs(args.slice(1)) };
  }

  // Legacy default: crawl
  return { subcommand: 'crawl', config: parseCrawlArgs(args) };
}

function parseCrawlArgs(args) {
  const config = {
    maxPages: 25,
    maxDepth: 3,
    timeout: 20000,
    artifactsDir: './artifacts'
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

// Phase 6: Scan command (one-command value)
function parseScanArgs(args) {
  const config = {
    // core
    baseUrl: undefined,
    artifactsDir: './artifacts',
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
    console.error('Error: <url> is required');
    console.error('Usage: guardian scan <url> [--preset <landing|landing-demo|saas|shop>]');
    process.exit(2);
  }

  // Apply scan preset overrides
  try {
    const { resolveScanPreset } = require('../src/guardian/scan-presets');
    const presetCfg = resolveScanPreset(config.preset);
    config.attempts = presetCfg.attempts;
    config.flows = presetCfg.flows;
    if (presetCfg.policy) {
      // Allow users to override via --policy
      config.policy = config.policy || presetCfg.policy;
    }
  } catch (e) {
    // If presets not available, proceed with defaults
  }

  return config;
}

function parseRealityArgs(args) {
  const config = {
    artifactsDir: './artifacts',
    attempts: getDefaultAttemptIds(),
    headful: false,
    enableTrace: true,
    enableScreenshots: true,
    enableDiscovery: false,
    includeUniversal: false,
    policy: null,
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

  return config;
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
    console.error('Error: <url> is required');
    console.error('Usage: guardian smoke <url>');
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

function parseProtectArgs(args) {
  const config = {
    artifactsDir: './artifacts',
    attempts: getDefaultAttemptIds(),
    headful: false,
    enableTrace: true,
    enableScreenshots: true,
    policy: 'preset:startup',
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
    console.error('Error: <url> is required');
    console.error('Usage: guardian protect <url> [options]');
    process.exit(2);
  }

  return config;
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
  0                        Success (first run baseline created, or no regressions)
  1                        FAILURE (regression detected or policy failed)
  2                        FRICTION (drift without critical failure or soft policy failure)

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
  --artifacts <dir>        Artifacts directory (default: ./artifacts)
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
  --artifacts <dir>        Artifacts directory (default: ./artifacts)
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
  --artifacts <dir>        Artifacts directory (default: ./artifacts)
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

  // Minimal release flag: print version and exit
  // PHASE 6: First-run welcome (only once)
  if (args.length > 0 && !['--help', '-h', 'init', 'presets'].includes(args[0])) {
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

QUICK START:
  init                     Initialize Guardian in current directory
  protect <url>            Full market reality test (slower, deeper)
  smoke <url>              Fast market sanity check (<30s)
  check <url>              Alias: same as smoke
  reality                  Full Market Reality Snapshot

OTHER COMMANDS:
  attempt                  Execute a single user attempt
  baseline save            (Legacy) Manually save baseline
  baseline check           (Legacy) Manually check against baseline
  presets                  List available policy presets

EXAMPLES:
  # Initialize Guardian
  guardian init
  
  # Quick protect (uses startup policy)
  guardian protect https://example.com
  
  # Full reality check with policy
  guardian reality --url https://example.com --policy preset:saas

Run 'guardian <subcommand> --help' for more information.
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
  } else if (parsed.subcommand === 'protect') {
    await runRealityCLI(config);
  } else if (parsed.subcommand === 'smoke') {
    await runSmokeCLI(config);
  } else if (parsed.subcommand === 'attempt') {
    await runAttemptCLI(config);
  } else if (parsed.subcommand === 'reality') {
    await runRealityCLI(config);
  } else if (parsed.subcommand === 'scan') {
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
    runGuardian(config);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});