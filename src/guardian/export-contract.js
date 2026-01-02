/**
 * Guardian Export Contract - Single source of truth for API payload contract
 * 
 * Defines the exact structure, versions, and validation rules for Guardian export headers.
 * All header strings, verdicts, and validation logic must reference this module.
 * 
 * No drift is possible without failing contract validation tests.
 */

// Contract version - increment only when breaking changes occur
const CONTRACT_VERSION = 'v1';

// Header name constants - single source of truth for all header strings
const HEADER_NAMES = {
  CONTRACT_VERSION: 'X-Guardian-Contract',
  RUN_ID: 'X-Guardian-Run-Id',
  VERDICT: 'X-Guardian-Verdict',
  URL: 'X-Guardian-Url',
  TIMESTAMP: 'X-Guardian-Timestamp',
  EXIT_CODE: 'X-Guardian-Exit-Code'
};

// Valid verdicts (from guardian verdict logic)
const VALID_VERDICTS = ['READY', 'FRICTION', 'DO_NOT_LAUNCH'];

// Valid exit codes
const VALID_EXIT_CODES = [0, 1, 2];

/**
 * List of required headers that must be present in every API export
 * 
 * @returns {string[]} Array of required header names
 */
function getRequiredHeaders() {
  return [
    HEADER_NAMES.CONTRACT_VERSION,
    HEADER_NAMES.RUN_ID,
    HEADER_NAMES.VERDICT,
    HEADER_NAMES.URL,
    HEADER_NAMES.TIMESTAMP,
    HEADER_NAMES.EXIT_CODE
  ];
}

/**
 * Validate a complete headers object against contract
 * 
 * Throws an error if any contract requirement is violated.
 * 
 * @param {Object} headers - Headers object to validate
 * @throws {Error} If validation fails
 * @returns {boolean} true if valid (does not throw)
 */
function validateContractHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    throw new Error('Headers must be an object');
  }

  // Check all required headers are present
  const required = getRequiredHeaders();
  for (const headerName of required) {
    if (!(headerName in headers)) {
      throw new Error(`Missing required header: ${headerName}`);
    }
  }

  // Validate contract version
  const contractVersion = headers[HEADER_NAMES.CONTRACT_VERSION];
  if (contractVersion !== CONTRACT_VERSION) {
    throw new Error(
      `Invalid contract version: "${contractVersion}" (expected "${CONTRACT_VERSION}")`
    );
  }

  // Validate run ID
  const runId = headers[HEADER_NAMES.RUN_ID];
  if (typeof runId !== 'string' || runId.trim().length === 0) {
    throw new Error('Run ID must be a non-empty string');
  }

  // Validate verdict
  const verdict = headers[HEADER_NAMES.VERDICT];
  if (!VALID_VERDICTS.includes(verdict)) {
    throw new Error(
      `Invalid verdict: "${verdict}" (must be one of: ${VALID_VERDICTS.join(', ')})`
    );
  }

  // Validate URL
  const url = headers[HEADER_NAMES.URL];
  if (typeof url !== 'string') {
    throw new Error('URL must be a string');
  }
  if (url.length > 0) {
    try {
      new URL(url);
    } catch (err) {
      throw new Error(`Invalid URL format: "${url}"`);
    }
  }

  // Validate timestamp
  const timestamp = headers[HEADER_NAMES.TIMESTAMP];
  if (typeof timestamp !== 'string') {
    throw new Error('Timestamp must be a string');
  }
  if (timestamp.length > 0) {
    // Validate ISO 8601 format - must match pattern and round-trip
    // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    if (!iso8601Regex.test(timestamp)) {
      throw new Error(`Timestamp must be valid ISO 8601: "${timestamp}"`);
    }
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid timestamp format: "${timestamp}" (expected ISO 8601)`);
    }
    // Ensure it round-trips correctly (catches invalid dates like 2025-13-32)
    if (date.toISOString() !== timestamp) {
      throw new Error(`Timestamp must be valid ISO 8601: "${timestamp}"`);
    }
  }

  // Validate exit code
  const exitCode = headers[HEADER_NAMES.EXIT_CODE];
  const exitCodeNum = typeof exitCode === 'string' ? parseInt(exitCode, 10) : exitCode;
  if (!Number.isInteger(exitCodeNum) || !VALID_EXIT_CODES.includes(exitCodeNum)) {
    throw new Error(
      `Exit code must be an integer (${VALID_EXIT_CODES.join(', ')}), got: ${exitCode}`
    );
  }

  return true;
}

/**
 * Build contract headers from run metadata
 * 
 * This is the ONLY place where headers should be constructed.
 * Direct string header creation is forbidden.
 * 
 * @param {Object} metadata - Run metadata
 * @param {string} metadata.runId - Run identifier (required)
 * @param {string} metadata.verdict - Run verdict: READY|FRICTION|DO_NOT_LAUNCH (required)
 * @param {string} metadata.url - Target URL (required, can be empty string)
 * @param {string} metadata.timestamp - ISO 8601 timestamp (required)
 * @param {number} metadata.exitCode - Exit code: 0|1|2 (required)
 * @returns {Object} Complete headers object with all contract fields
 * @throws {Error} If required fields are missing
 */
function buildContractHeaders(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    throw new Error('Metadata must be an object');
  }

  // Validate required fields exist
  if (!('runId' in metadata)) {
    throw new Error('Metadata requires runId');
  }
  if (!('verdict' in metadata)) {
    throw new Error('Metadata requires verdict');
  }
  if (!('url' in metadata)) {
    throw new Error('Metadata requires url');
  }
  if (!('timestamp' in metadata)) {
    throw new Error('Metadata requires timestamp');
  }
  if (!('exitCode' in metadata)) {
    throw new Error('Metadata requires exitCode');
  }

  const headers = {
    [HEADER_NAMES.CONTRACT_VERSION]: CONTRACT_VERSION,
    [HEADER_NAMES.RUN_ID]: metadata.runId,
    [HEADER_NAMES.VERDICT]: metadata.verdict,
    [HEADER_NAMES.URL]: metadata.url,
    [HEADER_NAMES.TIMESTAMP]: metadata.timestamp,
    [HEADER_NAMES.EXIT_CODE]: String(metadata.exitCode)
  };

  // Validate before returning
  validateContractHeaders(headers);

  return headers;
}

module.exports = {
  CONTRACT_VERSION,
  HEADER_NAMES,
  VALID_VERDICTS,
  VALID_EXIT_CODES,
  getRequiredHeaders,
  validateContractHeaders,
  buildContractHeaders
};
