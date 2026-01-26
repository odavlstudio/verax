#!/usr/bin/env node
/**
 * VERAX CLI Entry Point (Stage 7 Contract)
 * Commands handled here:
 * - verax run
 * - verax inspect
 * - verax gate
// eslint-disable-next-line no-unused-vars
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
import { VERSION, getVersionString, getVersionInfo } from '../version.js';

const FROZEN_COMMANDS = new Set([
  'doctor',
  'diagnose',
  'explain',
  'stability',
  'stability-run',
  'triage',
  'clean',
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Lazy loaders for heavy modules (loaded only when needed)
async function loadRunCommand() {
  const mod = await import('./commands/run.js');
  return mod.runCommand;
}

async function loadInspectCommand() {
  const mod = await import('./commands/inspect.js');
  return mod.inspectCommand;
}

async function loadDoctorCommand() {
  const mod = await import('./commands/doctor.js');
  return mod.doctorCommand;
}

async function loadDiagnoseCommand() {
  const mod = await import('./commands/diagnose.js');
  return mod.diagnoseCommand;
}

async function loadExplainCommand() {
  const mod = await import('./commands/explain.js');
  return mod.explainCommand;
}

async function loadStabilityCommand() {
  const mod = await import('./commands/stability.js');
  return mod.stabilityCommand;
}

async function loadStabilityRunCommand() {
  const mod = await import('./commands/stability-run.js');
  return mod.stabilityRunCommand;
}

async function loadTriageCommand() {
  const mod = await import('./commands/triage.js');
  return mod.triageCommand;
}

async function loadCleanCommand() {
  const mod = await import('./commands/clean.js');
  return mod.cleanCommand;
}

async function loadGateCommand() {
  const mod = await import('./commands/gate.js');
  return mod.gateCommand;
}

// Read package.json for version
function getVersion() {
  return VERSION;
}

/**
 * Print v1 scope notice for FROZEN or EXPERIMENTAL commands
 * @param {string} scope - 'FROZEN' or 'EXPERIMENTAL'
 * @param {boolean} json - Whether JSON output mode is active
 */
