/**
 * Human Intent Resolver Unit Tests
 * 
 * Test the deterministic human intent resolution logic
 */

const assert = require('assert');
const { resolveHumanIntent, shouldExecuteAttempt, HUMAN_GOALS } = require('../src/guardian/human-intent-resolver');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Human Intent Resolver Unit Tests');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Test 1: Ecommerce site → BUY intent
function test1_EcommerceSiteBuyIntent() {
  console.log('TEST 1: Ecommerce site → BUY intent');
  
  const introspection = {
    hasLogin: true,
    hasSignup: false,
    hasCheckout: true,
    hasNewsletter: false,
    hasContactForm: false,
    hasLanguageSwitch: false
  };
  
  const intent = resolveHumanIntent({
    siteProfile: 'ecommerce',
    introspection,
    entryUrl: 'https://shop.example.com'
  });
  
  assert.strictEqual(intent.primaryGoal, HUMAN_GOALS.BUY, 'Primary goal should be BUY');
  assert(intent.confidence >= 0.9, 'Confidence should be high for ecommerce');
  assert(intent.reasoning.includes('BUY'), 'Reasoning should mention BUY');
  
  // Check that checkout is allowed
  const checkoutDecision = shouldExecuteAttempt('checkout', intent);
  assert.strictEqual(checkoutDecision.shouldExecute, true, 'Checkout should be allowed for BUY intent');
  
  // Check that contact_form is NOT allowed (human buying wouldn't try to contact)
  const contactDecision = shouldExecuteAttempt('contact_form', intent);
  assert.strictEqual(contactDecision.shouldExecute, false, 'Contact form should NOT be allowed for BUY intent');
  assert(contactDecision.humanReason.includes('would NOT try'), 'Should explain human reasoning');
  
  console.log('  ✓ Ecommerce correctly resolves to BUY intent');
  console.log('  ✓ Checkout allowed, contact_form blocked');
  console.log();
}

// Test 2: SaaS site → SIGN_UP intent
function test2_SaasSiteSignUpIntent() {
  console.log('TEST 2: SaaS site → SIGN_UP intent');
  
  const introspection = {
    hasLogin: true,
    hasSignup: true,
    hasCheckout: false,
    hasNewsletter: false,
    hasContactForm: true,
    hasLanguageSwitch: false
  };
  
  const intent = resolveHumanIntent({
    siteProfile: 'saas',
    introspection,
    entryUrl: 'https://app.example.com'
  });
  
  assert.strictEqual(intent.primaryGoal, HUMAN_GOALS.SIGN_UP, 'Primary goal should be SIGN_UP');
  assert(intent.confidence >= 0.8, 'Confidence should be high for SaaS');
  
  // Check that signup is allowed
  const signupDecision = shouldExecuteAttempt('signup', intent);
  assert.strictEqual(signupDecision.shouldExecute, true, 'Signup should be allowed for SIGN_UP intent');
  
  // Check that checkout is NOT allowed (SaaS users don't checkout)
  const checkoutDecision = shouldExecuteAttempt('checkout', intent);
  assert.strictEqual(checkoutDecision.shouldExecute, false, 'Checkout should NOT be allowed for SIGN_UP intent');
  
  // Check that contact_form IS allowed (secondary goal)
  const contactDecision = shouldExecuteAttempt('contact_form', intent);
  assert.strictEqual(contactDecision.shouldExecute, true, 'Contact form should be allowed as secondary goal');
  
  console.log('  ✓ SaaS correctly resolves to SIGN_UP intent');
  console.log('  ✓ Signup allowed, checkout blocked, contact allowed as secondary');
  console.log();
}

// Test 3: Content site → READ intent
function test3_ContentSiteReadIntent() {
  console.log('TEST 3: Content site → READ intent');
  
  const introspection = {
    hasLogin: false,
    hasSignup: false,
    hasCheckout: false,
    hasNewsletter: true,
    hasContactForm: true,
    hasLanguageSwitch: true,
    hasContentSignals: true
  };
  
  const intent = resolveHumanIntent({
    siteProfile: 'content',
    introspection,
    entryUrl: 'https://docs.example.com'
  });
  
  assert.strictEqual(intent.primaryGoal, HUMAN_GOALS.READ, 'Primary goal should be READ');
  assert(intent.confidence >= 0.8, 'Confidence should be high for content');
  
  // Check that checkout and login are NOT allowed (readers don't check out or log in)
  const checkoutDecision = shouldExecuteAttempt('checkout', intent);
  assert.strictEqual(checkoutDecision.shouldExecute, false, 'Checkout should NOT be allowed for READ intent');
  
  const loginDecision = shouldExecuteAttempt('login', intent);
  assert.strictEqual(loginDecision.shouldExecute, false, 'Login should NOT be allowed for READ intent');
  
  // Newsletter signup IS allowed as secondary (different from account signup)
  const newsletterDecision = shouldExecuteAttempt('newsletter_signup', intent);
  assert.strictEqual(newsletterDecision.shouldExecute, true, 'Newsletter signup should be allowed as secondary');
  
  // Universal attempts are always allowed
  const smokeDecision = shouldExecuteAttempt('site_smoke', intent);
  assert.strictEqual(smokeDecision.shouldExecute, true, 'Site smoke should always be allowed');
  
  console.log('  ✓ Content site correctly resolves to READ intent');
  console.log('  ✓ Checkout and login blocked, newsletter allowed');
  console.log();
}

