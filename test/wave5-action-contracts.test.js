/**
 * WAVE 5: ACTION CONTRACTS
 * Tests for AST-based action contract extraction, instrumentation, and runtime attribution.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractActionContracts } from '../src/verax/learn/action-contract-extractor.js';
import { instrumentJSX } from '../src/verax/learn/source-instrumenter.js';
import { getExpectation } from '../src/verax/detect/expectation-model.js';
import { computeConfidence } from '../src/verax/detect/confidence-engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, 'fixtures');

describe('Wave 5: Action Contract Extraction', () => {
  it('should extract PROVEN contract from static fetch URL', () => {
    const filePath = resolve(fixturesDir, 'react-action-app', 'App.jsx');
    const workspaceRoot = resolve(__dirname, '..');
    
    const contracts = extractActionContracts(filePath, workspaceRoot);
    
    assert.ok(contracts.length > 0, 'Should find at least one contract');
    
    const fetchContract = contracts.find(c => c.urlPath === '/api/save');
    assert.ok(fetchContract, 'Should find /api/save contract');
    assert.strictEqual(fetchContract.kind, 'NETWORK_ACTION');
    assert.strictEqual(fetchContract.method, 'POST');
    assert.ok(fetchContract.source.includes('App.jsx'), 'Source reference should include file name');
  });

  it('should NOT extract contract from dynamic URL (template literal)', () => {
    const filePath = resolve(fixturesDir, 'dynamic-url', 'App.jsx');
    const workspaceRoot = resolve(__dirname, '..');
    
    const contracts = extractActionContracts(filePath, workspaceRoot);
    
    // Should not find any PROVEN contracts since URL is dynamic
    const dynamicContract = contracts.find(c => c.urlPath && c.urlPath.includes('users'));
    assert.ok(!dynamicContract, 'Should NOT create contract for dynamic URL');
  });

  it('should extract contract from missing-request fixture', () => {
    const filePath = resolve(fixturesDir, 'missing-request', 'App.jsx');
    const workspaceRoot = resolve(__dirname, '..');
    
    const contracts = extractActionContracts(filePath, workspaceRoot);
    
    assert.ok(contracts.length > 0, 'Should find contract even if code prevents execution');
    
    const fetchContract = contracts.find(c => c.urlPath === '/api/save');
    assert.ok(fetchContract, 'Should find /api/save contract');
    assert.strictEqual(fetchContract.method, 'POST');
  });
});

describe('Wave 5: Source Instrumentation', () => {
  it('should inject data-verax-source into onClick handlers', () => {
    const code = `
import React from 'react';

function App() {
  return (
    <div>
      <button onClick={() => console.log('clicked')}>Click Me</button>
    </div>
  );
}
`;
    
    const filePath = resolve(fixturesDir, 'test-app', 'App.jsx');
    const workspaceRoot = resolve(__dirname, '..');
    
    const instrumented = instrumentJSX(code, filePath, workspaceRoot);
    
    assert.ok(instrumented.includes('data-verax-source'), 'Should add data-verax-source attribute');
    assert.ok(instrumented.includes('App.jsx'), 'Source reference should include file name');
  });

  it('should NOT re-instrument already instrumented code', () => {
    const code = `
import React from 'react';

function App() {
  return (
    <button onClick={() => {}} data-verax-source="App.jsx:5:4">Click</button>
  );
}
`;
    
    const filePath = resolve(fixturesDir, 'test-app', 'App.jsx');
    const workspaceRoot = resolve(__dirname, '..');
    
    const instrumented = instrumentJSX(code, filePath, workspaceRoot);
    
    // Should only have one data-verax-source attribute
    const matches = instrumented.match(/data-verax-source/g);
    assert.strictEqual(matches.length, 1, 'Should not duplicate instrumentation');
  });

  it('should normalize Windows paths to forward slashes', () => {
    const code = `
import React from 'react';

function App() {
  return <button onClick={() => {}}>Test</button>;
}
`;
    
    const filePath = 'C:\\Users\\test\\project\\App.jsx';
    const workspaceRoot = 'C:\\Users\\test\\project';
    
    const instrumented = instrumentJSX(code, filePath, workspaceRoot);
    
    // Source reference should use forward slashes
    assert.ok(instrumented.includes('data-verax-source'), 'Should add attribute');
    assert.ok(!instrumented.includes('\\\\'), 'Should not contain backslashes');
  });
});

describe('Wave 5: Expectation Matching with Action Contracts', () => {
  it('should create PROVEN network_action expectation when sourceRef matches contract', () => {
    const manifest = {
      actionContracts: [
        {
          kind: 'NETWORK_ACTION',
          method: 'POST',
          urlPath: '/api/save',
          source: 'test/fixtures/react-action-app/App.jsx:8:10'
        }
      ]
    };
    
    const interaction = {
      type: 'button',
      selector: 'button'
    };
    
    const beforeUrl = 'http://localhost:3000/';
    const attemptMeta = {
      sourceRef: 'test/fixtures/react-action-app/App.jsx:8:10'
    };
    
    const expectation = getExpectation(manifest, interaction, beforeUrl, attemptMeta);
    
    assert.strictEqual(expectation.hasExpectation, true);
    assert.strictEqual(expectation.proof, 'PROVEN_EXPECTATION');
    assert.strictEqual(expectation.expectationType, 'network_action');
    assert.strictEqual(expectation.method, 'POST');
    assert.strictEqual(expectation.urlPath, '/api/save');
  });

  it('should NOT match without sourceRef', () => {
    const manifest = {
      actionContracts: [
        {
          kind: 'NETWORK_ACTION',
          method: 'POST',
          urlPath: '/api/save',
          source: 'App.jsx:8:10'
        }
      ]
    };
    
    const interaction = { type: 'button' };
    const beforeUrl = 'http://localhost:3000/';
    const attemptMeta = {}; // No sourceRef
    
    const expectation = getExpectation(manifest, interaction, beforeUrl, attemptMeta);
    
    assert.strictEqual(expectation.hasExpectation, false);
    assert.strictEqual(expectation.proof, 'UNKNOWN_EXPECTATION');
  });

  it('should NOT match with mismatched sourceRef', () => {
    const manifest = {
      actionContracts: [
        {
          kind: 'NETWORK_ACTION',
          method: 'POST',
          urlPath: '/api/save',
          source: 'App.jsx:8:10'
        }
      ]
    };
    
    const interaction = { type: 'button' };
    const beforeUrl = 'http://localhost:3000/';
    const attemptMeta = { sourceRef: 'App.jsx:99:99' }; // Different line
    
    const expectation = getExpectation(manifest, interaction, beforeUrl, attemptMeta);
    
    assert.strictEqual(expectation.hasExpectation, false);
  });
});

describe('Wave 5: missing_network_action Confidence Scoring', () => {
  it('should score HIGH confidence when zero network activity with PROVEN contract', () => {
    const result = computeConfidence({
      findingType: 'missing_network_action',
      expectation: {
        proof: 'PROVEN_EXPECTATION',
        expectationType: 'network_action'
      },
      sensors: {
        network: { totalRequests: 0 },
        console: { consoleErrorCount: 0 }
      },
      comparisons: {},
      attemptMeta: { sourceRef: 'App.jsx:10:5' }
    });
    
    assert.strictEqual(result.level, 'HIGH');
    assert.ok(result.score >= 80, `Score should be >= 80, got ${result.score}`);
    assert.ok(result.reasons.some(r => r.includes('Code contract proven')));
    assert.ok(result.reasons.some(r => r.includes('Zero network activity')));
  });

  it('should score MEDIUM confidence when console errors present', () => {
    const result = computeConfidence({
      findingType: 'missing_network_action',
      expectation: {
        proof: 'PROVEN_EXPECTATION',
        expectationType: 'network_action'
      },
      sensors: {
        network: { totalRequests: 0 },
        console: { consoleErrorCount: 2, pageErrorCount: 1 }
      },
      comparisons: {},
      attemptMeta: { sourceRef: 'App.jsx:10:5' }
    });
    
    assert.ok(result.score >= 60, `Score should be >= 60 for MEDIUM, got ${result.score}`);
    assert.ok(result.reasons.some(r => r.includes('JavaScript errors')));
  });

  it('should penalize when network activity occurred', () => {
    const withoutNetwork = computeConfidence({
      findingType: 'missing_network_action',
      expectation: { proof: 'PROVEN_EXPECTATION' },
      sensors: { network: { totalRequests: 0 } },
      attemptMeta: { sourceRef: 'App.jsx:10:5' }
    });
    
    const withNetwork = computeConfidence({
      findingType: 'missing_network_action',
      expectation: { proof: 'PROVEN_EXPECTATION' },
      sensors: { network: { totalRequests: 3 } },
      attemptMeta: { sourceRef: 'App.jsx:10:5' }
    });
    
    assert.ok(
      withoutNetwork.score > withNetwork.score,
      'Zero network should score higher than some network activity'
    );
  });
});

describe('Wave 5: Integration Test - Full Pipeline', () => {
  it('should detect network_silent_failure for 500 error with no feedback', () => {
    // Simulate a trace with sourceRef and network failure
    const manifest = {
      actionContracts: [
        {
          kind: 'NETWORK_ACTION',
          method: 'POST',
          urlPath: '/api/save',
          source: 'test/fixtures/react-action-app/index.html:34:10'
        }
      ]
    };
    
    const interaction = {
      type: 'button',
      selector: 'button'
    };
    
    const beforeUrl = 'http://localhost:3000/';
    const attemptMeta = {
      sourceRef: 'test/fixtures/react-action-app/index.html:34:10'
    };
    
    // Get expectation
    const expectation = getExpectation(manifest, interaction, beforeUrl, attemptMeta);
    
    assert.strictEqual(expectation.expectationType, 'network_action');
    assert.strictEqual(expectation.proof, 'PROVEN_EXPECTATION');
    
    // Compute confidence for network_silent_failure
    const sensors = {
      network: {
        totalRequests: 1,
        failedRequests: 1,
        failedByStatus: { 500: 1 },
        topFailedUrls: [{ url: '/api/save', status: 500 }]
      },
      console: { pageErrorCount: 1 },
      uiSignals: {
        before: { hasErrorSignal: false },
        after: { hasErrorSignal: false },
        changes: { changed: false }
      }
    };
    
    const confidence = computeConfidence({
      findingType: 'network_silent_failure',
      expectation,
      sensors,
      comparisons: { hasUrlChange: false, hasDomChange: false },
      attemptMeta
    });
    
    assert.strictEqual(confidence.level, 'HIGH');
    assert.ok(confidence.score >= 80);
  });

  it('should detect missing_network_action when request never fires', () => {
    const manifest = {
      actionContracts: [
        {
          kind: 'NETWORK_ACTION',
          method: 'POST',
          urlPath: '/api/save',
          source: 'test/fixtures/missing-request/App.jsx:8:10'
        }
      ]
    };
    
    const interaction = { type: 'button' };
    const beforeUrl = 'http://localhost:3000/';
    const attemptMeta = {
      sourceRef: 'test/fixtures/missing-request/App.jsx:8:10'
    };
    
    const expectation = getExpectation(manifest, interaction, beforeUrl, attemptMeta);
    
    assert.strictEqual(expectation.expectationType, 'network_action');
    
    // Zero network activity
    const sensors = {
      network: { totalRequests: 0 },
      console: { consoleErrorCount: 0 }
    };
    
    const confidence = computeConfidence({
      findingType: 'missing_network_action',
      expectation,
      sensors,
      comparisons: {},
      attemptMeta
    });
    
    assert.strictEqual(confidence.level, 'HIGH');
    assert.ok(confidence.reasons.some(r => r.includes('Zero network activity')));
  });
});
