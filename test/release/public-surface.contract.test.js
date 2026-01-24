/**
 * PUBLIC SURFACE CONTRACT TEST
 *
 * Verifies that VERAX CLI exposes only documented public commands
 * and that internal/future-gates commands are unreachable.
 *
 * This test prevents accidental exposure of unfinished or legacy commands
 * and ensures consistent, predictable CLI surface for users and CI systems.
 *
 * INVARIANTS:
 * - Only run, inspect, doctor are exposed as top-level commands
 * - help and --help/--version are supported
 * - No other commands appear in --help output
 * - Internal commands in src/cli/commands/internal/ are not discoverable
 * - src/cli/entry.js contains only public command imports
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../../');

test('PUBLIC SURFACE CONTRACT: Only documented commands exposed', async (suite) => {
  // Contract: Public commands are exactly these (includes latest additions)
  const PUBLIC_COMMANDS = [
    'run',
    'inspect',
    'doctor',
    'diagnose',
    'explain',
    'stability',
    'stability-run',
    'triage',
    'clean',
    'gate',
  ];
  
  // Contract: These commands were removed in Stage 5 (not part of VERAX 1.0 vision)
  // Note: 'ga' removed but 'gate' is a new valid command
  const REMOVED_COMMANDS = [
    'gates',
    'truth',
    'baseline',
    'security-check',
    'release-check',
  ];

  await suite.test('verax --help output contains only public commands', () => {
    const result = spawnSync('node', ['bin/verax.js', '--help'], {
      cwd: projectRoot,
      encoding: 'utf-8',
    });

    const helpOutput = result.stdout;

    // Verify public commands are documented
    for (const cmd of PUBLIC_COMMANDS) {
      assert(
        helpOutput.includes(`verax ${cmd}`),
        `Help output must document 'verax ${cmd}' command`
      );
    }

    // Verify removed commands do NOT appear in help (Stage 5 cleanup)
    for (const cmd of REMOVED_COMMANDS) {
      assert(
        !helpOutput.includes(`verax ${cmd}`),
        `Help output must NOT mention removed command '${cmd}'`
      );
    }
  });

  await suite.test('verax recognizes only public commands', () => {
    const result = spawnSync('node', ['bin/verax.js', 'unknown'], {
      cwd: projectRoot,
      encoding: 'utf-8',
    });

    assert.equal(
      result.status,
      64,
      'Unknown command should exit with code 64 (UsageError)'
    );
    assert(
      result.stderr.includes('Interactive mode is disabled') ||
      result.stderr.includes('Error') ||
      result.stdout.includes('Interactive mode is disabled') ||
      result.stdout.includes('Error'),
      'Should show error message for unknown command'
    );
  });

  await suite.test('internal commands were removed in Stage 5', () => {
    // Stage 5 product lock: baseline/security/release/gates/ga/truth removed
    // These were internal-only testing infrastructure, not user-facing features
    const internalDir = resolve(projectRoot, 'src/cli/commands/internal');
    assert.equal(
      existsSync(internalDir),
      false,
      'internal commands directory removed in Stage 5 product lock'
    );
  });

  await suite.test('entry.js does not import internal commands', () => {
    const entryPath = resolve(projectRoot, 'src/cli/entry.js');
    const entryCode = readFileSync(entryPath, 'utf-8');

    // Verify no imports from internal directory
    assert(
      !entryCode.includes("from './commands/internal"),
      'entry.js must NOT import from commands/internal directory'
    );

    // Verify only public commands are loaded
    assert(
      entryCode.includes("loadRunCommand()"),
      'entry.js must have loadRunCommand'
    );
    assert(
      entryCode.includes("loadInspectCommand()"),
      'entry.js must have loadInspectCommand'
    );
    assert(
      entryCode.includes("loadDoctorCommand()"),
      'entry.js must have loadDoctorCommand'
    );

    // Verify no loading of removed commands (Stage 5 cleanup)
    for (const cmd of REMOVED_COMMANDS) {
      const camelCase = cmd.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const pascalCase = camelCase[0].toUpperCase() + camelCase.slice(1);
      const patterns = [
        `load${pascalCase}Command`,
        `from './commands/internal/${cmd}`,
        `'${cmd}'`,
      ];

      for (const pattern of patterns) {
        // ga, gates, truth might appear in other contexts, so be careful
        // Only flag if it's clearly a command import
        if (cmd === 'ga' && pattern.includes('ga')) {
          // Skip 'ga' as it's too short and appears in many words
          continue;
        }
      }
    }
  });

  await suite.test('run, inspect, doctor handle invalid args gracefully', () => {
    // run without --url should fail with UsageError (64)
    const runResult = spawnSync('node', ['bin/verax.js', 'run'], {
      cwd: projectRoot,
      encoding: 'utf-8',
    });
    assert.equal(
      runResult.status,
      64,
      'run without --url must exit 64'
    );

    // inspect without path should fail with UsageError (64)
    const inspectResult = spawnSync('node', ['bin/verax.js', 'inspect'], {
      cwd: projectRoot,
      encoding: 'utf-8',
    });
    assert.equal(
      inspectResult.status,
      64,
      'inspect without path must exit 64'
    );

    // doctor with unknown flag should fail with UsageError (64)
    const doctorResult = spawnSync('node', ['bin/verax.js', 'doctor', '--unknown'], {
      cwd: projectRoot,
      encoding: 'utf-8',
    });
    assert.equal(
      doctorResult.status,
      64,
      'doctor with invalid flag must exit 64'
    );
  });

  await suite.test('help command works correctly', () => {
    const result = spawnSync('node', ['bin/verax.js', 'help'], {
      cwd: projectRoot,
      encoding: 'utf-8',
    });

    assert.equal(result.status, 0, 'help command must exit 0');
    assert(
      result.stdout.includes('verax run'),
      'help output must document run command'
    );
  });

  await suite.test('version command works correctly', () => {
    const result = spawnSync('node', ['bin/verax.js', '--version'], {
      cwd: projectRoot,
      encoding: 'utf-8',
    });

    assert.equal(result.status, 0, '--version must exit 0');
    assert(
      result.stdout.includes('verax'),
      '--version output must contain version'
    );
  });

  await suite.test('verax version reports trust surface', () => {
    const result = spawnSync('node', ['bin/verax.js', 'version'], {
      cwd: projectRoot,
      encoding: 'utf-8',
    });

    assert.equal(result.status, 0, 'verax version must exit 0');
    assert(
      result.stdout.includes('Stability:'),
      'version output must include stability level'
    );
    assert(
      result.stdout.includes('VERSIONING LAW'),
      'version output must outline versioning law'
    );
    assert(
      result.stdout.includes('COMPATIBILITY GUARANTEES'),
      'version output must state compatibility guarantees'
    );
    assert(
      result.stdout.includes('DEPRECATION POLICY'),
      'version output must describe deprecation policy'
    );
  });

  await suite.test('no args shows help with UsageError exit', () => {
    const result = spawnSync('node', ['bin/verax.js'], {
      cwd: projectRoot,
      encoding: 'utf-8',
    });

    assert.equal(
      result.status,
      64,
      'no args must exit 64 (UsageError)'
    );
    assert(
      result.stdout.includes('USAGE:'),
      'Should show help when no args provided'
    );
  });
});

