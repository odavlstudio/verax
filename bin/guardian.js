#!/usr/bin/env node

/**
 * ODAVL Guardian — Silent Failure Detector
 * CLI entry point
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

// Handle global --version
if (args.length === 1 && args[0] === '--version') {
  const packageJson = require('../package.json');
  let version = packageJson.version;
  // Try to get git SHA if in repo
  try {
    const gitDir = path.join(__dirname, '..', '.git');
    if (fs.existsSync(gitDir)) {
      const refHead = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf-8').trim();
      if (refHead.startsWith('ref: ')) {
        const refPath = path.join(gitDir, refHead.substring(5));
        if (fs.existsSync(refPath)) {
          const sha = fs.readFileSync(refPath, 'utf-8').trim().substring(0, 7);
          version += ` (${sha})`;
        }
      }
    }
  } catch {}
  console.log(version);
  process.exit(0);
}

// Handle debug:which
if (args.length === 1 && args[0] === 'debug:which') {
  const packageJson = require('../package.json');
  const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
  const executablePath = __filename;
  const cwd = process.cwd();
  console.log(`executable: ${executablePath}`);
  console.log(`packageJson: ${packageJsonPath}`);
  console.log(`name: ${packageJson.name}`);
  console.log(`version: ${packageJson.version}`);
  console.log(`node: ${process.version}`);
  console.log(`cwd: ${cwd}`);
  process.exit(0);
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

const { runSilentCLI } = require('../src/guardian/silent');

function parseArgs(argv) {
  const args = argv.slice(2);
  const subcommand = args[0];

  if (subcommand === 'silent') {
    return { subcommand: 'silent', config: parseSilentArgs(args.slice(1)) };
  }
  
  if (subcommand === 'explain') {
    return { subcommand: 'explain', failureId: args[1] || null };
  }
  
  if (subcommand === 'baseline:set') {
    let fromPath = null;
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--from' && args[i + 1]) {
        fromPath = args[i + 1];
        break;
      }
    }
    return { subcommand: 'baseline:set', fromPath };
  }
  
  if (subcommand === 'baseline:clear') {
    return { subcommand: 'baseline:clear' };
  }

  // Unknown command
  console.error(`Unknown command: ${subcommand}`);
  console.error('Run "guardian --help" for usage.');
  process.exit(2);
  return undefined;
}

function printGlobalHelp() {
  console.log(`
🛡️  ODAVL Guardian — Silent Failure Detector

Usage: guardian <command> [options]

COMMANDS:
  silent --url <URL>           Detect silent user failures
  explain <failure-id>         Explain a failure from latest run
  baseline:set --from <path>   Set baseline from results JSON
  baseline:clear               Clear baseline file

OPTIONS:
  --version                    Show version
  --help, -h                   Show help

Run 'guardian <command> --help' for detailed command help.
`);
}

function parseSilentArgs(args) {
  const config = {
    baseUrl: undefined,
    mode: undefined,
    baseline: undefined,
    diff: false,
    confirmHigh: false,
    profile: undefined
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--url' && args[i + 1]) {
      config.baseUrl = args[i + 1];
      i++;
    } else if (a === '--mode' && args[i + 1]) {
      const modeValue = args[i + 1];
      if (modeValue === 'warn' || modeValue === 'block') {
        config.mode = modeValue;
      } else {
        console.error(`Error: --mode must be 'warn' or 'block', got '${modeValue}'`);
        printHelpSilent();
        process.exit(2);
      }
      i++;
    } else if (a === '--baseline' && args[i + 1]) {
      config.baseline = args[i + 1];
      config.diff = true; // If baseline provided, diff is implied
      i++;
    } else if (a === '--diff') {
      config.diff = true;
    } else if (a === '--confirm-high') {
      config.confirmHigh = true;
    } else if (a === '--profile' && args[i + 1]) {
      const profileValue = args[i + 1];
      if (profileValue === 'fast' || profileValue === 'balanced' || profileValue === 'deep') {
        config.profile = profileValue;
      } else {
        console.error(`Error: --profile must be 'fast', 'balanced', or 'deep', got '${profileValue}'`);
        printHelpSilent();
        process.exit(2);
      }
      i++;
    } else if (a === '--help' || a === '-h') {
      printHelpSilent();
      process.exit(0);
    }
  }

  if (!config.baseUrl) {
    console.error('Error: --url is required');
    printHelpSilent();
    process.exit(2);
  }

  // Determine default mode: CI => warn, non-CI => block
  if (!config.mode) {
    const isCI = process.env.CI === 'true' || !!process.env.CI;
    config.mode = isCI ? 'warn' : 'block';
  }

  return config;
}

function printHelpSilent() {
  console.log(`
Usage: guardian silent --url <url> [options]

Detect silent user failures on a website.

OPTIONS:
  --url <url>           Target URL to analyze (required)
  --mode <warn|block>   Operating mode:
                        - warn: Warning-only signal mode (non-blocking, default in CI)
                        - block: Blocking mode (breaks pipelines on failures, default locally)
  --profile <fast|balanced|deep>  Test profile (default: balanced, fast in CI+warn)
  --baseline <path>     Path to baseline JSON file (previous silent-results.json)
  --diff                Enable diff output (implied if --baseline is provided)
  --confirm-high        Re-test HIGH severity failures to confirm (block mode only)

EXAMPLES:
  guardian silent --url https://example.com
  guardian silent --url https://github.com --mode warn
  guardian silent --url https://github.com --mode block

DESCRIPTION:
  Analyzes the target URL for silent user failures:
  - CTA button clicks that produce no effect
  - Navigation links that fail to navigate
  - Form submissions with no feedback
  - UI toggles that don't change content

  Results are sorted by severity (HIGH/MEDIUM/LOW) and
  saved to a run directory with screenshots and JSON report.

  Output includes Confidence level and Next Action guidance.
  In warn mode, failures do not fail CI (non-blocking signal mode).

  Default mode: 'warn' in CI environments, 'block' in local development.
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

  // Parse arguments (which handles subcommand routing)
  const parsed = parseArgs(process.argv);
  const config = parsed.config;

  // Determine which mode to run
  if (parsed.subcommand === 'silent') {
    const result = await runSilentCLI(config);
    process.exit(result.exitCode);
  } else if (parsed.subcommand === 'explain') {
    const { explainFailure } = require('../src/guardian/explain');
    if (!parsed.failureId) {
      console.error('Error: failure-id is required');
      console.error('Usage: guardian explain <failure-id>');
      process.exit(2);
    }
    await explainFailure(parsed.failureId);
    process.exit(0);
  } else if (parsed.subcommand === 'baseline:set') {
    const { setBaseline } = require('../src/guardian/baseline-manager');
    setBaseline(parsed.fromPath);
    process.exit(0);
  } else if (parsed.subcommand === 'baseline:clear') {
    const { clearBaseline } = require('../src/guardian/baseline-manager');
    clearBaseline();
    process.exit(0);
  } else {
    console.error(`Unknown command: ${parsed.subcommand}`);
    console.error('Run "guardian --help" for usage.');
    process.exit(2);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
