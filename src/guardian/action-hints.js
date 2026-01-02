/**
 * Action Hint Extractor - Converts attempt failures into actionable repair guidance
 * 
 * This module transforms raw attempt results into concrete, evidence-based
 * repair hints that tell developers EXACTLY what to fix.
 * 
 * Design principles:
 * - No AI/fuzzy text generation
 * - All hints are rule-based and deterministic
 * - Evidence must be grounded in actual execution data (step logs, errors, URLs)
 * - Hints must be actionable (not "check your site" but "add submit button to form at /contact")
 */

/**
 * Extract actionable repair hints from attempt results
 * @param {Array} attemptResults - Array of attempt execution results
 * @returns {Array} Array of action hints: { attempt, step, url, issue, hint, severity }
 */
function deriveActionHints(attemptResults) {
  if (!Array.isArray(attemptResults) || attemptResults.length === 0) {
    return [];
  }

  const hints = [];

  for (const attempt of attemptResults) {
    const { attemptId, outcome, steps = [], error, friction } = attempt;

    // Skip successful attempts (no hints needed)
    if (outcome === 'SUCCESS') {
      continue;
    }

    // Handle FAILURE outcomes
    if (outcome === 'FAILURE') {
      hints.push(...extractFailureHints(attemptId, steps, error, attempt));
    }

    // Handle FRICTION outcomes
    if (outcome === 'FRICTION') {
      hints.push(...extractFrictionHints(attemptId, steps, friction, attempt));
    }

    // Handle NOT_APPLICABLE outcomes (when discovery fails)
    if (outcome === 'NOT_APPLICABLE') {
      hints.push(...extractNotApplicableHints(attemptId, steps, attempt));
    }

    // Handle DISCOVERY_FAILED outcomes
    if (outcome === 'DISCOVERY_FAILED') {
      hints.push(...extractDiscoveryFailedHints(attemptId, steps, error, attempt));
    }
  }

  // Sort by severity (HIGH first)
  return hints.sort((a, b) => {
    const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
  });
}

/**
 * Extract hints from FAILURE outcome attempts
 */
function extractFailureHints(attemptId, steps, error, attempt) {
  const hints = [];
  
  // Find the failing step
  const failedStepIndex = steps.findIndex(s => s.status === 'failed' || s.error);
  const failedStep = failedStepIndex >= 0 ? steps[failedStepIndex] : null;
  
  if (failedStep) {
    const url = failedStep.target || attempt.baseUrl;
    const stepType = failedStep.type;
    const stepError = failedStep.error || error;

    // Rule 1: Navigation timeout
    if (stepError && stepError.includes('timeout')) {
      hints.push({
        attempt: attemptId,
        step: failedStepIndex,
        url,
        issue: `Navigation timeout after ${failedStep.durationMs || 'unknown'}ms`,
        hint: `Page at ${url} took too long to load. Check: 1) Server response time 2) Large resources (images, scripts) 3) Slow API calls blocking render`,
        severity: 'HIGH',
        evidence: {
          stepType,
          stepIndex: failedStepIndex,
          error: stepError
        }
      });
    }
    // Rule 2: Element not found (click, fill, etc.)
    else if (stepError && (stepError.includes('not found') || stepError.includes('Element'))) {
      const selector = extractSelector(stepError) || failedStep.selector;
      hints.push({
        attempt: attemptId,
        step: failedStepIndex,
        url,
        issue: `Required element not found: ${selector || 'selector'}`,
        hint: `Add or fix selector "${selector || 'missing'}" on page ${url}. Ensure element is visible and not hidden by CSS/JS`,
        severity: 'HIGH',
        evidence: {
          stepType,
          stepIndex: failedStepIndex,
          selector,
          error: stepError
        }
      });
    }
    // Rule 3: Form submit blocked
    else if ((stepType === 'submit' || stepError.includes('submit')) && stepError) {
      hints.push({
        attempt: attemptId,
        step: failedStepIndex,
        url,
        issue: `Form submission failed`,
        hint: `Form submit at ${url} blocked. Check: 1) Submit button disabled state 2) JS validation errors 3) Missing required fields 4) Network request blocked`,
        severity: 'HIGH',
        evidence: {
          stepType,
          stepIndex: failedStepIndex,
          error: stepError
        }
      });
    }
    // Rule 4: Navigation loop detected
    else if (stepType === 'navigate' && stepError && stepError.includes('loop')) {
      hints.push({
        attempt: attemptId,
        step: failedStepIndex,
        url,
        issue: `Navigation loop detected`,
        hint: `Link at ${url} creates redirect loop. Check: 1) Circular redirects 2) Broken routing logic 3) Auth redirect loop`,
        severity: 'HIGH',
        evidence: {
          stepType,
          stepIndex: failedStepIndex,
          error: stepError
        }
      });
    }
    // Rule 5: Generic failure with step context
    else {
      hints.push({
        attempt: attemptId,
        step: failedStepIndex,
        url,
        issue: `Step "${failedStep.id}" failed: ${stepType}`,
        hint: `Fix step "${failedStep.id}" (${stepType}) at ${url}. Error: ${stepError || 'No error details'}`,
        severity: 'HIGH',
        evidence: {
          stepType,
          stepIndex: failedStepIndex,
          error: stepError
        }
      });
    }
  } else if (error) {
    // Attempt-level error without specific step
    hints.push({
      attempt: attemptId,
      step: 'unknown',
      url: attempt.baseUrl,
      issue: `Attempt failed: ${error}`,
      hint: `Fix "${attemptId}" flow. Error: ${error}`,
      severity: 'HIGH',
      evidence: { error }
    });
  }

  return hints;
}

