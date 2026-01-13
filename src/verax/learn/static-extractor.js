import { glob } from 'glob';
import { resolve, dirname, relative } from 'path';
import { readFileSync, existsSync } from 'fs';
import { parse } from 'node-html-parser';

const MAX_HTML_FILES = 200;

function htmlFileToRoute(file) {
  let path = file.replace(/[\\/]/g, '/');
  path = path.replace(/\/index.html$/, '');
  path = path.replace(/\.html$/, '');
  path = path.replace(/^index$/, '');
  
  if (path === '' || path === '/') {
    return '/';
  }
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  
  return path;
}

function resolveLinkPath(href, fromFile, projectDir) {
  if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
    return null;
  }
  
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return null;
  }
  
  try {
    if (href.startsWith('/')) {
      return htmlFileToRoute(href);
    }
    
    const fromDir = dirname(resolve(projectDir, fromFile));
    const resolved = resolve(fromDir, href);
    const relativePath = relative(projectDir, resolved);
    
    if (relativePath.startsWith('..')) {
      return null;
    }
    
    return htmlFileToRoute(relativePath);
  } catch (error) {
    return null;
  }
}

export async function extractStaticRoutes(projectDir) {
  const routes = [];
  const routeSet = new Set();
  
  const htmlFiles = await glob('**/*.html', {
    cwd: projectDir,
    absolute: false,
    ignore: ['node_modules/**']
  });
  
  for (const file of htmlFiles.slice(0, MAX_HTML_FILES)) {
    const routePath = htmlFileToRoute(file);
    const routeKey = routePath;
    
    if (!routeSet.has(routeKey)) {
      routeSet.add(routeKey);
      routes.push({
        path: routePath,
        source: file,
        public: true
      });
    }
  }
  
  routes.sort((a, b) => a.path.localeCompare(b.path));
  
  return routes;
}

function extractButtonNavigationExpectations(root, fromPath, file, routeMap, projectDir) {
  const expectations = [];
  
  const buttons = root.querySelectorAll('button');
  for (const button of buttons) {
    let targetPath = null;
    let selectorHint = null;
    
    const buttonId = button.getAttribute('id');
    const dataHref = button.getAttribute('data-href');
    const onclick = button.getAttribute('onclick') || '';
    
    if (dataHref) {
      targetPath = resolveLinkPath(dataHref, file, projectDir);
      if (targetPath && routeMap.has(targetPath)) {
        selectorHint = buttonId ? `#${buttonId}` : `button[data-href="${dataHref}"]`;
      }
    } else if (onclick) {
      const locationMatch = onclick.match(/window\.location\s*=\s*['"]([^'"]+)['"]|document\.location\s*=\s*['"]([^'"]+)['"]/);
      if (locationMatch) {
        const href = locationMatch[1] || locationMatch[2];
        targetPath = resolveLinkPath(href, file, projectDir);
        if (targetPath && routeMap.has(targetPath)) {
          selectorHint = buttonId ? `#${buttonId}` : `button[onclick*="${href}"]`;
        }
      }
    } else {
      const parentLink = button.closest('a[href]');
      if (parentLink) {
        const href = parentLink.getAttribute('href');
        targetPath = resolveLinkPath(href, file, projectDir);
        if (targetPath && routeMap.has(targetPath)) {
          selectorHint = buttonId ? `#${buttonId}` : `button`;
        }
      }
    }
    
    if (targetPath && selectorHint) {
      expectations.push({
        fromPath: fromPath,
        type: 'navigation',
        targetPath: targetPath,
        evidence: {
          source: file,
          selectorHint: selectorHint
        }
      });
    }
  }
  
  return expectations;
}

function extractFormSubmissionExpectations(root, fromPath, file, routeMap, projectDir) {
  const expectations = [];
  
  const forms = root.querySelectorAll('form[action]');
  for (const form of forms) {
    const action = form.getAttribute('action');
    if (!action) continue;
    
    const targetPath = resolveLinkPath(action, file, projectDir);
    if (!targetPath || !routeMap.has(targetPath)) continue;
    
    const formId = form.getAttribute('id');
    const selectorHint = formId ? `#${formId}` : `form[action="${action}"]`;
    
    expectations.push({
      fromPath: fromPath,
      type: 'form_submission',
      targetPath: targetPath,
      evidence: {
        source: file,
        selectorHint: selectorHint
      }
    });
  }
  
  return expectations;
}

