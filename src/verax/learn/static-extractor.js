import { glob } from 'glob';
import { resolve, dirname, join, relative } from 'path';
import { readFileSync, existsSync } from 'fs';
import { parse } from 'node-html-parser';

const MAX_HTML_FILES = 200;

function htmlFileToRoute(file) {
  let path = file.replace(/[\\\/]/g, '/');
  path = path.replace(/\/index\.html$/, '');
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
        
        if (!routeMap.has(targetPath)) continue;
        
        const linkText = link.textContent?.trim() || '';
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
    } catch (error) {
      continue;
    }
  }
  
  return expectations;
}

