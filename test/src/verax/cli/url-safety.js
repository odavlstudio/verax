/**
 * Wave 3 — URL Safety Checks
 * 
 * Detects external/public URLs and requires confirmation.
 */

/**
 * Check if an IP address is private/local
 * @param {string} ip - IP address
 * @returns {boolean} True if private/local
 */
function isPrivateIP(ip) {
  // localhost
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return true;
  }
  
  // Private IP ranges
  const privateRanges = [
    /^10\./,                    // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
    /^192\.168\./,              // 192.168.0.0/16
    /^169\.254\./,              // Link-local
    /^fc00:/,                   // IPv6 private
    /^fe80:/                    // IPv6 link-local
  ];
  
  return privateRanges.some(range => range.test(ip));
}

/**
 * Check if URL is external/public (requires confirmation)
 * @param {string} url - URL to check
 * @returns {Object} { isExternal: boolean, hostname: string }
 */
export function checkUrlSafety(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Check if localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return {
        isExternal: false,
        hostname: hostname
      };
    }
    
    // Check if private IP
    if (isPrivateIP(hostname)) {
      return {
        isExternal: false,
        hostname: hostname
      };
    }
    
    // All other hosts are considered external
    return {
      isExternal: true,
      hostname: hostname
    };
  } catch (error) {
    // Invalid URL - let other validation catch it
    return {
      isExternal: false,
      hostname: null
    };
  }
}

/**
 * @typedef {Object} ReadlineInterface
 * @property {function(string): Promise<string>} question - Prompt user with question
 * @property {function(): void} close - Close the readline interface
 */

/**
 * @typedef {Object} ConfirmExternalUrlOptions
 * @property {ReadlineInterface} [readlineInterface] - Readline interface (injectable)
 */

/**
 * Prompt for external URL confirmation
 * @param {string} hostname - Hostname to confirm
 * @param {ConfirmExternalUrlOptions} [options={}] - Options
 * @returns {Promise<boolean>} True if confirmed
 */
export async function confirmExternalUrl(hostname, options = {}) {
  const rl = options.readlineInterface || null;
  
  if (!rl) {
    // Use readline if not injected
    // @ts-expect-error - readline/promises is available in Node 18+
    const readline = await import('readline/promises');
    const rlInterface = readline.default.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });
    
    try {
      const answer = await rlInterface.question(`This will scan a public site (${hostname}). Continue? (y/N): `);
      return (answer.trim().toLowerCase() || 'n').startsWith('y');
    } finally {
      rlInterface.close();
    }
  } else {
    const answer = await rl.question(`This will scan a public site (${hostname}). Continue? (y/N): `);
    return (answer.trim().toLowerCase() || 'n').startsWith('y');
  }
}

