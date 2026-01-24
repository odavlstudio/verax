/**
 * Internal: Evidence build errors
 */

export class EvidenceBuildError extends Error {
  constructor(message, missingFields = [], evidencePackage = null) {
    super(message);
    this.name = 'EvidenceBuildError';
    this.code = 'EVIDENCE_BUILD_FAILED';
    this.missingFields = missingFields;
    this.evidencePackage = evidencePackage;
  }
}
