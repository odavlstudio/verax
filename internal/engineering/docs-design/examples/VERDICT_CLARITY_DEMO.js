#!/usr/bin/env node

/**
 * Verdict Clarity Demonstration
 * Shows what the output looks like for each verdict type
 */

const { printVerdictClarity } = require('../src/guardian/verdict-clarity');

console.log('\n' + '='.repeat(70));
console.log('VERDICT CLARITY — Example Output for Each Verdict Type');
console.log('='.repeat(70));

console.log('\n\n');
console.log('═'.repeat(70));
console.log('Example 1: READY Verdict');
console.log('═'.repeat(70));

printVerdictClarity('READY', {
  reasons: [
    'All 5 critical flows completed successfully',
    'No policy violations detected',
    'Performance metrics within expected range'
  ],
  explanation: 'All core user flows completed successfully. Safe to launch.',
  tested: {
    count: 5,
    examples: ['signup', 'login', 'payment', 'checkout', 'profile']
  },
  notTested: {
    count: 2,
    reasons: {
      disabledByPreset: 2,
      userFiltered: 0,
      notApplicable: 0,
      missing: 0
    }
  },
  config: {},
  args: []
});

console.log('\n\n');
console.log('═'.repeat(70));
console.log('Example 2: FRICTION Verdict');
console.log('═'.repeat(70));

printVerdictClarity('FRICTION', {
  reasons: [
    '2 flows encountered friction signals',
    'Payment flow has timeout issues',
    'Form validation errors on signup'
  ],
  explanation: 'Some user flows encountered issues. Launch with caution.',
  tested: {
    count: 4,
    examples: ['login', 'payment', 'checkout']
  },
  notTested: {
    count: 1,
    reasons: {
      disabledByPreset: 0,
      userFiltered: 0,
      notApplicable: 1,
      missing: 0
    }
  },
  config: {},
  args: []
});

console.log('\n\n');
console.log('═'.repeat(70));
console.log('Example 3: DO_NOT_LAUNCH Verdict');
console.log('═'.repeat(70));

printVerdictClarity('DO_NOT_LAUNCH', {
  reasons: [
    'Critical payment flow failed',
    'Security validation failed on login',
    'Database connection error in checkout'
  ],
  explanation: 'Critical issues found. Do not launch until resolved.',
  tested: {
    count: 2,
    examples: ['login', 'payment']
  },
  notTested: {
    count: 3,
    reasons: {
      disabledByPreset: 3,
      userFiltered: 0,
      notApplicable: 0,
      missing: 0
    }
  },
  config: {},
  args: []
});

console.log('\n\n');
console.log('═'.repeat(70));
console.log('Example 4: No Reasons Available');
console.log('═'.repeat(70));

printVerdictClarity('FRICTION', {
  reasons: [],
  explanation: 'Insufficient data',
  tested: {
    count: 1,
    examples: []
  },
  notTested: {
    count: 0,
    reasons: {}
  },
  config: {},
  args: []
});

console.log('\n\n');
console.log('='.repeat(70));
console.log('Notes:');
console.log('='.repeat(70));
console.log(`
- All verdicts show clearly:
  * The verdict (READY / FRICTION / DO_NOT_LAUNCH)
  * What it means in plain English
  * What action to take
  
- Top Reasons (max 3) come from:
  * Rules engine decisions
  * Critical failures
  * Friction signals
  * Key findings
  
- Testing Clarity shows:
  * How many flows were tested
  * Which flows (examples)
  * Why flows were not tested (reasons)
  
- Automatic Suppression:
  * --quiet flag: output is suppressed
  * -q flag: output is suppressed
  * CI/non-TTY environments: output is suppressed
  * Machine-readable mode (future): output is suppressed
  
- Tone:
  * READY: calm, confident
  * FRICTION: cautionary, neutral
  * DO_NOT_LAUNCH: firm, protective
`);
