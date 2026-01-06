import { glob } from 'glob';
import { resolve } from 'path';

const INTERNAL_PATH_PATTERNS = [
  /^\/admin/,
  /^\/dashboard/,
  /^\/account/,
  /^\/settings/,
  /\/internal/,
  /\/private/
];

function isInternalRoute(path) {
  return INTERNAL_PATH_PATTERNS.some(pattern => pattern.test(path));
}

function fileToAppRouterPath(file) {
  let path = file.replace(/[\\\/]/g, '/');
  path = path.replace(/(^|\/)page\.(js|jsx|ts|tsx)$/, '');
  path = path.replace(/^\./, '');
  
  if (path === '' || path === '/') {
    return '/';
  }
  
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  
  path = path.replace(/\[([^\]]+)\]/g, ':$1');
  path = path.replace(/\([^)]+\)/g, '');
  
  return path || '/';
}

function fileToPagesRouterPath(file) {
  let path = file.replace(/[\\\/]/g, '/');
  path = path.replace(/\.(js|jsx|ts|tsx)$/, '');
  path = path.replace(/^index$/, '');
  path = path.replace(/^\./, '');
  
  if (path === '' || path === '/') {
    return '/';
  }
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  
  path = path.replace(/\[([^\]]+)\]/g, ':$1');
  
  return path || '/';
}

import { extractStaticRoutes } from './static-extractor.js';
import { extractReactRouterRoutes } from './react-router-extractor.js';
import { hasReactRouterDom } from './project-detector.js';

export async function extractRoutes(projectDir, projectType) {
  const routes = [];
  const routeSet = new Set();
  
  if (projectType === 'static') {
    return await extractStaticRoutes(projectDir);
  }
  
  if (projectType === 'react_spa') {
    const hasRouter = await hasReactRouterDom(projectDir);
    if (hasRouter) {
      return await extractReactRouterRoutes(projectDir);
    }
    return [];
  }
  
  if (projectType === 'nextjs_app_router') {
    const appDir = resolve(projectDir, 'app');
    const pageFiles = await glob('**/page.{js,jsx,ts,tsx}', {
      cwd: appDir,
      absolute: false,
      ignore: ['node_modules/**']
    });
    
    for (const file of pageFiles) {
      const routePath = fileToAppRouterPath(file);
      const routeKey = routePath;
      
      if (!routeSet.has(routeKey)) {
        routeSet.add(routeKey);
        routes.push({
          path: routePath,
          source: `app/${file}`,
          public: !isInternalRoute(routePath)
        });
      }
    }
  } else if (projectType === 'nextjs_pages_router') {
    const pagesDir = resolve(projectDir, 'pages');
    const pageFiles = await glob('**/*.{js,jsx,ts,tsx}', {
      cwd: pagesDir,
      absolute: false,
      ignore: ['node_modules/**', '_app.*', '_document.*', '_error.*']
    });
    
    for (const file of pageFiles) {
      const routePath = fileToPagesRouterPath(file);
      const routeKey = routePath;
      
      if (!routeSet.has(routeKey)) {
        routeSet.add(routeKey);
        routes.push({
          path: routePath,
          source: `pages/${file}`,
          public: !isInternalRoute(routePath)
        });
      }
    }
  }
  
  routes.sort((a, b) => a.path.localeCompare(b.path));
  
  return routes;
}

