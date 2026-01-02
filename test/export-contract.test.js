/**
 * Export Contract Tests - Validate that contract cannot drift
 * 
 * These tests ensure:
 * - Header names are always in sync with the contract module
 * - Contract validation is enforced
 * - Invalid headers are rejected
 * - API export must use the contract module
 */

const assert = require('assert');
const {
  CONTRACT_VERSION,
  HEADER_NAMES,
  VALID_VERDICTS,
  VALID_EXIT_CODES,
  getRequiredHeaders,
  validateContractHeaders,
  buildContractHeaders
} = require('../src/guardian/export-contract');

// Test suite
console.log('🧪 Export Contract Tests');
console.log('═'.repeat(50));

let testCount = 0;
let passCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`✅ Test ${testCount}: ${name}`);
  } catch (err) {
    console.log(`❌ Test ${testCount}: ${name}`);
    console.log(`   Error: ${err.message}`);
    console.error(err);
  }
}

// Test 1: Contract version is defined
test('CONTRACT_VERSION is defined and is v1', () => {
  assert.strictEqual(CONTRACT_VERSION, 'v1');
  assert.strictEqual(typeof CONTRACT_VERSION, 'string');
});

// Test 2: Header names are defined
test('HEADER_NAMES contains all required keys', () => {
  assert(HEADER_NAMES.CONTRACT_VERSION);
  assert(HEADER_NAMES.RUN_ID);
  assert(HEADER_NAMES.VERDICT);
  assert(HEADER_NAMES.URL);
  assert(HEADER_NAMES.TIMESTAMP);
  assert(HEADER_NAMES.EXIT_CODE);
  assert.strictEqual(HEADER_NAMES.CONTRACT_VERSION, 'X-Guardian-Contract');
  assert.strictEqual(HEADER_NAMES.RUN_ID, 'X-Guardian-Run-Id');
  assert.strictEqual(HEADER_NAMES.VERDICT, 'X-Guardian-Verdict');
  assert.strictEqual(HEADER_NAMES.URL, 'X-Guardian-Url');
  assert.strictEqual(HEADER_NAMES.TIMESTAMP, 'X-Guardian-Timestamp');
  assert.strictEqual(HEADER_NAMES.EXIT_CODE, 'X-Guardian-Exit-Code');
});

// Test 3: Valid verdicts are defined
test('VALID_VERDICTS includes all verdicts', () => {
  assert.deepStrictEqual(VALID_VERDICTS, ['READY', 'FRICTION', 'DO_NOT_LAUNCH']);
});

// Test 4: Valid exit codes are defined
test('VALID_EXIT_CODES includes 0, 1, 2', () => {
  assert.deepStrictEqual(VALID_EXIT_CODES, [0, 1, 2]);
});

// Test 5: getRequiredHeaders returns correct list
test('getRequiredHeaders returns all required header names', () => {
  const required = getRequiredHeaders();
  assert.strictEqual(required.length, 6);
  assert(required.includes(HEADER_NAMES.CONTRACT_VERSION));
  assert(required.includes(HEADER_NAMES.RUN_ID));
  assert(required.includes(HEADER_NAMES.VERDICT));
  assert(required.includes(HEADER_NAMES.URL));
  assert(required.includes(HEADER_NAMES.TIMESTAMP));
  assert(required.includes(HEADER_NAMES.EXIT_CODE));
});

// Test 6: buildContractHeaders creates valid headers
test('buildContractHeaders creates valid headers from metadata', () => {
  const metadata = {
    runId: 'test-run-id',
    verdict: 'READY',
    url: 'https://example.com',
    timestamp: '2025-12-29T19:00:25.375Z',
    exitCode: 0
  };
  
  const headers = buildContractHeaders(metadata);
  
  assert.strictEqual(headers[HEADER_NAMES.CONTRACT_VERSION], 'v1');
  assert.strictEqual(headers[HEADER_NAMES.RUN_ID], 'test-run-id');
  assert.strictEqual(headers[HEADER_NAMES.VERDICT], 'READY');
  assert.strictEqual(headers[HEADER_NAMES.URL], 'https://example.com');
  assert.strictEqual(headers[HEADER_NAMES.TIMESTAMP], '2025-12-29T19:00:25.375Z');
  assert.strictEqual(headers[HEADER_NAMES.EXIT_CODE], '0');
});

// Test 7: buildContractHeaders rejects missing runId
test('buildContractHeaders throws when runId is missing', () => {
  const metadata = {
    verdict: 'READY',
    url: 'https://example.com',
    timestamp: '2025-12-29T19:00:25.375Z',
    exitCode: 0
  };
  
  try {
    buildContractHeaders(metadata);
    throw new Error('Should have thrown');
  } catch (err) {
    assert(err.message.includes('runId'));
  }
});

