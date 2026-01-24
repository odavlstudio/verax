#!/usr/bin/env node
/**
 * Pre-Publish Validation Script
 * 
 * Ensures release discipline before publishing to npm.
 * Run automatically via package.json prepublishOnly hook.
 * 
 * Validation Rules:
 * 1. Version bumped since last git tag
 * 2. Changelog updated for new version
 * 3. All tests passing
 * 4. No dirty working tree (uncommitted changes)
 * 5. Version in package.json matches src/version.js
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(msg, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

function error(msg) {
  log(`❌ ${msg}`, RED);
}

function success(msg) {
  log(`✅ ${msg}`, GREEN);
}

function warn(msg) {
  log(`⚠️  ${msg}`, YELLOW);
}

function fatal(msg) {
  error(msg);
  process.exit(1);
}

function parseSemver(version) {
  const parts = version.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n) || n < 0)) {
    fatal(`Invalid semver: ${version}`);
  }
  return { major: parts[0], minor: parts[1], patch: parts[2] };
}

function inferBumpType(currentVersion, previousVersion) {
  if (!previousVersion) {
    return null; // First entry, nothing to compare
  }
  const current = parseSemver(currentVersion);
  const previous = parseSemver(previousVersion);
  if (current.major > previous.major) return 'major';
  if (current.major === previous.major && current.minor > previous.minor) return 'minor';
  if (
    current.major === previous.major &&
    current.minor === previous.minor &&
    current.patch > previous.patch
  ) return 'patch';
  fatal(`Version is not greater than previous entry. Current: ${currentVersion}, Previous: ${previousVersion}`);
  return null;
}

function assertRequiredFields(entry, version) {
  const required = ['version', 'date', 'type', 'breakingChanges', 'improvements', 'fixes', 'guarantees'];
  const missing = required.filter((field) => !(field in entry));
  if (missing.length > 0) {
    fatal(`Changelog entry for ${version} missing required fields: ${missing.join(', ')}`);
  }
  if (!['major', 'minor', 'patch'].includes(entry.type)) {
    fatal(`Changelog entry for ${version} has invalid type: ${entry.type}`);
  }
  if (!Array.isArray(entry.breakingChanges)) {
    fatal(`Changelog entry for ${version} must have breakingChanges as an array`);
  }
  if (!Array.isArray(entry.improvements)) {
    fatal(`Changelog entry for ${version} must have improvements as an array`);
  }
  if (!Array.isArray(entry.fixes)) {
    fatal(`Changelog entry for ${version} must have fixes as an array`);
  }
  if (typeof entry.guarantees !== 'object' || entry.guarantees === null) {
    fatal(`Changelog entry for ${version} must include guarantees object describing what stayed stable`);
  }
}

function assertMarkdownEntry(version, expectedType) {
  const changelogMdPath = resolve(__dirname, '../CHANGELOG.md');
  if (!existsSync(changelogMdPath)) {
    fatal('CHANGELOG.md not found');
  }

    const content = readFileSync(changelogMdPath, 'utf-8').toString();
  const escapedVersion = version.replace(/\./g, '\\.');
  const headingRegex = new RegExp(`^## \\[${escapedVersion}\\] - \\d{4}-\\d{2}-\\d{2} \\((major|minor|patch)\\)`, 'm');
  const match = content.match(headingRegex);
  if (!match) {
    fatal(`CHANGELOG.md missing entry for ${version} with type metadata (major|minor|patch)`);
  }

  const markdownType = match[1];
  if (expectedType && markdownType !== expectedType) {
    fatal(`CHANGELOG.md type mismatch for ${version}. Expected ${expectedType}, found ${markdownType}`);
  }

  const startIndex = match.index ?? content.indexOf(match[0]);
  const nextIndex = content.indexOf('\n## [', startIndex + 1);
  const entryBlock = nextIndex === -1 ? content.slice(startIndex) : content.slice(startIndex, nextIndex);

  ['### Breaking Changes', '### Improvements', '### Fixes', '### Guarantees'].forEach((heading) => {
    if (!entryBlock.includes(heading)) {
      fatal(`CHANGELOG.md entry for ${version} missing required section: ${heading}`);
    }
  });
}

/**
 * Check 1: Version consistency between package.json and src/version.js
 */
