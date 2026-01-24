import { getTimeProvider } from '../../../cli/util/support/time-provider.js';
/**
 * Digest Engine
 * Produces cryptographic hashes of run artifacts for determinism proof
 * Ensures two identical runs produce identical digests
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { atomicWriteJson } from '../support/atomic-write.js';

/**
 * Normalize JSON for hashing (canonicalize)
 * Removes volatile fields, sorts keys consistently
 */
function normalizeJSON(obj, volatileFields = []) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => normalizeJSON(item, volatileFields));
  }

  const normalized = {};
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b, 'en'));

  for (const key of keys) {
    // Skip volatile fields
    if (volatileFields.some(field => key.includes(field))) {
      continue;
    }

    const value = obj[key];
    if (typeof value === 'object' && value !== null) {
      normalized[key] = normalizeJSON(value, volatileFields);
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

/**
 * Strip timestamps and volatile data from string content
 */
function stripVolatile(content) {
  if (typeof content !== 'string') {
    return content;
  }

  let cleaned = content;

  // Strip ISO timestamps
  cleaned = cleaned.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.Z0-9]*/g, '[TIMESTAMP]');

  // Strip UUIDs
  cleaned = cleaned.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[UUID]');

  // Strip run IDs (format: YYYY-MM-DDTHH-MM-SSZ_XXXXXX)
  cleaned = cleaned.replace(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z_[a-z0-9]+/gi, '[RUN_ID]');

  // Strip execution times (durations)
  cleaned = cleaned.replace(/"endedAt":\s*"[^"]*"/g, '"endedAt":"[TIMESTAMP]"');
  cleaned = cleaned.replace(/"startedAt":\s*"[^"]*"/g, '"startedAt":"[TIMESTAMP]"');
  cleaned = cleaned.replace(/"observedAt":\s*"[^"]*"/g, '"observedAt":"[TIMESTAMP]"');

  // Strip finding IDs
  cleaned = cleaned.replace(/"findingId":\s*"[^"]*"/g, '"findingId":"[FINDING_ID]"');

  return cleaned;
}

/**
 * Compute SHA256 hash of content
 */
function hashContent(content) {
  const hash = createHash('sha256');
  hash.update(content, 'utf-8');
  return hash.digest('hex');
}

/**
 * Validate JSON evidence file structure
 * Returns null if file is missing, unreadable, or malformed
 */
function validateJSONEvidenceFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return null; // Empty file
    }
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') {
      return null; // Not an object
    }
    return parsed;
  } catch (e) {
    // Malformed JSON or file read error - return null to reject silently
    return null;
  }
}

/**
 * Normalize and hash a JSON file
 */
function hashJSONFile(filePath, volatileFields = []) {
  const parsed = validateJSONEvidenceFile(filePath);
  if (parsed === null) {
    return null; // Invalid or missing file
  }
  
  try {
    const normalized = normalizeJSON(parsed, volatileFields);
    const serialized = JSON.stringify(normalized);
    const stripped = stripVolatile(serialized);
    return hashContent(stripped);
  } catch (e) {
    return null; // Normalization error
  }
}

/**
 * Hash a raw file (e.g., screenshot PNG)
 */
function _hashFile(filePath) {
  try {
    const content = readFileSync(filePath);
    return hashContent(content.toString('utf-8'));
  } catch (e) {
    return null;
  }
}

/**
 * H5: Compute deterministic digest for observations
 * Ensures identical inputs produce identical digests
 * Used for reproducibility proof
 */
export function computeDigest(expectations, observations, metadata = {}) {
  const digest = {
    version: '1.0',
    deterministicSeed: 'verax-h5-determinism-proof',
    contentHashes: {},
    normalized: {},
  };

  // Normalize expectations
  const normalizedExpectations = (expectations || []).map(exp => ({
    id: exp.id,
    type: exp.type,
    category: exp.category,
    promise: exp.promise,
  }));

  const expString = JSON.stringify(normalizedExpectations);
  digest.contentHashes.expectations = hashContent(expString);
  digest.normalized.expectations = normalizedExpectations;

  // Normalize observations (remove timing)
  const normalizedObservations = (observations || []).map(obs => ({
    id: obs.id,
    category: obs.category,
    observed: obs.observed,
    reason: obs.reason,
  }));

  const obsString = JSON.stringify(normalizedObservations);
  digest.contentHashes.observations = hashContent(obsString);
  digest.normalized.observations = normalizedObservations;

  // Normalize metadata
  const normalizedMetadata = {
    framework: metadata.framework,
    url: metadata.url,
    version: metadata.version,
  };

  const metaString = JSON.stringify(normalizedMetadata);
  digest.contentHashes.metadata = hashContent(metaString);
  digest.normalized.metadata = normalizedMetadata;

  // Compute final digest
  const digestInput = [
    digest.contentHashes.expectations,
    digest.contentHashes.observations,
    digest.contentHashes.metadata,
    digest.deterministicSeed,
  ].join(':');

  digest.deterministicDigest = hashContent(digestInput);

  return digest;
}