// Test 8: buildContractHeaders rejects missing verdict
test('buildContractHeaders throws when verdict is missing', () => {
  const metadata = {
    runId: 'test-run-id',
    url: 'https://example.com',
    timestamp: '2025-12-29T19:00:25.375Z',
    exitCode: 0
  };
  
  try {
    buildContractHeaders(metadata);
    throw new Error('Should have thrown');
  } catch (err) {
    assert(err.message.includes('verdict'));
  }
});

// Test 9: buildContractHeaders rejects missing url
test('buildContractHeaders throws when url is missing', () => {
  const metadata = {
    runId: 'test-run-id',
    verdict: 'READY',
    timestamp: '2025-12-29T19:00:25.375Z',
    exitCode: 0
  };
  
  try {
    buildContractHeaders(metadata);
    throw new Error('Should have thrown');
  } catch (err) {
    assert(err.message.includes('url'));
  }
});

// Test 10: buildContractHeaders rejects missing timestamp
test('buildContractHeaders throws when timestamp is missing', () => {
  const metadata = {
    runId: 'test-run-id',
    verdict: 'READY',
    url: 'https://example.com',
    exitCode: 0
  };
  
  try {
    buildContractHeaders(metadata);
    throw new Error('Should have thrown');
  } catch (err) {
    assert(err.message.includes('timestamp'));
  }
});

// Test 11: buildContractHeaders rejects missing exitCode
test('buildContractHeaders throws when exitCode is missing', () => {
  const metadata = {
    runId: 'test-run-id',
    verdict: 'READY',
    url: 'https://example.com',
    timestamp: '2025-12-29T19:00:25.375Z'
  };
  
  try {
    buildContractHeaders(metadata);
    throw new Error('Should have thrown');
  } catch (err) {
    assert(err.message.includes('exitCode'));
  }
});

// Test 12: validateContractHeaders accepts valid headers
test('validateContractHeaders accepts valid headers', () => {
  const headers = {
    [HEADER_NAMES.CONTRACT_VERSION]: 'v1',
    [HEADER_NAMES.RUN_ID]: 'test-run-id',
    [HEADER_NAMES.VERDICT]: 'READY',
    [HEADER_NAMES.URL]: 'https://example.com',
    [HEADER_NAMES.TIMESTAMP]: '2025-12-29T19:00:25.375Z',
    [HEADER_NAMES.EXIT_CODE]: '0'
  };
  
  const result = validateContractHeaders(headers);
  assert.strictEqual(result, true);
});

// Test 13: validateContractHeaders rejects missing header
test('validateContractHeaders rejects missing required header', () => {
  const headers = {
    [HEADER_NAMES.CONTRACT_VERSION]: 'v1',
    [HEADER_NAMES.RUN_ID]: 'test-run-id',
    [HEADER_NAMES.VERDICT]: 'READY',
    [HEADER_NAMES.URL]: 'https://example.com',
    [HEADER_NAMES.TIMESTAMP]: '2025-12-29T19:00:25.375Z'
    // Missing EXIT_CODE
  };
  
  try {
    validateContractHeaders(headers);
    throw new Error('Should have thrown');
  } catch (err) {
    assert(err.message.includes('Missing required header'));
  }
});

// Test 14: validateContractHeaders rejects invalid contract version
test('validateContractHeaders rejects invalid contract version', () => {
  const headers = {
    [HEADER_NAMES.CONTRACT_VERSION]: 'v2',
    [HEADER_NAMES.RUN_ID]: 'test-run-id',
    [HEADER_NAMES.VERDICT]: 'READY',
    [HEADER_NAMES.URL]: 'https://example.com',
    [HEADER_NAMES.TIMESTAMP]: '2025-12-29T19:00:25.375Z',
    [HEADER_NAMES.EXIT_CODE]: '0'
  };
  
  try {
    validateContractHeaders(headers);
    throw new Error('Should have thrown');
  } catch (err) {
    assert(err.message.includes('contract version'));
  }
});

// Test 15: validateContractHeaders rejects empty runId
test('validateContractHeaders rejects empty runId', () => {
  const headers = {
    [HEADER_NAMES.CONTRACT_VERSION]: 'v1',
    [HEADER_NAMES.RUN_ID]: '',
    [HEADER_NAMES.VERDICT]: 'READY',
    [HEADER_NAMES.URL]: 'https://example.com',
    [HEADER_NAMES.TIMESTAMP]: '2025-12-29T19:00:25.375Z',
    [HEADER_NAMES.EXIT_CODE]: '0'
  };
  
  try {
    validateContractHeaders(headers);
    throw new Error('Should have thrown');
  } catch (err) {
    assert(err.message.includes('Run ID'));
  }
});

