/**
 * Signal Mapper
 * Enriches findings with decision-ready signals:
 * - Impact Level (LOW | MEDIUM | HIGH)
 * - User Risk (BLOCKS | CONFUSES | DEGRADES)
 * - Ownership Hint (FRONTEND | BACKEND | INTEGRATION | ACCESSIBILITY | PERFORMANCE)
 * - Grouping Metadata
 * 
 * Deterministic mapping only, no heuristics.
 */

/**
 * Map finding to impact level based on failure type, route criticality, and confidence
 */
export function mapImpactLevel(finding, manifest = {}) {
  const findingType = finding.type || 'unknown';
  const confidence = finding.confidence?.level || 'UNKNOWN';
  const routePath = extractRouteFromFinding(finding, manifest);
  const isCriticalRoute = isRouteCritical(routePath, manifest);
  
  // HIGH impact: blocking failures on critical routes with high confidence
  if (
    (findingType.includes('navigation') || findingType.includes('auth') || findingType === 'observed_break') &&
    isCriticalRoute &&
    (confidence === 'HIGH' || confidence === 'MEDIUM')
  ) {
    return 'HIGH';
  }
  
  // HIGH impact: accessibility failures (always high impact)
  if (
    findingType.includes('focus') || 
    findingType.includes('aria') || 
    findingType.includes('keyboard_trap')
  ) {
    return 'HIGH';
  }
  
  // HIGH impact: loading stuck or freeze-like failures
  if (
    findingType.includes('loading_stuck') || 
    findingType.includes('freeze_like')
  ) {
    return 'HIGH';
  }
  
  // MEDIUM impact: network failures on critical routes
  if (
    findingType.includes('network') || 
    findingType.includes('partial_success') ||
    findingType.includes('async_state')
  ) {
    return isCriticalRoute ? 'MEDIUM' : 'LOW';
  }
  
  // MEDIUM impact: feedback gap failures
  if (findingType.includes('feedback_gap')) {
    return 'MEDIUM';
  }
  
  // MEDIUM impact: validation failures
  if (findingType.includes('validation')) {
    return 'MEDIUM';
  }
  
  // MEDIUM impact: state failures
  if (findingType.includes('state')) {
    return isCriticalRoute ? 'MEDIUM' : 'LOW';
  }
  
  // LOW impact: hover, file upload failures (less critical)
  if (
    findingType.includes('hover') || 
    findingType.includes('file_upload')
  ) {
    return 'LOW';
  }
  
  // LOW impact: low confidence on non-critical routes
  if (confidence === 'LOW' && !isCriticalRoute) {
    return 'LOW';
  }
  
  // Default: MEDIUM for other cases
  return 'MEDIUM';
}

/**
 * Map finding to user risk level
 */
export function mapUserRisk(finding) {
  const findingType = finding.type || 'unknown';
  const interactionType = finding.interaction?.type || '';
  
  // BLOCKS: User cannot complete intended action
  if (
    findingType.includes('navigation') ||
    findingType.includes('auth') ||
    findingType.includes('loading_stuck') ||
    findingType.includes('freeze_like') ||
    findingType === 'observed_break' ||
    (findingType.includes('network') && interactionType === 'form')
  ) {
    return 'BLOCKS';
  }
  
  // CONFUSES: User action appears to work but provides no feedback
  if (
    findingType.includes('feedback_gap') ||
    findingType.includes('partial_success') ||
    findingType.includes('async_state') ||
    findingType.includes('validation')
  ) {
    return 'CONFUSES';
  }
  
  // DEGRADES: Functionality works but with reduced quality/accessibility
  if (
    findingType.includes('focus') ||
    findingType.includes('aria') ||
    findingType.includes('keyboard_trap') ||
    findingType.includes('hover') ||
    findingType.includes('file_upload')
  ) {
    return 'DEGRADES';
  }
  
  // Default: CONFUSES for unknown cases
  return 'CONFUSES';
}

/**
 * Map finding to ownership hint based on failure type and sensors
 */
