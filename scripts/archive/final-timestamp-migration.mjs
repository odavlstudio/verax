#!/usr/bin/env node

/**
 * FINAL TIMESTAMP MIGRATION — BATCH NEXT-1
 * 
 * Replaces ALL nondeterministic timestamps in src/ with getTimeProvider().iso()
 * Preserves Date.now() for duration/timing calculations (deterministic)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '../src');

// Files to migrate (all artifact writers and engines)
const filesToMigrate = [
  // CLI commands
  'cli/commands/run.js',
  'cli/commands/default.js',
  'cli/commands/ga.js',
  
  // CLI utilities - critical path
  'cli/util/detection-engine.js',
  'cli/util/determinism-writer.js',
  'cli/util/digest-engine.js',
  'cli/util/events.js',
  'cli/util/evidence-engine.js',
  'cli/util/findings-writer.js',
  'cli/util/learn-writer.js',
  'cli/util/ledger-writer.js',
  'cli/util/observation-engine.js',
  'cli/util/observe-writer.js',
  'cli/util/project-discovery.js',
  'cli/util/trust-activation-integration.js',
  'cli/util/interaction-planner.js',
  
  // Verax core - artifact writers
  'verax/core/baseline/baseline.snapshot.js',
  'verax/core/confidence/confidence-report-writer.js',
  'verax/core/decisions/decision.trace.js',
  'verax/core/determinism/contract-writer.js',
  'verax/core/determinism/engine.js',
  'verax/core/determinism/report-writer.js',
  'verax/core/evidence/evidence-capture-service.js',
  'verax/core/evidence/evidence-intent-ledger.js',
  'verax/core/ga/ga-report-writer.js',
  'verax/core/ga/ga.contract.js',
  'verax/core/guardrails/guardrails-report-writer.js',
  'verax/core/integrity/integrity.js',
  'verax/core/integrity/poisoning.js',
  'verax/core/observe/run-timeline.js',
  'verax/core/perf/perf.report.js',
  'verax/core/pipeline-tracker.js',
  'verax/core/release/provenance.builder.js',
  'verax/core/release/release-report-writer.js',
  'verax/core/release/reproducibility.check.js',
  'verax/core/release/sbom.builder.js',
  'verax/core/report/cross-index.js',
  'verax/core/report/human-summary.js',
  'verax/core/run-manifest.js',
  'verax/core/security/secrets.scan.js',
  'verax/core/security/security-report.js',
  'verax/core/security/supplychain.policy.js',
  'verax/core/security/vuln.scan.js',
  'verax/core/truth/truth.certificate.js',
  
  // Verax detect
  'verax/detect/detection-engine.js',
  'verax/detect/evidence-index.js',
  'verax/detect/findings-writer.js',
  'verax/detect/verdict-engine.js',
  
  // Verax learn
  'verax/learn/manifest-writer.js',
  
  // Verax observe
  'verax/observe/expectation-handler.js',
  'verax/observe/observation-builder.js',
  'verax/observe/traces-writer.js',
  'verax/observe/ui-feedback-detector.js',
  
  // Verax shared
  'verax/scan-summary-writer.js',
  'verax/shared/artifact-manager.js',
];

function calculateImportPath(filePath) {
  const depth = filePath.split('/').length;
  const timeProviderPath = '../'.repeat(depth) + 'cli/util/time-provider.js';
  return timeProviderPath;
}

function migrateFile(filePath) {
  const fullPath = path.join(srcDir, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  ${filePath}: File not found`);
    return false;
  }
  
  let content = fs.readFileSync(fullPath, 'utf-8');
  const originalContent = content;
  
  // Pattern: new Date().toISOString() (artifact timestamp)
  // BUT NOT: new Date(startedAt) or new Date(Date.parse(...)) (date parsing)
  const hasToISOString = /new Date\(\)\.toISOString\(\)/.test(content);
  
  if (hasToISOString) {
    // Add import if not present
    if (!content.includes('getTimeProvider')) {
      const importPath = calculateImportPath(filePath);
      const importStatement = `import { getTimeProvider } from '${importPath}';\n`;
      
      // Find where to insert (after other imports)
      const lastImportMatch = content.match(/^import .* from .*;\n/m);
      if (lastImportMatch) {
        const insertPos = content.lastIndexOf('\n', content.indexOf(lastImportMatch[0]) + lastImportMatch[0].length);
        content = content.slice(0, insertPos + 1) + importStatement + content.slice(insertPos + 1);
      } else {
        // No imports found, add at top
        content = importStatement + content;
      }
    }
    
    // Replace new Date().toISOString() with getTimeProvider().iso()
    content = content.replace(/new Date\(\)\.toISOString\(\)/g, 'getTimeProvider().iso()');
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ ${filePath}`);
    return true;
  }
  
  return false;
}

console.log('🔄 FINAL TIMESTAMP MIGRATION\n');

let migrated = 0;
let skipped = 0;

for (const file of filesToMigrate) {
  if (migrateFile(file)) {
    migrated++;
  } else {
    skipped++;
  }
}

console.log(`\n✅ Migrated: ${migrated} files`);
console.log(`⏭️  Skipped: ${skipped} files\n`);