// Test 16: validateContractHeaders rejects invalid verdict
test('validateContractHeaders rejects invalid verdict', () => {
  const headers = {
    [HEADER_NAMES.CONTRACT_VERSION]: 'v1',
    [HEADER_NAMES.RUN_ID]: 'test-run-id',
    [HEADER_NAMES.VERDICT]: 'INVALID',
    [HEADER_NAMES.URL]: 'https://example.com',
    [HEADER_NAMES.TIMESTAMP]: '2025-12-29T19:00:25.375Z',
    [HEADER_NAMES.EXIT_CODE]: '0'
  };
  
  try {
    validateContractHeaders(headers);
    throw new Error('Should have thrown');
  } catch (err) {
    assert(err.message.includes('verdict'));
  }
});

// Test 17: validateContractHeaders accepts all valid verdicts
test('validateContractHeaders accepts all valid verdicts', () => {
  for (const verdict of ['READY', 'FRICTION', 'DO_NOT_LAUNCH']) {
    const headers = {
      [HEADER_NAMES.CONTRACT_VERSION]: 'v1',
      [HEADER_NAMES.RUN_ID]: 'test-run-id',
      [HEADER_NAMES.VERDICT]: verdict,
      [HEADER_NAMES.URL]: 'https://example.com',
      [HEADER_NAMES.TIMESTAMP]: '2025-12-29T19:00:25.375Z',
      [HEADER_NAMES.EXIT_CODE]: '0'
    };
    
    validateContractHeaders(headers);
  }
});

// Test 18: validateContractHeaders rejects invalid URL
test('validateContractHeaders rejects invalid URL', () => {
  const headers = {
    [HEADER_NAMES.CONTRACT_VERSION]: 'v1',
    [HEADER_NAMES.RUN_ID]: 'test-run-id',
    [HEADER_NAMES.VERDICT]: 'READY',
    [HEADER_NAMES.URL]: 'not-a-valid-url',
    [HEADER_NAMES.TIMESTAMP]: '2025-12-29T19:00:25.375Z',
    [HEADER_NAMES.EXIT_CODE]: '0'
  };
  
  try {
    validateContractHeaders(headers);
    throw new Error('Should have thrown');
  } catch (err) {
    assert(err.message.includes('Invalid URL format'));
  }
});

// Test 19: validateContractHeaders accepts empty URL
test('validateContractHeaders accepts empty URL', () => {
  const headers = {
    [HEADER_NAMES.CONTRACT_VERSION]: 'v1',
    [HEADER_NAMES.RUN_ID]: 'test-run-id',
    [HEADER_NAMES.VERDICT]: 'READY',
    [HEADER_NAMES.URL]: '',
    [HEADER_NAMES.TIMESTAMP]: '2025-12-29T19:00:25.375Z',
    [HEADER_NAMES.EXIT_CODE]: '0'
  };
  
  validateContractHeaders(headers);
});

// Test 20: validateContractHeaders rejects invalid timestamp
test('validateContractHeaders rejects invalid timestamp', () => {
  const headers = {
    [HEADER_NAMES.CONTRACT_VERSION]: 'v1',
    [HEADER_NAMES.RUN_ID]: 'test-run-id',
    [HEADER_NAMES.VERDICT]: 'READY',
    [HEADER_NAMES.URL]: 'https://example.com',
    [HEADER_NAMES.TIMESTAMP]: 'not-a-timestamp',
    [HEADER_NAMES.EXIT_CODE]: '0'
  };
  
  try {
    validateContractHeaders(headers);
    throw new Error('Should have thrown');
  } catch (err) {
    assert(err.message.includes('timestamp'));
  }
});

// Test 21: validateContractHeaders rejects non-ISO timestamp
test('validateContractHeaders rejects non-ISO timestamp format', () => {
  const headers = {
    [HEADER_NAMES.CONTRACT_VERSION]: 'v1',
    [HEADER_NAMES.RUN_ID]: 'test-run-id',
    [HEADER_NAMES.VERDICT]: 'READY',
    [HEADER_NAMES.URL]: 'https://example.com',
    [HEADER_NAMES.TIMESTAMP]: '12/29/2025 7:00 PM',
    [HEADER_NAMES.EXIT_CODE]: '0'
  };
  
  try {
    validateContractHeaders(headers);
    throw new Error('Should have thrown');
  } catch (err) {
    assert(err.message.toLowerCase().includes('timestamp'), `Expected error about timestamp, got: ${err.message}`);
  }
});

