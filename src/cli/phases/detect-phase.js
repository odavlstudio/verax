import { detectSilentFailures } from '../util/detection-engine.js';
import { batchValidateFindings } from '../../verax/detect/constitution-validator.js';

/**
 * Real detection engine that converts learned promises + observed evidence
 * into constitutional findings.
 * 
 * @param {Object} learnData - { expectations, ... }
 * @param {Object} observeData - { observations, ... }
 * @param {string} _projectRoot 
 * @param {Function} _onProgress 
 * @returns {Promise<Object>}
 */
async function detectFindings(learnData, observeData, _projectRoot, _onProgress) {
  // Detect silent failures using real detection logic
  const findings = await detectSilentFailures(learnData, observeData);
  
  // All findings are already validated by detectSilentFailures,
  // but double-check through constitutional validator
  const { valid: validatedFindings, dropped, downgraded } = batchValidateFindings(findings);
  
  // Compute statistics
  const stats = {
    total: validatedFindings.length,
    silentFailures: validatedFindings.filter(f => f.type === 'dead_interaction_silent_failure').length,
    brokenNavigation: validatedFindings.filter(f => f.type === 'broken_navigation_promise').length,
    silentSubmissions: validatedFindings.filter(f => f.type === 'silent_submission').length,
    bySeverity: {
      HIGH: validatedFindings.filter(f => f.severity === 'HIGH').length,
      MEDIUM: validatedFindings.filter(f => f.severity === 'MEDIUM').length,
      LOW: validatedFindings.filter(f => f.severity === 'LOW').length,
    },
    byStatus: {
      CONFIRMED: validatedFindings.filter(f => f.status === 'CONFIRMED').length,
      SUSPECTED: validatedFindings.filter(f => f.status === 'SUSPECTED').length,
      INFORMATIONAL: validatedFindings.filter(f => f.status === 'INFORMATIONAL').length,
    },
    enforcement: {
      dropped,
      downgraded
    }
  };
  
  return {
    findings: validatedFindings,
    stats,
    enforcement: stats.enforcement,  // Also export at top level for writeFindingsJson
  };
}

/**
 * Detect Phase
 * 
 * PHASE 1 Constitutional Locking:
 * - All findings must pass validateFindingConstitution()
 * - Invalid findings are dropped safely (not propagated)
 * - Process continues even if findings are dropped
 * 
 * @param {Object} params - { learnData, observeData, projectRoot, events }
 * @returns {Promise<Object>} detectData
 */
export async function detectPhase(params) {
  const { learnData, observeData, projectRoot, events } = params;
  
  try {
    const detectData = await detectFindings(
      learnData,
      observeData,
      projectRoot,
      (progress) => {
        events.emit(progress.event, progress);
      }
    );
    
    return detectData;
  } catch (error) {
    // Constitution violations must not crash the process
    // Drop findings safely and continue
    console.warn('Warning: Constitution check failed during detection:', error.message);
    return {
      findings: [],
      stats: { 
        total: 0, 
        bySeverity: {},
        enforcement: { dropped: 0, downgraded: 0, error: error.message }
      },
    };
  }
}
