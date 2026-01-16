/**
 * Test Confidence Contract v1
 */

import { computeUnifiedConfidence, computeConfidenceForFinding } from '../src/verax/core/confidence-engine.js';
import { computeConfidence } from '../src/verax/detect/confidence-engine.js';

console.log('=== CONFIDENCE CONTRACT V1 TEST ===\n');

// Test 1: Core engine with unified confidence
console.log('1. computeUnifiedConfidence (high confidence):');
const test1 = computeUnifiedConfidence({
  findingType: 'network_silent_failure',
  expectation: { proof: 'PROVEN_EXPECTATION', confidence: 0.9 },
  sensors: {
    network: { failedRequests: 1 },
    dom: { changed: true }
  },
  comparisons: { urlChanged: false, domChanged: true },
  evidence: { screenshots: ['before.png', 'after.png'] }
});
console.log(JSON.stringify(test1, null, 2));
console.log('\n');

// Test 2: Legacy detect engine
console.log('2. computeConfidence (legacy, backward compat):');
const test2 = computeConfidence({
  findingType: 'network_silent_failure',
  expectation: { proof: 'PROVEN_EXPECTATION' },
  sensors: {
    network: { totalRequests: 1, failedRequests: 1, topFailedUrls: ['http://api.test'] }
  }
});
console.log(JSON.stringify({
  score: test2.score,
  scorePct: test2.scorePct,
  level: test2.level,
  explain: test2.explain.slice(0, 3)
}, null, 2));
console.log('\n');

// Test 3: Wrapper with truth locks
console.log('3. computeConfidenceForFinding (with wrapper):');
const test3 = computeConfidenceForFinding({
  findingType: 'network_silent_failure',
  expectation: { proof: 'PROVEN_EXPECTATION' },
  sensors: {
    network: { totalRequests: 1, failedRequests: 1 }
  }
});
console.log(JSON.stringify(test3, null, 2));
console.log('\n');

console.log('=== CONTRACT VALIDATION ===');
console.log('✓ score01 is canonical (0-1):', test1.score01 >= 0 && test1.score01 <= 1);
console.log('✓ score100 derived:', test1.score100 === Math.round(test1.score01 * 100));
console.log('✓ level derived from score01:', ['HIGH', 'MEDIUM', 'LOW'].includes(test1.level));
console.log('✓ topReasons present:', Array.isArray(test1.topReasons) && test1.topReasons.length >= 2 && test1.topReasons.length <= 4);
console.log('\n');

console.log('=== THRESHOLD TEST ===');
console.log('Score 0.85+ → HIGH:', test1.score01 >= 0.85 ? test1.level === 'HIGH' : 'N/A');
console.log('Score 0.60-0.84 → MEDIUM:', test1.score01 >= 0.60 && test1.score01 < 0.85 ? test1.level === 'MEDIUM' : 'N/A');  
console.log('Score <0.60 → LOW:', test1.score01 < 0.60 ? test1.level === 'LOW' : 'N/A');
