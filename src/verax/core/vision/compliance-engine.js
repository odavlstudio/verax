/**
 * Vision Compliance Engine
 * 
 * Calculates weighted compliance scores and generates vision-compliance.json artifact
 * 
 * Principles:
 * - Deterministic scoring: same evidence → same score
 * - Weighted by importance (core principles = 10, operational = 5-8)
 * - Per-category and overall compliance percentages
 * - Binary verdict based on thresholds
 * - Evidence-backed only
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { getVisionChecklist, getCategoryWeights } from './vision-checklist.js';
import { resolveVisionCompliance } from './vision-resolver.js';
import { getTimeProvider } from '../../../cli/util/support/time-provider.js';


/**
 * Compliance result structure
 * @typedef {Object} ComplianceResult
 * @property {number} contractVersion - Contract version (1)
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {string} veraxVersion - VERAX version
 * @property {string} visionVersionHash - SHA-256 hash of Vision.md
 * @property {number} overallCompliance - Overall compliance percentage (0-100)
 * @property {Object} categoryScores - Per-category compliance percentages
 * @property {number} categoryScores.core - Core principles score
 * @property {number} categoryScores.implementation - Implementation score
 * @property {number} categoryScores.operational - Operational score
 * @property {Object[]} checks - Individual check results
 * @property {Object} evidenceIndex - Index of evidence by source
 * @property {string} verdict - VISION_MATCH_CONFIRMED | VISION_MATCH_SUBSTANTIAL | VISION_MATCH_PARTIAL | VISION_MISMATCH
 */

/**
 * Evaluate vision compliance for a completed run
 * 
 * @param {string} projectRoot - Project root directory
 * @param {string} runDir - Run directory with artifacts (optional)
 * @returns {Promise<ComplianceResult>}
 */
export async function evaluateCompliance(projectRoot, runDir = null) {
  const checklist = getVisionChecklist();
  const categoryWeights = getCategoryWeights();

  // Resolve all checks
  const resolvedChecks = await resolveVisionCompliance(projectRoot, runDir);

  // Calculate per-category scores
  const categoryScores = calculateCategoryScores(resolvedChecks, checklist, categoryWeights);

  // Calculate overall score
  const overallScore = calculateOverallScore(resolvedChecks, checklist);

  // Determine verdict
  const verdict = determineVerdict(overallScore, categoryScores);

  // Build evidence index
  const evidenceIndex = buildEvidenceIndex(resolvedChecks);

  // Get Vision.md hash
  const visionHash = await getVisionHash(projectRoot);

  // Get VERAX version
  const veraxVersion = await getVeraxVersion(projectRoot);

  return {
    contractVersion: 1,
    timestamp: getTimeProvider().iso(),
    veraxVersion,
    visionVersionHash: visionHash,
    overallCompliance: Math.round(overallScore * 100) / 100, // 2 decimal places
    categoryScores: {
      core: Math.round(categoryScores.core * 100) / 100,
      implementation: Math.round(categoryScores.implementation * 100) / 100,
      operational: Math.round(categoryScores.operational * 100) / 100
    },
    checks: resolvedChecks.map(check => {
      const original = checklist.find(c => c.id === check.checkId);
      return {
        id: check.checkId,
        section: original.section,
        title: original.title,
        status: check.status,
        score: Math.round(check.score * 100) / 100,
        weight: original.weight,
        category: original.category,
        evidenceFound: check.evidenceFound,
        evidenceMissing: check.evidenceMissing,
        notes: check.notes
      };
    }),
    evidenceIndex,
    verdict
  };
}

/**
 * Calculate per-category compliance scores
 * 
 * @param {Object[]} resolvedChecks - Resolved check results
 * @param {Object[]} checklist - Full vision checklist
 * @param {Object} categoryWeights - Total weights per category
 * @returns {Object} Category scores (0-100)
 */
function calculateCategoryScores(resolvedChecks, checklist, categoryWeights) {
  const categories = ['core', 'implementation', 'operational'];
  const scores = {};

  categories.forEach(category => {
    const checksInCategory = checklist.filter(c => c.category === category);
    const resolvedInCategory = resolvedChecks.filter(r => 
      checksInCategory.some(c => c.id === r.checkId)
    );

    let earnedWeight = 0;
    let totalWeight = categoryWeights[category];

    resolvedInCategory.forEach(resolved => {
      const check = checksInCategory.find(c => c.id === resolved.checkId);
      earnedWeight += check.weight * resolved.score;
    });

    scores[category] = totalWeight > 0 ? (earnedWeight / totalWeight) * 100 : 0;
  });

  return scores;
}

