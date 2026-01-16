/**
 * Attempt to infer URL from environment variables and common dev configs
 */
export function tryResolveUrlFromEnv() {
  // Check common environment variables
  const candidates = [
    process.env.VERCEL_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.PUBLIC_URL,
  ];
  
  for (const candidate of candidates) {
    if (candidate) {
      // Ensure it's a valid URL
      if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
        return candidate;
      }
      // If it's a bare domain, assume https
      if (candidate.includes('.') && !candidate.includes(' ')) {
        return `https://${candidate}`;
      }
    }
  }
  
  // Check for localhost/PORT
  if (process.env.PORT) {
    const port = process.env.PORT;
    return `http://localhost:${port}`;
  }
  
  return null;
}
