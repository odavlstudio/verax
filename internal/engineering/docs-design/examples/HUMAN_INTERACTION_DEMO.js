/**
 * HUMAN INTERACTION FIDELITY DEMO
 * 
 * This demonstrates Guardian's human-like interaction patterns.
 * Run this to see how Guardian now behaves like a real person.
 */

const {
  humanClickDelay,
  humanTypingPattern,
  humanDecisionPause,
  humanAbortProbability,
  humanMaxRetries,
  humanNavigationPatience,
  explainTiming
} = require('../src/guardian/human-interaction-model');

console.log('\n🎭 GUARDIAN HUMAN INTERACTION FIDELITY DEMO\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Scenario 1: E-commerce checkout
console.log('📦 SCENARIO 1: E-commerce Checkout Flow');
console.log('   Site: https://shop.example.com/checkout\n');

const ecomUrl = 'https://shop.example.com/checkout';

console.log('   Step 1: Click "Add to Cart" button');
const addToCartDelay = humanClickDelay(ecomUrl, 'button');
console.log('   → ' + explainTiming('click', addToCartDelay));

console.log('\n   Step 2: Fill email field');
const emailText = 'john.doe@email.com';
const emailDelays = humanTypingPattern(emailText, ecomUrl, 'email');
const emailTotal = emailDelays.reduce((sum, d) => sum + d, 0);
console.log('   → ' + explainTiming('type', emailTotal) + ' (' + emailText.length + ' chars)');
console.log('   → Per-char: ' + emailDelays.slice(0, 5).join(', ') + '... ms');

console.log('\n   Step 3: Fill password field');
const passwordText = 'SecureP@ss123';
const passwordDelays = humanTypingPattern(passwordText, ecomUrl, 'password');
const passwordTotal = passwordDelays.reduce((sum, d) => sum + d, 0);
console.log('   → ' + explainTiming('type', passwordTotal) + ' (' + passwordText.length + ' chars)');
console.log('   → Per-char: ' + passwordDelays.slice(0, 5).join(', ') + '... ms');
console.log('   → Notice: Password typed ~' + Math.round(passwordTotal / emailTotal * 100) + '% slower (more careful)');

console.log('\n   Step 4: Click "Purchase" button');
const purchaseThinking = humanDecisionPause(ecomUrl, 'purchase', 0.8);
console.log('   → ' + explainTiming('decision', purchaseThinking) + ' (thinking before $$ commitment)');

console.log('\n   ✅ Total human-like time: ~' + Math.round((addToCartDelay + emailTotal + passwordTotal + purchaseThinking) / 1000) + ' seconds');

// Scenario 2: SaaS signup with failures
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('🏢 SCENARIO 2: SaaS Signup with Failures');
console.log('   Site: https://app.saas.com/signup\n');

const saasUrl = 'https://app.saas.com/signup';

console.log('   Attempt 1: Click "Sign Up" button');
const attempt1 = humanAbortProbability(saasUrl, { failureCount: 0, intentConfidence: 0.7 });
console.log('   → Result: ' + (attempt1 ? '❌ Human gives up (15% chance)' : '✅ Human continues'));

if (!attempt1) {
  console.log('\n   Attempt 2: Click "Sign Up" again (retry after failure)');
  const attempt2 = humanAbortProbability(saasUrl, { failureCount: 1, intentConfidence: 0.7 });
  console.log('   → Result: ' + (attempt2 ? '❌ Human gives up (40% chance)' : '✅ Human continues'));
  
  if (!attempt2) {
    console.log('\n   Attempt 3: Click "Sign Up" again (2nd retry)');
    const attempt3 = humanAbortProbability(saasUrl, { failureCount: 2, intentConfidence: 0.7 });
    console.log('   → Result: ' + (attempt3 ? '❌ Human gives up (80% chance)' : '✅ Human still trying'));
  }
}

const maxRetries = humanMaxRetries(saasUrl, 'click', 0.7);
console.log('\n   ℹ️  Human retry limit: ' + maxRetries + ' retries (confidence: 70%)');

// Scenario 3: Content site exploration
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('📰 SCENARIO 3: Content Site Exploration');
console.log('   Site: https://blog.example.com\n');

const blogUrl = 'https://blog.example.com';

console.log('   Click article link');
const articleDelay = humanClickDelay(blogUrl, 'link');
console.log('   → ' + explainTiming('click', articleDelay));

console.log('\n   Type search query "web development"');
const searchText = 'web development';
const searchDelays = humanTypingPattern(searchText, blogUrl, 'text');
const searchTotal = searchDelays.reduce((sum, d) => sum + d, 0);
console.log('   → ' + explainTiming('type', searchTotal) + ' (' + searchText.length + ' chars)');

const patience = humanNavigationPatience(blogUrl, 'article');
console.log('\n   Navigation patience: ' + (patience / 1000).toFixed(1) + ' seconds');
console.log('   → Human will wait this long for page to load before giving up');

// Comparison: Bot vs Human
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('🤖 vs 🧑 BOT vs HUMAN COMPARISON\n');

const testUrl = 'https://example.com/form';
const testText = 'test@example.com';

console.log('   Task: Click button + type email\n');

console.log('   🤖 BOT (before):');
console.log('      Click delay: 0ms (instant)');
console.log('      Type delay: ' + (testText.length * 50) + 'ms (fixed 50ms/char)');
console.log('      Total: ~' + (testText.length * 50) + 'ms\n');

const humanClick = humanClickDelay(testUrl, 'button');
const humanType = humanTypingPattern(testText, testUrl, 'email');
const humanTotal = humanType.reduce((sum, d) => sum + d, 0);

console.log('   🧑 HUMAN (now):');
console.log('      Click delay: ' + humanClick + 'ms (realistic reaction time)');
console.log('      Type delay: ' + humanTotal + 'ms (varied per-character)');
console.log('      Total: ~' + (humanClick + humanTotal) + 'ms\n');

console.log('   ✅ Guardian now behaves like a REAL person!');
console.log('   ✅ But still 100% deterministic (same site = same timing)');

// Determinism proof
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('🎯 DETERMINISM PROOF\n');

const proofUrl = 'https://deterministic.test';
console.log('   Running 3 times on: ' + proofUrl + '\n');

const run1 = humanClickDelay(proofUrl, 'button');
const run2 = humanClickDelay(proofUrl, 'button');
const run3 = humanClickDelay(proofUrl, 'button');

console.log('   Run 1: ' + run1 + 'ms');
console.log('   Run 2: ' + run2 + 'ms');
console.log('   Run 3: ' + run3 + 'ms');
console.log('\n   ' + (run1 === run2 && run2 === run3 ? '✅ IDENTICAL!' : '❌ DIFFERENT') + ' Same input = Same output');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('🎉 Human Interaction Fidelity: ACTIVE\n');
