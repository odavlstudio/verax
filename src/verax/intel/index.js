/**
 * CODE INTELLIGENCE v1 — Main Orchestrator
 * 
 * Combines all intelligence modules to emit PROVEN expectations:
 * - Routes from AST
 * - Handlers from JSX
 * - Effects from function bodies
 * 
 * Every expectation has sourceRef. NO GUESSING.
 */

import { createTSProgram } from './ts-program.js';
import { extractRoutes } from './route-extractor.js';
import { extractHandlerMappings, extractSelectorHint, extractNavElements } from './handler-mapper.js';
import { detectEffects } from './effect-detector.js';
import { extractVueNavigationPromises } from '../vue-extractors/vue/vue-navigation-extractor.js';
import { normalizeDynamicRoute, normalizeTemplateLiteral } from '../shared/dynamic-route-normalizer.js';

/**
 * Run code intelligence analysis.
 * 
 * @param {string} projectRoot - Project root
 * @returns {Promise<Object>} - { routes, handlerMappings, expectations, stats }
 */
export async function runCodeIntelligence(projectRoot) {
  const result = {
    routes: [],
    handlerMappings: [],
    expectations: [],
    stats: {
      routesFound: 0,
      handlersFound: 0,
      effectsFound: 0,
      expectationsGenerated: 0,
      expectationsProven: 0
    },
    error: null
  };
  
  try {
    // Step 1: Create TypeScript Program
    const program = createTSProgram(projectRoot, { includeJs: true });
    
    if (program.error) {
      result.error = program.error;
      return result;
    }
    
    // Step 2: Extract routes (AST-based, no regex)
    const routes = extractRoutes(projectRoot, program);
    result.routes = routes;
    result.stats.routesFound = routes.length;
    
    // Step 3: Extract handler mappings (JSX → Function)
    const handlerMappings = extractHandlerMappings(projectRoot, program);
    result.handlerMappings = handlerMappings;
    result.stats.handlersFound = handlerMappings.length;
    
    // Step 4: For each handler, detect effects
    for (const mapping of handlerMappings) {
      const handlerSourceFile = mapping.handler.node.getSourceFile();
      // VALIDATION INTELLIGENCE v1: Pass eventType to detectEffects
      const eventType = mapping.element?.event || null;
      const effects = detectEffects(
        mapping.handler.node,
        handlerSourceFile,
        projectRoot,
        eventType
      );
      
      mapping.effects = effects;
      result.stats.effectsFound += effects.length;
      
      // Step 5a: Generate expectations from (element + handler + effect)
      for (const effect of effects) {
        const expectation = generateExpectation(mapping, effect);
        if (expectation) {
          result.expectations.push(expectation);
          result.stats.expectationsGenerated++;
          if (expectation.proof === 'PROVEN_EXPECTATION') {
            result.stats.expectationsProven++;
          }
        }
      }
      
      // Step 5b: Attribute-driven navigation expectations (href/to literal)
      if ((effects?.length || 0) === 0) {
        const attrs = mapping.element?.attrs || {};
        const target = attrs.to || attrs.href || null;
        if (target && typeof target === 'string' && target.startsWith('/')) {
          const expectation = {
            type: 'spa_navigation',
            targetPath: target,
            matchAttribute: attrs.to ? 'to' : (attrs.href ? 'href' : null),
            proof: 'PROVEN_EXPECTATION',
            sourceRef: mapping.element.sourceRef,
            selectorHint: extractSelectorHint(mapping.element) || `${mapping.element.tag}`,
            metadata: {
              elementFile: mapping.element.file,
              elementLine: mapping.element.line,
              handlerName: mapping.handler.name,
              handlerFile: mapping.handler.file,
              handlerLine: mapping.handler.line,
              eventType: mapping.element.event
            }
          };
          result.expectations.push(expectation);
          result.stats.expectationsGenerated++;
          result.stats.expectationsProven++;
        }
      }
    }
    
    // Step 5c: Generate expectations from plain Link/NavLink/a elements with static href/to
    const navElements = extractNavElements(projectRoot, program);
    for (const el of navElements) {
      const target = el.attrs.to || el.attrs.href || null;
      if (!target) continue;
      const expectation = {
        type: 'spa_navigation',
        targetPath: target,
        matchAttribute: el.attrs.to ? 'to' : (el.attrs.href ? 'href' : null),
        proof: 'PROVEN_EXPECTATION',
        sourceRef: el.sourceRef,
        selectorHint: extractSelectorHint(/** @type {any} */ ({ attributes: { properties: [] } })) || `${el.tag}`,
        metadata: {
          elementFile: el.file,
          elementLine: el.line,
          handlerName: null,
          handlerFile: null,
          handlerLine: null,
          eventType: 'click'
        }
      };
      result.expectations.push(expectation);
      result.stats.expectationsGenerated++;
      result.stats.expectationsProven++;
    }
    
    // Step 5d: Extract Vue navigation promises (router-link, RouterLink, router.push/replace)
    const vueNavPromises = await extractVueNavigationPromises(projectRoot, program);
    for (const promise of vueNavPromises) {
      result.expectations.push(promise);
      result.stats.expectationsGenerated++;
      if (promise.proof === 'PROVEN_EXPECTATION') {
        result.stats.expectationsProven++;
      }
    }
    
  } catch (err) {
    result.error = err.message || 'Unknown error';
  }
  
  return result;
}

