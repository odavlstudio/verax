#!/usr/bin/env node
/**
 * VERAX CLI Entry Point (Stage 7 Contract)
 * Commands handled here:
 * - verax run
 * - verax bundle
 * - verax readiness (pilot-only)
 * - verax capability-bundle (pilot-only)
 * - verax version (fast exit)
 * - verax help (fast exit)
 *
 * Exit codes (shared):
 * 0 SUCCESS | 20 FINDINGS | 30 INCOMPLETE | 50 INVARIANT_VIOLATION | 64 USAGE_ERROR
 *
 * Contract rules:
 * - Exactly one RESULT/REASON/ACTION block per command (unless --json streaming).
 * - No interactive prompts; no extra logs without --debug.
 * - Lazy imports for heavy modules; fast exits avoid loading Playwright.
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync as _readFileSync } from 'fs';
import { UsageError } from './util/support/errors.js';
import { EXIT_CODES, emitOutcome, outcomeFromError, buildOutcome } from './config/cli-contract.js';
import { enforceReadOnlyOperation } from '../verax/core/product-contract.js';
import { buildAuthConfig } from './util/auth/auth-config.js';
import { isFirstRun } from './util/support/first-run-detection.js';
import { runPreflight } from './util/preflight/run-preflight.js';
import { VERSION, getVersionString, getVersionInfo } from '../version.js';
import {
  PRODUCT_ONE_LINER,
  DEFAULT_SCOPE_LINE,
  POST_AUTH_DISCLAIMER_LINE,
  NOT_THIS_TOOL_LINES,
  RESULTS_INTERPRETATION,
  ARTIFACTS_LINE,
} from './config/pilot-messages.js';

const PILOT_SURFACE_VERSION = VERSION;
const PILOT_COMMAND_SPECS = [
  {
    name: 'run',
    usage: 'run --url <url> [options]',
    description: 'Run scan on a URL',
  },
  {
    name: 'bundle',
    usage: 'bundle <runDir> <bundleDir>',
    description: 'Pack run artifacts into a bundle directory',
  },
  {
    name: 'readiness',
    usage: 'readiness --url <url> [options]',
    description: 'Pilot-only: diagnostic applicability check (no scan)',
  },
  {
    name: 'capability-bundle',
    usage: 'capability-bundle --url <url> [--out <path>] [options]',
    description: 'Pilot-only: generate a diagnostic bundle (safe to share)',
  },
  {
    name: 'version',
    usage: 'version',
    description: 'Show version and compatibility info',
  },
  {
    name: 'help',
    usage: 'help',
    description: 'Show this help',
  },
];
const PILOT_SUPPORTED_COMMANDS = PILOT_COMMAND_SPECS.map((spec) => spec.name);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Lazy loaders for heavy modules (loaded only when needed)
async function loadRunCommand() {
  const mod = await import('./commands/run.js');
  return mod.runCommand;
}

async function loadBundleCommand() {
  const mod = await import('./commands/bundle.js');
  return mod.bundleCommand;
}

async function loadReadinessCommand() {
  const mod = await import('./commands/readiness.js');
  return mod.readinessCommand;
}

async function loadCapabilityBundleCommand() {
  const mod = await import('./commands/capability-bundle.js');
  return mod.capabilityBundleCommand;
}

// Read package.json for version
function getVersion() {
  return VERSION;
}

/*
Command: verax version
Purpose: Report the installed VERAX CLI version without side effects.
Required: none
Optional: --version | -v (fast exit)
Outputs: RESULT/REASON/ACTION (Reason contains version string)
Exit Codes: 0 SUCCESS | 64 USAGE_ERROR (if invoked incorrectly)
Forbidden: additional logging, interactive prompts, file writes.
*/

// Parse args synchronously at module level for fast exits
function parseArgs() {
  return process.argv.slice(2);
}

