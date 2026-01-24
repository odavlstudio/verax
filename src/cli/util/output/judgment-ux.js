/**
 * STAGE 6.4: Judgment UX
 * 
 * Transforms raw findings into human-readable, well-grouped judgments.
 * 
 * Judgments are ordered by:
 * 1. Severity (CRITICAL > HIGH > MEDIUM > LOW)
 * 2. Impact (silent failure > unmet expectation > coverage gap)
 * 3. Detectability (confirmed > probable > possible)
 * 
 * Each judgment includes:
 * - id: unique identifier
 * - title: human-readable title
 * - description: what happened and why
 * - severity: CRITICAL | HIGH | MEDIUM | LOW
 * - type: classification
 * - findings: related finding IDs
 * - recommendedAction: FIX | REVIEW | DOCUMENT
 * - evidence: supporting evidence references
 */

/**
 * Build human-readable judgment from finding
 * @param {Object} finding - Finding object
 * @param {number} index - Index in findings array
 * @returns {Object} Judgment
 */
export function buildJudgment(finding, index) {
  const id = `judgment-${index}`;
  const severity = computeJudgmentSeverity(finding);
  const title = computeJudgmentTitle(finding);
  const description = computeJudgmentDescription(finding);
  const recommendedAction = computeRecommendedAction(finding, severity);
  
  return {
    id,
    index,
    title,
    description,
    severity,
    type: finding.type,
    outcome: finding.outcome,
    confidence: finding.confidence || { severity: 'MEDIUM' },
    humanSummary: finding.humanSummary,
    
    // Evidence pointers
    evidence: {
      findingId: finding.id,
      interactionIndex: finding.interactionIndex,
      promiseId: finding.promiseId,
      URL: finding.URL,
    },
    
    // Action guidance
    recommendation: {
      action: recommendedAction,
      reason: computeActionReason(finding, severity),
      suggestedNextStep: computeNextStep(finding, recommendedAction),
    },
    
    // Severity indicators
    silenceMarker: finding.silenceMarker || null,
  };
}

/**
 * Compute judgment severity
 * Based on: finding type, confidence, and impact
 * @param {Object} finding
 * @returns {string} CRITICAL | HIGH | MEDIUM | LOW
 */
function computeJudgmentSeverity(finding) {
  const type = finding.type || 'UNKNOWN';
  const confidence = finding.confidence || {};
  const confLevel = confidence.severity || 'MEDIUM';
  
  // Silent failures are always high impact
  if (type === 'SILENT_FAILURE') {
    return confLevel === 'LOW' ? 'MEDIUM' : 'HIGH';
  }
  
  // Unmet expectations depend on confidence
  if (type === 'UNMET_EXPECTATION') {
    return confLevel === 'CRITICAL' ? 'CRITICAL' : 
           confLevel === 'HIGH' ? 'HIGH' : 'MEDIUM';
  }
  
  // Coverage gaps are lower priority
  if (type === 'COVERAGE_GAP') {
    return 'LOW';
  }
  
  // Default to finding's stated confidence
  const severityMap = {
    'CRITICAL': 'CRITICAL',
    'HIGH': 'HIGH',
    'MEDIUM': 'MEDIUM',
    'LOW': 'LOW',
  };
  
  return severityMap[confLevel] || 'MEDIUM';
}

/**
 * Compute human-readable judgment title
 * @param {Object} finding
 * @returns {string}
 */
function computeJudgmentTitle(finding) {
  const type = finding.type || 'Unknown';
  const outcome = finding.outcome || '';
  
  const titleMap = {
    'SILENT_FAILURE': 'Silent Failure Detected',
    'UNMET_EXPECTATION': 'Expectation Not Met',
    'COVERAGE_GAP': 'Flow Not Tested',
    'UI_FEEDBACK_MISSING': 'Missing User Feedback',
    'PROMISE_UNPROVEN': 'Promise Not Verified',
    'FLOW_BREAK': 'Flow Interruption',
    'NAVIGATION_FAILURE': 'Navigation Failed',
    'INTERACTION_BLOCKED': 'Interaction Blocked',
    'TIMEOUT': 'Timeout Occurred',
    'NETWORK_ERROR': 'Network Error',
  };
  
  return titleMap[type] || `${type} (${outcome})`;
}

/**
 * Compute detailed description
 * @param {Object} finding
 * @returns {string}
 */
function computeJudgmentDescription(finding) {
  const parts = [];
  
  // What happened
  if (finding.humanSummary) {
    parts.push(`**What:** ${finding.humanSummary}`);
  } else {
    parts.push(`**What:** ${finding.type} - ${finding.outcome}`);
  }
  
  // Where it happened
  if (finding.URL) {
    parts.push(`**Where:** ${finding.URL}`);
  }
  
  // When in the flow
  if (finding.interactionIndex !== undefined) {
    parts.push(`**Step:** Interaction ${finding.interactionIndex}`);
  }
  
  // Why it matters
  const whyMap = {
    'SILENT_FAILURE': 'User expects operation to succeed but flow silently fails (user may not notice the problem).',
    'UNMET_EXPECTATION': 'Expected outcome did not occur. The flow may be broken or expectations need adjustment.',
    'COVERAGE_GAP': 'This part of the flow was not tested. Need to add expectations or assertions.',
    'UI_FEEDBACK_MISSING': 'User action did not produce expected UI feedback (spinner, toast, visual change).',
    'PROMISE_UNPROVEN': 'Code promises certain behavior but execution did not verify it.',
    'FLOW_BREAK': 'Expected flow continuation did not occur.',
  };
  
  if (whyMap[finding.type]) {
    parts.push(`**Why:** ${whyMap[finding.type]}`);
  }
  
  return parts.join('\n');
}

