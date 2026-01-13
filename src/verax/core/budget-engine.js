/**
 * Budget Engine
 * Allocates adaptive interaction budgets per route/page based on:
 * - Route criticality (has expectations or not)
 * - Number of routes in project
 * - Number of expectations per route
 * 
 * Deterministic and reproducible.
 */

export class BudgetEngine {
  constructor(options = {}) {
    this.baseBudgetPerRoute = options.baseBudgetPerRoute || 30;
    this.criticalRouteMultiplier = options.criticalRouteMultiplier || 2.0;
    this.nonCriticalRouteMultiplier = options.nonCriticalRouteMultiplier || 0.5;
    this.expectationMultiplier = options.expectationMultiplier || 1.5;
    this.minBudget = options.minBudget || 5;
    this.maxBudget = options.maxBudget || 100;
  }

  /**
   * Allocate budget for a single route
   * @param {Object} route - Route object with url, interactions
   * @param {Array} expectations - Expectations for this route
   * @return {Object} Budget allocation { budget, isCritical, reason }
   */
  allocateBudgetForRoute(route, expectations = []) {
    const isCritical = expectations.length > 0;
    let budget = this.baseBudgetPerRoute;

    if (isCritical) {
      // Critical routes with expectations get higher budget
      budget = Math.floor(budget * this.criticalRouteMultiplier);
      
      // Additional budget boost for routes with many expectations
      if (expectations.length > 3) {
        budget = Math.floor(budget * this.expectationMultiplier);
      }
    } else {
      // Non-critical routes get reduced budget
      budget = Math.floor(budget * this.nonCriticalRouteMultiplier);
    }

    // Clamp to min/max
    budget = Math.max(this.minBudget, Math.min(this.maxBudget, budget));

    return {
      budget,
      isCritical,
      reason: isCritical 
        ? `critical_route_${expectations.length}_expectations`
        : 'non_critical_route',
      routeUrl: route.url || route.path || 'unknown'
    };
  }

  /**
   * Allocate budgets for all routes deterministically
   * @param {Array} routes - Array of route objects
   * @param {Array} allExpectations - All expectations across routes
   * @return {Array} Array of budget allocations sorted by URL for stability
   */
  allocateBudgets(routes, allExpectations = []) {
    // Group expectations by route
    const expectationsByRoute = new Map();
    for (const exp of allExpectations) {
      const routeUrl = exp.expectedRoute || exp.fromPath || '/';
      if (!expectationsByRoute.has(routeUrl)) {
        expectationsByRoute.set(routeUrl, []);
      }
      expectationsByRoute.get(routeUrl).push(exp);
    }

    // Allocate budget for each route
    const allocations = [];
    for (const route of routes) {
      const routeUrl = route.url || route.path || '/';
      const expectations = expectationsByRoute.get(routeUrl) || [];
      const allocation = this.allocateBudgetForRoute(route, expectations);
      allocations.push({
        ...allocation,
        routeUrl: routeUrl
      });
    }

    // Sort deterministically by routeUrl for stable ordering
    allocations.sort((a, b) => {
      return (a.routeUrl || '').localeCompare(b.routeUrl || '');
    });

    return allocations;
  }

  /**
   * Compute total budget across all routes
   * @param {Array} routes - Array of route objects
   * @param {Array} allExpectations - All expectations across routes
   * @return {Object} Total budget stats
   */
  computeTotalBudget(routes, allExpectations = []) {
    const allocations = this.allocateBudgets(routes, allExpectations);
    
    const totalBudget = allocations.reduce((sum, alloc) => sum + alloc.budget, 0);
    const criticalRoutes = allocations.filter(a => a.isCritical).length;
    const nonCriticalRoutes = allocations.filter(a => !a.isCritical).length;

    return {
      totalBudget,
      totalRoutes: routes.length,
      criticalRoutes,
      nonCriticalRoutes,
      averageBudgetPerRoute: routes.length > 0 ? Math.round(totalBudget / routes.length) : 0,
      allocations
    };
  }

  /**
   * Get budget for a specific route URL
   * @param {string} routeUrl - Route URL to query
   * @param {Array} allocations - Pre-computed allocations
   * @return {number|null} Budget or null if not found
   */
  getBudgetForRoute(routeUrl, allocations) {
    const allocation = allocations.find(a => a.routeUrl === routeUrl);
    return allocation ? allocation.budget : null;
  }
}

// Legacy functional API for backwards compatibility
export function computeRouteBudget(manifest, currentUrl, baseBudget) {
  const routes = manifest.routes || [];
  const expectations = manifest.staticExpectations || [];
  const totalRoutes = routes.length;
  // const totalExpectations = expectations.length; // Reserved for future use
  
  // Count expectations per route
  const routeExpectationCount = new Map();
  for (const exp of expectations) {
    const routePath = exp.fromPath || '*';
    routeExpectationCount.set(routePath, (routeExpectationCount.get(routePath) || 0) + 1);
  }
  
  // Find matching route for current URL
  const urlPath = extractPathFromUrl(currentUrl);
  const urlPathNormalized = normalizePath(urlPath);
  
  // Try exact match first, then prefix match (but not root '/')
  const matchingRoute = routes.find(r => {
    const routePath = normalizePath(r.path);
    if (routePath === '*' || routePath === urlPathNormalized) {
      return true;
    }
    // Prefix match: only if routePath is not '/' and urlPath starts with routePath + '/'
    if (routePath !== '/' && urlPathNormalized.startsWith(routePath + '/')) {
      return true;
    }
    return false;
  });
  
  const routePath = matchingRoute?.path || urlPath || '*';
  const expectationsForRoute = routeExpectationCount.get(routePath) || 0;
  
  // Deterministic budget allocation:
  // - Base: baseBudget.maxInteractionsPerPage
  // - Critical routes (with expectations) get 1.5x budget
  // - Non-critical routes get 0.7x budget
  // - If total routes > 50, reduce all budgets proportionally
  
  let interactionBudget = baseBudget.maxInteractionsPerPage || 30;
  
  if (expectationsForRoute > 0) {
    // Critical route: has expectations
    interactionBudget = Math.floor(interactionBudget * 1.5);
  } else if (totalRoutes > 10) {
    // Non-critical route in large project: reduce budget
    interactionBudget = Math.floor(interactionBudget * 0.7);
  }
  
  // Scale down if project is very large
  if (totalRoutes > 50) {
    const scaleFactor = Math.max(0.6, 50 / totalRoutes);
    interactionBudget = Math.floor(interactionBudget * scaleFactor);
  }
  
  // Ensure minimum budget
  interactionBudget = Math.max(5, interactionBudget);
  
  // Ensure maximum budget cap
  interactionBudget = Math.min(100, interactionBudget);
  
  return {
    ...baseBudget,
    maxInteractionsPerPage: interactionBudget,
    routePath: routePath,
    expectationsForRoute: expectationsForRoute,
    budgetReason: expectationsForRoute > 0 ? 'critical_route' : (totalRoutes > 10 ? 'non_critical_large_project' : 'default')
  };
}

/**
 * Extract path from URL
 */
function extractPathFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    return url;
  }
}

/**
 * Normalize path for comparison
 */
function normalizePath(path) {
  if (!path) return '/';
  return path.replace(/\/$/, '') || '/';
}
