/**
 * NETWORK SAFETY FIREWALL
 * 
 * Handles network request interception and blocking:
 * - Cross-origin blocking (unless --allow-cross-origin)
 * - Read-only mode (blocks POST/PUT/PATCH/DELETE unconditionally)
 * - Safety tracking via SilenceTracker
 */

/**
 * Setup network interception firewall for safety mode
 * 
 * @param {Object} page - Playwright page object
 * @param {string} baseOrigin - Base origin URL for cross-origin checks
 * @param {boolean} allowCrossOrigin - Whether to allow cross-origin requests
 * @param {Object} silenceTracker - Silence tracker instance
 * @returns {Promise<{blockedNetworkWrites: Array, blockedCrossOrigin: Array}>}
 */
export async function setupNetworkFirewall(page, baseOrigin, allowCrossOrigin, silenceTracker) {
  const blockedNetworkWrites = [];
  const blockedCrossOrigin = [];

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
    
    // CONSTITUTIONAL: Block all write methods (read-only mode enforced)
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
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
  
  return { blockedNetworkWrites, blockedCrossOrigin };
}
