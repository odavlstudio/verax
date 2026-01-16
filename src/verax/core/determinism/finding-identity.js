/**
 * PHASE 18 — Stable Finding Identity
 * 
 * Computes stable identity keys for findings that are consistent across runs.
 * Used for matching findings between runs for comparison.
 */

import { createHash } from 'crypto';

/**
 * PHASE 18: Compute stable finding identity
 * 
 * Uses type + promise signature + route/network target + interaction selector/context chain
 * Includes evidence trigger source signature where available (AST snippet hash or location)
 * Must NOT include runId/timestamps
 * 
 * @param {Object} finding - Finding object
 * @returns {string} Stable identity key
 */
export function computeFindingIdentity(finding) {
  const parts = [];
  
  // Part 1: Finding type
  parts.push(`type:${finding.type || 'unknown'}`);
  
  // Part 2: Interaction signature
  const interaction = finding.interaction || {};
  if (interaction.type && interaction.selector) {
    parts.push(`interaction:${interaction.type}:${normalizeSelector(interaction.selector)}`);
  }
  if (interaction.label) {
    parts.push(`label:${interaction.label}`);
  }
  
  // Part 3: Promise signature
  const expectation = finding.expectation || {};
  const promise = finding.promise || {};
  
  if (expectation.type) {
    parts.push(`promiseType:${expectation.type}`);
  }
  if (expectation.targetPath) {
    parts.push(`targetPath:${normalizePath(expectation.targetPath)}`);
  }
  if (expectation.urlPath) {
    parts.push(`urlPath:${normalizePath(expectation.urlPath)}`);
  }
  if (promise.type) {
    parts.push(`promise:${promise.type}`);
  }
  
  // Part 4: Route/network target
  if (finding.route) {
    const route = finding.route;
    if (route.path) {
      parts.push(`route:${normalizePath(route.path)}`);
    }
    if (route.originalPattern) {
      parts.push(`routePattern:${normalizePath(route.originalPattern)}`);
    }
  }
  
  if (finding.evidence?.networkRequest?.url) {
    parts.push(`networkUrl:${normalizeUrl(finding.evidence.networkRequest.url)}`);
  }
  
  // Part 5: Evidence trigger source signature
  const source = finding.source || expectation.source || {};
  if (source.file) {
    parts.push(`sourceFile:${normalizePath(source.file)}`);
  }
  if (source.line) {
    parts.push(`sourceLine:${source.line}`);
  }
  if (source.astSource) {
    // Hash AST source for stability
    const astHash = hashString(source.astSource);
    parts.push(`astHash:${astHash}`);
  }
  
  // Part 6: Evidence trigger from evidencePackage
  if (finding.evidencePackage?.trigger?.astSource) {
    const triggerHash = hashString(finding.evidencePackage.trigger.astSource);
    parts.push(`triggerHash:${triggerHash}`);
  }
  if (finding.evidencePackage?.trigger?.source?.file) {
    parts.push(`triggerFile:${normalizePath(finding.evidencePackage.trigger.source.file)}`);
  }
  if (finding.evidencePackage?.trigger?.source?.line) {
    parts.push(`triggerLine:${finding.evidencePackage.trigger.source.line}`);
  }
  
  // Part 7: Context chain (if available)
  if (finding.contextChain && Array.isArray(finding.contextChain)) {
    const contextSig = finding.contextChain.map(c => `${c.type}:${c.name || ''}`).join('>');
    parts.push(`context:${contextSig}`);
  }
  
  // Combine all parts into stable identity
  const identity = parts.join('|');
  
  // Return hash for compactness and stability
  return hashString(identity);
}

/**
 * Normalize selector (remove volatile parts)
 */
function normalizeSelector(selector) {
  if (!selector || typeof selector !== 'string') return '';
  // Remove any dynamic IDs or classes that might change
  return selector.replace(/\[data-[^\]]+\]/g, '').replace(/\.\w+-\d+/g, '');
}

/**
 * Normalize path (remove absolute paths, normalize separators)
 */
function normalizePath(path) {
  if (!path || typeof path !== 'string') return '';
  // Normalize separators
  let normalized = path.replace(/\\/g, '/');
  // Remove absolute path prefixes (keep relative structure)
  normalized = normalized.replace(/^[A-Z]:\/[^/]+/, '');
  normalized = normalized.replace(/^\/[^/]+/, '');
  return normalized;
}

/**
 * Normalize URL (remove query params, hash, normalize domain)
 */
function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const urlObj = new URL(url);
    // Keep only pathname for comparison
    return urlObj.pathname;
  } catch {
    return url;
  }
}

/**
 * Hash string for stable identity
 */
function hashString(str) {
  // @ts-expect-error - digest returns string
  return createHash('sha256').update(str).digest('hex').substring(0, 16);
}