/**
 * Calculate overall compliance score (weighted across all checks)
 * 
 * @param {Object[]} resolvedChecks - Resolved check results
 * @param {Object[]} checklist - Full vision checklist
 * @returns {number} Overall score (0-100)
 */
function calculateOverallScore(resolvedChecks, checklist) {
  let earnedWeight = 0;
  let totalWeight = 0;

  checklist.forEach(check => {
    totalWeight += check.weight;
    const resolved = resolvedChecks.find(r => r.checkId === check.id);
    if (resolved) {
      earnedWeight += check.weight * resolved.score;
    }
  });

  return totalWeight > 0 ? (earnedWeight / totalWeight) * 100 : 0;
}

/**
 * Determine binary verdict from scores
 * 
 * @param {number} overallScore - Overall compliance score (0-100)
 * @param {Object} categoryScores - Per-category scores
 * @returns {string} Verdict
 */
function determineVerdict(overallScore, categoryScores) {
  // VISION_MATCH_CONFIRMED: 95%+ overall AND 95%+ core
  if (overallScore >= 95 && categoryScores.core >= 95) {
    return 'VISION_MATCH_CONFIRMED';
  }

  // VISION_MATCH_SUBSTANTIAL: 80%+ overall AND 90%+ core
  if (overallScore >= 80 && categoryScores.core >= 90) {
    return 'VISION_MATCH_SUBSTANTIAL';
  }

  // VISION_MATCH_PARTIAL: 60%+ overall
  if (overallScore >= 60) {
    return 'VISION_MATCH_PARTIAL';
  }

  // VISION_MISMATCH: Below 60%
  return 'VISION_MISMATCH';
}

/**
 * Build evidence index by source
 * 
 * @param {Object[]} resolvedChecks - Resolved check results
 * @returns {Object} Evidence index grouped by source type
 */
function buildEvidenceIndex(resolvedChecks) {
  const index = {
    codeStructure: [],
    artifacts: [],
    documentation: [],
    missing: []
  };

  resolvedChecks.forEach(check => {
    check.evidenceFound.forEach(evidence => {
      if (evidence.includes('.js') || evidence.includes('directory')) {
        index.codeStructure.push({ checkId: check.checkId, evidence });
      } else if (evidence.includes('.json')) {
        index.artifacts.push({ checkId: check.checkId, evidence });
      } else if (evidence.includes('.md')) {
        index.documentation.push({ checkId: check.checkId, evidence });
      }
    });

    check.evidenceMissing.forEach(evidence => {
      index.missing.push({ checkId: check.checkId, evidence });
    });
  });

  return index;
}

/**
 * Get SHA-256 hash of Vision.md for version tracking
 * 
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<string>} SHA-256 hash
 */
async function getVisionHash(projectRoot) {
  const visionPath = join(projectRoot, 'docs', 'VISION.md');
  
  if (!existsSync(visionPath)) {
    return 'VISION_NOT_FOUND';
  }

  const content = readFileSync(visionPath, 'utf-8');
  const hash = createHash('sha256').update(content).digest('hex');
  return `sha256:${hash}`;
}

/**
 * Get VERAX version from package.json
 * 
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<string>} Version string
 */
async function getVeraxVersion(projectRoot) {
  const packagePath = join(projectRoot, 'package.json');
  
  if (!existsSync(packagePath)) {
    return 'unknown';
  }

  const pkg = JSON.parse(String(readFileSync(packagePath, 'utf-8')));
  return pkg.version || 'unknown';
}

/**
 * Write vision compliance artifact to run directory
 * 
 * @param {string} runDir - Run directory path
 * @param {ComplianceResult} result - Compliance evaluation result
 * @returns {Promise<string>} Path to written file
 */
export async function writeVisionCompliance(runDir, result) {
  const outputPath = join(runDir, 'vision-compliance.json');

  // Ensure directory exists
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Write with deterministic formatting (2-space indent, sorted keys)
  const json = JSON.stringify(result, null, 2);
  writeFileSync(outputPath, json, 'utf-8');

  return outputPath;
}

/**
 * Check if vision compliance should run for this runDir
 * 
 * Only run compliance on COMPLETE runs with all artifacts present
 * 
 * @param {string} runDir - Run directory path
 * @returns {boolean} True if compliance should run
 */
export function shouldRunCompliance(runDir) {
  if (!runDir || !existsSync(runDir)) {
    return false;
  }

  // Check for summary.json (indicates run completed)
  const summaryPath = join(runDir, 'summary.json');
  if (!existsSync(summaryPath)) {
    return false;
  }

  // Check completion status
  const summary = JSON.parse(String(readFileSync(summaryPath, 'utf-8')));
  if (summary.completion?.runCompleted !== true) {
    return false;
  }

  // Check for required artifacts
  const requiredArtifacts = ['learn.json', 'observe.json', 'findings.json', 'decisions.json'];
  const allPresent = requiredArtifacts.every(artifact => 
    existsSync(join(runDir, artifact))
  );

  return allPresent;
}

