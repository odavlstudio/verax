#!/usr/bin/env node

import { computeDecision, computeCoverageProvenPercent } from '../src/verax/detect/decision-engine.js';

const manifest = {
  projectName: "test",
  staticExpectations: [
    { type: "navigation", proof: "PROVEN_EXPECTATION" },
    { type: "navigation", proof: "PROVEN_EXPECTATION" }
  ]
};

const coverage = computeCoverageProvenPercent(manifest);
const decision = computeDecision([], manifest, coverage);

console.log('Decision object:');
console.log(JSON.stringify(decision, null, 2));

console.log('\nDirect checks:');
console.log('decision value:', decision.decision);
console.log('decision type:', typeof decision.decision);
console.log('decision === "PASS":', decision.decision === 'PASS');
console.log('exitCode:', decision.exitCode);
console.log('exitCode === 0:', decision.exitCode === 0);
