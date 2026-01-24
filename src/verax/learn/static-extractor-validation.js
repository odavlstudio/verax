/**
 * Extract validation_block expectations from static HTML files.
 * Detects preventDefault() calls in onSubmit handlers.
 */

function extractValidationExpectations(root, fromPath, file, _projectDir) {
  const expectations = [];
  
  // Extract from inline scripts
  const scripts = root.querySelectorAll('script');
  for (const script of scripts) {
    const scriptContent = script.textContent || '';
    if (!scriptContent) continue;
    
    // Find preventDefault() calls in functions that might be onSubmit handlers
    const preventDefaultMatches = scriptContent.matchAll(/preventDefault\s*\(\s*\)/g);
    
    for (const match of preventDefaultMatches) {
      // Check if this is in an onSubmit context
      // Look for function definitions that might be onSubmit handlers
      const beforeMatch = scriptContent.substring(0, match.index);
      const _afterMatch = scriptContent.substring(match.index);
      
      // Check if there's a function definition before this preventDefault
      const functionMatch = beforeMatch.match(/function\s+(\w+)\s*\([^)]*event[^)]*\)/);
      const onSubmitMatch = beforeMatch.match(/onsubmit\s*=\s*["'](\w+)["']/);
      
      let functionName = null;
      if (functionMatch) {
        functionName = functionMatch[1];
      } else if (onSubmitMatch) {
        functionName = onSubmitMatch[1];
      }
      
      if (functionName) {
        // Find form with onsubmit that calls this function
        const forms = root.querySelectorAll(`form[onsubmit*="${functionName}"]`);
        for (const form of forms) {
          const formId = form.getAttribute('id');
          const selectorHint = formId ? `#${formId}` : `form[onsubmit*="${functionName}"]`;
          
          expectations.push({
            fromPath: fromPath,
            type: 'validation_block',
            proof: 'PROVEN_EXPECTATION',
            sourceRef: `${file}:${scriptContent.substring(0, match.index).split('\n').length}`,
            selectorHint: selectorHint,
            handlerRef: `${file}:${functionName}`,
            evidence: {
              source: file,
              selectorHint: selectorHint
            }
          });
        }
      }
    }
  }
  
  // Also check inline onsubmit attributes directly
  const forms = root.querySelectorAll('form[onsubmit]');
  for (const form of forms) {
    const onsubmit = form.getAttribute('onsubmit') || '';
    const preventDefaultMatch = onsubmit.match(/preventDefault\s*\(\s*\)/);
    
    if (preventDefaultMatch) {
      const formId = form.getAttribute('id');
      const selectorHint = formId ? `#${formId}` : `form[onsubmit*="preventDefault"]`;
      
      expectations.push({
        fromPath: fromPath,
        type: 'validation_block',
        proof: 'PROVEN_EXPECTATION',
        sourceRef: `${file}:onsubmit`,
        selectorHint: selectorHint,
        handlerRef: `${file}:onsubmit`,
        evidence: {
          source: file,
          selectorHint: selectorHint
        }
      });
    }
  }
  
  return expectations;
}

export { extractValidationExpectations };




