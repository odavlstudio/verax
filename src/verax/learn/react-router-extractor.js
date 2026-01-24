import { glob } from 'glob';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { resolveScanConfig, rootsToGlobPatterns } from './scan-roots.js';

export async function extractReactRouterRoutes(projectDir, projectType = 'unknown', scanOptions = {}) {
  const routes = [];
  const routeSet = new Set();
  
  // Resolve scan roots using framework-aware detection
  const scanConfig = resolveScanConfig(projectDir, projectType, scanOptions);
  const baseDir = scanConfig.cwd;
  
  if (scanConfig.roots.length === 0) {
    return routes;
  }
  
  // Generate glob patterns from scan roots
  const globPatterns = rootsToGlobPatterns(scanConfig.roots, '*.{js,jsx,ts,tsx}');
  
  // Collect files from all patterns
  let jsFiles = [];
  for (const pattern of globPatterns) {
    const matchedFiles = await glob(pattern, {
      cwd: baseDir,
      absolute: false,
      ignore: scanConfig.excludes
    });
    matchedFiles.sort((a, b) => a.localeCompare(b, 'en'));
    jsFiles = jsFiles.concat(matchedFiles);
  }
  jsFiles = Array.from(new Set(jsFiles)).sort((a, b) => a.localeCompare(b, 'en'));
  
  for (const file of jsFiles.slice(0, 200)) {
    try {
      const content = readFileSync(resolve(baseDir, file), 'utf-8');
      
      const routePatterns = [
        /<Route\s+path=["']([^"']+)["']/g,
        /path:\s*["']([^"']+)["']/g,
        /path\s*:\s*["']([^"']+)["']/g,
        /createBrowserRouter\s*\(\s*\[([^\]]+)\]/gs,
        /createRoutesFromElements\s*\([^)]*\)/gs
      ];
      
      for (const pattern of routePatterns) {
        let match;
  // @ts-expect-error - readFileSync with encoding returns string
        while ((match = pattern.exec(content)) !== null) {
          let path = match[1];
          
          if (!path) {
            if (match[0].includes('createBrowserRouter')) {
              // @ts-expect-error - readFileSync with encoding returns string
              const routesMatch = content.match(/createBrowserRouter\s*\(\s*\[([^\]]+)\]/s);
              if (routesMatch) {
                const routesContent = routesMatch[1];
                const pathMatches = routesContent.matchAll(/path\s*:\s*["']([^"']+)["']/g);
                for (const pathMatch of pathMatches) {
                  path = pathMatch[1];
                  if (path && !routeSet.has(path)) {
                    routeSet.add(path);
                    routes.push({
                      path: path,
                      source: file,
                      public: true
                    });
                  }
                }
              }
            }
            continue;
          }
          
          if (path && !routeSet.has(path)) {
            routeSet.add(path);
            routes.push({
              path: path,
              source: file,
              public: true
            });
          }
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  routes.sort((a, b) => a.path.localeCompare(b.path));
  
  return routes;
}




