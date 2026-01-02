#!/usr/bin/env node
/**
 * Generate Quality Baseline
 * Parses ESLint and TypeScript outputs to create baseline JSON files
 * Used to track existing errors and prevent regressions
 */

const fs = require('fs');
const path = require('path');

const BASELINE_DIR = path.join(__dirname, '..', 'reports', 'quality-baseline');

function parseESLintOutput(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const files = {};
  let totalErrors = 0;
  
  // Parse ESLint output format
  // Looking for lines like: C:\path\to\file.js
  //   15:12  error  'e' is defined but never used  no-unused-vars
  
  let currentFile = null;
  const lines = content.split('\n');
  
  for (const line of lines) {
    // Check if line is a file path (starts with drive letter or / and ends with .js)
    if (/^[A-Z]:\\.*\.js$/.test(line.trim()) || /^\/.*\.js$/.test(line.trim())) {
      currentFile = line.trim();
      // Normalize path to relative
      const repoRoot = path.join(__dirname, '..');
      currentFile = path.relative(repoRoot, currentFile).replace(/\\/g, '/');
      if (!files[currentFile]) {
        files[currentFile] = 0;
      }
    } else if (currentFile && /^\s+\d+:\d+\s+(error|warning)/.test(line)) {
      // This is an error/warning line
      if (line.includes('error')) {
        files[currentFile]++;
        totalErrors++;
      }
    }
  }
  
  // Count summary from ESLint output (more reliable)
  const summaryMatch = content.match(/✖\s+(\d+)\s+problems?\s+\((\d+)\s+errors?/);
  if (summaryMatch) {
    totalErrors = parseInt(summaryMatch[2], 10);
  }
  
  return { totalErrors, files };
}

function parseTypeCheckOutput(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const files = {};
  let totalErrors = 0;
  
  // Parse TypeScript output format
  // Looking for lines like: src/guardian/file.js(123,45): error TS2339: Property 'x' does not exist
  
  const lines = content.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^([^(]+)\(\d+,\d+\):\s+error\s+TS\d+:/);
    if (match) {
      let filePath = match[1].trim();
      // Normalize path to relative
      const repoRoot = path.join(__dirname, '..');
      filePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
      
      if (!files[filePath]) {
        files[filePath] = 0;
      }
      files[filePath]++;
      totalErrors++;
    }
  }
  
  return { totalErrors, files };
}

function main() {
  console.log('📊 Generating Quality Baselines...\n');
  
  // Parse ESLint
  const eslintRawPath = path.join(BASELINE_DIR, 'eslint-raw-output.txt');
  if (fs.existsSync(eslintRawPath)) {
    console.log('📝 Parsing ESLint output...');
    const eslintBaseline = parseESLintOutput(eslintRawPath);
    const eslintBaselinePath = path.join(BASELINE_DIR, 'eslint-baseline.json');
    fs.writeFileSync(eslintBaselinePath, JSON.stringify(eslintBaseline, null, 2));
    console.log(`   ✅ ESLint baseline: ${eslintBaseline.totalErrors} errors across ${Object.keys(eslintBaseline.files).length} files`);
    console.log(`   📁 Saved to: ${path.relative(path.join(__dirname, '..'), eslintBaselinePath)}`);
  } else {
    console.error('❌ ESLint raw output not found. Run: npm run lint 2>&1 > reports/quality-baseline/eslint-raw-output.txt');
    process.exit(1);
  }
  
  console.log();
  
  // Parse TypeScript
  const typecheckRawPath = path.join(BASELINE_DIR, 'typecheck-raw-output.txt');
  if (fs.existsSync(typecheckRawPath)) {
    console.log('📝 Parsing TypeScript output...');
    const typecheckBaseline = parseTypeCheckOutput(typecheckRawPath);
    const typecheckBaselinePath = path.join(BASELINE_DIR, 'typecheck-baseline.json');
    fs.writeFileSync(typecheckBaselinePath, JSON.stringify(typecheckBaseline, null, 2));
    console.log(`   ✅ TypeScript baseline: ${typecheckBaseline.totalErrors} errors across ${Object.keys(typecheckBaseline.files).length} files`);
    console.log(`   📁 Saved to: ${path.relative(path.join(__dirname, '..'), typecheckBaselinePath)}`);
  } else {
    console.error('❌ TypeScript raw output not found. Run: npm run typecheck 2>&1 > reports/quality-baseline/typecheck-raw-output.txt');
    process.exit(1);
  }
  
  console.log('\n✅ Quality baselines generated successfully!');
  console.log('\n📋 Next steps:');
  console.log('   1. Review baseline files in reports/quality-baseline/');
  console.log('   2. Run: npm run quality:guard');
  console.log('   3. Commit baselines to version control');
}

main();
