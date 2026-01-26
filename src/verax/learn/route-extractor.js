// resolve import removed - currently unused
import { extractStaticRoutes } from './static-extractor.js';
import { createTSProgram } from '../intel/ts-program.js';
import { extractRoutes as extractRoutesAST } from '../intel/route-extractor.js';
import { defaultScopePolicy } from '../core/scope-policy.js';

// GATE 3: Scope filtering now uses centralized scope-policy.js
// This maintains legacy isInternalRoute() for backward compatibility
function isInternalRoute(path) {
  const classification = defaultScopePolicy.classify(path);
  return classification.classification !== 'IN_SCOPE_PUBLIC';
}

export async function extractRoutes(projectDir, projectType, scanOptions = {}) {
  // Static sites: use file-based extractor (no regex, just file system)
  if (projectType === 'static') {
    return await extractStaticRoutes(projectDir, projectType, scanOptions);
  }

  // React SPAs, Next.js, and Vue: use AST-based intel module (NO REGEX)
  if (projectType === 'react_spa' || 
      projectType === 'nextjs_app_router' || 
      projectType === 'nextjs_pages_router' ||
      projectType === 'vue_router' ||
      projectType === 'vue_spa') {
    const program = createTSProgram(projectDir, { includeJs: true });
    
    if (program.error) {
      // Fallback: return empty routes if TS program creation fails
      return [];
    }
    
    const astRoutes = extractRoutesAST(projectDir, program);
    
    // Convert AST routes to manifest format and sort for determinism
    const routes = astRoutes.map(r => ({
      path: r.path,
      source: r.sourceRef || r.file || 'unknown',
      public: r.public !== undefined ? r.public : !isInternalRoute(r.path),
      sourceRef: r.sourceRef
    }));
    routes.sort((a, b) => a.path.localeCompare(b.path));
    return routes;
  }
  
  return [];
}




