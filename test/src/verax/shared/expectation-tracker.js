/**
 * Wave 2 — Expectation Tracker
 * 
 * Generates stable expectation IDs and tracks expectation usage.
 */

import { createHash } from 'crypto';

/**
 * Generate stable expectation ID from expectation data
 * @param {Object} expectation - Expectation object
 * @param {string} type - Expectation type (navigation, network_action, state_action)
 * @returns {string} Stable ID (8-char hex hash)
 */
export function generateExpectationId(expectation, type) {
  // Create deterministic hash from type + source + target
  const source = expectation.source || expectation.sourceFile || expectation.evidence?.source || '';
  const target = expectation.targetPath || expectation.urlPath || '';
  const method = expectation.method || '';
  const stateKind = expectation.stateKind || '';
  const handlerRef = expectation.handlerRef || '';
  const sourceRef = expectation.source || '';
  
  // Build hash input string
  const hashInput = `${type}|${source}|${target}|${method}|${stateKind}|${handlerRef}|${sourceRef}`;
  
  // Generate stable 8-character hex hash
  const hash = createHash('sha256').update(hashInput).digest('hex');
  // @ts-expect-error - digest returns string
  return hash.substring(0, 8);
}

/**
 * Normalize expectation for tracking
 * @param {Object} expectation - Raw expectation from manifest
 * @param {string} type - Expectation type
 * @returns {Object} Normalized expectation with ID
 */
export function normalizeExpectation(expectation, type) {
  const id = generateExpectationId(expectation, type);
  
  // Extract source location
  let sourceFile = null;
  let sourceLine = null;
  let sourceColumn = null;
  
  if (expectation.evidence?.source) {
    sourceFile = expectation.evidence.source;
  } else if (expectation.sourceFile) {
    sourceFile = expectation.sourceFile;
  } else if (expectation.source) {
    // sourceRef format: "file:line:col"
    const sourceMatch = expectation.source.match(/^(.+):(\d+):(\d+)$/);
    if (sourceMatch) {
      sourceFile = sourceMatch[1];
      sourceLine = parseInt(sourceMatch[2], 10);
      sourceColumn = parseInt(sourceMatch[3], 10);
    } else {
      sourceFile = expectation.source;
    }
  }
  
  if (expectation.line !== undefined && expectation.line !== null) {
    sourceLine = expectation.line;
  }
  
  // Determine reason for PROVEN vs UNKNOWN
  let reason = 'unknown';
  if (expectation.proof === 'PROVEN_EXPECTATION') {
    if (type === 'navigation') {
      if (expectation.evidence) {
        reason = 'static route literal';
      } else if (expectation.matchAttribute) {
        reason = 'ast-derived jsx contract';
      }
    } else if (type === 'network_action') {
      if (expectation.source || expectation.handlerRef) {
        reason = 'ast-derived network contract';
      }
    } else if (type === 'state_action') {
      if (expectation.source || expectation.handlerRef) {
        reason = 'ast-derived state contract';
      }
    } else if (type === 'validation_block') {
      if (expectation.source || expectation.handlerRef) {
        reason = 'ast-derived validation contract';
      }
    }
  } else {
    reason = 'unproven expectation';
  }
  
  return {
    id,
    type,
    proof: expectation.proof || 'UNKNOWN_EXPECTATION',
    reason,
    source: {
      file: sourceFile,
      line: sourceLine,
      column: sourceColumn
    },
    used: false,
    usedReason: null,
    raw: expectation // Keep raw data for reference
  };
}

/**
 * Track all expectations from manifest
 * @param {Object} manifest - Manifest object
 * @returns {Array} Array of normalized expectations
 */
export function trackExpectations(manifest) {
  const expectations = [];
  
  // Track static expectations
  if (manifest.staticExpectations && manifest.staticExpectations.length > 0) {
    for (const exp of manifest.staticExpectations) {
      const type = exp.type === 'form_submission' ? 'network_action' : 'navigation';
      expectations.push(normalizeExpectation(exp, type));
    }
  }
  
  // Track SPA expectations
  if (manifest.spaExpectations && manifest.spaExpectations.length > 0) {
    for (const exp of manifest.spaExpectations) {
      expectations.push(normalizeExpectation(exp, 'navigation'));
    }
  }
  
  // Track action contracts (network, state, and validation)
  if (manifest.actionContracts && manifest.actionContracts.length > 0) {
    for (const contract of manifest.actionContracts) {
      if (contract.kind === 'NETWORK_ACTION' || contract.kind === 'network') {
        expectations.push(normalizeExpectation(contract, 'network_action'));
      } else if (contract.kind === 'STATE_ACTION' || contract.kind === 'state') {
        expectations.push(normalizeExpectation(contract, 'state_action'));
      } else if (contract.kind === 'VALIDATION_BLOCK') {
        expectations.push(normalizeExpectation(contract, 'validation_block'));
      }
    }
  }
  
  return expectations;
}

/**
 * Find expectation by ID
 * @param {Array} expectations - Tracked expectations
 * @param {string} expectationId - ID to find
 * @returns {Object|null} Matching expectation or null
 */
export function findExpectationById(expectations, expectationId) {
  return expectations.find(e => e.id === expectationId) || null;
}

/**
 * Find expectation by matching criteria (for detect phase)
 * @param {Array} expectations - Tracked expectations
 * @param {Object} criteria - Matching criteria
 * @returns {Object|null} Matching expectation or null
 */
export function findExpectationByCriteria(expectations, criteria) {
  const { type, source, target, method, stateKind, handlerRef } = criteria;
  
  for (const exp of expectations) {
    if (exp.type !== type) continue;
    
    // Match by source
    const expSource = exp.raw.source || exp.raw.sourceFile || exp.raw.evidence?.source;
    if (source && expSource && expSource.includes(source)) {
      // Check target for navigation
      if (type === 'navigation') {
        const expTarget = exp.raw.targetPath;
        if (expTarget === target) {
          return exp;
        }
      }
      // Check method/urlPath for network_action
      else if (type === 'network_action') {
        if (method && exp.raw.method === method && exp.raw.urlPath === target) {
          return exp;
        }
      }
      // Check stateKind for state_action
      else if (type === 'state_action') {
        if (stateKind && exp.raw.stateKind === stateKind) {
          return exp;
        }
      }
    }
    
    // Match by handlerRef
    if (handlerRef && exp.raw.handlerRef === handlerRef) {
      return exp;
    }
  }
  
  return null;
}