export function mapOwnership(finding, trace = {}) {
  const findingType = finding.type || 'unknown';
  const sensors = trace.sensors || {};
  const hasNetwork = (sensors.network?.totalRequests || 0) > 0;
  const _hasAria = sensors.aria !== undefined;
  const _hasFocus = sensors.focus !== undefined;
  const hasTiming = sensors.timing !== undefined;
  
  // ACCESSIBILITY: Focus, ARIA, keyboard trap failures
  if (
    findingType.includes('focus') ||
    findingType.includes('aria') ||
    findingType.includes('keyboard_trap')
  ) {
    return 'ACCESSIBILITY';
  }
  
  // PERFORMANCE: Timing-related failures
  if (
    findingType.includes('loading_stuck') ||
    findingType.includes('freeze_like') ||
    findingType.includes('feedback_gap') ||
    hasTiming
  ) {
    return 'PERFORMANCE';
  }
  
  // BACKEND: Network failures without DOM/UI changes
  if (
    findingType.includes('network') ||
    findingType.includes('partial_success') ||
    findingType.includes('async_state')
  ) {
    // If network request occurred but no UI feedback, likely backend issue
    if (hasNetwork && !sensors.uiSignals?.diff?.changed) {
      return 'BACKEND';
    }
    // Otherwise integration issue
    return 'INTEGRATION';
  }
  
  // BACKEND: Auth failures (typically backend-related)
  if (findingType.includes('auth') || findingType.includes('logout')) {
    return 'BACKEND';
  }
  
  // FRONTEND: UI-only failures (no network, no backend involvement)
  if (
    findingType.includes('navigation') ||
    findingType.includes('validation') ||
    findingType.includes('hover') ||
    findingType.includes('file_upload') ||
    findingType === 'observed_break'
  ) {
    if (!hasNetwork) {
      return 'FRONTEND';
    }
    return 'INTEGRATION';
  }
  
  // INTEGRATION: Default for unclear cases
  return 'INTEGRATION';
}

/**
 * Generate grouping metadata for findings
 */
export function generateGroupingMetadata(finding, manifest = {}) {
  const routePath = extractRouteFromFinding(finding, manifest);
  const findingType = finding.type || 'unknown';
  
  return {
    groupByRoute: routePath || '*',
    groupByFailureType: findingType,
    groupByFeature: extractFeatureFromRoute(routePath)
  };
}

/**
 * Extract route path from finding
 */
function extractRouteFromFinding(finding, manifest) {
  // Try to get route from evidence
  const beforeUrl = finding.evidence?.beforeUrl || finding.evidence?.before?.url;
  if (beforeUrl) {
    try {
      const url = new URL(beforeUrl);
      return url.pathname;
    } catch {
      return extractPathFromUrl(beforeUrl);
    }
  }
  
  // Try to get route from expectation
  if (finding.expectationId) {
    const expectation = manifest.staticExpectations?.find(e => e.id === finding.expectationId);
    if (expectation?.fromPath) {
      return expectation.fromPath;
    }
  }
  
  return '*';
}

/**
 * Extract path from URL string
 */
function extractPathFromUrl(url) {
  if (!url) return '*';
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    // Try to extract pathname manually
    const match = url.match(/\/[^?#]*/);
    return match ? match[0] : '*';
  }
}

/**
 * Check if route is critical (has expectations)
 */
function isRouteCritical(routePath, manifest) {
  if (!manifest.staticExpectations) return false;
  
  const normalizedRoute = normalizePath(routePath);
  return manifest.staticExpectations.some(exp => {
    const expFromPath = normalizePath(exp.fromPath || '*');
    return expFromPath === normalizedRoute || expFromPath === '*';
  });
}

/**
 * Normalize path for comparison
 */
function normalizePath(path) {
  if (!path || path === '*') return '*';
  return path.replace(/\/$/, '') || '/';
}

/**
 * Extract feature name from route path
 */
function extractFeatureFromRoute(routePath) {
  if (!routePath || routePath === '*') return 'unknown';
  
  // Extract feature from common route patterns
  const normalized = normalizePath(routePath);
  
  // Common patterns: /users, /dashboard, /settings, etc.
  const parts = normalized.split('/').filter(p => p);
  if (parts.length > 0) {
    return parts[0]; // First segment is typically the feature
  }
  
  return 'root';
}

/**
 * Main function to enrich finding with all signals
 */
export function enrichFindingWithSignals(finding, trace = {}, manifest = {}) {
  const signals = {
    impact: mapImpactLevel(finding, manifest),
    userRisk: mapUserRisk(finding),
    ownership: mapOwnership(finding, trace),
    grouping: generateGroupingMetadata(finding, manifest)
  };
  
  return {
    ...finding,
    signals
  };
}
