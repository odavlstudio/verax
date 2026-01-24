/**
 * Failure Cause derivation (FCI) - Evidence-backed cause attribution
 * 
 * Pure, deterministic module that derives likely causes from confirmed findings.
 * Each cause has explicit evidence conditions and is never guessed.
 * 
 * Rules:
 * 1) No evidence -> no cause
 * 2) Causes phrased as "Likely cause:" statements
 * 3) Internal errors never reported as user bugs
 * 4) Deterministic output: same input => same causes, ordering, wording
 * 5) Confidence: LOW|MEDIUM only (never HIGH)
 */

/**
 * Catalog order: causes are sorted by this order first, then by id as tie-breaker.
 * This ensures stable, predictable cause ordering across all scenarios.
 */
const CATALOG_ORDER = ['C1_SELECTOR_MISMATCH', 'C2_STATE_MUTATION_NO_UI', 'C3_DEAD_CLICK', 'C4_NAVIGATION_NO_RENDER', 'C5_FORM_NO_FEEDBACK', 'C6_VALIDATION_NOT_SHOWN', 'C7_NETWORK_SILENT'];

/**
 * Catalog of detectable causes with evidence conditions
 * Ordered by catalog position, then id for deterministic processing
 */
const CAUSE_CATALOG = [
  {
    id: 'C1_SELECTOR_MISMATCH',
    title: 'Element not found or selector mismatch',
    condition: (finding) => {
      const ev = finding.evidence || {};
      return (
        (ev.targetElementMissing === true) ||
        (ev.staleHandle === true) ||
        (ev.clickAttempted === true && ev.targetElement === false) ||
        (ev.locatorResolution === 0) ||
        (ev.domSnapshotMissing && 
          (ev.domSnapshotMissing.includes('id') || ev.domSnapshotMissing.includes('class') || ev.domSnapshotMissing.includes('text')))
      );
    },
    statement: () => 
      'Likely cause: The UI element being interacted with could not be found or was stale at interaction time.',
    evidence_refs: (finding) => {
      const refs = [];
      if (finding.evidence?.targetElementMissing === true) refs.push('evidence.targetElementMissing=true');
      if (finding.evidence?.staleHandle === true) refs.push('evidence.staleHandle=true');
      if (finding.evidence?.locatorResolution === 0) refs.push('evidence.locatorResolution=0');
      if (finding.evidence?.domSnapshotMissing) refs.push('evidence.domSnapshotMissing');
      return refs;
    },
    confidenceScore: (finding) => {
      // MEDIUM if multiple signals, LOW otherwise
      const count = [
        finding.evidence?.targetElementMissing,
        finding.evidence?.staleHandle,
        finding.evidence?.locatorResolution === 0
      ].filter(Boolean).length;
      return count >= 2 ? 'MEDIUM' : 'LOW';
    }
  },
  
  {
    id: 'C2_STATE_MUTATION_NO_UI',
    title: 'State changed but UI did not update',
    condition: (finding) => {
      const ev = finding.evidence || {};
      return (
        ev.stateMutation === true &&
        ev.domChanged === false &&
        ev.navigationOccurred !== true &&
        ev.uiFeedback === false
      );
    },
    statement: () => 
      'Likely cause: Application state changed internally, but the UI did not re-render or reflect the change.',
    evidence_refs: (_finding) => 
      ['evidence.stateMutation=true', 'evidence.domChanged=false', 'evidence.uiFeedback=false'],
    confidenceScore: () => 'MEDIUM'
  },
  
  {
    id: 'C3_DEAD_CLICK',
    title: 'Interaction ran but produced no observable outcome',
    condition: (finding) => {
      const ev = finding.evidence || {};
      return (
        ev.interactionPerformed === true &&
        ev.networkActivity === false &&
        ev.navigationOccurred !== true &&
        ev.domChanged === false &&
        ev.userFeedback === false
      );
    },
    statement: () => 
      'Likely cause: The interaction ran but had no handler or the handler did nothing (dead/no-op click).',
    evidence_refs: (_finding) => 
      ['evidence.interactionPerformed=true', 'evidence.networkActivity=false', 'evidence.domChanged=false', 'evidence.userFeedback=false'],
    confidenceScore: () => 'MEDIUM'
  },
  
  {
    id: 'C4_NAVIGATION_NO_RENDER',
    title: 'Navigation attempted but content did not load',
    condition: (finding) => {
      const ev = finding.evidence || {};
      return (
        (ev.navigationAttempted === true || ev.urlChangeAttempted === true || ev.linkClicked === true) &&
        (ev.urlChanged === false || (ev.urlChanged === true && ev.contentStillLoading === true)) &&
        (ev.mainContentChanged === false || ev.mainContentBlank === true)
      );
    },
    statement: () => 
      'Likely cause: Navigation was triggered but the target route either did not change or did not render visible content.',
    evidence_refs: (finding) => {
      const refs = [];
      if (finding.evidence?.navigationAttempted || finding.evidence?.urlChangeAttempted || finding.evidence?.linkClicked) {
        refs.push('evidence.navigationAttempted|urlChangeAttempted|linkClicked=true');
      }
      if (finding.evidence?.urlChanged === false) refs.push('evidence.urlChanged=false');
      if (finding.evidence?.mainContentChanged === false) refs.push('evidence.mainContentChanged=false');
      return refs;
    },
    confidenceScore: () => 'MEDIUM'
  },
  
  {
    id: 'C5_FORM_NO_FEEDBACK',
    title: 'Form submitted but no success or error message shown',
    condition: (finding) => {
      const ev = finding.evidence || {};
      return (
        ev.submitInteraction === true &&
        (ev.networkRequestOccurred === true || ev.submitEventDetected === true) &&
        ev.successFeedback === false &&
        ev.errorFeedback === false &&
        ev.navigationAfterSubmit !== true
      );
    },
    statement: () => 
      'Likely cause: Form submission was sent to the server, but the UI did not show a success or error message.',
    evidence_refs: (_finding) => 
      ['evidence.submitInteraction=true', 'evidence.successFeedback=false', 'evidence.errorFeedback=false'],
    confidenceScore: () => 'MEDIUM'
  },
  
  {
    id: 'C6_VALIDATION_NOT_SHOWN',
    title: 'Validation expected but feedback not displayed',
    condition: (finding) => {
      const ev = finding.evidence || {};
      return (
        ev.formOrValidationPromise === true &&
        ev.invalidSubmitAttempted === true &&
        ev.inlineValidationFeedback === false
      );
    },
    statement: () => 
      'Likely cause: Form field validation was expected to show inline feedback, but no error message appeared.',
    evidence_refs: (_finding) => 
      ['evidence.formOrValidationPromise=true', 'evidence.invalidSubmitAttempted=true', 'evidence.inlineValidationFeedback=false'],
    confidenceScore: () => 'LOW'
  },
  
  {
    id: 'C7_NETWORK_SILENT',
    title: 'Network request failed silently without user feedback',
    condition: (finding) => {
      const ev = finding.evidence || {};
      return (
        (ev.networkFailure === true || ev.httpError === true || ev.fetchError === true) &&
        ev.uiFeedback === false &&
        ev.domChanged === false
      );
    },
    statement: () => 
      'Likely cause: A network request failed (4xx/5xx or connection error), but the UI showed no error message.',
    evidence_refs: (finding) => {
      const refs = [];
      if (finding.evidence?.networkFailure === true) refs.push('evidence.networkFailure=true');
      if (finding.evidence?.httpError === true) refs.push('evidence.httpError=true');
      if (finding.evidence?.fetchError === true) refs.push('evidence.fetchError=true');
      refs.push('evidence.uiFeedback=false');
      return refs;
    },
    confidenceScore: () => 'MEDIUM'
  }
];

