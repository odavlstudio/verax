/**
 * STAGE 4.2: Judgment Object Schema
 * 
 * Replaces finding objects with judgment objects.
 * 
 * JUDGMENT OBJECT:
 * - id: stable identifier
 * - promiseId: reference to promise
 * - promiseKind: kind of promise (navigate, network.request, etc.)
 * - outcome: canonical outcome from observation
 * - judgment: JUDGMENT_TYPES classification
 * - severity: derived from judgment + promise kind
 * - reason: human-readable explanation
 * - evidenceRefs: references to evidence
 * - determinismHash: stable hash of evidence + outcome
 * 
 * NO confidence scores, NO heuristics.
 */

import { createHash } from 'crypto';
import { getTimeProvider } from '../../cli/util/support/time-provider.js';
import { mapOutcomeToJudgment } from './judgment-mapper.js';
import { deriveSeverity } from './severity-mapper.js';

/**
 * Create a judgment object from promise capture and observation
 * 
 * This is the main entry point for creating judgments in STAGE 4.
 * 
 * @typedef {Object} JudgmentObject
 * @property {string} id - Stable judgment ID
 * @property {string} promiseId - Promise identifier
 * @property {string} promiseKind - Kind of promise
 * @property {string} outcome - Canonical outcome
 * @property {string} judgment - Judgment classification
 * @property {string} severity - Severity level
 * @property {string} reason - Human-readable explanation
 * @property {Array<string>} evidenceRefs - References to evidence
 * @property {string} determinismHash - Stable hash for determinism
 * @property {string} timestamp - ISO timestamp
 * @property {Object} context - Additional context
 * 
 * @param {Object} promiseCapture - Promise capture from STAGE 3
 * @param {Object} observation - Observation from STAGE 3
 * @returns {JudgmentObject}
 */
export function createJudgment(promiseCapture, observation) {
  // Extract from promise capture
  const promiseId = promiseCapture.id;
  const promiseKind = promiseCapture.promiseKind;
  const promiseValue = promiseCapture.intent || promiseCapture.value;

  // Extract from observation
  const outcome = observation.outcome;
  const acknowledgment = observation.acknowledgmentLevel;
  const silenceKind = observation.silenceKind;
  const signals = observation.signals || [];
  const networkStatus = observation.networkStatus || null;

  // Map outcome to judgment
  const judgment = mapOutcomeToJudgment(outcome);

  // Derive severity
  const severity = deriveSeverity(judgment, promiseKind);

  // Generate reason
  const reason = generateReason(judgment, promiseKind, outcome);

  // Create evidence refs
  const evidenceRefs = buildEvidenceRefs(observation);

  // Generate determinism hash
  const determinismHash = generateDeterminismHash({
    promiseId,
    promiseKind,
    promiseValue,
    outcome,
    judgment,
    evidenceRefs,
    acknowledgment,
    silenceKind,
    signals,
    networkStatus,
  });

  // Generate stable ID
  const id = generateJudgmentId(promiseId, determinismHash);

  // Build judgment object
  const judgmentObject = {
    id,
    promiseId,
    promiseKind,
    outcome,
    judgment,
    severity,
    reason,
    evidenceRefs: [...evidenceRefs].sort(), // Sort for determinism
    determinismHash,
    timestamp: getTimeProvider().iso(),
    context: {
      promiseValue,
      acknowledgment,
      silenceKind,
      signals,
      networkStatus,
    },
  };

  return judgmentObject;
}

/**
 * Generate human-readable reason for judgment
 * 
 * @param {string} judgment - Judgment type
 * @param {string} promiseKind - Promise kind
 * @param {string} outcome - Outcome type
 * @returns {string}
 */
function generateReason(judgment, promiseKind, outcome) {
  const templates = {
    PASS: `Promise fulfilled: ${promiseKind} completed successfully`,
    WEAK_PASS: `Promise partially fulfilled: ${promiseKind} completed with partial success`,
    FAILURE_SILENT: `Promise broken: ${promiseKind} failed silently without user feedback`,
    FAILURE_MISLEADING: `Promise broken: ${promiseKind} produced misleading feedback`,
    NEEDS_REVIEW: `Promise ambiguous: ${promiseKind} outcome requires manual review`,
  };

  return templates[judgment] || `Promise evaluated: ${promiseKind} resulted in ${outcome}`;
}

