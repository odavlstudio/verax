// resolve, writeFileSync, mkdirSync imports removed - currently unused
import { extractStaticExpectations } from './static-extractor.js';
import { assessLearnTruth } from './truth-assessor.js';
import { runCodeIntelligence } from '../intel/index.js';
import { isProvenExpectation } from '../shared/expectation-prover.js';
import { extractFlows } from './flow-extractor.js';
import { createTSProgram } from '../intel/ts-program.js';
import { extractVueNavigationPromises } from '../vue-extractors/vue/vue-navigation-extractor.js';
import { defaultScopePolicy } from '../core/scope-policy.js';

/**
 * @typedef {Object} Manifest
 * @property {number} version
 * @property {string} projectDir
 * @property {string} projectType
 * @property {Array} routes
 * @property {Array<string>} publicRoutes
 * @property {Array<string>} internalRoutes
 * @property {number} [totalRoutesDiscovered]
 * @property {number} [routesInScope]
 * @property {Object} [routesOutOfScope]
 * @property {Array} [staticExpectations]
 * @property {Array} [flows]
 * @property {string} [expectationsStatus]
 * @property {Array} [coverageGaps]
 * @property {Array} notes
 * @property {Object} [learnTruth]
 */

/**
 * @param {string} projectDir
 * @param {string} projectType
 * @param {Array} routes
 * @param {Object} scanOptions - Optional scan configuration (learnPaths, allowEmptyLearn)
 * @returns {Promise<Manifest>}
 */
export async function writeManifest(projectDir, projectType, routes, scanOptions = {}) {
  const publicRoutes = routes.filter(r => r.public).map(r => r.path);
  const internalRoutes = routes.filter(r => !r.public).map(r => r.path);
  
  // GATE 3: Classify routes by scope
  const scopeClassification = defaultScopePolicy.classifyMany(routes.map(r => r.path));
  const skippedExamples = defaultScopePolicy.getSkippedExamples(scopeClassification, 10);
  
  const manifest = {
    version: 1,
    projectDir: projectDir,
    projectType: projectType,
    routes: routes.map(r => ({
      path: r.path,
      source: r.source,
      public: r.public,
      sourceRef: r.sourceRef || null
    })),
    publicRoutes: publicRoutes,
    internalRoutes: internalRoutes,
    // GATE 3: Scope enforcement transparency
    totalRoutesDiscovered: routes.length,
    routesInScope: scopeClassification.summary.inScopeCount,
    routesOutOfScope: {
      total: scopeClassification.summary.outOfScopeCount,
      byCategory: scopeClassification.summary.outOfScopeCounts,
      examples: skippedExamples
    },
    notes: []
  };
  
  let staticExpectations = null;
  let intelExpectations = [];
  let allExpectations = [];
  
  // Static sites: extract from HTML
  if (projectType === 'static' && routes.length > 0) {
    staticExpectations = await extractStaticExpectations(projectDir, routes, scanOptions);
    manifest.staticExpectations = staticExpectations;
    allExpectations = staticExpectations || [];
  }

  // Vue projects: extract navigation promises from code
  if (projectType === 'vue_router' || projectType === 'vue_spa') {
    const program = createTSProgram(projectDir, { includeJs: true });
    
    if (!program.error) {
      const vueNavPromises = await extractVueNavigationPromises(program, projectDir);
      
      if (vueNavPromises && vueNavPromises.length > 0) {
        intelExpectations = vueNavPromises.filter(exp => isProvenExpectation(exp));
        
        if (!manifest.staticExpectations) {
          manifest.staticExpectations = [];
        }
        manifest.staticExpectations.push(...intelExpectations);
        allExpectations = intelExpectations;
      }
    }
  }
  
  // React SPAs, Next.js, and Vue: use code intelligence (AST-based) - NO FALLBACKS
  if (projectType === 'react_spa' || 
      projectType === 'nextjs_app_router' || 
      projectType === 'nextjs_pages_router' ||
      projectType === 'vue_router' ||
      projectType === 'vue_spa') {
    const intelResult = await runCodeIntelligence(projectDir);
    
    if (!intelResult.error && intelResult.expectations) {
      // ZERO-HEURISTIC: Only include expectations that pass isProvenExpectation()
      intelExpectations = intelResult.expectations.filter(exp => isProvenExpectation(exp));
      
      // STATE INTELLIGENCE: Also extract state expectations from AST
      const { extractStateExpectationsFromAST } = await import('./state-extractor.js');
      const stateResult = await extractStateExpectationsFromAST(projectDir, projectType, scanOptions);
      
      if (stateResult.expectations && stateResult.expectations.length > 0) {
        // Convert state expectations to manifest format with sourceRef
        const stateExpectations = stateResult.expectations.map(exp => ({
          type: 'state_action',
          expectedTarget: exp.expectedTarget,
          storeType: exp.storeType,
          proof: 'PROVEN_EXPECTATION',
          sourceRef: exp.line ? `${exp.sourceFile}:${exp.line}` : exp.sourceFile,
          selectorHint: null, // State actions don't have selector hints from AST
          metadata: {
            sourceFile: exp.sourceFile,
            line: exp.line
          }
        })).filter(exp => isProvenExpectation(exp));
        
        intelExpectations.push(...stateExpectations);
      }
      
      // Add intel expectations to manifest
      if (!manifest.staticExpectations) {
        manifest.staticExpectations = [];
      }
      manifest.staticExpectations.push(...intelExpectations);
      allExpectations = intelExpectations;
    }
  }
  
  // ZERO-HEURISTIC: Set expectationsStatus and coverageGaps
  const provenCount = allExpectations.filter(exp => isProvenExpectation(exp)).length;
  
  if (provenCount === 0 && (projectType === 'react_spa' || 
      projectType === 'nextjs_app_router' || 
      projectType === 'nextjs_pages_router' ||
      projectType === 'vue_router' ||
      projectType === 'vue_spa')) {
    manifest.expectationsStatus = 'NO_PROVEN_EXPECTATIONS';
    manifest.coverageGaps = [{
      reason: 'NO_PROVEN_EXPECTATIONS_AVAILABLE',
      message: 'Code intelligence found no extractable literal effects (navigation, network, validation) with static string literals',
      projectType: projectType
    }];
  } else {
    manifest.expectationsStatus = 'PROVEN_EXPECTATIONS_AVAILABLE';
    manifest.coverageGaps = [];
  }
  
  // FLOW INTELLIGENCE v1: Extract flows from PROVEN expectations
  const flows = extractFlows(manifest);
  if (flows.length > 0) {
    manifest.flows = flows;
  }
  
  const learnTruth = await assessLearnTruth(projectDir, projectType, routes, allExpectations, scanOptions);
  manifest.notes.push({
    type: 'truth',
    learn: learnTruth
  });
  
  // Note: This function is still used by learn() function
  // Direct usage is deprecated in favor of CLI learn.json writer
  return manifest;
}




