#!/usr/bin/env node

/**
 * Extension Marketplace Readiness Verification
 * Lightweight quality gate for VS Code extension publishing
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.dirname(path.dirname(__dirname));
const EXTENSION_ROOT = path.dirname(__dirname);
const PACKAGE_JSON_PATH = path.join(EXTENSION_ROOT, 'package.json');
const OUT_DIR = path.join(EXTENSION_ROOT, 'out');

const REQUIRED_FIELDS = [
  'name',
  'displayName',
  'version',
  'description',
  'publisher',
  'license',
  'repository',
  'bugs',
  'engines',
  'contributes'
];

const ERRORS = [];
const WARNINGS = [];

// 1. Verify package.json exists and is valid
console.log('Verifying extension marketplace readiness...\n');

if (!fs.existsSync(PACKAGE_JSON_PATH)) {
  ERRORS.push('package.json not found');
  process.exit(1);
}

let packageJson;
try {
  const content = fs.readFileSync(PACKAGE_JSON_PATH, 'utf8');
  packageJson = JSON.parse(content);
} catch (e) {
  ERRORS.push(`package.json is invalid JSON: ${e.message}`);
  process.exit(1);
}

// 2. Check required fields
for (const field of REQUIRED_FIELDS) {
  if (!packageJson[field]) {
    ERRORS.push(`Missing required field: ${field}`);
  }
}

// 3. Check specific marketplace fields
if (packageJson.publisher && !packageJson.publisher.match(/^[a-z0-9-]+$/)) {
  ERRORS.push('Publisher name contains invalid characters (must be lowercase alphanumeric and hyphens)');
}

if (!packageJson.repository?.url?.includes('github.com')) {
  WARNINGS.push('Repository URL should point to GitHub for public marketplace');
}

if (!packageJson.bugs?.url) {
  ERRORS.push('bugs.url field is missing');
}

if (!packageJson.license) {
  ERRORS.push('license field is missing');
}

// 4. Check categories don't emphasize testing
if (packageJson.categories?.includes('Testing') && !packageJson.categories?.includes('DevOps')) {
  WARNINGS.push('Consider replacing "Testing" category with "DevOps" for deployment-focused extensions');
}

// 5. Check activation events
if (packageJson.activationEvents?.includes('onStartupFinished')) {
  WARNINGS.push('onStartupFinished delays VS Code startup. Consider using onCommand or onView instead');
}

if (!packageJson.activationEvents || packageJson.activationEvents.length === 0) {
  ERRORS.push('activationEvents must be specified');
}

// 6. Verify compiled output exists
if (!fs.existsSync(OUT_DIR) || !fs.existsSync(path.join(OUT_DIR, 'extension.js'))) {
  ERRORS.push('Compiled output not found. Run "npm run compile" first');
}

// 7. Check for icon
if (!packageJson.icon) {
  WARNINGS.push('Icon field is missing from package.json');
}

// 8. Verify version format
if (!packageJson.version?.match(/^\d+\.\d+\.\d+/)) {
  ERRORS.push(`Version format invalid: ${packageJson.version} (expected: x.y.z)`);
}

// 9. Check engine version
if (packageJson.engines?.vscode && packageJson.engines.vscode !== '^1.85.0') {
  WARNINGS.push(`Engine requirement is ${packageJson.engines.vscode}. Ensure target audience compatibility`);
}

// 10. Verify no problematic dependencies in extension
const allDeps = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies
};

const prohibitedDeps = ['vsce'];
for (const dep of prohibitedDeps) {
  if (allDeps[dep]) {
    WARNINGS.push(`${dep} should not be in extension package.json dependencies (use root package.json if needed)`);
  }
}

// Print results
console.log('────────────────────────────────────────');
if (ERRORS.length > 0) {
  console.log(`❌ ERRORS (${ERRORS.length}):`);
  ERRORS.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  console.log('');
}

if (WARNINGS.length > 0) {
  console.log(`⚠️  WARNINGS (${WARNINGS.length}):`);
  WARNINGS.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
  console.log('');
}

if (ERRORS.length === 0 && WARNINGS.length === 0) {
  console.log('✅ All marketplace readiness checks passed!');
  console.log('');
  console.log(`Extension: ${packageJson.displayName} v${packageJson.version}`);
  console.log(`Publisher: ${packageJson.publisher}`);
  console.log(`Categories: ${(packageJson.categories || []).join(', ')}`);
  console.log(`Activation: ${(packageJson.activationEvents || []).join(', ')}`);
  console.log('');
}

console.log('────────────────────────────────────────');

// Exit with error if any errors found
if (ERRORS.length > 0) {
  process.exit(1);
}

// Exit success even with warnings
process.exit(0);
