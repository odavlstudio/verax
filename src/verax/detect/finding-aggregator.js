/**
 * Finding Aggregator
 * 
 * Groups raw findings into decision-level problems for executive review.
 * 
 * RULES:
 * - Deterministic grouping (no ML, no rules)
 * - Every problem references underlying findings
 * - Raw findings are preserved (never hidden)
 * - Evidence is deduplicated across group
 */

import { basename } from 'path';

/**
 * Aggregate findings into decision-level problems
 * 
 * @param {Array} findings - Raw findings from detection
 * @param {Object} manifest - Project manifest
 * @returns {Array} Array of ProblemGroup objects
 */
export function aggregateProblems(findings, manifest) {
  if (!findings || findings.length === 0) {
    return [];
  }

  // Group findings by page/route
  const byPage = groupByPage(findings);
  
  // Within each page, group by user intent
  const problems = [];
  
  for (const [page, pageFindings] of Object.entries(byPage)) {
    const intentGroups = groupByIntent(pageFindings);
    
    for (const [intent, intentFindings] of Object.entries(intentGroups)) {
      // Create a problem group
      const problem = createProblemGroup(page, intent, intentFindings, manifest);
      if (problem) {
        problems.push(problem);
      }
    }
  }
  
  // Sort by impact (HIGH > MEDIUM > LOW) then confidence (HIGH > LOW)
  problems.sort((a, b) => {
    const impactOrder = { HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
    const impactDiff = impactOrder[b.impact] - impactOrder[a.impact];
    if (impactDiff !== 0) return impactDiff;
    return b.confidence - a.confidence;
  });
  
  return problems;
}

/**
 * Group findings by page/route
 */
function groupByPage(findings) {
  const groups = {};
  
  for (const finding of findings) {
    const page = extractPage(finding);
    if (!groups[page]) {
      groups[page] = [];
    }
    groups[page].push(finding);
  }
  
  return groups;
}

/**
 * Extract page identifier from finding
 */
function extractPage(finding) {
  if (!finding.source || !finding.source.file) {
    return 'unknown';
  }
  
  // Extract filename without extension
  const file = finding.source.file;
  const filename = basename(file, '.jsx').replace(/\.js$/, '');
  
  // Map common patterns to routes
  if (filename.match(/dashboard/i)) return 'dashboard';
  if (filename.match(/profile/i)) return 'profile';
  if (filename.match(/settings/i)) return 'settings';
  if (filename.match(/home|index/i)) return 'home';
  if (filename.match(/login|auth/i)) return 'auth';
  
  return filename.toLowerCase();
}

/**
 * Group findings by user intent
 */
function groupByIntent(findings) {
  const groups = {};
  
  for (const finding of findings) {
    const intent = deriveIntent(finding);
    if (!groups[intent]) {
      groups[intent] = [];
    }
    groups[intent].push(finding);
  }
  
  return groups;
}

/**
 * derive user intent from finding
 */
function deriveIntent(finding) {
  const promise = finding.promise || {};
  const type = finding.type;
  const source = finding.source || {};
  const file = source.file || '';
  
  // Form submission
  if (type === 'form' || promise.kind === 'submit') {
    return 'save';
  }
  
  // Navigation
  if (type === 'navigation' || promise.kind === 'navigate') {
    return 'navigate';
  }
  
  // Auth actions - explicit button clicks
  if (promise.kind === 'click' && promise.value && promise.value.match(/login|logout|signin|signout/i)) {
    return 'auth';
  }
  
  // State changes - be more specific about what kind
  if (type === 'state' || promise.kind === 'state_mutation') {
    const value = promise.value || '';
    
    // Loading/saving state - usually indicates stuck loading indicator
    if (value.match(/loading|saving|submitting/i) || file.match(/dashboard/i)) {
      return 'loading_feedback';
    }
    
    // Auth-related state
    if (value.match(/auth|user|login/i) || file.match(/auth|profile/i)) {
      // If in Profile.jsx specifically, it's conditional UI bug
      if (file.match(/profile/i)) {
        return 'conditional_ui';
      }
      return 'auth_state';
    }
    
    // Generic state update
    return 'state_update';
  }
  
  // Feedback/validation
  if (type === 'feedback' || promise.kind === 'validation') {
    return 'validation';
  }
  
  // Button clicks
  if (promise.kind === 'click') {
    return 'interact';
  }
  
  return 'other';
}

/**
 * Create a problem group from findings
 */
function createProblemGroup(page, intent, findings, _manifest) {
  if (findings.length === 0) {
    return null;
  }
  
  // Generate problem ID
  const id = `problem_${page}_${intent}`;
  
  // Determine title based on intent
  const title = generateTitle(page, intent, findings);
  
  // Aggregate impact (highest wins)
  const impact = aggregateImpact(findings);
  
  // Aggregate confidence (average)
  const confidence = aggregateConfidence(findings);
  
  // Deduplicate evidence
  const evidence = deduplicateEvidence(findings);
  
  // Extract finding IDs
  const findingIds = findings.map(f => f.id);
  
  // Generate explanation
  const explanation = generateExplanation(page, intent, findings);
  
  return {
    id,
    title,
    page,
    userIntent: intent,
    impact,
    confidence,
    findings: findingIds,
    findingCount: findings.length,
    evidence,
    whatUserTried: explanation.whatUserTried,
    whatWasExpected: explanation.whatWasExpected,
    whatActuallyHappened: explanation.whatActuallyHappened,
    whyItMatters: explanation.whyItMatters
  };
}

/**
 * Generate human-readable title for problem
 */
function generateTitle(page, intent, findings) {
  const pageName = page.charAt(0).toUpperCase() + page.slice(1);
  
  const intentMap = {
    navigate: `${pageName} page doesn't load`,
    save: `${pageName} form submission fails silently`,
    auth: `${pageName} authentication fails silently`,
    auth_state: `${pageName} authentication state doesn't update UI`,
    conditional_ui: `${pageName} conditional UI doesn't update after state change`,
    loading_feedback: `${pageName} loading state never resolves`,
    state_update: `${pageName} state changes don't update UI`,
    validation: `${pageName} validation feedback missing`,
    interact: `${pageName} interactive elements don't work`,
    other: `${pageName} has broken functionality`
  };
  
  return intentMap[intent] || `${pageName} has ${findings.length} silent failures`;
}

/**
 * Aggregate impact across findings (highest wins)
 */
function aggregateImpact(findings) {
  const impactOrder = { HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
  let maxImpact = 'UNKNOWN';
  let maxValue = 0;
  
  for (const finding of findings) {
    const impact = finding.impact || 'UNKNOWN';
    const value = impactOrder[impact] || 0;
    if (value > maxValue) {
      maxValue = value;
      maxImpact = impact;
    }
  }
  
  return maxImpact;
}

/**
 * Aggregate confidence across findings (average)
 */
function aggregateConfidence(findings) {
  if (findings.length === 0) return 0;
  
  const sum = findings.reduce((acc, f) => acc + (f.confidence || 0.5), 0);
  return Math.round((sum / findings.length) * 100) / 100;
}

/**
 * Deduplicate evidence across findings
 */
function deduplicateEvidence(findings) {
  const evidenceMap = new Map();
  
  for (const finding of findings) {
    if (!finding.evidence) continue;
    
    for (const ev of finding.evidence) {
      const key = `${ev.type}:${ev.path || 'none'}`;
      if (!evidenceMap.has(key)) {
        evidenceMap.set(key, ev);
      }
    }
  }
  
  return Array.from(evidenceMap.values());
}

/**
 * Generate explanation for problem
 */
function generateExplanation(page, intent, findings) {
  const pageName = page.charAt(0).toUpperCase() + page.slice(1);
  const count = findings.length;
  
  // Build explanation based on intent
  const explanations = {
    navigate: {
      whatUserTried: `Navigate to ${pageName} page`,
      whatWasExpected: 'Page content loads and displays',
      whatActuallyHappened: `URL changed but page content did not render (${count} state mutations stuck)`,
      whyItMatters: 'Users cannot access the intended page or see its content'
    },
    save: {
      whatUserTried: `Submit form on ${pageName} page`,
      whatWasExpected: 'Form submits and shows success feedback (message, redirect, or toast)',
      whatActuallyHappened: `Form submitted but no feedback was provided to user (${count} related issues)`,
      whyItMatters: 'Users don\'t know if their data was saved or if they should retry'
    },
    auth: {
      whatUserTried: `Log in or log out using ${pageName} page buttons`,
      whatWasExpected: 'Button click triggers authentication action with visual feedback',
      whatActuallyHappened: `Button clicks produced no observable effect (${count} buttons don't work)`,
      whyItMatters: 'Users cannot complete authentication workflows'
    },
    auth_state: {
      whatUserTried: `Authenticate using ${pageName} page`,
      whatWasExpected: 'Authentication state changes update UI accordingly',
      whatActuallyHappened: `Auth state changed but UI did not reflect changes (${count} state mutations)`,
      whyItMatters: 'Users cannot tell their authentication status'
    },
    conditional_ui: {
      whatUserTried: `Interact with conditional UI on ${pageName} page`,
      whatWasExpected: 'UI elements appear/disappear based on state (e.g., Login button hides after login)',
      whatActuallyHappened: `State changed but conditional UI did not update (${count} stale elements)`,
      whyItMatters: 'Users see UI elements that should be hidden or vice versa, causing confusion'
    },
    loading_feedback: {
      whatUserTried: `Interact with ${pageName} page`,
      whatWasExpected: 'Loading indicator appears then resolves when content is ready',
      whatActuallyHappened: `Loading states were set but never cleared (${count} stuck states)`,
      whyItMatters: 'Users see perpetual loading spinners or incomplete UI'
    },
    state_update: {
      whatUserTried: `Interact with ${pageName} page elements`,
      whatWasExpected: 'UI updates to reflect new state',
      whatActuallyHappened: `State changed but UI did not update (${count} stale UI elements)`,
      whyItMatters: 'Users see outdated information that doesn\'t match actual state'
    },
    validation: {
      whatUserTried: `Submit invalid data on ${pageName} form`,
      whatWasExpected: 'Validation errors display clearly',
      whatActuallyHappened: `Validation feedback elements missing (${count} issues)`,
      whyItMatters: 'Users cannot correct their mistakes or understand what went wrong'
    },
    interact: {
      whatUserTried: `Click buttons or interact with elements on ${pageName}`,
      whatWasExpected: 'Interactive elements respond with visible feedback',
      whatActuallyHappened: `${count} interactive elements produced no observable effect`,
      whyItMatters: 'Users cannot complete intended actions or workflows'
    },
    other: {
      whatUserTried: `Use ${pageName} page functionality`,
      whatWasExpected: 'Actions produce visible results',
      whatActuallyHappened: `${count} actions failed silently with no user feedback`,
      whyItMatters: 'Core functionality is broken but fails without error messages'
    }
  };
  
  return explanations[intent] || explanations.other;
}








