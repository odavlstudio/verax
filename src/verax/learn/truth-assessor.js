import { glob } from 'glob';
import { hasReactRouterDom } from './project-detector.js';
import { resolveScanConfig, rootsToGlobPatterns } from './scan-roots.js';

const MAX_HTML_FILES = 200;

export async function assessLearnTruth(projectDir, projectType, routes, staticExpectations, scanOptions = {}) {
  const truth = {
    routesDiscovered: routes.length,
    routesSource: 'none',
    routesConfidence: 'LOW',
    expectationsDiscovered: 0,
    expectationsStrong: 0,
    expectationsWeak: 0,
    warnings: [],
    limitations: []
  };
  
  if (projectType === 'nextjs_app_router' || projectType === 'nextjs_pages_router') {
    truth.routesSource = 'nextjs_fs';
    truth.routesConfidence = 'HIGH';
  } else if (projectType === 'vue_router') {
    truth.routesSource = 'vue_router_ast';
    truth.routesConfidence = 'HIGH';
    
    if (staticExpectations && staticExpectations.length > 0) {
      truth.expectationsDiscovered = staticExpectations.length;
      truth.expectationsStrong = staticExpectations.filter(e => 
        e.type === 'spa_navigation'
      ).length;
      truth.expectationsWeak = 0;
    }
  } else if (projectType === 'vue_spa') {
    truth.routesSource = 'vue_no_router';
    truth.routesConfidence = 'LOW';
    truth.limitations.push({
      code: 'VUE_ROUTER_NOT_INSTALLED',
      message: 'Vue detected but vue-router not installed. Routes cannot be extracted from router configuration.'
    });
  } else if (projectType === 'static') {
    truth.routesSource = 'static_html';
    
    // Use scan-roots to find HTML files in appropriate directories
    const scanConfig = resolveScanConfig(projectDir, projectType, scanOptions);
    const baseDir = scanConfig.cwd;
    const globPatterns = rootsToGlobPatterns(scanConfig.roots, '*.html');
    
    let htmlFiles = [];
    for (const pattern of globPatterns) {
      const matchedFiles = await glob(pattern, {
        cwd: baseDir,
        absolute: false,
        ignore: scanConfig.excludes
      });
      matchedFiles.sort((a, b) => a.localeCompare(b, 'en'));
      htmlFiles = htmlFiles.concat(matchedFiles);
    }
    htmlFiles = Array.from(new Set(htmlFiles)).sort((a, b) => a.localeCompare(b, 'en'));
    
    if (htmlFiles.length <= MAX_HTML_FILES) {
      truth.routesConfidence = 'HIGH';
    } else {
      truth.routesConfidence = 'MEDIUM';
      truth.warnings.push({
        code: 'HTML_SCAN_CAPPED',
        message: `HTML file count (${htmlFiles.length}) exceeds cap (${MAX_HTML_FILES}). Some routes may be missed.`
      });
    }
    
    if (staticExpectations) {
      truth.expectationsDiscovered = staticExpectations.length;
      truth.expectationsStrong = staticExpectations.filter(e => 
        e.type === 'navigation' || e.type === 'form_submission'
      ).length;
      truth.expectationsWeak = 0;
    }
  } else if (projectType === 'react_spa') {
    truth.routesSource = 'react_router_regex';
    truth.routesConfidence = 'MEDIUM';
    
    const hasRouter = await hasReactRouterDom(projectDir);
    if (!hasRouter || routes.length === 0) {
      truth.routesConfidence = 'LOW';
      truth.limitations.push({
        code: 'REACT_ROUTES_NOT_FOUND',
        message: hasRouter 
          ? 'React Router detected but no routes extracted. Route extraction may have failed.'
          : 'react-router-dom not detected in package.json. Routes cannot be extracted.'
      });
    }
    
    truth.warnings.push({
      code: 'REACT_ROUTE_EXTRACTION_FRAGILE',
      message: 'Route extraction uses regex parsing of source files. Dynamic routes, nested routers, and code-split route definitions may be missed.'
    });
    
    truth.expectationsDiscovered = routes.length;
    truth.expectationsStrong = routes.length;
    truth.expectationsWeak = 0;
  } else if (projectType === 'unknown') {
    truth.routesSource = 'none';
    truth.routesConfidence = 'LOW';
    truth.limitations.push({
      code: 'PROJECT_TYPE_UNKNOWN',
      message: 'Project type could not be determined. No routes or expectations can be extracted.'
    });
  }
  
  return truth;
}