/**
 * Extract hints from FRICTION outcome attempts
 */
function extractFrictionHints(attemptId, steps, friction, attempt) {
  const hints = [];

  if (!friction || !friction.isFriction) {
    return hints;
  }

  // Rule: Slow steps causing friction
  const slowSteps = steps.filter(s => s.durationMs && s.durationMs > 3000);
  if (slowSteps.length > 0) {
    for (const step of slowSteps) {
      const stepIndex = steps.indexOf(step);
      hints.push({
        attempt: attemptId,
        step: stepIndex,
        url: step.target || attempt.baseUrl,
        issue: `Slow step: ${step.durationMs}ms (threshold: 3000ms)`,
        hint: `Optimize page load at ${step.target || attempt.baseUrl}. Current: ${step.durationMs}ms. Check: 1) Image sizes 2) Script defer/async 3) API call optimization`,
        severity: 'MEDIUM',
        evidence: {
          stepType: step.type,
          stepIndex,
          durationMs: step.durationMs,
          threshold: 3000
        }
      });
    }
  }

  // Rule: Multiple retries indicating instability
  const retriedSteps = steps.filter(s => s.retries && s.retries > 0);
  if (retriedSteps.length > 0) {
    for (const step of retriedSteps) {
      const stepIndex = steps.indexOf(step);
      hints.push({
        attempt: attemptId,
        step: stepIndex,
        url: step.target || attempt.baseUrl,
        issue: `Step required ${step.retries} retries (instability)`,
        hint: `Stabilize element at ${step.target || attempt.baseUrl}. Retries indicate timing issues. Add explicit waits or fix race conditions`,
        severity: 'MEDIUM',
        evidence: {
          stepType: step.type,
          stepIndex,
          retries: step.retries
        }
      });
    }
  }

  // Rule: Friction reasons from friction detector
  if (friction.reasons && friction.reasons.length > 0) {
    for (const reason of friction.reasons) {
      hints.push({
        attempt: attemptId,
        step: 'overall',
        url: attempt.baseUrl,
        issue: reason,
        hint: `Reduce friction: ${reason}. Review user experience and optimize flow`,
        severity: 'MEDIUM',
        evidence: {
          frictionReason: reason
        }
      });
    }
  }

  return hints;
}

/**
 * Extract hints from NOT_APPLICABLE outcomes
 */
function extractNotApplicableHints(attemptId, steps, attempt) {
  const hints = [];

  // NOT_APPLICABLE usually means the site doesn't have the required capability
  // Check if there's a specific step that failed (like URL not found)
  const failedStep = steps.find(s => s.status === 'failed' || s.error);
  if (failedStep && failedStep.error && failedStep.error.includes('not found')) {
    const stepIndex = steps.indexOf(failedStep);
    hints.push({
      attempt: attemptId,
      step: stepIndex,
      url: failedStep.target || attempt.baseUrl,
      issue: `URL not found on site`,
      hint: `Add page or fix link to ${failedStep.target || attempt.baseUrl} if this capability is needed`,
      severity: 'MEDIUM',
      evidence: {
        outcome: 'NOT_APPLICABLE',
        error: failedStep.error,
        stepIndex
      }
    });
  } else {
    // General NOT_APPLICABLE - informational
    const capabilityMap = {
      contact_form: 'contact form',
      contact_discovery: 'contact page/link',
      language_switch: 'language switcher',
      newsletter_signup: 'newsletter signup form',
      login: 'login form',
      signup: 'signup form',
      checkout: 'checkout flow'
    };

    const missingCapability = capabilityMap[attemptId] || attemptId;

    hints.push({
      attempt: attemptId,
      step: 'discovery',
      url: attempt.baseUrl,
      issue: `No ${missingCapability} detected on site`,
      hint: `Add ${missingCapability} if required for your users. Otherwise this is expected for your site type`,
      severity: 'MEDIUM',
      evidence: {
        outcome: 'NOT_APPLICABLE',
        missingCapability
      }
    });
  }

  return hints;
}