/**
 * derive likely causes for a finding.
 * Only returns causes where evidence conditions are met.
 * Causes are ordered deterministically by catalog order.
 * 
 * @param {Object} finding - Finding object with evidence property
 * @returns {Array} Array of cause objects, sorted by id. Empty if no evidence.
 */
export function deriveCauses(finding) {
  if (!finding) {
    return [];
  }
  
  // Enforce Evidence Law: no evidence -> no causes
  if (!finding.evidence || Object.keys(finding.evidence).length === 0) {
    return [];
  }
  
  const detectedCauses = [];
  
  for (const causeDef of CAUSE_CATALOG) {
    if (causeDef.condition(finding)) {
      const cause = {
        id: causeDef.id,
        title: causeDef.title,
        statement: causeDef.statement(),
        evidence_refs: causeDef.evidence_refs(finding),
        confidence: causeDef.confidenceScore(finding)
      };
      detectedCauses.push(cause);
    }
  }
  
  // Sort deterministically by catalog order, then by id
  detectedCauses.sort((a, b) => {
    const aPos = CATALOG_ORDER.indexOf(a.id);
    const bPos = CATALOG_ORDER.indexOf(b.id);
    if (aPos !== bPos) {
      return aPos - bPos;
    }
    return a.id.localeCompare(b.id);
  });
  
  return detectedCauses;
}

/**
 * Batch derive causes for all findings in a report.
 * Pure function: same input => same causes in same order.
 * 
 * @param {Array} findings - Array of finding objects
 * @returns {Object} Map of finding.id -> causes array
 */
export function deriveCausesForFindings(findings) {
  const causesMap = {};
  
  if (!findings || !Array.isArray(findings)) {
    return causesMap;
  }
  
  for (const finding of findings) {
    const causes = deriveCauses(finding);
    if (causes.length > 0) {
      causesMap[finding.id] = causes;
    }
  }
  
  return causesMap;
}

/**
 * Attach causes to a finding object (pure function).
 * Returns a new finding object with causes attached.
 * Original finding is not mutated.
 * 
 * @param {Object} finding - Finding to augment
 * @returns {Object} New finding object with causes array added
 */
export function attachCausesToFinding(finding) {
  if (!finding) {
    return finding;
  }
  const causes = deriveCauses(finding);
  return {
    ...finding,
    causes
  };
}

/**
 * Filter findings to only those with causes.
 * Useful for reporting only findings with explanation.
 * 
 * @param {Array} findings - Array of findings
 * @returns {Array} Findings with non-empty causes array
 */
export function findingsWithCauses(findings) {
  if (!findings || !Array.isArray(findings)) {
    return [];
  }
  
  return findings.filter(f => {
    const causes = deriveCauses(f);
    return causes.length > 0;
  });
}