function printV1ScopeNotice(scope, json = false) {
  if (json) return; // Skip in JSON mode
  
  if (scope === 'FROZEN') {
    console.error('Note: This command is frozen and not covered by VERAX v1 guarantees.');
  } else if (scope === 'EXPERIMENTAL') {
    console.error('Note: This command is experimental and behavior is not guaranteed in VERAX v1.');
  }
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
  if (FROZEN_COMMANDS.has(command)) {
    console.error('This command is frozen and not part of VERAX Vision 1.0 guarantees.');
    process.exit(EXIT_CODES.USAGE_ERROR);
  }
  
  try {
    let outcomePayload = null;
    
    // Route to command handlers (Stage 7 contract commands return outcomes)
    if (command === 'run') {
      commandExecuted = true;
      outcomePayload = await handleRunCommand(args, { debug });
    } else if (command === 'inspect') {
      commandExecuted = true;
      outcomePayload = await handleInspectCommand(args, { debug });
    } else if (command === 'gate') {
      commandExecuted = true;
      outcomePayload = await handleGateCommand(args, { debug });
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
    } else if (command === 'doctor') {
      commandExecuted = true;
      outcomePayload = await handleDoctorCommand(args);
    } else if (command === 'diagnose') {
      commandExecuted = true;
      outcomePayload = await handleDiagnoseCommand(args);
    } else if (command === 'explain') {
      commandExecuted = true;
      outcomePayload = await handleExplainCommand(args);
    } else if (command === 'stability') {
      commandExecuted = true;
      outcomePayload = await handleStabilityCommand(args);
    } else if (command === 'stability-run') {
      commandExecuted = true;
      outcomePayload = await handleStabilityRunCommand(args);
    } else if (command === 'triage') {
      commandExecuted = true;
      outcomePayload = await handleTriageCommand(args);
    } else if (command === 'clean') {
      commandExecuted = true;
      outcomePayload = await handleCleanCommand(args);
    } else {
      // Interactive mode removed
      throw new UsageError('Interactive mode is disabled. Use: verax run --url <url>');
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
  const helpText = `
verax ${version}
VERAX — Silent failure detection for websites

USAGE:
  verax run --url <url> [options]              Run scan on a URL
  verax inspect <runPath> [--json]             Inspect an existing run

EXPERIMENTAL COMMANDS:
  verax diagnose <runId> [--json]              [ALPHA] Generate diagnostics for a run
  verax explain <runId> <findingId> [--json]   [ALPHA] Explain a specific finding
  verax triage <runId> [--json]                [ALPHA] Generate incident triage report
  verax stability <runId> [--json]             [ALPHA] Analyze stability of a single run
  verax stability-run --url <url> --repeat <N>  [ALPHA] Execute multiple runs and analyze
                     [--mode ci|standard] [--json]

OPERATIONAL COMMANDS:
  verax doctor [--json]                        Diagnose local environment
  verax clean [--keep-last N] [--older-than D]  Clean up old runs (default: dry-run)
              [--allow-delete-confirmed] [--no-dry-run] [--json]
  verax gate --url <url> [--fail-on-incomplete true|false]  [BETA] Enterprise CI release gate
             [--json]
  verax help results                           Explain VERAX pipeline and results

OPTIONS:
  --url <url>                    Target URL to scan
  --src <path>                   Source directory (optional, auto-detected if omitted)
                                 Auto-detection searches: ., ./src, ./app, ./frontend
                                 If not found: runs in LIMITED mode (result: INCOMPLETE)
  --out <path>                   Output directory for artifacts (default: .verax)
  --json                         Output as JSON lines (progress events)
  --debug/--verbose              Verbose output
  --explain-expectations         Print top 10 extracted expectations before observing
  --auth-storage <path>          Playwright storage state JSON file (cookies/localStorage)
  --auth-cookie <cookie>         Authentication cookies (repeatable)
  --auth-header <header>         Authentication header (repeatable)
  --auth-mode <mode>             Auth mode: auto (default), strict, or off
  --force-post-auth              Required to use auth flags (post-auth is OUT OF SCOPE, experimental)
  --retain-runs <number>         Number of recent runs to keep (default: 10, 0=none)
  --no-retention                 Disable automatic run cleanup (keeps all runs)
  --min-coverage <0-1>           Minimum observation coverage ratio (default: 0.90)
  --ci-mode <balanced|strict>    Exit code policy for run (default: balanced)
  --fail-on-incomplete <bool>    Gate: treat incomplete runs as failure (default: true)
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
VERAX Results and Pipeline (plain language)

Pipeline:
  Learn   - reads your source code to extract navigation, forms, and feedback promises (requires --src)
  Observe - plays those interactions in a real browser (pre-auth only; dynamic routes skipped)
  Detect  - compares promises vs observed reality and flags silent failures with evidence

Verdicts:
  SUCCESS     - No silent failures seen in the covered flows. Not a guarantee of correctness.
  FINDINGS    - Silent failures detected with evidence. Treat as real user risks until disproven.
  INCOMPLETE  - Observation unfinished or coverage below threshold. ⚠ NOT SAFE to treat as clean.

Artifacts:
  .verax/runs/<scan>/<run>/summary.json   - verdict, coverage, counts
  .../findings.json                       - list of findings with evidence pointers
  .../learn.json                          - promises extracted from source
  .../coverage.json                       - attempted vs unattempted expectations

Next steps per verdict:
  SUCCESS    - keep as advisory gate; expand coverage for critical flows
  FINDINGS   - run "verax inspect <run>" to open evidence; fix or accept risk explicitly
  INCOMPLETE - rerun with reachable URL, reduce scope, or increase --min-coverage / timeout budget

Remember: VERAX needs the matching source code. Without it, promises are empty and results will be INCOMPLETE.
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

async function handleRunCommand(args, { debug = false } = {}) {
  const allowedFlags = new Set([
    '--url',
    '--src',
    '--out',
    '--json',
    '--debug',
    '--verbose',
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
      if (!json) {
        console.log(`✓ Source: auto-detected from ${autoResult.srcPath}`);
      }
    } else {
      src = projectRoot; // Fallback to cwd for LIMITED mode
      sourceMode = 'not-detected';
      if (!json) {
        console.log('⚠️  Source: not detected (limited runtime-only mode)');
        console.log('    Analysis will be limited to runtime observation.');
        console.log('    Result will be marked INCOMPLETE.');
        console.log('    Provide --src <path> for full source-based analysis.\n');
      }
    }
  }
  
  // Detect first run
  const isFirstRunDetected = isFirstRun(projectRoot);
  
  const authStorage = parseArg(args, '--auth-storage');
  const authCookiesArgs = parseMultipleArgs(args, '--auth-cookie');
  const authHeadersArgs = parseMultipleArgs(args, '--auth-header');
  const authMode = parseArg(args, '--auth-mode') || 'auto';
  const forcePostAuth = hasArg(args, '--force-post-auth');
  
  // SCOPE BOUNDARY ENFORCEMENT: Vision.md explicitly states "Authenticated / post-login flows" are OUT OF SCOPE
  // If user provides auth flags, require explicit --force-post-auth acknowledgement
  const hasAuthFlags = authStorage || (authCookiesArgs && authCookiesArgs.length > 0) || (authHeadersArgs && authHeadersArgs.length > 0) || authMode !== 'auto';
  if (hasAuthFlags && !forcePostAuth) {
    throw new UsageError(
      'Authentication flags detected, but authenticated flows are OUT OF SCOPE per Vision.md.\n' +
      'VERAX is designed for pre-authentication, public flows only.\n' +
      'If you understand the risks and limitations, add --force-post-auth to proceed.\n' +
      '⚠️  WARNING: Results with authentication are EXPERIMENTAL and will always be marked INCOMPLETE.'
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
  
  // Print loud warning if using post-auth mode
  if (hasAuthFlags && forcePostAuth) {
    if (!json) {
      console.log('⚠️  WARNING: Running in EXPERIMENTAL post-auth mode');
      console.log('    • Authenticated flows are OUT OF SCOPE per Vision.md');
      console.log('    • Result will be marked INCOMPLETE');
      console.log('    • Trust guarantees do NOT apply to post-auth analysis\n');
    }
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

  const runCommand = await loadRunCommand();
  const result = await runCommand({ 
    url,
    src,
    out,
    json,
    verbose: verboseFlag,
    debug: debugFlag,
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

  return { outcome, emit: true, json };

}

async function handleInspectCommand(args, { debug = false } = {}) {
  if (args.length < 2) {
    throw new UsageError('inspect command requires a run path argument');
  }

  const allowedFlags = new Set(['--json']);
  const unknownFlags = args.slice(2).filter((a) => a.startsWith('-') && !allowedFlags.has(a));
  if (unknownFlags.length > 0) {
    throw new UsageError(`Unsupported flag(s) for inspect: ${unknownFlags.join(', ')}`);
  }
  
  const runPath = args[1];
  const json = args.includes('--json');
  
  const inspectCommand = await loadInspectCommand();
  const { outcome, jsonPayload } = await inspectCommand(runPath, { json, debug });

  if (json) {
    return { outcome, emit: true, json: true, jsonOutput: true, jsonPayload };
  }
  return { outcome, emit: true, json: false };

}

async function handleDoctorCommand(args) {
  const allowedFlags = new Set(['--json']);
  const extraFlags = args.slice(1).filter((a) => a.startsWith('-') && !allowedFlags.has(a));
  if (extraFlags.length > 0) {
    throw new UsageError(`Unsupported flag(s) for doctor: ${extraFlags.join(', ')}`);
  }
  const json = args.includes('--json');
  
  // v1 scope notice
  printV1ScopeNotice('FROZEN', json);
  
  const doctorCommand = await loadDoctorCommand();
  const result = await doctorCommand({ json });
  const exitCode = result?.exitCode ?? (result?.ok === false ? EXIT_CODES.INVARIANT_VIOLATION : EXIT_CODES.SUCCESS);
  const outcome = buildOutcome({
    command: 'doctor',
    exitCode,
    reason: result?.ok ? 'Environment checks passed' : `${result?.checks?.filter(c => c.status === 'fail').length || 0} checks failed`,
    action: result?.ok ? 'Environment is ready' : 'Review recommendations and fix failing checks',
  });
  return { outcome, emit: !json, json };

}

async function handleDiagnoseCommand(args) {
  if (args.length < 2) {
    throw new UsageError('diagnose command requires a <runId> argument');
  }
  
  const allowedFlags = new Set(['--json']);
  const extraFlags = args.slice(2).filter((a) => a.startsWith('-') && !allowedFlags.has(a));
  if (extraFlags.length > 0) {
    throw new UsageError(`Unsupported flag(s) for diagnose: ${extraFlags.join(', ')}`);
  }
  
  const runIdArg = args[1];
  const json = args.includes('--json');
  
  // v1 scope notice
  printV1ScopeNotice('FROZEN', json);
  
  const diagnoseCommand = await loadDiagnoseCommand();
  const result = await diagnoseCommand({ runId: runIdArg, json, projectRoot: process.cwd() });
  
  const outcome = buildOutcome({
    command: 'diagnose',
    exitCode: EXIT_CODES.SUCCESS,
    reason: `Diagnostics generated for run ${runIdArg}`,
    action: `Review diagnostics at ${result?.diagnosticsPath || '.verax/runs/' + runIdArg + '/diagnostics.json'}`,
  });
  return { outcome, emit: !json, json };
}

async function handleExplainCommand(args) {
  if (args.length < 3) {
    throw new UsageError('explain command requires <runId> and <findingId> arguments');
  }
  
  const allowedFlags = new Set(['--json']);
  const extraFlags = args.slice(3).filter((a) => a.startsWith('-') && !allowedFlags.has(a));
  if (extraFlags.length > 0) {
    throw new UsageError(`Unsupported flag(s) for explain: ${extraFlags.join(', ')}`);
  }
  
  const runIdArg = args[1];
  const findingIdArg = args[2];
  const json = args.includes('--json');
  
  // v1 scope notice
  printV1ScopeNotice('FROZEN', json);
  
  const explainCommand = await loadExplainCommand();
  const result = await explainCommand({ runIdArg, findingIdArg, json, projectRoot: process.cwd() });
  
  const outcome = buildOutcome({
    command: 'explain',
    exitCode: EXIT_CODES.SUCCESS,
    reason: `Explanation generated for finding ${findingIdArg}`,
    action: `Review explanation at ${result?.explainPath || `.verax/runs/${runIdArg}/explain/${findingIdArg}.json`}`,
  });
  return { outcome, emit: !json, json };
}

async function handleStabilityCommand(args) {
  if (args.length < 2) {
    throw new UsageError('stability command requires <runId> argument');
  }

  const allowedFlags = new Set(['--json']);
  const extraFlags = args.slice(2).filter((a) => a.startsWith('-') && !allowedFlags.has(a));
  if (extraFlags.length > 0) {
    throw new UsageError(`Unsupported flag(s) for stability: ${extraFlags.join(', ')}`);
  }

  const runId = args[1];
  const json = args.includes('--json');

  // v1 scope notice
  printV1ScopeNotice('FROZEN', json);

  const stabilityCommand = await loadStabilityCommand();
  const result = await stabilityCommand({ projectRoot: process.cwd(), runId, json });
  
  const outcome = buildOutcome({
    command: 'stability',
    exitCode: EXIT_CODES.SUCCESS,
    reason: `Stability metrics generated for run ${runId}`,
    action: `Review stability at ${result?.stabilityPath || `.verax/runs/${runId}/stability.json`}`,
  });
  return { outcome, emit: !json, json };
}

async function handleStabilityRunCommand(args) {
  const allowedFlags = new Set(['--url', '--repeat', '--mode', '--json']);
  const extraFlags = args.slice(1).filter((a) => a.startsWith('-') && !allowedFlags.has(a));
  if (extraFlags.length > 0) {
    throw new UsageError(`Unsupported flag(s) for stability-run: ${extraFlags.join(', ')}`);
  }

  const url = parseArg(args, '--url');
  const repeat = parseArg(args, '--repeat');
  const mode = parseArg(args, '--mode') || 'standard';
  const json = args.includes('--json');

  if (!url) {
    throw new UsageError('stability-run command requires --url <url> argument');
  }

  if (!repeat) {
    throw new UsageError('stability-run command requires --repeat <N> argument');
  }

  const repeatNum = parseInt(repeat, 10);
  if (isNaN(repeatNum) || repeatNum < 2) {
    throw new UsageError('--repeat must be a number >= 2');
  }

  const stabilityRunCommand = await loadStabilityRunCommand();
  const result = await stabilityRunCommand({
    projectRoot: process.cwd(),
    url,
    repeat: repeatNum,
    mode,
    json
  });
  
  const outcome = buildOutcome({
    command: 'stability-run',
    exitCode: EXIT_CODES.SUCCESS,
    reason: `Batch stability analysis complete (${repeatNum} runs)`,
    action: `Review batch report at ${result?.reportPath || '.verax/stability'}`,
  });
  return { outcome, emit: !json, json };
}

async function handleTriageCommand(args) {
  if (args.length < 2) {
    throw new UsageError('triage command requires <runId> argument');
  }

  const allowedFlags = new Set(['--json']);
  const extraFlags = args.slice(2).filter((a) => a.startsWith('-') && !allowedFlags.has(a));
  if (extraFlags.length > 0) {
    throw new UsageError(`Unsupported flag(s) for triage: ${extraFlags.join(', ')}`);
  }

  const runId = args[1];
  const json = args.includes('--json');

  // v1 scope notice
  printV1ScopeNotice('FROZEN', json);

  const triageCommand = await loadTriageCommand();
  const result = await triageCommand({ projectRoot: process.cwd(), runId, json });
  
  const outcome = buildOutcome({
    command: 'triage',
    exitCode: EXIT_CODES.SUCCESS,
    reason: `Triage report generated for run ${runId}`,
    action: `Review triage at ${result?.triagePath || `.verax/runs/${runId}/triage.json`}`,
  });
  return { outcome, emit: !json, json };
}

async function handleCleanCommand(args) {
  const allowedFlags = new Set(['--keep-last', '--older-than', '--allow-delete-confirmed', '--no-dry-run', '--json']);
  const extraFlags = args.slice(1).filter((a) => a.startsWith('-') && !allowedFlags.has(a));
  if (extraFlags.length > 0) {
    throw new UsageError(`Unsupported flag(s) for clean: ${extraFlags.join(', ')}`);
  }

  const keepLastArg = parseArg(args, '--keep-last');
  const keepLast = keepLastArg !== null ? parseInt(keepLastArg, 10) : 10;
  
  const olderThanArg = parseArg(args, '--older-than');
  const olderThanDays = olderThanArg !== null ? parseInt(olderThanArg, 10) : null;
  
  const allowDeleteConfirmed = args.includes('--allow-delete-confirmed');
  const dryRun = !args.includes('--no-dry-run'); // Default to dry-run
  const json = args.includes('--json');
  
  // v1 scope notice
  printV1ScopeNotice('FROZEN', json);
  
  if (keepLastArg !== null && (isNaN(keepLast) || keepLast < 0)) {
    throw new UsageError(`--keep-last must be an integer >= 0, got: ${keepLastArg}`);
  }
  
  if (olderThanArg !== null && (isNaN(olderThanDays) || olderThanDays <= 0)) {
    throw new UsageError(`--older-than must be a positive integer, got: ${olderThanArg}`);
  }

  const cleanCommand = await loadCleanCommand();
  const result = await cleanCommand({
    projectRoot: process.cwd(),
    keepLast,
    olderThanDays,
    allowDeleteConfirmed,
    dryRun,
    json,
  });
  
  const outcome = buildOutcome({
    command: 'clean',
    exitCode: EXIT_CODES.SUCCESS,
    reason: dryRun ? `Cleanup plan: ${result?.deleted || 0} runs would be deleted` : `Cleanup complete: ${result?.deleted || 0} runs deleted`,
    action: dryRun ? 'Run with --no-dry-run to execute' : 'Cleanup finished',
  });
  return { outcome, emit: !json, json };
}

async function handleGateCommand(args, { debug = false } = {}) {
  const allowedFlags = new Set([
    '--url',
    '--src',
    '--out',
    '--json',
    '--debug',
    '--verbose',
    '--auth-storage',
    '--auth-cookie',
    '--auth-header',
    '--auth-mode',
    '--fail-on-incomplete',
  ]);

  const unknownFlags = args.slice(1).filter((a) => a.startsWith('-') && !allowedFlags.has(a));
  if (unknownFlags.length > 0) {
    throw new UsageError(`Unsupported flag(s) for gate: ${unknownFlags.join(', ')}`);
  }

  const url = parseArg(args, '--url');
  const src = parseArg(args, '--src') || '.';
  const out = parseArg(args, '--out') || '.verax';
  const json = args.includes('--json');
  
  // v1 scope notice
  printV1ScopeNotice('FROZEN', json);
  
  const verboseFlag = args.includes('--verbose');
  const debugFlag = debug || verboseFlag || args.includes('--debug');
  
  const authStorage = parseArg(args, '--auth-storage');
  const authCookiesArgs = parseMultipleArgs(args, '--auth-cookie');
  const authHeadersArgs = parseMultipleArgs(args, '--auth-header');
  const authMode = parseArg(args, '--auth-mode') || 'auto';
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
  
  const failOnIncompleteArg = parseArg(args, '--fail-on-incomplete');
  const failOnIncomplete = failOnIncompleteArg === 'false' ? false : true;

  if (!url) {
    throw new UsageError('gate requires --url <url>');
  }

  const projectRoot = resolve(process.cwd());
  const srcPath = resolve(projectRoot, src);
  const outPath = resolve(projectRoot, out);
  const readOnlyCheck = enforceReadOnlyOperation({ srcPath, outPath, projectRoot });
  if (!readOnlyCheck.enforced) {
    const violation = readOnlyCheck.violations[0];
    if (violation && violation.message.includes('source code directory')) {
      throw new UsageError(`Product Contract violation (READ_ONLY): ${violation.message}`);
    }
  }

  const gateCommand = await loadGateCommand();
  const result = await gateCommand({
    url,
    projectRoot,
    src,
    out,
    json,
    verbose: verboseFlag,
    debug: debugFlag,
    authConfig,
    failOnIncomplete,
  });

  if (json) {
    return { outcome: result.outcome, emit: true, json: true, jsonOutput: true, jsonPayload: result.jsonPayload };
  }

  return { outcome: result.outcome, emit: true, json: false };
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



