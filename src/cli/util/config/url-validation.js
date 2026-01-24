/**
 * URL Validation Utilities
 * Ensures strict URL format validation to prevent false greens
 */

export function validateUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    throw new Error('URL must be a non-empty string');
  }
  
  try {
    const url = new URL(urlString);
    
    // Require http or https
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`Invalid protocol: ${url.protocol} (must be http or https)`);
    }
    
    // Require hostname
    if (!url.hostname) {
      throw new Error('URL must include a hostname');
    }
    
    // Check for localhost without port (common misconfiguration)
    if (url.hostname === 'localhost' && !url.port) {
      // This is OK - localhost defaults to port 80/443
    }
    
    return { valid: true, url };
  } catch (error) {
    throw new Error(`Invalid URL: ${error.message}`);
  }
}

export function validateFlags(flags, allowed) {
  const invalidFlags = flags.filter(flag => !allowed.includes(flag));
  if (invalidFlags.length > 0) {
    throw new Error(`Unknown flag(s): ${invalidFlags.join(', ')}`);
  }
}