function collectNonStdHandles() {
  // eslint-disable-next-line no-underscore-dangle
  const allowed = new Set(['WriteStream', 'ReadStream', 'Socket', 'Pipe', 'TTY']);
  /**
   * PRODUCTION: Using undocumented Node.js internal API process._getActiveHandles()
   * Purpose: Detect resource leaks during CLI fast-exit paths (--help, --version) in CI
   * Risk Assessment: Low - API stable since Node 0.10, used by popular tools (tap, nyc)
   * Failure Mode: Graceful - if API changes, CLI still works, just loses hang detection
   * Alternative: None - no official API for detecting active handles exists
   */
  return process._getActiveHandles().filter((handle) => {
    const name = handle?.constructor?.name;
    return !allowed.has(name);
  });
}

function assertNoActiveHandles(label) {
  const extras = collectNonStdHandles();
  if (extras.length > 0) {
    const names = extras.map((h) => h?.constructor?.name || typeof h).join(', ');
    throw new Error(`Active handles detected during ${label}: ${names}`);
  }
}

// Handle fast-exit cases SYNCHRONOUSLY before entering async
function handleFastExits(args, { debug = false } = {}) {
  // Handle --version
  if (args.includes('--version') || args.includes('-v')) {
    assertNoActiveHandles('--version fast exit');
    const outcome = buildOutcome({
      command: 'version',
      exitCode: EXIT_CODES.SUCCESS,
      result: 'VERSION',
      reason: `verax ${getVersionString()}`,
      action: 'Continue with desired command',
    });
    emitOutcome(outcome, { json: false });
    process.exit(outcome.exitCode);

  }
  
  // Handle explicit --help
  if (args.includes('--help') || args.includes('-h')) {
    assertNoActiveHandles('--help fast exit');
    const { outcome } = showHelp({ debug, usageError: false });
    emitOutcome(outcome, { json: false });
    process.exit(outcome.exitCode);
  }
  
  // If no args, show minimal help (no interactive mode)
  if (args.length === 0) {
    assertNoActiveHandles('no-args fast exit');
    const { outcome } = showHelp({ debug, usageError: true });
    emitOutcome(outcome, { json: false });
    process.exit(outcome.exitCode);
  }
  
  // Return false if no fast exit triggered
  return false;
}

async function main() {
  const args = parseArgs();
  const debug = args.includes('--debug') || args.includes('--verbose');
  let commandExecuted = false;
  
  // Handle fast exits before entering async logic
  if (handleFastExits(args, { debug })) {
    return; // Should never reach here (process.exit called)
  }

  const command = args[0];
  
  try {
    let outcomePayload = null;
    
    // Route to command handlers (Stage 7 contract commands return outcomes)
    if (command === 'run') {
      commandExecuted = true;
      outcomePayload = await handleRunCommand(args, { debug });
    } else if (command === 'bundle') {
      commandExecuted = true;
      outcomePayload = await handleBundleCommand(args, { debug });
    } else if (command === 'readiness') {
      commandExecuted = true;
      outcomePayload = await handleReadinessCommand(args);
    } else if (command === 'capability-bundle') {
      commandExecuted = true;
      outcomePayload = await handleCapabilityBundleCommand(args);
    } else if (command === 'help' || command === '--help' || command === '-h') {
      commandExecuted = true;
      const topic = args[1];
      if (topic === 'results') {
        outcomePayload = showResultsHelp();
      } else {
        outcomePayload = showHelp({ debug, usageError: false });
      }
    } else if (command === 'version') {
      commandExecuted = true;
      outcomePayload = await handleVersionCommand(args, { debug });
    } else {
      outcomePayload = outOfScopeCommand(command);
    }

    if (outcomePayload) {
      const { outcome, emit = true, json = false, jsonOutput = false, jsonPayload } = outcomePayload;
      if (jsonOutput && jsonPayload) {
        console.log(JSON.stringify(jsonPayload, null, 2));
      }
      if (emit && outcome) {
        emitOutcome(outcome, { json });
      }
      // Force process exit to prevent hanging (BLOCKER C contract fix)
      const finalExitCode = outcome?.exitCode ?? EXIT_CODES.INVARIANT_VIOLATION;
      process.exit(finalExitCode);
    }
    // Fallback: ensure exit even if no outcome payload
    process.exit(EXIT_CODES.INVARIANT_VIOLATION);
  } catch (error) {
    const outcome = outcomeFromError(error, { command: 'verax' });
    if (!commandExecuted && (outcome.exitCode === EXIT_CODES.SUCCESS || outcome.exitCode === EXIT_CODES.USAGE_ERROR)) {
      assertNoActiveHandles('fast-exit error path');
    }
    emitOutcome(outcome, { json: false });
    process.exit(outcome.exitCode);
  }
}