/**
 * Extract hints from DISCOVERY_FAILED outcomes
 */
function extractDiscoveryFailedHints(attemptId, steps, error, attempt) {
  const hints = [];

  // Find discovery step if exists
  const discoveryStepIndex = steps.findIndex(s => s.type === 'discovery' || s.id === 'discovery' || s.error);
  
  hints.push({
    attempt: attemptId,
    step: discoveryStepIndex >= 0 ? discoveryStepIndex : 'discovery',
    url: attempt.baseUrl,
    issue: `Element discovery failed: ${error || 'unknown'}`,
    hint: `Add stable element markers (data-testid or aria-label) for "${attemptId}" to improve detection. Error: ${error || 'No details'}`,
    severity: 'MEDIUM',
    evidence: {
      outcome: 'DISCOVERY_FAILED',
      error
    }
  });

  return hints;
}

/**
 * Extract selector from error message
 */
function extractSelector(errorMessage) {
  if (!errorMessage) return null;
  
  // Try to extract selector from common Playwright error formats
  const selectorMatch = errorMessage.match(/selector ["']([^"']+)["']/i);
  if (selectorMatch) return selectorMatch[1];
  
  const quoteMatch = errorMessage.match(/["']([^"']+)["']/);
  if (quoteMatch) return quoteMatch[1];
  
  return null;
}

/**
 * Format hints for CLI display (concise)
 */
function formatHintsForCLI(hints, maxHints = 3) {
  if (hints.length === 0) {
    return '';
  }

  let output = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  output += 'ACTION HINTS (How to Fix)\n';
  output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  const displayHints = hints.slice(0, maxHints);
  
  for (let i = 0; i < displayHints.length; i++) {
    const hint = displayHints[i];
    const icon = hint.severity === 'HIGH' ? '⚠️' : hint.severity === 'MEDIUM' ? '🔸' : '💡';
    
    output += `${icon} Attempt: ${hint.attempt}\n`;
    output += `   Step: ${hint.step}\n`;
    output += `   URL: ${hint.url}\n`;
    output += `   Issue: ${hint.issue}\n`;
    output += `   Fix: ${hint.hint}\n`;
    if (i < displayHints.length - 1) {
      output += '\n';
    }
  }

  if (hints.length > maxHints) {
    output += `\n   ... and ${hints.length - maxHints} more hint(s) in decision.json\n`;
  }

  output += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

  return output;
}

/**
 * Format hints for summary.md (detailed)
 */
function formatHintsForSummary(hints) {
  if (hints.length === 0) {
    return '';
  }

  let output = '';
  
  const highHints = hints.filter(h => h.severity === 'HIGH');
  const mediumHints = hints.filter(h => h.severity === 'MEDIUM');
  const lowHints = hints.filter(h => h.severity === 'LOW');

  if (highHints.length > 0) {
    output += '\n### High Priority (Must Fix Before Launch)\n\n';
    for (const hint of highHints) {
      output += `**Attempt:** ${hint.attempt}  \n`;
      output += `**Step:** ${hint.step}  \n`;
      output += `**URL:** ${hint.url}  \n`;
      output += `**Issue:** ${hint.issue}  \n`;
      output += `**Fix Hint:** ${hint.hint}  \n`;
      output += `**Severity:** ${hint.severity}  \n\n`;
    }
  }

  if (mediumHints.length > 0) {
    output += '\n### Medium Priority (Should Fix Soon)\n\n';
    for (const hint of mediumHints) {
      output += `**Attempt:** ${hint.attempt}  \n`;
      output += `**Step:** ${hint.step}  \n`;
      output += `**URL:** ${hint.url}  \n`;
      output += `**Issue:** ${hint.issue}  \n`;
      output += `**Fix Hint:** ${hint.hint}  \n`;
      output += `**Severity:** ${hint.severity}  \n\n`;
    }
  }

  if (lowHints.length > 0) {
    output += '\n### Low Priority (Optimize When Possible)\n\n';
    for (const hint of lowHints) {
      output += `**Attempt:** ${hint.attempt}  \n`;
      output += `**Step:** ${hint.step}  \n`;
      output += `**URL:** ${hint.url}  \n`;
      output += `**Issue:** ${hint.issue}  \n`;
      output += `**Fix Hint:** ${hint.hint}  \n`;
      output += `**Severity:** ${hint.severity}  \n\n`;
    }
  }

  return output;
  return output;
}

module.exports = {
  deriveActionHints,
  formatHintsForCLI,
  formatHintsForSummary
};
