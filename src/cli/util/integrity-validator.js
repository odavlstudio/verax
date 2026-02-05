/**
 * ARTIFACT INTEGRITY VALIDATOR
 * 
 * Enforces cross-artifact consistency:
 * 1. Summary says X findings => findings.json contains X
 * 2. Evidence references in findings must point to existing files
 * 3. If evidence files missing for CONFIRMED finding => downgrade or drop
 * 4. Corruption/missing evidence => mark run INCOMPLETE and signal exit 30
 * 
 * Pure validator (no I/O mutations), returns integrity report.
 */

import { readdirSync } from 'fs';
import { existsSync, statSync as _statSync } from 'fs';
import { resolve } from 'path';

/**
 * INTEGRITY REPORT
 * @typedef {Object} IntegrityReport
 * @property {boolean} consistent - True if all artifacts consistent
 * @property {string} [reason] - Why inconsistent (if applicable)
 * @property {Object} issues - Categorized integrity issues
 * @property {Array} issues.missingEvidenceFiles - Findings referencing non-existent evidence
 * @property {Array} issues.countMismatches - Summary/findings count discrepancies
 * @property {number} severityLevel - 0=OK, 1=WARNING, 2=CRITICAL
 * @property {boolean} shouldMarkIncomplete - True if run should be marked INCOMPLETE
 * @property {Array} requiredDowngrades - Finding IDs that must be downgraded (no evidence)
 */

/**
 * Check if evidence files referenced in findings actually exist
 * 
 * @private
 */
function validateEvidenceFileReferences(findingsData, evidenceDir) {
  const issues = {
    missingEvidenceFiles: [],
    requiredDowngrades: []
  };

  if (!findingsData || !Array.isArray(findingsData.findings)) {
    return issues;
  }

  // List all files in evidence directory
  let _evidenceFiles = [];
  if (existsSync(evidenceDir)) {
    try {
      _evidenceFiles = readdirSync(evidenceDir).sort((a, b) => a.localeCompare(b, 'en'));
    } catch (e) {
      // Directory unreadable, mark as issue but continue
    }
  }

  for (const finding of findingsData.findings) {
    if (!finding.evidence || typeof finding.evidence !== 'object') {
      continue;
    }

    // Check for evidence file references
    const evidenceFilesRef = finding.evidence.evidence_files || 
                              finding.evidence.evidenceFiles || 
                              [];

    if (!Array.isArray(evidenceFilesRef)) {
      continue;
    }

    for (const refFile of evidenceFilesRef) {
      if (typeof refFile !== 'string') {
        continue;
      }

      // Check if referenced file exists
      const fullPath = resolve(evidenceDir, refFile);
      if (!existsSync(fullPath)) {
        issues.missingEvidenceFiles.push({
          findingId: finding.id || finding.findingId,
          findingType: finding.type,
          missingFile: refFile,
          status: finding.status
        });

        // If CONFIRMED but evidence missing, must downgrade
        if (finding.status === 'CONFIRMED') {
          issues.requiredDowngrades.push({
            findingId: finding.id || finding.findingId,
            reason: `Evidence file missing: ${refFile}`
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Check summary/findings count consistency
 * 
 * @private
 */
function validateCountConsistency(summary, findingsData) {
  const issues = {
    countMismatches: []
  };

  if (!summary || !findingsData) {
    return issues;
  }

  const summaryTotal = summary.silentFailures || summary.findingsCounts?.total || 0;
  const findingsTotal = findingsData.findings?.length || 0;

  if (summaryTotal !== findingsTotal) {
    issues.countMismatches.push({
      summaryCount: summaryTotal,
      findingsCount: findingsTotal,
      mismatch: Math.abs(summaryTotal - findingsTotal)
    });
  }

  // Check severity breakdown if present
  if (summary.findingsCounts && findingsData.findings) {
    const actualCounts = {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0
    };

    for (const finding of findingsData.findings) {
      const sev = finding.severity || 'UNKNOWN';
      if (sev in actualCounts) {
        actualCounts[sev]++;
      }
    }

    // Verify each severity count matches
    for (const severity of Object.keys(actualCounts)) {
      const expectedCount = summary.findingsCounts[severity] || 0;
      const actualCount = actualCounts[severity];
      if (expectedCount !== actualCount) {
        issues.countMismatches.push({
          severity,
          expectedCount,
          actualCount
        });
      }
    }
  }

  return issues;
}

/**
 * VALIDATE ARTIFACT INTEGRITY
 * 
 * Main validation function called during finalize phase.
 * Checks cross-artifact consistency and returns comprehensive report.
 *
 * @param {Object} params - { summary, findingsData, evidenceDir }
 * @returns {IntegrityReport}
 */
export function validateArtifactIntegrity(params) {
  const { summary, findingsData, evidenceDir } = params;

  let severityLevel = 0; // 0=OK, 1=WARNING, 2=CRITICAL
  const allIssues = {
    missingEvidenceFiles: [],
    countMismatches: [],
    requiredDowngrades: []
  };

  // Check evidence file references
  const evidenceIssues = validateEvidenceFileReferences(findingsData, evidenceDir);
  allIssues.missingEvidenceFiles = evidenceIssues.missingEvidenceFiles;
  allIssues.requiredDowngrades = evidenceIssues.requiredDowngrades;

  if (allIssues.missingEvidenceFiles.length > 0) {
    severityLevel = Math.max(severityLevel, 1); // At minimum WARNING
    
    // CRITICAL if many files missing or if CONFIRMED has missing evidence
    if (allIssues.missingEvidenceFiles.length > 3 ||
        allIssues.requiredDowngrades.length > 0) {
      severityLevel = 2;
    }
  }

  // Check count consistency
  const countIssues = validateCountConsistency(summary, findingsData);
  allIssues.countMismatches = countIssues.countMismatches;

  if (allIssues.countMismatches.length > 0) {
    severityLevel = Math.max(severityLevel, 2); // Count mismatch is CRITICAL
  }

  // Determine if run should be marked INCOMPLETE
  const shouldMarkIncomplete = severityLevel === 2 || 
                               allIssues.requiredDowngrades.length > 0;

  const consistent = severityLevel === 0 && allIssues.countMismatches.length === 0;

  return {
    consistent,
    reason: !consistent ? `Integrity check failed (severity=${severityLevel})` : undefined,
    issues: allIssues,
    severityLevel,
    shouldMarkIncomplete,
    requiredDowngrades: allIssues.requiredDowngrades
  };
}

/**
 * Apply integrity fixes to findings
 * 
 * Downgrades CONFIRMED findings that have missing evidence references.
 * 
 * @param {Array} findings - Array of findings to fix
 * @param {Array} requiredDowngrades - List of {findingId, reason} objects
 * @returns {Array} - Fixed findings
 */
export function applyIntegrityFixes(findings, requiredDowngrades) {
  if (!requiredDowngrades || requiredDowngrades.length === 0) {
    return findings;
  }

  const downgradedIds = new Set(requiredDowngrades.map(d => d.findingId));

  return findings.map(finding => {
    const findingId = finding.id || finding.findingId;
    
    if (downgradedIds.has(findingId)) {
      // Add integrity downgrade reason to enrichment
      return {
        ...finding,
        status: 'SUSPECTED',
        enrichment: {
          ...(finding.enrichment || {}),
          integrityDowngradeReason: requiredDowngrades.find(
            d => d.findingId === findingId
          )?.reason || 'Evidence integrity issue'
        }
      };
    }

    return finding;
  });
}
