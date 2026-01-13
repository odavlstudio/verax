#!/usr/bin/env node
/**
 * SILENCE INVENTORY
 * 
 * Scans the entire codebase to identify every location where:
 * - Data is skipped
 * - Findings are dropped
 * - Budgets are capped
 * - Timeouts occur
 * - Expectations go unverified
 * - Incremental reuse happens
 * 
 * GOAL: Make all silence explicit and unavoidable in output
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SILENCE_PATTERNS = {
  // Budget/limit checks
  budget: [
    /\.cap\b/,
    /capped\s*[:=]/,
    /exceed.*budget/i,
    /interaction.*limit/i,
    /page.*limit/i,
    /\.length\s*[><=]/,
    /MAX_.*INTERACTIONS/,
    /MAX_.*PAGES/,
    /budgetRemaining/,
  ],
  
  // Timeout handling
  timeout: [
    /timeout/i,
    /waitFor.*timeout/,
    /TIMEOUT_.*=/,
    /navigationTimeout/,
    /settleTimeout/,
  ],
  
  // Silent return/skip
  silent: [
    /return\s*;\s*\/\//,
    /return\s*null\s*;/,
    /return\s*undefined\s*;/,
    /skip\(/i,
    /\.skip\b/,
    /if\s*\(!.*\)\s*return/,
    /if\s*\(.*\)\s*return\s*;\s*$/m,
  ],
  
  // Drop/filter operations that remove data
  drop: [
    /\.filter\(\s*[^)]*=>/,
    /\.splice\(/,
    /\.slice\(/,
    /dropped/i,
    /filtered.*out/i,
  ],
  
  // Incremental reuse (skipping re-observation)
  incremental: [
    /INCREMENTAL/,
    /incremental/i,
    /previousRun/i,
    /cached.*result/i,
    /reuse.*observ/i,
    /skip.*reobserv/i,
  ],
  
  // Safety skips
  safety: [
    /logout/i,
    /sign.*out/i,
    /delete/i,
    /unsubscribe/i,
    /confirm.*destructive/i,
    /UNSAFE/,
    /dangerous/i,
  ],
  
  // Gap tracking (existing)
  gaps: [
    /expectationCoverageGaps/,
    /coverageGaps/,
    /uncovered/i,
    /not.*covered/i,
    /missing.*expect/i,
  ],
};

/**
 * Find all silence locations in codebase
 */
function inventorySilence(rootDir = '.') {
  const inventory = {
    byType: {},
    byFile: {},
    locations: [],
    patterns: {},
  };

  Object.keys(SILENCE_PATTERNS).forEach(type => {
    inventory.byType[type] = [];
    inventory.patterns[type] = [];
  });

  const visited = new Set();

  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      // Skip common ignore patterns
      if (file.startsWith('.') || file === 'node_modules' || file === 'dist' || file === '.git') {
        return;
      }

      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (file.endsWith('.js') || file.endsWith('.mjs')) {
        scanFile(fullPath);
      }
    });
  }

  function scanFile(filePath) {
    if (visited.has(filePath)) return;
    visited.add(filePath);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      inventory.byFile[filePath] = {
        matches: [],
        lineCount: lines.length,
      };

      lines.forEach((line, lineNum) => {
        Object.entries(SILENCE_PATTERNS).forEach(([type, patterns]) => {
          patterns.forEach(pattern => {
            if (pattern.test(line)) {
              const match = {
                file: filePath,
                line: lineNum + 1,
                type,
                content: line.trim().substring(0, 100),
              };

              inventory.byType[type].push(match);
              inventory.byFile[filePath].matches.push(match);
              inventory.locations.push(match);
            }
          });
        });
      });
    } catch (err) {
      // Skip unreadable files
    }
  }

  scanDir(rootDir);
  return inventory;
}

/**
 * Analyze inventory and produce report
 */
function analyzeInventory(inventory) {
  const report = {
    summary: {},
    byType: {},
    topFiles: [],
    categories: {},
  };

  // Count by type
  Object.entries(inventory.byType).forEach(([type, matches]) => {
    report.byType[type] = {
      count: matches.length,
      files: new Set(matches.map(m => m.file)).size,
    };
  });

  // Summary
  report.summary = {
    totalMatches: inventory.locations.length,
    filesAffected: Object.keys(inventory.byFile).length,
    types: Object.keys(report.byType),
  };

  // Top files
  report.topFiles = Object.entries(inventory.byFile)
    .filter(([_, data]) => data.matches.length > 0)
    .sort((a, b) => b[1].matches.length - a[1].matches.length)
    .slice(0, 10)
    .map(([file, data]) => ({
      file,
      matches: data.matches.length,
    }));

  return report;
}

/**
 * Generate actionable report
 */
function generateReport(inventory, report) {
  console.log('\n=== SILENCE INVENTORY REPORT ===\n');
  
  console.log('SUMMARY');
  console.log('-------');
  console.log(`Total silence patterns found: ${report.summary.totalMatches}`);
  console.log(`Files with silence: ${report.summary.filesAffected}`);
  console.log(`Pattern types: ${report.summary.types.join(', ')}\n`);

  console.log('BREAKDOWN BY TYPE');
  console.log('-----------------');
  Object.entries(report.byType)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([type, data]) => {
      console.log(`${type.toUpperCase()}: ${data.count} matches in ${data.files} files`);
    });

  console.log('\nTOP FILES WITH MOST SILENCE');
  console.log('----------------------------');
  report.topFiles.forEach(({ file, matches }) => {
    const rel = path.relative('.', file);
    console.log(`${rel}: ${matches} matches`);
  });

  // Find critical patterns
  console.log('\nCRITICAL PATTERNS TO ADDRESS');
  console.log('----------------------------');
  
  const budgetIssues = report.byType.budget?.count || 0;
  const timeoutIssues = report.byType.timeout?.count || 0;
  const silentReturns = report.byType.silent?.count || 0;
  const gapTracking = report.byType.gaps?.count || 0;

  if (budgetIssues > 10) {
    console.log(`⚠️  HIGH: ${budgetIssues} budget-related checks - ensure all are tracked`);
  }
  if (timeoutIssues > 5) {
    console.log(`⚠️  HIGH: ${timeoutIssues} timeout operations - ensure failures are surfaced`);
  }
  if (silentReturns > 20) {
    console.log(`⚠️  CRITICAL: ${silentReturns} silent returns - these may hide failures`);
  }
  if (gapTracking < budgetIssues) {
    console.log(`⚠️  CRITICAL: Gap tracking (${gapTracking}) < Budget checks (${budgetIssues})`);
    console.log('   Not all budget caps are being tracked as gaps!');
  }
}

// Main
try {
  const root = process.argv[2] || './src/verax';
  console.log(`Scanning: ${root}\n`);

  const inventory = inventorySilence(root);
  const report = analyzeInventory(inventory);
  generateReport(inventory, report);

  // Output detailed data
  console.log('\nDETAILED INVENTORY (silence-inventory.json)');
  fs.writeFileSync('silence-inventory.json', JSON.stringify(inventory, null, 2));
  fs.writeFileSync('silence-report.json', JSON.stringify(report, null, 2));
  console.log('✓ Saved to silence-inventory.json and silence-report.json');
} catch (err) {
  console.error('Error:', err.message);
  console.error(err);
  process.exit(1);
}

export { inventorySilence, analyzeInventory, generateReport };
