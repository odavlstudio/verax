/**
 * EVIDENCE INTENT LEDGER
 * 
 * Audit trail of evidence capture attempts per finding.
 * Records what evidence was required, what was captured, and what failed.
 * This is NOT proof; it is an audit trail proving we attempted to capture evidence.
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { EVIDENCE_CAPTURE_STAGE, EVIDENCE_CAPTURE_FAILURE_CODES as _EVIDENCE_CAPTURE_FAILURE_CODES } from './evidence-capture-service.js';

/**
 * Required evidence fields for CONFIRMED findings (stable)
 */
export const REQUIRED_EVIDENCE_FIELDS = [
  'trigger.source',
  'before.screenshot',
  'after.screenshot',
  'before.url',
  'after.url',
  'action.interaction',
  'signals.network',
  'signals.uiSignals'
];

/**
 * Build evidence intent entry for a finding
 * 
 * @param {Object} finding - Finding object
 * @param {Object} evidencePackage - Evidence package
 * @param {Array<Object>} captureFailures - Array of EvidenceCaptureFailure objects
 * @returns {Object} Evidence intent entry
 */
export function buildEvidenceIntentEntry(finding, evidencePackage, captureFailures = []) {
  const findingIdentity = finding.findingId || finding.id || `finding-${Date.now()}`;
  
  // Determine required fields based on finding severity
  const requiredFields = finding.severity === 'CONFIRMED' || finding.status === 'CONFIRMED' 
    ? REQUIRED_EVIDENCE_FIELDS 
    : [];
  
  // Check capture outcomes for each required field
  const captureOutcomes = {};
  const missingFields = [];
  
  for (const field of requiredFields) {
    const [section, key] = field.split('.');
    
    let captured = false;
    let failure = null;
    
    // Check if field exists in evidence package
    if (section === 'trigger' && evidencePackage.trigger?.[key]) {
      captured = true;
    } else if (section === 'before' && evidencePackage.before?.[key]) {
      captured = true;
    } else if (section === 'after' && evidencePackage.after?.[key]) {
      captured = true;
    } else if (section === 'action' && evidencePackage.action?.[key]) {
      captured = true;
    } else if (section === 'signals' && evidencePackage.signals?.[key]) {
      captured = true;
    }
    
    // Check if there was a capture failure for this field
    if (!captured) {
      const fieldFailure = captureFailures.find(f => {
        if (field.includes('screenshot') && f.stage.includes('SCREENSHOT')) return true;
        if (field.includes('domSignature') && f.stage === EVIDENCE_CAPTURE_STAGE.DOM_SIGNATURE) return true;
        if (field.includes('url') && f.stage === EVIDENCE_CAPTURE_STAGE.URL) return true;
        if (field.includes('uiSignals') && f.stage === EVIDENCE_CAPTURE_STAGE.UISIGNALS) return true;
        if (field.includes('network') && f.stage === EVIDENCE_CAPTURE_STAGE.NETWORK) return true;
        return false;
      });
      
      if (fieldFailure) {
        failure = {
          stage: fieldFailure.stage,
          reasonCode: fieldFailure.reasonCode,
          reason: fieldFailure.reason
        };
      }
      
      missingFields.push(field);
    }
    
    captureOutcomes[field] = {
      required: true,
      captured,
      failure
    };
  }
  
  return {
    findingIdentity,
    findingType: finding.type || 'finding',
    severity: finding.severity || finding.status || 'SUSPECTED',
    requiredFields,
    captureOutcomes,
    missingFields,
    evidencePackageComplete: evidencePackage.isComplete === true,
    timestamp: new Date().toISOString()
  };
}

/**
 * Write evidence intent ledger
 * 
 * @param {string} runDir - Run directory
 * @param {Array<Object>} findings - Array of findings with evidence packages
 * @param {Map<string, Array<Object>>} captureFailuresMap - Map of findingId -> capture failures
 * @returns {string} Path to written evidence.intent.json
 */
export function writeEvidenceIntentLedger(runDir, findings, captureFailuresMap = new Map()) {
  const intentPath = resolve(runDir, 'evidence.intent.json');
  
  // Build intent entries (deterministic ordering by findingIdentity)
  const entries = [];
  
  for (const finding of findings || []) {
    const findingIdentity = finding.findingId || finding.id || `finding-${findings.indexOf(finding)}`;
    const captureFailures = captureFailuresMap.get(findingIdentity) || [];
    const evidencePackage = finding.evidencePackage || {};
    
    const entry = buildEvidenceIntentEntry(finding, evidencePackage, captureFailures);
    entries.push(entry);
  }
  
  // Sort by findingIdentity for deterministic ordering
  entries.sort((a, b) => a.findingIdentity.localeCompare(b.findingIdentity));
  
  const ledger = {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalFindings: entries.length,
    entries
  };
  
  writeFileSync(intentPath, JSON.stringify(ledger, null, 2) + '\n');
  
  return intentPath;
}

/**
 * Read evidence intent ledger
 * 
 * @param {string} runDir - Run directory
 * @returns {Object | null} Evidence intent ledger or null if not found
 */
export function readEvidenceIntentLedger(runDir) {
  const intentPath = resolve(runDir, 'evidence.intent.json');
  
  if (!existsSync(intentPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(intentPath, 'utf-8');
  // @ts-expect-error - readFileSync with encoding returns string
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

