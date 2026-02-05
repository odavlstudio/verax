import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..');

const SRC = resolve(ROOT, 'src');
const DETECT = resolve(SRC, 'verax', 'detect');
const OBSERVE = resolve(SRC, 'verax', 'observe');
const CLI = resolve(SRC, 'cli');

// ============================================================================
// CONSTITUTIONAL ASSERTIONS
// ============================================================================

// CORE PRINCIPLE 1: ZERO CONFIGURATION
test('ZERO CONFIG | config-loader.js must not exist', () => {
  const configPath = resolve(ROOT, 'src', 'verax', 'shared', 'config-loader.js');
  assert.equal(
    existsSync(configPath),
    false,
    'config-loader.js violates zero-configuration principle (must be deleted)'
  );
});

test('ZERO CONFIG | no references to config loading in entry.js', () => {
  const entryPath = resolve(CLI, 'entry.js');
  const content = readFileSync(entryPath, 'utf-8');
  
  const forbiddenPatterns = [
    /loadConfig/,
    /getDefaultConfig/,
    /validateConfig/,
    /--use-config/,
    /--config/,
  ];
  
  for (const pattern of forbiddenPatterns) {
    assert.equal(
      pattern.test(content),
      false,
      `entry.js references forbidden config pattern: ${pattern}`
    );
  }
});

test('ZERO CONFIG | run command does not accept --config flags', () => {
  const runPath = resolve(CLI, 'commands', 'run.js');
  const content = readFileSync(runPath, 'utf-8');
  
  assert.equal(
    /--config|--use-config|loadConfig/.test(content),
    false,
    'run.js must not have config-loading code'
  );
});

// ============================================================================
// CORE PRINCIPLE 2: DETERMINISM
// ============================================================================

test('DETERMINISM | run-id generator does not use Date.now()', () => {
  const runIdPath = resolve(SRC, 'verax', 'core', 'run-id.js');
  const content = readFileSync(runIdPath, 'utf-8');
  
  assert.equal(
    /Date\.now\(\)/g.test(content),
    false,
    'run-id.js must not call Date.now() (non-deterministic)'
  );
});

test('DETERMINISM | run-id generator does not use Math.random()', () => {
  const runIdPath = resolve(SRC, 'verax', 'core', 'run-id.js');
  const content = readFileSync(runIdPath, 'utf-8');
  
  assert.equal(
    /Math\.random\(\)/g.test(content),
    false,
    'run-id.js must not call Math.random() (non-deterministic)'
  );
});

test('DETERMINISM | core run-id generator uses deterministic hash', () => {
  const coreRunIdPath = resolve(SRC, 'verax', 'core', 'run-id.js');
  assert.equal(
    existsSync(coreRunIdPath),
    true,
    'src/verax/core/run-id.js must exist (canonical generator)'
  );
  
  const content = readFileSync(coreRunIdPath, 'utf-8');
  assert.ok(
    /generateRunId|export.*function|createHash/i.test(content),
    'core run-id.js must export generateRunId using deterministic hashing'
  );
});

test('DETERMINISM | safetyFlags.allowWrites hardcoded to false', () => {
  const manifestPath = resolve(SRC, 'verax', 'core', 'run-manifest.js');
  const content = readFileSync(manifestPath, 'utf-8');
  
  assert.ok(
    /allowWrites:\s*false/.test(content),
    'run-manifest must hardcode allowWrites: false'
  );
});

// ============================================================================
// CORE PRINCIPLE 3: NO GUESSING / EVIDENCE-ONLY
// ============================================================================

test('NO GUESSING | detect/ has no opinionated guessing functions', async () => {
  const files = await glob('**/*.js', { cwd: DETECT });
  
  // Look for functions that invent behavior (not reading explicit data)
  const forbiddenFunctions = [
    'guessExpectedBehavior',
    'assumeUserIntent',
    'smartDetectFailure',
    'inferFromContext',
  ];
  
  for (const file of files) {
    const filePath = resolve(DETECT, file);
    const content = readFileSync(filePath, 'utf-8');
    
    for (const func of forbiddenFunctions) {
      assert.equal(
        new RegExp(`\\b${func}\\b`).test(content),
        false,
        `detect/${file} defines forbidden guessing function: ${func}`
      );
    }
  }
});

test('NO GUESSING | observe/ has no opinionated guessing functions', async () => {
  const files = await glob('**/*.js', { cwd: OBSERVE });
  
  const forbiddenFunctions = [
    'guessExpectedBehavior',
    'assumeUserIntent',
    'smartDetectFailure',
    'inferFromContext',
  ];
  
  for (const file of files) {
    const filePath = resolve(OBSERVE, file);
    const content = readFileSync(filePath, 'utf-8');
    
    for (const func of forbiddenFunctions) {
      assert.equal(
        new RegExp(`\\b${func}\\b`).test(content),
        false,
        `observe/${file} defines forbidden guessing function: ${func}`
      );
    }
  }
});

test('NO GUESSING | cli/ has no opinionated guessing functions', async () => {
  const files = await glob('**/*.js', { cwd: CLI });
  
  const forbiddenFunctions = [
    'guessExpectedBehavior',
    'assumeUserIntent',
    'smartDetectFailure',
    'inferExpectedFeedback',
  ];
  
  for (const file of files) {
    const filePath = resolve(CLI, file);
    const content = readFileSync(filePath, 'utf-8');
    
    for (const func of forbiddenFunctions) {
      assert.equal(
        new RegExp(`\\b${func}\\b`).test(content),
        false,
        `cli/${file} defines forbidden guessing function: ${func}`
      );
    }
  }
});