/**
 * Generate expectation from handler mapping and effect.
 * 
 * @param {Object} mapping - Handler mapping
 * @param {Object} effect - Detected effect
 * @returns {Object|null} - Expectation object
 */
function generateExpectation(mapping, effect) {
  if (!effect || !effect.type) return null;
  
  const selectorHint = extractSelectorHint(mapping.element);
  
  const base = {
    selectorHint: selectorHint || `${mapping.element.tag}`,
    proof: 'PROVEN_EXPECTATION',
    sourceRef: effect.sourceRef,
    metadata: {
      elementFile: mapping.element.file,
      elementLine: mapping.element.line,
      handlerName: mapping.handler.name,
      handlerFile: mapping.handler.file,
      handlerLine: mapping.handler.line,
      effectFile: effect.file,
      effectLine: effect.line,
      eventType: mapping.element.event
    }
  };

  // Navigation → spa_navigation expectation with matchAttribute
  if (effect.type === 'navigation' && effect.target) {
    const matchAttribute = mapping.element?.attrs?.to
      ? 'to'
      : (mapping.element?.attrs?.href ? 'href' : null);
    // Extract navigation method (push/replace/navigate) from effect
    const navMethod = effect.method || 'push'; // Default to push if not specified
    
    // Normalize dynamic routes to example paths
    const normalized = normalizeDynamicRoute(effect.target) || normalizeTemplateLiteral(effect.target);
    
    if (normalized) {
      return {
        ...base,
        type: 'spa_navigation',
        targetPath: normalized.examplePath,
        originalPattern: normalized.originalPattern,
        isDynamic: true,
        exampleExecution: true,
        matchAttribute,
        expectedTarget: normalized.examplePath,
        navigationMethod: navMethod
      };
    }
    
    return {
      ...base,
      type: 'spa_navigation',
      targetPath: effect.target,
      matchAttribute,
      expectedTarget: effect.target,
      navigationMethod: navMethod
    };
  }

  // Network → network_action expectation
  if (effect.type === 'network') {
    return {
      ...base,
      type: 'network_action',
      method: effect.method || 'GET',
      expectedTarget: effect.target || null,
      urlPath: effect.target || null // Alias for compatibility
    };
  }

  // VALIDATION INTELLIGENCE v1: validation_block → validation_block expectation
  if (effect.type === 'validation_block') {
    return {
      ...base,
      type: 'validation_block',
      proof: 'PROVEN_EXPECTATION',
      handlerRef: base.metadata.handlerFile ? `${base.metadata.handlerFile}:${base.metadata.handlerLine}` : null
    };
  }

  // Validation → form submission expectation (legacy)
  if (effect.type === 'validation') {
    return {
      ...base,
      type: 'form_submission',
      expectedTarget: effect.target || null
    };
  }

  // State → state_action expectation
  if (effect.type === 'state' && effect.target) {
    return {
      ...base,
      type: 'state_action',
      expectedTarget: effect.target,
      storeType: effect.storeType || 'unknown',
      method: effect.method || null
    };
  }

  return null;
}

/**
 * Determine expectation type from effect.
 * 
 * @param {Object} effect - Effect object
 * @returns {string} - Expectation type
 */
function _determineExpectationType(effect) {
  switch (effect.type) {
    case 'navigation':
      return 'navigation';
    case 'network':
      return 'network_action';
    case 'validation':
      return 'form_submission'; // preventDefault typically in forms
    default:
      return 'unknown';
  }
}



