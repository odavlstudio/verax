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

function matchesStaticExpectation(expectation, interaction, afterUrl) {
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
  const interactionLabel = (interaction.label || '').toLowerCase().trim();
  
  if (selectorHint && interactionSelector) {
    if (selectorHint.includes(interactionSelector) || interactionSelector.includes(selectorHint.replace(/[\]()]/g, ''))) {
      return true;
    }
  }
  
  return false;
}

export function expectsNavigation(manifest, interaction, beforeUrl) {
  if (manifest.staticExpectations && manifest.staticExpectations.length > 0) {
    const beforePath = getUrlPath(beforeUrl);
    if (beforePath) {
      const normalizedBefore = beforePath.replace(/\/$/, '') || '/';
      
      for (const expectation of manifest.staticExpectations) {
        if (expectation.type === 'navigation') {
          const normalizedFrom = expectation.fromPath.replace(/\/$/, '') || '/';
          
          if (normalizedFrom === normalizedBefore) {
            if (interaction.type === 'link') {
              const selectorHint = expectation.evidence.selectorHint || '';
              const interactionSelector = interaction.selector || '';
              const interactionLabel = (interaction.label || '').toLowerCase().trim();
              
              if (selectorHint && interactionSelector) {
                if (selectorHint.includes(interactionSelector) || interactionSelector.includes(selectorHint.replace(/[\[\]()]/g, ''))) {
                  return true;
                }
              }
              
              if (interactionLabel && expectation.targetPath) {
                const targetName = expectation.targetPath.split('/').pop() || 'home';
                if (interactionLabel.includes(targetName) || targetName.includes(interactionLabel)) {
                  return true;
                }
              }
            } else if (interaction.type === 'button') {
              const selectorHint = expectation.evidence.selectorHint || '';
              const interactionSelector = interaction.selector || '';
              
              if (selectorHint && interactionSelector) {
                if (selectorHint.includes(interactionSelector) || interactionSelector.includes(selectorHint.replace(/[\[\]()]/g, ''))) {
                  return true;
                }
              }
            }
          }
        } else if (expectation.type === 'form_submission') {
          const normalizedFrom = expectation.fromPath.replace(/\/$/, '') || '/';
          
          if (normalizedFrom === normalizedBefore && interaction.type === 'form') {
            const selectorHint = expectation.evidence.selectorHint || '';
            const interactionSelector = interaction.selector || '';
            
            if (selectorHint && interactionSelector) {
              if (selectorHint.includes(interactionSelector) || interactionSelector.includes(selectorHint.replace(/[\[\]()]/g, ''))) {
                return true;
              }
            }
          }
        }
      }
    }
  }
  
  if (manifest.projectType === 'react_spa' && interaction.type === 'link') {
    const beforePath = getUrlPath(beforeUrl);
    if (beforePath) {
      const href = interaction.selector ? interaction.selector.match(/href=["']([^"']+)["']/) : null;
      if (!href) {
        for (const route of manifest.routes) {
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
    
    for (const route of manifest.routes) {
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
      for (const route of manifest.routes) {
        if (!route.public) continue;
        if (route.path === '/' && label.includes('home')) {
          return true;
        }
        if (route.path !== '/') {
          return true;
        }
      }
    }
    
    for (const route of manifest.routes) {
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

