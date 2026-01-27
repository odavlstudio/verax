#!/usr/bin/env node

/**
 * E2E Test: Generate findings with causes and show real output
 */

import { buildFindingsReport } from '../src/verax/detect/findings-writer.js';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';


// Create synthetic findings with varying evidence
const findings = [
  {
    id: 'finding_state_001',
    type: 'missing_state_action',
    promise: { kind: 'state_mutation', value: 'authenticated = true' },
    source: { file: 'Auth.jsx', line: 42 },
    what_happened: 'User clicked login button',
    what_was_expected: 'Application state updates with user feedback',
    what_was_observed: 'State did not change or changed without feedback',
    why_it_matters: 'User took action expecting app state to change but saw no confirmation',
    confidence: 0.65,
    impact: 'HIGH',
    evidence: {
      stateMutation: true,
      domChanged: false,
      navigationOccurred: false,
      uiFeedback: false
    }
  },
  {
    id: 'finding_network_001',
    type: 'network_silent_failure',
    promise: { kind: 'network_action', value: 'POST /api/submit' },
    source: { file: 'Form.jsx', line: 85 },
    what_happened: 'User submitted form',
    what_was_expected: 'Network request succeeds with user feedback',
    what_was_observed: 'Request failed silently',
    why_it_matters: 'User submitted form but received no error notification',
    confidence: 0.75,
    impact: 'CRITICAL',
    evidence: {
      networkFailure: true,
      httpError: true,
      uiFeedback: false,
      domChanged: false
    }
  },
  {
    id: 'finding_click_001',
    type: 'silent_failure',
    promise: { kind: 'click', value: 'Save button' },
    source: { file: 'Panel.jsx', line: 120 },
    what_happened: 'User clicked Save button',
    what_was_expected: 'Observable change (network/navigation/DOM/feedback)',
    what_was_observed: 'No observable change occurred',
    why_it_matters: 'User took action but system provided no confirmation',
    confidence: 0.5,
    impact: 'MEDIUM',
    evidence: {
      interactionPerformed: true,
      networkActivity: false,
      navigationOccurred: false,
      domChanged: false,
      userFeedback: false
    }
  },
  {
    id: 'finding_no_evidence',
    type: 'silent_failure',
    promise: { kind: 'click', value: 'Unknown button' },
    source: { file: 'Unknown.jsx', line: 0 },
    what_happened: 'User action executed',
    what_was_expected: 'Observable change',
    what_was_observed: 'No observable change',
    why_it_matters: 'No feedback',
    confidence: 0.3,
    impact: 'LOW',
    evidence: {} // No evidence - should have no causes
  }
];

const {report} = buildFindingsReport({
  url: 'https://example.com/test',
  findings,
  coverageGaps: [],
  detectedAt: getTimeProvider().iso()
});

console.log('=== FINDINGS REPORT WITH CAUSES ===\n');
console.log(JSON.stringify(report, null, 2));