/**
 * Generate human-readable compliance report
 * 
 * @param {ComplianceResult} result - Compliance evaluation result
 * @returns {string} Markdown report
 */
export function generateComplianceReport(result) {
  const lines = [];

  lines.push('# Vision Compliance Report');
  lines.push('');
  lines.push(`**Generated**: ${result.timestamp}`);
  lines.push(`**VERAX Version**: ${result.veraxVersion}`);
  lines.push(`**Vision Hash**: ${result.visionVersionHash.substring(0, 16)}...`);
  lines.push('');

  // Overall verdict
  lines.push('## Verdict');
  lines.push('');
  lines.push(`**${result.verdict}**`);
  lines.push('');
  lines.push(`Overall Compliance: **${result.overallCompliance.toFixed(2)}%**`);
  lines.push('');

  // Category scores
  lines.push('## Category Scores');
  lines.push('');
  lines.push('| Category | Score | Status |');
  lines.push('|----------|-------|--------|');
  lines.push(`| Core Principles | ${result.categoryScores.core.toFixed(2)}% | ${getStatusEmoji(result.categoryScores.core)} |`);
  lines.push(`| Implementation | ${result.categoryScores.implementation.toFixed(2)}% | ${getStatusEmoji(result.categoryScores.implementation)} |`);
  lines.push(`| Operational | ${result.categoryScores.operational.toFixed(2)}% | ${getStatusEmoji(result.categoryScores.operational)} |`);
  lines.push('');

  // Check summary
  const checksByStatus = {
    pass: result.checks.filter(c => c.status === 'pass').length,
    partial: result.checks.filter(c => c.status === 'partial').length,
    fail: result.checks.filter(c => c.status === 'fail').length,
    unknown: result.checks.filter(c => c.status === 'unknown').length
  };

  lines.push('## Check Summary');
  lines.push('');
  lines.push(`- ✅ **Pass**: ${checksByStatus.pass}/20`);
  lines.push(`- ⚠️  **Partial**: ${checksByStatus.partial}/20`);
  lines.push(`- ❌ **Fail**: ${checksByStatus.fail}/20`);
  lines.push(`- ❓ **Unknown**: ${checksByStatus.unknown}/20`);
  lines.push('');

  // Failed checks
  const failedChecks = result.checks.filter(c => c.status === 'fail');
  if (failedChecks.length > 0) {
    lines.push('## Failed Checks');
    lines.push('');
    failedChecks.forEach(check => {
      lines.push(`### ${check.section}. ${check.title}`);
      lines.push('');
      if (check.evidenceMissing.length > 0) {
        lines.push('**Missing Evidence:**');
        check.evidenceMissing.forEach(e => lines.push(`- ${e}`));
        lines.push('');
      }
      if (check.notes.length > 0) {
        lines.push('**Notes:**');
        check.notes.forEach(n => lines.push(`- ${n}`));
        lines.push('');
      }
    });
  }

  // Partial checks
  const partialChecks = result.checks.filter(c => c.status === 'partial');
  if (partialChecks.length > 0) {
    lines.push('## Partial Checks');
    lines.push('');
    partialChecks.forEach(check => {
      lines.push(`### ${check.section}. ${check.title}`);
      lines.push('');
      lines.push(`**Score**: ${(check.score * 100).toFixed(0)}%`);
      lines.push('');
      if (check.evidenceFound.length > 0) {
        lines.push('**Evidence Found:**');
        check.evidenceFound.forEach(e => lines.push(`- ${e}`));
        lines.push('');
      }
      if (check.evidenceMissing.length > 0) {
        lines.push('**Evidence Missing:**');
        check.evidenceMissing.forEach(e => lines.push(`- ${e}`));
        lines.push('');
      }
    });
  }

  // Evidence index
  lines.push('## Evidence Sources');
  lines.push('');
  lines.push(`- Code Structure: ${result.evidenceIndex.codeStructure.length} items`);
  lines.push(`- Artifacts: ${result.evidenceIndex.artifacts.length} items`);
  lines.push(`- Documentation: ${result.evidenceIndex.documentation.length} items`);
  lines.push(`- Missing: ${result.evidenceIndex.missing.length} items`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Helper: Get status emoji for score
 */
function getStatusEmoji(score) {
  if (score >= 95) return '✅ Excellent';
  if (score >= 80) return '✅ Good';
  if (score >= 60) return '⚠️ Partial';
  return '❌ Poor';
}

