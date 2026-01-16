/**
 * PHASE 20 — Vue SFC (Single File Component) Extractor
 * 
 * Extracts <script>, <script setup>, and <template> content from .vue files.
 * Deterministic and robust (no external runtime execution).
 */

/**
 * PHASE 20: Extract Vue SFC blocks
 * 
 * @param {string} content - Full .vue file content
 * @returns {Object} { scriptBlocks: [{content, lang, startLine}], template: {content, startLine} }
 */
export function extractVueSFC(content) {
  const scriptBlocks = [];
  let template = null;
  
  // Extract <script> blocks (including <script setup>)
  const scriptRegex = /<script(?:\s+setup)?(?:\s+lang=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  let _lineOffset = 1;
  
  while ((scriptMatch = scriptRegex.exec(content)) !== null) {
    const isSetup = scriptMatch[0].includes('setup');
    const lang = scriptMatch[1] || 'js';
    const scriptContent = scriptMatch[2];
    
    // Calculate start line
    const beforeMatch = content.substring(0, scriptMatch.index);
    const startLine = (beforeMatch.match(/\n/g) || []).length + 1;
    
    scriptBlocks.push({
      content: scriptContent.trim(),
      lang: lang.toLowerCase(),
      startLine,
      isSetup,
    });
  }
  
  // Extract <template> block
  const templateRegex = /<template[^>]*>([\s\S]*?)<\/template>/i;
  const templateMatch = content.match(templateRegex);
  
  if (templateMatch) {
    const beforeTemplate = content.substring(0, templateMatch.index);
    const templateStartLine = (beforeTemplate.match(/\n/g) || []).length + 1;
    
    template = {
      content: templateMatch[1].trim(),
      startLine: templateStartLine,
    };
  }
  
  return {
    scriptBlocks,
    template,
  };
}

/**
 * PHASE 20: Extract template bindings and references
 * 
 * @param {string} templateContent - Template content
 * @returns {Object} { bindings: string[], routerLinks: Array, eventHandlers: Array }
 */
export function extractTemplateBindings(templateContent) {
  const bindings = [];
  const routerLinks = [];
  const eventHandlers = [];
  
  // Extract variable bindings: {{ var }}, :prop="var", v-if="var", etc.
  const bindingPatterns = [
    /\{\{\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\}\}/g,  // {{ var }}
    /:([a-zA-Z-]+)=["']([^"']+)["']/g,  // :prop="value"
    /v-if=["']([^"']+)["']/g,  // v-if="condition"
    /v-show=["']([^"']+)["']/g,  // v-show="condition"
    /v-model=["']([^"']+)["']/g,  // v-model="value"
  ];
  
  for (const pattern of bindingPatterns) {
    let match;
    while ((match = pattern.exec(templateContent)) !== null) {
      const binding = match[1] || match[2];
      if (binding && !bindings.includes(binding)) {
        bindings.push(binding);
      }
    }
  }
  
  // Extract <router-link> usage
  const routerLinkRegex = /<router-link[^>]*\s+to=["']([^"']+)["'][^>]*>/gi;
  let routerLinkMatch;
  while ((routerLinkMatch = routerLinkRegex.exec(templateContent)) !== null) {
    routerLinks.push({
      to: routerLinkMatch[1],
      fullMatch: routerLinkMatch[0],
    });
  }
  
  // Extract event handlers: @click="handler", @submit.prevent="handler"
  const eventHandlerRegex = /@([a-z]+)(?:\.([a-z]+)*)?=["']([^"']+)["']/gi;
  let eventMatch;
  while ((eventMatch = eventHandlerRegex.exec(templateContent)) !== null) {
    eventHandlers.push({
      event: eventMatch[1],
      modifiers: eventMatch[2] ? eventMatch[2].split('.') : [],
      handler: eventMatch[3],
    });
  }
  
  return {
    bindings,
    routerLinks,
    eventHandlers,
  };
}

/**
 * PHASE 20: Map template handlers to script functions
 * 
 * @param {Object} templateBindings - Result from extractTemplateBindings
 * @param {Array} scriptBlocks - Script blocks from extractVueSFC
 * @returns {Map} handlerName -> { scriptBlock, functionInfo }
 */
export function mapTemplateHandlersToScript(templateBindings, scriptBlocks) {
  const handlerMap = new Map();
  
  for (const handler of templateBindings.eventHandlers) {
    const handlerName = handler.handler;
    
    // Find handler in script blocks
    for (const scriptBlock of scriptBlocks) {
      const scriptContent = scriptBlock.content;
      
      // Look for function declarations: function handlerName() {}
      const functionRegex = new RegExp(`(?:function|const|let|var)\\s+${handlerName}\\s*[=(]`, 'g');
      if (functionRegex.test(scriptContent)) {
        handlerMap.set(handlerName, {
          scriptBlock,
          handler,
          type: 'function',
        });
        break;
      }
      
      // Look for method definitions: methods: { handlerName() {} }
      const methodRegex = new RegExp(`(?:methods|setup)\\s*:\\s*\\{[^}]*${handlerName}\\s*[:(]`, 's');
      if (methodRegex.test(scriptContent)) {
        handlerMap.set(handlerName, {
          scriptBlock,
          handler,
          type: 'method',
        });
        break;
      }
    }
  }
  
  return handlerMap;
}