/**
 * Compute recommended action
 * @param {Object} finding
 * @param {string} severity
 * @returns {string} FIX | REVIEW | DOCUMENT
 */
function computeRecommendedAction(finding, severity) {
  if (severity === 'CRITICAL' || severity === 'HIGH') {
    return 'FIX';
  }
  
  if (finding.type === 'SILENT_FAILURE') {
    return 'FIX';
  }
  
  if (finding.type === 'COVERAGE_GAP') {
    return 'DOCUMENT';
  }
  
  return 'REVIEW';
}

/**
 * Compute reason for action
 * @param {Object} finding
 * @param {string} severity
 * @returns {string}
 */
function computeActionReason(finding, severity) {
  const type = finding.type || 'unknown';
  
  const reasons = {
    'SILENT_FAILURE': 'Silent failures degrade user trust and cause subtle data loss.',
    'UNMET_EXPECTATION': 'Expected behavior did not occur; flow may be broken.',
    'COVERAGE_GAP': 'Add expectations to cover this scenario and prevent regressions.',
    'UI_FEEDBACK_MISSING': 'Users need feedback to understand what the app is doing.',
    'PROMISE_UNPROVEN': 'Code promises should be verified by assertions.',
  };
  
  return reasons[type] || `Severity: ${severity}`;
}

/**
 * Compute suggested next step
 * @param {Object} finding
 * @param {string} action
 * @returns {string}
 */
function computeNextStep(finding, action) {
  switch (action) {
    case 'FIX':
      return finding.type === 'SILENT_FAILURE' 
        ? 'Add error handling or UI feedback to indicate failure'
        : 'Review code and fix the broken expectation';
    
    case 'REVIEW':
      return `Review the finding and decide if code or expectations need changes`;
    
    case 'DOCUMENT':
      return `Document why this part of the flow is not tested`;
    
    default:
      return 'Review and determine appropriate action';
  }
}

/**
 * Sort judgments by priority (severity + impact)
 * @param {Array} judgments
 * @returns {Array} Sorted judgments
 */
export function sortJudgmentsByPriority(judgments = []) {
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const typeOrder = { SILENT_FAILURE: 0, UNMET_EXPECTATION: 1, COVERAGE_GAP: 2 };
  const actionOrder = { FIX: 0, REVIEW: 1, DOCUMENT: 2 };
  
  return [...judgments].sort((a, b) => {
    // First by severity
    const sevA = severityOrder[a.severity] ?? 99;
    const sevB = severityOrder[b.severity] ?? 99;
    if (sevA !== sevB) return sevA - sevB;
    
    // Then by type
    const typeA = typeOrder[a.type] ?? 99;
    const typeB = typeOrder[b.type] ?? 99;
    if (typeA !== typeB) return typeA - typeB;
    
    // Then by recommended action
    const actA = actionOrder[a.recommendation?.action] ?? 99;
    const actB = actionOrder[b.recommendation?.action] ?? 99;
    if (actA !== actB) return actA - actB;
    
    // Finally by index
    return (a.index ?? 999) - (b.index ?? 999);
  });
}

/**
 * Group judgments by severity for display
 * @param {Array} judgments
 * @returns {Object} { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] }
 */
export function groupJudgmentsBySeverity(judgments = []) {
  const grouped = {
    CRITICAL: [],
    HIGH: [],
    MEDIUM: [],
    LOW: [],
  };
  
  for (const judgment of judgments) {
    const severity = judgment.severity || 'MEDIUM';
    if (grouped[severity]) {
      grouped[severity].push(judgment);
    }
  }
  
  return grouped;
}

/**
 * Format judgment for CLI output
 * @param {Object} judgment
 * @returns {string} Formatted output
 */
export function formatJudgmentForCli(judgment) {
  const lines = [];
  const icon = {
    'CRITICAL': '🔴',
    'HIGH': '🟠',
    'MEDIUM': '🟡',
    'LOW': '🟢',
  }[judgment.severity] || '❓';
  
  lines.push(`${icon} ${judgment.title}`);
  lines.push(`   Severity: ${judgment.severity} | Type: ${judgment.type}`);
  lines.push(`   Action: ${judgment.recommendation?.action} - ${judgment.recommendation?.reason}`);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Convert findings array to sorted, grouped judgments
 * @param {Array} findings
 * @returns {Object} { byPriority: [], bySeverity: {}, summary: {} }
 */
export function transformFindingsToJudgments(findings = []) {
  // Build judgments from findings
  const judgments = findings.map((finding, idx) => buildJudgment(finding, idx));
  
  // Sort by priority
  const sorted = sortJudgmentsByPriority(judgments);
  
  // Group by severity
  const grouped = groupJudgmentsBySeverity(sorted);
  
  // Compute summary
  const summary = {
    total: judgments.length,
    critical: grouped.CRITICAL.length,
    high: grouped.HIGH.length,
    medium: grouped.MEDIUM.length,
    low: grouped.LOW.length,
    actionRequired: (grouped.CRITICAL.length + grouped.HIGH.length),
    reviewNeeded: grouped.MEDIUM.length,
    informational: grouped.LOW.length,
  };
  
  return {
    byPriority: sorted,
    bySeverity: grouped,
    summary,
  };
}
