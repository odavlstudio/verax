/**
 * Silent Failure Taxonomy Expansion Tests
 * 
 * Verifies the four detector classes that complete the Silent Failure
 * taxonomy described in Vision.md:
 * - invisible_state_failure (MEDIUM severity)
 * - stuck_or_phantom_loading (LOW severity)
 * - silent_permission_wall (HIGH severity)
 * - render_failure (MEDIUM severity)
 */

import test from 'node:test';
import assert from 'assert';
import { detectInvisibleStateFailures } from '../../src/verax/detect/invisible-state-failure.js';
import { detectStuckOrPhantomLoading } from '../../src/verax/detect/loading-hang-detector.js';
import { detectSilentPermissionWalls } from '../../src/verax/detect/silent-permission-wall.js';
import { detectRenderFailures } from '../../src/verax/detect/render-failure.js';

test('Taxonomy: invisible_state_failure detects network without UI change', () => {
  const traces = [{
    interaction: { type: 'button', selector: '#save-btn', label: 'Save' },
    beforeUrl: 'https://app.test/settings',
    afterUrl: 'https://app.test/settings',
    sensors: {
      network: { totalRequests: 1, requests: [{ url: '/api/save', method: 'POST', status: 200 }] },
      uiSignals: { diff: { changed: false } }
    }
  }];

  const findings = [];
  detectInvisibleStateFailures(traces, {}, findings);

  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].type, 'invisible_state_failure');
  assert.strictEqual(findings[0].severity, 'MEDIUM');
  assert.strictEqual(findings[0].impact, 'MEDIUM');
  assert(findings[0].confidence.level >= 0.7);
  assert(findings[0].evidence.totalRequests > 0);
});

test('Taxonomy: invisible_state_failure ignores when UI feedback present', () => {
  const traces = [{
    interaction: { type: 'button', selector: '#save-btn', label: 'Save' },
    beforeUrl: 'https://app.test/settings',
    afterUrl: 'https://app.test/settings',
    sensors: {
      network: { totalRequests: 1 },
      uiSignals: { diff: { changed: true } }
    }
  }];

  const findings = [];
  detectInvisibleStateFailures(traces, {}, findings);

  assert.strictEqual(findings.length, 0);
});

test('Taxonomy: stuck_or_phantom_loading detects unresolved loading', () => {
  const traces = [{
    interaction: { type: 'button', selector: '#load-btn', label: 'Load Data' },
    beforeUrl: 'https://app.test/data',
    afterUrl: 'https://app.test/data',
    sensors: {
      uiSignals: {
        after: { loadingIndicatorDetected: true, errorMessageDetected: false }
      }
    }
  }];

  const findings = [];
  detectStuckOrPhantomLoading(traces, {}, findings);

  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].type, 'stuck_or_phantom_loading');
  assert.strictEqual(findings[0].severity, 'LOW');
  assert.strictEqual(findings[0].impact, 'LOW');
  assert(findings[0].confidence.level >= 0.75);
});

test('Taxonomy: stuck_or_phantom_loading ignores when content loads', () => {
  const traces = [{
    interaction: { type: 'button', selector: '#load-btn', label: 'Load Data' },
    beforeUrl: 'https://app.test/data',
    afterUrl: 'https://app.test/data',
    dom: { beforeHash: 'abc123', afterHash: 'xyz789' },
    sensors: {
      uiSignals: { after: { loadingIndicatorDetected: true } }
    }
  }];

  const findings = [];
  detectStuckOrPhantomLoading(traces, {}, findings);

  assert.strictEqual(findings.length, 0);
});

test('Taxonomy: silent_permission_wall detects blocked action no feedback', () => {
  const traces = [{
    interaction: { type: 'button', selector: '#delete-btn', label: 'Delete', disabled: false },
    beforeUrl: 'https://app.test/admin',
    afterUrl: 'https://app.test/admin',
    sensors: {
      network: { totalRequests: 0 },
      uiSignals: {
        after: { errorMessageDetected: false, validationFeedbackDetected: false, loadingIndicatorDetected: false },
        diff: { changed: false }
      }
    }
  }];

  const findings = [];
  detectSilentPermissionWalls(traces, {}, findings);

  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].type, 'silent_permission_wall');
  assert.strictEqual(findings[0].severity, 'HIGH');
  assert.strictEqual(findings[0].impact, 'HIGH');
  assert(findings[0].confidence.level >= 0.8);
});

