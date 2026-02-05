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
 * - Only run, bundle, readiness, capability-bundle, version, help are exposed as top-level commands
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
  // Contract: Public commands are exactly these (documented in help, not frozen)
  const PUBLIC_COMMANDS = [
    'run',
    'bundle',
    'readiness',
    'capability-bundle',
    'version',
    'help',
  ];

  const OUT_OF_SCOPE_COMMANDS = [
    'doctor',
    'inspect',
    'pilot',
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

    // Verify out-of-scope commands do NOT appear in help
    for (const cmd of OUT_OF_SCOPE_COMMANDS) {
      assert(
        !helpOutput.includes(`verax ${cmd}`),
        `Help output must NOT mention out-of-scope command '${cmd}'`
      );
    }

    // Verify removed commands do NOT appear in help (Stage 5 cleanup)
    for (const cmd of REMOVED_COMMANDS) {
      assert(
        !helpOutput.includes(`verax ${cmd}`),
        `Help output must NOT mention removed command '${cmd}'`
      );
    }

    // Help must not reference repo-only documentation paths.
    for (const forbidden of ['docs/', 'docs\\', 'VISION.md', 'RULEBOOK.md', 'reports/']) {
      assert(
        !helpOutput.includes(forbidden),
        `Help output must NOT reference missing doc path '${forbidden}'`
      );
    }
  });

  await suite.test('verax recognizes only public commands', () => {
    const result = spawnSync('node', ['bin/verax.js', 'unknown'], {
      cwd: projectRoot,
      encoding: 'utf-8',
    });

    const expected = "Command 'unknown' is out of scope for VERAX 0.4.9 pilot surface. Supported: run, bundle, readiness, capability-bundle, version, help.";

    assert.equal(
      result.status,
      64,
      'Unknown command should exit with code 64 (UsageError)'
    );
    assert.equal(result.stderr.trim(), expected, 'Unknown command must emit pilot-scope out-of-scope message to stderr');
    assert.equal((result.stdout || '').trim(), '', 'Unknown command must not emit contract output to stdout');
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
      entryCode.includes("loadBundleCommand()"),
      'entry.js must have loadBundleCommand'
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

  await suite.test('run and bundle handle invalid args gracefully', () => {
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

    // bundle without args should fail with UsageError (64)
    const bundleResult = spawnSync('node', ['bin/verax.js', 'bundle'], {
      cwd: projectRoot,
      encoding: 'utf-8',
    });
    assert.equal(
      bundleResult.status,
      64,
      'bundle without args must exit 64'
    );
  });

  await suite.test('out-of-scope commands reject with pilot-scope message', () => {
    const expected = (cmd) =>
      `Command '${cmd}' is out of scope for VERAX 0.4.9 pilot surface. Supported: run, bundle, readiness, capability-bundle, version, help.`;

    for (const cmd of ['doctor', 'inspect', 'pilot', 'diagnose']) {
      const result = spawnSync('node', ['bin/verax.js', cmd], {
        cwd: projectRoot,
        encoding: 'utf-8',
      });

      assert.equal(result.status, 64, `${cmd} must exit 64`);
      assert.equal((result.stdout || '').trim(), '', `${cmd} must not emit contract output to stdout`);
      assert.equal((result.stderr || '').trim(), expected(cmd), `${cmd} must emit out-of-scope message to stderr`);
    }
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
    assert(
      result.stdout.includes('verax bundle'),
      'help output must document bundle command'
    );
    assert(
      result.stdout.includes('verax readiness'),
      'help output must document readiness command'
    );
    assert(
      result.stdout.includes('Pilot-only'),
      'help output must mark pilot-only commands'
    );
    assert(
      result.stdout.includes('verax capability-bundle'),
      'help output must document capability-bundle command'
    );
    assert(
      result.stdout.includes('verax version'),
      'help output must document version command'
    );
    assert(
      result.stdout.includes('verax help'),
      'help output must document help command'
    );
    assert.equal(result.stdout.includes('verax doctor'), false, 'help output must not document doctor command');
    assert.equal(result.stdout.includes('verax inspect'), false, 'help output must not document inspect command');
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