function outOfScopeCommand(cmd) {
  const message = `Command '${cmd}' is out of scope for VERAX ${PILOT_SURFACE_VERSION} pilot surface. Supported: ${PILOT_SUPPORTED_COMMANDS.join(', ')}.`;
  process.stderr.write(`${message}\n`);

  const outcome = buildOutcome({
    command: cmd || 'verax',
    exitCode: EXIT_CODES.USAGE_ERROR,
    reason: message,
    action: `Supported: ${PILOT_SUPPORTED_COMMANDS.join(', ')}`,
  });

  return { outcome, emit: false, json: false };
}

function showHelp({ debug: _debug = false, usageError = false } = {}) {
    /*
    Command: verax help
  Purpose: Render deterministic help text for CLI usage.
  Required: none
  Optional: --help | -h, --debug for additional verbose output
  Outputs: Help text always printed to stdout, followed by RESULT/REASON/ACTION (unless explicit --help)
  Exit Codes: 0 SUCCESS | 64 USAGE_ERROR (no command specified)
  Forbidden: interactive prompts, multiple RESULT blocks.
  */
  const version = getVersion();
  const usageLines = PILOT_COMMAND_SPECS
    .map(({ usage, description }) => {
      const left = `  verax ${usage}`;
      return `${left.padEnd(44)} ${description}`;
    })
    .join('\n');
  const resultsBlock = `RESULTS:
  SUCCESS     ${RESULTS_INTERPRETATION.SUCCESS}
  FINDINGS    ${RESULTS_INTERPRETATION.FINDINGS}
  INCOMPLETE  ${RESULTS_INTERPRETATION.INCOMPLETE}
`;

  const optionsBlock = _debug
    ? `OPTIONS:
  --url <url>                    Target URL to scan (required)
  --src <path>                   Source directory (recommended; auto-detected if omitted)
  --out <path>                   Output directory for artifacts (default: .verax)
  --json                         JSON lines output (progress events + final outcome)
  --debug/--verbose              Verbose output
  --runtime-nav-discovery        Opt-in: discover additional navigation targets at runtime
  --alignment-preflight          Opt-in: preflight check that source and URL likely match
  --auth-storage <path>          Playwright storage state JSON file (cookies/localStorage)
  --auth-cookie <cookie>         Authentication cookies (repeatable)
  --auth-header <header>         Authentication header (repeatable)
  --auth-mode <mode>             Auth mode: auto (default), strict, or off
  --force-post-auth              Required to use auth flags (post-login is out of scope)
  --retain-runs <number>         Number of recent runs to keep (default: 10, 0=none)
  --no-retention                 Disable automatic run pruning (keeps all runs)
  --min-coverage <0-1>           Minimum coverage threshold (default: 0.90)
  --ci-mode <balanced|strict>    Exit-code policy (default: balanced)

PILOT-ONLY (diagnostic) COMMAND FLAGS:
  readiness --timeout-ms <ms>        Timeout for initial HTML fetch
  readiness --json                  Emit a single JSON object (no streaming)
  capability-bundle --out <path>     Output directory root (default: .verax)
  capability-bundle --timeout-ms <ms> Timeout for initial HTML fetch
  capability-bundle --zip            Also write a small zip next to the folder
`
    : `OPTIONS:
  --url <url>     Target URL to scan (required)
  --src <path>    Source directory (recommended; auto-detected if omitted)
  --out <path>    Output directory for artifacts (default: .verax)
  --json          JSON lines output (machine-readable)
  --verbose       Show advanced options

PILOT-ONLY (diagnostic):
  verax readiness --url <url> [--timeout-ms <ms>] [--json]
  verax capability-bundle --url <url> [--out <path>] [--timeout-ms <ms>] [--zip]
`;

  const helpText = `
verax ${version}
${PRODUCT_ONE_LINER}
${DEFAULT_SCOPE_LINE}
${ARTIFACTS_LINE}

USAGE:
${usageLines}

${optionsBlock}
${resultsBlock}
NOTES:
  - ${NOT_THIS_TOOL_LINES[0]}
  - ${NOT_THIS_TOOL_LINES[1]}
  - ${POST_AUTH_DISCLAIMER_LINE}
`;

  // Always print help text to stdout
  console.log(helpText);

  const exitCode = usageError ? EXIT_CODES.USAGE_ERROR : EXIT_CODES.SUCCESS;
  const outcome = buildOutcome({
    command: 'help',
    exitCode,
    result: 'HELP',
    reason: usageError ? 'No command specified' : 'Help requested',
    action: 'Use commands as documented above',
  });
  return { outcome };
}

