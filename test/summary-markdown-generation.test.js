#!/usr/bin/env node

/**
 * E2E Test: Verify SUMMARY.md displays causes in markdown
 */

import { writeSummaryMarkdown } from '../src/verax/detect/summary-writer.js';
import { mkdirSync } from 'fs';
import { readFileSync } from 'fs';

const runDir = '/tmp/verax-e2e-summary-test';
mkdirSync(`${runDir}/EVIDENCE`, { recursive: true });

const findings = {
  findings: [
    {
      id: 'finding_state_001',
      type: 'missing_state_action',
      promise: { kind: 'state_mutation', value: 'authenticated = true' },
      source: { file: 'Auth.jsx', line: 42 },
      what_happened: 'User clicked login button',
      what_was_expected: 'Application state updates',
      what_was_observed: 'State changed but no feedback',
      why_it_matters: 'No confirmation shown',
      confidence: 0.65,
      impact: 'HIGH',
      evidence: [
        { type: 'screenshot', path: 'evidence/before.png', available: true }
      ],
      causes: [
        {
          id: 'C2_STATE_MUTATION_NO_UI',
          title: 'State changed but UI did not update',
          statement: 'Likely cause: Application state changed internally, but the UI did not re-render.',
          evidence_refs: ['evidence.stateMutation=true', 'evidence.domChanged=false'],
          confidence: 'MEDIUM'
        }
      ]
    },
    {
      id: 'finding_network_001',
      type: 'network_silent_failure',
      promise: { kind: 'network_action', value: 'POST /api/submit' },
      source: { file: 'Form.jsx', line: 85 },
      what_happened: 'User submitted form',
      what_was_expected: 'Network request with feedback',
      what_was_observed: 'Request failed silently',
      why_it_matters: 'No error shown',
      confidence: 0.75,
      impact: 'CRITICAL',
      evidence: [
        { type: 'screenshot', path: 'evidence/after.png', available: true }
      ],
      causes: [
        {
          id: 'C7_NETWORK_SILENT',
          title: 'Network request failed silently',
          statement: 'Likely cause: Network request failed, but the UI showed no error.',
          evidence_refs: ['evidence.networkFailure=true', 'evidence.uiFeedback=false'],
          confidence: 'MEDIUM'
        }
      ]
    }
  ],
  stats: {
    silentFailures: 2,
    coverageGaps: 0
  }
};

const learnData = {
  stats: { totalExpectations: 5 },
  projectType: 'react'
};

const observeData = {
  stats: { attempted: 5, observed: 3 }
};

try {
  const summaryPath = writeSummaryMarkdown(runDir, 'https://example.com', '/path/to/src', findings, learnData, observeData);
  const content = readFileSync(summaryPath, 'utf-8');
  
  console.log('=== GENERATED SUMMARY.MD (EXCERPT) ===\n');
  
  // Extract relevant sections
  const lines = content.split('\n');
  let inFinding = false;
  let findingLines = [];
  
  for (const line of lines) {
    if (line.includes('Finding') || line.includes('Interaction') || line.includes('Form')) {
      inFinding = true;
    }
    if (inFinding) {
      findingLines.push(line);
      if (findingLines.length > 50) break;
    }
  }
  
  console.log(findingLines.slice(0, 60).join('\n'));
  console.log('\n... (truncated) ...\n');
  
  // Check for causes in the markdown
  if (content.includes('Likely Causes:') || content.includes('Likely cause:')) {
    console.log('✓ SUMMARY.MD contains causes');
  } else {
    console.log('✗ WARNING: Causes not visible in SUMMARY.MD');
  }
  
  if (content.includes('C2_STATE_MUTATION_NO_UI')) {
    console.log('✓ C2 cause found in summary');
  }
  
  if (content.includes('C7_NETWORK_SILENT')) {
    console.log('✓ C7 cause found in summary');
  }
  
  console.log('\n✓ SUMMARY.MD generation successful');
} catch (e) {
  console.error('Error generating summary:', e.message);
  process.exit(1);
}




