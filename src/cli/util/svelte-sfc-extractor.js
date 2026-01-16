/**
 * PHASE 20 — Svelte SFC (Single File Component) Extractor
 * 
 * Extracts <script>, <script context="module">, and markup content from .svelte files.
 * Deterministic and robust (no external runtime execution).
 */

/**
 * PHASE 20: Extract Svelte SFC blocks
 * 
 * @param {string} content - Full .svelte file content
 * @returns {Object} { scriptBlocks: [{content, lang, startLine, isModule}], markup: {content, startLine} }
 */
export function extractSvelteSFC(content) {
  const scriptBlocks = [];
  let markup = null;
  
  // Extract <script> blocks (including <script context="module">)
  const scriptRegex = /<script(?:\s+context=["']module["'])?(?:\s+lang=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  
  while ((scriptMatch = scriptRegex.exec(content)) !== null) {
    const isModule = scriptMatch[0].includes('context="module"') || scriptMatch[0].includes("context='module'");
    const lang = scriptMatch[1] || 'js';
    const scriptContent = scriptMatch[2];
    
    // Calculate start line
    const beforeMatch = content.substring(0, scriptMatch.index);
    const startLine = (beforeMatch.match(/\n/g) || []).length + 1;
    
    scriptBlocks.push({
      content: scriptContent.trim(),
      lang: lang.toLowerCase(),
      startLine,
      isModule,
    });
  }
  
  // Extract markup (everything outside script/style tags)
  // Svelte markup is the template content
  const styleRegex = /<style[^>]*>[\s\S]*?<\/style>/gi;
  const allScriptRegex = /<script[^>]*>[\s\S]*?<\/script>/gi;
  
  let markupContent = content;
  // Remove style blocks
  markupContent = markupContent.replace(styleRegex, '');
  // Remove script blocks
  markupContent = markupContent.replace(allScriptRegex, '');
  
  // Find first non-whitespace line for markup
  const lines = content.split('\n');
  let markupStartLine = 1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() && !line.trim().startsWith('<script') && !line.trim().startsWith('<style')) {
      markupStartLine = i + 1;
      break;
    }
  }
  
  if (markupContent.trim()) {
    markup = {
      content: markupContent.trim(),
      startLine: markupStartLine,
    };
  }
  
  return {
    scriptBlocks,
    markup,
  };
}

/**
 * Extract template bindings from Svelte markup
 * Detects reactive statements, event handlers, and bindings
 * 
 * @param {string} markupContent - Svelte markup content
 * @returns {Object} { reactiveStatements: [], eventHandlers: [], bindings: [] }
 */
export function extractTemplateBindings(markupContent) {
  const reactiveStatements = [];
  const eventHandlers = [];
  const bindings = [];
  
  // Extract reactive statements: $: statements
  const reactiveRegex = /\$:\s*([^;]+);/g;
  let reactiveMatch;
  while ((reactiveMatch = reactiveRegex.exec(markupContent)) !== null) {
    reactiveStatements.push({
      statement: reactiveMatch[1].trim(),
      line: (markupContent.substring(0, reactiveMatch.index).match(/\n/g) || []).length + 1,
    });
  }
  
  // Extract event handlers: on:click, on:submit, etc.
  const eventHandlerRegex = /on:(\w+)=["']([^"']+)["']/g;
  let handlerMatch;
  while ((handlerMatch = eventHandlerRegex.exec(markupContent)) !== null) {
    eventHandlers.push({
      event: handlerMatch[1],
      handler: handlerMatch[2],
      line: (markupContent.substring(0, handlerMatch.index).match(/\n/g) || []).length + 1,
    });
  }
  
  // Extract bindings: bind:value, bind:checked, etc.
  const bindingRegex = /bind:(\w+)=["']([^"']+)["']/g;
  let bindingMatch;
  while ((bindingMatch = bindingRegex.exec(markupContent)) !== null) {
    bindings.push({
      property: bindingMatch[1],
      variable: bindingMatch[2],
      line: (markupContent.substring(0, bindingMatch.index).match(/\n/g) || []).length + 1,
    });
  }
  
  return {
    reactiveStatements,
    eventHandlers,
    bindings,
  };
}

/**
 * Map template handlers to script functions
 * Helps identify which handlers are UI-bound
 * 
 * @param {Array} eventHandlers - Event handlers from template
 * @param {string} scriptContent - Script block content
 * @returns {Array} Mapped handlers with function references
 */
export function mapTemplateHandlersToScript(eventHandlers, scriptContent) {
  return eventHandlers.map(handler => {
    // Try to find function definition in script
    const functionRegex = new RegExp(`(?:function\\s+${handler.handler}|const\\s+${handler.handler}\\s*=\\s*[^(]*\\(|${handler.handler}\\s*=\\s*[^(]*\\(|export\\s+function\\s+${handler.handler})`, 'g');
    const functionMatch = functionRegex.exec(scriptContent);
    
    return {
      ...handler,
      functionFound: !!functionMatch,
      functionLine: functionMatch ? (scriptContent.substring(0, functionMatch.index).match(/\n/g) || []).length + 1 : null,
    };
  });
}