/**
 * H5: Validate determinism across multiple runs
 */
export function validateDeterminism(digests) {
  if (!digests || digests.length === 0) {
    return {
      isDeterministic: true,
      reason: 'No runs to compare',
    };
  }

  const firstDigest = digests[0].deterministicDigest;
  const allMatch = digests.every(d => d.deterministicDigest === firstDigest);

  return {
    isDeterministic: allMatch,
    firstDigest,
    mismatchedRuns: !allMatch ? digests.map((d, i) => ({
      runIndex: i,
      digest: d.deterministicDigest,
    })).filter(d => d.digest !== firstDigest) : [],
  };
}

/**
 * Produce a complete run digest
 */
export async function produceRunDigest(runPath, runData) {
  const digest = {
    format: 'run-digest-v1',
    timestamp: getTimeProvider().iso(),
    digests: {
      learn: null,
      observe: null,
      findings: null,
      evidence: {},
    },
    metadata: {
      runPath,
      isReproducible: false,
    },
  };

  // Hash learn.json (should be deterministic)
  const learnPath = resolve(runPath, 'learn.json');
  const learnHash = hashJSONFile(learnPath, ['extractedAt', 'duration']);
  if (learnHash) {
    digest.digests.learn = learnHash;
  }

  // Hash observe.json (normalized)
  const observePath = resolve(runPath, 'observe.json');
  const observeHash = hashJSONFile(observePath, [
    'observedAt',
    'startedAt',
    'endedAt',
    'timing',
    'duration',
    'findingId',
  ]);
  if (observeHash) {
    digest.digests.observe = observeHash;
  }

  // Hash findings.json (normalized)
  const findingsPath = resolve(runPath, 'findings.json');
  const findingsHash = hashJSONFile(findingsPath, ['findingId', 'confidence']);
  if (findingsHash) {
    digest.digests.findings = findingsHash;
  }

  // Hash evidence directory
  if (runData?.evidence && Array.isArray(runData.evidence)) {
    const evidenceDigests = {};
    for (const evidenceFile of runData.evidence) {
      if (evidenceFile.endsWith('.png') || evidenceFile.endsWith('.jpg')) {
        // Skip images (they may have subtle compression differences)
        evidenceDigests[evidenceFile] = '[IMAGE_SKIPPED]';
      } else if (evidenceFile.endsWith('.json')) {
        const filePath = resolve(runPath, 'evidence', evidenceFile);
        const hash = hashJSONFile(filePath, ['timestamp', 'duration']);
        if (hash) {
          evidenceDigests[evidenceFile] = hash;
        }
      }
    }
    digest.digests.evidence = evidenceDigests;
  }

  // Determine if reproducible (all core files match if run again)
  const hasAllHashes =
    digest.digests.learn &&
    digest.digests.observe &&
    digest.digests.findings &&
    Object.keys(digest.digests.evidence).length > 0;

  digest.metadata.isReproducible = hasAllHashes;

  return digest;
}

/**
 * Compare two digests for determinism
 */
export function compareDigests(digest1, digest2) {
  const comparison = {
    match: false,
    diffs: [],
  };

  // Learn must match (deterministic)
  if (digest1.digests.learn !== digest2.digests.learn) {
    comparison.diffs.push('learn.json hash differs');
  }

  // Observe must match (deterministic execution)
  if (digest1.digests.observe !== digest2.digests.observe) {
    comparison.diffs.push('observe.json hash differs');
  }

  // Findings must match (deterministic classification)
  if (digest1.digests.findings !== digest2.digests.findings) {
    comparison.diffs.push('findings.json hash differs');
  }

  // Evidence files should match
  const evidenceKeys1 = Object.keys(digest1.digests.evidence || {});
  const evidenceKeys2 = Object.keys(digest2.digests.evidence || {});

  if (evidenceKeys1.length !== evidenceKeys2.length) {
    comparison.diffs.push(
      `Evidence count differs: ${evidenceKeys1.length} vs ${evidenceKeys2.length}`
    );
  }

  for (const key of evidenceKeys1) {
    if (
      digest1.digests.evidence[key] &&
      digest2.digests.evidence[key] &&
      digest1.digests.evidence[key] !== '[IMAGE_SKIPPED]' &&
      digest1.digests.evidence[key] !== digest2.digests.evidence[key]
    ) {
      comparison.diffs.push(`Evidence file '${key}' hash differs`);
    }
  }

  comparison.match = comparison.diffs.length === 0;

  return comparison;
}

/**
 * Save digest to file
 */
export function saveDigest(digestPath, digest) {
  try {
    atomicWriteJson(digestPath, digest);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Load digest from file
 */
export function loadDigest(digestPath) {
  try {
    const content = readFileSync(digestPath, 'utf-8');
  // @ts-expect-error - readFileSync with encoding returns string
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

/**
 * Check if a run is deterministically reproducible
 */
export function isRunDeterministic(digest) {
  if (!digest) return false;
  return (
    Boolean(digest.digests.learn) &&
    Boolean(digest.digests.observe) &&
    Boolean(digest.digests.findings)
  );
}



