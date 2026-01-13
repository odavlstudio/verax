import { resolve } from 'path';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { DataError } from '../util/errors.js';

/**
 * `verax inspect` command
 * Read an existing run folder and display summary
 */
export async function inspectCommand(runPath, options = {}) {
  const { json = false } = options;
  
  const fullPath = resolve(runPath);
  
  // Validate run directory exists
  if (!existsSync(fullPath)) {
    throw new DataError(`Run directory not found: ${fullPath}`);
  }
  
  // Check for required files
  const requiredFiles = ['summary.json', 'findings.json'];
  const missingFiles = [];
  
  for (const file of requiredFiles) {
    const filePath = `${fullPath}/${file}`;
    if (!existsSync(filePath)) {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length > 0) {
    throw new DataError(
      `Invalid run directory. Missing files: ${missingFiles.join(', ')}`
    );
  }
  
  // Read summary and findings
  let summary, findings;
  
  try {
    summary = JSON.parse(readFileSync(`${fullPath}/summary.json`, 'utf8'));
  } catch (error) {
    throw new DataError(`Failed to parse summary.json: ${error.message}`);
  }
  
  try {
    findings = JSON.parse(readFileSync(`${fullPath}/findings.json`, 'utf8'));
  } catch (error) {
    throw new DataError(`Failed to parse findings.json: ${error.message}`);
  }
  
  // Check for evidence directory
  const evidenceDir = `${fullPath}/evidence`;
  const hasEvidence = existsSync(evidenceDir);
  let evidenceCount = 0;
  
  if (hasEvidence) {
    try {
      evidenceCount = readdirSync(evidenceDir).length;
    } catch (error) {
      evidenceCount = 0;
    }
  }
  
  // Build output
  const output = {
    runId: summary.runId || 'unknown',
    status: summary.status || 'unknown',
    startedAt: summary.startedAt || null,
    completedAt: summary.completedAt || null,
    url: summary.url || null,
    findingsCount: Array.isArray(findings) ? findings.length : 0,
    evidenceDir: hasEvidence ? evidenceDir : null,
    evidenceFileCount: evidenceCount,
  };
  
  if (json) {
    // Output as single JSON object
    console.log(JSON.stringify(output, null, 2));
  } else {
    // Output as human-readable summary
    console.log('\n=== Run Summary ===\n');
    console.log(`Run ID: ${output.runId}`);
    console.log(`Status: ${output.status}`);
    
    if (output.startedAt) {
      console.log(`Started: ${output.startedAt}`);
    }
    
    if (output.completedAt) {
      console.log(`Completed: ${output.completedAt}`);
    }
    
    if (output.url) {
      console.log(`URL: ${output.url}`);
    }
    
    console.log(`\nFindings: ${output.findingsCount}`);
    
    if (output.evidenceDir) {
      console.log(`Evidence: ${output.evidenceDir} (${output.evidenceFileCount} files)`);
    } else {
      console.log(`Evidence: not found`);
    }
    
    console.log('');
  }
  
  return output;
}
