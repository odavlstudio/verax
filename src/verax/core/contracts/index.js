/**
 * VERAX Core Contracts - Main export
 * 
 * Single source of truth for:
 * - Canonical type definitions (Finding, Evidence, Confidence, Observation, Signals)
 * - All enums (CONFIDENCE_LEVEL, FINDING_STATUS, IMPACT, USER_RISK, OWNERSHIP, etc.)
 * - Runtime validators that enforce contracts
 * - Evidence Law enforcement (findings without evidence cannot be CONFIRMED)
 */

export {
  CONFIDENCE_LEVEL,
  FINDING_STATUS,
  FINDING_TYPE,
  IMPACT,
  USER_RISK,
  OWNERSHIP,
  EVIDENCE_TYPE,
  ALL_ENUMS
} from './types.js';

export {
  validateFinding,
  validateEvidence,
  validateConfidence,
  validateSignals,
  isEvidenceSubstantive,
  enforceContractsOnFindings
} from './validators.js';



