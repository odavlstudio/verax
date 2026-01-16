import { getUrlPath } from './evidence-validator.js';

function routeMatchesUrl(routePath, url) {
  const urlPath = getUrlPath(url);
  if (!urlPath) return false;
  
  const normalizedRoute = routePath.replace(/\/$/, '') || '/';
  const normalizedUrl = urlPath.replace(/\/$/, '') || '/';
  
  if (normalizedRoute === normalizedUrl) return true;
  
  if (normalizedRoute.includes(':')) {
    const routeParts = normalizedRoute.split('/');
    const urlParts = normalizedUrl.split('/');
    
    if (routeParts.length !== urlParts.length) return false;
    
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) continue;
      if (routeParts[i] !== urlParts[i]) return false;
    }
    return true;
  }
  
  return false;
}

function normalizeExpectationType(expectationType) {
  if (expectationType === 'spa_navigation') {
    return 'navigation';
  }
  return expectationType;
}

/**
 * Normalize selector for comparison.
 * Removes brackets, parentheses, and normalizes whitespace.
 */
function normalizeSelector(selector) {
  if (!selector) return '';
  return selector.replace(/[[\]()]/g, '').trim();
}

/**
 * Check if two selectors match.
 * Returns true if:
 * - Exact match, OR
 * - One contains the other (after normalization)
 */
function selectorsMatch(selector1, selector2) {
  if (!selector1 || !selector2) return false;
  
  const norm1 = normalizeSelector(selector1);
  const norm2 = normalizeSelector(selector2);
  
  if (selector1 === selector2) return true;
  if (norm1 === norm2) return true;
  if (selector1.includes(selector2)) return true;
  if (selector2.includes(selector1)) return true;
  if (norm1.includes(norm2)) return true;
  if (norm2.includes(norm1)) return true;
  
  return false;
}

/**
 * Check if interaction type is compatible with expectation type.
 */
function typesCompatible(expectationType, interactionType) {
  const normalizedType = normalizeExpectationType(expectationType);
  if (normalizedType === 'navigation') {
    return interactionType === 'link' || interactionType === 'button';
  }
  if (normalizedType === 'form_submission') {
    return interactionType === 'form';
  }
  // VALIDATION INTELLIGENCE v1: Validation blocks are triggered by forms
  if (normalizedType === 'validation_block') {
    return interactionType === 'form';
  }
  if (normalizedType === 'network_action') {
    return interactionType === 'button' || interactionType === 'form';
  }
  return false;
}

/**
 * Match expectation to interaction.
 * Returns the matched expectation or null.
 */
export function matchExpectation(expectation, interaction, beforeUrl) {
  const beforePath = getUrlPath(beforeUrl);
  if (!beforePath) return null;
  
  const normalizedBefore = beforePath.replace(/\/$/, '') || '/';
  const normalizedFrom = expectation.fromPath ? expectation.fromPath.replace(/\/$/, '') || '/' : normalizedBefore;
  const normalizedType = normalizeExpectationType(expectation.type);
  
  if (expectation.fromPath && normalizedFrom !== normalizedBefore) return null;
  
  if (!typesCompatible(normalizedType, interaction.type)) return null;
  
  const selectorHint = expectation.evidence?.selectorHint || '';
  const interactionSelector = interaction.selector || '';
  
  if (selectorHint && interactionSelector) {
    if (selectorsMatch(selectorHint, interactionSelector)) {
      return { ...expectation, type: normalizedType };
    }
  } else if (!selectorHint && !interactionSelector) {
    return { ...expectation, type: normalizedType };
  }
  
  return null;
}

function _matchesStaticExpectation(expectation, interaction, afterUrl) {
  if (interaction.type !== 'link') return false;
  
  const afterPath = getUrlPath(afterUrl);
  if (!afterPath) return false;
  
  const normalizedTarget = expectation.targetPath.replace(/\/$/, '') || '/';
  const normalizedAfter = afterPath.replace(/\/$/, '') || '/';
  
  if (normalizedAfter === normalizedTarget) {
    return true;
  }
  
  const selectorHint = expectation.evidence.selectorHint || '';
  const interactionSelector = interaction.selector || '';
  const _interactionLabel = (interaction.label || '').toLowerCase().trim();
  
  if (selectorHint && interactionSelector) {
    if (selectorHint.includes(interactionSelector) || interactionSelector.includes(selectorHint.replace(/[\]()]/g, ''))) {
      return true;
    }
  }
  
  return false;
}

