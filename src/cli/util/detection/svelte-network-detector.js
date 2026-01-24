/**
 * PHASE 20 — Svelte Network Detector
 * 
 * Detects network calls (fetch, axios) in Svelte component handlers and lifecycle functions.
 * Reuses AST network detector but ensures it works with Svelte SFC script blocks.
 */

import { extractSvelteSFC, extractTemplateBindings, mapTemplateHandlersToScript } from './svelte-sfc-extractor.js';
import { detectNetworkCallsAST } from './ast-network-detector.js';
import BaseDetector from './base-detector.js';

/**
 * Svelte Network Detector class (BaseDetector implementation)
 */
export class SvelteNetworkDetector extends BaseDetector {
  constructor() {
    super({
      name: 'svelte-network',
      framework: 'svelte',
      type: 'network',
    });
  }

  detect(filePath, content, projectRoot) {
    return detectSvelteNetwork(filePath, content, projectRoot);
  }
}
import { relative } from 'path';

/**
 * Detect network promises in Svelte SFC
 * 
 * @param {string} filePath - Path to .svelte file
 * @param {string} content - Full file content
 * @param {string} projectRoot - Project root directory
 * @returns {Array} Array of network expectations
 */
export function detectSvelteNetwork(filePath, content, projectRoot) {
  const expectations = [];
  
  try {
    const sfc = extractSvelteSFC(content);
    const { scriptBlocks, markup } = sfc;
    
    // Extract event handlers from markup to identify UI-bound handlers
    const templateBindings = markup ? extractTemplateBindings(markup.content) : { eventHandlers: [] };
    const mappedHandlers = scriptBlocks.length > 0 && templateBindings.eventHandlers.length > 0
      ? mapTemplateHandlersToScript(templateBindings.eventHandlers, scriptBlocks[0].content)
      : [];
    
    const uiBoundHandlers = new Set(mappedHandlers.map(h => h.handler));
    
    // Process each script block
    for (const scriptBlock of scriptBlocks) {
      if (!scriptBlock.content) continue;
      
      // Use AST network detector on script content
      const networkCalls = detectNetworkCallsAST(scriptBlock.content, filePath, relative(projectRoot, filePath));
      
      // Filter and enhance network calls
      for (const networkCall of networkCalls) {
        // Check if this is in a UI-bound handler
        const isUIBound = networkCall.context && uiBoundHandlers.has(networkCall.context);
        
        // Skip analytics-only calls (filtered by guardrails later)
        if (networkCall.target && (
          networkCall.target.includes('/api/analytics') ||
          networkCall.target.includes('/api/track') ||
          networkCall.target.includes('/api/beacon')
        )) {
          continue;
        }
        
        expectations.push({
          type: 'network',
          target: networkCall.target,
          method: networkCall.method || 'GET',
          context: networkCall.context || 'component',
          sourceRef: {
            file: filePath,
            line: networkCall.line || scriptBlock.startLine,
            snippet: networkCall.snippet || '',
          },
          proof: networkCall.proof || 'LIKELY_EXPECTATION',
          metadata: {
            isUIBound,
            handlerContext: networkCall.context,
          },
        });
      }
    }
  } catch (error) {
    // Skip if extraction fails
  }
  
  return expectations;
}




