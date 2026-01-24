/**
 * PHASE 20 — Svelte Navigation Detector
 * 
 * Detects navigation promises in Svelte applications:
 * - <a href="/path"> links
 * - goto() calls from SvelteKit
 * - programmatic navigation
 */

import { extractSvelteSFC, extractTemplateBindings as _extractTemplateBindings, mapTemplateHandlersToScript as _mapTemplateHandlersToScript } from './svelte-sfc-extractor.js';
import BaseDetector from './base-detector.js';
/**
 * Svelte Navigation Detector class (BaseDetector implementation)
 */
export class SvelteNavigationDetector extends BaseDetector {
  constructor() {
    super({
      name: 'svelte-navigation',
      framework: 'svelte',
      type: 'navigation',
    });
  }

  detect(filePath, content, projectRoot) {
    return detectSvelteNavigation(filePath, content, projectRoot);
  }
}
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

/**
 * Detect navigation promises in Svelte SFC
 * 
 * @param {string} filePath - Path to .svelte file
 * @param {string} content - Full file content
 * @param {string} _projectRoot - Project root directory (unused)
 * @returns {Array} Array of navigation expectations
 */
export function detectSvelteNavigation(filePath, content, _projectRoot) {
  const expectations = [];
  
  try {
    const sfc = extractSvelteSFC(content);
    const { scriptBlocks, markup } = sfc;
    
    // Extract navigation from markup (links)
    if (markup && markup.content) {
      const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
      let linkMatch;
      while ((linkMatch = linkRegex.exec(markup.content)) !== null) {
        const href = linkMatch[1];
        // Skip external links and hash-only links
        if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#')) {
          continue;
        }
        
        const beforeMatch = markup.content.substring(0, linkMatch.index);
        const line = markup.startLine + (beforeMatch.match(/\n/g) || []).length;
        
        expectations.push({
          type: 'navigation',
          target: href,
          context: 'markup',
          sourceRef: {
            file: filePath,
            line,
            snippet: linkMatch[0],
          },
          proof: 'PROVEN_EXPECTATION',
          metadata: {
            navigationType: 'link',
          },
        });
      }
    }
    
    // Extract navigation from script blocks (goto, navigate, etc.)
    for (const scriptBlock of scriptBlocks) {
      if (!scriptBlock.content) continue;
      
      try {
        const ast = parse(scriptBlock.content, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
        });
        
        traverse.default(ast, {
          CallExpression(path) {
            const { node } = path;
            
            // Detect goto() calls (SvelteKit)
            if (
              node.callee.type === 'Identifier' &&
              node.callee.name === 'goto' &&
              node.arguments.length > 0
            ) {
              const arg = node.arguments[0];
              let target = null;
              
              if (arg.type === 'StringLiteral') {
                target = arg.value;
              } else if (arg.type === 'TemplateLiteral' && arg.quasis.length === 1) {
                target = arg.quasis[0].value.raw;
              }
              
              if (target && !target.startsWith('http://') && !target.startsWith('https://') && !target.startsWith('#')) {
                const location = node.loc;
                const line = scriptBlock.startLine + (location ? location.start.line - 1 : 0);
                
                expectations.push({
                  type: 'navigation',
                  target,
                  context: 'goto',
                  sourceRef: {
                    file: filePath,
                    line,
                    snippet: scriptBlock.content.substring(
                      node.start - (ast.program.body[0]?.start || 0),
                      node.end - (ast.program.body[0]?.start || 0)
                    ),
                  },
                  proof: arg.type === 'StringLiteral' ? 'PROVEN_EXPECTATION' : 'LIKELY_EXPECTATION',
                  metadata: {
                    navigationType: 'goto',
                  },
                });
              }
            }
            
            // Detect navigate() calls (if imported)
            if (
              node.callee.type === 'MemberExpression' &&
              node.callee.property.name === 'navigate' &&
              node.arguments.length > 0
            ) {
              const arg = node.arguments[0];
              let target = null;
              
              if (arg.type === 'StringLiteral') {
                target = arg.value;
              } else if (arg.type === 'TemplateLiteral' && arg.quasis.length === 1) {
                target = arg.quasis[0].value.raw;
              }
              
              if (target && !target.startsWith('http://') && !target.startsWith('https://') && !target.startsWith('#')) {
                const location = node.loc;
                const line = scriptBlock.startLine + (location ? location.start.line - 1 : 0);
                
                expectations.push({
                  type: 'navigation',
                  target,
                  context: 'navigate',
                  sourceRef: {
                    file: filePath,
                    line,
                    snippet: scriptBlock.content.substring(
                      node.start - (ast.program.body[0]?.start || 0),
                      node.end - (ast.program.body[0]?.start || 0)
                    ),
                  },
                  proof: arg.type === 'StringLiteral' ? 'PROVEN_EXPECTATION' : 'LIKELY_EXPECTATION',
                  metadata: {
                    navigationType: 'navigate',
                  },
                });
              }
            }
          },
        });
      } catch (parseError) {
        // Skip if parsing fails
      }
    }
  } catch (error) {
    // Skip if extraction fails
  }
  
  return expectations;
}




