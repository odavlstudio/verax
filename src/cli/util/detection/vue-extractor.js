/**
 * Vue Framework-Specific Expectation Extractor
 * PHASE H6: Extracts static routes from Vue Single File Components
 * 
 * Supported patterns:
 * - <router-link to="/path"> (static only)
 * - this.$router.push("/path") (static only)
 * - <form action="/path"> (static only)
 */

/**
 * Extract expectations from Vue files
 * @param {string} content - Vue file content
 * @param {string} filePath - File path for location tracking
 * @param {string} relPath - Relative path for reporting
 * @returns {Array} Expectations array
 */
export function extractVueExpectations(content, filePath, relPath, skipped = null) {
  const expectations = [];
  
  // Extract <router-link to="/path"> and <RouterLink to="/path"> - static only
  const routerLinkRegex = /<(?:router-link|RouterLink)\s+(?:[^>]*\s+)?to=["']([^"']+)["']/g;
  let match;
  
  while ((match = routerLinkRegex.exec(content)) !== null) {
    const path = match[1];
    
    // Skip dynamic paths (variables, expressions, param segments)
    if (
      path.includes('$') ||
      path.includes('{') ||
      path.includes('(') ||
      path.includes('[') ||
      path.includes('/:')
    ) {
      if (skipped) skipped.dynamic++;
      continue;
    }
    
    const lineNum = content.substring(0, match.index).split('\n').length;
    
    // Only extract static paths
    if (path.startsWith('/') || path.startsWith('http')) {
      expectations.push({
        kind: 'navigation',
        value: path,
        confidence: 0.95,
        source: {
          file: relPath,
          filePath,
          line: lineNum,
          column: match.index,
          pattern: '<router-link|RouterLink to>',
        },
        promise: {
          kind: 'navigation',
          value: path,
          description: `Vue router-link navigation to ${path}`,
        },
      });
    }
  }
  
  // Extract router.push("/path") and router.replace("/path") - static only
  const localRouterPushRegex = /(?:^|[^\w])router\.push\(["']([^"']+)["']\)/g;
  const localRouterReplaceRegex = /(?:^|[^\w])router\.replace\(["']([^"']+)["']\)/g;
  // Extract this.$router.push("/path") and this.$router.replace("/path") - static only
  const thisRouterPushRegex = /this\.\$router\.push\(["']([^"']+)["']\)/g;
  const thisRouterReplaceRegex = /this\.\$router\.replace\(["']([^"']+)["']\)/g;
  // Extract $router.push("/path") and $router.replace("/path") - static only
  const dollarRouterPushRegex = /\$router\.push\(["']([^"']+)["']\)/g;
  const dollarRouterReplaceRegex = /\$router\.replace\(["']([^"']+)["']\)/g;
  
  const pushReplaceExtract = (regex, patternLabel) => {
    let m;
    while ((m = regex.exec(content)) !== null) {
      const pathVal = m[1];
      if (pathVal.includes('$') || pathVal.includes('{') || pathVal.includes('(') || pathVal.includes('[')) {
        if (skipped) skipped.dynamic++;
        continue;
      }
      const ln = content.substring(0, m.index).split('\n').length;
      if (pathVal.startsWith('/') || pathVal.startsWith('http')) {
        expectations.push({
          kind: 'navigation',
          value: pathVal,
          confidence: 0.95,
          source: {
            file: relPath,
            filePath,
            line: ln,
            column: m.index,
            pattern: patternLabel,
          },
          promise: {
            kind: 'navigation',
            value: pathVal,
            description: `Vue navigation to ${pathVal}`,
          },
        });
      }
    }
  };
  
  pushReplaceExtract(localRouterPushRegex, 'router.push');
  pushReplaceExtract(localRouterReplaceRegex, 'router.replace');
  pushReplaceExtract(thisRouterPushRegex, 'this.$router.push');
  pushReplaceExtract(thisRouterReplaceRegex, 'this.$router.replace');
  pushReplaceExtract(dollarRouterPushRegex, '$router.push');
  pushReplaceExtract(dollarRouterReplaceRegex, '$router.replace');
  
  // Extract <form action="/path"> - static only
  const formActionRegex = /<form\s+[^>]*action=["']([^"']+)["']/gi;
  
  while ((match = formActionRegex.exec(content)) !== null) {
    const path = match[1];
    
    // Skip dynamic paths
    if (path.includes('$') || path.includes('{') || path.includes('(') || path.includes('[')) {
      if (skipped) skipped.dynamic++;
      continue;
    }
    
    const lineNum = content.substring(0, match.index).split('\n').length;
    
    if (path.startsWith('/') || path.startsWith('http')) {
      expectations.push({
        kind: 'form-submission',
        value: path,
        confidence: 0.85,
        source: {
          file: relPath,
          filePath,
          line: lineNum,
          column: match.index,
          pattern: '<form action>',
        },
        promise: {
          kind: 'form-submission',
          value: path,
          description: `Vue form submission to ${path}`,
        },
      });
    }
  }
  
  return expectations;
}