function showResultsHelp() {
  const text = `
VERAX — Results (pilot)

What VERAX does:
  ${PRODUCT_ONE_LINER}
  ${DEFAULT_SCOPE_LINE}

How to read results:
  SUCCESS     ${RESULTS_INTERPRETATION.SUCCESS}
  FINDINGS    ${RESULTS_INTERPRETATION.FINDINGS}
  INCOMPLETE  ${RESULTS_INTERPRETATION.INCOMPLETE}

Artifacts (the product):
  summary.json    verdict + coverage + counts
  findings.json   findings with evidence pointers
  evidence/       screenshots, traces, and supporting files

Next step:
  Open the run directory under .verax/runs/ (or --out) and review summary.json and findings.json.

Scope note:
  ${POST_AUTH_DISCLAIMER_LINE}
`;

  console.log(text);

  const outcome = buildOutcome({
    command: 'help',
    exitCode: EXIT_CODES.SUCCESS,
    result: 'HELP',
    reason: 'Results help displayed',
    action: 'Use verax run --url <url> --src <path> to scan',
  });

  return { outcome };
}

function parseArg(args, name) {
  const index = args.indexOf(name);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return null;
}

/**
 * Parse repeatable arguments (e.g., --auth-cookie can appear multiple times)
 */
function parseMultipleArgs(args, name) {
  const values = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name && i + 1 < args.length) {
      values.push(args[i + 1]);
      i++; // Skip the value
    }
  }
  return values;
}

// ============================================================================
// COMMAND HANDLERS (extracted from main() for clarity)
// Each handler: parses args, validates, calls command, exits
// ============================================================================

async function handleBundleCommand(args, { debug: _debug = false } = {}) {
  const allowedFlags = new Set(['--debug', '--verbose']);
  const unknownFlags = args.slice(1).filter((a) => a.startsWith('-') && !allowedFlags.has(a));
  if (unknownFlags.length > 0) {
    throw new UsageError(`Unsupported flag(s) for bundle: ${unknownFlags.join(', ')}`);
  }

  const positional = args.slice(1).filter((a) => !a.startsWith('-'));
  if (positional.length !== 2) {
    throw new UsageError('bundle requires <runDir> <bundleDir>');
  }

  const [runDir, bundleDir] = positional;

  const bundleCommand = await loadBundleCommand();
  const { outcome } = await bundleCommand(runDir, bundleDir);

  return { outcome, emit: true, json: false };
}

async function handleReadinessCommand(args) {
  const allowedFlags = new Set(['--url', '--json', '--timeout-ms', '--debug', '--verbose']);
  const unknownFlags = args.slice(1).filter((a) => a.startsWith('-') && !allowedFlags.has(a));
  if (unknownFlags.length > 0) {
    console.log(`Unsupported flag(s) for readiness: ${unknownFlags.join(', ')}`);
  }

  const readinessCommand = await loadReadinessCommand();
  const result = await readinessCommand(args);
  if (result?.json && result?.payload) {
    console.log(JSON.stringify(result.payload, null, 2));
  } else if (result?.text) {
    process.stdout.write(result.text);
  }

  const outcome = buildOutcome({
    command: 'readiness',
    exitCode: EXIT_CODES.SUCCESS,
    result: 'READINESS',
    reason: 'Diagnostic readiness report generated',
    action: 'Use this to decide if a pilot makes sense',
  });

  return { outcome, emit: false, json: false };
}

