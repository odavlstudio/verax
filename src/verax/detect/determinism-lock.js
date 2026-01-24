/**
 * STAGE 4.6: Determinism Lock
 * 
 * Ensures deterministic sorting and comparison of judgments.
 * Same reality MUST produce same judgment array order and same hash.
 * 
 * RULES:
 * - Stable sort order across identical inputs
 * - Deterministic hash for judgment arrays
 * - No randomness, no timestamps in sorting
 * - Reproducible across different runs
 */

import crypto from 'node:crypto';

/**
 * Sort judgments deterministically
 * 
 * Sorting hierarchy:
 * 1. promiseId (stable ID from capture)
 * 2. judgment type (FAILURE_MISLEADING > FAILURE_SILENT > NEEDS_REVIEW > WEAK_PASS > PASS)
 * 3. severity (CRITICAL > HIGH > MEDIUM > LOW)
 * 4. determinismHash (stable hash from evidence)
 * 
 * @param {Array<Object>} judgments - Unsorted judgments
 * @returns {Array<Object>} - Sorted judgments
 */
export function sortJudgmentsDeterministically(judgments) {
  if (!judgments || judgments.length === 0) {
    return [];
  }

  // Create copy to avoid mutation
  const sorted = [...judgments];

  // Define judgment priority (higher = more severe)
  const judgmentPriority = {
    FAILURE_MISLEADING: 5,
    FAILURE_SILENT: 4,
    NEEDS_REVIEW: 3,
    WEAK_PASS: 2,
    PASS: 1,
  };

  // Define severity priority (higher = more severe)
  const severityPriority = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  // Stable sort
  sorted.sort((a, b) => {
    // 1. Sort by promiseId (stable identifier)
    if (a.promiseId !== b.promiseId) {
      return a.promiseId.localeCompare(b.promiseId);
    }

    // 2. Sort by judgment severity
    const aPriority = judgmentPriority[a.judgment] || 0;
    const bPriority = judgmentPriority[b.judgment] || 0;
    if (aPriority !== bPriority) {
      return bPriority - aPriority; // Higher priority first
    }

    // 3. Sort by severity
    const aSeverity = severityPriority[a.severity] || 0;
    const bSeverity = severityPriority[b.severity] || 0;
    if (aSeverity !== bSeverity) {
      return bSeverity - aSeverity; // Higher severity first
    }

    // 4. Sort by determinismHash (stable hash from evidence)
    return a.determinismHash.localeCompare(b.determinismHash);
  });

  return sorted;
}

/**
 * Generate deterministic hash for judgment array
 * 
 * Hash includes:
 * - All judgment determinismHashes (sorted)
 * - Judgment types
 * - Severities
 * 
 * Excludes:
 * - Timestamps
 * - IDs (except promiseId which is stable)
 * 
 * @param {Array<Object>} judgments - Judgments array
 * @returns {string} - SHA256 hash
 */
export function generateJudgmentArrayHash(judgments) {
  if (!judgments || judgments.length === 0) {
    return generateHash('empty-judgment-array');
  }

  // Sort first to ensure deterministic order
  const sorted = sortJudgmentsDeterministically(judgments);

  // Extract deterministic fields
  const hashableData = sorted.map(j => ({
    promiseId: j.promiseId,
    judgment: j.judgment,
    severity: j.severity,
    determinismHash: j.determinismHash,
  }));

  // Generate hash
  const canonical = JSON.stringify(hashableData);
  return generateHash(canonical);
}

/**
 * Compare two judgment arrays for equivalence
 * 
 * Checks:
 * - Same number of judgments
 * - Same judgment types
 * - Same severities
 * - Same determinismHashes
 * 
 * @param {Array<Object>} judgmentsA - First array
 * @param {Array<Object>} judgmentsB - Second array
 * @returns {boolean} - True if equivalent
 */
export function areJudgmentArraysEquivalent(judgmentsA, judgmentsB) {
  if (!judgmentsA && !judgmentsB) return true;
  if (!judgmentsA || !judgmentsB) return false;
  
  if (judgmentsA.length !== judgmentsB.length) return false;

  // Compare hashes for quick check
  const hashA = generateJudgmentArrayHash(judgmentsA);
  const hashB = generateJudgmentArrayHash(judgmentsB);
  
  return hashA === hashB;
}

/**
 * Verify determinism contract
 * 
 * Checks:
 * - All judgments have determinismHash
 * - All determinismHashes are valid SHA256
 * - No duplicate promiseIds
 * 
 * @param {Array<Object>} judgments - Judgments to verify
 * @throws {Error} - If determinism violated
 */
export function verifyDeterminismContract(judgments) {
  if (!judgments || judgments.length === 0) {
    return; // Empty array is valid
  }

  const seenPromiseIds = new Set();

  for (const judgment of judgments) {
    // Check determinismHash exists
    if (!judgment.determinismHash) {
      throw new Error(`Judgment missing determinismHash: ${judgment.id}`);
    }

    // Check determinismHash is valid SHA256 (64 hex chars)
    if (!/^[a-f0-9]{64}$/.test(judgment.determinismHash)) {
      throw new Error(`Invalid determinismHash format: ${judgment.determinismHash}`);
    }

    // Check for duplicate promiseIds
    if (seenPromiseIds.has(judgment.promiseId)) {
      throw new Error(`Duplicate promiseId: ${judgment.promiseId}`);
    }
    seenPromiseIds.add(judgment.promiseId);

    // Check required fields exist
    if (!judgment.judgment) {
      throw new Error(`Judgment missing judgment type: ${judgment.id}`);
    }

    if (!judgment.severity) {
      throw new Error(`Judgment missing severity: ${judgment.id}`);
    }
  }
}

/**
 * Create deterministic snapshot of judgments
 * 
 * Includes:
 * - Sorted judgments
 * - Judgment array hash
 * - Count by type
 * - Count by severity
 * 
 * @param {Array<Object>} judgments - Judgments
 * @returns {Object} - Snapshot
 */
export function createJudgmentSnapshot(judgments) {
  const sorted = sortJudgmentsDeterministically(judgments);
  const hash = generateJudgmentArrayHash(sorted);

  // Count by type
  const countsByType = {};
  const countsBySeverity = {};

  for (const judgment of sorted) {
    countsByType[judgment.judgment] = (countsByType[judgment.judgment] || 0) + 1;
    countsBySeverity[judgment.severity] = (countsBySeverity[judgment.severity] || 0) + 1;
  }

  return {
    hash,
    totalCount: sorted.length,
    countsByType,
    countsBySeverity,
    judgments: sorted,
  };
}

/**
 * Generate SHA256 hash
 * 
 * @param {string} data - Data to hash
 * @returns {string} - SHA256 hex string
 */
function generateHash(data) {
  return String(
    crypto
      .createHash('sha256')
      .update(data, 'utf8')
      .digest('hex')
  );
}

/**
 * Compare judgment snapshots
 * 
 * @param {Object} snapshotA - First snapshot
 * @param {Object} snapshotB - Second snapshot
 * @returns {Object} - Comparison result
 */
export function compareSnapshots(snapshotA, snapshotB) {
  return {
    identical: snapshotA.hash === snapshotB.hash,
    hashMatch: snapshotA.hash === snapshotB.hash,
    countMatch: snapshotA.totalCount === snapshotB.totalCount,
    typeCountsMatch: JSON.stringify(snapshotA.countsByType) === JSON.stringify(snapshotB.countsByType),
    severityCountsMatch: JSON.stringify(snapshotA.countsBySeverity) === JSON.stringify(snapshotB.countsBySeverity),
  };
}
