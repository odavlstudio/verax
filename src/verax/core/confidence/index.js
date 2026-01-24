/**
 * CANONICAL CONFIDENCE API — Single Authority
 * 
 * All confidence computation throughout the product must route through this module.
 * This ensures determinism, policy application, and truth-aware scoring.
 * 
 * PHASE 25: Unified Confidence Entry Point
 * - One function, one output shape, no backdoors
 * - Backward compatible with existing finding.confidence fields
 * - Deterministic output for same inputs
 */

import { computeConfidence as computeLegacyConfidence } from '../../shared/legacy-confidence-bridge.js';
import { computeFinalConfidence } from './confidence-compute.js';

/**
 * RUNTIME BOUNDARY GUARD (Development Mode)
 * 
 * Detects if confidence computation is called from forbidden paths.
 * This prevents architectural regressions where modules try to bypass
 * the canonical confidence API.
 * 
 * Forbidden callers:
 * - Direct imports of detect/confidence-engine.legacy.js from detect modules
 * - Direct imports of legacy confidence files from non-core modules
 * - Any non-core module computing confidence independently
 */
function enforceConfidenceArchitecture() {
  // In production, skip this check for performance
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  // Guard: Only enable for unit tests and development
  if (process.env.NODE_ENV !== 'test' && !process.env.VERAX_ARCH_ENFORCE) {
    return;
  }

  // Extract call stack to identify caller
  const stack = new Error().stack || '';
  
  // Look for forbidden patterns in the stack
  const forbiddenPatterns = [
    // Calling from detect/ modules directly (they should use core/confidence)
    /at\s+.*\(.*\/src\/verax\/detect\/[^/]*\.js:/,
    // Calling from legacy confidence-engine imports
    /confidence-engine\.deprecated\.js/,
    /confidence-engine\.legacy\.js/,
    /confidence-engine\.js.*from.*detect/
  ];

  // Only warn on test mode (not blocking, to preserve behavior)
  const calledFromForbidden = forbiddenPatterns.some(pattern => pattern.test(stack));
  
  // Store for test verification (doesn't change behavior)
  if (calledFromForbidden && typeof globalThis !== 'undefined') {
    globalThis._architectureViolationDetected = true;
  }
}

// Minimal guard (dev-only, zero production cost)
const ENFORCE_BOUNDARIES = process.env.NODE_ENV === 'test' || process.env.VERAX_ARCH_ENFORCE === '1';

/**
 * CANONICAL CONFIDENCE COMPUTATION
 * 
 * This is the ONLY function that should be called for confidence scoring.
 * All detect/* modules must import from here, not from legacy engine directly.
 * 
 * @param {Object} params - Confidence computation parameters
 * @param {string} params.findingType - Type of finding
 * @param {Object} params.expectation - Expectation/promise metadata
 * @param {Object} params.sensors - Sensor data { network, console, uiSignals }
 * @param {Object} params.comparisons - Comparison data { hasUrlChange, hasDomChange, hasVisibleChange }
 * @param {Object} params.attemptMeta - Attempt metadata (optional)
 * @param {Object} params.evidenceIntent - Evidence intent outcomes (optional)
 * @param {Object} params.guardrailsOutcome - Guardrails assessment (optional)
 * @param {string} params.truthStatus - Truth status CONFIRMED|SUSPECTED|INFORMATIONAL|IGNORED (optional)
 * @param {Object} params.evidence - Evidence data (optional)
 * @param {Object} params.options - Options { policyPath, projectDir, determinismVerdict, verificationStatus }
 * 
 * @returns {Object} Canonical confidence object with backward-compatible fields:
 *   - score: number (0-100)
 *   - level: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'
 *   - explain: string[] (max 8 items, ordered by importance)
 *   - factors: { expectationStrength, sensorsPresent, evidenceSignals, penalties, boosts }
 *   - confidenceExplanation: { whyThisConfidence, whatWouldIncreaseConfidence, whatWouldReduceConfidence }
 *   - boundaryExplanation: string | null
 */
export function computeConfidence({
  findingType,
  expectation,
  sensors = {},
  comparisons = {},
  attemptMeta = {},
  evidenceIntent = null,
  guardrailsOutcome = null,
  truthStatus = null,
  evidence = {},
  options = {}
}) {
    // ARCHITECTURAL ENFORCEMENT: Guard against bypass attempts
    if (ENFORCE_BOUNDARIES) {
      enforceConfidenceArchitecture();
    }

  // Step 1: Compute raw confidence using legacy engine (for backward compatibility)
  // This produces the 0-100 scale and detailed factor analysis
  const legacyResult = computeLegacyConfidence({
    findingType,
    expectation,
    sensors,
    comparisons,
    attemptMeta
  });

  // Step 2: If no enhancement parameters provided, return legacy result directly
  // (maintains 100% backward compatibility for detection phase)
  if (!evidenceIntent && !guardrailsOutcome && !truthStatus && !evidence.evidencePackage) {
    return legacyResult;
  }

  // Step 3: Otherwise, compute enhanced confidence with full truth-aware reconciliation
  // This applies evidence intent penalties, guardrails adjustments, and invariant enforcement
  const enhancedResult = computeFinalConfidence({
    findingType,
    expectation,
    sensors,
    comparisons,
    evidence,
    rawSignals: sensors,
    evidenceIntent,
    guardrailsOutcome,
    truthStatus,
    options
  });

  // Step 4: Convert enhanced result back to legacy shape for backward compatibility
  // (map 0-1 scale to 0-100, ensure all expected fields exist)
  return mapEnhancedToCanonical(enhancedResult, legacyResult);
}

/**
 * Map enhanced confidence result (0-1 scale) to canonical shape (0-100 scale, legacy-compatible)
 * 
 * @param {Object} enhanced - Result from computeFinalConfidence (0-1 scale)
 * @param {Object} legacy - Result from legacy engine (0-100 scale, for fallback)
 * @returns {Object} Canonical shape with backward-compatible fields
 */
function mapEnhancedToCanonical(enhanced, legacy) {
  // If enhanced result is unavailable, return legacy result
  if (!enhanced) {
    return legacy;
  }

  // Scale enhanced score from 0-1 to 0-100 for consistency
  const scaledScore = Math.round((enhanced.confidenceAfter || 0) * 100);

  // Use enhanced level if available, otherwise derive from scaled score
  let level = enhanced.confidenceLevel || 'LOW';
  if (!enhanced.confidenceLevel) {
    // Fallback level derivation (legacy logic)
    if (scaledScore >= 80) {
      level = 'HIGH';
    } else if (scaledScore >= 55) {
      level = 'MEDIUM';
    } else {
      level = 'LOW';
    }
  }

  // Build explanation array
  // Priority: reasonCodes > enhanced explanation > legacy explain
  const explain = enhanced.reasonCodes
    ? enhanced.reasonCodes.slice(0, 8)
    : (enhanced.topReasons && Array.isArray(enhanced.topReasons)
        ? enhanced.topReasons.slice(0, 8)
        : (Array.isArray(enhanced.explanation)
            ? enhanced.explanation.slice(0, 8)
            : (legacy.explain || [])));

  // Preserve or build factors object
  const factors = legacy.factors || {
    expectationStrength: enhanced.expectationProof ? 'PROVEN' : 'UNKNOWN',
    sensorsPresent: { network: false, console: false, ui: false },
    evidenceSignals: {},
    penalties: [],
    boosts: []
  };

  // Build confidence explanation from enhanced version
  const confidenceExplanation = enhanced.confidenceExplanation
    ? {
        whyThisConfidence: enhanced.confidenceExplanation.whyThisConfidence || '',
        whatWouldIncreaseConfidence: enhanced.confidenceExplanation.whatWouldIncreaseConfidence || [],
        whatWouldReduceConfidence: enhanced.confidenceExplanation.whatWouldReduceConfidence || []
      }
    : (enhanced.topReasons
        ? {
            whyThisConfidence: enhanced.topReasons.join('; '),
            whatWouldIncreaseConfidence: ['Provide complete evidence', 'Achieve PROVEN expectation strength'],
            whatWouldReduceConfidence: ['Incomplete evidence', 'Non-deterministic execution']
          }
        : (legacy.confidenceExplanation || {
            whyThisConfidence: [],
            whatWouldIncreaseConfidence: [],
            whatWouldReduceConfidence: []
          }));

  // Return canonical shape
  return {
    score: scaledScore,
    level,
    explain,
    factors,
    confidenceExplanation,
    boundaryExplanation: legacy.boundaryExplanation || null,
    // Additional context fields (not legacy, but useful for enhanced mode)
    appliedInvariants: enhanced.appliedInvariants || [],
    truthStatus: enhanced.truthStatus || null,
    invariantViolations: enhanced.invariantViolations || [],
    // New policy-aware fields
    reasonCodes: enhanced.reasonCodes || [],
    appliedPolicy: enhanced.appliedPolicy || {},
    meta: enhanced.meta || legacy.meta || null
  };
}

/**
 * Legacy export for backward compatibility
 * (some code may have imported from core/confidence-engine.js directly)
 */
export { computeConfidence as computeConfidenceForFinding };
