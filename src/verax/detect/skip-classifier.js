import { getUrlPath } from './evidence-validator.js';

const MAX_EXAMPLES = 10;

export function classifySkipReason(manifest, interaction, beforeUrl, validation = null) {
  const skipReasons = {
    NO_EXPECTATION: {
      code: 'NO_EXPECTATION',
      message: 'No applicable expectations found for this interaction type or context'
    },
    AMBIGUOUS_MATCH: {
      code: 'AMBIGUOUS_MATCH',
      message: 'Multiple expectations could match; conservative approach requires single clear match'
    },
    SELECTOR_MISMATCH: {
      code: 'SELECTOR_MISMATCH',
      message: 'Expectations exist but selector mismatch and no safe fallback match'
    },
    WEAK_EXPECTATION_DROPPED: {
      code: 'WEAK_EXPECTATION_DROPPED',
      message: 'Expectation derived from route that was validated as unreachable'
    },
    UNSUPPORTED_INTERACTION: {
      code: 'UNSUPPORTED_INTERACTION',
      message: 'Interaction type not supported for expectation derivation'
    }
  };
  
  const beforePath = getUrlPath(beforeUrl);
  const normalizedBefore = beforePath ? beforePath.replace(/\/$/, '') || '/' : null;
  
  let hasStaticExpectations = false;
  let hasRouteExpectations = false;
  let hasMatchingStaticExpectations = false;
  let selectorMismatchCount = 0;
  let matchingRoutes = [];
  let unreachableRoutes = new Set();
  
  if (validation && validation.details) {
    for (const detail of validation.details) {
      if (detail.status === 'UNREACHABLE') {
        unreachableRoutes.add(detail.path);
      }
    }
  }
  
  if (manifest.staticExpectations && manifest.staticExpectations.length > 0) {
    hasStaticExpectations = true;
    for (const expectation of manifest.staticExpectations) {
      if (normalizedBefore && expectation.fromPath.replace(/\/$/, '') || '/' === normalizedBefore) {
        if (expectation.type === 'navigation' && (interaction.type === 'link' || interaction.type === 'button')) {
          hasMatchingStaticExpectations = true;
          const selectorHint = expectation.evidence.selectorHint || '';
          const interactionSelector = interaction.selector || '';
          
          if (selectorHint && interactionSelector) {
            const normalizedSelectorHint = selectorHint.replace(/[\[\]()]/g, '');
            const normalizedInteractionSelector = interactionSelector.replace(/[\[\]()]/g, '');
            
            if (selectorHint === interactionSelector || 
                selectorHint.includes(interactionSelector) || 
                interactionSelector.includes(normalizedSelectorHint) ||
                normalizedSelectorHint === normalizedInteractionSelector) {
              return null;
            } else {
              selectorMismatchCount++;
            }
          } else if (!selectorHint && !interactionSelector) {
            return null;
          } else {
            selectorMismatchCount++;
          }
        } else if (expectation.type === 'form_submission' && interaction.type === 'form') {
          hasMatchingStaticExpectations = true;
          const selectorHint = expectation.evidence.selectorHint || '';
          const interactionSelector = interaction.selector || '';
          
          if (selectorHint && interactionSelector) {
            const normalizedSelectorHint = selectorHint.replace(/[\[\]()]/g, '');
            const normalizedInteractionSelector = interactionSelector.replace(/[\[\]()]/g, '');
            
            if (selectorHint === interactionSelector || 
                selectorHint.includes(interactionSelector) || 
                interactionSelector.includes(normalizedSelectorHint) ||
                normalizedSelectorHint === normalizedInteractionSelector) {
              return null;
            } else {
              selectorMismatchCount++;
            }
          } else {
            selectorMismatchCount++;
          }
        }
      }
    }
  }
  
  if (manifest.routes && manifest.routes.length > 0) {
    hasRouteExpectations = true;
    for (const route of manifest.routes) {
      if (!route.public) continue;
      if (unreachableRoutes.has(route.path)) {
        continue;
      }
      
      if (interaction.type === 'link') {
        const label = (interaction.label || '').toLowerCase().trim();
        const routePath = route.path.toLowerCase();
        const routeName = routePath.split('/').pop() || 'home';
        
        if (label.includes(routeName) || routeName.includes(label)) {
          matchingRoutes.push(route.path);
        }
      } else if (interaction.type === 'button' || interaction.type === 'form') {
        const label = (interaction.label || '').toLowerCase().trim();
        const routePath = route.path.toLowerCase();
        const routeName = routePath.split('/').pop() || 'home';
        
        const navigationKeywords = ['go', 'navigate', 'next', 'continue', 'submit', 'save'];
        const hasNavKeyword = navigationKeywords.some(keyword => label.includes(keyword));
        
        if (hasNavKeyword || label.includes(routeName) || routeName.includes(label)) {
          matchingRoutes.push(route.path);
        }
      }
    }
  }
  
  if (hasMatchingStaticExpectations && selectorMismatchCount > 0) {
    return skipReasons.SELECTOR_MISMATCH;
  }
  
  if (matchingRoutes.length > 1) {
    return skipReasons.AMBIGUOUS_MATCH;
  }
  
  if (matchingRoutes.length === 1 && unreachableRoutes.has(matchingRoutes[0])) {
    return skipReasons.WEAK_EXPECTATION_DROPPED;
  }
  
  if (interaction.type === 'button' && !hasStaticExpectations && !hasRouteExpectations) {
    const label = (interaction.label || '').toLowerCase().trim();
    const navigationKeywords = ['go', 'navigate', 'next', 'continue', 'submit', 'save'];
    const hasNavKeyword = navigationKeywords.some(keyword => label.includes(keyword));
    
    if (!hasNavKeyword) {
      return skipReasons.UNSUPPORTED_INTERACTION;
    }
  }
  
  if (!hasStaticExpectations && !hasRouteExpectations) {
    return skipReasons.NO_EXPECTATION;
  }
  
  if (hasStaticExpectations && !hasMatchingStaticExpectations && !hasRouteExpectations) {
    return skipReasons.NO_EXPECTATION;
  }
  
  if (hasRouteExpectations && matchingRoutes.length === 0) {
    return skipReasons.NO_EXPECTATION;
  }
  
  return skipReasons.NO_EXPECTATION;
}

export function collectSkipReasons(skips) {
  const reasonCounts = new Map();
  const examples = [];
  
  for (const skip of skips) {
    const code = skip.code;
    reasonCounts.set(code, (reasonCounts.get(code) || 0) + 1);
    
    if (examples.length < MAX_EXAMPLES) {
      examples.push({
        interaction: {
          type: skip.interaction.type,
          selector: skip.interaction.selector ? skip.interaction.selector.substring(0, 100) : '',
          label: skip.interaction.label ? skip.interaction.label.substring(0, 100) : ''
        },
        code: code,
        message: skip.message
      });
    }
  }
  
  const reasons = Array.from(reasonCounts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.code.localeCompare(b.code);
    });
  
  return {
    total: skips.length,
    reasons: reasons,
    examples: examples
  };
}