export function expectsNavigation(manifest, interaction, beforeUrl) {
  if (manifest.staticExpectations && manifest.staticExpectations.length > 0) {
    for (const expectation of manifest.staticExpectations) {
      const matched = matchExpectation(expectation, interaction, beforeUrl);
      if (matched) {
        return true;
      }
    }
  }
  
  if (manifest.projectType === 'react_spa' && interaction.type === 'link') {
    const beforePath = getUrlPath(beforeUrl);
    if (beforePath) {
      const href = interaction.selector ? interaction.selector.match(/href=["']([^"']+)["']/) : null;
      if (!href) {
        for (const route of (manifest.routes || [])) {
          if (!route.public) continue;
          const routePath = route.path.toLowerCase();
          const routeName = routePath.split('/').pop() || 'home';
          const interactionLabel = (interaction.label || '').toLowerCase().trim();
          
          if (interactionLabel.includes(routeName) || routeName.includes(interactionLabel)) {
            return true;
          }
        }
      }
    }
  }
  
  if (interaction.type === 'link') {
    const label = (interaction.label || '').toLowerCase().trim();
    
    for (const route of (manifest.routes || [])) {
      if (!route.public) continue;
      
      const routePath = route.path.toLowerCase();
      const routeName = routePath.split('/').pop() || 'home';
      
      if (label.includes(routeName) || routeName.includes(label)) {
        return true;
      }
      
      if (routeMatchesUrl(route.path, beforeUrl + route.path)) {
        return true;
      }
    }
  }
  
  if (interaction.type === 'button' || interaction.type === 'form') {
    const label = (interaction.label || '').toLowerCase().trim();
    
    const navigationKeywords = ['go', 'navigate', 'next', 'continue', 'submit', 'save'];
    const hasNavKeyword = navigationKeywords.some(keyword => label.includes(keyword));
    
    if (hasNavKeyword) {
      for (const route of (manifest.routes || [])) {
        if (!route.public) continue;
        if (route.path === '/' && label.includes('home')) {
          return true;
        }
        if (route.path !== '/') {
          return true;
        }
      }
    }
    
    for (const route of (manifest.routes || [])) {
      if (!route.public) continue;
      const routePath = route.path.toLowerCase();
      const routeName = routePath.split('/').pop() || 'home';
      
      if (routeName === 'home' && (label.includes('home') || label.includes('main') || label.includes('index'))) {
        return true;
      }
      
      if (label.includes(routeName) || routeName.includes(label)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Get expectation for interaction from manifest (unified API for static and action contracts)
 * @param {Object} manifest - Project manifest
 * @param {Object} interaction - Interaction object
 * @param {string} beforeUrl - URL before interaction
 * @param {Object} [attemptMeta] - Optional metadata about the interaction attempt
 * @returns {Object} { hasExpectation: boolean, proof: string, ...expectationData }
 */
export function getExpectation(manifest, interaction, beforeUrl, attemptMeta = {}) {
  // Check static expectations first (for static sites)
  if (manifest.staticExpectations && manifest.staticExpectations.length > 0) {
    for (const expectation of manifest.staticExpectations) {
      const matched = matchExpectation(expectation, interaction, beforeUrl);
      if (matched) {
        return {
          hasExpectation: true,
          proof: expectation.proof || 'PROVEN_EXPECTATION',
          expectationType: expectation.type,
          expectedTargetPath: expectation.targetPath,
          ...expectation
        };
      }
    }
  }
  
  // Check action contracts (for apps with source-level contracts)
  if (manifest.actionContracts && manifest.actionContracts.length > 0) {
    const sourceRef = attemptMeta?.sourceRef;
    if (sourceRef) {
      for (const contract of manifest.actionContracts) {
        if (contract.source === sourceRef) {
          const expectationType = contract.kind === 'NETWORK_ACTION' ? 'network_action' : 'action';
          return {
            hasExpectation: true,
            proof: 'PROVEN_EXPECTATION',
            expectationType,
            method: contract.method,
            urlPath: contract.urlPath,
            ...contract
          };
        }
      }
    }
  }
  
  return {
    hasExpectation: false,
    proof: 'UNKNOWN_EXPECTATION'
  };
}

