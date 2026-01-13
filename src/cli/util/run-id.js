import crypto from 'crypto';

/**
 * Generate a run ID in format: <ISO_TIMESTAMP_UTC>_<6-8 char short hash>
 * Example: 2026-01-11T00-59-12Z_4f2a9c
 */
export function generateRunId() {
  // Create ISO timestamp with colons replaced by dashes for filesystem compatibility
  const now = new Date();
  const isoString = now.toISOString();
  // Format: 2026-01-11T00:59:12.123Z -> 2026-01-11T00-59-12Z
  const timestamp = isoString.replace(/:/g, '-').replace(/\.\d+Z/, 'Z');
  
  // Generate a short hash (6-8 chars)
  const hash = crypto
    .randomBytes(4)
    .toString('hex')
    .substring(0, 6);
  
  return `${timestamp}_${hash}`;
}

/**
 * Validate a run ID format
 */
export function isValidRunId(runId) {
  // Pattern: YYYY-MM-DDTHH-MM-SSZ_hexchars
  const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z_[a-f0-9]{6,8}$/;
  return pattern.test(runId);
}