// Test 4: Marketing site → CONTACT intent
function test4_MarketingSiteContactIntent() {
  console.log('TEST 4: Marketing site → CONTACT intent');
  
  const introspection = {
    hasLogin: false,
    hasSignup: false,
    hasCheckout: false,
    hasNewsletter: true,
    hasContactForm: true,
    hasLanguageSwitch: false
  };
  
  const intent = resolveHumanIntent({
    siteProfile: 'unknown',
    introspection,
    entryUrl: 'https://example.com'
  });
  
  assert.strictEqual(intent.primaryGoal, HUMAN_GOALS.CONTACT, 'Primary goal should be CONTACT');
  assert(intent.confidence >= 0.7, 'Confidence should be reasonable for marketing');
  
  // Check that contact_form is allowed
  const contactDecision = shouldExecuteAttempt('contact_form', intent);
  assert.strictEqual(contactDecision.shouldExecute, true, 'Contact form should be allowed for CONTACT intent');
  
  // Check that checkout is NOT allowed
  const checkoutDecision = shouldExecuteAttempt('checkout', intent);
  assert.strictEqual(checkoutDecision.shouldExecute, false, 'Checkout should NOT be allowed for CONTACT intent');
  
  console.log('  ✓ Marketing site correctly resolves to CONTACT intent');
  console.log('  ✓ Contact form allowed, checkout blocked');
  console.log();
}

// Test 5: Login-only site → USE_SERVICE intent
function test5_LoginOnlySiteUseServiceIntent() {
  console.log('TEST 5: Login-only site → USE_SERVICE intent');
  
  const introspection = {
    hasLogin: true,
    hasSignup: false,
    hasCheckout: false,
    hasNewsletter: false,
    hasContactForm: false,
    hasLanguageSwitch: false
  };
  
  const intent = resolveHumanIntent({
    siteProfile: 'saas',
    introspection,
    entryUrl: 'https://app.example.com/login'
  });
  
  assert.strictEqual(intent.primaryGoal, HUMAN_GOALS.USE_SERVICE, 'Primary goal should be USE_SERVICE');
  
  // Check that login is allowed
  const loginDecision = shouldExecuteAttempt('login', intent);
  assert.strictEqual(loginDecision.shouldExecute, true, 'Login should be allowed for USE_SERVICE intent');
  
  // Signup IS allowed (first-time users, though less prominent)
  const signupDecision = shouldExecuteAttempt('signup', intent);
  assert.strictEqual(signupDecision.shouldExecute, true, 'Signup should be allowed for first-time users');
  
  // Checkout is NOT allowed (not an ecommerce use case)
  const checkoutDecision = shouldExecuteAttempt('checkout', intent);
  assert.strictEqual(checkoutDecision.shouldExecute, false, 'Checkout should NOT be allowed for service apps');
  
  console.log('  ✓ Login-only site correctly resolves to USE_SERVICE intent');
  console.log('  ✓ Login and signup allowed, checkout blocked');
  console.log();
}

// Test 6: Unknown site → EXPLORE intent (conservative)
function test6_UnknownSiteExploreIntent() {
  console.log('TEST 6: Unknown site → EXPLORE intent (conservative)');
  
  const introspection = {
    hasLogin: false,
    hasSignup: false,
    hasCheckout: false,
    hasNewsletter: false,
    hasContactForm: false,
    hasLanguageSwitch: false
  };
  
  const intent = resolveHumanIntent({
    siteProfile: 'unknown',
    introspection,
    entryUrl: 'https://example.com'
  });
  
  assert.strictEqual(intent.primaryGoal, HUMAN_GOALS.EXPLORE, 'Primary goal should be EXPLORE');
  assert(intent.confidence <= 0.5, 'Confidence should be low for unknown');
  
  // Check that most attempts are allowed (conservative approach)
  const checkoutDecision = shouldExecuteAttempt('checkout', intent);
  assert.strictEqual(checkoutDecision.shouldExecute, true, 'Checkout should be allowed when exploring');
  
  const signupDecision = shouldExecuteAttempt('signup', intent);
  assert.strictEqual(signupDecision.shouldExecute, true, 'Signup should be allowed when exploring');
  
  console.log('  ✓ Unknown site correctly resolves to EXPLORE intent');
  console.log('  ✓ Most attempts allowed (conservative)');
  console.log();
}

// Test 7: Determinism - same input = same output
function test7_Determinism() {
  console.log('TEST 7: Determinism - same input produces same output');
  
  const introspection = {
    hasLogin: true,
    hasSignup: true,
    hasCheckout: true,
    hasNewsletter: false,
    hasContactForm: false,
    hasLanguageSwitch: false
  };
  
  const intent1 = resolveHumanIntent({
    siteProfile: 'ecommerce',
    introspection,
    entryUrl: 'https://shop.example.com'
  });
  
  const intent2 = resolveHumanIntent({
    siteProfile: 'ecommerce',
    introspection,
    entryUrl: 'https://shop.example.com'
  });
  
  assert.strictEqual(intent1.primaryGoal, intent2.primaryGoal, 'Same input should produce same goal');
  assert.strictEqual(intent1.confidence, intent2.confidence, 'Same input should produce same confidence');
  assert.strictEqual(intent1.reasoning, intent2.reasoning, 'Same input should produce same reasoning');
  
  console.log('  ✓ Intent resolution is deterministic');
  console.log();
}

// Run all tests
try {
  test1_EcommerceSiteBuyIntent();
  test2_SaasSiteSignUpIntent();
  test3_ContentSiteReadIntent();
  test4_MarketingSiteContactIntent();
  test5_LoginOnlySiteUseServiceIntent();
  test6_UnknownSiteExploreIntent();
  test7_Determinism();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ All tests passed!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  process.exit(0);
} catch (err) {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('❌ Test failed!');
  console.error(err.message);
  console.error(err.stack);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  process.exit(1);
}
