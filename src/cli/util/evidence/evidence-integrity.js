/**
 * Evidence Integrity Verifier
 * Creates SHA256 hashes of evidence objects for verification
 * Used to ensure evidence integrity in determinism contracts
 */

import crypto from 'crypto';

/**
 * Compute SHA256 hash of a normalized JSON object
 * Ensures consistent hashing by sorting keys
 * @param {Object} obj - JSON object to hash
 * @returns {string} hex-encoded SHA256 hash
 */
export function hashObject(obj) {
  // Stringify with sorted keys for deterministic hashing
  const json = JSON.stringify(obj, Object.keys(obj).sort((a, b) => a.localeCompare(b, 'en')));
  // @ts-expect-error - crypto hash chain returns string from digest('hex')
  return crypto.createHash('sha256').update(json).digest('hex');
}

/**
 * Create a manifest of evidence hashes for a finding
 * Links evidence to integrity hashes
 * @param {Object} finding - finding object with evidence array
 * @returns {Object} manifest with hashes
 */
export function createEvidenceManifest(finding) {
  if (!finding.evidence || !Array.isArray(finding.evidence)) {
    return null;
  }

  const manifest = {
    findingId: finding.id,
    findingType: finding.type,
    evidenceCount: finding.evidence.length,
    hashes: finding.evidence.map((ev, idx) => ({
      index: idx,
      source: ev.source,
      hash: hashObject(ev),
    })),
  };

  manifest.manifestHash = hashObject({
    findingId: manifest.findingId,
    findingType: manifest.findingType,
    evidenceCount: manifest.evidenceCount,
    hashes: manifest.hashes,
  });

  return manifest;
}

/**
 * Verify that evidence hasn't changed using manifest hashes
 * @param {Object} evidence - evidence object to verify
 * @param {string} expectedHash - expected SHA256 hash
 * @returns {Object} verification result
 */
export function verifyEvidenceHash(evidence, expectedHash) {
  const actualHash = hashObject(evidence);
  return {
    valid: actualHash === expectedHash,
    expectedHash,
    actualHash,
    mismatch: actualHash !== expectedHash ? true : undefined,
  };
}

/**
 * Verify all evidence in a finding matches manifest
 * @param {Object} finding - finding with evidence
 * @param {Object} manifest - manifest from createEvidenceManifest
 * @returns {Object} comprehensive verification result
 */
export function verifyFindingIntegrity(finding, manifest) {
  if (!manifest || finding.id !== manifest.findingId) {
    return {
      valid: false,
      reason: 'Manifest mismatch',
    };
  }

  const evidence = finding.evidence || [];
  if (evidence.length !== manifest.evidenceCount) {
    return {
      valid: false,
      reason: `Evidence count mismatch (expected ${manifest.evidenceCount}, got ${evidence.length})`,
    };
  }

  const results = evidence.map((ev, idx) => {
    const expectedHash = manifest.hashes[idx]?.hash;
    return verifyEvidenceHash(ev, expectedHash);
  });

  const allValid = results.every(r => r.valid);
  const failures = results.filter(r => !r.valid);

  return {
    valid: allValid,
    totalEvidence: evidence.length,
    validEvidence: results.filter(r => r.valid).length,
    failures: failures.length > 0 ? failures : undefined,
  };
}