test('Taxonomy: silent_permission_wall ignores when error explains block', () => {
  const traces = [{
    interaction: { type: 'button', selector: '#delete-btn', label: 'Delete' },
    beforeUrl: 'https://app.test/admin',
    afterUrl: 'https://app.test/admin',
    sensors: {
      network: { totalRequests: 0 },
      uiSignals: { after: { errorMessageDetected: true }, diff: { changed: false } }
    }
  }];

  const findings = [];
  detectSilentPermissionWalls(traces, {}, findings);

  assert.strictEqual(findings.length, 0);
});

test('Taxonomy: render_failure detects state change without DOM update', () => {
  const traces = [{
    interaction: { type: 'button', selector: '#toggle-btn', label: 'Toggle' },
    beforeUrl: 'https://app.test/view',
    afterUrl: 'https://app.test/view',
    sensors: {
      network: { totalRequests: 1, requests: [{ url: '/api/toggle', method: 'POST', status: 200 }] },
      state: { changed: ['isActive'] },
      uiSignals: { after: { errorMessageDetected: false } }
    }
  }];

  const findings = [];
  detectRenderFailures(traces, {}, findings);

  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].type, 'render_failure');
  assert.strictEqual(findings[0].severity, 'MEDIUM');
  assert.strictEqual(findings[0].impact, 'MEDIUM');
  assert(findings[0].confidence.level >= 0.8);
});

test('Taxonomy: render_failure ignores when DOM updates', () => {
  const traces = [{
    interaction: { type: 'button', selector: '#toggle-btn', label: 'Toggle' },
    beforeUrl: 'https://app.test/view',
    afterUrl: 'https://app.test/view',
    dom: { beforeHash: 'abc123', afterHash: 'xyz789' },
    sensors: {
      network: { totalRequests: 1 },
      state: { changed: ['isActive'] }
    }
  }];

  const findings = [];
  detectRenderFailures(traces, {}, findings);

  assert.strictEqual(findings.length, 0);
});

test('Taxonomy: deterministic severity matrix', () => {
  const testCases = [
    {
      name: 'silent_permission_wall',
      detector: detectSilentPermissionWalls,
      expectedSeverity: 'HIGH',
      trace: {
        interaction: { type: 'button', selector: '#test', label: 'Test' },
        beforeUrl: 'https://test.com',
        afterUrl: 'https://test.com',
        sensors: {
          network: { totalRequests: 0 },
          uiSignals: { after: {}, diff: { changed: false } }
        }
      }
    },
    {
      name: 'invisible_state_failure',
      detector: detectInvisibleStateFailures,
      expectedSeverity: 'MEDIUM',
      trace: {
        interaction: { type: 'button', selector: '#test', label: 'Test' },
        beforeUrl: 'https://test.com',
        afterUrl: 'https://test.com',
        sensors: {
          network: { totalRequests: 1, requests: [] },
          uiSignals: { diff: { changed: false } }
        }
      }
    },
    {
      name: 'render_failure',
      detector: detectRenderFailures,
      expectedSeverity: 'MEDIUM',
      trace: {
        interaction: { type: 'button', selector: '#test', label: 'Test' },
        beforeUrl: 'https://test.com',
        afterUrl: 'https://test.com',
        sensors: {
          network: { totalRequests: 1, requests: [] },
          state: { changed: ['key'] },
          uiSignals: { after: {} }
        }
      }
    },
    {
      name: 'stuck_or_phantom_loading',
      detector: detectStuckOrPhantomLoading,
      expectedSeverity: 'LOW',
      trace: {
        interaction: { type: 'button', selector: '#test', label: 'Test' },
        beforeUrl: 'https://test.com',
        afterUrl: 'https://test.com',
        sensors: {
          uiSignals: { after: { loadingIndicatorDetected: true } }
        }
      }
    }
  ];

  for (const testCase of testCases) {
    const findings = [];
    testCase.detector([testCase.trace], {}, findings);
    
    if (findings.length > 0) {
      assert.strictEqual(findings[0].severity, testCase.expectedSeverity, 
        `${testCase.name} must have ${testCase.expectedSeverity} severity`);
      assert.strictEqual(findings[0].impact, testCase.expectedSeverity,
        `${testCase.name} impact must match severity`);
    }
  }
});
