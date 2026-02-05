#!/usr/bin/env node
/**
 * Generate a reproducible, committable proof-pack snapshot for a specific release version.
 *
 * This is preservation/release-hygiene only. It does not change runtime behavior.
 *
 * Usage:
 *   node scripts/generate-proof-pack.js 0.4.9
 *   node scripts/generate-proof-pack.js 0.4.9 --force
 */

import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import {
  mkdirSync,
  existsSync,
  readdirSync,
  rmSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, join, resolve, relative } from 'path';
import { fileURLToPath } from 'url';
import { startFixtureServer } from '../test/helpers/fixture-server.helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { version: null, force: false };
  for (const a of args) {
    if (a === '--force') out.force = true;
    else if (!out.version) out.version = a;
  }
  return out;
}

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function sh(cmd, args, options = {}) {
  const okExitCodes = Array.isArray(options.okExitCodes) ? options.okExitCodes : [0];
  const proc = spawnSync(cmd, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    windowsHide: true,
    ...options,
  });
  const stdout = String(proc.stdout || '');
  const stderr = String(proc.stderr || '');
  if (proc.error) {
    throw new Error(`${cmd} failed: ${proc.error.message}`);
  }
  const status = typeof proc.status === 'number' ? proc.status : 0;
  if (!okExitCodes.includes(status)) {
    throw new Error(
      `${cmd} ${args.join(' ')} failed (exit ${status}).\n` +
        (stderr.trim() ? `stderr:\n${stderr}` : '') +
        (stdout.trim() ? `\nstdout:\n${stdout}` : '')
    );
  }
  return { stdout, stderr, status };
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listFilesRec(dir) {
  /** @type {string[]} */
  const out = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...listFilesRec(full));
    else if (e.isFile()) out.push(full);
  }
  return out;
}

/**
 * @param {string} path
 * @returns {string}
 */
function sha256File(path) {
  const buf = /** @type {Buffer} */ (readFileSync(path));
  return /** @type {string} */ (createHash('sha256').update(buf).digest('hex'));
}

function isTextish(path) {
  const lower = path.toLowerCase();
  return (
    lower.endsWith('.json') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.md') ||
    lower.endsWith('.yml') ||
    lower.endsWith('.yaml') ||
    lower.endsWith('.jsonl') ||
    lower.endsWith('.js') ||
    lower.endsWith('.ts')
  );
}

function assertNoSensitivePaths(outDir) {
  const files = listFilesRec(outDir).filter(isTextish);
  const patterns = [
    /[A-Z]:\\Users\\/i, // Windows home paths
    /\/Users\//, // macOS home paths
    /\/home\//, // Linux home paths
  ];

  for (const f of files) {
    const text = String(readFileSync(f, 'utf8'));
    for (const p of patterns) {
      if (p.test(text)) {
        const rel = relative(projectRoot, f).replace(/\\/g, '/');
        throw new Error(`Sensitive local path detected in ${rel}`);
      }
    }
  }
}

function redactLocalPaths(text) {
  let out = String(text || '');
  // Replace this repo's absolute path first.
  out = out.replaceAll(projectRoot, '<PROJECT_ROOT>');
  out = out.replaceAll(projectRoot.replace(/\\/g, '/'), '<PROJECT_ROOT>');

  // Defensive fallback for any remaining home paths.
  out = out.replace(/[A-Z]:\\Users\\[^\\]+/gi, '<USER_HOME>');
  out = out.replace(/\/Users\/[^/]+/g, '<USER_HOME>');
  out = out.replace(/\/home\/[^/]+/g, '<USER_HOME>');
  return out;
}

