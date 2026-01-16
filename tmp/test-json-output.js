/**
 * JSON Output Comparison - Before and After Contract v1
 */

console.log('=== CONFIDENCE OBJECT (BEFORE) ===\n');
const before = {
  "confidence": {
    "level": "MEDIUM",
    "score": 65,
    "reasons": [
      "PROMISE_PROVEN",
      "OBS_DOM_CHANGED",
      "OBS_NETWORK_FAILURE",
      "CORR_WEAK_CORRELATION",
      "EVIDENCE_INCOMPLETE",
      "SENSOR_NETWORK_PRESENT",
      "GUARD_ANALYTICS_FILTERED"
    ]
  }
};
console.log(JSON.stringify(before, null, 2));

console.log('\n=== CONFIDENCE OBJECT (AFTER - Contract v1) ===\n');
const after = {
  "confidence": {
    "score01": 0.65,
    "score100": 65,
    "level": "MEDIUM",
    "topReasons": [
      "PROMISE_PROVEN",
      "OBS_DOM_CHANGED",
      "OBS_NETWORK_FAILURE",
      "CORR_WEAK_CORRELATION"
    ],
    "reasons": [
      "PROMISE_PROVEN",
      "OBS_DOM_CHANGED",
      "OBS_NETWORK_FAILURE",
      "CORR_WEAK_CORRELATION",
      "EVIDENCE_INCOMPLETE",
      "SENSOR_NETWORK_PRESENT",
      "GUARD_ANALYTICS_FILTERED"
    ]
  }
};
console.log(JSON.stringify(after, null, 2));

console.log('\n=== CONTRACT v1 RULES ===');
console.log('1. score01 (0.00-1.00) is CANONICAL SOURCE OF TRUTH');
console.log('2. score100 = round(score01 * 100) - DERIVED');
console.log('3. level computed from score01:');
console.log('   - HIGH:   score01 >= 0.85');
console.log('   - MEDIUM: 0.60 <= score01 < 0.85');
console.log('   - LOW:    score01 < 0.60');
console.log('4. topReasons = 2-4 most important reasons (REQUIRED)');
console.log('5. reasons = full list (optional, for deep analysis)');
console.log('6. Legacy "score" (0-100) kept for backward compat, but DO NOT use as source');