function checkVersionConsistency() {
  log('\n[1/5] Checking version consistency...', YELLOW);
  
  const pkgPath = resolve(__dirname, '../package.json');
  const versionPath = resolve(__dirname, '../src/version.js');
  
  if (!existsSync(pkgPath)) {
    fatal('package.json not found');
  }
  
  if (!existsSync(versionPath)) {
    fatal('src/version.js not found');
  }
  
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8').toString());
    const versionContent = readFileSync(versionPath, 'utf-8').toString();
  
  // Extract VERSION from src/version.js
  const match = versionContent.match(/export const VERSION = ['"]([^'"]+)['"]/);
  if (!match) {
    fatal('Could not extract VERSION from src/version.js');
  }
  
  const srcVersion = match[1];
  const pkgVersion = pkg.version;
  
  if (srcVersion !== pkgVersion) {
    fatal(`Version mismatch: package.json=${pkgVersion}, src/version.js=${srcVersion}`);
  }
  
  success(`Version consistent: ${pkgVersion}`);
  return pkgVersion;
}

/**
 * Check 2: Version bumped since last git tag
 */
function checkVersionBumped(currentVersion) {
  log('\n[2/5] Checking version bumped since last tag...', YELLOW);
  
  try {
    // Get latest git tag
    const latestTag = execSync('git describe --tags --abbrev=0 2>/dev/null || echo "none"', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    
    if (latestTag === 'none') {
      warn('No previous git tags found (first release)');
      return;
    }
    
    // Remove 'v' prefix if present
    const lastVersion = latestTag.replace(/^v/, '');
    
    if (currentVersion === lastVersion) {
      fatal(`Version not bumped. Current: ${currentVersion}, Last tag: ${latestTag}`);
    }
    
    success(`Version bumped: ${lastVersion} → ${currentVersion}`);
  } catch (err) {
    warn('Could not check git tags (not a git repository?)');
  }
}

/**
 * Check 3: Changelog updated
 */
function checkChangelogUpdated(currentVersion) {
  log('\n[3/5] Checking changelog updated (json + md)...', YELLOW);
  
  const changelogPath = resolve(__dirname, '../changelog.json');
  
  if (!existsSync(changelogPath)) {
    fatal('changelog.json not found');
  }
  
  const changelog = JSON.parse(String(readFileSync(changelogPath, 'utf-8')));
  
  if (!changelog.versions || !Array.isArray(changelog.versions)) {
    fatal('changelog.json has invalid structure (missing versions array)');
  }
  
  const latestEntry = changelog.versions[0];
  const previousEntry = changelog.versions[1];
  
  if (!latestEntry) {
    fatal('changelog.json has no version entries');
  }
  
  if (latestEntry.version !== currentVersion) {
    fatal(`Changelog not updated. Latest entry: ${latestEntry.version}, Current version: ${currentVersion}`);
  }
  
  assertRequiredFields(latestEntry, currentVersion);
  const inferredType = inferBumpType(currentVersion, previousEntry?.version);
  if (inferredType && latestEntry.type !== inferredType) {
    fatal(`Changelog type mismatch for ${currentVersion}. Expected ${inferredType}, found ${latestEntry.type}`);
  }

  assertMarkdownEntry(currentVersion, latestEntry.type);
  
  success(`Changelog updated for version ${currentVersion} (type: ${latestEntry.type})`);
}

/**
 * Check 4: Tests passing
 */
function checkTestsPassing() {
  log('\n[4/5] Running tests...', YELLOW);
  
  try {
    execSync('npm test', {
      stdio: 'inherit',
      encoding: 'utf-8',
    });
    success('All tests passing');
  } catch (err) {
    fatal('Tests failed. Fix tests before publishing.');
  }
}

/**
 * Check 5: No dirty working tree
 */
function checkCleanWorkingTree() {
  log('\n[5/5] Checking working tree...', YELLOW);
  
  try {
    const status = execSync('git status --porcelain', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    
    if (status) {
      fatal('Working tree has uncommitted changes. Commit or stash before publishing.');
    }
    
    success('Working tree clean');
  } catch (err) {
    warn('Could not check git status (not a git repository?)');
  }
}

/**
 * Main validation
 */
function main() {
  log('\n=== VERAX Pre-Publish Validation ===', GREEN);
  
  try {
    const version = checkVersionConsistency();
    checkVersionBumped(version);
    checkChangelogUpdated(version);
    checkTestsPassing();
    checkCleanWorkingTree();
    
    log('\n=== ✅ All checks passed. Ready to publish. ===\n', GREEN);
    process.exit(0);
  } catch (err) {
    if (err.message) {
      error(`\nValidation failed: ${err.message}`);
    }
    process.exit(1);
  }
}

main();
