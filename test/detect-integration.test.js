/**
 * Detect Phase Integration Test
 * Validates that the detect phase correctly:
 * 1. Classifies expectations based on observations
 * 2. Calculates deterministic confidence scores
 * 3. Assigns impact levels correctly
 * 4. Links evidence to findings
 * 5. Generates valid findings.json
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { detectFindings } from '../src/cli/util/detection-engine.js';
import { writeFindingsJson } from '../src/cli/util/findings-writer.js';

function createTempDir() {
  const tempDir = resolve(
    tmpdir(),
    `verax-detect-integration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('detect phase classifies silent failures correctly', async () => {
  const tempDir = createTempDir();
  try {
    const learnData = {
      expectations: [
        {
          id: 'exp-001',
          type: 'navigation',
          promise: { kind: 'navigate', value: '/about' },
          source: { file: 'pages/index.js', line: 10 },
          confidence: 0.9
        }
      ],
      skipped: []
    };

    const observeData = {
      observations: [
        {
          id: 'exp-001',
          observed: false,
          attempted: true,
          reason: 'Navigation did not occur',
          evidenceFiles: []
        }
      ],
      stats: { attempted: 1, observed: 0, notObserved: 1 },
      observedAt: new Date().toISOString()
    };

    const findings = await detectFindings(learnData, observeData, tempDir);

    assert.strictEqual(findings.findings.length, 1);
    const finding = findings.findings[0];

    assert.strictEqual(finding.id, 'exp-001');
    assert.strictEqual(finding.classification, 'silent-failure');
    assert.strictEqual(finding.impact, 'HIGH');
    assert.strictEqual(finding.confidence, 0.4);
    assert.strictEqual(findings.stats.silentFailures, 1);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('detect phase classifies observed expectations correctly', async () => {
  const tempDir = createTempDir();
  try {
    const learnData = {
      expectations: [
        {
          id: 'exp-002',
          type: 'network',
          promise: { kind: 'request', value: 'https://api.example.com/users' },
          source: { file: 'services/api.js', line: 25 },
          confidence: 0.95
        }
      ],
      skipped: []
    };

    const observeData = {
      observations: [
        {
          id: 'exp-002',
          observed: true,
          attempted: true,
          reason: 'Network request successful',
          evidenceFiles: ['network-logs/api-users.json']
        }
      ],
      stats: { attempted: 1, observed: 1, notObserved: 0 },
      observedAt: new Date().toISOString()
    };

    const findings = await detectFindings(learnData, observeData, tempDir);

    assert.strictEqual(findings.findings.length, 1);
    const finding = findings.findings[0];

    assert.strictEqual(finding.id, 'exp-002');
    assert.strictEqual(finding.classification, 'observed');
    assert.strictEqual(finding.impact, 'MEDIUM');
    assert.strictEqual(finding.confidence, 1.0);
    assert.deepStrictEqual(finding.evidence, [
      { type: 'network-log', path: 'network-logs/api-users.json', available: true }
    ]);
    assert.strictEqual(findings.stats.observed, 1);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('detect phase marks coverage gaps for untested expectations', async () => {
  const tempDir = createTempDir();
  try {
    const learnData = {
      expectations: [
        {
          id: 'exp-003',
          type: 'state',
          promise: { kind: 'state_mutation', value: 'user auth token' },
          source: { file: 'hooks/useAuth.js', line: 15 },
          confidence: 0.8
        }
      ],
      skipped: []
    };

    const observeData = {
      observations: [], // Nothing observed for this expectation
      stats: { attempted: 0, observed: 0, notObserved: 0 },
      observedAt: new Date().toISOString()
    };

    const findings = await detectFindings(learnData, observeData, tempDir);

    assert.strictEqual(findings.findings.length, 1);
    const finding = findings.findings[0];

    assert.strictEqual(finding.id, 'exp-003');
    assert.strictEqual(finding.classification, 'coverage-gap');
    assert.strictEqual(finding.impact, 'LOW'); // Coverage gaps are low priority
    assert.strictEqual(finding.confidence, 0);
    assert.strictEqual(findings.stats.coverageGaps, 1);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('detect phase calculates deterministic confidence correctly', async () => {
  const tempDir = createTempDir();
  try {
    // Test case: Base confidence 0.8, silent-failure classification
    // Expected: 0.8 * 0.75 = 0.6
    const learnData = {
      expectations: [
        {
          id: 'exp-004',
          type: 'navigation',
          promise: { kind: 'navigate', value: '/products' },
          source: { file: 'pages/index.js', line: 5 },
          confidence: 0.8
        }
      ],
      skipped: []
    };

    const observeData = {
      observations: [
        {
          id: 'exp-004',
          observed: false,
          attempted: true,
          reason: 'Navigation not observed',
          evidenceFiles: ['screenshots/before.png', 'screenshots/after.png']
        }
      ],
      stats: { attempted: 1, observed: 0, notObserved: 1 },
      observedAt: new Date().toISOString()
    };

    const findings = await detectFindings(learnData, observeData, tempDir);
    const finding = findings.findings[0];

    // Screenshots only -> ~0.6 per deterministic rule
    assert.strictEqual(finding.confidence, 0.6);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('detect phase handles mixed expectations correctly', async () => {
  const tempDir = createTempDir();
  try {
    const learnData = {
      expectations: [
        {
          id: 'exp-005-success',
          type: 'navigation',
          promise: { kind: 'navigate', value: '/' },
          source: { file: 'pages/index.js', line: 1 },
          confidence: 1.0
        },
        {
          id: 'exp-005-failure',
          type: 'navigation',
          promise: { kind: 'navigate', value: '/admin' },
          source: { file: 'pages/index.js', line: 2 },
          confidence: 0.7
        },
        {
          id: 'exp-005-gap',
          type: 'state',
          promise: { kind: 'state_mutation', value: 'theme preference' },
          source: { file: 'hooks/useTheme.js', line: 10 },
          confidence: 0.6
        }
      ],
      skipped: []
    };

    const observeData = {
      observations: [
        {
          id: 'exp-005-success',
          observed: true,
          attempted: true,
          reason: 'Navigation successful',
          evidenceFiles: ['screenshots/home-visited.png']
        },
        {
          id: 'exp-005-failure',
          observed: false,
          attempted: true,
          reason: 'Admin navigation blocked',
          evidenceFiles: []
        }
        // No observation for exp-005-gap
      ],
      stats: { attempted: 2, observed: 1, notObserved: 1 },
      observedAt: new Date().toISOString()
    };

    const findings = await detectFindings(learnData, observeData, tempDir);

    assert.strictEqual(findings.findings.length, 3);
    assert.strictEqual(findings.stats.total, 3);
    assert.strictEqual(findings.stats.observed, 1);
    assert.strictEqual(findings.stats.silentFailures, 0);
    assert.strictEqual(findings.stats.coverageGaps, 2);

    // Verify each finding
    const byId = Object.fromEntries(
      findings.findings.map((f) => [f.id, f])
    );

    assert.strictEqual(byId['exp-005-success'].classification, 'observed');
    assert.strictEqual(byId['exp-005-success'].confidence, 1.0);

    assert.strictEqual(byId['exp-005-failure'].classification, 'coverage-gap');
    assert.strictEqual(byId['exp-005-failure'].confidence, 0);

    assert.strictEqual(byId['exp-005-gap'].classification, 'coverage-gap');
    assert.strictEqual(byId['exp-005-gap'].confidence, 0);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('detect phase writes findings.json with correct schema', async () => {
  const tempDir = createTempDir();
  try {
    const runDir = join(tempDir, 'runs', 'test-run');
    mkdirSync(runDir, { recursive: true });

    const learnData = {
      expectations: [
        {
          id: 'exp-006',
          type: 'network',
          promise: { kind: 'request', value: 'https://api.example.com/data' },
          source: { file: 'services/fetch.js', line: 8 },
          confidence: 0.85
        }
      ],
      skipped: []
    };

    const observeData = {
      observations: [
        {
          id: 'exp-006',
          observed: true,
          attempted: true,
          reason: 'Request successful',
          evidenceFiles: ['network-logs/api-data.json']
        }
      ],
      stats: { attempted: 1, observed: 1, notObserved: 0 },
      observedAt: new Date().toISOString()
    };

    const findings = await detectFindings(learnData, observeData, tempDir);
    writeFindingsJson(runDir, findings);

    const findingsPath = join(runDir, 'findings.json');
    assert.ok(existsSync(findingsPath));

    const content = readFileSync(findingsPath, 'utf-8');
    const output = JSON.parse(content);

    assert.ok(output.findings);
    assert.ok(output.stats);
    assert.ok(output.detectedAt);
    assert.strictEqual(output.findings.length, 1);
    assert.strictEqual(output.stats.total, 1);
    assert.strictEqual(output.stats.observed, 1);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('detect phase handles empty expectations gracefully', async () => {
  const tempDir = createTempDir();
  try {
    const learnData = {
      expectations: [],
      skipped: []
    };

    const observeData = {
      observations: [],
      stats: { attempted: 0, observed: 0, notObserved: 0 },
      observedAt: new Date().toISOString()
    };

    const findings = await detectFindings(learnData, observeData, tempDir);

    assert.strictEqual(findings.findings.length, 0);
    assert.strictEqual(findings.stats.total, 0);
    assert.ok(findings.detectedAt);
  } finally {
    cleanupTempDir(tempDir);
  }
});
