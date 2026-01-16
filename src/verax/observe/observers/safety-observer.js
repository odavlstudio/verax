/**
 * PHASE 21.3 — Safety Observer
 * 
 * Responsibilities:
 * - Network interception (cross-origin blocking, write method blocking)
 * - NO file I/O
 * - NO side effects outside its scope
 */

/**
 * Setup network interception firewall
 * 
 * @param {Object} context - Observe context
 * @returns {Promise<void>}
 */
export async function setupNetworkInterception(context) {
  const { page, baseOrigin, safetyFlags, silenceTracker, blockedNetworkWrites, blockedCrossOrigin } = context;
  const { allowWrites = false, allowCrossOrigin = false } = safetyFlags;

  await page.route('**/*', (route) => {
    const request = route.request();
    const method = request.method();
    const requestUrl = request.url();
    const resourceType = request.resourceType();
    
    // Check cross-origin blocking (skip for file:// URLs)
    if (!allowCrossOrigin && !requestUrl.startsWith('file://')) {
      try {
        const reqOrigin = new URL(requestUrl).origin;
        if (reqOrigin !== baseOrigin) {
          blockedCrossOrigin.push({
            url: requestUrl,
            origin: reqOrigin,
            method,
            resourceType,
            timestamp: Date.now()
          });
          
          silenceTracker.record({
            scope: 'safety',
            reason: 'cross_origin_blocked',
            description: `Cross-origin request blocked: ${method} ${requestUrl}`,
            context: { url: requestUrl, origin: reqOrigin, method, baseOrigin },
            impact: 'request_blocked'
          });
          
          return route.abort('blockedbyclient');
        }
      } catch (e) {
        // Invalid URL, allow and let browser handle
      }
    }
    
    // Check write method blocking
    if (!allowWrites && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      // Check if it's a GraphQL mutation (best-effort)
      const isGraphQLMutation = requestUrl.includes('/graphql') && method === 'POST';
      
      blockedNetworkWrites.push({
        url: requestUrl,
        method,
        resourceType,
        isGraphQLMutation,
        timestamp: Date.now()
      });
      
      silenceTracker.record({
        scope: 'safety',
        reason: 'blocked_network_write',
        description: `Network write blocked: ${method} ${requestUrl}${isGraphQLMutation ? ' (GraphQL mutation)' : ''}`,
        context: { url: requestUrl, method, resourceType, isGraphQLMutation },
        impact: 'write_blocked'
      });
      
      return route.abort('blockedbyclient');
    }
    
    // Allow request
    route.continue();
  });
}