async function main() {
  const { version, force } = parseArgs(process.argv);
  const pkg = JSON.parse(String(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')));
  const targetVersion = version || pkg.version;

  if (targetVersion !== pkg.version) {
    fail(`Version mismatch: package.json=${pkg.version} but requested=${targetVersion}`);
  }

  const outDir = resolve(projectRoot, 'proof-pack', `v${targetVersion}-final`);
  const fixedTime = '2026-02-05T00:00:00.000Z';

  if (existsSync(outDir)) {
    const hasContents =
      readdirSync(outDir).filter((name) => name !== '.gitkeep').length > 0;
    if (hasContents && !force) {
      fail(`Output directory already exists and is non-empty: ${outDir} (use --force to overwrite)`);
    }
    if (force) rmSync(outDir, { recursive: true, force: true });
  }

  mkdirSync(outDir, { recursive: true });

  const gitSha = sh('git', ['rev-parse', 'HEAD']).stdout.trim();

  const env = {
    ...process.env,
    VERAX_TEST_TIME: fixedTime,
    VERAX_DETERMINISTIC_MODE: '1',
    // Ensure deterministic output location does not escape projectRoot.
    VERAX_OUT_BASE: resolve(projectRoot, 'proof-pack', '_out-base'),
  };

  const fixtureDir = resolve(projectRoot, 'test', 'fixtures', 'static-buttons');
  const fixtureServer = await startFixtureServer(fixtureDir, 0);
  const url = `${fixtureServer.url}/index.html`;

  try {
    const commands = [];

    const capDefaultOut = resolve(outDir, 'artifacts', 'pilot', 'capability-bundle.default');
    mkdirSync(capDefaultOut, { recursive: true });
    commands.push(
      `VERAX_TEST_TIME=${fixedTime} VERAX_DETERMINISTIC_MODE=1 node bin/verax.js capability-bundle --url ${url} --out ${relative(projectRoot, capDefaultOut)} --timeout-ms 15000`
    );
    sh(
      process.execPath,
      ['bin/verax.js', 'capability-bundle', '--url', url, '--out', capDefaultOut, '--timeout-ms', '15000'],
      { env }
    );

    const capAnonOut = resolve(outDir, 'artifacts', 'pilot', 'capability-bundle.anonymize-host');
    mkdirSync(capAnonOut, { recursive: true });
    commands.push(
      `VERAX_TEST_TIME=${fixedTime} VERAX_DETERMINISTIC_MODE=1 node bin/verax.js capability-bundle --url ${url} --out ${relative(projectRoot, capAnonOut)} --timeout-ms 15000 --anonymize-host`
    );
    sh(
      process.execPath,
      [
        'bin/verax.js',
        'capability-bundle',
        '--url',
        url,
        '--out',
        capAnonOut,
        '--timeout-ms',
        '15000',
        '--anonymize-host',
      ],
      { env }
    );

    const runBundleOut = resolve(outDir, 'artifacts', 'bundles', 'run-bundle');
    mkdirSync(runBundleOut, { recursive: true });
    commands.push(
      `VERAX_TEST_TIME=${fixedTime} VERAX_DETERMINISTIC_MODE=1 node bin/verax.js run --url ${url} --src test/fixtures/static-buttons --out ${relative(projectRoot, runBundleOut)}`
    );
    const runResult = sh(
      process.execPath,
      ['bin/verax.js', 'run', '--url', url, '--src', fixtureDir, '--out', runBundleOut],
      { env, okExitCodes: [0, 20, 30] }
    );

    // Record the run command output for auditing.
    writeFileSync(
      resolve(outDir, 'artifacts', 'bundles', 'run-bundle.stdout.txt'),
      redactLocalPaths(runResult.stdout),
      'utf8'
    );

    assertNoSensitivePaths(outDir);

    const files = listFilesRec(outDir)
      .map((p) => relative(outDir, p).replace(/\\/g, '/'))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    /** @type {Record<string, {sha256: string, bytes: number}>} */
    const integrity = {};
    for (const relPath of files) {
      const abs = resolve(outDir, relPath);
      const st = statSync(abs);
      integrity[relPath] = { sha256: sha256File(abs), bytes: st.size };
    }

    const manifest = {
      proofPackVersion: `v${targetVersion}-final`,
      version: targetVersion,
      gitSha,
      generatedAt: fixedTime,
      env: { VERAX_TEST_TIME: fixedTime, VERAX_DETERMINISTIC_MODE: '1' },
      fixture: { dir: relative(projectRoot, fixtureDir).replace(/\\/g, '/'), url },
      commands,
      integrity,
    };

    writeFileSync(resolve(outDir, 'PROOF_PACK.manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

    console.log(`✅ Proof-pack generated at: ${relative(projectRoot, outDir)}`);
  } finally {
    await fixtureServer.close();
  }
}

main().catch((e) => {
  console.error(`❌ Proof-pack generation failed: ${e?.message || e}`);
  process.exit(1);
});
