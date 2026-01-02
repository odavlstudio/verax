#!/usr/bin/env node
/**
 * Quality Guard - Zero Regression Shield
 * Prevents introduction of new lint or type errors
 * Allows existing errors to remain (frozen baseline)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASELINE_DIR = path.join(__dirname, '..', 'reports', 'quality-baseline');
const TEMP_DIR = path.join(BASELINE_DIR, 'temp');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function loadBaseline(name) {
  const filePath = path.join(BASELINE_DIR, `${name}-baseline.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Baseline not found: ${filePath}`);
    console.error('   Run: node scripts/generate-quality-baseline.js');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runESLint() {
  console.log('🔍 Running ESLint...');
  try {
    execSync('npx eslint bin/ src/', { stdio: 'pipe' });
    return { totalErrors: 0, files: {} };
  } catch (error) {
    // ESLint exits with code 1 when errors found
    const output = error.stdout ? error.stdout.toString() : '';
    
    // Save raw output for debugging
    fs.writeFileSync(path.join(TEMP_DIR, 'eslint-current.txt'), output);
    
    const files = {};
    let totalErrors = 0;
    let currentFile = null;
    
    const lines = output.split('\n');
    for (const line of lines) {
      // File path line
      if (/^[A-Z]:\\.*\.js$/.test(line.trim()) || /^\/.*\.js$/.test(line.trim())) {
        currentFile = line.trim();
        const repoRoot = path.join(__dirname, '..');
        currentFile = path.relative(repoRoot, currentFile).replace(/\\/g, '/');
        if (!files[currentFile]) {
          files[currentFile] = 0;
        }
      } else if (currentFile && /^\s+\d+:\d+\s+error/.test(line)) {
        files[currentFile]++;
        totalErrors++;
      }
    }
    
    // Try to get accurate count from summary
    const summaryMatch = output.match(/✖\s+(\d+)\s+problems?\s+\((\d+)\s+errors?/);
    if (summaryMatch) {
      totalErrors = parseInt(summaryMatch[2], 10);
    }
    
    return { totalErrors, files };
  }
}

function runTypeCheck() {
  console.log('🔍 Running TypeScript type check...');
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    return { totalErrors: 0, files: {} };
  } catch (error) {
    const output = error.stdout ? error.stdout.toString() : '';
    
    // Save raw output for debugging
    fs.writeFileSync(path.join(TEMP_DIR, 'typecheck-current.txt'), output);
    
    const files = {};
    let totalErrors = 0;
    
    const lines = output.split('\n');
    for (const line of lines) {
      const match = line.match(/^([^(]+)\(\d+,\d+\):\s+error\s+TS\d+:/);
      if (match) {
        let filePath = match[1].trim();
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
}

function compareResults(name, baseline, current) {
  console.log(`\n📊 ${name} Comparison:`);
  console.log(`   Baseline: ${baseline.totalErrors} errors`);
  console.log(`   Current:  ${current.totalErrors} errors`);
  
  const newErrors = [];
  const fixedErrors = [];
  
  // Check for new errors in existing files or new files with errors
  for (const [file, count] of Object.entries(current.files)) {
    const baselineCount = baseline.files[file] || 0;
    if (count > baselineCount) {
      newErrors.push({
        file,
        baseline: baselineCount,
        current: count,
        new: count - baselineCount
      });
    } else if (count < baselineCount) {
      fixedErrors.push({
        file,
        baseline: baselineCount,
        current: count,
        fixed: baselineCount - count
      });
    }
  }
  
  // Report results
  if (newErrors.length > 0) {
    console.log(`\n   ❌ NEW ERRORS DETECTED (${newErrors.length} files affected):`);
    for (const error of newErrors) {
      console.log(`      ${error.file}: ${error.baseline} → ${error.current} (+${error.new})`);
    }
  }
  
  if (fixedErrors.length > 0) {
    console.log(`\n   ✅ IMPROVEMENTS (${fixedErrors.length} files improved):`);
    for (const fix of fixedErrors) {
      console.log(`      ${fix.file}: ${fix.baseline} → ${fix.current} (-${fix.fixed})`);
    }
  }
  
  if (newErrors.length === 0 && fixedErrors.length === 0) {
    console.log('   ✅ No changes detected');
  }
  
  return {
    hasNewErrors: newErrors.length > 0,
    newErrorCount: newErrors.reduce((sum, e) => sum + e.new, 0),
    fixedErrorCount: fixedErrors.reduce((sum, f) => sum + f.fixed, 0),
    newErrors,
    fixedErrors
  };
}

function main() {
  console.log('🛡️  Quality Guard - Zero Regression Shield\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Load baselines
  const eslintBaseline = loadBaseline('eslint');
  const typecheckBaseline = loadBaseline('typecheck');
  
  console.log('📋 Loaded baselines:');
  console.log(`   ESLint:     ${eslintBaseline.totalErrors} errors (frozen)`);
  console.log(`   TypeScript: ${typecheckBaseline.totalErrors} errors (frozen)`);
  console.log();
  
  // Run current checks
  const eslintCurrent = runESLint();
  const typecheckCurrent = runTypeCheck();
  
  // Compare results
  const eslintComparison = compareResults('ESLint', eslintBaseline, eslintCurrent);
  const typecheckComparison = compareResults('TypeScript', typecheckBaseline, typecheckCurrent);
  
  // Generate summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📈 Summary:\n');
  
  const totalNewErrors = eslintComparison.newErrorCount + typecheckComparison.newErrorCount;
  const totalFixed = eslintComparison.fixedErrorCount + typecheckComparison.fixedErrorCount;
  
  if (totalNewErrors > 0) {
    console.log(`   ❌ GUARD FAILED: ${totalNewErrors} new errors introduced`);
    console.log('   → Fix the new errors before committing');
  } else {
    console.log('   ✅ GUARD PASSED: No new errors introduced');
  }
  
  if (totalFixed > 0) {
    console.log(`   🎉 Bonus: ${totalFixed} errors fixed!`);
    console.log('   → Consider updating baseline with: node scripts/generate-quality-baseline.js');
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Exit with appropriate code
  if (totalNewErrors > 0) {
    console.log('❌ Quality guard check failed.\n');
    process.exit(1);
  } else {
    console.log('✅ Quality guard check passed.\n');
    process.exit(0);
  }
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
  console.error('\n❌ Quality guard error:', error.message);
  console.error('\nStack trace:', error.stack);
  process.exit(1);
});

main();
