#!/usr/bin/env node

/**
 * VERAX CLI Entry Point
 * 
 * Commands:
 * - verax run --url <url>    (strict, non-interactive)
 * - verax inspect <runPath>  (read and display run summary)
 * 
 * Exit codes:
 * - 0:  success
 * - 2:  internal crash
 * - 64: invalid CLI usage
 * - 65: invalid input data
 * 
 * DESIGN: Lazy imports for heavy modules
 * --version and --help are fast and don't load Playwright or observation-engine
 * Heavy modules are only loaded when running actual commands (run, inspect, doctor)
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';
import { getExitCode, UsageError } from './util/errors.js';

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

// Read package.json for version
function getVersion() {
  try {
    const pkgPath = resolve(__dirname, '../../package.json');
  // @ts-expect-error - readFileSync with encoding returns string
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  try {
    // Handle --version
    if (args.includes('--version') || args.includes('-v')) {
      console.log(`verax ${getVersion()}`);
      process.exit(0);
    }
    
    // Handle explicit --help
    if (args.includes('--help') || args.includes('-h')) {
      showHelp();
      process.exit(0);
    }
    
    // If no args, show help (no interactive mode)
    if (args.length === 0) {
      showHelp();
      process.exit(64);
    }
    
    const command = args[0];
    
    // Handle 'run' command
    if (command === 'run') {
      const url = parseArg(args, '--url');
      const src = parseArg(args, '--src') || '.';
      const out = parseArg(args, '--out') || '.verax';
      const json = args.includes('--json');
      const verbose = args.includes('--verbose');
      
      if (!url) {
        throw new UsageError('run command requires --url <url> argument');
      }
      
      const runCommand = await loadRunCommand();
      await runCommand({ url, src, out, json, verbose });
      process.exit(0);
    }
    
    // Handle 'inspect' command
    if (command === 'inspect') {
      if (args.length < 2) {
        throw new UsageError('inspect command requires a run path argument');
      }
      
      const runPath = args[1];
      const json = args.includes('--json');
      
      const inspectCommand = await loadInspectCommand();
      await inspectCommand(runPath, { json });
      process.exit(0);
    }

    // Handle 'doctor' command
    if (command === 'doctor') {
      const allowedFlags = new Set(['--json']);
      const extraFlags = args.slice(1).filter((a) => a.startsWith('-') && !allowedFlags.has(a));
      const json = args.includes('--json');
      const doctorCommand = await loadDoctorCommand();
      await doctorCommand({ json, extraFlags });
      process.exit(0);
    }
    
    // Handle 'help' command
    if (command === 'help' || command === '--help' || command === '-h') {
      showHelp();
      process.exit(0);
    }
    
    // Interactive mode removed
    throw new UsageError('Interactive mode is disabled. Use: verax run --url <url>');
  } catch (error) {
    // Print error message
    if (error.message) {
      console.error(`Error: ${error.message}`);
    }
    
    // Get exit code
    const exitCode = getExitCode(error);
    process.exit(exitCode);
  }
}

function showHelp() {
  const version = getVersion();
  console.log(`
verax ${version}
VERAX — Silent failure detection for websites

USAGE:
  verax run --url <url> [options]             Strict mode (non-interactive, CI-friendly)
  verax inspect <runPath> [--json]            Inspect an existing run
  verax doctor [--json]                       Diagnose local environment
  verax --version                              Show version
  verax --help                                 Show this help

OPTIONS:
  --url <url>        Target URL to scan
  --src <path>       Source directory (default: .)
  --out <path>       Output directory for artifacts (default: .verax)
  --json             Output as JSON lines (progress events)
  --verbose          Verbose output
  --help             Show this help
  --version          Show version

EXAMPLES:
  # Smart mode (interactive if needed)
  verax

  # Smart mode with explicit URL
  verax --url https://example.com

  # Strict mode (CI-friendly, non-interactive)
  verax run --url https://example.com --src . --out .verax

  # Inspect previous run
  verax inspect .verax/runs/2026-01-11T00-59-12Z_4f2a9c

EXIT CODES:
  0   Success (tool executed)
  2   Internal crash
  64  Invalid CLI usage (missing args, invalid flags)
  65  Invalid input data (bad JSON, unreadable folder, etc.)

ARTIFACTS:
  Artifacts are written to: <out>/runs/<runId>/
  Required files:
    - run.status.json     Run status lifecycle
    - run.meta.json       Metadata about the run
    - summary.json        Summary of results
    - findings.json       Array of findings
    - traces.jsonl        JSONL traces of execution
    - evidence/           Directory for evidence files
`);
}

function parseArg(args, name) {
  const index = args.indexOf(name);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return null;
}

main().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(2);
});