/**
 * Build evidence references from observation
 * 
 * @param {Object} observation - Observation object
 * @returns {Array<string>}
 */
function buildEvidenceRefs(observation) {
  const refs = [];

  if (observation.acknowledgmentLevel) {
    refs.push(`acknowledgment:${observation.acknowledgmentLevel}`);
  }

  if (observation.silenceKind) {
    refs.push(`silence:${observation.silenceKind}`);
  }

  if (observation.signals && Array.isArray(observation.signals)) {
    for (const signal of observation.signals) {
      refs.push(`signal:${signal}`);
    }
  }

  if (observation.networkStatus) {
    refs.push(`network:${observation.networkStatus.lastResponseStatus || 'unknown'}`);
  }

  return refs.sort(); // Sort for determinism
}

/**
 * Generate determinism hash from evidence and outcome
 * 
 * MUST be stable: same inputs → same hash
 * 
 * @param {Object} data - Data to hash
 * @returns {string} - Hex hash (full SHA256 - 64 chars)
 */
export function generateDeterminismHash(data) {
  // Sort keys for determinism
  const sortedData = sortObjectKeys(data);
  
  // JSON stringify with sorted keys
  const jsonStr = JSON.stringify(sortedData, null, 0);
  
  // SHA256 hash
  const hash = String(
    createHash('sha256')
      .update(jsonStr, 'utf8')
      .digest('hex')
  );
  
  // Return full hash (64 hex chars) for determinism contract
  return hash;
}

/**
 * Generate stable judgment ID
 * 
 * @param {string} promiseId - Promise identifier
 * @param {string} determinismHash - Determinism hash
 * @returns {string}
 */
export function generateJudgmentId(promiseId, determinismHash) {
  return `judgment-${promiseId}-${determinismHash}`;
}

/**
 * Sort object keys recursively for determinism
 * 
 * @param {any} obj - Object to sort
 * @returns {any} - Sorted object
 */
function sortObjectKeys(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys).sort();
  }

  if (typeof obj === 'object') {
    const sorted = {};
    const keys = Object.keys(obj).sort();
    
    for (const key of keys) {
      sorted[key] = sortObjectKeys(obj[key]);
    }
    
    return sorted;
  }

  return obj;
}

/**
 * Validate judgment object structure
 * 
 * @param {Object} judgment - Judgment to validate
 * @returns {Object} - { valid: boolean, errors: Array<string> }
 */
export function validateJudgment(judgment) {
  const errors = [];

  // Required fields
  const requiredFields = ['id', 'promiseId', 'promiseKind', 'outcome', 'judgment', 'severity', 'reason', 'evidenceRefs', 'determinismHash'];
  
  for (const field of requiredFields) {
    if (!judgment[field] && judgment[field] !== '') {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // evidenceRefs must be array
  if (!Array.isArray(judgment.evidenceRefs)) {
    errors.push('evidenceRefs must be an array');
  }

  // id must match format
  if (judgment.id && !judgment.id.startsWith('judgment-')) {
    errors.push('id must start with "judgment-"');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sort judgments deterministically
 * 
 * Priority: judgment type (failures first), then promiseId, then id
 * 
 * @param {Array<JudgmentObject>} judgments - Judgments to sort
 * @returns {Array<JudgmentObject>} - Sorted judgments
 */
export function sortJudgmentsDeterministically(judgments) {
  return [...judgments].sort((a, b) => {
    // First by judgment priority (failures first)
    const priorityA = getJudgmentPriority(a.judgment);
    const priorityB = getJudgmentPriority(b.judgment);
    
    if (priorityA !== priorityB) {
      return priorityB - priorityA; // Higher priority first
    }

    // Then by promiseId
    if (a.promiseId !== b.promiseId) {
      return a.promiseId.localeCompare(b.promiseId);
    }

    // Finally by id
    return a.id.localeCompare(b.id);
  });
}

/**
 * Get judgment priority for sorting
 * 
 * @param {string} judgment - Judgment type
 * @returns {number}
 */
function getJudgmentPriority(judgment) {
  const priorities = {
    'FAILURE_MISLEADING': 100,
    'FAILURE_SILENT': 90,
    'NEEDS_REVIEW': 50,
    'WEAK_PASS': 20,
    'PASS': 10,
  };

  return priorities[judgment] ?? 0;
}