async function handleCapabilityBundleCommand(args) {
  const allowedFlags = new Set(['--url', '--out', '--zip', '--timeout-ms', '--debug', '--verbose']);
  const unknownFlags = args.slice(1).filter((a) => a.startsWith('-') && !allowedFlags.has(a));
  if (unknownFlags.length > 0) {
    console.log(`Unsupported flag(s) for capability-bundle: ${unknownFlags.join(', ')}`);
  }

  const capabilityBundleCommand = await loadCapabilityBundleCommand();
  const result = await capabilityBundleCommand(args);
  if (result?.text) {
    process.stdout.write(result.text);
  }

  const outcome = buildOutcome({
    command: 'capability-bundle',
    exitCode: EXIT_CODES.SUCCESS,
    result: 'CAPABILITY_BUNDLE',
    reason: 'Diagnostic capability bundle generated',
    action: 'Share the bundle with VERAX support if needed',
  });

  return { outcome, emit: false, json: false };
}

async function handleRunCommand(args, { debug = false } = {}) {
  const allowedFlags = new Set([
    '--url',
    '--src',
    '--out',
    '--json',
    '--debug',
    '--verbose',
    '--runtime-nav-discovery',
    '--alignment-preflight',
    '--auth-storage',
    '--auth-cookie',
    '--auth-header',
    '--auth-mode',
    '--force-post-auth',
    '--retain-runs',
    '--no-retention',
    '--min-coverage',
    '--ci-mode',
    '--bootstrap-browser',
    '--explain-expectations',
    '--dry-learn',
  ]);

  const unknownFlags = args.slice(1).filter((a) => a.startsWith('-') && !allowedFlags.has(a));
  if (unknownFlags.length > 0) {
    throw new UsageError(`Unsupported flag(s) for run: ${unknownFlags.join(', ')}`);
  }

  const url = parseArg(args, '--url');
  const srcArg = parseArg(args, '--src');
  const out = parseArg(args, '--out') || '.verax';
  const json = args.includes('--json');
  const verboseFlag = args.includes('--verbose');
  const debugFlag = debug || verboseFlag || args.includes('--debug');
  const bootstrapBrowser = args.includes('--bootstrap-browser') || process.env.VERAX_BOOTSTRAP_BROWSER === '1';
  const explainExpectations = args.includes('--explain-expectations');
  const dryLearn = args.includes('--dry-learn');
  const runtimeNavDiscovery = args.includes('--runtime-nav-discovery');
  const alignmentPreflight = args.includes('--alignment-preflight');

  // Propagate debug intent to internals that honor VERAX_DEBUG
  if (debugFlag && !process.env.VERAX_DEBUG) {
    process.env.VERAX_DEBUG = '1';
  }
  
  if (!url) {
    throw new UsageError('run command requires --url <url> argument');
  }
  
  // Zero-config: auto-detect source if not provided
  const projectRoot = resolve(process.cwd());
  let src = srcArg;
  let sourceMode = 'provided'; // 'provided' | 'auto-detected' | 'not-detected'
  
  if (!srcArg) {
    const { autoDiscoverSrc } = await import('./util/support/src-auto-discovery.js');
    const autoResult = autoDiscoverSrc(projectRoot);
    
    if (autoResult.discovered && autoResult.srcPath) {
      src = autoResult.srcPath;
      sourceMode = 'auto-detected';
      if (!json && debugFlag) {
        console.log(`Source: auto-detected (${autoResult.srcPath})`);
      }
    } else {
      src = projectRoot; // Fallback to cwd for LIMITED mode
      sourceMode = 'not-detected';
      if (!json && debugFlag) {
        console.log('Source: not detected (limited runtime-only mode)');
        console.log('Analysis will be limited to runtime observation.');
        console.log('Result will be marked INCOMPLETE.');
        console.log('Provide --src <path> for full source-based analysis.\n');
      }
    }
  }
  
  // Detect first run
  const isFirstRunDetected = isFirstRun(projectRoot);
  
  const authStorage = parseArg(args, '--auth-storage');
  const authCookiesArgs = parseMultipleArgs(args, '--auth-cookie');
  const authHeadersArgs = parseMultipleArgs(args, '--auth-header');
  const authMode = parseArg(args, '--auth-mode') || 'auto';
  const forcePostAuth = args.includes('--force-post-auth');
  
  // SCOPE BOUNDARY ENFORCEMENT: post-login flows are out of scope for the pilot surface.
  // If user provides auth flags, require explicit --force-post-auth acknowledgement.
  const hasAuthFlags = authStorage || (authCookiesArgs && authCookiesArgs.length > 0) || (authHeadersArgs && authHeadersArgs.length > 0) || authMode !== 'auto';
  if (hasAuthFlags && !forcePostAuth) {
    throw new UsageError(
      `Authentication flags require --force-post-auth.\n${POST_AUTH_DISCLAIMER_LINE}\n` +
      'Results with authentication are always marked INCOMPLETE.'
    );
  }
  
  const { authConfig, errors: authErrors } = buildAuthConfig({
    authStorage,
    authCookiesArgs,
    authHeadersArgs,
    authMode,
    cwd: process.cwd(),
  });

  if (authErrors.length > 0) {
    throw new UsageError(authErrors.join('; '));
  }
  
  // Do not emit extra console output in normal mode; any post-auth notice is in help/usage text.
  if (hasAuthFlags && forcePostAuth && !json && debugFlag) {
    console.log(`Scope note: ${POST_AUTH_DISCLAIMER_LINE}`);
    console.log('Result will be marked INCOMPLETE.\n');
  }
  
  const retainRunsArg = parseArg(args, '--retain-runs');
  const retainRuns = retainRunsArg !== null ? parseInt(retainRunsArg, 10) : 10;
  const noRetention = args.includes('--no-retention');
  
  if (retainRunsArg !== null && (isNaN(retainRuns) || retainRuns < 0)) {
    throw new UsageError(`--retain-runs must be an integer >= 0, got: ${retainRunsArg}`);
  }
  
  // Apply first-run defaults
  const minCoverageArg = parseArg(args, '--min-coverage');
  const ciModeArg = parseArg(args, '--ci-mode');
  
  let minCoverage;
  let ciMode;
  
  if (isFirstRunDetected) {
    // First run: relaxed defaults (only if user didn't provide flags)
    minCoverage = minCoverageArg !== null ? parseFloat(minCoverageArg) : 0.50;
    ciMode = ciModeArg || 'balanced'; // FIXED: removed advisory mode (violated Vision.md)
  } else {
    // Subsequent runs: normal defaults
    minCoverage = minCoverageArg !== null ? parseFloat(minCoverageArg) : 0.90;
    ciMode = ciModeArg || 'balanced';
  }
  
  if (minCoverageArg !== null && (isNaN(minCoverage) || minCoverage < 0 || minCoverage > 1)) {
    throw new UsageError(`--min-coverage must be a number between 0.0 and 1.0, got: ${minCoverageArg}`);
  }

  const allowedCiModes = new Set(['balanced', 'strict']); // REMOVED: advisory (violated Vision.md)
  if (!allowedCiModes.has(ciMode)) {
    throw new UsageError(`--ci-mode must be balanced or strict, got: ${ciMode}`);
  }

  const srcPath = resolve(projectRoot, src);
  const outPath = resolve(projectRoot, out);
  const readOnlyCheck = enforceReadOnlyOperation({ srcPath, outPath, projectRoot });
  if (!readOnlyCheck.enforced) {
    const violation = readOnlyCheck.violations[0];
    if (violation && violation.message.includes('source code directory')) {
      throw new UsageError(`Product Contract violation (READ_ONLY): ${violation.message}`);
    }
  }

  // PHASE 4: Preflight (fast, deterministic). Must run BEFORE run directories/phases begin.
  try {
    await runPreflight({ outPath });
  } catch (preflightError) {
    const outcome = outcomeFromError(preflightError, { command: 'run' });
    return { outcome, emit: true, json };
  }

  const runCommand = await loadRunCommand();
  const result = await runCommand({ 
    url,
    src,
    out,
    json,
    verbose: verboseFlag,
    debug: debugFlag,
    runtimeNavDiscovery,
    alignmentPreflight,
    authConfig,
    retainRuns,
    noRetention,
    minCoverage,
    ciMode,
    bootstrapBrowser,
    isFirstRun: isFirstRunDetected,
    explainExpectations,
    dryLearn,
    sourceMode, // NEW: track how source was provided
    forcePostAuth, // SCOPE ENFORCEMENT: track post-auth mode
    hasAuthFlags, // SCOPE ENFORCEMENT: track if auth flags provided
  });

  const outcome = result?.outcome || buildOutcome({
    command: 'run',
    exitCode: result?.exitCode ?? EXIT_CODES.INVARIANT_VIOLATION,
    reason: 'Run completed',
    action: 'Review artifacts',
  });

  // TRUST FIX 2: Ensure outcome exitCode matches result exitCode (single source of truth)
  // If result has an outcome, the outcome's exitCode is authoritative
  // If building fallback outcome, use result.exitCode
  if (result?.outcome && result?.exitCode !== undefined && result.outcome.exitCode !== result.exitCode) {
    if (debugFlag || verboseFlag) {
      console.error(
        `[WARN] Exit code mismatch: outcome=${result.outcome.exitCode}, result=${result.exitCode}. Using outcome exitCode.`
      );
    }
  }

  return { outcome, emit: true, json };

}