// Test 22: validateContractHeaders rejects invalid date in timestamp
test('validateContractHeaders rejects invalid date (2025-13-32)', () => {
  const headers = {
    [HEADER_NAMES.CONTRACT_VERSION]: 'v1',
    [HEADER_NAMES.RUN_ID]: 'test-run-id',
    [HEADER_NAMES.VERDICT]: 'READY',
    [HEADER_NAMES.URL]: 'https://example.com',
    [HEADER_NAMES.TIMESTAMP]: '2025-13-32T19:00:25.375Z',
    [HEADER_NAMES.EXIT_CODE]: '0'
  };
  
  try {
    validateContractHeaders(headers);
    throw new Error('Should have thrown');
  } catch (err) {
    assert(err.message.includes('timestamp'));
  }
});

// Test 23: validateContractHeaders rejects invalid exit code
test('validateContractHeaders rejects invalid exit code', () => {
  const headers = {
    [HEADER_NAMES.CONTRACT_VERSION]: 'v1',
    [HEADER_NAMES.RUN_ID]: 'test-run-id',
    [HEADER_NAMES.VERDICT]: 'READY',
    [HEADER_NAMES.URL]: 'https://example.com',
    [HEADER_NAMES.TIMESTAMP]: '2025-12-29T19:00:25.375Z',
    [HEADER_NAMES.EXIT_CODE]: '5'
  };
  
  try {
    validateContractHeaders(headers);
    throw new Error('Should have thrown');
  } catch (err) {
    assert(err.message.includes('Exit code'));
  }
});

// Test 24: validateContractHeaders accepts all valid exit codes
test('validateContractHeaders accepts all valid exit codes', () => {
  for (const code of [0, 1, 2]) {
    const headers = {
      [HEADER_NAMES.CONTRACT_VERSION]: 'v1',
      [HEADER_NAMES.RUN_ID]: 'test-run-id',
      [HEADER_NAMES.VERDICT]: 'READY',
      [HEADER_NAMES.URL]: 'https://example.com',
      [HEADER_NAMES.TIMESTAMP]: '2025-12-29T19:00:25.375Z',
      [HEADER_NAMES.EXIT_CODE]: String(code)
    };
    
    validateContractHeaders(headers);
  }
});

// Test 25: API exporter uses contract module (integration)
test('API exporter imports and uses contract module', () => {
  const runExport = require('../src/guardian/run-export');
  
  // Verify httpPostWithRetry is exported and callable
  assert(typeof runExport.httpPostWithRetry === 'function');
  
  // Verify no hardcoded header strings in run-export.js
  const fs = require('fs');
  const content = fs.readFileSync('./src/guardian/run-export.js', 'utf8');
  
  // Should NOT have direct header strings (should use contract module instead)
  assert(!content.includes("'X-Guardian-Contract'"), 'Found hardcoded X-Guardian-Contract header');
  assert(!content.includes("'X-Guardian-Run-Id'"), 'Found hardcoded X-Guardian-Run-Id header');
  assert(!content.includes("'X-Guardian-Verdict'"), 'Found hardcoded X-Guardian-Verdict header');
  assert(!content.includes("'X-Guardian-Url'"), 'Found hardcoded X-Guardian-Url header');
  assert(!content.includes("'X-Guardian-Timestamp'"), 'Found hardcoded X-Guardian-Timestamp header');
  assert(!content.includes("'X-Guardian-Exit-Code'"), 'Found hardcoded X-Guardian-Exit-Code header');
  
  // Should import the contract module
  assert(content.includes("require('./export-contract')"), 'Contract module not imported');
});

// Test 26: buildContractHeaders converts exitCode to string
test('buildContractHeaders converts exitCode to string', () => {
  const metadata = {
    runId: 'test-run-id',
    verdict: 'READY',
    url: 'https://example.com',
    timestamp: '2025-12-29T19:00:25.375Z',
    exitCode: 0
  };
  
  const headers = buildContractHeaders(metadata);
  assert.strictEqual(typeof headers[HEADER_NAMES.EXIT_CODE], 'string');
  assert.strictEqual(headers[HEADER_NAMES.EXIT_CODE], '0');
});

// Test 27: Contract headers cannot be bypassed
test('validateContractHeaders is called by buildContractHeaders', () => {
  const metadata = {
    runId: 'test-run-id',
    verdict: 'INVALID_VERDICT',
    url: 'https://example.com',
    timestamp: '2025-12-29T19:00:25.375Z',
    exitCode: 0
  };
  
  try {
    buildContractHeaders(metadata);
    throw new Error('Should have thrown during validation');
  } catch (err) {
    assert(err.message.includes('verdict'));
  }
});

// Print summary
console.log('═'.repeat(50));
console.log(`\nResults: ${passCount}/${testCount} tests passed`);

if (passCount === testCount) {
  console.log('✅ All contract tests passed\n');
  process.exit(0);
} else {
  console.log(`❌ ${testCount - passCount} test(s) failed\n`);
  process.exit(1);
}