function extractNetworkExpectations(root, fromPath, file, _projectDir) {
  const expectations = [];
  
  // Extract from inline scripts
  const scripts = root.querySelectorAll('script');
  for (const script of scripts) {
    const scriptContent = script.textContent || '';
    if (!scriptContent) continue;
    
    // Find fetch() calls with string literals
    const fetchMatches = scriptContent.matchAll(/fetch\s*\(\s*['"]([^'"]+)['"]/g);
    for (const match of fetchMatches) {
      const endpoint = match[1];
      if (!endpoint) continue;
      
      // Only extract if it's an API endpoint (starts with /api/)
      if (!endpoint.startsWith('/api/')) continue;
      
      // Find the button/function that triggers this
      // Look for onclick handlers or function definitions
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
        // Determine method from fetch options if present
        let method = 'GET';
        const methodMatch = scriptContent.match(/method\s*:\s*['"]([^'"]+)['"]/i);
        if (methodMatch) {
          method = methodMatch[1].toUpperCase();
        }
        
        expectations.push({
          fromPath: fromPath,
          type: 'network_action',
          expectedTarget: endpoint,
          urlPath: endpoint,
          method: method,
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
    const fetchMatch = onclick.match(/fetch\s*\(\s*['"]([^'"]+)['"]/);
    if (fetchMatch) {
      const endpoint = fetchMatch[1];
      if (endpoint.startsWith('/api/')) {
        const buttonId = button.getAttribute('id');
        const selectorHint = buttonId ? `#${buttonId}` : `button[onclick*="${endpoint}"]`;
        
        let method = 'GET';
        const methodMatch = onclick.match(/method\s*:\s*['"]([^'"]+)['"]/i);
        if (methodMatch) {
          method = methodMatch[1].toUpperCase();
        }
        
        expectations.push({
          fromPath: fromPath,
          type: 'network_action',
          expectedTarget: endpoint,
          urlPath: endpoint,
          method: method,
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

export async function extractStaticExpectations(projectDir, routes) {
  const expectations = [];
  const routeMap = new Map(routes.map(r => [r.path, r]));
  
  const htmlFiles = await glob('**/*.html', {
    cwd: projectDir,
    absolute: false,
    ignore: ['node_modules/**']
  });
  
  for (const file of htmlFiles.slice(0, MAX_HTML_FILES)) {
    const fromPath = htmlFileToRoute(file);
    const filePath = resolve(projectDir, file);
    
    if (!existsSync(filePath)) continue;
    
    try {
      const content = readFileSync(filePath, 'utf-8');
      const root = parse(content);
      
      const links = root.querySelectorAll('a[href]');
      for (const link of links) {
        const href = link.getAttribute('href');
        if (!href) continue;
        
        const targetPath = resolveLinkPath(href, file, projectDir);
        if (!targetPath) continue;
        
        // Extract expectation even if target route doesn't exist yet
        // This allows detection of broken links or prevented navigation
        // (The route may not exist, but the link promises navigation)
        const _linkText = link.textContent?.trim() || '';
        const selectorHint = link.id ? `#${link.id}` : `a[href="${href}"]`;
        
        expectations.push({
          fromPath: fromPath,
          type: 'navigation',
          targetPath: targetPath,
          evidence: {
            source: file,
            selectorHint: selectorHint
          }
        });
      }
      
      const buttonExpectations = extractButtonNavigationExpectations(root, fromPath, file, routeMap, projectDir);
      expectations.push(...buttonExpectations);
      
      const formExpectations = extractFormSubmissionExpectations(root, fromPath, file, routeMap, projectDir);
      expectations.push(...formExpectations);
      
      const networkExpectations = extractNetworkExpectations(root, fromPath, file, projectDir);
      expectations.push(...networkExpectations);
      
      // NAVIGATION INTELLIGENCE v2: Extract navigation expectations from inline scripts
      const { extractNavigationExpectations } = await import('./static-extractor-navigation.js');
      const navigationExpectations = extractNavigationExpectations(root, fromPath, file, projectDir);
      expectations.push(...navigationExpectations);
      
      // VALIDATION INTELLIGENCE v1: Extract validation_block expectations from inline scripts
      const { extractValidationExpectations } = await import('./static-extractor-validation.js');
      const validationExpectations = extractValidationExpectations(root, fromPath, file, projectDir);
      expectations.push(...validationExpectations);
    } catch (error) {
      continue;
    }
  }
  
  return expectations;
}