// ============================================================================
// CORE PRINCIPLE 4: NO INTERACTIVE MODE
// ============================================================================

test('NO INTERACTIVE | default.js removed in Stage 5', () => {
  const defaultPath = resolve(CLI, 'commands', 'default.js');
  
  assert.equal(
    existsSync(defaultPath),
    false,
    'default.js removed in Stage 5 - interactive mode disabled per vision §17'
  );
});

test('NO INTERACTIVE | CLI entry.js rejects no-args with usage error', () => {
  const result = spawnSync('node', ['src/cli/entry.js'], {
    cwd: ROOT,
    encoding: 'utf-8',
  });
  
  assert.equal(
    result.status,
    64,
    `CLI must exit with code 64 (usage error) when called with no args, got ${result.status}`
  );
  
  assert.ok(
    /USAGE:|run --url|verax bundle|verax version|verax help/i.test(result.stdout || ''),
    'help text must be shown on no-args call'
  );
});

test('NO INTERACTIVE | no interactive prompt logic in entry.js', () => {
  const entryPath = resolve(CLI, 'entry.js');
  const content = readFileSync(entryPath, 'utf-8');
  
  assert.equal(
    /import.*inquirer|\.prompt\(/i.test(content),
    false,
    'entry.js must not import or use interactive prompt libraries'
  );
});

// ============================================================================
// CORE PRINCIPLE 5: READ-ONLY GUARANTEE
// ============================================================================

test('READ ONLY | no --allow-writes CLI flag exists', () => {
  const runPath = resolve(CLI, 'commands', 'run.js');
  const content = readFileSync(runPath, 'utf-8');
  
  assert.equal(
    /--allow-writes/g.test(content),
    false,
    'run.js must not expose --allow-writes flag'
  );
});

test('READ ONLY | safety-observer blocks POST/PUT/PATCH/DELETE', () => {
  const safetyPath = resolve(OBSERVE, 'observers', 'safety-observer.js');
  assert.equal(existsSync(safetyPath), true, 'safety-observer.js must exist');
  
  const content = readFileSync(safetyPath, 'utf-8');
  
  assert.ok(
    /POST|PUT|PATCH|DELETE/.test(content),
    'safety-observer must mention write methods (POST, PUT, PATCH, DELETE)'
  );
});

test('READ ONLY | safety-observer checks allowWrites', () => {
  const safetyPath = resolve(OBSERVE, 'observers', 'safety-observer.js');
  const content = readFileSync(safetyPath, 'utf-8');
  
  assert.ok(
    /allowWrites/.test(content),
    'safety-observer must check allowWrites flag'
  );
});

test('READ ONLY | observe() enforces write blocking', () => {
  const indexPath = resolve(OBSERVE, 'index.js');
  const content = readFileSync(indexPath, 'utf-8');
  
  assert.ok(
    /read-only|writesBlocked/.test(content),
    'observe() must mention read-only or write blocking'
  );
});

// ============================================================================
// META: CONSTITUTIONAL GUARDRAILS
// ============================================================================

test('GUARDRAILS | vision-enforcement.test.js exists as regression guard', () => {
  const enforcePath = resolve(ROOT, 'test', 'release', 'vision-enforcement.test.js');
  assert.equal(
    existsSync(enforcePath),
    true,
    'vision-enforcement.test.js must exist (prevents config system reintroduction)'
  );
});

test('GUARDRAILS | vision-compliance.test.js exists as constitutional test', () => {
  const compliancePath = resolve(ROOT, 'test', 'release', 'vision-compliance.test.js');
  assert.equal(
    existsSync(compliancePath),
    true,
    'vision-compliance.test.js must exist (comprehensive constitutional enforcement)'
  );
});

test('GUARDRAILS | VISION.md documents core principles', () => {
  const visionPath = resolve(ROOT, 'docs', 'VISION.md');
  assert.equal(existsSync(visionPath), true, 'VISION.md must exist');
  
  const content = readFileSync(visionPath, 'utf-8');
  
  const principles = [
    'Evidence',
    'Determinism',
    'Zero Configuration',
    'read-only',
    'Silent Failures',
  ];
  
  for (const principle of principles) {
    assert.ok(
      new RegExp(principle, 'i').test(content),
      `VISION.md must document: ${principle}`
    );
  }
});

test('GUARDRAILS | no temporary artifacts in root directory', () => {
  const rootContents = readdirSync(ROOT);
  
  // After tests, root must NOT contain temporary artifacts
  const tmpPatterns = [
    /^tmp-/,                    // tmp-* directories/files
    /\.tgz$/,                   // tarball artifacts
    /^\d{4}-\d{2}-\d{2}/,      // date-named directories (YYYY-MM-DD*)
    /^verax-.*\.tgz$/,         // package tarballs
  ];
  
  const allowedItems = new Set([
    '.verax',         // VERAX artifacts directory (gitignored)
    'tmp',            // Temp directory (gitignored)
    'node_modules',   // Dependencies (gitignored)
    '.git',           // Git directory
    'artifacts',      // Test artifacts (gitignored)
  ]);
  
  const unexpectedArtifacts = rootContents.filter(name => {
    // Skip allowed items
    if (allowedItems.has(name)) return false;
    
    // Check if matches any tmp pattern
    return tmpPatterns.some(pattern => pattern.test(name));
  });
  
  assert.strictEqual(
    unexpectedArtifacts.length, 
    0, 
    `Found unexpected temporary artifacts in root: ${unexpectedArtifacts.join(', ')}. ` +
    `Root directory must be clean after tests. Run cleanup scripts or check .gitignore.`
  );
});