async function handleVersionCommand(args, { debug: _debug = false } = {}) {
  /*
  Command: verax version
  Purpose: Display version, stability level, and compatibility guarantees
  Required: none
  Optional: --json
  Outputs: Version information as text or JSON
  Exit Codes: 0 SUCCESS
  Forbidden: interactive prompts, side effects
  */
  const json = args.includes('--json');
  const versionInfo = getVersionInfo();
  
  if (json) {
    console.log(JSON.stringify(versionInfo, null, 2));
  } else {
    console.log(`\nVERAX ${getVersionString()}`);
    console.log(`Stability: ${versionInfo.stability}`);
    console.log('\nVERSIONING LAW:');
    console.log(`  MAJOR: ${versionInfo.versioningLaw.major}`);
    console.log(`  MINOR: ${versionInfo.versioningLaw.minor}`);
    console.log(`  PATCH: ${versionInfo.versioningLaw.patch}`);
    console.log('\nCOMPATIBILITY GUARANTEES:');
    console.log(`  CLI Commands:       ${versionInfo.compatibility.cli.commands}`);
    console.log(`  Exit Codes:         ${versionInfo.compatibility.cli.exitCodes}`);
    console.log(`  Artifact Schema:    ${versionInfo.compatibility.artifacts.schema}`);
    console.log(`  Determinism:        ${versionInfo.compatibility.behavior.determinism}`);
    console.log(`  Read-Only:          ${versionInfo.compatibility.behavior.readOnly}`);
    console.log(`  Zero-Config:        ${versionInfo.compatibility.behavior.zeroConfig}`);
    console.log('\nDEPRECATION POLICY:');
    console.log(`  No silent removals. ${versionInfo.deprecationPolicy.notice}.`);
    console.log('\nEXPERIMENTAL AREAS:');
    console.log(`  Commands:           ${versionInfo.compatibility.experimental.commands}`);
    console.log(`  Advanced Auth:      ${versionInfo.compatibility.experimental.advancedAuth}`);
    
    if (versionInfo.breakingChangesSinceLastMajor.length > 0) {
      console.log(`\nBREAKING CHANGES SINCE LAST MAJOR:`);
      versionInfo.breakingChangesSinceLastMajor.forEach((change) => {
        console.log(`  - ${change}`);
      });
    }
    console.log();
  }
  
  const outcome = buildOutcome({
    command: 'version',
    exitCode: EXIT_CODES.SUCCESS,
    result: 'VERSION',
    reason: `verax ${getVersionString()}`,
    action: 'Continue with desired command',
  });
  
  return { outcome, emit: true, json };
}
main().catch((error) => {
  const outcome = buildOutcome({
    command: 'verax',
    exitCode: EXIT_CODES.INVARIANT_VIOLATION,
    reason: error instanceof Error ? error.message : (typeof error === 'string' ? error : 'Fatal error'),
    action: 'Re-run with --debug for stack trace',
  });
  emitOutcome(outcome, { json: false });
  process.exit(outcome.exitCode);
});




