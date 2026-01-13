/**
 * Extract navigation expectations from static HTML files.
 * Detects router.push/replace/navigate calls in inline scripts.
 */

function extractNavigationExpectations(root, fromPath, file, _projectDir) {
  const expectations = [];
  
  // Extract from inline scripts
  const scripts = root.querySelectorAll('script');
  for (const script of scripts) {
    const scriptContent = script.textContent || '';
    if (!scriptContent) continue;
    
    // Find router.push/replace/navigate calls with string literals
    const routerPushMatches = scriptContent.matchAll(/router\.push\s*\(\s*['"]([^'"]+)['"]/g);
    const routerReplaceMatches = scriptContent.matchAll(/router\.replace\s*\(\s*['"]([^'"]+)['"]/g);
    const navigateMatches = scriptContent.matchAll(/navigate\s*\(\s*['"]([^'"]+)['"]/g);
    
    for (const match of [...routerPushMatches, ...routerReplaceMatches, ...navigateMatches]) {
      const target = match[1];
      if (!target) continue;
      
      // Only extract if it's a relative path (starts with /)
      if (!target.startsWith('/')) continue;
      
      // Find the button/function that triggers this
      const buttonId = scriptContent.match(/getElementById\s*\(\s*['"]([^'"]+)['"]/)?.[1];
      const functionName = scriptContent.match(/function\s+(\w+)\s*\(/)?.[1];
      
      let selectorHint = null;
      if (buttonId) {
        selectorHint = `#${buttonId}`;
      } else if (functionName) {
        // Try to find button with onclick that calls this function
        const buttons = root.querySelectorAll(`button[onclick*="${functionName}"]`);
        if (buttons.length > 0) {
          const btn = buttons[0];
          selectorHint = btn.id ? `#${btn.id}` : `button[onclick*="${functionName}"]`;
        }
      }
      
      if (selectorHint) {
        // Determine method from match
        let method = 'push';
        if (match[0].includes('replace')) {
          method = 'replace';
        } else if (match[0].includes('navigate')) {
          method = 'navigate';
        }
        
        expectations.push({
          fromPath: fromPath,
          type: 'spa_navigation',
          targetPath: target,
          expectedTarget: target,
          navigationMethod: method,
          proof: 'PROVEN_EXPECTATION',
          sourceRef: `${file}:${scriptContent.indexOf(match[0])}`,
          selectorHint: selectorHint,
          evidence: {
            source: file,
            selectorHint: selectorHint
          }
        });
      }
    }
  }
  
  // Also check onclick attributes directly
  const buttons = root.querySelectorAll('button[onclick]');
  for (const button of buttons) {
    const onclick = button.getAttribute('onclick') || '';
    const routerPushMatch = onclick.match(/router\.push\s*\(\s*['"]([^'"]+)['"]/);
    const routerReplaceMatch = onclick.match(/router\.replace\s*\(\s*['"]([^'"]+)['"]/);
    const navigateMatch = onclick.match(/navigate\s*\(\s*['"]([^'"]+)['"]/);
    
    const match = routerPushMatch || routerReplaceMatch || navigateMatch;
    if (match) {
      const target = match[1];
      if (target.startsWith('/')) {
        const buttonId = button.getAttribute('id');
        const selectorHint = buttonId ? `#${buttonId}` : `button[onclick*="${target}"]`;
        
        let method = 'push';
        if (routerReplaceMatch) {
          method = 'replace';
        } else if (navigateMatch) {
          method = 'navigate';
        }
        
        expectations.push({
          fromPath: fromPath,
          type: 'spa_navigation',
          targetPath: target,
          expectedTarget: target,
          navigationMethod: method,
          proof: 'PROVEN_EXPECTATION',
          sourceRef: `${file}:onclick`,
          selectorHint: selectorHint,
          evidence: {
            source: file,
            selectorHint: selectorHint
          }
        });
      }
    }
  }
  
  return expectations;
}

export { extractNavigationExpectations };

