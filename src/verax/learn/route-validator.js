import { chromium } from 'playwright';
import { isExternalUrl } from '../observe/domain-boundary.js';

const VALIDATION_TIMEOUT_MS = 8000;
const MAX_ROUTES_TO_VALIDATE = 50;

export async function validateRoutes(manifest, baseUrl) {
  let baseOrigin;
  try {
    const urlObj = new URL(baseUrl);
    baseOrigin = urlObj.origin;
  } catch (error) {
    return {
      routesValidated: 0,
      routesReachable: 0,
      routesUnreachable: 0,
      details: [],
      warnings: []
    };
  }
  
  const projectType = manifest.projectType;
  const shouldValidate = projectType === 'nextjs_app_router' || 
                        projectType === 'nextjs_pages_router' ||
                        projectType === 'react_spa' ||
                        projectType === 'static';
  
  if (!shouldValidate) {
    return {
      routesValidated: 0,
      routesReachable: 0,
      routesUnreachable: 0,
      details: [],
      warnings: []
    };
  }
  
  const publicRoutes = manifest.publicRoutes || [];
  if (publicRoutes.length === 0) {
    return {
      routesValidated: 0,
      routesReachable: 0,
      routesUnreachable: 0,
      details: [],
      warnings: []
    };
  }
  
  const routesToValidate = publicRoutes.slice(0, MAX_ROUTES_TO_VALIDATE);
  const wasCapped = publicRoutes.length > MAX_ROUTES_TO_VALIDATE;
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();
  
  const details = [];
  let reachableCount = 0;
  let unreachableCount = 0;
  
  try {
    for (const routePath of routesToValidate) {
      page.removeAllListeners('response');
      let routeUrl;
      let normalizedPath;
      
      if (routePath.startsWith('http://') || routePath.startsWith('https://')) {
        routeUrl = routePath;
      } else {
        normalizedPath = routePath.startsWith('/') ? routePath : '/' + routePath;
        if (normalizedPath === '') {
          normalizedPath = '/';
        }
        routeUrl = baseOrigin + normalizedPath;
      }
      
      let status = 'UNREACHABLE';
      let httpStatus = null;
      let finalUrl = null;
      let reason = null;
      
      let redirectTargetUrl = null;
      let hasExternalRedirect = false;
      
      try {
        const response = await page.goto(routeUrl, {
          waitUntil: 'domcontentloaded',
          timeout: VALIDATION_TIMEOUT_MS
        });
        
        await page.waitForTimeout(300);
        
        finalUrl = page.url();
        
        // Check redirect chain in response object - PRIMARY detection method
        if (response) {
          httpStatus = response.status();
          
          const request = response.request();
          
          // Use redirectChain property if available (Playwright API)
          let redirectChain = [];
          // @ts-expect-error - redirectChain exists in Playwright runtime but not in TypeScript types
          if (request.redirectChain && Array.isArray(request.redirectChain)) {
            // @ts-expect-error - redirectChain exists in Playwright runtime but not in TypeScript types
            redirectChain = request.redirectChain;
          } else if (request.redirectedFrom) {
            // Fall back to redirectedFrom if redirectChain not available
            redirectChain = [request.redirectedFrom];
          }
          
          // If redirectChain is empty or not available, build chain from redirectedFrom
          if (redirectChain.length === 0) {
            let currentRequest = request.redirectedFrom();
            while (currentRequest) {
              redirectChain.unshift(currentRequest);
              currentRequest = currentRequest.redirectedFrom();
            }
          }
          
          // Check each request in the redirect chain for external origin
          for (const chainRequest of redirectChain) {
            const chainRequestUrl = chainRequest.url();
            try {
              const chainUrlObj = new URL(chainRequestUrl);
              if (chainUrlObj.origin !== baseOrigin) {
                hasExternalRedirect = true;
                redirectTargetUrl = chainRequestUrl;
                break;
              }
            } catch (e) {
              // URL parsing failed, try with isExternalUrl
              if (isExternalUrl(chainRequestUrl, baseOrigin)) {
                hasExternalRedirect = true;
                redirectTargetUrl = chainRequestUrl;
                break;
              }
            }
          }
        }
        
        if (hasExternalRedirect) {
          status = 'UNREACHABLE';
          reason = 'external_redirect_blocked';
          finalUrl = redirectTargetUrl || finalUrl;
          unreachableCount++;
        } else if (isExternalUrl(finalUrl, baseOrigin)) {
          status = 'UNREACHABLE';
          reason = 'external_redirect_blocked';
          unreachableCount++;
        } else if (response) {
          if (httpStatus >= 200 && httpStatus < 300) {
            status = 'REACHABLE';
            reachableCount++;
          } else {
            status = 'UNREACHABLE';
            reason = `http_${httpStatus}`;
            unreachableCount++;
          }
        } else {
          status = 'REACHABLE';
          reachableCount++;
        }
      } catch (error) {
        if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
          reason = 'timeout';
        } else if (error.message.includes('net::ERR')) {
          reason = 'network_error';
        } else {
          reason = 'navigation_failed';
        }
        unreachableCount++;
      }
      
      details.push({
        path: routePath,
        status: status,
        httpStatus: httpStatus,
        finalUrl: finalUrl,
        reason: reason
      });
    }
  } finally {
    await browser.close();
  }
  
  const warnings = [];
  
  if (wasCapped) {
    warnings.push({
      code: 'ROUTE_VALIDATION_CAPPED',
      message: `Route validation capped at ${MAX_ROUTES_TO_VALIDATE} routes. ${publicRoutes.length - MAX_ROUTES_TO_VALIDATE} routes were not validated.`
    });
  }
  
  const totalValidated = details.length;
  if (totalValidated > 0) {
    const reachabilityRatio = reachableCount / totalValidated;
    if (reachabilityRatio < 0.5) {
      warnings.push({
        code: 'LOW_ROUTE_REACHABILITY',
        message: `Only ${reachableCount} of ${totalValidated} validated routes are reachable (${Math.round(reachabilityRatio * 100)}%). This may indicate incorrect route extraction or server configuration issues.`
      });
    }
  }
  
  return {
    routesValidated: totalValidated,
    routesReachable: reachableCount,
    routesUnreachable: unreachableCount,
    details: details,
    warnings: warnings
  };
}




