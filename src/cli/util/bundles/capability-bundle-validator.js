import { readFileSync } from 'fs';
import { join } from 'path';
import { DataError } from '../support/errors.js';
import { verifyBundleIntegrityOrThrow } from './bundle-integrity.js';
import { validateCapabilityBundleJsonOrThrow } from './capability-bundle-schema.js';

export function validateCapabilityBundleDirOrThrow(bundleDir) {
  // 1) Cryptographic integrity (detect tamper/missing/extra)
  verifyBundleIntegrityOrThrow(bundleDir);

  // 2) Schema lock (detect adversarial manifest rewrite that still passes hashes)
  const capabilityPath = join(bundleDir, 'capability.json');
  let parsed;
  try {
    parsed = JSON.parse(String(readFileSync(capabilityPath, 'utf8')));
  } catch (e) {
    throw new DataError('capability.json is missing or invalid JSON.');
  }

  validateCapabilityBundleJsonOrThrow(parsed);
  return { ok: true };
}

